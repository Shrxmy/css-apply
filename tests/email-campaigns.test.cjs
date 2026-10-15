const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const { z } = require("zod");

function load(relativePath, imports = {}, consoleOverride = console) {
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
      console: consoleOverride,
    },
    { filename },
  )(
    (name) => {
      if (name === "server-only") return {};
      if (Object.hasOwn(imports, name)) return imports[name];
      if (name === "zod") return require(name);
      throw new Error(`Unexpected import: ${name}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

// Deliberately stub collaborators: this suite tests service validation and lifecycle,
// not the separately-owned template renderer or audience query implementation.
const campaignContentSchema = z
  .object({
    templateType: z.enum(["event", "reminder"]),
    subject: z.string().trim().min(1).max(200),
    title: z.string().min(1),
    body: z.string().min(1),
    eventDate: z.string().optional(),
    eventTime: z.string().optional(),
    eventVenue: z.string().optional(),
    ctaLabel: z.string().optional(),
    ctaUrl: z.url().optional(),
  })
  .strict();
const contract = load("src/lib/email-campaign-contract.ts");
const actor = { id: "super-1", name: "Administrator" };
const id = "9b182d5e-80a9-4b13-9833-123456789abc";
const content = {
  templateType: "event",
  subject: "Event announcement",
  title: "CSS event",
  body: "Please join us.",
};
const input = (overrides = {}) => ({
  clientRequestId: id,
  recruitmentCycleId: "cycle-1",
  content,
  recipientIds: ["u1", "u2"],
  ...overrides,
});
const recipient = (userId, groups = ["member"]) => ({
  userId,
  name: `Name ${userId}`,
  email: `${userId}@example.invalid`,
  groups,
  positions: [],
});
const clone = (value) => structuredClone(value);

function harness({
  provider,
  trackingFailure = false,
  claimFailure = false,
} = {}) {
  const state = {
    rows: new Map(),
    calls: [],
    writes: [],
    logs: [],
    audienceReads: 0,
    audience: {
      cycle: { id: "cycle-1", schoolYear: "2026-2027" },
      counts: { ea: 1, staff: 1, member: 1 },
      recipients: [recipient("u1", ["ea", "staff"]), recipient("u2")],
    },
    trackingFailure,
    claimFailure,
  };
  let txTail = Promise.resolve();
  const matches = (row, where) =>
    Object.entries(where).every(([key, value]) =>
      key === "id" && value && typeof value === "object"
        ? value.in.includes(row.id)
        : row[key] === value,
    );
  const db = {
    emailCampaign: {
      findUnique: async ({ where }) => clone(state.rows.get(where.id) ?? null),
      findMany: async ({ take, orderBy, select }) => {
        assert.equal(take, 50);
        assert.equal(orderBy[0].createdAt, "desc");
        assert.equal(select.content, undefined);
        assert.deepEqual(Object.keys(select.recipients.select), ["status"]);
        return [...state.rows.values()]
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, take)
          .map(clone);
      },
      create: async ({ data }) => {
        if (state.rows.has(data.id))
          throw Object.assign(new Error("duplicate"), { code: "P2002" });
        const now = new Date();
        const row = {
          ...clone(data),
          status: "DRAFT",
          startedAt: null,
          acceptedAt: null,
          messageIds: null,
          errorMessage: null,
          createdAt: now,
          updatedAt: now,
          recipients: data.recipients.create.map((r, index) => ({
            ...clone(r),
            id: `r-${index}`,
            campaignId: data.id,
            status: "PENDING",
            acceptedAt: null,
            createdAt: now,
            updatedAt: now,
          })),
        };
        state.rows.set(data.id, row);
        state.writes.push(["create", data.id]);
        return clone(row);
      },
      updateMany: async ({ where, data }) => {
        state.writes.push(["campaign", clone(data)]);
        if (state.claimFailure && data.status === "SENDING")
          throw new Error("claim unavailable");
        if (state.trackingFailure && data.status !== "SENDING")
          throw new Error("tracking unavailable; private provider details");
        let count = 0;
        for (const row of state.rows.values())
          if (matches(row, where)) {
            Object.assign(row, clone(data), { updatedAt: new Date() });
            count++;
          }
        return { count };
      },
    },
    emailCampaignRecipient: {
      updateMany: async ({ where, data }) => {
        state.writes.push(["recipients", clone(data)]);
        let count = 0;
        for (const row of state.rows.values())
          for (const r of row.recipients)
            if (matches(r, where)) {
              Object.assign(r, clone(data));
              count++;
            }
        return { count };
      },
    },
    // Serializable in-memory transactions with rollback: never use a real database.
    $transaction: (callback) => {
      const work = txTail.then(async () => {
        const before = clone(state.rows);
        try {
          return await callback(db);
        } catch (error) {
          state.rows = before;
          throw error;
        }
      });
      txTail = work.catch(() => {});
      return work;
    },
  };
  const service = load(
    "src/lib/email-campaigns.ts",
    {
      "@/lib/prisma": { prisma: db },
      "@/lib/email-campaign-contract": contract,
      "@/lib/email-campaign-content": {
        campaignContentSchema,
        buildCampaignEmail: (c) => ({
          subject: c.subject,
          html: `<p>${c.body}</p>`,
        }),
      },
      "@/lib/email-campaign-recipients": {
        getEmailCampaignAudience: async () => {
          state.audienceReads++;
          return clone(state.audience);
        },
      },
      "@/lib/email": {
        sendEmailBatch: async (...args) => {
          state.calls.push(clone(args));
          return provider
            ? provider(...args)
            : {
                success: true,
                sentCount: args[0].length,
                messageId: "batch-id",
                messageIds: ["m1", "m2"],
              };
        },
      },
    },
    { error: (...args) => state.logs.push(args) },
  );
  return { service, state, db };
}

const rejectsStatus = (promise, status, message) =>
  assert.rejects(
    promise,
    (error) =>
      error.name === "EmailCampaignError" &&
      error.status === status &&
      (!message || message.test(error.message)),
  );

test("draft snapshots are server-derived, lowercased, immutable and never dispatch", async () => {
  const { service, state } = harness();
  state.audience.recipients[0].email = "U1@Example.Invalid";
  const detail = await service.createEmailCampaign(input(), actor);
  assert.equal(detail.id, id);
  assert.equal(detail.status, "DRAFT");
  assert.equal(detail.recipients[0].email, "u1@example.invalid");
  assert.deepEqual([...detail.recipients[0].groups], ["ea", "staff"]);
  assert.equal(detail.counts.total, 2);
  assert.equal(detail.counts.pending, 2);
  assert.equal(typeof detail.createdAt, "string");
  assert.equal(detail.startedAt, null);
  assert.equal(detail.createdById, undefined);
  assert.equal(detail.messageIds, undefined);
  state.audience.recipients[0].name = "Changed later";
  assert.equal(
    (await service.getEmailCampaign(id)).recipients[0].name,
    "Name u1",
  );
  assert.equal(state.calls.length, 0);
});

test("strict create rejects raw-email injection, malformed content, IDs and recipient limits without writes", async () => {
  const { service, state } = harness();
  for (const payload of [
    null,
    {},
    input({ emails: ["injected@example.invalid"] }),
    input({ recipients: [{ email: "injected@example.invalid" }] }),
    input({ confirmed: true }),
    input({ clientRequestId: undefined }),
    input({ clientRequestId: "not-uuid" }),
    input({ recruitmentCycleId: { not: null } }),
    input({ recipientIds: [] }),
    input({ recipientIds: ["u1", "u1"] }),
    input({ recipientIds: [""] }),
    input({ recipientIds: [{ userId: "u1" }] }),
    input({ recipientIds: Array.from({ length: 251 }, (_, i) => `u${i}`) }),
    input({ content: { ...content, html: "injected" } }),
    input({ content: { ...content, templateType: "custom" } }),
    input({ content: { ...content, subject: "" } }),
  ]) {
    await rejectsStatus(service.createEmailCampaign(payload, actor), 400);
  }
  assert.equal(state.writes.length, 0);
  assert.equal(state.calls.length, 0);
});

test("exactly 250 recipients are permitted", async () => {
  const { service, state } = harness();
  state.audience.recipients = Array.from({ length: 250 }, (_, i) =>
    recipient(`u${i}`),
  );
  const draft = await service.createEmailCampaign(
    input({ recipientIds: state.audience.recipients.map((r) => r.userId) }),
    actor,
  );
  assert.equal(draft.counts.total, 250);
  assert.equal((await service.sendEmailCampaign(id)).counts.accepted, 250);
  assert.equal(state.calls[0][0].length, 250);
});

test("stale/no active cycle or ineligible selected IDs reject creation without writes", async () => {
  for (const change of [
    (s) => {
      s.audience.cycle = null;
    },
    (s) => {
      s.audience.cycle.id = "other";
    },
    (s) => {
      s.audience.recipients.pop();
    },
  ]) {
    const { service, state } = harness();
    change(state);
    await rejectsStatus(service.createEmailCampaign(input(), actor), 409);
    assert.equal(state.writes.length, 0);
  }
});

test("duplicate request IDs return the original snapshot even after the audience changes", async () => {
  const { service, state } = harness();
  await service.createEmailCampaign(input(), actor);
  state.audience.cycle = null;
  const again = await service.createEmailCampaign(
    input({ recipientIds: ["u2", "u1"] }),
    { ...actor, name: "Renamed" },
  );
  assert.equal(again.id, id);
  assert.equal(state.writes.filter(([kind]) => kind === "create").length, 1);
  for (const [payload, who] of [
    [input({ content: { ...content, body: "Changed" } }), actor],
    [input({ recipientIds: ["u1"] }), actor],
    [input({ recruitmentCycleId: "other" }), actor],
    [input(), { id: "other", name: "Other" }],
  ]) {
    await rejectsStatus(service.createEmailCampaign(payload, who), 409);
  }
  assert.equal(state.calls.length, 0);
});

test("simultaneous creates with the same ID create only one draft", async () => {
  const { service, state } = harness();
  const results = await Promise.all([
    service.createEmailCampaign(input(), actor),
    service.createEmailCampaign(input(), actor),
  ]);
  assert.equal(results[0].id, results[1].id);
  assert.equal(state.rows.size, 1);
});

test("provider acceptance uses one no-retry bounded call and exactly two tracking bulk updates", async () => {
  const { service, state } = harness();
  await service.createEmailCampaign(input(), actor);
  const detail = await service.sendEmailCampaign(id);
  assert.equal(detail.status, "ACCEPTED");
  assert.equal(detail.counts.accepted, 2);
  assert.equal(detail.counts.sending, 0);
  assert.equal(detail.acceptedAt, state.rows.get(id).acceptedAt.toISOString());
  assert.ok(detail.startedAt);
  assert.deepEqual(state.calls, [
    [
      ["u1@example.invalid", "u2@example.invalid"],
      content.subject,
      `<p>${content.body}</p>`,
      { maxRetries: 0, timeoutInSeconds: 30 },
    ],
  ]);
  assert.deepEqual(state.rows.get(id).messageIds, {
    messageId: "batch-id",
    messageIds: ["m1", "m2"],
  });
  assert.equal(
    state.writes.filter(([, data]) => data?.status === "ACCEPTED").length,
    2,
  );
  assert.equal((await service.sendEmailCampaign(id)).status, "ACCEPTED");
  // An ambiguous create response retried after sending cannot create another send.
  assert.equal(
    (await service.createEmailCampaign(input(), actor)).status,
    "ACCEPTED",
  );
  assert.equal(state.calls.length, 1);
});

test("concurrent send CAS allows only one provider call", async () => {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const { service, state } = harness({
    provider: async () => {
      await pending;
      return { success: true, messageIds: ["accepted"] };
    },
  });
  await service.createEmailCampaign(input(), actor);
  const first = service.sendEmailCampaign(id);
  const second = rejectsStatus(service.sendEmailCampaign(id), 409);
  // Drain scheduled claims without releasing the provider.
  await new Promise((resolve) => setImmediate(resolve));
  await second;
  assert.equal(state.calls.length, 1);
  assert.equal(state.rows.get(id).status, "SENDING");
  release();
  assert.equal((await first).status, "ACCEPTED");
});

test("stale cycle, lost acceptance or changed email leave the draft completely unchanged", async () => {
  for (const change of [
    (s) => {
      s.audience.cycle = null;
    },
    (s) => {
      s.audience.cycle.id = "new-cycle";
    },
    (s) => {
      s.audience.recipients.pop();
    },
    (s) => {
      s.audience.recipients[0].email = "changed@example.invalid";
    },
  ]) {
    const { service, state } = harness();
    await service.createEmailCampaign(input(), actor);
    const before = clone(state.rows.get(id));
    change(state);
    await rejectsStatus(service.sendEmailCampaign(id), 409);
    assert.deepEqual(clone(state.rows.get(id)), before);
    assert.equal(state.calls.length, 0);
  }
});

test("invalid or inconsistent saved content and recipient snapshots never dispatch", async () => {
  for (const change of [
    (r) => {
      r.content.html = "unsafe";
    },
    (r) => {
      r.content.templateType = "invalid";
    },
    (r) => {
      r.subject = "tampered subject";
    },
    (r) => {
      r.recipients[0].groups = ["injected"];
    },
    (r) => {
      r.recipients = [];
    },
    (r) => {
      r.recipients[0].status = "SENDING";
    },
  ]) {
    const { service, state } = harness();
    await service.createEmailCampaign(input(), actor);
    change(state.rows.get(id));
    await rejectsStatus(service.sendEmailCampaign(id), 409);
    assert.equal(state.rows.get(id).status, "DRAFT");
    assert.equal(state.calls.length, 0);
  }
});

test("claim and recipient-claim failures cannot dispatch; transaction rollback preserves draft", async () => {
  const unavailable = harness({ claimFailure: true });
  await unavailable.service.createEmailCampaign(input(), actor);
  await rejectsStatus(unavailable.service.sendEmailCampaign(id), 502);
  assert.equal(unavailable.state.calls.length, 0);
  const { service, state, db } = harness();
  await service.createEmailCampaign(input(), actor);
  db.emailCampaignRecipient.updateMany = async () => ({ count: 1 });
  await rejectsStatus(service.sendEmailCampaign(id), 409);
  assert.equal(state.rows.get(id).status, "DRAFT");
  assert.equal(state.calls.length, 0);
});

test("definitive 4xx provider rejections become FAILED; ambiguous outcomes become UNKNOWN, never retry", async () => {
  for (const [error, expected, throws] of [
    [{ statusCode: 400, body: "private" }, "FAILED"],
    [{ statusCode: 401 }, "FAILED"],
    [{ statusCode: 429 }, "FAILED"],
    [{ statusCode: 408 }, "UNKNOWN"],
    [{ statusCode: 500 }, "UNKNOWN"],
    [{ status: 503 }, "UNKNOWN"],
    [new Error("network private@example.invalid"), "UNKNOWN", true],
    [{ name: "TimeoutError" }, "UNKNOWN", true],
  ]) {
    const { service, state } = harness({
      provider: async () => {
        if (throws) throw error;
        return { success: false, error };
      },
    });
    await service.createEmailCampaign(input(), actor);
    const detail = await service.sendEmailCampaign(id);
    assert.equal(detail.status, expected);
    assert.equal(detail.counts[expected.toLowerCase()], 2);
    assert.equal(detail.acceptedAt, null);
    assert.equal(/private|@/.test(detail.errorMessage), false);
    await rejectsStatus(service.sendEmailCampaign(id), 409);
    assert.equal(state.calls.length, 1);
  }
});

test("provider acceptance followed by tracking failure is safe, diagnosable and cannot resend", async () => {
  const { service, state } = harness({ trackingFailure: true });
  await service.createEmailCampaign(input(), actor);
  await rejectsStatus(
    service.sendEmailCampaign(id),
    502,
    /provider accepted.*tracking failed.*do not resend/i,
  );
  assert.ok(["SENDING", "UNKNOWN"].includes(state.rows.get(id).status));
  assert.match(JSON.stringify(state.logs), /batch-id/);
  assert.match(JSON.stringify(state.logs), /m1/);
  assert.match(JSON.stringify(state.logs), /recipientCount/);
  assert.doesNotMatch(
    JSON.stringify(state.logs),
    /example\.invalid|Please join|private provider/,
  );
  await rejectsStatus(service.sendEmailCampaign(id), 409);
  assert.equal(state.calls.length, 1);
});

test("recipient tracking failure rolls back provider acceptance and best-effort records UNKNOWN", async () => {
  const { service, state, db } = harness();
  await service.createEmailCampaign(input(), actor);
  const update = db.emailCampaignRecipient.updateMany;
  db.emailCampaignRecipient.updateMany = async (args) => {
    if (args.data.status === "ACCEPTED")
      throw new Error("recipient update failed");
    return update(args);
  };
  await rejectsStatus(service.sendEmailCampaign(id), 502);
  assert.equal(state.rows.get(id).status, "UNKNOWN");
  assert.equal(
    state.rows.get(id).recipients.every((r) => r.status === "UNKNOWN"),
    true,
  );
  assert.deepEqual(state.rows.get(id).messageIds, {
    messageId: "batch-id",
    messageIds: ["m1", "m2"],
  });
  await rejectsStatus(service.sendEmailCampaign(id), 409);
  assert.equal(state.calls.length, 1);
});

test("crash-stuck SENDING is displayed as uncertain and is never reset or retried", async () => {
  const { service, state } = harness();
  await service.createEmailCampaign(input(), actor);
  state.rows.get(id).status = "SENDING";
  state.rows.get(id).recipients.forEach((r) => {
    r.status = "SENDING";
  });
  const detail = await service.getEmailCampaign(id);
  assert.equal(detail.status, "SENDING");
  assert.match(detail.errorMessage, /uncertain|unknown/i);
  await rejectsStatus(service.sendEmailCampaign(id), 409);
  assert.equal(state.calls.length, 0);
  assert.equal(state.rows.get(id).status, "SENDING");
});

test("history returns most recent 50 with all status counts and no content or recipients", async () => {
  const { service, state } = harness();
  await service.createEmailCampaign(input(), actor);
  const base = clone(state.rows.get(id));
  state.rows.clear();
  for (let i = 0; i < 55; i++)
    state.rows.set(`history-${i}`, {
      ...clone(base),
      id: `history-${i}`,
      createdAt: new Date(1700000000000 + i),
      recipients: [
        "PENDING",
        "SENDING",
        "ACCEPTED",
        "FAILED",
        "UNKNOWN",
        "ACCEPTED",
      ].map((status) => ({ ...clone(base.recipients[0]), status })),
    });
  const list = await service.listEmailCampaigns();
  assert.equal(list.length, 50);
  assert.equal(list[0].id, "history-54");
  assert.equal(list[49].id, "history-5");
  assert.deepEqual(
    { ...list[0].counts },
    { total: 6, pending: 1, sending: 1, accepted: 2, failed: 1, unknown: 1 },
  );
  assert.equal(list[0].content, undefined);
  assert.equal(list[0].recipients, undefined);
  assert.equal(list[0].createdById, undefined);
});

test("ambiguous create response is recoverable only with the original request ID", async () => {
  const { service, state, db } = harness();
  const create = db.emailCampaign.create;
  db.emailCampaign.create = async (args) => {
    await create(args);
    throw new Error("commit response lost");
  };
  await rejectsStatus(
    service.createEmailCampaign(input(), actor),
    502,
    /same client request ID/,
  );
  assert.equal(
    (await service.createEmailCampaign(input(), actor)).status,
    "DRAFT",
  );
  assert.equal(state.rows.size, 1);
  assert.equal(state.calls.length, 0);
});

test("concurrent conflicting requests sharing an ID cannot replace the winner", async () => {
  const { service, state } = harness();
  const results = await Promise.allSettled([
    service.createEmailCampaign(input(), actor),
    service.createEmailCampaign(
      input({ content: { ...content, body: "Different content" } }),
      actor,
    ),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    results.find((result) => result.status === "rejected").reason.status,
    409,
  );
  assert.equal(state.rows.size, 1);
  assert.equal(state.calls.length, 0);
});

test("an ambiguous claim commit never reaches the provider and cannot be resumed", async () => {
  const { service, state, db } = harness();
  await service.createEmailCampaign(input(), actor);
  const transaction = db.$transaction;
  db.$transaction = async (callback) => {
    await transaction(callback);
    throw new Error("claim committed but response lost");
  };
  await rejectsStatus(service.sendEmailCampaign(id), 502);
  assert.equal(state.rows.get(id).status, "SENDING");
  await rejectsStatus(service.sendEmailCampaign(id), 409);
  assert.equal(state.calls.length, 0);
});

test("an ambiguous acceptance commit is never overwritten with UNKNOWN or resent", async () => {
  const { service, state, db } = harness();
  await service.createEmailCampaign(input(), actor);
  const transaction = db.$transaction;
  db.$transaction = async (callback) => {
    const result = await transaction(callback);
    if (state.rows.get(id).status === "ACCEPTED")
      throw new Error("acceptance committed but response lost");
    return result;
  };
  await rejectsStatus(service.sendEmailCampaign(id), 502, /DO NOT RESEND/);
  assert.equal(state.rows.get(id).status, "ACCEPTED");
  assert.equal(
    state.rows.get(id).recipients.every((r) => r.status === "ACCEPTED"),
    true,
  );
  assert.equal((await service.sendEmailCampaign(id)).status, "ACCEPTED");
  assert.equal(state.calls.length, 1);
});

test("tracking failure after a rejected or ambiguous send cannot unlock another send", async () => {
  for (const statusCode of [400, 503]) {
    const { service, state } = harness({
      trackingFailure: true,
      provider: async () => ({ success: false, error: { statusCode } }),
    });
    await service.createEmailCampaign(input(), actor);
    await rejectsStatus(service.sendEmailCampaign(id), 502, /DO NOT RESEND/);
    assert.equal(state.rows.get(id).status, "SENDING");
    await rejectsStatus(service.sendEmailCampaign(id), 409);
    assert.equal(state.calls.length, 1);
  }
});

test("missing campaigns return safe 404 and invalid lookup IDs never become Prisma filters", async () => {
  const { service, state } = harness();
  await rejectsStatus(service.getEmailCampaign("missing"), 404);
  await rejectsStatus(service.sendEmailCampaign("missing"), 404);
  await rejectsStatus(service.getEmailCampaign({ not: null }), 400);
  await rejectsStatus(service.sendEmailCampaign(""), 400);
  assert.equal(state.calls.length, 0);
});
