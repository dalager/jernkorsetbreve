"""
Psycholinguistic analysis pipeline for WW1 Danish letters (ADR-015).

Computes per-letter metrics across six categories:
  A. Lexical metrics (MATTR, MTLD, HD-D, hapax ratio, lexical density)
  B. Syntactic metrics (dependency distance, sentence length, tree depth)
  C. Psychological markers (pronouns, hedging, absolutist, cognitive, reassurance)
  D. Code-switching (Danish-German military vocabulary)
  E. Information-theoretic (Shannon entropy, compression ratio)
  F. Embedding-derived (sentiment volatility, arc asymmetry from CVP scores)

Inputs:
  data/normalized-letters.json     665 letters with text_normalized
  data/cvp-sentence-scores.json    13,577 sentence-level CVP scores
  data/letters.csv                 metadata (date, sender, recipient)

Outputs:
  data/letter-psycholinguistics.json   per-letter metric dict keyed by ID
  data/psycholinguistics-meta.json     skip-logic metadata
"""

import argparse
import gzip
import hashlib
import json
import math
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone

import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, os.pardir, "data")


def resolve(path: str) -> str:
    return os.path.normpath(os.path.join(DATA_DIR, path))


# ---------------------------------------------------------------------------
# Skip logic (ADR-029)
# ---------------------------------------------------------------------------

def compute_file_hash(path: str) -> str:
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def should_skip(letters_path: str, sentences_path: str, csv_path: str,
                meta_path: str) -> bool:
    current = {
        "letters_hash": compute_file_hash(letters_path),
        "sentences_hash": compute_file_hash(sentences_path),
        "csv_hash": compute_file_hash(csv_path),
        "script_hash": compute_file_hash(__file__),
    }
    if not os.path.exists(meta_path):
        return False
    with open(meta_path, "r", encoding="utf-8") as f:
        existing = json.load(f)
    return all(existing.get(k) == v for k, v in current.items())


# ---------------------------------------------------------------------------
# NLP Model Loading
# ---------------------------------------------------------------------------

def load_nlp_model():
    """Load DaCy transformer model, falling back to spaCy if unavailable."""
    try:
        import dacy
        nlp = dacy.load("large")
        print("Using DaCy large")
        return nlp
    except (ImportError, OSError):
        pass

    try:
        import spacy
        nlp = spacy.load("da_core_news_lg")
        print("DaCy not available, falling back to spaCy da_core_news_lg")
        return nlp
    except OSError:
        print("Error: Neither DaCy da_dacy_large_trf nor spaCy da_core_news_lg "
              "could be loaded. Install one of them first.", file=sys.stderr)
        sys.exit(1)


# ---------------------------------------------------------------------------
# Danish Lexicons for Psychological Markers
# ---------------------------------------------------------------------------

FIRST_PERSON_SINGULAR = {"jeg", "mig", "min", "mit", "mine"}
FIRST_PERSON_PLURAL = {"vi", "os", "vores", "vor", "vort"}
HEDGING_WORDS = {"vist", "måske", "vel", "nok"}
ABSOLUTIST_WORDS = {
    "altid", "aldrig", "alt", "intet", "helt",
    "fuldstændig", "alle", "ingen", "enhver",
}
COGNITIVE_WORDS = {
    "fordi", "grund", "forstå", "forstår", "indse", "indser",
    "tænke", "tænker", "mene", "mener", "derfor", "årsag",
}
REASSURANCE_PATTERNS = [
    re.compile(r"\balt\s+vel\b", re.IGNORECASE),
    re.compile(r"\bdet\s+går\s+godt\b", re.IGNORECASE),
    re.compile(r"\bI\s+skal\s+ikke\s+bekymre\b", re.IGNORECASE),
    re.compile(r"\bjeg\s+har\s+det\s+godt\b", re.IGNORECASE),
    re.compile(r"\bellers\s+alt\s+vel\b", re.IGNORECASE),
    re.compile(r"\balt\s+er\s+godt\b", re.IGNORECASE),
    re.compile(r"\bjeg\s+er\s+rask\b", re.IGNORECASE),
    re.compile(r"\bdet\s+går\s+mig\s+godt\b", re.IGNORECASE),
]
SENSORY_WORDS = {
    "se", "ser", "så", "hører", "høre", "hørte",
    "føle", "føler", "følte", "lugte", "lugter",
    "smage", "smager",
}

