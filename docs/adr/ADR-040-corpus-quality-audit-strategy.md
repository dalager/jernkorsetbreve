# ADR-040: Corpus Text Quality Audit and Correction Strategy

## Status

Accepted (2026-04-02)

## Date

2026-04-02

## Context

ADR-039 defines the multi-layer text architecture for recording editorial corrections with provenance. This companion ADR defines *how* errors are found, classified, and corrected — the methodology and tooling that populates ADR-039's correction layer.

The 665 letters in the jernkorsetbreve corpus have passed through multiple transcription stages, each introducing distinct error types:

```
Peter Mærsk's handwriting (1911-1918)
  → Manual typing by family/archivist (unknown date)
    → HTML digitization (unknown tool/date)
      → 01_cleanup.ipynb (our pipeline)
        → normalize-danish.mjs (our pipeline)
```

Each stage can introduce errors. The original handwriting is not available for comparison, so we work backwards from the digitized text, using linguistic context and corpus statistics to detect anomalies.

### The Problem of Error vs. Authenticity

This corpus presents a fundamental tension: **how do you distinguish a transcription error from authentic dialect, archaic usage, or the writer's own idiosyncratic spelling?**

Peter Mærsk was a South Jutlandic farmer writing during a period when:
- Danish orthography was not yet standardized (the 1948 spelling reform was decades away)
- The region was under German/Prussian rule — German words and phrases are authentic
- Education levels varied — unconventional spelling may be the writer's own
- Letters were written in the field during wartime — haste and poor conditions affected penmanship

**Guiding principle:** When in doubt, preserve. A false positive (wrongly "correcting" authentic text) is worse than a false negative (leaving an error uncorrected), because it silently destroys evidence.

### Error Categories

| Category | Origin | Example | Distinguishing Feature |
|----------|--------|---------|----------------------|
| **Typing error** | Manual transcription | `Tor` for `for`, `dia` for `du` | Adjacent keys on keyboard, or looks similar in handwriting |
| **OCR artifact** | Optical character recognition | `love.e` for `lovede`, `lier` for `her` | Character substitution/insertion patterns typical of OCR |
| **Encoding artifact** | Character set conversion | `Sid«` for `Side`, `¥ie` for `Wie` | Non-Danish characters in Danish context |
| **Garbled text** | Multiple/unknown causes | `taeklærnpt` | Multiple character errors making the intended word uncertain |
| **Authentic dialect** | Writer's actual usage | `kanske` for `måske` | Consistent across letters, matches known dialect patterns |
| **Authentic German** | Bilingual context | `Feldwebel`, `Thüringen` | German words in context of military service under Prussia |
| **Period spelling** | Pre-reform orthography | `skulde`, `saa`, `aa` | Already handled by normalization (ADR-014) |

The first four are errors to be corrected. The last three are authentic text to be preserved. The challenge is reliable classification.

---

## Specification (SPARC-S)

### Requirements

1. **Systematic audit**: Every letter must be scanned for potential quality issues — no letter should be unchecked.
2. **Categorized output**: Each flagged issue must be classified into one of the error categories above.
3. **Confidence scoring**: Each issue must have a confidence level (high/medium/review) indicating how certain we are that it's an error vs. authentic.
4. **Context preservation**: Each flagged issue must include surrounding text (at minimum 20 characters each side) for human reviewers.
5. **Deterministic**: The audit produces identical output on identical input. No randomness, no LLM calls in the core audit.
6. **Actionable output**: The audit output format must be directly consumable by `apply-corrections.py` (ADR-039).
7. **Incremental**: New error patterns can be added to the audit without re-reviewing previously resolved items.
8. **Validation**: Automated checks prevent corrections from introducing new errors.

### Acceptance Criteria

- Audit script runs in < 30 seconds on all 665 letters
- All 8 confirmed typing errors from ADR-039 evidence are detected
- All 5 encoding artifact types from ADR-039 evidence are detected
- False positive rate < 20% (at most 1 in 5 flagged items is actually authentic)
- Zero false corrections applied at Tier A (high confidence)

---

## Pseudocode (SPARC-P)

### Phase 1: Audit Script (`scripts/audit-text-quality.py`)

