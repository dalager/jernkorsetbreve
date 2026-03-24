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
  const sentimentLabel =
    sentiment > 10 ? "Positiv" : sentiment < -10 ? "Negativ" : "Neutral";
  const sentimentColor =
    sentiment > 10
      ? "text-green-700"
      : sentiment < -10
        ? "text-red-700"
        : "text-amber-700";

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
        {sender} &rarr; {recipient}
      </p>
      {place && (
        <p className="font-ui text-ui-sm text-faded">{place}</p>
      )}
      <div className="mt-1 flex items-center gap-3 border-t border-faded/20 pt-1">
        <span className={`font-ui text-ui-sm font-medium ${sentimentColor}`}>
          {sentimentLabel} ({sentiment})
        </span>
        <span className="font-ui text-ui-sm text-faded">{clusterLabel}</span>
      </div>
    </div>
  );
}
