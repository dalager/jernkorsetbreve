import { Letter } from "@/types/letters";
import Link from "next/link";
import { Metadata } from "next";
import { mockLetters, mockLetterList } from "@/data/mockLetters";
import { formatDanishDate } from "@/utils/dateFormatter";
export const revalidate = 3600; // Revalidate every hour

// This runs at build time to fetch a specific letter
async function getLetter(id: string): Promise<Letter> {
  try {
    // Try to fetch from the API
    const res = await fetch(`http://localhost:8000/letters/${id}`, {
      // Using consistent caching strategy
      next: { revalidate: 3600 }, // Same revalidation period as top-level setting
      // Set a short timeout so we don't hang too long if API is unavailable
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      console.error(
        `Error fetching letter ${id}: ${res.status} ${res.statusText}`
      );
      throw new Error(`Failed to fetch letter with ID ${id}`);
    }

    return res.json();
  } catch (error) {
    console.warn(
      `API fetch failed for letter ${id}, using mock data instead:`,
      error
    );
    // Fallback to mock data
    const numericId = parseInt(id, 10);
    return mockLetters[numericId] || mockLetters[1]; // Default to first letter if ID not found
  }
}

// Generate metadata for the page
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const letter = await getLetter(params.id);
  // Format date for page title using utility function
  const formattedDate = formatDanishDate(letter.date);

  return {
    title: `Letter from ${formattedDate} - Iron Cross Letters Archive`,
  };
}

// This generates the static paths for all letters at build time
export async function generateStaticParams() {
  try {
    // Try to fetch from the API with consistent caching strategy
    const res = await fetch("http://localhost:8000/letters", {
      next: { revalidate: 3600 }, // Use same revalidation period
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch letters");
    }

    const letters = await res.json();
    return letters.map((letter: { id: number }) => ({
      id: letter.id.toString(),
    }));
  } catch (error) {
    console.warn(
      "API fetch failed for generateStaticParams, using mock data:",
      error
    );
    // Fallback to mock data
    return mockLetterList.map((letter) => ({
      id: letter.id.toString(),
    }));
  }
}

// The page component
export default async function LetterPage({
  params,
}: {
  params: { id: string };
}) {
  const letter = await getLetter(params.id);

  // Format date to Danish locale using utility function
  const formattedDate = formatDanishDate(letter.date);

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center mb-6 text-blue-600 hover:underline"
      >
        ← Tilbage til listen
      </Link>

      <article className="bg-white rounded-lg border border-gray-200 shadow-md p-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{formattedDate}</h1>
          <div className="text-gray-600">
            <p className="mb-1">
              <span className="font-medium">Fra:</span> {letter.sender}
            </p>
            <p className="mb-1">
              <span className="font-medium">Til:</span> {letter.recipient}
            </p>
            {letter.place && (
              <p>
                <span className="font-medium">Sted:</span> {letter.place}
              </p>
            )}
          </div>
        </header>

        <div className="prose max-w-none">
          {/* Display letter content, split by newlines for proper formatting */}
          {letter.text.split("\n").map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </article>
    </div>
  );
}
