#!/usr/bin/env python3
"""
apply-corrections.py — Apply editorial corrections to jernkorsetbreve letters.

Reads  data/letters.csv
Writes data/corrected-letters.json

Correction tiers:
  A — High confidence (auto-apply): encoding artifacts, OCR artifacts
  B — Medium confidence (auto-apply with context checks): typing errors
  C — Review only (flag in corrections[], do NOT modify text_corrected)

Usage:
    python scripts/apply-corrections.py [--dry-run]
"""

import argparse
import csv
import io
import json
import re
import sys
from pathlib import Path

# Windows UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "data"
INPUT_CSV = DATA_DIR / "letters.csv"
ABBREV_LEXICON = DATA_DIR / "abbreviation-lexicon.json"
OUTPUT_JSON = DATA_DIR / "corrected-letters.json"


# ---------------------------------------------------------------------------
# Context helpers
# ---------------------------------------------------------------------------

def _preceding_word(text: str, pos: int) -> str:
    """Get the word immediately before position pos."""
    before = text[:pos].rstrip()
    m = re.search(r"\b(\w+)\s*$", before)
    return m.group(1).lower() if m else ""


def _following_token(text: str, end_pos: int) -> str:
    """Get the first word after position end_pos."""
    after = text[end_pos:].lstrip()
    m = re.match(r"(\w+)", after)
    return m.group(1).lower() if m else ""


def _is_sentence_start(text: str, pos: int) -> bool:
    """Return True if position pos is at the start of a sentence."""
    before = text[:pos].rstrip()
    if not before:
        return True
    return before[-1] in ".!?\n"


# ---------------------------------------------------------------------------
# Tier A — High confidence corrections (auto-apply)
# ---------------------------------------------------------------------------

