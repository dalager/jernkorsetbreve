export interface Letter {
  id: number;
  date: string;
  place: string;
  sender: string;
  recipient: string;
  text: string;
}

export interface LetterSummary {
  id: number;
  date: string;
  place: string;
  sender: string;
  recipient: string;
}

/** Same as LetterSummary, kept for backward compatibility */
export type LetterListItem = LetterSummary;

export interface Place {
  name: string;
  count: number;
  lat?: number;
  lng?: number;
}
