"""DeepSeek batch translation - handles both free-text and JSON prompts."""
import json, sys, os, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen

API_KEY = "sk-f364b019ede54d60be539ac006c9b4a4"
API_BASE = "https://api.deepseek.com/v1/chat/completions"
MODEL = "deepseek-chat"
WORKERS = 8
BATCH = 3

PROMPTS_PATH = r"C:\Users\Anooo\website-p\prompts.json"
CHUNK_DIR = r"C:\Users\Anooo\website-p"

FREE_PROMPT = """Translate the following AI image generation prompt to Chinese. Keep all technical parameters (--ar, --v, 8K, 4K, etc), brand names, camera models, and template parameters {argument name="xxx" default="yyy"} unchanged. Output only the Chinese translation, no explanations. Separate with ---SPLIT---."""

JSON_PROMPT = """Rewrite the following structured text into a natural, fluent Chinese paragraph for AI image generation. Extract all scene, subject, lighting, camera, composition details and write them as flowing Chinese prose. Keep technical parameters (--ar, --v, 8K, 4K), camera models, brand names, and {argument name="xxx" default="yyy"} templates unchanged. Remove all JSON formatting, brackets, and English field labels. Output only the Chinese paragraph, no explanations. Separate with ---SPLIT---."""

def call_api(system_prompt, texts):
    combined = "\n---SPLIT---\n".join(texts)
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": combined},
        ],
        "max_tokens": 4000,
        "temperature": 0.3,
    }
    try:
        req = Request(
            API_BASE,
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

def process(prompts, to_process, prompt_type):
    system = FREE_PROMPT if prompt_type == "free" else JSON_PROMPT
    total = len(to_process)
    batches = [(to_process[j:j+BATCH], j//BATCH) for j in range(0, total, BATCH)]
    log(f"Type: {prompt_type} | {total} prompts | {len(batches)} batches")

    done = ok = 0
    start = time.time()
    last_save = 0

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {}
        for batch_items, bid in batches:
            texts = [p["prompt"] for _, p in batch_items]
            f = pool.submit(call_api, system, texts)
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
                if done - last_save >= 300:
                    save(prompts)
                    last_save = done
            except Exception as e:
                log(f"  ERR: {e}")

    log(f"Done {prompt_type}: {ok}/{total} translated\n")
    return ok

def main():
    log("=== DeepSeek Translation ===\n")
    with open(PROMPTS_PATH, "r", encoding="utf-8") as f:
        prompts = json.load(f)

    # Free-text English prompts
    free_en = [
        (i, p) for i, p in enumerate(prompts)
        if p.get("source") != "aishort.top"
        and p.get("type") in ("image", "video")
        and p.get("prompt")
        and not p["prompt"].startswith("{")
        and not any('一' <= c <= '鿿' for c in p["prompt"])
    ]
    log(f"Free-text EN: {len(free_en)}")

    # JSON prompts
    json_en = [
        (i, p) for i, p in enumerate(prompts)
        if p.get("source") != "aishort.top"
        and p.get("type") in ("image", "video")
        and p.get("prompt")
        and p["prompt"].startswith("{")
    ]
    log(f"JSON format: {len(json_en)}")

    t1 = process(prompts, free_en, "free") if free_en else 0
    save(prompts)
    t2 = process(prompts, json_en, "json") if json_en else 0
    save(prompts)

    # Final stats
    with open(PROMPTS_PATH, "r", encoding="utf-8") as f:
        prompts = json.load(f)
    img = [p for p in prompts if p.get("source") != "aishort.top" and p.get("type") in ("image", "video")]
    cn = sum(1 for p in img if any('一' <= c <= '鿿' for c in p.get("prompt", "")))
    log(f"=== Final: {cn}/{len(img)} Chinese ===")

if __name__ == "__main__":
    main()
