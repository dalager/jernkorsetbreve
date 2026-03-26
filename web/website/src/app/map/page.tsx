"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

interface Place {
  name: string;
  lat: number;
  lng: number;
  letterCount: number;
}

interface Letter {
  id: number;
  date: string;
  sender: string;
  recipient: string;
  place: string;
  location?: { lat: number; lng: number } | null;
}

function MapPageContent() {
  const searchParams = useSearchParams();
  const initialPlace = searchParams.get("place");

  const [letters, setLetters] = useState<Letter[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(
    initialPlace
  );
  const [sidebarSearch, setSidebarSearch] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lettersRes, placesRes] = await Promise.all([
          fetch("/data/letters.json"),
          fetch("/data/places.json"),
        ]);
        if (!lettersRes.ok) throw new Error("Kunne ikke hente breve");

        const lettersData: Letter[] = await lettersRes.json();
        setLetters(lettersData);

        // Try places.json first, fall back to computing from letters
        if (placesRes.ok) {
          const placesData: Place[] = await placesRes.json();
          if (placesData.length > 0) {
            setPlaces(placesData);
          } else {
            setPlaces(computePlacesFromLetters(lettersData));
          }
        } else {
          setPlaces(computePlacesFromLetters(lettersData));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ukendt fejl");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredPlaces = useMemo(() => {
    if (!sidebarSearch) return places;
    const q = sidebarSearch.toLowerCase();
    return places.filter((p) => p.name.toLowerCase().includes(q));
  }, [places, sidebarSearch]);

  const totalLettersOnMap = useMemo(() => {
    return places.reduce((sum, p) => sum + p.letterCount, 0);
  }, [places]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center">
        <div className="animate-pulse">
          <div className="h-8 bg-parchment-dark rounded w-48 mx-auto mb-4" />
          <div className="h-4 bg-parchment-dark rounded w-64 mx-auto" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center">
        <h1 className="font-display text-3xl text-ink mb-4">Kort</h1>
        <p className="text-faded">Data er ikke tilg&aelig;ngelig: {error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-4">
        <h1 className="font-display text-3xl text-ink mb-2">Kort</h1>
        <p className="text-faded font-ui text-sm">
          {places.length} steder med {totalLettersOnMap} breve.
          Klik p&aring; en mark&oslash;r for at se breve fra det sted.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4" style={{ height: 600 }}>
        {/* Sidebar */}
        <div className="lg:w-72 flex-shrink-0 bg-parchment-light border border-faded/20 rounded-lg overflow-hidden flex flex-col shadow-sm">
          <div className="p-3 border-b border-faded/20">
            <input
              type="text"
              placeholder="S&oslash;g sted..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="w-full bg-parchment border border-faded/30 rounded px-3 py-1.5 text-sm font-ui text-ink placeholder:text-faded/60"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filteredPlaces.map((place) => (
              <button
                key={place.name}
                onClick={() => setSelectedPlace(place.name)}
                className={`w-full text-left px-3 py-2 text-sm font-ui border-b border-faded/10 transition-colors ${
                  selectedPlace === place.name
                    ? "bg-parchment text-ink font-medium"
                    : "text-ink hover:bg-parchment/50"
                }`}
              >
                <span className="block truncate">{place.name}</span>
                <span className="text-xs text-faded">
                  {place.letterCount} brev{place.letterCount !== 1 ? "e" : ""}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 rounded-lg overflow-hidden border border-faded/20 shadow-sm">
          <MapView
            places={places}
            letters={letters}
            selectedPlace={selectedPlace}
            onPlaceSelect={setSelectedPlace}
          />
        </div>
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto py-12 text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-parchment-dark rounded w-48 mx-auto mb-4" />
            <div className="h-4 bg-parchment-dark rounded w-64 mx-auto" />
          </div>
        </div>
      }
    >
      <MapPageContent />
    </Suspense>
  );
}

function computePlacesFromLetters(letters: Letter[]): Place[] {
  const map = new Map<
    string,
    { lat: number; lng: number; count: number }
  >();
  letters.forEach((l) => {
    if (!l.place || !l.location) return;
    const existing = map.get(l.place);
    if (existing) {
      existing.count++;
    } else {
      map.set(l.place, {
        lat: l.location.lat,
        lng: l.location.lng,
        count: 1,
      });
    }
  });
  return Array.from(map.entries())
    .map(([name, data]) => ({
      name,
      lat: data.lat,
      lng: data.lng,
      letterCount: data.count,
    }))
    .sort((a, b) => b.letterCount - a.letterCount);
}
