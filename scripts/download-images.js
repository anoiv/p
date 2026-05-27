const fs = require('fs');
const path = require('path');
const https = require('https');
const sharp = require('sharp');

const IMAGE_URLS = require('../_data/prompts/image-urls.json');
const OUTPUT_DIR = path.join(__dirname, '..', '_data', 'images');
const IMG_WIDTH = 400; // resize to 400px wide

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function download(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'Origin': 'https://youmind.com',
        'Referer': 'https://youmind.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };
    https.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        download(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function processImage(url, outputPath) {
  const buffer = await download(url);
  // Resize with sharp, maintain aspect ratio
  const resized = await sharp(buffer)
    .resize({ width: IMG_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 80, progressive: true })
    .toBuffer();
  fs.writeFileSync(outputPath, resized);
  return { original: buffer.length, resized: resized.length };
}

async function main() {
  // Filter already downloaded
  const todo = [];
  for (const url of IMAGE_URLS) {
    const filename = url.split('/').pop().replace(/[?#].*$/, '');
    const dest = path.join(OUTPUT_DIR, filename);
    if (fs.existsSync(dest)) continue;
    todo.push({ url, dest, filename });
  }

  console.log(`${IMAGE_URLS.length} total, ${todo.length} to download`);

  let count = 0;
  let totalOrig = 0;
  let totalNew = 0;
  const BATCH = 5;

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(({ url, dest }) => processImage(url, dest))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      count++;
      if (result.status === 'fulfilled') {
        totalOrig += result.value.original;
        totalNew += result.value.resized;
        const pct = ((1 - result.value.resized / result.value.original) * 100).toFixed(0);
        if (count % 50 === 0) {
          console.log(`[${count}/${todo.length}] ${batch[j].filename} (${(result.value.original/1024).toFixed(0)}KB -> ${(result.value.resized/1024).toFixed(0)}KB, -${pct}%)`);
        }
      } else {
        console.log(`[${count}/${todo.length}] FAIL: ${batch[j].filename} - ${result.reason.message}`);
      }
    }
  }

  console.log(`\nDone! ${count} processed`);
  console.log(`Storage: ${(totalOrig/1024/1024).toFixed(0)}MB -> ${(totalNew/1024/1024).toFixed(0)}MB (${((1-totalNew/totalOrig)*100).toFixed(0)}% saved)`);
}

main().catch(console.error);
