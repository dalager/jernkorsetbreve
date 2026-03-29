"use client";

import React from "react";
import Link from "next/link";
import type { LetterSentiment, SentenceScore } from "@/types/letters";
import {
  sentimentBgColor,
  sentimentBorderColor,
  sentimentGradientColor,
  formatScore,
  formatNegativeRatio,
} from "@/lib/sentiment-utils";
import { sentimentColor, sentimentCategory } from "@/lib/timeline-utils";

interface SentimentLetterDetailProps {
  letterId: number;
  letterDate: string;
  letterSender: string;
  letterRecipient: string;
  letterPlace: string;
  sentiment: LetterSentiment;
  sentences: SentenceScore[];
  onClose: () => void;
}

function NarrativeArcSparkline({ sentences }: { sentences: SentenceScore[] }) {
  if (sentences.length === 0) return null;
  const W = 600, H = 60, PAD_X = 4, PAD_Y = 6;
  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_Y * 2;
  const maxAbs = Math.max(0.3, ...sentences.map((s) => Math.abs(s.score)));

  function sx(i: number): number {
    if (sentences.length === 1) return W / 2;
    return PAD_X + (i / (sentences.length - 1)) * plotW;
  }

  function sy(score: number): number {
    return PAD_Y + ((maxAbs - score) / (2 * maxAbs)) * plotH;
  }

  const zeroY = sy(0);
  const segments: React.ReactNode[] = [];
  for (let i = 0; i < sentences.length - 1; i++) {
    const x1 = sx(i);
    const y1 = sy(sentences[i].score);
    const x2 = sx(i + 1);
    const y2 = sy(sentences[i + 1].score);
    const midScore = (sentences[i].score + sentences[i + 1].score) / 2;
    segments.push(
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={sentimentGradientColor(midScore)}
        strokeWidth={2}
        strokeLinecap="round"
      />
    );
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 60 }}
      preserveAspectRatio="none"
      aria-label="Stemningskurve henover brevet"
    >
      <line
        x1={PAD_X}
        y1={zeroY}
        x2={W - PAD_X}
        y2={zeroY}
        stroke="rgba(156,143,128,0.35)"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      {segments}
      {sentences.map((s, i) => (
        <circle
          key={i}
          cx={sx(i)}
          cy={sy(s.score)}
          r={2.5}
          fill={sentimentGradientColor(s.score)}
          opacity={s.is_formulaic ? 0.4 : 1}
        />
      ))}
    </svg>
  );
}

function Badge({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-ui"
      style={{
        backgroundColor: color
          ? `${color}1a`
          : "rgba(156,143,128,0.12)",
        color: color ?? "var(--color-ink, #3b3228)",
      }}
    >
      {color && (
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="text-faded">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

export default function SentimentLetterDetail({
  letterId,
  letterDate,
  letterSender,
  letterRecipient,
  letterPlace,
  sentiment,
  sentences,
  onClose,
}: SentimentLetterDetailProps) {
  const cat = sentimentCategory(sentiment.cvp_mean);
  const catLabel: Record<string, string> = {
    positiv: "Positiv",
    negativ: "Negativ",
    neutral: "Neutral",
  };

  return (
    <div className="bg-cream rounded-lg border border-faded/20 shadow-letter">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-faded/10">
        <div>
          <h3 className="font-display text-lg text-ink leading-tight">
            {letterDate}
          </h3>
          <p className="font-body text-sm text-faded mt-0.5">
            {letterSender} → {letterRecipient}
            {letterPlace && (
              <span className="ml-1.5 text-faded/70">({letterPlace})</span>
            )}
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-parchment-light transition-colors text-faded hover:text-ink"
          aria-label="Luk"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2 px-5 py-3">
        <Badge
          label="Stemning:"
          value={`${formatScore(sentiment.cvp_mean)} (${catLabel[cat]})`}
          color={sentimentColor(sentiment.cvp_mean)}
        />
        <Badge
          label="Spændvidde:"
          value={sentiment.cvp_range.toFixed(2)}
        />
        <Badge
          label="Negativt:"
          value={formatNegativeRatio(sentiment.negative_ratio)}
        />
        <Badge
          label="Sætninger:"
          value={`${sentiment.sentence_count_substantive} / ${sentiment.sentence_count}`}
        />
      </div>

      {/* Narrative arc sparkline */}
      {sentences.length > 1 && (
        <div className="px-5 pb-2">
          <p className="text-xs font-ui text-faded mb-1">
            Stemningskurve henover brevet
          </p>
          <div className="bg-parchment-light rounded border border-faded/10 p-2">
            <NarrativeArcSparkline sentences={sentences} />
          </div>
        </div>
      )}

      {/* Sentence-by-sentence */}
      <div className="px-5 py-3 space-y-1">
        {sentences.map((s) => (
          <div
            key={`${s.letter_id}-${s.index}`}
            className={`flex items-start gap-2 rounded px-3 py-1.5 ${
              s.is_formulaic ? "opacity-50 italic" : ""
            }`}
            style={{
              borderLeft: `3px solid ${sentimentBorderColor(s.score)}`,
              backgroundColor: sentimentBgColor(s.score, 0.08),
            }}
          >
            <span className="font-body text-ink text-sm flex-1 leading-relaxed">
              {s.text}
            </span>
            <span
              className="shrink-0 text-xs font-ui mt-0.5 tabular-nums"
              style={{ color: sentimentGradientColor(s.score) }}
            >
              {formatScore(s.score)}
            </span>
          </div>
        ))}
        {sentences.length === 0 && (
          <p className="text-sm text-faded font-ui py-4 text-center">
            Ingen sætningsscorer tilgængelige for dette brev.
          </p>
        )}
      </div>

      {/* Link to full letter */}
      <div className="px-5 pb-4 pt-1 border-t border-faded/10">
        <Link
          href={`/letters/${letterId}/`}
          className="text-sm font-ui text-wax-red hover:underline"
        >
          Læs hele brevet →
        </Link>
      </div>
    </div>
  );
}
