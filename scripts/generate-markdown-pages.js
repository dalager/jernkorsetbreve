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

// ── About ─────────────────────────────────────────────────────

function generateAbout() {
  return `# Om Jernkorset.dk

Jernkorset.dk er bare det foreløbige seneste stop på et længere familieprojekt.

- Peter Mærsk skrev brevene.
- Else Mærsk, Peters datter, skrev dem ind på maskine i 1990'erne.
- Jørgen Dalager, gift med Aase Mærsk Berthelsen, Peters barnebarn, har scannet og indsamlet materiale rundt om brevsamlingen.
- Christian Dalager, søn af Jørgen og Aase, har skruet nærværende website sammen. Kan kontaktes på christian@dalager.com

## Sprogteknologi og data

Brevene er skrevet på dansk anno 1911–1918 med en retskrivning der kan være svær at læse i dag. Websitet bruger AI-baseret sprogteknologi til at gøre samlingen mere tilgængelig:

- **Semantisk søgning** — Alle 665 breve er indekseret med en multilingual embedding model (multilingual-e5-small, 384 dimensioner), så man kan søge på semantisk nærhed fremfor blot nøgleord.
- **Stemningsanalyse** — Hvert brev er analyseret med Concept Vector Projection (CVP) fra Aarhus Universitet, der giver kontinuerlige sentiment scores baseret på semantiske embeddings. Metoden er udviklet specifikt til historiske og litterære tekster.
- **Emne-grupper og relaterede breve** — Brevene er grupperet i emneklynger og forbundet via lighed.
- **Sproganalyse** — Psykolingvistiske mål som ordlængde, sætningskompleksitet og pronomenfordeling.
- **Data om krigens slag** — Historiske slag er korreleret med brevenes datering og afsendelsessted.

Hele datasættet genereres fra kildefilerne via en automatiseret datapipeline og eksporteres som statiske JSON-filer.

## Kildekode

Koden til dette projekt er open source: [github.com/dalager/jernkorsetbreve](https://github.com/dalager/jernkorsetbreve)

## Data-API

Alle data er tilgængelige som statiske JSON-filer under [\`/data/\`](${SITE_URL}/data/). Se [API-kataloget](${SITE_URL}/.well-known/api-catalog) for maskinlæsbar oversigt.

---

*Kilde: [jernkorset.dk/about/](${SITE_URL}/about/)*
`;
}

// ── Billeder ──────────────────────────────────────────────────

function generateBilleder(imageRegistry) {
  const categories = {};
  for (const img of imageRegistry) {
    const cat = img.category || "other";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(img);
  }

  const categoryLabels = {
    portrait: "Portrætter", group: "Gruppebilleder", place: "Steder",
    map: "Kort", document: "Dokumenter", historical: "Historiske", military: "Militær",
  };

  let md = `# Billeder — Jernkorset Breve

${imageRegistry.length} billeder fra brevsamlingen.

`;

  for (const [cat, imgs] of Object.entries(categories)) {
    md += `## ${categoryLabels[cat] || cat} (${imgs.length})\n\n`;
    for (const img of imgs) {
      md += `- **${img.description || img.filename || img.id}**`;
      if (img.letter_id) md += ` — [Brev ${img.letter_id}](/letters/${img.letter_id}/)`;
      md += "\n";
    }
    md += "\n";
  }

  md += `---\n\n*Kilde: [jernkorset.dk/billeder/](${SITE_URL}/billeder/)*\n`;
  return md;
}

// ── Statistics ────────────────────────────────────────────────

