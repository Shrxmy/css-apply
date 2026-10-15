const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const sharp = require("sharp");

const filename = path.resolve(__dirname, "../src/lib/email-campaign-layout.ts");
const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: filename,
});
const moduleUnderTest = { exports: {} };
vm.runInNewContext(
  `(function(require, module, exports) { ${outputText}\n})`,
  {},
  { filename },
)(
  (name) => {
    throw new Error(`Unexpected import: ${name}`);
  },
  moduleUnderTest,
  moduleUnderTest.exports,
);
const { wrapCampaignEmail } = moduleUnderTest.exports;
const base =
  "https://ust-css-apply.vercel.app/assets/css-apply-static-images/assets/";
const images = (html) => html.match(/<img\b[^>]*>/g) || [];

test("default CSSApply logo is centered above the title at 126 by 35", () => {
  const html = wrapCampaignEmail("Campaign title", "<p>Body</p>");
  assert.equal(
    html,
    wrapCampaignEmail("Campaign title", "<p>Body</p>", "cssapply"),
  );
  const [logo] = images(html);
  assert.ok(logo.includes(`${base}logos/Logo_CSS_Apply_Email.png`));
  assert.match(logo, /width="126" height="35" alt="CSSApply Logo"/);
  assert.match(logo, /display: block;.*margin: 0 auto/);
  assert.ok(html.indexOf(logo) < html.indexOf("<h1"));
  assert.match(html, /class="campaign-header" align="center"/);
});

