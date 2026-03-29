/**
 * Sentiment Explorer utilities (ADR-036).
 * Color gradients, data fetching, and aggregation helpers.
 */

import type { SentenceScore, SentimentOverview } from "@/types/letters";

// ── Continuous color gradient ────────────────────────────────────────

/**
 * Map a CVP score (-1..+1) to a continuous CSS color.
 * Negative → red, neutral → warm gray, positive → green.
 * Used for sentence-level coloring (the whole point of CVP).
 */
export function sentimentGradientColor(score: number): string {
  const clamped = Math.max(-1, Math.min(1, score));
  if (clamped < 0) {
    // Red channel increases toward -1
    const t = Math.abs(clamped);
    const r = Math.round(166 + t * 40);
    const g = Math.round(143 - t * 100);
    const b = Math.round(128 - t * 90);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Green channel increases toward +1
    const t = clamped;
    const r = Math.round(166 - t * 75);
    const g = Math.round(143 + t * 50);
    const b = Math.round(128 - t * 40);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

/**
 * Map a CVP score to a background color with opacity for sentence highlighting.
 * Returns an rgba string suitable for sentence background.
 */
export function sentimentBgColor(score: number, opacity = 0.15): string {
  const clamped = Math.max(-1, Math.min(1, score));
  if (clamped < -0.2) {
    const t = Math.min(1, (Math.abs(clamped) - 0.2) / 0.8);
    return `rgba(166, 53, 53, ${opacity + t * 0.2})`;
  } else if (clamped > 0.2) {
    const t = Math.min(1, (clamped - 0.2) / 0.8);
    return `rgba(91, 140, 90, ${opacity + t * 0.2})`;
  }
  return `rgba(156, 143, 128, ${opacity * 0.5})`;
}

/**
 * Map a CVP score to a left-border color for sentence display.
 * More saturated than background to be visually clear.
 */
export function sentimentBorderColor(score: number): string {
  const clamped = Math.max(-1, Math.min(1, score));
  if (clamped < -0.15) {
    const t = Math.min(1, (Math.abs(clamped) - 0.15) / 0.85);
    return `rgba(166, 53, 53, ${0.3 + t * 0.7})`;
  } else if (clamped > 0.15) {
    const t = Math.min(1, (clamped - 0.15) / 0.85);
    return `rgba(91, 140, 90, ${0.3 + t * 0.7})`;
  }
  return "rgba(156, 143, 128, 0.3)";
}

/** Format a CVP score for display: +0.42 or -0.18 */
export function formatScore(score: number): string {
  return (score >= 0 ? "+" : "") + score.toFixed(2);
}

/** Format negative_ratio as percentage: "47%" */
export function formatNegativeRatio(ratio: number): string {
  return Math.round(ratio * 100) + "%";
}

// ── Data fetching ────────────────────────────────────────────────────

let sentenceCache: SentenceScore[] | null = null;
let overviewCache: SentimentOverview | null = null;

/** Fetch sentence scores (lazy, ~400 KB gzipped). */
export async function fetchSentenceScores(): Promise<SentenceScore[]> {
  if (sentenceCache) return sentenceCache;
  const res = await fetch("/data/cvp-sentence-scores.json");
  if (!res.ok) throw new Error("Kunne ikke hente sætningsscores");
  sentenceCache = await res.json();
  return sentenceCache!;
}

/** Fetch pre-computed overview aggregates (~15 KB). */
export async function fetchSentimentOverview(): Promise<SentimentOverview> {
  if (overviewCache) return overviewCache;
  const res = await fetch("/data/sentiment-overview.json");
  if (!res.ok) throw new Error("Kunne ikke hente stemningsoverblik");
  overviewCache = await res.json();
  return overviewCache!;
}

/** Get sentence scores for a specific letter from already-fetched data. */
export function getSentencesForLetter(
  sentences: SentenceScore[],
  letterId: number
): SentenceScore[] {
  return sentences
    .filter((s) => s.letter_id === letterId)
    .sort((a, b) => a.index - b.index);
}