def _find_tier_a(letter_id: int, text: str) -> list[dict]:
    """Find Tier A (encoding artifacts, OCR artifacts) correction candidates."""
    findings = []

    # A1: U+0085 (NEL) → remove
    for m in re.finditer("\u0085", text):
        findings.append({
            "position": m.start(),
            "original": "\u0085",
            "corrected": "",
            "category": "encoding_artifact",
            "confidence": "high",
            "method": "encoding_scan",
            "rationale": "NEL control character (U+0085) — removed",
            "_apply": True,
        })

    # A2: U+00B4 (´) → remove when at end of text or empty line
    for m in re.finditer("\u00b4", text):
        after = text[m.end():m.end() + 2]
        # Remove only when at end of text or followed by newline/end
        if not after or after[0] in ("\n", "\r"):
            findings.append({
                "position": m.start(),
                "original": "\u00b4",
                "corrected": "",
                "category": "encoding_artifact",
                "confidence": "high",
                "method": "encoding_scan",
                "rationale": "Acute accent (U+00B4) at end of line — removed",
                "_apply": True,
            })

    # A3: love.e → lovede (OCR artifact: period inside word)
    for m in re.finditer(r"\blove\.e\b", text, re.IGNORECASE):
        replacement = "Lovede" if m.group()[0].isupper() else "lovede"
        findings.append({
            "position": m.start(),
            "original": m.group(),
            "corrected": replacement,
            "category": "ocr_artifact",
            "confidence": "high",
            "method": "pattern_match",
            "rationale": "OCR artifact: period inserted inside 'lovede' (past tense of 'love'=promise)",
            "_apply": True,
        })

    # A4: á → a (encoding artifact, e.g. "skál" → "skal")
    for m in re.finditer("\u00e1", text):
        findings.append({
            "position": m.start(),
            "original": "\u00e1",
            "corrected": "a",
            "category": "encoding_artifact",
            "confidence": "high",
            "method": "encoding_scan",
            "rationale": "á (U+00E1) is encoding artifact for 'a' — e.g. 'skál' → 'skal'",
            "_apply": True,
        })

    # A5: ¥ → W (Windows-1252 artifact in German passages)
    for m in re.finditer("\u00a5", text):
        findings.append({
            "position": m.start(),
            "original": "\u00a5",
            "corrected": "W",
            "category": "encoding_artifact",
            "confidence": "high",
            "method": "encoding_scan",
            "rationale": "¥ (U+00A5) is Windows-1252 artifact for 'W' in German text",
            "_apply": True,
        })

    # A6: Pakke.n → Pakken (OCR artifact: period inside word)
    for m in re.finditer(r"\bPakke\.n\b", text):
        findings.append({
            "position": m.start(),
            "original": "Pakke.n",
            "corrected": "Pakken",
            "category": "ocr_artifact",
            "confidence": "high",
            "method": "pattern_match",
            "rationale": "OCR artifact: period inserted inside 'Pakken'",
            "_apply": True,
        })

    # A7: ? ? → ? (duplicated punctuation from transcription)
    for m in re.finditer(r"\? \?", text):
        findings.append({
            "position": m.start(),
            "original": "? ?",
            "corrected": "?",
            "category": "typing_error",
            "confidence": "high",
            "method": "pattern_match",
            "rationale": "Duplicated question mark from transcription",
            "_apply": True,
        })

    # A8: Missing space after period before capital letter (not abbreviations)
    # Matches patterns like "Gang.Her", "sider.Jeg", "morsomt.Jeg"
    # but NOT German military abbreviation compounds like "Schl.Holstein",
    # "Regt.Staben", "Batl.Stab", "Komp.føreren", "Offz.Køkkenet" etc.
    # Strategy: the word before the dot must be a full Danish word (≥4 chars)
    # AND not end in a known abbreviation suffix.
    ABBREV_SUFFIXES = {
        "chl", "egt", "atl", "att", "omp", "ffz", "elv", "efr",  # Schl, Regt, Batl, Batt, Komp, Offz, Feldv, Gefr
        "nf", "iv", "eg", "es", "az", "an",  # Inf, Div, Reg, Res, Laz, San
        "ang",  # abbreviation-like
    }
    for m in re.finditer(r"([a-zæøå]{4,})\.([A-ZÆØÅ][a-zæøå])", text):
        word_before = m.group(1)
        word_after = m.group(2)
        # Skip if the word before the dot ends with a known abbreviation suffix
        if any(word_before.endswith(sfx) for sfx in ABBREV_SUFFIXES):
            continue
        # Skip if this looks like it's inside an address/header block
        # (within 5 chars of "Poststempel", "Absender", "Feldpost" etc.)
        context_before = text[max(0, m.start() - 40):m.start()].lower()
        if any(kw in context_before for kw in ("poststempel", "absender", "feldpost", "konvolut")):
            continue
        findings.append({
            "position": m.start(),
            "original": m.group(),
            "corrected": f"{word_before}. {word_after}",
            "category": "typing_error",
            "confidence": "high",
            "method": "pattern_match",
            "rationale": f"Missing space after period: '{word_before}.{word_after}' → '{word_before}. {word_after}'",
            "_apply": True,
        })

    # A9: Specific per-letter corrections discovered by DaCy Tier C analysis.
    # These are context-specific: each pattern is unique to one letter, so we
    # match on the surrounding text to avoid false positives elsewhere.
    DACY_FIXES = [
        # L26: "foretræk ker" → "foretrækker" (line-break split)
        (r"foretræk ker", "foretrækker", "ocr_artifact",
         "Line-break hyphenation artifact: 'foretræk ker' → 'foretrækker' (prefers)"),
        # L26: "for meget rned det" → "for meget med det"
        (r"for meget rned det", "for meget med det", "typing_error",
         "Typing error: 'rned' → 'med'"),
        # L43: "tjænesten son mange" → "tjænesten som mange"
        (r"tjænesten son mange", "tjænesten som mange", "typing_error",
         "Typing error: 'son' → 'som' (adjacent key)"),
        # L44: "driltø jet" → "driltøjet" (line-break split)
        (r"driltø jet", "driltøjet", "ocr_artifact",
         "Line-break hyphenation artifact: 'driltø jet' → 'driltøjet' (drill uniform)"),
        # L50: "Mandag elier Tirsdag" → "Mandag eller Tirsdag"
        (r"elier", "eller", "typing_error",
         "Typing error: 'elier' → 'eller'"),
        # L55: "jeg skul de have" → "jeg skulde have" (line-break split)
        (r"jeg skul de have", "jeg skulde have", "ocr_artifact",
         "Line-break hyphenation artifact: 'skul de' → 'skulde'"),
        # L55: "jeg havd tænkt" → "jeg havde tænkt" (truncation)
        (r"jeg havd tænkt", "jeg havde tænkt", "ocr_artifact",
         "Line-break truncation: 'havd' → 'havde'"),
        # L55: "de andr så" → "de andre så" (truncation)
        (r"de andr så", "de andre så", "ocr_artifact",
         "Line-break truncation: 'andr' → 'andre'"),
        # L79: "jeg kal nok" → "jeg kan nok"
        (r"jeg kal nok", "jeg kan nok", "typing_error",
         "Typing error: 'kal' → 'kan' (adjacent key)"),
        # L141: "nole li jern" → "nok hjem" (garbled, resolved by project owner)
        (r"nole li jern", "nok hjem", "garbled_text",
         "Garbled text resolved by project owner: 'nole li jern' → 'nok hjem'"),
    ]
    for pattern, replacement, category, rationale in DACY_FIXES:
        for m in re.finditer(re.escape(pattern), text, re.IGNORECASE):
            findings.append({
                "position": m.start(),
                "original": m.group(),
                "corrected": replacement,
                "category": category,
                "confidence": "high",
                "method": "dacy_tier_c" if "DaCy" not in rationale else "manual",
                "rationale": rationale,
                "_apply": True,
            })

    return findings


