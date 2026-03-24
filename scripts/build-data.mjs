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

const LETTERS_CSV = join(ROOT, "webapp", "data", "letters.csv");
const PLACES_GEOJSON = join(ROOT, "data", "places.geojson");
const SENTIMENTS_CSV = join(ROOT, "data", "sentiment_scored_letters.csv");
const OUT_DIR = join(ROOT, "webapp", "public-site", "public", "data");

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

  // Build sentiment lookup: id -> score
  const sentimentMap = {};
  for (const row of sentimentRows) {
    const id = parseInt(row.id, 10);
    const score = parseFloat(row.sentiment_score);
    if (!Number.isNaN(id) && !Number.isNaN(score)) {
      sentimentMap[id] = score;
    }
  }
  console.log(`  Sentiment scores mapped: ${Object.keys(sentimentMap).length}`);

  // ── 4. Transform letters ────────────────────────────────────────────────

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
    searchCorpus.push({ id, text: plainText });

    searchSnippets[id] = plainText.length > 200
      ? plainText.substring(0, 200) + "..."
      : plainText;
  }

  // ── 5. Transform places ─────────────────────────────────────────────────

  // Count letters per place name (case-sensitive match against CSV place field)
  const placeLetterCount = {};
  for (const row of letterRows) {
    const p = (row.place || "").trim();
    if (p) {
      placeLetterCount[p] = (placeLetterCount[p] || 0) + 1;
    }
  }

  const places = features.map((f) => {
    const name = f.properties?.place || "";
    const coords = f.geometry?.coordinates || [];
    // GeoJSON is [lng, lat] — we want { lat, lng }
    return {
      name,
      lat: coords[1] ?? null,
      lng: coords[0] ?? null,
      letterCount: placeLetterCount[name] || 0,
    };
  });

  // ── 6. Write output files ───────────────────────────────────────────────

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

  console.log(
    `\nDone. ${letters.length} letters, ${places.length} places, ${Object.keys(sentimentMap).length} sentiments.`
  );
}

main();
