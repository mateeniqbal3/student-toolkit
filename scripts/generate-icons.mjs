/**
 * Renders the app icons from an inline SVG so there are no binary source
 * assets in the repo and the icons can be regenerated after a brand change.
 *
 * Run with: npm run icons
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const TEAL = "#0f766e";
const PAPER = "#fdfcf7";

/** The lucide graduation-cap outline, drawn on a 24x24 grid. */
const CAP = `
  <g fill="none" stroke="${PAPER}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
    <path d="M22 10v6" />
    <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
  </g>
`;

/**
 * @param {number} size    output pixel size
 * @param {number} inset   fraction of the canvas the glyph occupies
 * @param {number} radius  corner radius in pixels, 0 for a full bleed square
 */
function svg(size, inset, radius) {
  const glyph = size * inset;
  const offset = (size - glyph) / 2;
  const scale = glyph / 24;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${TEAL}" />
  <g transform="translate(${offset} ${offset}) scale(${scale})">${CAP}</g>
</svg>`;
}

async function png(path, size, inset, radius) {
  const buffer = await sharp(Buffer.from(svg(size, inset, radius)))
    .png()
    .toBuffer();
  await writeFile(path, buffer);
  console.log(`  ${path}  ${size}x${size}`);
}

await mkdir("public/icons", { recursive: true });

console.log("Generating icons...");
// "any" icons keep a rounded-square silhouette of their own.
await png("public/icons/icon-192.png", 192, 0.56, 42);
await png("public/icons/icon-512.png", 512, 0.56, 112);
// A maskable icon is full bleed: the platform crops it, so the glyph sits
// inside the 80% safe zone and the background reaches every edge.
await png("public/icons/maskable-512.png", 512, 0.44, 0);
// Next.js serves these two automatically from src/app.
await png("src/app/icon.png", 512, 0.56, 112);
await png("src/app/apple-icon.png", 180, 0.6, 0);

// Also emit the source SVG for anyone wanting a vector copy.
await writeFile("public/icons/icon.svg", svg(512, 0.56, 112));
console.log("  public/icons/icon.svg");
