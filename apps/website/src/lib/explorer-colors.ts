/**
 * Shared color palettes and helpers for both 2D and 3D explorer canvases.
 */
import { sentimentColorHSL } from "@/lib/timeline-utils";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Year range for the time color gradient */
export const YEAR_MIN = 1911;
export const YEAR_MAX = 1918;

/** Categorical recipient colors */
export const RECIPIENT_COLORS: Record<string, string> = {
  "Mor og far": "hsl(145, 45%, 42%)",
  "Trine Mærsk": "hsl(340, 55%, 55%)",
  "Peter Mærsk": "hsl(215, 60%, 50%)",
  "Maren Mærsk": "hsl(270, 45%, 55%)",
};
export const RECIPIENT_DEFAULT = "hsl(0, 0%, 60%)";

/** Qualitative cluster palette (8 clusters) */
export const CLUSTER_PALETTE = [
  "hsl(210, 55%, 50%)",
  "hsl(35, 70%, 52%)",
  "hsl(150, 45%, 42%)",
  "hsl(340, 55%, 52%)",
  "hsl(270, 45%, 55%)",
  "hsl(180, 50%, 42%)",
  "hsl(55, 65%, 48%)",
  "hsl(15, 60%, 50%)",
];

/* ------------------------------------------------------------------ */
/*  Color helpers                                                      */
/* ------------------------------------------------------------------ */

export function getTimeColor(dateStr: string): string {
  if (!dateStr) return "hsl(0, 0%, 60%)";
  const year = parseInt(dateStr.substring(0, 4), 10);
  const t = Math.max(0, Math.min(1, (year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)));
  const hue = 220 - t * 205;
  return `hsl(${hue}, 65%, 50%)`;
}

export function getRecipientColor(recipient: string): string {
  return RECIPIENT_COLORS[recipient] ?? RECIPIENT_DEFAULT;
}

export const getSentimentColor = sentimentColorHSL;

export function getClusterColor(clusterId: number): string {
  return CLUSTER_PALETTE[clusterId % CLUSTER_PALETTE.length];
}

export function colorWithAlpha(hsl: string, alpha: number): string {
  return hsl.replace("hsl(", "hsla(").replace(")", `, ${alpha})`);
}
