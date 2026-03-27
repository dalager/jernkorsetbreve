"use client";

interface Sender {
  name: string;
  count: number;
}

interface TimelineControlsProps {
  senders: Sender[];
  selectedSender: string;
  onSenderChange: (sender: string) => void;
  showSentiment: boolean;
  onToggleSentiment: () => void;
  showBattles: boolean;
  onToggleBattles: () => void;
  showDensity: boolean;
  onToggleDensity: () => void;
  onResetZoom: () => void;
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`
          relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none
          ${checked ? "bg-ink-light" : "bg-faded-light/40"}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-4 w-4 rounded-full bg-parchment-light
            shadow-sm transition-transform duration-200 ease-in-out
            ${checked ? "translate-x-4" : "translate-x-0"}
          `}
        />
      </button>
      <span className="text-xs font-ui text-faded">{label}</span>
    </label>
  );
}

export default function TimelineControls({
  senders,
  selectedSender,
  onSenderChange,
  showSentiment,
  onToggleSentiment,
  showBattles,
  onToggleBattles,
  showDensity,
  onToggleDensity,
  onResetZoom,
}: TimelineControlsProps) {
  return (
    <div className="flex flex-wrap gap-4 mb-4 items-end">
      <div>
        <label className="block text-xs font-ui text-faded mb-1">Afsender</label>
        <select
          value={selectedSender}
          onChange={(e) => onSenderChange(e.target.value)}
          className="bg-parchment-light border border-faded/30 rounded px-3 py-1.5 text-sm font-ui text-ink"
        >
          <option value="all">Alle afsendere</option>
          {senders.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name} ({s.count})
            </option>
          ))}
        </select>
      </div>

      <Toggle checked={showSentiment} onChange={onToggleSentiment} label="Vis stemning" />
      <Toggle checked={showBattles} onChange={onToggleBattles} label="Vis slag" />
      <Toggle checked={showDensity} onChange={onToggleDensity} label="Vis densitet" />

      <button
        type="button"
        onClick={onResetZoom}
        className="px-3 py-1.5 text-xs font-ui text-faded border border-faded/30 rounded
                   hover:bg-parchment-dark transition-colors"
      >
        Nulstil zoom
      </button>
    </div>
  );
}
