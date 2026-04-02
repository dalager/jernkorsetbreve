#!/usr/bin/env python3
"""
Data quality audit for jernkorsetbreve — 665 WW1 Danish letters.

Scans data/letters.csv and produces data/quality-audit/error-inventory.json.

Detection tiers:
  A — encoding artifacts (high confidence)
  B — known typing/OCR error patterns (medium confidence, context-dependent)
  C — statistical anomalies / hapax legomena (low confidence, review only)
"""

import csv
import io
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

# Windows UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "data"
INPUT_CSV = DATA_DIR / "letters.csv"
OUTPUT_DIR = DATA_DIR / "quality-audit"
OUTPUT_JSON = OUTPUT_DIR / "error-inventory.json"

# ---------------------------------------------------------------------------
# Levenshtein distance (pure Python fallback)
# ---------------------------------------------------------------------------
try:
    import Levenshtein as _lev  # type: ignore

    def levenshtein(a: str, b: str) -> int:
        return _lev.distance(a, b)

except ImportError:
    def levenshtein(a: str, b: str) -> int:
        """Simple DP edit distance."""
        if len(a) < len(b):
            a, b = b, a
        if not b:
            return len(a)
        prev = list(range(len(b) + 1))
        for i, ca in enumerate(a, 1):
            curr = [i]
            for j, cb in enumerate(b, 1):
                curr.append(min(prev[j] + 1, curr[j - 1] + 1,
                                prev[j - 1] + (ca != cb)))
            prev = curr
        return prev[-1]


# ---------------------------------------------------------------------------
# Helper: extract ~40-char context window around a match position
# ---------------------------------------------------------------------------
def _context(text: str, pos: int, window: int = 40) -> str:
    start = max(0, pos - window)
    end = min(len(text), pos + window)
    snippet = text[start:end].replace("\n", " ")
    return f"...{snippet}..."


# ---------------------------------------------------------------------------
# Tier A — encoding artifacts
# ---------------------------------------------------------------------------
TIER_A_CHARS = {
    "\u0085": ("remove", "NEL control character — remove"),
    "\u00b4": ("remove_eol", "Acute accent at line end — remove"),
    "\u00e1": ("review", "á — likely encoding error for 'a'"),
    "\u00ab": ("review", "« guillemet — garbled text"),
    "\u00a5": ("review", "¥ yen sign — likely 'W' in German passage"),
}

# Characters that are LEGITIMATE and must not be flagged
LEGITIMATE_CHARS = set("üäöÜÄÖ½¼¾°")


def scan_tier_a(letter_id: int, text: str) -> list[dict]:
    findings = []
    for i, ch in enumerate(text):
        if ch not in TIER_A_CHARS:
            continue
        action, rationale = TIER_A_CHARS[ch]
        # For acute accent: only flag when at end of a line / para
        if action == "remove_eol":
            after = text[i + 1:i + 3]
            if after and after[0] not in ("\n", ""):
                continue
        findings.append({
            "letter_id": letter_id,
            "position": i,
            "context": _context(text, i),
            "original": ch,
            "suggested_correction": "" if action in ("remove", "remove_eol") else None,
            "category": "encoding_artifact",
            "confidence": "high",
            "method": "encoding_scan",
            "rationale": rationale,
        })
    return findings


# ---------------------------------------------------------------------------
# Tier B — known error patterns
# ---------------------------------------------------------------------------

def _preceding_word(text: str, match_start: int) -> str:
    """Return the word immediately before the match (lowercase, stripped)."""
    before = text[:match_start].rstrip()
    m = re.search(r"\b(\w+)\s*$", before)
    return m.group(1).lower() if m else ""


def _following_token(text: str, match_end: int) -> str:
    """Return the first non-space token after the match (lowercase)."""
    after = text[match_end:].lstrip()
    m = re.match(r"(\w+)", after)
    return m.group(1).lower() if m else ""


# Danish infinitive indicators (common words that precede infinitives)
INFINITIVE_TRIGGERS = {"at", "vil", "kan", "skal", "må", "maa", "bør", "boer",
                       "er", "var", "har", "havde"}

