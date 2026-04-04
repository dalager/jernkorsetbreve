#!/usr/bin/env python3
"""
ADR-043: Epithet Resolution

Resolves epithet references to known persons in the person-registry.
Uses co-occurrence analysis, context classification, temporal patterns,
and grammatical gender clues to determine who each epithet refers to.

Reads:
  - data/epithet-inventory.json (from scan-epithets.py)
  - data/letter-entities-draft.json (per-letter NER entities)
  - data/person-registry.json (canonical persons)
  - data/corrected-letters.json (full letter texts for deeper analysis)

Outputs:
  - data/epithet-resolutions.json
"""

import json
import re
import sys
from pathlib import Path
from collections import defaultdict, Counter

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

# ---------------------------------------------------------------------------
# Gender signal patterns (Danish)
# ---------------------------------------------------------------------------
MALE_PRONOUNS = re.compile(
    r"\b(han|ham|hans|sin\s+mand|sin\s+far|sin\s+fader)\b", re.IGNORECASE
)
FEMALE_PRONOUNS = re.compile(
    r"\b(hun|hende|hendes|sin\s+kone|sin\s+mor|sin\s+moder)\b", re.IGNORECASE
)

# ---------------------------------------------------------------------------
# Context classification keywords
# ---------------------------------------------------------------------------
FAMILY_KEYWORDS = re.compile(
    r"\b(far|faer|mor|moer|moder|fader|hjem|hjemme|hus|gaard|gård|"
    r"børn|barn|familie|søster|broder|bror|søndag|"
    r"trine|musse|signe|bodil|roagger|obling)\b",
    re.IGNORECASE,
)
MILITARY_KEYWORDS = re.compile(
    r"\b(soldat|regiment|regt|kompagni|kaserne|feldt|felt|"
    r"kommando|løjtnant|leutn|hauptm|feldw|feldv|oberstl|"
    r"krig|front|skyttegrav|gevær|kanon|batteri|"
    r"konow|poulsen|petersen|madsen|braunsberg)\b",
    re.IGNORECASE,
)
COMMUNITY_KEYWORDS = re.compile(
    r"\b(nabo|kirke|præst|marked|marked|fest|bryllup|"
    r"begravelse|mejeri|skole|forening|møde)\b",
    re.IGNORECASE,
)

# Aliases for "Far" that we check for co-occurrence
FAR_ALIASES = {"Far", "Faer", "Fader"}

MIN_MENTIONS_FOR_RESOLUTION = 3


def load_json(filename):
    """Load a JSON file from the data directory."""
    with open(DATA_DIR / filename, "r", encoding="utf-8") as f:
        return json.load(f)


def get_letter_text_map(letters):
    """Build a map of letter_id -> full text for context lookups."""
    text_map = {}
    for letter in letters:
        text = letter.get("text_corrected") or letter.get("text_source") or ""
        text_map[letter["id"]] = text
    return text_map


def check_far_cooccurrence(letter_id, letter_entities):
    """Check whether 'Far' or 'Faer' appears as NER entity in the same letter."""
    lid = str(letter_id)
    if lid not in letter_entities:
        return False
    persons = letter_entities[lid].get("persons", [])
    return bool(FAR_ALIASES & set(persons))


def check_far_in_text(letter_id, text_map):
    """Check whether Far/Faer appears in the letter text (not just NER)."""
    text = text_map.get(letter_id, "")
    return bool(re.search(r"\b(Far|Faer)\b", text))


def classify_context(full_context):
    """Classify a match context as family/military/community/ambiguous."""
    family_score = len(FAMILY_KEYWORDS.findall(full_context))
    military_score = len(MILITARY_KEYWORDS.findall(full_context))
    community_score = len(COMMUNITY_KEYWORDS.findall(full_context))

    if family_score > military_score and family_score > community_score:
        return "family"
    if military_score > family_score and military_score > community_score:
        return "military"
    if community_score > family_score and community_score > military_score:
        return "community"
    return "ambiguous"


def detect_gender(full_context):
    """Detect grammatical gender clues in the context around a match."""
    male_count = len(MALE_PRONOUNS.findall(full_context))
    female_count = len(FEMALE_PRONOUNS.findall(full_context))

    if male_count > female_count:
        return "male"
    if female_count > male_count:
        return "female"
    return "unknown"


