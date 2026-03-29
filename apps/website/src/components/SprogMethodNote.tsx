"use client";

import { useState } from "react";

export default function SprogMethodNote() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6 border border-faded/20 rounded-lg bg-parchment/30">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-ui text-sm text-faded">
          <span className="mr-2">ℹ</span>
          Om metoden
        </span>
        <span className="text-faded text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-faded font-ui space-y-2 border-t border-faded/10 pt-3">
          <p>
            Tallene på denne side er beregnet af algoritmer, der analyserer
            ordvalg, sætningsopbygning og sproglige mønstre i brevene.           </p>
          <p>
            <strong>Ordrigdom</strong> (MATTR) måler hvor varieret ordforrådet
            er. <strong>Sætningslængde</strong> og{" "}
            <strong>syntaktisk dybde</strong> viser hvor komplekst sproget er
            opbygget. <strong>Pronominer</strong> (jeg/vi) afslører skift i
            identitet og gruppetilhør.
          </p>
          <p>
            Analysen bruger <a href="https://chc.au.dk/research/dacy">DaCy</a>, et dansk NLP framework fra Aarhus Universitet,
            og trækker på samme embeddings som stemningsanalysen. Resultaterne
            viser <em>mønstre</em>, ikke sandheder, de inviterer til
            fortolkning, ikke konklusioner.
          </p>
        </div>
      )}
    </div>
  );
}
