"use client";

import { useEffect, useRef } from "react";

const MONTH_NAMES = [
  "Januar",
  "Februar",
  "Marts",
  "April",
  "Maj",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "December",
];

interface ExplorerTimelineProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

const START = new Date("1911-01-01").getTime();
const END = new Date("1918-12-31").getTime();
const RANGE = END - START;

export default function ExplorerTimeline({
  isPlaying,
  onTogglePlay,
  currentDate,
  onDateChange,
  speed,
  onSpeedChange,
}: ExplorerTimelineProps) {
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const dateRef = useRef(currentDate.getTime());
  const speedRef = useRef(speed);
  const onDateChangeRef = useRef(onDateChange);
  const onTogglePlayRef = useRef(onTogglePlay);

  // Keep refs in sync with latest props
  dateRef.current = currentDate.getTime();
  speedRef.current = speed;
  onDateChangeRef.current = onDateChange;
  onTogglePlayRef.current = onTogglePlay;

  useEffect(() => {
    if (!isPlaying) return;

    lastFrameRef.current = 0;

    const advance = (timestamp: number) => {
      if (lastFrameRef.current === 0) {
        lastFrameRef.current = timestamp;
        rafRef.current = requestAnimationFrame(advance);
        return;
      }
      const elapsed = timestamp - lastFrameRef.current;
      lastFrameRef.current = timestamp;

      // At 1x speed: traverse the full range in ~96 seconds (8 years * 12 months)
      const increment = elapsed * speedRef.current * (RANGE / (8 * 12 * 1000));
      const newTime = dateRef.current + increment;

      if (newTime >= END) {
        onDateChangeRef.current(new Date(END));
        onTogglePlayRef.current();
        return;
      }
      onDateChangeRef.current(new Date(newTime));
      rafRef.current = requestAnimationFrame(advance);
    };

    rafRef.current = requestAnimationFrame(advance);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  const sliderValue = ((currentDate.getTime() - START) / RANGE) * 1000;

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ratio = Number(e.target.value) / 1000;
    onDateChange(new Date(START + ratio * RANGE));
  };

  const label = `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  return (
    <div className="flex items-center gap-3 rounded border border-faded/20 bg-parchment-light px-4 py-2">
      <button
        onClick={onTogglePlay}
        className="flex h-11 w-11 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded bg-ink text-parchment-light transition-colors hover:bg-ink-light"
        aria-label={isPlaying ? "Pause" : "Afspil"}
      >
        {isPlaying ? (
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="2" width="4" height="12" rx="1" />
            <rect x="9" y="2" width="4" height="12" rx="1" />
          </svg>
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2l10 6-10 6V2z" />
          </svg>
        )}
      </button>

      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(sliderValue)}
        onChange={handleSlider}
        className="h-2 flex-1 cursor-pointer appearance-none rounded bg-parchment-dark accent-ink [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6"
      />

      <span className="w-32 shrink-0 text-center font-ui text-ui-sm font-medium text-ink">
        {label}
      </span>

      <div className="flex shrink-0 gap-1">
        {[1, 2, 5].map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`rounded px-2 py-0.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 font-ui text-ui-sm transition-colors ${
              speed === s
                ? "bg-ink text-parchment-light"
                : "text-faded hover:bg-parchment-dark hover:text-ink"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
