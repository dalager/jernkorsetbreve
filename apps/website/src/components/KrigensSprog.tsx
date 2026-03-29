"use client";

import { useMemo } from "react";
import Link from "next/link";
import type {
  PsycholinguisticsMap,
  EmotionScoresMap,
  IdentityScoresMap,
} from "@/types/psycholinguistics";
import {
  periodMeans,
  periodChangePercent,
  reassuranceRatio,
  metricByYear,
  formatChangePercent,
  formatNum,
  formatPercent,
} from "@/lib/psycholinguistic-utils";
import MetricTimeline from "@/components/MetricTimeline";
import EmotionTimeline from "@/components/EmotionTimeline";
import IdentityTimeline from "@/components/IdentityTimeline";

// ── Comparison card ────────────────────────────────────────────────

interface ComparisonCardProps {
  label: string;
  preWar: string;
  wartime: string;
  changePct: number;
}

function ComparisonCard({ label, preWar, wartime, changePct }: ComparisonCardProps) {
  const isPositive = changePct >= 0;
  return (
    <div className="p-4 rounded-lg border border-faded/20 bg-parchment/20">
      <div className="font-ui text-sm font-medium text-ink mb-2">{label}</div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="font-ui text-xs text-faded mb-0.5">Forkrig</div>
          <div className="font-display text-lg text-ink">{preWar}</div>
        </div>
        <div>
          <div className="font-ui text-xs text-faded mb-0.5">Krigstid</div>
          <div className="font-display text-lg text-ink">{wartime}</div>
        </div>
        <div>
          <div className="font-ui text-xs text-faded mb-0.5">Ændring</div>
          <div
            className={`font-display text-lg ${
              isPositive ? "text-wax-red" : "text-ink"
            }`}
          >
            <span className="inline-block mr-0.5 text-sm">
              {isPositive ? "\u2191" : "\u2193"}
            </span>
            {formatChangePercent(changePct)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Metric definitions ─────────────────────────────────────────────

type MetricKey = keyof PsycholinguisticsMap[string];

interface MetricDef {
  key: MetricKey;
  label: string;
  format: (v: number) => string;
}

const COMPARISON_METRICS: MetricDef[] = [
  { key: "mattr", label: "Ordrigdom (MATTR)", format: (v) => formatNum(v, 2) },
  { key: "mean_sentence_length", label: "Sætningslængde (ord)", format: (v) => formatNum(v, 1) },
  { key: "first_person_singular_rate", label: "Brug af \u00ABjeg\u00BB", format: (v) => formatPercent(v) },
  { key: "first_person_plural_rate", label: "Brug af \u00ABvi\u00BB", format: (v) => formatPercent(v) },
  { key: "hedging_rate", label: "Tøven (usikkerhedsmarkører)", format: (v) => formatPercent(v) },
  { key: "absolutist_rate", label: "Absolut sprog", format: (v) => formatPercent(v) },
];

const TIMELINE_METRICS: {
  key: MetricKey;
  label: string;
  description: string;
}[] = [
  {
    key: "mattr",
    label: "Ordrigdom (MATTR)",
    description:
      "Højere = mere varieret ordforråd. Ordrigdommen falder markant under krigens pres.",
  },
  {
    key: "mean_sentence_length",
    label: "Sætningslængde",
    description:
      "Kortere sætninger signalerer kognitivt pres og tidsnød.",
  },
  {
    key: "first_person_singular_rate",
    label: "Brug af \u00ABjeg\u00BB",
    description:
      "Falder når identiteten absorberes i det militære kollektiv.",
  },
  {
    key: "absolutist_rate",
    label: "Absolut sprog",
    description:
      "Ord som \u00ABaltid\u00BB, \u00ABaldrig\u00BB, \u00ABhelt\u00BB stiger under psykisk belastning.",
  },
  {
    key: "german_density",
    label: "Tyske ord",
    description:
      "Kodeveksling til tysk stiger med daglig kontakt i militærlivet.",
  },
];

// ── Main component ─────────────────────────────────────────────────

interface KrigensSprogProps {
  psycho: PsycholinguisticsMap;
  emotions: EmotionScoresMap;
  identity?: IdentityScoresMap | null;
}

export default function KrigensSprog({ psycho, emotions, identity }: KrigensSprogProps) {
  // Pre-war vs wartime comparison data
  const comparisonCards = useMemo(() => {
    const cards = COMPARISON_METRICS.map((m) => {
      const { preWar, wartime } = periodMeans(psycho, m.key);
      const changePct = periodChangePercent(psycho, m.key);
      return {
        label: m.label,
        preWar: m.format(preWar.mean),
        wartime: m.format(wartime.mean),
        changePct,
      };
    });

    // Reassurance (special handling — count per letter, not a rate)
    const r = reassuranceRatio(psycho);
    cards.push({
      label: "Beroligelse pr. brev",
      preWar: formatNum(r.preWarPerLetter, 1),
      wartime: formatNum(r.wartimePerLetter, 1),
      changePct: r.changePercent,
    });

    // German density
    const germanStats = periodMeans(psycho, "german_density");
    const germanChange = periodChangePercent(psycho, "german_density");
    cards.push({
      label: "Tyske ord (tæthed)",
      preWar: formatPercent(germanStats.preWar.mean),
      wartime: formatPercent(germanStats.wartime.mean),
      changePct: germanChange,
    });

    return cards;
  }, [psycho]);

  // Timeline data
  const timelineData = useMemo(
    () =>
      TIMELINE_METRICS.map((m) => ({
        ...m,
        data: metricByYear(psycho, m.key),
      })),
    [psycho]
  );

  return (
    <div className="space-y-10">
      {/* Section 1: Comparison cards */}
      <section>
        <h2 className="font-display text-xl text-ink mb-1">
          Før og efter krigens udbrud
        </h2>
        <p className="font-ui text-sm text-faded mb-4">
          Sammenligning af sproglige markører før og efter august 1914.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {comparisonCards.map((card) => (
            <ComparisonCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      {/* Section 2: Metric timelines (small multiples) */}
      <section>
        <h2 className="font-display text-xl text-ink mb-1">
          Sproglige markører over tid
        </h2>
        <p className="font-ui text-sm text-faded mb-4">
          Årlige gennemsnit for fem centrale mål. Den stiplede linje markerer krigens udbrud.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {timelineData.map((m) => (
            <MetricTimeline
              key={m.key as string}
              data={m.data}
              label={m.label}
              description={m.description}
            />
          ))}
        </div>
      </section>

      {/* Section 3: Emotion trajectories */}
      <section>
        <h2 className="font-display text-xl text-ink mb-1">
          Følelsernes bane
        </h2>
        <p className="font-ui text-sm text-faded mb-4">
          Fire følelsesdimensioner målt over tid ved sætningsanalyse.
        </p>
        <div className="border border-faded/20 rounded-lg p-4 bg-parchment/10">
          <EmotionTimeline emotions={emotions} psycho={psycho} />
        </div>
      </section>

      {/* Section 4: Identity register (ADR-038) */}
      {identity && Object.keys(identity).length > 0 && (
        <section>
          <h2 className="font-display text-xl text-ink mb-1">
            Dansk eller tysk register?
          </h2>
          <p className="font-ui text-sm text-faded mb-4">
            Peters sproglige register analyseret med et korpusspecifikt begrebsvektor.
            Vektoren skelner mellem dansk framing (hjemstavn, danske kammerater) og tysk militært register (rang, ordrer, udmærkelser).
          </p>
          <div className="border border-faded/20 rounded-lg p-4 bg-parchment/10">
            <IdentityTimeline identity={identity} psycho={psycho} />
          </div>
        </section>
      )}

      {/* Cross-link */}
      <div className="border-t border-faded/20 pt-4">
        <p className="font-ui text-sm text-faded">
          Se også:{" "}
          <Link
            href="/sentiment/"
            className="text-wax-red hover:underline font-medium"
          >
            Stemning
          </Link>{" "}
          — en udforskning af den overordnede stemning i brevene.
        </p>
      </div>
    </div>
  );
}
