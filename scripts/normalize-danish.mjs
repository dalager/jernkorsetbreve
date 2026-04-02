#!/usr/bin/env node
/**
 * Rule-based Danish text normalizer for jernkorsetbreve.
 *
 * Normalizes archaic Danish (1911-1918) to modern Danish spelling
 * for optimal embedding model alignment. Original text is always
 * preserved separately — this only affects the text used for embeddings.
 *
 * Usage:
 *   node scripts/normalize-danish.mjs [--dry-run] [--stats] [--source=csv|corrected]
 *
 * Input sources (controlled by --source flag):
 *   corrected  Read data/corrected-letters.json (text_corrected field). Used by
 *              default when the file exists (ADR-039 corrections layer).
 *   csv        Read data/letters.csv (backwards-compatible default when no
 *              corrected-letters.json is present).
 *
 * As a library:
 *   import { normalizeDanish } from './scripts/normalize-danish.mjs';
 *   const { text, changeCount, changesByCategory } = normalizeDanish(inputText);
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Preserve lists ──────────────────────────────────────────────────────

const AA_PRESERVE_SET = new Set([
  'aalborg', 'aarhus', 'aaby', 'aabenraa',
  'aarup', 'aalestrup', 'aadum', 'aakirkeby',
]);

// Names where th/kj must be preserved
const TH_PRESERVE_SET = new Set([
  'thomas', 'thøjsen', 'thorkild', 'thorvald', 'theodor',
  'dorthea', 'martha', 'bertha', 'thisted', 'thyholm',
  'thüringen', 'thiringen', 'thy',
]);

// ── Rule definitions ────────────────────────────────────────────────────

/** Apply aa→å replacement on a single word, preserving case. */
function applyAaRule(word) {
  if (AA_PRESERVE_SET.has(word.toLowerCase())) return word;
  let result = word.replace(/^Aa/, 'Å');
  result = result.replace(/aa/gi, (match) => {
    if (match === 'Aa') return 'Å';
    if (match === 'AA') return 'ÅÅ';
    return 'å';
  });
  return result;
}

function replaceAa(text) {
  return text.replace(/(&[a-zA-Z]+;)|(\b[a-zA-ZæøåÆØÅéÉ]+\b)/g, (match, entity, word) => {
    if (entity) return entity;
    return applyAaRule(word);
  });
}

// ── Category 1: Archaic verb forms ──────────────────────────────────────

const VERB_RULES = [
  [/\bskulde\b/g, 'skulle'], [/\bSkulde\b/g, 'Skulle'],
  [/\bvilde\b/g, 'ville'], [/\bVilde\b/g, 'Ville'],
  [/\bkunde\b/g, 'kunne'], [/\bKunde\b/g, 'Kunne'],
];

// ── Category 2: Past tense forms ────────────────────────────────────────

const PAST_TENSE_RULES = [
  [/\bfaaet\b/g, 'fået'], [/\bFaaet\b/g, 'Fået'],
  [/\bstaaet\b/g, 'stået'], [/\bStaaet\b/g, 'Stået'],
  [/\bgaaet\b/g, 'gået'], [/\bGaaet\b/g, 'Gået'],
  [/\bseet\b/g, 'set'], [/\bSeet\b/g, 'Set'],
  [/\bhavt\b/g, 'haft'], [/\bHavt\b/g, 'Haft'],
];

// ── Category 3: Adverbs and conjunctions ────────────────────────────────

const ADVERB_RULES = [
  [/\bsaa\b/g, 'så'], [/\bSaa\b/g, 'Så'],
  [/\bidag\b/g, 'i dag'], [/\bIdag\b/g, 'I dag'],
  [/\bigaar\b/g, 'i går'], [/\bIgaar\b/g, 'I går'],
  [/\bigår\b/g, 'i går'], [/\bIgår\b/g, 'I går'],
  [/\biaften\b/g, 'i aften'], [/\bIaften\b/g, 'I aften'],
  [/\bimorgen\b/g, 'i morgen'], [/\bImorgen\b/g, 'I morgen'],
  [/\bimorges\b/g, 'i morges'], [/\bImorges\b/g, 'I morges'],
  [/\btillige\b/g, 'også'], [/\bTillige\b/g, 'Også'],
  [/\bhvorledes\b/g, 'hvordan'], [/\bHvorledes\b/g, 'Hvordan'],
];

// ── Category 4: Past participles -en → -et ──────────────────────────────

