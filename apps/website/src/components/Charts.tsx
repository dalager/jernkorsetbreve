"use client";

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-parchment-light border border-faded/20 rounded-lg p-5 shadow-sm">
      <p className="text-faded text-xs font-ui uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="font-display text-2xl text-ink">{value}</p>
      {sub && <p className="text-faded text-xs font-ui mt-1">{sub}</p>}
    </div>
  );
}

export function BarChart({
  data,
  title,
  maxBarHeight = 120,
}: {
  data: { label: string; value: number }[];
  title: string;
  maxBarHeight?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div>
      <h3 className="font-display text-lg text-ink mb-3">{title}</h3>
      <div
        className="flex items-end gap-1 sm:gap-2"
        style={{ height: maxBarHeight + 30 }}
      >
        {data.map((d) => {
          const h = (d.value / max) * maxBarHeight;
          return (
            <div
              key={d.label}
              className="flex flex-col items-center flex-1 min-w-0"
            >
              <span className="text-xs font-ui text-faded mb-1">
                {d.value}
              </span>
              <div
                className="w-full rounded-t"
                style={{
                  height: h,
                  backgroundColor: "#5A4F43",
                  opacity: 0.7,
                  minWidth: 12,
                }}
              />
              <span className="text-xs font-ui text-faded mt-1 truncate w-full text-center">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MiniLineChart({
  data,
  title,
}: {
  data: { label: string; value: number }[];
  title: string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const svgWidth = 800;
  const svgHeight = 150;
  const padding = { top: 10, right: 10, bottom: 20, left: 40 };
  const plotW = svgWidth - padding.left - padding.right;
  const plotH = svgHeight - padding.top - padding.bottom;

  const points = data.map((d, i) => {
    const x =
      padding.left + (i / Math.max(data.length - 1, 1)) * plotW;
    const y = padding.top + plotH - (d.value / max) * plotH;
    return { x, y, ...d };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");

  return (
    <div>
      <h3 className="font-display text-lg text-ink mb-3">{title}</h3>
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full">
        {[0, 0.5, 1].map((frac) => {
          const val = Math.round(max * (1 - frac));
          const y = padding.top + frac * plotH;
          return (
            <g key={frac}>
              <line
                x1={padding.left}
                y1={y}
                x2={svgWidth - padding.right}
                y2={y}
                stroke="#E8E3D5"
                strokeWidth={1}
              />
              <text
                x={padding.left - 5}
                y={y + 4}
                textAnchor="end"
                fill="#7D7469"
                fontSize={10}
                fontFamily="IBM Plex Sans, sans-serif"
              >
                {val}
              </text>
            </g>
          );
        })}
        <path d={pathD} fill="none" stroke="#5A4F43" strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#5A4F43" />
        ))}
        {points
          .filter(
            (_, i) =>
              i % Math.max(1, Math.floor(points.length / 12)) === 0
          )
          .map((p) => (
            <text
              key={p.label}
              x={p.x}
              y={svgHeight - 2}
              textAnchor="middle"
              fill="#7D7469"
              fontSize={9}
              fontFamily="IBM Plex Sans, sans-serif"
            >
              {p.label}
            </text>
          ))}
      </svg>
    </div>
  );
}

export function ProgressBar({
  label,
  value,
  maxValue,
  color = "#5A4F43",
}: {
  label: string;
  value: number;
  maxValue: number;
  color?: string;
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm font-ui text-ink mb-0.5">
        <span>{label}</span>
        <span className="text-faded">{value}</span>
      </div>
      <div className="h-2 bg-parchment-dark rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
