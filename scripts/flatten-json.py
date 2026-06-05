"""Convert JSON/image prompts to natural Chinese prose."""
import json, sys, os, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen

API_KEY = "sk-9mjYZICqcW3WNgGJGb7rXDuu9gy8l3JlcKcYU5wLEitLnpgq"
API_BASE = "https://api.cphone.vip/v1"
MODEL = "gpt-4o-mini"
WORKERS = 2
BATCH = 2

PROMPTS_PATH = r"C:\Users\Anooo\website-p\prompts.json"
CHUNK_DIR = r"C:\Users\Anooo\website-p"

SYSTEM_PROMPT = """把以下英文图像提示词改写为流畅的中文段落描述。

改写规则：
1. 提取所有场景、人物、光影、构图、色彩、情绪等细节
2. 写成一个自然流畅的中文段落
3. 保留技术参数不变：--ar 16:9、8K、4K、iPhone等
4. 保留模板参数：{argument name="xxx" default="yyy"}
5. 保留时间码标记：[00:00-00:05] 等
6. 不要输出任何格式标记、代码块或引号
7. 用"---SPLIT---"分隔每条结果
8. 只输出改写后的中文"""

def process_batch(texts):
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
        resp = urlopen(req, timeout=60)
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

    to_process = [
        (i, p) for i, p in enumerate(prompts)
        if p.get("source") != "aishort.top"
        and p.get("type") in ("image", "video")
        and p.get("prompt")
        and p["prompt"].strip().startswith("{")
    ]
    total = len(to_process)
    batches = [(to_process[j:j+BATCH], j//BATCH) for j in range(0, total, BATCH)]
    log(f"JSON to flatten: {total} | {len(batches)} batches | {WORKERS} workers")

    done = 0
    start = time.time()
    last_save = 0

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {}
        for batch_items, bid in batches:
            texts = [p["prompt"] for _, p in batch_items]
            f = pool.submit(process_batch, texts)
            futures[f] = (batch_items, bid)

        for f in as_completed(futures):
            batch_items, bid = futures[f]
            try:
                results = f.result()
                for (i, p), zh in zip(batch_items, results):
                    if zh and len(zh) > 20 and not zh.strip().startswith("{"):
                        prompts[i]["prompt"] = zh
                done += len(batch_items)
                elapsed = max(time.time() - start, 0.1)
                rate = done / elapsed * 60
                eta = elapsed / done * (total - done) / 60 if done < total else 0
                log(f"[{done}/{total}] {done*100//total}% {rate:.0f}/min ETA {eta:.1f}min")
                if done - last_save >= 200:
                    save(prompts)
                    last_save = done
                    log("  saved")
            except Exception as e:
                log(f"  ERR: {e}")

    log("Final save...")
    save(prompts)
    log(f"Done! {total} flattened.")

if __name__ == "__main__":
    main()
