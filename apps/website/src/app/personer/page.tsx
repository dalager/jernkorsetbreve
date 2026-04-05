import { Metadata } from "next";
import Link from "next/link";
import { getPersonPages } from "@/lib/data";
import { PersonPage } from "@/types/letters";

export const metadata: Metadata = {
  title: "Personer -- Jernkorset Breve",
  description: "Oversigt over alle personer nævnt i brevsamlingen fra Første Verdenskrig.",
};

const CATEGORY_LABELS: Record<string, string> = {
  family: "Familie",
  military: "Militær",
  community: "Samfund",
  unknown: "Ukendt",
};

const CATEGORY_ORDER = ["family", "military", "community", "unknown"];

export default async function PersonerPage() {
  const persons = await getPersonPages();

  const grouped = CATEGORY_ORDER.reduce<Record<string, PersonPage[]>>((acc, cat) => {
    acc[cat] = persons.filter(p => p.category === cat);
    return acc;
  }, {});

  // Collect any categories not in CATEGORY_ORDER
  const extraCategories = [...new Set(persons.map(p => p.category))].filter(
    c => !CATEGORY_ORDER.includes(c)
  );
  for (const cat of extraCategories) {
    grouped[cat] = persons.filter(p => p.category === cat);
  }

  const allCategories = [...CATEGORY_ORDER, ...extraCategories];

  return (
    <div className="pt-8 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl text-ink mb-2">Personer</h1>
          <p className="text-faded font-body">
            {persons.length} personer nævnt i brevsamlingen
          </p>
        </header>

        {allCategories.map((category) => {
          const group = grouped[category];
          if (!group || group.length === 0) return null;

          return (
            <section key={category} className="mb-10">
              <h2 className="font-display text-xl text-ink mb-4 pb-2 border-b border-faded/20">
                {CATEGORY_LABELS[category] ?? category}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.map((person) => {
                  const displayName = person.full_name || person.canonical;
                  const thumb = person.photos[0];

                  return (
                    <Link
                      key={person.id}
                      href={`/personer/${person.id}/`}
                      className="group flex gap-3 bg-cream rounded-lg border border-faded/20 overflow-hidden hover:border-faded/40 transition-colors p-3"
                    >
                      {/* Thumbnail */}
                      {thumb && (
                        <div className="flex-shrink-0 w-14 h-14 rounded overflow-hidden bg-parchment">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/images/letters/${thumb.path}`}
                            alt={displayName}
                            className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                            loading="lazy"
                          />
                        </div>
                      )}

                      {/* Text */}
                      <div className="min-w-0">
                        <p className="font-body text-ink font-medium truncate group-hover:text-wax-red transition-colors">
                          {displayName}
                        </p>
                        {person.role && (
                          <p className="font-ui text-xs text-faded truncate mt-0.5">
                            {person.role}
                          </p>
                        )}
                        <p className="font-ui text-xs text-faded mt-1">
                          {person.letter_count} {person.letter_count === 1 ? "brev" : "breve"}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