# Common Danish pronouns / adverbs that indicate 'korn' is in verb position
PRONOUN_ADVERBS = {"jeg", "du", "han", "hun", "vi", "de", "der", "her",
                   "nu", "ikke", "jo", "da", "vel", "nok", "hjem", "ud",
                   "ind", "op", "ned", "tilbage", "igen"}

# Simple German word markers: if surrounded by clear German we skip
GERMAN_INDICATORS = {"der", "die", "das", "ein", "eine", "und", "ist",
                     "ich", "sie", "er", "wir", "nicht", "mit", "auf"}


def scan_tier_b(letter_id: int, text: str) -> list[dict]:
    findings = []

    # 1. Tor → for   (only when preceded by "Tak")
    for m in re.finditer(r"\bTor\b", text):
        prec = _preceding_word(text, m.start())
        if prec == "tak":
            findings.append({
                "letter_id": letter_id,
                "position": m.start(),
                "context": _context(text, m.start()),
                "original": m.group(),
                "suggested_correction": "for",
                "category": "typing_error",
                "confidence": "medium",
                "method": "pattern_match",
                "rationale": (
                    "Fixed greeting formula 'Tak for sidst'; "
                    "'Tor' not preceded by 'Brandenburger' or part of compound"
                ),
            })

    # 2. dia → du   (pronoun position: not a name, used as pronoun)
    for m in re.finditer(r"\bdia\b", text, re.IGNORECASE):
        # Pronoun positions: after comma/start of clause, before verb
        before_ctx = text[max(0, m.start() - 15):m.start()]
        # Skip if it looks like a name (capitalised mid-sentence only after .!?)
        if m.group()[0].isupper():
            before_stripped = before_ctx.strip()
            if before_stripped and before_stripped[-1] not in ".!?":
                findings.append({
                    "letter_id": letter_id,
                    "position": m.start(),
                    "context": _context(text, m.start()),
                    "original": m.group(),
                    "suggested_correction": "du",
                    "category": "typing_error",
                    "confidence": "medium",
                    "method": "pattern_match",
                    "rationale": "'dia' is not a Danish word; appears in pronoun position",
                })
        else:
            findings.append({
                "letter_id": letter_id,
                "position": m.start(),
                "context": _context(text, m.start()),
                "original": m.group(),
                "suggested_correction": "du",
                "category": "typing_error",
                "confidence": "medium",
                "method": "pattern_match",
                "rationale": "'dia' is not a Danish word; appears in pronoun position",
            })

    # 3. st → at   (preceded by "ude" AND followed by infinitive trigger or verb)
    for m in re.finditer(r"\bst\b", text, re.IGNORECASE):
        prec = _preceding_word(text, m.start())
        foll = _following_token(text, m.end())
        if prec == "ude" and foll not in ("", ):
            findings.append({
                "letter_id": letter_id,
                "position": m.start(),
                "context": _context(text, m.start()),
                "original": m.group(),
                "suggested_correction": "at",
                "category": "typing_error",
                "confidence": "medium",
                "method": "pattern_match",
                "rationale": "'st' not a Danish word after 'ude'; expected 'at' + infinitive",
            })

    # 4. korn → kom   (in verb position, not agricultural context)
    #    All 4 corpus occurrences are "kom" typos:
    #    L5: "Og korn vi til at snakke" (followed by pronoun)
    #    L6: "da Uffe korn, hjalp det" (followed by comma+verb)
    #    L29: "Lørdag aften korn der så" (followed by adverb)
    #    L34: "Så korn Underofficeren" (followed by proper noun subject)
    AGRI_CONTEXT = {"sæd", "høst", "mark", "rug", "byg", "havre", "hvede",
                    "afgrøde", "kerne", "sæk", "lade"}
    for m in re.finditer(r"\bkorn\b", text, re.IGNORECASE):
        prec = _preceding_word(text, m.start())
        foll = _following_token(text, m.end())
        # Skip if clearly agricultural (preceded by grain/harvest words)
        if prec in AGRI_CONTEXT:
            continue
        # In verb position: preceded by subject/adverb, or followed by
        # pronoun/adverb/noun (any word that could be a subject or complement).
        # The key signal: "korn" as standalone verb is not a valid Danish word.
        # "korn" as noun means "grain" — only skip when preceded by agri context.
        findings.append({
            "letter_id": letter_id,
            "position": m.start(),
            "context": _context(text, m.start()),
            "original": m.group(),
            "suggested_correction": "kom",
            "category": "typing_error",
            "confidence": "medium",
            "method": "pattern_match",
            "rationale": (
                "'korn' is not a Danish verb form; "
                "context indicates past tense 'kom' (came), not noun 'korn' (grain)"
            ),
        })

    # 5. lier → her   (not a name; preceded by article/adjective)
    ARTICLES_ADJ = {"den", "det", "de", "en", "et", "min", "din", "sin",
                    "vor", "hans", "hendes", "deres", "lille", "store", "gamle",
                    "eneste", "første", "sidste", "største", "bedste"}
    for m in re.finditer(r"\blier\b", text, re.IGNORECASE):
        prec = _preceding_word(text, m.start())
        if prec in ARTICLES_ADJ:
            findings.append({
                "letter_id": letter_id,
                "position": m.start(),
                "context": _context(text, m.start()),
                "original": m.group(),
                "suggested_correction": "her",
                "category": "typing_error",
                "confidence": "medium",
                "method": "pattern_match",
                "rationale": "'lier' is not a Danish word; preceded by article/adjective",
            })

    # 6. vj → vi   (used as pronoun)
    for m in re.finditer(r"\bvj\b", text, re.IGNORECASE):
        findings.append({
            "letter_id": letter_id,
            "position": m.start(),
            "context": _context(text, m.start()),
            "original": m.group(),
            "suggested_correction": "vi",
            "category": "typing_error",
            "confidence": "medium",
            "method": "pattern_match",
            "rationale": "Adjacent-key typo 'vj' → 'vi' (pronoun position)",
        })

    # 7. love.e → lovede   (OCR artifact: period inside word)
    for m in re.finditer(r"\blove\.e\b", text, re.IGNORECASE):
        findings.append({
            "letter_id": letter_id,
            "position": m.start(),
            "context": _context(text, m.start()),
            "original": m.group(),
            "suggested_correction": "lovede",
            "category": "ocr_artifact",
            "confidence": "high",
            "method": "pattern_match",
            "rationale": "OCR artifact: period inserted inside 'lovede' (past tense of 'love'=promise)",
        })

    # 8. taeklærnpt → flag for review
    for m in re.finditer(r"\btaeklærnpt\b", text, re.IGNORECASE):
        findings.append({
            "letter_id": letter_id,
            "position": m.start(),
            "context": _context(text, m.start()),
            "original": m.group(),
            "suggested_correction": None,
            "category": "garbled_text",
            "confidence": "low",
            "method": "pattern_match",
            "rationale": "Garbled word; possibly 'tæklemt' — requires manual review",
        })

    return findings


