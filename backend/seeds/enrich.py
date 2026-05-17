"""LLM topic classification for scraped problems."""

import json
import os
import re
from pathlib import Path

import httpx

RAW = Path("seeds/data/raw_problems.json")
OUTPUT = Path("seeds/data/enriched_problems.json")
BATCH_SIZE = 25
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "anthropic/claude-haiku-4-5"
VOCABULARY = [
    "array", "string", "hash-map", "two-pointers", "sliding-window",
    "binary-search", "linked-list", "stack", "queue", "tree", "graph",
    "dynamic-programming", "greedy", "backtracking", "math",
    "bit-manipulation", "heap", "sorting",
]


def classify_batch(descriptions: list[str]) -> list[list[str]]:
    """Classify a batch of problem descriptions into topic tags."""
    vocab_str = ", ".join(VOCABULARY)
    numbered = "\n".join(f"{i + 1}. {d[:400]}" for i, d in enumerate(descriptions))
    prompt = (
        f"Classify each problem into 1-4 topics from this vocabulary: {vocab_str}\n\n"
        f"If there is only one problem, respond with a single JSON array like: [\"array\",\"hash-map\"]\n"
        f"If there are multiple problems, respond with a JSON array of arrays like: "
        f"[[\"array\"],[\"dynamic-programming\",\"tree\"]]\n"
        f"Respond with ONLY the JSON. No explanation.\n\n"
        f"Problems:\n{numbered}"
    )

    response = httpx.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}",
            "Content-Type": "application/json",
        },
        json={
            "model": MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 1024,
        },
        timeout=60.0,
    )
    response.raise_for_status()
    raw = response.json()["choices"][0]["message"]["content"].strip()

    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
    parsed = json.loads(raw)

    if descriptions and not isinstance(parsed[0], list):
        return [parsed]
    return parsed


def main() -> None:
    problems = json.loads(RAW.read_text())
    print(f"Classifying topics for {len(problems)} problems...")

    descriptions = [p.get("description") or p["title"] for p in problems]
    all_topics: list[list[str]] = []

    for i in range(0, len(descriptions), BATCH_SIZE):
        batch = descriptions[i : i + BATCH_SIZE]
        end = min(i + BATCH_SIZE, len(descriptions))
        print(f"  Batch {i + 1}-{end} ({len(batch)} problems)...", flush=True)
        try:
            topics = classify_batch(batch)
            all_topics.extend(topics)
        except Exception as e:
            print(f"  WARNING: batch failed, using empty tags: {e}")
            all_topics.extend([[] for _ in batch])

    for problem, topics in zip(problems, all_topics):
        problem["topic"] = topics

    OUTPUT.write_text(json.dumps(problems, indent=2))
    print(f"Wrote enriched data to {OUTPUT}")


if __name__ == "__main__":
    main()
