"use client";

import { useState, useEffect, useCallback } from "react";
import { thumbSrc, fullSrc } from "@/lib/image-paths";

interface LetterImageItem {
  image_id: string;
  relevance: string;
  score: number;
  reason_da: string;
}

interface ImageRegistryItem {
  id: string;
  filename: string;
  path: string;
  category: string;
  description: string;
  description_da: string;
  date_estimate: string;
}

interface LetterImagesProps {
  images: Array<{
    image_id: string;
    relevance: string;
    score: number;
    reason_da: string;
  }>;
  imageRegistry: Array<{
    id: string;
    filename: string;
    path: string;
    category: string;
    description: string;
    description_da: string;
    date_estimate: string;
  }>;
}

interface ResolvedImage {
  item: LetterImageItem;
  registry: ImageRegistryItem;
}

interface LightboxState {
  open: boolean;
  image: ResolvedImage | null;
}

export default function LetterImages({ images, imageRegistry }: LetterImagesProps) {
  const [lightbox, setLightbox] = useState<LightboxState>({ open: false, image: null });

  const resolved: ResolvedImage[] = images
    .map((item) => {
      const registry = imageRegistry.find((r) => r.id === item.image_id);
      if (!registry) return null;
      return { item, registry };
    })
    .filter((r): r is ResolvedImage => r !== null);

  const closeLightbox = useCallback(() => {
    setLightbox({ open: false, image: null });
  }, []);

  useEffect(() => {
    if (!lightbox.open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [lightbox.open, closeLightbox]);

  if (resolved.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="font-display text-xl text-ink mb-3">Billeder</h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {resolved.map(({ item, registry }) => {
          const label = registry.description_da || registry.description;
          const src = thumbSrc(registry.path);

          return (
            <button
              key={item.image_id}
              type="button"
              onClick={() => setLightbox({ open: true, image: { item, registry } })}
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
                {registry.date_estimate && (
                  <p className="font-ui text-xs text-faded">{registry.date_estimate}</p>
                )}
                {item.reason_da && (
                  <p className="font-ui text-xs text-faded/80 mt-1 italic line-clamp-2">
                    {item.reason_da}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightbox.open && lightbox.image && (
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
                src={fullSrc(lightbox.image.registry.path)}
                alt={
                  lightbox.image.registry.description_da ||
                  lightbox.image.registry.description
                }
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>

            {/* Description */}
            <div className="px-5 py-4 border-t border-faded/20">
              <p className="font-body text-sm text-ink leading-relaxed">
                {lightbox.image.registry.description_da ||
                  lightbox.image.registry.description}
              </p>
              {lightbox.image.registry.date_estimate && (
                <p className="font-ui text-xs text-faded mt-1">
                  {lightbox.image.registry.date_estimate}
                </p>
              )}
              {lightbox.image.item.reason_da && (
                <p className="font-ui text-xs text-faded/80 mt-2 italic">
                  {lightbox.image.item.reason_da}
                </p>
              )}
              <p className="font-ui text-xs text-faded/50 mt-2">
                <span className="select-all">{lightbox.image.item.image_id}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
