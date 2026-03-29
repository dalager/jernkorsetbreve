#!/usr/bin/env node

/**
 * Static data build script for jernkorsetbreve.
 *
 * Reads the canonical CSV letter data, GeoJSON places, and sentiment scores,
 * then writes optimised JSON files consumed by the static site.
 *
 * Usage:  node scripts/build-data.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── Paths ────────────────────────────────────────────────────────────────────

const LETTERS_CSV = join(ROOT, "data", "letters.csv");
const PLACES_GEOJSON = join(ROOT, "data", "places.geojson");
const SENTIMENTS_CSV = join(ROOT, "data", "sentiment_scored_letters.csv");
const CVP_SCORES_PATH = join(ROOT, "data", "cvp-letter-scores.json");
const CVP_SENTENCE_SCORES_PATH = join(ROOT, "data", "cvp-sentence-scores.json");
const PLACES_ENRICHED_PATH = join(ROOT, "data", "places-enriched.json");
const OUT_DIR = join(ROOT, "apps", "website", "public", "data");

// Modernized text sources (checked in priority order)
const MODERNIZED_LLM_PATH = join(ROOT, "apps", "admin", "data", "modernized-letters.json");
const NORMALIZED_RULES_PATH = join(ROOT, "data", "normalized-letters.json");

// ── CSV helpers ──────────────────────────────────────────────────────────────

/**
 * Minimal CSV parser that handles quoted fields with commas and escaped quotes.
 * Returns an array of objects keyed by the header row.
 */
