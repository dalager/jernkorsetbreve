"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

interface PlaceData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  letterCount: number;
}

interface StederMapOverviewProps {
  places: PlaceData[];
}

export default function StederMapOverview({ places }: StederMapOverviewProps) {
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);

  const selected = places.find((p) => p.name === selectedPlace);

  return (
    <section className="mb-10">
      <h2 className="font-ui text-xs uppercase tracking-widest text-faded border-b border-faded/20 pb-1 mb-4">
        Kort
      </h2>
      <div className="rounded-lg overflow-hidden border border-faded/20 shadow-sm h-[400px] relative">
        <MapView
          places={places}
          letters={[]}
          selectedPlace={selectedPlace}
          onPlaceSelect={setSelectedPlace}
        />
      </div>
      {selected && (
        <div className="mt-2 text-sm font-ui text-faded">
          <Link
            href={`/steder/${places.find((p) => p.name === selectedPlace)?.id}/`}
            className="text-ink hover:text-wax-red transition-colors"
          >
            {selected.name}
          </Link>
          {" — "}
          {selected.letterCount} {selected.letterCount === 1 ? "brev" : "breve"}
        </div>
      )}
    </section>
  );
}
