"use client";

interface BorderToggleProps {
  visible: boolean;
  onToggle: (visible: boolean) => void;
  year: 1914 | 1918;
  onYearChange: (year: 1914 | 1918) => void;
}

export default function BorderToggle({
  visible,
  onToggle,
  year,
  onYearChange,
}: BorderToggleProps) {
  return (
    <div
      className="absolute top-3 right-3 z-[1000] bg-parchment-light border border-faded/20 rounded-lg shadow-sm px-3 py-2 font-ui text-sm pointer-events-auto"
      style={{ minWidth: 180 }}
    >
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => onToggle(e.target.checked)}
          className="accent-ink w-4 h-4"
        />
        <span className="text-ink">Historiske grænser</span>
      </label>

      {visible && (
        <div className="flex gap-2 mt-2">
          {([1914, 1918] as const).map((y) => (
            <button
              key={y}
              onClick={() => onYearChange(y)}
              className={`flex-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
                year === y
                  ? "bg-ink text-parchment"
                  : "bg-parchment border border-faded/30 text-ink hover:bg-parchment-dark"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
