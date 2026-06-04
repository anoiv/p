"""Concurrent batch translation - 8 workers, 6 prompts per batch."""
import json, sys, time, os
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen

API_KEY = "sk-9mjYZICqcW3WNgGJGb7rXDuu9gy8l3JlcKcYU5wLEitLnpgq"
API_BASE = "https://api.cphone.vip/v1"
MODEL = "gpt-4o-mini"
WORKERS = 8
BATCH = 6

PROMPTS_PATH = r"C:\Users\Anooo\website-p\prompts.json"
CHUNK_DIR = r"C:\Users\Anooo\website-p"

def translate_batch(texts):
    combined = "\n---SPLIT---\n".join(texts)
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": "Translate to Chinese. Keep all params like --ar, --v unchanged. Separate with ---SPLIT---. No explanations."},
            {"role": "user", "content": combined},
        ],
        "max_tokens": 4000,
        "temperature": 0.1,
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

    to_translate = [
        (i, p) for i, p in enumerate(prompts)
        if p.get("source") != "aishort.top"
        and p.get("type") in ("image", "video")
        and p.get("prompt")
        and not any('一' <= c <= '鿿' for c in p["prompt"])
    ]
    total = len(to_translate)
    batches = [(to_translate[j:j+BATCH], j//BATCH) for j in range(0, total, BATCH)]
    log(f"Need: {total} prompts, {len(batches)} batches, {WORKERS} workers")

    done = 0
    start = time.time()

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
                    if zh and len(zh) > 10:
                        prompts[i]["prompt"] = zh
                done += len(batch_items)
                elapsed = max(time.time() - start, 0.1)
                rate = done / elapsed * 60
                eta = elapsed / done * (total - done) / 60 if done < total else 0
                log(f"[{done}/{total}] {done*100//total}% {rate:.0f}/min ETA {eta:.1f}min")
            except Exception as e:
                log(f"  ERR batch {bid}: {e}")

    log("Saving...")
    save(prompts)
    log(f"Done! {total} translated.")

if __name__ == "__main__":
    main()