```python
def audit_corpus(letters):
    issues = []

    for letter in letters:
        # 1. Encoding scan
        #    For each character, check if it's in the expected set:
        #    ASCII printable + æøåÆØÅéÉ + German umlauts (üäöÜÄÖ) +
        #    fractions (½¼¾) + degree (°)
        #    Flag anything else with surrounding context.

        # 2. Known error pattern scan
        #    Apply a dictionary of context-aware patterns:
        #    - "Tak Tor" → likely "Tak for" (fixed phrase, Tor not a name here)
        #    - "korn" followed by pronoun/verb → likely "kom" (not grain)
        #    - "ude st" + infinitive → likely "ude at"
        #    - "dia" as standalone pronoun → likely "du"
        #    - "vj" as standalone → likely "vi"
        #    - word containing "." mid-word → likely OCR artifact
        #    Each pattern provides: category, confidence, suggested correction.

        # 3. Hapax anomaly scan (statistical)
        #    Words appearing exactly once in the corpus that are:
        #    - Not proper nouns (not capitalized mid-sentence, or capitalized
        #      but not in a name position)
        #    - Not German (not in a German-language passage)
        #    - Within edit distance 1-2 of a common Danish word
        #    Flag as "review" confidence — these are candidates, not certainties.

        # 4. Character sequence anomaly scan
        #    Flag unusual character sequences that suggest OCR errors:
        #    - Consonant clusters not found in Danish or German (e.g., "lrn", "kpt")
        #    - Punctuation inside words (e.g., "love.e")
        #    - Single-letter words other than known ones (å, i, o)

    return issues
```

### Phase 2: Correction Script (`scripts/apply-corrections.py`)

```python
def apply_corrections(letters, rules):
    for letter in letters:
        text = letter.text_source
        corrections = []

        for rule in rules:
            if rule.confidence == "review":
                continue  # skip — needs human decision

            matches = rule.find_in_text(text)
            for match in matches:
                if rule.context_check(text, match):
                    corrections.append({
                        position: match.start,
                        original: match.text,
                        corrected: rule.replacement,
                        category: rule.category,
                        confidence: rule.confidence,
                        method: rule.method,
                        rationale: rule.rationale,
                    })

        # Apply corrections in reverse order (to preserve positions)
        text_corrected = apply_in_reverse(text, corrections)

        letter.text_corrected = text_corrected
        letter.corrections = corrections

    return letters
```

### Phase 3: Validation Script (`scripts/validate-text-quality.py`)

```python
def validate(corrected_letters, letters_csv):
    errors = []

    for letter in corrected_letters:
        # 1. Round-trip check: reversing all corrections yields text_source
        reversed_text = reverse_corrections(letter.text_corrected, letter.corrections)
        assert reversed_text == letter.text_source

        # 2. No new encoding artifacts introduced
        assert no_unexpected_characters(letter.text_corrected)

        # 3. Correction positions are valid and non-overlapping
        assert corrections_are_valid(letter.corrections)

        # 4. Known error regression check
        assert "Tak Tor" not in letter.text_corrected
        # (expand with all confirmed errors)

        # 5. Sanity: corrected text length within 5% of source
        ratio = len(letter.text_corrected) / len(letter.text_source)
        assert 0.95 < ratio < 1.05

    return errors
```

---

## Architecture (SPARC-A)