const PARTICIPLE_RULES = [
  // High frequency (safe — always participle in this corpus)
  [/\bkommen\b/g, 'kommet'], [/\bKommen\b/g, 'Kommet'],
  [/\bbleven\b/g, 'blevet'], [/\bBleven\b/g, 'Blevet'],
  [/\bskreven\b/g, 'skrevet'], [/\bSkreven\b/g, 'Skrevet'],
  [/\bfalden\b/g, 'faldet'], [/\bFalden\b/g, 'Faldet'],
  [/\btagen\b/g, 'taget'], [/\bTagen\b/g, 'Taget'],
  [/\bgiven\b/g, 'givet'], [/\bGiven\b/g, 'Givet'],
  [/\bfunden\b/g, 'fundet'], [/\bFunden\b/g, 'Fundet'],
  [/\btrukken\b/g, 'trukket'], [/\bTrukken\b/g, 'Trukket'],
  [/\btruffen\b/g, 'truffet'], [/\bTruffen\b/g, 'Truffet'],
  [/\bsprungen\b/g, 'sprunget'], [/\bSprungen\b/g, 'Sprunget'],
  [/\bsunken\b/g, 'sunket'], [/\bSunken\b/g, 'Sunket'],
  [/\bgreben\b/g, 'grebet'], [/\bGreben\b/g, 'Grebet'],
  [/\bforsvunden\b/g, 'forsvundet'], [/\bForsvunden\b/g, 'Forsvundet'],
  [/\bhjulpen\b/g, 'hjulpet'], [/\bHjulpen\b/g, 'Hjulpet'],
  // Compound forms
  [/\bankommen\b/g, 'ankommet'], [/\bAnkommen\b/g, 'Ankommet'],
  [/\bopskreven\b/g, 'opskrevet'], [/\bOpskreven\b/g, 'Opskrevet'],
  [/\bforbunden\b/g, 'forbundet'], [/\bForbunden\b/g, 'Forbundet'],
  // Ambiguous but safe in this corpus context (participle usage dominates)
  [/\bdrukken\b/g, 'drukket'], [/\bDrukken\b/g, 'Drukket'],
  [/\bbunden\b/g, 'bundet'], [/\bBunden\b/g, 'Bundet'],
];

// ── Category 5: Archaic æ→e vowels ─────────────────────────────────────

const VOWEL_RULES = [
  [/\bgærne\b/g, 'gerne'], [/\bGærne\b/g, 'Gerne'],
  [/\bnæmlig\b/g, 'nemlig'], [/\bNæmlig\b/g, 'Nemlig'],
  [/\bbægge\b/g, 'begge'], [/\bBægge\b/g, 'Begge'],
  // vænte → vente (all forms)
  [/\bvænte\b/g, 'vente'], [/\bVænte\b/g, 'Vente'],
  [/\bvænter\b/g, 'venter'], [/\bVænter\b/g, 'Venter'],
  [/\bvæntet\b/g, 'ventet'], [/\bVæntet\b/g, 'Ventet'],
  [/\bvæntede\b/g, 'ventede'], [/\bVæntede\b/g, 'Ventede'],
  [/\bvæntetid\b/g, 'ventetid'],
  // tjæneste → tjeneste (all forms)
  [/\btjæneste\b/g, 'tjeneste'], [/\bTjæneste\b/g, 'Tjeneste'],
  [/\btjænesten\b/g, 'tjenesten'], [/\bTjænesten\b/g, 'Tjenesten'],
  [/\bgudstjæneste\b/g, 'gudstjeneste'], [/\bGudstjæneste\b/g, 'Gudstjeneste'],
  // taknæmlig → taknemmelig (all forms)
  [/\btaknæmlig\b/g, 'taknemmelig'], [/\bTaknæmlig\b/g, 'Taknemmelig'],
  [/\btaknæmlige\b/g, 'taknemmelige'], [/\bTaknæmlige\b/g, 'Taknemmelige'],
  [/\btaknæmligt\b/g, 'taknemmeligt'],
];

// ── Category 6: kj→k, gj→g, skj→sk orthography ────────────────────────

