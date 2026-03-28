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

/** CVP multi-score sentiment per letter (ADR-030). */
export interface LetterSentiment {
  cvp_mean: number;
  cvp_min: number;
  cvp_p10: number;
  cvp_p90: number;
  cvp_range: number;
  negative_ratio: number;
  sentence_count: number;
  sentence_count_substantive: number;
  afinn_legacy?: number;
}

export type SentimentMap = Record<string, LetterSentiment>;
