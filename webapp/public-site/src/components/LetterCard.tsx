import Link from "next/link";
import { LetterListItem } from "@/types/letters";
import { formatDanishDate } from "@/utils/dateFormatter";

interface LetterCardProps {
  letter: LetterListItem;
}

export default function LetterCard({ letter }: LetterCardProps) {
  // Format date to Danish locale using the utility function
  const formattedDate = formatDanishDate(letter.date);

  return (
    <Link
      href={`/letters/${letter.id}/`}
      className="block p-6 bg-white rounded-lg border border-gray-200 shadow-md hover:bg-gray-50 transition-colors"
    >
      <h2 className="mb-2 text-xl font-bold tracking-tight text-gray-900">
        {formattedDate}
      </h2>
      <p className="text-gray-700 mb-1">
        <span className="font-medium">Fra:</span> {letter.sender}
      </p>
      <p className="text-gray-700 mb-1">
        <span className="font-medium">Til:</span> {letter.recipient}
      </p>
      {letter.place && (
        <p className="text-gray-700">
          <span className="font-medium">Sted:</span> {letter.place}
        </p>
      )}
    </Link>
  );
}
