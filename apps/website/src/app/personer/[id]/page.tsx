import { Metadata } from "next";
import Link from "next/link";
import { getAllPersonIds, getPersonPage } from "@/lib/data";
import { formatDanishDate } from "@/utils/dateFormatter";
import PersonImages from "@/components/PersonImages";

/** Generate all person pages at build time */
export async function generateStaticParams() {
  const ids = getAllPersonIds();
  return ids.map((id) => ({ id }));
}

/** Generate metadata for each person page */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const person = await getPersonPage(id);

  if (!person) {
    return { title: "Person ikke fundet -- Jernkorset Breve" };
  }

  const displayName = person.full_name || person.canonical;
  return {
    title: `${displayName} -- Jernkorset Breve`,
    description: person.biographical
      ? person.biographical.slice(0, 160)
      : `${displayName} — ${person.role || person.category}. Nævnt i ${person.letter_count} breve.`,
  };
}

const ROLE_BADGE: Record<string, string> = {
  afsender: "Afsender",
  modtager: "Modtager",
  nævnt: "Nævnt",
};

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const person = await getPersonPage(id);

  if (!person) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-3xl text-ink mb-4">
          Person ikke fundet
        </h1>
        <p className="text-faded font-body text-lg mb-6">
          Personen &quot;{id}&quot; findes ikke i samlingen.
        </p>
        <Link
          href="/personer/"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-ui bg-cream border border-faded/30 rounded-md text-ink hover:bg-parchment transition-colors"
        >
          Tilbage til personlisten
        </Link>
      </div>
    );
  }

  const displayName = person.full_name || person.canonical;

  const dateRange =
    person.birth_date || person.death_date
      ? [
          person.birth_date ? formatDanishDate(person.birth_date) : "?",
          person.death_date ? formatDanishDate(person.death_date) : "?",
        ].join(" – ")
      : null;

  const bioparagraphs = person.biographical
    ? person.biographical.split(/\n+/).filter(Boolean)
    : [];

  return (
    <div className="pt-8 pb-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          href="/personer/"
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
          Tilbage til personlisten
        </Link>

        {/* Header */}
        <header className="mb-6">
          <h1 className="font-display text-3xl sm:text-4xl text-ink mb-1">
            {displayName}
          </h1>
          {dateRange && (
            <p className="text-faded font-ui text-sm mb-1">{dateRange}</p>
          )}
          {person.role && (
            <p className="text-faded font-ui">{person.role}</p>
          )}
        </header>

        {/* Photo gallery */}
        <PersonImages photos={person.photos} />

        {/* Biographical text */}
        {bioparagraphs.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-xl text-ink mb-3">Biografi</h2>
            <div className="bg-cream rounded-lg border border-faded/20 px-6 py-5 space-y-3">
              {bioparagraphs.map((para, i) => (
                <p key={i} className="font-body text-ink leading-relaxed">
                  {para}
                </p>
              ))}
            </div>
          </section>
        )}

        {/* Letter timeline */}
        {person.letters.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-xl text-ink mb-3">
              Breve ({person.letters.length})
            </h2>
            <ol className="space-y-3">
              {person.letters.map((ref) => {
                const roleBadge = ROLE_BADGE[ref.role] ?? ref.role;
                return (
                  <li key={`${ref.letter_id}-${ref.role}`}>
                    <Link
                      href={`/letters/${ref.letter_id}/`}
                      className="group block bg-cream rounded-lg border border-faded/20 px-5 py-4 hover:border-faded/40 transition-colors"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                        <span className="font-ui text-sm text-ink group-hover:text-wax-red transition-colors">
                          {formatDanishDate(ref.date)}
                        </span>
                        {ref.place && (
                          <span className="font-ui text-xs text-faded">
                            {ref.place}
                          </span>
                        )}
                        <span className="inline-block px-2 py-0.5 text-xs font-ui rounded bg-parchment text-faded border border-faded/20">
                          {roleBadge}
                        </span>
                      </div>
                      {ref.excerpt && (
                        <p className="font-body text-sm text-faded leading-snug line-clamp-2">
                          {ref.excerpt}
                        </p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* Connections */}
        {person.connections.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-xl text-ink mb-3">
              Forbindelser
            </h2>
            <ul className="flex flex-wrap gap-2">
              {person.connections.map((conn) => (
                <li key={conn.person_id}>
                  <Link
                    href={`/personer/${conn.person_id}/`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cream rounded border border-faded/20 hover:border-faded/40 transition-colors font-ui text-sm text-ink hover:text-wax-red"
                  >
                    {conn.full_name}
                    <span className="text-xs text-faded">({conn.weight})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Mention span */}
        {(person.first_mention || person.last_mention) && (
          <p className="text-center text-faded font-ui text-sm mt-8">
            Første nævnelse: {person.first_mention
              ? formatDanishDate(person.first_mention)
              : "—"}
            {person.first_mention !== person.last_mention && (
              <> &mdash; Sidste nævnelse: {person.last_mention
                ? formatDanishDate(person.last_mention)
                : "—"}</>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
