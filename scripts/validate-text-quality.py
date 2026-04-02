#!/usr/bin/env python3
"""
validate-text-quality.py — Post-correction quality validation for jernkorsetbreve.

Reads data/corrected-letters.json and runs five automated checks:

  Check 1: Round-trip Reversal
  Check 2: No Unexpected Characters
  Check 3: Correction Positions Valid
  Check 4: Known Error Regression
  Check 5: Length Sanity

Exit code 0 if all checks pass, 1 if any fail.
"""

import io
import json
import sys
from pathlib import Path

# Windows UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "data"
INPUT_JSON = DATA_DIR / "corrected-letters.json"

# ---------------------------------------------------------------------------
# Expected character set for text_corrected
# ---------------------------------------------------------------------------

# ASCII printable: 0x20–0x7E
ASCII_PRINTABLE = set(chr(c) for c in range(0x20, 0x7F))
# Whitespace
ALLOWED_WHITESPACE = {"\n", "\t"}
# Danish
DANISH_CHARS = set("æøåÆØÅéÉ")
# German (legitimate)
GERMAN_CHARS = set("üäöÜÄÖß")
# Fractions/symbols (legitimate)
SYMBOL_CHARS = set("½¼¾°")

ALLOWED_CHARS = ASCII_PRINTABLE | ALLOWED_WHITESPACE | DANISH_CHARS | GERMAN_CHARS | SYMBOL_CHARS

# Characters that are ONLY allowed when explicitly flagged in a Tier C (review) correction
REVIEW_ONLY_CHARS = {
    "\u00e1",  # á
    "\u00ab",  # «
    "\u00a5",  # ¥
}

# ---------------------------------------------------------------------------
# Known regression strings
# ---------------------------------------------------------------------------

KNOWN_ERRORS = [
    ("Tak Tor", "should be 'Tak for'"),
    ("ude st ", "should be 'ude at '"),
    (" dia ", "should be ' du '"),
    (" vj ", "should be ' vi '"),
    ("love.e", "should be 'lovede'"),
]

# ---------------------------------------------------------------------------
# Check 1: Round-trip Reversal
# ---------------------------------------------------------------------------

def check_round_trip(letters: list[dict]) -> tuple[bool, list[str]]:
    """
    For each letter, reverse all applied corrections on text_corrected and
    verify the result equals text_source.

    Applied corrections are those where corrected is not None (Tier C items
    have corrected=None and must be skipped).
    """
    failures = []

    for letter in letters:
        letter_id = letter["id"]
        text_source = letter.get("text_source", "")
        text_corrected = letter.get("text_corrected", "")
        corrections = letter.get("corrections", [])

        # Only reverse corrections that were actually applied (corrected is not None)
        applied = [c for c in corrections if c.get("corrected") is not None]

        # Sort by position ascending (source-text positions)
        applied_sorted = sorted(applied, key=lambda c: c["position"])

        # Reverse corrections: positions reference text_source, but in
        # text_corrected earlier corrections shifted offsets when
        # original and replacement have different lengths.
        # Track cumulative offset: how much text_corrected has grown/shrunk
        # relative to text_source due to corrections processed so far.
        reconstructed = text_corrected
        # Start with the total offset from all corrections applied
        # (text_corrected is shorter/longer than text_source by this amount)
        # Process in REVERSE position order to avoid disturbing earlier positions.
        total_offset = sum(
            len(c["corrected"]) - len(c["original"]) for c in applied_sorted
        )
        # Track running offset from the end backwards
        for correction in reversed(applied_sorted):
            src_pos = correction["position"]
            orig = correction["original"]
            repl = correction["corrected"]

            # Remove this correction's contribution to get offset for positions
            # at or after this correction
            total_offset -= len(repl) - len(orig)

            # Adjusted position in reconstructed text
            adj_pos = src_pos + total_offset

            # In the reconstructed text, we expect `repl` at adj_pos
            if adj_pos >= 0 and adj_pos + len(repl) <= len(reconstructed) and \
               reconstructed[adj_pos: adj_pos + len(repl)] == repl:
                reconstructed = reconstructed[:adj_pos] + orig + reconstructed[adj_pos + len(repl):]
            else:
                actual = reconstructed[adj_pos:adj_pos + len(repl)] if adj_pos >= 0 else "?"
                failures.append(
                    f"  Letter {letter_id}: position {src_pos} (adj {adj_pos}) "
                    f"expected {repl!r} but found {actual!r}"
                )

        if reconstructed != text_source:
            # Truncate diff for readability
            diff_pos = next(
                (i for i in range(min(len(reconstructed), len(text_source)))
                 if reconstructed[i] != text_source[i]),
                min(len(reconstructed), len(text_source)),
            )
            failures.append(
                f"  Letter {letter_id}: round-trip mismatch at char {diff_pos}; "
                f"got {reconstructed[max(0,diff_pos-10):diff_pos+20]!r}, "
                f"want {text_source[max(0,diff_pos-10):diff_pos+20]!r}"
            )

    passed = len(failures) == 0
    return passed, failures


