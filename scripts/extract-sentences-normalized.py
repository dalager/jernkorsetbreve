#!/usr/bin/env python3
"""
Extract sentences from normalized Danish letter text.

Input:  data/normalized-letters.json
Output: data/normalized-sentences.json

Uses rule-based sentence splitting (no ML dependencies).
"""

import argparse
import json
import re
import sys
from pathlib import Path

# Resolve paths relative to this script's location
SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "data"
INPUT_PATH = DATA_DIR / "normalized-letters.json"
OUTPUT_PATH = DATA_DIR / "normalized-sentences.json"

# Abbreviations that should NOT trigger sentence breaks.
ABBREVIATIONS = {
    "Kl", "kl",
    "St", "Hr", "Fr", "Dr", "Nr", "Pr",
    "J", "Chr", "H", "C", "P", "M", "N", "A", "L", "T", "S", "E", "K",
    "Kilom", "kilom",
    "Feldw", "feldw",
    "Regt", "regt",
    "ca", "evt", "bl", "div", "osv", "dvs",
    "d", "f", "m",
}

# Regex to find candidate sentence boundaries:
# A period, exclamation, or question mark followed by whitespace and uppercase letter.
_BOUNDARY_RE = re.compile(
    r"([.!?])\s+(?=[A-ZÆØÅ])"
)


def _word_before_dot(text: str, dot_pos: int) -> str:
    """Extract the word immediately before the dot at dot_pos."""
    i = dot_pos - 1
    while i >= 0 and text[i].isalpha():
        i -= 1
    return text[i + 1:dot_pos]


def _is_abbreviation_boundary(text: str, match: re.Match) -> bool:
    """Check if the punctuation at this match position is an abbreviation."""
    punct = match.group(1)
    if punct != ".":
        # ! and ? are always sentence-ending
        return False
    dot_pos = match.start(1)
    word = _word_before_dot(text, dot_pos)
    if word in ABBREVIATIONS:
        return True
    # Protect numbers followed by dot (ordinals, dates): "1.", "15."
    if dot_pos > 0 and text[dot_pos - 1].isdigit():
        return True
    return False


def split_sentences(text: str) -> list[str]:
    """Split text into sentences using rule-based approach."""
    # Step 1: split into paragraphs on double-newline
    paragraphs = re.split(r"\n\n+", text)

    all_sentences = []
    for para in paragraphs:
        # Normalize internal whitespace (newlines within a paragraph become spaces)
        para = re.sub(r"\s+", " ", para).strip()
        if not para:
            continue

        # Step 2: split paragraph into sentences
        # Use the regex to find split points
        sentences = _split_paragraph(para)
        all_sentences.extend(sentences)

    # Step 3: strip whitespace, filter short/empty
    result = []
    for s in all_sentences:
        s = s.strip()
        if len(s) >= 3:
            result.append(s)

    return result


def _split_paragraph(text: str) -> list[str]:
    """Split a single paragraph into sentences."""
    sentences = []
    last_end = 0

    for match in _BOUNDARY_RE.finditer(text):
        if _is_abbreviation_boundary(text, match):
            continue
        # Split point is right after the punctuation mark
        split_pos = match.start(1) + 1
        segment = text[last_end:split_pos].strip()
        if segment:
            sentences.append(segment)
        last_end = split_pos

    # Remaining text after the last split
    tail = text[last_end:].strip()
    if tail:
        sentences.append(tail)

    return sentences


# --- Formulaic detection ---

_OPENING_PATTERNS = [
    re.compile(r"^(Min (egen )?)?[Kk]ære\b", re.IGNORECASE),
    re.compile(r"^Min lille\b", re.IGNORECASE),
    re.compile(r"^M\.M[.!]?$"),
    re.compile(r"^Lieber \w+", re.IGNORECASE),
]

_CLOSING_PATTERNS = [
    re.compile(r"^(Mange )?(kærlige )?(Hilsener|hilsener|Hilsen|hilsen)\b", re.IGNORECASE),
    re.compile(r"^Med (mange )?(kærlige )?(Hilsener|hilsener|Hilsen|hilsen)\b", re.IGNORECASE),
    re.compile(r"^[Dd]in (egen )?\w+$"),
    re.compile(r"^[Jj]eres \w+$"),
    re.compile(r"^[Ee]ders \w+$"),
    re.compile(r"^Peter$"),
    re.compile(r"^Trine$"),
]


def is_formulaic(sentence: str) -> bool:
    """Check if a sentence is a formulaic greeting or closing."""
    for pat in _OPENING_PATTERNS:
        if pat.search(sentence):
            return True
    for pat in _CLOSING_PATTERNS:
        if pat.search(sentence):
            return True
    return False


def main():
    parser = argparse.ArgumentParser(
        description="Extract sentences from normalized Danish letters."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print statistics but do not write output file.",
    )
    args = parser.parse_args()

    # Load input
    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        letters = json.load(f)

    assert len(letters) > 600, (
        f"Expected more than 600 letters, got {len(letters)}"
    )

    # Extract sentences
    output = []
    for letter in letters:
        letter_id = letter["id"]
        text = letter.get("text_normalized", "")
        if not text:
            continue

        sentences = split_sentences(text)
        for idx, sent in enumerate(sentences):
            output.append({
                "letter_id": letter_id,
                "index": idx,
                "text": sent,
                "is_formulaic": is_formulaic(sent),
            })

    # Compute statistics
    total_letters = len(letters)
    total_sentences = len(output)
    formulaic_count = sum(1 for s in output if s["is_formulaic"])
    letters_with_sentences = len(set(s["letter_id"] for s in output))
    avg_per_letter = (
        total_sentences / letters_with_sentences if letters_with_sentences else 0
    )

    print(f"Total letters:          {total_letters}")
    print(f"Letters with sentences: {letters_with_sentences}")
    print(f"Total sentences:        {total_sentences}")
    print(f"Formulaic sentences:    {formulaic_count}")
    print(f"Avg sentences/letter:   {avg_per_letter:.1f}")

    if args.dry_run:
        print("\n[dry-run] Output not written.")
        return

    # Write output
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nOutput written to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
