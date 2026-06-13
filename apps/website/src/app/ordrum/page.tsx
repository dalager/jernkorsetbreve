"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import WordSpaceCanvas, { THEME_COLORS, type WordSpaceData } from "@/components/WordSpaceCanvas";

const WordSpace3DCanvas = dynamic(() => import("@/components/WordSpace3DCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] items-center justify-center rounded-md border border-faded/20 bg-parchment-light">
      <p className="font-ui text-faded">Indlæser 3D-visning…</p>
    </div>
  ),
});

type ViewMode = "2d" | "3d";

export default function OrdrumPage() {
  const [data, setData] = useState<WordSpaceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("2d");
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const [hasWebGL] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      return false;
    }
  });

  useEffect(() => {
    fetch("/data/wordspace.json")
      .then((res) => {
        if (!res.ok) throw new Error("Kunne ikke hente data");
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Ukendt fejl"));
  }, []);

  function toggleTheme(theme: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(theme)) next.delete(theme);
      else next.add(theme);
      return next;
    });
  }

  const intro = useMemo(
    () =>
      view === "3d"
        ? "Den samme model giver hvert ord 384 tal — 384 dimensioner. Det kan ingen tegne. Her er ordene presset ned i 3 dimensioner, så du kan rotere rummet og fornemme, at nærhed findes i mange retninger på én gang."
        : "En sprogmodel oversætter hvert ord til en lang talrække — en vektor — så ord med beslægtet betydning får næsten samme talrække. Her er ordene fra brevene presset ned i 2 dimensioner efter, hvordan modellen «forstår» dem.",
    [view],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="font-display text-display-md text-ink">Ordrum — ord og betydning</h1>
        <p className="mt-2 max-w-3xl font-body text-body text-faded-dark">
          {intro}{" "}
          <strong className="text-ink">Jo tættere to ord ligger, desto mere ligner deres betydning hinanden.</strong>{" "}
          Hold musen over et ord for at se dets nærmeste naboer og et rigtigt citat fra brevene.
        </p>
        {data && (
          <p className="mt-2 font-ui text-ui-sm text-faded">
            {data.meta.termCount} ord · model: {data.meta.model} · {data.meta.dimensions} dimensioner ·
            projektion: {data.meta.method.toUpperCase()} → {view === "3d" ? "3D" : "2D"}
          </p>
        )}
      </header>

      {error && <p className="font-ui text-wax-red">{error}</p>}
      {!data && !error && <p className="font-ui text-faded">Indlæser visualisering…</p>}

      {data && (
        <>
          {/* Shared toolbar: view toggle + theme legend */}
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-1 rounded border border-faded/30 bg-parchment p-0.5">
              {(["2d", "3d"] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setView(m)}
                  disabled={m === "3d" && !hasWebGL}
                  title={m === "3d" && !hasWebGL ? "3D kræver WebGL" : undefined}
                  className={`rounded px-3 py-1 font-ui text-ui-sm transition-colors ${
                    view === m ? "bg-ink text-parchment-light" : "text-faded-dark hover:text-ink disabled:opacity-40"
                  }`}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(data.themes).map(([key, label]) => {
                const off = hidden.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleTheme(key)}
                    className={`inline-flex items-center gap-2 rounded-full border border-faded/30 bg-parchment-light px-3 py-1 font-ui text-ui-sm transition-opacity ${off ? "opacity-40" : ""}`}
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: THEME_COLORS[key] }} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {view === "2d" ? (
            <WordSpaceCanvas data={data} hidden={hidden} />
          ) : (
            <WordSpace3DCanvas data={data} hidden={hidden} />
          )}
        </>
      )}

      {/* Explanatory notes */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Note title="Fra ord til tal">
          Modellen <code className="font-ui text-ui-sm">multilingual-e5</code> giver hvert ord 384 tal.
          Hvert ord er her repræsenteret af gennemsnittet af de sætninger i brevene, hvor ordet faktisk
          optræder — altså ordet som det <em>bruges</em>, ikke en ordbogsdefinition.
        </Note>
        <Note title="384 dimensioner">
          Vi kan kun se 2 eller 3 dimensioner ad gangen, men modellen arbejder i 384. Skift til 3D og
          rotér: ord der så ud til at ligge langt fra hinanden i 2D, kan være tæt på i en anden retning.
          Det er kernen i et embedding-rum.
        </Note>
        <Note title="Naboforbindelser">
          Hvert ord er forbundet til sine tre nærmeste naboer i det fulde 384-dimensionelle rum — de ord
          modellen regner for mest beslægtede. Slå <em>Naboforbindelser</em> til for at se hele vævet,
          eller hold musen over ét ord for kun at se dets egne forbindelser.
        </Note>
        <Note title="Derfor virker søgning">
          Når du søger på siden, bliver din søgning også til en vektor. Siden finder de breve, hvis
          vektorer ligger tættest på — så «længsel efter hjemmet» finder breve om savn, selv uden de
          præcise ord.
        </Note>
      </div>
    </div>
  );
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-faded/20 bg-parchment-light p-4">
      <h3 className="mb-1.5 font-display text-base text-wax-red">{title}</h3>
      <p className="font-body text-body-sm text-faded-dark">{children}</p>
    </div>
  );
}