def get_wider_context(letter_id, position, text_map, window=300):
    """Get a wider context window from the full letter text."""
    text = text_map.get(letter_id, "")
    if not text:
        return ""
    start = max(0, position - window)
    end = min(len(text), position + window)
    return text[start:end]


def resolve_den_gamle(pattern_data, letter_entities, text_map):
    """
    Resolve 'den gamle' — the most complex epithet.

    Analysis shows "den gamle" refers to MULTIPLE people depending on context:
    - In military context (wartime): the commanding officer (Major/Oberstleutnant)
    - In family context (pre-war or letters home): possibly Peter's father
    - Occasionally: other older persons (e.g. "den gamle i Birkelev" = a woman)

    Strategy:
    0. Filter to substantive uses only (skip adjectival: "den gamle kone")
    1. Classify each mention by context and gender
    2. Check co-occurrence with Far/Faer
    3. Detect temporal patterns
    4. Produce a split resolution with per-mention classification
    """
    all_matches = pattern_data["matches"]

    # Separate substantive (person reference) from adjectival uses
    matches = [m for m in all_matches if m.get("usage") == "substantive"]
    adjective_matches = [m for m in all_matches if m.get("usage") == "adjective"]
    ambiguous_matches = [m for m in all_matches if m.get("usage") == "ambiguous"]

    # Per-mention analysis
    military_evidence = []
    family_evidence = []
    other_evidence = []
    context_breakdown = Counter()
    gender_breakdown = Counter()

    for match in matches:
        lid = match["letter_id"]
        date = match["date"]
        position = match["position"]

        wider_ctx = get_wider_context(lid, position, text_map)
        narrow_ctx = match["full_context"]

        far_in_ner = check_far_cooccurrence(lid, letter_entities)
        far_in_text = check_far_in_text(lid, text_map)
        has_cooccurrence = far_in_ner or far_in_text

        context_type = classify_context(wider_ctx)
        context_breakdown[context_type] += 1

        gender = detect_gender(wider_ctx)
        gender_breakdown[gender] += 1

        signals = []
        if context_type != "ambiguous":
            signals.append(context_type + " context")
        if gender != "unknown":
            signals.append(gender + " referent")
        if has_cooccurrence:
            signals.append("co-occurs with Far/Faer")

        entry = {
            "letter_id": lid,
            "date": date,
            "context": narrow_ctx,
            "signal": ", ".join(signals) if signals else "no clear signal",
            "context_type": context_type,
            "gender": gender,
            "co_occurs_with_far": has_cooccurrence,
        }

        # Classification logic:
        # - Co-occurs with Far/Faer in same letter => must be someone else (military)
        # - Military context => commanding officer
        # - Female gender => other person
        # - Family context (any period) => likely Far, unless co-occurs
        # - Ambiguous context during wartime => likely military superior
        is_wartime = date >= "1914-08-01"
        if has_cooccurrence:
            # If "Far" mentioned separately, "den gamle" is someone else
            military_evidence.append(entry)
        elif gender == "female":
            other_evidence.append(entry)
        elif context_type == "military":
            military_evidence.append(entry)
        elif context_type == "family":
            family_evidence.append(entry)
        elif context_type == "ambiguous" and is_wartime:
            # Ambiguous wartime = likely military superior
            military_evidence.append(entry)
        else:
            other_evidence.append(entry)

    total = len(matches)
    mil_count = len(military_evidence)
    fam_count = len(family_evidence)
    other_count = len(other_evidence)

    # Temporal analysis
    pre_war = [m for m in matches if m["date"] < "1914-08-01"]
    war_time = [m for m in matches if m["date"] >= "1914-08-01"]
    temporal_note = (
        f"Pre-war: {len(pre_war)} mentions, wartime: {len(war_time)} mentions. "
        f"Military usage dominates wartime ({mil_count} of {total} total)."
    )

    return {
        "epithet": "den gamle",
        "pattern": "den gamle",
        "total_mentions": total,
        "total_raw_mentions": len(all_matches),
        "adjective_mentions_excluded": len(adjective_matches),
        "ambiguous_mentions_excluded": len(ambiguous_matches),
        "resolved_to": "SPLIT",
        "resolved_to_canonical": None,
        "confidence": "review",
        "reason": (
            f"'den gamle' refers to MULTIPLE people: "
            f"{mil_count} mentions likely = commanding officer (military superior), "
            f"{fam_count} mentions likely = Far (Peter's father), "
            f"{other_count} mentions = other persons (incl. female referents). "
            f"Explicit identification in letter 281: 'den gamle (Majoren)'. "
            f"Co-occurrence with Far/Faer in same letter confirms they are "
            f"different people in military context."
        ),
        "temporal_note": temporal_note,
        "split_resolution": {
            "military_superior": {
                "likely_referent": "commanding officer (Major/Oberstleutnant)",
                "mention_count": mil_count,
                "confidence": "high",
                "key_evidence": "Letter 281: 'den gamle (Majoren)'",
                "evidence": military_evidence[:15],
            },
            "father": {
                "likely_referent": "far",
                "likely_canonical": "Far",
                "mention_count": fam_count,
                "confidence": "medium",
                "evidence": family_evidence[:10],
            },
            "other": {
                "mention_count": other_count,
                "confidence": "low",
                "note": "Includes female referents and unclear cases",
                "evidence": other_evidence[:5],
            },
        },
        "co_occurs_with_target": any(
            e["co_occurs_with_far"] for e in military_evidence + family_evidence
        ),
        "co_occurrence_count": sum(
            1 for e in military_evidence + family_evidence + other_evidence
            if e["co_occurs_with_far"]
        ),
        "co_occurrence_rate": round(
            sum(1 for e in military_evidence + family_evidence + other_evidence
                if e["co_occurs_with_far"]) / total if total > 0 else 0,
            3,
        ),
        "context_breakdown": dict(context_breakdown),
        "gender_breakdown": dict(gender_breakdown),
    }


