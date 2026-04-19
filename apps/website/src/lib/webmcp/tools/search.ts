/**
 * WebMCP search tools for jernkorset.dk letter corpus.
 *
 * Three tools:
 *   - search_letters      — semantic full-text search via pre-computed embeddings
 *   - find_similar_letters — pre-computed nearest-neighbour lookup by letter ID
 *   - browse_letters       — filtered, paginated metadata listing (no body text)
 */

import { WebMCPToolRegistration } from "../types";
import { getData, DATA } from "../data-loader";
import { getSearchEngine } from "../../search-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LetterRecord {
  id: number;
  date: string;
  sender: string;
  recipient: string;
  place: string;
  text?: string;
  text_modern?: string;
  location?: { lat: number; lng: number } | null;
}

type RelatedLettersMap = Record<string, Array<{ id: number; score: number }>>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a numeric value between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Fetch letters and build a lookup map. */
async function getLetterMap(): Promise<Map<number, LetterRecord>> {
  const letters = await getData<LetterRecord[]>(DATA.letters);
  return new Map(letters.map((l) => [l.id, l]));
}

// ---------------------------------------------------------------------------
// Tool 1: search_letters
// ---------------------------------------------------------------------------

const searchLettersTool: WebMCPToolRegistration = {
  definition: {
    name: "search_letters",
    title: "Search Letters",
    description:
      "Semantic full-text search across 665 WW1 Danish letters using multilingual embeddings. " +
      "Returns ranked matches with metadata and a representative text snippet. " +
      "The search engine initialises on first call (downloads ~30 MB model + embeddings); " +
      "subsequent calls are fast. Supports Danish and English queries.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search query. Supports Danish and English. Examples: 'soldater i skyttegraven', " +
            "'Christmas 1915', 'hjemve og familie'.",
        },
        top_k: {
          type: "integer",
          description: "Maximum number of results to return. Defaults to 10, max 50.",
          default: 10,
          minimum: 1,
          maximum: 50,
        },
      },
      required: ["query"],
    },
    annotations: { readOnlyHint: true },
  },

  execute: async (input) => {
    const query = input.query as string;
    const topK = clamp(Number(input.top_k ?? 10), 1, 50);

    const engine = getSearchEngine();
    if (!engine.isReady()) {
      await engine.init();
    }

    const rawResults = await engine.search(query, topK);
    const letterMap = await getLetterMap();
    const letters = Array.from(letterMap.values());

    const results = rawResults.map(({ letterId, score }) => {
      const letter = letterMap.get(letterId);
      return {
        letterId,
        score: Math.round(score * 10000) / 10000,
        date: letter?.date ?? "",
        sender: letter?.sender ?? "",
        recipient: letter?.recipient ?? "",
        place: letter?.place ?? "",
        snippet: engine.getSnippet(letterId) ?? "",
      };
    });

    return {
      results,
      totalLetters: letters.length,
      queryLanguageNote:
        "Query was matched against original Danish letter text. Both Danish and English queries are supported.",
    };
  },
};

// ---------------------------------------------------------------------------
// Tool 2: find_similar_letters
// ---------------------------------------------------------------------------

