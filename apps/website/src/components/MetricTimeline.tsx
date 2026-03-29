"use client";

interface MetricTimelineProps {
  data: { year: string; mean: number; count: number }[];
  label: string;
  description: string;
  warOnsetYear?: string;
  color?: string;
  warColor?: string;
}

export default function MetricTimeline({
  data,
  label,
  description,
  warOnsetYear = "1914",
  color = "#4A3728",
  warColor = "#8B4513",
}: MetricTimelineProps) {
  if (data.length < 2) {
    return (
      <div className="text-center text-faded font-ui text-xs py-4">
        Ikke nok data til at vise tidslinje.
      </div>
    );
  }

  const width = 320;
  const height = 180;
  const pad = { top: 20, right: 20, bottom: 36, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const values = data.map((d) => d.mean);
  const yMin = Math.min(...values);
  const yMax = Math.max(...values);
  const yRange = yMax - yMin || 1;

  const xScale = (i: number) => pad.left + (i / (data.length - 1)) * plotW;
  const yScale = (v: number) => pad.top + plotH - ((v - yMin) / yRange) * plotH;

  // Build polyline points
  const points = data.map((d, i) => `${xScale(i)},${yScale(d.mean)}`).join(" ");

  // War onset vertical line
  const warIdx = data.findIndex((d) => d.year >= warOnsetYear);
  const warX = warIdx >= 0 ? xScale(warIdx) : null;

  // Format y-axis labels
  const formatY = (v: number) => {
    if (v >= 1) return v.toFixed(1);
    return v.toFixed(3);
  };

  return (
    <div>
      <h4 className="font-ui text-sm font-medium text-ink mb-1">{label}</h4>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={label}>
        {/* Y-axis labels */}
        <text x={pad.left - 4} y={pad.top + 4} textAnchor="end" fill="#8a7a6b" fontSize="8">
          {formatY(yMax)}
        </text>
        <text x={pad.left - 4} y={pad.top + plotH + 3} textAnchor="end" fill="#8a7a6b" fontSize="8">
          {formatY(yMin)}
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
              stroke={warColor}
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.6"
            />
            <text
              x={warX}
              y={pad.top - 6}
              textAnchor="middle"
              fill={warColor}
              fontSize="7"
              opacity="0.8"
            >
              Krigens udbrud
            </text>
          </>
        )}

        {/* Data line */}
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" opacity="0.8" />

        {/* Data points */}
        {data.map((d, i) => {
          const isWar = d.year >= warOnsetYear;
          return (
            <circle
              key={d.year}
              cx={xScale(i)}
              cy={yScale(d.mean)}
              r="3.5"
              fill={isWar ? warColor : color}
              stroke="white"
              strokeWidth="1"
            />
          );
        })}

        {/* X-axis year labels */}
        {data.map((d, i) => (
          <text
            key={d.year}
            x={xScale(i)}
            y={pad.top + plotH + 14}
            textAnchor="middle"
            fill="#8a7a6b"
            fontSize="8"
          >
            {d.year}
          </text>
        ))}
      </svg>
      <p className="font-ui text-xs text-faded mt-1">{description}</p>
    </div>
  );
}
