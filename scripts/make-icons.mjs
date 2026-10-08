// Regenerates the app icons: the mascot badge on navy. Run after changing the logo or the navy:
//   node scripts/make-logo.mjs && node scripts/make-icons.mjs
// The navy mirrors --color-chrome in src/app/globals.css.
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const CHROME = "#0b1f33";
const BADGE = "public/logo.png";

/**
 * @param {number} size   Output size in pixels.
 * @param {number} scale  How much of the square the badge fills. Maskable icons keep it inside the safe zone.
 * @param {number} radius Corner radius as a fraction of the size; 0 for full-bleed squares.
 */
async function icon(size, scale, radius, file) {
  const badge = await sharp(BADGE)
    .resize(Math.round(size * scale), Math.round(size * scale))
    .png()
    .toBuffer();
  const corner = Math.round(size * radius);
  const background = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${corner}" fill="${CHROME}"/></svg>`,
  );
  await sharp(background).composite([{ input: badge, gravity: "centre" }]).png().toFile(file);
  console.log(`${file} (${size}px)`);
}

mkdirSync("public/icons", { recursive: true });

await icon(96, 0.92, 0.22, "src/app/icon.png");
await icon(180, 0.9, 0, "src/app/apple-icon.png");
await icon(192, 0.92, 0.22, "public/icons/icon-192.png");
await icon(512, 0.92, 0.22, "public/icons/icon-512.png");
await icon(512, 0.68, 0, "public/icons/maskable-512.png");
