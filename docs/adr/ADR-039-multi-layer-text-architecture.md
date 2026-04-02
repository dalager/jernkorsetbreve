# ADR-039: Multi-Layer Text Architecture for Editorial Corrections

## Status

Accepted (2026-04-02)

## Date

2026-04-02

## Context

The jernkorsetbreve pipeline currently operates with a two-layer text model introduced in ADR-014:

```
letters.json (HTML source)
  → 01_cleanup.ipynb → letters.csv (text_original: cleaned plaintext)
    → normalize-danish.mjs → normalized-letters.json (text_original + text_normalized)
```

This architecture conflates two distinct operations in the cleanup step:
1. **Mechanical cleaning** — stripping HTML, fixing encoding artifacts, normalizing whitespace
2. **Editorial correction** — fixing transcription errors introduced during manual typing or OCR

The current cleanup notebook (`01_cleanup.ipynb`) performs both: it strips HTML tags and `\xa0`/`\xad` artifacts (mechanical), but also replaces `cg` → `og` (editorial). The normalization script (`normalize-danish.mjs`) also mixes in OCR fixes (`jog` → `jeg`) alongside orthographic modernization.

This creates problems:

| Problem | Example | Consequence |
|---------|---------|-------------|
| **Uncorrected typing errors** reach downstream NLP | `Tak Tor sidst` (should be `for`) | Sentiment/NER misreads |
| **No provenance** for editorial changes | `cg` → `og` fix is buried in notebook code | Not auditable by scholars |
| **Corrections scattered** across notebook + script | `cg`→`og` in cleanup, `jog`→`jeg` in normalizer | No single place to review all editorial decisions |
| **No confidence tracking** | Can't distinguish certain fixes from judgment calls | Downstream consumers can't filter by reliability |

### Evidence: Quality Issues in the Corpus

Systematic analysis of the 665 letters reveals these surviving errors:

**Confirmed transcription errors (uncorrected):**

| Error | Intended | Letter | Context | Type |
|-------|----------|--------|---------|------|
| `Tor` | `for` | 4 | "Tak Tor sidst" | Typing error. Note: `Tor` also appears in L55 (part of compound `Tor-nysteren`), L196 and L569 (`Brandenburger Tor` — German for gate). Only the L4 occurrence is an error. |
| `dia` | `du` | 2 | "jeg tror nok dia kan komme" | Typing error |
| `st` | `at` | 4 | "ude st trække frisk Vejr" | Typing error |
| `korn` | `kom` | 5,6,29,34 | "da Uffe korn, hjalp det" | Typing error (4 occurrences) |
| `lier` | `her` | 3 | "den eneste lier i Huset" | Typing/OCR error |
| `vj` | `vi` | 6 | "saadan noget lader vj være" | Typing error |
| `love.e` | `lovede` | 6 | "jeg love.e det ogsaa" | OCR artifact |
| `taeklærnpt` | ? | 6 | "lidt taeklærnpt" | Garbled (possibly `tæklemt`) |

**Non-ASCII characters in source `letters.json`:**

*Legitimate multilingual content (preserve as-is):*

| Char | Unicode | Count | Context | Why legitimate |
|------|---------|-------|---------|----------------|
| `½` | U+00BD | 94 | "Kl. 1½", "med 2½ Toget" | Time and quantity references throughout the corpus |
| `ü` | U+00FC | 48 | "Mütze", "Für", "Grüsse", "Mühlhausen" | German words — Peter served in the Prussian army and wrote German phrases, place names, and military terms. Also his surname was spelled "Märsk" in German contexts (Gefr. Märsk) |
| `ä` | U+00E4 | 35 | "Gefr. Märsk", "Felddienstunfähig", "Skärnevitze" | German military terms, place names, and Peter's own name in German military documents |
| `ö` | U+00F6 | 18 | "Kölnische Zeitung", "Möller", "Tövejr" | German place names, surnames, and Danish words with ö (archaic for ø in some contexts) |
| `¾` | U+00BE | 2 | "kl. 7¾" | Time references (quarter to eight) |
| `¼` | U+00BC | 1 | "en ¼ del af det" | Fraction in running text |
| `°` | U+00B0 | 1 | "20 - 23 Gr°" | Degree sign for temperature |

