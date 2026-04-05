"use client";

import { useState, useEffect, useCallback } from "react";
import { PersonPhoto } from "@/types/letters";

interface LightboxState {
  open: boolean;
  photo: PersonPhoto | null;
}

interface PersonImagesProps {
  photos: PersonPhoto[];
}

export default function PersonImages({ photos }: PersonImagesProps) {
  const [lightbox, setLightbox] = useState<LightboxState>({ open: false, photo: null });

  const closeLightbox = useCallback(() => {
    setLightbox({ open: false, photo: null });
  }, []);

  useEffect(() => {
    if (!lightbox.open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [lightbox.open, closeLightbox]);

  if (photos.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="font-display text-xl text-ink mb-3">Billeder</h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {photos.map((photo) => {
          const label = photo.description_da || photo.description;
          const src = `/images/letters/${photo.path}`;

          return (
            <button
              key={photo.image_id}
              type="button"
              onClick={() => setLightbox({ open: true, photo })}
              className="group text-left bg-cream rounded border border-faded/20 overflow-hidden hover:border-faded/40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-wax-red"
            >
              {/* Thumbnail */}
              <div className="aspect-[4/3] overflow-hidden bg-parchment">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={label}
                  className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                  loading="lazy"
                />
              </div>

              {/* Caption */}
              <div className="px-2 py-2">
                {label && (
                  <p className="font-body text-xs text-ink leading-snug line-clamp-2 mb-1">
                    {label}
                  </p>
                )}
                {photo.date_estimate && (
                  <p className="font-ui text-xs text-faded">{photo.date_estimate}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightbox.open && lightbox.photo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4"
          onClick={closeLightbox}
        >
          <div
            className="relative max-w-3xl w-full bg-cream rounded-lg shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={closeLightbox}
              aria-label="Luk"
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-parchment/80 text-ink hover:bg-parchment transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Full image */}
            <div className="bg-parchment/50 flex items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/images/letters/${lightbox.photo.path}`}
                alt={lightbox.photo.description_da || lightbox.photo.description}
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>

            {/* Description */}
            <div className="px-5 py-4 border-t border-faded/20">
              <p className="font-body text-sm text-ink leading-relaxed">
                {lightbox.photo.description_da || lightbox.photo.description}
              </p>
              {lightbox.photo.date_estimate && (
                <p className="font-ui text-xs text-faded mt-1">
                  {lightbox.photo.date_estimate}
                </p>
              )}
              <p className="font-ui text-xs text-faded/50 mt-2">
                <span className="select-all">{lightbox.photo.image_id}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
