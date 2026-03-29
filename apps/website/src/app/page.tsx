import { getLetterSummaries } from "@/lib/data";
import LetterTable from "@/components/LetterTable";

export default function Home() {
  const letters = getLetterSummaries();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-ink mb-2">Brevsamlingen</h1>
        <p className="text-faded font-ui">
          {letters.length > 0
            ? `${letters.length} breve fra 1911\u20131918`
            : "Brevdata ikke genereret endnu"}
        </p>
      </div>

      <LetterTable letters={letters} />
    </div>
  );
}
