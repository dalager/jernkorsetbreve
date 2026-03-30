"use client";

import { useMemo } from "react";
import type {
  EmotionScoresMap,
  PsycholinguisticsMap,
} from "@/types/psycholinguistics";
import MetricTimeline from "@/components/MetricTimeline";

// ── Emotion definitions ───────────────────────────────────────────

interface EmotionDef {
  key: string;
  label: string;
  color: string;
  description: string;
}

const EMOTIONS: EmotionDef[] = [
  { key: "fear", label: "Frygt", color: "#D97706", description: "Angst og nervøsitet. Stiger markant under kamphandlinger." },
  { key: "grief", label: "Sorg", color: "#64748B", description: "Sorg og tab. Stiger når kammerater falder." },
  { key: "hope", label: "Håb", color: "#059669", description: "Optimisme og fremtidstro. Svinger med krigens gang." },
  { key: "love", label: "Kærlighed", color: "#E11D48", description: "Kærlighed og omsorg. Stærkest i breve til Trine." },
  { key: "anger", label: "Vrede", color: "#DC2626", description: "Frustration og irritation over militærlivet." },
  { key: "gratitude", label: "Taknemmelighed", color: "#7C3AED", description: "Taknemmelighed for pakker, breve og Guds beskyttelse." },
  { key: "pride", label: "Stolthed", color: "#2563EB", description: "Stolthed over præstationer og kammeratskab." },
  { key: "remorse", label: "Anger", color: "#6B7280", description: "Fortrydelse og skyldfølelse over at være væk." },
  { key: "relief", label: "Lettelse", color: "#0891B2", description: "Lettelse efter overlevede kampe og gode nyheder." },
  { key: "desire", label: "Længsel", color: "#BE185D", description: "Længsel efter hjem, Trine og fred." },
];

// ── Data aggregation ──────────────────────────────────────────────

function emotionByYear(
  emotions: EmotionScoresMap,
  psycho: PsycholinguisticsMap,
  emotionKey: string
): { year: string; mean: number; count: number }[] {
  const meanKey = `${emotionKey}_mean` as keyof EmotionScoresMap[string];
  const buckets: Record<string, number[]> = {};

  for (const [letterId, scores] of Object.entries(emotions)) {
    const letterMeta = psycho[letterId];
    if (!letterMeta) continue;

    const val = scores[meanKey] as number;
    if (typeof val !== "number") continue;

    const year = letterMeta.date.slice(0, 4);
    if (!buckets[year]) buckets[year] = [];
    buckets[year].push(val);
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, vals]) => ({
      year,
      mean: vals.reduce((s, v) => s + v, 0) / vals.length,
      count: vals.length,
    }));
}

// ── Main component ────────────────────────────────────────────────

interface FoelelserTabProps {
  emotions: EmotionScoresMap;
  psycho: PsycholinguisticsMap;
}

export default function FoelelserTab({ emotions, psycho }: FoelelserTabProps) {
  const emotionData = useMemo(
    () =>
      EMOTIONS.map((e) => ({
        ...e,
        data: emotionByYear(emotions, psycho, e.key),
      })),
    [emotions, psycho]
  );

  return (
    <div className="space-y-10">
      {/* Section header */}
      <section>
        <h2 className="font-display text-xl text-ink mb-1">
          Følelser i brevene
        </h2>
        <p className="font-ui text-sm text-faded mb-4">
          Ti følelsesdimensioner målt ved sætningsanalyse med begrebsvektorer (CVP).
        </p>
      </section>

      {/* All emotions */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {emotionData.map((e) => (
            <div
              key={e.key}
              className="border border-faded/20 rounded-lg p-4 bg-parchment/10"
            >
              <MetricTimeline
                data={e.data}
                label={e.label}
                description={e.description}
                color={e.color}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Method note */}
      <section className="border-t border-faded/20 pt-4">
        <p className="font-ui text-xs text-faded">
          Følelserne er målt med Concept Vector Projection (CVP) baseret på{" "}
          GoEmotions-datasættet — et engelsk datasæt med 58.000 sætninger,
          overført til dansk via en flersproget sprogmodel. Metoden er
          eksperimentel og bør betragtes som indikativ.
        </p>
      </section>
    </div>
  );
}
