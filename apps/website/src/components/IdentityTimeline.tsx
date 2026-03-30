"use client";

import { useMemo } from "react";
import type {
  IdentityScoresMap,
  PsycholinguisticsMap,
} from "@/types/psycholinguistics";

interface IdentityTimelineProps {
  identity: IdentityScoresMap;
  psycho: PsycholinguisticsMap;
}

interface YearBucket {
  year: string;
  mean: number;
  p10: number;
  p90: number;
  count: number;
}

export default function IdentityTimeline({ identity, psycho }: IdentityTimelineProps) {
  const yearData = useMemo(() => {
    const buckets: Record<string, { means: number[]; p10s: number[]; p90s: number[] }> = {};

    for (const [letterId, id] of Object.entries(identity)) {
      const psych = psycho[letterId];
      if (!psych) continue;
      const year = psych.date.slice(0, 4);

      if (!buckets[year]) {
        buckets[year] = { means: [], p10s: [], p90s: [] };
      }
      buckets[year].means.push(id.mean);
      buckets[year].p10s.push(id.p10);
      buckets[year].p90s.push(id.p90);
    }

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, b]): YearBucket => ({
        year,
        mean: b.means.reduce((s, v) => s + v, 0) / b.means.length,
        p10: b.p10s.reduce((s, v) => s + v, 0) / b.p10s.length,
        p90: b.p90s.reduce((s, v) => s + v, 0) / b.p90s.length,
        count: b.means.length,
      }));
  }, [identity, psycho]);

  if (yearData.length < 2) {
    return (
      <div className="text-center text-faded font-ui text-xs py-4">
        Ikke nok data til at vise identitetskurve.
      </div>
    );
  }

  const width = 600;
  const height = 260;
  const pad = { top: 24, right: 20, bottom: 40, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  // Y-axis: include confidence band
  const allVals = yearData.flatMap((d) => [d.p10, d.p90, d.mean]);
  const yMin = Math.min(...allVals);
  const yMax = Math.max(...allVals);
  const yRange = yMax - yMin || 1;

  const xScale = (i: number) => pad.left + (i / (yearData.length - 1)) * plotW;
  const yScale = (v: number) => pad.top + plotH - ((v - yMin) / yRange) * plotH;

  // War onset line
  const warIdx = yearData.findIndex((d) => d.year >= "1914");
  const warX = warIdx >= 0 ? xScale(warIdx) : null;

  // Zero line (if visible)
  const zeroY = yMin <= 0 && yMax >= 0 ? yScale(0) : null;

  // Confidence band polygon (p10 forward, p90 backward)
  const bandPoints = [
    ...yearData.map((d, i) => `${xScale(i)},${yScale(d.p90)}`),
    ...yearData.map((d, i) => `${xScale(yearData.length - 1 - i)},${yScale(yearData[yearData.length - 1 - i].p10)}`),
  ].join(" ");

  // Mean line
  const meanLine = yearData.map((d, i) => `${xScale(i)},${yScale(d.mean)}`).join(" ");

  // Colors: Danish = warm brown, German = muted green (from ADR-037 color system)
  const danishColor = "#8B6F47";
  const germanColor = "#5B7B6A";

  return (
    <div>
      <h3 className="font-display text-lg text-ink mb-1">Sproglig identitet over tid</h3>
      <p className="font-ui text-xs text-faded mb-3">
        Positiv = dansk register (hjemstavnsfølelse, danske kammerater). Negativ = tysk militært register (hierarki, ordrer, udmærkelser).
      </p>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-3">
        <span className="flex items-center gap-1.5 font-ui text-xs text-faded">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: danishColor }} />
          Dansk register
        </span>
        <span className="flex items-center gap-1.5 font-ui text-xs text-faded">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: germanColor }} />
          Tysk militært register
        </span>
        <span className="flex items-center gap-1.5 font-ui text-xs text-faded">
          <span className="inline-block w-3 h-2 rounded opacity-30" style={{ backgroundColor: danishColor }} />
          Spredning (p10-p90)
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Identitetskurve over tid">
        {/* Y-axis labels */}
        <text x={pad.left - 4} y={pad.top + 4} textAnchor="end" fill="#8a7a6b" fontSize="9">
          {yMax.toFixed(2)}
        </text>
        <text x={pad.left - 4} y={pad.top + plotH + 3} textAnchor="end" fill="#8a7a6b" fontSize="9">
          {yMin.toFixed(2)}
        </text>

        {/* Y-axis pole labels */}
        <text x={pad.left - 4} y={pad.top + 16} textAnchor="end" fill={danishColor} fontSize="8" opacity="0.7">
          Dansk
        </text>
        <text x={pad.left - 4} y={pad.top + plotH - 8} textAnchor="end" fill={germanColor} fontSize="8" opacity="0.7">
          Tysk
        </text>

        {/* Axes */}
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH} stroke="#8a7a6b" strokeWidth="0.5" opacity="0.4" />
        <line x1={pad.left} y1={pad.top + plotH} x2={pad.left + plotW} y2={pad.top + plotH} stroke="#8a7a6b" strokeWidth="0.5" opacity="0.4" />

        {/* Zero line */}
        {zeroY !== null && (
          <line x1={pad.left} y1={zeroY} x2={pad.left + plotW} y2={zeroY} stroke="#8a7a6b" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.3" />
        )}

        {/* War onset line */}
        {warX !== null && (
          <>
            <line x1={warX} y1={pad.top} x2={warX} y2={pad.top + plotH} stroke="#8B4513" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
            <text x={warX} y={pad.top - 8} textAnchor="middle" fill="#8B4513" fontSize="8" opacity="0.8">
              Krigens udbrud
            </text>
          </>
        )}

        {/* Confidence band */}
        <polygon points={bandPoints} fill={danishColor} opacity="0.12" />

        {/* Mean line — colored by sign */}
        {yearData.map((d, i) => {
          if (i === 0) return null;
          const prev = yearData[i - 1];
          const avgVal = (d.mean + prev.mean) / 2;
          const color = avgVal >= 0 ? danishColor : germanColor;
          return (
            <line
              key={`seg-${d.year}`}
              x1={xScale(i - 1)}
              y1={yScale(prev.mean)}
              x2={xScale(i)}
              y2={yScale(d.mean)}
              stroke={color}
              strokeWidth="2.5"
              opacity="0.85"
            />
          );
        })}

        {/* Data points */}
        {yearData.map((d, i) => (
          <circle
            key={d.year}
            cx={xScale(i)}
            cy={yScale(d.mean)}
            r="4"
            fill={d.mean >= 0 ? danishColor : germanColor}
            stroke="white"
            strokeWidth="1"
          />
        ))}

        {/* X-axis year labels */}
        {yearData.map((d, i) => (
          <text key={d.year} x={xScale(i)} y={pad.top + plotH + 16} textAnchor="middle" fill="#8a7a6b" fontSize="9">
            {d.year}
          </text>
        ))}
      </svg>

      <p className="font-ui text-xs text-faded mt-2">
        Baseret på sætningsanalyse med et korpusspecifikt begrebsvektor. Vektoren måler sprogligt register (ordvalg og framing), ikke overbevisning.
        Positive scorer indikerer dansk framing (hjemstavn, danskere, dansk kultur). Negative scorer indikerer tysk militært register (rang, ordrer, udmærkelser).
      </p>
    </div>
  );
}