### Three-Tier Detection Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Detection Methods                         │
├──────────────┬──────────────────┬───────────────────────────┤
│  Rule-based  │  Statistical     │  LLM-assisted             │
│  (patterns)  │  (corpus stats)  │  (contextual)             │
├──────────────┼──────────────────┼───────────────────────────┤
│ Encoding     │ Hapax legomena   │ Ambiguous word-in-context │
│ artifacts    │ analysis         │ classification            │
│              │                  │                           │
│ Known OCR    │ Edit distance    │ Garbled text              │
│ patterns     │ to common words  │ reconstruction            │
│              │                  │                           │
│ Fixed-phrase │ Frequency        │ Dialect vs. error         │
│ violations   │ anomalies        │ determination             │
├──────────────┼──────────────────┼───────────────────────────┤
│ Tier A+B     │ Tier B+C         │ Tier C (discovery only)   │
│ Auto-apply   │ Flag + review    │ Human decides             │
└──────────────┴──────────────────┴───────────────────────────┘
```

### Rule-Based Patterns (Tier A+B)

These are deterministic, context-aware rules:

```python
CORRECTION_RULES = [
    # Tier A: High confidence — encoding artifacts
    {
        "pattern": r"\x85",       # NEL control character
        "replacement": "",
        "category": "encoding_artifact",
        "confidence": "high",
        "context_check": None,    # always apply
        "rationale": "U+0085 (NEL) is a control character with no textual meaning"
    },
    {
        "pattern": r"´\s*$",      # stray accent at end of text
        "replacement": "",
        "category": "encoding_artifact",
        "confidence": "high",
        "context_check": None,
        "rationale": "Stray acute accent (U+00B4) after signature, likely rendering artifact"
    },

    # Tier A: High confidence — unambiguous OCR
    {
        "pattern": r"\blove\.e\b",
        "replacement": "lovede",
        "category": "ocr_artifact",
        "confidence": "high",
        "context_check": None,
        "rationale": "Period inside word is OCR artifact; 'lovede' is past tense of 'love' (promise)"
    },

    # Tier B: Medium confidence — context-dependent typing errors
    {
        "pattern": r"\bTor\b",
        "replacement": "for",
        "category": "typing_error",
        "confidence": "medium",
        "context_check": "preceded_by('Tak')",
        "rationale": "'Tak for sidst' is a fixed Danish greeting formula; 'Tor' is not a word in this context"
    },
    {
        "pattern": r"\bst\b",
        "replacement": "at",
        "category": "typing_error",
        "confidence": "medium",
        "context_check": "preceded_by('ude') and followed_by(infinitive)",
        "rationale": "'st' is not a Danish word; 'ude at [verb]' is a common construction"
    },
    {
        "pattern": r"\bkorn\b",
        "replacement": "kom",
        "category": "typing_error",
        "confidence": "medium",
        "context_check": "followed_by(pronoun_or_adverb) and not_in_agricultural_context()",
        "rationale": "'korn' means grain but in 'korn vi til at snakke' the subject+verb pattern requires 'kom'"
    },
    {
        "pattern": r"\bdia\b",
        "replacement": "du",
        "category": "typing_error",
        "confidence": "medium",
        "context_check": "used_as_pronoun()",
        "rationale": "'dia' is not a Danish word; position in sentence matches pronoun 'du'"
    },
    {
        "pattern": r"\bvj\b",
        "replacement": "vi",
        "category": "typing_error",
        "confidence": "medium",
        "context_check": "used_as_pronoun()",
        "rationale": "'vj' is not a Danish word; adjacent-key typo for 'vi'"
    },
    {
        "pattern": r"\blier\b",
        "replacement": "her",
        "category": "typing_error",
        "confidence": "medium",
        "context_check": "not_a_name() and preceded_by(article_or_adjective)",
        "rationale": "'lier' is not a Danish word in this context; OCR/typing error for 'her'"
    },

    # Tier C: Review — ambiguous cases
    {
        "pattern": r"\btaeklærnpt\b",
        "replacement": "?",        # uncertain
        "category": "garbled_text",
        "confidence": "review",
        "context_check": None,
        "rationale": "Multiple character errors; possibly 'tæklemt' (constricted) but uncertain"
    },
    {
        "pattern": r"skál",
        "replacement": "skal",
        "category": "encoding_artifact",
        "confidence": "review",
        "context_check": None,
        "rationale": "á (U+00E1) likely encoding artifact for 'a' in 'skal', but review needed"
    },
    {
        "pattern": r"Sid«",
        "replacement": "?",
        "category": "encoding_artifact",
        "confidence": "review",
        "context_check": None,
        "rationale": "« (left guillemet) is encoding artifact; intended word unclear from context"
    },
]
```

### Statistical Detection (Tier B+C)

The corpus has 4,933 hapax legomena. Most are legitimate. The statistical scan flags a hapax only when ALL of these conditions are met:

1. The word is not a proper noun (not capitalized at start of sentence)
2. The word is not in a German-language passage
3. The word is within Levenshtein distance ≤ 2 of a word appearing 5+ times in the corpus
4. The word does not appear in a reference list of known archaic/dialect Danish words

This dramatically reduces the false positive rate. Estimated: ~50-100 candidates from 4,933 hapax, of which ~20-30 are actual errors.

### LLM-Assisted Detection (Tier C Discovery)

Used **once** as a discovery pass, not as an ongoing pipeline step:

```
Du er ekspert i dansk fra Sønderjylland i perioden 1911-1918.
Peter Mærsk var en sønderjysk landmand der tjente i den tyske hær under Første Verdenskrig.

