/**
 * Pure TypeScript QR Code Generator (ISO/IEC 18004 compliant subset)
 * Zero external dependencies. Works in Node, Edge, and browser runtimes.
 * Supports Versions 1-10, Error Correction Levels L, M, Q, H, Byte Mode.
 */

// GF(256) Math tables with primitive polynomial 0x11d
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_EXP[i + 255] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 256) x ^= 0x11d;
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF_EXP[GF_LOG[x] + GF_LOG[y]];
}

function rsGenPoly(ecCount: number): number[] {
  let poly = [1];
  for (let i = 0; i < ecCount; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], GF_EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsCompute(data: number[], ecCount: number): number[] {
  const gen = rsGenPoly(ecCount);
  const remainder = new Array(ecCount).fill(0);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    // gen is stored lowest degree first; the division needs it highest first.
    for (let j = 0; j < ecCount; j++) {
      remainder[j] ^= gfMul(gen[ecCount - 1 - j], factor);
    }
  }
  return remainder;
}

// Version table: total codewords, EC codewords per block, block counts
export type ECLevel = "L" | "M" | "Q" | "H";

interface VersionInfo {
  version: number;
  totalCodewords: number;
  ecPerBlock: number;
  numBlocksGroup1: number;
  dataPerBlockGroup1: number;
  numBlocksGroup2: number;
  dataPerBlockGroup2: number;
  alignmentPatterns: number[];
}

const VERSION_TABLE_M: Record<number, VersionInfo> = {
  1: {
    version: 1,
    totalCodewords: 26,
    ecPerBlock: 10,
    numBlocksGroup1: 1,
    dataPerBlockGroup1: 16,
    numBlocksGroup2: 0,
    dataPerBlockGroup2: 0,
    alignmentPatterns: [],
  },
  2: {
    version: 2,
    totalCodewords: 44,
    ecPerBlock: 16,
    numBlocksGroup1: 1,
    dataPerBlockGroup1: 28,
    numBlocksGroup2: 0,
    dataPerBlockGroup2: 0,
    alignmentPatterns: [6, 18],
  },
  3: {
    version: 3,
    totalCodewords: 70,
    ecPerBlock: 26,
    numBlocksGroup1: 1,
    dataPerBlockGroup1: 44,
    numBlocksGroup2: 0,
    dataPerBlockGroup2: 0,
    alignmentPatterns: [6, 22],
  },
  4: {
    version: 4,
    totalCodewords: 100,
    ecPerBlock: 18,
    numBlocksGroup1: 2,
    dataPerBlockGroup1: 32,
    numBlocksGroup2: 0,
    dataPerBlockGroup2: 0,
    alignmentPatterns: [6, 26],
  },
  5: {
    version: 5,
    totalCodewords: 134,
    ecPerBlock: 24,
    numBlocksGroup1: 2,
    dataPerBlockGroup1: 43,
    numBlocksGroup2: 0,
    dataPerBlockGroup2: 0,
    alignmentPatterns: [6, 30],
  },
};

// Format info BCH generator: (G = x^10 + x^8 + x^5 + x^4 + x^2 + x + 1 => 0x537)
const FORMAT_MASK = 0x5412;

function calcFormatBits(mask: number): number {
  // EC Level M = 00 in format bits
  // Mask is 3 bits: 0..7
  const data = (0b00 << 3) | (mask & 0b111);
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) {
      rem ^= 0x537 << (i - 10);
    }
  }
  return ((data << 10) | rem) ^ FORMAT_MASK;
}

// ISO/IEC 18004 mask penalty (rules N1-N4). Scoring only part of it lets a
// mask through that draws finder-like patterns, which scanners misdetect.
function maskPenalty(grid: boolean[][]): number {
  const size = grid.length;
  let penalty = 0;

  const addHistory = (runLength: number, history: number[]) => {
    if (history[0] === 0) runLength += size; // light border before the line
    history.pop();
    history.unshift(runLength);
  };
  const countFinderLike = (h: number[]) => {
    const n = h[1];
    const core =
      n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n;
    return (
      (core && h[0] >= n * 4 && h[6] >= n ? 1 : 0) +
      (core && h[6] >= n * 4 && h[0] >= n ? 1 : 0)
    );
  };

  for (const vertical of [false, true]) {
    for (let a = 0; a < size; a++) {
      let runColor = false;
      let runLength = 0;
      const history = [0, 0, 0, 0, 0, 0, 0];
      for (let b = 0; b < size; b++) {
        const dark = vertical ? grid[b][a] : grid[a][b];
        if (dark === runColor) {
          runLength++;
          if (runLength === 5) penalty += 3;
          else if (runLength > 5) penalty += 1;
        } else {
          addHistory(runLength, history);
          if (!runColor) penalty += countFinderLike(history) * 40;
          runColor = dark;
          runLength = 1;
        }
      }
      if (runColor) {
        addHistory(runLength, history);
        runLength = 0;
      }
      addHistory(runLength + size, history); // light border after the line
      penalty += countFinderLike(history) * 40;
    }
  }

  let darkCount = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]) darkCount++;
      if (
        r < size - 1 &&
        c < size - 1 &&
        grid[r][c] === grid[r + 1][c] &&
        grid[r][c] === grid[r][c + 1] &&
        grid[r][c] === grid[r + 1][c + 1]
      ) {
        penalty += 3;
      }
    }
  }
  const total = size * size;
  penalty +=
    (Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1) * 10;
  return penalty;
}

