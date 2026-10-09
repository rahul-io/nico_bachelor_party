// Builds the web-ready brand images in public/brand from the source boards in design/brand.
//   node scripts/make-brand.mjs
// Sources are the files Peter supplied; nothing here is hand-edited afterwards.
import sharp from "sharp";

const src = (name) => `design/brand/${name}.webp`;
const out = (name) => `public/brand/${name}.webp`;

/** Full-bleed photographs and textures: resized and recompressed. */
const photos = [
  // [source, output, width, quality, optional crop {left, top, width, height}]
  ["chart-night", "bg-night", 900, 62],
  ["chart-night-wide", "bg-night-wide", 1600, 62],
  ["chart-day", "bg-day", 900, 70],
  ["chart-day-wide", "bg-day-wide", 1600, 70],
  ["sunset-wide", "hero-sunset", 1400, 72],
  ["sunset", "hero-sunset-tall", 900, 72],
  // The tiki and the drink sit in the lower half of the portrait.
  ["tiki-night", "tiki", 900, 70, { left: 0, top: 700, width: 941, height: 760 }],
];

for (const [source, name, width, quality, crop] of photos) {
  let image = sharp(src(source));
  if (crop) image = image.extract(crop);
  const info = await image.resize({ width }).webp({ quality }).toFile(out(name));
  console.log(`${out(name)}  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB`);
}

/** Marks supplied as their own transparent files: trimmed and resized. */
const singles = [
  // [source, output, width]
  ["crest", "lockup", 720],
  ["divider", "rope", 900],
];

for (const [source, name, width] of singles) {
  const cut = await sharp(src(source)).trim().png().toBuffer();
  const info = await sharp(cut).resize({ width }).webp({ quality: 90 }).toFile(out(name));
  console.log(`${out(name)}  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB`);
}

/** Marks cut out of the transparent logo sheet, trimmed tight. */
const marks = [
  ["logo-sheet", "capn-crider", { left: 20, top: 520, width: 330, height: 370 }],
  ["logo-sheet", "commodores-challenge", { left: 380, top: 540, width: 430, height: 330 }],
];

for (const [source, name, crop] of marks) {
  const cut = await sharp(src(source)).extract(crop).png().toBuffer();
  const info = await sharp(cut).trim().webp({ quality: 90 }).toFile(out(name));
  console.log(`${out(name)}  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB`);
}

/**
 * Slot machine artwork (design/brand/slot). The seven symbols keep their
 * 512 px canvas so they stay the same size relative to each other. The frame
 * is cropped to its artwork; SlotReels.tsx places the reels over its window,
 * which sits at x 96–983, y 520–815 of the 1080 × 1440 source.
 */
import { mkdirSync } from "node:fs";

mkdirSync("public/brand/slot", { recursive: true });
for (const name of ["1x", "2x", "3x", "bust", "jackpot", "rob", "forward"]) {
  const file = `public/brand/slot/${name}.webp`;
  const info = await sharp(`design/brand/slot/slot-${name}.png`).resize({ width: 192 }).webp({ quality: 90 }).toFile(file);
  console.log(`${file}  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB`);
}
{
  const file = "public/brand/slot/frame.webp";
  const info = await sharp("design/brand/slot/slot-frame.webp")
    .extract({ left: 0, top: 100, width: 1080, height: 1064 })
    .resize({ width: 900 })
    .webp({ quality: 88 })
    .toFile(file);
  console.log(`${file}  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB`);
}

/** Badge crests (design/brand/badges), used by the seeded badges in src/lib/badges/seed.ts. */
import { readdirSync } from "node:fs";

mkdirSync("public/brand/badges", { recursive: true });
for (const source of readdirSync("design/brand/badges")) {
  const file = `public/brand/badges/${source}`;
  const info = await sharp(`design/brand/badges/${source}`).resize({ width: 400 }).webp({ quality: 82 }).toFile(file);
  console.log(`${file}  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB`);
}
