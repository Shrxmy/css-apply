const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const filename = path.resolve(
  __dirname,
  "../src/lib/email-campaign-content.ts",
);
const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: filename,
});
const moduleUnderTest = { exports: {} };
const wrapped = [];
vm.runInNewContext(
  `(function(require, module, exports) { ${outputText}\n})`,
  { URL },
  { filename },
)(
  (name) => {
    if (name === "server-only") return {};
    if (name === "zod") return require("zod");
    if (name === "@/lib/email") {
      return {
        wrapEmail(title, html) {
          wrapped.push({ title, html });
          return `<html><h2>${title}</h2>${html}</html>`;
        },
      };
    }
    throw new Error(`Unexpected import: ${name}`);
  },
  moduleUnderTest,
  moduleUnderTest.exports,
);
const { campaignContentSchema, buildCampaignEmail } = moduleUnderTest.exports;
const valid = {
  templateType: "event",
  subject: "CSS event",
  title: "You're invited",
  body: "Join us for a CSS event.",
};
const parses = (overrides) =>
  campaignContentSchema.safeParse({ ...valid, ...overrides }).success;

test("strict schema trims content and normalizes blank optional fields", () => {
  const result = campaignContentSchema.parse({
    ...valid,
    subject: "  CSS event  ",
    title: "  You're invited  ",
    body: "  Hello\n\nCSS members  ",
    eventDate: "  Tomorrow  ",
    eventTime: "  ",
    ctaLabel: " ",
    ctaUrl: " ",
  });
  assert.equal(result.subject, valid.subject);
  assert.equal(result.title, valid.title);
  assert.equal(result.body, "Hello\n\nCSS members");
  assert.equal(result.eventDate, "Tomorrow");
  assert.equal(result.eventTime, undefined);
  assert.equal(result.ctaUrl, undefined);
  assert.equal(parses({ html: "<b>Not allowed</b>" }), false);
  assert.equal(parses({ templateType: "arbitrary" }), false);
});

test("required text and bounded optional fields enforce sensible limits", () => {
  for (const key of ["subject", "title", "body"]) {
    for (const value of ["", "   ", null, 1]) {
      assert.equal(parses({ [key]: value }), false, `${key}: ${value}`);
    }
  }
  assert.equal(
    parses({ subject: "s".repeat(160), title: "t".repeat(160) }),
    true,
  );
  assert.equal(parses({ subject: "s".repeat(161) }), false);
  assert.equal(parses({ title: "t".repeat(161) }), false);
  assert.equal(parses({ body: "x".repeat(10000) }), true);
  assert.equal(parses({ body: "x".repeat(10001) }), false);
  for (const key of ["eventDate", "eventTime", "eventVenue"]) {
    assert.equal(parses({ [key]: "x".repeat(301) }), false, key);
    assert.equal(parses({ [key]: 123 }), false, key);
  }
  assert.equal(
    parses({ ctaLabel: "x".repeat(101), ctaUrl: "https://example.org" }),
    false,
  );
  assert.equal(
    parses({
      ctaLabel: "Open",
      ctaUrl: `https://example.org/${"x".repeat(2048)}`,
    }),
    false,
  );
});

test("subject rejects controls and newlines, including ones trimming would hide", () => {
  for (const subject of [
    "Hello\r\nBcc: other@example.org",
    "\nHello",
    "Hello\t",
    "Hello\0",
    "Hello\x7f",
    "Hello\x85",
    "Hello\u2028world",
    "Hello\u2029world",
  ]) {
    assert.equal(parses({ subject }), false, JSON.stringify(subject));
  }
});

test("CTA label and URL must be paired and use credential-free HTTPS", () => {
  assert.equal(parses({ ctaLabel: "Open" }), false);
  assert.equal(parses({ ctaUrl: "https://example.org" }), false);
  assert.equal(parses({ ctaLabel: "Open", ctaUrl: " " }), false);
  for (const ctaUrl of [
    "http://example.org",
    "javascript:alert(1)",
    "data:text/html,test",
    "//example.org",
    "/relative",
    "not a URL",
    "https://user:pass@example.org",
    "https://user@example.org",
    "https://@example.org",
    "https://",
    "https://exam\tple.org",
    "https:\\example.org",
    "https://example.org/a b",
  ]) {
    assert.equal(parses({ ctaLabel: "Open", ctaUrl }), false, ctaUrl);
  }
  assert.equal(
    parses({
      ctaLabel: "Open",
      ctaUrl: " https://example.org/path?q=one&x=two#part ",
    }),
    true,
  );
});

