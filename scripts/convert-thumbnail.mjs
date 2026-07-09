import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const SRC = path.resolve(
  '/home/yty/.cursor/projects/home-yty-workspace-sansokim/assets/c__Users_user_AppData_Roaming_Cursor_User_workspaceStorage_2562234363fb2a95b97cea72893c74da_images_________-9af8468c-2f5e-423a-81de-bf42d6fe9491.png',
);
const OUT_DIR = path.resolve('/home/yty/workspace/sansokim/assets/logo');
const WIDTH = 1932;
const HEIGHT = 828;
const PEACH = { r: 255, g: 232, b: 214 };

async function replaceDarkBackgroundWithPeach(inputBuffer, width, height) {
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const output = Buffer.alloc(data.length);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 10 || (r < 45 && g < 45 && b < 45)) {
      output[i] = PEACH.r;
      output[i + 1] = PEACH.g;
      output[i + 2] = PEACH.b;
      output[i + 3] = 255;
      continue;
    }

    output[i] = r;
    output[i + 1] = g;
    output[i + 2] = b;
    output[i + 3] = 255;
  }

  return sharp(output, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function buildPreview(thumbnailPath, previewPath) {
  const small = await sharp(thumbnailPath).resize(483, 207).toBuffer();
  const medium = await sharp(thumbnailPath).resize(966, 414).toBuffer();

  await sharp({
    create: {
      width: 1200,
      height: 700,
      channels: 3,
      background: { r: 24, g: 24, b: 28 },
    },
  })
    .composite([
      { input: medium, left: 117, top: 80 },
      { input: small, left: 117, top: 520 },
    ])
    .png()
    .toFile(previewPath);
}

await mkdir(OUT_DIR, { recursive: true });

const meta = await sharp(SRC).metadata();
const peachBuffer = await replaceDarkBackgroundWithPeach(
  await sharp(SRC).toBuffer(),
  meta.width,
  meta.height,
);

const outputPath = path.join(OUT_DIR, 'harugibu-thumbnail-1932x828.png');
const previewPath = path.join(OUT_DIR, 'harugibu-thumbnail-preview.png');

await sharp(peachBuffer)
  .resize(WIDTH, HEIGHT, {
    fit: 'fill',
    kernel: sharp.kernel.lanczos3,
  })
  .png()
  .toFile(outputPath);

await buildPreview(outputPath, previewPath);

const outMeta = await sharp(outputPath).metadata();
console.log(`Source: ${meta.width}x${meta.height}`);
console.log(`Created: ${outputPath}`);
console.log(`Output: ${outMeta.width}x${outMeta.height}`);
console.log(`Created preview: ${previewPath}`);
