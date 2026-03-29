"use client";

import { useMemo } from "react";
import type {
  EmotionScoresMap,
  PsycholinguisticsMap,
} from "@/types/psycholinguistics";
import { isWartime } from "@/lib/psycholinguistic-utils";

interface EmotionTimelineProps {
  emotions: EmotionScoresMap;
  psycho: PsycholinguisticsMap;
}

type EmotionKey = "fear" | "grief" | "hope" | "love";

const EMOTIONS: { key: EmotionKey; label: string; color: string }[] = [
  { key: "fear", label: "Frygt", color: "#D97706" },
  { key: "grief", label: "Sorg", color: "#64748B" },
  { key: "hope", label: "Håb", color: "#059669" },
  { key: "love", label: "Kærlighed", color: "#E11D48" },
];

interface YearBucket {
  year: string;
  fear: number;
  grief: number;
  hope: number;
  love: number;
  count: number;
}

export default function EmotionTimeline({ emotions, psycho }: EmotionTimelineProps) {
  const yearData = useMemo(() => {
    const buckets: Record<string, { fear: number; grief: number; hope: number; love: number; count: number }> = {};

    for (const [letterId, emo] of Object.entries(emotions)) {
      const psych = psycho[letterId];
      if (!psych) continue;
      const year = psych.date.slice(0, 4);

      if (!buckets[year]) {
        buckets[year] = { fear: 0, grief: 0, hope: 0, love: 0, count: 0 };
      }
      buckets[year].fear += emo.fear_mean;
      buckets[year].grief += emo.grief_mean;
      buckets[year].hope += emo.hope_mean;
      buckets[year].love += emo.love_mean;
      buckets[year].count++;
    }

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, b]): YearBucket => ({
        year,
        fear: b.count > 0 ? b.fear / b.count : 0,
        grief: b.count > 0 ? b.grief / b.count : 0,
        hope: b.count > 0 ? b.hope / b.count : 0,
        love: b.count > 0 ? b.love / b.count : 0,
        count: b.count,
      }));
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

  // Compute global min/max across all emotions
  const allVals = yearData.flatMap((d) => [d.fear, d.grief, d.hope, d.love]);
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
      <h3 className="font-display text-lg text-ink mb-3">Følelsernes udvikling</h3>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-3">
        {EMOTIONS.map((e) => (
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
        {EMOTIONS.map((e) => (
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
        {EMOTIONS.map((e) =>
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
      </p>
    </div>
  );
}