function parseCsv(text) {
  const rows = [];
  const lines = text.split("\n");
  if (lines.length === 0) return rows;

  const headers = parseCsvLine(lines[0]);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") continue;
    const fields = parseCsvLine(line);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = (fields[j] ?? "").trim();
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Parse a single CSV line, respecting quoted fields.
 */
function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote ("") or end of quoted field
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

// ── Location parsing ─────────────────────────────────────────────────────────

/**
 * Parse "lat,lng,zoom" string from CSV into { lat, lng } or null.
 */
function parseLocation(raw) {
  if (!raw) return null;
  const parts = raw.split(",").map((s) => s.trim());
  if (parts.length < 2) return null;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

// ── Text transforms ──────────────────────────────────────────────────────────

/**
 * Convert <PARA> separated text into HTML paragraphs.
 */
function textToHtml(raw) {
  if (!raw) return "";
  return raw
    .split("<PARA>")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => `<p>${p}</p>`)
    .join("\n");
}

/**
 * Convert <PARA> separated text into plain text (spaces instead of markers).
 */
function textToPlain(raw) {
  if (!raw) return "";
  return raw.replace(/<PARA>/g, " ").replace(/\s+/g, " ").trim();
}

// ── Fuzzy place matching ─────────────────────────────────────────────────────

/**
 * Normalize a place name for fuzzy matching:
 * - Lowercase, trim, collapse whitespace
 * - Strip diacritics (ż→z, ó→o, etc.) except Scandinavian (æøåÆØÅ)
 * - Extract the "base name" before any parenthetical
 */
function normalizePlaceName(name) {
  let s = (name || "").trim().toLowerCase().replace(/\s+/g, " ");
  // Remove diacritics except æøå which are distinct Scandinavian letters
  s = s.replace(/[àáâãä]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[ýÿ]/g, "y")
    .replace(/[ñ]/g, "n")
    .replace(/[ß]/g, "ss")
    .replace(/[żź]/g, "z")
    .replace(/[ś]/g, "s")
    .replace(/[ć]/g, "c")
    .replace(/[ł]/g, "l")
    .replace(/[ę]/g, "e")
    .replace(/[ń]/g, "n");
  return s;
}

function placeBaseName(name) {
  return normalizePlaceName(name).replace(/\s*\(.*$/, "").trim();
}

/**
 * Extract all name components from a place name:
 * the base name plus any comma-separated parts inside parentheses.
 * E.g. "Feldburg (Feldbach, Steiermark)" -> ["feldburg", "feldbach", "steiermark"]
 */
function placeNameComponents(name) {
  const norm = normalizePlaceName(name);
  const base = norm.replace(/\s*\(.*$/, "").trim();
  const parenMatch = norm.match(/\(([^)]+)\)/);
  const parts = [base];
  if (parenMatch) {
    parenMatch[1].split(",").forEach((p) => {
      const trimmed = p.trim();
      if (trimmed.length > 2) parts.push(trimmed);
    });
  }
  return parts.filter((p) => p.length > 2);
}

/**
 * Find the best matching letter place name for a GeoJSON place name.
 * Returns the matching key from letterPlaceCounts or null.
 * @param {string} geoName - the GeoJSON feature's place name
 * @param {string[]} letterPlaceNames - place names found in the letter CSV
 * @param {string[]} [aliases] - optional alias names from the GeoJSON feature
 */
function findMatchingPlace(geoName, letterPlaceNames, aliases = []) {
  const geoNorm = normalizePlaceName(geoName);
  const geoBase = placeBaseName(geoName);

  // Pass 1: exact normalized match
  for (const lp of letterPlaceNames) {
    if (normalizePlaceName(lp) === geoNorm) return lp;
  }

  // Pass 2: base name match (before parenthetical)
  for (const lp of letterPlaceNames) {
    if (placeBaseName(lp) === geoBase && geoBase.length > 2) return lp;
  }

  // Pass 2b: parenthetical component match
  // Matches when any name component from the geo name overlaps with any
  // component from the letter name (handles swapped base/parenthetical).
  const geoComponents = placeNameComponents(geoName);
  for (const lp of letterPlaceNames) {
    const lpComponents = placeNameComponents(lp);
    for (const gc of geoComponents) {
      for (const lc of lpComponents) {
        if (gc === lc) return lp;
      }
    }
  }

  // Pass 3: one base name starts with the other
  for (const lp of letterPlaceNames) {
    const lpBase = placeBaseName(lp);
    if (lpBase.length > 3 && geoBase.length > 3) {
      if (lpBase.startsWith(geoBase) || geoBase.startsWith(lpBase)) return lp;
    }
  }

  // Pass 4: alias matching — check each alias against letter place names
  for (const alias of aliases) {
    const aliasNorm = normalizePlaceName(alias);
    for (const lp of letterPlaceNames) {
      if (normalizePlaceName(lp) === aliasNorm) return lp;
    }
  }

  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log("Building static data...");

  // ── 1. Read letters CSV ──────────────────────────────────────────────────

  const lettersRaw = readFileSync(LETTERS_CSV, "utf-8");
  const letterRows = parseCsv(lettersRaw);
  console.log(`  Letters CSV: ${letterRows.length} letters`);

  // ── 2. Read places GeoJSON ───────────────────────────────────────────────

  const placesGeo = JSON.parse(readFileSync(PLACES_GEOJSON, "utf-8"));
  const features = placesGeo.features || [];
  console.log(`  Places GeoJSON: ${features.length} places`);

  // ── 3. Read sentiment scores ─────────────────────────────────────────────

  const sentimentsRaw = readFileSync(SENTIMENTS_CSV, "utf-8");
  const sentimentRows = parseCsv(sentimentsRaw);
  console.log(`  Sentiments CSV: ${sentimentRows.length} rows`);

  // Build sentiment lookup: id -> multi-score object
  const sentimentMap = {};

  // Legacy AFINN scores from CSV
  for (const row of sentimentRows) {
    const id = parseInt(row.id, 10);
    const score = parseFloat(row.sentiment_score);
    if (!Number.isNaN(id) && !Number.isNaN(score)) {
      sentimentMap[id] = { afinn_legacy: score };
    }
  }
  console.log(`  AFINN scores mapped: ${Object.keys(sentimentMap).length}`);

  // CVP multi-scores (preferred, from ADR-030)
  if (existsSync(CVP_SCORES_PATH)) {
    try {
      const cvpData = JSON.parse(readFileSync(CVP_SCORES_PATH, "utf-8"));
      let cvpCount = 0;
      for (const [id, scores] of Object.entries(cvpData)) {
        const numId = parseInt(id, 10);
        if (!sentimentMap[numId]) sentimentMap[numId] = {};
        Object.assign(sentimentMap[numId], scores);
        cvpCount++;
      }
      console.log(`  CVP scores merged: ${cvpCount} letters (from ${CVP_SCORES_PATH})`);
    } catch (err) {
      console.warn(`  Warning: could not read CVP scores: ${err.message}`);
    }
  } else {
    console.log(`  CVP scores: not found (${CVP_SCORES_PATH}) — using AFINN only`);
  }

  // ── 4. Load modernized text (optional) ──────────────────────────────────

  const modernizedTextMap = {};

  // Priority 1: LLM-modernized text from admin app
  if (existsSync(MODERNIZED_LLM_PATH)) {
    try {
      const llmData = JSON.parse(readFileSync(MODERNIZED_LLM_PATH, "utf-8"));
      for (const [id, entry] of Object.entries(llmData)) {
        if (entry.text_modern) {
          modernizedTextMap[id] = entry.text_modern;
        }
      }
      console.log(`  LLM modernized text: ${Object.keys(modernizedTextMap).length} letters (from ${MODERNIZED_LLM_PATH})`);
    } catch (err) {
      console.warn(`  Warning: could not read LLM modernized text: ${err.message}`);
    }
  } else {
    console.log(`  LLM modernized text: not found (${MODERNIZED_LLM_PATH})`);
  }

  // Priority 2: Rule-based normalized text (only for letters not already covered)
  if (existsSync(NORMALIZED_RULES_PATH)) {
    try {
      const normalizedData = JSON.parse(readFileSync(NORMALIZED_RULES_PATH, "utf-8"));
      let addedFromRules = 0;
      for (const entry of normalizedData) {
        const id = String(entry.id);
        if (!modernizedTextMap[id] && entry.text_normalized) {
          modernizedTextMap[id] = entry.text_normalized;
          addedFromRules++;
        }
      }
      console.log(`  Rule-based normalized text: ${addedFromRules} letters added (from ${NORMALIZED_RULES_PATH})`);
    } catch (err) {
      console.warn(`  Warning: could not read normalized text: ${err.message}`);
    }
  } else {
    console.log(`  Rule-based normalized text: not found (${NORMALIZED_RULES_PATH})`);
  }

  console.log(`  Total modernized text available: ${Object.keys(modernizedTextMap).length} letters`);

  // ── 5. Transform letters ────────────────────────────────────────────────

  const letters = [];
  const summaries = [];
  const searchCorpus = [];
  const searchSnippets = {};

  for (const row of letterRows) {
    const id = parseInt(row.id, 10);
    if (Number.isNaN(id)) continue;

    const letter = {
      id,
      date: row.date || null,
      sender: row.sender || "",
      recipient: row.recipient || "",
      place: row.place || "",
      location: parseLocation(row.location),
      text: textToHtml(row.text),
    };
    letters.push(letter);

    summaries.push({
      id,
      date: letter.date,
      sender: letter.sender,
      recipient: letter.recipient,
      place: letter.place,
    });

    const plainText = textToPlain(row.text);
    const corpusEntry = { id, text: plainText };
    if (modernizedTextMap[String(id)]) {
      corpusEntry.text_modern = modernizedTextMap[String(id)];
    }
    searchCorpus.push(corpusEntry);

    searchSnippets[id] = plainText.length > 200
      ? plainText.substring(0, 200) + "..."
      : plainText;
  }

  const modernizedCount = searchCorpus.filter((e) => e.text_modern).length;
  console.log(`  Search corpus: ${modernizedCount}/${searchCorpus.length} letters have modernized text`);

  // ── 6. Transform places ─────────────────────────────────────────────────

  // Count letters per place name from CSV
  const placeLetterCount = {};
  for (const row of letterRows) {
    const p = (row.place || "").trim();
    if (p) {
      placeLetterCount[p] = (placeLetterCount[p] || 0) + 1;
    }
  }

  const letterPlaceNames = Object.keys(placeLetterCount);
  let matchedCount = 0;

  const places = features.map((f) => {
    const geoName = (f.properties?.place || "").trim();
    const coords = f.geometry?.coordinates || [];

    // Try exact match first, then fuzzy
    let count = placeLetterCount[geoName] || 0;
    let displayName = geoName;

    if (count === 0) {
      const match = findMatchingPlace(geoName, letterPlaceNames, f.properties?.aliases || []);
      if (match) {
        count = placeLetterCount[match];
        displayName = match; // Use the letter's version of the name (more readable)
      }
    }

    if (count > 0) matchedCount++;

    // GeoJSON is [lng, lat] — we want { lat, lng }
    return {
      name: displayName,
      _geoName: geoName,  // original GeoJSON name for enrichment lookup
      lat: coords[1] ?? null,
      lng: coords[0] ?? null,
      letterCount: count,
    };
  });

  console.log(`  Place matching: ${matchedCount}/${features.length} places matched to letters (was 48 with exact match)`);

  // ── 6b. Merge Wikidata enrichment (optional, ADR-032) ──────────────────

  if (existsSync(PLACES_ENRICHED_PATH)) {
    try {
      const enriched = JSON.parse(readFileSync(PLACES_ENRICHED_PATH, "utf-8"));
      let enrichedCount = 0;
      for (const p of places) {
        // Try display name first, then original GeoJSON name
        const data = enriched[p.name] || enriched[p._geoName] || null;
        if (data && (data.wikipedia_url || data.wikipedia_da_url || data.wikidata_id)) {
          p.wikipedia = data.wikipedia_url || data.wikipedia_da_url || null;
          p.wikidataId = data.wikidata_id;
          if (data.modern_name) p.modernName = data.modern_name;
          if (data.country) p.country = data.country;
          enrichedCount++;
        }
      }
      console.log(`  Wikidata enrichment: ${enrichedCount}/${places.length} places enriched`);
    } catch (err) {
      console.warn(`  Warning: could not read places enrichment: ${err.message}`);
    }
  } else {
    console.log(`  Wikidata enrichment: not found (${PLACES_ENRICHED_PATH})`);
  }

  // Remove internal _geoName field before output
  for (const p of places) delete p._geoName;

  // ── 7. Write output files ───────────────────────────────────────────────

  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
    console.log(`  Created output directory: ${OUT_DIR}`);
  }

  const outputs = [
    ["letters.json", letters],
    ["letter-summaries.json", summaries],
    ["places.json", places],
    ["search-corpus.json", searchCorpus],
    ["letter-sentiments.json", sentimentMap],
    ["search-snippets.json", searchSnippets],
  ];

  for (const [filename, data] of outputs) {
    const path = join(OUT_DIR, filename);
    const json = JSON.stringify(data, null, 2);
    writeFileSync(path, json, "utf-8");
    const sizeKb = (Buffer.byteLength(json, "utf-8") / 1024).toFixed(1);
    console.log(`  Wrote ${filename} (${sizeKb} KB)`);
  }

  // ── 7b. Publish sentence scores for Sentiment Explorer (ADR-036) ───
  if (existsSync(CVP_SENTENCE_SCORES_PATH)) {
    try {
      const sentenceScoresRaw = readFileSync(CVP_SENTENCE_SCORES_PATH, "utf-8");
      const sentencePath = join(OUT_DIR, "cvp-sentence-scores.json");
      writeFileSync(sentencePath, sentenceScoresRaw, "utf-8");
      const sizeKb = (Buffer.byteLength(sentenceScoresRaw, "utf-8") / 1024).toFixed(1);
      console.log(`  Wrote cvp-sentence-scores.json (${sizeKb} KB)`);
    } catch (err) {
      console.warn(`  Warning: could not publish sentence scores: ${err.message}`);
    }
  } else {
    console.log(`  Sentence scores: not found (${CVP_SENTENCE_SCORES_PATH})`);
  }

  // ── 7c. Generate sentiment overview aggregates (ADR-036) ───────────
  if (existsSync(CVP_SCORES_PATH) && existsSync(CVP_SENTENCE_SCORES_PATH)) {
    try {
      const cvpData = JSON.parse(readFileSync(CVP_SCORES_PATH, "utf-8"));
      const sentenceData = JSON.parse(readFileSync(CVP_SENTENCE_SCORES_PATH, "utf-8"));

      // Build letter metadata lookup
      const letterMeta = {};
      for (const row of letterRows) {
        const id = parseInt(row.id, 10);
        if (!Number.isNaN(id)) {
          letterMeta[id] = { date: row.date || "", sender: row.sender || "", recipient: row.recipient || "" };
        }
      }

      // Rolling monthly averages with p10/p90 bands
      const monthlyData = {};
      for (const [id, scores] of Object.entries(cvpData)) {
        const meta = letterMeta[parseInt(id, 10)];
        if (!meta || !meta.date) continue;
        const month = meta.date.substring(0, 7);
        if (!monthlyData[month]) monthlyData[month] = { means: [], p10s: [], p90s: [] };
        monthlyData[month].means.push(scores.cvp_mean);
        monthlyData[month].p10s.push(scores.cvp_p10);
        monthlyData[month].p90s.push(scores.cvp_p90);
      }
      const rolling = Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          month,
          mean: data.means.reduce((s, v) => s + v, 0) / data.means.length,
          p10: data.p10s.reduce((s, v) => s + v, 0) / data.p10s.length,
          p90: data.p90s.reduce((s, v) => s + v, 0) / data.p90s.length,
          count: data.means.length,
        }));

      // Distribution bins
      const binWidth = 0.1;
      const bins = {};
      for (const [, scores] of Object.entries(cvpData)) {
        const bin = Math.floor(scores.cvp_mean / binWidth) * binWidth;
        const key = bin.toFixed(2);
        bins[key] = (bins[key] || 0) + 1;
      }
      const distribution = Object.entries(bins)
        .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
        .map(([min, count]) => ({ min: parseFloat(min), max: parseFloat(min) + binWidth, count }));

      // Notable letters
      const letterEntries = Object.entries(cvpData)
        .map(([id, scores]) => {
          const numId = parseInt(id, 10);
          const meta = letterMeta[numId] || {};
          // Find the most extreme sentence for excerpt
          const letterSentences = sentenceData.filter(s => s.letter_id === numId && !s.is_formulaic);
          const mostNeg = letterSentences.reduce((best, s) => s.score < (best?.score ?? 999) ? s : best, null);
          const mostPos = letterSentences.reduce((best, s) => s.score > (best?.score ?? -999) ? s : best, null);
          return { id: numId, ...meta, ...scores, mostNeg, mostPos };
        })
        .filter(e => e.date);

      const makeNotable = (entry, excerptSentence) => ({
        id: entry.id,
        date: entry.date,
        sender: entry.sender,
        recipient: entry.recipient,
        score: entry.cvp_mean,
        excerpt: excerptSentence?.text || "",
      });

      const sortedByMean = [...letterEntries].sort((a, b) => a.cvp_mean - b.cvp_mean);
      const sortedByRange = [...letterEntries].sort((a, b) => b.cvp_range - a.cvp_range);
      const sortedByNegRatio = [...letterEntries].sort((a, b) => b.negative_ratio - a.negative_ratio);

      const notable = {
        most_negative: sortedByMean.slice(0, 10).map(e => makeNotable(e, e.mostNeg)),
        most_positive: sortedByMean.slice(-10).reverse().map(e => makeNotable(e, e.mostPos)),
        widest_range: sortedByRange.slice(0, 10).map(e => makeNotable(e, e.mostNeg)),
        highest_negative_ratio: sortedByNegRatio.slice(0, 10).map(e => makeNotable(e, e.mostNeg)),
      };

      const overview = { rolling, distribution, notable };
      const overviewJson = JSON.stringify(overview, null, 2);
      const overviewPath = join(OUT_DIR, "sentiment-overview.json");
      writeFileSync(overviewPath, overviewJson, "utf-8");
      const sizeKb = (Buffer.byteLength(overviewJson, "utf-8") / 1024).toFixed(1);
      console.log(`  Wrote sentiment-overview.json (${sizeKb} KB)`);
    } catch (err) {
      console.warn(`  Warning: could not generate sentiment overview: ${err.message}`);
    }
  }

  // ── 7d. Publish psycholinguistic data files (ADR-037) ───────────
  const psychoFiles = [
    "letter-psycholinguistics.json",
    "cvp-emotion-scores.json",
    "letter-audience-divergence.json",
    "letter-narrative-arcs.json",
    "semantic-shifts.json",
    "pca-dimensions.json",
  ];
  for (const filename of psychoFiles) {
    const srcPath = join(ROOT, "data", filename);
    if (existsSync(srcPath)) {
      try {
        const raw = readFileSync(srcPath, "utf-8");
        const destPath = join(OUT_DIR, filename);
        writeFileSync(destPath, raw, "utf-8");
        const sizeKb = (Buffer.byteLength(raw, "utf-8") / 1024).toFixed(1);
        console.log(`  Wrote ${filename} (${sizeKb} KB)`);
      } catch (err) {
        console.warn(`  Warning: could not publish ${filename}: ${err.message}`);
      }
    }
  }

  console.log(
    `\nDone. ${letters.length} letters, ${places.length} places, ${Object.keys(sentimentMap).length} sentiments.`
  );
}

main();
