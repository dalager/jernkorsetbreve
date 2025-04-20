"use client";

import { useState, useEffect } from "react";
import LetterCard from "@/components/LetterCard";
import { LetterListItem } from "@/types/letters";
import { mockLetterList } from "@/data/mockLetters";

// This function runs to fetch data
async function getLetters(): Promise<LetterListItem[]> {
  try {
    // Try to fetch from the API
    const res = await fetch("http://localhost:8000/letters", {
      // cache: "no-store",
      next: { revalidate: 3600 }, // Same revalidation period

      // Set a short timeout so we don't hang too long if API is unavailable
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch letters");
    }

    return res.json();
  } catch (error) {
    console.warn("API fetch failed, using mock data instead:", error);
    // Fallback to mock data
    return mockLetterList;
  }
}

export default function Home() {
  const [letters, setLetters] = useState<LetterListItem[]>([]);
  const [filteredLetters, setFilteredLetters] = useState<LetterListItem[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<string>("all");
  const [places, setPlaces] = useState<{ name: string; count: number }[]>([]);

  // Fetch letters on component mount
  useEffect(() => {
    const fetchData = async () => {
      const data = await getLetters();
      setLetters(data);
      setFilteredLetters(data);

      // Extract unique places and count letters for each place
      const placesMap = new Map<string, number>();
      data.forEach((letter) => {
        const place = letter.place || "Unknown";
        placesMap.set(place, (placesMap.get(place) || 0) + 1);
      });

      // Convert map to array of objects
      const placesArray = Array.from(placesMap.entries()).map(
        ([name, count]) => ({
          name,
          count,
        })
      );

      setPlaces(placesArray);
    };

    fetchData();
  }, []);

  // Handle place filter change
  const handlePlaceChange = (place: string) => {
    setSelectedPlace(place);

    if (place === "all") {
      setFilteredLetters(letters);
    } else {
      setFilteredLetters(letters.filter((letter) => letter.place === place));
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Jernkorset.dk</h1>
        <p className="text-gray-600">Breve fra 1. verdenskrig</p>
      </div>

      {/* Place filter */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handlePlaceChange("all")}
            className={`px-4 py-2 rounded-full text-sm ${
              selectedPlace === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            Alle steder ({letters.length})
          </button>

          {places.map((place) => (
            <button
              key={place.name}
              onClick={() => handlePlaceChange(place.name)}
              className={`px-4 py-2 rounded-full text-sm ${
                selectedPlace === place.name
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {place.name} ({place.count})
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLetters.map((letter) => (
          <LetterCard key={letter.id} letter={letter} />
        ))}
      </div>
    </div>
  );
}
