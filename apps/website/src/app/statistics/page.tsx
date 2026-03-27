"use client";

import { useState, useEffect, useMemo } from "react";
import { StatCard, BarChart, MiniLineChart, ProgressBar } from "@/components/Charts";

interface Letter {
  id: number;
  date: string;
  sender: string;
  recipient: string;
  place: string;
  text: string;
}

export default function StatisticsPage() {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [sentiments, setSentiments] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lettersRes, sentimentsRes] = await Promise.all([
          fetch("/data/letters.json"),
          fetch("/data/letter-sentiments.json"),
        ]);
        if (!lettersRes.ok || !sentimentsRes.ok) {
          throw new Error("Kunne ikke hente data");
        }
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

  const stats = useMemo(() => {
    if (letters.length === 0) return null;

    const dates = letters.map((l) => l.date).filter(Boolean).sort();
    const firstDate = dates[0] || "";
    const lastDate = dates[dates.length - 1] || "";

    const senderCounts = new Map<string, number>();
    const recipientCounts = new Map<string, number>();
    const placeCounts = new Map<string, number>();
    const yearCounts = new Map<string, number>();
    const monthCounts = new Map<string, number>();

    letters.forEach((l) => {
      senderCounts.set(l.sender, (senderCounts.get(l.sender) || 0) + 1);
      recipientCounts.set(l.recipient, (recipientCounts.get(l.recipient) || 0) + 1);
      if (l.place) placeCounts.set(l.place, (placeCounts.get(l.place) || 0) + 1);
      const year = l.date?.substring(0, 4);
      if (year) yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
      const month = l.date?.substring(0, 7);
      if (month) monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
    });

    const topSenders = Array.from(senderCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topRecipients = Array.from(recipientCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topPlaces = Array.from(placeCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const perYear = Array.from(yearCounts.entries()).sort().map(([l, v]) => ({ label: l, value: v }));
    const perMonth = Array.from(monthCounts.entries()).sort().map(([l, v]) => ({ label: l, value: v }));

    const lengths = letters.map((l) => {
      const plain = (l.text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      return { id: l.id, length: plain.length, wordCount: plain.split(" ").filter(Boolean).length };
    });
    const sortedByLen = [...lengths].sort((a, b) => b.length - a.length);
    const avgWordCount = Math.round(lengths.reduce((s, l) => s + l.wordCount, 0) / lengths.length);

    const yearLengths = new Map<string, { total: number; count: number }>();
    letters.forEach((l, i) => {
      const year = l.date?.substring(0, 4);
      if (!year) return;
      const entry = yearLengths.get(year) || { total: 0, count: 0 };
      entry.total += lengths[i]?.wordCount || 0;
      entry.count += 1;
      yearLengths.set(year, entry);
    });
    const avgLenPerYear = Array.from(yearLengths.entries())
      .sort()
      .map(([l, { total, count }]) => ({ label: l, value: Math.round(total / count) }));

    let positive = 0, neutral = 0, negative = 0;
    Object.values(sentiments).forEach((s) => {
      if (s > 10) positive++;
      else if (s < -5) negative++;
      else neutral++;
    });

    return {
      total: letters.length, firstDate, lastDate, topSenders, topRecipients,
      topPlaces, perYear, perMonth, longestLetter: sortedByLen[0],
      shortestLetter: sortedByLen[sortedByLen.length - 1], avgWordCount,
      avgLenPerYear, sentimentDist: { positive, neutral, negative },
    };
  }, [letters, sentiments]);

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

  if (error || !stats) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center">
        <h1 className="font-display text-3xl text-ink mb-4">Statistik</h1>
        <p className="text-faded">Data er ikke tilg&aelig;ngelig{error ? `: ${error}` : ""}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-ink mb-2">Statistik</h1>
        <p className="text-faded font-ui text-sm">
          Overblik over brevsamlingen med {stats.total} breve fra{" "}
          {stats.firstDate.substring(0, 4)} til {stats.lastDate.substring(0, 4)}.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Breve i alt" value={stats.total} />
        <StatCard
          label="Periode"
          value={`${stats.firstDate.substring(0, 4)}\u2013${stats.lastDate.substring(0, 4)}`}
          sub={`${stats.firstDate} til ${stats.lastDate}`}
        />
        <StatCard
          label="Mest aktive afsender"
          value={stats.topSenders[0]?.[0] || "-"}
          sub={`${stats.topSenders[0]?.[1] || 0} breve`}
        />
        <StatCard
          label="Hyppigste modtager"
          value={stats.topRecipients[0]?.[0] || "-"}
          sub={`${stats.topRecipients[0]?.[1] || 0} breve`}
        />
      </div>

      <div className="bg-parchment-light border border-faded/20 rounded-lg p-6 mb-6 shadow-sm">
        <BarChart data={stats.perYear} title="Breve pr. &aring;r" maxBarHeight={140} />
      </div>

      <div className="bg-parchment-light border border-faded/20 rounded-lg p-6 mb-6 shadow-sm">
        <MiniLineChart data={stats.perMonth} title="Breve pr. m&aring;ned" />
      </div>

      <div className="bg-parchment-light border border-faded/20 rounded-lg p-6 mb-6 shadow-sm">
        <BarChart data={stats.avgLenPerYear} title="Gennemsnitlig brevl&aelig;ngde pr. &aring;r (ord)" maxBarHeight={100} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-parchment-light border border-faded/20 rounded-lg p-6 shadow-sm">
          <h3 className="font-display text-lg text-ink mb-3">Afsendere</h3>
          <div className="space-y-2">
            {stats.topSenders.map(([name, count]) => (
              <ProgressBar key={name} label={name} value={count} maxValue={stats.total} color="#5A4F43" />
            ))}
          </div>
        </div>

        <div className="bg-parchment-light border border-faded/20 rounded-lg p-6 shadow-sm">
          <h3 className="font-display text-lg text-ink mb-3">Modtagere</h3>
          <div className="space-y-2">
            {stats.topRecipients.map(([name, count]) => (
              <ProgressBar key={name} label={name} value={count} maxValue={stats.total} color="#5B8C5A" />
            ))}
          </div>
        </div>
      </div>

      <div className="bg-parchment-light border border-faded/20 rounded-lg p-6 mb-6 shadow-sm">
        <h3 className="font-display text-lg text-ink mb-3">Hyppigste steder (top 10)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
          {stats.topPlaces.map(([name, count], idx) => (
            <div key={name}>
              <div className="flex justify-between text-sm font-ui text-ink mb-0.5">
                <span>{idx + 1}. {name}</span>
                <span className="text-faded">{count}</span>
              </div>
              <div className="h-1.5 bg-parchment-dark rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(count / stats.topPlaces[0][1]) * 100}%`, backgroundColor: "#8B2323", opacity: 0.7 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-parchment-light border border-faded/20 rounded-lg p-6 shadow-sm">
          <h3 className="font-display text-lg text-ink mb-3">Stemningsfordeling</h3>
          <div className="space-y-3">
            {[
              { label: "Positiv", value: stats.sentimentDist.positive, color: "#5B8C5A" },
              { label: "Neutral", value: stats.sentimentDist.neutral, color: "#9C8F80" },
              { label: "Negativ", value: stats.sentimentDist.negative, color: "#A63535" },
            ].map((item) => {
              const total = stats.sentimentDist.positive + stats.sentimentDist.neutral + stats.sentimentDist.negative;
              const pct = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm font-ui text-ink mb-0.5">
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.label}
                    </span>
                    <span className="text-faded">{item.value} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 bg-parchment-dark rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-parchment-light border border-faded/20 rounded-lg p-6 shadow-sm">
          <h3 className="font-display text-lg text-ink mb-3">Brevl&aelig;ngde</h3>
          <div className="space-y-4 text-sm font-ui">
            <div>
              <p className="text-faded">Gennemsnitlig l&aelig;ngde</p>
              <p className="text-ink text-lg font-display">~{stats.avgWordCount} ord</p>
            </div>
            {stats.longestLetter && (
              <div>
                <p className="text-faded">L&aelig;ngste brev</p>
                <p className="text-ink">
                  Brev #{stats.longestLetter.id} ({stats.longestLetter.wordCount} ord)
                  <a href={`/letters/${stats.longestLetter.id}/`} className="ml-2 text-wax-red hover:underline text-xs">
                    L&aelig;s brevet &rarr;
                  </a>
                </p>
              </div>
            )}
            {stats.shortestLetter && (
              <div>
                <p className="text-faded">Korteste brev</p>
                <p className="text-ink">
                  Brev #{stats.shortestLetter.id} ({stats.shortestLetter.wordCount} ord)
                  <a href={`/letters/${stats.shortestLetter.id}/`} className="ml-2 text-wax-red hover:underline text-xs">
                    L&aelig;s brevet &rarr;
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
