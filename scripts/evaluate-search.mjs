#!/usr/bin/env node

/**
 * evaluate-search.mjs
 *
 * Evaluates semantic search quality against a golden dataset of
 * manually curated query-to-relevant-letter-ID pairs.
 *
 * Loads pre-computed embeddings and a multilingual model, embeds each
 * query, ranks documents by cosine similarity, and computes IR metrics
 * (Precision@k, Recall@k, MRR, nDCG@k) per tier and aggregated.
 *
 * Usage:
 *   # Evaluate current model
 *   node scripts/evaluate-search.mjs
 *
 *   # Evaluate with specific embeddings
 *   node scripts/evaluate-search.mjs --embeddings data/embeddings.bin --model Xenova/multilingual-e5-small
 *
 *   # Compare two models
 *   node scripts/evaluate-search.mjs --compare \
 *     --a apps/website/public/data/embeddings.bin --model-a Xenova/multilingual-e5-small \
 *     --b data/embeddings-gte-small.bin --model-b Xenova/gte-small
 *
 *   # Save results to file
 *   node scripts/evaluate-search.mjs --save
 *
 * Requires: npm install @huggingface/transformers onnxruntime-node
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline, env } from "@huggingface/transformers";
import { parseArgs } from "node:util";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");

const DEFAULT_EMBEDDINGS = join(
  PROJECT_ROOT,
  "apps",
  "website",
  "public",
  "data",
  "embeddings.bin"
);
const DEFAULT_INDEX = join(
  PROJECT_ROOT,
  "apps",
  "website",
  "public",
  "data",
  "embedding-index.json"
);
const GOLDEN_DATASET = join(
  PROJECT_ROOT,
  "tests",
  "search-eval",
  "golden-queries.json"
);
const RESULTS_DIR = join(PROJECT_ROOT, "tests", "search-eval", "results");

const DEFAULT_MODEL = "Xenova/multilingual-e5-small";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    embeddings: { type: "string", default: DEFAULT_EMBEDDINGS },
    index: { type: "string", default: DEFAULT_INDEX },
    model: { type: "string", default: DEFAULT_MODEL },
    compare: { type: "boolean", default: false },
    a: { type: "string" },
    "model-a": { type: "string" },
    "index-a": { type: "string" },
    b: { type: "string" },
    "model-b": { type: "string" },
    "index-b": { type: "string" },
    save: { type: "boolean", default: false },
    k: { type: "string", default: "10" },
    verbose: { type: "boolean", default: false },
    "per-query": { type: "boolean", default: false },
  },
});

const K = parseInt(args.k, 10);

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

function cosineSimilarity(a, b) {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ---------------------------------------------------------------------------
// IR Metrics
// ---------------------------------------------------------------------------

/**
 * Precision@k: fraction of top-k results that are relevant.
 */
function precisionAtK(ranked, relevant, k) {
  const topK = ranked.slice(0, k);
  const hits = topK.filter((id) => relevant.has(String(id))).length;
  return hits / k;
}

/**
 * Recall@k: fraction of all relevant documents found in top-k.
 */
function recallAtK(ranked, relevant, k) {
  if (relevant.size === 0) return 0;
  const topK = new Set(ranked.slice(0, k).map(String));
  let found = 0;
  for (const id of relevant.keys()) {
    if (topK.has(id)) found++;
  }
  return found / relevant.size;
}

/**
 * Mean Reciprocal Rank: 1/rank of first relevant result.
 */
