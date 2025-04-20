import LetterCard from "@/components/LetterCard";
import { LetterListItem } from "@/types/letters";
import { mockLetterList } from "@/data/mockLetters";

// This function runs at build time to fetch data
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

export default async function Home() {
  // Fetch letters data at build time
  const letters = await getLetters();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Jernkorset.dk</h1>
        <p className="text-gray-600">Breve fra 1. verdenskrig</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {letters.map((letter) => (
          <LetterCard key={letter.id} letter={letter} />
        ))}
      </div>
    </div>
  );
}
