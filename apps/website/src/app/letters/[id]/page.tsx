import { Metadata } from "next";
import Link from "next/link";
import { getAllLetterIds, getLetter, getLetterCount, getPlaces } from "@/lib/data";
import { formatDanishDate } from "@/utils/dateFormatter";
import LetterNavigation from "@/components/LetterNavigation";
import RelatedLetters from "@/components/RelatedLetters";
import MiniMapWrapper from "@/components/MiniMapWrapper";

/** Generate all 665 static letter pages at build time */
export async function generateStaticParams() {
  const ids = getAllLetterIds();
  return ids.map((id) => ({ id: id.toString() }));
}

/** Generate metadata for each letter page */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const letter = getLetter(parseInt(id, 10));

  if (!letter) {
    return { title: "Brev ikke fundet -- Jernkorset Breve" };
  }

  const formattedDate = formatDanishDate(letter.date);
  return {
    title: `${formattedDate} -- ${letter.sender} -- Jernkorset Breve`,
    description: `Brev fra ${letter.sender} til ${letter.recipient}, ${formattedDate}. ${letter.place || ""}`,
  };
}

export default async function LetterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = parseInt(id, 10);
  const letter = getLetter(numericId);
  const totalLetters = getLetterCount();

  // Look up coordinates for the letter's place
  const placeData = letter?.place
    ? getPlaces().find((p) => p.name === letter.place)
    : undefined;
  const placeCoords =
    placeData && typeof placeData.lat === "number" && typeof placeData.lng === "number"
      ? { lat: placeData.lat, lng: placeData.lng }
      : null;

  if (!letter) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-3xl text-ink mb-4">
          Brevet blev ikke fundet
        </h1>
        <p className="text-faded font-body text-lg mb-6">
          Brev #{numericId} findes ikke i samlingen.
        </p>
        <Link
          href="/breve/"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-ui bg-cream border border-faded/30 rounded-md text-ink hover:bg-parchment transition-colors"
        >
          Tilbage til brevlisten
        </Link>
      </div>
    );
  }

  const formattedFullDate = formatDanishDate(letter.date, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="pt-8 pb-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          href="/breve/"
          className="inline-flex items-center gap-1 text-faded hover:text-ink font-ui text-sm mb-6 transition-colors"
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Tilbage til brevlisten
        </Link>

        {/* Header with date and place */}
        <header className="mb-6">
          <h1 className="font-display text-3xl sm:text-4xl text-ink mb-1 capitalize">
            {formattedFullDate}
          </h1>
          {letter.place && (
            <p className="text-faded font-ui flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {letter.place}
            </p>
          )}
        </header>

        {/* Mini map — shown when place coordinates are available */}
        {placeCoords && letter.place && (
          <MiniMapWrapper
            lat={placeCoords.lat}
            lng={placeCoords.lng}
            placeName={letter.place}
          />
        )}

        {/* Letter card */}
        <article className="bg-cream rounded-lg border border-faded/20 shadow-letter overflow-hidden">
          {/* Sender/recipient bar */}
          <div className="bg-parchment/50 border-b border-faded/20 px-6 py-4 flex flex-wrap gap-x-8 gap-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-xs uppercase tracking-wider text-faded font-ui">
                Fra
              </span>
              <span className="font-body text-ink">{letter.sender}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs uppercase tracking-wider text-faded font-ui">
                Til
              </span>
              <span className="font-body text-ink">{letter.recipient}</span>
            </div>
          </div>

          {/* Letter content — text may contain HTML <p> tags from source data */}
          <div className="px-6 py-8 sm:px-8">
            <div
              className="font-body text-ink text-lg leading-relaxed [&>p]:mb-4 [&>p:last-child]:mb-0"
              dangerouslySetInnerHTML={{ __html: letter.text }}
            />
          </div>

          {/* Navigation bar */}
          <div className="bg-parchment/30 border-t border-faded/20 px-6 py-4">
            <LetterNavigation
              currentId={numericId}
              totalLetters={totalLetters}
            />
          </div>
        </article>

        {/* Sentiment detail link */}
        <div className="mt-6 text-center">
          <Link
            href={`/sentiment/?brev=${numericId}`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-ui bg-cream border border-faded/30 rounded-md text-ink hover:bg-parchment transition-colors"
          >
            Stemningsdetaljer
          </Link>
        </div>

        {/* Related letters */}
        <RelatedLetters letterId={numericId} />

        {/* Letter number indicator */}
        <p className="text-center text-faded font-ui text-sm mt-4">
          Brev #{numericId}
          {totalLetters > 0 ? ` af ${totalLetters}` : ""}
        </p>
      </div>
    </div>
  );
}
