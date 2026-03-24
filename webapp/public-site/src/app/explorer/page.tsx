"use client";

import { useState, useEffect, useCallback } from "react";
import ExplorerCanvas, { type ColorMode } from "@/components/ExplorerCanvas";
import ExplorerTimeline from "@/components/ExplorerTimeline";

/* ------------------------------------------------------------------ */
/*  Types for fetched data                                             */
/* ------------------------------------------------------------------ */

interface EmbeddingsData {
  points: Array<{ id: number; x: number; y: number }>;
}

interface LetterSummary {
  id: number;
  date: string;
  sender: string;
  recipient: string;
  place: string;
}

interface ClusterData {
  clusters: Array<{ id: number; label: string }>;
  assignments: Record<string, number>;
}

/* ------------------------------------------------------------------ */
/*  Legend content per color mode                                       */
/* ------------------------------------------------------------------ */

const LEGENDS: Record<ColorMode, Array<{ color: string; label: string }>> = {
  time: [
    { color: "hsl(220, 65%, 50%)", label: "1911" },
    { color: "hsl(165, 65%, 50%)", label: "1913" },
    { color: "hsl(110, 65%, 50%)", label: "1915" },
    { color: "hsl(55, 65%, 50%)", label: "1917" },
    { color: "hsl(15, 65%, 50%)", label: "1918" },
  ],
  sender: [
    { color: "hsl(215, 60%, 50%)", label: "Peter M\u00e6rsk" },
    { color: "hsl(340, 55%, 55%)", label: "Trine M\u00e6rsk" },
    { color: "hsl(145, 45%, 42%)", label: "Mor og Far" },
    { color: "hsl(0, 0%, 60%)", label: "Andre" },
  ],
  sentiment: [
    { color: "hsl(145, 55%, 42%)", label: "Positiv (>10)" },
    { color: "hsl(40, 65%, 50%)", label: "Neutral" },
    { color: "hsl(0, 60%, 48%)", label: "Negativ (<-10)" },
  ],
  cluster: [],
};

const COLOR_MODE_LABELS: Record<ColorMode, string> = {
  time: "Tidsperiode",
  sender: "Afsender",
  sentiment: "Stemning",
  cluster: "Emne",
};

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function ExplorerPage() {
  const [points, setPoints] = useState<EmbeddingsData["points"]>([]);
  const [letters, setLetters] = useState<LetterSummary[]>([]);
  const [sentiments, setSentiments] = useState<Record<string, number>>({});
  const [clusters, setClusters] = useState<ClusterData>({
    clusters: [],
    assignments: {},
  });

  const [colorMode, setColorMode] = useState<ColorMode>("time");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Animation state */
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationDate, setAnimationDate] = useState(new Date("1911-01-01"));
  const [speed, setSpeed] = useState(1);

  /* Fetch all data on mount */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [embRes, letRes, senRes, cluRes] = await Promise.all([
          fetch("/data/embeddings-2d.json"),
          fetch("/data/letter-summaries.json"),
          fetch("/data/letter-sentiments.json"),
          fetch("/data/topic-clusters.json"),
        ]);
        if (!embRes.ok || !letRes.ok || !senRes.ok || !cluRes.ok) {
          throw new Error("Kunne ikke hente data");
        }
        const embData: EmbeddingsData = await embRes.json();
        setPoints(embData.points);
        setLetters(await letRes.json());
        setSentiments(await senRes.json());
        setClusters(await cluRes.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ukendt fejl");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  /* Build cluster legend dynamically */
  const clusterLegend = clusters.clusters.map((c) => ({
    color: [
      "hsl(210, 55%, 50%)",
      "hsl(35, 70%, 52%)",
      "hsl(150, 45%, 42%)",
      "hsl(340, 55%, 52%)",
      "hsl(270, 45%, 55%)",
      "hsl(180, 50%, 42%)",
      "hsl(55, 65%, 48%)",
      "hsl(15, 60%, 50%)",
    ][c.id % 8],
    label: c.label,
  }));

  const activeLegend = colorMode === "cluster" ? clusterLegend : LEGENDS[colorMode];

  const togglePlay = useCallback(() => {
    setIsAnimating((prev) => !prev);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="font-ui text-faded">Indl&aelig;ser visualisering&hellip;</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="font-ui text-wax-red">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header bar */}
      <div className="border-b border-faded/20 bg-parchment-light px-4 py-3 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="font-display text-display-md text-ink">
            Udforsk brevsamlingen
          </h1>
          <p className="mt-1 font-body text-body-sm text-faded">
            Hvert punkt er et brev, placeret i et vektorrum baseret p&aring;
            dets indhold. Breve t&aelig;t p&aring; hinanden ligner hinanden
            tematisk. Klik p&aring; et punkt for at l&aelig;se brevet.
          </p>

          {/* Controls row */}
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {/* Color-by dropdown */}
            <label className="flex items-center gap-2">
              <span className="font-ui text-ui-sm text-faded-dark">
                Farv efter:
              </span>
              <select
                value={colorMode}
                onChange={(e) => setColorMode(e.target.value as ColorMode)}
                className="rounded border border-faded/30 bg-parchment px-2 py-1 font-ui text-ui-sm text-ink"
              >
                {(Object.keys(COLOR_MODE_LABELS) as ColorMode[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {COLOR_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            </label>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-2">
              {activeLegend.map((item) => (
                <span
                  key={item.label}
                  className="flex items-center gap-1 font-ui text-ui-sm text-faded-dark"
                >
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-hidden">
        <ExplorerCanvas
          points={points}
          letters={letters}
          sentiments={sentiments}
          clusters={clusters}
          colorMode={colorMode}
          isAnimating={isAnimating}
          animationDate={animationDate}
        />
      </div>

      {/* Timeline bar */}
      <div className="border-t border-faded/20 px-4 py-2 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <ExplorerTimeline
            isPlaying={isAnimating}
            onTogglePlay={togglePlay}
            currentDate={animationDate}
            onDateChange={setAnimationDate}
            speed={speed}
            onSpeedChange={setSpeed}
          />
        </div>
      </div>
    </div>
  );
}
