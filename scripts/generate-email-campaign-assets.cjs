const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const directory = path.resolve(
  __dirname,
  "../public/assets/css-apply-static-images/assets/pictures",
);

async function generate() {
  // Preserve the mascot's original RGBA pixels. Some mail proxies lose WebP alpha.
  await sharp(path.join(directory, "CSAR_Excited.webp"))
    .png({ compressionLevel: 9 })
    .toFile(path.join(directory, "CSAR_Excited_Email.png"));

  // Bake the site's normal background color into its transparent code-pattern art.
  // No CSS opacity or alpha support is required in email clients for this image.
  await sharp(path.join(directory, "background.webp"))
    .flatten({ background: "#F3F3FD" })
    .png({ compressionLevel: 9 })
    .toFile(path.join(directory, "background_email.png"));

  // Reuse the site's social glyphs in brand blue. Rasterize at 2x display size
  // because inline SVG/SVG image support is inconsistent in email clients.
  for (const platform of ["facebook", "instagram"]) {
    const svg = fs
      .readFileSync(
        path.resolve(__dirname, `../public/icons/${platform}.svg`),
        "utf8",
      )
      .replaceAll('fill="white"', 'fill="#134687"');
    await sharp(Buffer.from(svg))
      .resize(40, 40)
      .png({ compressionLevel: 9 })
      .toFile(path.join(directory, `${platform}_email.png`));
  }

  console.log(
    "Generated campaign-only PNGs; original website assets unchanged.",
  );
}

generate().catch((error) => {
  console.error("Could not generate campaign email assets:", error.message);
  process.exitCode = 1;
});
