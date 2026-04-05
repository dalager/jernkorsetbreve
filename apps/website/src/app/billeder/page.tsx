import { Metadata } from "next";
import { getImageRegistry } from "@/lib/data";
import ImageBrowser from "@/components/ImageBrowser";

export const metadata: Metadata = {
  title: "Billeder -- Jernkorset Breve",
  description:
    "Oversigt over alle billeder fra brevsamlingen — portrætter, steder, kort og dokumenter fra Første Verdenskrig.",
};

const CATEGORY_LABELS: Record<string, string> = {
  portrait: "Portrætter",
  group: "Gruppebilleder",
  place: "Steder",
  map: "Kort",
  document: "Dokumenter",
  historical: "Historiske",
  military: "Militær",
};

const CATEGORY_ORDER = [
  "portrait",
  "group",
  "place",
  "map",
  "document",
  "military",
  "historical",
];

export default async function BillederPage() {
  const images = await getImageRegistry();

  const grouped = CATEGORY_ORDER.reduce<
    Record<string, typeof images>
  >((acc, cat) => {
    acc[cat] = images.filter((i) => i.category === cat);
    return acc;
  }, {});

  // Stats
  const withDescDa = images.filter((i) => i.description_da).length;
  const withDates = images.filter((i) => i.date_sort).length;

  return (
    <div className="pt-8 pb-12 px-4">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl text-ink mb-2">
            Billeder
          </h1>
          <p className="text-faded font-body text-lg">
            {images.length} billeder fra Else Gad Mærsks præsentation om
            brevsamlingen.
          </p>
          <p className="text-faded/70 font-ui text-sm mt-1">
            {withDescDa} med danske billedtekster &middot; {withDates} med
            datering
          </p>
        </header>

        <ImageBrowser
          images={images}
          grouped={grouped}
          categoryLabels={CATEGORY_LABELS}
          categoryOrder={CATEGORY_ORDER}
        />
      </div>
    </div>
  );
}