const ORTHOGRAPHY_RULES = [
  // kj → k (but NOT kjole, which is modern Danish)
  [/\bkjær\b/g, 'kær'], [/\bKjær\b/g, 'Kær'],
  [/\bkjære\b/g, 'kære'], [/\bKjære\b/g, 'Kære'],
  [/\bkjærlig\b/g, 'kærlig'], [/\bKjærlig\b/g, 'Kærlig'],
  [/\bkjærlige\b/g, 'kærlige'], [/\bKjærlige\b/g, 'Kærlige'],
  [/\bkjærlighed\b/g, 'kærlighed'], [/\bKjærlighed\b/g, 'Kærlighed'],
  [/\bkjøbe\b/g, 'købe'], [/\bKjøbe\b/g, 'Købe'],
  [/\bkjøbt\b/g, 'købt'], [/\bKjøbt\b/g, 'Købt'],
  [/\bkjøbte\b/g, 'købte'], [/\bKjøbte\b/g, 'Købte'],
  [/\bkjende\b/g, 'kende'], [/\bKjende\b/g, 'Kende'],
  [/\bkjendt\b/g, 'kendt'], [/\bKjendt\b/g, 'Kendt'],
  // gj → g (NOT gjort/gjorde which are modern)
  [/\bigjen\b/g, 'igen'], [/\bIgjen\b/g, 'Igen'],
  [/\bgjensyn\b/g, 'gensyn'], [/\bGjensyn\b/g, 'Gensyn'],
  [/\bgjærne\b/g, 'gerne'], [/\bGjærne\b/g, 'Gerne'],
  [/\bigjennem\b/g, 'igennem'], [/\bIgjennem\b/g, 'Igennem'],
  // skj → sk (NOT skjorte/skjule which are modern)
  [/\bskjælm\b/g, 'skælm'], [/\bSkjælm\b/g, 'Skælm'],
  [/\bskjæbne\b/g, 'skæbne'], [/\bSkjæbne\b/g, 'Skæbne'],
  [/\bskjævt\b/g, 'skævt'],
];

// ── Category 7: th→t, ph→f archaic spelling ────────────────────────────

function applyThRules(text, stats) {
  let result = text;
  // th → t in common words (NOT in names)
  const thRules = [
    [/\bthelephon/gi, 'telefon'],
    [/\btelephon/gi, 'telefon'],
    [/\bthelegram/gi, 'telegram'],
    [/\bthelegraf/gi, 'telegraf'],
    [/\btheater\b/gi, 'teater'],
    [/\btheatret\b/gi, 'teatret'],
    [/\bthyphus\b/gi, 'tyfus'],
    [/\blazareth\b/gi, 'lazaret'],
  ];
  for (const [pattern, replacement] of thRules) {
    pattern.lastIndex = 0;
    const matches = result.match(pattern);
    if (matches) stats['th_ph→t_f'] = (stats['th_ph→t_f'] || 0) + matches.length;
    result = result.replace(pattern, replacement);
  }
  // ph → f in common words
  const phRules = [
    [/\bphotografi/gi, 'fotografi'],
    [/\bphotograf\b/gi, 'fotograf'],
    [/\bgramophon/gi, 'grammofon'],
  ];
  for (const [pattern, replacement] of phRules) {
    pattern.lastIndex = 0;
    const matches = result.match(pattern);
    if (matches) stats['th_ph→t_f'] = (stats['th_ph→t_f'] || 0) + matches.length;
    result = result.replace(pattern, replacement);
  }
  return result;
}

// ── Category 8: Archaic pronouns ────────────────────────────────────────

const PRONOUN_RULES = [
  [/\bEders\b/g, 'jeres'], [/\beders\b/g, 'jeres'],
  [/\bEder\b/g, 'jer'], [/\beder\b/g, 'jer'],
];

// ── Category 9: Archaic vocabulary & spelling ───────────────────────────

const VOCABULARY_RULES = [
  // Original rules
  [/\bTornyster\b/g, 'tornister'], [/\btornyster\b/g, 'tornister'],
  [/\bHauptmand\b/g, 'hauptmand'],
  [/\bFeldvebel\b/g, 'feldwebel'], [/\bfeldvebel\b/g, 'feldwebel'],
  [/\bKogeapparat\b/g, 'kogeapparat'],
  [/\bEkcerserere\b/g, 'eksercere'], [/\bekcerserere\b/g, 'eksercere'],
  [/\bhjærtelig\b/g, 'hjertelig'], [/\bHjærtelig\b/g, 'Hjertelig'],
  [/\bhjærtelige\b/g, 'hjertelige'], [/\bHjærtelige\b/g, 'Hjertelige'],
  [/\bLykønskningen\b/g, 'lykønskningen'],
  // New: research findings
  [/\bkanske\b/g, 'måske'], [/\bKanske\b/g, 'Måske'],
  [/\bbilir\b/g, 'bliver'], // only compound, not standalone "blir"
  [/\bblir\b/g, 'bliver'], [/\bBlir\b/g, 'Bliver'],
  [/\bmangen\b/g, 'mange'], [/\bMangen\b/g, 'Mange'],
  [/\bcaffe\b/g, 'kaffe'], [/\bCaffe\b/g, 'Kaffe'],
  [/\bveed\b/g, 'ved'], [/\bVeed\b/g, 'Ved'],
  [/\btee\b/g, 'te'],
  [/\blycke\b/g, 'lykke'],
];