# ---------------------------------------------------------------------------
# Tier B — Medium confidence corrections (auto-apply with context check)
# ---------------------------------------------------------------------------

AGRI_CONTEXT = {
    "sæd", "høst", "mark", "rug", "byg", "havre", "hvede",
    "afgrøde", "kerne", "sæk", "lade",
}

ARTICLES_ADJ = {
    "den", "det", "de", "en", "et", "min", "din", "sin",
    "vor", "hans", "hendes", "deres", "lille", "store", "gamle",
    "eneste", "første", "sidste",
}


def _find_tier_b(letter_id: int, text: str) -> list[dict]:
    """Find Tier B (typing errors) correction candidates."""
    findings = []

    # B4: Tor → for ONLY when preceded by "Tak"
    # Do NOT touch "Brandenburger Tor" or "Tor-nysteren"
    for m in re.finditer(r"\bTor\b", text):
        prec = _preceding_word(text, m.start())
        if prec == "tak":
            findings.append({
                "position": m.start(),
                "original": m.group(),
                "corrected": "for",
                "category": "typing_error",
                "confidence": "medium",
                "method": "pattern_match",
                "rationale": "Fixed greeting formula 'Tak for sidst'",
                "_apply": True,
            })

    # B5: dia → du when used as pronoun (lowercase, or capitalised but not after sentence end)
    for m in re.finditer(r"\bdia\b", text, re.IGNORECASE):
        if m.group()[0].isupper():
            # Capitalised — only flag if NOT at sentence start (i.e., mid-sentence capital)
            if not _is_sentence_start(text, m.start()):
                replacement = "Du"
                findings.append({
                    "position": m.start(),
                    "original": m.group(),
                    "corrected": replacement,
                    "category": "typing_error",
                    "confidence": "medium",
                    "method": "pattern_match",
                    "rationale": "'dia' is not a Danish word; capitalised mid-sentence in pronoun position",
                    "_apply": True,
                })
        else:
            findings.append({
                "position": m.start(),
                "original": m.group(),
                "corrected": "du",
                "category": "typing_error",
                "confidence": "medium",
                "method": "pattern_match",
                "rationale": "'dia' is not a Danish word; appears in pronoun position",
                "_apply": True,
            })

    # B6: st → at ONLY when preceded by "ude" and followed by a word
    for m in re.finditer(r"\bst\b", text, re.IGNORECASE):
        prec = _preceding_word(text, m.start())
        foll = _following_token(text, m.end())
        if prec == "ude" and foll:
            replacement = "At" if m.group()[0].isupper() else "at"
            findings.append({
                "position": m.start(),
                "original": m.group(),
                "corrected": replacement,
                "category": "typing_error",
                "confidence": "medium",
                "method": "pattern_match",
                "rationale": "'st' not a Danish word after 'ude'; expected 'at' + infinitive",
                "_apply": True,
            })

    # B7: korn → kom when NOT preceded by agricultural words
    for m in re.finditer(r"\bkorn\b", text, re.IGNORECASE):
        prec = _preceding_word(text, m.start())
        if prec not in AGRI_CONTEXT:
            replacement = "Kom" if m.group()[0].isupper() else "kom"
            findings.append({
                "position": m.start(),
                "original": m.group(),
                "corrected": replacement,
                "category": "typing_error",
                "confidence": "medium",
                "method": "pattern_match",
                "rationale": (
                    "'korn' is not a Danish verb form; "
                    "context indicates past tense 'kom' (came), not noun 'korn' (grain)"
                ),
                "_apply": True,
            })

    # B8: lier → her when preceded by article/adjective
    for m in re.finditer(r"\blier\b", text, re.IGNORECASE):
        prec = _preceding_word(text, m.start())
        if prec in ARTICLES_ADJ:
            replacement = "Her" if m.group()[0].isupper() else "her"
            findings.append({
                "position": m.start(),
                "original": m.group(),
                "corrected": replacement,
                "category": "typing_error",
                "confidence": "medium",
                "method": "pattern_match",
                "rationale": "'lier' is not a Danish word; preceded by article/adjective",
                "_apply": True,
            })

    # B9: vj → vi (adjacent-key typo)
    for m in re.finditer(r"\bvj\b", text, re.IGNORECASE):
        replacement = "Vi" if m.group()[0].isupper() else "vi"
        findings.append({
            "position": m.start(),
            "original": m.group(),
            "corrected": replacement,
            "category": "typing_error",
            "confidence": "medium",
            "method": "pattern_match",
            "rationale": "Adjacent-key typo 'vj' → 'vi' (pronoun position)",
            "_apply": True,
        })

    # B10: taeklærnpt → beklemt (garbled text, decided by project owner)
    for m in re.finditer(r"\btaeklærnpt\b", text, re.IGNORECASE):
        findings.append({
            "position": m.start(),
            "original": m.group(),
            "corrected": "beklemt",
            "category": "garbled_text",
            "confidence": "medium",
            "method": "manual",
            "rationale": "Garbled text resolved by project owner: 'beklemt' (constricted/anxious)",
            "_apply": True,
        })

    # B11: « — garbled encoding artifacts (resolved by project owner per-letter)
    #   L70:  "Sid«" → "side" (sidekammerater)
    #   L396: "Ru «,." → "Rusland" (with punctuation cleanup)
    #   L452: "Søndag«" → "Søndag."
    for m in re.finditer("\u00ab", text):
        pos = m.start()
        # Context-specific corrections
        before = text[max(0, pos - 6):pos]
        after = text[pos + 1:pos + 5]

        if before.endswith("Sid"):
            # "Sid«" → "side" — part of "sidekammerater"
            findings.append({
                "position": pos - 3,
                "original": "Sid\u00ab",
                "corrected": "side",
                "category": "encoding_artifact",
                "confidence": "medium",
                "method": "manual",
                "rationale": "Garbled 'Sid«' resolved by project owner: 'side' (as in 'sidekammerater')",
                "_apply": True,
            })
        elif before.rstrip().endswith("Ru"):
            # "Ru «,." → "Rusland"
            # Find the full garbled span: "Ru «,."
            garbled_start = pos - 3 if text[pos - 3:pos] == "Ru " else pos - 2
            garbled_end = pos + 1
            # Consume trailing punctuation garbage ",."
            while garbled_end < len(text) and text[garbled_end] in ",. ":
                garbled_end += 1
            garbled = text[garbled_start:garbled_end]
            findings.append({
                "position": garbled_start,
                "original": garbled,
                "corrected": "Rusland",
                "category": "encoding_artifact",
                "confidence": "medium",
                "method": "manual",
                "rationale": "Garbled 'Ru «,.' resolved by project owner: 'Rusland'",
                "_apply": True,
            })
        elif before.endswith("ndag"):
            # "Søndag«" → "Søndag."
            findings.append({
                "position": pos,
                "original": "\u00ab",
                "corrected": ".",
                "category": "encoding_artifact",
                "confidence": "medium",
                "method": "manual",
                "rationale": "Garbled 'Søndag«' resolved by project owner: 'Søndag.'",
                "_apply": True,
            })
        # If none match, leave as Tier C (will be caught below)

    return findings


