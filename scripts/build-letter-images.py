"""Build letter-to-image associations using place, person, and date matching.

Usage:
    python scripts/build-letter-images.py
    python scripts/build-letter-images.py --stats
    python scripts/build-letter-images.py --sample 42

Reads:
  - data/image-registry.json
  - data/corrected-letters.json
  - data/letter-entities.json
  - data/person-registry.json
  - data/place-image-lookup.json
  - data/letter-image-overrides.json (optional)

Writes:
  - data/letter-images.json

Implements ADR-046.
"""

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from collections import Counter

IMAGE_REG = Path("data/image-registry.json")
LETTERS = Path("data/corrected-letters.json")
ENTITIES = Path("data/letter-entities.json")
PERSON_REG = Path("data/person-registry.json")
PLACE_LOOKUP = Path("data/place-image-lookup.json")
OVERRIDES = Path("data/letter-image-overrides.json")
OUTPUT = Path("data/letter-images.json")

MAX_PER_LETTER = 8
MIN_SCORE = 0.2
MAX_MAPS = 2
MAX_HISTORICAL = 1
MAX_RECIPIENT = 2  # ADR-050: cap recipient portraits to leave room for contextual images

# Recipient → person-registry ID
RECIPIENT_MAP = {
    "Trine Mærsk": "trine",
    "Mor og far": None,  # Both parents — handled specially
    "Peter Mærsk": "peter",
    "Maren Mærsk": "mor",
}

# Danish reason labels for frontend
REASON_DA = {
    "place+person": "Sted og person i brevet",
    "place": "Fra samme sted",
    "person": "Person nævnt i brevet",
    "recipient": "Brevets modtager",
    "date": "Samme tidsperiode",
    "context": "Baggrund",
    "manual": "Udvalgt",
}


def parse_date(s):
    """Parse ISO date string to datetime, or None."""
    if not s:
        return None
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def date_proximity_bonus(letter_date, image_date):
    """Score bonus for date proximity."""
    if not letter_date or not image_date:
        return 0.0
    delta = abs((letter_date - image_date).days)
    if delta <= 31:
        return 0.3   # Same month
    elif delta <= 92:
        return 0.2   # Same quarter
    elif delta <= 365:
        return 0.1   # Same year
    return 0.0


def resolve_letter_persons(letter, entities_map, person_reg_map):
    """Get person IDs mentioned in a letter."""
    letter_id = letter["id"]
    persons = set()

    # From NER entities
    if letter_id in entities_map:
        for ent in entities_map[letter_id].get("entities", []):
            if ent.get("type") == "PER":
                name = ent.get("text", "")
                # Try to resolve to person-registry ID
                for pid, preg in person_reg_map.items():
                    if name in preg.get("aliases", []) or name == preg.get("canonical", ""):
                        persons.add(pid)
                        break

    # Always add recipient
    recipient = letter.get("recipient", "")
    if recipient == "Mor og far":
        persons.add("far")
        persons.add("mor")
    elif recipient in RECIPIENT_MAP and RECIPIENT_MAP[recipient]:
        persons.add(RECIPIENT_MAP[recipient])

    return persons


def score_image(image, letter_place_ids, letter_persons, letter_date, recipient_ids):
    """Score an image's relevance to a letter. Returns (score, relevance, reason_da)."""
    img_places = set(image.get("places", []))
    img_persons = set(image.get("persons", []))
    img_date = parse_date(image.get("date_sort", ""))
    category = image.get("category", "")

    place_match = bool(letter_place_ids & img_places)
    person_match = bool(letter_persons & img_persons)
    recipient_match = bool(recipient_ids & img_persons)
    date_bonus = date_proximity_bonus(letter_date, img_date)

    # Base scores by match type
    score = 0.0
    relevance = "context"

    if place_match and (person_match or recipient_match):
        score = 0.8 + date_bonus
        relevance = "place+person"
    elif place_match:
        score = 0.7 + date_bonus
        if category == "place":
            score += 0.1
        relevance = "place"
    elif recipient_match:
        # Recipient photos — always relevant
        score = 0.5 + date_bonus
        relevance = "recipient"
    elif person_match:
        score = 0.4 + date_bonus
        relevance = "person"
    elif date_bonus >= 0.2:
        score = 0.1 + date_bonus
        relevance = "date"

    # Category adjustments
    if category == "portrait" and not person_match and not recipient_match:
        score = 0.0  # Portraits only matter if the person is relevant
    elif category == "map":
        if place_match:
            score = min(score, 0.5)  # Maps cap lower
        elif not place_match:
            score = 0.0  # Maps without place match are irrelevant
    elif category == "historical":
        score = min(score, 0.3)
    elif category == "document":
        if not place_match and not person_match:
            score = 0.0

    # Peter downweight: he's in 78 photos, so matching him alone isn't very discriminating
    if person_match and not place_match and not recipient_match:
        matching_persons = letter_persons & img_persons
        if matching_persons == {"peter"}:
            score *= 0.1

    # Floor
    if score < MIN_SCORE:
        score = 0.0

    reason_da = REASON_DA.get(relevance, "")
    return round(score, 3), relevance, reason_da