*Actual encoding artifacts (to be cleaned or reviewed):*

| Char | Unicode | Count | Context | Disposition |
|------|---------|-------|---------|-------------|
| NEL | U+0085 | 7 | Invisible control chars in letters 121, 142, 514 | **Remove** — no textual meaning |
| `«` | U+00AB | 3 | "Sid**«** kammerater" (L71), "fra Ru **«**,." (L397), "Søndag**«**" (L453) | **Review** — garbled text, intended chars unclear from context |
| `¥` | U+00A5 | 2 | "**¥**ie es mir scheint" (L517), "**¥**aren schon wieder" (L517) | **Review** — likely `W` (Windows-1252 artifact in a German-language passage: "Wie es mir scheint", "Waren schon wieder") |
| `á` | U+00E1 | 1 | "sk**á**l jeg vist på vagt" (L44) | **Review** — likely `a` in `skal`, encoding artifact |
| `´` | U+00B4 | 1 | Stray accent on empty line after signature (L166) | **Remove** — rendering artifact |

**Already handled (by cleanup or normalization):**

| Issue | Fix | Location |
|-------|-----|----------|
| `<span>` tags (292 letters) | Stripped by `MLStripper` | `01_cleanup.ipynb` |
| `\xa0` (nbsp) | Replaced with space | `01_cleanup.ipynb` |
| `\xad` (soft hyphen) | Removed | `01_cleanup.ipynb` + `normalize-danish.mjs` |
| `\x95` (bullet) | Removed | `01_cleanup.ipynb` |
| `cg` → `og` | Manual replacement | `01_cleanup.ipynb` |
| `jog` → `jeg` | OCR rule | `normalize-danish.mjs` |

### Abbreviations in the Corpus

The letters contain authentic period abbreviations that the sentence extractor (`extract-sentences-normalized.py`) already partially handles:

