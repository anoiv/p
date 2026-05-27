const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://raw.githubusercontent.com/YouMind-OpenLab/nano-banana-pro-prompts-recommend-skill/main/references';
const FILES = [
  'social-media-post.json',
  'product-marketing.json',
  'profile-avatar.json',
  'others.json',
  'poster-flyer.json',
  'ecommerce-main-image.json',
  'game-asset.json',
  'infographic-edu-visual.json',
  'comic-storyboard.json',
  'youtube-thumbnail.json',
  'app-web-design.json',
];

const RAW_DIR = path.join(__dirname, '..', '_data', 'raw');
const OUTPUT_DIR = path.join(__dirname, '..', '_data', 'prompts');
const TARGET_COUNT = 5000;

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve(body));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true });
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Step 1: Download all JSON files
  console.log('Step 1: Downloading JSON data files...\n');
  let allPrompts = [];
  const categoryStats = [];

  for (const file of FILES) {
    const categoryName = file.replace('.json', '');
    const url = `${BASE_URL}/${file}`;
    console.log(`  ${file}...`);
    const raw = await fetch(url);
    const prompts = JSON.parse(raw);

    // Normalize data structure
    const normalized = prompts.map((p) => ({
      title: p.title || '',
      prompt: p.content || '',
      description: p.description || '',
      image: (p.sourceMedia && p.sourceMedia[0]) || '',
      images: p.sourceMedia || [],
      category: categoryName,
      type: 'image',
      language: 'ZH',
      tags: [],
    }));

    console.log(`    -> ${normalized.length} prompts`);
    categoryStats.push({ category: categoryName, total: normalized.length });
    allPrompts.push(...normalized);
  }

  console.log(`\n  Total: ${allPrompts.length} prompts`);

  // Step 2: Sample prompts proportionally from each category
  console.log(`\nStep 2: Sampling ${TARGET_COUNT} prompts...`);

  // Calculate how many to take from each category
  const totalAll = categoryStats.reduce((s, c) => s + c.total, 0);
  const sampled = [];
  const seen = new Set();

  for (const { category, total } of categoryStats) {
    const target = Math.max(50, Math.round((total / totalAll) * TARGET_COUNT));
    const catPrompts = allPrompts.filter((p) => p.category === category);
    // Shuffle and take target
    const shuffled = catPrompts.sort(() => Math.random() - 0.5);
    const taken = shuffled.slice(0, target);
    // Deduplicate by title
    for (const p of taken) {
      const key = p.title.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        sampled.push(p);
      }
    }
    console.log(`  ${category}: ${taken.length} selected (out of ${total})`);
  }

  // If we don't have enough, fill from remaining
  if (sampled.length < TARGET_COUNT) {
    const remaining = allPrompts.filter(
      (p) => !seen.has(p.title.toLowerCase())
    );
    const shuffled = remaining.sort(() => Math.random() - 0.5);
    const needed = TARGET_COUNT - sampled.length;
    const extra = shuffled.slice(0, needed);
    for (const p of extra) {
      if (!seen.has(p.title.toLowerCase())) {
        seen.add(p.title.toLowerCase());
        sampled.push(p);
      }
    }
  }

  console.log(`\n  Final sample: ${sampled.length} prompts`);

  // Step 3: Save output
  console.log('\nStep 3: Saving output files...');

  // Save as single file
  const allPath = path.join(OUTPUT_DIR, 'all.json');
  fs.writeFileSync(allPath, JSON.stringify(sampled, null, 2));
  console.log(`  -> ${allPath} (${(fs.statSync(allPath).size / 1024 / 1024).toFixed(1)} MB)`);

  // Save by category
  for (const { category } of categoryStats) {
    const catPrompts = sampled.filter((p) => p.category === category);
    if (catPrompts.length === 0) continue;
    const catPath = path.join(OUTPUT_DIR, `${category}.json`);
    fs.writeFileSync(catPath, JSON.stringify(catPrompts, null, 2));
    console.log(`  -> ${catPath} (${catPrompts.length} prompts)`);
  }

  // Save image URL list for download
  const imageUrls = [...new Set(sampled.map((p) => p.image).filter(Boolean))];
  const imgPath = path.join(OUTPUT_DIR, 'image-urls.json');
  fs.writeFileSync(imgPath, JSON.stringify(imageUrls, null, 2));
  console.log(`  -> ${imgPath} (${imageUrls.length} unique images)`);

  console.log('\nDone!');
}

main().catch(console.error);
