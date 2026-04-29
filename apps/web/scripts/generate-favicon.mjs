import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(webRoot, "public");
const source = path.join(publicDir, "lessonforge_favicon.svg");

async function pngBuffer(size) {
  return sharp(source).resize(size, size).png().toBuffer();
}

function createIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0);
  entry.writeUInt8(32, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, png]);
}

const icons = [
  ["favicon-16x16.png", 16],
  ["favicon-32x32.png", 32],
  ["apple-touch-icon.png", 180],
  ["android-chrome-192x192.png", 192],
  ["android-chrome-512x512.png", 512],
];

await Promise.all(
  icons.map(([filename, size]) =>
    sharp(source).resize(size, size).png().toFile(path.join(publicDir, filename))
  )
);

await fs.writeFile(path.join(publicDir, "favicon.ico"), createIco(await pngBuffer(32)));

console.log("Generated LessonForge favicon assets.");
