#!/usr/bin/env node
/**
 * Generate markdown versions of all pages for agent content negotiation.
 *
 * For each HTML page in the static export, this script generates a companion
 * .md file with clean, structured markdown. A small _worker.js then routes
 * requests with Accept: text/markdown to these pre-built files.
 *
 * Run after `next build`:
 *   node scripts/generate-markdown-pages.js
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

/** Strip HTML tags and decode common entities */
function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** Format a Danish date from ISO string */
function formatDate(iso) {
  if (!iso) return "";
  const months = [
    "januar", "februar", "marts", "april", "maj", "juni",
    "juli", "august", "september", "oktober", "november", "december",
  ];
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${months[m - 1]} ${y}`;
}

/** Estimate token count (rough: ~4 chars per token) */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/** Write a markdown file, creating directories as needed */
function writeMd(relPath, content) {
  const fullPath = path.join(OUT_DIR, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

// ── Homepage ──────────────────────────────────────────────────

function generateHomepage(letterCount) {
  return `# Jernkorset Breve — En brevsamling fra 1911–1918

${letterCount} breve fra Peter Mærsk, en dansker der kæmpede på tysk side under Første Verdenskrig. Brevsamlingen dækker perioden 1911 til 1918.

## Indhold

- [Breve](/breve/) — Alle ${letterCount} breve i kronologisk rækkefølge
- [Personer](/personer/) — De mennesker der nævnes i brevene
- [Steder](/steder/) — Steder nævnt i brevene, med kort
- [Billeder](/billeder/) — Fotografier og dokumenter
- [Søg](/search/) — Fritekst-søgning i brevene
- [Kort](/map/) — Geografisk visualisering
- [Tidslinje](/timeline/) — Kronologisk oversigt
- [Netværk](/network/) — Sociale relationer
- [Statistik](/statistics/) — Brevstatistik
- [Sproganalyse](/sproganalyse/) — Sproglig analyse
- [Sentiment](/sentiment/) — Følelsesanalyse

## Om samlingen

Brevene er skrevet af og til Peter Mærsk fra Øster Aabølling i Sønderjylland. Som dansker i det tyske kejserrige blev Peter indkaldt til den tyske hær i 1913 og kæmpede på både Øst- og Vestfronten under Første Verdenskrig. Samlingen giver et unikt indblik i hverdagen for en dansk soldat i tysk tjeneste.

---

*Kilde: [jernkorset.dk](${SITE_URL})*
`;
}

// ── Letter list ───────────────────────────────────────────────

function generateLetterList(summaries) {
  let md = `# Breve — Jernkorset Breve

${summaries.length} breve i kronologisk rækkefølge.

| # | Dato | Afsender | Modtager | Sted |
|---|------|----------|----------|------|
`;
  for (const s of summaries) {
    md += `| ${s.id} | ${formatDate(s.date)} | ${s.sender} | ${s.recipient} | ${s.place || ""} |\n`;
  }
  md += `\n---\n\n*Kilde: [jernkorset.dk/breve/](${SITE_URL}/breve/)*\n`;
  return md;
}

// ── Letter detail ─────────────────────────────────────────────

function generateLetterPage(letter) {
  const text = stripHtml(letter.text);
  const modernText = letter.text_modern ? stripHtml(letter.text_modern) : null;

  let md = `# Brev ${letter.id}: ${formatDate(letter.date)}

- **Afsender:** ${letter.sender}
- **Modtager:** ${letter.recipient}
- **Dato:** ${formatDate(letter.date)}
- **Sted:** ${letter.place || "Ukendt"}
`;

  if (letter.location) {
    md += `- **Koordinater:** ${letter.location.lat}, ${letter.location.lng}\n`;
  }

  md += `\n## Brevtekst (original)\n\n${text}\n`;

  if (modernText && modernText !== text) {
    md += `\n## Brevtekst (moderne dansk)\n\n${modernText}\n`;
  }

  md += `\n---\n\n`;
  md += `- [← Forrige brev](/letters/${letter.id - 1}/) | [Næste brev →](/letters/${letter.id + 1}/)\n`;
  md += `- [Alle breve](/breve/)\n`;
  md += `\n*Kilde: [jernkorset.dk/letters/${letter.id}/](${SITE_URL}/letters/${letter.id}/)*\n`;
  return md;
}

// ── Person list ───────────────────────────────────────────────

function generatePersonList(persons) {
  let md = `# Personer — Jernkorset Breve

${persons.length} personer nævnt i brevsamlingen.

| Navn | Rolle | Breve |
|------|-------|-------|
`;
  for (const p of persons) {
    md += `| [${p.full_name}](/personer/${p.id}/) | ${p.role || ""} | ${p.letter_count} |\n`;
  }
  md += `\n---\n\n*Kilde: [jernkorset.dk/personer/](${SITE_URL}/personer/)*\n`;
  return md;
}

// ── Person detail ─────────────────────────────────────────────

