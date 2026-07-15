// Generate web-optimized WebP versions of the food photos.
// Static export can't optimize images at request time, so we do it once here.
// Run with: npm run optimize:images
import { readdir, stat } from "node:fs/promises";
import { join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const DIR = fileURLToPath(new URL("../public/food/", import.meta.url));
const MAX_WIDTH = 800; // covers hero on high-DPI phones; plenty for cards
const QUALITY = 74;

const files = (await readdir(DIR)).filter((f) => /\.(jpe?g|png)$/i.test(f));
if (files.length === 0) {
  console.log("No source images found in public/food/.");
  process.exit(0);
}

let before = 0;
let after = 0;

for (const file of files) {
  const src = join(DIR, file);
  const out = join(DIR, `${parse(file).name}.webp`);
  const srcSize = (await stat(src)).size;

  await sharp(src)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(out);

  const outSize = (await stat(out)).size;
  before += srcSize;
  after += outSize;
  const pct = Math.round((1 - outSize / srcSize) * 100);
  console.log(`${file.padEnd(22)} ${(srcSize / 1024).toFixed(0)}KB -> ${(outSize / 1024).toFixed(0)}KB  (-${pct}%)`);
}

console.log(
  `\nTotal: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB  ` +
    `(-${Math.round((1 - after / before) * 100)}%) across ${files.length} images`,
);
