#!/usr/bin/env python3
"""
ADR-043: Epithet Scanner

Scans letter texts for epithet and pronoun-like person references that the
NER pipeline misses (e.g. "den gamle", "Bedstefar", "Onkel").

Reads:
  - data/corrected-letters.json (letter texts)

Outputs:
  - data/epithet-inventory.json (all matches grouped by pattern)
"""

import json
import re
import sys
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

# ---------------------------------------------------------------------------
# Epithet patterns: (label, regex_pattern, description)
# All patterns are compiled case-insensitive with word boundaries.
# ---------------------------------------------------------------------------
EPITHET_PATTERNS = [
    # "den gamle" — "the old one"
    ("den gamle", r"\bden\s+gamle\b", "the old one"),
    # "vor gamle" / "min gamle" — possessive + old
    ("vor gamle", r"\bvor\s+gamle\b", "our old one"),
    ("min gamle", r"\bmin\s+gamle\b", "my old one"),
    # "den lille" — "the little one"
    ("den lille", r"\bden\s+lille\b", "the little one"),
    # "den unge" — "the young one"
    ("den unge", r"\bden\s+unge\b", "the young one"),
    # "den syge" — "the sick one"
    ("den syge", r"\bden\s+syge\b", "the sick one"),
    # Grandparents
    ("Bedstefar", r"\bbedstefar\b", "grandfather"),
    ("Bedstemoder", r"\bbedstemoder\b", "grandmother (formal)"),
    ("Bedstemor", r"\bbedstemor\b", "grandmother"),
    # In-laws
    ("Svigerfar", r"\bsvigerfar\b", "father-in-law"),
    ("Svigermor", r"\bsvigermor\b", "mother-in-law"),
    ("Svigermoder", r"\bsvigermoder\b", "mother-in-law (formal)"),
    # Uncle / Aunt
    ("Onkel", r"\bonkel\b", "uncle"),
    ("Tante", r"\btante\b", "aunt"),
    # "Stakkel" / "Stakkels" — "poor one"
    ("Stakkel", r"\bstakkels?\b", "poor one"),
]

CONTEXT_CHARS = 100  # characters of context on each side

# Patterns that need standalone-vs-adjective classification.
# When "den gamle" is followed by a noun, it's an adjective ("den gamle kone").
# When standalone or followed by a verb/punctuation, it's an epithet for a person.
ADJECTIVE_CHECK_PATTERNS = {"den gamle", "den lille", "den unge", "den syge",
                            "vor gamle", "min gamle"}

# Words that, when following the epithet, indicate it's used as an adjective
# modifying a noun rather than as a standalone person reference.
FOLLOWING_NOUN_PATTERN = re.compile(
    r"^\s+[a-zæøå]",  # followed by whitespace + lowercase word (common noun)
    re.IGNORECASE,
)

# Common nouns/words that follow "den gamle" in adjectival use.
# This includes concrete nouns (kone, mand), abstract nouns (rolle, sport),
# and items/clothing (litevka, bog).
MODIFIER_NOUNS = re.compile(
    r"^\s+(kone|mand|dame|kvinde|herre|bager|backer|baker|"
    r"præst|doktor|læge|ven|nabo|pige|dreng|karl|"
    r"gaard|gård|hus|kirke|vej|stol|maskine|"
    r"tjæneste|tjeneste|gænge|gang|ordre|plads|stilling|"
    r"historie|tid|vis|måde|maade|skik|sæd|"
    r"aftale|regel|system|bro|by|slot|"
    r"rolle|bog|dur|rummel|sport|højde|høide|"
    r"litevka|rønne|vane|tone|lov|ret)\b",
    re.IGNORECASE,
)


def load_letters():
    """Load corrected letters."""
    path = DATA_DIR / "corrected-letters.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_context(text, start, end, context_chars=CONTEXT_CHARS):
    """Extract surrounding context for a match."""
    ctx_start = max(0, start - context_chars)
    ctx_end = min(len(text), end + context_chars)

    before = text[ctx_start:start]
    matched = text[start:end]
    after = text[end:ctx_end]

    return {
        "before": before,
        "matched": matched,
        "after": after,
        "full_context": before + "[" + matched + "]" + after,
    }


