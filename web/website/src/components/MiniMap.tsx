"use client";

import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";

interface MiniMapProps {
  lat: number;
  lng: number;
  placeName: string;
}

export default function MiniMap({ lat, lng, placeName }: MiniMapProps) {
  return (
    <div className="rounded-lg overflow-hidden border border-faded/20 shadow-sm mb-6">
      <div style={{ height: 200, position: "relative" }}>
        <MapContainer
          center={[lat, lng]}
          zoom={8}
          scrollWheelZoom={false}
          dragging={false}
          zoomControl={false}
          attributionControl={false}
          style={{ height: "100%", width: "100%" }}
          className="z-0"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={20}
          />
          <CircleMarker
            center={[lat, lng]}
            radius={8}
            pathOptions={{
              color: "#5A4F43",
              fillColor: "#5B8C5A",
              fillOpacity: 0.8,
              weight: 2,
            }}
          />
        </MapContainer>
      </div>
      <div className="bg-parchment/50 border-t border-faded/20 px-4 py-2 text-right">
        <Link
          href={`/map?place=${encodeURIComponent(placeName)}`}
          className="text-sm font-ui text-faded hover:text-ink transition-colors inline-flex items-center gap-1"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 16l4.553-2.276A1 1 0 0021 19.382V8.618a1 1 0 00-.553-.894L15 5m0 18V5m0 0L9 7"
            />
          </svg>
          Se på det store kort
        </Link>
      </div>
    </div>
  );
}
