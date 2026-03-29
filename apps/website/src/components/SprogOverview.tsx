"use client";

import { useMemo } from "react";
import type { PsycholinguisticsMap } from "@/types/psycholinguistics";
import {
  periodMeans,
  periodChangePercent,
  reassuranceRatio,
  metricByMonth,
  formatChangePercent,
  WAR_ONSET,
} from "@/lib/psycholinguistic-utils";

interface StatCardProps {
  number: string;
  label: string;
  detail: string;
  onClick?: () => void;
  color?: "red" | "default";
}

function StatCard({ number, label, detail, onClick, color = "default" }: StatCardProps) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`text-left p-4 rounded-lg border border-faded/20 bg-parchment/20 transition-colors ${
        onClick ? "hover:bg-parchment/50 cursor-pointer" : ""
      }`}
    >
      <div
        className={`font-display text-2xl mb-1 ${
          color === "red" ? "text-wax-red" : "text-ink"
        }`}
      >
        {number}
      </div>
      <div className="font-ui text-sm text-ink font-medium">{label}</div>
      <div className="font-ui text-xs text-faded mt-1">{detail}</div>
    </Wrapper>
  );
}

/** Simple SVG sparkline for a metric over time. */
function Sparkline({
  data,
  warOnsetMonth,
}: {
  data: { month: string; mean: number }[];
  warOnsetMonth: string;
}) {
  if (data.length < 2) return null;

  const width = 600;
  const height = 80;
  const padding = { top: 8, right: 8, bottom: 20, left: 8 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const values = data.map((d) => d.mean);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * plotW;
    const y = padding.top + plotH - ((d.mean - min) / range) * plotH;
    return `${x},${y}`;
  });

  // Find war onset x position
  const warIdx = data.findIndex((d) => d.month >= warOnsetMonth.slice(0, 7));
  const warX =
    warIdx >= 0
      ? padding.left + (warIdx / (data.length - 1)) * plotW
      : null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20">
      {warX !== null && (
        <>
          <line
            x1={warX}
            y1={padding.top}
            x2={warX}
            y2={padding.top + plotH}
            stroke="#8B4513"
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity="0.5"
          />
          <text
            x={warX + 3}
            y={padding.top + plotH + 14}
            fill="#8B4513"
            fontSize="9"
            opacity="0.7"
          >
            1914
          </text>
        </>
      )}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="#4A3728"
        strokeWidth="1.5"
        opacity="0.7"
      />
    </svg>
  );
}

interface SprogOverviewProps {
  psycho: PsycholinguisticsMap;
  onNavigateTab: (tab: string) => void;
}

export default function SprogOverview({ psycho, onNavigateTab }: SprogOverviewProps) {
  const stats = useMemo(() => {
    const reassurance = reassuranceRatio(psycho);
    const jegChange = periodChangePercent(psycho, "first_person_singular_rate");
    const absChange = periodChangePercent(psycho, "absolutist_rate");
    const mattrMeans = periodMeans(psycho, "mattr");
    const sentenceLengthMeans = periodMeans(psycho, "mean_sentence_length");

    return { reassurance, jegChange, absChange, mattrMeans, sentenceLengthMeans };
  }, [psycho]);

  const sparklineData = useMemo(
    () => metricByMonth(psycho, "mattr"),
    [psycho]
  );

  return (
    <div className="space-y-6">
      {/* Stat cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          number={formatChangePercent(stats.reassurance.changePercent)}
          label="Beroligende vendinger"
          detail="Stigning i beroligende formuleringer fra førkrig til krigstid"
          onClick={() => onNavigateTab("krigens-sprog")}
          color="red"
        />
        <StatCard
          number={formatChangePercent(stats.jegChange)}
          label="Brug af «jeg»"
          detail="Fald i første person ental — identiteten opløses i det militære kollektiv"
          onClick={() => onNavigateTab("krigens-sprog")}
        />
        <StatCard
          number={formatChangePercent(stats.absChange)}
          label="Absolut sprogbrug"
          detail="Stigning i ord som «altid», «aldrig», «helt» - et muligt stress-signal"
          onClick={() => onNavigateTab("krigens-sprog")}
          color="red"
        />
        <StatCard
          number={`${stats.mattrMeans.preWar.mean.toFixed(2)} → ${stats.mattrMeans.wartime.mean.toFixed(2)}`}
          label="Ordrigdom (MATTR)"
          detail="Ordforrådet indsnævres under pres"
          onClick={() => onNavigateTab("krigens-sprog")}
        />
        <StatCard
          number={`${stats.sentenceLengthMeans.preWar.mean.toFixed(1)} → ${stats.sentenceLengthMeans.wartime.mean.toFixed(1)}`}
          label="Ord pr. sætning"
          detail="Sætningerne forkortes i løbet af krigen"
          onClick={() => onNavigateTab("krigens-sprog")}
        />
        <StatCard
          number="58 brevpar"
          label="Samme dag, to modtagere"
          detail="Peter tilpasser bevidst eller ubevidst sit sprog til Trine og forældrene"
          onClick={() => onNavigateTab("to-modtagere")}
        />
      </div>

      {/* Complexity sparkline */}
      <div className="border border-faded/20 rounded-lg p-4 bg-parchment/10">
        <h3 className="font-ui text-sm text-faded mb-2">
          Ordrigdom over tid (MATTR, månedligt gennemsnit)
        </h3>
        <Sparkline data={sparklineData} warOnsetMonth={WAR_ONSET} />
        <p className="font-ui text-xs text-faded mt-1">
          Højere værdi = mere varieret ordforråd. Den stiplede linje markerer krigens udbrud (august 1914).
        </p>
      </div>
    </div>
  );
}
