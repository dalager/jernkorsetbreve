/**
 * Pure utility functions for timeline computations.
 * No React dependencies — usable in Canvas draw loops and tests.
 */

export interface LetterEntry {
  id: number;
  date: string;
  sender: string;
  recipient: string;
  place: string;
}

export interface RollingPoint {
  date: Date;
  avgSentiment: number;
}

export interface MonthlyBin {
  month: string;
  count: number;
}

const MS_PER_DAY = 86_400_000;

/** Parse a "YYYY-MM-DD" string to a Date at midnight UTC. */
export function parseDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00");
}

/**
 * Compute a rolling average of sentiment scores over a sliding window.
 * Letters are sorted by date; for each day with at least one letter in
 * the window, we emit the average sentiment of all letters within
 * [day - windowDays, day].
 */
export function computeRollingAverage(
  letters: LetterEntry[],
  sentiments: Record<string, { cvp_mean?: number }>,
  windowDays: number
): RollingPoint[] {
  const sorted = [...letters]
    .map((l) => ({ date: parseDate(l.date), score: sentiments[String(l.id)]?.cvp_mean ?? 0 }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (sorted.length === 0) return [];

  const windowMs = windowDays * MS_PER_DAY;
  const points: RollingPoint[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    let sum = 0;
    let count = 0;
    for (let j = i; j >= 0; j--) {
      if (current.date.getTime() - sorted[j].date.getTime() > windowMs) break;
      sum += sorted[j].score;
      count++;
    }
    if (count > 0) {
      points.push({ date: current.date, avgSentiment: sum / count });
    }
  }

  return points;
}

/** Compute letter counts grouped by YYYY-MM. */
export function computeMonthlyDensity(letters: LetterEntry[]): MonthlyBin[] {
  const counts = new Map<string, number>();
  for (const l of letters) {
    const key = l.date.substring(0, 7);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));
}

/** Map a Date to a canvas X pixel coordinate. */
export function dateToX(
  date: Date,
  viewStart: Date,
  viewEnd: Date,
  canvasWidth: number,
  padding: number
): number {
  const range = viewEnd.getTime() - viewStart.getTime();
  if (range <= 0) return padding;
  const ratio = (date.getTime() - viewStart.getTime()) / range;
  return padding + ratio * (canvasWidth - 2 * padding);
}

/** Map a canvas X pixel coordinate back to a Date. */
export function xToDate(
  x: number,
  viewStart: Date,
  viewEnd: Date,
  canvasWidth: number,
  padding: number
): Date {
  const range = viewEnd.getTime() - viewStart.getTime();
  const ratio = (x - padding) / (canvasWidth - 2 * padding);
  return new Date(viewStart.getTime() + ratio * range);
}

/** Deterministic jitter for letter dot Y positions (seeded by id). */
export function jitterY(id: number, idx: number, range: number): number {
  const hash = ((id * 2654435761) >>> 0) ^ ((idx * 40503) >>> 0);
  return (hash % range) - range / 2;
}

// ── CVP sentiment thresholds and helpers ─────────────────────────────
// Single source of truth for sentiment classification (ADR-030).
// CVP scores range roughly from -1 to +1.

export const SENTIMENT_POSITIVE_THRESHOLD = 0.1;
export const SENTIMENT_NEGATIVE_THRESHOLD = -0.05;

export type SentimentCategory = "positiv" | "negativ" | "neutral";

export function sentimentCategory(score: number): SentimentCategory {
  if (score > SENTIMENT_POSITIVE_THRESHOLD) return "positiv";
  if (score < SENTIMENT_NEGATIVE_THRESHOLD) return "negativ";
  return "neutral";
}

const SENTIMENT_COLORS: Record<SentimentCategory, string> = {
  positiv: "#5B8C5A",
  negativ: "#A63535",
  neutral: "#9C8F80",
};

const SENTIMENT_COLORS_HSL: Record<SentimentCategory, string> = {
  positiv: "hsl(145, 55%, 42%)",
  negativ: "hsl(0, 60%, 48%)",
  neutral: "hsl(40, 65%, 50%)",
};

const SENTIMENT_CSS: Record<SentimentCategory, string> = {
  positiv: "text-green-700",
  negativ: "text-red-700",
  neutral: "text-amber-700",
};

/** CVP sentiment score (-1..+1) to hex colour string. */
export function sentimentColor(score: number): string {
  return SENTIMENT_COLORS[sentimentCategory(score)];
}

/** CVP sentiment score (-1..+1) to HSL colour string (for canvas). */
export function sentimentColorHSL(score: number): string {
  return SENTIMENT_COLORS_HSL[sentimentCategory(score)];
}

/** CVP sentiment score (-1..+1) to Tailwind CSS class. */
export function sentimentCss(score: number): string {
  return SENTIMENT_CSS[sentimentCategory(score)];
}

/** CVP sentiment score (-1..+1) to label. */
export function sentimentLabel(score: number): string {
  return sentimentCategory(score);
}
