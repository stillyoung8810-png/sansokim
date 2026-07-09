import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const SRC = path.resolve(
  '/home/yty/.cursor/projects/home-yty-workspace-sansokim/assets/c__Users_user_AppData_Roaming_Cursor_User_workspaceStorage_2562234363fb2a95b97cea72893c74da_images_______-effd10e2-11d7-47e4-a5be-57ad33dfb8c6.png',
);
const OUT_DIR = path.resolve('/home/yty/workspace/sansokim/assets/logo');
const SIZE = 600;
const ICON_SCALE = 0.72;
const PEACH = { r: 255, g: 232, b: 214 };
const DARK_BG = { r: 30, g: 30, b: 35 };

async function extractIconBuffer() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const idx = (y * info.width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a < 10 || (r < 40 && g < 40 && b < 40)) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  return sharp(SRC)
    .extract({ left: minX, top: minY, width: cropW, height: cropH })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .then(async ({ data: cropData, info: cropInfo }) => {
      const cleaned = Buffer.alloc(cropInfo.width * cropInfo.height * 4);

      for (let y = 0; y < cropInfo.height; y += 1) {
        for (let x = 0; x < cropInfo.width; x += 1) {
          const idx = (y * cropInfo.width + x) * 4;
          const r = cropData[idx];
          const g = cropData[idx + 1];
          const b = cropData[idx + 2];
          const a = cropData[idx + 3];

          if (a < 10 || (r < 40 && g < 40 && b < 40)) {
            cleaned[idx] = 0;
            cleaned[idx + 1] = 0;
            cleaned[idx + 2] = 0;
            cleaned[idx + 3] = 0;
          } else {
            cleaned[idx] = r;
            cleaned[idx + 1] = g;
            cleaned[idx + 2] = b;
            cleaned[idx + 3] = 255;
          }
        }
      }

      return sharp(cleaned, {
        raw: { width: cropInfo.width, height: cropInfo.height, channels: 4 },
      })
        .png()
        .toBuffer();
    });
}

async function composeOnBackground(iconBuffer, bg, outputPath) {
  const iconMeta = await sharp(iconBuffer).metadata();
  const target = Math.round(SIZE * ICON_SCALE);
  const scale = Math.min(target / iconMeta.width, target / iconMeta.height);
  const resizedW = Math.max(1, Math.round(iconMeta.width * scale));
  const resizedH = Math.max(1, Math.round(iconMeta.height * scale));

  const resizedIcon = await sharp(iconBuffer)
    .resize(resizedW, resizedH, { fit: 'inside', kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  const offsetX = Math.floor((SIZE - resizedW) / 2);
  const offsetY = Math.floor((SIZE - resizedH) / 2);

  await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 3,
      background: bg,
    },
  })
    .composite([{ input: resizedIcon, left: offsetX, top: offsetY }])
    .png()
    .toFile(outputPath);
}

async function buildPreview(peachPath, darkPath, outPath) {
  const peach = await sharp(peachPath).resize(500, 500).toBuffer();
  const dark = await sharp(darkPath).resize(500, 500).toBuffer();
  const small48 = await sharp(darkPath).resize(48, 48).toBuffer();
  const small64 = await sharp(darkPath).resize(64, 64).toBuffer();
  const small96 = await sharp(darkPath).resize(96, 96).toBuffer();

  const canvas = sharp({
    create: {
      width: 1200,
      height: 760,
      channels: 3,
      background: { r: 18, g: 18, b: 22 },
    },
  });

  await canvas
    .composite([
      { input: peach, left: 50, top: 140 },
      { input: dark, left: 650, top: 140 },
      { input: small48, left: 650, top: 520 },
      { input: small64, left: 770, top: 512 },
      { input: small96, left: 890, top: 496 },
    ])
    .png()
    .toFile(outPath);
}

async function analyzeContrast(imagePath, bg) {
  const { data, info } = await sharp(imagePath).removeAlpha().raw().toBuffer({ resolveWithObject: true });

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (r < 50 && g < 50 && b < 50) {
      continue;
    }

    sumR += r;
    sumG += g;
    sumB += b;
    count += 1;
  }

  const avgR = sumR / count;
  const avgG = sumG / count;
  const avgB = sumB / count;
  const iconLum = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;
  const bgLum = 0.299 * bg.r + 0.587 * bg.g + 0.114 * bg.b;
  const contrast = (Math.max(iconLum, bgLum) + 5) / (Math.min(iconLum, bgLum) + 5);

  return { avgR, avgG, avgB, contrast };
}

await mkdir(OUT_DIR, { recursive: true });

const iconBuffer = await extractIconBuffer();
const peachPath = path.join(OUT_DIR, 'harugibu-logo-600x600-peach.png');
const darkPath = path.join(OUT_DIR, 'harugibu-logo-600x600-dark-bg.png');
const previewPath = path.join(OUT_DIR, 'harugibu-logo-preview.png');

await composeOnBackground(iconBuffer, PEACH, peachPath);
await composeOnBackground(iconBuffer, DARK_BG, darkPath);
await buildPreview(peachPath, darkPath, previewPath);

const peachContrast = await analyzeContrast(peachPath, PEACH);
const darkContrast = await analyzeContrast(darkPath, DARK_BG);

console.log('Created:', peachPath);
console.log('Created:', darkPath);
console.log('Created:', previewPath);
console.log('Peach bg contrast:', peachContrast.contrast.toFixed(2));
console.log('Dark bg contrast:', darkContrast.contrast.toFixed(2));
console.log('Dark bg readable:', darkContrast.contrast >= 2.5 ? 'YES' : 'NEEDS IMPROVEMENT');
