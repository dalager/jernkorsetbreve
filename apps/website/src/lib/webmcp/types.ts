// WebMCP spec types (W3C Draft April 2026)
// We define our own since there's no official @types package yet

export interface WebMCPToolDefinition {
  name: string;           // 1-128 chars, [a-zA-Z0-9_.-]
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;  // JSON Schema object
  annotations?: {
    readOnlyHint?: boolean;
  };
}

export interface WebMCPToolRegistration {
  definition: WebMCPToolDefinition;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

// Extend Navigator for TypeScript
declare global {
  interface Navigator {
    modelContext?: {
      registerTool(
        tool: WebMCPToolDefinition & { execute: (input: Record<string, unknown>) => Promise<unknown> },
        options?: { signal?: AbortSignal }
      ): void;
    };
  }
}

// Tool return types for the 10 tools defined in ADR-061

// (Search tool types defined inline in search.ts — these are unused imports)

export interface LetterAnalysis {
  sentiment: {
    cvp_mean: number;
    cvp_range: number;
    negative_ratio: number;
  };
  emotions: {
    fear_mean: number;
    grief_mean: number;
    hope_mean: number;
    love_mean: number;
    anger_mean: number;
    gratitude_mean: number;
    loneliness_mean: number;
  };
  narrative_arc: {
    arc_type: string;
    arc_asymmetry: number;
    sentiment_range: number;
  };
}

export interface GetLetterResult {
  id: number;
  date: string;
  sender: string;
  recipient: string;
  place: string;
  location: { lat: number; lng: number } | null;
  text_original: string;
  text_modern: string;
  analysis?: LetterAnalysis;
}

export interface GetPersonResult {
  id: string;
  full_name: string;
  canonical: string;
  role: string;
  category: string;
  biographical: string;
  birth_date: string | null;
  death_date: string | null;
  aliases: string[];
  first_mention: string;
  last_mention: string;
  letter_count: number;
  photos: string[];
  letters?: Array<{ letter_id: number; date: string; sender: string; recipient: string }>;
  network?: {
    degree_centrality: number;
    betweenness_centrality: number;
    pagerank: number;
    connections: Array<{ person_id: string; canonical: string; weight: number }>;
  };
}

export interface GetPlaceResult {
  id: string;
  name: string;
  modern_name: string | null;
  country: string;
  lat: number;
  lng: number;
  wikidata_id: string | null;
  wikipedia_url: string | null;
  letter_count: number;
  photos: string[];
  letters?: Array<{ letter_id: number; date: string; sender: string; recipient: string }>;
}

export interface NetworkNode {
  id: string;
  canonical: string;
  category: string;
  role: string;
  letter_count: number;
  degree_centrality: number;
  betweenness_centrality: number;
  pagerank: number;
  disappeared: boolean;
  silence_date: string | null;
}

export interface GetSocialNetworkResult {
  metadata: { node_count: number; edge_count: number; generated: string };
  global_metrics: Record<string, number>;
  nodes: NetworkNode[];
  edges?: Array<{ source: string; target: string; weight: number; years: number[] }>;
  temporal_slices?: Array<{ year: number; node_count: number; edge_count: number }>;
}

export interface SentimentSingleResult {
  letter_id: number;
  date: string;
  sentiment: {
    cvp_mean: number;
    cvp_min: number;
    cvp_p10: number;
    cvp_p90: number;
    cvp_range: number;
    negative_ratio: number;
    sentence_count: number;
  };
  emotions: Record<string, number>;
  dominant_emotion: string;
}

export interface SentimentRangeResult {
  date_from: string;
  date_to: string;
  letter_count: number;
  monthly_trend: Array<{ month: string; mean_sentiment: number; letter_count: number }>;
  period_summary: {
    avg_sentiment: number;
    most_positive_letter: { id: number; date: string; cvp_mean: number };
    most_negative_letter: { id: number; date: string; cvp_mean: number };
    dominant_emotion: string;
  };
}

export interface NarrativeArcSingleResult {
  letter_id: number;
  date: string;
  arc_type: string;
  arc_asymmetry: number;
  sentiment_range: number;
  sentence_count: number;
}

export interface NarrativeArcRangeResult {
  date_from: string;
  date_to: string;
  letter_count: number;
  arc_distribution: Record<string, number>;
  avg_sentiment_range: number;
  avg_asymmetry: number;
  trend_description: string;
}

export interface NavigateResult {
  navigated: true;
  url: string;
  target: string;
  id: string | number;
}