# ---------------------------------------------------------------------------
# Tier C — Review only (flag but do NOT modify text_corrected)
# ---------------------------------------------------------------------------

def _find_tier_c(letter_id: int, text: str) -> list[dict]:
    """Find Tier C items to flag for review (no auto-apply)."""
    findings = []

    # All former Tier C items (taeklærnpt, á, «, ¥) have been promoted
    # to Tier A or B with specific corrections decided by project owner.
    # No remaining Tier C items.

    return findings


# ---------------------------------------------------------------------------
# Apply corrections to text (reverse order to preserve offsets)
# ---------------------------------------------------------------------------

def _apply_corrections(text: str, candidates: list[dict]) -> tuple[str, list[dict]]:
    """
    Apply corrections in reverse position order to preserve character offsets.
    Returns (corrected_text, applied_corrections_list).
    The returned list has the internal '_apply' key stripped.
    """
    # Only apply those marked _apply=True
    to_apply = [c for c in candidates if c.get("_apply")]
    to_apply_sorted = sorted(to_apply, key=lambda c: c["position"], reverse=True)

    corrected = text
    for correction in to_apply_sorted:
        pos = correction["position"]
        orig = correction["original"]
        repl = correction["corrected"]
        # Safety check: original must match at position
        if corrected[pos: pos + len(orig)] == orig:
            corrected = corrected[:pos] + repl + corrected[pos + len(orig):]

    # Build output corrections list (all candidates, strip internal key)
    output_corrections = []
    for c in candidates:
        entry = {k: v for k, v in c.items() if k != "_apply"}
        output_corrections.append(entry)

    return corrected, output_corrections