function mrr(ranked, relevant) {
  for (let i = 0; i < ranked.length; i++) {
    if (relevant.has(String(ranked[i]))) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

/**
 * nDCG@k with graded relevance.
 */
function ndcgAtK(ranked, relevantWithGrades, k) {
  const topK = ranked.slice(0, k);

  // DCG
  let dcg = 0;
  for (let i = 0; i < topK.length; i++) {
    const grade = relevantWithGrades.get(String(topK[i])) || 0;
    dcg += (Math.pow(2, grade) - 1) / Math.log2(i + 2);
  }

  // Ideal DCG: sort grades descending
  const idealGrades = [...relevantWithGrades.values()].sort((a, b) => b - a);
  let idcg = 0;
  for (let i = 0; i < Math.min(idealGrades.length, k); i++) {
    idcg += (Math.pow(2, idealGrades[i]) - 1) / Math.log2(i + 2);
  }

  return idcg === 0 ? 0 : dcg / idcg;
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

async function loadEmbeddings(binPath, indexPath) {
  const [buffer, indexJson] = await Promise.all([
    readFile(binPath),
    readFile(indexPath, "utf-8"),
  ]);
  const index = JSON.parse(indexJson);
  const embeddings = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  return { embeddings, index };
}

async function loadGoldenDataset() {
  const raw = await readFile(GOLDEN_DATASET, "utf-8");
  return JSON.parse(raw);
}

async function loadModel(modelName) {
  console.log(`  Loading model: ${modelName}...`);
  env.allowLocalModels = false;
  const extractor = await pipeline("feature-extraction", modelName, {
    dtype: "q8",
  });
  console.log(`  Model loaded.`);
  return extractor;
}

async function embed(extractor, text) {
  const output = await extractor("query: " + text, {
    pooling: "mean",
    normalize: true,
  });
  return new Float32Array(output.data);
}

// ---------------------------------------------------------------------------
// Search: rank all documents for a query
// ---------------------------------------------------------------------------

function rankDocuments(queryEmbedding, embeddings, index) {
  const { letterIds, count, dimensions } = index;
  const results = [];
  for (let i = 0; i < count; i++) {
    const offset = i * dimensions;
    const docEmbedding = embeddings.subarray(offset, offset + dimensions);
    const score = cosineSimilarity(queryEmbedding, docEmbedding);
    results.push({ letterId: letterIds[i], score });
  }
  results.sort((a, b) => b.score - a.score);
  return results.map((r) => r.letterId);
}

// ---------------------------------------------------------------------------
// Evaluate
// ---------------------------------------------------------------------------

async function evaluate(binPath, indexPath, modelName) {
  console.log(`\nEvaluating: ${modelName}`);
  console.log(`  Embeddings: ${binPath}`);

  const [{ embeddings, index }, golden, extractor] = await Promise.all([
    loadEmbeddings(binPath, indexPath),
    loadGoldenDataset(),
    loadModel(modelName),
  ]);

  console.log(
    `  Corpus: ${index.count} documents, ${index.dimensions} dimensions`
  );
  console.log(`  Golden dataset: ${golden.queries.length} queries\n`);

  const results = {
    model: modelName,
    embeddingsPath: binPath,
    timestamp: new Date().toISOString(),
    corpusSize: index.count,
    dimensions: index.dimensions,
    k: K,
    queryCount: golden.queries.length,
    perQuery: [],
    perTier: {},
    perDimension: {},
    aggregate: {},
  };

  // Group queries by tier and dimension
  const tierBuckets = {};
  const dimBuckets = {};

  for (const q of golden.queries) {
    // Build relevance map
    const relevantMap = new Map(Object.entries(q.relevant));
    const relevantSet = new Map(
      Object.entries(q.relevant).filter(([, g]) => g > 0)
    );

    // Embed query
    const queryEmb = await embed(extractor, q.query);
    const ranked = rankDocuments(queryEmb, embeddings, index);

    // Compute metrics
    const p5 = precisionAtK(ranked, relevantSet, 5);
    const p10 = precisionAtK(ranked, relevantSet, K);
    const r10 = recallAtK(ranked, relevantSet, K);
    const mrrVal = mrr(ranked, relevantSet);
    const ndcg10 = ndcgAtK(ranked, relevantMap, K);

    const queryResult = {
      id: q.id,
      query: q.query,
      tier: q.tier,
      dimension: q.dimension,
      metrics: { "P@5": p5, [`P@${K}`]: p10, [`R@${K}`]: r10, MRR: mrrVal, [`nDCG@${K}`]: ndcg10 },
      topK: ranked.slice(0, K),
      relevantCount: relevantSet.size,
    };
    results.perQuery.push(queryResult);

    // Accumulate per tier
    if (!tierBuckets[q.tier]) tierBuckets[q.tier] = [];
    tierBuckets[q.tier].push(queryResult.metrics);

    // Accumulate per dimension
    if (!dimBuckets[q.dimension]) dimBuckets[q.dimension] = [];
    dimBuckets[q.dimension].push(queryResult.metrics);

    if (args.verbose || args["per-query"]) {
      const status =
        ndcg10 >= 0.5 ? "OK" : ndcg10 >= 0.2 ? "WEAK" : "POOR";
      console.log(
        `  [${status}] ${q.id} "${q.query}" — nDCG@${K}=${ndcg10.toFixed(3)}, MRR=${mrrVal.toFixed(3)}, P@5=${p5.toFixed(3)}`
      );
    }
  }

  // Aggregate per tier
  for (const [tier, metrics] of Object.entries(tierBuckets)) {
    results.perTier[tier] = averageMetrics(metrics);
  }

  // Aggregate per dimension
  for (const [dim, metrics] of Object.entries(dimBuckets)) {
    results.perDimension[dim] = averageMetrics(metrics);
  }

  // Overall aggregate
  results.aggregate = averageMetrics(
    results.perQuery.map((q) => q.metrics)
  );

  return results;
}

function averageMetrics(metricsList) {
  if (metricsList.length === 0) return {};
  const keys = Object.keys(metricsList[0]);
  const avg = {};
  for (const key of keys) {
    avg[key] =
      metricsList.reduce((sum, m) => sum + m[key], 0) / metricsList.length;
  }
  return avg;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

function printResults(results) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  Model: ${results.model}`);
  console.log(`  Corpus: ${results.corpusSize} documents (${results.dimensions}d)`);
  console.log(`  Queries: ${results.queryCount} | k=${results.k}`);
  console.log(`${"=".repeat(70)}\n`);

  // Aggregate
  console.log("  AGGREGATE:");
  printMetricsRow(results.aggregate);
  console.log();

  // Per tier
  console.log("  PER TIER:");
  for (const [tier, metrics] of Object.entries(results.perTier)) {
    console.log(`    ${tier}:`);
    printMetricsRow(metrics, "      ");
  }
  console.log();

  // Per dimension
  console.log("  PER DIMENSION:");
  for (const [dim, metrics] of Object.entries(results.perDimension)) {
    console.log(`    ${dim}:`);
    printMetricsRow(metrics, "      ");
  }
  console.log();
}

function printMetricsRow(metrics, indent = "    ") {
  const parts = Object.entries(metrics).map(
    ([k, v]) => `${k}=${v.toFixed(4)}`
  );
  console.log(`${indent}${parts.join("  ")}`);
}

function printComparison(resultsA, resultsB) {
  console.log(`\n${"=".repeat(70)}`);
  console.log("  COMPARISON");
  console.log(`${"=".repeat(70)}\n`);

  console.log(`  Model A: ${resultsA.model}`);
  console.log(`  Model B: ${resultsB.model}\n`);

  console.log("  AGGREGATE:");
  const keys = Object.keys(resultsA.aggregate);
  const header = "    " + ["Metric", "Model A", "Model B", "Delta"].map((s) => s.padEnd(12)).join("");
  console.log(header);
  console.log("    " + "-".repeat(48));
  for (const key of keys) {
    const a = resultsA.aggregate[key];
    const b = resultsB.aggregate[key];
    const delta = b - a;
    const arrow = delta > 0.001 ? " +" : delta < -0.001 ? " " : " ~";
    console.log(
      `    ${key.padEnd(12)}${a.toFixed(4).padEnd(12)}${b.toFixed(4).padEnd(12)}${arrow}${delta.toFixed(4)}`
    );
  }

  console.log("\n  PER TIER:");
  const tiers = [
    ...new Set([
      ...Object.keys(resultsA.perTier),
      ...Object.keys(resultsB.perTier),
    ]),
  ];
  for (const tier of tiers) {
    console.log(`\n    ${tier}:`);
    const metricsA = resultsA.perTier[tier] || {};
    const metricsB = resultsB.perTier[tier] || {};
    for (const key of keys) {
      const a = metricsA[key] || 0;
      const b = metricsB[key] || 0;
      const delta = b - a;
      const arrow = delta > 0.001 ? " +" : delta < -0.001 ? " " : " ~";
      console.log(
        `      ${key.padEnd(12)}${a.toFixed(4).padEnd(12)}${b.toFixed(4).padEnd(12)}${arrow}${delta.toFixed(4)}`
      );
    }
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!existsSync(GOLDEN_DATASET)) {
    console.error(`Golden dataset not found: ${GOLDEN_DATASET}`);
    process.exit(1);
  }

  if (args.compare) {
    if (!args.a || !args.b) {
      console.error("--compare requires --a <path> and --b <path>");
      process.exit(1);
    }
    const modelA = args["model-a"] || DEFAULT_MODEL;
    const modelB = args["model-b"] || DEFAULT_MODEL;
    const indexA = args["index-a"] || DEFAULT_INDEX;
    const indexB = args["index-b"] || DEFAULT_INDEX;

    const resultsA = await evaluate(args.a, indexA, modelA);
    const resultsB = await evaluate(args.b, indexB, modelB);

    printResults(resultsA);
    printResults(resultsB);
    printComparison(resultsA, resultsB);

    if (args.save) {
      await saveResults(resultsA, "comparison-a");
      await saveResults(resultsB, "comparison-b");
    }
  } else {
    const results = await evaluate(args.embeddings, args.index, args.model);
    printResults(results);

    if (args.save) {
      await saveResults(results);
    }
  }
}

async function saveResults(results, suffix = "") {
  if (!existsSync(RESULTS_DIR)) {
    await mkdir(RESULTS_DIR, { recursive: true });
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const modelSlug = results.model.replace(/[/\\]/g, "_");
  const filename = suffix
    ? `${ts}_${modelSlug}_${suffix}.json`
    : `${ts}_${modelSlug}.json`;
  const path = join(RESULTS_DIR, filename);
  await writeFile(path, JSON.stringify(results, null, 2));
  console.log(`  Results saved to: ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