test("CSS logo is substantially smaller than 160 and has no extra title gap", () => {
  const html = wrapCampaignEmail("Title", "<p>Body</p>", "css");
  const [logo] = images(html);
  assert.ok(logo.includes(`${base}logos/Logo_CSS_Watermark.png`));
  assert.match(logo, /width="100" height="100" alt="CSS Logo"/);
  assert.match(logo, /width: 100px; height: 100px/);
  assert.doesNotMatch(html, /(?:width|height)[=:][" ]*160/);
  assert.match(html, /campaign-header[^>]*padding: 8px 32px 16px/);
  assert.match(html, /<h1 style="margin: 0px 0 0;/);
});

test("small decorative CSar appears only in the footer after caller content", () => {
  const body = '<p>Body marker</p><a href="https://example.org/event">Join</a>';
  const html = wrapCampaignEmail("Title", body);
  const allImages = images(html);
  assert.equal(allImages.length, 4);
  const mascot = allImages.find((image) =>
    image.includes("CSAR_Excited_Email.png"),
  );
  assert.ok(mascot);
  assert.ok(mascot.includes(`${base}pictures/CSAR_Excited_Email.png`));
  assert.match(mascot, /width="44" height="46"/);
  assert.match(mascot, /width: 44px; height: 46px/);
  assert.ok(html.indexOf(body) < html.indexOf('class="campaign-footer"'));
  assert.ok(html.indexOf('class="campaign-footer"') < html.indexOf(mascot));
  assert.match(mascot, /alt="" role="presentation"/);
});

test("footer socials match the site accounts and the RSO number stays a quiet footer line", () => {
  const html = wrapCampaignEmail("Title", "<p>Body marker</p>");
  const footer = html.slice(html.indexOf('class="campaign-footer"'));
  const siteFooter = fs.readFileSync(
    path.resolve(__dirname, "../src/components/Footer.tsx"),
    "utf8",
  );
  for (const [label, url, asset] of [
    ["Facebook", "https://www.facebook.com/ustcss", "facebook_email.png"],
    ["Instagram", "https://www.instagram.com/ustcss", "instagram_email.png"],
  ]) {
    assert.ok(siteFooter.includes(url));
    assert.ok(footer.includes(`href="${url}"`));
    assert.match(
      footer,
      new RegExp(
        `<img[^>]*${asset.replaceAll(".", "\\.")}[^>]*width="20" height="20" alt="${label}"`,
      ),
    );
  }
  assert.equal((html.match(/RSO-D-26-27-CICS02/g) || []).length, 1);
  assert.match(footer, /class="campaign-rso"[^>]*style="[^"]*font-size: 11px/);
  assert.match(footer, /RSO Control No\.:/);
  assert.ok(footer.includes("RSO-D-26-27-CICS02"));
  assert.doesNotMatch(
    html.slice(0, html.indexOf('class="campaign-footer"')),
    /RSO-D-26-27-CICS02|facebook_email|instagram_email/,
  );
});

test("uses CSSApply blue inline styling without badges or side accents", () => {
  const html = wrapCampaignEmail("Title", "<p>Body</p>");
  for (const color of ["#134687", "#044FAF", "#F3F3FD", "#E8F2FF"]) {
    assert.ok(html.includes(color), color);
  }
  assert.match(html, /<h1 style="[^"]*color: #134687/i);
  assert.match(html, /class="campaign-body"[^>]*style="[^"]*color: #134687/i);
  assert.match(html, /\.button\s*\{[^}]*background-color: #044FAF/i);
  assert.match(html, /\.accent-box\s*\{[^}]*background-color: #E8F2FF/i);
  assert.match(
    html,
    /<a\b[^>]*href="mailto:css\.cics@ust\.edu\.ph"[^>]*style="[^"]*color: #044FAF/i,
  );
  assert.doesNotMatch(
    html,
    /#353052|#4D4B65|#57507D|#F2F0FA|CSS event|Reminder|border-(?:left|right|inline)|\.webp|ustcomputersciencesociety@gmail\.com/i,
  );
});

test("pattern is on the full-width outer table with solid readable surfaces", () => {
  const html = wrapCampaignEmail("Title", "<p>Body</p>");
  const background = `${base}pictures/background_email.png`;
  const tables = html.match(/<table\b[^>]*>/g) || [];
  const outer = tables[0];
  assert.ok(outer);
  assert.match(outer, /role="presentation"/);
  assert.match(outer, /width="100%"/);
  assert.ok(outer.includes(`background="${background}"`));
  assert.match(outer, /bgcolor="#F3F3FD"/i);
  const style = outer.match(/style="([^"]*)"/)?.[1];
  assert.ok(style);
  assert.ok(style.includes(`background-image: url('${background}')`));
  assert.match(style, /background-repeat:\s*repeat\s*(?:;|$)/i);
  assert.match(style, /background-size:\s*800px\s+1600px\s*(?:;|$)/i);
  assert.match(style, /background-color:\s*#F3F3FD\s*(?:;|$)/i);
  // The Outlook-only width wrapper can precede the actual card table.
  const card = tables.find((table) => /max-width:\s*600px/i.test(table));
  assert.ok(card);
  assert.match(card, /bgcolor="#FFFFFF"/i);
  assert.match(card, /background-color:\s*#FFFFFF/i);
  for (const [surface, fill] of [
    ["header", "#FFFFFF"],
    ["body", "#FFFFFF"],
    ["footer", "#E8F2FF"],
  ]) {
    const tag = html.match(
      new RegExp(`<td\\b[^>]*class="campaign-${surface}"[^>]*>`),
    )?.[0];
    assert.ok(tag, surface);
    // Header/body may inherit the enclosing solid-white card surface.
    if (surface === "footer" || /background-color\s*:/i.test(tag)) {
      assert.match(tag, new RegExp(`background-color:\\s*${fill}`, "i"));
    }
    assert.doesNotMatch(tag, /background-image|background="|background\s*:/i);
  }
  assert.equal((html.match(/background-image\s*:/gi) || []).length, 1);
  assert.equal((html.match(/\sbackground="/gi) || []).length, 1);
});

test("responsive presentation tables cap the card at 600px and wrap long text", () => {
  const html = wrapCampaignEmail(
    "T".repeat(1000),
    `<p>${"x".repeat(2000)}</p>`,
  );
  assert.match(
    html,
    /<meta name="viewport" content="width=device-width, initial-scale=1">/,
  );
  assert.match(html, /max-width: 600px/);
  assert.match(html, /@media only screen and \(max-width: 600px\)/);
  assert.match(html, /font-family: Inter, Arial, sans-serif/);
  assert.match(html, /overflow-wrap: anywhere; word-wrap: break-word/);
  assert.match(html, /table-layout: fixed/);
  assert.doesNotMatch(html, /min-width\s*:/i);
  const tables = html.match(/<table\b[^>]*>/g);
  assert.ok(tables.length >= 3);
  for (const table of tables) {
    assert.match(table, /role="presentation"/);
    assert.match(table, /cellspacing="0" cellpadding="0" border="0"/);
  }
});

test("pre-escaped title and trusted body are preserved without double escaping", () => {
  const title = "CSS &amp; friends &lt;welcome&gt; &#39;hello&#39;";
  const body =
    '<p style="color: #134687;">Hello &amp; friends<br>Next line</p>\n<div class="accent-box">Room &lt;A&gt;</div>';
  const html = wrapCampaignEmail(title, body);
  assert.ok(html.includes(`<title>${title}</title>`));
  assert.ok(html.includes(`>${title}</h1>`));
  assert.ok(html.includes(body));
  assert.doesNotMatch(html, /&amp;amp;|&amp;lt;|&amp;#39;/);
});

test("only fixed assets and the caller CTA plus official footer links are included", () => {
  const cta =
    '<a class="button" href="https://example.org/event?a=1&amp;b=2">Join</a>';
  for (const logo of [
    undefined,
    "css",
    "cssapply",
    "https://untrusted.example/logo",
  ]) {
    const html = wrapCampaignEmail("Title", cta, logo);
    const sources = [...html.matchAll(/<img\b[^>]*src="([^"]+)"/g)].map(
      (match) => match[1],
    );
    assert.equal(sources.length, 4);
    for (const source of sources) {
      assert.equal(new URL(source).protocol, "https:");
    }
    assert.deepEqual(sources, [
      `${base}logos/${logo === "css" ? "Logo_CSS_Watermark.png" : "Logo_CSS_Apply_Email.png"}`,
      `${base}pictures/facebook_email.png`,
      `${base}pictures/instagram_email.png`,
      `${base}pictures/CSAR_Excited_Email.png`,
    ]);
    assert.doesNotMatch(
      html,
      /untrusted\.example|\.webp|ustcomputersciencesociety@gmail\.com/i,
    );
    const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(
      (match) => match[1],
    );
    assert.deepEqual(links, [
      "https://example.org/event?a=1&amp;b=2",
      "mailto:css.cics@ust.edu.ph",
      "https://www.facebook.com/ustcss",
      "https://www.instagram.com/ustcss",
    ]);
    assert.match(html, /UST Computer Science Society/);
    assert.match(html, />css\.cics@ust\.edu\.ph<\/a>/);
  }
  const withoutCta = wrapCampaignEmail("Title", "<p>Body</p>");
  assert.deepEqual(
    [...withoutCta.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(
      (match) => match[1],
    ),
    [
      "mailto:css.cics@ust.edu.ph",
      "https://www.facebook.com/ustcss",
      "https://www.instagram.com/ustcss",
    ],
  );
});

const pictures = path.resolve(
  __dirname,
  "../public/assets/css-apply-static-images/assets/pictures",
);

test("social glyphs are small transparent brand-blue PNGs served without Git LFS", async () => {
  const attributes = fs.readFileSync(
    path.resolve(__dirname, "../.gitattributes"),
    "utf8",
  );
  for (const platform of ["facebook", "instagram"]) {
    const file = path.join(pictures, `${platform}_email.png`);
    const metadata = await sharp(file).metadata();
    assert.equal(metadata.format, "png");
    assert.equal(metadata.width, 40);
    assert.equal(metadata.height, 40);
    assert.equal(metadata.hasAlpha, true);
    assert.ok(fs.statSync(file).size < 4096);
    const { data } = await sharp(file)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(data[3], 0, "transparent corner");
    let bluePixels = 0;
    for (let offset = 0; offset < data.length; offset += 4) {
      if (
        data[offset] === 19 &&
        data[offset + 1] === 70 &&
        data[offset + 2] === 135 &&
        data[offset + 3] === 255
      )
        bluePixels++;
    }
    assert.ok(bluePixels > 0, "opaque CSS-blue glyph pixels");
    assert.ok(
      attributes.includes(
        `public/assets/css-apply-static-images/assets/pictures/${platform}_email.png -filter -diff -merge -text`,
      ),
    );
  }
});

test("email CSar is a real PNG preserving the original resolution and exact RGBA pixels", async () => {
  const png = path.join(pictures, "CSAR_Excited_Email.png");
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 399);
  assert.equal(metadata.height, 420);
  assert.equal(metadata.hasAlpha, true);
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 4);
  const alphaAt = (x, y) => data[(y * info.width + x) * 4 + 3];
  for (const [x, y] of [
    [0, 0],
    [398, 0],
    [0, 419],
    [398, 419],
  ]) {
    assert.equal(alphaAt(x, y), 0, `transparent corner ${x},${y}`);
  }
  assert.equal(alphaAt(199, 210), 255, "opaque mascot center");
  const original = await sharp(path.join(pictures, "CSAR_Excited.webp"))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(original.info.width, info.width);
  assert.equal(original.info.height, info.height);
  assert.equal(original.info.channels, info.channels);
  assert.ok(
    data.equals(original.data),
    "PNG must preserve every decoded source RGBA byte",
  );
});

test("email background is an opaque 800 by 1600 PNG composited over the fallback color", async () => {
  const png = path.join(pictures, "background_email.png");
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 800);
  assert.equal(metadata.height, 1600);
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 4);
  for (let offset = 3; offset < data.length; offset += 4) {
    if (data[offset] !== 255) {
      assert.fail(`background must be opaque at pixel ${(offset - 3) / 4}`);
    }
  }
  // Compare rendered pixels, not encoded bytes or the source's transparent RGB.
  const expected = await sharp(path.join(pictures, "background.webp"))
    .flatten({ background: "#F3F3FD" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(expected.info.width, info.width);
  assert.equal(expected.info.height, info.height);
  assert.ok(
    data.equals(expected.data),
    "background must match the source over #F3F3FD",
  );
});
