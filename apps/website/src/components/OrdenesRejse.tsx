"use client";

import { useState, useMemo } from "react";
import type { SemanticShiftsData } from "@/types/psycholinguistics";
import WordSelector from "./WordSelector";
import WordDriftChart from "./WordDriftChart";

interface OrdenesRejseProps {
  shifts: SemanticShiftsData;
}

/* ------------------------------------------------------------------ */
/*  Hardcoded interpretations for key words                           */
/* ------------------------------------------------------------------ */
const INTERPRETATIONS: Record<string, string> = {
  hjem: "I 1911 bruger Peter \u00ABhjem\u00BB om sin g\u00E5rd. I 1916 er \u00ABhjem\u00BB blevet et ord for det han l\u00E6nges efter \u2014 en dr\u00F8m mere end et sted.",
  godt: "\u00ABGodt\u00BB skifter fra neutral konstatering til aktivt fors\u00F8g p\u00E5 at berolige.",
  stille: "Fra bogstavelig stilhed til den uhyggelige ro mellem angreb.",
};

export default function OrdenesRejse({ shifts }: OrdenesRejseProps) {
  const words = useMemo(
    () => Object.keys(shifts.target_words),
    [shifts.target_words],
  );

  const defaultWord = words.includes("hjem") ? "hjem" : words[0] ?? "";
  const [selected, setSelected] = useState(defaultWord);

  /* Drift ranking: total absolute drift per word */
  const ranking = useMemo(() => {
    return words
      .map((w) => {
        const ws = shifts.target_words[w];
        const totalDrift = ws.drift.reduce(
          (sum, d) => sum + Math.abs(d.delta_mean),
          0,
        );
        return { word: w, total: ws.total_occurrences, drift: totalDrift };
      })
      .sort((a, b) => b.drift - a.drift);
  }, [words, shifts.target_words]);

  const selectedData = shifts.target_words[selected];
  const interpretation = INTERPRETATIONS[selected];

  return (
    <div className="space-y-8">
      {/* Intro */}
      <p className="font-body text-body-md text-ink/80 max-w-prose">
        Ord ændrer betydning over tid. Ved at måle hvordan et ord
        bruges i sætninger år for år, kan vi se hvordan krigen
        forskubbede hverdagssprogets betydning.
      </p>

      {/* Word selector */}
      <WordSelector
        words={words}
        mostShifted={shifts.most_shifted}
        mostFossilized={shifts.most_fossilized}
        selected={selected}
        onSelect={setSelected}
      />

      {/* Drift chart for selected word */}
      {selectedData && (
        <div className="rounded-lg border border-faded/20 bg-parchment/20 p-4">
          <h3 className="font-display text-lg text-ink mb-3">
            Semantisk drift: &laquo;{selected}&raquo;
          </h3>
          <WordDriftChart word={selected} data={selectedData} />

          {/* Interpretation */}
          {interpretation && (
            <p className="mt-4 font-body text-body-sm text-ink/70 italic border-l-2 border-wax-red/40 pl-3">
              {interpretation}
            </p>
          )}
        </div>
      )}

      {/* Drift ranking table */}
      <div>
        <h3 className="font-display text-lg text-ink mb-3">
          Driftrangering
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full font-ui text-sm">
            <thead>
              <tr className="border-b border-faded/20 text-left">
                <th className="py-2 pr-4 text-faded font-medium">Ord</th>
                <th className="py-2 pr-4 text-faded font-medium text-right">
                  Forekomster
                </th>
                <th className="py-2 pr-4 text-faded font-medium text-right">
                  Samlet drift
                </th>
                <th className="py-2 text-faded font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((row) => {
                const isSelected = row.word === selected;
                const isShifted = shifts.most_shifted.includes(row.word);
                const isFossilized = shifts.most_fossilized.includes(row.word);

                return (
                  <tr
                    key={row.word}
                    onClick={() => setSelected(row.word)}
                    className={`border-b border-faded/10 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-wax-red/5"
                        : "hover:bg-parchment/40"
                    }`}
                  >
                    <td className="py-2 pr-4 text-ink font-medium">
                      {row.word}
                    </td>
                    <td className="py-2 pr-4 text-ink text-right">
                      {row.total}
                    </td>
                    <td className="py-2 pr-4 text-ink text-right">
                      {row.drift.toFixed(4)}
                    </td>
                    <td className="py-2">
                      {isShifted && (
                        <span className="inline-block rounded-full bg-wax-red/10 text-wax-red text-xs px-2 py-0.5 font-medium">
                          Mest forskudt
                        </span>
                      )}
                      {isFossilized && (
                        <span className="inline-block rounded-full bg-faded/10 text-faded text-xs px-2 py-0.5 font-medium">
                          Mest stabilt
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
