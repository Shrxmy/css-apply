const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const zod = require("zod");

function load(file, imports) {
  const filename = path.resolve(__dirname, "..", file);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${outputText}\n})`, {
    filename,
  })(
    (name) => {
      if (name === "server-only") return {};
      if (name === "zod") return zod;
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error(`Unexpected import ${name}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

function fixture(options = {}) {
  const state = {
    session: { user: { email: "admin@example.invalid", role: "super_admin" } },
    account: { id: "admin-1", name: "Admin", role: "super_admin" },
    calls: [],
    logs: [],
    ...options,
  };
  class EmailCampaignError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }
  const invoke =
    (name, result) =>
    async (...args) => {
      state.calls.push({ name, args });
      if (state.failure) throw state.failure;
      return result;
    };
  const service = {
    EmailCampaignError,
    createEmailCampaign: invoke("create", {
      id: "campaign-1",
      status: "DRAFT",
    }),
    listEmailCampaigns: invoke("list", []),
    getEmailCampaign: invoke("get", { id: "campaign-1" }),
    sendEmailCampaign: invoke("send", { id: "campaign-1", status: "ACCEPTED" }),
  };
  const imports = {
    "next/server": {
      NextResponse: {
        json: (body, opts = {}) => ({
          body,
          status: opts.status || 200,
          headers: opts.headers,
        }),
      },
    },
    "next-auth": { getServerSession: async () => state.session },
    "@/lib/auth": { authOptions: {} },
    "@/lib/prisma": {
      prisma: { user: { findUnique: async () => state.account } },
    },
    "@/lib/logger": {
      createLogger: () => ({ error: (...args) => state.logs.push(args) }),
    },
    "@/lib/email-campaigns": service,
    "@/lib/email-campaign-recipients": {
      getEmailCampaignAudience: invoke("audience", {
        cycle: null,
        counts: { ea: 0, staff: 0, member: 0 },
        recipients: [],
      }),
    },
    "@/lib/email-campaign-content": {
      campaignContentSchema: zod.z.object({ subject: zod.z.string() }).strict(),
      buildCampaignEmail: (content) => {
        state.calls.push({ name: "preview", args: [content] });
        return { subject: content.subject, html: "<p>Preview</p>" };
      },
    },
  };
  imports["@/lib/email-campaign-api"] = load(
    "src/lib/email-campaign-api.ts",
    imports,
  );
  const routes = {
    root: load("src/app/api/admin/email-campaigns/route.ts", imports),
    audience: load(
      "src/app/api/admin/email-campaigns/recipients/route.ts",
      imports,
    ),
    preview: load(
      "src/app/api/admin/email-campaigns/preview/route.ts",
      imports,
    ),
    detail: load("src/app/api/admin/email-campaigns/[id]/route.ts", imports),
    send: load("src/app/api/admin/email-campaigns/[id]/send/route.ts", imports),
  };
  return { state, routes, EmailCampaignError };
}
const req = (body, headers = {}) => ({
  headers: new Headers(headers),
  text: async () => JSON.stringify(body),
});
const context = (id = "campaign-1") => ({ params: Promise.resolve({ id }) });
const actions = (r) => [
  () => r.root.GET(),
  () => r.root.POST(req({})),
  () => r.audience.GET(),
  () => r.preview.POST(req({ content: { subject: "Preview" } })),
  () => r.detail.GET({}, context()),
  () => r.send.POST(req({ confirmed: true }), context()),
];

test("all composer routes reject anonymous users before reading campaign data", async () => {
  const { routes, state } = fixture({ session: null });
  for (const action of actions(routes))
    assert.equal((await action()).status, 401);
  assert.equal(state.calls.length, 0);
});

test("all composer routes use the current database role, rejecting stale Super Admin sessions", async () => {
  for (const account of [
    null,
    { id: "u", name: "User", role: "user" },
    { id: "a", name: "EB", role: "admin" },
  ]) {
    const { routes, state } = fixture({ account });
    for (const action of actions(routes))
      assert.equal((await action()).status, 403);
    assert.equal(state.calls.length, 0);
  }
});

