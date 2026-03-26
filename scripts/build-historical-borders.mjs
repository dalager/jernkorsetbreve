#!/usr/bin/env node
/**
 * Build optimized European border GeoJSON from U-Spatial world data.
 * See ADR-005 and ADR-008 for design rationale.
 *
 * Input:  maps/1914/1914.geojson, maps/1914/1918.geojson
 * Output: web/website/public/data/borders-1914.json, borders-1918.json
 *
 * Zero npm dependencies. Douglas-Peucker implemented inline.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Europe bounding box (ADR-005)
const EUROPE_BBOX = { latMin: 34, latMax: 72, lngMin: -25, lngMax: 45 };

// Douglas-Peucker tolerance in degrees (~1.1 km at European latitudes)
const SIMPLIFY_TOLERANCE = 0.01;

// Coordinate precision (5 decimal places ≈ 1.1 m)
const PRECISION = 5;

// EN → DA country name translations.
// Source names taken from the U-Spatial GeoJSON (which uses some anachronistic
// modern names like "Russian Federation" for 1914 Russia). The notebook
// notebooks/02_1_create1914map.ipynb has the original mapping; we extend it
// here to cover all 44 European features.
const NAME_DA = {
  // Core countries (from notebooks + extended)
  "Albania": "Albanien",
  "Andorra": "Andorra",
  "Arabia": "Arabien",
  "Austria - Hungary": "Østrig-Ungarn",
  "Austria - Hungary ": "Østrig-Ungarn",   // trailing space in source data
  "Belgium": "Belgien",
  "Bulgaria": "Bulgarien",
  "Cyprus": "Cypern",
  "Denmark": "Danmark",
  "Faroe Islands": "Færøerne",
  "Finland": "Finland",
  "France": "Frankrig",
  "French Sudan": "Fransk Sudan",
  "French West Africa": "Fransk Vestafrika",
  "Germany": "Tyskland",
  "Gibraltar": "Gibraltar",
  "Greece": "Grækenland",
  "Greenland": "Grønland",
  "Guernsey": "Guernsey",
  "Iceland": "Island",
  "Ireland": "Irland",
  "Isle of Man": "Isle of Man",
  "Italy": "Italien",
  "Jan Mayen": "Jan Mayen",
  "Jersey": "Jersey",
  "Liechtenstein": "Liechtenstein",
  "Luxembourg": "Luxembourg",
  "Malta": "Malta",
  "Monaco": "Monaco",
  "Montenegro": "Montenegro",
  "Morocco": "Marokko",
  "Netherlands": "Holland",
  "Norway": "Norge",
  "Ottoman Empire": "Det Osmanniske Rige",
  "Persia": "Persien",
  "Poland": "Polen",
  "Portugal": "Portugal",
  "Romania": "Rumænien",
  "Rumania": "Rumænien",                   // spelling in source data
  "Russia": "Rusland",
  "Russian Federation": "Rusland",          // anachronistic name in source
  "San Marino": "San Marino",
  "Serbia": "Serbien",
  "Spain": "Spanien",
  "Spanish  Morocco": "Spansk Marokko",     // double space in source (1914)
  "Spanish Morocco": "Spansk Marokko",      // single space (1918)
  "Sweden": "Sverige",
  "Switzerland": "Schweiz",
  "Tunis": "Tunesien",
  "Turkish Empire": "Det Osmanniske Rige",  // 1918 name variant
  "United Kingdom": "Storbritannien",
  // Post-1918 states
  "Austria": "Østrig",
  "Hungary": "Ungarn",
  "Czechoslovakia": "Tjekkoslovakiet",
  "Yugoslavia": "Jugoslavien",
  "Estonia": "Estland",
  "Latvia": "Letland",
  "Lithuania": "Litauen",
  "Turkey": "Tyrkiet",
};

// --- Douglas-Peucker simplification ---

function sqDistToSegment(p, a, b) {
  let dx = b[0] - a[0];
  let dy = b[1] - a[1];
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      dx = p[0] - b[0];
      dy = p[1] - b[1];
    } else if (t > 0) {
      dx = p[0] - (a[0] + dx * t);
      dy = p[1] - (a[1] + dy * t);
    } else {
      dx = p[0] - a[0];
      dy = p[1] - a[1];
    }
  } else {
    dx = p[0] - a[0];
    dy = p[1] - a[1];
  }
  return dx * dx + dy * dy;
}

function douglasPeucker(points, tolerance) {
  if (points.length <= 2) return points;

  const sqTol = tolerance * tolerance;
  let maxDist = 0;
  let maxIdx = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const d = sqDistToSegment(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > sqTol) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIdx), tolerance);
    return left.slice(0, -1).concat(right);
  }

  return [points[0], points[points.length - 1]];
}

// --- Geometry processing ---

function simplifyRing(ring, tolerance) {
  const simplified = douglasPeucker(ring, tolerance);
  // Ensure ring closure (first === last)
  if (simplified.length >= 2) {
    const first = simplified[0];
    const last = simplified[simplified.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      simplified.push([...first]);
    }
  }
  return simplified;
}

function truncateCoord(coord) {
  return [
    parseFloat(coord[0].toFixed(PRECISION)),
    parseFloat(coord[1].toFixed(PRECISION)),
  ];
}

function truncateRing(ring) {
  return ring.map(truncateCoord);
}

function featureBBoxOverlaps(feature) {
  // Check if any coordinate falls within the Europe bounding box.
  // GeoJSON coordinates are [lng, lat].
  const coords = feature.geometry.coordinates;
  const type = feature.geometry.type;

  const rings =
    type === "Polygon"
      ? coords
      : type === "MultiPolygon"
        ? coords.flat()
        : [];

  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (
        lat >= EUROPE_BBOX.latMin &&
        lat <= EUROPE_BBOX.latMax &&
        lng >= EUROPE_BBOX.lngMin &&
        lng <= EUROPE_BBOX.lngMax
      ) {
        return true;
      }
    }
  }
  return false;
}

function processFeature(feature) {
  const type = feature.geometry.type;
  let coordinates;

  if (type === "Polygon") {
    coordinates = feature.geometry.coordinates.map((ring) =>
      truncateRing(simplifyRing(ring, SIMPLIFY_TOLERANCE))
    );
  } else if (type === "MultiPolygon") {
    coordinates = feature.geometry.coordinates.map((polygon) =>
      polygon.map((ring) =>
        truncateRing(simplifyRing(ring, SIMPLIFY_TOLERANCE))
      )
    );
  } else {
    return null;
  }

  const name = feature.properties.NAME || "";
  return {
    type: "Feature",
    properties: {
      NAME: name,
      NAME_DA: NAME_DA[name] || name,
    },
    geometry: { type, coordinates },
  };
}

function processFile(inputPath, outputPath) {
  console.log(`Reading ${inputPath}...`);
  const raw = readFileSync(inputPath, "utf-8");
  const geojson = JSON.parse(raw);

  const totalFeatures = geojson.features.length;
  let totalPointsBefore = 0;
  let totalPointsAfter = 0;

  // Filter to Europe and process
  const features = [];
  for (const feature of geojson.features) {
    if (!featureBBoxOverlaps(feature)) continue;

    // Count points before
    const type = feature.geometry.type;
    if (type === "Polygon") {
      totalPointsBefore += feature.geometry.coordinates.reduce(
        (s, r) => s + r.length,
        0
      );
    } else if (type === "MultiPolygon") {
      totalPointsBefore += feature.geometry.coordinates.reduce(
        (s, p) => s + p.reduce((s2, r) => s2 + r.length, 0),
        0
      );
    }

    const processed = processFeature(feature);
    if (processed) {
      // Count points after
      if (processed.geometry.type === "Polygon") {
        totalPointsAfter += processed.geometry.coordinates.reduce(
          (s, r) => s + r.length,
          0
        );
      } else if (processed.geometry.type === "MultiPolygon") {
        totalPointsAfter += processed.geometry.coordinates.reduce(
          (s, p) => s + p.reduce((s2, r) => s2 + r.length, 0),
          0
        );
      }
      features.push(processed);
    }
  }

  const output = { type: "FeatureCollection", features };
  const json = JSON.stringify(output);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, json);

  const sizeKB = (Buffer.byteLength(json) / 1024).toFixed(0);
  console.log(
    `  ${totalFeatures} features → ${features.length} European features`
  );
  console.log(
    `  ${totalPointsBefore.toLocaleString()} points → ${totalPointsAfter.toLocaleString()} points`
  );
  console.log(`  Output: ${outputPath} (${sizeKB} KB)`);
}

// --- Main ---

const OUTPUT_DIR = join(ROOT, "web/website/public/data");

const files = [
  {
    input: join(ROOT, "maps/1914/1914.geojson"),
    output: join(OUTPUT_DIR, "borders-1914.json"),
  },
  {
    input: join(ROOT, "maps/1914/1918.geojson"),
    output: join(OUTPUT_DIR, "borders-1918.json"),
  },
];

console.log("Building historical border data...\n");

for (const { input, output } of files) {
  processFile(input, output);
  console.log();
}

console.log("Done.");
