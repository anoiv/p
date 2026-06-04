"""High-quality translation with GPT-4o for image prompts."""
import json, sys, time, os
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen

API_KEY = "sk-9mjYZICqcW3WNgGJGb7rXDuu9gy8l3JlcKcYU5wLEitLnpgq"
API_BASE = "https://api.cphone.vip/v1"
MODEL = "gpt-4o-mini"
WORKERS = 4
BATCH = 2

PROMPTS_PATH = r"C:\Users\Anooo\website-p\prompts.json"
CHUNK_DIR = r"C:\Users\Anooo\website-p"

SYSTEM_PROMPT = """你是专业AI图像生成提示词的中文翻译专家。你的翻译风格自然流畅，读起来就像是中文母语者原创撰写的提示词。

翻译规则：
1. 完整翻译每个场景描述、人物细节、光影、构图、色彩、情绪氛围等内容
2. 保留所有技术参数不变：--ar 16:9、--v 6.1、--style raw、8K、4K、HDR等
3. 保留品牌名和相机型号：iPhone 17 Pro、Sony A7S3、Midjourney、DALL-E等
4. 保留模板参数：{argument name="xxx" default="yyy"} 原样保留
5. 保留时间码：[00:00-00:05]、[0-4秒] 等原样保留
6. 保留英文专有名词：ASMR、TikTok、YouTube、KOL等
7. 不要添油加醋，不要改变原意，不要删减内容
8. 用"---SPLIT---"分隔每条翻译结果
9. 只输出翻译，不要任何解释或说明"""

def translate_batch(texts):
    combined = "\n---SPLIT---\n".join(texts)
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": combined},
        ],
        "max_tokens": 4000,
        "temperature": 0.3,
    }
    try:
        req = Request(
            f"{API_BASE}/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
        )
        resp = urlopen(req, timeout=90)
        data = json.loads(resp.read().decode("utf-8"))
        result = data["choices"][0]["message"]["content"].strip()
        parts = [t.strip() for t in result.split("---SPLIT---")]
        while len(parts) < len(texts):
            parts.append(texts[len(parts)])
        return parts[:len(texts)]
    except Exception as e:
        print(f"  E:{e}", flush=True)
        return texts

def log(msg):
    print(msg, flush=True)

def save(prompts):
    with open(PROMPTS_PATH, "w", encoding="utf-8") as f:
        json.dump(prompts, f, ensure_ascii=False)
    CHUNK = 1000
    tc = (len(prompts) + CHUNK - 1) // CHUNK
    for i in range(tc):
        chunk = prompts[i*CHUNK:(i+1)*CHUNK]
        with open(os.path.join(CHUNK_DIR, f"prompts-chunk-{i}.json"), "w", encoding="utf-8") as f:
            json.dump(chunk, f, ensure_ascii=False)

def main():
    log("Loading...")
    with open(PROMPTS_PATH, "r", encoding="utf-8") as f:
        prompts = json.load(f)

    # Only translate free-text English prompts (skip JSON format)
    to_translate = [
        (i, p) for i, p in enumerate(prompts)
        if p.get("source") != "aishort.top"
        and p.get("type") in ("image", "video")
        and p.get("prompt")
        and not p["prompt"].startswith("{")
        and not any('一' <= c <= '鿿' for c in p["prompt"])
    ]
    total = len(to_translate)
    batches = [(to_translate[j:j+BATCH], j//BATCH) for j in range(0, total, BATCH)]
    log(f"Translate: {total} free-text prompts | {len(batches)} batches | {WORKERS} workers | {MODEL}")

    done = 0
    start = time.time()
    last_save = 0

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {}
        for batch_items, bid in batches:
            texts = [p["prompt"] for _, p in batch_items]
            f = pool.submit(translate_batch, texts)
            futures[f] = (batch_items, bid)

        for f in as_completed(futures):
            batch_items, bid = futures[f]
            try:
                results = f.result()
                for (i, p), zh in zip(batch_items, results):
                    if zh and len(zh) > 20:
                        prompts[i]["prompt"] = zh
                done += len(batch_items)
                elapsed = max(time.time() - start, 0.1)
                rate = done / elapsed * 60
                eta = elapsed / done * (total - done) / 60 if done < total else 0
                log(f"[{done}/{total}] {done*100//total}% {rate:.0f}/min ETA {eta:.1f}min")

                # Save every 200 prompts
                if done - last_save >= 200:
                    save(prompts)
                    last_save = done
                    log("  (saved)")
            except Exception as e:
                log(f"  ERR: {e}")

    log("Final save...")
    save(prompts)
    log(f"Done! {total} translated with {MODEL}.")

if __name__ == "__main__":
    main()
