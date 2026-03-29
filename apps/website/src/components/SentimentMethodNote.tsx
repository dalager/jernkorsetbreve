"use client";

import { useState } from "react";

export default function SentimentMethodNote() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-cream border border-faded/20 rounded-lg shadow-sm mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">&#9678;</span>
          <div>
            <h3 className="font-display text-lg text-ink">
              Om stemningsanalysen
            </h3>
            <p className="text-faded text-sm font-ui">
              Hvad kan tallene fortælle — og hvad kan de ikke?
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-faded transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {expanded && (
        <div className="px-6 pb-6 border-t border-faded/10 pt-4">
          <div className="font-body text-ink text-sm leading-relaxed space-y-3 max-w-2xl">
            <p>
              <strong>Hvad er det her?</strong> Hvert brev er opdelt i
              sætninger, og en computer har vurderet hver sætning på en skala
              fra negativ til positiv. Tænk på det som et
              <em> stemningsbarometer</em> — det viser den overordnede retning,
              men ikke den præcise følelse.
            </p>
            <p>
              <strong>Hvordan virker det?</strong> Metoden hedder{" "}
              <em>Concept Vector Projection</em> og er udviklet på Aarhus
              Universitet. Computeren sammenligner hver sætning med kendte
              positive og negative sætninger fra dansk litteratur og giver en
              score mellem -1 (negativ) og +1 (positiv).
            </p>
            <p>
              <strong>Hvad kan det ikke?</strong> Tallene viser tendenser, ikke
              sandheder. En &quot;negativ&quot; score kan betyde sorg,
              bekymring, eller blot en nøgtern beskrivelse af vanskelige forhold
              — metoden kan ikke skelne mellem disse. Metoden er udviklet til
              litterære tekster og er her anvendt på personlige breve for første
              gang.
            </p>
            <p>
              <strong>Stærke og svage signaler.</strong> Nogle mønstre er
              tydelige (f.eks. forskel mellem fred og krig), andre er mere
              usikre (f.eks. gradvise ændringer over tid). Vi angiver altid hvor
              sikre vi er på mønstrene.
            </p>
            <p className="text-faded text-xs">
              Metode:{" "}
              <a
                href="https://arxiv.org/abs/2508.14620"
                target="_blank"
                rel="noopener noreferrer"
                className="text-wax-red hover:underline"
              >
                Lyngbaek et al. 2025, &quot;Continuous Sentiment Scores for
                Literary and Multilingual Contexts&quot;
              </a>{" "}
              — Model: paraphrase-multilingual-mpnet-base-v2
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