// ── Category 10: Compound word splits ───────────────────────────────────

const COMPOUND_RULES = [
  [/\bhveranden\b/g, 'hver anden'], [/\bHveranden\b/g, 'Hver anden'],
  [/\ballesammen\b/g, 'alle sammen'], [/\bAllesammen\b/g, 'Alle sammen'],
  [/\btilgode\b/g, 'til gode'],
  [/\bistand\b/g, 'i stand'],
];

// ── Category 11: OCR fixes ──────────────────────────────────────────────

const OCR_RULES = [
  // NOTE (ADR-039): jog→jeg is a pre-existing editorial correction that should
  // ideally live in the corrections layer (corrected-letters.json), but is kept
  // here for backwards compatibility with pipelines that do not use that layer.
  [/\bjog\b/g, 'jeg'], // confirmed OCR error in corpus (9 occurrences)
];

// ── Text cleanup ────────────────────────────────────────────────────────

function cleanupText(text, stats) {
  let result = text;
  // Remove soft hyphens (U+00AD) — typewriter artifact
  const softHyphens = (result.match(/\u00AD/g) || []).length;
  if (softHyphens > 0) {
    stats['cleanup'] = (stats['cleanup'] || 0) + softHyphens;
    result = result.replace(/\u00AD/g, '');
  }
  // Collapse multiple spaces to single
  const multiSpaces = (result.match(/ {2,}/g) || []).length;
  if (multiSpaces > 0) {
    stats['cleanup'] = (stats['cleanup'] || 0) + multiSpaces;
    result = result.replace(/ {2,}/g, ' ');
  }
  return result;
}

// ── Shared helpers ──────────────────────────────────────────────────────

function applyRules(text, rules, category, stats) {
  let result = text;
  for (const [pattern, replacement] of rules) {
    pattern.lastIndex = 0;
    const matches = result.match(pattern);
    if (matches) {
      stats[category] = (stats[category] || 0) + matches.length;
    }
    result = result.replace(pattern, replacement);
  }
  return result;
}

