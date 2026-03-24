#!/usr/bin/env node

/**
 * Generates battles.json from the WWI battles CSV, pre-computing
 * sentiment correlation and geographic proximity with the letter collection.
 *
 * Usage:  node scripts/generate-battle-data.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── Paths ────────────────────────────────────────────────────────────────────

const BATTLES_CSV = join(ROOT, "historical_data", "Battles_WW1.csv");
const SENTIMENTS_JSON = join(ROOT, "webapp", "public-site", "public", "data", "letter-sentiments.json");
const SUMMARIES_JSON = join(ROOT, "webapp", "public-site", "public", "data", "letter-summaries.json");
const PLACES_JSON = join(ROOT, "webapp", "public-site", "public", "data", "places.json");
const OUT_FILE = join(ROOT, "webapp", "public-site", "public", "data", "battles.json");

// ── Constants ────────────────────────────────────────────────────────────────

const BEFORE_WINDOW_DAYS = 14;
const AFTER_WINDOW_DAYS = 30;
const PROXIMITY_KM = 200;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Haversine distance in km between two lat/lng points. */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Parse an ISO date string to a Date at midnight UTC. */
function parseDate(s) {
  if (!s) return null;
  const d = new Date(s + "T00:00:00Z");
  return isNaN(d.getTime()) ? null : d;
}

/** Day difference: (a - b) in days. */
function daysBetween(a, b) {
  return (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Minimal CSV row parser that handles quoted fields (which may contain commas).
 * Returns an array of string arrays.
 */
function parseCsvRows(text) {
  const rows = [];
  const lines = text.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const fields = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        i++; // skip opening quote
        let val = "";
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') {
            val += '"';
            i += 2;
          } else if (line[i] === '"') {
            i++; // skip closing quote
            break;
          } else {
            val += line[i++];
          }
        }
        if (line[i] === ",") i++; // skip delimiter
        fields.push(val);
      } else {
        const next = line.indexOf(",", i);
        if (next === -1) {
          fields.push(line.slice(i));
          break;
        }
        fields.push(line.slice(i, next));
        i = next + 1;
      }
    }
    rows.push(fields);
  }
  return rows;
}

// ── Load data ────────────────────────────────────────────────────────────────

const sentiments = JSON.parse(readFileSync(SENTIMENTS_JSON, "utf-8"));
const summaries = JSON.parse(readFileSync(SUMMARIES_JSON, "utf-8"));
const places = JSON.parse(readFileSync(PLACES_JSON, "utf-8"));

// Build a lookup: place name -> { lat, lng }
const placeCoords = new Map();
for (const p of places) {
  placeCoords.set(p.name, { lat: p.lat, lng: p.lng });
}

// Enrich letters with parsed date, sentiment, and coordinates
const letters = summaries
  .map((l) => ({
    id: l.id,
    date: parseDate(l.date),
    sentiment: sentiments[String(l.id)] ?? null,
    place: l.place,
    coords: placeCoords.get(l.place) ?? null,
  }))
  .filter((l) => l.date !== null);

// ── Parse battles CSV ────────────────────────────────────────────────────────

const csvRows = parseCsvRows(readFileSync(BATTLES_CSV, "utf-8"));
const header = csvRows[0];
const dataRows = csvRows.slice(1);

const battles = dataRows.map((cols) => {
  const obj = {};
  header.forEach((h, i) => (obj[h.trim()] = (cols[i] ?? "").trim()));

  // Parse coordinates: "lat, lng"
  const coordParts = (obj.Coordinates || "").split(",").map((s) => parseFloat(s.trim()));
  const lat = coordParts.length === 2 && !isNaN(coordParts[0]) ? coordParts[0] : null;
  const lng = coordParts.length === 2 && !isNaN(coordParts[1]) ? coordParts[1] : null;

  return {
    name: obj.Battle || "",
    startDate: obj.Date || null,
    endDate: obj.EndDate || null,
    front: obj.Front || "",
    location: obj.Location || "",
    lat,
    lng,
    wikipedia: obj.wikipedia || "",
  };
});

// ── Compute sentiment correlation and proximity ──────────────────────────────

let withSentiment = 0;
let withNearby = 0;

for (const battle of battles) {
  const start = parseDate(battle.startDate);
  const end = parseDate(battle.endDate);

  // Sentiment: find letters in before/after windows around the battle start
  if (start) {
    const beforeLetters = letters.filter((l) => {
      const diff = daysBetween(start, l.date);
      return diff > 0 && diff <= BEFORE_WINDOW_DAYS && l.sentiment !== null;
    });
    const afterLetters = letters.filter((l) => {
      const ref = end ?? start;
      const diff = daysBetween(l.date, ref);
      return diff >= 0 && diff <= AFTER_WINDOW_DAYS && l.sentiment !== null;
    });

    const avgBefore =
      beforeLetters.length > 0
        ? beforeLetters.reduce((s, l) => s + l.sentiment, 0) / beforeLetters.length
        : null;
    const avgAfter =
      afterLetters.length > 0
        ? afterLetters.reduce((s, l) => s + l.sentiment, 0) / afterLetters.length
        : null;

    battle.sentimentBefore = avgBefore !== null ? Math.round(avgBefore * 10) / 10 : null;
    battle.sentimentAfter = avgAfter !== null ? Math.round(avgAfter * 10) / 10 : null;
    battle.sentimentDelta =
      avgBefore !== null && avgAfter !== null
        ? Math.round((avgAfter - avgBefore) * 10) / 10
        : null;
    battle.letterCountBefore = beforeLetters.length;
    battle.letterCountAfter = afterLetters.length;

    if (battle.sentimentDelta !== null) withSentiment++;
  } else {
    battle.sentimentBefore = null;
    battle.sentimentAfter = null;
    battle.sentimentDelta = null;
    battle.letterCountBefore = 0;
    battle.letterCountAfter = 0;
  }

  // Geographic proximity
  if (battle.lat !== null && battle.lng !== null) {
    const nearby = letters.filter((l) => {
      if (!l.coords) return false;
      return haversineKm(battle.lat, battle.lng, l.coords.lat, l.coords.lng) <= PROXIMITY_KM;
    });
    battle.nearbyLetterIds = [...new Set(nearby.map((l) => l.id))].sort((a, b) => a - b);
    if (battle.nearbyLetterIds.length > 0) withNearby++;
  } else {
    battle.nearbyLetterIds = [];
  }
}

// ── Write output ─────────────────────────────────────────────────────────────

writeFileSync(OUT_FILE, JSON.stringify(battles, null, 2) + "\n", "utf-8");

console.log(
  `Processed ${battles.length} battles, ${withSentiment} with sentiment data, ${withNearby} with nearby letters`
);
console.log(`Output: ${OUT_FILE}`);
