"use client";

import type { WordShift } from "@/types/psycholinguistics";

interface WordDriftChartProps {
  word: string;
  data: WordShift;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const SVG_W = 600;
const SVG_H = 250;
const PAD = { top: 24, right: 30, bottom: 44, left: 54 };
const PLOT_W = SVG_W - PAD.left - PAD.right;
const PLOT_H = SVG_H - PAD.top - PAD.bottom;

const INK = "#4A3728";
const INK_LIGHT = "rgba(74,55,40,0.1)";
const WAR_COLOR = "#8B4513";
const GREEN = "#2D6A2E";
const RED = "#8B2323";

export default function WordDriftChart({ word, data }: WordDriftChartProps) {
  const years = Object.keys(data.by_year).sort();
  if (years.length === 0) return null;

  const stats = years.map((y) => ({ year: y, ...data.by_year[y] }));

  /* Y-axis range with padding */
  const allLow = stats.map((s) => s.mean_cvp - s.std_cvp);
  const allHigh = stats.map((s) => s.mean_cvp + s.std_cvp);
  const dataMin = Math.min(...allLow);
  const dataMax = Math.max(...allHigh);
  const rangePad = (dataMax - dataMin) * 0.15 || 0.05;
  const yMin = dataMin - rangePad;
  const yMax = dataMax + rangePad;

  /* Helpers */
  const xPos = (i: number) => PAD.left + (i / Math.max(years.length - 1, 1)) * PLOT_W;
  const yPos = (v: number) => PAD.top + PLOT_H * (1 - (v - yMin) / (yMax - yMin));

  /* Build line path */
  const linePath = stats
    .map((s, i) => `${i === 0 ? "M" : "L"} ${xPos(i)} ${yPos(s.mean_cvp)}`)
    .join(" ");

  /* Build error band polygon */
  const bandTop = stats.map((s, i) => `${xPos(i)},${yPos(s.mean_cvp + s.std_cvp)}`).join(" ");
  const bandBot = [...stats]
    .reverse()
    .map((s, i) => `${xPos(stats.length - 1 - i)},${yPos(s.mean_cvp - s.std_cvp)}`)
    .join(" ");
  const bandPoints = `${bandTop} ${bandBot}`;

  /* Y-axis tick values */
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, i) => yMin + (i / (yTicks - 1)) * (yMax - yMin));

  /* War line at 1914 */
  const warIdx = years.indexOf("1914");
  const warX = warIdx >= 0 ? xPos(warIdx) : null;

  /* Point radius based on count */
  const pointR = (count: number) => Math.min(12, Math.max(3, Math.sqrt(count) * 2));

  return (
    <div>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Semantisk drift for «${word}» over tid`}
      >
        {/* Y-axis grid + labels */}
        {yTickValues.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              y1={yPos(v)}
              x2={SVG_W - PAD.right}
              y2={yPos(v)}
              stroke="rgba(125,116,105,0.15)"
              strokeDasharray="2,4"
            />
            <text
              x={PAD.left - 8}
              y={yPos(v) + 4}
              textAnchor="end"
              className="fill-faded"
              style={{ fontSize: 10, fontFamily: "IBM Plex Sans, system-ui, sans-serif" }}
            >
              {v.toFixed(3)}
            </text>
          </g>
        ))}

        {/* War vertical line */}
        {warX !== null && (
          <g>
            <line
              x1={warX}
              y1={PAD.top}
              x2={warX}
              y2={PAD.top + PLOT_H}
              stroke={WAR_COLOR}
              strokeDasharray="4,3"
              strokeWidth={1}
              opacity={0.6}
            />
            <text
              x={warX}
              y={PAD.top - 6}
              textAnchor="middle"
              fill={WAR_COLOR}
              style={{ fontSize: 10, fontFamily: "IBM Plex Sans, system-ui, sans-serif" }}
            >
              Krigens udbrud
            </text>
          </g>
        )}

        {/* Error band */}
        <polygon points={bandPoints} fill={INK_LIGHT} />

        {/* Main line */}
        <path d={linePath} fill="none" stroke={INK} strokeWidth={2} />

        {/* Drift arrows between consecutive years */}
        {data.drift.map((step, i) => {
          const fromIdx = years.indexOf(step.from);
          const toIdx = years.indexOf(step.to);
          if (fromIdx < 0 || toIdx < 0) return null;

          const fromY = yPos(stats[fromIdx].mean_cvp);
          const toY = yPos(stats[toIdx].mean_cvp);
          const midX = (xPos(fromIdx) + xPos(toIdx)) / 2;
          const midY = (fromY + toY) / 2;
          const color = step.delta_mean >= 0 ? GREEN : RED;
          const arrowDir = step.delta_mean >= 0 ? -6 : 6; // up or down

          return (
            <g key={`arrow-${i}`} opacity={0.7}>
              <line
                x1={midX}
                y1={midY + 6}
                x2={midX}
                y2={midY - 6}
                stroke={color}
                strokeWidth={1.5}
              />
              <polygon
                points={`${midX},${midY + arrowDir} ${midX - 3},${midY} ${midX + 3},${midY}`}
                fill={color}
              />
            </g>
          );
        })}

        {/* Data points */}
        {stats.map((s, i) => {
          const isWar = parseInt(s.year) >= 1914;
          return (
            <circle
              key={s.year}
              cx={xPos(i)}
              cy={yPos(s.mean_cvp)}
              r={pointR(s.count)}
              fill={isWar ? WAR_COLOR : INK}
              opacity={0.85}
            />
          );
        })}

        {/* X-axis year labels */}
        {stats.map((s, i) => (
          <text
            key={s.year}
            x={xPos(i)}
            y={PAD.top + PLOT_H + 18}
            textAnchor="middle"
            className="fill-ink"
            style={{ fontSize: 11, fontFamily: "IBM Plex Sans, system-ui, sans-serif" }}
          >
            {s.year}
          </text>
        ))}

        {/* Axis lines */}
        <line
          x1={PAD.left}
          y1={PAD.top + PLOT_H}
          x2={SVG_W - PAD.right}
          y2={PAD.top + PLOT_H}
          stroke="rgba(125,116,105,0.3)"
          strokeWidth={1}
        />
        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={PAD.top + PLOT_H}
          stroke="rgba(125,116,105,0.3)"
          strokeWidth={1}
        />

        {/* Y-axis label */}
        <text
          x={14}
          y={PAD.top + PLOT_H / 2}
          textAnchor="middle"
          transform={`rotate(-90, 14, ${PAD.top + PLOT_H / 2})`}
          className="fill-faded"
          style={{ fontSize: 10, fontFamily: "IBM Plex Sans, system-ui, sans-serif" }}
        >
          CVP score
        </text>
      </svg>

      {/* Occurrence summary below chart */}
      <div className="mt-3 font-ui text-xs text-faded">
        <span className="font-medium text-ink">Forekomster: {data.total_occurrences}</span>
        <span className="ml-3">
          {stats.map((s) => `${s.year}: ${s.count}`).join(" · ")}
        </span>
      </div>
    </div>
  );
}
