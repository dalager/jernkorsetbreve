"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SentimentMethodNote from "@/components/SentimentMethodNote";
import SentimentOverview from "@/components/SentimentOverview";
import SentimentLetterList from "@/components/SentimentLetterList";
import SentimentLetterDetail from "@/components/SentimentLetterDetail";
import SentimentSignals from "@/components/SentimentSignals";
import { fetchSentimentOverview, fetchSentenceScores, getSentencesForLetter } from "@/lib/sentiment-utils";
import type { LetterSentiment, SentimentOverview as SentimentOverviewType, SentenceScore } from "@/types/letters";

type Tab = "overblik" | "breve" | "dybdegaaende";

interface LetterSummary {
  id: number;
  date: string;
  sender: string;
  recipient: string;
  place: string;
}

export default function SentimentPage() {
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
      <SentimentPageInner />
    </Suspense>
  );
}

function SentimentPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overblik");
  const [letters, setLetters] = useState<LetterSummary[]>([]);
  const [sentiments, setSentiments] = useState<Record<string, LetterSentiment>>({});
  const [overview, setOverview] = useState<SentimentOverviewType | null>(null);
  const [sentences, setSentences] = useState<SentenceScore[] | null>(null);
  const [selectedLetterId, setSelectedLetterId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deepLinkPending, setDeepLinkPending] = useState<number | null>(null);

  // Parse deep-link param on mount: /sentiment/?brev=123
  useEffect(() => {
    const brevParam = searchParams.get("brev");
    if (brevParam) {
      const id = parseInt(brevParam, 10);
      if (!Number.isNaN(id) && id > 0) {
        setDeepLinkPending(id);
      }
    }
  }, [searchParams]);

  // Load base data on mount
  useEffect(() => {
    const load = async () => {
      try {
        const [lettersRes, sentimentsRes, overviewData] = await Promise.all([
          fetch("/data/letter-summaries.json"),
          fetch("/data/letter-sentiments.json"),
          fetchSentimentOverview(),
        ]);
        if (!lettersRes.ok || !sentimentsRes.ok) throw new Error("Kunne ikke hente data");
        setLetters(await lettersRes.json());
        setSentiments(await sentimentsRes.json());
        setOverview(overviewData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ukendt fejl");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Activate deep-link once data is loaded
  useEffect(() => {
    if (deepLinkPending && !loading && letters.length > 0) {
      handleSelectLetter(deepLinkPending);
      setDeepLinkPending(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkPending, loading, letters]);

  // Update URL when letter selection changes (without full navigation)
  const updateUrl = useCallback((id: number | null) => {
    const url = id ? `/sentiment/?brev=${id}` : "/sentiment/";
    router.replace(url, { scroll: false });
  }, [router]);

  // Lazy-load sentence scores when switching to detail view or selecting a letter
  const handleSelectLetter = useCallback(async (id: number) => {
    setSelectedLetterId(id);
    setTab("dybdegaaende");
    updateUrl(id);
    if (!sentences) {
      try {
        const data = await fetchSentenceScores();
        setSentences(data);
      } catch (err) {
        console.error("Could not load sentence scores:", err);
      }
    }
  }, [sentences, updateUrl]);

  // Compute pre-war vs wartime means for signals
  const preWarMean = (() => {
    const entries = Object.entries(sentiments);
    const preWar = entries.filter(([id]) => {
      const letter = letters.find(l => l.id === parseInt(id, 10));
      return letter && letter.date < "1914-08-01";
    });
    if (preWar.length === 0) return undefined;
    return preWar.reduce((s, [, v]) => s + (v.cvp_mean || 0), 0) / preWar.length;
  })();

  const warMean = (() => {
    const entries = Object.entries(sentiments);
    const war = entries.filter(([id]) => {
      const letter = letters.find(l => l.id === parseInt(id, 10));
      return letter && letter.date >= "1914-08-01";
    });
    if (war.length === 0) return undefined;
    return war.reduce((s, [, v]) => s + (v.cvp_mean || 0), 0) / war.length;
  })();

  const overallMean = (() => {
    const vals = Object.values(sentiments).map(s => s.cvp_mean).filter(v => v !== undefined);
    if (vals.length === 0) return undefined;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  })();

  const selectedLetter = selectedLetterId ? letters.find(l => l.id === selectedLetterId) : null;
  const selectedSentiment = selectedLetterId ? sentiments[String(selectedLetterId)] : null;
  const selectedSentences = selectedLetterId && sentences
    ? getSentencesForLetter(sentences, selectedLetterId)
    : [];

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
        <h1 className="font-display text-3xl text-ink mb-4">Stemning</h1>
        <p className="text-faded">Data er ikke tilgængelig: {error}</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "overblik", label: "Overblik" },
    { key: "breve", label: "Breve" },
    { key: "dybdegaaende", label: "Dybdegående" },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl text-ink mb-2">Stemning</h1>
        <p className="text-faded font-ui text-sm">
          Udforsk brevsamlingens følelsesmæssige indhold — fra overordnede mønstre til enkelte sætninger.
        </p>
      </div>

      {/* Method note */}
      <SentimentMethodNote />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-faded/20">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-ui transition-colors border-b-2 -mb-px ${
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
      {tab === "overblik" && overview && (
        <div className="space-y-6">
          <SentimentOverview
            overview={overview}
            sentiments={sentiments}
            onSelectLetter={handleSelectLetter}
          />
          <SentimentSignals
            preWarMean={preWarMean}
            warMean={warMean}
            overallMean={overallMean}
          />
        </div>
      )}

      {tab === "breve" && (
        <SentimentLetterList
          letters={letters}
          sentiments={sentiments}
          onSelectLetter={handleSelectLetter}
          selectedLetterId={selectedLetterId ?? undefined}
        />
      )}

      {tab === "dybdegaaende" && (
        <div>
          {selectedLetter && selectedSentiment && selectedSentences.length > 0 ? (
            <SentimentLetterDetail
              letterId={selectedLetter.id}
              letterDate={selectedLetter.date}
              letterSender={selectedLetter.sender}
              letterRecipient={selectedLetter.recipient}
              letterPlace={selectedLetter.place}
              sentiment={selectedSentiment}
              sentences={selectedSentences}
              onClose={() => { setSelectedLetterId(null); setTab("breve"); updateUrl(null); }}
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-faded font-ui">
                Vælg et brev fra <button onClick={() => setTab("breve")} className="text-wax-red hover:underline">Breve-fanen</button> for at se sætningsdetaljer.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
