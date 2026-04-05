"""Enrich person-registry.json with biographical data extracted from the PDF presentation.

Usage:
    python scripts/enrich-persons-from-pdf.py           # Preview changes
    python scripts/enrich-persons-from-pdf.py --apply    # Apply changes

Source: docs/background/Powerpoint_presentation_about_letters.pdf
Created by Peter's daughter Else Gad Mærsk.
"""

import json
import sys
from pathlib import Path
from copy import deepcopy

REGISTRY_PATH = Path("data/person-registry.json")
ENRICHMENTS_PATH = Path("data/person-enrichments-pdf.json")
SOURCE = "Else Gad Mærsk presentation (docs/background/Powerpoint_presentation_about_letters.pdf)"

# Enrichments derived from visual inspection of the PDF slides.
# New fields: full_name, birth_date, death_date, biographical, photos
# Updated fields: role, category, aliases (additions only)
ENRICHMENTS = {
    "peter": {
        "full_name": "Peter Mærsk",
        "birth_date": "1892-04-27",
        "death_date": "1976-07-25",
        "biographical": (
            "Only child (enebarn) of Jes and Maren Mærsk. Grew up at Øster Aabølling farm. "
            "Schools: Vester Vedsted Efterskole, Ryslinge Højskole, Vallekilde Højskole (Nov 1912–May 1913). "
            "Conscripted Oct 1913; hoped for Altona but sent to Løtzen (East Prussia) because his father "
            "was active in the Danish cause. Musketier, 12. Komp. 2. Masurisches Inf.-Regt. 147. "
            "Served as Ordonans (orderly). Stationed Løtzen, then Arys, then Eastern Front (Poland, Russia), "
            "transferred to Western Front (France) Dec 1916. Survived the war. "
            "Deserted during last leave (Sep 1918), crossed border to Denmark. "
            "Settled at Bækgaarden on Fyn after the war."
        ),
        "add_aliases": ["Musketier Märsk", "Peter M"],
        "photos": [
            "page001_02.png", "page009_02.png", "page024_02.png", "page024_03.png",
            "page024_04.png", "page034_02.png", "page036_02.png", "page039_03.png",
            "page045_02.png", "page079_02.png", "page097_02.png", "page117_02.png",
            "page197_02.png", "page270_02.png"
        ],
    },
    "trine": {
        "full_name": "Trine Kjems Gad",
        "birth_date": "1895-05-02",
        "death_date": "1984-07-31",
        "biographical": (
            "Daughter of Peter Andreas P. Gad and Ane Elisabeth Gad. Had 7 siblings "
            "(3 brothers, 3 sisters, 2 died young). Grew up at Ravnholt. "
            "Was only 16 when the first love letters from Peter began (spring 1911). "
            "After school, stayed home at Ravnholt caring for her sick mother (who died shortly after). "
            "Attended Vallekilde Højskole for 3 months in 1914. "
            "Married Peter Mærsk (date from letters: engagement revealed to parents 1 Aug 1914). "
            "First child Musse born 1 Dec 1917. Settled at Bækgaarden on Fyn after the war."
        ),
        "add_aliases": ["Trine Kjems Gad", "Trine Kjems"],
        "photos": [
            "page009_03.png", "page025_02.png", "page030_02.png",
            "page045_02.png", "page134_02.png"
        ],
    },
    "far": {
        "full_name": "Jes Mærsk",
        "birth_date": "1863-12-09",
        "biographical": (
            "German citizen. German soldier 1884–87. Married Maren 1890. "
            "Bought the farm at Øster Aabølling in 1897 (snatching it from German buyers). "
            "Formand (chairman) for the local forsamlingshus (assembly house). "
            "Active in the fight for Danish identity against Germanization. "
            "Had a German pastor (Schmidt, Vodder) as neighbour who was MF for Det Tyske Mindretal. "
            "His political activism caused Peter to be sent to distant Løtzen rather than nearby Altona for military service."
        ),
        "add_aliases": ["Jes", "Jes Mærsk"],
        "photos": ["page010_02.png", "page010_03.png", "page015_02.png"],
    },
    "mor": {
        "full_name": "Maren Mærsk",
        "biographical": (
            "Married Jes Mærsk 1890. Mother of Peter (only child). "
            "Lived at Øster Aabølling farm."
        ),
        "photos": ["page010_02.png"],
    },
    "uffe": {
        "full_name": "Uffe Gad",
        "role": "Trine's brother, Peter's svoger (brother-in-law)",
        "category": "family",
        "biographical": (
            "Brother of Trine. Visible in the Gad family photo from 1904. "
            "Also served in the German army during WW1. Met Peter at the Western Front "
            "(Grandlup La Neuville, 1918). His father Peter Andreas Gad was an optant (Danish citizen)."
        ),
        "add_aliases": ["Uffe Gad"],
        "photos": ["page014_04.png", "page227_02.png"],
    },
    "signe": {
        "full_name": "Signe Gad",
        "role": "Trine's sister",
        "biographical": (
            "Sister of Trine. Visible in the photo of Ravnholt (Trine's family home) "
            "alongside Trine."
        ),
        "add_aliases": ["Signe Gad"],
        "photos": ["page020_02.png"],
    },
    "major_beerbohm": {
        "full_name": "Hans Beerbohm",
        "death_date": "1918-03-23",
        "biographical": (
            "Peter's commanding officer at Regimentsstaben (Reg. Stab). "
            "Fell on 23 March 1918. His funeral was carried out by his 8 Meldere (orderlies) "
            "from the Stab, including Peter. Referred to as 'den gamle' (the old one) by Peter."
        ),
        "add_aliases": ["Hans Beerbohm", "den gamle", "Majoren"],
        "photos": ["page236_02.png", "page238_02.png"],
    },
    "becker": {
        "full_name": "Hauptmann Becker",
        "role": "Peter's commanding officer at Løtzen, 1913-1914",
        "category": "military",
        "biographical": (
            "Hauptmann (captain) at Løtzen. Peter's address was 'Hauptm. Becker, Løtzen, Ostpreussen'. "
            "Peter needed to write to him to request leave (Udlov)."
        ),
        "add_aliases": ["Hauptmann Becker", "Hauptm. Becker"],
    },
    "henningsen": {
        "full_name": "Walter Henningsen",
        "biographical": (
            "Served alongside Peter at the Western Front. Appears in the first snow photo "
            "(20 Dec 1917) together with Konow and Peter, and in another group photo "
            "('Vilh. J., Emil B. Walter H, Peter'). Note: the separate 'walter' registry entry "
            "(8 mentions, 1917-1918) likely refers to the same person by first name."
        ),
        "add_aliases": ["Walter H"],
        "photos": ["page224_02.png", "page228_02.png"],
    },
    "walter": {
        "biographical": (
            "Likely identical to Walter Henningsen (id: henningsen). "
            "Referred to by first name in letters from Oct 1917 onward."
        ),
        "possible_duplicate_of": "henningsen",
    },
    "konow": {
        "full_name": "Wilhelm Konow",
        "biographical": (
            "Served alongside Peter. Appears in group photos from the Western Front. "
            "Visible in the first snow photo (20 Dec 1917) with Walter Henningsen and Peter."
        ),
        "photos": ["page079_02.png", "page224_02.png"],
    },
    "musse": {
        "full_name": "Musse Mærsk",
        "role": "Peter and Trine's first child (daughter)",
        "biographical": (
            "Born 1 December 1917. Peter was writing a letter when news of the birth arrived. "
            "Peter wrote: 'vi håber med Guds hjælp at alt er klaret'. "
            "Named in letters as 'Musse' and 'min lille Musse'."
        ),
    },
}