function generateStatistics(letters, sentiments) {
  // Compute basic stats
  const senders = {};
  const recipients = {};
  const years = {};
  for (const l of letters) {
    senders[l.sender] = (senders[l.sender] || 0) + 1;
    recipients[l.recipient] = (recipients[l.recipient] || 0) + 1;
    const y = l.date ? l.date.split("-")[0] : "ukendt";
    years[y] = (years[y] || 0) + 1;
  }

  const totalWords = letters.reduce((sum, l) => sum + (stripHtml(l.text || "").split(/\s+/).length), 0);
  const avgWords = Math.round(totalWords / letters.length);

  let md = `# Statistik — Jernkorset Breve

## Nøgletal

- **Antal breve:** ${letters.length}
- **Samlede ord:** ${totalWords.toLocaleString("da-DK")}
- **Gns. ord pr. brev:** ${avgWords}
- **Periode:** ${letters[0]?.date || "?"} – ${letters[letters.length - 1]?.date || "?"}

## Breve pr. år

| År | Antal |
|----|-------|
`;
  for (const [y, n] of Object.entries(years).sort()) {
    md += `| ${y} | ${n} |\n`;
  }

  md += `\n## Top afsendere\n\n| Afsender | Antal |\n|----------|-------|\n`;
  for (const [name, n] of Object.entries(senders).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    md += `| ${name} | ${n} |\n`;
  }

  md += `\n## Top modtagere\n\n| Modtager | Antal |\n|----------|-------|\n`;
  for (const [name, n] of Object.entries(recipients).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    md += `| ${name} | ${n} |\n`;
  }

  // Sentiment summary if available
  if (sentiments && typeof sentiments === "object") {
    const scores = Object.values(sentiments).map(s => s.cvp_mean).filter(v => v != null);
    if (scores.length > 0) {
      const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3);
      const pos = scores.filter(s => s > 0.05).length;
      const neg = scores.filter(s => s < -0.05).length;
      const neu = scores.length - pos - neg;
      md += `\n## Sentiment-oversigt\n\n`;
      md += `- **Gns. sentiment (CVP):** ${avg}\n`;
      md += `- **Positive breve:** ${pos}\n`;
      md += `- **Neutrale breve:** ${neu}\n`;
      md += `- **Negative breve:** ${neg}\n`;
    }
  }

  md += `\n## Rådata\n\n`;
  md += `- [letters.json](/data/letters.json) — Alle breve med fuld tekst\n`;
  md += `- [letter-summaries.json](/data/letter-summaries.json) — Brevmetadata uden tekst\n`;
  md += `- [letter-sentiments.json](/data/letter-sentiments.json) — Sentiment-scores pr. brev\n`;

  md += `\n---\n\n*Kilde: [jernkorset.dk/statistics/](${SITE_URL}/statistics/)*\n`;
  return md;
}

// ── Sentiment ─────────────────────────────────────────────────

function generateSentiment(sentimentOverview) {
  let md = `# Følelsesanalyse — Jernkorset Breve

Sentimentanalyse af alle breve ved hjælp af Concept Vector Projection (CVP), en teknik fra Aarhus Universitet udviklet til historiske og litterære tekster.

## Metode

CVP projicerer brevenes semantiske embeddings mod konceptvektorer (positiv/negativ) for at give kontinuerlige sentiment-scores. Metoden klarer sig bedre end dictionary-baserede værktøjer på ældre dansk.

`;

  if (Array.isArray(sentimentOverview)) {
    md += `## Breve sorteret efter sentiment\n\n`;
    md += `| Brev | Dato | Afsender | Sentiment |\n|------|------|----------|-----------|\n`;
    const sorted = [...sentimentOverview].sort((a, b) => (a.cvp_mean || 0) - (b.cvp_mean || 0));
    const extremes = [...sorted.slice(0, 10), ...sorted.slice(-10)];
    for (const s of extremes) {
      const score = s.cvp_mean != null ? s.cvp_mean.toFixed(3) : "?";
      md += `| [${s.letter_id || s.id}](/letters/${s.letter_id || s.id}/) | ${formatDate(s.date)} | ${s.sender || ""} | ${score} |\n`;
    }
    md += `\n*Viser de 10 mest negative og 10 mest positive breve.*\n`;
  }

  md += `\n## Rådata\n\n`;
  md += `- [letter-sentiments.json](/data/letter-sentiments.json) — CVP sentiment pr. brev\n`;
  md += `- [cvp-sentence-scores.json](/data/cvp-sentence-scores.json) — Sentiment pr. sætning\n`;
  md += `- [sentiment-overview.json](/data/sentiment-overview.json) — Sentiment-oversigt\n`;

  md += `\n---\n\n*Kilde: [jernkorset.dk/sentiment/](${SITE_URL}/sentiment/)*\n`;
  return md;
}

// ── Sproganalyse ──────────────────────────────────────────────

function generateSproganalyse() {
  return `# Sproganalyse — Jernkorset Breve

Psykolingvistisk analyse af hvordan krigens pres forandrede Peters skriftsprog over tid.

## Analysemoduler

### Overblik
Overordnede sproglige tendenser: ordlængde, sætningskompleksitet, ordforrådsbredde og pronomenfordeling over tid.

### Krigens sprog
Hvordan krigens sprog trænger ind i brevene — militær terminologi, eufemismer, og sproglig tilpasning.

### Følelser
Emotionel analyse baseret på CVP-emotionsvektorer: glæde, sorg, frygt, vrede, overraskelse og afsky.

### National identitet
Peters danske identitet under tysk militærtjeneste — sproglige markører for national tilhørighed og fremmedgørelse.

### To modtagere
Sammenligning af brevenes sproglige stil til hhv. Trine (kæreste/kone) og forældrene — audience divergence analysis.

### Ordenes rejse
Semantiske forandringer over tid — ord der skifter betydning eller emotionel ladning gennem krigsårene.

## Rådata

- [letter-psycholinguistics.json](/data/letter-psycholinguistics.json) — Psykolingvistiske mål pr. brev
- [cvp-emotion-scores.json](/data/cvp-emotion-scores.json) — Emotionsvektorer pr. brev
- [cvp-identity-scores.json](/data/cvp-identity-scores.json) — Identitets-scores
- [letter-audience-divergence.json](/data/letter-audience-divergence.json) — Modtager-divergens
- [letter-narrative-arcs.json](/data/letter-narrative-arcs.json) — Narrative forløb
- [semantic-shifts.json](/data/semantic-shifts.json) — Semantiske skift

---

*Kilde: [jernkorset.dk/sproganalyse/](${SITE_URL}/sproganalyse/)*
`;
}

