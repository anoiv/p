const fs = require('fs');

const prompts = JSON.parse(fs.readFileSync('C:/Users/Anooo/website-p/prompts.json', 'utf-8'));
const orig = JSON.parse(fs.readFileSync('C:/Users/Anooo/aishort-orig.json', 'utf-8'));

// Build title -> original English prompt from AiShort source
const origByTitle = {};
for (const item of orig) {
  if (item.zh && item.zh.title) {
    origByTitle[item.zh.title] = item.zh.prompt;
  }
}

let fixed = 0;
for (const p of prompts) {
  if (p.source !== 'aishort.top') continue;
  // Check if translated prompt is too short (< 30 chars = API refusal)
  if (p.prompt && p.prompt.length < 30) {
    const originalPrompt = origByTitle[p.title];
    if (originalPrompt) {
      console.log('RESTORED:', p.title, '(' + p.prompt.length + ' -> ' + originalPrompt.length + ' chars)');
      p.prompt = originalPrompt;
      fixed++;
    }
  }
}

console.log('\nRestored ' + fixed + ' prompts to original English.\n');

fs.writeFileSync('C:/Users/Anooo/website-p/prompts.json', JSON.stringify(prompts), 'utf-8');

// Re-chunk
const CHUNK = 1000;
const total = Math.ceil(prompts.length / CHUNK);
for (let i = 0; i < total; i++) {
  const chunk = prompts.slice(i * CHUNK, (i + 1) * CHUNK);
  fs.writeFileSync('C:/Users/Anooo/website-p/prompts-chunk-' + i + '.json', JSON.stringify(chunk), 'utf-8');
}
console.log('Chunks: ' + total);
