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
  { label: "breve om kærlighed", query: "breve om kærlighed" },
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
        <div className="max-w-3xl mx-auto text-center py-12 text-faded">
          Indlæser søgeside...
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
  const [engineState, setEngineState] = useState<SearchEngineState>(() => {
    try {
      return getSearchEngine().getState();
    } catch {
      return { status: "idle" };
    }
  });
  const [lettersMeta, setLettersMeta] = useState<Record<number, LetterMeta>>(
    {}
  );
  const [snippets, setSnippets] = useState<Record<string, string>>({});
  const [showSlowLoadMsg, setShowSlowLoadMsg] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialSearchDone = useRef(false);
  const pendingQueryRef = useRef<string>("");

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
      return;
    }

    const res = await engine.search(q.trim(), 30);
    setResults(res);
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

    engine.init().catch(() => {
      /* error state is handled via engine subscription */
    });

    return unsubscribe;
  }, [initialQuery, performSearch]);

  // -----------------------------------------------------------------------
  // Input handlers
  // -----------------------------------------------------------------------

  const handleInput = useCallback(
    (value: string) => {
      setQuery(value);
      pendingQueryRef.current = value;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const engine = getSearchEngine();
      if (engine.isReady()) {
        debounceRef.current = setTimeout(() => performSearch(value), 300);
      }
    },
    [performSearch]
  );

  const handlePill = useCallback(
    (pillQuery: string) => {
      setQuery(pillQuery);
      pendingQueryRef.current = pillQuery;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const engine = getSearchEngine();
      if (engine.isReady()) {
        performSearch(pillQuery);
      }
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
        return "Forbereder søgning...";
      case "loading-model":
        if (engineState.modelProgress) {
          return `Forbereder søgemaskinen... (${engineState.modelProgress}%)`;
        }
        return "Forbereder søgemaskinen...";
      case "loading-embeddings":
        return "Indlæser brevdata...";
      case "searching":
        return "Søger...";
      case "ready":
        if (results.length > 0 && query.trim()) {
          return `Fandt ${results.length} resultater for \u201c${query}\u201d`;
        }
        return `Klar! Søg i ${engineState.letterCount ?? "?"} breve.`;
      case "error":
        return "Noget gik galt. Prøv at genindlæse siden.";
      default:
        return "";
    }
  }

  const isReady =
    engineState.status === "ready" || engineState.status === "searching";

  // -----------------------------------------------------------------------
  // Auto-execute pending query when engine becomes ready
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (isReady && pendingQueryRef.current.trim()) {
      performSearch(pendingQueryRef.current);
      pendingQueryRef.current = "";
    }
  }, [isReady, performSearch]);

  // -----------------------------------------------------------------------
  // Show slow-load message after 3 seconds of model loading
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (engineState.status === "loading-model") {
      const timer = setTimeout(() => setShowSlowLoadMsg(true), 3000);
      return () => {
        clearTimeout(timer);
        setShowSlowLoadMsg(false);
      };
    }
  }, [engineState.status]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="max-w-3xl mx-auto">
      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="font-display text-display-md text-ink mb-1">
          Brevsøgning
        </h1>
        <p className="text-faded text-sm">
          Find breve efter emne eller indhold
        </p>
      </div>

      {/* Progress bar (visible during model load) */}
      {engineState.status === "loading-model" && (
        <div className="w-full h-1.5 bg-parchment-light rounded-full overflow-hidden mb-1">
          <div
            className="h-full bg-wax-red rounded-full transition-all duration-300"
            style={{ width: `${engineState.modelProgress ?? 5}%` }}
          />
        </div>
      )}
      {showSlowLoadMsg && engineState.status === "loading-model" && (
        <p className="text-center text-xs text-faded mt-1">
          Første gang tager det lidt længere. Næste gang er det hurtigere.
        </p>
      )}

      {/* Status */}
      <p className="text-center text-sm text-faded mb-4 min-h-[1.2em]">
        {statusText()}
      </p>

      {/* Search input */}
      <div className="relative mb-3">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-faded pointer-events-none"
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
          placeholder={
            isReady
              ? "Søg efter breve... (f.eks. 'breve om kærlighed')"
              : "Søgemaskinen forberedes..."
          }
          className="w-full pl-10 pr-4 py-3 rounded-lg border-2 border-faded/20 bg-parchment text-ink text-base outline-none focus:border-ink transition-colors"
        />
      </div>

      {/* Example pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {EXAMPLE_QUERIES.map((eq) => (
          <button
            key={eq.query}
            onClick={() => handlePill(eq.query)}
            className="px-3 py-1 rounded-full text-sm bg-parchment-light text-faded-dark border border-faded/20 hover:border-ink-light hover:bg-parchment transition-colors cursor-pointer"
          >
            {eq.label}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="space-y-3">
        {results.length === 0 && query.trim() && isReady && (
          <p className="text-center text-faded py-8">Ingen resultater</p>
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
              className="block relative overflow-hidden rounded-lg border border-faded/20 bg-parchment p-4 hover:bg-parchment-light transition-colors"
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
                <span className="font-bold text-ink">
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
                <div className="flex flex-wrap gap-x-4 text-sm text-faded mb-1">
                  <span>
                    {meta.sender} → {meta.recipient}
                  </span>
                  {meta.place && <span>{meta.place}</span>}
                </div>
              )}

              {snippet && (
                <p className="text-sm text-faded-dark line-clamp-2">
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
          <p>
            Søgemaskinen kunne ikke starte. Prøv at genindlæse siden. Kontakt os hvis problemet fortsætter.
          </p>
        </div>
      )}

      {/* Footer note */}
      <div className="mt-8 text-center text-xs text-faded leading-relaxed">
        <p>
          Søgningen sker lokalt i din browser — ingen data sendes videre.
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

