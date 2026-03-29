"use client";

interface WordSelectorProps {
  words: string[];
  mostShifted: string[];
  mostFossilized: string[];
  selected: string;
  onSelect: (word: string) => void;
}

export default function WordSelector({
  words,
  mostShifted,
  selected,
  onSelect,
}: WordSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {words.map((word) => {
        const isSelected = word === selected;
        const isShifted = mostShifted.includes(word);

        return (
          <button
            key={word}
            onClick={() => onSelect(word)}
            className={`relative rounded-full px-4 py-1.5 text-sm font-ui border transition-colors ${
              isSelected
                ? "bg-wax-red/10 border-wax-red text-ink font-medium"
                : "bg-parchment/30 border-faded/20 text-faded hover:text-ink"
            }`}
          >
            {word}
            {isShifted && (
              <span className="absolute -top-0.5 -right-0.5 block h-2 w-2 rounded-full bg-wax-red" />
            )}
          </button>
        );
      })}
    </div>
  );
}
