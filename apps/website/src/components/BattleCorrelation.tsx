"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { BattleEntry } from "@/lib/timeline-renderer";

interface Props {
  battles: BattleEntry[];
}

/* ------------------------------------------------------------------ */
/*  SVG bar chart of sentiment impact per battle                       */
/* ------------------------------------------------------------------ */

function SentimentImpactChart({ battles }: { battles: BattleEntry[] }) {
  const data = useMemo(
    () =>
      battles
        .filter((b) => b.sentimentDelta !== null)
        .sort(
          (a, b) =>
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        ),
    [battles]
  );

  if (data.length === 0) return null;

  const maxAbs = Math.max(1, ...data.map((b) => Math.abs(b.sentimentDelta!)));
  const barWidth = 36;
  const gap = 8;
  const chartWidth = data.length * (barWidth + gap) + 80;
  const chartHeight = 260;
  const midY = chartHeight / 2;
  const barMax = midY - 40;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full"
        style={{ minWidth: Math.min(chartWidth, 600), maxHeight: 300 }}
      >
        {/* Zero line */}
        <line
          x1={40}
          y1={midY}
          x2={chartWidth - 20}
          y2={midY}
          stroke="#9C8F80"
          strokeWidth={1}
          strokeDasharray="4,4"
        />
        <text
          x={36}
          y={midY + 4}
          textAnchor="end"
          fill="#7D7469"
          fontSize={10}
          fontFamily="IBM Plex Sans, sans-serif"
        >
          0
        </text>

        {/* Bars */}
        {data.map((battle, i) => {
          const delta = battle.sentimentDelta!;
          const barH = (Math.abs(delta) / maxAbs) * barMax;
          const x = 50 + i * (barWidth + gap);
          const y = delta >= 0 ? midY - barH : midY;
          const color = delta >= 0 ? "#5B8C5A" : "#A63535";

          return (
            <g key={battle.name}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                fill={color}
                opacity={0.75}
                rx={2}
              />
              {/* Delta value on bar */}
              <text
                x={x + barWidth / 2}
                y={delta >= 0 ? y - 4 : y + barH + 12}
                textAnchor="middle"
                fill={color}
                fontSize={10}
                fontWeight="bold"
                fontFamily="IBM Plex Sans, sans-serif"
              >
                {delta > 0 ? "+" : ""}
                {delta.toFixed(1)}
              </text>
              {/* Battle name (rotated) */}
              <text
                x={x + barWidth / 2}
                y={chartHeight - 4}
                textAnchor="end"
                fill="#7D7469"
                fontSize={9}
                fontFamily="IBM Plex Sans, sans-serif"
                transform={`rotate(-45 ${x + barWidth / 2} ${chartHeight - 4})`}
              >
                {battle.name.length > 22
                  ? battle.name.substring(0, 20) + "\u2026"
                  : battle.name}
              </text>
            </g>
          );
        })}

        {/* Y axis labels */}
        <text
          x={36}
          y={midY - barMax + 4}
          textAnchor="end"
          fill="#7D7469"
          fontSize={9}
          fontFamily="IBM Plex Sans, sans-serif"
        >
          +{maxAbs.toFixed(0)}
        </text>
        <text
          x={36}
          y={midY + barMax + 4}
          textAnchor="end"
          fill="#7D7469"
          fontSize={9}
          fontFamily="IBM Plex Sans, sans-serif"
        >
          -{maxAbs.toFixed(0)}
        </text>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function BattleCorrelation({ battles }: Props) {
  // Find the 3 battles with the most negative sentiment delta
  const worstBattles = useMemo(
    () =>
      [...battles]
        .filter((b) => b.sentimentDelta !== null)
        .sort((a, b) => (a.sentimentDelta ?? 0) - (b.sentimentDelta ?? 0))
        .slice(0, 3),
    [battles]
  );

  // Battles that have nearbyLetterIds
  const battlesWithNearbyLetters = useMemo(
    () => battles.filter((b) => b.nearbyLetterIds.length > 0),
    [battles]
  );

  const findingSentence = useMemo(() => {
    if (worstBattles.length === 0) return null;
    const names = worstBattles
      .map(
        (b) =>
          `${b.name} (${(b.sentimentDelta ?? 0) > 0 ? "+" : ""}${(b.sentimentDelta ?? 0).toFixed(1)})`
      )
      .join(", ");
    return `De blodigste slag \u2014 ${names} \u2014 korrelerer med markante fald i brevenes stemning i ugerne efter.`;
  }, [worstBattles]);

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-ink mb-2">
        Krigens indvirkning p&aring; brevenes stemning
      </h2>
      <p className="text-faded font-ui text-sm mb-6">
        Stemnings&aelig;ndring i breve f&oslash;r og efter hvert slag. Negative
        v&aelig;rdier viser fald i stemning.
      </p>

      <div className="bg-parchment-light border border-faded/20 rounded-lg p-4 shadow-sm mb-6">
        <SentimentImpactChart battles={battles} />
      </div>

      {/* Key findings */}
      {findingSentence && (
        <div className="bg-parchment-light border-l-4 border-wax-red rounded-r-lg p-4 mb-6">
          <p className="font-body text-sm text-ink leading-relaxed">
            {findingSentence}
          </p>
        </div>
      )}

      {/* Nearby letters per battle */}
      {battlesWithNearbyLetters.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-display text-lg text-ink">
            Breve skrevet n&aelig;r slagmarkerne
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {battlesWithNearbyLetters.map((battle) => (
              <div
                key={battle.name}
                className="bg-parchment-light border border-faded/20 rounded-lg p-3"
              >
                <p className="font-ui text-sm font-medium text-ink mb-1">
                  {battle.name}
                </p>
                <p className="text-faded text-xs font-ui mb-2">
                  {battle.nearbyLetterIds.length} breve skrevet fra
                  n&aelig;rliggende steder
                </p>
                <div className="flex flex-wrap gap-1">
                  {battle.nearbyLetterIds.slice(0, 8).map((id) => (
                    <Link
                      key={id}
                      href={`/letters/${id}/`}
                      className="inline-block text-xs font-ui text-wax-red hover:text-wax-red-dark underline"
                    >
                      #{id}
                    </Link>
                  ))}
                  {battle.nearbyLetterIds.length > 8 && (
                    <span className="text-xs font-ui text-faded">
                      +{battle.nearbyLetterIds.length - 8} flere
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
