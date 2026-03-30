"use client";

import { useState, useMemo } from "react";
import { StatCard } from "./Charts";
import {
  sentimentGradientColor,
  formatScore,
} from "@/lib/sentiment-utils";
import { sentimentColor } from "@/lib/timeline-utils";

import type {
  SentimentOverview as SentimentOverviewData,
  LetterSentiment,
  RollingBand,
  DistributionBin,
  NotableLetters,
} from "@/types/letters";

interface SentimentOverviewProps {
  overview: SentimentOverviewData;
  sentiments: Record<string, LetterSentiment>;
  onSelectLetter?: (id: number) => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const SVG_W = 800;
const SVG_H = 260;
const PAD = { top: 20, right: 20, bottom: 40, left: 50 };
const PLOT_W = SVG_W - PAD.left - PAD.right;
const PLOT_H = SVG_H - PAD.top - PAD.bottom;
const Y_MIN = -0.5;
const Y_MAX = 0.5;

const ANNOTATIONS: { month: string; label: string }[] = [
  { month: "1914-08", label: "Mobilisering" },
  { month: "1918-11", label: "Våbenstilstand" },
];

const NOTABLE_TABS: { key: keyof NotableLetters; label: string }[] = [
  { key: "most_negative", label: "Mest negative" },
  { key: "most_positive", label: "Mest positive" },
  { key: "widest_range", label: "Bredest spænd" },
  { key: "highest_negative_ratio", label: "Højest negativ andel" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function yPos(value: number): number {
  const clamped = clamp(value, Y_MIN, Y_MAX);
  return PAD.top + PLOT_H * (1 - (clamped - Y_MIN) / (Y_MAX - Y_MIN));
}

function xPos(index: number, total: number): number {
  if (total <= 1) return PAD.left + PLOT_W / 2;
  return PAD.left + (index / (total - 1)) * PLOT_W;
}

function shortMonth(m: string): string {
  // "1914-08" → "aug 14"
  const [y, mo] = m.split("-");
  const names = [
    "jan", "feb", "mar", "apr", "maj", "jun",
    "jul", "aug", "sep", "okt", "nov", "dec",
  ];
  return `${names[parseInt(mo, 10) - 1]} ${y.slice(2)}`;
}

/* ------------------------------------------------------------------ */
/*  Timeline Band Chart                                               */
/* ------------------------------------------------------------------ */
function TimelineBand({ rolling }: { rolling: RollingBand[] }) {
  if (rolling.length === 0) return null;
  const n = rolling.length;

  // Build band polygon (p10 forward, p90 backward)
  const bandPoints = rolling
    .map((r, i) => `${xPos(i, n)},${yPos(r.p10)}`)
    .concat(
      [...rolling].reverse().map((r, i) => `${xPos(n - 1 - i, n)},${yPos(r.p90)}`)
    )
    .join(" ");

  // Mean line
  const meanPath = rolling
    .map((r, i) => `${i === 0 ? "M" : "L"}${xPos(i, n)},${yPos(r.mean)}`)
    .join(" ");

  // Y-axis ticks
  const yTicks = [-0.4, -0.2, 0, 0.2, 0.4];

  // X-axis labels — show every ~6th month
  const step = Math.max(1, Math.floor(n / 12));
  const xLabels = rolling.filter((_, i) => i % step === 0 || i === n - 1);

  return (
    <div>
      <h3 className="font-display text-lg text-ink mb-3">
        Stemningsoversigt over tid
      </h3>
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full">
        {/* Grid lines */}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              y1={yPos(v)}
              x2={SVG_W - PAD.right}
              y2={yPos(v)}
              stroke="#E8E3D5"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={yPos(v) + 4}
              textAnchor="end"
              fill="#7D7469"
              fontSize={10}
              fontFamily="IBM Plex Sans, sans-serif"
            >
              {v === 0 ? "0" : v > 0 ? `+${v}` : v}
            </text>
          </g>
        ))}

        {/* Zero line */}
        <line
          x1={PAD.left}
          y1={yPos(0)}
          x2={SVG_W - PAD.right}
          y2={yPos(0)}
          stroke="#7D7469"
          strokeWidth={1}
          strokeDasharray="4 3"
        />

        {/* Annotation lines */}
        {ANNOTATIONS.map(({ month, label }) => {
          const idx = rolling.findIndex((r) => r.month === month);
          if (idx < 0) return null;
          const x = xPos(idx, n);
          return (
            <g key={month}>
              <line
                x1={x}
                y1={PAD.top}
                x2={x}
                y2={PAD.top + PLOT_H}
                stroke="#8B3A3A"
                strokeWidth={1}
                strokeDasharray="5 3"
              />
              <text
                x={x + 4}
                y={PAD.top + 12}
                fill="#8B3A3A"
                fontSize={9}
                fontFamily="IBM Plex Sans, sans-serif"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* P10–P90 band */}
        <polygon points={bandPoints} fill="#5A4F43" opacity={0.15} />

        {/* Mean line */}
        <path d={meanPath} fill="none" stroke="#5A4F43" strokeWidth={2} />

        {/* X-axis labels */}
        {xLabels.map((r) => {
          const idx = rolling.indexOf(r);
          return (
            <text
              key={r.month}
              x={xPos(idx, n)}
              y={SVG_H - 6}
              textAnchor="middle"
              fill="#7D7469"
              fontSize={9}
              fontFamily="IBM Plex Sans, sans-serif"
            >
              {shortMonth(r.month)}
            </text>
          );
        })}
      </svg>
      <p className="text-faded text-xs font-ui mt-1">
        Linje = gennemsnit, bånd = 10.–90. percentil pr. måned
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Distribution Chart                                                */
/* ------------------------------------------------------------------ */
function DistributionChart({ bins }: { bins: DistributionBin[] }) {
  if (bins.length === 0) return null;
  const maxCount = Math.max(...bins.map((b) => b.count), 1);

  return (
    <div>
      <h3 className="font-display text-lg text-ink mb-3">
        Fordeling på sætningsniveau
      </h3>
      <div className="space-y-1">
        {bins.map((bin) => {
          const pct = (bin.count / maxCount) * 100;
          const midScore = (bin.min + bin.max) / 2;
          const color = sentimentGradientColor(midScore);
          const label =
            bin.min < 0 && bin.max <= 0
              ? `${bin.min.toFixed(1)} til ${bin.max.toFixed(1)}`
              : bin.min >= 0
                ? `+${bin.min.toFixed(1)} til +${bin.max.toFixed(1)}`
                : `${bin.min.toFixed(1)} til +${bin.max.toFixed(1)}`;
          return (
            <div key={`${bin.min}-${bin.max}`} className="flex items-center gap-2">
              <span className="text-xs font-ui text-faded w-28 text-right shrink-0">
                {label}
              </span>
              <div className="flex-1 h-4 bg-parchment rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${Math.max(pct, 1)}%`,
                    backgroundColor: color,
                    opacity: 0.75,
                  }}
                />
              </div>
              <span className="text-xs font-ui text-faded w-10 text-right shrink-0">
                {bin.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Notable Letters                                                   */
/* ------------------------------------------------------------------ */
function NotableLettersList({
  notable,
  onSelectLetter,
}: {
  notable: NotableLetters;
  onSelectLetter?: (id: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<keyof NotableLetters>("most_negative");

  const letters = notable[activeTab] ?? [];

  return (
    <div>
      <h3 className="font-display text-lg text-ink mb-3">Breve der stikker ud</h3>
      <div className="flex flex-wrap gap-2 mb-4">
        {NOTABLE_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-3 py-1.5 rounded text-xs font-ui transition-colors ${
              activeTab === key
                ? "bg-ink text-parchment"
                : "bg-parchment-light text-faded border border-faded/20 hover:border-faded/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {letters.length === 0 ? (
        <p className="text-faded text-sm font-ui">Ingen breve i denne kategori.</p>
      ) : (
        <ul className="space-y-3">
          {letters.map((letter) => (
            <li
              key={letter.id}
              className="bg-parchment-light border border-faded/20 rounded-lg p-4 cursor-pointer hover:border-faded/40 transition-colors"
              onClick={() => onSelectLetter?.(letter.id)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-ui text-faded">
                  {letter.date} — {letter.sender} til {letter.recipient}
                </span>
                <span
                  className="text-sm font-display font-semibold"
                  style={{ color: sentimentColor(letter.score) }}
                >
                  {formatScore(letter.score)}
                </span>
              </div>
              <p className="text-sm font-body text-ink leading-relaxed line-clamp-2">
                {letter.excerpt}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */
export default function SentimentOverview({
  overview,
  sentiments,
  onSelectLetter,
}: SentimentOverviewProps) {
  const stats = useMemo(() => {
    const values = Object.values(sentiments).filter(
      (s) => s.cvp_mean !== undefined
    );
    if (values.length === 0) return null;

    const means = values.map((s) => s.cvp_mean);
    const totalMean = means.reduce((a, b) => a + b, 0) / means.length;
    const totalSentences = values.reduce(
      (a, s) => a + (s.sentence_count_substantive ?? 0),
      0
    );
    const avgNegRatio =
      values.reduce((a, s) => a + (s.negative_ratio ?? 0), 0) / values.length;

    return {
      letterCount: values.length,
      totalMean,
      totalSentences,
      avgNegRatio,
    };
  }, [sentiments]);

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Breve analyseret"
            value={stats.letterCount}
            sub={`${stats.totalSentences} sætninger i alt`}
          />
          <StatCard
            label="Gennemsnitlig score"
            value={formatScore(stats.totalMean)}
            sub="CVP-gennemsnit pr. brev"
          />
          <StatCard
            label="Negativ andel"
            value={`${Math.round(stats.avgNegRatio * 100)}%`}
            sub="Gns. andel negative sætninger"
          />
          <StatCard
            label="Måneder dækket"
            value={overview.rolling.length}
            sub={
              overview.rolling.length > 0
                ? `${shortMonth(overview.rolling[0].month)} – ${shortMonth(overview.rolling[overview.rolling.length - 1].month)}`
                : ""
            }
          />
        </div>
      )}

      {/* Timeline band chart */}
      <TimelineBand rolling={overview.rolling} />

      {/* Distribution */}
      <DistributionChart bins={overview.distribution} />

      {/* Notable letters */}
      <NotableLettersList
        notable={overview.notable}
        onSelectLetter={onSelectLetter}
      />

      {/* Cross-link to Sproganalyse (ADR-037) */}
      <div className="border border-faded/20 rounded-lg p-4 bg-parchment/20 text-center">
        <p className="font-ui text-sm text-faded mb-2">
          Udforsk også de sproglige mønstre i brevene — ordforråd, syntaks og pronomenskift.
        </p>
        <a
          href="/sproganalyse/"
          className="inline-block px-4 py-2 text-sm font-ui text-wax-red border border-wax-red/30 rounded hover:bg-wax-red/5 transition-colors"
        >
          Sproganalyse →
        </a>
      </div>
    </div>
  );
}
