"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from "react";
import { useRouter } from "next/navigation";
import {
  type LetterEntry,
  computeRollingAverage,
  computeMonthlyDensity,
  xToDate,
  parseDate,
  sentimentLabel,
} from "@/lib/timeline-utils";
import {
  type BattleEntry,
  type HitTarget,
  PADDING,
  COLORS,
  computeCanvasHeight,
  computeBattleLanes,
  drawTimeline,
  pointInCircle,
  pointInRect,
} from "@/lib/timeline-renderer";
import { dateToX } from "@/lib/timeline-utils";

// Re-export for consumers
export type { BattleEntry } from "@/lib/timeline-renderer";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  letters: LetterEntry[];
  sentiments: Record<string, { cvp_mean?: number }>;
  battles: BattleEntry[];
  showSentiment: boolean;
  showBattles: boolean;
  showDensity: boolean;
  selectedSender: string;
}

export interface EnhancedTimelineHandle {
  resetZoom: () => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FULL_START = new Date("1911-01-01T00:00:00");
const FULL_END = new Date("1918-12-31T00:00:00");
const MIN_RANGE_MS = 30 * 86_400_000;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const EnhancedTimeline = forwardRef<EnhancedTimelineHandle, Props>(
  function EnhancedTimeline(
    { letters, sentiments, battles, showSentiment, showBattles, showDensity, selectedSender },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const [viewStart, setViewStart] = useState<Date>(FULL_START);
    const [viewEnd, setViewEnd] = useState<Date>(FULL_END);
    const [canvasWidth, setCanvasWidth] = useState(1000);
    const [tooltip, setTooltip] = useState<{ text: string[]; x: number; y: number } | null>(null);

    const isPanning = useRef(false);
    const panStartX = useRef(0);
    const panStartDate = useRef<Date>(FULL_START);
    const panEndDate = useRef<Date>(FULL_END);
    const hitTargets = useRef<HitTarget[]>([]);

    useImperativeHandle(ref, () => ({
      resetZoom() {
        setViewStart(FULL_START);
        setViewEnd(FULL_END);
      },
    }));

    /* ---- Derived data ---- */

    const filtered = useMemo(() => {
      if (selectedSender === "all") return letters;
      return letters.filter((l) => l.sender === selectedSender);
    }, [letters, selectedSender]);

    const rollingAvg = useMemo(
      () => computeRollingAverage(filtered, sentiments, 30),
      [filtered, sentiments]
    );

    const monthlyDensity = useMemo(
      () => computeMonthlyDensity(filtered),
      [filtered]
    );

    const maxDensity = useMemo(
      () => Math.max(1, ...monthlyDensity.map((b) => b.count)),
      [monthlyDensity]
    );

    const battleLaneCount = useMemo(() => {
      if (!showBattles || battles.length === 0) return 0;
      const toX = (d: Date) => dateToX(d, viewStart, viewEnd, canvasWidth, PADDING);
      const { laneCount } = computeBattleLanes(battles, toX, canvasWidth);
      return laneCount;
    }, [battles, showBattles, viewStart, viewEnd, canvasWidth]);

    const canvasHeight = useMemo(
      () => computeCanvasHeight(showSentiment, showBattles, showDensity, battleLaneCount),
      [showSentiment, showBattles, showDensity, battleLaneCount]
    );

    /* ---- Resize observer ---- */

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) setCanvasWidth(Math.floor(entry.contentRect.width));
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    /* ---- Draw ---- */

    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvasWidth * dpr;
      canvas.height = canvasHeight * dpr;
      ctx.scale(dpr, dpr);

      hitTargets.current = drawTimeline({
        ctx,
        width: canvasWidth,
        height: canvasHeight,
        viewStart,
        viewEnd,
        letters: filtered,
        sentiments,
        battles,
        rollingAvg,
        monthlyDensity,
        maxDensity,
        showSentiment,
        showBattles,
        showDensity,
      });
    }, [
      canvasWidth, canvasHeight, viewStart, viewEnd,
      filtered, sentiments, battles, rollingAvg,
      monthlyDensity, maxDensity, showSentiment, showBattles, showDensity,
    ]);

    useEffect(() => { draw(); }, [draw]);

    /* ---- Zoom (wheel) ---- */

    const handleWheel = useCallback(
      (e: React.WheelEvent) => {
        e.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const mouseX = e.clientX - rect.left;
        const pivot = xToDate(mouseX, viewStart, viewEnd, canvasWidth, PADDING);
        const range = viewEnd.getTime() - viewStart.getTime();
        const factor = e.deltaY > 0 ? 1.15 : 0.87;
        const newRange = Math.max(MIN_RANGE_MS, range * factor);
        const pivotRatio = (pivot.getTime() - viewStart.getTime()) / range;

        let newStart = new Date(pivot.getTime() - pivotRatio * newRange);
        let newEnd = new Date(pivot.getTime() + (1 - pivotRatio) * newRange);
        if (newStart < FULL_START) newStart = FULL_START;
        if (newEnd > FULL_END) newEnd = FULL_END;

        setViewStart(newStart);
        setViewEnd(newEnd);
      },
      [viewStart, viewEnd, canvasWidth]
    );

    /* ---- Pan (drag) ---- */

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        isPanning.current = true;
        panStartX.current = e.clientX;
        panStartDate.current = viewStart;
        panEndDate.current = viewEnd;
      },
      [viewStart, viewEnd]
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        if (isPanning.current) {
          const dx = e.clientX - panStartX.current;
          const range = panEndDate.current.getTime() - panStartDate.current.getTime();
          const dateShift = -(dx / (canvasWidth - 2 * PADDING)) * range;

          let ns = new Date(panStartDate.current.getTime() + dateShift);
          let ne = new Date(panEndDate.current.getTime() + dateShift);
          if (ns < FULL_START) {
            ne = new Date(ne.getTime() + (FULL_START.getTime() - ns.getTime()));
            ns = FULL_START;
          }
          if (ne > FULL_END) {
            ns = new Date(ns.getTime() - (ne.getTime() - FULL_END.getTime()));
            ne = FULL_END;
          }
          setViewStart(ns);
          setViewEnd(ne);
          setTooltip(null);
          return;
        }

        // Hover hit-testing
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const hit = findHit(mx, my, hitTargets.current, sentiments);
        setTooltip(hit ? { ...hit, x: mx, y: my } : null);
      },
      [canvasWidth, sentiments]
    );

    const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);

    /* ---- Click ---- */

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        for (const t of hitTargets.current) {
          if (t.kind === "letter" && t.r && pointInCircle(mx, my, t.x, t.y, t.r)) {
            router.push(`/letters/${t.letter!.id}/`);
            return;
          }
          if (t.kind === "battle" && t.w !== undefined && t.h !== undefined
              && pointInRect(mx, my, t.x, t.y, t.w, t.h)) {
            window.open(t.battle!.wikipedia, "_blank", "noopener");
            return;
          }
        }
      },
      [router]
    );

    /* ---- Render ---- */

    return (
      <div ref={containerRef} className="relative w-full">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          style={{ width: "100%", height: canvasHeight, cursor: "grab", touchAction: "none" }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { isPanning.current = false; setTooltip(null); }}
          onClick={handleClick}
        />

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-2 text-xs font-ui text-faded">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.positive }} />
            Positiv
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.neutral }} />
            Neutral
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.negative }} />
            Negativ
          </span>
          {showBattles && (
            <>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: COLORS.westFront }} />
                Vestfronten
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: COLORS.eastFront }} />
                Østfronten
              </span>
            </>
          )}
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-ink text-parchment-light text-xs rounded px-3 py-2 shadow-lg font-ui z-10"
            style={{
              left: Math.min(tooltip.x + 12, canvasWidth - 220),
              top: Math.max(tooltip.y - 10, 0),
              maxWidth: 260,
            }}
          >
            {tooltip.text.map((line, i) => (
              <p key={i} className={i === 0 ? "font-medium mb-0.5" : ""}>{line}</p>
            ))}
          </div>
        )}
      </div>
    );
  }
);

