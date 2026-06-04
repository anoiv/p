/**
 * Merge AiShort prompts into 何老师提示词网站.
 * Uses index-based matching: card ID = position in prompt.json array + 1.
 */
const fs = require('fs');
const path = require('path');

const AISHORT_DIR = 'C:\\Users\\Anooo\\aishort-source\\src\\data';
const WEBSITE_DIR = 'C:\\Users\\Anooo\\website-p';

const TAG_TO_CATEGORY = {
  write: '写作辅助', article: '文章/报告', code: 'IT/编程', ai: 'AI工具',
  living: '生活质量', interesting: '趣味科普', life: '生活百科', social: '心理/社交',
  philosophy: '哲学/宗教', mind: '思维训练', pedagogy: '教育/学生', academic: '学术/教师',
  games: '趣味游戏', tool: '效率工具', interpreter: '终端/解释器', language: '语言/翻译',
  speech: '辩论/演讲', comments: '点评/评鉴', text: '文本/词语', company: '企业职能',
  seo: 'SEO优化', doctor: '医疗健康', finance: '金融顾问', music: '音乐艺术',
  professional: '专业顾问', contribute: '用户分享',
};

function main() {
  console.log('=== AiShort → 何老师提示词 合并工具 ===\n');

  // 1. Load AiShort prompts (278 entries)
  console.log('[1/5] 加载 AiShort prompt.json ...');
  const aishortArr = JSON.parse(fs.readFileSync(path.join(AISHORT_DIR, 'prompt.json'), 'utf-8'));
  console.log(`  → ${aishortArr.length} 条`);

  // 2. Load card tags by ID (index-based: card ID = array idx + 1)
  console.log('[2/5] 加载卡片标签 ...');
  const cardsDir = path.join(AISHORT_DIR, 'cards');
  const allCardFiles = fs.readdirSync(cardsDir);
  const zhCardFiles = allCardFiles.filter(f => f.endsWith('_zh-Hans.json'));

  const tagById = {};   // id → tags[]
  const faqById = {};   // id → faq[]
  const metaById = {};  // id → { metaTitle, metaDescription, website, related }
  for (const file of zhCardFiles) {
    const card = JSON.parse(fs.readFileSync(path.join(cardsDir, file), 'utf-8'));
    if (card.tags) tagById[card.id] = card.tags;
    if (card.faq && card.faq.length) faqById[card.id] = card.faq;
    metaById[card.id] = {
      metaTitle: card.metaTitle || '',
      metaDescription: card.metaDescription || '',
      website: card.website || '',
      related: card.related || [],
    };
  }
  console.log(`  → ${Object.keys(tagById).length} 卡片有标签`);
  console.log(`  → ${Object.keys(faqById).length} 卡片有FAQ`);

  // 3. Convert and merge
  console.log('[3/5] 转换并去重 ...');
  const existing = JSON.parse(fs.readFileSync(path.join(WEBSITE_DIR, 'prompts.json'), 'utf-8'));
  console.log(`  → 现有 ${existing.length} 条`);

  const existingTitles = new Set(existing.map(p => (p.title || '').trim().toLowerCase()));
  const seenTitles = new Set();
  const added = [];

  for (let i = 0; i < aishortArr.length; i++) {
    const item = aishortArr[i];
    const zh = item.zh;
    if (!zh || !zh.title || !zh.prompt) continue;
    if (zh.prompt.length < 30) continue;

    const title = zh.title.trim();
    const titleKey = title.toLowerCase();
    if (existingTitles.has(titleKey) || seenTitles.has(titleKey)) continue;
    seenTitles.add(titleKey);

    const cardId = i + 1;
    const tags = tagById[cardId] || [];
    const category = tags.length > 0 && TAG_TO_CATEGORY[tags[0]]
      ? TAG_TO_CATEGORY[tags[0]]
      : '精选';

    // Determine type and image
    const meta = metaById[cardId] || {};
    const promptType = (tags.includes('code') || tags.includes('interpreter')) ? 'code' : 'text';

    const entry = {
      title: title,
      prompt: zh.prompt,
      description: zh.description || '',
      remark: zh.remark || '',
      category: category,
      type: promptType,
      tags: ['AiShort', ...tags],
      source: 'aishort.top',
    };

    // Add optional metadata
    if (meta.metaTitle) entry.metaTitle = meta.metaTitle;
    if (meta.metaDescription) entry.metaDescription = meta.metaDescription;
    if (meta.website) entry.website = meta.website;
    if (meta.related && meta.related.length) entry.related = meta.related;

    // Attach FAQ if available
    if (faqById[cardId]) entry.faq = faqById[cardId];

    added.push(entry);
  }

  console.log(`  → ${added.length} 条新增（去重后）`);

  // 4. Merge and write
  console.log('[4/5] 写入合并文件 ...');
  const merged = [...existing, ...added];
  console.log(`  → 合并后总计 ${merged.length} 条`);

  // Backup
  const backupPath = path.join(WEBSITE_DIR, 'prompts.backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(existing), 'utf-8');
  console.log(`  → 已备份到 prompts.backup.json`);

  // Write merged
  fs.writeFileSync(path.join(WEBSITE_DIR, 'prompts.json'), JSON.stringify(merged), 'utf-8');

  // Chunk files (1000 per chunk)
  const CHUNK = 1000;
  const totalChunks = Math.ceil(merged.length / CHUNK);
  for (let i = 0; i < totalChunks; i++) {
    const chunk = merged.slice(i * CHUNK, (i + 1) * CHUNK);
    fs.writeFileSync(path.join(WEBSITE_DIR, `prompts-chunk-${i}.json`), JSON.stringify(chunk), 'utf-8');
  }
  // Remove stale chunks
  for (const f of fs.readdirSync(WEBSITE_DIR)) {
    const m = f.match(/^prompts-chunk-(\d+)\.json$/);
    if (m && parseInt(m[1]) >= totalChunks) {
      fs.unlinkSync(path.join(WEBSITE_DIR, f));
    }
  }
  console.log(`  → ${totalChunks} 个分块文件`);

  // 5. Stats
  console.log('\n[5/5] 统计报告');
  console.log(`原有: ${existing.length} | 新增: ${added.length} | 合计: ${merged.length}`);

  const dist = {};
  for (const item of added) {
    dist[item.category] = (dist[item.category] || 0) + 1;
  }
  console.log('\n新增分类分布:');
  for (const [cat, n] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${n}`);
  }

  // Also generate standalone AIShort FAQ reference
  const faqRef = { source: 'aishort.top', total: Object.keys(faqById).length, byPrompt: {} };
  for (const [id, faqs] of Object.entries(faqById)) {
    const idx = parseInt(id) - 1;
    const title = aishortArr[idx]?.zh?.title || `ID ${id}`;
    faqRef.byPrompt[title] = faqs;
  }
  fs.writeFileSync(path.join(WEBSITE_DIR, 'aishort-faqs.json'), JSON.stringify(faqRef, null, 2), 'utf-8');
  console.log(`\nFAQ 参考文件: aishort-faqs.json (${Object.keys(faqById).length} 条目)`);

  console.log('\n✅ 完成！');
}

main();
