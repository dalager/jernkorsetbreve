#!/usr/bin/env node

/**
 * generate-embeddings.mjs
 *
 * Generates vector embeddings for all letters in the search corpus using
 * the Xenova/gte-small model (384-dimensional, multilingual).
 *
 * Outputs:
 *   - embeddings.bin          (Float32 binary, all vectors concatenated)
 *   - embedding-index.json    (letter IDs, dimensions, byte offsets)
 *   - embedding-meta.json     (model name, content hash, timestamp)
 *   - related-letters.json    (top-5 most similar letters per letter)
 *   - embeddings-2d.json      (UMAP 2D projection for visualization)
 *
 * Usage:
 *   node scripts/generate-embeddings.mjs           # uses cache
 *   node scripts/generate-embeddings.mjs --force   # regenerate all
 *
 * Requires: npm install @huggingface/transformers onnxruntime-node
 * Depends on: search-corpus.json (from scripts/build-data.mjs)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline, env } from '@huggingface/transformers';
import { UMAP } from 'umap-js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

const DATA_DIR = join(PROJECT_ROOT, 'webapp', 'public-site', 'public', 'data');
const CORPUS_PATH = join(DATA_DIR, 'search-corpus.json');
const EMBEDDINGS_BIN = join(DATA_DIR, 'embeddings.bin');
const INDEX_PATH = join(DATA_DIR, 'embedding-index.json');
const META_PATH = join(DATA_DIR, 'embedding-meta.json');
const RELATED_PATH = join(DATA_DIR, 'related-letters.json');
const UMAP_2D_PATH = join(DATA_DIR, 'embeddings-2d.json');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MODEL_NAME = 'Xenova/gte-small';
const DIMENSIONS = 384;
const BATCH_SIZE = 15;
const TOP_K_RELATED = 5;

// Allow local model caching in a project-local directory
const MODEL_CACHE_DIR = join(PROJECT_ROOT, '.cache', 'models');
env.cacheDir = MODEL_CACHE_DIR;
env.allowLocalModels = true;

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

const forceRegenerate = process.argv.includes('--force');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = ((ms % 60_000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/** Cosine similarity between two Float32Arrays of equal length. */
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