# New person to add (not in current registry)
NEW_PERSONS = [
    {
        "id": "peter_andreas_gad",
        "canonical": "Peter Andreas Gad",
        "aliases": ["Peter Andreas Gad", "Peter Andreas P. Gad", "P. A. Gad"],
        "full_name": "Peter Andreas P. Gad",
        "role": "Trine's father",
        "category": "family",
        "letter_count": 0,
        "first_mention": None,
        "last_mention": None,
        "birth_date": "1849-12-28",
        "death_date": "1931-01-28",
        "biographical": (
            "Optant (chose Danish citizenship) 1869 after attending Askov Højskole. "
            "Danish soldier in Fredericia 1871 (6 months). Landvæsenselev on Amager. "
            "Attended Tune Landbrugsskole. Married outside Folkekirken by pastor Poulsen "
            "in 'Gundesens storstue'. Lived at Ravnholt. Father of 8 children "
            "(3 boys, 3 girls, 2 died). Lived under constant threat of 24-hour deportation "
            "as an optant. In 1907 all optant children were naturalized (German citizenship) "
            "for 50/10 Mark — 7 years later the war came and all their sons had to serve."
        ),
        "photos": ["page018_02.png", "page014_04.png"],
        "source": SOURCE,
    },
    {
        "id": "ane_elisabeth_gad",
        "canonical": "Ane Elisabeth Gad",
        "aliases": ["Ane Elisabeth", "Ane Elisabeth Gad"],
        "full_name": "Ane Elisabeth Gad",
        "role": "Trine's mother",
        "category": "family",
        "letter_count": 0,
        "first_mention": None,
        "last_mention": None,
        "biographical": (
            "Mother of Trine, Uffe, Signe, and 5 other children. "
            "Was 'ret svagelig' (quite frail) — Trine stayed home to care for her. "
            "Died shortly after Trine finished school (before 1914). "
            "Visible in the 1904 Gad family photo."
        ),
        "photos": ["page014_04.png"],
        "source": SOURCE,
    },
    {
        "id": "else_gad_maersk",
        "canonical": "Else Gad Mærsk",
        "aliases": ["Else Gad Mærsk", "Else"],
        "full_name": "Else Gad Mærsk",
        "role": "Peter and Trine's daughter, transcriber of the letters",
        "category": "family",
        "letter_count": 0,
        "first_mention": None,
        "last_mention": None,
        "biographical": (
            "Daughter of Peter and Trine Mærsk. Transcribed all 900 letters. "
            "Created the presentation 'Hjertet under jernkorset — En sønderjyde i kejserens tjeneste' "
            "documenting her father's life and the letter collection."
        ),
        "source": SOURCE,
    },
]


