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

export interface LetterImage {
  image_id: string;
  relevance: string;
  score: number;
  reason_da: string;
}

export interface LetterImageEntry {
  letter_id: number;
  images: LetterImage[];
}

export interface ImageRegistryEntry {
  id: string;
  filename: string;
  path: string;
  category: string;
  persons: string[];
  places: string[];
  date_estimate: string;
  date_sort: string;
  description: string;
  description_da: string;
  source: string;
  width: number;
  height: number;
  size_bytes: number;
}

export interface PersonPhoto {
  image_id: string;
  path: string;
  description_da: string;
  description: string;
  date_estimate: string;
  category: string;
}

export interface PersonLetterRef {
  letter_id: number;
  date: string;
  place: string;
  recipient: string;
  role: string;
  excerpt: string;
}

export interface PersonConnection {
  person_id: string;
  full_name: string;
  weight: number;
}

export interface PersonPage {
  id: string;
  full_name: string;
  canonical: string;
  role: string;
  category: string;
  birth_date?: string;
  death_date?: string;
  biographical?: string;
  photos: PersonPhoto[];
  letters: PersonLetterRef[];
  connections: PersonConnection[];
  letter_count: number;
  first_mention: string;
  last_mention: string;
}

export interface PlacePhoto {
  image_id: string;
  path: string;
  description_da: string;
  description: string;
  date_estimate: string;
  category: string;
}

export interface PlaceLetterRef {
  letter_id: number;
  date: string;
  sender: string;
  recipient: string;
  excerpt: string;
}

export interface PlaceNamedLocation {
  name: string;
  aliases: string[];
  description: string;
  date_range: string;
}

export interface PlacePage {
  id: string;
  name: string;
  modern_name: string;
  country: string;
  lat: number;
  lng: number;
  wikidata_id?: string;
  wikipedia_url?: string;
  description?: string;
  letter_count: number;
  photos: PlacePhoto[];
  letters: PlaceLetterRef[];
  named_locations: PlaceNamedLocation[];
}
