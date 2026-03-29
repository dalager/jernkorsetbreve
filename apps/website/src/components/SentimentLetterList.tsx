"use client";

import { useMemo, useState } from "react";
import type { LetterSentiment } from "@/types/letters";
import {
  sentimentBgColor,
  formatScore,
  formatNegativeRatio,
} from "@/lib/sentiment-utils";
import { sentimentColor, sentimentCategory } from "@/lib/timeline-utils";

interface SentimentLetterListProps {
  letters: Array<{
    id: number;
    date: string;
    sender: string;
    recipient: string;
    place: string;
  }>;
  sentiments: Record<string, LetterSentiment>;
  onSelectLetter: (id: number) => void;
  selectedLetterId?: number;
}

type SortKey =
  | "date"
  | "sender"
  | "recipient"
  | "stemning"
  | "spaendvidde"
  | "negativt";
type SortDir = "asc" | "desc";
type SentimentFilter = "alle" | "positiv" | "negativ" | "neutral";

const PAGE_SIZE = 25;

export default function SentimentLetterList({
  letters,
  sentiments,
  onSelectLetter,
  selectedLetterId,
}: SentimentLetterListProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [yearFilter, setYearFilter] = useState<string>("alle");
  const [sentimentFilter, setSentimentFilter] =
    useState<SentimentFilter>("alle");
  const [page, setPage] = useState(0);

  const years = useMemo(() => {
    const set = new Set(letters.map((l) => l.date.substring(0, 4)));
    return Array.from(set).sort();
  }, [letters]);

  const filtered = useMemo(() => {
    return letters.filter((l) => {
      if (yearFilter !== "alle" && !l.date.startsWith(yearFilter)) return false;
      if (sentimentFilter !== "alle") {
        const s = sentiments[String(l.id)];
        if (!s) return false;
        const cat = sentimentCategory(s.cvp_mean);
        if (cat !== sentimentFilter) return false;
      }
      return true;
    });
  }, [letters, sentiments, yearFilter, sentimentFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const sa = sentiments[String(a.id)];
      const sb = sentiments[String(b.id)];
      switch (sortKey) {
        case "date":
          return dir * a.date.localeCompare(b.date);
        case "sender":
          return dir * a.sender.localeCompare(b.sender);
        case "recipient":
          return dir * a.recipient.localeCompare(b.recipient);
        case "stemning":
          return dir * ((sa?.cvp_mean ?? 0) - (sb?.cvp_mean ?? 0));
        case "spaendvidde":
          return dir * ((sa?.cvp_range ?? 0) - (sb?.cvp_range ?? 0));
        case "negativt":
          return dir * ((sa?.negative_ratio ?? 0) - (sb?.negative_ratio ?? 0));
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sentiments, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = sorted.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center font-ui text-sm">
        <label className="flex items-center gap-1.5 text-faded">
          År:
          <select
            value={yearFilter}
            onChange={(e) => {
              setYearFilter(e.target.value);
              setPage(0);
            }}
            className="bg-parchment-light border border-faded/20 rounded px-2 py-1 text-ink"
          >
            <option value="alle">Alle</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-faded">
          Stemning:
          <select
            value={sentimentFilter}
            onChange={(e) => {
              setSentimentFilter(e.target.value as SentimentFilter);
              setPage(0);
            }}
            className="bg-parchment-light border border-faded/20 rounded px-2 py-1 text-ink"
          >
            <option value="alle">Alle</option>
            <option value="positiv">Positive</option>
            <option value="negativ">Negative</option>
            <option value="neutral">Neutrale</option>
          </select>
        </label>
        <span className="text-faded ml-auto">
          {sorted.length} breve
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-faded/20 font-ui text-faded text-left">
              <th
                className="py-2 px-2 cursor-pointer select-none"
                onClick={() => toggleSort("date")}
              >
                Dato{arrow("date")}
              </th>
              <th
                className="py-2 px-2 cursor-pointer select-none"
                onClick={() => toggleSort("sender")}
              >
                Afsender{arrow("sender")}
              </th>
              <th
                className="py-2 px-2 cursor-pointer select-none hidden md:table-cell"
                onClick={() => toggleSort("recipient")}
              >
                Modtager{arrow("recipient")}
              </th>
              <th
                className="py-2 px-2 cursor-pointer select-none"
                onClick={() => toggleSort("stemning")}
              >
                Stemning{arrow("stemning")}
              </th>
              <th
                className="py-2 px-2 cursor-pointer select-none hidden md:table-cell"
                onClick={() => toggleSort("spaendvidde")}
              >
                Spændvidde{arrow("spaendvidde")}
              </th>
              <th
                className="py-2 px-2 cursor-pointer select-none hidden md:table-cell"
                onClick={() => toggleSort("negativt")}
              >
                Negativt{arrow("negativt")}
              </th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((l) => {
              const s = sentiments[String(l.id)];
              const isSelected = l.id === selectedLetterId;
              return (
                <tr
                  key={l.id}
                  onClick={() => onSelectLetter(l.id)}
                  className={`border-b border-faded/10 cursor-pointer transition-colors hover:bg-parchment-light ${
                    isSelected ? "bg-parchment-light ring-1 ring-faded/30" : ""
                  }`}
                >
                  <td className="py-1.5 px-2 font-body text-ink whitespace-nowrap">
                    {l.date}
                  </td>
                  <td className="py-1.5 px-2 font-body text-ink">
                    {l.sender}
                  </td>
                  <td className="py-1.5 px-2 font-body text-ink hidden md:table-cell">
                    {l.recipient}
                  </td>
                  <td
                    className="py-1.5 px-2 font-body whitespace-nowrap"
                    style={{
                      backgroundColor: s
                        ? sentimentBgColor(s.cvp_mean, 0.15)
                        : undefined,
                    }}
                  >
                    {s ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: sentimentColor(s.cvp_mean),
                          }}
                        />
                        <span className="text-ink">
                          {formatScore(s.cvp_mean)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-faded">—</span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 font-body text-ink hidden md:table-cell">
                    {s ? s.cvp_range.toFixed(2) : "—"}
                  </td>
                  <td className="py-1.5 px-2 font-body text-ink hidden md:table-cell">
                    {s ? formatNegativeRatio(s.negative_ratio) : "—"}
                  </td>
                </tr>
              );
            })}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-faded font-ui">
                  Ingen breve matcher filteret.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between font-ui text-sm text-faded">
          <button
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="px-3 py-1 rounded border border-faded/20 bg-parchment-light disabled:opacity-40 hover:bg-parchment transition-colors"
          >
            ← Forrige
          </button>
          <span>
            Side {safePage + 1} af {totalPages}
          </span>
          <button
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="px-3 py-1 rounded border border-faded/20 bg-parchment-light disabled:opacity-40 hover:bg-parchment transition-colors"
          >
            Næste →
          </button>
        </div>
      )}
    </div>
  );
}