| Abbreviation | Expansion | Category |
|--------------|-----------|----------|
| `Kl.` | Klokken (o'clock) | Time |
| `J.` | Jørgen (context-dependent) | Personal name |
| `Chr.` | Christian/Christen | Personal name |
| `St.` | Stenderup (context-dependent) | Place/family name |
| `Kilom.` | Kilometer | Unit |
| `Feldw.` | Feldwebel (German: sergeant) | Military rank |
| `Regt.` | Regiment | Military unit |
| `Gefr.` | Gefreiter (German: private first class) | Military rank |
| `Komp.` | Kompagni (company) | Military unit |
| `Nr.` | Nummer | Ordinal |
| `Hr.` | Herr | Title |
| `Fr.` | Fru/Frøken | Title |
| `Dr.` | Doktor | Title |

These must be **preserved as-is** in all text layers — they are authentic to the writer. But expansion metadata is useful for presentation (tooltips) and potentially for NLP (expanding before embedding).

---

## Specification (SPARC-S)

### Requirements

1. Every editorial intervention on the letter text must be recorded with: what changed, why, confidence level, and method.
2. The original source text must be recoverable at every stage — no silent, irreversible modifications.
3. Downstream consumers (sentiment, NER, embeddings) must be able to choose which text layer to operate on.
4. Abbreviations must be annotated with expansions without modifying the text itself.
5. The architecture must be backwards-compatible: existing scripts that read `text_original` and `text_normalized` must continue to work without changes.
6. Corrections must be deterministic and reproducible — running the correction script twice produces identical output.

### Non-requirements

- This ADR does not specify *which* corrections to apply (see ADR-040).
- This ADR does not change the normalization rules in `normalize-danish.mjs`.
- This ADR does not require LLM-based modernization changes (ADR-014 Phase 2).

---

## Pseudocode (SPARC-P)

### Data Flow

```
letters.json                    [immutable source — HTML formatted]
  │
  ▼
01_cleanup.ipynb                [mechanical: strip HTML, fix encoding, normalize whitespace]
  │
  ▼
letters.csv                     [cleaned plaintext — existing format unchanged]
  │
  ├──► apply-corrections.py     [editorial: fix transcription errors with provenance]
  │      │
  │      ▼
  │    corrected-letters.json   [NEW: cleaned text + corrections log + abbreviation annotations]
  │      │
  │      ▼
  │    normalize-danish.mjs     [orthographic: archaic → modern Danish]  ← input changes from
  │      │                       letters.csv to corrected-letters.json
  │      ▼
  │    normalized-letters.json  [existing format preserved, but text_original = corrected text]
  │
  └──► (legacy path still works: normalize-danish.mjs can still read letters.csv directly)
```

### Schema: `corrected-letters.json`

```
for each letter:
  {
    id:                 int       — letter ID (1-665)
    date:               string    — ISO date
    sender:             string    — sender name
    recipient:          string    — recipient name
    place:              string    — place name
    text_source:        string    — cleaned plaintext from letters.csv (immutable reference)
    text_corrected:     string    — text with editorial corrections applied
    corrections: [                — provenance log (empty array if no corrections)
      {
        position:       int       — character offset in text_source
        original:       string    — original token/span
        corrected:      string    — replacement token/span
        category:       enum      — "typing_error" | "ocr_artifact" | "encoding_artifact"
        confidence:     enum      — "high" | "medium" | "review"
        method:         string    — "pattern_match" | "context_rule" | "manual" | "llm_suggested"
        rationale:      string    — why this correction was made
      }
    ]
    abbreviations: [              — annotation layer (does NOT modify text)
      {
        token:          string    — the abbreviation as it appears ("Kl.")
        expansion:      string    — full form ("Klokken")
        category:       string    — "time" | "personal_name" | "military_rank" | "unit" | "title" | "place_name"
        positions:      int[]     — character offsets in text_corrected where this abbreviation occurs
      }
    ]
  }
```

### Schema: Updated `normalized-letters.json`

The existing schema is preserved for backwards compatibility:

```
{
  id:               int
  text_original:    string    — now sourced from text_corrected (was text_source before)
  text_normalized:  string    — archaic → modern Danish applied to text_corrected
  changes:          int       — normalization change count (same as before)
}
```

The key change: `text_original` in normalized-letters.json now contains the **corrected** text, not the raw cleaned text. This means downstream consumers automatically benefit from corrections without any code changes. The raw cleaned text is always recoverable from `corrected-letters.json → text_source` or from `letters.csv`.

---

## Architecture (SPARC-A)

### Layer Model

```
Layer 0: text_source      letters.json → HTML stripped → letters.csv
         (mechanical)     What the digitizer typed / OCR produced, minus formatting.
                          Changes: HTML removal, encoding fixes, whitespace normalization.
                          Reversibility: letters.json is the ultimate source.

Layer 1: text_corrected   apply-corrections.py → corrected-letters.json
         (editorial)      Transcription errors fixed with full provenance.
                          Changes: typing errors, OCR artifacts, garbled text.
                          Reversibility: corrections[] array + text_source = round-trip.

Layer 2: text_normalized  normalize-danish.mjs → normalized-letters.json
         (orthographic)   Archaic Danish modernized for NLP consumption.
                          Changes: spelling reform (aa→å), verb forms, vocabulary.
                          Reversibility: text_original field preserves Layer 1 text.
                          (normalize-danish.mjs already tracks changesByCategory.)
```

Each layer has a single, well-defined responsibility. No layer mixes mechanical/editorial/orthographic concerns.

### Correction Confidence Tiers

| Tier | Confidence | Auto-apply? | Examples |
|------|-----------|-------------|----------|
| **A** | `high` | Yes | Encoding artifacts (U+0085 removal), unambiguous OCR (`love.e` → `lovede`) |
| **B** | `medium` | Yes, with logging | Context-unambiguous typing errors (`Tak Tor sidst` → `Tak for sidst`, only 1 occurrence of `Tor` as a word in the corpus and it's in a fixed phrase) |
| **C** | `review` | No — flagged for human | Ambiguous cases (`korn` could mean "grain" or be a typo for `kom`; `taeklærnpt` is garbled and the intended word is uncertain) |

### Backwards Compatibility

| Consumer | Current input | After ADR-039 | Breaking? |
|----------|--------------|---------------|-----------|
| `normalize-danish.mjs` | `letters.csv` | `corrected-letters.json` (falls back to `letters.csv`) | No |
| `extract-sentences-normalized.py` | `normalized-letters.json` | Same | No |
| `generate-sentiments-cvp.py` | `normalized-letters.json` | Same | No |
| `build-data.mjs` (website) | `normalized-letters.json` | Same | No |
| Sentence extractor abbreviations | Hardcoded set | Shared `abbreviation-lexicon.json` | No (additive) |

### File Locations

Following project conventions:

| File | Path | Type |
|------|------|------|
| Correction script | `scripts/apply-corrections.py` | New |
| Corrected letters | `data/corrected-letters.json` | New output |
| Abbreviation lexicon | `data/abbreviation-lexicon.json` | New reference data |
| Quality audit script | `scripts/audit-text-quality.py` | New (see ADR-040) |
| Validation script | `scripts/validate-text-quality.py` | New (see ADR-040) |

---

## Refinement (SPARC-R)

### Adjustments from Initial Analysis

The goal-planner's initial assessment required several corrections based on empirical analysis:

1. **Span tags are not a problem.** The `MLStripper` in `01_cleanup.ipynb` already strips all `<span>` tags correctly. 0/665 letters in `letters.csv` contain HTML tags. The 292 letters with `<span>` in `letters.json` are properly handled.

2. **German characters (ü, ä, ö) are authentic.** The soldier served in the Prussian/German army and wrote German words and phrases. These 101 occurrences are legitimate multilingual content, not encoding errors.

3. **Most "encoding artifacts" are legitimate.** Of the 13 non-standard character types found, only 5 are actual artifacts (totaling ~14 instances). The rest are fractions (½, ¼), degree signs (°), and German umlauts.

4. **Typing error detection needs precise context.** Naive string matching for `Tor` yields 35 letters, but only 1 is an actual error ("Tak Tor sidst"). The others are the name Tor or part of compound words. Context-aware rules are essential.

5. **The corpus has ~4,933 hapax legomena** (words appearing exactly once). Most are legitimate (German military terms, proper nouns, dialect words). Only a small fraction are errors. A frequency-based approach alone produces too many false positives.

### Design Decision: Additive, Not Restructuring

Rather than restructuring the existing pipeline, this ADR **adds a new layer between existing steps**. The cleanup notebook and normalization script continue to work as-is. The correction script is a new, optional step that can be introduced gradually.

This means:
- No risk to the existing working pipeline
- Corrections can be developed and validated independently
- The pipeline can run with or without the correction step (normalization falls back to `letters.csv`)

### Design Decision: Corrections in Python, Not Node.js

The correction script is Python (not `.mjs`) because:
- Pattern matching with context requires more sophisticated text processing
- The existing audit/NLP scripts are Python
- The cleanup notebook is Python
- Node.js normalization script handles orthographic rules well, but editorial corrections need different tooling

---

## Completion (SPARC-C)

### Implementation Steps

1. **Create `data/abbreviation-lexicon.json`** — curate from the sentence extractor's existing `ABBREVIATIONS` set plus military/personal name abbreviations found in the corpus.

2. **Create `scripts/apply-corrections.py`** — reads `letters.csv`, applies tiered corrections, writes `corrected-letters.json`. Initially contains only Tier A (high-confidence) corrections. Tier B and C corrections are added incrementally after ADR-040 audit.

3. **Update `normalize-danish.mjs`** — add fallback input: prefer `corrected-letters.json` if it exists, otherwise read `letters.csv` as before. Move the `jog` → `jeg` OCR rule to the correction script (it's an editorial fix, not an orthographic normalization).

4. **Update Makefile** — add `correct` target between `clean` and `normalize` in the data pipeline.

5. **Create `scripts/validate-text-quality.py`** — round-trip validation ensuring corrections are consistent and no regressions are introduced (see ADR-040 for details).

### Validation Criteria

- [ ] `corrected-letters.json` contains 665 entries, one per letter
- [ ] Every entry has `text_source` matching the corresponding `letters.csv` text
- [ ] Every correction in `corrections[]` can be verified: applying the reverse yields `text_source`
- [ ] `normalized-letters.json` regenerated from corrected text produces equal or better output
- [ ] All existing downstream scripts produce valid output without code changes
- [ ] Abbreviation lexicon covers all period-terminated tokens in the sentence extractor's set

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Corrections introduce new errors | High | Tier system, validation script, human review for Tier C |
| `normalize-danish.mjs` input change breaks output | Medium | Fallback to `letters.csv`, regression test comparing old/new output |
| Abbreviation expansion is wrong in context | Low | Expansions are metadata only — never modify text |
| Pipeline ordering dependency | Low | Makefile enforces correct order; each script validates its input |

---

## Alternatives Considered

### Alternative 1: Extend `normalize-danish.mjs` with correction rules

Add typing error fixes to the existing normalization script's rule categories.

**Rejected** because it conflates two different concerns (editorial correction vs. orthographic modernization) and provides no provenance tracking. The normalization script tracks change *counts* by category but not *what* was changed or *why*.

### Alternative 2: Fix errors directly in `letters.json` or `letters.csv`

Correct the source data files to eliminate errors at the root.

**Rejected** because it destroys provenance. In Digital Humanities, the distinction between the source text and editorial intervention must be transparent. Scholars need to see both what the digitizer produced and what the editor corrected.

### Alternative 3: TEI XML encoding

Use the Text Encoding Initiative standard for editorial apparatus (`<choice>`, `<sic>`, `<corr>`, `<abbr>`, `<expan>`).

**Deferred, not rejected.** TEI XML is the gold standard for scholarly text editions. However, the project's NLP pipeline is built on JSON/CSV, and introducing XML would require significant tooling changes. The JSON-based provenance model in this ADR captures the same information and can be exported to TEI if needed later. The `corrections[]` array maps directly to `<choice><sic>original</sic><corr>corrected</corr></choice>` and the `abbreviations[]` array maps to `<choice><abbr>Kl.</abbr><expan>Klokken</expan></choice>`.

### Alternative 4: Single-pass LLM correction of all errors

Send each letter to an LLM with a prompt to identify and correct all transcription errors.

**Rejected as primary approach** because LLM output is non-deterministic. However, LLM-assisted detection is recommended in ADR-040 as a *discovery* tool — the LLM proposes corrections, which are then codified as deterministic rules.

---

## Consequences

### Positive

- Every editorial change is traceable, auditable, and reversible
- Downstream NLP quality improves as transcription errors are corrected
- Abbreviation metadata enables richer presentation (tooltips, glossary)
- Backwards-compatible — existing scripts work without changes
- The correction layer can grow incrementally as new errors are discovered
- Aligns with Digital Humanities best practices for scholarly text editions

### Negative

- Adds a new pipeline step and data file (`corrected-letters.json`)
- The normalization script's `text_original` field becomes the corrected text, not the raw cleaned text (potentially confusing naming — but renaming would break backwards compatibility)
- Human review is required for Tier C corrections — cannot be fully automated

---

## Related

- **ADR-014**: Archaic Danish Text Modernization — establishes the dual-text architecture this ADR extends
- **ADR-025**: Sentiment on Normalized Text — benefits from cleaner input via the correction layer
- **ADR-026**: Extract Notebooks to Scripts — the correction script follows this pattern
- **ADR-040**: Corpus Text Quality Audit Strategy — defines how errors are found and classified (companion ADR)