// ── Timeline ──────────────────────────────────────────────────

function generateTimeline(summaries, battles) {
  let md = `# Tidslinje — Jernkorset Breve

Kronologisk oversigt over ${summaries.length} breve og krigens begivenheder.

`;

  // Group letters by year-month
  const months = {};
  for (const s of summaries) {
    const ym = s.date ? s.date.substring(0, 7) : "ukendt";
    if (!months[ym]) months[ym] = [];
    months[ym].push(s);
  }

  for (const [ym, group] of Object.entries(months).sort()) {
    const [y, m] = ym.split("-");
    const monthNames = ["januar","februar","marts","april","maj","juni","juli","august","september","oktober","november","december"];
    const label = m ? `${monthNames[parseInt(m) - 1]} ${y}` : ym;
    md += `### ${label} (${group.length} breve)\n\n`;
    for (const s of group) {
      md += `- ${formatDate(s.date)}: [Brev ${s.id}](/letters/${s.id}/) — ${s.sender} til ${s.recipient}${s.place ? ", " + s.place : ""}\n`;
    }
    md += "\n";
  }

  if (battles && battles.length > 0) {
    md += `## Krigens slag\n\n`;
    md += `| Slag | Start | Slut | Front |\n|------|-------|------|-------|\n`;
    for (const b of battles.slice(0, 50)) {
      md += `| ${b.name || b.battle} | ${b.start_date || b.date || ""} | ${b.end_date || ""} | ${b.front || ""} |\n`;
    }
    if (battles.length > 50) md += `\n*… og ${battles.length - 50} flere slag*\n`;
  }

  md += `\n## Rådata\n\n`;
  md += `- [letter-summaries.json](/data/letter-summaries.json) — Brevmetadata\n`;
  md += `- [battles.json](/data/battles.json) — Historiske slag\n`;

  md += `\n---\n\n*Kilde: [jernkorset.dk/timeline/](${SITE_URL}/timeline/)*\n`;
  return md;
}

// ── Network ───────────────────────────────────────────────────

function generateNetwork(socialNetwork) {
  let md = `# Socialt netværk — Jernkorset Breve

Sociale relationer udledt fra brevsamlingen.

`;

  const nodes = socialNetwork.nodes || [];
  const edges = socialNetwork.edges || [];

  md += `## Nøgletal\n\n`;
  md += `- **Personer i netværket:** ${nodes.length}\n`;
  md += `- **Forbindelser:** ${edges.length}\n\n`;

  if (nodes.length > 0) {
    md += `## Centrale personer (sorteret efter PageRank)\n\n`;
    md += `| Person | Kategori | Breve | PageRank | Betweenness |\n`;
    md += `|--------|----------|-------|----------|-------------|\n`;
    const sorted = [...nodes].sort((a, b) => (b.pagerank || 0) - (a.pagerank || 0));
    for (const n of sorted.slice(0, 20)) {
      md += `| [${n.canonical || n.id}](/personer/${n.id}/) | ${n.category || ""} | ${n.letter_count || ""} | ${(n.pagerank || 0).toFixed(4)} | ${(n.betweenness_centrality || 0).toFixed(4)} |\n`;
    }
  }

  if (edges.length > 0) {
    md += `\n## Stærkeste forbindelser\n\n`;
    md += `| Person A | Person B | Styrke |\n|----------|----------|--------|\n`;
    const sorted = [...edges].sort((a, b) => (b.weight || 0) - (a.weight || 0));
    for (const e of sorted.slice(0, 20)) {
      md += `| ${e.source} | ${e.target} | ${e.weight} |\n`;
    }
  }

  md += `\n## Rådata\n\n`;
  md += `- [social-network.json](/data/social-network.json) — Komplet netværksdata (noder + kanter)\n`;
  md += `- [person-registry.json](/data/person-registry.json) — Personregister\n`;

  md += `\n---\n\n*Kilde: [jernkorset.dk/network/](${SITE_URL}/network/)*\n`;
  return md;
}