async function main() {
  const t0 = performance.now();

  console.log('=== Embedding Generation Pipeline ===\n');

  // -- 1. Read corpus -------------------------------------------------------

  if (!existsSync(CORPUS_PATH)) {
    console.error(
      `ERROR: ${CORPUS_PATH} not found.\n` +
      'Run the data build pipeline first: node scripts/build-data.mjs'
    );
    process.exit(1);
  }

  const corpusRaw = await readFile(CORPUS_PATH, 'utf8');
  const corpus = JSON.parse(corpusRaw);
  const contentHash = sha256(corpusRaw);

  console.log(`Corpus:      ${corpus.length} letters`);
  console.log(`Content hash: ${contentHash.slice(0, 16)}...`);

  // -- 2. Cache check -------------------------------------------------------

  if (!forceRegenerate && existsSync(META_PATH)) {
    try {
      const meta = JSON.parse(await readFile(META_PATH, 'utf8'));
      if (
        meta.model === MODEL_NAME &&
        meta.contentHash === contentHash &&
        existsSync(EMBEDDINGS_BIN) &&
        existsSync(INDEX_PATH) &&
        existsSync(RELATED_PATH) &&
        existsSync(UMAP_2D_PATH)
      ) {
        console.log('\nEmbeddings up to date, skipping.');
        console.log(`  Generated: ${meta.generatedAt}`);
        console.log(`  Letters:   ${meta.letterCount}`);
        return;
      }
      if (meta.model !== MODEL_NAME) {
        console.log(`\nModel changed (${meta.model} -> ${MODEL_NAME}), regenerating...`);
      } else {
        console.log('\nCorpus changed, regenerating...');
      }
    } catch {
      console.log('\nCould not read cache metadata, regenerating...');
    }
  } else if (forceRegenerate) {
    console.log('\n--force flag set, regenerating...');
  } else {
    console.log('\nNo existing embeddings found, generating...');
  }

  // -- 3. Load model --------------------------------------------------------

  console.log(`\nLoading model: ${MODEL_NAME}`);
  const tModel = performance.now();

  const extractor = await pipeline('feature-extraction', MODEL_NAME, {
    progress_callback: (progress) => {
      if (progress.status === 'progress' && progress.progress) {
        const pct = Math.round(progress.progress);
        process.stdout.write(`\r  Downloading: ${progress.file} (${pct}%)`);
      } else if (progress.status === 'done') {
        process.stdout.write('\n');
      }
    },
  });

  const modelLoadTime = performance.now() - tModel;
  console.log(`Model loaded in ${formatDuration(modelLoadTime)}`);

  // -- 4. Generate embeddings -----------------------------------------------

  console.log(`\nGenerating embeddings (batch size: ${BATCH_SIZE})...`);
  const tEmbed = performance.now();

  const allEmbeddings = new Float32Array(corpus.length * DIMENSIONS);
  const letterIds = [];
  const byteOffsets = {};

  for (let i = 0; i < corpus.length; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, corpus.length);
    const batchTexts = [];
    const batchIndices = [];

    for (let j = i; j < batchEnd; j++) {
      const letter = corpus[j];
      letterIds.push(letter.id);

      // Compose a searchable text from all available fields
      const parts = [];
      if (letter.sender) parts.push(`Fra: ${letter.sender}`);
      if (letter.recipient) parts.push(`Til: ${letter.recipient}`);
      if (letter.date) parts.push(`Dato: ${letter.date}`);
      if (letter.place) parts.push(`Sted: ${letter.place}`);
      if (letter.text) parts.push(letter.text);
      const text = parts.join('. ');

      // gte-small has a max of 512 tokens; we truncate character-wise
      // as a safe approximation (the tokenizer handles the real truncation,
      // but shorter input is faster)
      const truncated = text.length > 2000 ? text.slice(0, 2000) : text;
      batchTexts.push(truncated);
      batchIndices.push(j);
    }

    // Process each text in the batch individually
    // (transformers.js v3 pipeline supports single strings best)
    for (let k = 0; k < batchTexts.length; k++) {
      const output = await extractor(batchTexts[k], {
        pooling: 'mean',
        normalize: true,
      });

      const embedding = output.data;
      const idx = batchIndices[k];
      const offset = idx * DIMENSIONS;

      for (let d = 0; d < DIMENSIONS; d++) {
        allEmbeddings[offset + d] = embedding[d];
      }

      byteOffsets[corpus[idx].id] = offset * 4; // Float32 = 4 bytes
    }

    // Progress reporting
    const done = batchEnd;
    const elapsed = performance.now() - tEmbed;
    const rate = done / (elapsed / 1000);
    const remaining = ((corpus.length - done) / rate) * 1000;

    process.stdout.write(
      `\r  Embedding letter ${done}/${corpus.length}` +
      ` (${rate.toFixed(1)}/s, ~${formatDuration(remaining)} remaining)`
    );
  }

  const embedTime = performance.now() - tEmbed;
  console.log(`\n\nEmbeddings generated in ${formatDuration(embedTime)}`);
  console.log(
    `  Rate: ${(corpus.length / (embedTime / 1000)).toFixed(1)} letters/s`
  );

  // -- 5. Write binary embeddings -------------------------------------------

  await mkdir(DATA_DIR, { recursive: true });

  const buffer = Buffer.from(allEmbeddings.buffer);
  await writeFile(EMBEDDINGS_BIN, buffer);
  console.log(`\nWrote: embeddings.bin (${formatBytes(buffer.byteLength)})`);

  // -- 6. Write embedding index ---------------------------------------------

  const indexData = {
    letterIds,
    dimensions: DIMENSIONS,
    count: corpus.length,
    byteOffsets,
  };
  await writeFile(INDEX_PATH, JSON.stringify(indexData, null, 2));
  console.log(`Wrote: embedding-index.json`);

  // -- 7. Write metadata ----------------------------------------------------

  const metaData = {
    model: MODEL_NAME,
    contentHash,
    generatedAt: new Date().toISOString(),
    letterCount: corpus.length,
    dimensions: DIMENSIONS,
    embeddingTimeMs: Math.round(embedTime),
  };
  await writeFile(META_PATH, JSON.stringify(metaData, null, 2));
  console.log(`Wrote: embedding-meta.json`);

  // -- 8. Compute related letters -------------------------------------------

  console.log(`\nComputing related letters (top ${TOP_K_RELATED} per letter)...`);
  const tRelated = performance.now();

  const relatedLetters = {};

  for (let i = 0; i < corpus.length; i++) {
    const aOffset = i * DIMENSIONS;
    const aVec = allEmbeddings.subarray(aOffset, aOffset + DIMENSIONS);
    const scores = [];

    for (let j = 0; j < corpus.length; j++) {
      if (i === j) continue;
      const bOffset = j * DIMENSIONS;
      const bVec = allEmbeddings.subarray(bOffset, bOffset + DIMENSIONS);
      const score = cosineSimilarity(aVec, bVec);
      scores.push({ id: corpus[j].id, score: Math.round(score * 10000) / 10000 });
    }

    // Sort descending by score and take top K
    scores.sort((a, b) => b.score - a.score);
    relatedLetters[corpus[i].id] = scores.slice(0, TOP_K_RELATED);

    if ((i + 1) % 100 === 0 || i === corpus.length - 1) {
      process.stdout.write(`\r  Processed ${i + 1}/${corpus.length}`);
    }
  }

  const relatedTime = performance.now() - tRelated;
  console.log(`\n  Computed in ${formatDuration(relatedTime)}`);

  await writeFile(RELATED_PATH, JSON.stringify(relatedLetters, null, 2));
  console.log(`Wrote: related-letters.json`);

  // -- 9. Compute UMAP 2D projection ----------------------------------------

  console.log('\nComputing UMAP 2D projection...');
  const tUmap = performance.now();

  // Convert the flat Float32Array into an array-of-arrays for UMAP
  const embeddingMatrix = [];
  for (let i = 0; i < corpus.length; i++) {
    const offset = i * DIMENSIONS;
    embeddingMatrix.push(Array.from(allEmbeddings.subarray(offset, offset + DIMENSIONS)));
  }

  const umap = new UMAP({
    nNeighbors: 15,
    minDist: 0.1,
    nComponents: 2,
    spread: 1.0,
  });

  const projected = umap.fit(embeddingMatrix);

  // Normalize coordinates to [0, 1] range
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const [x, y] of projected) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const points = projected.map(([x, y], i) => ({
    id: letterIds[i],
    x: Math.round(((x - minX) / rangeX) * 10000) / 10000,
    y: Math.round(((y - minY) / rangeY) * 10000) / 10000,
  }));

  const umap2dData = {
    method: 'umap',
    params: { nNeighbors: 15, minDist: 0.1 },
    points,
  };

  await writeFile(UMAP_2D_PATH, JSON.stringify(umap2dData, null, 2));
  const umapTime = performance.now() - tUmap;
  console.log(`  Computed in ${formatDuration(umapTime)}`);
  console.log('Wrote: embeddings-2d.json');

  // -- 10. Summary ----------------------------------------------------------

  const totalTime = performance.now() - t0;
  console.log('\n=== Summary ===');
  console.log(`  Letters:         ${corpus.length}`);
  console.log(`  Dimensions:      ${DIMENSIONS}`);
  console.log(`  Model:           ${MODEL_NAME}`);
  console.log(`  Model load:      ${formatDuration(modelLoadTime)}`);
  console.log(`  Embedding time:  ${formatDuration(embedTime)}`);
  console.log(`  Related compute: ${formatDuration(relatedTime)}`);
  console.log(`  UMAP projection: ${formatDuration(umapTime)}`);
  console.log(`  Total time:      ${formatDuration(totalTime)}`);
  console.log(`  Binary size:     ${formatBytes(buffer.byteLength)}`);
  console.log(`  Expected size:   ${formatBytes(corpus.length * DIMENSIONS * 4)}`);
}

main().catch((err) => {
  console.error('\nFATAL:', err.message || err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