# German military vocabulary for code-switching detection
GERMAN_MILITARY_LEXICON = {
    # Rank/organization
    "feldvebel", "hauptmand", "hauptmann", "gefr", "regt", "unteroffizier",
    "leutnant", "zugführer", "kompagni", "batteri", "gefreiter",
    # Locations/facilities
    "kaserne", "lazarett", "etappe", "stellung", "graben",
    # Equipment
    "gewehr", "granate", "geschütz", "munition", "patrone",
    # Procedures
    "appell", "wache", "dienst", "urlaub", "marschbefehl", "ordenans",
    # Medical
    "sanitäter", "verbandplatz",
    # Administrative
    "feldpost", "feldpostkarte", "zensur",
}

# Build a set without umlauts for fuzzy matching
_UMLAUT_MAP = str.maketrans({"ä": "a", "ö": "o", "ü": "u", "ß": "ss"})


def _build_german_variants() -> set[str]:
    """Build set including both original and de-umlauted forms."""
    variants = set()
    for word in GERMAN_MILITARY_LEXICON:
        variants.add(word)
        stripped = word.translate(_UMLAUT_MAP)
        if stripped != word:
            variants.add(stripped)
    return variants


GERMAN_VARIANTS = _build_german_variants()


# ---------------------------------------------------------------------------
# A. Lexical Metrics
# ---------------------------------------------------------------------------

def compute_lexical_metrics(text: str) -> dict:
    """Compute lexical richness metrics using the lexicalrichness library."""
    from lexicalrichness import LexicalRichness

    lr = LexicalRichness(text)
    word_count = lr.words

    if word_count == 0:
        return {
            "mattr": None,
            "mtld": None,
            "hdd": None,
            "hapax_ratio": 0,
            "lexical_density": None,  # computed from DaCy POS below
            "word_count": 0,
        }

    # MATTR with window=50; fall back to TTR for short letters
    try:
        mattr = lr.mattr(window_size=50) if word_count >= 50 else lr.ttr
    except Exception:
        mattr = lr.ttr if word_count > 0 else None

    # MTLD
    try:
        mtld = lr.mtld(threshold=0.72)
    except Exception:
        mtld = None

    # HD-D requires sample_size <= words
    try:
        hdd = lr.hdd(sample_size=42) if word_count >= 42 else None
    except Exception:
        hdd = None

    # Hapax legomena: words appearing exactly once
    word_freqs = Counter(lr.wordlist)
    hapax_count = sum(1 for c in word_freqs.values() if c == 1)
    hapax_ratio = hapax_count / word_count if word_count > 0 else 0

    return {
        "mattr": round(mattr, 4) if mattr is not None else None,
        "mtld": round(mtld, 4) if mtld is not None else None,
        "hdd": round(hdd, 4) if hdd is not None else None,
        "hapax_ratio": round(hapax_ratio, 4),
        "lexical_density": None,  # filled in later from DaCy POS
        "word_count": word_count,
    }


# ---------------------------------------------------------------------------
# B. Syntactic Metrics
# ---------------------------------------------------------------------------

def _get_tree_depth(token, depth: int = 0) -> int:
    """Recursively compute depth of a token's subtree."""
    children_depths = [_get_tree_depth(c, depth + 1) for c in token.children]
    return max(children_depths) if children_depths else depth


