"use client";

import { useState, useEffect, useMemo } from "react";
import TimelineSVG from "@/components/TimelineSVG";

interface Letter {
  id: number;
  date: string;
  sender: string;
  recipient: string;
  place: string;
}

const WWI_EVENTS = [
  { date: "1914-06-28", label: "Mordet p\u00e5 Franz Ferdinand" },
  { date: "1914-08-04", label: "Storbritannien erkl\u00e6rer krig" },
  { date: "1914-08-23", label: "Slaget ved Tannenberg" },
  { date: "1915-05-02", label: "Gorlice-Tarn\u00f3w offensiven" },
  { date: "1916-02-21", label: "Slaget ved Verdun begynder" },
  { date: "1916-07-01", label: "Slaget ved Somme" },
  { date: "1917-04-06", label: "USA g\u00e5r ind i krigen" },
  { date: "1917-07-31", label: "Passchendaele begynder" },
  { date: "1918-03-21", label: "For\u00e5rsoffensiven" },
  { date: "1918-11-11", label: "V\u00e5benstilstand" },
];

export default function TimelinePage() {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [sentiments, setSentiments] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSender, setSelectedSender] = useState<string>("all");
  const [yearRange, setYearRange] = useState<[number, number]>([1911, 1918]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lettersRes, sentimentsRes] = await Promise.all([
          fetch("/data/letters.json"),
          fetch("/data/letter-sentiments.json"),
        ]);
        if (!lettersRes.ok || !sentimentsRes.ok) throw new Error("Kunne ikke hente data");
        setLetters(await lettersRes.json());
        setSentiments(await sentimentsRes.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ukendt fejl");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const senders = useMemo(() => {
    const counts = new Map<string, number>();
    letters.forEach((l) => counts.set(l.sender, (counts.get(l.sender) || 0) + 1));
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [letters]);

  const filteredLetters = useMemo(() => {
    return letters.filter((l) => {
      if (selectedSender !== "all" && l.sender !== selectedSender) return false;
      const year = parseInt(l.date.substring(0, 4));
      return year >= yearRange[0] && year <= yearRange[1];
    });
  }, [letters, selectedSender, yearRange]);

  const monthlyDensity = useMemo(() => {
    const counts = new Map<string, number>();
    filteredLetters.forEach((l) => {
      const key = l.date.substring(0, 7);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [filteredLetters]);

  const allMonths = useMemo(() => {
    const months: string[] = [];
    for (let y = yearRange[0]; y <= yearRange[1]; y++) {
      for (let m = 1; m <= 12; m++) months.push(`${y}-${String(m).padStart(2, "0")}`);
    }
    return months;
  }, [yearRange]);

  const maxDensity = useMemo(() => {
    let max = 0;
    monthlyDensity.forEach((v) => { if (v > max) max = v; });
    return max || 1;
  }, [monthlyDensity]);

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
        <p className="text-faded">Data er ikke tilg&aelig;ngelig: {error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-ink mb-2">Tidslinje</h1>
        <p className="text-faded font-ui text-sm">
          {filteredLetters.length} breve fra {yearRange[0]} til {yearRange[1]}.
          Hold musen over et punkt for detaljer, klik for at l&aelig;se brevet.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6 items-end">
        <div>
          <label className="block text-xs font-ui text-faded mb-1">Afsender</label>
          <select
            value={selectedSender}
            onChange={(e) => setSelectedSender(e.target.value)}
            className="bg-parchment-light border border-faded/30 rounded px-3 py-1.5 text-sm font-ui text-ink"
          >
            <option value="all">Alle afsendere</option>
            {senders.map((s) => (
              <option key={s.name} value={s.name}>{s.name} ({s.count})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-ui text-faded mb-1">Fra &aring;r</label>
          <select
            value={yearRange[0]}
            onChange={(e) => setYearRange([parseInt(e.target.value), yearRange[1]])}
            className="bg-parchment-light border border-faded/30 rounded px-3 py-1.5 text-sm font-ui text-ink"
          >
            {[1911, 1912, 1913, 1914, 1915, 1916, 1917, 1918].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-ui text-faded mb-1">Til &aring;r</label>
          <select
            value={yearRange[1]}
            onChange={(e) => setYearRange([yearRange[0], parseInt(e.target.value)])}
            className="bg-parchment-light border border-faded/30 rounded px-3 py-1.5 text-sm font-ui text-ink"
          >
            {[1911, 1912, 1913, 1914, 1915, 1916, 1917, 1918].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs font-ui text-faded">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#5B8C5A" }} />
          Positiv
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#9C8F80" }} />
          Neutral
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#A63535" }} />
          Negativ
        </span>
      </div>

      {/* Timeline visualization */}
      <div className="bg-parchment-light border border-faded/20 rounded-lg p-4 overflow-x-auto shadow-sm">
        <TimelineSVG
          letters={filteredLetters}
          sentiments={sentiments}
          yearRange={yearRange}
          events={WWI_EVENTS}
          monthlyDensity={monthlyDensity}
          allMonths={allMonths}
          maxDensity={maxDensity}
        />
      </div>

      {/* Summary stats */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        <div className="bg-parchment-light border border-faded/20 rounded-lg p-4">
          <p className="font-display text-2xl text-ink">{filteredLetters.length}</p>
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
          <p className="font-display text-2xl text-ink">{yearRange[1] - yearRange[0] + 1}</p>
          <p className="text-faded text-xs font-ui">&Aring;r vist</p>
        </div>
      </div>
    </div>
  );
}