function stripHtml(text) {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

// ── Main normalizer ─────────────────────────────────────────────────────

/**
 * Normalize archaic Danish text to modern Danish spelling.
 *
 * @param {string} text - Input text (plain text, not HTML)
 * @returns {{ text: string, changeCount: number, changesByCategory: Record<string, number> }}
 */
export function normalizeDanish(text) {
  const stats = {};
  let result = text;

  // 0. Text cleanup (soft hyphens, whitespace)
  result = cleanupText(result, stats);

  // 1. aa → å (pre-1948 spelling reform) — must come first
  const beforeAa = result;
  result = replaceAa(result);
  const aaChanges = (beforeAa.match(/aa/gi) || []).length - (result.match(/aa/gi) || []).length;
  if (aaChanges > 0) stats['aa→å'] = aaChanges;

  // 2. Archaic verb forms (skulde→skulle, etc.)
  result = applyRules(result, VERB_RULES, 'verb_forms', stats);

  // 3. Past tense forms (faaet→fået, etc.)
  result = applyRules(result, PAST_TENSE_RULES, 'past_tense', stats);

  // 4. Past participles (-en → -et)
  result = applyRules(result, PARTICIPLE_RULES, 'participles', stats);

  // 5. Adverbs and conjunctions
  result = applyRules(result, ADVERB_RULES, 'adverbs_conjunctions', stats);

  // 6. Archaic æ→e vowels
  result = applyRules(result, VOWEL_RULES, 'vowel_forms', stats);

  // 7. kj/gj/skj orthography
  result = applyRules(result, ORTHOGRAPHY_RULES, 'kj_gj_skj', stats);

  // 8. th→t, ph→f
  result = applyThRules(result, stats);

  // 9. Archaic pronouns (Eder→jer)
  result = applyRules(result, PRONOUN_RULES, 'pronouns', stats);

  // 10. Vocabulary & archaic spelling
  result = applyRules(result, VOCABULARY_RULES, 'vocabulary', stats);

  // 11. Compound word splits
  result = applyRules(result, COMPOUND_RULES, 'compound_splits', stats);

  // 12. OCR fixes
  result = applyRules(result, OCR_RULES, 'ocr_fixes', stats);

  const changeCount = Object.values(stats).reduce((sum, n) => sum + n, 0);
  return { text: result, changeCount, changesByCategory: stats };
}

// ── CSV parser ─────────────────────────────────────────────────────────

/**
 * Parse a single CSV line, respecting quoted fields.
 */
function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Minimal CSV parser that handles quoted fields with commas and escaped quotes.
 */
function parseCsv(text) {
  const rows = [];
  const lines = text.split('\n');
  if (lines.length === 0) return rows;

  const headers = parseCsvLine(lines[0]);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;
    const fields = parseCsvLine(line);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = (fields[j] ?? '').trim();
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Convert <PARA>-separated CSV text to plain text with paragraph breaks.
 */
function csvTextToPlain(raw) {
  if (!raw) return '';
  return raw
    .replace(/<PARA>/g, '\n\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

// ── CLI entry point ─────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const showStats = args.includes('--stats') || dryRun;

  // Resolve --source flag: explicit override or auto-detect based on file presence.
  const sourceArg = args.find(a => a.startsWith('--source='));
  const correctedPath = resolve(__dirname, '..', 'data', 'corrected-letters.json');
  const csvPath = resolve(__dirname, '..', 'data', 'letters.csv');
  const outputPath = resolve(__dirname, '..', 'data', 'normalized-letters.json');

  let useSource;
  if (sourceArg) {
    useSource = sourceArg.split('=')[1];
    if (useSource !== 'csv' && useSource !== 'corrected') {
      console.error(`Unknown --source value "${useSource}". Use "csv" or "corrected".`);
      process.exit(1);
    }
  } else {
    useSource = existsSync(correctedPath) ? 'corrected' : 'csv';
  }

  let letterRows;

  if (useSource === 'corrected') {
    try {
      const raw = readFileSync(correctedPath, 'utf-8');
      letterRows = JSON.parse(raw);
    } catch (err) {
      console.error(`Failed to read ${correctedPath}: ${err.message}`);
      process.exit(1);
    }
    console.log(`Processing ${letterRows.length} letters from corrected-letters.json...`);
  } else {
    try {
      const csvRaw = readFileSync(csvPath, 'utf-8');
      letterRows = parseCsv(csvRaw);
    } catch (err) {
      console.error(`Failed to read ${csvPath}: ${err.message}`);
      process.exit(1);
    }
    console.log(`Processing ${letterRows.length} letters from letters.csv...`);
  }

  const aggregateStats = {};
  let totalChanges = 0;

  const output = letterRows.map((row) => {
    const id = parseInt(row.id, 10);
    // When reading from corrected-letters.json, use text_corrected as the input
    // for normalization; it becomes text_original in the output (ADR-039).
    // When reading from CSV, convert <PARA>-delimited text to plain text as before.
    const plainText = useSource === 'corrected'
      ? (row.text_corrected || '')
      : csvTextToPlain(row.text || '');
    const { text: normalized, changeCount, changesByCategory } = normalizeDanish(plainText);

    totalChanges += changeCount;
    for (const [cat, count] of Object.entries(changesByCategory)) {
      aggregateStats[cat] = (aggregateStats[cat] || 0) + count;
    }

    return {
      id,
      text_original: plainText,
      text_normalized: normalized,
      changes: changeCount,
    };
  });

  if (showStats) {
    console.log('\n--- Normalization Statistics ---');
    console.log(`Total letters:  ${letterRows.length}`);
    console.log(`Total changes:  ${totalChanges}`);
    console.log(`Letters with changes: ${output.filter(l => l.changes > 0).length}`);
    console.log('\nChanges by category:');
    for (const [cat, count] of Object.entries(aggregateStats).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${cat.padEnd(25)} ${count}`);
    }
  }

  if (dryRun) {
    console.log('\n(dry run — no file written)');
    const sample = output.filter(l => l.changes > 0).slice(0, 3);
    for (const s of sample) {
      console.log(`\n--- Letter ${s.id} (${s.changes} changes) ---`);
      console.log('Original (first 3 lines):');
      s.text_original.split('\n').slice(0, 3).forEach(l => console.log(`  ${l}`));
      console.log('Normalized (first 3 lines):');
      s.text_normalized.split('\n').slice(0, 3).forEach(l => console.log(`  ${l}`));
    }
  } else {
    writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`\nWritten to ${outputPath}`);
  }
}

const isMain = process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main();
}