def preview_changes():
    registry = json.load(open(REGISTRY_PATH, encoding="utf-8"))
    registry_map = {p["id"]: p for p in registry}

    print("=" * 60)
    print("ENRICHMENT PREVIEW")
    print("=" * 60)

    for pid, enrich in ENRICHMENTS.items():
        if pid not in registry_map:
            print(f"\n[WARN] {pid} not found in registry!")
            continue

        person = registry_map[pid]
        print(f"\n--- {pid} ({person['canonical']}) ---")

        for key, value in enrich.items():
            if key == "add_aliases":
                existing = set(person.get("aliases", []))
                new = [a for a in value if a not in existing]
                if new:
                    print(f"  aliases: +{new}")
            elif key == "photos":
                print(f"  photos: {len(value)} photo references")
            elif key in person:
                old = person[key]
                if old != value:
                    old_preview = str(old)[:60]
                    new_preview = str(value)[:60]
                    print(f"  {key}: '{old_preview}' -> '{new_preview}'")
            else:
                preview = str(value)[:80]
                print(f"  {key}: (new) '{preview}'")

    print(f"\n--- NEW PERSONS ---")
    for new_p in NEW_PERSONS:
        existing = registry_map.get(new_p["id"])
        if existing:
            print(f"  {new_p['id']}: already exists, will merge")
        else:
            print(f"  {new_p['id']}: {new_p['canonical']} — {new_p['role']}")

    print(f"\nRun with --apply to write changes.")


def apply_changes():
    registry = json.load(open(REGISTRY_PATH, encoding="utf-8"))
    registry_map = {p["id"]: p for p in registry}

    changes = []

    # Apply enrichments to existing persons
    for pid, enrich in ENRICHMENTS.items():
        if pid not in registry_map:
            print(f"[WARN] {pid} not found, skipping")
            continue

        person = registry_map[pid]
        person_changes = []

        for key, value in enrich.items():
            if key == "add_aliases":
                existing = set(person.get("aliases", []))
                new_aliases = [a for a in value if a not in existing]
                if new_aliases:
                    person["aliases"].extend(new_aliases)
                    person_changes.append(f"aliases: +{new_aliases}")
            else:
                old = person.get(key)
                person[key] = value
                if old and old != value:
                    person_changes.append(f"{key}: updated")
                elif not old:
                    person_changes.append(f"{key}: added")

        person["enrichment_source"] = SOURCE
        if person_changes:
            changes.append(f"{pid}: {', '.join(person_changes)}")
            print(f"  Updated {pid}: {', '.join(person_changes)}")

    # Add new persons
    for new_p in NEW_PERSONS:
        if new_p["id"] in registry_map:
            # Merge into existing
            existing = registry_map[new_p["id"]]
            for key, value in new_p.items():
                if key == "aliases":
                    existing_aliases = set(existing.get("aliases", []))
                    for a in value:
                        if a not in existing_aliases:
                            existing.setdefault("aliases", []).append(a)
                elif key == "id":
                    continue
                else:
                    existing[key] = value
            existing["enrichment_source"] = SOURCE
            changes.append(f"{new_p['id']}: merged new data")
            print(f"  Merged {new_p['id']}")
        else:
            registry.append(new_p)
            changes.append(f"{new_p['id']}: added new person")
            print(f"  Added {new_p['id']}: {new_p['canonical']}")

    # Save enriched registry
    with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)

    # Save enrichments log
    with open(ENRICHMENTS_PATH, "w", encoding="utf-8") as f:
        json.dump({
            "source": SOURCE,
            "changes": changes,
            "enrichments": ENRICHMENTS,
            "new_persons": [p["id"] for p in NEW_PERSONS],
        }, f, indent=2, ensure_ascii=False)

    print(f"\nApplied {len(changes)} changes to {REGISTRY_PATH}")
    print(f"Enrichment log saved to {ENRICHMENTS_PATH}")
    print(f"Total persons in registry: {len(registry)}")


if __name__ == "__main__":
    if "--apply" in sys.argv:
        apply_changes()
    else:
        preview_changes()