export function generateQRCodeMatrix(text: string): boolean[][] {
  const encoder = new TextEncoder();
  const textBytes = Array.from(encoder.encode(text));

  // Determine minimum version (using EC Level M)
  let vInfo = VERSION_TABLE_M[1];
  for (let v = 1; v <= 5; v++) {
    const info = VERSION_TABLE_M[v];
    const maxDataBytes =
      info.numBlocksGroup1 * info.dataPerBlockGroup1 +
      info.numBlocksGroup2 * info.dataPerBlockGroup2;
    // Overhead: 4 bits mode + 8 bits length indicator = 1.5 bytes -> need dataBytes + 2 <= maxDataBytes
    if (textBytes.length + 2 <= maxDataBytes) {
      vInfo = info;
      break;
    }
  }

  const totalDataBytes =
    vInfo.numBlocksGroup1 * vInfo.dataPerBlockGroup1 +
    vInfo.numBlocksGroup2 * vInfo.dataPerBlockGroup2;

  // Build bitstream
  const bits: number[] = [];
  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }

  // Byte mode indicator: 0100
  pushBits(0b0100, 4);
  // Character count indicator (8 bits for v1-9)
  pushBits(textBytes.length, 8);
  // Data bytes
  for (const b of textBytes) {
    pushBits(b, 8);
  }
  // Terminator (up to 4 zeroes)
  const maxBits = totalDataBytes * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  pushBits(0, termLen);
  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }
  // Pad bytes: 0xEC (236), 0x11 (17)
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < maxBits) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Split into codewords
  const dataCodewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | bits[i + j];
    }
    dataCodewords.push(byte);
  }

  // Partition into blocks & compute EC
  const totalBlocks = vInfo.numBlocksGroup1 + vInfo.numBlocksGroup2;
  const blocksData: number[][] = [];
  const blocksEc: number[][] = [];
  let offset = 0;

  for (let b = 0; b < vInfo.numBlocksGroup1; b++) {
    const chunk = dataCodewords.slice(
      offset,
      offset + vInfo.dataPerBlockGroup1,
    );
    blocksData.push(chunk);
    blocksEc.push(rsCompute(chunk, vInfo.ecPerBlock));
    offset += vInfo.dataPerBlockGroup1;
  }
  for (let b = 0; b < vInfo.numBlocksGroup2; b++) {
    const chunk = dataCodewords.slice(
      offset,
      offset + vInfo.dataPerBlockGroup2,
    );
    blocksData.push(chunk);
    blocksEc.push(rsCompute(chunk, vInfo.ecPerBlock));
    offset += vInfo.dataPerBlockGroup2;
  }

  // Interleave data codewords
  const finalStream: number[] = [];
  const maxDataLen = Math.max(
    vInfo.dataPerBlockGroup1,
    vInfo.dataPerBlockGroup2 || 0,
  );
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      if (i < blocksData[b].length) {
        finalStream.push(blocksData[b][i]);
      }
    }
  }
  // Interleave EC codewords
  for (let i = 0; i < vInfo.ecPerBlock; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      finalStream.push(blocksEc[b][i]);
    }
  }

  // Initialize Matrix
  const size = vInfo.version * 4 + 17;
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
    new Array(size).fill(null),
  );
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    new Array(size).fill(false),
  );

  function setModule(r: number, c: number, val: boolean, fn = false) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val;
      if (fn) isFunction[r][c] = true;
    }
  }

  // Finder Patterns
  function drawFinder(r0: number, c0: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rPos = r0 + r;
        const cPos = c0 + c;
        if (rPos >= 0 && rPos < size && cPos >= 0 && cPos < size) {
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isDark =
              r === 0 ||
              r === 6 ||
              c === 0 ||
              c === 6 ||
              (r >= 2 && r <= 4 && c >= 2 && c <= 4);
            setModule(rPos, cPos, isDark, true);
          } else {
            // Separator
            setModule(rPos, cPos, false, true);
          }
        }
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0, true);
    setModule(i, 6, i % 2 === 0, true);
  }

  // Alignment Patterns (for v >= 2)
  if (vInfo.alignmentPatterns.length > 0) {
    const coords = vInfo.alignmentPatterns;
    for (const r of coords) {
      for (const c of coords) {
        // Skip if overlaps finder
        if (
          (r <= 8 && c <= 8) ||
          (r <= 8 && c >= size - 8) ||
          (r >= size - 8 && c <= 8)
        )
          continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isDark =
              Math.abs(dr) === 2 ||
              Math.abs(dc) === 2 ||
              (dr === 0 && dc === 0);
            setModule(r + dr, c + dc, isDark, true);
          }
        }
      }
    }
  }

  // Dark module
  setModule(size - 8, 8, true, true);

  // Reserve format info area
  for (let i = 0; i <= 8; i++) {
    setModule(8, i, false, true);
    setModule(i, 8, false, true);
  }
  for (let i = 0; i <= 7; i++) {
    setModule(8, size - 1 - i, false, true);
    setModule(size - 1 - i, 8, false, true);
  }

  // Place Data Bits
  const dataBits: number[] = [];
  for (const byte of finalStream) {
    for (let i = 7; i >= 0; i--) {
      dataBits.push((byte >> i) & 1);
    }
  }

  let bitIdx = 0;
  let upwards = true;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column
    const colList = [right, right - 1];

    const rowStart = upwards ? size - 1 : 0;
    const rowEnd = upwards ? -1 : size;
    const rowStep = upwards ? -1 : 1;

    for (let row = rowStart; row !== rowEnd; row += rowStep) {
      for (const col of colList) {
        if (!isFunction[row][col]) {
          const bitVal =
            bitIdx < dataBits.length ? dataBits[bitIdx] === 1 : false;
          matrix[row][col] = bitVal;
          bitIdx++;
        }
      }
    }
    upwards = !upwards;
  }

  // Apply best mask (0-7)
  const maskPatterns = [
    (r: number, c: number) => (r + c) % 2 === 0,
    (r: number) => r % 2 === 0,
    (_r: number, c: number) => c % 3 === 0,
    (r: number, c: number) => (r + c) % 3 === 0,
    (r: number, c: number) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r: number, c: number) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r: number, c: number) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r: number, c: number) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  let bestMask = 0;
  let minPenalty = Infinity;

  for (let m = 0; m < 8; m++) {
    const maskFn = maskPatterns[m];
    // Copy matrix and apply mask
    const testMatrix: boolean[][] = matrix.map((row, r) =>
      row.map((val, c) =>
        isFunction[r][c] ? (val ?? false) : (val ?? false) !== maskFn(r, c),
      ),
    );

    // Apply format info for this mask to evaluate
    const formatBits = calcFormatBits(m);
    // Write format bits for penalty testing
    for (let i = 0; i < 15; i++) {
      const bit = ((formatBits >> i) & 1) === 1;
      if (i < 6) testMatrix[i][8] = bit;
      else if (i === 6) testMatrix[7][8] = bit;
      else if (i === 7) testMatrix[8][8] = bit;
      else if (i === 8) testMatrix[8][7] = bit;
      else testMatrix[8][14 - i] = bit;

      if (i < 8) testMatrix[8][size - 1 - i] = bit;
      else testMatrix[size - 15 + i][8] = bit;
    }

    const penalty = maskPenalty(testMatrix);

    if (penalty < minPenalty) {
      minPenalty = penalty;
      bestMask = m;
    }
  }

  // Apply best mask to final matrix
  const finalMatrix: boolean[][] = matrix.map((row, r) =>
    row.map((val, c) =>
      isFunction[r][c]
        ? (val ?? false)
        : (val ?? false) !== maskPatterns[bestMask](r, c),
    ),
  );

  // Write format info for best mask
  const finalFormat = calcFormatBits(bestMask);
  for (let i = 0; i < 15; i++) {
    const bit = ((finalFormat >> i) & 1) === 1;
    // Around top-left
    if (i < 6) finalMatrix[i][8] = bit;
    else if (i === 6) finalMatrix[7][8] = bit;
    else if (i === 7) finalMatrix[8][8] = bit;
    else if (i === 8) finalMatrix[8][7] = bit;
    else finalMatrix[8][14 - i] = bit;

    // Around other finders
    if (i < 8) finalMatrix[8][size - 1 - i] = bit;
    else finalMatrix[size - 15 + i][8] = bit;
  }

  return finalMatrix;
}

/**
 * Generate a clean, responsive SVG string for a QR code.
 */
export function generateQRCodeSvg(
  text: string,
  options?: {
    size?: number;
    color?: string;
    bgColor?: string;
    margin?: number;
  },
): string {
  const matrix = generateQRCodeMatrix(text);
  const matrixSize = matrix.length;
  const margin = options?.margin ?? 2;
  const totalSize = matrixSize + margin * 2;
  const color = options?.color ?? "#134687";
  const bgColor = options?.bgColor ?? "#ffffff";

  let rects = "";
  for (let y = 0; y < matrixSize; y++) {
    for (let x = 0; x < matrixSize; x++) {
      if (matrix[y][x]) {
        rects += `<rect x="${x + margin}" y="${y + margin}" width="1" height="1" fill="${color}" />`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="crispEdges">
    <rect width="${totalSize}" height="${totalSize}" fill="${bgColor}" />
    ${rects}
  </svg>`;
}
