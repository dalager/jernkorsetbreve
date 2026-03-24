#!/usr/bin/env node

/**
 * generate-clusters.mjs
 *
 * Runs k-means++ clustering on 384D letter embeddings to discover topic groups.
 *
 * Reads:
 *   - embeddings.bin          (Float32 binary, all vectors concatenated)
 *   - embedding-index.json    (letter IDs, dimensions, count)
 *   - letter-summaries.json   (date, sender, recipient, place per letter)
 *   - letter-sentiments.json  (sentiment score per letter)
 *
 * Outputs:
 *   - topic-clusters.json     (cluster assignments and metadata)
 *
 * Usage:
 *   node scripts/generate-clusters.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'webapp', 'public-site', 'public', 'data');

const K = 8;
const MAX_ITER = 50;

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32)
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 42;
const RESTARTS = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Squared Euclidean distance between a data point and a centroid array. */
function sqDistToCentroid(data, dims, offset, centroid, cOffset) {
  let sum = 0;
  for (let d = 0; d < dims; d++) {
    const diff = data[offset + d] - centroid[cOffset + d];
    sum += diff * diff;
  }
  return sum;
}

// ---------------------------------------------------------------------------
// K-means++ initialization
// ---------------------------------------------------------------------------

function kmeansppInit(data, n, dims, k, rng) {
  const centroids = new Float64Array(k * dims);

  // First centroid: random point
  const first = Math.floor(rng() * n);
  for (let d = 0; d < dims; d++) {
    centroids[d] = data[first * dims + d];
  }

  const minDists = new Float64Array(n).fill(Infinity);

  for (let c = 1; c < k; c++) {
    // Update minimum distances to the most recently added centroid
    const prevC = (c - 1) * dims;
    let totalDist = 0;
    for (let i = 0; i < n; i++) {
      const dist = sqDistToCentroid(data, dims, i * dims, centroids, prevC);
      if (dist < minDists[i]) {
        minDists[i] = dist;
      }
      totalDist += minDists[i];
    }

    // Pick next centroid with probability proportional to squared distance
    let threshold = rng() * totalDist;
    let chosen = 0;
    for (let i = 0; i < n; i++) {
      threshold -= minDists[i];
      if (threshold <= 0) {
        chosen = i;
        break;
      }
    }

    for (let d = 0; d < dims; d++) {
      centroids[c * dims + d] = data[chosen * dims + d];
    }
  }

  return centroids;
}

// ---------------------------------------------------------------------------
// K-means iteration
// ---------------------------------------------------------------------------

function kmeans(data, n, dims, k, maxIter, rng) {
  const centroids = kmeansppInit(data, n, dims, k, rng);
  const assignments = new Int32Array(n);
  const counts = new Int32Array(k);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign each point to nearest centroid
    let changed = 0;
    counts.fill(0);

    for (let i = 0; i < n; i++) {
      let bestCluster = 0;
      let bestDist = Infinity;
      const iOffset = i * dims;

      for (let c = 0; c < k; c++) {
        const dist = sqDistToCentroid(data, dims, iOffset, centroids, c * dims);
        if (dist < bestDist) {
          bestDist = dist;
          bestCluster = c;
        }
      }

      if (assignments[i] !== bestCluster) {
        changed++;
      }
      assignments[i] = bestCluster;
      counts[bestCluster]++;
    }

    console.log(`  Iteration ${iter + 1}: ${changed} reassigned, sizes: [${Array.from(counts).join(', ')}]`);

    if (changed === 0) {
      console.log('  Converged.');
      break;
    }

    // Recompute centroids
    centroids.fill(0);
    for (let i = 0; i < n; i++) {
      const c = assignments[i];
      const iOffset = i * dims;
      const cOffset = c * dims;
      for (let d = 0; d < dims; d++) {
        centroids[cOffset + d] += data[iOffset + d];
      }
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) continue;
      const cOffset = c * dims;
      for (let d = 0; d < dims; d++) {
        centroids[cOffset + d] /= counts[c];
      }
    }
  }

  // Compute total inertia (sum of squared distances to assigned centroids)
  let inertia = 0;
  for (let i = 0; i < n; i++) {
    inertia += sqDistToCentroid(data, dims, i * dims, centroids, assignments[i] * dims);
  }

  return { assignments, centroids, counts, inertia };
}

// ---------------------------------------------------------------------------
// Label generation
// ---------------------------------------------------------------------------

