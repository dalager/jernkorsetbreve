#!/usr/bin/env python3
"""
adr016_b1_dacy_ner.py — Run DaCy NER on normalized letter texts.

Part of ADR-016 (Social Network Extraction).

Reads  data/normalized-letters.json   (id, text_normalized)
Reads  data/letters.csv               (id, date, sender, recipient)
Writes data/letter-entities.json       (NER results with character offsets)

Usage:
    python scripts/adr016_b1_dacy_ner.py [--model MODEL] [--sample N] [--batch-size N]

Examples:
    python scripts/adr016_b1_dacy_ner.py --sample 10      # quick test on 10 letters
    python scripts/adr016_b1_dacy_ner.py                   # full corpus (665 letters)
"""

import argparse
import csv
import io
import json
import sys
import time
import warnings
from pathlib import Path

warnings.filterwarnings("ignore", category=UserWarning)

# Ensure UTF-8 output on Windows
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "data"
NORMALIZED_LETTERS = DATA_DIR / "normalized-letters.json"
LETTERS_CSV = DATA_DIR / "letters.csv"
OUTPUT = DATA_DIR / "letter-entities.json"

# DaCy model preference order (large is best for NER accuracy)
MODEL_PREFERENCE = [
    "da_dacy_large_trf-0.2.0",
    "da_dacy_medium_trf-0.2.0",
    "da_dacy_small_trf-0.2.0",
]

# Entity types we care about for social network extraction
ENTITY_TYPES = {"PER", "LOC", "ORG"}


def load_dacy_model(model_name: str | None = None):
    """Load DaCy model, trying fallbacks if the requested model is unavailable."""
    import dacy  # noqa: delayed import so we get a clear error if missing

    if model_name:
        print(f"Loading DaCy model '{model_name}'...")
        nlp = dacy.load(model_name)
        print(f"Model loaded: {nlp.pipe_names}")
        return nlp

    # Try models in preference order
    for name in MODEL_PREFERENCE:
        try:
            print(f"Trying DaCy model '{name}'...")
            nlp = dacy.load(name)
            print(f"Model loaded: {nlp.pipe_names}")
            return nlp
        except Exception as e:
            print(f"  Could not load '{name}': {e}")

    raise RuntimeError(
        "No DaCy model available. Install with:\n"
        "  pip install dacy\n"
        "  python -c \"import dacy; dacy.load('da_dacy_large_trf-0.2.0')\"\n"
    )


def load_letter_dates() -> dict[int, dict]:
    """Load date, sender, recipient from letters.csv keyed by letter id."""
    metadata: dict[int, dict] = {}
    with open(LETTERS_CSV, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            lid = int(row["id"])
            metadata[lid] = {
                "date": row.get("date", ""),
                "sender": row.get("sender", ""),
                "recipient": row.get("recipient", ""),
            }
    return metadata


def load_normalized_letters() -> list[dict]:
    """Load normalized letters JSON."""
    with open(NORMALIZED_LETTERS, encoding="utf-8") as f:
        return json.load(f)


def extract_entities(nlp, letters: list[dict], metadata: dict[int, dict],
                     batch_size: int = 8) -> list[dict]:
    """Run NER on all letters and extract PER/LOC/ORG entities with offsets."""
    texts = [letter["text_normalized"] for letter in letters]
    ids = [letter["id"] for letter in letters]
    total = len(texts)

    results = []
    t0 = time.time()

    # Process in batches using nlp.pipe for efficiency
    for batch_start in range(0, total, batch_size):
        batch_end = min(batch_start + batch_size, total)
        batch_texts = texts[batch_start:batch_end]
        batch_ids = ids[batch_start:batch_end]

        docs = list(nlp.pipe(batch_texts, batch_size=batch_size))

        for doc, lid in zip(docs, batch_ids):
            entities = []
            for ent in doc.ents:
                if ent.label_ in ENTITY_TYPES:
                    entities.append({
                        "text": ent.text,
                        "type": ent.label_,
                        "start": ent.start_char,
                        "end": ent.end_char,
                    })

            meta = metadata.get(lid, {})
            results.append({
                "letter_id": lid,
                "date": meta.get("date", ""),
                "sender": meta.get("sender", ""),
                "recipient": meta.get("recipient", ""),
                "entities": entities,
            })

        elapsed = time.time() - t0
        done = batch_end
        rate = done / elapsed if elapsed > 0 else 0
        remaining = (total - done) / rate if rate > 0 else 0
        print(
            f"  [{done:>4d}/{total}] "
            f"{elapsed:.0f}s elapsed, "
            f"~{remaining:.0f}s remaining, "
            f"{rate:.1f} letters/s"
        )

    return results


def summarize(results: list[dict]) -> None:
    """Print a summary of the NER extraction."""
    total_ents = sum(len(r["entities"]) for r in results)
    per_count = sum(1 for r in results for e in r["entities"] if e["type"] == "PER")
    loc_count = sum(1 for r in results for e in r["entities"] if e["type"] == "LOC")
    org_count = sum(1 for r in results for e in r["entities"] if e["type"] == "ORG")
    letters_with_ents = sum(1 for r in results if r["entities"])

    print(f"\nNER Extraction Summary")
    print(f"  Letters processed: {len(results)}")
    print(f"  Letters with entities: {letters_with_ents}")
    print(f"  Total entities: {total_ents}")
    print(f"    PER: {per_count}")
    print(f"    LOC: {loc_count}")
    print(f"    ORG: {org_count}")

    # Show unique PER entities (top 20)
    from collections import Counter
    per_names = Counter(
        e["text"] for r in results for e in r["entities"] if e["type"] == "PER"
    )
    print(f"\n  Top 20 PER entities:")
    for name, count in per_names.most_common(20):
        print(f"    {name:30s} ({count}x)")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run DaCy NER on normalized letter texts (ADR-016)."
    )
    parser.add_argument(
        "--model", default=None,
        help="DaCy model name (default: auto-detect best available)",
    )
    parser.add_argument(
        "--sample", type=int, default=0,
        help="Process only N letters for testing (0 = all)",
    )
    parser.add_argument(
        "--batch-size", type=int, default=8,
        help="Batch size for nlp.pipe (default: 8)",
    )
    parser.add_argument(
        "--output", type=str, default=None,
        help="Output file path (default: data/letter-entities.json)",
    )
    args = parser.parse_args()

    output_path = Path(args.output) if args.output else OUTPUT

    # Load data
    print(f"Loading normalized letters from {NORMALIZED_LETTERS}...")
    letters = load_normalized_letters()
    print(f"  Loaded {len(letters)} letters")

    print(f"Loading letter metadata from {LETTERS_CSV}...")
    metadata = load_letter_dates()
    print(f"  Loaded metadata for {len(metadata)} letters")

    # Apply sample limit
    if args.sample > 0:
        letters = letters[:args.sample]
        print(f"  Sampling first {args.sample} letters")

    # Load DaCy
    nlp = load_dacy_model(args.model)

    # Run NER
    print(f"\nRunning NER on {len(letters)} letters...")
    t0 = time.time()
    results = extract_entities(nlp, letters, metadata, args.batch_size)
    elapsed = time.time() - t0
    print(f"NER complete in {elapsed:.1f}s")

    # Summary
    summarize(results)

    # Write output
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nOutput written to {output_path}")


if __name__ == "__main__":
    main()
