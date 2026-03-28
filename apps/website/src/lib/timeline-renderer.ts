/**
 * Pure Canvas 2D rendering functions for the enhanced timeline.
 * No React dependencies -- receives pre-computed data and a 2D context.
 */

import {
  type LetterEntry,
  type RollingPoint,
  type MonthlyBin,
  dateToX,
  jitterY,
  sentimentColor,
  parseDate,
} from "@/lib/timeline-utils";

/* ------------------------------------------------------------------ */
/*  Shared types                                                       */
/* ------------------------------------------------------------------ */

export interface BattleEntry {
  name: string;
  startDate: string;
  endDate: string;
  front: string;
  location: string;
  wikipedia: string;
  sentimentDelta: number | null;
  nearbyLetterIds: number[];
}

export interface HitTarget {
  kind: "letter" | "battle";
  letter?: LetterEntry;
  battle?: BattleEntry;
  x: number;
  y: number;
  w?: number;
  h?: number;
  r?: number;
}

export interface DrawParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  viewStart: Date;
  viewEnd: Date;
  letters: LetterEntry[];
  sentiments: Record<string, { cvp_mean?: number }>;
  battles: BattleEntry[];
  rollingAvg: RollingPoint[];
  monthlyDensity: MonthlyBin[];
  maxDensity: number;
  showSentiment: boolean;
  showBattles: boolean;
  showDensity: boolean;
}

/* ------------------------------------------------------------------ */
/*  Layout constants                                                   */
/* ------------------------------------------------------------------ */

export const PADDING = 60;
export const TRACK_LETTER_H = 170;
export const TRACK_SENTIMENT_H = 90;
export const BATTLE_LANE_H = 32;
export const BATTLE_HEADER = 18;
export const TRACK_DENSITY_H = 40;
export const GAP = 20;
export const LABEL_H = 28;

const COLORS = {
  bg: "#FFFEF8",
  grid: "#E8E3D5",
  axis: "#9C8F80",
  text: "#7D7469",
  textDark: "#3D3229",
  westFront: "#4682B4",
  eastFront: "#D4A017",
  positive: "#5B8C5A",
  negative: "#A63535",
  neutral: "#9C8F80",
  separator: "#D6D0C4",
};

export { COLORS };

const FONT = "'IBM Plex Sans', system-ui, sans-serif";

/* Approximate character width for 9px bold IBM Plex Sans */
const CHAR_WIDTH_9PX_BOLD = 5.6;

/* ------------------------------------------------------------------ */
/*  Two-phase battle lane computation                                  */
/* ------------------------------------------------------------------ */

export interface BattleLaneItem {
  battle: BattleEntry;
  lane: number;
  sx: number;
  barW: number;
}

/**
 * Pre-compute battle lane assignments. Runs before canvas height is
 * known, so it uses a character-width approximation for label collision
 * instead of ctx.measureText.
 */
export function computeBattleLanes(
  battles: BattleEntry[],
  toX: (d: Date) => number,
  canvasWidth: number
): { items: BattleLaneItem[]; laneCount: number } {
  const sorted = [...battles].sort(
    (a, b) => parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime()
  );

  const lanes: { end: number }[] = [];
  const items: BattleLaneItem[] = [];

  for (const battle of sorted) {
    const sx = toX(parseDate(battle.startDate));
    const ex = toX(parseDate(battle.endDate));
    const barW = Math.max(ex - sx, 8);

    if (sx > canvasWidth - PADDING + 50 || ex < PADDING - 50) continue;

    // Account for label width in lane end tracking
    const labelW = battle.name.length * CHAR_WIDTH_9PX_BOLD + 10;
    const occupiedEnd = sx + Math.max(barW, labelW);

    // Correct first-fit: find the first lane where this battle fits
    let lane = -1;
    for (let l = 0; l < lanes.length; l++) {
      if (sx > lanes[l].end + 8) {
        lane = l;
        break;
      }
    }
    if (lane === -1) {
      lane = lanes.length;
      lanes.push({ end: 0 });
    }
    lanes[lane].end = occupiedEnd;

    items.push({ battle, lane, sx, barW });
  }

  return { items, laneCount: lanes.length };
}

/* ------------------------------------------------------------------ */
/*  Canvas height calculator                                           */
/* ------------------------------------------------------------------ */

