"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getSearchEngine,
  type SearchResult,
  type SearchEngineState,
} from "@/lib/search-engine";

// ---------------------------------------------------------------------------
// Letter metadata for quick result display
// ---------------------------------------------------------------------------

interface LetterMeta {
  id: number;
  date: string;
  sender: string;
  recipient: string;
  place: string;
}

function formatDanishDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("da-DK", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [engineLoading, setEngineLoading] = useState(false);
  const [lettersMeta, setLettersMeta] = useState<Record<number, LetterMeta>>(
    {}
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -----------------------------------------------------------------------
  // Load letter metadata for result display
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
  }, []);

  // -----------------------------------------------------------------------
  // Subscribe to engine state
  // -----------------------------------------------------------------------

  useEffect(() => {
    const engine = getSearchEngine();

    const update = (state: SearchEngineState) => {
      setEngineReady(state.status === "ready");
      setEngineLoading(
        state.status === "loading-model" ||
          state.status === "loading-embeddings"
      );
    };

    update(engine.getState());
    const unsub = engine.subscribe(update);
    return unsub;
  }, []);

  // -----------------------------------------------------------------------
  // Close dropdown on outside click
  // -----------------------------------------------------------------------

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // -----------------------------------------------------------------------
  // Search (debounced)
  // -----------------------------------------------------------------------

  const performSearch = useCallback(async (q: string) => {
    const engine = getSearchEngine();
    if (!engine.isReady() || !q.trim()) {
      setResults([]);
      return;
    }
    const res = await engine.search(q.trim(), 5);
    setResults(res);
  }, []);

  const handleInput = useCallback(
    (value: string) => {
      setQuery(value);
      setOpen(true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => performSearch(value), 300);
    },
    [performSearch]
  );

  // -----------------------------------------------------------------------
  // Focus handler -- start engine init if not already running
  // -----------------------------------------------------------------------

  const handleFocus = useCallback(() => {
    // Start engine init if not already running (idempotent)
    getSearchEngine().init().catch(() => {});
    setOpen(true);
  }, []);

  // -----------------------------------------------------------------------
  // Keyboard: Enter goes to full search page
  // -----------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && query.trim()) {
        setOpen(false);
        router.push(`/search/?q=${encodeURIComponent(query.trim())}`);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    },
    [query, router]
  );

  // -----------------------------------------------------------------------
  // Select a result
  // -----------------------------------------------------------------------

  const handleSelect = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const showDropdown = open && query.trim().length > 0 && results.length > 0;

  return (
    <div ref={containerRef} className="relative">
      {/* Compact search input */}
      <div className="relative">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faded/60 pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
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
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={engineLoading ? "Forbereder søgning..." : "Søg i breve..."}
          className="w-40 sm:w-56 pl-8 pr-3 py-1.5 rounded-md border border-faded/30 bg-parchment/50 text-ink text-sm font-ui placeholder:text-faded/60 outline-none focus:ring-2 focus:ring-wax-red/30 focus:border-wax-red/50 transition-all duration-200"
        />
      </div>

      {/* Dropdown results */}
      {showDropdown && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
          {results.map((r) => {
            const meta = lettersMeta[r.letterId];
            const pct = Math.max(0, Math.min(100, r.score * 100));

            return (
              <Link
                key={r.letterId}
                href={`/letters/${r.letterId}/`}
                onClick={handleSelect}
                className="block px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {meta
                      ? formatDanishDate(meta.date)
                      : `Brev #${r.letterId}`}
                  </span>
                  <span className="text-xs font-semibold text-blue-600 tabular-nums shrink-0">
                    {pct.toFixed(0)}%
                  </span>
                </div>
                {meta && (
                  <span className="text-xs text-gray-500">
                    {meta.sender} &rarr; {meta.recipient}
                  </span>
                )}
              </Link>
            );
          })}

          <Link
            href={`/search/?q=${encodeURIComponent(query.trim())}`}
            onClick={handleSelect}
            className="block px-3 py-2 text-center text-sm text-blue-600 hover:bg-blue-50 font-medium transition-colors"
          >
            Se alle resultater &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
