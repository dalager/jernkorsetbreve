# Identity Concept Vector — Validation Assessment

Date: 2026-03-31

## Context

This assesses the validity of the national identity concept vector (ADR-038) — a CVP method that scores each sentence on a spectrum from Danish social register to German military register, trained on 82 curated seed sentences from the corpus itself.

## What checks out

**The vector is measuring something real and independent.** Five things give confidence:

1. **Independence from sentiment** (cosine sim 0.07) — this is not just picking up mood. A sad letter about Danish comrades and a sad letter about German battles score differently.

2. **The temporal pattern holds on non-seed letters.** Even when you strip out all 71 letters that contain seed sentences, the same yearly arc appears: pre-war high (+0.19 in 1913), drop at mobilisation (+0.12 in 1914), recovery in 1917-18 (+0.14). The vector generalises beyond its training examples.

3. **The pre-war vs wartime difference is statistically significant.** Permutation test p=0.003 for the overall gap, p=0.0004 for the 1913-to-1914/15 drop. This is not noise.

4. **The extremes make sense.** The most German-leaning letters (89, 113) describe combat, military hierarchy, and institutional life. The most Danish-leaning describe homeland longing, Danish group gatherings, and family context. A human reader would classify them the same way.

5. **R-squared with date is 0.003** — the vector is not just measuring "early vs late letter." Whatever it captures is orthogonal to time.

## What's fragile

**The seed curation is the weakest link.** Three concerns:

1. **Danish seeds cluster heavily in 1914** (25 of 45 = 56%). This is the mobilisation year when Peter says "vi danskere" most often — for obvious reasons. But it means the Danish pole is partly "mobilisation register" rather than pure "Danish identity register." If you re-curated with more pre-war and late-war Danish seeds, the vector could shift.

2. **Only 82 seeds from 13,577 sentences (0.6%).** The vector is defined by a tiny fraction of the corpus. Split-half cross-validation is the right test: randomly split the 45 Danish seeds into two groups of ~22, build two independent vectors, and check if they agree (cosine sim > 0.7). If they don't, the vector is unstable. This can be done without re-embedding — just re-average the cached embeddings.

3. **The German pole has fewer seeds (37) from fewer letters (34).** The German pole may not adequately represent the full range of German military register.

## What's speculative

**The historical narrative built on the scores is interpretive, not proven.** The numbers are:

| Period | Mean | n |
|--------|------|---|
| Pre-war | +0.168 | 36 |
| Wartime | +0.128 | 629 |

The difference (0.04 on a scale roughly -0.2 to +0.5) is statistically significant but small. The standard deviation within any year (~0.09) is twice the effect size. This means most wartime letters overlap completely with pre-war letters in their identity register. The narrative "Peter's Danish identity drops and then recovers" is one reading; another equally valid reading is "Peter's letters are fundamentally Danish throughout, with slightly more military vocabulary during the war, as you'd expect."

The yearly means are all positive. Peter never shifts to a German register on average. The 1913 peak (+0.21) is based on only 13 letters with high variance (std 0.12). It could be an outlier year.

### Recipient analysis

| Recipient | Mean | Std | n |
|-----------|------|-----|---|
| Mor og far | +0.126 | 0.088 | 422 |
| Trine Maersk | +0.135 | 0.089 | 215 |
| Peter Maersk (inbound) | +0.144 | 0.087 | 18 |

The differences between recipients are small (0.009) and within the noise. The vector does not reveal a strong audience adaptation effect for identity register.

### Score distribution

| Score range | Letters | % |
|-------------|---------|---|
| [-0.20, 0.00) | 46 | 6.9% |
| [0.00, 0.05) | 53 | 8.0% |
| [0.05, 0.10) | 123 | 18.5% |
| [0.10, 0.15) | 195 | 29.3% |
| [0.15, 0.20) | 132 | 19.8% |
| [0.20, 0.30) | 90 | 13.5% |
| [0.30, 0.50) | 25 | 3.8% |

47 of 665 letters (7%) have a negative mean — i.e., lean German-military on average. 577 of 665 (87%) have at least one sentence in the 10th percentile below zero, meaning nearly every letter contains some German-register language. The within-letter spread (mean p90-p10 = 0.56) is large relative to the between-year variation (0.04).

## How to substantiate it

Three tests that can be done with the data that exists, without re-running ML models:

### 1. Split-half stability test

Take the 45 Danish seeds, randomly split into two groups of ~22, compute two independent vectors from the cached embeddings (`data/.cache/sentence-embeddings.npy`), and check their cosine similarity. Do the same for the German seeds. Repeat 100 times. If the median cosine sim > 0.7, the vector is stable. If < 0.5, it's too dependent on individual seed choices.

### 2. Leave-one-out on seed letters

For each of the 71 seed-containing letters, drop all seeds from that letter, recompute the vector, and re-score the corpus. If the yearly pattern survives across all 71 runs, the finding is robust. If removing letter 33 (which has multiple Danish seeds) changes the story, the findings are fragile.

### 3. Blind human validation

Pick 50 random non-seed sentences (stratified by score: 15 high, 15 low, 20 mid-range). Have a human classify each as "Danish register", "German/military register", or "neutral" without seeing the score. Then compare. If the human and the vector agree >70% of the time on the high/low sentences, the vector captures what it claims. If they disagree, the vector may be capturing something else (sentence length, formality, topic).

## Verdict

The method is sound — corpus-specific concept vectors are established in computational linguistics. The statistical signal is real (p < 0.01). The independence checks pass. The extremes are face-valid.

But it is currently validated by plausibility rather than by rigorous testing. The three tests above would move it from "interesting and plausible" to "defended." Without them, any claims should be framed as patterns observed in the data, not as proven findings about Peter's identity.

## Independence from other vectors

| Vector | Cosine similarity |
|--------|-------------------|
| Sentiment (concept) | +0.069 |
| Fear | +0.028 |
| Grief | +0.083 |
| Hope | -0.045 |
| Love | +0.159 |
| Anger | +0.058 |
| Gratitude | +0.081 |
| Pride | -0.025 |
| Remorse | +0.087 |
| Relief | +0.060 |
| Desire | -0.002 |

The highest correlation is with love (+0.16), which is plausible — letters expressing love (to wife, family) tend to be written in a Danish domestic register. This is not a confound; it reflects the genuine co-occurrence of love and Danish framing in homeland-directed letters.
