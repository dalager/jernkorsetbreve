# ADR-014: Archaic Danish Text Modernization for Embeddings

## Status
Proposed

## Context

The 665 letters (1911–1918) are written in archaic Danish with features that reduce embedding quality even with a multilingual model (ADR-012):

| Archaic Form | Modern Danish | Issue |
|-------------|---------------|-------|
| skulde | skulle | Verb form |
| vilde | ville | Verb form |
| kunde | kunne | Verb form |
| saa | så | Pre-1948 spelling reform |
| aa (throughout) | å | Pre-1948 spelling reform |
| Tornyster | tornister | Archaic vocabulary |
| Ekcerserere | eksercere | Misspelling + archaic |
| Feldvebel | feldwebel/sergent | German military loanword |
| Hauptmand | kaptajn | German military loanword |

Additionally: inconsistent capitalization of common nouns (German influence), South Jutlandic dialect features, mixed Danish-German fragments, and inconsistent orthography (same word spelled differently across letters).

Modern Danish search queries ("soldater," "hjemve," "forplejning") must match this archaic text. Even `multilingual-e5-small` is trained on modern web text, not 1900s Danish correspondence.

### Existing Research

- **DaNLP** (Alexandra Institute): Danish NLP toolkit — no historical text support
- **DaCy**: Danish spaCy pipeline — modern Danish only
- **MultiLexNorm benchmark**: Includes Danish for lexical normalization
- **CLARIN normalization tools**: Historical text normalization across languages
- **LLM-based approaches**: Most practical for a corpus of this size

## Decision

### Dual-Text Architecture

Store modernized text alongside originals. Generate embeddings from modernized text. Display original text in the UI.

Extend the data model:

```json
{
  "id": 1,
  "text": "Min egen kjære Trine. Tak for sidst. Jeg er saa forkølet...",
  "text_modern": "Min egen kære Trine. Tak for sidst. Jeg er så forkølet...",
  "text_for_embedding": "passage: Min egen kære Trine. Tak for sidst. Jeg er så forkølet..."
}
```

### Phase 1: Rule-Based Normalization (Quick Win)

Create `scripts/normalize-danish.mjs` with systematic orthographic rules:

1. **Pre-1948 spelling reform**: `aa` → `å` (with whitelist for names/places: Aalborg, Aarhus)
2. **Common archaic verb forms**: `skulde` → `skulle`, `vilde` → `ville`, `kunde` → `kunne`
3. **Capitalized common nouns**: Lowercase nouns capitalized under German influence (requires POS tagging to avoid lowercasing proper nouns — conservative approach: only lowercase words from a known common-noun list)
4. **Known vocabulary mappings**: A manually curated dictionary of ~50-100 archaic→modern word pairs found in the corpus

This phase is deterministic, fast, and free. Expected to catch ~60% of orthographic differences.

### Phase 2: LLM-Based Modernization (High Quality)

Use Claude or GPT-4 to modernize all 665 letters at build time:

**Prompt:**
```
Du er en ekspert i historisk dansk sprog fra begyndelsen af 1900-tallet.
Modernisér følgende tekst til nutidig dansk retskrivning.
Bevar betydningen, tonen og sætningsstrukturen.
Bevar alle navne, steder og datoer uændrede.
Returnér kun den moderniserede tekst.
```

**Cost estimate:** 665 letters × ~1,636 chars avg × ~$0.01/letter ≈ **$7 one-time cost**.

**Process:**
1. Run LLM modernization on all letters (batch API for cost efficiency)
2. Store results in `data/modernized-letters.json`
3. Spot-check 20 random letters for accuracy
4. Integrate into `search-corpus.json` as the `text_modern` field
5. Regenerate embeddings from `text_modern`

### Phase 3: Weighted Dual Embedding (Optional, Evaluate First)

If evaluation (ADR-013) shows that modernized-only embeddings miss archaic-specific terms that users actually search for, consider a weighted combination:

```
final_embedding = 0.7 × embed(modernized) + 0.3 × embed(original)
```

Only pursue if Phase 2 evaluation reveals a regression on archaic-term queries.

### Not Pursued: Training a Custom Historical Danish Normalizer

Rejected because:
- The corpus (665 letters) is too small to train a reliable normalizer
- LLM-based modernization achieves higher quality with less effort
- A custom model would need ongoing maintenance

## Consequences

### Positive
- Resolves the vocabulary mismatch between modern search queries and archaic letter text
- Modernized text can serve double duty: better embeddings AND as a reading aid for users unfamiliar with archaic Danish
- The original text is always preserved and displayed — no loss of historical authenticity
- Rule-based Phase 1 is free and deterministic; LLM Phase 2 is a one-time ~$7 cost
- Modernized text benefits all downstream analyses (topic modeling, NER, sentiment) not just search

### Negative
- LLM modernization is non-deterministic — results may vary between runs
- Some archaic expressions may lose nuance in modernization (e.g., "Meningen" with capital M has a different connotation than modern "meningen")
- Adds a build-time dependency on an LLM API (for Phase 2)
- Data files grow: `search-corpus.json` roughly doubles in size with the additional `text_modern` field

### Risks
- Names and places must be preserved exactly — the LLM prompt must be carefully validated
- German military terms should be retained (they are the historically correct terms), not translated to Danish equivalents
- The modernization should not change sentence structure, only spelling and vocabulary

## Validation
- Phase 1: Manual review of 50 random letters — verify no false positives (e.g., "Aalborg" not changed to "Ålborg" unless intended)
- Phase 2: Spot-check 20 letters against originals — verify meaning preservation
- Both phases: Run evaluation framework (ADR-013) comparing embeddings from original vs. normalized vs. LLM-modernized text
- Verify that search for archaic terms (e.g., "Feldvebel") still returns relevant results