function generateLabel(medianYear, yearMin, yearMax, avgSentiment, topRecipient) {
  // Use median year to characterize the temporal center of the cluster
  const yearTag = `${yearMin}-${yearMax}`;

  // Pre-war clusters (median before 1914)
  if (medianYear < 1914) {
    if (avgSentiment >= 20) return `Førkrigstid, lys tone (${yearTag})`;
    return `Tidlige breve (${yearTag})`;
  }

  // Early war (1914-1915)
  if (medianYear >= 1914 && medianYear < 1916) {
    if (avgSentiment < 12) return `Tidlig krig, alvorlig tone (${yearTag})`;
    if (avgSentiment >= 22) return `Tidlig krig, positiv tone (${yearTag})`;
    return `Tidlig krigsperiode (${yearTag})`;
  }

  // Mid war (1916-1917)
  if (medianYear >= 1916 && medianYear < 1918) {
    if (avgSentiment < 12) return `Midt i krigen, tung stemning (${yearTag})`;
    if (avgSentiment >= 22) return `Midt i krigen, lys stemning (${yearTag})`;
    return `Midterste krigsår (${yearTag})`;
  }

  // Late war (1918+)
  if (avgSentiment < 12) return `Sen krig, alvorlig tone (${yearTag})`;
  if (avgSentiment >= 22) return `Sen krig, håbefuld tone (${yearTag})`;
  return `Sene krigsbreve (${yearTag})`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const t0 = performance.now();
  console.log('=== Topic Clustering Pipeline ===\n');

  // 1. Read data
  const indexRaw = await readFile(join(DATA_DIR, 'embedding-index.json'), 'utf8');
  const index = JSON.parse(indexRaw);
  const { letterIds, dimensions: dims, count: n } = index;

  const embBuf = await readFile(join(DATA_DIR, 'embeddings.bin'));
  const embeddings = new Float32Array(embBuf.buffer, embBuf.byteOffset, embBuf.byteLength / 4);

  const summaries = JSON.parse(await readFile(join(DATA_DIR, 'letter-summaries.json'), 'utf8'));
  const sentiments = JSON.parse(await readFile(join(DATA_DIR, 'letter-sentiments.json'), 'utf8'));

  // Build lookup maps
  const summaryById = new Map(summaries.map((s) => [s.id, s]));

  console.log(`Letters: ${n}, Dimensions: ${dims}, K: ${K}\n`);

  // 2. Run k-means with multiple restarts, keep the best (lowest inertia)
  let best = null;
  for (let r = 0; r < RESTARTS; r++) {
    const rng = mulberry32(SEED + r);
    console.log(`Run ${r + 1}/${RESTARTS} (seed=${SEED + r}):`);
    const result = kmeans(embeddings, n, dims, K, MAX_ITER, rng);
    console.log(`  Inertia: ${result.inertia.toFixed(2)}\n`);
    if (best === null || result.inertia < best.inertia) {
      best = result;
    }
  }
  console.log(`Best inertia: ${best.inertia.toFixed(2)}`);
  const { assignments, centroids, counts } = best;

  // 3. Build cluster metadata
  console.log('\nBuilding cluster metadata...');
  const clusters = Array.from({ length: K }, (_, i) => ({
    id: i,
    letterIds: [],
    sentiments: [],
    senders: {},
    recipients: {},
    years: [],
    distances: [],
  }));

  for (let i = 0; i < n; i++) {
    const letterId = letterIds[i];
    const c = assignments[i];
    const cluster = clusters[c];

    cluster.letterIds.push(letterId);

    // Sentiment
    const sentiment = sentiments[String(letterId)];
    if (sentiment !== undefined) {
      cluster.sentiments.push(sentiment);
    }

    // Summary metadata
    const summary = summaryById.get(letterId);
    if (summary) {
      if (summary.sender) {
        cluster.senders[summary.sender] = (cluster.senders[summary.sender] || 0) + 1;
      }
      if (summary.recipient) {
        cluster.recipients[summary.recipient] = (cluster.recipients[summary.recipient] || 0) + 1;
      }
      if (summary.date) {
        const year = parseInt(summary.date.slice(0, 4), 10);
        if (year > 0) cluster.years.push(year);
      }
    }

    // Distance to centroid
    const dist = sqDistToCentroid(embeddings, dims, i * dims, centroids, c * dims);
    cluster.distances.push({ letterId, dist });
  }

  // Compute final cluster objects
  const clusterOutput = clusters.map((c) => {
    const avgSentiment =
      c.sentiments.length > 0
        ? Math.round((c.sentiments.reduce((a, b) => a + b, 0) / c.sentiments.length) * 10) / 10
        : 0;

    // Top sender
    let topSender = '';
    let topCount = 0;
    for (const [sender, count] of Object.entries(c.senders)) {
      if (count > topCount) {
        topCount = count;
        topSender = sender;
      }
    }

    // Top recipient
    let topRecipient = '';
    let topRecCount = 0;
    for (const [recipient, count] of Object.entries(c.recipients)) {
      if (count > topRecCount) {
        topRecCount = count;
        topRecipient = recipient;
      }
    }

    // Year range and median
    const sortedYears = c.years.slice().sort((a, b) => a - b);
    const yearMin = sortedYears.length > 0 ? sortedYears[0] : 0;
    const yearMax = sortedYears.length > 0 ? sortedYears[sortedYears.length - 1] : 0;
    const medianYear =
      sortedYears.length > 0
        ? sortedYears[Math.floor(sortedYears.length / 2)]
        : 0;

    // Representative: 3 closest to centroid
    c.distances.sort((a, b) => a.dist - b.dist);
    const representative = c.distances.slice(0, 3).map((d) => d.letterId);

    const label = generateLabel(medianYear, yearMin, yearMax, avgSentiment, topRecipient);

    return {
      id: c.id,
      label,
      size: c.letterIds.length,
      avgSentiment,
      topSender,
      yearRange: [yearMin, yearMax],
      representative,
      letterIds: c.letterIds.sort((a, b) => a - b),
    };
  });

  // Build assignments map
  const assignmentMap = {};
  for (let i = 0; i < n; i++) {
    assignmentMap[String(letterIds[i])] = assignments[i];
  }

  const output = { k: K, clusters: clusterOutput, assignments: assignmentMap };

  // 4. Write output
  const outPath = join(DATA_DIR, 'topic-clusters.json');
  await writeFile(outPath, JSON.stringify(output, null, 2));

  // 5. Summary
  const elapsed = performance.now() - t0;
  console.log(`\n=== Cluster Summary ===`);
  for (const c of clusterOutput) {
    console.log(
      `  Cluster ${c.id}: "${c.label}" — ${c.size} letters, ` +
        `sentiment=${c.avgSentiment}, top=${c.topSender}, years=${c.yearRange.join('-')}`
    );
  }

  const totalAssigned = Object.keys(assignmentMap).length;
  console.log(`\nTotal letters assigned: ${totalAssigned}`);
  console.log(`Wrote: ${outPath}`);
  console.log(`Done in ${(elapsed / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error('\nFATAL:', err.message || err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
