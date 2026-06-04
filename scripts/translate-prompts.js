/**
 * Translate AiShort English prompts to Chinese.
 * Uses the user's cphone.vip GPT-4o-mini API.
 */
const fs = require('fs');
const https = require('https');

const PROMPTS_PATH = 'C:/Users/Anooo/website-p/prompts.json';
const API_URL = process.argv[2] || '';

if (!API_URL) {
  console.log('Usage: node translate-prompts.js <API_ENDPOINT>');
  console.log('Example: node translate-prompts.js https://api.cphone.vip/...');
  process.exit(1);
}

// Load prompts
const prompts = JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf-8'));
const toTranslate = prompts.filter(p =>
  p.source === 'aishort.top' &&
  p.prompt &&
  /^[A-Za-z]/.test(p.prompt.trim())
);

console.log(`Found ${toTranslate.length} prompts to translate`);

async function translate(text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '你是一个专业翻译。把下面的AI提示词模板翻译成中文。保留占位符格式如[xxx]和{xxx}。只返回翻译结果，不要解释。' },
        { role: 'user', content: text }
      ],
      max_tokens: 2000,
      temperature: 0.3
    });

    const req = https.request(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.choices?.[0]?.message?.content || text);
        } catch(e) {
          console.error('Parse error:', data.substring(0, 200));
          resolve(text);
        }
      });
    });
    req.on('error', e => { console.error('Request error:', e.message); resolve(text); });
    req.write(body);
    req.end();
  });
}

async function main() {
  let translated = 0;
  for (let i = 0; i < toTranslate.length; i++) {
    const p = toTranslate[i];
    const promptText = p.prompt;
    if (!promptText || promptText.length < 30) continue;

    try {
      const zh = await translate(promptText);
      p.prompt = zh;
      // Also translate remark if English
      if (p.remark && /^[A-Za-z]/.test(p.remark.trim())) {
        p.remark = await translate(p.remark);
      }
      translated++;
      console.log(`[${i+1}/${toTranslate.length}] ${p.title}`);
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    } catch(e) {
      console.error(`Failed: ${p.title} - ${e.message}`);
    }
  }

  // Save
  fs.writeFileSync(PROMPTS_PATH, JSON.stringify(prompts), 'utf-8');

  // Re-chunk
  const CHUNK = 1000;
  const total = Math.ceil(prompts.length / CHUNK);
  for (let i = 0; i < total; i++) {
    const chunk = prompts.slice(i * CHUNK, (i + 1) * CHUNK);
    fs.writeFileSync(`C:/Users/Anooo/website-p/prompts-chunk-${i}.json`, JSON.stringify(chunk), 'utf-8');
  }

  console.log(`\nDone! Translated ${translated} prompts.`);
}

main().catch(console.error);
