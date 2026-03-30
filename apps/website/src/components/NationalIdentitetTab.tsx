"use client";

import { useState } from "react";
import type {
  IdentityScoresMap,
  PsycholinguisticsMap,
} from "@/types/psycholinguistics";
import IdentityTimeline from "@/components/IdentityTimeline";

// ── Stat card ─────────────────────────────────────────────────────────

interface StatCardProps {
  heading: string;
  body: string;
}

function StatCard({ heading, body }: StatCardProps) {
  return (
    <div className="p-4 rounded-lg border border-faded/20 bg-parchment/20">
      <div className="font-ui text-sm font-medium text-ink mb-1">
        {heading}
      </div>
      <p className="font-ui text-xs text-faded leading-relaxed">{body}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

interface NationalIdentitetTabProps {
  identity: IdentityScoresMap;
  psycho: PsycholinguisticsMap;
}

export default function NationalIdentitetTab({
  identity,
  psycho,
}: NationalIdentitetTabProps) {
  const [methodOpen, setMethodOpen] = useState(false);

  return (
    <div className="space-y-10">
      {/* Section header */}
      <section>
        <h2 className="font-display text-xl text-ink mb-1">
          National identitet
        </h2>
        <p className="font-ui text-sm text-faded mb-4">
          Dansk eller tysk? Peters sproglige register analyseret over tid.
        </p>

        {/* Introduction */}
        <p className="font-ui text-sm text-ink/80 leading-relaxed">
          Peter Mærsk var sønderjyde — dansk, men tvunget i
          tysk krigstjeneste. Hans breve afspejler denne dobbelte
          tilhørighed: dansk hjemstavn og fællesskab på den
          ene side, tysk militært hierarki og pligter på den anden.
          Ved hjælp af et korpusspecifikt begrebsvektor kan vi måle,
          hvor meget Peters sprog hælder mod det ene eller det andet
          register i hver sætning.
        </p>
      </section>

      {/* Main chart */}
      {identity && Object.keys(identity).length > 0 && (
        <section>
          <div className="border border-faded/20 rounded-lg p-4 bg-parchment/10">
            <IdentityTimeline identity={identity} psycho={psycho} />
          </div>
        </section>
      )}

      {/* Key findings */}
      <section>
        <h3 className="font-display text-lg text-ink mb-3">
          Hvad viser det?
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            heading="Grundlæggende dansk"
            body="Peters breve er grundlæggende danske dokumenter \u2014 gennemsnittet er positivt i alle krigsår."
          />
          <StatCard
            heading="Mobiliseringens effekt"
            body="Mobiliseringen i 1914 medfører et fald på ~44% i dansk register-intensitet."
          />
          <StatCard
            heading="Gradvis tilbagevenden"
            body="Fra 1917 begynder en gradvis tilbagevenden til stærkere dansk framing."
          />
        </div>
        <p className="font-ui text-xs text-faded mt-3 italic">
          Mønstre, ikke beviser — tallene viser sproglige
          tendenser, ikke politisk overbevisning.
        </p>
      </section>

      {/* What does the vector measure? */}
      <section>
        <h3 className="font-display text-lg text-ink mb-3">
          Hvad måler vektoren?
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-faded/20 bg-parchment/20">
            <div className="font-ui text-sm font-medium text-ink mb-2">
              Dansk register{" "}
              <span className="text-faded font-normal">(positiv)</span>
            </div>
            <ul className="font-ui text-xs text-faded space-y-1 list-disc list-inside">
              <li>
                Gruppe-identifikation («os danskere»)
              </li>
              <li>Hjemstavnsreferencer</li>
              <li>Dansk sprog og kultur</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg border border-faded/20 bg-parchment/20">
            <div className="font-ui text-sm font-medium text-ink mb-2">
              Tysk register{" "}
              <span className="text-faded font-normal">(negativ)</span>
            </div>
            <ul className="font-ui text-xs text-faded space-y-1 list-disc list-inside">
              <li>
                Militært hierarki (Major, Oberstleutnant)
              </li>
              <li>Udmærkelser (Jernkorset)</li>
              <li>Kommandoer og rapportering</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Method note (collapsible) */}
      <section>
        <button
          type="button"
          onClick={() => setMethodOpen(!methodOpen)}
          className="flex items-center gap-2 font-ui text-sm text-faded hover:text-ink transition-colors"
        >
          <span
            className={`inline-block transition-transform ${
              methodOpen ? "rotate-90" : ""
            }`}
          >
            &#9654;
          </span>
          Metodebeskrivelse
        </button>
        {methodOpen && (
          <p className="font-ui text-xs text-faded leading-relaxed mt-2 pl-5">
            Vektoren er trænet på udvalgte sætninger fra selve
            brevsamlingen — 45 sætninger med dansk framing og 37 med
            tysk militært register. Den måler sprogligt register
            (ordvalg og framing), ikke overbevisning. Positive scorer indikerer
            dansk register, negative scorer tysk militært register.
            Vektoren er uafhængig af stemningsanalysen
            (cosinus-similaritet: −0,02).
          </p>
        )}
      </section>
    </div>
  );
}
