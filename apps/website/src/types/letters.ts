export interface Letter {
  id: number;
  date: string;
  place: string;
  sender: string;
  recipient: string;
  text: string;
  text_modern?: string;
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

/** Per-sentence CVP score (ADR-036). */
export interface SentenceScore {
  letter_id: number;
  index: number;
  text: string;
  score: number;
  is_formulaic: boolean;
}

/** Pre-computed overview aggregates for the Sentiment Explorer (ADR-036). */
export interface SentimentOverview {
  rolling: RollingBand[];
  distribution: DistributionBin[];
  notable: NotableLetters;
}

export interface RollingBand {
  month: string;
  mean: number;
  p10: number;
  p90: number;
  count: number;
}

export interface DistributionBin {
  min: number;
  max: number;
  count: number;
}

export interface NotableLetters {
  most_negative: NotableLetter[];
  most_positive: NotableLetter[];
  widest_range: NotableLetter[];
  highest_negative_ratio: NotableLetter[];
}

export interface NotableLetter {
  id: number;
  date: string;
  sender: string;
  recipient: string;
  score: number;
  excerpt: string;
}
