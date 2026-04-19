/**
 * Cached JSON data loader for WebMCP tools.
 * Fetches static JSON files from /data/ and caches them in memory.
 * All data is pre-computed by the pipeline — no server-side API.
 */

const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

export async function getData<T>(path: string): Promise<T> {
  if (cache.has(path)) {
    return cache.get(path) as T;
  }

  // Deduplicate concurrent requests for the same path
  if (inflight.has(path)) {
    return inflight.get(path) as Promise<T>;
  }

  const promise = fetch(path)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch ${path}: ${res.status}`);
      }
      return res.json();
    })
    .then((data) => {
      cache.set(path, data);
      inflight.delete(path);
      return data as T;
    })
    .catch((err) => {
      inflight.delete(path);
      throw err;
    });

  inflight.set(path, promise);
  return promise as Promise<T>;
}

/** Strip HTML tags from a string, returning plain text. */
export function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
}

/** Data file paths (centralized to avoid typos) */
export const DATA = {
  letters: "/data/letters.json",
  letterSummaries: "/data/letter-summaries.json",
  searchSnippets: "/data/search-snippets.json",
  relatedLetters: "/data/related-letters.json",
  personRegistry: "/data/person-registry.json",
  personPages: "/data/person-pages.json",
  placesJson: "/data/places.json",
  placePages: "/data/place-pages.json",
  socialNetwork: "/data/social-network.json",
  letterSentiments: "/data/letter-sentiments.json",
  emotionScores: "/data/cvp-emotion-scores.json",
  sentimentOverview: "/data/sentiment-overview.json",
  narrativeArcs: "/data/letter-narrative-arcs.json",
} as const;
