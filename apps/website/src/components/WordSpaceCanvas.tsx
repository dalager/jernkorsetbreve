"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { polygonHull, scaleLinear } from "d3";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface WordPoint {
  term: string;
  theme: string;
  themeLabel: string;
  x: number;
  y: number;
  neighbors: Array<{ term: string; sim: number }>;
  contextCount: number;
  example: string | null;
  exampleLetterId: number | null;
}

export interface WordSpaceData {
  meta: { model: string; dimensions: number; method: string; termCount: number };
  themes: Record<string, string>;
  points: WordPoint[];
}

/* Theme colours — muted, archival-editorial palette. */
export const THEME_COLORS: Record<string, string> = {
  krig: "#8B2323", // war       (wax-red)
  hjem: "#2f5d8c", // home
  folelser: "#7a4a8c", // emotions
  natur: "#3f7a4d", // nature
  tro: "#b07d1e", // faith
  brev: "#2f7d82", // letters
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function WordSpaceCanvas({ data }: { data: WordSpaceData }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [hovered, setHovered] = useState<WordPoint | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showLinks, setShowLinks] = useState(false);
  const [showHulls, setShowHulls] = useState(true);

  /* Responsive width */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = Math.max(420, Math.min(680, Math.round(width * 0.62)));
  const pad = 46;

  const { xScale, yScale } = useMemo(() => {
    return {
      xScale: scaleLinear().domain([0, 1]).range([pad, width - pad]),
      yScale: scaleLinear().domain([0, 1]).range([height - pad, pad]),
    };
  }, [width, height]);

  const byTerm = useMemo(
    () => new Map(data.points.map((p) => [p.term, p])),
    [data.points],
  );

  const visiblePoints = useMemo(
    () => data.points.filter((p) => !hidden.has(p.theme)),
    [data.points, hidden],
  );

  /* Convex hull per theme */
  const hulls = useMemo(() => {
    if (!showHulls) return [];
    const out: Array<{ theme: string; d: string }> = [];
    const groups = new Map<string, WordPoint[]>();
    for (const p of visiblePoints) {
      if (!groups.has(p.theme)) groups.set(p.theme, []);
      groups.get(p.theme)!.push(p);
    }
    for (const [theme, pts] of groups) {
      if (pts.length < 3) continue;
      const hull = polygonHull(pts.map((p) => [xScale(p.x), yScale(p.y)] as [number, number]));
      if (!hull) continue;
      out.push({ theme, d: "M" + hull.map((h) => h.join(",")).join("L") + "Z" });
    }
    return out;
  }, [visiblePoints, showHulls, xScale, yScale]);

  /* Links: persistent (toggle) and/or hover neighbours */
  const links = useMemo(() => {
    const out: Array<{ x1: number; y1: number; x2: number; y2: number; color: string; opacity: number; w: number }> = [];
    const isVisible = (t: string) => byTerm.has(t) && !hidden.has(byTerm.get(t)!.theme);

    if (showLinks) {
      const seen = new Set<string>();
      for (const p of visiblePoints) {
        for (const nb of p.neighbors) {
          if (!isVisible(nb.term)) continue;
          const key = [p.term, nb.term].sort().join("|");
          if (seen.has(key)) continue;
          seen.add(key);
          const q = byTerm.get(nb.term)!;
          out.push({ x1: xScale(p.x), y1: yScale(p.y), x2: xScale(q.x), y2: yScale(q.y), color: THEME_COLORS[p.theme], opacity: 0.16, w: 1 });
        }
      }
    }
    if (hovered) {
      for (const nb of hovered.neighbors) {
        if (!isVisible(nb.term)) continue;
        const q = byTerm.get(nb.term)!;
        out.push({ x1: xScale(hovered.x), y1: yScale(hovered.y), x2: xScale(q.x), y2: yScale(q.y), color: THEME_COLORS[hovered.theme], opacity: 0.55, w: 1.6 });
      }
    }
    return out;
  }, [showLinks, hovered, visiblePoints, hidden, byTerm, xScale, yScale]);

  const neighborTerms = useMemo(
    () => (hovered ? new Set(hovered.neighbors.map((n) => n.term)) : null),
    [hovered],
  );

  function toggleTheme(theme: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(theme)) next.delete(theme);
      else next.add(theme);
      return next;
    });
  }

  /* Card position next to the hovered node, clamped to the plot. */
  const cardPos = useMemo(() => {
    if (!hovered) return null;
    const cx = xScale(hovered.x);
    const cy = yScale(hovered.y);
    const cardW = 300;
    let left = cx + 18;
    if (left + cardW > width) left = cx - cardW - 18;
    let top = cy + 14;
    if (top + 190 > height) top = Math.max(8, height - 200);
    return { left: Math.max(8, left), top: Math.max(8, top) };
  }, [hovered, xScale, yScale, width, height]);

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.themes).map(([key, label]) => {
            const off = hidden.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleTheme(key)}
                className={`inline-flex items-center gap-2 rounded-full border border-faded/30 bg-parchment-light px-3 py-1 font-ui text-ui-sm transition-opacity ${off ? "opacity-40" : ""}`}
              >
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: THEME_COLORS[key] }} />
                {label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-4 font-ui text-ui-sm text-faded-dark">
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={showLinks} onChange={(e) => setShowLinks(e.target.checked)} />
            Naboforbindelser
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={showHulls} onChange={(e) => setShowHulls(e.target.checked)} />
            Temaområder
          </label>
        </div>
      </div>

      {/* Plot */}
      <div ref={wrapRef} className="relative rounded-md border border-faded/20 bg-parchment-light">
        <svg width={width} height={height} className="block" role="img" aria-label="Vektorrum med ord fra brevene">
          {/* hulls */}
          {hulls.map((h) => (
            <path
              key={h.theme}
              d={h.d}
              fill={THEME_COLORS[h.theme]}
              fillOpacity={0.07}
              stroke={THEME_COLORS[h.theme]}
              strokeOpacity={0.22}
              strokeWidth={1}
            />
          ))}
          {/* links */}
          {links.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.color} strokeOpacity={l.opacity} strokeWidth={l.w} strokeLinecap="round" />
          ))}
          {/* nodes */}
          {visiblePoints.map((p) => {
            const isHover = hovered?.term === p.term;
            const isNeighbor = neighborTerms?.has(p.term) ?? false;
            const dim = hovered && !isHover && !isNeighbor;
            return (
              <g
                key={p.term}
                transform={`translate(${xScale(p.x)},${yScale(p.y)})`}
                opacity={dim ? 0.2 : 1}
                onMouseEnter={() => setHovered(p)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  r={isHover ? 9 : isNeighbor ? 7 : 6}
                  fill={THEME_COLORS[p.theme]}
                  stroke="var(--color-parchment-light, #FFFEF8)"
                  strokeWidth={1.5}
                />
                <text
                  x={10}
                  y={4}
                  fontSize={13}
                  fontWeight={isHover ? 700 : 400}
                  className="select-none"
                  style={{ fill: "var(--color-ink, #3D3229)", paintOrder: "stroke", stroke: "var(--color-parchment-light, #FFFEF8)", strokeWidth: 3, strokeLinejoin: "round" }}
                >
                  {p.term}
                </text>
              </g>
            );
          })}
        </svg>

        <span className="pointer-events-none absolute bottom-2.5 right-3.5 font-ui text-xs italic text-faded">
          {data.meta.dimensions} dimensioner → 2 ({data.meta.method.toUpperCase()}). Kun afstand betyder noget.
        </span>

        {/* Detail card */}
        {hovered && cardPos && (
          <div
            className="pointer-events-none absolute z-10 w-[300px] max-w-[78vw] rounded-md border border-faded/30 border-t-[3px] border-t-wax-red bg-parchment-light p-3.5 shadow-letter"
            style={{ left: cardPos.left, top: cardPos.top }}
          >
            <div className="font-display text-lg text-ink">{hovered.term}</div>
            <div className="mb-2 font-ui text-xs text-faded">
              {hovered.themeLabel}
              {hovered.contextCount ? ` · ${hovered.contextCount} forekomster` : ""}
            </div>
            <div className="mb-1 font-ui text-[11px] uppercase tracking-wide text-faded">Nærmeste naboer</div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {hovered.neighbors.map((n) => (
                <span key={n.term} className="rounded-full border border-faded/30 bg-parchment px-2 py-0.5 font-ui text-ui-sm text-ink">
                  {n.term}
                </span>
              ))}
            </div>
            {hovered.example && (
              <>
                <div className="mb-1 font-ui text-[11px] uppercase tracking-wide text-faded">Sådan bruges ordet i brevene</div>
                <p className="border-l-2 border-faded/30 pl-2.5 font-body text-body-sm italic text-faded-dark">
                  «{hovered.example}»
                  {hovered.exampleLetterId != null && (
                    <span className="not-italic"> — brev {hovered.exampleLetterId}</span>
                  )}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Read-the-letter link (pointer-events under the card are disabled, so
          provide a separate, clickable affordance below the plot). */}
      {hovered?.exampleLetterId != null && (
        <p className="mt-2 font-ui text-ui-sm text-faded-dark">
          Eksemplet for «{hovered.term}» kommer fra{" "}
          <Link href={`/breve/${hovered.exampleLetterId}/`} className="text-wax-red underline">
            brev {hovered.exampleLetterId}
          </Link>
          .
        </p>
      )}
    </div>
  );
}