test("event template escapes every supplied HTML field and preserves paragraphs and newlines", () => {
  const content = {
    ...valid,
    subject: "CSS <event> & friends",
    title: "<img src=x onerror=\"alert(1)\"> & 'title'",
    body: '<script>alert("x")</script>\r\nNext & line\r\n\r\nAnother <b>paragraph</b>',
    eventDate: '<svg onload="bad()">',
    eventTime: "10:00 & 11:00",
    eventVenue: "'Hall' \"A\" <room>",
    ctaLabel: '<Click> & "go"',
    ctaUrl: "https://example.org/?a=\"quoted\"&b='single'",
  };
  const email = buildCampaignEmail(content);
  assert.equal(email.subject, content.subject);
  assert.match(
    email.html,
    /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; &#39;title&#39;/,
  );
  assert.match(
    email.html,
    /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;<br\s*\/?>Next &amp; line/,
  );
  assert.match(
    email.html,
    /<\/p>\s*<p[^>]*>Another &lt;b&gt;paragraph&lt;\/b&gt;/,
  );
  assert.match(email.html, /&lt;svg onload=&quot;bad\(\)&quot;&gt;/);
  assert.match(email.html, /10:00 &amp; 11:00/);
  assert.match(email.html, /&#39;Hall&#39; &quot;A&quot; &lt;room&gt;/);
  assert.match(
    email.html,
    /href="https:\/\/example.org\/\?a=&quot;quoted&quot;&amp;b=&#39;single&#39;"/,
  );
  assert.match(email.html, /&lt;Click&gt; &amp; &quot;go&quot;/);
  assert.doesNotMatch(email.html, /<script|<img|<svg|<b>/);
  assert.equal(wrapped.at(-1).title.includes("<img"), false);
  assert.ok(wrapped.at(-1).html.includes("&lt;script&gt;"));
});

test("event details are optional and reminder renders neither details nor a fallback link", () => {
  for (const templateType of ["event", "reminder"]) {
    const email = buildCampaignEmail({ ...valid, templateType });
    assert.doesNotMatch(email.html, /href=|Event details|Venue:|Date:|Time:/);
  }
  const reminder = buildCampaignEmail({
    ...valid,
    templateType: "reminder",
    eventDate: "SECRET_DATE",
    eventTime: "SECRET_TIME",
    eventVenue: "SECRET_VENUE",
  });
  assert.doesNotMatch(reminder.html, /SECRET_|Event details|href=/);
  assert.match(reminder.html, /Reminder/);
  assert.notEqual(reminder.html, buildCampaignEmail(valid).html);
});

test("partial event details and an explicitly supplied reminder CTA render", () => {
  const event = buildCampaignEmail({ ...valid, eventVenue: "Room 1" });
  assert.match(event.html, /Room 1/);
  assert.doesNotMatch(event.html, /Date:|Time:/);
  const reminder = buildCampaignEmail({
    ...valid,
    templateType: "reminder",
    ctaLabel: "View details",
    ctaUrl: "https://example.org",
  });
  assert.match(reminder.html, /href="https:\/\/example.org"/);
  assert.match(reminder.html, /View details/);
});

test("builder validates at runtime rather than trusting TypeScript types", () => {
  assert.throws(() =>
    buildCampaignEmail({ ...valid, subject: "Injected\r\nheader" }),
  );
  assert.throws(() =>
    buildCampaignEmail({
      ...valid,
      ctaLabel: "Click",
      ctaUrl: "javascript:alert(1)",
    }),
  );
  assert.throws(() =>
    buildCampaignEmail({ ...valid, html: "<b>untrusted</b>" }),
  );
});
