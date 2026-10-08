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

/** Marks cut out of the transparent logo sheet, trimmed tight. */
const marks = [
  ["logo-sheet", "lockup", { left: 0, top: 110, width: 420, height: 410 }],
  ["logo-sheet", "capn-crider", { left: 20, top: 520, width: 330, height: 370 }],
  ["logo-sheet", "commodores-challenge", { left: 380, top: 540, width: 430, height: 330 }],
  ["logo-sheet", "rope", { left: 945, top: 858, width: 445, height: 46 }],
];

for (const [source, name, crop] of marks) {
  const cut = await sharp(src(source)).extract(crop).png().toBuffer();
  const info = await sharp(cut).trim().webp({ quality: 90 }).toFile(out(name));
  console.log(`${out(name)}  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB`);
}
