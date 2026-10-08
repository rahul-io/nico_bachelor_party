// Regenerates the app icons from the SVG below. Run after changing the artwork or brand colours:
//   node scripts/make-icons.mjs
// Colours here mirror the theme tokens in src/app/globals.css.
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const CANVAS = "#0b0a12";
const PRIMARY = "#ff4d8d";
const ACCENT = "#ffc53d";
const ACCENT_SHADE = "#e3a51a";
const INK = "#f4f1ff";

/**
 * @param {object} options
 * @param {number} options.scale   Artwork scale. Maskable icons keep it inside the central safe zone.
 * @param {number} options.radius  Corner radius of the background; 0 for full-bleed squares.
 */
function svg({ scale, radius }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="glow" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="${PRIMARY}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${PRIMARY}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="${radius}" fill="${CANVAS}"/>
  <rect width="512" height="512" rx="${radius}" fill="url(#glow)"/>
  <g transform="translate(256 256) scale(${scale}) translate(-270 -250)">
    <path d="M316 228h26a38 38 0 0 1 38 38v34a38 38 0 0 1-38 38h-26" fill="none" stroke="${ACCENT}" stroke-width="24" stroke-linecap="round"/>
    <rect x="176" y="196" width="140" height="170" rx="20" fill="${ACCENT}"/>
    <rect x="212" y="244" width="16" height="92" rx="8" fill="${ACCENT_SHADE}"/>
    <rect x="264" y="244" width="16" height="92" rx="8" fill="${ACCENT_SHADE}"/>
    <g fill="${INK}">
      <rect x="170" y="186" width="152" height="30" rx="15"/>
      <circle cx="194" cy="182" r="30"/>
      <circle cx="238" cy="166" r="38"/>
      <circle cx="286" cy="176" r="32"/>
      <circle cx="310" cy="194" r="22"/>
      <rect x="192" y="200" width="24" height="52" rx="12"/>
    </g>
  </g>
</svg>`;
}

const rounded = svg({ scale: 1.35, radius: 112 });
const square = svg({ scale: 1.35, radius: 0 });
const maskable = svg({ scale: 1.0, radius: 0 });

mkdirSync("public/icons", { recursive: true });

const outputs = [
  [rounded, 96, "src/app/icon.png"],
  [square, 180, "src/app/apple-icon.png"],
  [rounded, 192, "public/icons/icon-192.png"],
  [rounded, 512, "public/icons/icon-512.png"],
  [maskable, 512, "public/icons/maskable-512.png"],
];

for (const [source, size, file] of outputs) {
  await sharp(Buffer.from(source), { density: 300 }).resize(size, size).png().toFile(file);
  console.log(`${file} (${size}px)`);
}
