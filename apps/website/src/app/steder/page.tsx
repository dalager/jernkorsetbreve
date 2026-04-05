import { Metadata } from "next";
import Link from "next/link";
import { getPlacePages } from "@/lib/data";
import { PlacePage } from "@/types/letters";

export const metadata: Metadata = {
  title: "Steder -- Jernkorset Breve",
  description: "Oversigt over steder nævnt i brevene fra Den Store Krig 1914–1918.",
};

export default async function StederPage() {
  const places = await getPlacePages();

  // Group by country
  const byCountry = places.reduce<Record<string, PlacePage[]>>((acc, place) => {
    const country = place.country || "Ukendt";
    if (!acc[country]) acc[country] = [];
    acc[country].push(place);
    return acc;
  }, {});

  // Sort countries alphabetically, putting Denmark first
  const countryOrder = Object.keys(byCountry).sort((a, b) => {
    if (a === "Denmark" || a === "Danmark") return -1;
    if (b === "Denmark" || b === "Danmark") return 1;
    return a.localeCompare(b, "da");
  });

  // Translate country names to Danish for display
  const countryLabels: Record<string, string> = {
    Denmark: "Danmark",
    Danmark: "Danmark",
    Germany: "Tyskland",
    France: "Frankrig",
    Poland: "Polen",
    Russia: "Rusland",
    Belgium: "Belgien",
    Austria: "Østrig",
    Latvia: "Letland",
    Lithuania: "Litauen",
    Estonia: "Estland",
  };

  const totalLetters = places.reduce((sum, p) => sum + (p.letter_count ?? 0), 0);

  return (
    <div className="pt-8 pb-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Page header */}
        <header className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl text-ink mb-2">Steder</h1>
          <p className="text-faded font-body text-base">
            {places.length} steder nævnt i {totalLetters} breve fra Den Store Krig.
          </p>
        </header>

        {places.length === 0 ? (
          <p className="text-faded font-body">Ingen steder fundet.</p>
        ) : (
          <div className="space-y-10">
            {countryOrder.map((country) => {
              const countryPlaces = byCountry[country].sort((a, b) =>
                a.name.localeCompare(b.name, "da")
              );
              const label = countryLabels[country] ?? country;

              return (
                <section key={country}>
                  {/* Country heading */}
                  <h2 className="font-ui text-xs uppercase tracking-widest text-faded border-b border-faded/20 pb-1 mb-4">
                    {label}
                  </h2>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {countryPlaces.map((place) => {
                      const showModernName =
                        place.modern_name &&
                        place.modern_name.toLowerCase() !== place.name.toLowerCase();

                      return (
                        <Link
                          key={place.id}
                          href={`/steder/${place.id}/`}
                          className="group flex flex-col bg-cream rounded border border-faded/20 px-4 py-3 hover:border-faded/40 transition-colors"
                        >
                          <span className="font-display text-lg text-ink group-hover:text-wax-red transition-colors leading-tight">
                            {place.name}
                          </span>
                          {showModernName && (
                            <span className="font-ui text-xs text-faded mt-0.5">
                              {place.modern_name}
                            </span>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="font-ui text-xs text-faded">
                              {place.letter_count ?? 0}{" "}
                              {(place.letter_count ?? 0) === 1 ? "brev" : "breve"}
                            </span>
                            {place.photos && place.photos.length > 0 && (
                              <span className="font-ui text-xs text-faded">
                                {place.photos.length}{" "}
                                {place.photos.length === 1 ? "billede" : "billeder"}
                              </span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