def build_letter_images():
    images = json.load(open(IMAGE_REG, encoding="utf-8"))
    letters = json.load(open(LETTERS, encoding="utf-8"))
    entities_list = json.load(open(ENTITIES, encoding="utf-8"))
    persons = json.load(open(PERSON_REG, encoding="utf-8"))
    place_lookup = json.load(open(PLACE_LOOKUP, encoding="utf-8"))

    person_map = {p["id"]: p for p in persons}
    entities_map = {}
    for ent in entities_list:
        eid = ent.get("letter_id", ent.get("id"))
        if eid is not None:
            entities_map[eid] = ent

    # Load manual overrides if they exist
    overrides = {}
    if OVERRIDES.exists():
        overrides = json.load(open(OVERRIDES, encoding="utf-8"))

    result = []
    total_associations = 0
    letters_with_images = 0

    for letter in letters:
        letter_id = letter["id"]
        letter_date = parse_date(letter.get("date", ""))
        letter_place = letter.get("place", "")

        # Resolve letter place to manifest place IDs
        letter_place_ids = set()
        if letter_place and letter_place in place_lookup:
            letter_place_ids.add(place_lookup[letter_place])

        # Resolve letter persons
        letter_persons = resolve_letter_persons(letter, entities_map, person_map)

        # Determine recipient person IDs for recipient-match scoring
        recipient = letter.get("recipient", "")
        recipient_ids = set()
        if recipient == "Mor og far":
            recipient_ids = {"far", "mor"}
        elif recipient in RECIPIENT_MAP and RECIPIENT_MAP[recipient]:
            recipient_ids.add(RECIPIENT_MAP[recipient])

        # Score all images
        candidates = []
        for img in images:
            score, relevance, reason_da = score_image(
                img, letter_place_ids, letter_persons, letter_date, recipient_ids
            )
            if score > 0:
                candidates.append({
                    "image_id": img["id"],
                    "relevance": relevance,
                    "score": score,
                    "reason_da": reason_da,
                })

        # Apply manual overrides
        letter_overrides = overrides.get(str(letter_id), [])
        for ov in letter_overrides:
            ov["relevance"] = "manual"
            ov["reason_da"] = REASON_DA["manual"]
            candidates.append(ov)

        # Sort by score descending
        candidates.sort(key=lambda x: -x["score"])

        # Apply limits
        map_count = 0
        hist_count = 0
        recipient_count = 0
        filtered = []
        for c in candidates:
            # Look up category from image registry
            img_entry = next((i for i in images if i["id"] == c["image_id"]), None)
            cat = img_entry["category"] if img_entry else ""

            if c["relevance"] == "recipient":
                if recipient_count >= MAX_RECIPIENT:
                    continue
                recipient_count += 1
            elif cat == "map":
                if map_count >= MAX_MAPS:
                    continue
                map_count += 1
            elif cat == "historical":
                if hist_count >= MAX_HISTORICAL:
                    continue
                hist_count += 1

            filtered.append(c)
            if len(filtered) >= MAX_PER_LETTER:
                break

        if filtered:
            result.append({
                "letter_id": letter_id,
                "images": filtered,
            })
            total_associations += len(filtered)
            letters_with_images += 1

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"Built letter-image associations:")
    print(f"  Letters with images: {letters_with_images}/{len(letters)}")
    print(f"  Total associations: {total_associations}")
    print(f"  Avg images/letter: {total_associations/max(letters_with_images,1):.1f}")
    print(f"Output: {OUTPUT}")


def show_stats():
    data = json.load(open(OUTPUT, encoding="utf-8"))
    print(f"Total letters with images: {len(data)}")

    all_relevances = Counter()
    all_scores = []
    img_usage = Counter()

    for entry in data:
        for img in entry["images"]:
            all_relevances[img["relevance"]] += 1
            all_scores.append(img["score"])
            img_usage[img["image_id"]] += 1

    print(f"\nRelevance breakdown:")
    for rel, count in all_relevances.most_common():
        print(f"  {rel:20s}: {count}")

    print(f"\nScore distribution:")
    brackets = [(0.2, 0.4), (0.4, 0.6), (0.6, 0.8), (0.8, 1.01)]
    for lo, hi in brackets:
        count = sum(1 for s in all_scores if lo <= s < hi)
        print(f"  {lo:.1f}-{hi:.1f}: {count}")

    print(f"\nMost-used images:")
    for img_id, count in img_usage.most_common(10):
        print(f"  {img_id:30s}: {count} letters")

    unused = set()
    images = json.load(open(IMAGE_REG, encoding="utf-8"))
    all_used = set(img_usage.keys())
    for img in images:
        if img["id"] not in all_used:
            unused.add(img["id"])
    print(f"\nUnused images: {len(unused)}/{len(images)}")


def show_sample(letter_id):
    data = json.load(open(OUTPUT, encoding="utf-8"))
    images = json.load(open(IMAGE_REG, encoding="utf-8"))
    img_map = {i["id"]: i for i in images}

    entry = next((e for e in data if e["letter_id"] == letter_id), None)
    if not entry:
        print(f"No images for letter {letter_id}")
        return

    letters = json.load(open(LETTERS, encoding="utf-8"))
    letter = next((l for l in letters if l["id"] == letter_id), None)

    print(f"Letter {letter_id}: {letter.get('date', '?')} | {letter.get('place', '?')} | to: {letter.get('recipient', '?')}")
    print(f"Images ({len(entry['images'])}):")
    for img_ref in entry["images"]:
        img = img_map.get(img_ref["image_id"], {})
        print(f"  {img_ref['score']:.2f} [{img_ref['relevance']:15s}] {img.get('category','?'):10s} {img_ref['image_id']:30s} | {img.get('description','')[:60]}")
        print(f"       {img_ref['reason_da']}")


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--stats" in args:
        show_stats()
    elif "--sample" in args:
        idx = args.index("--sample")
        lid = int(args[idx + 1])
        show_sample(lid)
    else:
        build_letter_images()
