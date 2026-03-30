import { sentimentLabel as getSentimentLabel, sentimentCss } from "@/lib/timeline-utils";

interface ExplorerTooltipProps {
  x: number;
  y: number;
  date: string;
  sender: string;
  recipient: string;
  place: string;
  sentiment: number;
  clusterLabel: string;
}

export default function ExplorerTooltip({
  x,
  y,
  date,
  sender,
  recipient,
  place,
  sentiment,
  clusterLabel,
}: ExplorerTooltipProps) {
  return (
    <div
      className="pointer-events-none absolute z-50 rounded border border-faded/30 bg-parchment-light px-3 py-2 shadow-letter"
      style={{
        left: x + 14,
        top: y - 10,
        maxWidth: 280,
      }}
    >
      <p className="font-ui text-ui-sm font-medium text-ink">{date}</p>
      <p className="font-ui text-ui-sm text-faded-dark">
        {sender} → {recipient}
      </p>
      {place && (
        <p className="font-ui text-ui-sm text-faded">{place}</p>
      )}
      <div className="mt-1 flex items-center gap-3 border-t border-faded/20 pt-1">
        <span className={`font-ui text-ui-sm font-medium ${sentimentCss(sentiment)}`}>
          {getSentimentLabel(sentiment)} ({sentiment.toFixed(2)})
        </span>
        <span className="font-ui text-ui-sm text-faded">{clusterLabel}</span>
      </div>
    </div>
  );
}
