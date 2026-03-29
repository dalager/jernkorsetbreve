# How the Emotion Vectors Work

The script `generate-emotion-vectors.py` uses the **Concept Vector Projection (CVP)** method:

1. Load the [GoEmotions dataset](https://huggingface.co/datasets/google-research-datasets/go_emotions) (~58k English Reddit comments labeled with 27 emotions + neutral)
2. For each target emotion, split sentences into **positive pole** (sentences labeled with that emotion) and **negative pole** (sentences labeled with the opposite)
3. Embed both poles with `paraphrase-multilingual-mpnet-base-v2` (multilingual model -- works for Danish scoring even though training data is English)
4. Concept vector = `mean(positive embeddings) - mean(negative embeddings)`, normalized
5. To score a Danish sentence: embed it, dot-product with the concept vector -> scalar score

The four emotions were chosen with specific pole definitions (see `generate-emotion-vectors.py` lines 63-80):

| Emotion | Positive pole labels | Negative pole labels | Rationale |
|---------|---------------------|---------------------|-----------|
| fear | fear, nervousness | neutral | Combat anxiety |
| grief | grief, sadness | neutral | Loss of comrades |
| hope | optimism | disappointment, sadness | Longing for war's end |
| love | love, caring | neutral | Letters to wife/parents |

## Can more emotions be added?

Yes, straightforwardly. GoEmotions has **27 emotion labels** available (defined in `LABEL_IDS`, lines 52-60 of `generate-emotion-vectors.py`):

> admiration, amusement, anger, annoyance, approval, caring, confusion, curiosity, desire, disappointment, disapproval, disgust, embarrassment, excitement, fear, gratitude, grief, joy, love, nervousness, optimism, pride, realization, relief, remorse, sadness, surprise

### What it takes to add one

1. **Add a definition** to `EMOTION_DEFS` in `generate-emotion-vectors.py` -- pick positive and negative pole labels
2. **Add validation sentences** in Danish to `VALIDATION_SENTENCES` for sanity-checking
3. **Run the script** -- it generates `data/cvp-{emotion}-vector.csv`
4. **Add scoring** in `generate-emotions-cvp.py` to compute per-letter scores using the new vector
5. **Update the website** components to display the new channel

### Candidates that would be historically interesting for Peter's letters

| Emotion | Pole definition | Why relevant |
|---------|----------------|--------------|
| **anger** | anger, annoyance vs neutral | Frustration with military life, censorship |
| **gratitude** | gratitude vs neutral | Thanking Trine for packages, letters |
| **pride** | pride vs neutral | Military identity, duty |
| **remorse** | remorse vs neutral | Guilt about being away, about combat |
| **relief** | relief vs neutral | After surviving battles, receiving news |
| **desire** | desire vs neutral | Longing for home, for the war to end |

The main constraint is that each emotion needs enough GoEmotions training sentences in its positive pole (minimum 100, see line 109 of `generate-emotion-vectors.py`). Rare emotions like `grief` (only ~100 examples) work but have noisier vectors. Common ones like `anger` (~3000 examples) or `gratitude` (~2500) would produce very robust vectors.

The cross-lingual transfer (English training -> Danish scoring) works because the multilingual MPNet model shares embedding space across languages, but emotions with very culture-specific expression patterns may transfer less cleanly.
