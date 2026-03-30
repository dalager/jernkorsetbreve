/**
 * TypeScript interfaces for psycholinguistic data files (ADR-037).
 */

// ── letter-psycholinguistics.json ───────────────────────────────────

export interface LetterPsycholinguistics {
  date: string;
  recipient: string;
  word_count: number;
  // Lexical
  mattr: number;
  mtld: number;
  hdd: number | null;
  hapax_ratio: number;
  lexical_density: number;
  // Syntactic
  mean_dependency_distance: number;
  max_dependency_distance: number;
  mean_sentence_length: number;
  subordinate_clause_ratio: number;
  max_tree_depth: number;
  // Psychological
  first_person_singular_rate: number;
  first_person_plural_rate: number;
  jeg_vi_shift: number;
  hedging_rate: number;
  absolutist_rate: number;
  cognitive_rate: number;
  reassurance_count: number;
  sensory_rate: number;
  past_tense_ratio: number;
  present_tense_ratio: number;
  // Code-switching
  german_density: number;
  german_term_count: number;
  // Information-theoretic
  char_entropy: number;
  compression_ratio: number;
  // Embedding-derived
  sentiment_volatility: number;
  sentiment_arc_asymmetry: number;
}

/** Keyed by letter ID (string). */
export type PsycholinguisticsMap = Record<string, LetterPsycholinguistics>;

// ── cvp-emotion-scores.json ─────────────────────────────────────────

export interface LetterEmotionScores {
  fear_mean: number;
  fear_p10: number;
  fear_p90: number;
  grief_mean: number;
  grief_p10: number;
  grief_p90: number;
  hope_mean: number;
  hope_p10: number;
  hope_p90: number;
  love_mean: number;
  love_p10: number;
  love_p90: number;
  anger_mean: number;
  anger_p10: number;
  anger_p90: number;
  gratitude_mean: number;
  gratitude_p10: number;
  gratitude_p90: number;
  pride_mean: number;
  pride_p10: number;
  pride_p90: number;
  remorse_mean: number;
  remorse_p10: number;
  remorse_p90: number;
  relief_mean: number;
  relief_p10: number;
  relief_p90: number;
  desire_mean: number;
  desire_p10: number;
  desire_p90: number;
  sentence_count: number;
  sentence_count_substantive: number;
}

/** Keyed by letter ID (string). */
export type EmotionScoresMap = Record<string, LetterEmotionScores>;

// ── letter-audience-divergence.json ─────────────────────────────────

export interface AudienceDivergenceSummary {
  trine_count: number;
  parent_count: number;
  unknown_count: number;
  same_date_pairs: number;
  quarters_with_both: number;
}

export interface QuarterlyDivergence {
  quarter: string;
  trine_count: number;
  parent_count: number;
  jsd_words: number;
  wasserstein_sentiment: number;
  metric_divergence: {
    hedging_rate: number;
    first_person_singular_rate: number;
    mattr: number;
    mean_sentence_length: number;
    german_density: number;
    reassurance_count: number;
    sentiment_volatility: number;
  };
}

export interface AudienceDivergenceData {
  summary: AudienceDivergenceSummary;
  quarterly_divergence: QuarterlyDivergence[];
}

// ── letter-narrative-arcs.json ──────────────────────────────────────

export type ArcType = "peak" | "valley" | "rising" | "falling" | "flat";

export interface LetterArc {
  arc_type: ArcType;
  arc_asymmetry: number;
  sentiment_range: number;
  sentence_count_substantive: number;
}

export interface NarrativeArcsData {
  within_letter: Record<string, LetterArc>;
}

// ── semantic-shifts.json ────────────────────────────────────────────

export interface YearStats {
  count: number;
  mean_cvp: number;
  std_cvp: number;
}

export interface DriftStep {
  from: string;
  to: string;
  delta_mean: number;
}

export interface WordShift {
  total_occurrences: number;
  by_year: Record<string, YearStats>;
  drift: DriftStep[];
}

export interface SemanticShiftsData {
  target_words: Record<string, WordShift>;
  most_shifted: string[];
  most_fossilized: string[];
}

// ── cvp-identity-scores.json (ADR-038) ────────────────────────────

export interface LetterIdentityScores {
  mean: number;
  p10: number;
  p90: number;
}

/** Keyed by letter ID (string). Positive = Danish-leaning, negative = German/military-leaning. */
export type IdentityScoresMap = Record<string, LetterIdentityScores>;

// ── pca-dimensions.json ─────────────────────────────────────────────

export interface PCASentence {
  letter_id: number;
  index: number;
  text: string;
  score: number;
}

export interface PCAComponent {
  explained_variance_ratio: number;
  top_sentences: PCASentence[];
  bottom_sentences?: PCASentence[];
}

export interface PCAData {
  explained_variance_ratio: number[];
  cumulative_variance: number[];
  components: Record<string, PCAComponent>;
}
