const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const HTML_FILE = path.join(__dirname, 'index.html');
const IMG_DIR = path.join(__dirname, 'images');

// Extract all unique cms-assets.youmind.com URLs
const html = fs.readFileSync(HTML_FILE, 'utf-8');
const urlSet = new Set();
const re = /https:\/\/cms-assets\.youmind\.com\/media\/[^\s"')]+/g;
let m;
while ((m = re.exec(html)) !== null) {
  urlSet.add(m[0]);
}

const urls = [...urlSet];
console.log(`Found ${urls.length} unique image URLs`);

// Create images directory
if (!fs.existsSync(IMG_DIR)) {
  fs.mkdirSync(IMG_DIR);
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'Referer': 'https://youmind.com/',
        'Origin': 'https://youmind.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };
    proto.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        console.error(`  FAIL [${res.statusCode}]: ${url}`);
        resolve(null);
        return;
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(dest);
      });
      file.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      console.error(`  ERROR: ${url} - ${err.message}`);
      resolve(null);
    });
  });
}

async function main() {
  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const filename = url.split('/').pop();
    const dest = path.join(IMG_DIR, filename);

    if (fs.existsSync(dest)) {
      console.log(`[${i + 1}/${urls.length}] SKIP (exists): ${filename}`);
      downloaded++;
      continue;
    }

    console.log(`[${i + 1}/${urls.length}] DOWNLOAD: ${filename}`);
    try {
      const result = await download(url, dest);
      if (result) downloaded++;
      else failed++;
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${downloaded} downloaded, ${failed} failed`);
}

main().catch(console.error);
