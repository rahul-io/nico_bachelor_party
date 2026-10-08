// Regenerates the in-app logo and the link-preview image from design/logo-source.webp.
//   node scripts/make-logo.mjs
// The background colour mirrors --color-canvas in src/app/globals.css.
import sharp from "sharp";

const SOURCE = "design/logo-source.webp";
const CANVAS = "#0b0a12";

// Trim the transparent margin, then pad back to a square so the artwork is centred.
const trimmed = await sharp(SOURCE).trim().toBuffer({ resolveWithObject: true });
const side = Math.max(trimmed.info.width, trimmed.info.height);
const square = await sharp(trimmed.data)
  .extend({
    top: Math.floor((side - trimmed.info.height) / 2),
    bottom: Math.ceil((side - trimmed.info.height) / 2),
    left: Math.floor((side - trimmed.info.width) / 2),
    right: Math.ceil((side - trimmed.info.width) / 2),
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

await sharp(square).resize(512, 512).png().toFile("public/logo.png");
console.log("public/logo.png (512px, transparent)");

// 1200x630 is the size link previews expect.
const badge = await sharp(square).resize(520, 520).png().toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 4, background: CANVAS } })
  .composite([{ input: badge, gravity: "centre" }])
  .png()
  .toFile("public/og.png");
console.log("public/og.png (1200x630)");
