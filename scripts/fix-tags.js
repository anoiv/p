const fs = require('fs');

const TAG_MAP = {
  write: '写作辅助', article: '文章/报告', code: 'IT/编程', ai: 'AI工具',
  living: '生活质量', interesting: '趣味科普', life: '生活百科', social: '心理/社交',
  philosophy: '哲学/宗教', mind: '思维训练', pedagogy: '教育/学生', academic: '学术/教师',
  games: '趣味游戏', tool: '效率工具', interpreter: '终端/解释器', language: '语言/翻译',
  speech: '辩论/演讲', comments: '点评/评鉴', text: '文本/词语', company: '企业职能',
  seo: 'SEO优化', doctor: '医疗健康', finance: '金融顾问', music: '音乐艺术',
  professional: '专业顾问', contribute: '用户分享',
};

const prompts = JSON.parse(fs.readFileSync('C:/Users/Anooo/website-p/prompts.json', 'utf-8'));
let fixed = 0;

for (const p of prompts) {
  if (p.source !== 'aishort.top') continue;
  if (!p.tags) continue;
  p.tags = p.tags.map(t => TAG_MAP[t] || t).filter((t, i, arr) => arr.indexOf(t) === i);
  fixed++;
}

fs.writeFileSync('C:/Users/Anooo/website-p/prompts.json', JSON.stringify(prompts), 'utf-8');

// Rewrite chunks
const CHUNK = 1000;
const total = Math.ceil(prompts.length / CHUNK);
for (let i = 0; i < total; i++) {
  const chunk = prompts.slice(i * CHUNK, (i + 1) * CHUNK);
  fs.writeFileSync(`C:/Users/Anooo/website-p/prompts-chunk-${i}.json`, JSON.stringify(chunk), 'utf-8');
}
// Clean stale chunks
for (const f of fs.readdirSync('C:/Users/Anooo/website-p')) {
  const m = f.match(/^prompts-chunk-(\d+)\.json$/);
  if (m && parseInt(m[1]) >= total) fs.unlinkSync(`C:/Users/Anooo/website-p/${f}`);
}

console.log(`Fixed ${fixed} prompts, ${total} chunks`);