export function computeCanvasHeight(
  showSentiment: boolean,
  showBattles: boolean,
  showDensity: boolean,
  battleLaneCount: number = 3
): number {
  let h = LABEL_H + TRACK_LETTER_H;
  if (showSentiment) h += GAP + TRACK_SENTIMENT_H;
  if (showBattles) {
    const battleH = BATTLE_HEADER + Math.max(battleLaneCount, 1) * BATTLE_LANE_H + 8;
    h += GAP + Math.max(battleH, 60);
  }
  if (showDensity) h += GAP + TRACK_DENSITY_H;
  return h + 20;
}

/* ------------------------------------------------------------------ */
/*  Hit-testing helpers                                                */
/* ------------------------------------------------------------------ */

export function pointInCircle(
  px: number, py: number, cx: number, cy: number, r: number
): boolean {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

export function pointInRect(
  px: number, py: number, rx: number, ry: number, rw: number, rh: number
): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

/* ------------------------------------------------------------------ */
/*  Label granularity                                                  */
/* ------------------------------------------------------------------ */

function labelGranularity(
  viewStart: Date, viewEnd: Date
): "year" | "month" | "week" | "day" {
  const rangeDays = (viewEnd.getTime() - viewStart.getTime()) / 86_400_000;
  if (rangeDays <= 60) return "day";
  if (rangeDays <= 365) return "week";
  if (rangeDays <= 365 * 3) return "month";
  return "year";
}

/* ------------------------------------------------------------------ */
/*  Track separators & headers                                         */
/* ------------------------------------------------------------------ */

function drawTrackSeparator(ctx: CanvasRenderingContext2D, y: number, w: number) {
  ctx.strokeStyle = COLORS.separator;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING - 10, y);
  ctx.lineTo(w - PADDING + 10, y);
  ctx.stroke();
}

function drawTrackHeader(ctx: CanvasRenderingContext2D, label: string, y: number) {
  ctx.save();
  ctx.font = `600 10px ${FONT}`;
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = "right";
  ctx.fillText(label, PADDING - 14, y + 13);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/*  Main draw routine                                                  */
/* ------------------------------------------------------------------ */

export function drawTimeline(params: DrawParams): HitTarget[] {
  const {
    ctx, width: w, height, viewStart, viewEnd,
    letters, sentiments, battles,
    rollingAvg, monthlyDensity, maxDensity,
    showSentiment, showBattles, showDensity,
  } = params;

  const targets: HitTarget[] = [];
  const toX = (d: Date) => dateToX(d, viewStart, viewEnd, w, PADDING);

  // Clear
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, height);

  /* ---- Time labels ---- */

  drawTimeLabels(ctx, w, height, viewStart, viewEnd, toX);

  /* ---- TRACK 1: Letter dots (with density background) ---- */

  const trackLetterTop = LABEL_H;
  drawTrackHeader(ctx, "Breve", trackLetterTop);

  // Draw density as subtle background tint behind the letter dots
  if (showDensity && monthlyDensity.length > 0) {
    for (const bin of monthlyDensity) {
      const monthStart = parseDate(`${bin.month}-01`);
      const nextMonth = new Date(monthStart);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const sx = toX(monthStart);
      const ex = toX(nextMonth);
      if (ex < PADDING || sx > w - PADDING) continue;
      const intensity = bin.count / maxDensity;
      ctx.fillStyle = `rgba(156, 143, 128, ${intensity * 0.15})`;
      ctx.fillRect(sx, trackLetterTop, Math.max(ex - sx - 1, 2), TRACK_LETTER_H);
    }
  }

  const dotR = Math.max(3, Math.min(5, w / Math.max(letters.length, 1)));

  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i];
    const d = parseDate(letter.date);
    const x = toX(d);
    if (x < PADDING - 10 || x > w - PADDING + 10) continue;

    const score = sentiments[String(letter.id)]?.cvp_mean ?? 0;
    const yOff = jitterY(letter.id, i, TRACK_LETTER_H - 20);
    const cy = trackLetterTop + TRACK_LETTER_H / 2 + yOff;

    ctx.beginPath();
    ctx.arc(x, cy, dotR, 0, Math.PI * 2);
    ctx.fillStyle = sentimentColor(score);
    ctx.globalAlpha = 0.75;
    ctx.fill();
    ctx.globalAlpha = 1;

    targets.push({ kind: "letter", letter, x, y: cy, r: dotR + 2 });
  }

  /* ---- TRACK 2: Sentiment trend ---- */

  let nextTrackTop = trackLetterTop + TRACK_LETTER_H;

  if (showSentiment && rollingAvg.length > 1) {
    nextTrackTop += GAP;
    drawTrackSeparator(ctx, nextTrackTop - GAP / 2, w);
    drawTrackHeader(ctx, "Stemning", nextTrackTop);
    drawSentimentTrack(ctx, w, toX, rollingAvg, nextTrackTop);
    nextTrackTop += TRACK_SENTIMENT_H;
  }

  /* ---- TRACK 3: Battles (two-phase: lanes pre-computed) ---- */

  if (showBattles && battles.length > 0) {
    nextTrackTop += GAP;
    drawTrackSeparator(ctx, nextTrackTop - GAP / 2, w);
    drawTrackHeader(ctx, "Slag", nextTrackTop);

    const { items } = computeBattleLanes(battles, toX, w);
    drawBattleTrack(ctx, w, items, nextTrackTop, targets);

    const laneCount = items.length > 0
      ? Math.max(...items.map((it) => it.lane)) + 1
      : 1;
    nextTrackTop += BATTLE_HEADER + laneCount * BATTLE_LANE_H + 8;
  }

  /* ---- TRACK 4: Density heatmap (standalone bars) ---- */

  if (showDensity && monthlyDensity.length > 0) {
    nextTrackTop += GAP;
    drawTrackSeparator(ctx, nextTrackTop - GAP / 2, w);
    drawTrackHeader(ctx, "Densitet", nextTrackTop);
    drawDensityTrack(ctx, w, toX, monthlyDensity, maxDensity, nextTrackTop);
  }

  return targets;
}

