import { Metadata } from "next";
import Link from "next/link";
import { getAllPlaceIds, getPlacePage } from "@/lib/data";
import { formatDanishDate } from "@/utils/dateFormatter";
import MiniMapWrapper from "@/components/MiniMapWrapper";
import PlaceImages from "@/components/PlaceImages";

/** Generate all place pages at build time */
export function generateStaticParams() {
  const ids = getAllPlaceIds();
  return ids.map((id) => ({ id }));
}

/** Generate metadata for each place page */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const place = await getPlacePage(id);

  if (!place) {
    return { title: "Sted ikke fundet -- Jernkorset Breve" };
  }

  return {
    title: `${place.name} -- Jernkorset Breve`,
    description: place.description
      ? place.description
      : `${place.name} (${place.modern_name}), ${place.country}. ${place.letter_count} breve fra Den Store Krig.`,
  };
}

export default async function StedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const place = await getPlacePage(id);

  if (!place) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-3xl text-ink mb-4">
          Stedet blev ikke fundet
        </h1>
        <p className="text-faded font-body text-lg mb-6">
          Sted &ldquo;{id}&rdquo; findes ikke i samlingen.
        </p>
        <Link
          href="/steder/"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-ui bg-cream border border-faded/30 rounded-md text-ink hover:bg-parchment transition-colors"
        >
          Tilbage til stedlisten
        </Link>
      </div>
    );
  }

  const showModernName =
    place.modern_name &&
    place.modern_name.toLowerCase() !== place.name.toLowerCase();

  // Sort letters chronologically
  const sortedLetters = [...place.letters].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return (
    <div className="pt-8 pb-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          href="/steder/"
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
          Alle steder
        </Link>

        {/* Header */}
        <header className="mb-6">
          <h1 className="font-display text-3xl sm:text-4xl text-ink mb-1">
            {place.name}
          </h1>
          {showModernName && (
            <p className="text-faded font-ui text-base mb-1">{place.modern_name}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            <span className="font-ui text-sm text-faded">{place.country}</span>
            <span className="font-ui text-sm text-faded">
              {place.letter_count} {place.letter_count === 1 ? "brev" : "breve"}
            </span>
            {place.wikidata_id && (
              <a
                href={`https://www.wikidata.org/wiki/${place.wikidata_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-ui text-xs text-faded hover:text-ink transition-colors underline underline-offset-2"
              >
                Wikidata
              </a>
            )}
            {place.wikipedia_url && (
              <a
                href={place.wikipedia_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-ui text-xs text-faded hover:text-ink transition-colors underline underline-offset-2"
              >
                Wikipedia
              </a>
            )}
          </div>
        </header>

        {/* Description */}
        {place.description && (
          <p className="font-body text-base text-ink leading-relaxed mb-6">
            {place.description}
          </p>
        )}

        {/* Map — wider container than on letter pages */}
        {typeof place.lat === "number" && typeof place.lng === "number" && (
          <div className="w-full mb-8">
            <MiniMapWrapper
              lat={place.lat}
              lng={place.lng}
              placeName={place.name}
            />
          </div>
        )}

        {/* Photos */}
        {place.photos && place.photos.length > 0 && (
          <PlaceImages photos={place.photos} />
        )}

        {/* Named locations */}
        {place.named_locations && place.named_locations.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-xl text-ink mb-4">Kendte lokaliteter</h2>
            <div className="space-y-4">
              {place.named_locations.map((loc, i) => (
                <div
                  key={i}
                  className="bg-cream rounded border border-faded/20 px-4 py-4"
                >
                  <h3 className="font-display text-lg text-ink mb-1">{loc.name}</h3>
                  {loc.aliases && loc.aliases.length > 0 && (
                    <p className="font-ui text-xs text-faded mb-2">
                      Også kendt som:{" "}
                      {loc.aliases.join(", ")}
                    </p>
                  )}
                  {loc.description && (
                    <p className="font-body text-sm text-ink leading-relaxed mb-2">
                      {loc.description}
                    </p>
                  )}
                  {loc.date_range && (
                    <p className="font-ui text-xs text-faded">{loc.date_range}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Letters from this place */}
        {sortedLetters.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-xl text-ink mb-4">
              Breve fra dette sted
            </h2>
            <div className="space-y-2">
              {sortedLetters.map((letter) => (
                <Link
                  key={letter.letter_id}
                  href={`/letters/${letter.letter_id}/`}
                  className="group flex flex-col bg-cream rounded border border-faded/20 px-4 py-3 hover:border-faded/40 transition-colors"
                >
                  {/* Date + sender/recipient */}
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mb-1">
                    <span className="font-ui text-xs text-faded">
                      {formatDanishDate(letter.date)}
                    </span>
                    <span className="font-body text-sm text-ink">
                      {letter.sender}
                      <span className="text-faded mx-1">til</span>
                      {letter.recipient}
                    </span>
                  </div>
                  {/* Excerpt */}
                  {letter.excerpt && (
                    <p className="font-body text-sm text-faded/90 italic line-clamp-2 group-hover:text-ink/70 transition-colors">
                      &ldquo;{letter.excerpt}&rdquo;
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