Givet denne sætning fra et af hans breve, vurdér om det markerede ord er:
A) Korrekt (autentisk dialekt, tysk ord, eller periodens stavemåde)
B) Sandsynlig skrive-/tastefejl fra den person der har afskrevet brevet
   (med forslag til rettelse)
C) Uvist (kan ikke afgøres uden mere kontekst)

Sætning: "{sentence}"
Markeret ord: "{flagged_word}"

Svar kort med kategori (A/B/C), begrundelse, og evt. rettelsesforslag.
```

**Cost**: ~50-100 flagged items × ~$0.002 per call = **< $1 total**.

**Process**: LLM suggestions are reviewed by the project owner. Accepted suggestions become deterministic rules in the pattern dictionary. The LLM is never called at pipeline runtime.

### Abbreviation Lexicon

The abbreviation lexicon (`data/abbreviation-lexicon.json`) serves double duty:

1. **Sentence splitting**: The sentence extractor uses it to avoid breaking on abbreviation periods.
2. **Presentation**: The website can use expansions for tooltips or a glossary.

The lexicon is curated manually from:
- The existing `ABBREVIATIONS` set in `extract-sentences-normalized.py` (33 entries)
- Military abbreviations found by scanning for pattern `[A-Z][a-z]*\.` in the corpus
- Context from the letters themselves (e.g., `J.` = Jørgen when discussing Jørgen Jensen)

The lexicon is a reference file, not a pipeline output. It changes only when new abbreviation patterns are discovered.

---

## Refinement (SPARC-R)

### Key Adjustment: "korn" Requires Careful Context

The word `korn` appears 4 times in the corpus. In all 4 cases, linguistic context strongly suggests `kom`:

| Letter | Context | Why `kom` not `korn` |
|--------|---------|---------------------|
| 5 | "Og korn vi til at snakke" | Subject `vi` + infinitive `at snakke` — requires verb `kom` |
| 6 | "da Uffe korn, hjalp det" | Temporal clause with named subject — requires verb `kom` |
| 29 | "Lørdag aften korn der så Flyveblade" | Inverted subject-verb — `kom der` (there came) |
| 34 | "Så korn Underofficeren" | Inverted subject-verb — `kom Underofficeren` |

However, `korn` (grain) is a real Danish word and Peter is a farmer. The context rule must check for verb position (subject-verb pattern). This is Tier B, not Tier A — logged but auto-applied because every occurrence has unambiguous syntactic context.

### Key Adjustment: Don't Over-Automate

The initial plan proposed an LLM pass over all 4,933 hapax legomena. This is overkill. Instead:

1. Rule-based patterns catch the confirmed errors (~10 patterns)
2. Statistical scan flags ~50-100 candidates from hapax analysis
3. LLM is used **only** on those ~50-100 flagged items, not the full hapax list
4. Human reviews LLM output and promotes accepted corrections to rules

This keeps costs minimal and the pipeline deterministic.

### Key Adjustment: The `cg` → `og` Fix Should Move

The cleanup notebook currently contains `df['text'] = df['text'].str.replace(' cg ', ' og ')`. This is an editorial correction, not a mechanical cleanup. It should move to `apply-corrections.py` with proper provenance. However, since it's already applied in `letters.csv`, we record it as a pre-existing correction (method: `"legacy_cleanup"`) rather than re-applying it.

Similarly, `jog` → `jeg` in `normalize-danish.mjs` is an editorial fix, not an orthographic normalization. It should be documented as a pre-existing correction. Moving it out of the normalizer is optional — the provenance record is what matters.

---

## Completion (SPARC-C)

### Implementation Phases

#### Phase 0: Audit and Inventory (prerequisite)

**Deliverable**: `scripts/audit-text-quality.py` and `data/quality-audit/error-inventory.json`

1. Implement encoding artifact scanner
2. Implement known error pattern scanner (the ~10 confirmed patterns)
3. Implement hapax anomaly scanner (statistical, flags candidates)
4. Run audit, review output, adjust false positive rate
5. Produce `error-inventory.json` with all findings categorized and scored

**Milestone**: "We know what's wrong — complete inventory of issues across 665 letters."

#### Phase 1: High-Confidence Corrections

**Deliverable**: `scripts/apply-corrections.py` with Tier A rules, `data/corrected-letters.json`

1. Implement correction script with the Tier A rules (encoding artifacts, unambiguous OCR)
2. Generate `corrected-letters.json` with provenance
3. Run validation: round-trip check, no regressions
4. Update `normalize-danish.mjs` to prefer corrected input

**Milestone**: "Encoding artifacts eliminated, obvious OCR errors fixed, with full provenance."

#### Phase 2: Context-Dependent Corrections

**Deliverable**: Tier B rules added to `apply-corrections.py`

1. Implement context-aware pattern matching for the typing errors (`Tor`, `korn`, `dia`, `st`, `vj`, `lier`)
2. Run audit on Tier B corrections, verify context checks work
3. Generate updated `corrected-letters.json`
4. Manual spot-check of all Tier B corrections (small number — approximately 10 items)

**Milestone**: "All confident corrections applied. Human has reviewed every Tier B correction."

#### Phase 3: Ambiguous Cases (Human-in-the-Loop)

**Deliverable**: Tier C items resolved

1. Run LLM-assisted detection on statistical anomaly candidates (~50-100 items)
2. Present results to project owner for review
3. Accepted corrections become Tier A or B rules
4. Rejected items are marked as authentic (added to a preserve-list)

**Milestone**: "All detectable errors classified. Ambiguous cases resolved by human judgment."

#### Phase 4: Abbreviation Lexicon

**Deliverable**: `data/abbreviation-lexicon.json`

1. Curate lexicon from existing ABBREVIATIONS set + corpus scanning
2. Annotate abbreviation positions in `corrected-letters.json`
3. Update sentence extractor to source abbreviations from lexicon file
4. Validate: no sentence breaks on abbreviation periods

**Milestone**: "Abbreviations annotated with expansions across corpus."

#### Phase 5: Validation Framework

**Deliverable**: `scripts/validate-text-quality.py`, Makefile integration

1. Implement validation checks (round-trip, encoding, regression, sanity)
2. Add Makefile targets: `audit`, `correct`, `validate`, `pipeline-data`
3. Run full pipeline: audit → correct → normalize → validate
4. Document in README or pipeline docs

**Milestone**: "Pipeline is self-validating. Quality checks run automatically."

### Impact on Downstream Outputs

When corrections are applied, all downstream outputs need regeneration:

| Output | Script | Expected Change |
|--------|--------|-----------------|
| `normalized-letters.json` | `normalize-danish.mjs` | Minor: ~10 words across ~8 letters corrected before normalization |
| `normalized-sentences.json` | `extract-sentences-normalized.py` | Minimal: corrected words produce cleaner sentences |
| `sentiment_scored_*.csv` | sentiment pipeline | Small: corrected words may now match sentiment lexicons |
| `NER_entities.csv` | NER pipeline | Minimal: most corrections are common words, not entities |
| Website data | `build-data.mjs` | Automatically benefits via `normalized-letters.json` |

The impact is deliberately small — we're correcting ~10-20 confirmed errors across 665 letters. But each correction removes a potential NLP misread.

---

## Alternatives Considered

### Alternative 1: Manual correction only

Have a human read all 665 letters and manually flag/fix errors.

**Rejected** as primary approach. At ~5 minutes per letter, this is ~55 hours of work. The automated audit can flag candidates in 30 seconds, reducing human review to ~50-100 specific items. However, human review is essential for Tier C items — the audit provides the triage, not the final judgment.

### Alternative 2: Full LLM correction of all 665 letters

Send every letter to an LLM with instructions to identify all errors.

**Rejected** because:
- Non-deterministic: different runs produce different corrections
- Risk of hallucinated "corrections" that are actually authentic dialect
- Cannot be validated without human review of all 665 outputs
- More expensive and slower than targeted rule-based correction
- The LLM doesn't know which transcription stage introduced an error

LLM detection of the ~50-100 statistical anomaly candidates is appropriate (Phase 3), but blanket LLM correction is not.

### Alternative 3: Ignore errors — normalize around them

Let the normalization script paper over errors by treating them as archaic forms.

**Rejected** because:
- `Tor`, `dia`, `vj` are not archaic Danish — they're keyboard errors with no archaic interpretation
- The normalization script correctly avoids modifying words it doesn't recognize
- Errors in common function words (pronouns, prepositions) affect syntactic parsing and sentiment
- This approach would mean the "normalized" text still contains errors, undermining the purpose of normalization

### Alternative 4: Probabilistic spell-checker (e.g., SymSpell, Hunspell)

Run a spell-checker tuned for Danish.

**Rejected** because:
- Standard Danish spell-checkers flag all archaic forms as errors (false positives)
- They don't distinguish between transcription errors and authentic period spelling
- The corpus is too small and too specialized for training a custom language model
- Context-aware rules (our approach) are more precise for the ~10 confirmed error patterns

---

## Consequences

### Positive

- Systematic, reproducible quality audit across the full corpus
- Clear separation between error detection (audit) and error correction (apply)
- Human review is focused on a small, manageable set of ambiguous cases
- Every correction is traceable to a specific rule with stated rationale
- The approach is conservative: when in doubt, preserve the source text
- Incremental: new error patterns can be added without re-reviewing old corrections

### Negative

- The audit may not catch all errors — errors with no statistical or pattern-based signal will be missed
- Human review is still required for ~50-100 items (Tier C)
- The correction rules are corpus-specific — they wouldn't transfer to a different letter collection
- Adding the LLM discovery step (Phase 3) introduces a one-time API cost (~$1)

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Context rule incorrectly applies a correction | High | Every Tier B correction is manually spot-checked. Validation script catches round-trip failures. |
| LLM suggests "corrections" that destroy authentic dialect | Medium | LLM is used for discovery only. Every suggestion goes through human review. Accepted items are codified as deterministic rules. |
| Statistical scan produces too many false positives | Low | Multiple filtering conditions (not a name, not German, close to common word) keep the candidate list manageable. Threshold can be adjusted. |
| New letters added to corpus aren't audited | Low | Audit script runs on the full corpus each time. New letters are automatically included. |

---

## Validation

### Audit Script Validation

- [ ] Detects all 8 confirmed typing errors from ADR-039 evidence table
- [ ] Detects all encoding artifacts (U+0085, U+00AB, U+00A5, U+00E1, U+00B4)
- [ ] Does NOT flag German umlauts (ü, ä, ö) as artifacts
- [ ] Does NOT flag fractions (½, ¼, ¾) or degree signs (°) as artifacts
- [ ] Runs in < 30 seconds on 665 letters
- [ ] Output is valid JSON matching the schema in ADR-039

### Correction Script Validation

- [ ] Round-trip: reversing corrections on `text_corrected` yields `text_source` exactly
- [ ] No Tier C (review) items are auto-applied
- [ ] All Tier A corrections are encoding/OCR fixes (no judgment calls)
- [ ] All Tier B corrections have passing context checks
- [ ] Total corrections across corpus is in expected range (~15-25 for Tier A+B)

### Pipeline Validation

- [ ] `normalized-letters.json` produced from corrected text is valid
- [ ] Sentence extraction produces valid output from corrected+normalized text
- [ ] No downstream script fails or produces obviously wrong output
- [ ] Diff between old and new `normalized-letters.json` is small and explainable

---

## Related

- **ADR-039**: Multi-Layer Text Architecture — defines the data model this ADR populates
- **ADR-014**: Archaic Danish Text Modernization — the normalization layer that consumes corrected text
- **ADR-025**: Sentiment on Normalized Text — directly benefits from cleaner input
- **ADR-026**: Extract Notebooks to Scripts — pattern for new pipeline scripts
