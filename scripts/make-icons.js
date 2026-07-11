/**
 * make-icons.js
 * Generates ParkingFriend app-icon assets (map-pin logo) per-pixel with pngjs.
 *
 * Usage:  node scripts/make-icons.js
 *
 * Outputs (relative to project root):
 *   assets/icon.png           1024x1024  emerald bg, white pin (~55% height)
 *   assets/adaptive-icon.png  1024x1024  transparent bg, white pin (~45% height)
 *   assets/splash-icon.png    512x512    transparent bg, white pin (~60% height)
 *   assets/favicon.png        48x48      emerald bg, white pin
 *
 * The pin is a classic map-pin silhouette: a circle joined to a downward
 * triangle whose edges are exactly tangent to the circle, with a punched-out
 * inner circle. Edges are anti-aliased by 4x supersampling + box downsample.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');

const EMERALD = { r: 0x0f, g: 0xb5, b: 0x7e }; // #0FB57E
const WHITE = { r: 255, g: 255, b: 255 };

const SS = 4; // supersampling factor (4x4 = 16 samples per pixel)

/**
 * Build a coverage test for the pin shape, sized so total pin height = H px,
 * horizontally centered at cx and vertically centered at cy.
 *
 * Geometry (y grows downward):
 *   - Head circle: radius R, center (cx, y0).
 *   - Tip at (cx, y0 + T) with T = K * R.
 *   - Triangle vertices: tip + the two tangent points from tip to the circle,
 *     so the sides join the circle smoothly.
 *   - Inner hole: radius HOLE * R, same center as head circle.
 *   - Total height H = R + T = R * (1 + K); pin top = y0 - R, bottom = tip.
 */
function makePinTest(cx, cy, H) {
  const K = 1.8; // tip distance as multiple of R
  const HOLE = 0.42; // hole radius as fraction of R

  // H = R (top half of circle) + T (center to tip) = R + K*R = R * (1 + K)
  const Rr = H / (1 + K);
  const T = K * Rr;
  const y0 = cy - H / 2 + Rr; // circle center so pin spans [cy-H/2, cy+H/2]

  const rHole = HOLE * Rr;
  const RrSq = Rr * Rr;
  const rHoleSq = rHole * rHole;

  // Tangent points from tip P=(0, T) (relative to circle center) to circle:
  // y_t = R^2 / T ; x_t = sqrt(R^2 - y_t^2)
  const yt = RrSq / T;
  const xt = Math.sqrt(RrSq - yt * yt);

  return function inside(px, py) {
    const x = px - cx;
    const y = py - y0; // relative to circle center, +y downward

    // punched-out inner circle
    if (x * x + y * y <= rHoleSq) return false;

    // head circle
    if (x * x + y * y <= RrSq) return true;

    // tapering triangle (isoceles, symmetric about x = 0)
    if (y >= yt && y <= T) {
      const halfWidth = (xt * (T - y)) / (T - yt);
      if (Math.abs(x) <= halfWidth) return true;
    }
    return false;
  };
}

/**
 * Render one icon.
 * @param {number} size        output width/height in px (square)
 * @param {number} pinFrac     pin height as fraction of canvas
 * @param {object|null} bg     background color {r,g,b} or null for transparent
 * @param {object} fg          pin color {r,g,b}
 */
function renderIcon(size, pinFrac, bg, fg) {
  const png = new PNG({ width: size, height: size });
  const inside = makePinTest(size / 2, size / 2, size * pinFrac);

  const inv = 1 / SS;
  const samplesPerPx = SS * SS;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // supersample: SS x SS grid of sample points inside this pixel
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        const py = y + (sy + 0.5) * inv;
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) * inv;
          if (inside(px, py)) hits++;
        }
      }
      const cov = hits / samplesPerPx; // 0..1 pin coverage

      const idx = (size * y + x) << 2;
      if (bg) {
        // opaque: blend fg over bg by coverage
        png.data[idx] = Math.round(bg.r + (fg.r - bg.r) * cov);
        png.data[idx + 1] = Math.round(bg.g + (fg.g - bg.g) * cov);
        png.data[idx + 2] = Math.round(bg.b + (fg.b - bg.b) * cov);
        png.data[idx + 3] = 255;
      } else {
        // transparent bg: white pin with alpha = coverage
        png.data[idx] = fg.r;
        png.data[idx + 1] = fg.g;
        png.data[idx + 2] = fg.b;
        png.data[idx + 3] = Math.round(255 * cov);
      }
    }
  }
  return PNG.sync.write(png);
}

const JOBS = [
  { file: 'icon.png', size: 1024, pinFrac: 0.55, bg: EMERALD },
  { file: 'adaptive-icon.png', size: 1024, pinFrac: 0.45, bg: null },
  { file: 'splash-icon.png', size: 512, pinFrac: 0.6, bg: null },
  { file: 'favicon.png', size: 48, pinFrac: 0.6, bg: EMERALD },
];

function generate() {
  if (!fs.existsSync(ASSETS)) fs.mkdirSync(ASSETS, { recursive: true });
  for (const job of JOBS) {
    const buf = renderIcon(job.size, job.pinFrac, job.bg, WHITE);
    const out = path.join(ASSETS, job.file);
    fs.writeFileSync(out, buf);
    console.log(`wrote ${job.file}  ${job.size}x${job.size}  ${buf.length} bytes`);
  }
}

function verify() {
  let ok = true;
  console.log('\n--- verify ---');
  for (const job of JOBS) {
    const out = path.join(ASSETS, job.file);
    if (!fs.existsSync(out)) {
      console.error(`FAIL ${job.file}: missing`);
      ok = false;
      continue;
    }
    const bytes = fs.statSync(out).size;
    const png = PNG.sync.read(fs.readFileSync(out));

    if (png.width !== job.size || png.height !== job.size) {
      console.error(
        `FAIL ${job.file}: expected ${job.size}x${job.size}, got ${png.width}x${png.height}`
      );
      ok = false;
      continue;
    }

    // count fully white, fully opaque pixels (the pin body)
    let whitePixels = 0;
    let holeBgPixels = 0; // pixels at exact center of hole matching background
    for (let i = 0; i < png.data.length; i += 4) {
      if (
        png.data[i] === 255 &&
        png.data[i + 1] === 255 &&
        png.data[i + 2] === 255 &&
        png.data[i + 3] === 255
      ) {
        whitePixels++;
      }
    }

    // sanity-check the punched hole: sample the hole center pixel.
    // hole center = circle center = cy - H/2 + R, R = H / 2.8
    const H = job.size * job.pinFrac;
    const R = H / 2.8;
    const holeY = Math.round(job.size / 2 - H / 2 + R);
    const holeX = Math.round(job.size / 2);
    const hIdx = (png.width * holeY + holeX) << 2;
    const hA = png.data[hIdx + 3];
    const holeIsPunched = job.bg
      ? png.data[hIdx] === job.bg.r && png.data[hIdx + 1] === job.bg.g && png.data[hIdx + 2] === job.bg.b
      : hA === 0;
    if (holeIsPunched) holeBgPixels = 1;

    const pass = whitePixels > 0 && holeIsPunched;
    if (!pass) ok = false;
    console.log(
      `${pass ? 'OK  ' : 'FAIL'} ${job.file}  ${png.width}x${png.height}  ${bytes} bytes  ` +
        `whitePixels=${whitePixels}  holePunched=${holeIsPunched}`
    );
  }
  if (!ok) {
    console.error('\nVERIFY FAILED');
    process.exit(1);
  }
  console.log('\nAll assets verified.');
}

generate();
verify();
