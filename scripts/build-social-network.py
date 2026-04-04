"""
ADR-016 Task C1+C2: Build social network graph from person registry
and letter-entity mapping, compute network metrics, output data/social-network.json.
"""

import csv
import json
from collections import defaultdict
from datetime import date
from itertools import combinations
from pathlib import Path

import networkx as nx

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def load_person_registry():
    with open(DATA / "person-registry.json", encoding="utf-8") as f:
        return json.load(f)


def load_letter_entities():
    with open(DATA / "letter-entities-draft.json", encoding="utf-8") as f:
        return json.load(f)


def load_letters_csv():
    """Return dict mapping letter id (str) -> {'date': ..., ...}."""
    letters = {}
    with open(DATA / "letters.csv", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            letters[str(row["id"])] = row
    return letters


def build_alias_lookup(registry):
    """Build a mapping from lowercase alias -> person id."""
    lookup = {}
    for person in registry:
        for alias in person["aliases"]:
            key = alias.lower()
            # Longer aliases take priority (more specific match)
            if key not in lookup or len(alias) > len(lookup[key][1]):
                lookup[key] = (person["id"], alias)
    # Return just id mapping
    return {k: v[0] for k, v in lookup.items()}


def resolve_persons_in_letter(person_names, alias_lookup):
    """Given a list of person name strings from a letter, resolve to registry ids."""
    resolved = set()
    for name in person_names:
        key = name.lower()
        if key in alias_lookup:
            resolved.add(alias_lookup[key])
    return resolved


def build_network(registry, letter_entities, letters_csv):
    """Build the co-mention network and temporal slices."""
    alias_lookup = build_alias_lookup(registry)
    registry_by_id = {p["id"]: p for p in registry}

    # Per-letter: resolved person ids
    letter_persons = {}  # letter_id -> set of person ids
    letter_year = {}     # letter_id -> year (int)

    for lid, entities in letter_entities.items():
        persons = resolve_persons_in_letter(entities.get("persons", []), alias_lookup)
        letter_persons[lid] = persons

        # Get year from CSV
        if lid in letters_csv and letters_csv[lid]["date"]:
            try:
                letter_year[lid] = int(letters_csv[lid]["date"][:4])
            except (ValueError, IndexError):
                pass

    # Build edge weights: (person_a, person_b) -> {total_weight, years set}
    edge_data = defaultdict(lambda: {"weight": 0, "years": set(), "letters": []})
    peter_trine_raw_weight = 0

    for lid, persons in letter_persons.items():
        year = letter_year.get(lid)
        # Generate all pairs
        for a, b in combinations(sorted(persons), 2):
            pair = (a, b)
            # Track peter-trine separately
            if pair == ("peter", "trine"):
                peter_trine_raw_weight += 1
                continue
            edge_data[pair]["weight"] += 1
            if year:
                edge_data[pair]["years"].add(year)
            edge_data[pair]["letters"].append(lid)

    # Filter edges with weight >= 2
    MIN_WEIGHT = 2
    filtered_edges = {
        pair: data for pair, data in edge_data.items()
        if data["weight"] >= MIN_WEIGHT
    }

    # Track per-person active years
    person_years = defaultdict(set)
    for lid, persons in letter_persons.items():
        year = letter_year.get(lid)
        if year:
            for pid in persons:
                person_years[pid].add(year)

    # Build NetworkX graph
    G = nx.Graph()
    for person in registry:
        G.add_node(person["id"])

    for (a, b), data in filtered_edges.items():
        G.add_edge(a, b, weight=data["weight"], years=sorted(data["years"]))

    # Compute metrics
    degree_cent = nx.degree_centrality(G)
    betweenness_cent = nx.betweenness_centrality(G, weight="weight")
    pagerank = nx.pagerank(G, weight="weight")

    # Build nodes output
    nodes = []
    for person in registry:
        pid = person["id"]
        years_active = sorted(person_years.get(pid, []))
        node = {
            "id": pid,
            "canonical": person["canonical"],
            "category": person["category"],
            "role": person["role"],
            "letter_count": person["letter_count"],
            "first_mention": person["first_mention"],
            "last_mention": person["last_mention"],
            "degree_centrality": round(degree_cent.get(pid, 0), 6),
            "betweenness_centrality": round(betweenness_cent.get(pid, 0), 6),
            "pagerank": round(pagerank.get(pid, 0), 6),
            "temporal_persistence": len(years_active),
            "years_active": years_active,
        }
        nodes.append(node)

    # Build edges output
    edges = []
    for (a, b), data in sorted(filtered_edges.items(), key=lambda x: -x[1]["weight"]):
        edges.append({
            "source": a,
            "target": b,
            "weight": data["weight"],
            "years": sorted(data["years"]),
        })

    # Temporal slices
    all_years = sorted(set(letter_year.values()))
    temporal_slices = {}
    first_seen = {}  # person_id -> first year

    for pid, years in person_years.items():
        if years:
            first_seen[pid] = min(years)

    for year in all_years:
        # Letters in this year
        year_letters = [lid for lid, y in letter_year.items() if y == year]
        # Active persons this year
        active_persons = set()
        for lid in year_letters:
            active_persons.update(letter_persons.get(lid, set()))

        # Active edges this year (co-mentions in this year's letters only)
        year_edge_data = defaultdict(int)
        for lid in year_letters:
            persons = letter_persons.get(lid, set())
            for a, b in combinations(sorted(persons), 2):
                if (a, b) == ("peter", "trine"):
                    continue
                year_edge_data[(a, b)] += 1

        # Filter edges with weight >= 2 for this year too? No — show all for the year slice.
        # But use the global filter for consistency: only edges that pass global threshold
        year_edges = {
            pair: w for pair, w in year_edge_data.items()
            if pair in filtered_edges
        }

        # Build year subgraph for density
        Gy = nx.Graph()
        for pid in active_persons:
            Gy.add_node(pid)
        for (a, b), w in year_edges.items():
            Gy.add_edge(a, b, weight=w)

        new_nodes = sorted([pid for pid in active_persons if first_seen.get(pid) == year])

        n_nodes = len(active_persons)
        n_edges = Gy.number_of_edges()
        density = nx.density(Gy) if n_nodes > 1 else 0.0

        temporal_slices[str(year)] = {
            "density": round(density, 6),
            "num_nodes": n_nodes,
            "num_edges": n_edges,
            "new_nodes": new_nodes,
        }

    # Global metrics
    total_nodes = G.number_of_nodes()
    total_edges = G.number_of_edges()
    degrees = [d for _, d in G.degree()]
    avg_degree = sum(degrees) / len(degrees) if degrees else 0
    components = nx.number_connected_components(G)
    density = nx.density(G)

    output = {
        "metadata": {
            "generated": date.today().isoformat(),
            "source": "ADR-016",
            "total_letters": len(letters_csv),
            "letters_with_entities": len(letter_entities),
            "peter_trine_edge_excluded": True,
            "peter_trine_raw_weight": peter_trine_raw_weight,
            "min_edge_weight": MIN_WEIGHT,
        },
        "nodes": nodes,
        "edges": edges,
        "temporal_slices": temporal_slices,
        "global_metrics": {
            "total_nodes": total_nodes,
            "total_edges": total_edges,
            "average_degree": round(avg_degree, 4),
            "connected_components": components,
            "density": round(density, 6),
        },
    }

    return output, G, pagerank, betweenness_cent, degree_cent, temporal_slices


def print_summary(output, G, pagerank, betweenness, degree, temporal_slices):
    gm = output["global_metrics"]
    md = output["metadata"]

    print("=" * 60)
    print("ADR-016 Social Network — Summary")
    print("=" * 60)
    print(f"Total letters processed: {md['total_letters']}")
    print(f"Letters with entity data: {md['letters_with_entities']}")
    print(f"Peter-Trine raw co-occurrence: {md['peter_trine_raw_weight']} (excluded)")
    print(f"Min edge weight threshold: {md['min_edge_weight']}")
    print()
    print(f"Nodes: {gm['total_nodes']}")
    print(f"Edges: {gm['total_edges']}")
    print(f"Average degree: {gm['average_degree']}")
    print(f"Connected components: {gm['connected_components']}")
    print(f"Density: {gm['density']}")
    print()

    # Top 5 by PageRank
    print("Top 5 by PageRank:")
    top_pr = sorted(pagerank.items(), key=lambda x: -x[1])[:5]
    for pid, val in top_pr:
        node = next(n for n in output["nodes"] if n["id"] == pid)
        print(f"  {node['canonical']:20s}  PR={val:.6f}  cat={node['category']}")

    print()
    print("Top 5 by Betweenness Centrality:")
    top_bc = sorted(betweenness.items(), key=lambda x: -x[1])[:5]
    for pid, val in top_bc:
        node = next(n for n in output["nodes"] if n["id"] == pid)
        print(f"  {node['canonical']:20s}  BC={val:.6f}  cat={node['category']}")

    print()
    print("Top 5 by Degree Centrality:")
    top_dc = sorted(degree.items(), key=lambda x: -x[1])[:5]
    for pid, val in top_dc:
        node = next(n for n in output["nodes"] if n["id"] == pid)
        print(f"  {node['canonical']:20s}  DC={val:.6f}  cat={node['category']}")

    print()
    print("Network over time:")
    print(f"  {'Year':>6s}  {'Nodes':>5s}  {'Edges':>5s}  {'Density':>8s}  {'New persons':>11s}")
    for year_str in sorted(temporal_slices.keys()):
        ts = temporal_slices[year_str]
        print(
            f"  {year_str:>6s}  {ts['num_nodes']:5d}  {ts['num_edges']:5d}  "
            f"{ts['density']:8.4f}  {len(ts['new_nodes']):5d}"
        )
    print()


def main():
    registry = load_person_registry()
    letter_entities = load_letter_entities()
    letters_csv = load_letters_csv()

    output, G, pagerank, betweenness, degree, temporal_slices = build_network(
        registry, letter_entities, letters_csv
    )

    # Write output
    out_path = DATA / "social-network.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"Written: {out_path}")
    print()

    print_summary(output, G, pagerank, betweenness, degree, temporal_slices)


if __name__ == "__main__":
    main()