# ---------------------------------------------------------------------------
# Check 2: No Unexpected Characters
# ---------------------------------------------------------------------------

def check_unexpected_chars(letters: list[dict]) -> tuple[bool, list[str]]:
    """
    Scan text_corrected for characters outside the expected set.
    Characters in REVIEW_ONLY_CHARS are allowed only if they also appear
    in a Tier C (corrected=None) correction entry.
    """
    failures = []

    for letter in letters:
        letter_id = letter["id"]
        text_corrected = letter.get("text_corrected", "")
        corrections = letter.get("corrections", [])

        # Collect review-only chars that were explicitly flagged (Tier C)
        flagged_review_chars = set()
        for c in corrections:
            if c.get("corrected") is None and c.get("original"):
                for ch in c["original"]:
                    if ch in REVIEW_ONLY_CHARS:
                        flagged_review_chars.add(ch)

        effective_allowed = ALLOWED_CHARS | flagged_review_chars

        bad_chars: dict[str, list[int]] = {}
        for i, ch in enumerate(text_corrected):
            if ch not in effective_allowed:
                bad_chars.setdefault(ch, []).append(i)

        for ch, positions in bad_chars.items():
            pos_sample = positions[:5]
            failures.append(
                f"  Letter {letter_id}: unexpected char {ch!r} (U+{ord(ch):04X}) "
                f"at positions {pos_sample}"
                + (" ..." if len(positions) > 5 else "")
            )

    passed = len(failures) == 0
    return passed, failures


# ---------------------------------------------------------------------------
# Check 3: Correction Positions Valid
# ---------------------------------------------------------------------------

def check_positions_valid(letters: list[dict]) -> tuple[bool, list[str]]:
    """
    Validate that:
    - All positions are within text_source bounds
    - No two corrections overlap
    - Position references the correct original text
    """
    failures = []

    for letter in letters:
        letter_id = letter["id"]
        text_source = letter.get("text_source", "")
        corrections = letter.get("corrections", [])

        # Build list of (start, end) intervals for overlap detection
        intervals: list[tuple[int, int, str]] = []

        for c in corrections:
            pos = c.get("position")
            orig = c.get("original", "")

            if pos is None:
                failures.append(f"  Letter {letter_id}: correction missing 'position' field")
                continue

            orig_len = len(orig)
            end = pos + orig_len

            # Bounds check
            if pos < 0 or end > len(text_source):
                failures.append(
                    f"  Letter {letter_id}: position {pos} (end {end}) out of bounds "
                    f"(text_source length {len(text_source)})"
                )
                continue

            # Verify original matches text_source at position
            actual = text_source[pos:end]
            if actual != orig:
                failures.append(
                    f"  Letter {letter_id}: position {pos} expected {orig!r} "
                    f"but text_source has {actual!r}"
                )

            intervals.append((pos, end, orig))

        # Overlap check: sort by start, check consecutive pairs
        sorted_intervals = sorted(intervals, key=lambda x: x[0])
        for i in range(len(sorted_intervals) - 1):
            s1, e1, o1 = sorted_intervals[i]
            s2, e2, o2 = sorted_intervals[i + 1]
            if e1 > s2:
                failures.append(
                    f"  Letter {letter_id}: corrections overlap — "
                    f"{o1!r}@{s1}..{e1} overlaps {o2!r}@{s2}..{e2}"
                )

    passed = len(failures) == 0
    return passed, failures


