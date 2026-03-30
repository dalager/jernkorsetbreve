"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import EnhancedTimeline, {
  type BattleEntry,
  type EnhancedTimelineHandle,
} from "@/components/EnhancedTimeline";
import TimelineControls from "@/components/TimelineControls";
import BattleCorrelation from "@/components/BattleCorrelation";
import type { LetterEntry } from "@/lib/timeline-utils";

export default function TimelinePage() {
  const [letters, setLetters] = useState<LetterEntry[]>([]);
  const [sentiments, setSentiments] = useState<Record<string, { cvp_mean?: number }>>({});
  const [battles, setBattles] = useState<BattleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSender, setSelectedSender] = useState("all");
  const [showSentiment, setShowSentiment] = useState(true);
  const [showBattles, setShowBattles] = useState(true);
  const [showDensity, setShowDensity] = useState(true);

  const timelineRef = useRef<EnhancedTimelineHandle>(null);

  /* ---- Fetch data ---- */

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lettersRes, sentimentsRes, battlesRes] = await Promise.all([
          fetch("/data/letter-summaries.json"),
          fetch("/data/letter-sentiments.json"),
          fetch("/data/battles.json"),
        ]);
        if (!lettersRes.ok || !sentimentsRes.ok || !battlesRes.ok) {
          throw new Error("Kunne ikke hente data");
        }
        setLetters(await lettersRes.json());
        setSentiments(await sentimentsRes.json());
        setBattles(await battlesRes.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ukendt fejl");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  /* ---- Derived ---- */

  const senders = useMemo(() => {
    const counts = new Map<string, number>();
    letters.forEach((l) =>
      counts.set(l.sender, (counts.get(l.sender) || 0) + 1)
    );
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [letters]);

  const filteredLetterCount = useMemo(() => {
    if (selectedSender === "all") return letters.length;
    return letters.filter((l) => l.sender === selectedSender).length;
  }, [letters, selectedSender]);

  /* ---- Loading / Error states ---- */

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
        <h1 className="font-display text-3xl text-ink mb-4">Tidslinje</h1>
        <p className="text-faded">
          Data er ikke tilgængelig: {error}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="font-display text-3xl text-ink mb-2">Tidslinje</h1>
        <p className="text-faded font-ui text-sm">
          {filteredLetterCount} breve — brug musehjulet til at zoome og
          træk for at panorere. Klik på et punkt for at læse
          brevet.
        </p>
      </div>

      {/* Controls */}
      <TimelineControls
        senders={senders}
        selectedSender={selectedSender}
        onSenderChange={setSelectedSender}
        showSentiment={showSentiment}
        onToggleSentiment={() => setShowSentiment((v) => !v)}
        showBattles={showBattles}
        onToggleBattles={() => setShowBattles((v) => !v)}
        showDensity={showDensity}
        onToggleDensity={() => setShowDensity((v) => !v)}
        onResetZoom={() => timelineRef.current?.resetZoom()}
      />

      {/* Canvas timeline */}
      <div className="bg-parchment-light border border-faded/20 rounded-lg p-4 shadow-sm">
        <EnhancedTimeline
          ref={timelineRef}
          letters={letters}
          sentiments={sentiments}
          battles={battles}
          showSentiment={showSentiment}
          showBattles={showBattles}
          showDensity={showDensity}
          selectedSender={selectedSender}
        />
      </div>

      {/* Summary stats */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        <div className="bg-parchment-light border border-faded/20 rounded-lg p-4">
          <p className="font-display text-2xl text-ink">{filteredLetterCount}</p>
          <p className="text-faded text-xs font-ui">Breve vist</p>
        </div>
        <div className="bg-parchment-light border border-faded/20 rounded-lg p-4">
          <p className="font-display text-2xl text-ink">{letters.length}</p>
          <p className="text-faded text-xs font-ui">Breve i alt</p>
        </div>
        <div className="bg-parchment-light border border-faded/20 rounded-lg p-4">
          <p className="font-display text-2xl text-ink">{senders.length}</p>
          <p className="text-faded text-xs font-ui">Afsendere</p>
        </div>
        <div className="bg-parchment-light border border-faded/20 rounded-lg p-4">
          <p className="font-display text-2xl text-ink">{battles.length}</p>
          <p className="text-faded text-xs font-ui">Slag registreret</p>
        </div>
      </div>

      {/* Battle correlation analysis */}
      <BattleCorrelation battles={battles} />
    </div>
  );
}
