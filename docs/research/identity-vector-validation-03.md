# Identity Vector Validation Report

## Date: 2026-03-29

Research validation for ADR-038 (National Identity Concept Vector). This document covers temporal bias analysis, cross-validation design, and the Danish-language method note for the website.

---

## 1. Temporal Bias Analysis

### 1.1 Corpus distribution by year

The 665 letters (13,577 sentences) are distributed unevenly:

| Year | Letters | Sentences | Period |
|------|---------|-----------|--------|
| 1911 | 9 | 236 | Peacetime |
| 1912 | 14 | 374 | Peacetime |
| 1913 | 13 | 559 | Peacetime |
| 1914 | 85 | 1,994 | Mobilization + first war year |
| 1915 | 127 | 2,771 | War |
| 1916 | 125 | 2,224 | War |
| 1917 | 179 | 3,559 | War |
| 1918 | 113 | 1,860 | War + armistice |

Pre-war (1911-1913): 1,169 sentences (8.6% of corpus).
War (1914-1918): 12,408 sentences (91.4% of corpus).

### 1.2 Identity keyword distribution

Using the research prototype's keyword sets (the same that produced the 46 Danish / 27 German seed counts):

**Danish pole keywords** (danskere, danske, dansk hurra, sonderjylland, nordslesvig, hjemland, modersmaal):

| Year | Hits | Notes |
|------|------|-------|
| 1911 | 1 | |
| 1912 | 0 | |
| 1913 | 4 | |
| 1914 | 30 | Peak -- mobilization triggers explicit identity framing |
| 1915 | 6 | |
| 1916 | 3 | |
| 1917 | 1 | |
| 1918 | 1 | |

**German/military pole keywords** (kejser, jernkorset, pligt, tysk soldat, tyske rige, troskab):

| Year | Hits | Notes |
|------|------|-------|
| 1911-1913 | 0 | Peter is not yet in military service |
| 1914 | 11 | |
| 1915 | 3 | |
| 1916 | 10 | |
| 1917 | 1 | |
| 1918 | 2 | |

### 1.3 Temporal separation between poles

- Mean date of Danish-pole keyword sentences: **1914-10-01** (n=52)
- Mean date of German-pole keyword sentences: **1915-12-30** (n=192, using broader military keywords)
- Temporal separation: **454 days (~1.2 years)**

This is a significant separation. The Danish pole peaks at mobilization (1914) when Peter explicitly discusses his Danish identity in the context of entering German service. The German pole is spread across the war years, peaking wherever military hierarchy is most discussed.

### 1.4 Structural confound: the German pole cannot exist pre-war

The ADR specifies "Balance across time periods (don't over-sample early or late letters)." This requirement is **structurally impossible** for the German/military pole:

- German/military keyword sentences available pre-war (1911-1913): **0-1**
- German/military keyword sentences available wartime (1914-1918): **191+**

This is not a methodological flaw -- it reflects historical reality. Peter was a farmer in Sonderjylland until mid-1914. There is no German military register to sample from before conscription. The temporal imbalance is inherent in the subject matter.

### 1.5 The Danish pole also clusters temporally

The 46 Danish-pole keyword sentences are concentrated in 1914 (30 of 46 = 65%). This occurs because mobilization forces Peter to articulate his Danish identity explicitly ("Forst om Danskerne", "alle os danskere tog afsked med hinanden"). By 1916-1918, Danish identity is expressed more implicitly -- through longing for home, dialect markers, and social references that keyword matching does not capture.

This means the keyword-based seed selection from the prototype is biased toward early-war explicit identity statements. Manual seed curation for the final implementation should actively seek implicit identity sentences from 1916-1918 via embedding-neighbor search, not just keyword matching.

### 1.6 Temporal confound check: R-squared regression

The existing `generate-identity-vector.py` script already computes `r` and `R^2` between letter date and identity score (lines 274-299). The ADR sets a replanning trigger at R^2 > 0.5.

The following Python fragment provides an additional check that should be included in the `--validate` mode. It tests whether the identity score adds explanatory power beyond what letter date alone provides:

