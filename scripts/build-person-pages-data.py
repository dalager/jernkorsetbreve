"""
build-person-pages-data.py

Pre-computes data for person detail pages (ADR-048).

Reads:
  data/person-registry.json   — 68 persons
  data/image-registry.json    — 164 images
  data/letter-entities.json   — 665 letter entity entries
  data/corrected-letters.json — 665 corrected letters

Writes:
  data/person-pages.json
  apps/website/public/data/person-pages.json  (copy)

Qualification: letter_count >= 3 OR biographical field present.
"""

import json
import re
import shutil
from collections import defaultdict
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).parent.parent
DATA = ROOT / "data"
FRONTEND_DATA = ROOT / "apps" / "website" / "public" / "data"

PERSON_REGISTRY = DATA / "person-registry.json"
IMAGE_REGISTRY = DATA / "image-registry.json"
LETTER_ENTITIES = DATA / "letter-entities.json"
CORRECTED_LETTERS = DATA / "corrected-letters.json"
OUTPUT = DATA / "person-pages.json"
OUTPUT_FRONTEND = FRONTEND_DATA / "person-pages.json"

# ---------------------------------------------------------------------------
# Sender / recipient → person ID mapping
# ---------------------------------------------------------------------------
SENDER_MAP = {
    "Peter Mærsk": ["peter"],
}

RECIPIENT_MAP = {
    "Trine Mærsk": ["trine"],
    "Mor og far": ["far", "mor"],
    "Peter Mærsk": ["peter"],
    "Maren Mærsk": ["mor"],
}


def strip_html(text: str) -> str:
    """Remove HTML tags and return plain text."""
    return re.sub(r"<[^>]+>", "", text or "")


def excerpt(text: str, length: int = 100) -> str:
    """Return first `length` chars of plain text, stripped of HTML."""
    plain = strip_html(text).strip()
    return plain[:length]


# ---------------------------------------------------------------------------
# Load data
# ---------------------------------------------------------------------------
print("Loading data files...")

with open(PERSON_REGISTRY, encoding="utf-8") as f:
    all_persons = json.load(f)

with open(IMAGE_REGISTRY, encoding="utf-8") as f:
    all_images = json.load(f)

with open(LETTER_ENTITIES, encoding="utf-8") as f:
    all_entities = json.load(f)

with open(CORRECTED_LETTERS, encoding="utf-8") as f:
    all_letters = json.load(f)

# ---------------------------------------------------------------------------
# Index helpers
# ---------------------------------------------------------------------------

# letter_id → letter object
letter_by_id: dict = {str(l["id"]): l for l in all_letters}

# person id → person object
person_by_id: dict = {p["id"]: p for p in all_persons}

# Build alias → [person_id] lookup for entity matching
# An alias must be matched case-insensitively and exactly as a whole token
alias_to_persons: dict[str, list[str]] = defaultdict(list)
for person in all_persons:
    for alias in person.get("aliases", []):
        alias_to_persons[alias.lower()].append(person["id"])

# image_id → image object
image_by_id: dict = {img["id"]: img for img in all_images}

# person_id → [image objects] sorted by date_sort
images_by_person: dict[str, list] = defaultdict(list)
for img in all_images:
    for pid in img.get("persons", []):
        images_by_person[pid].append(img)

for pid in images_by_person:
    images_by_person[pid].sort(key=lambda i: i.get("date_sort") or "")

# ---------------------------------------------------------------------------
# Qualification filter
# ---------------------------------------------------------------------------
qualified_persons = [
    p for p in all_persons
    if p.get("letter_count", 0) >= 3 or p.get("biographical")
]

print(f"Qualified persons: {len(qualified_persons)} of {len(all_persons)}")

# ---------------------------------------------------------------------------
# For each letter, determine which person IDs appear
# (via sender/recipient mapping OR entity alias match)
# Returns a dict: letter_id → set of person_ids with their roles
# ---------------------------------------------------------------------------

def persons_in_letter(entity_entry: dict) -> dict[str, str]:
    """
    Returns {person_id: role} for all persons appearing in this letter entry.
    role is one of: 'sender', 'recipient', 'mentioned'
    Later roles take precedence in the order: sender > recipient > mentioned,
    but we keep all distinct roles per person. Here we track just the
    'primary' role for the letter list display (highest priority).
    """
    roles: dict[str, set] = defaultdict(set)

    sender = entity_entry.get("sender", "")
    recipient = entity_entry.get("recipient", "")

    # Sender mapping
    for mapped_sender, pids in SENDER_MAP.items():
        if sender == mapped_sender:
            for pid in pids:
                roles[pid].add("sender")

    # Recipient mapping
    for mapped_recipient, pids in RECIPIENT_MAP.items():
        if recipient == mapped_recipient:
            for pid in pids:
                roles[pid].add("recipient")

    # Entity (PER) alias matching
    for entity in entity_entry.get("entities", []):
        if entity.get("type") != "PER":
            continue
        text_lower = entity["text"].lower()
        for pid in alias_to_persons.get(text_lower, []):
            if pid not in roles:
                roles[pid].add("mentioned")

    # Collapse to single best role per person
    def best_role(role_set: set) -> str:
        if "sender" in role_set:
            return "sender"
        if "recipient" in role_set:
            return "recipient"
        return "mentioned"

    return {pid: best_role(r) for pid, r in roles.items()}


