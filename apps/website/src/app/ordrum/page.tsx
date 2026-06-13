"use client";

import { useEffect, useState } from "react";
import WordSpaceCanvas, { type WordSpaceData } from "@/components/WordSpaceCanvas";

export default function OrdrumPage() {
  const [data, setData] = useState<WordSpaceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/wordspace.json")
      .then((res) => {
        if (!res.ok) throw new Error("Kunne ikke hente data");
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Ukendt fejl"));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="font-display text-display-md text-ink">Ordrum — ord og betydning</h1>
        <p className="mt-2 max-w-3xl font-body text-body text-faded-dark">
          En sprogmodel oversætter hvert ord til en lang talrække — en <em>vektor</em> — så ord med
          beslægtet betydning får næsten samme talrække. Her er {data?.meta.termCount ?? 44} ord fra
          brevene placeret efter, hvordan modellen «forstår» dem.{" "}
          <strong className="text-ink">Jo tættere to ord ligger, desto mere ligner deres betydning hinanden.</strong>{" "}
          Hold musen over et ord for at se dets nærmeste naboer og et rigtigt citat fra brevene.
        </p>
        {data && (
          <p className="mt-2 font-ui text-ui-sm text-faded">
            {data.meta.termCount} ord · model: {data.meta.model} · {data.meta.dimensions} dimensioner ·
            projektion: {data.meta.method.toUpperCase()}
          </p>
        )}
      </header>

      {error && <p className="font-ui text-wax-red">{error}</p>}
      {!data && !error && <p className="font-ui text-faded">Indlæser visualisering…</p>}
      {data && <WordSpaceCanvas data={data} />}

      {/* Explanatory notes */}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Note title="Fra ord til tal">
          Modellen <code className="font-ui text-ui-sm">multilingual-e5</code> giver hvert ord 384 tal.
          Hvert ord er her repræsenteret af gennemsnittet af de sætninger i brevene, hvor ordet faktisk
          optræder — altså ordet som det <em>bruges</em>, ikke en ordbogsdefinition.
        </Note>
        <Note title="Afstand = betydning">
          «Krig», «soldat», «skyttegrav» og «fjende» klumper sig sammen. «Mor», «far», «hjem» og
          «familie» danner en anden klynge. Modellen har aldrig fået temaerne fortalt — den udleder dem
          af sproget selv.
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
