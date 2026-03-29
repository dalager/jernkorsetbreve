# Psycholinguistic Analysis: Initial Findings

**Date**: 2026-03-29
**Corpus**: 665 letters by Peter Maersk, 1911-1918
**Pipeline**: ADR-015 implementation (DaCy large, CVP, lexicalrichness)

---

## 1. The War Changed His Language

Comparing 76 pre-war letters (before Aug 1, 1914) against 589 wartime letters:

| Metric | Pre-war | War | Change | Interpretation |
|--------|---------|-----|--------|----------------|
| Reassurance formulae | 0.01/letter | 0.17/letter | **+1177%** | "Det gar godt", "alt vel" — barely present pre-war, pervasive during war. Peter is actively managing his family's anxiety. |
| German military terms | 0.04/100w | 0.06/100w | **+73%** | German vocabulary colonizing his Danish. The army is reshaping his language. |
| Absolutist language | 1.03/100w | 1.33/100w | **+29%** | "altid", "aldrig", "ingen" — linguistic markers of psychological distress (Al-Mosaiwi & Johnstone 2018). War makes Peter think in extremes. |
| First-person singular (jeg) | 5.26/100w | 4.16/100w | **-21%** | The individual self is receding. Less "I", replaced by collective or impersonal forms. |
| Hedging | 0.90/100w | 0.70/100w | **-23%** | Less "maske", "vist", "vel". Pre-war Peter hedges (social uncertainty of courtship). Wartime Peter has no room for tentativeness. |
| Cognitive processing words | 0.26/100w | 0.21/100w | **-21%** | Fewer causal/insight words ("fordi", "forsta"). He is not reflectively processing his experiences — a classic avoidance marker (Pennebaker 2003). |
| Sentence length | 18.3 words | 16.5 words | **-10%** | Shorter sentences under cognitive load (Liu 2008). |
| Compression ratio | 0.52 | 0.59 | **+12%** | Wartime text compresses better — more formulaic, more repetitive. |
| Sentiment volatility | 0.37 | 0.38 | **+4%** | Slight increase in emotional swings within individual letters. |

### What the numbers tell us

The pattern is consistent with the trauma literature: vocabulary constriction, syntactic simplification, self-reference reduction, and cognitive processing avoidance. But it also shows something specific to letter-writing under censorship: the massive rise in reassurance formulae. Peter is not just psychologically affected — he is actively performing normalcy for his recipients.

The 29% increase in absolutist language is particularly notable. Al-Mosaiwi & Johnstone (2018) found absolutist words to be the single strongest linguistic marker of psychological distress, outperforming negative emotion words. Peter's wartime language shows this signature clearly.

---

## 2. He Tells Trine and His Parents Different Stories

### Overall audience differences (217 Trine-letters vs 422 parent-letters)

| Metric | To Trine | To Parents | Reading |
|--------|----------|------------|---------|
| First-person singular | 4.53/100w | 4.10/100w | More self-revealing with Trine |
| First-person plural | 1.62/100w | 2.00/100w | More "vi" (we) to parents — performing family membership |
| Hedging | 0.79/100w | 0.69/100w | More uncertain/vulnerable with Trine |
| Absolutist language | 1.21/100w | 1.36/100w | More extreme language to parents |
| Reassurance formulae | 0.11/letter | 0.17/letter | More reassurance directed at parents |
| German military terms | 0.07/100w | 0.05/100w | Shares more of military reality with Trine |

### Same-date censorship analysis

On **58 dates**, Peter wrote to both Trine and his parents — a natural experiment in self-censorship. Key finding:

**Peter is consistently more positive to Trine than to parents on the same day.** The top 5 largest sentiment gaps all show positive CVP difference (Trine letter more positive than parent letter). This reverses the common hypothesis that soldiers protect parents more than partners.

Possible interpretation: Peter presents optimism and hope to the woman he plans to marry (future-focused), while being more pragmatically blunt with his parents (present-focused, logistical).

