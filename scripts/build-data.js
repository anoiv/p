const fs = require('fs');
const path = require('path');

const NEW_DATA = path.join(__dirname, '..', '_data', 'prompts', 'all.json');
const EXISTING_VIDEO = path.join(__dirname, '..', 'seedance-data.js'); // video prompts
const IMG_SRC = path.join(__dirname, '..', '_data', 'images');
const IMG_DST = path.join(__dirname, '..', 'images');
const OUTPUT = path.join(__dirname, '..', 'prompts.json');

// Step 1: Load new Nano Banana image prompts
const newPrompts = JSON.parse(fs.readFileSync(NEW_DATA, 'utf-8'));
console.log(`New image prompts: ${newPrompts.length}`);

// Step 2: Load existing video prompts from seedance-data.js
const seedanceRaw = fs.readFileSync(EXISTING_VIDEO, 'utf-8');
const seedanceMatch = seedanceRaw.match(/const SEEDANCE_PROMPTS = (\[[\s\S]*?\]);/);
const seedancePrompts = seedanceMatch ? JSON.parse(seedanceMatch[1]) : [];
console.log(`Existing video prompts: ${seedancePrompts.length}`);

// Step 3: Load existing image prompts from youmind-data.js (if not already covered)
// All new prompts have type: 'image', existing seedance has type: 'video'
// We keep ALL seedance video prompts + ALL new image prompts
const merged = [...seedancePrompts, ...newPrompts];
console.log(`Merged total: ${merged.length}`);

// Step 4: Update image URLs for new prompts
// New prompts have image URLs pointing to cms-assets.youmind.com
// We need to replace them with the local path
for (const p of newPrompts) {
  if (p.image) {
    const filename = p.image.split('/').pop().replace(/[?#].*$/, '');
    p.image = 'images/' + filename;
  }
  if (p.images) {
    p.images = p.images.map((url) => {
      const filename = url.split('/').pop().replace(/[?#].*$/, '');
      return 'images/' + filename;
    });
  }
}

// Step 5: Save merged data
fs.writeFileSync(OUTPUT, JSON.stringify(merged, null, 2));
const sizeMB = (fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1);
console.log(`Saved: ${OUTPUT} (${sizeMB} MB)`);

// Step 6: Copy new images to public directory
if (fs.existsSync(IMG_SRC)) {
  const files = fs.readdirSync(IMG_SRC);
  let copied = 0;
  for (const f of files) {
    const src = path.join(IMG_SRC, f);
    const dst = path.join(IMG_DST, f);
    if (!fs.existsSync(dst)) {
      fs.copyFileSync(src, dst);
      copied++;
    }
  }
  console.log(`Copied ${copied} new images to images/`);
}

console.log('\nBuild complete!');