// ── Interactive stubs ─────────────────────────────────────────

function generateSearchStub() {
  return `# Søg — Jernkorset Breve

Semantisk fritekst-søgning i alle 665 breve på jernkorset.dk. Søgningen bruger multilingual-e5-small embeddings (384 dimensioner) til at finde breve baseret på semantisk nærhed.

Søgningen kræver JavaScript og fungerer bedst i browseren: [jernkorset.dk/search/](${SITE_URL}/search/)

## Rådata

- [search-corpus.json](/data/search-corpus.json) — Søgekorpus
- [search-snippets.json](/data/search-snippets.json) — Søge-snippets
- [embeddings-2d.json](/data/embeddings-2d.json) — 2D-embeddings (UMAP)
- [embeddings-3d.json](/data/embeddings-3d.json) — 3D-embeddings (UMAP)
- [topic-clusters.json](/data/topic-clusters.json) — Emneklynger

---

*Kilde: [jernkorset.dk/search/](${SITE_URL}/search/)*
`;
}

function generateMapStub(places) {
  let md = `# Kort — Jernkorset Breve

Geografisk visualisering af ${places.length} steder nævnt i brevsamlingen. Kortet kræver JavaScript: [jernkorset.dk/map/](${SITE_URL}/map/)

## Steder med koordinater

| Sted | Moderne navn | Land | Lat | Lng | Breve |
|------|-------------|------|-----|-----|-------|
`;
  for (const p of places) {
    if (p.lat && p.lng) {
      md += `| [${p.name}](/steder/${p.id}/) | ${p.modern_name || ""} | ${p.country || ""} | ${p.lat} | ${p.lng} | ${p.letter_count} |\n`;
    }
  }

  md += `\n## Rådata\n\n`;
  md += `- [places.json](/data/places.json) — Steder med koordinater\n`;
  md += `- [place-pages.json](/data/place-pages.json) — Udvidet steddata\n`;
  md += `- [borders-1914.json](/data/borders-1914.json) — Historiske grænser 1914\n`;
  md += `- [borders-1918.json](/data/borders-1918.json) — Historiske grænser 1918\n`;

  md += `\n---\n\n*Kilde: [jernkorset.dk/map/](${SITE_URL}/map/)*\n`;
  return md;
}

function generateExplorerStub() {
  return `# Udforsk — Jernkorset Breve

Interaktiv 2D/3D-visualisering af brevsamlingens embeddings. Brevene er projiceret fra 384-dimensionelle semantiske vektorer ned til 2D/3D ved hjælp af UMAP. Lignende breve ligger tæt på hinanden.

Visualiseringen kræver JavaScript og WebGL: [jernkorset.dk/explorer/](${SITE_URL}/explorer/)

## Rådata

- [embeddings-2d.json](/data/embeddings-2d.json) — 2D UMAP-koordinater
- [embeddings-3d.json](/data/embeddings-3d.json) — 3D UMAP-koordinater
- [topic-clusters.json](/data/topic-clusters.json) — Emneklynger
- [related-letters.json](/data/related-letters.json) — Relaterede breve (cosine similarity)

---

*Kilde: [jernkorset.dk/explorer/](${SITE_URL}/explorer/)*
`;
}

// ── Main ──────────────────────────────────────────────────────

function main() {
  console.log("Generating markdown pages for agent content negotiation:");

  const letters = readJson("letters.json");
  const summaries = readJson("letter-summaries.json");
  const persons = readJson("person-pages.json");
  const places = readJson("place-pages.json");
  const imageRegistry = readJson("image-registry.json");
  const sentiments = readJson("letter-sentiments.json");
  const sentimentOverview = readJson("sentiment-overview.json");
  const socialNetwork = readJson("social-network.json");
  const battles = readJson("battles.json");

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

  // About
  writeMd("about/index.md", generateAbout());
  count++;

  // Billeder
  writeMd("billeder/index.md", generateBilleder(imageRegistry));
  count++;

  // Statistics
  writeMd("statistics/index.md", generateStatistics(letters, sentiments));
  count++;

  // Sentiment
  writeMd("sentiment/index.md", generateSentiment(sentimentOverview));
  count++;

  // Sproganalyse
  writeMd("sproganalyse/index.md", generateSproganalyse());
  count++;

  // Timeline
  writeMd("timeline/index.md", generateTimeline(summaries.length ? summaries : letters, battles));
  count++;

  // Network
  writeMd("network/index.md", generateNetwork(socialNetwork));
  count++;

  // Interactive stubs
  writeMd("search/index.md", generateSearchStub());
  writeMd("map/index.md", generateMapStub(places));
  writeMd("explorer/index.md", generateExplorerStub());
  count += 3;

  console.log(`  Written ${count} markdown files to out/`);
}

main();
