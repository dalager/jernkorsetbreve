#!/usr/bin/env node
/**
 * Generate sitemap.xml for jernkorset.dk
 *
 * Reads letter-summaries, person-pages, and place-pages from the website's
 * public/data directory and writes a sitemap.xml into the build output (out/).
 *
 * Run after `next build`:
 *   node scripts/generate-sitemap.js
 */

const fs = require("fs");
const path = require("path");

const SITE_URL = "https://jernkorset.dk";
const DATA_DIR = path.join(__dirname, "..", "apps", "website", "public", "data");
const OUT_DIR = path.join(__dirname, "..", "apps", "website", "out");

function readJson(filename) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), "utf-8"));
  } catch {
    console.warn(`  Warning: Could not read ${filename}, skipping`);
    return [];
  }
}

function toDate(iso) {
  if (!iso) return new Date().toISOString().split("T")[0];
  return iso.split("T")[0];
}

const today = new Date().toISOString().split("T")[0];

// Static pages with priorities
const staticPages = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/breve/", priority: "0.9", changefreq: "weekly" },
  { path: "/personer/", priority: "0.8", changefreq: "monthly" },
  { path: "/steder/", priority: "0.8", changefreq: "monthly" },
  { path: "/billeder/", priority: "0.7", changefreq: "monthly" },
  { path: "/about/", priority: "0.6", changefreq: "monthly" },
  { path: "/search/", priority: "0.5", changefreq: "monthly" },
  { path: "/map/", priority: "0.6", changefreq: "monthly" },
  { path: "/timeline/", priority: "0.6", changefreq: "monthly" },
  { path: "/network/", priority: "0.5", changefreq: "monthly" },
  { path: "/statistics/", priority: "0.5", changefreq: "monthly" },
  { path: "/sproganalyse/", priority: "0.5", changefreq: "monthly" },
  { path: "/sentiment/", priority: "0.5", changefreq: "monthly" },
  { path: "/explorer/", priority: "0.5", changefreq: "monthly" },
];

// Dynamic pages
const letters = readJson("letter-summaries.json");
const persons = readJson("person-pages.json");
const places = readJson("place-pages.json");

console.log(`Generating sitemap.xml:`);
console.log(`  ${staticPages.length} static pages`);
console.log(`  ${letters.length} letters`);
console.log(`  ${persons.length} persons`);
console.log(`  ${places.length} places`);

let urls = "";

// Static pages
for (const page of staticPages) {
  urls += `  <url>
    <loc>${SITE_URL}${page.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>\n`;
}

// Letter pages
for (const letter of letters) {
  urls += `  <url>
    <loc>${SITE_URL}/letters/${letter.id}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
}

// Person pages
for (const person of persons) {
  urls += `  <url>
    <loc>${SITE_URL}/personer/${person.id}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>\n`;
}

// Place pages
for (const place of places) {
  urls += `  <url>
    <loc>${SITE_URL}/steder/${place.id}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>\n`;
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>
`;

const totalUrls = staticPages.length + letters.length + persons.length + places.length;

// Write to both public (for dev) and out (for deploy)
fs.writeFileSync(path.join(OUT_DIR, "sitemap.xml"), sitemap);
console.log(`  Written to out/sitemap.xml (${totalUrls} URLs)`);

// Also copy to public so next dev serves it
fs.writeFileSync(
  path.join(__dirname, "..", "apps", "website", "public", "sitemap.xml"),
  sitemap
);
console.log(`  Written to public/sitemap.xml (${totalUrls} URLs)`);
