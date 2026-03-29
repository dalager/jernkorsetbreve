/**
 * Psycholinguistic Explorer utilities (ADR-037).
 * Data fetching, aggregation helpers, pre-war/wartime splits.
 */

import type {
  PsycholinguisticsMap,
  LetterPsycholinguistics,
  EmotionScoresMap,
  AudienceDivergenceData,
  NarrativeArcsData,
  SemanticShiftsData,
  IdentityScoresMap,
} from "@/types/psycholinguistics";

// ── Constants ───────────────────────────────────────────────────────

/** War onset date used for pre-war/wartime splits. */
export const WAR_ONSET = "1914-08-01";

/** Display label for the war onset marker. */
export const WAR_ONSET_LABEL = "Krigens udbrud";

// ── Period classification ───────────────────────────────────────────

export function isWartime(date: string): boolean {
  return date >= WAR_ONSET;
}

export function periodLabel(date: string): "Førkrig" | "Krigstid" {
  return isWartime(date) ? "Krigstid" : "Førkrig";
}

// ── Aggregation helpers ─────────────────────────────────────────────

type MetricKey = keyof LetterPsycholinguistics;

interface PeriodStats {
  mean: number;
  count: number;
}

/**
 * Compute the mean of a numeric metric, split by pre-war/wartime.
 */
export function periodMeans(
  data: PsycholinguisticsMap,
  metric: MetricKey
): { preWar: PeriodStats; wartime: PeriodStats } {
  let preSum = 0, preCount = 0;
  let warSum = 0, warCount = 0;

  for (const entry of Object.values(data)) {
    const val = entry[metric];
    if (typeof val !== "number" || val === null) continue;
    if (isWartime(entry.date)) {
      warSum += val;
      warCount++;
    } else {
      preSum += val;
      preCount++;
    }
  }

  return {
    preWar: { mean: preCount > 0 ? preSum / preCount : 0, count: preCount },
    wartime: { mean: warCount > 0 ? warSum / warCount : 0, count: warCount },
  };
}

/**
 * Compute percentage change between pre-war and wartime means.
 */
export function periodChangePercent(
  data: PsycholinguisticsMap,
  metric: MetricKey
): number {
  const { preWar, wartime } = periodMeans(data, metric);
  if (preWar.mean === 0) return 0;
  return ((wartime.mean - preWar.mean) / Math.abs(preWar.mean)) * 100;
}

/**
 * Group metric values by year for timeline charts.
 * Returns sorted array of { year, mean, values }.
 */
export function metricByYear(
  data: PsycholinguisticsMap,
  metric: MetricKey
): { year: string; mean: number; count: number }[] {
  const buckets: Record<string, number[]> = {};

  for (const entry of Object.values(data)) {
    const val = entry[metric];
    if (typeof val !== "number" || val === null) continue;
    const year = entry.date.slice(0, 4);
    if (!buckets[year]) buckets[year] = [];
    buckets[year].push(val);
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, vals]) => ({
      year,
      mean: vals.reduce((s, v) => s + v, 0) / vals.length,
      count: vals.length,
    }));
}

/**
 * Group metric values by month for finer-grained timelines.
 */
export function metricByMonth(
  data: PsycholinguisticsMap,
  metric: MetricKey
): { month: string; mean: number; count: number }[] {
  const buckets: Record<string, number[]> = {};

  for (const entry of Object.values(data)) {
    const val = entry[metric];
    if (typeof val !== "number" || val === null) continue;
    const month = entry.date.slice(0, 7);
    if (!buckets[month]) buckets[month] = [];
    buckets[month].push(val);
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, vals]) => ({
      month,
      mean: vals.reduce((s, v) => s + v, 0) / vals.length,
      count: vals.length,
    }));
}

/**
 * Count reassurance formulae pre-war vs wartime and compute the ratio.
 */
