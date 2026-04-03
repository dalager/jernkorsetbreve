"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "jernkorset-text-mode";

interface LetterContentProps {
  textOriginal: string;
  textModern?: string;
}

export default function LetterContent({
  textOriginal,
  textModern,
}: LetterContentProps) {
  const [isModern, setIsModern] = useState(false);

  // Read persisted preference on mount (SSR-safe)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "modern") setIsModern(true);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const handleToggle = (modern: boolean) => {
    setIsModern(modern);
    try {
      localStorage.setItem(STORAGE_KEY, modern ? "modern" : "original");
    } catch {
      // localStorage unavailable
    }
  };

  const showModern = isModern && !!textModern;

  return (
    <div className="px-6 py-8 sm:px-8">
      {textModern && (
        <div className="flex items-center gap-1 mb-6 font-ui text-sm" data-testid="text-mode-toggle">
          <button
            onClick={() => handleToggle(false)}
            className={`px-3 py-1.5 rounded-l-md border transition-colors ${
              !isModern
                ? "bg-ink text-parchment border-ink"
                : "bg-parchment border-faded/30 text-ink hover:bg-parchment-dark"
            }`}
          >
            Original
          </button>
          <button
            onClick={() => handleToggle(true)}
            className={`px-3 py-1.5 rounded-r-md border border-l-0 transition-colors ${
              isModern
                ? "bg-ink text-parchment border-ink"
                : "bg-parchment border-faded/30 text-ink hover:bg-parchment-dark"
            }`}
          >
            Moderne dansk
          </button>
        </div>
      )}
      <div
        className="font-body text-ink text-lg leading-relaxed [&>p]:mb-4 [&>p:last-child]:mb-0"
        data-testid="letter-text"
        dangerouslySetInnerHTML={{
          __html: showModern ? textModern : textOriginal,
        }}
      />
    </div>
  );
}
