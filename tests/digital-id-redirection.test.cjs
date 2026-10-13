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
    {
      Date,
      Object,
      console,
      URL,
      Buffer,
    },
    { filename },
  )(
    (name) => {
      if (Object.hasOwn(imports, name)) return imports[name];
      if (name === "@/lib/digital-id-role")
        return load("src/lib/digital-id-role.ts", domainImports);
      throw new Error(`Unexpected import: ${name}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

const domainImports = {
  "@/data/committeeRoles": load("src/data/committeeRoles.ts"),
  "@/lib/eb-mapping": load("src/lib/eb-mapping.ts"),
};
class TestResponse {
  constructor(body, options = {}) {
    this.body = body;
    this.status = options.status ?? 200;
  }
  static json(body, options = {}) {
    return new TestResponse(body, options);
  }
}
const next = { NextResponse: TestResponse };
const createdAt = new Date("2026-10-01T00:00:00.000Z");
const cycle = {
  id: "cycle-1",
  schoolYear: "2026-2027",
  membershipExpiration: null,
};
const memberId = "CSS-2627-0202";

function user(overrides = {}) {
  return {
    id: "user-1",
    name: "Test Applicant",
    email: "test@example.invalid",
    studentNumber: "1234567890",
    section: "1CS-A",
    image: null,
    role: "user",
    ebProfile: null,
    memberships: [{ memberId, createdAt, photoPath: null }],
    memberApplications: [],
    executiveAssociateApplications: [],
    committeeApplications: [
      {
        id: "application-1",
        firstOptionCommittee: "finance",
        hasAccepted: true,
        redirection: "member",
        paymentStatus: "approved",
        createdAt,
      },
    ],
    ...overrides,
  };
}

function applicantRoute(record) {
  return load("src/app/api/user/digital-id/route.ts", {
    ...domainImports,
    "next/server": next,
    "next-auth/next": {
      getServerSession: async () => ({ user: { email: record.email } }),
    },
    "@/lib/auth": { authOptions: {} },
    "@/lib/prisma": {
      prisma: {
        recruitmentCycle: { findFirst: async () => cycle },
        user: { findUnique: async () => record },
        $transaction: () => {
          throw new Error("Existing member ID must not be regenerated");
        },
      },
    },
    "@/lib/member-id": {
      ensureCycleMemberId: () => {
        throw new Error("Unexpected member ID write");
      },
    },
    "@/lib/membership-expiration": { isMembershipExpired: () => false },
  });
}

function exportRoute(record) {
  let pdfMembers;
  const route = load("src/app/api/admin/digital-ids/export/route.ts", {
    ...domainImports,
    "next/server": next,
    sharp: {
      default: () => {
        throw new Error("No photo resize expected");
      },
    },
    "next-auth": {
      getServerSession: async () => ({ user: { role: "admin" } }),
    },
    "@/lib/auth": { authOptions: {} },
    "@/lib/prisma": {
      prisma: {
        recruitmentCycle: { findFirst: async () => cycle },
        membership: {
          findMany: async () => [
            { memberId, createdAt, photoPath: null, user: record },
          ],
        },
      },
    },
    "@/lib/supabase": {
      supabase: {
        storage: {
          from: () => {
            throw new Error("No photo download expected");
          },
        },
      },
    },
    "@/lib/digital-id-pdf": {
      createDigitalIdPdf: async (members) => {
        pdfMembers = members;
        return Buffer.from("mock PDF");
      },
    },
  });
  return { route, getPdfMembers: () => pdfMembers };
}

test("Finance canonical application redirected to Member displays Official Member without regenerating ID", async () => {
  const result = await applicantRoute(user()).GET();
  assert.equal(result.status, 200);
  assert.equal(result.body.isEligible, true);
  assert.equal(result.body.roleTitle, "Official Member");
  assert.equal(result.body.applicationType, "member");
  assert.equal(result.body.memberId, memberId);
});

test("admin print data uses the redirected destination, not the original Finance choice", async () => {
  const { route } = exportRoute(user());
  const result = await route.GET({
    url: "https://example.invalid/api/admin/digital-ids/export?format=print-data",
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.members[0].roleTitle, "Official Member");
  assert.equal(result.body.members[0].memberId, memberId);
});

test("PDF generation receives the same redirected role as print data", async () => {
  const { route, getPdfMembers } = exportRoute(user());
  const result = await route.GET({
    url: "https://example.invalid/api/admin/digital-ids/export",
  });
  assert.equal(result.status, 200);
  assert.equal(getPdfMembers()[0].roleTitle, "Official Member");
  assert.equal(getPdfMembers()[0].memberId, memberId);
});

test("accepted cross-type and same-type redirects resolve to their destinations", () => {
  const { getApprovedDigitalIdRole } = load(
    "src/lib/digital-id-role.ts",
    domainImports,
  );
  const cases = [
    ["member", "member", "Official Member"],
    ["treasurer", "ea", "Executive Associate (Treasurer)"],
    [
      "representative-1st-year",
      "ea",
      "Executive Associate (1st Year Representative)",
    ],
    ["committee-technology", "committee", "Staff - Technology Development"],
    ["technology", "committee", "Staff - Technology Development"],
    [
      "Technology Development Committee",
      "committee",
      "Staff - Technology Development",
    ],
    ["publicity", "committee", "Staff - Publicity"],
  ];
  for (const [redirection, type, title] of cases) {
    for (const source of ["committee", "ea"]) {
      const record =
        source === "committee"
          ? user({
              committeeApplications: [
                {
                  firstOptionCommittee: "finance",
                  hasAccepted: true,
                  redirection,
                  paymentStatus: "approved",
                },
              ],
            })
          : user({
              committeeApplications: [],
              executiveAssociateApplications: [
                {
                  ebRole: "secretary",
                  firstOptionEb: "secretary",
                  hasAccepted: true,
                  redirection,
                  paymentStatus: "approved",
                },
              ],
            });
      const role = getApprovedDigitalIdRole(record);
      assert.equal(role.applicationType, type);
      assert.equal(role.roleTitle, title);
    }
  }
});

test("pending or unknown redirects retain the existing source role", () => {
  const { getApprovedDigitalIdRole } = load(
    "src/lib/digital-id-role.ts",
    domainImports,
  );
  for (const [hasAccepted, redirection] of [
    [false, "member"],
    [true, "unknown-destination"],
  ]) {
    const record = user({
      committeeApplications: [
        {
          firstOptionCommittee: "finance",
          hasAccepted,
          redirection,
          paymentStatus: "approved",
        },
      ],
    });
    assert.equal(getApprovedDigitalIdRole(record).roleTitle, "Staff - Finance");
  }
});

test("non-redirected Finance staff and EB overrides retain their existing ID roles", async () => {
  const staff = user({
    committeeApplications: [
      {
        firstOptionCommittee: "finance",
        hasAccepted: true,
        redirection: null,
        paymentStatus: "approved",
      },
    ],
  });
  assert.equal(
    (await applicantRoute(staff).GET()).body.roleTitle,
    "Staff - Finance",
  );
  const eb = user({
    role: "admin",
    ebProfile: { position: "treasurer", isActive: true },
  });
  assert.equal(
    (await applicantRoute(eb).GET()).body.roleTitle,
    "Executive Board - Treasurer",
  );
});

test("an unapproved redirected receipt still cannot unlock the ID or enter print data", async () => {
  const record = user({
    committeeApplications: [
      {
        firstOptionCommittee: "finance",
        hasAccepted: true,
        redirection: "member",
        paymentStatus: "needs_revision",
      },
    ],
  });
  assert.equal((await applicantRoute(record).GET()).body.isEligible, false);
  assert.equal(
    (
      await exportRoute(record).route.GET({
        url: "https://example.invalid/?format=print-data",
      })
    ).status,
    404,
  );
});