def resolve_generic_epithet(label, pattern_data, letter_entities, text_map,
                            epithet_type="generic"):
    """
    Resolve kinship, adjective, or other epithets.
    epithet_type: 'kinship', 'adjective', or 'generic'
    """
    matches = pattern_data["matches"]
    context_breakdown = Counter()
    gender_breakdown = Counter()
    evidence = []

    for match in matches:
        lid = match["letter_id"]
        position = match["position"]
        wider_ctx = get_wider_context(lid, position, text_map)
        context_type = classify_context(wider_ctx)
        context_breakdown[context_type] += 1
        gender = detect_gender(wider_ctx)
        gender_breakdown[gender] += 1
        signals = [context_type + " context"]
        if gender != "unknown":
            signals.append(gender + " referent")
        evidence.append({
            "letter_id": lid,
            "date": match["date"],
            "context": match["full_context"],
            "signal": ", ".join(signals),
        })

    # "vor gamle" and "min gamle" follow the same split pattern as "den gamle"
    related_to_den_gamle = label in ("vor gamle", "min gamle")
    if related_to_den_gamle:
        resolved_to = "SPLIT (same as 'den gamle')"
        confidence = "review"
        reason = (
            f"Variant of 'den gamle' pattern; same split referent: "
            f"commanding officer in military context, Far in family context"
        )
    elif epithet_type == "kinship":
        resolved_to = None
        confidence = "unresolved"
        reason = f"Kinship term with {len(matches)} mentions; no registry mapping attempted"
    else:
        resolved_to = None
        confidence = "unresolved"
        reason = f"Epithet with {len(matches)} mentions; needs manual review"

    return {
        "epithet": label,
        "pattern": label,
        "total_mentions": len(matches),
        "resolved_to": resolved_to,
        "resolved_to_canonical": None,
        "confidence": confidence,
        "reason": reason,
        "temporal_note": None,
        "evidence": evidence[:10],
        "counter_evidence": [],
        "co_occurs_with_target": False,
        "co_occurrence_count": 0,
        "co_occurrence_rate": 0,
        "context_breakdown": dict(context_breakdown),
        "gender_breakdown": dict(gender_breakdown),
    }


