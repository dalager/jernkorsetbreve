"use client";

import { useMemo } from "react";
import type {
  PsycholinguisticsMap,
  AudienceDivergenceData,
  NarrativeArcsData,
  QuarterlyDivergence,
} from "@/types/psycholinguistics";
import { formatNum } from "@/lib/psycholinguistic-utils";
import DivergenceTimeline from "@/components/DivergenceTimeline";
import ArcDistribution from "@/components/ArcDistribution";

interface ToModtagereProps {
  psycho: PsycholinguisticsMap;
  divergence: AudienceDivergenceData;
  arcs: NarrativeArcsData;
}

// ── Metric labels ──────────────────────────────────────────────────

interface MetricRow {
  key: keyof QuarterlyDivergence["metric_divergence"];
  label: string;
}

const METRICS: MetricRow[] = [
  { key: "hedging_rate", label: "Tøven" },
  { key: "first_person_singular_rate", label: "\u00ABJeg\u00BB-brug" },
  { key: "mattr", label: "Ordrigdom" },
  { key: "mean_sentence_length", label: "Sætningslængde" },
  { key: "german_density", label: "Tyske ord" },
  { key: "reassurance_count", label: "Beroligelse" },
  { key: "sentiment_volatility", label: "Stemningsudsving" },
];

// ── Stat card ──────────────────────────────────────────────────────

function StatCard({
  number,
  label,
  detail,
}: {
  number: string;
  label: string;
  detail: string;
}) {
  return (
    <div className="p-4 rounded-lg border border-faded/20 bg-parchment/20">
      <div className="font-display text-2xl text-ink mb-1">{number}</div>
      <div className="font-ui text-sm text-ink font-medium">{label}</div>
      <div className="font-ui text-xs text-faded mt-1">{detail}</div>
    </div>
  );
}

// ── Metric divergence bar ──────────────────────────────────────────

function MetricDivergenceTable({
  data,
}: {
  data: QuarterlyDivergence[];
}) {
  const averaged = useMemo(() => {
    if (data.length === 0) return [];

    const sums: Record<string, number> = {};
    for (const m of METRICS) sums[m.key] = 0;

    for (const q of data) {
      for (const m of METRICS) {
        sums[m.key] += Math.abs(q.metric_divergence[m.key]);
      }
    }

    return METRICS.map((m) => ({
      ...m,
      value: sums[m.key] / data.length,
    })).sort((a, b) => b.value - a.value);
  }, [data]);

  const maxVal = Math.max(...averaged.map((m) => m.value), 0.001);

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg text-ink">
        Hvilke dimensioner adskiller sig mest?
      </h3>
      <p className="font-ui text-sm text-faded">
        Gennemsnitlig absolut forskel mellem Trine- og forældrebreve per
        kvartal.
      </p>
      <div className="space-y-2">
        {averaged.map((m) => {
          const pct = (m.value / maxVal) * 100;
          return (
            <div key={m.key} className="flex items-center gap-3">
              <span className="font-ui text-sm text-ink w-32 shrink-0 text-right">
                {m.label}
              </span>
              <div className="flex-1 h-5 rounded bg-parchment/30 border border-faded/10 overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: "#8B6F47",
                    opacity: 0.75,
                  }}
                />
              </div>
              <span className="font-ui text-xs text-faded w-14 text-right">
                {formatNum(m.value, 3)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────

export default function ToModtagere({
  psycho,
  divergence,
  arcs,
}: ToModtagereProps) {
  const { summary, quarterly_divergence } = divergence;

  return (
    <section className="space-y-8">
      {/* Headline */}
      <div>
        <h2 className="font-display text-xl text-ink leading-snug">
          58 gange skrev Peter to breve på samme dag — et til Trine, et til
          forældrene. De er markant forskellige.
        </h2>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          number={String(summary.trine_count)}
          label="Breve til Trine"
          detail="Peters kone"
        />
        <StatCard
          number={String(summary.parent_count)}
          label="Breve til forældrene"
          detail="Mor og far"
        />
        <StatCard
          number={String(summary.same_date_pairs)}
          label="Brevpar på samme dag"
          detail="Direkte sammenligningsgrundlag"
        />
      </div>

      {/* Divergence timeline */}
      <div className="rounded-lg border border-faded/20 bg-parchment/20 p-4">
        <DivergenceTimeline data={quarterly_divergence} />
      </div>

      {/* Metric divergence breakdown */}
      <div className="rounded-lg border border-faded/20 bg-parchment/20 p-4">
        <MetricDivergenceTable data={quarterly_divergence} />
      </div>

      {/* Arc distribution */}
      <div className="rounded-lg border border-faded/20 bg-parchment/20 p-4">
        <ArcDistribution arcs={arcs} psycho={psycho} />
      </div>
    </section>
  );
}
