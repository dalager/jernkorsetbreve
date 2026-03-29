"use client";

import Link from "next/link";

interface LetterNavigationProps {
  currentId: number;
  totalLetters: number;
}

export default function LetterNavigation({
  currentId,
  totalLetters,
}: LetterNavigationProps) {
  const hasPrevious = currentId > 1;
  const hasNext = totalLetters > 0 ? currentId < totalLetters : true;

  return (
    <div className="flex items-center justify-end">
      <div className="flex items-center gap-1">
        {hasPrevious ? (
          <Link
            href={`/letters/${currentId - 1}/`}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-ui text-faded hover:text-ink hover:bg-parchment/50 rounded-md transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="hidden sm:inline">Forrige</span>
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-ui text-faded/40 cursor-not-allowed">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="hidden sm:inline">Forrige</span>
          </span>
        )}

        <span className="text-faded font-ui text-sm px-2">
          {currentId}
          {totalLetters > 0 ? ` / ${totalLetters}` : ""}
        </span>

        {hasNext ? (
          <Link
            href={`/letters/${currentId + 1}/`}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-ui text-faded hover:text-ink hover:bg-parchment/50 rounded-md transition-colors"
          >
            <span className="hidden sm:inline">Næste</span>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-ui text-faded/40 cursor-not-allowed">
            <span className="hidden sm:inline">Næste</span>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}