# ---------------------------------------------------------------------------
# Check 4: Known Error Regression
# ---------------------------------------------------------------------------

def check_known_error_regression(letters: list[dict]) -> tuple[bool, list[str]]:
    """
    Verify that known error strings do NOT appear in any text_corrected.
    """
    failures = []

    for letter in letters:
        letter_id = letter["id"]
        text_corrected = letter.get("text_corrected", "")

        for error_string, note in KNOWN_ERRORS:
            if error_string in text_corrected:
                pos = text_corrected.index(error_string)
                context_start = max(0, pos - 20)
                context_end = min(len(text_corrected), pos + len(error_string) + 20)
                snippet = text_corrected[context_start:context_end].replace("\n", " ")
                failures.append(
                    f"  Letter {letter_id}: found {error_string!r} ({note}) "
                    f"at pos {pos}: ...{snippet}..."
                )

    passed = len(failures) == 0
    return passed, failures


# ---------------------------------------------------------------------------
# Check 5: Length Sanity
# ---------------------------------------------------------------------------

def check_length_sanity(letters: list[dict]) -> tuple[bool, list[str]]:
    """
    Verify len(text_corrected) / len(text_source) is between 0.95 and 1.05.
    """
    failures = []

    for letter in letters:
        letter_id = letter["id"]
        text_source = letter.get("text_source", "")
        text_corrected = letter.get("text_corrected", "")

        if len(text_source) == 0:
            if len(text_corrected) != 0:
                failures.append(
                    f"  Letter {letter_id}: text_source is empty but text_corrected is not"
                )
            continue

        ratio = len(text_corrected) / len(text_source)
        if not (0.95 <= ratio <= 1.05):
            failures.append(
                f"  Letter {letter_id}: length ratio {ratio:.4f} "
                f"(corrected={len(text_corrected)}, source={len(text_source)})"
            )

    passed = len(failures) == 0
    return passed, failures


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if not INPUT_JSON.exists():
        print(f"ERROR: Input file not found: {INPUT_JSON}")
        sys.exit(1)

    with INPUT_JSON.open(encoding="utf-8") as fh:
        letters = json.load(fh)

    print(f"Loaded {len(letters)} letters from {INPUT_JSON}")
    print()

    all_passed = True

    checks = [
        ("Check 1: Round-trip Reversal",       check_round_trip),
        ("Check 2: No Unexpected Characters",   check_unexpected_chars),
        ("Check 3: Correction Positions Valid", check_positions_valid),
        ("Check 4: Known Error Regression",     check_known_error_regression),
        ("Check 5: Length Sanity",              check_length_sanity),
    ]

    for name, check_fn in checks:
        passed, failures = check_fn(letters)
        status = "PASS" if passed else "FAIL"
        print(f"[{status}] {name}")
        if not passed:
            all_passed = False
            for line in failures[:20]:
                print(line)
            if len(failures) > 20:
                print(f"  ... and {len(failures) - 20} more failures")
        print()

    if all_passed:
        print("All checks passed.")
        sys.exit(0)
    else:
        print("One or more checks FAILED.")
        sys.exit(1)


if __name__ == "__main__":
    main()