# ---------------------------------------------------------------------------
# Tier C — statistical anomalies (hapax legomena)
# ---------------------------------------------------------------------------

# Simple German word list to avoid flagging German as errors
GERMAN_WORDS = {
    "der", "die", "das", "ein", "eine", "und", "ist", "ich", "sie",
    "er", "wir", "nicht", "mit", "auf", "den", "dem", "des", "von",
    "zu", "im", "an", "am", "bei", "nach", "aus", "über", "unter",
    "vor", "zwischen", "für", "durch", "gegen", "ohne", "um", "wie",
    "was", "wir", "aber", "oder", "wenn", "dann", "auch", "noch",
    "schon", "sehr", "hier", "dort", "jetzt", "hat", "haben", "war",
    "sein", "werden", "kann", "muss", "soll", "will", "doch", "mehr",
    "mir", "mich", "ihm", "ihn", "uns", "man", "habe", "sind", "alle",
    "dieser", "diese", "diesem", "diesen", "dieses",
}

# Tokeniser: lowercase words, letters only (includes Danish æøå)
_TOKEN_RE = re.compile(r"\b[a-zæøåäöü]{3,}\b")


def _is_sentence_start(text: str, pos: int) -> bool:
    """Return True if the token at pos is at the start of a sentence."""
    before = text[:pos].rstrip()
    if not before:
        return True
    return before[-1] in ".!?\n"


