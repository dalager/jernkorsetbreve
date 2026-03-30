"use client";

import { Suspense, useState, useEffect } from "react";
import SprogMethodNote from "@/components/SprogMethodNote";
import SprogOverview from "@/components/SprogOverview";
import KrigensSprog from "@/components/KrigensSprog";
import FoelelserTab from "@/components/FoelelserTab";
import NationalIdentitetTab from "@/components/NationalIdentitetTab";
import ToModtagere from "@/components/ToModtagere";
import OrdenesRejse from "@/components/OrdenesRejse";
import {
  fetchPsycholinguistics,
  fetchEmotionScores,
  fetchAudienceDivergence,
  fetchNarrativeArcs,
  fetchSemanticShifts,
  fetchIdentityScores,
} from "@/lib/psycholinguistic-utils";
import type { PsycholinguisticsMap, EmotionScoresMap, AudienceDivergenceData, NarrativeArcsData, SemanticShiftsData, IdentityScoresMap } from "@/types/psycholinguistics";

type Tab = "overblik" | "krigens-sprog" | "foelelser" | "national-identitet" | "to-modtagere" | "ordenes-rejse";

export default function SproganalysePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto py-12 text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-parchment-dark rounded w-48 mx-auto mb-4" />
            <div className="h-4 bg-parchment-dark rounded w-64 mx-auto" />
          </div>
        </div>
      }
    >
      <SproganalyseInner />
    </Suspense>
  );
}

function SproganalyseInner() {
  const [tab, setTab] = useState<Tab>("overblik");
  const [psycho, setPsycho] = useState<PsycholinguisticsMap | null>(null);
  const [emotions, setEmotions] = useState<EmotionScoresMap | null>(null);
  const [divergence, setDivergence] = useState<AudienceDivergenceData | null>(null);
  const [arcs, setArcs] = useState<NarrativeArcsData | null>(null);
  const [shifts, setShifts] = useState<SemanticShiftsData | null>(null);
  const [identity, setIdentity] = useState<IdentityScoresMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [psychoData, emotionData, divData, arcData, shiftData, identityData] =
          await Promise.all([
            fetchPsycholinguistics(),
            fetchEmotionScores(),
            fetchAudienceDivergence(),
            fetchNarrativeArcs(),
            fetchSemanticShifts(),
            fetchIdentityScores(),
          ]);
        setPsycho(psychoData);
        setEmotions(emotionData);
        setDivergence(divData);
        setArcs(arcData);
        setShifts(shiftData);
        setIdentity(identityData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ukendt fejl");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center">
        <div className="animate-pulse">
          <div className="h-8 bg-parchment-dark rounded w-48 mx-auto mb-4" />
          <div className="h-4 bg-parchment-dark rounded w-64 mx-auto" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center">
        <h1 className="font-display text-3xl text-ink mb-4">Sproganalyse</h1>
        <p className="text-faded">Data er ikke tilgængelig: {error}</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "overblik", label: "Overblik" },
    { key: "krigens-sprog", label: "Krigens sprog" },
    { key: "foelelser", label: "Følelser" },
    ...(identity ? [{ key: "national-identitet" as Tab, label: "National identitet" }] : []),
    { key: "to-modtagere", label: "To modtagere" },
    { key: "ordenes-rejse", label: "Ordenes rejse" },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl text-ink mb-2">Sproganalyse</h1>
        <p className="text-faded font-ui text-sm">
          Hvordan krigen forandrede Peters sprog — ordforråd, syntaks, pronomener og betydning.
        </p>
      </div>

      {/* Method note */}
      <SprogMethodNote />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-faded/20 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-ui transition-colors border-b-2 -mb-px whitespace-nowrap ${
              tab === t.key
                ? "border-wax-red text-ink font-medium"
                : "border-transparent text-faded hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overblik" && psycho && (
        <SprogOverview psycho={psycho} onNavigateTab={(t) => setTab(t as Tab)} />
      )}

      {tab === "krigens-sprog" && psycho && (
        <KrigensSprog psycho={psycho} onNavigateTab={(t) => setTab(t as Tab)} />
      )}

      {tab === "foelelser" && psycho && emotions && (
        <FoelelserTab emotions={emotions} psycho={psycho} />
      )}

      {tab === "national-identitet" && psycho && identity && (
        <NationalIdentitetTab identity={identity} psycho={psycho} />
      )}

      {tab === "to-modtagere" && psycho && divergence && arcs && (
        <ToModtagere psycho={psycho} divergence={divergence} arcs={arcs} />
      )}

      {tab === "ordenes-rejse" && shifts && (
        <OrdenesRejse shifts={shifts} />
      )}
    </div>
  );
}
