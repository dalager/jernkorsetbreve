"use client";

import { useMemo } from "react";
import type {
  NarrativeArcsData,
  PsycholinguisticsMap,
  ArcType,
} from "@/types/psycholinguistics";
import { recipientGroup } from "@/lib/psycholinguistic-utils";

interface ArcDistributionProps {
  arcs: NarrativeArcsData;
  psycho: PsycholinguisticsMap;
}

const ARC_LABELS: Record<ArcType, string> = {
  valley: "Dal",
  peak: "Top",
  rising: "Stigende",
  falling: "Faldende",
  flat: "Flad",
};

const ARC_ORDER: ArcType[] = ["valley", "peak", "rising", "falling", "flat"];

const TRINE_COLOR = "#8B6F47";
const PARENT_COLOR = "#5B7B6A";

export default function ArcDistribution({ arcs, psycho }: ArcDistributionProps) {
  const counts = useMemo(() => {
    const result: Record<ArcType, { trine: number; parent: number }> = {
      valley: { trine: 0, parent: 0 },
      peak: { trine: 0, parent: 0 },
      rising: { trine: 0, parent: 0 },
      falling: { trine: 0, parent: 0 },
      flat: { trine: 0, parent: 0 },
    };

    for (const [letterId, arc] of Object.entries(arcs.within_letter)) {
      const letter = psycho[letterId];
      if (!letter) continue;
      const group = recipientGroup(letter.recipient);
      if (group === "Trine") {
        result[arc.arc_type].trine++;
      } else if (group === "Forældre") {
        result[arc.arc_type].parent++;
      }
    }

    return result;
  }, [arcs, psycho]);

  const maxVal = useMemo(() => {
    let m = 0;
    for (const arc of ARC_ORDER) {
      m = Math.max(m, counts[arc].trine, counts[arc].parent);
    }
    return m || 1;
  }, [counts]);

  const width = 500;
  const height = 260;
  const pad = { top: 16, right: 48, bottom: 8, left: 90 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const rowH = plotH / ARC_ORDER.length;
  const barH = rowH * 0.32;
  const gap = 2;

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg text-ink">
        Fortællebuer per modtager
      </h3>
      <p className="font-ui text-sm text-faded">
        Fortællebuer beskriver det følelsesmæssige forløb inden for et brev.
        <br />
        En {'"'}Dal{'"'} starter og slutter højt. Tænk {'"'}shit burger{'"'} eller {'"'}kompliment sandwich{'"'}, hvor man pakker det negative budskab ind i en noget positivt for at skåne eller nedtone.
        <br />
        En {'"'}Top{'"'} er omvendt.
      </p>

      {/* Legend */}
      <div className="flex gap-4 font-ui text-xs text-faded">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ backgroundColor: TRINE_COLOR }}
          />
          Trine
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ backgroundColor: PARENT_COLOR }}
          />
          Forældre
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Fortællebuer fordelt på modtagergruppe"
      >
        {ARC_ORDER.map((arcType, i) => {
          const cy = pad.top + i * rowH + rowH / 2;
          const trineW = (counts[arcType].trine / maxVal) * plotW;
          const parentW = (counts[arcType].parent / maxVal) * plotW;

          return (
            <g key={arcType}>
              {/* Row label */}
              <text
                x={pad.left - 8}
                y={cy + 2}
                textAnchor="end"
                className="fill-ink font-ui"
                fontSize={12}
              >
                {ARC_LABELS[arcType]}
              </text>

              {/* Trine bar */}
              <rect
                x={pad.left}
                y={cy - barH - gap / 2}
                width={Math.max(trineW, 1)}
                height={barH}
                rx={2}
                fill={TRINE_COLOR}
                opacity={0.85}
              >
                <title>
                  Trine: {counts[arcType].trine} breve
                </title>
              </rect>
              {counts[arcType].trine > 0 && (
                <text
                  x={pad.left + trineW + 4}
                  y={cy - gap / 2 - barH / 2 + 4}
                  className="fill-faded font-ui"
                  fontSize={10}
                >
                  {counts[arcType].trine}
                </text>
              )}

              {/* Parent bar */}
              <rect
                x={pad.left}
                y={cy + gap / 2}
                width={Math.max(parentW, 1)}
                height={barH}
                rx={2}
                fill={PARENT_COLOR}
                opacity={0.85}
              >
                <title>
                  Forældre: {counts[arcType].parent} breve
                </title>
              </rect>
              {counts[arcType].parent > 0 && (
                <text
                  x={pad.left + parentW + 4}
                  y={cy + gap / 2 + barH / 2 + 4}
                  className="fill-faded font-ui"
                  fontSize={10}
                >
                  {counts[arcType].parent}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
