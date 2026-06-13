# Jernkorset.dk -- om projektet og mig

## Hovedpunkter
- Fra pen til skrivemaskine til scanner til word til web til AI-venligt datasæt
- Mine interesser: sprog/formidling, teknologi, sprogteknologi, AI -> Jernkorset.dk som eksperiment-platform.
- Om data og at rense det - tekstproblematikker. Stedsangivelser til geografiske punkter.
- Gennemgang af jernkorset.dk

## Gennemgang af jernkorset.dk

- Brevene
- Personer
- Steder
- Billeder
- Kort
- Tidslinje
- Søgning


## Om semantisk søgning og embeddingmodeller
Fortæl om hvad en sprogmodel er.
Lav en illustration af vektorspace og ord/begreber og brug eksempler fra brevene til at vise hvordan ord er tæt på lignende ord og begreber.

> **Visualisering:** interaktivt vektorrum med 44 ord fra brevene, placeret med samme model
> som siden bruger (`multilingual-e5-small`, 384 dim → 2D via UMAP). Hvert ord er repræsenteret
> af gennemsnittet af de brevsætninger hvor ordet faktisk optræder. Hold musen over et ord for
> at se nærmeste naboer + et rigtigt citat fra brevene.
>
> - **På sitet:** `/ordrum/` (under Analyser) — med **2D/3D-skift**. 3D-visningen (rotér rummet)
>   bruges til at forklare embedding-rummets høje dimensionalitet (384 dimensioner presset til 3).
> - **Standalone til slides:** `embedding-viz/index.html` (2D, dobbeltklik, virker offline).
> - **Regenerér data:** `npm run data:wordspace` (UMAP til både 2D og 3D; skriver til sitet og standalone-kopien).