test("both Super Admin role spellings can list recipients and history with private no-store responses", async () => {
  for (const role of ["super_admin", "super-admin"]) {
    const { routes } = fixture({ account: { id: "a", name: "Admin", role } });
    const result = await routes.audience.GET();
    assert.equal(result.status, 200);
    assert.match(result.headers["Cache-Control"], /private, no-store/);
    assert.equal((await routes.root.GET()).status, 200);
  }
});

test("creating a draft passes the server-derived actor and never dispatches", async () => {
  const { routes, state } = fixture();
  const body = {
    clientRequestId: "id",
    recruitmentCycleId: "cycle-1",
    recipientIds: ["u"],
    content: {},
  };
  const result = await routes.root.POST(req(body));
  assert.equal(result.status, 201);
  assert.deepEqual(state.calls[0], {
    name: "create",
    args: [body, { id: "admin-1", name: "Admin" }],
  });
  assert.equal(
    state.calls.some((c) => c.name === "send"),
    false,
  );
});

test("preview validates content and does not create a campaign or send email", async () => {
  const { routes, state } = fixture();
  assert.equal(
    (await routes.preview.POST(req({ content: { subject: "Hello" } }))).status,
    200,
  );
  assert.deepEqual(
    state.calls.map((c) => c.name),
    ["preview"],
  );
  assert.equal(
    (
      await routes.preview.POST(
        req({
          content: { subject: "Hello" },
          recipients: ["outsider@example.invalid"],
        }),
      )
    ).status,
    400,
  );
});

test("sending requires explicit literal confirmation and rejects injected recipients", async () => {
  const { routes, state } = fixture();
  for (const body of [
    {},
    { confirmed: false },
    { confirmed: "true" },
    { confirmed: true, recipients: ["outsider@example.invalid"] },
  ]) {
    assert.equal((await routes.send.POST(req(body), context())).status, 400);
  }
  assert.equal(state.calls.length, 0);
  const result = await routes.send.POST(req({ confirmed: true }), context());
  assert.equal(result.status, 200);
  assert.deepEqual(
    state.calls.map((c) => c.name),
    ["send"],
  );
  assert.deepEqual(state.calls[0].args, ["campaign-1"]);
});

test("malformed JSON and oversized bodies stop before draft creation", async () => {
  const { routes, state } = fixture();
  assert.equal(
    (await routes.root.POST({ headers: new Headers(), text: async () => "{" }))
      .status,
    400,
  );
  assert.equal(
    (await routes.root.POST(req({ body: "x".repeat(128 * 1024) }))).status,
    413,
  );
  let read = false;
  const result = await routes.root.POST({
    headers: new Headers({ "content-length": "999999" }),
    text: async () => {
      read = true;
      return "{}";
    },
  });
  assert.equal(result.status, 413);
  assert.equal(read, false);
  assert.equal(state.calls.length, 0);
});

test("invalid campaign ids stop before lookup or dispatch", async () => {
  const { routes, state } = fixture();
  assert.equal(
    (await routes.detail.GET({}, context("x".repeat(101)))).status,
    400,
  );
  assert.equal(
    (await routes.send.POST(req({ confirmed: true }), context(""))).status,
    400,
  );
  assert.equal(state.calls.length, 0);
});

test("safe service errors survive, but unexpected errors never disclose secrets or recipient content", async () => {
  const { routes, state, EmailCampaignError } = fixture();
  state.failure = new EmailCampaignError(
    409,
    "Send status is uncertain. Do not resend.",
  );
  const conflict = await routes.send.POST(req({ confirmed: true }), context());
  assert.equal(conflict.status, 409);
  assert.match(conflict.body.error, /Do not resend/);
  state.failure = new Error(
    "PRIVATE_KEY=secret123 recipient@example.invalid private campaign body",
  );
  const failure = await routes.root.GET();
  assert.equal(failure.status, 500);
  assert.doesNotMatch(
    JSON.stringify({ failure, logs: state.logs }),
    /secret123|private campaign body|recipient@example.invalid/,
  );
  state.failure = Object.assign(new Error("missing table"), { code: "P2021" });
  assert.equal((await routes.root.GET()).status, 503);
});