```python
# Temporal confound check (for --validate mode)
#
# After scoring all sentences, compute:
#   1. R^2 of identity_score ~ year (raw temporal correlation)
#   2. Partial correlation: identity_score ~ identity_keywords | year
#      (does the vector capture something beyond time?)
#
# If R^2(raw) > 0.3 but partial correlation is still significant,
# the vector captures identity register WITH a temporal trend --
# which is expected (Peter's register does change over time).
# If R^2(raw) > 0.5 AND partial correlation is weak, the vector
# is just a time proxy.

import numpy as np
from datetime import datetime

def temporal_confound_check(letter_scores, letter_dates):
    """Check whether identity score correlates with letter date."""
    years = []
    scores = []
    for lid_str, entry in letter_scores.items():
        lid = int(lid_str)
        date = letter_dates.get(lid)
        if date:
            # Convert to ordinal for finer granularity than year
            try:
                ordinal = datetime.strptime(date, "%Y-%m-%d").toordinal()
            except ValueError:
                ordinal = int(date[:4])  # fallback to year
            years.append(ordinal)
            scores.append(entry["mean"])

    x = np.array(years, dtype=np.float64)
    y = np.array(scores, dtype=np.float64)

    r = np.corrcoef(x, y)[0, 1]
    r_sq = r ** 2

    print(f"  Temporal confound: r={r:+.4f}, R^2={r_sq:.4f}")
    if r_sq > 0.5:
        print("  FAIL: R^2 > 0.5 -- vector likely captures time, not identity")
        return False
    elif r_sq > 0.3:
        print("  WARNING: R^2 > 0.3 -- moderate temporal correlation.")
        print("  Check whether this reflects genuine register shift or confound.")
        return True
    else:
        print("  PASS: No strong temporal confound.")
        return True
```

### 1.7 Mitigation recommendations

1. **Accept the structural asymmetry.** The German pole will always be wartime-only. Document this honestly.
2. **Expand Danish-pole seeds into 1916-1918.** Use embedding-neighbor search from known late-war Danish-identity sentences rather than keyword matching. Target at least 10 seeds from 1916-1918.
3. **Spread German-pole seeds across 1914-1918.** The current keyword hits span 1914-1918, but cluster in 1914 and 1916. Ensure representation from 1917-1918 as well.
4. **Report R^2 in the generation script output.** The script already does this (line 288-299). If R^2 > 0.3, flag for review.
5. **Consider a residualized variant.** If R^2 > 0.3, offer a --residualize flag that regresses out the linear time trend and reports residual identity scores. This separates "identity register that tracks time" from "identity register independent of time."
6. **Frame correctly on the website.** If the identity score trends downward over time, that is potentially a real finding (register convergence), not necessarily a confound. The method note must acknowledge this ambiguity.

---

## 2. Cross-Validation Design

### 2.1 Purpose

The identity vector is trained on ~50 seeds per pole. With small seed sets, the vector could be unstable -- driven by a few outlier sentences rather than a robust direction in embedding space. Cross-validation quantifies this stability.

### 2.2 Split-half validation specification

Add a `--validate` flag to `scripts/generate-identity-vector.py` that performs the following:

```
Usage: python scripts/generate-identity-vector.py --validate [--n-splits 20]
```

#### Algorithm

```
1. Load seeds and embeddings (same as normal mode)

2. For k = 1..N_SPLITS (default 20):
   a. Randomly split danish_seeds into two halves: dk_A, dk_B
   b. Randomly split german_seeds into two halves: de_A, de_B
   c. Compute cv_A = normalize(mean(dk_A_emb) - mean(de_A_emb))
   d. Compute cv_B = normalize(mean(dk_B_emb) - mean(de_B_emb))
   e. Record cosine_similarity(cv_A, cv_B)
   f. Score all sentences with cv_A and cv_B
   g. Record Spearman rank correlation between the two score vectors

3. Report:
   - Mean and std of cosine similarities across splits
   - Mean and std of Spearman correlations across splits
   - Minimum cosine similarity observed

4. Thresholds:
   - Mean cosine similarity > 0.70: PASS (stable direction)
   - Mean cosine similarity 0.50-0.70: WARNING (marginal stability)
   - Mean cosine similarity < 0.50: FAIL (unstable, seed set too small or noisy)
   - Mean Spearman correlation > 0.80: PASS (consistent rankings)
   - Mean Spearman correlation < 0.60: FAIL (rankings are not reproducible)
```

#### Leave-one-out variant

For a more granular check, also compute leave-one-out stability:

```
For each seed s in danish_pole + german_pole:
   Compute cv_without_s (excluding seed s)
   Record cosine_similarity(cv_full, cv_without_s)

Report:
   - Mean, min, max cosine similarity
   - Any seed whose removal changes cosine similarity by > 0.05
     (these are "influential seeds" that should be reviewed)
```

### 2.3 Implementation specification

The `--validate` mode should:

1. **Not write any output files.** It is a diagnostic-only mode.
2. **Print a summary table** with pass/fail for each check.
3. **List influential seeds** (leave-one-out cosine drop > 0.05) with their text and letter_id, so the researcher can review whether they belong.
4. **Set exit code 1** if any FAIL threshold is triggered.

### 2.4 Pseudocode for the --validate flag