def compute_syntactic_metrics(doc) -> dict:
    """Compute syntactic metrics from a spaCy/DaCy Doc."""
    # Mean and Max Dependency Distance
    distances = [abs(token.i - token.head.i)
                 for token in doc if token.dep_ != "ROOT"]
    mdd = sum(distances) / len(distances) if distances else 0
    max_dd = max(distances) if distances else 0

    # Mean Sentence Length
    sents = list(doc.sents)
    mean_sent_len = (sum(len(s) for s in sents) / len(sents)
                     if sents else 0)

    # Subordinate Clause Ratio
    sub_labels = {"mark", "advcl", "ccomp", "xcomp", "acl", "relcl"}
    clause_labels = sub_labels | {"ROOT", "conj"}
    sub_count = sum(1 for t in doc if t.dep_ in sub_labels)
    clause_count = sum(1 for t in doc if t.dep_ in clause_labels)
    sub_ratio = sub_count / clause_count if clause_count > 0 else 0

    # Max Tree Depth
    root_tokens = [t for t in doc if t.dep_ == "ROOT"]
    max_depth = max((_get_tree_depth(t) for t in root_tokens), default=0)

    return {
        "mean_dependency_distance": round(mdd, 4),
        "max_dependency_distance": max_dd,
        "mean_sentence_length": round(mean_sent_len, 2),
        "subordinate_clause_ratio": round(sub_ratio, 4),
        "max_tree_depth": max_depth,
    }


# ---------------------------------------------------------------------------
# C. Psychological Markers
# ---------------------------------------------------------------------------

def compute_psychological_markers(text: str, doc) -> dict:
    """Compute pronoun rates, hedging, absolutist, cognitive, and sensory markers."""
    words_lower = text.lower().split()
    total = len(words_lower)

    if total == 0:
        return {
            "first_person_singular_rate": 0,
            "first_person_plural_rate": 0,
            "jeg_vi_shift": 0,
            "hedging_rate": 0,
            "absolutist_rate": 0,
            "cognitive_rate": 0,
            "reassurance_count": 0,
            "sensory_rate": 0,
            "past_tense_ratio": 0,
            "present_tense_ratio": 0,
            "lexical_density": 0,
        }

    per_100 = 100.0 / total

    # Pronoun counts
    sing_count = sum(1 for w in words_lower if w in FIRST_PERSON_SINGULAR)
    plural_count = sum(1 for w in words_lower if w in FIRST_PERSON_PLURAL)
    sing_rate = sing_count * per_100
    plural_rate = plural_count * per_100

    # jeg/vi shift: 1 = all singular, 0 = all plural
    total_pronoun_rate = sing_rate + plural_rate
    jeg_vi_shift = (sing_rate / total_pronoun_rate
                    if total_pronoun_rate > 0 else 0)

    # Hedging, absolutist, cognitive, sensory
    hedging_count = sum(1 for w in words_lower if w in HEDGING_WORDS)
    absolutist_count = sum(1 for w in words_lower if w in ABSOLUTIST_WORDS)
    cognitive_count = sum(1 for w in words_lower if w in COGNITIVE_WORDS)
    sensory_count = sum(1 for w in words_lower if w in SENSORY_WORDS)

    # Reassurance patterns (regex on full text)
    reassurance_count = sum(
        len(pat.findall(text)) for pat in REASSURANCE_PATTERNS
    )

    # Temporal orientation: verb tense from morphological features
    past_count = 0
    present_count = 0
    for token in doc:
        if token.pos_ == "VERB":
            morph = token.morph.to_dict()
            tense = morph.get("Tense", "")
            if tense == "Past":
                past_count += 1
            elif tense == "Pres":
                present_count += 1

    tense_total = past_count + present_count
    past_ratio = past_count / tense_total if tense_total > 0 else 0
    present_ratio = present_count / tense_total if tense_total > 0 else 0

    # Lexical density from POS tags
    content_pos = {"NOUN", "VERB", "ADJ", "ADV"}
    content_count = sum(1 for t in doc if t.pos_ in content_pos)
    total_tokens = len(doc)
    lexical_density = content_count / total_tokens if total_tokens > 0 else 0

    return {
        "first_person_singular_rate": round(sing_rate, 4),
        "first_person_plural_rate": round(plural_rate, 4),
        "jeg_vi_shift": round(jeg_vi_shift, 4),
        "hedging_rate": round(hedging_count * per_100, 4),
        "absolutist_rate": round(absolutist_count * per_100, 4),
        "cognitive_rate": round(cognitive_count * per_100, 4),
        "reassurance_count": reassurance_count,
        "sensory_rate": round(sensory_count * per_100, 4),
        "past_tense_ratio": round(past_ratio, 4),
        "present_tense_ratio": round(present_ratio, 4),
        "lexical_density": round(lexical_density, 4),
    }


