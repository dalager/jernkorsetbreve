"use client";

import { useMemo, useState } from "react";
import type {
  EmotionScoresMap,
  PsycholinguisticsMap,
} from "@/types/psycholinguistics";
import { isWartime } from "@/lib/psycholinguistic-utils";

interface EmotionTimelineProps {
  emotions: EmotionScoresMap;
  psycho: PsycholinguisticsMap;
}

type EmotionKey =
  | "fear"
  | "grief"
  | "hope"
  | "love"
  | "anger"
  | "gratitude"
  | "pride"
  | "remorse"
  | "relief"
  | "desire";

interface EmotionDef {
  key: EmotionKey;
  label: string;
  color: string;
  group: "core" | "extended";
}

const EMOTIONS: EmotionDef[] = [
  // Core (original 4)
  { key: "fear", label: "Frygt", color: "#D97706", group: "core" },
  { key: "grief", label: "Sorg", color: "#64748B", group: "core" },
  { key: "hope", label: "Håb", color: "#059669", group: "core" },
  { key: "love", label: "Kærlighed", color: "#E11D48", group: "core" },
  // Extended (ADR-038)
  { key: "anger", label: "Vrede", color: "#DC2626", group: "extended" },
  { key: "gratitude", label: "Taknemmelighed", color: "#7C3AED", group: "extended" },
  { key: "pride", label: "Stolthed", color: "#2563EB", group: "extended" },
  { key: "remorse", label: "Anger", color: "#6B7280", group: "extended" },
  { key: "relief", label: "Lettelse", color: "#0891B2", group: "extended" },
  { key: "desire", label: "Længsel", color: "#BE185D", group: "extended" },
];

type YearBucket = Record<EmotionKey, number> & { year: string; count: number };

