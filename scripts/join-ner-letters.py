"""
ADR-016 Task A1: Join NER entities to letter IDs.

Reads NER_entities.csv and sentences.csv, maps sentence_id -> letter_id,
and produces data/letter-entities-draft.json grouped by letter.
"""

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def main():
    # Load data
    ner = pd.read_csv(DATA / "NER_entities.csv", index_col=0)
    sentences = pd.read_csv(DATA / "sentences.csv")

    # Build sentence_id -> letter_id lookup
    sent_to_letter = sentences.set_index("id")["letter_id"].to_dict()

    # Map each NER row to its letter_id
    ner["letter_id"] = ner["sentence_id"].map(sent_to_letter)

    # Drop rows where mapping failed (shouldn't happen, but be safe)
    unmapped = ner["letter_id"].isna().sum()
    if unmapped > 0:
        print(f"WARNING: {unmapped} entities could not be mapped to a letter.")
    ner = ner.dropna(subset=["letter_id"])
    ner["letter_id"] = ner["letter_id"].astype(int)

    # Build per-letter output
    result = {}
    for letter_id, group in ner.groupby("letter_id"):
        lid = str(letter_id)
        persons = sorted(group.loc[group["type"] == "PER", "text"].unique().tolist())
        locations = sorted(group.loc[group["type"] == "LOC", "text"].unique().tolist())
        organizations = sorted(group.loc[group["type"] == "ORG", "text"].unique().tolist())
        all_entities = [
            {"text": row["text"], "type": row["type"]}
            for _, row in group[["text", "type"]].drop_duplicates().iterrows()
        ]
        result[lid] = {
            "persons": persons,
            "locations": locations,
            "organizations": organizations,
            "all_entities": all_entities,
        }

    # Write output
    out_path = DATA / "letter-entities-draft.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    # Report statistics
    letters_with_entities = len(result)
    total_per = sum(len(v["persons"]) for v in result.values())
    avg_per = total_per / letters_with_entities if letters_with_entities else 0
    total_entities = sum(len(v["all_entities"]) for v in result.values())

    print(f"Output written to {out_path}")
    print(f"Letters with entity data: {letters_with_entities}")
    print(f"Total unique PER mentions across all letters: {total_per}")
    print(f"Average unique PER entities per letter: {avg_per:.2f}")
    print(f"Total unique entity mentions (all types): {total_entities}")


if __name__ == "__main__":
    main()