const findSimilarLettersTool: WebMCPToolRegistration = {
  definition: {
    name: "find_similar_letters",
    title: "Find Similar Letters",
    description:
      "Returns pre-computed nearest-neighbour letters for a given letter ID, " +
      "ranked by embedding similarity. Useful for corpus exploration and finding thematic clusters. " +
      "Similarity scores are cosine similarity in embedding space.",
    inputSchema: {
      type: "object",
      properties: {
        letter_id: {
          type: "integer",
          description: "Numeric ID of the source letter.",
        },
        top_k: {
          type: "integer",
          description: "Maximum number of similar letters to return. Defaults to 5, max 20.",
          default: 5,
          minimum: 1,
          maximum: 20,
        },
      },
      required: ["letter_id"],
    },
    annotations: { readOnlyHint: true },
  },

  execute: async (input) => {
    const letterId = Number(input.letter_id);
    const topK = clamp(Number(input.top_k ?? 5), 1, 20);

    const [relatedMap, letterMap] = await Promise.all([
      getData<RelatedLettersMap>(DATA.relatedLetters),
      getLetterMap(),
    ]);

    const source = letterMap.get(letterId);
    if (!source) {
      throw new Error(`Letter with ID ${letterId} not found.`);
    }

    const neighbours = relatedMap[String(letterId)];
    if (!neighbours) {
      throw new Error(
        `No pre-computed similarity data found for letter ID ${letterId}.`
      );
    }

    const similar = neighbours.slice(0, topK).map(({ id, score }) => {
      const letter = letterMap.get(id);
      return {
        letterId: id,
        score: Math.round(score * 10000) / 10000,
        date: letter?.date ?? "",
        sender: letter?.sender ?? "",
        recipient: letter?.recipient ?? "",
        place: letter?.place ?? "",
      };
    });

    return {
      sourceLetter: {
        id: source.id,
        date: source.date,
        sender: source.sender,
        recipient: source.recipient,
      },
      similar,
    };
  },
};

// ---------------------------------------------------------------------------
// Tool 3: browse_letters
// ---------------------------------------------------------------------------

const browseLettersTool: WebMCPToolRegistration = {
  definition: {
    name: "browse_letters",
    title: "Browse Letters",
    description:
      "Returns a paginated list of letter metadata filtered by date range, sender, recipient, " +
      "or place. Does not include letter body text — use get_letter for full content. " +
      "All text filters are case-insensitive substring matches.",
    inputSchema: {
      type: "object",
      properties: {
        date_from: {
          type: "string",
          description:
            "ISO 8601 date string (YYYY-MM-DD). Only include letters on or after this date.",
        },
        date_to: {
          type: "string",
          description:
            "ISO 8601 date string (YYYY-MM-DD). Only include letters on or before this date.",
        },
        sender: {
          type: "string",
          description:
            "Case-insensitive substring filter on the sender field.",
        },
        recipient: {
          type: "string",
          description:
            "Case-insensitive substring filter on the recipient field.",
        },
        place: {
          type: "string",
          description:
            "Case-insensitive substring filter on the place field (writing location).",
        },
        offset: {
          type: "integer",
          description: "Zero-based pagination offset. Defaults to 0.",
          default: 0,
          minimum: 0,
        },
        limit: {
          type: "integer",
          description: "Maximum number of letters to return per page. Defaults to 20, max 100.",
          default: 20,
          minimum: 1,
          maximum: 100,
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },

  execute: async (input) => {
    const dateFrom = input.date_from as string | undefined;
    const dateTo = input.date_to as string | undefined;
    const senderFilter = (input.sender as string | undefined)?.toLowerCase();
    const recipientFilter = (input.recipient as string | undefined)?.toLowerCase();
    const placeFilter = (input.place as string | undefined)?.toLowerCase();
    const offset = Math.max(Number(input.offset ?? 0), 0);
    const limit = clamp(Number(input.limit ?? 20), 1, 100);

    const letterMap = await getLetterMap();
    let letters = Array.from(letterMap.values());

    // Apply filters
    if (dateFrom) {
      letters = letters.filter((l) => l.date >= dateFrom);
    }
    if (dateTo) {
      letters = letters.filter((l) => l.date <= dateTo);
    }
    if (senderFilter) {
      letters = letters.filter((l) =>
        l.sender.toLowerCase().includes(senderFilter)
      );
    }
    if (recipientFilter) {
      letters = letters.filter((l) =>
        l.recipient.toLowerCase().includes(recipientFilter)
      );
    }
    if (placeFilter) {
      letters = letters.filter((l) =>
        l.place.toLowerCase().includes(placeFilter)
      );
    }

    const total = letters.length;
    const page = letters.slice(offset, offset + limit);

    return {
      letters: page.map(({ id, date, sender, recipient, place }) => ({
        id,
        date,
        sender,
        recipient,
        place,
      })),
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
    };
  },
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const searchTools: WebMCPToolRegistration[] = [
  searchLettersTool,
  findSimilarLettersTool,
  browseLettersTool,
];
