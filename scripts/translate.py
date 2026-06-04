"""Translate AiShort English prompts to Chinese via cphone.vip API."""
import json, time, sys, os
from urllib.request import Request, urlopen
from urllib.error import URLError

API_KEY = "sk-9mjYZICqcW3WNgGJGb7rXDuu9gy8l3JlcKcYU5wLEitLnpgq"
API_BASE = "https://api.cphone.vip/v1"
MODEL = "gpt-4o-mini"

PROMPTS_PATH = r"C:\Users\Anooo\website-p\prompts.json"
CHUNK_DIR = r"C:\Users\Anooo\website-p"

def translate(text: str) -> str:
    """Translate English prompt to Chinese."""
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": "你是专业翻译。把AI提示词翻译成中文。保留所有占位符如[xxx]、{xxx}、{{xxx}}不变。只输出翻译结果，不要解释。"},
            {"role": "user", "content": text},
        ],
        "max_tokens": 2000,
        "temperature": 0.2,
    }
    req = Request(
        f"{API_BASE}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
    )
    try:
        resp = urlopen(req, timeout=60)
        data = json.loads(resp.read().decode("utf-8"))
        return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"  API error: {e}")
        return text

def is_english(text: str) -> bool:
    """Check if text starts with English (primarily English content)."""
    if not text: return False
    t = text.strip()
    # Count Chinese chars vs English words
    chinese = sum(1 for c in t if '一' <= c <= '鿿')
    words = len(t.split())
    return chinese < words * 0.3  # Less than 30% Chinese content

def main():
    print("Loading prompts...")
    with open(PROMPTS_PATH, "r", encoding="utf-8") as f:
        prompts = json.load(f)

    to_translate = [
        (i, p) for i, p in enumerate(prompts)
        if p.get("source") == "aishort.top"
        and p.get("prompt")
        and is_english(p["prompt"])
    ]
    print(f"Found {len(to_translate)} prompts to translate\n")

    for idx, (i, p) in enumerate(to_translate):
        title = p["title"]
        print(f"[{idx+1}/{len(to_translate)}] {title}")

        # Translate prompt
        orig = p["prompt"]
        zh = translate(orig)
        if zh and zh != orig:
            p["prompt"] = zh
            print(f"  OK ({len(orig)} -> {len(zh)} chars)")

        # Translate remark if English
        if p.get("remark") and is_english(p["remark"]):
            p["remark"] = translate(p["remark"])

        time.sleep(0.3)  # Rate limit

    # Save
    print(f"\nSaving...")
    with open(PROMPTS_PATH, "w", encoding="utf-8") as f:
        json.dump(prompts, f, ensure_ascii=False)

    # Re-chunk
    CHUNK = 1000
    total = (len(prompts) + CHUNK - 1) // CHUNK
    for i in range(total):
        chunk = prompts[i*CHUNK : (i+1)*CHUNK]
        path = os.path.join(CHUNK_DIR, f"prompts-chunk-{i}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(chunk, f, ensure_ascii=False)
        print(f"  Chunk {i}: {len(chunk)} prompts")

    print(f"\nDone! Translated {len(to_translate)} prompts.")

if __name__ == "__main__":
    main()