# Build: person_id → list of {letter_id, date, place, sender, recipient, role, excerpt}
print("Matching letters to persons...")

person_letters: dict[str, list] = defaultdict(list)

# We need letter text for excerpts — index by letter_id
for entity_entry in all_entities:
    lid = str(entity_entry["letter_id"])
    roles = persons_in_letter(entity_entry)

    letter_obj = letter_by_id.get(lid)
    if not letter_obj:
        continue

    letter_excerpt = excerpt(letter_obj.get("text_corrected", ""))
    letter_date = entity_entry.get("date") or letter_obj.get("date", "")
    letter_place = letter_obj.get("place", "")
    letter_sender = entity_entry.get("sender", "")
    letter_recipient = entity_entry.get("recipient", "")

    for pid, role in roles.items():
        person_letters[pid].append({
            "letter_id": entity_entry["letter_id"],
            "date": letter_date,
            "place": letter_place,
            "sender": letter_sender,
            "recipient": letter_recipient,
            "role": role,
            "excerpt": letter_excerpt,
        })

# Sort each person's letter list by date
for pid in person_letters:
    person_letters[pid].sort(key=lambda l: l["date"] or "")

# ---------------------------------------------------------------------------
# Connection logic: persons co-occurring in the same letter
# ---------------------------------------------------------------------------
print("Computing connections...")

# letter_id → set of person_ids in that letter
letter_persons: dict[str, set] = defaultdict(set)
for pid, letters in person_letters.items():
    for letter in letters:
        letter_persons[str(letter["letter_id"])].add(pid)

# Count co-occurrences
co_occurrences: dict[tuple, int] = defaultdict(int)
for lid, pids in letter_persons.items():
    pids_list = sorted(pids)
    for i, a in enumerate(pids_list):
        for b in pids_list[i + 1:]:
            co_occurrences[(a, b)] += 1

# Build per-person connection list: {other_pid: weight}
connections_by_person: dict[str, list] = defaultdict(list)
for (a, b), weight in co_occurrences.items():
    connections_by_person[a].append((b, weight))
    connections_by_person[b].append((a, weight))

# Sort by weight desc, keep top 10
for pid in connections_by_person:
    connections_by_person[pid].sort(key=lambda x: -x[1])
    connections_by_person[pid] = connections_by_person[pid][:10]

# ---------------------------------------------------------------------------
# Build output
# ---------------------------------------------------------------------------
print("Building person page objects...")

output = []
total_photos = 0
total_letter_refs = 0

for person in qualified_persons:
    pid = person["id"]

    # Photos from image-registry (not from person-registry photos field)
    photo_objs = []
    for img in images_by_person.get(pid, []):
        photo_objs.append({
            "image_id": img["id"],
            "path": img.get("path", ""),
            "description_da": img.get("description_da", ""),
            "description": img.get("description", ""),
            "date_estimate": img.get("date_estimate", ""),
            "category": img.get("category", ""),
        })

    total_photos += len(photo_objs)

    # Letters
    letters = person_letters.get(pid, [])
    total_letter_refs += len(letters)

    # Connections
    raw_connections = connections_by_person.get(pid, [])
    connections = []
    for other_pid, weight in raw_connections:
        other = person_by_id.get(other_pid)
        if not other:
            continue
        connections.append({
            "person_id": other_pid,
            "full_name": other.get("full_name") or other.get("canonical", other_pid),
            "weight": weight,
        })

    page = {
        "id": pid,
        "full_name": person.get("full_name") or person.get("canonical", pid),
        "canonical": person.get("canonical", ""),
        "role": person.get("role", ""),
        "category": person.get("category", ""),
    }

    # Optional biographical fields — only include if present
    if person.get("birth_date"):
        page["birth_date"] = person["birth_date"]
    if person.get("death_date"):
        page["death_date"] = person["death_date"]
    if person.get("biographical"):
        page["biographical"] = person["biographical"]

    page["photos"] = photo_objs
    page["letters"] = letters
    page["connections"] = connections
    page["letter_count"] = person.get("letter_count", 0)

    if person.get("first_mention"):
        page["first_mention"] = person["first_mention"]
    if person.get("last_mention"):
        page["last_mention"] = person["last_mention"]

    output.append(page)

# Sort output: primary persons first (letter_count desc), then alphabetically
output.sort(key=lambda p: (-p["letter_count"], p["full_name"]))

# ---------------------------------------------------------------------------
# Write output
# ---------------------------------------------------------------------------
print(f"Writing {OUTPUT} ...")
with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"Copying to {OUTPUT_FRONTEND} ...")
FRONTEND_DATA.mkdir(parents=True, exist_ok=True)
shutil.copy2(OUTPUT, OUTPUT_FRONTEND)

# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------
print()
print("=== Stats ===")
print(f"  Qualified persons:        {len(output)}")
print(f"  Total photos linked:      {total_photos}")
print(f"  Total letter references:  {total_letter_refs}")
print(f"  Output written to:        {OUTPUT}")
print(f"  Frontend copy:            {OUTPUT_FRONTEND}")
