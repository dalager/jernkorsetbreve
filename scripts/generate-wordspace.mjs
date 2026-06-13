#!/usr/bin/env node

/**
 * generate-wordspace.mjs
 *
 * Builds a word-level embedding-space dataset for the "Ordrum" page and the
 * project presentation. Embeds a curated set of words/concepts that actually
 * occur in the Jernkorset letters, using the SAME model the site uses
 * (Xenova/multilingual-e5-small, 384-dim), projects them to 2D with UMAP, and
 * finds each word's true nearest neighbours in the full 384-dim space.
 *
 * Each concept is represented by the CENTROID of the modernized letter
 * sentences in which the word appears — i.e. the word as it is actually used in
 * the corpus, not a dictionary definition. e5 is a sentence model: bare single
 * words cluster by spelling (krig→kirke), context-grounding fixes that.
 *
 * Outputs (single source of truth, kept in sync):
 *   - apps/website/public/data/wordspace.json      (consumed by /ordrum/)
 *   - docs/presentations/2026-06-13/embedding-viz/wordspace.json
 *   - docs/presentations/2026-06-13/embedding-viz/wordspace.js  (file:// global)
 *
 * Run:  npm run data:wordspace   (or: node scripts/generate-wordspace.mjs)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline, env } from '@huggingface/transformers';
import { UMAP } from 'umap-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const DATA_DIR = join(PROJECT_ROOT, 'apps', 'website', 'public', 'data');
const CORPUS_PATH = join(DATA_DIR, 'search-corpus.json');
const WEBSITE_OUT = join(DATA_DIR, 'wordspace.json');
const PRES_DIR = join(PROJECT_ROOT, 'docs', 'presentations', '2026-06-13', 'embedding-viz');

const MODEL_NAME = 'Xenova/multilingual-e5-small';
env.cacheDir = join(PROJECT_ROOT, '.cache', 'models');
env.allowLocalModels = true;

// ---------------------------------------------------------------------------
// Curated vocabulary — real words from the corpus, grouped by theme.
// ---------------------------------------------------------------------------
const THEMES = {
  krig:     { da: 'Krig & front',     words: ['krig', 'soldat', 'skyttegrav', 'granat', 'kanon', 'front', 'kugle', 'fjende', 'sår', 'fange'] },
  hjem:     { da: 'Hjem & familie',   words: ['hjem', 'mor', 'far', 'kone', 'barn', 'familie', 'gård', 'jul'] },
  folelser: { da: 'Følelser',         words: ['håb', 'glæde', 'sorg', 'længsel', 'frygt', 'savn', 'fred', 'kærlighed'] },
  natur:    { da: 'Natur & hverdag',  words: ['skov', 'mark', 'regn', 'kulde', 'sult', 'brød', 'søvn', 'tobak'] },
  tro:      { da: 'Tro',              words: ['Gud', 'bøn', 'kirke', 'himmel', 'død'] },
  brev:     { da: 'Brevet',           words: ['brev', 'hilsen', 'skrive', 'tak', 'penge'] },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function matchingSentences(word, sentenceIndex) {
  const re = new RegExp('(^|[^a-zà-ÿ])' + word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return sentenceIndex.filter((s) => re.test(s.text));
}

function pickExample(candidates) {
  // Prefer a sentence of reasonable length (readable in a tooltip).
  return [...candidates].sort((a, b) => {
    const score = (s) => Math.abs(s.text.length - 90) + (s.text.length > 200 ? 1000 : 0);
    return score(a) - score(b);
  })[0] || null;
}

function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are already L2-normalized
}

// Deterministic RNG so the layout is reproducible across runs.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('Loading modernized corpus…');
  const corpus = JSON.parse(await readFile(CORPUS_PATH, 'utf8'));

  // Build a flat sentence index from the MODERNIZED text.
  const sentenceIndex = [];
  for (const letter of corpus) {
    const body = letter.text_modern || letter.text;
    if (!body) continue;
    for (const s of splitSentences(body)) {
      if (s.length >= 25 && s.length <= 220) sentenceIndex.push({ letterId: letter.id, text: s });
    }
  }
  console.log(`Sentence index: ${sentenceIndex.length} sentences from ${corpus.length} letters`);

  // Flatten terms with theme assignment.
  const terms = [];
  for (const [key, theme] of Object.entries(THEMES)) {
    for (const w of theme.words) terms.push({ term: w, theme: key, themeLabel: theme.da });
  }

  console.log(`Loading model ${MODEL_NAME}…`);
  const extractor = await pipeline('feature-extraction', MODEL_NAME);

  const MAX_CONTEXTS = 20;
  console.log(`Embedding ${terms.length} concepts from in-context sentences…`);
  const records = [];
  for (const t of terms) {
    const matches = matchingSentences(t.term, sentenceIndex);
    // Spread contexts across the corpus rather than taking the first N.
    const step = Math.max(1, Math.floor(matches.length / MAX_CONTEXTS));
    const contexts = matches.filter((_, i) => i % step === 0).slice(0, MAX_CONTEXTS);

    const centroid = new Float64Array(384);
    for (const ctx of contexts) {
      const out = await extractor('passage: ' + ctx.text, { pooling: 'mean', normalize: true });
      for (let i = 0; i < 384; i++) centroid[i] += out.data[i];
    }
    // Mean, then L2-normalize so cosine == dot product downstream.
    let norm = 0;
    for (let i = 0; i < 384; i++) { centroid[i] /= contexts.length || 1; norm += centroid[i] * centroid[i]; }
    norm = Math.sqrt(norm) || 1;
    const vec = Array.from(centroid, (v) => v / norm);

    const example = pickExample(contexts.length ? contexts : matches);
    if (!contexts.length) console.warn(`  ! no sentences found for "${t.term}"`);
    records.push({ ...t, vec, example, contextCount: contexts.length });
  }

  // True nearest neighbours in the full 384-dim space.
  console.log('Computing nearest neighbours (full space)…');
  for (let i = 0; i < records.length; i++) {
    const sims = records
      .map((r, j) => (j === i ? null : { term: r.term, sim: cosine(records[i].vec, r.vec) }))
      .filter(Boolean)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 3);
    records[i].neighbors = sims.map((s) => ({ term: s.term, sim: Number(s.sim.toFixed(3)) }));
  }

  // Per-axis [0,1] normalization of a UMAP projection.
  const nrm = (v, mn, mx) => (mx - mn ? (v - mn) / (mx - mn) : 0.5);
  function normalizeAxes(projection, dims) {
    const mins = Array.from({ length: dims }, (_, d) => Math.min(...projection.map((p) => p[d])));
    const maxs = Array.from({ length: dims }, (_, d) => Math.max(...projection.map((p) => p[d])));
    return projection.map((p) => p.map((v, d) => Number(nrm(v, mins[d], maxs[d]).toFixed(4))));
  }

  // UMAP → 2D and 3D (seeded for reproducibility). Same neighbour params, so
  // the cluster structure is consistent between the two projections.
  console.log('Projecting to 2D with UMAP…');
  const umap2d = new UMAP({ nComponents: 2, nNeighbors: 8, minDist: 0.35, spread: 1.0, random: mulberry32(42) });
  const projected2d = normalizeAxes(umap2d.fit(records.map((r) => r.vec)), 2);

  console.log('Projecting to 3D with UMAP…');
  const umap3d = new UMAP({ nComponents: 3, nNeighbors: 8, minDist: 0.35, spread: 1.0, random: mulberry32(42) });
  const projected3d = normalizeAxes(umap3d.fit(records.map((r) => r.vec)), 3);

  const points = records.map((r, i) => ({
    term: r.term,
    theme: r.theme,
    themeLabel: r.themeLabel,
    x: projected2d[i][0],
    y: projected2d[i][1],
    x3: projected3d[i][0],
    y3: projected3d[i][1],
    z3: projected3d[i][2],
    neighbors: r.neighbors,
    contextCount: r.contextCount,
    example: r.example ? r.example.text : null,
    exampleLetterId: r.example ? r.example.letterId : null,
  }));

  const output = {
    meta: {
      model: MODEL_NAME,
      dimensions: 384,
      source: 'search-corpus.json (text_modern)',
      representation: 'centroid of in-context modernized letter sentences (passage:)',
      method: 'umap',
      params: { nNeighbors: 8, minDist: 0.35, seed: 42 },
      projections: { '2d': ['x', 'y'], '3d': ['x3', 'y3', 'z3'] },
      termCount: points.length,
    },
    themes: Object.fromEntries(Object.entries(THEMES).map(([k, v]) => [k, v.da])),
    points,
  };

  const json = JSON.stringify(output, null, 2);
  await writeFile(WEBSITE_OUT, json);
  // Presentation copies: JSON for reference, JS global so index.html works via file://.
  await writeFile(join(PRES_DIR, 'wordspace.json'), json);
  await writeFile(join(PRES_DIR, 'wordspace.js'), 'window.WORDSPACE = ' + JSON.stringify(output) + ';\n');

  console.log(`\nWrote ${WEBSITE_OUT}`);
  console.log(`Wrote presentation copies in ${PRES_DIR}`);
  console.log(`${points.length} terms, ${points.filter((p) => p.example).length} with example sentences.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