# ---------------------------------------------------------------------------
# D. Code-Switching (Danish-German)
# ---------------------------------------------------------------------------

def compute_code_switching(text: str) -> dict:
    """Detect German military vocabulary in Danish text."""
    words_lower = text.lower().split()
    total = len(words_lower)

    if total == 0:
        return {"german_density": 0, "german_term_count": 0}

    german_count = sum(1 for w in words_lower if w in GERMAN_VARIANTS)

    return {
        "german_density": round(german_count * 100.0 / total, 4),
        "german_term_count": german_count,
    }


# ---------------------------------------------------------------------------
# E. Information-Theoretic Metrics
# ---------------------------------------------------------------------------

def char_entropy(text: str) -> float:
    """Shannon entropy per character."""
    freqs = Counter(text.lower())
    total = len(text)
    if total == 0:
        return 0.0
    return -sum((c / total) * math.log2(c / total) for c in freqs.values())


def compression_ratio(text: str) -> float:
    """Ratio of gzip-compressed to raw byte length."""
    encoded = text.encode("utf-8")
    if len(encoded) == 0:
        return 0.0
    compressed = gzip.compress(encoded)
    return len(compressed) / len(encoded)


def compute_info_theoretic(text: str) -> dict:
    return {
        "char_entropy": round(char_entropy(text), 4),
        "compression_ratio": round(compression_ratio(text), 4),
    }


# ---------------------------------------------------------------------------
# F. Embedding-Derived Metrics (from existing CVP sentence scores)
# ---------------------------------------------------------------------------

def compute_embedding_metrics(sentence_scores: list[dict]) -> dict:
    """Compute sentiment volatility and arc asymmetry from CVP scores."""
    scores = [s["score"] for s in sentence_scores if not s["is_formulaic"]]

    if len(scores) < 2:
        return {
            "sentiment_volatility": 0,
            "sentiment_arc_asymmetry": 0,
        }

    # Sentiment volatility: mean absolute difference between consecutive scores
    diffs = [abs(scores[i + 1] - scores[i]) for i in range(len(scores) - 1)]
    volatility = sum(diffs) / len(diffs)

    # Arc asymmetry: (mean second half) - (mean first half)
    mid = len(scores) // 2
    first_half = sum(scores[:mid]) / mid if mid > 0 else 0
    second_half = (sum(scores[mid:]) / (len(scores) - mid)
                   if len(scores) - mid > 0 else 0)
    asymmetry = second_half - first_half

    return {
        "sentiment_volatility": round(volatility, 4),
        "sentiment_arc_asymmetry": round(asymmetry, 4),
    }


# ---------------------------------------------------------------------------
# Data Loading
# ---------------------------------------------------------------------------

def load_letters(path: str) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        letters = json.load(f)
    print(f"Loaded {len(letters)} normalized letters")
    return letters


def load_sentence_scores(path: str) -> dict[int, list[dict]]:
    """Load CVP sentence scores, grouped by letter_id."""
    with open(path, "r", encoding="utf-8") as f:
        sentences = json.load(f)
    by_letter: dict[int, list[dict]] = defaultdict(list)
    for s in sentences:
        by_letter[s["letter_id"]].append(s)
    print(f"Loaded {len(sentences)} sentence scores across {len(by_letter)} letters")
    return by_letter


