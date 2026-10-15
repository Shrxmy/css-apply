const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const { z } = require("zod");

function load(file, imports, env = {}) {
  const filename = path.resolve(__dirname, "..", file);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const module = { exports: {} };
  vm.runInThisContext(
    `(function(require,module,exports,process){${outputText}\n})`,
    { filename },
  )(
    (name) => {
      if (name === "zod") return { z };
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error(`Unexpected import: ${name}`);
    },
    module,
    module.exports,
    { env },
  );
  return module.exports;
}
const GROUP_URL = "https://www.facebook.com/groups/cssapply-test-group";
function fixture(overrides = {}) {
  const state = {
    calls: [],
    reads: 0,
    session: {
      user: {
        email: "admin@example.invalid",
        name: "Admin",
        role: "super_admin",
      },
    },
    configs: [
      { key: "community_group_url", value: GROUP_URL },
      { key: "community_group_label", value: "Join the saved group" },
    ],
    ...overrides,
  };
  class BrevoClient {
    transactionalEmails = {
      sendTransacEmail: async (payload, options) => {
        state.calls.push({ payload, options });
        return {
          messageId: "test-message-id",
          messageIds: ["test-version-id"],
        };
      },
    };
  }
  const email = load(
    "src/lib/email.ts",
    {
      "@getbrevo/brevo": { BrevoClient },
      "@/lib/logger": { createLogger: () => ({ error() {} }) },
    },
    {
      VERCEL_URL: "per-deployment-host.vercel.app",
      NEXTAUTH_URL: "https://public.example.invalid",
    },
  );
  const templates = load("src/lib/email-test-templates.ts", {
    "@/lib/email": email,
  });
  const route = load("src/app/api/admin/test-email/route.ts", {
    "next/server": {
      NextResponse: {
        json: (body, opts = {}) => ({ body, status: opts.status || 200 }),
      },
    },
    "next-auth": { getServerSession: async () => state.session },
    "@/lib/auth": { authOptions: {} },
    "@/lib/prisma": {
      prisma: {
        systemConfig: {
          findMany: async () => {
            state.reads++;
            return state.configs;
          },
        },
      },
    },
    "@/lib/email": email,
    "@/lib/email-test-templates": templates,
  });
  return { state, email, templates, route };
}
const anchors = (html) =>
  [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((m) =>
    m[1].replaceAll("&amp;", "&"),
  );
const req = (body) => ({ json: async () => body });

test("community invitation links only to its supplied saved group, never a Vercel/app navigation URL", () => {
  const { email } = fixture();
  const template = email.emailTemplates.cssGroupJoin(
    "Member",
    "Join group",
    GROUP_URL,
  );
  assert.deepEqual(
    anchors(template.html).filter((url) => url.startsWith("https://")),
    [GROUP_URL],
  );
  assert.equal(
    anchors(template.html).some((url) => /vercel\.app/.test(url)),
    false,
  );
  // The public Vercel logo remains an image asset, not a community navigation link.
  assert.match(
    template.html,
    /<img src="https:\/\/ust-css-apply\.vercel\.app\//,
  );
});

test("community names, labels and URLs are escaped safely", () => {
  const { email } = fixture();
  const template = email.emailTemplates.cssGroupJoin(
    "<script>alert(1)</script>",
    "<b>Group</b>",
    `${GROUP_URL}?a=1&b=2`,
  );
  assert.doesNotMatch(template.html, /<script>|<b>Group<\/b>/);
  assert.match(template.html, /&lt;script&gt;/);
  assert.match(template.html, /\?a=1&amp;b=2/);
});

test("Super Admin test send loads the saved group and sends only to the signed-in admin", async () => {
  const { state, route } = fixture();
  const result = await route.POST(req({ templateType: "css_group_join" }));
  assert.equal(result.status, 200);
  assert.equal(state.reads, 1);
  assert.equal(state.calls.length, 1);
  assert.deepEqual(state.calls[0].payload.to, [
    { email: "admin@example.invalid" },
  ]);
  assert.deepEqual(
    anchors(state.calls[0].payload.htmlContent).filter((url) =>
      url.startsWith("https://"),
    ),
    [GROUP_URL],
  );
  assert.equal(result.body.messageId, "test-message-id");
});

test("missing or non-HTTPS saved links prevent community tests instead of falling back to CSSApply", async () => {
  for (const value of [
    "",
    "not a url",
    "http://www.facebook.com/groups/test",
    "javascript:alert(1)",
  ]) {
    const { state, route } = fixture({
      configs: [{ key: "community_group_url", value }],
    });
    assert.equal(
      (await route.POST(req({ templateType: "css_group_join" }))).status,
      409,
    );
    assert.equal(state.calls.length, 0);
  }
});

test("anonymous and non-Super Admin test requests cannot read the link or send email", async () => {
  for (const session of [
    null,
    { user: { email: "user@example.invalid", role: "user" } },
  ]) {
    const { state, route } = fixture({ session });
    assert.equal(
      (await route.POST(req({ templateType: "css_group_join" }))).status,
      session ? 403 : 401,
    );
    assert.equal(state.reads, 0);
    assert.equal(state.calls.length, 0);
  }
});

test("batch options disable SDK retries for campaigns and keep recipient addresses private", async () => {
  const { state, email } = fixture();
  const result = await email.sendEmailBatch(
    ["one@example.invalid", "two@example.invalid"],
    "Subject",
    "<p>Body</p>",
    { maxRetries: 0, timeoutInSeconds: 30 },
  );
  assert.equal(result.success, true);
  assert.equal(state.calls.length, 1);
  assert.deepEqual(state.calls[0].options, {
    maxRetries: 0,
    timeoutInSeconds: 30,
  });
  assert.equal("to" in state.calls[0].payload, false);
  assert.deepEqual(state.calls[0].payload.messageVersions, [
    { to: [{ email: "one@example.invalid" }] },
    { to: [{ email: "two@example.invalid" }] },
  ]);
  assert.deepEqual(result.messageIds, ["test-version-id"]);
  assert.equal(
    (
      await email.sendEmailBatch(
        Array(251).fill("one@example.invalid"),
        "Subject",
        "Body",
      )
    ).success,
    false,
  );
  assert.equal(state.calls.length, 1);
});