export default function EmotionTimeline({ emotions, psycho }: EmotionTimelineProps) {
  const [showExtended, setShowExtended] = useState(false);

  // Only show emotions that have data (extended emotions may not be generated yet)
  const hasExtendedData = useMemo(() => {
    const firstEntry = Object.values(emotions)[0];
    return firstEntry && typeof (firstEntry as unknown as Record<string, number>)["anger_mean"] === "number";
  }, [emotions]);

  const availableEmotions = hasExtendedData ? EMOTIONS : EMOTIONS.filter((e) => e.group === "core");
  const visibleEmotions = showExtended ? availableEmotions : availableEmotions.filter((e) => e.group === "core");

  const yearData = useMemo(() => {
    const buckets: Record<string, Record<string, number> & { count: number }> = {};

    for (const [letterId, emo] of Object.entries(emotions)) {
      const psych = psycho[letterId];
      if (!psych) continue;
      const year = psych.date.slice(0, 4);

      if (!buckets[year]) {
        const init: Record<string, number> & { count: number } = { count: 0 } as Record<string, number> & { count: number };
        for (const e of EMOTIONS) init[e.key] = 0;
        buckets[year] = init;
      }
      for (const e of EMOTIONS) {
        const val = (emo as unknown as Record<string, number>)[`${e.key}_mean`];
        if (typeof val === "number") {
          buckets[year][e.key] += val;
        }
      }
      buckets[year].count++;
    }

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, b]) => {
        const row: Record<string, number | string> = { year, count: b.count };
        for (const e of EMOTIONS) {
          row[e.key] = b.count > 0 ? b[e.key] / b.count : 0;
        }
        return row as unknown as YearBucket;
      });
  }, [emotions, psycho]);

  if (yearData.length < 2) {
    return (
      <div className="text-center text-faded font-ui text-xs py-4">
        Ikke nok data til at vise følelseskurver.
      </div>
    );
  }

  const width = 600;
  const height = 260;
  const pad = { top: 24, right: 20, bottom: 40, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  // Compute global min/max across visible emotions
  const allVals = yearData.flatMap((d) =>
    visibleEmotions.map((e) => d[e.key])
  );
  const yMin = Math.min(...allVals);
  const yMax = Math.max(...allVals);
  const yRange = yMax - yMin || 1;

  const xScale = (i: number) => pad.left + (i / (yearData.length - 1)) * plotW;
  const yScale = (v: number) => pad.top + plotH - ((v - yMin) / yRange) * plotH;

  // War onset line
  const warIdx = yearData.findIndex((d) => d.year >= "1914");
  const warX = warIdx >= 0 ? xScale(warIdx) : null;

  const buildLine = (key: EmotionKey) =>
    yearData.map((d, i) => `${xScale(i)},${yScale(d[key])}`).join(" ");

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg text-ink">Følelsernes udvikling</h3>
        {hasExtendedData && (
          <button
            onClick={() => setShowExtended(!showExtended)}
            className="font-ui text-xs text-faded hover:text-ink transition-colors border border-faded/30 rounded px-2 py-1"
          >
            {showExtended ? "Vis færre" : "Vis alle 10 følelser"}
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
        {visibleEmotions.map((e) => (
          <span key={e.key} className="flex items-center gap-1.5 font-ui text-xs text-faded">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: e.color }}
            />
            {e.label}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Følelseskurver over tid">
        {/* Y-axis labels */}
        <text x={pad.left - 4} y={pad.top + 4} textAnchor="end" fill="#8a7a6b" fontSize="9">
          {yMax.toFixed(2)}
        </text>
        <text x={pad.left - 4} y={pad.top + plotH + 3} textAnchor="end" fill="#8a7a6b" fontSize="9">
          {yMin.toFixed(2)}
        </text>

        {/* Axes */}
        <line
          x1={pad.left}
          y1={pad.top}
          x2={pad.left}
          y2={pad.top + plotH}
          stroke="#8a7a6b"
          strokeWidth="0.5"
          opacity="0.4"
        />
        <line
          x1={pad.left}
          y1={pad.top + plotH}
          x2={pad.left + plotW}
          y2={pad.top + plotH}
          stroke="#8a7a6b"
          strokeWidth="0.5"
          opacity="0.4"
        />

        {/* War onset line */}
        {warX !== null && (
          <>
            <line
              x1={warX}
              y1={pad.top}
              x2={warX}
              y2={pad.top + plotH}
              stroke="#8B4513"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.6"
            />
            <text
              x={warX}
              y={pad.top - 8}
              textAnchor="middle"
              fill="#8B4513"
              fontSize="8"
              opacity="0.8"
            >
              Krigens udbrud
            </text>
          </>
        )}

        {/* Emotion lines */}
        {visibleEmotions.map((e) => (
          <polyline
            key={e.key}
            points={buildLine(e.key)}
            fill="none"
            stroke={e.color}
            strokeWidth="2"
            opacity="0.85"
          />
        ))}

        {/* Data points */}
        {visibleEmotions.map((e) =>
          yearData.map((d, i) => (
            <circle
              key={`${e.key}-${d.year}`}
              cx={xScale(i)}
              cy={yScale(d[e.key])}
              r="3"
              fill={e.color}
              stroke="white"
              strokeWidth="0.8"
            />
          ))
        )}

        {/* X-axis year labels */}
        {yearData.map((d, i) => (
          <text
            key={d.year}
            x={xScale(i)}
            y={pad.top + plotH + 16}
            textAnchor="middle"
            fill="#8a7a6b"
            fontSize="9"
          >
            {d.year}
          </text>
        ))}
      </svg>

      <p className="font-ui text-xs text-faded mt-2">
        Gennemsnitlige følelsesscorer pr. år beregnet fra sætningsanalyse af alle breve. Højere værdi = stærkere tilstedeværelse af følelsen.
        {showExtended && " De seks udvidede følelser (vrede, taknemmelighed, stolthed, anger, lettelse, længsel) er baseret på GoEmotions-datasættet."}
      </p>
    </div>
  );
}