```python
def run_validation(seeds, embeddings, sentences, n_splits=20):
    """Split-half and leave-one-out validation of identity vector stability."""

    danish_indices = match_seeds_to_indices(seeds["danish_pole"], sentences)
    german_indices = match_seeds_to_indices(seeds["german_pole"], sentences)

    # Full vector for reference
    dk_full = embeddings[danish_indices].mean(axis=0)
    de_full = embeddings[german_indices].mean(axis=0)
    cv_full = normalize(dk_full - de_full)

    # --- Split-half ---
    cosines = []
    spearmans = []
    rng = np.random.default_rng(seed=42)  # reproducible

    for _ in range(n_splits):
        dk_perm = rng.permutation(len(danish_indices))
        de_perm = rng.permutation(len(german_indices))

        dk_A = [danish_indices[i] for i in dk_perm[:len(dk_perm)//2]]
        dk_B = [danish_indices[i] for i in dk_perm[len(dk_perm)//2:]]
        de_A = [german_indices[i] for i in de_perm[:len(de_perm)//2]]
        de_B = [german_indices[i] for i in de_perm[len(de_perm)//2:]]

        cv_A = normalize(embeddings[dk_A].mean(0) - embeddings[de_A].mean(0))
        cv_B = normalize(embeddings[dk_B].mean(0) - embeddings[de_B].mean(0))

        cosines.append(cosine_similarity(cv_A, cv_B))

        scores_A = embeddings @ cv_A
        scores_B = embeddings @ cv_B
        spearmans.append(spearmanr(scores_A, scores_B).correlation)

    print(f"Split-half cosine similarity: "
          f"mean={np.mean(cosines):.4f}, std={np.std(cosines):.4f}, "
          f"min={np.min(cosines):.4f}")
    print(f"Split-half Spearman correlation: "
          f"mean={np.mean(spearmans):.4f}, std={np.std(spearmans):.4f}")

    # --- Leave-one-out ---
    all_indices = danish_indices + german_indices
    loo_cosines = []
    influential = []

    for i, idx in enumerate(all_indices):
        remaining_dk = [j for j in danish_indices if j != idx]
        remaining_de = [j for j in german_indices if j != idx]

        if len(remaining_dk) == 0 or len(remaining_de) == 0:
            continue

        cv_loo = normalize(
            embeddings[remaining_dk].mean(0) - embeddings[remaining_de].mean(0)
        )
        sim = cosine_similarity(cv_full, cv_loo)
        loo_cosines.append(sim)

        if 1.0 - sim > 0.05:
            sent = sentences[idx]
            pole = "danish" if idx in danish_indices else "german"
            influential.append((pole, sent["letter_id"], sent["text"][:80], sim))

    print(f"\nLeave-one-out cosine: "
          f"mean={np.mean(loo_cosines):.4f}, min={np.min(loo_cosines):.4f}")

    if influential:
        print(f"\nInfluential seeds (removal changes cosine by >0.05):")
        for pole, lid, text, sim in influential:
            print(f"  [{pole}] letter {lid}: cos={sim:.4f} -- {text}")
```

---

## 3. Method Note for the Website (Danish)

### Context

The method note follows the established pattern from `SentimentMethodNote.tsx` and `SprogMethodNote.tsx`: a collapsible panel with "Hvad er det her?", "Hvordan virker det?", and "Hvad kan det ikke?" sections. The tone is plain, honest, and accessible.

### Component: `IdentityMethodNote.tsx`

The method note text (to be wrapped in a React component matching the SentimentMethodNote pattern):

---

**Om identitetsanalysen**

*Hvad viser grafen -- og hvad viser den ikke?*

**Hvad er det her?** Grafen viser et maal for, om Peter i en given saetning bruger et *dansk socialt* eller et *tysk militaert* sprogregister. Positive vaerdier betyder, at saetningen minder om de steder, hvor Peter taler om sig selv som dansker, om hjem og familie, om danske kammerater. Negative vaerdier betyder, at saetningen minder om steder med militaert hierarki, tyske titler og kommandosprog.

**Hvordan virker det?** Vi har haandplukket ca. 50 saetninger fra brevene, der tydeligt udtrykker dansk identitet, og ca. 50, der tydeligt bruger tysk militaerregister. En AI-model (den samme som i stemningsanalysen) beregner en retning i et matematisk rum, der adskiller de to grupper. Derefter maales alle 13.577 saetninger i brevene mod denne retning.

**Hvad kan det ikke?** Metoden maaler *sprogregister*, ikke *overbevisning*. At Peter bruger tyske militaerudtryk, betyder ikke, at han foeler sig tysk -- det kan vaere ren noedvendighed. At han taler om "os danskere", fortaeller os, at han bruger den ramme -- ikke hvad han foeler indeni. Moenstrene er *indikationer*, ikke beviser.

