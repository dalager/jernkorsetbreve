#!/usr/bin/env python3
"""
filter-tier-c-dacy.py — Use DaCy (Danish NLP) to filter Tier C hapax candidates.

Reads  data/quality-audit/error-inventory.json  (category=possible_typo)
Reads  data/letters.csv                          (for sentence context)
Writes data/quality-audit/tier-c-dacy-filtered.json   (full results)
Writes data/quality-audit/tier-c-review-shortlist.json (human review only)

Usage:
    python scripts/filter-tier-c-dacy.py [--model MODEL] [--batch-size N]
"""

import argparse
import csv
import io
import json
import re
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore", category=UserWarning)

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "data"
INVENTORY = DATA_DIR / "quality-audit" / "error-inventory.json"
LETTERS_CSV = DATA_DIR / "letters.csv"
OUTPUT_FULL = DATA_DIR / "quality-audit" / "tier-c-dacy-filtered.json"
OUTPUT_SHORT = DATA_DIR / "quality-audit" / "tier-c-review-shortlist.json"


# ---------------------------------------------------------------------------
# Context extraction
# ---------------------------------------------------------------------------

def extract_sentence(text: str, position: int, word: str, window: int = 150) -> str:
    """Extract the sentence surrounding `position` in `text`."""
    start = max(0, position - window)
    end = min(len(text), position + len(word) + window)
    chunk = text[start:end]

    # Find sentence boundaries within the chunk
    # Relative position of the target word in the chunk
    rel_pos = position - start

    # Look for sentence start (. ! ? or paragraph break before the word)
    sent_start = 0
    for m in re.finditer(r"[.!?]\s+", chunk[:rel_pos]):
        sent_start = m.end()

    # Look for sentence end (. ! ? after the word)
    sent_end = len(chunk)
    after_word = rel_pos + len(word)
    end_match = re.search(r"[.!?]\s", chunk[after_word:])
    if end_match:
        sent_end = after_word + end_match.start() + 1

    sentence = chunk[sent_start:sent_end].strip()
    # Clean up PARA markers and excessive whitespace
    sentence = sentence.replace("<PARA>", " ").strip()
    sentence = re.sub(r"\s+", " ", sentence)
    return sentence


# ---------------------------------------------------------------------------
# DaCy analysis
# ---------------------------------------------------------------------------

def analyze_candidates(nlp, items: list[dict], letters: dict[int, str],
                       batch_size: int = 16) -> list[dict]:
    """Run DaCy on each candidate's sentence and score it."""
    # Prepare sentences and track which item maps to which sentence
    sentences = []
    for item in items:
        lid = item["letter_id"]
        text = letters.get(lid, "")
        sent = extract_sentence(text, item["position"], item["original"])
        sentences.append(sent)

    print(f"Processing {len(sentences)} sentences through DaCy...")

    # Batch process with nlp.pipe
    docs = list(nlp.pipe(sentences, batch_size=batch_size))

    results = []
    for item, doc, sent in zip(items, docs, sentences):
        target = item["original"].lower()
        token_info = _find_token(doc, target)

        valid_score = 0
        suspicious_score = 0

        if token_info is None:
            # Word not found after tokenization — suspicious
            suspicious_score += 3
        else:
            pos = token_info["pos"]
            lemma = token_info["lemma"]
            ent = token_info["ent_type"]
            is_oov = token_info["is_oov"]

            # POS scoring
            if pos in ("NOUN", "VERB", "ADJ", "ADV", "PROPN", "NUM"):
                valid_score += 2
            elif pos in ("DET", "ADP", "CCONJ", "SCONJ", "PART", "AUX", "PRON"):
                valid_score += 1
            elif pos == "X":
                suspicious_score += 2

            # Lemma scoring — if model produces a different lemma, it knows the word
            if lemma and lemma != target:
                valid_score += 2

            # NER scoring
            if ent:
                valid_score += 2

            # OOV flag
            if is_oov:
                suspicious_score += 1

        # Capitalised words in original text are often proper nouns
        orig_text_at_pos = letters.get(item["letter_id"], "")
        if item["position"] < len(orig_text_at_pos):
            if orig_text_at_pos[item["position"]].isupper():
                valid_score += 1

        # Classify
        net = valid_score - suspicious_score
        if valid_score >= 3:
            classification = "likely_valid"
        elif net < 1:
            classification = "review_required"
        else:
            classification = "likely_valid"

        result = {
            "letter_id": item["letter_id"],
            "position": item["position"],
            "original": item["original"],
            "suggested_correction": item["suggested_correction"],
            "context": sent[:100],
            "dacy_pos": token_info["pos"] if token_info else None,
            "dacy_lemma": token_info["lemma"] if token_info else None,
            "dacy_ent": token_info["ent_type"] if token_info else None,
            "dacy_oov": token_info["is_oov"] if token_info else None,
            "valid_score": valid_score,
            "suspicious_score": suspicious_score,
            "classification": classification,
        }
        results.append(result)

    return results


