"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";

interface Letter {
  id: number;
  date: string;
  sender: string;
  recipient: string;
  place: string;
}

interface HistoricalEvent {
  date: string;
  label: string;
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00");
}

function getSentimentColor(score: number): string {
  if (score > 10) return "#5B8C5A";
  if (score < -5) return "#A63535";
  return "#9C8F80";
}

function getSentimentLabel(score: number): string {
  if (score > 10) return "positiv";
  if (score < -5) return "negativ";
  return "neutral";
}

interface TimelineSVGProps {
  letters: Letter[];
  sentiments: Record<string, number>;
  yearRange: [number, number];
  events: HistoricalEvent[];
  monthlyDensity: Map<string, number>;
  allMonths: string[];
  maxDensity: number;
}

export default function TimelineSVG({
  letters,
  sentiments,
  yearRange,
  events,
  monthlyDensity,
  allMonths,
  maxDensity,
}: TimelineSVGProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredLetter, setHoveredLetter] = useState<Letter | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const margin = { top: 40, right: 30, bottom: 20, left: 30 };
  const width = 1000;
  const timelineHeight = 200;
  const densityHeight = 100;
  const totalHeight = timelineHeight + densityHeight + margin.top + margin.bottom + 60;

  const startDate = parseDate(`${yearRange[0]}-01-01`);
  const endDate = parseDate(`${yearRange[1]}-12-31`);
  const dateRange = endDate.getTime() - startDate.getTime();

  const xScale = useCallback(
    (dateStr: string) => {
      const d = parseDate(dateStr);
      const ratio = (d.getTime() - startDate.getTime()) / dateRange;
      return margin.left + ratio * (width - margin.left - margin.right);
    },
    [startDate, dateRange, margin.left, margin.right]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent, letter: Letter) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top - 10 });
      setHoveredLetter(letter);
    },
    []
  );

  const yearTicks: number[] = [];
  for (let y = yearRange[0]; y <= yearRange[1]; y++) yearTicks.push(y);

  const filteredEvents = events.filter((evt) => {
    const year = parseInt(evt.date.substring(0, 4));
    return year >= yearRange[0] && year <= yearRange[1];
  });

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${totalHeight}`}
      className="w-full"
      style={{ minWidth: 600 }}
    >
      {/* Year grid lines and labels */}
      {yearTicks.map((y) => {
        const x = xScale(`${y}-01-01`);
        return (
          <g key={y}>
            <line x1={x} y1={margin.top} x2={x} y2={margin.top + timelineHeight} stroke="#E8E3D5" strokeWidth={1} />
            <text x={x} y={margin.top - 8} textAnchor="middle" fill="#7D7469" fontSize={12} fontFamily="IBM Plex Sans, sans-serif">{y}</text>
          </g>
        );
      })}

      {/* Timeline axis */}
      <line x1={margin.left} y1={margin.top + timelineHeight / 2} x2={width - margin.right} y2={margin.top + timelineHeight / 2} stroke="#E8E3D5" strokeWidth={2} />

      {/* Historical events */}
      {filteredEvents.map((evt, i) => {
        const x = xScale(evt.date);
        const yOff = i % 2 === 0 ? -40 : 40;
        const midY = margin.top + timelineHeight / 2;
        return (
          <g key={evt.date}>
            <line x1={x} y1={midY - 8} x2={x} y2={midY + 8} stroke="#8B2323" strokeWidth={2} />
            <line x1={x} y1={midY + (yOff > 0 ? 8 : yOff)} x2={x} y2={midY + yOff} stroke="#8B2323" strokeWidth={1} strokeDasharray="2,2" />
            <text x={x} y={midY + yOff + (yOff > 0 ? 14 : -4)} textAnchor="middle" fill="#8B2323" fontSize={9} fontFamily="IBM Plex Sans, sans-serif" fontWeight={500}>{evt.label}</text>
          </g>
        );
      })}

      {/* Letter dots */}
      {letters.map((letter, idx) => {
        const x = xScale(letter.date);
        const score = sentiments[String(letter.id)] ?? 0;
        const jitterY = ((letter.id * 17 + idx * 7) % 60) - 30;
        const cy = margin.top + timelineHeight / 2 + jitterY;
        return (
          <Link key={letter.id} href={`/letters/${letter.id}/`}>
            <circle
              cx={x} cy={cy} r={4}
              fill={getSentimentColor(score)}
              opacity={0.7}
              stroke={hoveredLetter?.id === letter.id ? "#3D3229" : "transparent"}
              strokeWidth={hoveredLetter?.id === letter.id ? 2 : 0}
              className="cursor-pointer transition-opacity hover:opacity-100"
              onMouseMove={(e) => handleMouseMove(e, letter)}
              onMouseLeave={() => setHoveredLetter(null)}
            />
          </Link>
        );
      })}

      {/* Monthly density bars */}
      <text x={margin.left} y={margin.top + timelineHeight + 24} fill="#7D7469" fontSize={11} fontFamily="IBM Plex Sans, sans-serif">
        Breve pr. m&aring;ned
      </text>
      {allMonths.map((month) => {
        const count = monthlyDensity.get(month) || 0;
        const x = xScale(`${month}-15`);
        const barH = (count / maxDensity) * (densityHeight - 20);
        const barY = margin.top + timelineHeight + 30 + (densityHeight - 20 - barH);
        const barW = Math.max(2, ((width - margin.left - margin.right) / allMonths.length) * 0.7);
        return (
          <g key={month}>
            <rect x={x - barW / 2} y={barY} width={barW} height={barH} fill="#5A4F43" opacity={0.5} rx={1} />
            {count > 0 && barH > 14 && (
              <text x={x} y={barY + barH - 3} textAnchor="middle" fill="#FFFEF8" fontSize={8} fontFamily="IBM Plex Sans, sans-serif">{count}</text>
            )}
          </g>
        );
      })}

      {/* Tooltip */}
      {hoveredLetter && (
        <foreignObject
          x={Math.min(tooltipPos.x - 100, width - 220)}
          y={Math.max(tooltipPos.y - 70, 0)}
          width={220} height={80}
        >
          <div className="bg-ink text-parchment-light text-xs rounded px-3 py-2 shadow-lg font-ui pointer-events-none">
            <p className="font-medium mb-1">
              {new Date(hoveredLetter.date + "T00:00:00").toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            <p>Fra: {hoveredLetter.sender} &rarr; {hoveredLetter.recipient}</p>
            <p>Stemning: {getSentimentLabel(sentiments[String(hoveredLetter.id)] ?? 0)} ({sentiments[String(hoveredLetter.id)] ?? 0})</p>
          </div>
        </foreignObject>
      )}
    </svg>
  );
}