export function reassuranceRatio(data: PsycholinguisticsMap): {
  preWarTotal: number;
  wartimeTotal: number;
  preWarPerLetter: number;
  wartimePerLetter: number;
  changePercent: number;
} {
  let preTotal = 0, preCount = 0, warTotal = 0, warCount = 0;

  for (const entry of Object.values(data)) {
    if (isWartime(entry.date)) {
      warTotal += entry.reassurance_count;
      warCount++;
    } else {
      preTotal += entry.reassurance_count;
      preCount++;
    }
  }

  const prePerLetter = preCount > 0 ? preTotal / preCount : 0;
  const warPerLetter = warCount > 0 ? warTotal / warCount : 0;

  return {
    preWarTotal: preTotal,
    wartimeTotal: warTotal,
    preWarPerLetter: prePerLetter,
    wartimePerLetter: warPerLetter,
    changePercent: prePerLetter > 0 ? ((warPerLetter - prePerLetter) / prePerLetter) * 100 : 0,
  };
}

// ── Recipient helpers ───────────────────────────────────────────────

export function isTrineLetter(recipient: string): boolean {
  return recipient.toLowerCase().includes("trine");
}

export function isParentLetter(recipient: string): boolean {
  const r = recipient.toLowerCase();
  return r.includes("mor") || r.includes("far") || r.includes("forældre");
}

export function recipientGroup(recipient: string): "Trine" | "Forældre" | "Anden" {
  if (isTrineLetter(recipient)) return "Trine";
  if (isParentLetter(recipient)) return "Forældre";
  return "Anden";
}

// ── Data fetching (cached) ──────────────────────────────────────────

let psychoCache: PsycholinguisticsMap | null = null;
let emotionCache: EmotionScoresMap | null = null;
let divergenceCache: AudienceDivergenceData | null = null;
let arcsCache: NarrativeArcsData | null = null;
let shiftsCache: SemanticShiftsData | null = null;
let identityCache: IdentityScoresMap | null = null;

export async function fetchPsycholinguistics(): Promise<PsycholinguisticsMap> {
  if (psychoCache) return psychoCache;
  const res = await fetch("/data/letter-psycholinguistics.json");
  if (!res.ok) throw new Error("Kunne ikke hente sprogdata");
  psychoCache = await res.json();
  return psychoCache!;
}

export async function fetchEmotionScores(): Promise<EmotionScoresMap> {
  if (emotionCache) return emotionCache;
  const res = await fetch("/data/cvp-emotion-scores.json");
  if (!res.ok) throw new Error("Kunne ikke hente følelsesdata");
  emotionCache = await res.json();
  return emotionCache!;
}

export async function fetchAudienceDivergence(): Promise<AudienceDivergenceData> {
  if (divergenceCache) return divergenceCache;
  const res = await fetch("/data/letter-audience-divergence.json");
  if (!res.ok) throw new Error("Kunne ikke hente modtagerdata");
  divergenceCache = await res.json();
  return divergenceCache!;
}

export async function fetchNarrativeArcs(): Promise<NarrativeArcsData> {
  if (arcsCache) return arcsCache;
  const res = await fetch("/data/letter-narrative-arcs.json");
  if (!res.ok) throw new Error("Kunne ikke hente fortællebuer");
  arcsCache = await res.json();
  return arcsCache!;
}

export async function fetchSemanticShifts(): Promise<SemanticShiftsData> {
  if (shiftsCache) return shiftsCache;
  const res = await fetch("/data/semantic-shifts.json");
  if (!res.ok) throw new Error("Kunne ikke hente semantiske skift");
  shiftsCache = await res.json();
  return shiftsCache!;
}

export async function fetchIdentityScores(): Promise<IdentityScoresMap | null> {
  if (identityCache) return identityCache;
  try {
    const res = await fetch("/data/cvp-identity-scores.json");
    if (!res.ok) return null;
    identityCache = await res.json();
    return identityCache!;
  } catch {
    return null;
  }
}

// ── Formatting ──────────────────────────────────────────────────────

/** Format a number as percentage with sign: "+29%" or "-21%" */
export function formatChangePercent(pct: number): string {
  const rounded = Math.round(pct);
  return (rounded >= 0 ? "+" : "") + rounded + "%";
}

/** Format a decimal as percentage: 0.789 → "78.9%" */
export function formatPercent(val: number, decimals = 1): string {
  return (val * 100).toFixed(decimals) + "%";
}

/** Format a number to N decimal places. */
export function formatNum(val: number, decimals = 2): string {
  return val.toFixed(decimals);
}