# ---------------------------------------------------------------------------
# Abbreviation annotation
# ---------------------------------------------------------------------------

def _load_abbreviation_lexicon() -> list[dict]:
    """Load abbreviation lexicon, or return empty list if file doesn't exist."""
    if not ABBREV_LEXICON.exists():
        return []
    try:
        with ABBREV_LEXICON.open(encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def _annotate_abbreviations(text: str, lexicon: list[dict]) -> list[dict]:
    """
    Scan text for abbreviation tokens from lexicon.
    Returns list of abbreviation annotation objects with positions.
    """
    if not lexicon:
        return []

    # Build lookup: token (case-sensitive) → lexicon entry
    token_map: dict[str, dict] = {}
    for entry in lexicon:
        token_map[entry["token"]] = entry

    annotations: dict[str, dict] = {}  # token → annotation accumulator

    for token, entry in token_map.items():
        pattern = re.escape(token)
        for m in re.finditer(pattern, text):
            if token not in annotations:
                annotations[token] = {
                    "token": token,
                    "expansion": entry.get("expansion", ""),
                    "category": entry.get("category", ""),
                    "positions": [],
                }
            annotations[token]["positions"].append(m.start())

    return list(annotations.values())


# ---------------------------------------------------------------------------
# Main processing
# ---------------------------------------------------------------------------

def process_letters(dry_run: bool = False) -> list[dict]:
    """Read CSV, apply corrections, return list of corrected letter objects."""
    if not INPUT_CSV.exists():
        print(f"ERROR: Input file not found: {INPUT_CSV}", file=sys.stderr)
        sys.exit(1)

    lexicon = _load_abbreviation_lexicon()
    if lexicon:
        print(f"Loaded abbreviation lexicon: {len(lexicon)} entries")
    else:
        print("No abbreviation lexicon found — abbreviations will be empty []")

    results = []
    total_corrections_applied = 0
    corrections_by_category: dict[str, int] = {}

    with INPUT_CSV.open(encoding="utf-8", newline="") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            letter_id = int(row["id"])
            raw_text = row.get("text", "")

            # Convert <PARA> to \n\n for text_source
            text_source = raw_text.replace("<PARA>", "\n\n")

            # Gather all correction candidates
            candidates: list[dict] = []
            candidates.extend(_find_tier_a(letter_id, text_source))
            candidates.extend(_find_tier_b(letter_id, text_source))
            candidates.extend(_find_tier_c(letter_id, text_source))

            # Apply corrections (Tier C items have _apply=False)
            text_corrected, corrections_out = _apply_corrections(text_source, candidates)

            # Count applied corrections
            applied_count = sum(1 for c in candidates if c.get("_apply"))
            total_corrections_applied += applied_count
            for c in corrections_out:
                if c.get("corrected") is not None:
                    cat = c.get("category", "unknown")
                    corrections_by_category[cat] = corrections_by_category.get(cat, 0) + 1

            # Annotate abbreviations
            abbreviations = _annotate_abbreviations(text_corrected, lexicon)

            # Strip internal '_apply' key already done in _apply_corrections
            # Build output corrections list with only schema fields
            schema_corrections = []
            for c in corrections_out:
                schema_corrections.append({
                    "position": c["position"],
                    "original": c["original"],
                    "corrected": c["corrected"],
                    "category": c["category"],
                    "confidence": c["confidence"],
                    "method": c["method"],
                    "rationale": c["rationale"],
                })

            letter_obj = {
                "id": letter_id,
                "date": row.get("date", ""),
                "sender": row.get("sender", ""),
                "recipient": row.get("recipient", ""),
                "place": row.get("place", ""),
                "text_source": text_source,
                "text_corrected": text_corrected,
                "corrections": schema_corrections,
                "abbreviations": abbreviations,
            }
            results.append(letter_obj)

    # Summary
    print(f"\nSummary:")
    print(f"  Total letters processed : {len(results)}")
    print(f"  Total corrections applied: {total_corrections_applied}")
    print(f"  Corrections by category:")
    for cat, count in sorted(corrections_by_category.items()):
        print(f"    {cat:30s}: {count}")

    return results


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Apply editorial corrections to jernkorsetbreve letters."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Process and print summary without writing output file.",
    )
    args = parser.parse_args()

    corrected = process_letters(dry_run=args.dry_run)

    if args.dry_run:
        print("\n[dry-run] Output file not written.")
        # Print first letter as sample
        if corrected:
            sample = corrected[0]
            print(f"\nSample (letter {sample['id']}):")
            print(f"  Corrections : {len(sample['corrections'])}")
            print(f"  Abbreviations: {len(sample['abbreviations'])}")
            if sample["corrections"]:
                for c in sample["corrections"][:3]:
                    print(f"    [{c['confidence']}] {c['original']!r} → {c['corrected']!r}  ({c['rationale']})")
        return

    with OUTPUT_JSON.open("w", encoding="utf-8") as f:
        json.dump(corrected, f, ensure_ascii=False, indent=2)

    print(f"\nOutput written to: {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
