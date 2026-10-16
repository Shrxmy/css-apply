const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

// @zxing/library is the decoder the attendance scanner uses (via @zxing/browser).
const zx = require(
  require.resolve("@zxing/library", {
    paths: [path.dirname(require.resolve("@zxing/browser"))],
  }),
);

function loadGenerator() {
  const filename = path.resolve(__dirname, "../src/lib/qr-generator.ts");
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} };
  vm.runInNewContext(
    `(function(module, exports) { ${outputText}\n})`,
    { Array, Math, TextEncoder, Uint8Array },
    { filename },
  )(module, module.exports);
  return module.exports;
}

// PURE_BARCODE reads the modules directly, so this checks the encoding itself
// (data, error correction, format info) without camera-style detection.
function decode(matrix, { pure = true } = {}) {
  const margin = 4;
  const scale = 8;
  const size = (matrix.length + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(size * size).fill(255);
  matrix.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (!dark) return;
      for (let dy = 0; dy < scale; dy++) {
        const offset =
          ((y + margin) * scale + dy) * size + (x + margin) * scale;
        pixels.fill(0, offset, offset + scale);
      }
    }),
  );
  const bitmap = new zx.BinaryBitmap(
    new zx.HybridBinarizer(new zx.RGBLuminanceSource(pixels, size, size)),
  );
  const hints = pure
    ? new Map([[zx.DecodeHintType.PURE_BARCODE, true]])
    : undefined;
  return new zx.QRCodeReader().decode(bitmap, hints).getText();
}

const { generateQRCodeMatrix } = loadGenerator();

test("digital ID QR codes decode with the attendance scanner's decoder", () => {
  const values = [
    "CSS-2627-0001",
    "CSS-2627-10000",
    "x",
    "A".repeat(40),
    "B".repeat(84),
    ...Array.from(
      { length: 25 },
      (_, i) => `CSS-2627-${String(i * 41).padStart(4, "0")}`,
    ),
  ];
  // A full scan (finder detection included) of a real member ID.
  assert.equal(
    decode(generateQRCodeMatrix("CSS-2627-0001"), { pure: false }),
    "CSS-2627-0001",
  );
  for (const value of values) {
    let decoded;
    try {
      decoded = decode(generateQRCodeMatrix(value));
    } catch (error) {
      assert.fail(`${value} did not decode: ${error.constructor.name}`);
    }
    assert.equal(decoded, value);
  }
});