def load_letter_metadata(path: str) -> dict[int, dict]:
    """Load letter metadata (date, recipient) from CSV."""
    df = pd.read_csv(path)
    meta = {}
    for _, row in df.iterrows():
        meta[int(row["id"])] = {
            "date": str(row["date"]) if pd.notna(row["date"]) else None,
            "recipient": str(row["recipient"]) if pd.notna(row["recipient"]) else None,
        }
    print(f"Loaded metadata for {len(meta)} letters from CSV")
    return meta


# ---------------------------------------------------------------------------
# Main Processing
# ---------------------------------------------------------------------------

def process_letters(letters: list[dict], nlp,
                    sentence_scores_by_letter: dict[int, list[dict]],
                    metadata: dict[int, dict]) -> dict:
    """Process all letters through the NLP pipeline and compute metrics."""
    results = {}

    # Prepare texts and IDs for batch processing
    texts = []
    letter_ids = []
    letter_map = {}

    for letter in letters:
        lid = letter["id"]
        text = letter.get("text_normalized", "")
        if not text or not text.strip():
            # Handle empty letters with null/zero metrics
            meta = metadata.get(lid, {})
            results[str(lid)] = _empty_metrics(meta)
            continue
        texts.append(text.strip())
        letter_ids.append(lid)
        letter_map[lid] = text.strip()

    print(f"Processing {len(texts)} letters through NLP pipeline...")
    print(f"Skipped {len(letters) - len(texts)} empty letters")

    # Batch process with nlp.pipe for efficiency
    batch_size = 16
    processed = 0

    for doc, lid in zip(nlp.pipe(texts, batch_size=batch_size), letter_ids):
        text = letter_map[lid]
        meta = metadata.get(lid, {})

        # A. Lexical metrics
        lexical = compute_lexical_metrics(text)

        # B. Syntactic metrics
        syntactic = compute_syntactic_metrics(doc)

        # C. Psychological markers (includes temporal orientation and lexical density)
        psych = compute_psychological_markers(text, doc)

        # Overwrite lexical_density from the POS-based computation
        lexical["lexical_density"] = psych.pop("lexical_density")

        # D. Code-switching
        codesw = compute_code_switching(text)

        # E. Information-theoretic
        info = compute_info_theoretic(text)

        # F. Embedding-derived metrics
        sent_scores = sentence_scores_by_letter.get(lid, [])
        embedding = compute_embedding_metrics(sent_scores)

        # Assemble per-letter result
        result = {
            "date": meta.get("date"),
            "recipient": meta.get("recipient"),
            "word_count": lexical.pop("word_count"),
        }
        result.update(lexical)
        result.update(syntactic)
        result.update(psych)
        result.update(codesw)
        result.update(info)
        result.update(embedding)

        results[str(lid)] = result

        processed += 1
        if processed % 100 == 0:
            print(f"  Processed {processed}/{len(texts)} letters...")

    print(f"  Processed {processed}/{len(texts)} letters total")
    return results


def _empty_metrics(meta: dict) -> dict:
    """Return a metrics dict with zeros/nulls for an empty letter."""
    return {
        "date": meta.get("date"),
        "recipient": meta.get("recipient"),
        "word_count": 0,
        "mattr": None,
        "mtld": None,
        "hdd": None,
        "hapax_ratio": 0,
        "lexical_density": 0,
        "mean_dependency_distance": 0,
        "max_dependency_distance": 0,
        "mean_sentence_length": 0,
        "subordinate_clause_ratio": 0,
        "max_tree_depth": 0,
        "first_person_singular_rate": 0,
        "first_person_plural_rate": 0,
        "jeg_vi_shift": 0,
        "hedging_rate": 0,
        "absolutist_rate": 0,
        "cognitive_rate": 0,
        "reassurance_count": 0,
        "sensory_rate": 0,
        "past_tense_ratio": 0,
        "present_tense_ratio": 0,
        "german_density": 0,
        "german_term_count": 0,
        "char_entropy": 0,
        "compression_ratio": 0,
        "sentiment_volatility": 0,
        "sentiment_arc_asymmetry": 0,
    }


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