function generatePersonPage(person) {
  let md = `# ${person.full_name}

- **Rolle:** ${person.role || "Ukendt"}
- **Kategori:** ${person.category || ""}
`;

  if (person.birth_date) md += `- **Født:** ${formatDate(person.birth_date)}\n`;
  if (person.death_date) md += `- **Død:** ${formatDate(person.death_date)}\n`;
  md += `- **Nævnt i:** ${person.letter_count} breve (${formatDate(person.first_mention)} – ${formatDate(person.last_mention)})\n`;

  if (person.biographical) {
    md += `\n## Biografi\n\n${person.biographical}\n`;
  }

  if (person.connections && person.connections.length > 0) {
    md += `\n## Forbindelser\n\n`;
    for (const c of person.connections) {
      md += `- [${c.full_name || c.person_id}](/personer/${c.person_id}/)`;
      if (c.weight) md += ` (${c.weight} forbindelser)`;
      md += "\n";
    }
  }

  if (person.letters && person.letters.length > 0) {
    md += `\n## Breve\n\n`;
    const shown = person.letters.slice(0, 20);
    for (const l of shown) {
      const role = l.role === "sender" ? "Afsender" : l.role === "recipient" ? "Modtager" : "Nævnt";
      md += `- [Brev ${l.letter_id}](/letters/${l.letter_id}/) — ${formatDate(l.date)}${l.place ? ", " + l.place : ""} (${role})\n`;
    }
    if (person.letters.length > 20) {
      md += `- … og ${person.letters.length - 20} flere breve\n`;
    }
  }

  md += `\n---\n\n*Kilde: [jernkorset.dk/personer/${person.id}/](${SITE_URL}/personer/${person.id}/)*\n`;
  return md;
}

// ── Place list ────────────────────────────────────────────────

function generatePlaceList(places) {
  let md = `# Steder — Jernkorset Breve

${places.length} steder nævnt i brevsamlingen.

| Sted | Moderne navn | Land | Breve |
|------|-------------|------|-------|
`;
  for (const p of places) {
    md += `| [${p.name}](/steder/${p.id}/) | ${p.modern_name || ""} | ${p.country || ""} | ${p.letter_count} |\n`;
  }
  md += `\n---\n\n*Kilde: [jernkorset.dk/steder/](${SITE_URL}/steder/)*\n`;
  return md;
}

// ── Place detail ──────────────────────────────────────────────

function generatePlacePage(place) {
  let md = `# ${place.name}

- **Moderne navn:** ${place.modern_name || place.name}
- **Land:** ${place.country || "Ukendt"}
- **Breve fra dette sted:** ${place.letter_count}
`;

  if (place.lat && place.lng) {
    md += `- **Koordinater:** ${place.lat}, ${place.lng}\n`;
  }
  if (place.wikidata_id) {
    md += `- **Wikidata:** [${place.wikidata_id}](https://www.wikidata.org/wiki/${place.wikidata_id})\n`;
  }
  if (place.wikipedia_url) {
    md += `- **Wikipedia:** [Læs mere](${place.wikipedia_url})\n`;
  }

  if (place.description) {
    md += `\n## Beskrivelse\n\n${place.description}\n`;
  }

  if (place.named_locations && place.named_locations.length > 0) {
    md += `\n## Navngivne lokaliteter\n\n`;
    for (const loc of place.named_locations) {
      md += `### ${loc.name || loc.id}\n`;
      if (loc.aliases && loc.aliases.length) md += `*Også kaldet: ${loc.aliases.join(", ")}*\n\n`;
      if (loc.description) md += `${loc.description}\n\n`;
    }
  }

  if (place.letters && place.letters.length > 0) {
    md += `\n## Breve fra dette sted\n\n`;
    for (const l of place.letters) {
      md += `- [Brev ${l.letter_id}](/letters/${l.letter_id}/) — ${formatDate(l.date)}, ${l.sender} til ${l.recipient}\n`;
    }
  }

  md += `\n---\n\n*Kilde: [jernkorset.dk/steder/${place.id}/](${SITE_URL}/steder/${place.id}/)*\n`;
  return md;
}

// ── Main ──────────────────────────────────────────────────────

function main() {
  console.log("Generating markdown pages for agent content negotiation:");

  const letters = readJson("letters.json");
  const summaries = readJson("letter-summaries.json");
  const persons = readJson("person-pages.json");
  const places = readJson("place-pages.json");

  let count = 0;

  // Homepage
  writeMd("index.md", generateHomepage(letters.length));
  count++;

  // Letter list
  writeMd("breve/index.md", generateLetterList(summaries.length ? summaries : letters));
  count++;

  // Letter detail pages
  for (const letter of letters) {
    writeMd(`letters/${letter.id}/index.md`, generateLetterPage(letter));
    count++;
  }

  // Person list
  writeMd("personer/index.md", generatePersonList(persons));
  count++;

  // Person detail pages
  for (const person of persons) {
    writeMd(`personer/${person.id}/index.md`, generatePersonPage(person));
    count++;
  }

  // Place list
  writeMd("steder/index.md", generatePlaceList(places));
  count++;

  // Place detail pages
  for (const place of places) {
    writeMd(`steder/${place.id}/index.md`, generatePlacePage(place));
    count++;
  }

  console.log(`  Written ${count} markdown files to out/`);
}

main();