def classify_usage(label, text, match_end):
    """
    Classify whether an epithet match is used as a standalone person reference
    ('substantive') or as an adjective modifying a following noun ('adjective').

    Returns: 'substantive', 'adjective', or 'ambiguous'
    """
    if label not in ADJECTIVE_CHECK_PATTERNS:
        return "substantive"

    after_text = text[match_end:match_end + 50]

    # Check for common noun following (adjectival use)
    if MODIFIER_NOUNS.search(after_text):
        return "adjective"

    # Check if followed by a capitalized word (proper name = adjectival: "den gamle Henningsen")
    proper_name = re.match(r"^\s+([A-ZÆØÅ][a-zæøå]+)\b", after_text)
    if proper_name:
        # But some capitalized words are place/context words, not names
        # If it looks like a name (not a common word), treat as adjective
        word = proper_name.group(1)
        # Common capitalized non-name words at sentence/clause boundaries
        non_names = {"Den", "Det", "Der", "De", "Da", "Ja", "Jeg", "Vi",
                     "Han", "Hun", "Og", "Men", "Nu", "Så", "Saa"}
        if word not in non_names:
            return "adjective"

    # Check if followed by punctuation, line break, parenthesis, dash, or end of text
    stripped = after_text.lstrip()
    if not stripped or stripped[0] in ".,;:!?)\n-–(":
        return "substantive"

    # Check if followed by a verb, preposition, adverb, or pronoun
    # (indicates the epithet IS the subject/object = person reference)
    substantive_followers = re.compile(
        r"^\s+(er|var|har|havde|skal|vil|kan|må|maa|blev|blir|"
        r"ved|siger|sagde|skriver|skrev|sidder|sad|"
        r"gaar|går|gik|kom|kommer|får|fik|gør|gjorde|ser|så|"
        r"saa|sender|sendte|mener|mente|mente|tænker|tænkte|"
        r"laver|holdt|holder|ligger|faldt|falder|"
        r"kører|køre|kører|rider|red|staar|står|"
        r"sagt|fået|nok|nemlig|ellers|"
        r"sig|ham|hende|det|at\b|"
        r"i\b|op\b|af\b|til\b|på\b|paa\b|bort|borte|"
        r"afsted|oppe|endnu|igen|angaaende|angående|og\b)\b",
        re.IGNORECASE,
    )
    if substantive_followers.search(after_text):
        return "substantive"

    return "ambiguous"


def scan_letter(letter, compiled_patterns):
    """Scan a single letter for all epithet patterns. Returns list of matches."""
    text = letter.get("text_corrected") or letter.get("text_source") or ""
    if not text:
        return []

    letter_id = letter["id"]
    date = letter.get("date", "")
    matches = []

    for label, pattern, description in compiled_patterns:
        for m in pattern.finditer(text):
            ctx = extract_context(text, m.start(), m.end())
            usage = classify_usage(label, text, m.end())
            matches.append({
                "pattern": label,
                "description": description,
                "letter_id": letter_id,
                "date": date,
                "matched_text": m.group(),
                "position": m.start(),
                "usage": usage,
                "context_before": ctx["before"],
                "context_after": ctx["after"],
                "full_context": ctx["full_context"],
            })

    return matches


def main():
    print("=" * 60)
    print("ADR-043: Epithet Scanner")
    print("=" * 60)

    # Load letters
    letters = load_letters()
    print(f"Loaded {len(letters)} letters from corrected-letters.json")

    # Compile patterns
    compiled_patterns = [
        (label, re.compile(regex, re.IGNORECASE), desc)
        for label, regex, desc in EPITHET_PATTERNS
    ]

    # Scan all letters
    all_matches = []
    for letter in letters:
        all_matches.extend(scan_letter(letter, compiled_patterns))

    print(f"Found {len(all_matches)} total epithet matches")

    # Group by pattern
    by_pattern = defaultdict(list)
    for match in all_matches:
        by_pattern[match["pattern"]].append(match)

    # Build output structure
    inventory = {
        "metadata": {
            "total_matches": len(all_matches),
            "total_letters_scanned": len(letters),
            "patterns_scanned": len(EPITHET_PATTERNS),
            "context_chars": CONTEXT_CHARS,
        },
        "patterns": {},
    }

    # Sort patterns by match count descending
    for label in sorted(by_pattern.keys(), key=lambda k: -len(by_pattern[k])):
        matches = by_pattern[label]
        # Unique letter IDs
        letter_ids = sorted(set(m["letter_id"] for m in matches))
        # Usage breakdown
        usage_counts = defaultdict(int)
        for m in matches:
            usage_counts[m.get("usage", "substantive")] += 1
        substantive_ids = sorted(set(
            m["letter_id"] for m in matches if m.get("usage") == "substantive"
        ))
        inventory["patterns"][label] = {
            "description": matches[0]["description"],
            "total_mentions": len(matches),
            "unique_letters": len(letter_ids),
            "substantive_mentions": usage_counts.get("substantive", 0),
            "adjective_mentions": usage_counts.get("adjective", 0),
            "ambiguous_mentions": usage_counts.get("ambiguous", 0),
            "substantive_letter_ids": substantive_ids,
            "letter_ids": letter_ids,
            "matches": sorted(matches, key=lambda m: (m["date"], m["letter_id"])),
        }

    # Print summary
    print(f"\n{'Pattern':<20s} {'Total':>8s} {'Subst':>8s} {'Adj':>8s} {'Ambig':>8s} {'Letters':>8s}")
    print("-" * 62)
    for label, data in inventory["patterns"].items():
        print(f"{label:<20s} {data['total_mentions']:>8d} "
              f"{data['substantive_mentions']:>8d} "
              f"{data['adjective_mentions']:>8d} "
              f"{data['ambiguous_mentions']:>8d} "
              f"{data['unique_letters']:>8d}")

    # Write output
    output_path = DATA_DIR / "epithet-inventory.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(inventory, f, ensure_ascii=False, indent=2)

    print(f"\nOutput written to: {output_path}")


if __name__ == "__main__":
    main()
