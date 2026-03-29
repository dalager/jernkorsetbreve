"use client";

import { formatScore } from "@/lib/sentiment-utils";

interface Signal {
  title: string;
  description: string;
  confidence: "strong" | "weak";
  value?: string;
}

interface SentimentSignalsProps {
  preWarMean?: number;
  warMean?: number;
  overallMean?: number;
  mostNegativeMonth?: string;
  onSelectLetter?: (id: number) => void;
}

function buildSignals({
  preWarMean,
  warMean,
  overallMean,
  mostNegativeMonth,
}: Omit<SentimentSignalsProps, "onSelectLetter">): Signal[] {
  const signals: Signal[] = [];

  // Strong: pre-war vs wartime difference
  if (preWarMean !== undefined && warMean !== undefined) {
    const diff = warMean - preWarMean;
    const direction = diff < 0 ? "lavere" : "højere";
    signals.push({
      title: "Forskel mellem fred og krig",
      description:
        `Breve fra krigsårene har en gennemsnitlig stemningsscore der er ${Math.abs(diff).toFixed(2)} ${direction} end breve fra før krigen. Denne forskel er tydelig og konsistent på tværs af måneder. Og det kan man så tænke lidt over.`,
      confidence: "strong",
      value: `${formatScore(preWarMean)} → ${formatScore(warMean)}`,
    });
  }

  // Strong: overall corpus tendency
  if (overallMean !== undefined) {
    const tendency =
      overallMean < -0.05
        ? "en overvejende negativ"
        : overallMean > 0.05
          ? "en overvejende positiv"
          : "en neutral";
    signals.push({
      title: "Samlet stemning i brevene",
      description:
        `Brevene har ${tendency} gennemsnitsscore. Dette afspejler brevenes indhold, men kan også påvirkes af den sproglige stil og periodens konventioner for brevskrivning.`,
      confidence: "strong",
      value: formatScore(overallMean),
    });
  }

  // Weak: seasonal patterns
  signals.push({
    title: "Sæsonmæssige mønstre",
    description:
      "Der er en smule sæsonvariation i stemningsscorerne, men datamængden er for begrænset til at at sige noget sikkert. ",
    confidence: "weak",
  });

  // Weak: recipient differences
  signals.push({
    title: "Forskelle mellem modtagere",
    description:
      "Der er noget der tyder på at der er forskel på stemningen afhængigt af modtageren. Det er ikke overraskende, men det er ikke et superstærkt signal. Og dét er måske lidt overraskende.",
    confidence: "weak",
  });

  // Weak: most negative month
  if (mostNegativeMonth) {
    signals.push({
      title: "Mest negative måned",
      description:
        `Måneden ${mostNegativeMonth} skiller sig ud med de laveste stemningsscorer. Det kan afspejle historiske begivenheder, men kan også skyldes tilfældig variation i de få breve fra perioden.`,
      confidence: "weak",
      value: mostNegativeMonth,
    });
  }

  return signals;
}

const CONFIDENCE_STYLES: Record<
  Signal["confidence"],
  { border: string; badge: string; badgeText: string; label: string }
> = {
  strong: {
    border: "border-l-green-700",
    badge: "bg-green-100 text-green-800",
    badgeText: "Stærkt signal",
    label: "Stærke signaler",
  },
  weak: {
    border: "border-l-amber-500",
    badge: "bg-amber-50 text-amber-700",
    badgeText: "Svagt signal",
    label: "Svage signaler",
  },
};

function SignalCard({ signal }: { signal: Signal }) {
  const style = CONFIDENCE_STYLES[signal.confidence];

  return (
    <div
      className={`bg-parchment-light border border-faded/20 ${style.border} border-l-4 rounded-lg p-5 shadow-sm`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="font-display text-base text-ink">{signal.title}</h4>
        <span
          className={`${style.badge} text-xs font-ui px-2 py-0.5 rounded-full whitespace-nowrap`}
        >
          {style.badgeText}
        </span>
      </div>
      <p className="font-body text-sm text-ink leading-relaxed">
        {signal.description}
      </p>
      {signal.value && (
        <p className="mt-2 font-display text-lg text-ink">{signal.value}</p>
      )}
    </div>
  );
}

export default function SentimentSignals({
  preWarMean,
  warMean,
  overallMean,
  mostNegativeMonth,
}: SentimentSignalsProps) {
  const signals = buildSignals({
    preWarMean,
    warMean,
    overallMean,
    mostNegativeMonth,
  });

  const strong = signals.filter((s) => s.confidence === "strong");
  const weak = signals.filter((s) => s.confidence === "weak");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg text-ink mb-1">
          Stærke og svage signaler
        </h3>
        <p className="text-faded text-sm font-ui mb-4">
          Hvad kan vi sige med sikkerhed — og hvad kræver mere udforskning?
        </p>
      </div>

      {strong.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-ui text-faded uppercase tracking-wide">
            Stærke signaler
          </h4>
          {strong.map((s, i) => (
            <SignalCard key={i} signal={s} />
          ))}
        </div>
      )}

      {weak.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-ui text-faded uppercase tracking-wide">
            Svage signaler
          </h4>
          {weak.map((s, i) => (
            <SignalCard key={i} signal={s} />
          ))}
        </div>
      )}
    </div>
  );
}