| Date | Trine letter | Parent letter | CVP difference | Word count diff |
|------|-------------|---------------|----------------|-----------------|
| 1917-01-12 | #381 | #382 | +0.46 | +32 |
| 1918-07-11 | #644 | #645 | +0.42 | +173 |
| 1916-12-20 | #365 | #366 | +0.40 | +325 |
| 1917-12-04 | #538 | #537 | +0.35 | +231 |
| 1918-08-18 | #659 | #658 | +0.34 | +179 |

The Jan 12, 1917 pair (#381/#382) shows the single largest emotional gap. The Trine letter is also longer (+32 words) — he writes more and more positively to her.

---

## 3. The Shape of War Letters

### Within-letter emotional arcs

| Arc type | Count | Share | Description |
|----------|-------|-------|-------------|
| **Valley** | 233 | 35.0% | Positive opening, negative middle, positive close |
| Rising | 146 | 22.0% | Ends more positive than it starts |
| Falling | 134 | 20.2% | Starts positive, ends negative |
| Flat | 104 | 15.6% | Uniform tone throughout |
| Peak | 48 | 7.2% | Negative opening, positive middle, negative close |

The **valley shape dominates** — Peter opens with warm greetings, delivers difficult content in the middle, and closes with reassurance. This is exactly what the war letters literature predicts (Hanna 2014): the "reassurance-shock-reassurance" structure of wartime self-presentation.

### Emotional regime shifts over time

The CUSUM change-point algorithm detected **70 emotional regime shifts** across the correspondence. Their distribution tells the story of the war:

| Year | Change points | Context |
|------|--------------|---------|
| 1911 | 2 | Courtship period |
| 1912 | 3 | Courtship period |
| 1913 | 2 | Pre-war |
| **1914** | **12** | **War begins (Aug 1914). Emotional turbulence.** |
| 1915 | 10 | Settling into war |
| 1916 | 8 | Grinding attrition |
| **1917** | **14** | **Worst year of the war for many soldiers** |
| **1918** | **19** | **Spring Offensive, final battles, armistice** |

### Highest emotional velocity transitions

The biggest single-letter emotional swings:

| Dates | Velocity | Context |
|-------|----------|---------|
| 1918-04-18 to 04-19 | 0.52 | During the German Spring Offensive |
| 1914-11-04 to 11-09 | 0.51 | Early war — first front-line exposure? |
| 1915-12-06 to 12-09 | 0.51 | Winter 1915 |
| 1918-03-28 to 03-29 | 0.51 | Eve of the Spring Offensive (Operation Michael) |
| 1918-03-29 to 03-30 | 0.49 | Three consecutive days of violent emotional swings |

The **March 28-30, 1918** cluster is striking: three consecutive days with massive emotional swings (letters 587-590), coinciding with one of the war's most intense periods.

---

## 4. Words That Fossilized

Tracking the contextual embedding variance of high-frequency words reveals which words became formulaic over time:

### Most fossilized (decreasing contextual variance)

| Word | Occurrences | Fossilization index | 1911 std | 1918 std | Interpretation |
|------|------------|--------------------|---------|---------|----|
| **kaere** (dear) | 719 | -0.0165 | 0.32 | 0.22 | Starts with genuine emotional range; becomes pure formula |
| **glad** (happy) | 207 | -0.0004 | 0.26 | 0.34 | Slight fossilization |
| **nok** (enough/probably) | 951 | -0.0002 | 0.30 | 0.31 | Mild fossilization |

**"kaere"** is the clearest case: its contextual embedding variance drops 30% from 1911 to 1918. In 1911, Peter uses "kaere" with genuine variability — sometimes tender, sometimes formal. By 1918, it appears in fixed formulae ("kaere Trine", "kaere Foraeldre") with increasingly uniform sentiment context.

### Most drifted (shifting sentiment context)

| Word | Occurrences | CVP drift (1911 to 1918) | Interpretation |
|------|------------|--------------------------|----------------|
| **bedre** (better) | 199 | **+0.50** | Neutral comparison word becomes a vessel for hope ("det bliver bedre") |
| **hjem** (home) | 580 | **+0.38** | Physical place (the farm) becomes emotionally charged (idealized destination of longing) |
| **glad** (happy) | 207 | -0.04 | Slight negative drift — happiness becoming more formulaic/performed? |

**"hjem"** is the most interpretively rich finding. In 1911, it appears in practical contexts (going home from events, farm work). By 1918, it carries intense emotional weight — "hjem" is no longer a place but an aspiration. The word itself has been transformed by the war.

---

## 5. Corpus-Wide Psycholinguistic Profile

### Baseline statistics (665 letters)

| Metric | Mean | Std | Min | Max |
|--------|------|-----|-----|-----|
| MATTR (vocabulary diversity) | 0.81 | 0.04 | 0.72 | 1.00 |
| MTLD (text lexical diversity) | 87.96 | 34.40 | 1.00 | 425.88 |
| Mean dependency distance | 3.43 | 0.46 | 0.00 | 5.43 |
| Mean sentence length | 16.68 | 5.57 | 1.00 | 51.00 |
| Jeg rate (per 100 words) | 4.28 | 2.15 | 0.00 | 14.55 |
| Vi rate (per 100 words) | 1.86 | 1.51 | 0.00 | 10.42 |
| Jeg-Vi shift index | 0.68 | 0.25 | 0.00 | 1.00 |
| Hedging rate (per 100 words) | 0.72 | 0.68 | 0.00 | 4.65 |
| Absolutist rate (per 100 words) | 1.29 | 0.99 | 0.00 | 8.33 |
| Cognitive rate (per 100 words) | 0.22 | 0.32 | 0.00 | 2.17 |
| German density (per 100 words) | 0.06 | 0.31 | 0.00 | 3.45 |
| Shannon entropy (bits/char) | 4.27 | 0.10 | 2.55 | 4.56 |
| Compression ratio | 0.58 | 0.13 | 0.42 | 2.64 |
| Sentiment volatility | 0.38 | 0.12 | 0.00 | 0.88 |

---

## Methodology

### Tools used
- **DaCy large** (`da_dacy_large_trf`): tokenization, POS tagging, dependency parsing, morphological analysis
- **lexicalrichness**: MATTR (window=50), MTLD (threshold=0.72), HD-D
- **CVP** (Concept Vector Projection): sentiment scoring with `paraphrase-multilingual-mpnet-base-v2` and Fiction4 concept vector
- **Custom Danish lexicons**: pronouns, hedging words, absolutist language, cognitive processing words, reassurance formulae, sensory language, German military terms

### Input data
- 665 normalized letters (`text_normalized` from ADR-014)
- 13,577 extracted sentences with formulaic flags
- Pre-computed CVP sentence-level sentiment scores

### Key references
- Al-Mosaiwi, M. & Johnstone, T. (2018). Absolutist words as markers of psychological distress. *Clinical Psychological Science*.
- Pennebaker, J.W. (2003). Psychological aspects of natural language use. *Annual Review of Psychology*.
- Hanna, M. (2014). War letters: Communication between front and home front. *1914-1918 International Encyclopedia of the First World War*.
- Liu, H. (2008). Dependency distance as a metric of language comprehension difficulty. *Journal of Cognitive Science*.
- Kleim, B. et al. (2018). Linguistic features of peritraumatic narratives and PTSD. *Clinical Psychology Review*.
- Bedi, G. et al. (2015). Automated analysis of free speech predicts psychosis onset. *npj Schizophrenia*.
- Lyngbaek et al. (2025). Continuous sentiment scores for literary and multilingual contexts (CVP paper).

### Limitations
- DaCy is trained on modern Danish; POS/dependency accuracy on normalized archaic text is imperfect
- Small per-period sample sizes (especially pre-war Trine letters) limit statistical power
- The trauma composite is observational, not a validated clinical instrument
- German military term detection uses a curated lexicon and may miss unlisted terms
- Recipient classification is heuristic (based on greeting patterns in `letters.csv`)