/* ------------------------------------------------------------------ */
/*  Sub-draw: time labels                                              */
/* ------------------------------------------------------------------ */

function drawTimeLabels(
  ctx: CanvasRenderingContext2D,
  w: number, height: number,
  viewStart: Date, viewEnd: Date,
  toX: (d: Date) => number
) {
  const gran = labelGranularity(viewStart, viewEnd);
  ctx.font = `11px ${FONT}`;
  ctx.textAlign = "center";

  const labels: { date: Date; label: string }[] = [];
  const monthNames = [
    "Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec",
  ];

  if (gran === "year") {
    for (let y = 1911; y <= 1918; y++) {
      const d = new Date(`${y}-01-01T00:00:00`);
      if (d >= viewStart && d <= viewEnd) labels.push({ date: d, label: String(y) });
    }
  } else if (gran === "month") {
    const cur = new Date(viewStart);
    cur.setDate(1);
    while (cur <= viewEnd) {
      labels.push({
        date: new Date(cur),
        label: `${monthNames[cur.getMonth()]} ${cur.getFullYear()}`,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
  } else if (gran === "week") {
    const cur = new Date(viewStart);
    cur.setDate(cur.getDate() - cur.getDay() + 1);
    while (cur <= viewEnd) {
      labels.push({ date: new Date(cur), label: `${cur.getDate()}/${cur.getMonth() + 1}` });
      cur.setDate(cur.getDate() + 7);
    }
  } else {
    const cur = new Date(viewStart);
    while (cur <= viewEnd) {
      labels.push({ date: new Date(cur), label: `${cur.getDate()}/${cur.getMonth() + 1}` });
      cur.setDate(cur.getDate() + 1);
    }
  }

  for (const { date, label } of labels) {
    const x = toX(date);
    if (x < PADDING || x > w - PADDING) continue;
    ctx.fillStyle = COLORS.text;
    ctx.fillText(label, x, 16);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, LABEL_H);
    ctx.lineTo(x, height - 10);
    ctx.stroke();
  }
}

/* ------------------------------------------------------------------ */
/*  Sub-draw: sentiment trend                                          */
/* ------------------------------------------------------------------ */

function drawSentimentTrack(
  ctx: CanvasRenderingContext2D,
  w: number,
  toX: (d: Date) => number,
  rollingAvg: RollingPoint[],
  trackTop: number
) {
  const trackMid = trackTop + TRACK_SENTIMENT_H / 2;

  let minS = 0, maxS = 0;
  for (const p of rollingAvg) {
    if (p.avgSentiment < minS) minS = p.avgSentiment;
    if (p.avgSentiment > maxS) maxS = p.avgSentiment;
  }
  const absMax = Math.max(Math.abs(minS), Math.abs(maxS), 0.01);
  const toY = (v: number) => trackMid - (v / absMax) * (TRACK_SENTIMENT_H / 2 - 8);

  // Zero line
  ctx.strokeStyle = COLORS.axis;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(PADDING, trackMid);
  ctx.lineTo(w - PADDING, trackMid);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = `10px ${FONT}`;
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = "left";
  ctx.fillText("0", PADDING - 14, trackMid + 3);

  // Filled area with clip
  ctx.beginPath();
  ctx.moveTo(toX(rollingAvg[0].date), trackMid);
  for (const p of rollingAvg) ctx.lineTo(toX(p.date), toY(p.avgSentiment));
  ctx.lineTo(toX(rollingAvg[rollingAvg.length - 1].date), trackMid);
  ctx.closePath();

  ctx.save();
  ctx.clip();
  ctx.fillStyle = "rgba(91, 140, 90, 0.2)";
  ctx.fillRect(PADDING, trackTop, w - 2 * PADDING, trackMid - trackTop);
  ctx.fillStyle = "rgba(166, 53, 53, 0.2)";
  ctx.fillRect(PADDING, trackMid, w - 2 * PADDING, trackTop + TRACK_SENTIMENT_H - trackMid);
  ctx.restore();

  // Trend line
  ctx.strokeStyle = COLORS.textDark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < rollingAvg.length; i++) {
    const x = toX(rollingAvg[i].date);
    const y = toY(rollingAvg[i].avgSentiment);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/* ------------------------------------------------------------------ */
/*  Sub-draw: battle bars (uses pre-computed lanes)                    */
/* ------------------------------------------------------------------ */

function drawBattleTrack(
  ctx: CanvasRenderingContext2D,
  w: number,
  laneItems: BattleLaneItem[],
  trackTop: number,
  targets: HitTarget[]
) {
  const barH = 22;

  for (const { battle, lane, sx, barW } of laneItems) {
    const barY = trackTop + BATTLE_HEADER + lane * BATTLE_LANE_H;
    const color = battle.front === "West" ? COLORS.westFront : COLORS.eastFront;

    // Rounded bar
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55;
    roundRect(ctx, sx, barY, barW, barH, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    roundRect(ctx, sx, barY, barW, barH, 3);
    ctx.stroke();

    // Striped pattern for East front
    if (battle.front !== "West") {
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = COLORS.textDark;
      ctx.lineWidth = 1;
      roundRect(ctx, sx, barY, barW, barH, 3);
      ctx.clip();
      for (let stripe = sx - barH; stripe < sx + barW + barH; stripe += 6) {
        ctx.beginPath();
        ctx.moveTo(stripe, barY);
        ctx.lineTo(stripe + barH, barY + barH);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Label: inside bar if it fits, otherwise to the right
    ctx.font = `bold 9px ${FONT}`;
    const labelW = ctx.measureText(battle.name).width;
    ctx.fillStyle = COLORS.textDark;
    ctx.textAlign = "left";
    if (labelW < barW - 6) {
      ctx.fillText(battle.name, sx + 4, barY + barH / 2 + 3);
    } else {
      ctx.fillText(battle.name, sx + barW + 5, barY + barH / 2 + 3, w - sx - barW - PADDING - 10);
    }

    targets.push({ kind: "battle", battle, x: sx, y: barY, w: barW, h: barH });
  }
}

/* ------------------------------------------------------------------ */
/*  Sub-draw: density heatmap                                          */
/* ------------------------------------------------------------------ */

function drawDensityTrack(
  ctx: CanvasRenderingContext2D,
  w: number,
  toX: (d: Date) => number,
  monthlyDensity: MonthlyBin[],
  maxDensity: number,
  trackTop: number
) {
  for (const bin of monthlyDensity) {
    const monthStart = parseDate(`${bin.month}-01`);
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const sx = toX(monthStart);
    const ex = toX(nextMonth);
    if (ex < PADDING || sx > w - PADDING) continue;

    const intensity = bin.count / maxDensity;
    const r = Math.round(232 - intensity * (232 - 90));
    const g = Math.round(227 - intensity * (227 - 79));
    const b = Math.round(213 - intensity * (213 - 67));

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(sx, trackTop, Math.max(ex - sx - 1, 2), TRACK_DENSITY_H);

    if (ex - sx > 18 && bin.count > 0) {
      ctx.font = `9px ${FONT}`;
      ctx.fillStyle = intensity > 0.5 ? "#FFFEF8" : COLORS.text;
      ctx.textAlign = "center";
      ctx.fillText(String(bin.count), (sx + ex) / 2, trackTop + TRACK_DENSITY_H / 2 + 3);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Utility: rounded rectangle path                                    */
/* ------------------------------------------------------------------ */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