export default EnhancedTimeline;

/* ------------------------------------------------------------------ */
/*  Hover hit-test helper                                              */
/* ------------------------------------------------------------------ */

function findHit(
  mx: number,
  my: number,
  targets: HitTarget[],
  sentiments: Record<string, { cvp_mean?: number }>
): { text: string[] } | null {
  for (const t of targets) {
    if (t.kind === "letter" && t.r && pointInCircle(mx, my, t.x, t.y, t.r)) {
      const l = t.letter!;
      const score = sentiments[String(l.id)]?.cvp_mean ?? 0;
      const dateStr = parseDate(l.date).toLocaleDateString("da-DK", {
        day: "numeric", month: "long", year: "numeric",
      });
      return {
        text: [
          dateStr,
          `Fra: ${l.sender} \u2192 ${l.recipient}`,
          `Stemning: ${sentimentLabel(score)} (${score.toFixed(2)})`,
        ],
      };
    }
    if (t.kind === "battle" && t.w !== undefined && t.h !== undefined
        && pointInRect(mx, my, t.x, t.y, t.w, t.h)) {
      const b = t.battle!;
      const lines = [
        b.name,
        `${b.startDate} \u2013 ${b.endDate}`,
        `Front: ${b.front === "West" ? "Vestfronten" : "\u00D8stfronten"}`,
      ];
      if (b.sentimentDelta !== null) {
        lines.push(`Stemningsændring: ${b.sentimentDelta > 0 ? "+" : ""}${b.sentimentDelta.toFixed(1)}`);
      }
      lines.push(`Breve i nærheden: ${b.nearbyLetterIds.length}`);
      return { text: lines };
    }
  }
  return null;
}
