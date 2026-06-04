const fs = require('fs');

const CAT_MAP = {
  'social-media-post': '社交媒体帖子',
  'product-marketing': '产品营销',
  'profile-avatar': '头像/个人资料',
  'others': '其他',
  'poster-flyer': '海报/传单',
  'ecommerce-main-image': '电商主图',
  'game-asset': '游戏素材',
  'infographic-edu-visual': '信息图/教育视觉',
  'comic-storyboard': '漫画/故事板',
  'youtube-thumbnail': 'YouTube缩略图',
  'app-web-design': '应用/网页设计',
};

// Also fix English tags (not just categories)
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

let catFixed = 0, tagFixed = 0;
for (const p of prompts) {
  if (CAT_MAP[p.category]) {
    p.category = CAT_MAP[p.category];
    catFixed++;
  }
  if (p.tags) {
    const oldLen = p.tags.length;
    p.tags = p.tags.map(t => TAG_MAP[t] || t).filter((t, i, arr) => arr.indexOf(t) === i);
    if (p.tags.some((t, i) => t !== p.tags[i])) tagFixed++;
  }
}

fs.writeFileSync('C:/Users/Anooo/website-p/prompts.json', JSON.stringify(prompts), 'utf-8');

const CHUNK = 1000;
const total = Math.ceil(prompts.length / CHUNK);
for (let i = 0; i < total; i++) {
  const chunk = prompts.slice(i * CHUNK, (i + 1) * CHUNK);
  fs.writeFileSync(`C:/Users/Anooo/website-p/prompts-chunk-${i}.json`, JSON.stringify(chunk), 'utf-8');
}

console.log(`Categories fixed: ${catFixed}, Tags fixed: ${tagFixed}, Chunks: ${total}`);