def print_summary(results: dict) -> None:
    """Print summary statistics for the computed metrics."""
    non_empty = {k: v for k, v in results.items() if v["word_count"] > 0}
    if not non_empty:
        print("\n--- Summary ---")
        print("  No non-empty letters found.")
        return

    word_counts = [v["word_count"] for v in non_empty.values()]
    mattrs = [v["mattr"] for v in non_empty.values() if v["mattr"] is not None]
    mdds = [v["mean_dependency_distance"] for v in non_empty.values()]
    sing_rates = [v["first_person_singular_rate"] for v in non_empty.values()]
    german_counts = [v["german_term_count"] for v in non_empty.values()]
    reassurance = [v["reassurance_count"] for v in non_empty.values()]

    print("\n--- Summary ---")
    print(f"  Letters analyzed: {len(non_empty)}")
    print(f"  Empty/skipped:    {len(results) - len(non_empty)}")
    print(f"  Word count:       mean={sum(word_counts)/len(word_counts):.1f}, "
          f"min={min(word_counts)}, max={max(word_counts)}")
    if mattrs:
        print(f"  MATTR:            mean={sum(mattrs)/len(mattrs):.4f}, "
              f"min={min(mattrs):.4f}, max={max(mattrs):.4f}")
    print(f"  MDD:              mean={sum(mdds)/len(mdds):.4f}")
    print(f"  1st person sg:    mean={sum(sing_rates)/len(sing_rates):.2f} per 100 words")
    print(f"  German terms:     total={sum(german_counts)}, "
          f"letters with German={sum(1 for g in german_counts if g > 0)}")
    print(f"  Reassurance:      total={sum(reassurance)}, "
          f"letters with reassurance={sum(1 for r in reassurance if r > 0)}")
    print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Psycholinguistic analysis for WW1 Danish letters (ADR-015)"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Skip the skip-logic check",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Compute and print stats but do not write output",
    )
    args = parser.parse_args()

    letters_path = resolve("normalized-letters.json")
    sentences_path = resolve("cvp-sentence-scores.json")
    csv_path = resolve("letters.csv")
    meta_path = resolve("psycholinguistics-meta.json")
    output_path = resolve("letter-psycholinguistics.json")

    # Validate inputs exist
    for label, path in [
        ("Normalized letters", letters_path),
        ("CVP sentence scores", sentences_path),
        ("Letters CSV", csv_path),
    ]:
        if not os.path.exists(path):
            print(f"Error: {label} not found at {path}", file=sys.stderr)
            sys.exit(1)

    # Skip logic
    if not args.force and should_skip(letters_path, sentences_path,
                                      csv_path, meta_path):
        print("Psycholinguistic analysis up to date, skipping.")
        sys.exit(0)

    # Load inputs
    letters = load_letters(letters_path)
    sentence_scores = load_sentence_scores(sentences_path)
    metadata = load_letter_metadata(csv_path)

    # Load NLP model
    print("Loading NLP model...")
    nlp = load_nlp_model()

    # Process
    results = process_letters(letters, nlp, sentence_scores, metadata)

    # Summary
    print_summary(results)

    if args.dry_run:
        print("Dry run — no files written.")
        sys.exit(0)

    # Write output
    print("Writing output...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # Write skip-logic meta
    meta = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "letters_hash": compute_file_hash(letters_path),
        "sentences_hash": compute_file_hash(sentences_path),
        "csv_hash": compute_file_hash(csv_path),
        "script_hash": compute_file_hash(__file__),
        "letter_count": len(results),
        "non_empty_count": sum(1 for v in results.values() if v["word_count"] > 0),
        "metric_categories": [
            "lexical", "syntactic", "psychological",
            "code_switching", "info_theoretic", "embedding_derived",
        ],
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"Wrote {output_path}")
    print(f"Wrote {meta_path}")


if __name__ == "__main__":
    main()
