"""Simple direct translation, minimal system prompt to avoid content filters."""
import json, sys, os, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen

API_KEY = "sk-9mjYZICqcW3WNgGJGb7rXDuu9gy8l3JlcKcYU5wLEitLnpgq"
API_BASE = "https://api.cphone.vip/v1"
MODEL = "gpt-4o-mini"
WORKERS = 3
BATCH = 2

PROMPTS_PATH = r"C:\Users\Anooo\website-p\prompts.json"
CHUNK_DIR = r"C:\Users\Anooo\website-p"

def translate(texts):
    combined = "\n---SPLIT---\n".join(texts)
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "user", "content": f"Translate to Chinese. Separate with ---SPLIT---:\n\n{combined}"},
        ],
        "max_tokens": 4000,
        "temperature": 0.2,
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
        and not p["prompt"].startswith("{")
        and not any('一' <= c <= '鿿' for c in p["prompt"])
    ]
    total = len(to_translate)
    batches = [(to_translate[j:j+BATCH], j//BATCH) for j in range(0, total, BATCH)]
    log(f"To translate: {total} | {len(batches)} batches | {WORKERS} workers")

    done = ok = start = last_save = 0
    start = time.time()

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {}
        for batch_items, bid in batches:
            texts = [p["prompt"] for _, p in batch_items]
            f = pool.submit(translate, texts)
            futures[f] = (batch_items, bid)

        for f in as_completed(futures):
            batch_items, bid = futures[f]
            try:
                results = f.result()
                for (i, p), zh in zip(batch_items, results):
                    if zh and len(zh) > 20 and any('一' <= c <= '鿿' for c in zh):
                        prompts[i]["prompt"] = zh
                        ok += 1
                done += len(batch_items)
                elapsed = max(time.time() - start, 0.1)
                rate = done / elapsed * 60
                eta = elapsed / done * (total - done) / 60 if done < total else 0
                log(f"[{done}/{total}] {done*100//total}% ok:{ok} {rate:.0f}/min ETA {eta:.1f}min")
                if done - last_save >= 200:
                    save(prompts)
                    last_save = done
            except Exception as e:
                log(f"  ERR: {e}")

    log(f"Final: {ok}/{total} translated")
    save(prompts)
    log("Done!")

if __name__ == "__main__":
    main()
