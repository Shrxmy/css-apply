const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function load(relativePath, imports = {}) {
  const filename = path.resolve(__dirname, "..", relativePath);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const module = { exports: {} };
  vm.runInNewContext(
    `(function(require, module, exports) { ${outputText}\n})`,
    { URL },
    { filename },
  )(
    (name) => {
      if (name === "server-only") return {};
      if (name === "zod") return require("zod");
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error(`Unexpected import: ${name}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const cycle = { id: "active-cycle", schoolYear: "2026-2027" };
const domainImports = {
  "@/data/committeeRoles": load("src/data/committeeRoles.ts"),
  "@/lib/eb-mapping": load("src/lib/eb-mapping.ts"),
};
const user = (id, email = `${id}@example.org`, name = `Name ${id}`) => ({
  id,
  email,
  name,
});
const application = (record, overrides = {}) => ({
  user: record,
  recruitmentCycleId: cycle.id,
  hasAccepted: true,
  paymentStatus: "not_submitted",
  redirection: null,
  firstOptionCommittee: "finance",
  ebRole: "secretary",
  firstOptionEb: "treasurer",
  ...overrides,
});

function setup({
  members = [],
  staff = [],
  eas = [],
  activeCycle = cycle,
} = {}) {
  const calls = [];
  const findMany = (model, rows) => async (query) => {
    calls.push({ model, query: plain(query) });
    const matches = rows.filter((row) =>
      Object.entries(query.where).every(([key, value]) => row[key] === value),
    );
    // Respect the selection: the implementation must not depend on payment,
    // acceptance or other fields it did not request.
    return matches.map((row) =>
      Object.fromEntries(
        Object.entries(query.select).map(([key, selection]) => [
          key,
          selection === true
            ? row[key]
            : Object.fromEntries(
                Object.keys(selection.select).map((field) => [
                  field,
                  row[key][field],
                ]),
              ),
        ]),
      ),
    );
  };
  const db = {
    recruitmentCycle: {
      findFirst: async (query) => {
        calls.push({ model: "recruitmentCycle", query: plain(query) });
        return activeCycle;
      },
    },
    memberApplication: { findMany: findMany("memberApplication", members) },
    committeeApplication: { findMany: findMany("committeeApplication", staff) },
    executiveAssociateApplication: {
      findMany: findMany("executiveAssociateApplication", eas),
    },
  };
  const { getEmailCampaignAudience } = load(
    "src/lib/email-campaign-recipients.ts",
    {
      ...domainImports,
      "@/lib/prisma": { prisma: db },
    },
  );
  return { db, calls, getEmailCampaignAudience };
}

test("no active cycle returns zero counts without querying applications", async () => {
  const { calls, getEmailCampaignAudience } = setup({ activeCycle: null });
  assert.deepEqual(plain(await getEmailCampaignAudience()), {
    cycle: null,
    counts: { ea: 0, staff: 0, member: 0 },
    recipients: [],
  });
  assert.deepEqual(calls, [
    {
      model: "recruitmentCycle",
      query: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        select: { id: true, schoolYear: true },
      },
    },
  ]);
});

test("only accepted active-cycle applications qualify, regardless of every payment state", async () => {
  const states = [
    "not_submitted",
    "pending",
    "needs_revision",
    "rejected",
    "approved",
  ];
  const rows = states.map((paymentStatus, index) =>
    application(user(`u${index}`), { paymentStatus }),
  );
  rows.push(
    application(user("pending"), {
      hasAccepted: false,
      paymentStatus: "approved",
    }),
  );
  rows.push(
    application(user("old"), {
      recruitmentCycleId: "old-cycle",
      paymentStatus: "approved",
    }),
  );
  rows.push(
    application(user("legacy"), {
      recruitmentCycleId: null,
      paymentStatus: "approved",
    }),
  );
  const { calls, db, getEmailCampaignAudience } = setup({
    members: rows,
    staff: rows,
    eas: rows,
  });
  const audience = plain(await getEmailCampaignAudience(db));
  assert.deepEqual(audience.cycle, cycle);
  assert.equal(audience.recipients.length, states.length);
  assert.deepEqual(audience.counts, { ea: 5, staff: 5, member: 5 });
  for (const recipient of audience.recipients) {
    assert.deepEqual(recipient.groups, ["ea", "staff", "member"]);
    assert.deepEqual(recipient.positions, [
      "Executive Associate (Secretary)",
      "Official Member",
      "Staff - Finance",
    ]);
  }
  const selections = {
    memberApplication: {
      user: { select: { id: true, name: true, email: true } },
    },
    committeeApplication: {
      user: { select: { id: true, name: true, email: true } },
      redirection: true,
      firstOptionCommittee: true,
    },
    executiveAssociateApplication: {
      user: { select: { id: true, name: true, email: true } },
      redirection: true,
      ebRole: true,
      firstOptionEb: true,
    },
  };
  for (const { model, query } of calls.slice(1)) {
    assert.deepEqual(query.where, {
      hasAccepted: true,
      recruitmentCycleId: cycle.id,
    });
    assert.deepEqual(query.select, selections[model]);
    assert.doesNotMatch(
      JSON.stringify(query),
      /payment|status|studentNumber|paymentProof/i,
    );
  }
});

test("canonical accepted redirects replace source group for both staff and EA applications", async () => {
  const cases = [
    ["member", "member", "Official Member"],
    [" MEMBER ", "member", "Official Member"],
    ["committee-technology", "staff", "Staff - Technology Development"],
    [
      "committee-Technology Development Committee",
      "staff",
      "Staff - Technology Development",
    ],
    ["technology", "staff", "Staff - Technology Development"],
    ["Technology Development", "staff", "Staff - Technology Development"],
    [
      "Technology Development Committee",
      "staff",
      "Staff - Technology Development",
    ],
    ["publicity", "staff", "Staff - Publicity"],
    ["treasurer", "ea", "Executive Associate (Treasurer)"],
    ["Treasurer", "ea", "Executive Associate (Treasurer)"],
    [
      "representative-1st-year",
      "ea",
      "Executive Associate (1st Year Representative)",
    ],
    [
      "Public Relations Officer (PRO)",
      "ea",
      "Executive Associate (Public Relations Officer (PRO))",
    ],
  ];
  for (const source of ["staff", "eas"]) {
    for (const [redirection, group, position] of cases) {
      const { getEmailCampaignAudience } = setup({
        [source]: [application(user("redirected"), { redirection })],
      });
      const audience = plain(await getEmailCampaignAudience());
      assert.deepEqual(
        audience.recipients[0].groups,
        [group],
        `${source}: ${redirection}`,
      );
      assert.deepEqual(
        audience.recipients[0].positions,
        [position],
        `${source}: ${redirection}`,
      );
      assert.deepEqual(audience.counts, {
        ea: Number(group === "ea"),
        staff: Number(group === "staff"),
        member: Number(group === "member"),
      });
    }
  }
});

test("unknown redirects keep source group, EA source supports role titles and first choice fallback", async () => {
  const { getEmailCampaignAudience } = setup({
    staff: [application(user("staff"), { redirection: "unknown-destination" })],
    eas: [
      application(user("ea"), {
        redirection: "unknown-destination",
        ebRole: "Treasurer",
      }),
      application(user("fallback"), {
        redirection: null,
        ebRole: "",
        firstOptionEb: "president",
      }),
    ],
  });
  const recipients = plain((await getEmailCampaignAudience()).recipients);
  const byId = Object.fromEntries(
    recipients.map((recipient) => [recipient.userId, recipient]),
  );
  assert.deepEqual(byId.staff.groups, ["staff"]);
  assert.deepEqual(byId.staff.positions, ["Staff - Finance"]);
  assert.deepEqual(byId.ea.groups, ["ea"]);
  assert.deepEqual(byId.ea.positions, ["Executive Associate (Treasurer)"]);
  assert.deepEqual(byId.fallback.positions, [
    "Executive Associate (President)",
  ]);
});

test("invalid and unsafe email addresses are excluded; valid addresses normalize case and whitespace", async () => {
  const invalid = [
    "",
    "not-an-email",
    "a@",
    "@example.org",
    "a@example",
    "a..b@example.org",
    "a@-example.org",
    "a@example..org",
    "a@example.org\r\nBcc: bad@example.org",
    "a@exam\tple.org",
  ];
  const members = invalid.map((email, i) =>
    application(user(`invalid-${i}`, email)),
  );
  members.push(application(user("valid", " Valid+tag@Example.ORG ")));
  const { getEmailCampaignAudience } = setup({ members });
  const audience = plain(await getEmailCampaignAudience());
  assert.equal(audience.recipients.length, 1);
  assert.equal(audience.recipients[0].email, "valid+tag@example.org");
  assert.deepEqual(audience.counts, { ea: 0, staff: 0, member: 1 });
});

test("case-duplicate accounts and repeated user IDs merge transitively with a stable eligible representative", async () => {
  const rows = [
    application(user("z-user", "Shared@Example.org", "Zed")),
    application(user("a-user", "shared@example.org", "Alice")),
    application(user("z-user", "second@example.org", "Zed")),
    application(user("b-user", "SECOND@example.org", "Bob")),
    application(user("separate", "separate@example.org")),
  ];
  const staff = [
    application(user("b-user", "second@example.org"), {
      firstOptionCommittee: "technology",
    }),
  ];
  const eas = [application(user("z-user", "shared@example.org"))];
  const run = async (members) =>
    plain(await setup({ members, staff, eas }).getEmailCampaignAudience());
  const forward = await run(rows);
  assert.deepEqual(await run([...rows].reverse()), forward);
  assert.equal(forward.recipients.length, 2);
  const merged = forward.recipients.find(
    (recipient) => recipient.userId === "a-user",
  );
  assert.ok(
    merged,
    "representative must be an accepted account, not a synthesized ID",
  );
  assert.equal(merged.name, "Alice");
  assert.equal(merged.email, "shared@example.org");
  assert.deepEqual(merged.groups, ["ea", "staff", "member"]);
  assert.deepEqual(merged.positions, [
    "Executive Associate (Secretary)",
    "Official Member",
    "Staff - Technology Development",
  ]);
  assert.deepEqual(forward.counts, { ea: 1, staff: 1, member: 2 });
  assert.equal(
    new Set(forward.recipients.map((recipient) => recipient.userId)).size,
    2,
  );
  assert.equal(
    new Set(forward.recipients.map((recipient) => recipient.email)).size,
    2,
  );
});

test("duplicate positions are unique and deterministically ordered independently of row order", async () => {
  const person = user("multi");
  const staff = ["technology", "finance", "technology"].map(
    (firstOptionCommittee) => application(person, { firstOptionCommittee }),
  );
  const run = async (rows) =>
    plain(await setup({ staff: rows }).getEmailCampaignAudience());
  const result = await run(staff);
  assert.deepEqual(await run([...staff].reverse()), result);
  assert.deepEqual(result.recipients[0].groups, ["staff"]);
  assert.deepEqual(result.recipients[0].positions, [
    "Staff - Finance",
    "Staff - Technology Development",
  ]);
  assert.deepEqual(result.counts, { ea: 0, staff: 1, member: 0 });
});

test("database failures propagate instead of reporting a misleading empty audience", async () => {
  const { db, getEmailCampaignAudience } = setup();
  db.committeeApplication.findMany = async () => {
    throw new Error("database unavailable");
  };
  await assert.rejects(getEmailCampaignAudience(db), /database unavailable/);
});
