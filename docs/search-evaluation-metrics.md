# Søgekvalitet: Metrics forklaret

Evalueringsframeworket (se [ADR-013](adr/ADR-013-search-evaluation-framework.md)) måler søgekvaliteten med fem standard Information Retrieval (IR) metrics. Hver metric besvarer et forskelligt spørgsmål om søgningens kvalitet.

## Precision@k

**"Hvor mange af de øverste k resultater er faktisk relevante?"**

```
Precision@5 = antal relevante i top 5 / 5
```

Eksempel: Hvis 3 ud af de 5 øverste resultater er relevante → P@5 = 0.60

Måler *renhed* af resultater. Høj precision = få irrelevante resultater i toppen.

## Recall@k

**"Hvor mange af alle relevante breve fandt vi i top k?"**

```
Recall@10 = antal relevante fundet i top 10 / totalt antal relevante
```

Eksempel: 4 fundet ud af 10 relevante breve i alt → R@10 = 0.40

Måler *fuldstændighed*. Høj recall = vi misser ikke vigtige breve. For forespørgsler med mange relevante breve (f.eks. "breve fra december 1917" med 22 relevante) vil recall naturligt være lavere ved k=10.

## MRR (Mean Reciprocal Rank)

**"Hvor hurtigt dukker det første gode resultat op?"**

```
MRR = 1 / position af første relevante resultat
```

Eksempler:
- Første relevante resultat på plads 1 → 1/1 = 1.000
- Første relevante resultat på plads 3 → 1/3 = 0.333
- Første relevante resultat på plads 10 → 1/10 = 0.100

Måler "I'm feeling lucky"-oplevelsen. Høj MRR = brugeren ser noget brugbart med det samme. MRR rapporteres som gennemsnit over alle forespørgsler.

## nDCG@k (Normalized Discounted Cumulative Gain)

**"Er de *bedste* resultater rangeret højest?"**

Den mest informative enkeltstående metric. nDCG adskiller sig fra de øvrige ved at bruge *gradueret relevans* (0 = irrelevant, 1 = delvist relevant, 2 = meget relevant) i stedet for binær ja/nej.

```
DCG@k  = Σ (2^relevans - 1) / log₂(position + 1)    for position 1..k
nDCG@k = DCG@k / idealDCG@k
```

- Et meget relevant brev (grad 2) på plads 1 scorer langt bedre end på plads 10
- Normaliseret mod den ideelle rækkefølge, så 1.0 = perfekt rangering
- Straffer både manglende resultater og dårlig rækkefølge

Eksempel med 3 resultater (relevans i parentes):

| Rangering | Faktisk | Ideel |
|-----------|---------|-------|
| 1 | brev A (1) | brev C (2) |
| 2 | brev B (0) | brev A (1) |
| 3 | brev C (2) | brev B (0) |

Her er nDCG < 1.0 fordi det mest relevante brev (C, grad 2) først dukker op på plads 3.

## Rapportering

Metrics rapporteres på tre niveauer:

### Per tier
| Tier | Antal | Beskrivelse |
|------|-------|-------------|
| **Factual** | 30 | Dato, afsender, modtager — verificerbar fra metadata |
| **Topical** | 30 | Emner som sygdom, jul, kamp — kræver indholdslæsning |
| **Semantic** | 20 | Følelser som ensomhed, frygt, kærlighed — kræver dybere forståelse |

### Per dimension
| Dimension | Eksempel |
|-----------|----------|
| **temporal** | "breve fra december 1917" |
| **person** | "breve fra Uffe" |
| **topical** | "sygdom og lazaret" |
| **emotional** | "ensomhed og savn ved fronten" |
| **cross-lingual** | Moderne dansk forespørgsel → arkaisk dansk tekst |

### Samlet (aggregate)
Gennemsnit over alle 80 forespørgsler.

## Baseline (multilingual-e5-small)

Etableret 2026-03-27 med det nuværende embedding-model:

| Metric | Samlet | Factual | Topical | Semantic |
|--------|--------|---------|---------|----------|
| nDCG@10 | 0.053 | 0.043 | 0.064 | 0.051 |
| MRR | 0.137 | 0.113 | 0.133 | 0.179 |
| P@5 | 0.048 | 0.040 | 0.060 | 0.040 |
| P@10 | 0.036 | 0.027 | 0.043 | 0.040 |
| R@10 | 0.055 | 0.034 | 0.065 | 0.069 |

### Fortolkning

De lave scores er forventede og informative:

- **Person/metadata-forespørgsler** scorer nær nul fordi embeddings koder *indholdssemantik*, ikke metadata. Modellen kan ikke vide at brev 178 er "fra Trine" blot fra tekstens embedding.
- **Emneforespørgsler** scorer lidt bedre fordi indholdsnøgleord korrelerer med embeddings.
- **Semantiske forespørgsler** scorer også lavt, primært fordi arkaisk dansk ("kjære", "faaet", "Eder") afviger fra de moderne danske forespørgsler.

Disse baseline-scores gør det muligt at måle effekten af fremtidige forbedringer som tekstmodernisering ([ADR-014](adr/ADR-014-archaic-danish-modernization.md)).

## Brug

```bash
# Kør evaluering
npm run eval:search

# Med detaljeret per-query output
npm run eval:search:verbose

# Gem resultater som JSON til sammenligning
npm run eval:search:save

# Sammenlign to modeller
node scripts/evaluate-search.mjs --compare \
  --a data/embeddings-model-a.bin --model-a Xenova/model-a \
  --b data/embeddings-model-b.bin --model-b Xenova/model-b
```

Resultater gemmes i `tests/search-eval/results/` som tidsstemplede JSON-filer.