def _find_token(doc, target_lower: str) -> dict | None:
    """Find the target word in a spaCy Doc, with fuzzy fallback."""
    # Exact match first
    for token in doc:
        if token.text.lower() == target_lower:
            return {
                "pos": token.pos_,
                "lemma": token.lemma_.lower(),
                "ent_type": token.ent_type_,
                "is_oov": token.is_oov,
            }

    # Fuzzy: target contained in token or vice versa
    for token in doc:
        t = token.text.lower()
        if target_lower in t or t in target_lower:
            if len(t) >= len(target_lower) - 2:
                return {
                    "pos": token.pos_,
                    "lemma": token.lemma_.lower(),
                    "ent_type": token.ent_type_,
                    "is_oov": token.is_oov,
                }

    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Filter Tier C hapax candidates using DaCy."
    )
    parser.add_argument(
        "--model", default="da_dacy_large_trf-0.2.0",
        help="DaCy model name (default: da_dacy_large_trf-0.2.0)",
    )
    parser.add_argument(
        "--batch-size", type=int, default=16,
        help="Batch size for nlp.pipe (default: 16)",
    )
    args = parser.parse_args()

    # Load inventory
    with open(INVENTORY, encoding="utf-8") as f:
        inventory = json.load(f)
    tier_c = [i for i in inventory if i["category"] == "possible_typo"]
    print(f"Loaded {len(tier_c)} Tier C candidates from {INVENTORY}")

    # Load letters
    letters: dict[int, str] = {}
    with open(LETTERS_CSV, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            text = row.get("text", "").replace("<PARA>", "\n\n")
            letters[int(row["id"])] = text
    print(f"Loaded {len(letters)} letters from {LETTERS_CSV}")

    # Load DaCy
    print(f"Loading DaCy model '{args.model}'...")
    import dacy
    nlp = dacy.load(args.model)
    print(f"Model loaded: {nlp.pipe_names}")

    # Analyze
    results = analyze_candidates(nlp, tier_c, letters, args.batch_size)

    # Split results
    review = [r for r in results if r["classification"] == "review_required"]
    valid = [r for r in results if r["classification"] == "likely_valid"]

    print(f"\nResults:")
    print(f"  Likely valid (filtered out): {len(valid)}")
    print(f"  Review required (shortlist): {len(review)}")

    # Write outputs
    with open(OUTPUT_FULL, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nFull results: {OUTPUT_FULL}")

    with open(OUTPUT_SHORT, "w", encoding="utf-8") as f:
        json.dump(review, f, ensure_ascii=False, indent=2)
    print(f"Review shortlist: {OUTPUT_SHORT}")

    # Print the shortlist
    if review:
        print(f"\n{'='*80}")
        print(f"REVIEW SHORTLIST ({len(review)} items)")
        print(f"{'='*80}")
        for r in sorted(review, key=lambda x: (x["letter_id"], x["position"])):
            pos_tag = r["dacy_pos"] or "NOT_FOUND"
            print(
                f"  L{r['letter_id']:>3d}: {r['original']:20s} "
                f"-> {r['suggested_correction']:15s} "
                f"POS={pos_tag:6s} "
                f"V={r['valid_score']} S={r['suspicious_score']}"
            )
            print(f"         {r['context'][:75]}")


if __name__ == "__main__":
    main()
