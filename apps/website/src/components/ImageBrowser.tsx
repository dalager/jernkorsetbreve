"use client";

import { useState, useEffect, useCallback } from "react";
import { thumbSrc, fullSrc } from "@/lib/image-paths";
import type { ImageRegistryEntry } from "@/types/letters";

interface ImageBrowserProps {
  images: ImageRegistryEntry[];
  grouped: Record<string, ImageRegistryEntry[]>;
  categoryLabels: Record<string, string>;
  categoryOrder: string[];
}

export default function ImageBrowser({
  images,
  grouped,
  categoryLabels,
  categoryOrder,
}: ImageBrowserProps) {
  const [filter, setFilter] = useState<string>("all");
  const [lightbox, setLightbox] = useState<ImageRegistryEntry | null>(null);

  const closeLightbox = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    if (!lightbox) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [lightbox, closeLightbox]);

  const filtered =
    filter === "all" ? images : images.filter((i) => i.category === filter);

  return (
    <>
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded text-sm font-ui transition-colors ${
            filter === "all"
              ? "bg-ink text-cream"
              : "bg-cream text-ink border border-faded/20 hover:bg-parchment"
          }`}
        >
          Alle ({images.length})
        </button>
        {categoryOrder.map((cat) => {
          const count = grouped[cat]?.length ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded text-sm font-ui transition-colors ${
                filter === cat
                  ? "bg-ink text-cream"
                  : "bg-cream text-ink border border-faded/20 hover:bg-parchment"
              }`}
            >
              {categoryLabels[cat] ?? cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Image grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filtered.map((img) => {
          const label = img.description_da || img.description;
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => setLightbox(img)}
              className="group text-left bg-cream rounded border border-faded/20 overflow-hidden hover:border-faded/40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-wax-red"
            >
              <div className="aspect-[4/3] overflow-hidden bg-parchment">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbSrc(img.path)}
                  alt={label}
                  className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                  loading="lazy"
                />
              </div>
              <div className="px-2 py-1.5">
                {label && (
                  <p className="font-body text-xs text-ink leading-snug line-clamp-2">
                    {label}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  {img.date_estimate && (
                    <span className="font-ui text-xs text-faded">
                      {img.date_estimate}
                    </span>
                  )}
                  <span className="font-ui text-xs text-faded/50">
                    {img.id}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-faded font-body py-12">
          Ingen billeder i denne kategori.
        </p>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4"
          onClick={closeLightbox}
        >
          <div
            className="relative max-w-4xl w-full bg-cream rounded-lg shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeLightbox}
              aria-label="Luk"
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-parchment/80 text-ink hover:bg-parchment transition-colors"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <div className="bg-parchment/50 flex items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fullSrc(lightbox.path)}
                alt={lightbox.description_da || lightbox.description}
                className="max-h-[75vh] w-auto object-contain"
              />
            </div>

            <div className="px-5 py-4 border-t border-faded/20">
              <p className="font-body text-sm text-ink leading-relaxed">
                {lightbox.description_da || lightbox.description}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                {lightbox.date_estimate && (
                  <span className="font-ui text-xs text-faded">
                    {lightbox.date_estimate}
                  </span>
                )}
                <span className="font-ui text-xs text-faded/50 uppercase tracking-wide">
                  {categoryLabels[lightbox.category] ?? lightbox.category}
                </span>
                {lightbox.persons.length > 0 && (
                  <span className="font-ui text-xs text-faded">
                    Personer: {lightbox.persons.join(", ")}
                  </span>
                )}
                {lightbox.places.length > 0 && (
                  <span className="font-ui text-xs text-faded">
                    Steder: {lightbox.places.join(", ")}
                  </span>
                )}
              </div>
              <p className="font-ui text-xs text-faded/50 mt-2">
                <span className="select-all">{lightbox.id}</span>
                {" "}&middot; {lightbox.filename} &middot;{" "}
                {lightbox.width}&times;{lightbox.height}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
