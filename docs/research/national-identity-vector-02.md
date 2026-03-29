# National Identity Concept Vector — Research Notes

## Background

Peter Mærsk was a Danish-speaking Sønderjyde forced into German military service during WW1. A natural question is whether his letters reveal drift in national identity or loyalty over time — does he become more "German-military" in register, or does he maintain a Danish frame of reference?

## Approach: Corpus-specific Concept Vector Projection

Unlike the GoEmotions-based emotion vectors (fear, grief, hope, love, etc.), there is no external labeled dataset for "Danish identity" vs "German military identity". Instead, we use a **seed-sentence approach** on the existing sentence embeddings:

1. Identify sentences expressing Danish identity (keywords: "danskere", "danske", "dansk hurra", "sønderjylland", "nordslesvig", "hjemland", "modersmål")
2. Identify sentences expressing German military identity (keywords: "kejser", "jernkorset", "pligt", "tysk soldat", "tyske rige", "troskab")
3. Compute mean embedding for each pole
4. Identity vector = `mean(Danish embeddings) - mean(German embeddings)`, normalized
5. Score all sentences: positive = Danish-leaning, negative = German/military-leaning

## Seed Sentences Found

- **Danish pole**: 46 seed sentences from the corpus
- **German/military pole**: 27 seed sentences from the corpus
- **Cached embeddings**: 13,577 sentences × 768 dimensions already available at `data/.cache/sentence-embeddings.npy`

## Key Finding: Independence from Sentiment

The identity vector has **cosine similarity of -0.02** with the existing sentiment concept vector. This means it captures a completely independent dimension — not "happy Danish" vs "sad German", but genuinely different framing regardless of emotional valence.

## What the Vector Captures

### Danish-leaning (high positive scores)

Sentences about:
- Identifying as part of the Danish group ("Vi er 6 danskere", "alle os danskere")
- References to Danish homeland geography (Jylland, København, Skærbæk, Sønderjylland)
- Speaking Danish, being among Danish-speakers
- Danish social and cultural context

Top examples:
- [35] "Først om Danskerne."
- [90] "Af mine danske kammerater er alle levende."
- [46] "Jeg synes det er helt godt skrevet, man kan da se, at de alligevel ser op til os danskere."
- [33] "Men det var jo dog mere hjemlig, om der havde været en dansk iblandt."

### German/military-leaning (high negative scores)

Sentences about:
- Military hierarchy (Major, Oberstleutnant, General, Leutnant)
- Awards and promotions (Jernkorset, Orden, Underofficer)
- Commands, orders, military structure
- Formal military language register

Top examples:
- [343] "Og jeg måtte egentlig ikke komme afsted endnu, da Majoren ville have, at jeg først skulle have Jernkorset..."
- [273] "Majoren tog to pakker op af Lommen, dekorerede dem med Jernkorset, og de blev straks Underofficerer."
- [529] "Jeg sagde, da han spurgte... 'Herr Oberstl. en Soldat må ikke sige alt, hvad han ved'."

### Explicit Identity Tension Sentences

These are particularly valuable — sentences where Peter directly addresses the tension:

- [59] "Ja, nu har vi lovet den tyske Kejser troskab." (+0.61, framed positively but stating German oath)
- [59] "Jeg frygtede ellers for den dag, for det er jo ikke så let for os, at love ham troskab og forsvare det tyske Rige, når v..." (-0.32, explicitly difficult)
- [591] "Så jeg er snart mere Englænder end - tysk Soldat." (+0.16, ironic identity commentary)
- [397] "Da jeg så sagde God dag på tysk, men blev af ham tiltalt på Dansk, så tænkte jeg, å ja så er det jo dog tilladt at tale..." (+0.28, language-as-identity)
- [612] "Mor skrev i dag, at Dagny Brodersen fra Ottesbøl havde forlovet sig med en Tysker, det var da kedelig..." (-0.09, social boundary)
- [502] "Om Aftenen var Madsen her, og vi kavlede så halvt på tysk halvt på dansk, for at Konov også kunne forstå noget." (-0.07, code-switching)

## Methodological Difference from GoEmotions Vectors

The emotion vectors (fear, grief, hope, love, anger, etc.) are trained on an external dataset (GoEmotions, ~58k English Reddit comments) and transferred cross-lingually. The identity vector would be trained on Peter's own corpus. This is:

- **More authentic**: Captures Peter's specific register patterns, not generic "identity language"
- **Less generalizable**: Only valid for this corpus
- **Requires honest framing**: "We trained the identity vector on manually curated sentences from the corpus itself" — patterns, not external ground truth

## Suggested Pole Curation

The keyword-based seed finding is a good start but needs manual curation:
- Remove noisy matches (e.g., "ære" matching "kære" was caught and fixed with word boundaries)
- Add good sentences surfaced by the semantic nearest-neighbor search
- Balance pole sizes (currently 46 vs 27 — should aim for ~50 each)
- Exclude sentences that are ambiguous or express the tension itself (save those for analysis, not training)

## Next Steps

1. Write ADR for implementation
2. Create a script (`scripts/generate-identity-vector.py`) following the CVP pattern
3. Manual curation step for seed sentences (possibly as a JSON file)
4. Score all sentences and aggregate per-letter
5. Visualize identity drift over time on the Sproganalyse page
