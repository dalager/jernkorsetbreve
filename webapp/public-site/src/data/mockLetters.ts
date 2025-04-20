import { Letter, LetterListItem } from "@/types/letters";

// Sample letter list for when the API isn't available
export const mockLetterList: LetterListItem[] = [
  {
    id: 1,
    date: "June 15, 1941",
    place: "Eastern Front",
    sender: "Johannes Meyer",
    recipient: "Margarete Meyer",
  },
  {
    id: 2,
    date: "August 3, 1942",
    place: "Stalingrad",
    sender: "Heinrich Müller",
    recipient: "Elisabeth Müller",
  },
  {
    id: 3,
    date: "December 12, 1943",
    place: "Berlin",
    sender: "Franz Weber",
    recipient: "Anna Weber",
  },
];

// Sample letter details with full content
export const mockLetters: Record<number, Letter> = {
  1: {
    id: 1,
    date: "June 15, 1941",
    place: "Eastern Front",
    sender: "Johannes Meyer",
    recipient: "Margarete Meyer",
    text: "My dearest Margarete,\n\nToday is our third day on the Eastern Front. The journey was long and tiring, but we have finally arrived at our designated position. The countryside here is vast and different from home.\n\nI think of you and the children every day. How are Hans and little Greta doing with their studies? Please tell them their father is well and serving with honor.\n\nThe weather has been favorable so far, though we are told it will change as winter approaches. I've received your package with the wool socks and am grateful for your thoughtfulness.\n\nI must keep this letter brief. Please give my regards to your parents and know that I carry your picture close to my heart.\n\nYours always,\nJohannes",
  },
  2: {
    id: 2,
    date: "August 3, 1942",
    place: "Stalingrad",
    sender: "Heinrich Müller",
    recipient: "Elisabeth Müller",
    text: "My beloved Elisabeth,\n\nThe fighting here has been intense, but our company has shown great courage. The city is largely in ruins now, and we move from building to building. The local population has mostly evacuated.\n\nYour last letter brought me great joy. The photograph of you in the garden with the roses in bloom gave me strength. I keep it with me at all times.\n\nOur rations have been reduced, but we manage. The Iron Cross I received last month has given me renewed determination. I wear it proudly, knowing that you too can be proud of your husband's service.\n\nI pray this conflict ends soon so I may return to you and our home. Until then, I remain steadfast in my duty.\n\nWith all my love,\nHeinrich",
  },
  3: {
    id: 3,
    date: "December 12, 1943",
    place: "Berlin",
    sender: "Franz Weber",
    recipient: "Anna Weber",
    text: "Dearest Anna,\n\nI write to you from a hospital in Berlin. Do not worry - my injuries are not severe, and the doctors assure me I will recover fully within a few weeks.\n\nThe medal ceremony was held yesterday. Several of us from the Eastern campaign received recognition for our actions. The Iron Cross is a great honor, though I only did what any man would do for his comrades.\n\nThe city bears the marks of the air raids, but life continues. There is talk that I may be assigned to a desk position after my recovery, which would mean remaining in Berlin. Perhaps you could join me here?\n\nI miss our home and your cooking. The hospital food is adequate but lacks your special touch. My thoughts are with you constantly.\n\nYours faithfully,\nFranz",
  },
};
