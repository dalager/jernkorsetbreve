"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface RelatedEntry {
  id: number;
  score: number;
}

interface LetterSummary {
  id: number;
  date: string;
  sender: string;
  recipient: string;
  place: string;
}

type RelatedLettersMap = Record<string, RelatedEntry[]>;

// Module-level caches so data survives across navigations
let cachedRelated: RelatedLettersMap | null = null;
let cachedSummaries: Map<number, LetterSummary> | null = null;

async function fetchRelatedData(): Promise<RelatedLettersMap | null> {
  if (cachedRelated) return cachedRelated;
  try {
    const res = await fetch("/data/related-letters.json");
    if (!res.ok) return null;
    cachedRelated = await res.json();
    return cachedRelated;
  } catch {
    return null;
  }
}

async function fetchSummaries(): Promise<Map<number, LetterSummary> | null> {
  if (cachedSummaries) return cachedSummaries;
  try {
    const res = await fetch("/data/letter-summaries.json");
    if (!res.ok) return null;
    const arr: LetterSummary[] = await res.json();
    cachedSummaries = new Map(arr.map((s) => [s.id, s]));
    return cachedSummaries;
  } catch {
    return null;
  }
}

interface RelatedLettersProps {
  letterId: number;
}

interface ResolvedRelated {
  id: number;
  score: number;
  date: string;
  sender: string;
  recipient: string;
  place: string;
}

export default function RelatedLetters({ letterId }: RelatedLettersProps) {
  const [items, setItems] = useState<ResolvedRelated[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [related, summaries] = await Promise.all([
        fetchRelatedData(),
        fetchSummaries(),
      ]);

      if (cancelled) return;

      if (!related || !summaries) {
        setLoaded(true);
        return;
      }

      const entries = related[String(letterId)];
      if (!entries || entries.length === 0) {
        setLoaded(true);
        return;
      }

      const resolved: ResolvedRelated[] = [];
      for (const entry of entries) {
        const summary = summaries.get(entry.id);
        if (summary) {
          resolved.push({
            id: entry.id,
            score: entry.score,
            date: summary.date,
            sender: summary.sender,
            recipient: summary.recipient,
            place: summary.place,
          });
        }
      }

      setItems(resolved);
      setLoaded(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [letterId]);

  if (!loaded || items.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="font-display text-xl text-ink mb-3">Relaterede breve</h2>
      <div className="bg-cream rounded-lg border border-faded/20 shadow-letter overflow-hidden divide-y divide-faded/15">
        {items.map((item) => {
          const pct = (item.score * 100).toFixed(1);
          const date = new Date(item.date).toLocaleDateString("da-DK", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });

          return (
            <Link
              key={item.id}
              href={`/letters/${item.id}/`}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3 hover:bg-parchment/50 transition-colors group"
            >
              <span className="font-ui text-sm text-wax-red font-medium w-14 shrink-0">
                {pct}%
              </span>
              <span className="font-ui text-sm text-ink">{date}</span>
              <span className="font-body text-sm text-ink">
                {item.sender} → {item.recipient}
              </span>
              {item.place && (
                <span className="font-ui text-sm text-faded">{item.place}</span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