**Vigtige forbehold.** Analysen er bygget paa Peters egne breve og kan ikke overfoeres til andre brevsamlinger. De haandplukkede saetninger, der traener modellen, er et fortolkningsvalg -- andre forskere kunne vaelge anderledes. Endelig er der en tidsmessig skavhed: de tyske militaersaetninger findes naesten kun fra krigsaarene (1914-1918), fordi Peter foerst da var soldat. Naar grafen viser en forskel mellem fred og krig, afspejler det baade et reelt registerskift *og* den kendsgerning, at militaersprog foerst dukker op med krigen.

---

### Equivalent with Danish special characters (for copy-paste into TSX)

**Om identitetsanalysen**

*Hvad viser grafen — og hvad viser den ikke?*

**Hvad er det her?** Grafen viser et mål for, om Peter i en given sætning bruger et *dansk socialt* eller et *tysk militært* sprogregister. Positive værdier betyder, at sætningen minder om de steder, hvor Peter taler om sig selv som dansker, om hjem og familie, om danske kammerater. Negative værdier betyder, at sætningen minder om steder med militært hierarki, tyske titler og kommandosprog.

**Hvordan virker det?** Vi har håndplukket ca. 50 sætninger fra brevene, der tydeligt udtrykker dansk identitet, og ca. 50, der tydeligt bruger tysk militærregister. En AI-model (den samme som i stemningsanalysen) beregner en retning i et matematisk rum, der adskiller de to grupper. Derefter måles alle 13.577 sætninger i brevene mod denne retning.

**Hvad kan det ikke?** Metoden måler *sprogregister*, ikke *overbevisning*. At Peter bruger tyske militærudtryk, betyder ikke, at han føler sig tysk — det kan være ren nødvendighed. At han taler om "os danskere", fortæller os, at han bruger den ramme — ikke hvad han føler indeni. Mønstrene er *indikationer*, ikke beviser.

**Vigtige forbehold.** Analysen er bygget på Peters egne breve og kan ikke overføres til andre brevsamlinger. De håndplukkede sætninger, der træner modellen, er et fortolkningsvalg — andre forskere kunne vælge anderledes. Endelig er der en tidsmæssig skævhed: de tyske militærsætninger findes næsten kun fra krigsårene (1914–1918), fordi Peter først da var soldat. Når grafen viser en forskel mellem fred og krig, afspejler det både et reelt registerskift *og* den kendsgerning, at militærsprog først dukker op med krigen.

---

## 4. Summary of Findings and Recommendations

### Temporal bias

| Finding | Severity | Recommendation |
|---------|----------|----------------|
| German pole structurally absent pre-war | Expected | Document as known limitation, do not force artificial balance |
| Danish pole clusters in 1914 (65% of keyword hits) | Moderate | Expand seeds into 1916-1918 via embedding-neighbor search |
| 1.2-year mean temporal separation between poles | Moderate | Report R^2; if >0.3, consider residualized variant |
| Overall corpus 91% wartime | Low | Natural for a war-era letter collection; not actionable |

### Cross-validation

The `--validate` mode specification provides two levels of stability checking:

1. **Split-half** (20 random splits): tests whether halving the seed set still produces the same direction. Threshold: mean cosine > 0.70.
2. **Leave-one-out**: identifies individual seeds whose removal disproportionately shifts the vector. Any seed causing cosine drop > 0.05 should be reviewed.

Given the current seed counts (46 Danish, 27 German), the German pole is most at risk of instability because 27 seeds split into halves of ~13 is thin. If split-half cosine drops below 0.70, the primary mitigation is to add more German-pole seeds, not to relax the threshold.

### Method note

The Danish method note follows the established pattern (collapsible, three-part structure, honest about limitations). Key framing choices:

- Uses "sprogregister" (language register) rather than "identitet" (identity) as the primary descriptor
- States explicitly that the method cannot distinguish pragmatic code-switching from genuine identity shift
- Acknowledges the temporal confound in plain language ("de tyske militærsætninger findes næsten kun fra krigsårene")
- Labels results as "indikationer, ikke beviser" (indications, not proof), matching the ADR's "mønstre, ikke beviser"

### Implementation priority

1. Implement `--validate` mode in `generate-identity-vector.py`
2. Run validation on current prototype seeds (46+27)
3. If split-half cosine < 0.70, expand seed sets before proceeding
4. Create `IdentityMethodNote.tsx` component using the text above
5. Report R^2 in the generation script; add `--residualize` flag if R^2 > 0.3
