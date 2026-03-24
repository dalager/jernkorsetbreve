"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

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
}

interface MapViewProps {
  places: Place[];
  letters: Letter[];
  selectedPlace: string | null;
  onPlaceSelect: (name: string | null) => void;
}

function FlyToPlace({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 8, { duration: 1 });
  }, [map, lat, lng]);
  return null;
}

function getMarkerRadius(count: number, maxCount: number): number {
  const minR = 5;
  const maxR = 25;
  if (maxCount <= 0) return minR;
  return minR + (count / maxCount) * (maxR - minR);
}

export default function MapView({
  places,
  letters,
  selectedPlace,
  onPlaceSelect,
}: MapViewProps) {
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(
    null
  );

  const maxLetterCount = useMemo(() => {
    return Math.max(...places.map((p) => p.letterCount), 1);
  }, [places]);

  const lettersForPlace = useMemo(() => {
    const map = new Map<string, Letter[]>();
    letters.forEach((l) => {
      if (!l.place) return;
      if (!map.has(l.place)) map.set(l.place, []);
      map.get(l.place)!.push(l);
    });
    return map;
  }, [letters]);

  useEffect(() => {
    if (selectedPlace) {
      const place = places.find((p) => p.name === selectedPlace);
      if (place) {
        setFlyTarget({ lat: place.lat, lng: place.lng });
      }
    }
  }, [selectedPlace, places]);

  return (
    <MapContainer
      center={[54.5, 12]}
      zoom={5}
      scrollWheelZoom={true}
      style={{ height: "100%", width: "100%", borderRadius: "0.5rem" }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {flyTarget && <FlyToPlace lat={flyTarget.lat} lng={flyTarget.lng} />}
      {places
        .filter((p) => p.letterCount > 0)
        .map((place) => {
          const r = getMarkerRadius(place.letterCount, maxLetterCount);
          const placeLetters = lettersForPlace.get(place.name) || [];
          const isSelected = selectedPlace === place.name;
          return (
            <CircleMarker
              key={place.name}
              center={[place.lat, place.lng]}
              radius={r}
              pathOptions={{
                color: isSelected ? "#8B2323" : "#5A4F43",
                fillColor: isSelected ? "#A63535" : "#5B8C5A",
                fillOpacity: isSelected ? 0.8 : 0.6,
                weight: isSelected ? 3 : 1.5,
              }}
              eventHandlers={{
                click: () => onPlaceSelect(place.name),
              }}
            >
              <Popup>
                <div className="font-ui text-sm" style={{ minWidth: 180 }}>
                  <p className="font-medium text-base mb-1">{place.name}</p>
                  <p className="text-gray-600 mb-2">
                    {place.letterCount} brev{place.letterCount !== 1 ? "e" : ""}
                  </p>
                  <div className="max-h-40 overflow-y-auto">
                    {placeLetters.slice(0, 10).map((l) => (
                      <a
                        key={l.id}
                        href={`/letters/${l.id}/`}
                        className="block text-xs py-0.5 text-blue-700 hover:underline"
                      >
                        {new Date(l.date + "T00:00:00").toLocaleDateString(
                          "da-DK",
                          { day: "numeric", month: "short", year: "numeric" }
                        )}{" "}
                        &mdash; {l.sender}
                      </a>
                    ))}
                    {placeLetters.length > 10 && (
                      <p className="text-xs text-gray-500 mt-1">
                        og {placeLetters.length - 10} flere...
                      </p>
                    )}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
    </MapContainer>
  );
}
