"use client";

import { useMemo } from "react";
import type { QuarterlyDivergence } from "@/types/psycholinguistics";

interface DivergenceTimelineProps {
  data: QuarterlyDivergence[];
}

const WAR_QUARTER = "1914-Q3";

export default function DivergenceTimeline({ data }: DivergenceTimelineProps) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => a.quarter.localeCompare(b.quarter)),
    [data]
  );

  if (sorted.length < 2) return null;

  const width = 700;
  const height = 300;
  const pad = { top: 24, right: 32, bottom: 56, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const jsdValues = sorted.map((d) => d.jsd_words);
  const yMin = 0;
  const yMax = Math.max(0.5, ...jsdValues) * 1.1;

  const x = (i: number) => pad.left + (i / (sorted.length - 1)) * plotW;
  const y = (v: number) => pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const polyline = sorted.map((d, i) => `${x(i)},${y(d.jsd_words)}`).join(" ");

  const warIdx = sorted.findIndex((d) => d.quarter >= WAR_QUARTER);
  const warX = warIdx >= 0 ? x(warIdx) : null;

  // Y-axis ticks
  const yTicks = [0, 0.1, 0.2, 0.3, 0.4, 0.5].filter((t) => t <= yMax);

  // X-axis labels: show every 4th quarter
  const xLabels = sorted
    .map((d, i) => ({ label: d.quarter, cx: x(i) }))
    .filter((_, i) => i % 4 === 0);

  // Circle sizes based on letter count
  const counts = sorted.map((d) => d.trine_count + d.parent_count);
  const maxCount = Math.max(...counts, 1);
  const circleR = (count: number) => 3 + (count / maxCount) * 4;

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg text-ink">
        Sproglig divergens over tid
      </h3>
      <p className="font-ui text-sm text-faded">
        Jensen-Shannon-divergens måler hvor forskellige ordvalgene er mellem
        brevene til de to modtagere. Højere = mere forskelligt.
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Divergenstidslinje: JSD mellem Trine- og forældrebreve per kvartal"
      >
        {/* Y-axis gridlines and labels */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              y1={y(tick)}
              x2={pad.left + plotW}
              y2={y(tick)}
              stroke="currentColor"
              className="text-faded/20"
              strokeWidth={0.5}
            />
            <text
              x={pad.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-faded font-ui"
              fontSize={10}
            >
              {tick.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Y-axis label */}
        <text
          x={14}
          y={pad.top + plotH / 2}
          textAnchor="middle"
          className="fill-faded font-ui"
          fontSize={10}
          transform={`rotate(-90, 14, ${pad.top + plotH / 2})`}
        >
          JSD
        </text>

        {/* War onset vertical line */}
        {warX !== null && (
          <g>
            <line
              x1={warX}
              y1={pad.top}
              x2={warX}
              y2={pad.top + plotH}
              stroke="currentColor"
              className="text-wax-red"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <text
              x={warX + 4}
              y={pad.top + 10}
              className="fill-wax-red font-ui"
              fontSize={10}
            >
              Krigens udbrud
            </text>
          </g>
        )}

        {/* Data line */}
        <polyline
          points={polyline}
          fill="none"
          stroke="#8B6F47"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Data points */}
        {sorted.map((d, i) => (
          <circle
            key={d.quarter}
            cx={x(i)}
            cy={y(d.jsd_words)}
            r={circleR(counts[i])}
            fill="#8B6F47"
            opacity={0.8}
          >
            <title>
              {d.quarter}: JSD {d.jsd_words.toFixed(3)} ({d.trine_count}+
              {d.parent_count} breve)
            </title>
          </circle>
        ))}

        {/* X-axis labels */}
        {xLabels.map((l) => (
          <text
            key={l.label}
            x={l.cx}
            y={pad.top + plotH + 20}
            textAnchor="middle"
            className="fill-faded font-ui"
            fontSize={9}
          >
            {l.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