def main():
    print("=" * 60)
    print("ADR-043: Epithet Resolution")
    print("=" * 60)

    # Load data
    inventory = load_json("epithet-inventory.json")
    letter_entities = load_json("letter-entities-draft.json")
    letters = load_json("corrected-letters.json")

    text_map = get_letter_text_map(letters)

    print(f"Loaded epithet inventory: {inventory['metadata']['total_matches']} matches")
    print(f"Loaded {len(letter_entities)} letter entity records")
    print(f"Loaded {len(letters)} letter texts")

    patterns = inventory["patterns"]
    resolutions = []

    # Kinship patterns
    kinship_labels = {
        "Bedstefar", "Bedstemoder", "Bedstemor",
        "Svigerfar", "Svigermor", "Svigermoder",
        "Onkel", "Tante",
    }

    # Adjective/descriptive patterns
    adjective_labels = {
        "den lille", "den unge", "den syge",
        "vor gamle", "min gamle", "Stakkel",
    }

    for label, pattern_data in patterns.items():
        total = pattern_data["total_mentions"]
        print(f"\nProcessing: {label} ({total} mentions)")

        if label == "den gamle":
            resolution = resolve_den_gamle(
                pattern_data, letter_entities, text_map
            )
        else:
            if total < MIN_MENTIONS_FOR_RESOLUTION:
                print(f"  Skipping (only {total} mentions, threshold={MIN_MENTIONS_FOR_RESOLUTION})")
                continue
            etype = "kinship" if label in kinship_labels else "adjective"
            resolution = resolve_generic_epithet(
                label, pattern_data, letter_entities, text_map, etype
            )

        resolutions.append(resolution)
        print(f"  -> resolved_to={resolution['resolved_to']}, "
              f"confidence={resolution['confidence']}")

    # Sort by total_mentions descending
    resolutions.sort(key=lambda r: -r["total_mentions"])

    # Write output
    output_path = DATA_DIR / "epithet-resolutions.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(resolutions, f, ensure_ascii=False, indent=2)

    # Print summary
    print(f"\n{'=' * 60}")
    print("RESOLUTION SUMMARY")
    print(f"{'=' * 60}")
    print(f"Total epithets resolved: {len(resolutions)}")
    print(f"\n{'Epithet':<20s} {'Mentions':>10s} {'Resolved To':<15s} {'Confidence':<10s}")
    print("-" * 57)
    for r in resolutions:
        resolved = r["resolved_to"] or "(unresolved)"
        print(f"{r['epithet']:<20s} {r['total_mentions']:>10d} {resolved:<15s} {r['confidence']:<10s}")

    # Highlight the key finding
    den_gamle = next((r for r in resolutions if r["epithet"] == "den gamle"), None)
    if den_gamle:
        print(f"\n--- Key Finding: 'den gamle' ---")
        print(f"  Substantive mentions: {den_gamle['total_mentions']} "
              f"(of {den_gamle.get('total_raw_mentions', '?')} raw)")
        print(f"  Excluded: {den_gamle.get('adjective_mentions_excluded', 0)} adjectival, "
              f"{den_gamle.get('ambiguous_mentions_excluded', 0)} ambiguous")
        print(f"  Resolved to: {den_gamle['resolved_to']}")
        split = den_gamle.get("split_resolution", {})
        if split:
            mil = split.get("military_superior", {})
            fam = split.get("father", {})
            oth = split.get("other", {})
            print(f"  - Commanding officer: {mil.get('mention_count', 0)} mentions "
                  f"(confidence: {mil.get('confidence', '?')})")
            print(f"  - Father (Far):      {fam.get('mention_count', 0)} mentions "
                  f"(confidence: {fam.get('confidence', '?')})")
            print(f"  - Other:             {oth.get('mention_count', 0)} mentions")
        print(f"  Context: {den_gamle['context_breakdown']}")
        print(f"  Gender: {den_gamle['gender_breakdown']}")
        if den_gamle.get("temporal_note"):
            print(f"  Temporal: {den_gamle['temporal_note']}")

    print(f"\nOutput written to: {output_path}")


if __name__ == "__main__":
    main()
