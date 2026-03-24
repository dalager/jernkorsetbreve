"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  getSearchEngine,
  type SearchResult,
  type SearchEngineState,
} from "@/lib/search-engine";

// ---------------------------------------------------------------------------
// Letter metadata (loaded from static JSON for result display)
// ---------------------------------------------------------------------------

interface LetterMeta {
  id: number;
  date: string;
  sender: string;
  recipient: string;
  place: string;
}

// ---------------------------------------------------------------------------
// Example query pills -- Danish content relevant to the WW1 letters
// ---------------------------------------------------------------------------

const EXAMPLE_QUERIES = [
  { label: "breve om k\u00e6rlighed", query: "breve om k\u00e6rlighed" },
  { label: "krigen i Frankrig", query: "krigen i Frankrig" },
  { label: "julen 1917", query: "julen 1917" },
  { label: "hverdagen derhjemme", query: "hverdagen derhjemme" },
  { label: "vejret og naturen", query: "vejret og naturen" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDanishDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("da-DK", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

function scoreColor(pct: number): string {
  const hue = Math.round(Math.max(0, Math.min(100, pct)) * 1.2);
  return `hsl(${hue}, 70%, 45%)`;
}

// ---------------------------------------------------------------------------
// Wrapper that provides Suspense for useSearchParams
// ---------------------------------------------------------------------------

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto text-center py-12 text-gray-400">
          Indl&aelig;ser s&oslash;geside...
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Inner component (uses useSearchParams)
// ---------------------------------------------------------------------------

function SearchPageInner() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [engineState, setEngineState] = useState<SearchEngineState>({
    status: "idle",
  });
  const [lettersMeta, setLettersMeta] = useState<Record<number, LetterMeta>>(
    {}
  );
  const [snippets, setSnippets] = useState<Record<string, string>>({});
  const [initError, setInitError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialSearchDone = useRef(false);

  // -----------------------------------------------------------------------
  // Load letter metadata + snippets (for display)
  // -----------------------------------------------------------------------

  useEffect(() => {
    fetch("/data/letters.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((letters: LetterMeta[]) => {
        const map: Record<number, LetterMeta> = {};
        letters.forEach((l) => {
          map[l.id] = l;
        });
        setLettersMeta(map);
      })
      .catch(() => {
        /* non-critical */
      });

    fetch("/data/search-snippets.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, string>) => setSnippets(data))
      .catch(() => {
        /* non-critical */
      });
  }, []);

  // -----------------------------------------------------------------------
  // Perform search
  // -----------------------------------------------------------------------

  const performSearch = useCallback(async (q: string) => {
    const engine = getSearchEngine();
    if (!engine.isReady() || !q.trim()) {
      setResults([]);
      setSearchTime(null);
      return;
    }

    const t0 = performance.now();
    const res = await engine.search(q.trim(), 30);
    const elapsed = performance.now() - t0;

    setResults(res);
    setSearchTime(elapsed);
  }, []);

  // -----------------------------------------------------------------------
  // Initialise search engine
  // -----------------------------------------------------------------------

  useEffect(() => {
    const engine = getSearchEngine();
    const unsubscribe = engine.subscribe((state) => {
      setEngineState(state);

      // When engine becomes ready and we have an initial query, run it once
      if (
        state.status === "ready" &&
        !initialSearchDone.current &&
        initialQuery.trim()
      ) {
        initialSearchDone.current = true;
        performSearch(initialQuery);
      }
    });
    setEngineState(engine.getState());

    engine.init().catch((err) => {
      setInitError(
        err instanceof Error ? err.message : "Kunne ikke starte sogemaskinen"
      );
    });

    return unsubscribe;
  }, [initialQuery, performSearch]);

  // -----------------------------------------------------------------------
  // Input handlers
  // -----------------------------------------------------------------------

  const handleInput = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => performSearch(value), 300);
    },
    [performSearch]
  );

  const handlePill = useCallback(
    (pillQuery: string) => {
      setQuery(pillQuery);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      performSearch(pillQuery);
      inputRef.current?.focus();
    },
    [performSearch]
  );

  // -----------------------------------------------------------------------
  // Status text
  // -----------------------------------------------------------------------

  function statusText(): string {
    switch (engineState.status) {
      case "idle":
        return "Starter...";
      case "loading-model":
        if (engineState.modelProgress && engineState.modelProgressFile) {
          return `Henter AI-model: ${engineState.modelProgressFile} (${engineState.modelProgress}%)`;
        }
        return "Henter AI-model (~33 MB, caches efter f\u00f8rste gang)...";
      case "loading-embeddings":
        return "Indl\u00e6ser brev-embeddings...";
      case "searching":
        return "S\u00f8ger...";
      case "ready":
        if (results.length > 0 && query.trim()) {
          return `Fandt ${results.length} resultater for \u201c${query}\u201d`;
        }
        return `Klar! S\u00f8g i ${engineState.letterCount ?? "?"} breve.`;
      case "error":
        return `Fejl: ${engineState.error ?? initError ?? "Ukendt fejl"}`;
      default:
        return "";
    }
  }

  const isReady =
    engineState.status === "ready" || engineState.status === "searching";

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="max-w-3xl mx-auto">
      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-1">
          Semantisk Brevs&oslash;gning
        </h1>
        <p className="text-gray-500 text-sm">
          AI-drevet s&oslash;gning i breve fra 1. verdenskrig &mdash; alt
          k&oslash;rer i din browser
        </p>
      </div>

      {/* Performance dashboard */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatBox
          label="Model"
          value={
            engineState.modelLoadTime
              ? `${(engineState.modelLoadTime / 1000).toFixed(1)}s`
              : engineState.status === "loading-model"
                ? undefined
                : "\u2014"
          }
          sub="gte-small (flersproget)"
          loading={engineState.status === "loading-model"}
        />
        <StatBox
          label="Embeddings"
          value={
            engineState.embeddingLoadTime
              ? `${(engineState.embeddingLoadTime / 1000).toFixed(1)}s`
              : "\u2014"
          }
          sub={
            engineState.letterCount
              ? `${engineState.letterCount} breve`
              : "\u00a0"
          }
          loading={engineState.status === "loading-embeddings"}
        />
        <StatBox
          label="S&oslash;getid"
          value={searchTime !== null ? `${searchTime.toFixed(0)}ms` : "\u2014"}
          sub="cosine similarity"
        />
      </div>

      {/* Progress bar (visible during model load) */}
      {engineState.status === "loading-model" && (
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mb-1">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${engineState.modelProgress ?? 5}%` }}
          />
        </div>
      )}

      {/* Status */}
      <p className="text-center text-sm text-gray-500 mb-4 min-h-[1.2em]">
        {statusText()}
      </p>

      {/* Search input */}
      <div className="relative mb-3">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          disabled={!isReady}
          placeholder={
            isReady
              ? "S\u00f8g efter breve... (f.eks. 'brev om k\u00e6rlighed')"
              : "Indl\u00e6ser s\u00f8gemaskine..."
          }
          className="w-full pl-10 pr-4 py-3 rounded-lg border-2 border-gray-200 bg-white text-gray-900 text-base outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        />
      </div>

      {/* Example pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {EXAMPLE_QUERIES.map((eq) => (
          <button
            key={eq.query}
            disabled={!isReady}
            onClick={() => handlePill(eq.query)}
            className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-600 border border-gray-200 hover:border-blue-400 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {eq.label}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="space-y-3">
        {results.length === 0 && query.trim() && isReady && (
          <p className="text-center text-gray-400 py-8">Ingen resultater</p>
        )}

        {results.map((r, idx) => {
          const meta = lettersMeta[r.letterId];
          const snippet = snippets[String(r.letterId)];
          const pct = Math.max(0, Math.min(100, r.score * 100));
          const color = scoreColor(pct);

          return (
            <Link
              key={r.letterId}
              href={`/letters/${r.letterId}/`}
              className="block relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50 transition-colors"
              style={{
                animationDelay: `${Math.min(idx * 40, 400)}ms`,
                animation: "fadeSlideIn 0.3s ease both",
              }}
            >
              {/* Score bar at top */}
              <div
                className="absolute top-0 left-0 h-[3px] rounded-tl"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />

              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="font-bold text-gray-900">
                  {meta
                    ? formatDanishDate(meta.date)
                    : `Brev #${r.letterId}`}
                </span>
                <span
                  className="text-sm font-semibold tabular-nums shrink-0"
                  style={{ color }}
                >
                  {pct.toFixed(1)}%
                </span>
              </div>

              {meta && (
                <div className="flex flex-wrap gap-x-4 text-sm text-gray-500 mb-1">
                  <span>
                    {meta.sender} &rarr; {meta.recipient}
                  </span>
                  {meta.place && <span>{meta.place}</span>}
                </div>
              )}

              {snippet && (
                <p className="text-sm text-gray-600 line-clamp-2">
                  {snippet}
                </p>
              )}
            </Link>
          );
        })}
      </div>

      {/* Error notice */}
      {engineState.status === "error" && (
        <div className="mt-6 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <p className="font-semibold mb-1">
            S&oslash;gemaskinen kunne ikke starte
          </p>
          <p>{engineState.error ?? initError}</p>
          <p className="mt-2 text-xs text-red-500">
            Embeddings-filen (<code>embeddings.bin</code>) er muligvis ikke
            genereret endnu. K&oslash;r build-data scriptet for at oprette den.
          </p>
        </div>
      )}

      {/* Footer note */}
      <div className="mt-8 text-center text-xs text-gray-400 leading-relaxed">
        <p>
          <strong>Alt k&oslash;rer i din browser</strong> &mdash; ingen data
          sendes til en server. Modellen caches efter f&oslash;rste
          indl&aelig;sning.
        </p>
      </div>

      {/* Keyframe for card animation */}
      <style jsx global>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat box sub-component
// ---------------------------------------------------------------------------

function StatBox({
  label,
  value,
  sub,
  loading,
}: {
  label: string;
  value?: string;
  sub: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 text-center flex flex-col items-center gap-0.5">
      <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </span>
      <span className="text-xl font-bold text-blue-600 tabular-nums leading-tight">
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
        ) : (
          value ?? "\u2014"
        )}
      </span>
      <span className="text-[0.65rem] text-gray-400">{sub}</span>
    </div>
  );
}