def scan_tier_c(letters: list[dict]) -> list[dict]:
    """Build global word frequency and flag hapax legomena close to common words."""
    freq: Counter = Counter()
    positions: defaultdict = defaultdict(list)  # word → [(letter_id, pos, text)]

    for row in letters:
        text = row["text"]
        letter_id = int(row["id"])
        for m in _TOKEN_RE.finditer(text.lower()):
            word = m.group()
            freq[word] += 1
            if len(positions[word]) < 5:  # keep only a few examples
                positions[word].append((letter_id, m.start(), text))

    # Words that appear 5+ times → reference vocabulary
    common_words = {w for w, c in freq.items() if c >= 5}

    findings = []
    for word, count in freq.items():
        if count != 1:
            continue
        if word in GERMAN_WORDS:
            continue

        # Check if it's likely a proper noun (original token is capitalised mid-sentence)
        occurrences = positions[word]
        if not occurrences:
            continue
        letter_id, pos, text = occurrences[0]
        original_char = text[pos] if pos < len(text) else ""

        if original_char.isupper() and not _is_sentence_start(text, pos):
            continue  # likely proper noun — skip

        # Find closest common word within edit distance ≤ 2
        best_match = None
        best_dist = 3
        # Only compare against words of similar length (±2) for performance
        for candidate in common_words:
            if abs(len(candidate) - len(word)) > 2:
                continue
            d = levenshtein(word, candidate)
            if d < best_dist:
                best_dist = d
                best_match = candidate

        if best_match is None:
            continue

        # Check if surrounded by German words (skip if so)
        ctx_lower = _context(text, pos).lower()
        german_hits = sum(1 for gw in GERMAN_WORDS if re.search(r"\b" + gw + r"\b", ctx_lower))
        if german_hits >= 2:
            continue

        findings.append({
            "letter_id": letter_id,
            "position": pos,
            "context": _context(text, pos),
            "original": word,
            "suggested_correction": best_match,
            "category": "possible_typo",
            "confidence": "review",
            "method": "statistical_hapax",
            "rationale": (
                f"Hapax legomenon; edit distance {best_dist} from "
                f"'{best_match}' (freq={freq[best_match]})"
            ),
        })

    return findings


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with open(INPUT_CSV, encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        letters = list(reader)

    print(f"Loaded {len(letters)} letters from {INPUT_CSV}")

    # Pre-process: replace <PARA> with double newline for all letters
    for row in letters:
        row["text"] = row["text"].replace("<PARA>", "\n\n")

    all_findings: list[dict] = []
    tier_a_count = 0
    tier_b_count = 0

    for row in letters:
        letter_id = int(row["id"])
        text = row["text"]

        a = scan_tier_a(letter_id, text)
        b = scan_tier_b(letter_id, text)

        tier_a_count += len(a)
        tier_b_count += len(b)
        all_findings.extend(a)
        all_findings.extend(b)

    print(f"Tier A (encoding artifacts):  {tier_a_count} findings")
    print(f"Tier B (known error patterns): {tier_b_count} findings")

    print("Running Tier C statistical scan (hapax legomena)...")
    tier_c = scan_tier_c(letters)
    tier_c_count = len(tier_c)
    all_findings.extend(tier_c)
    print(f"Tier C (statistical anomalies): {tier_c_count} findings")

    # Sort by letter_id, then position
    all_findings.sort(key=lambda x: (x["letter_id"], x["position"]))

    with open(OUTPUT_JSON, "w", encoding="utf-8") as fh:
        json.dump(all_findings, fh, ensure_ascii=False, indent=2)

    total = len(all_findings)
    print(f"\nTotal findings: {total}")
    print(f"Output written to: {OUTPUT_JSON}")

    # Category breakdown
    cats: Counter = Counter(f["category"] for f in all_findings)
    print("\nBy category:")
    for cat, cnt in cats.most_common():
        print(f"  {cat}: {cnt}")

    # Confidence breakdown
    conf: Counter = Counter(f["confidence"] for f in all_findings)
    print("\nBy confidence:")
    for c, cnt in conf.most_common():
        print(f"  {c}: {cnt}")

    # Letters affected
    affected = len({f["letter_id"] for f in all_findings})
    print(f"\nLetters with at least one finding: {affected} / {len(letters)}")


if __name__ == "__main__":
    main()
