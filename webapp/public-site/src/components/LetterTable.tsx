"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { LetterSummary } from "@/types/letters";

interface LetterTableProps {
  letters: LetterSummary[];
}

const PAGE_SIZE = 25;

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("da-DK", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatFullDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("da-DK", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function LetterTable({ letters }: LetterTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [filterSender, setFilterSender] = useState("all");
  const [filterPlace, setFilterPlace] = useState("all");
  const [searchText, setSearchText] = useState("");

  // Extract unique senders and places for filter dropdowns
  const senders = useMemo(() => {
    const map = new Map<string, number>();
    letters.forEach((l) => {
      const s = l.sender || "Ukendt";
      map.set(s, (map.get(s) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [letters]);

  const places = useMemo(() => {
    const map = new Map<string, number>();
    letters.forEach((l) => {
      const p = l.place || "Ukendt";
      map.set(p, (map.get(p) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [letters]);

  // Filter letters
  const filteredLetters = useMemo(() => {
    let result = letters;

    if (filterSender !== "all") {
      result = result.filter((l) => l.sender === filterSender);
    }

    if (filterPlace !== "all") {
      result = result.filter((l) => l.place === filterPlace);
    }

    if (searchText.trim()) {
      const query = searchText.toLowerCase();
      result = result.filter(
        (l) =>
          l.sender?.toLowerCase().includes(query) ||
          l.recipient?.toLowerCase().includes(query) ||
          l.place?.toLowerCase().includes(query) ||
          l.date?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [letters, filterSender, filterPlace, searchText]);

  const totalPages = Math.ceil(filteredLetters.length / PAGE_SIZE);
  const paginatedLetters = filteredLetters.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset to page 1 when filters change
  const handleFilterChange = (
    setter: (v: string) => void,
    value: string
  ) => {
    setter(value);
    setCurrentPage(1);
  };

  if (letters.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-faded font-ui text-lg">
          Ingen breve fundet. Kor <code>npm run data:build</code> for at
          generere brevdata.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Text search */}
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Filtrer breve..."
            value={searchText}
            onChange={(e) => handleFilterChange(setSearchText, e.target.value)}
            className="w-full px-3 py-2 pl-9 text-sm font-ui bg-cream border border-faded/30 rounded-md placeholder:text-faded/60 text-ink focus:outline-none focus:ring-2 focus:ring-wax-red/30 focus:border-wax-red/50 transition-all"
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-faded/60"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Sender filter */}
        <select
          value={filterSender}
          onChange={(e) => handleFilterChange(setFilterSender, e.target.value)}
          className="px-3 py-2 text-sm font-ui bg-cream border border-faded/30 rounded-md text-ink focus:outline-none focus:ring-2 focus:ring-wax-red/30"
        >
          <option value="all">Alle afsendere ({letters.length})</option>
          {senders.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name} ({s.count})
            </option>
          ))}
        </select>

        {/* Place filter */}
        <select
          value={filterPlace}
          onChange={(e) => handleFilterChange(setFilterPlace, e.target.value)}
          className="px-3 py-2 text-sm font-ui bg-cream border border-faded/30 rounded-md text-ink focus:outline-none focus:ring-2 focus:ring-wax-red/30"
        >
          <option value="all">Alle steder ({letters.length})</option>
          {places.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} ({p.count})
            </option>
          ))}
        </select>
      </div>

      {/* Results count */}
      <p className="text-faded font-ui text-sm mb-4">
        Viser {filteredLetters.length} af {letters.length} breve
      </p>

      {/* Letter table */}
      <div className="relative overflow-x-auto rounded-md border border-faded/20">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-faded uppercase bg-parchment-dark font-ui">
            <tr>
              <th scope="col" className="px-4 py-3">
                Dato
              </th>
              <th scope="col" className="px-4 py-3 hidden sm:table-cell">
                Sted
              </th>
              <th scope="col" className="px-4 py-3">
                Afsender
              </th>
              <th scope="col" className="px-4 py-3 hidden md:table-cell">
                Modtager
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedLetters.map((letter) => (
              <tr
                key={letter.id}
                className="bg-cream border-b border-faded/20 hover:bg-parchment transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/letters/${letter.id}/`}
                    className="text-wax-red hover:underline font-body"
                    title={formatFullDate(letter.date)}
                  >
                    {formatDate(letter.date)}
                  </Link>
                </td>
                <td className="px-4 py-3 font-body hidden sm:table-cell">
                  {letter.place}
                </td>
                <td className="px-4 py-3 font-body">{letter.sender}</td>
                <td className="px-4 py-3 font-body hidden md:table-cell">
                  {letter.recipient}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-faded font-ui text-sm">
            Side {currentPage} af {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-4 py-2 text-sm font-ui rounded border transition-colors ${
                currentPage === 1
                  ? "bg-parchment text-faded/50 border-faded/30 cursor-not-allowed"
                  : "bg-cream text-ink border-faded/30 hover:bg-parchment"
              }`}
            >
              Forrige
            </button>

            {/* Page number buttons */}
            <div className="hidden sm:flex gap-1">
              {generatePageNumbers(currentPage, totalPages).map((page, i) =>
                page === "..." ? (
                  <span
                    key={`ellipsis-${i}`}
                    className="px-2 py-2 text-sm text-faded"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page as number)}
                    className={`px-3 py-2 text-sm font-ui rounded border transition-colors ${
                      currentPage === page
                        ? "bg-wax-red text-cream border-wax-red"
                        : "bg-cream text-ink border-faded/30 hover:bg-parchment"
                    }`}
                  >
                    {page}
                  </button>
                )
              )}
            </div>

            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={currentPage === totalPages}
              className={`px-4 py-2 text-sm font-ui rounded border transition-colors ${
                currentPage === totalPages
                  ? "bg-parchment text-faded/50 border-faded/30 cursor-not-allowed"
                  : "bg-cream text-ink border-faded/30 hover:bg-parchment"
              }`}
            >
              Naeste
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Generate a compact list of page numbers with ellipsis */
function generatePageNumbers(
  current: number,
  total: number
): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [1];

  if (current > 3) {
    pages.push("...");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push("...");
  }

  pages.push(total);

  return pages;
}
