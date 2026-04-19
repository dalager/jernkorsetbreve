/**
 * WebMCP Retrieval Tools (ADR-061)
 * Four data retrieval tools: get_letter, get_person, get_place, get_social_network
 */

import {
  WebMCPToolRegistration,
  GetLetterResult,
  GetPersonResult,
  GetPlaceResult,
  GetSocialNetworkResult,
  LetterAnalysis,
  NetworkNode,
} from "../types";
import { getData, stripHtml, DATA } from "../data-loader";

// ============================================================================
// Shared Data Interfaces
// ============================================================================

interface Letter {
  id: number;
  date: string;
  sender: string;
  recipient: string;
  place: string;
  location?: { lat: number; lng: number } | null;
  text: string;
  text_modern: string;
}

interface SentimentEntry {
  cvp_mean: number;
  cvp_range: number;
  negative_ratio: number;
  [key: string]: unknown;
}

interface EmotionEntry {
  fear_mean: number;
  grief_mean: number;
  hope_mean: number;
  love_mean: number;
  anger_mean: number;
  gratitude_mean: number;
  loneliness_mean: number;
  [key: string]: unknown;
}

interface NarrativeArcEntry {
  arc_type: string;
  arc_asymmetry: number;
  sentiment_range: number;
}

interface NarrativeArcData {
  within_letter: Record<string, NarrativeArcEntry>;
}

interface PersonPage {
  id: string;
  full_name: string;
  canonical: string;
  role: string;
  category: string;
  biographical: string;
  birth_date: string | null;
  death_date: string | null;
  letters: Array<{
    letter_id: number;
    date: string;
    sender: string;
    recipient: string;
  }>;
  connections: Array<{ person_id: string; canonical: string }>;
  letter_count: number;
  first_mention: string;
  last_mention: string;
  photos: string[];
}

interface RegistryEntry {
  id: string;
  canonical: string;
  aliases: string[];
}

interface PlacePage {
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
  letters: Array<{
    letter_id: number;
    date: string;
    sender: string;
    recipient: string;
  }>;
  named_locations?: unknown[];
}

interface SocialNetworkNode {
  id: string;
  canonical: string;
  category: string;
  role: string;
  letter_count: number;
  degree_centrality: number;
  betweenness_centrality: number;
  pagerank: number;
  disappeared?: boolean;
  silence_date?: string | null;
}

interface SocialNetworkEdge {
  source: string;
  target: string;
  weight: number;
  years: number[];
}

interface SocialNetworkData {
  metadata: { node_count: number; edge_count: number; generated: string };
  global_metrics?: Record<string, number>;
  nodes: SocialNetworkNode[];
  edges: SocialNetworkEdge[];
  temporal_slices?: Array<{
    year: number;
    node_count: number;
    edge_count: number;
  }>;
}

// ============================================================================
// Tool 1: get_letter
// ============================================================================

const getLetterTool: WebMCPToolRegistration = {
  definition: {
    name: "get_letter",
    title: "Get Letter",
    description:
      "Fetch a specific WW1 Danish letter by ID (1-665). Returns full text in original archaic Danish and modernized Danish, plus metadata. Optionally includes sentiment, emotion, and narrative arc analysis.",
    inputSchema: {
      type: "object",
      properties: {
        letter_id: {
          type: "integer",
          minimum: 1,
          maximum: 665,
          description: "The letter ID (1-665)",
        },
        include_analysis: {
          type: "boolean",
          default: false,
          description:
            "If true, include sentiment scores, emotion vectors, and narrative arc type",
        },
      },
      required: ["letter_id"],
    },
    annotations: { readOnlyHint: true },
  },
  execute: async (input) => {
    const letterId = input.letter_id as number;
    const includeAnalysis = input.include_analysis as boolean | undefined;

    const letters = await getData<Letter[]>(DATA.letters);
    const letter = letters.find((l) => l.id === letterId);

    if (!letter) {
      throw new Error(`Letter ${letterId} not found`);
    }

    const result: GetLetterResult = {
      id: letter.id,
      date: letter.date,
      sender: letter.sender,
      recipient: letter.recipient,
      place: letter.place,
      location: letter.location || null,
      text_original: stripHtml(letter.text),
      text_modern: stripHtml(letter.text_modern),
    };

    if (includeAnalysis) {
      const sentiments = await getData<Record<string, SentimentEntry>>(
        DATA.letterSentiments
      );
      const sentimentData = sentiments[String(letterId)];

      const emotions = await getData<Record<string, EmotionEntry>>(
        DATA.emotionScores
      );
      const emotionData = emotions[String(letterId)];

      const narrativeData = await getData<NarrativeArcData>(DATA.narrativeArcs);
      const arcData = narrativeData.within_letter[String(letterId)];

      if (sentimentData && emotionData && arcData) {
        result.analysis = {
          sentiment: {
            cvp_mean: sentimentData.cvp_mean,
            cvp_range: sentimentData.cvp_range,
            negative_ratio: sentimentData.negative_ratio,
          },
          emotions: {
            fear_mean: emotionData.fear_mean,
            grief_mean: emotionData.grief_mean,
            hope_mean: emotionData.hope_mean,
            love_mean: emotionData.love_mean,
            anger_mean: emotionData.anger_mean,
            gratitude_mean: emotionData.gratitude_mean,
            loneliness_mean: emotionData.loneliness_mean,
          },
          narrative_arc: {
            arc_type: arcData.arc_type,
            arc_asymmetry: arcData.arc_asymmetry,
            sentiment_range: arcData.sentiment_range,
          },
        } as LetterAnalysis;
      }
    }

    return result;
  },
};

// ============================================================================
// Tool 2: get_person
// ============================================================================

const getPersonTool: WebMCPToolRegistration = {
  definition: {
    name: "get_person",
    title: "Get Person",
    description:
      "Fetch a specific person from the WW1 Danish letters social network by ID. Returns biographical data, letters they sent/received, and optionally their network connections (degree centrality, betweenness centrality, pagerank).",
    inputSchema: {
      type: "object",
      properties: {
        person_id: {
          type: "string",
          description: "The person ID (canonical name)",
        },
        include_letters: {
          type: "boolean",
          default: true,
          description: "If true, include list of letters sent/received by this person",
        },
        include_network: {
          type: "boolean",
          default: false,
          description:
            "If true, include network metrics and connected persons from social-network.json",
        },
      },
      required: ["person_id"],
    },
    annotations: { readOnlyHint: true },
  },
  execute: async (input) => {
    const personId = input.person_id as string;
    const includeLetters = (input.include_letters as boolean | undefined) ?? true;
    const includeNetwork = input.include_network as boolean | undefined;

    const personPages = await getData<PersonPage[]>(DATA.personPages);
    const person = personPages.find(
      (p) => p.id === personId || p.canonical === personId
    );

    if (!person) {
      throw new Error(`Person ${personId} not found`);
    }

    const registry = await getData<RegistryEntry[]>(DATA.personRegistry);
    const registryEntry = registry.find(
      (r) => r.id === person.id || r.canonical === person.canonical
    );

    const result: GetPersonResult = {
      id: person.id,
      full_name: person.full_name,
      canonical: person.canonical,
      role: person.role,
      category: person.category,
      biographical: person.biographical,
      birth_date: person.birth_date,
      death_date: person.death_date,
      aliases: registryEntry?.aliases || [],
      first_mention: person.first_mention,
      last_mention: person.last_mention,
      letter_count: person.letter_count,
      photos: person.photos,
    };

    if (includeLetters) {
      result.letters = person.letters;
    }

    if (includeNetwork) {
      const network = await getData<SocialNetworkData>(DATA.socialNetwork);
      const node = network.nodes.find(
        (n) => n.id === person.id || n.canonical === person.canonical
      );

      if (node) {
        const connections = network.edges
          .filter((e) => e.source === node.id || e.target === node.id)
          .map((e) => {
            const otherId = e.source === node.id ? e.target : e.source;
            const otherNode = network.nodes.find((n) => n.id === otherId);
            return {
              person_id: otherId,
              canonical: otherNode?.canonical || otherId,
              weight: e.weight,
            };
          });

        result.network = {
          degree_centrality: node.degree_centrality,
          betweenness_centrality: node.betweenness_centrality,
          pagerank: node.pagerank,
          connections,
        };
      }
    }

    return result;
  },
};

// ============================================================================
// Tool 3: get_place
// ============================================================================

const getPlaceTool: WebMCPToolRegistration = {
  definition: {
    name: "get_place",
    title: "Get Place",
    description:
      "Fetch a specific place (location) mentioned in the WW1 Danish letters. Returns geographical data (coordinates, Wikidata link), photos, and optionally the list of letters mentioning this place.",
    inputSchema: {
      type: "object",
      properties: {
        place_id: {
          type: "string",
          description: "The place ID (name)",
        },
        include_letters: {
          type: "boolean",
          default: true,
          description: "If true, include list of letters mentioning this place",
        },
      },
      required: ["place_id"],
    },
    annotations: { readOnlyHint: true },
  },
  execute: async (input) => {
    const placeId = input.place_id as string;
    const includeLetters = (input.include_letters as boolean | undefined) ?? true;

    const places = await getData<PlacePage[]>(DATA.placePages);
    const place = places.find((p) => p.id === placeId || p.name === placeId);

    if (!place) {
      throw new Error(`Place ${placeId} not found`);
    }

    const result: GetPlaceResult = {
      id: place.id,
      name: place.name,
      modern_name: place.modern_name,
      country: place.country,
      lat: place.lat,
      lng: place.lng,
      wikidata_id: place.wikidata_id,
      wikipedia_url: place.wikipedia_url,
      letter_count: place.letter_count,
      photos: place.photos,
    };

    if (includeLetters) {
      result.letters = place.letters;
    }

    return result;
  },
};

// ============================================================================
// Tool 4: get_social_network
// ============================================================================

const getSocialNetworkTool: WebMCPToolRegistration = {
  definition: {
    name: "get_social_network",
    title: "Get Social Network",
    description:
      "Fetch the WW1 Danish letters social network. Returns nodes (persons) ranked by centrality/pagerank, and optionally edges (connections) between them. If person_id is provided, returns that person's subgraph; otherwise returns top 20 nodes by pagerank.",
    inputSchema: {
      type: "object",
      properties: {
        person_id: {
          type: "string",
          description:
            "Optional: if provided, return only this person's node and their immediate connections",
        },
        include_edges: {
          type: "boolean",
          default: true,
          description: "If true, include edges (connections) in the result",
        },
        include_temporal_slices: {
          type: "boolean",
          default: false,
          description:
            "If true, include yearly breakdown of network growth over the war period",
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  execute: async (input) => {
    const personId = input.person_id as string | undefined;
    const includeEdges = (input.include_edges as boolean | undefined) ?? true;
    const includeTemporalSlices = input.include_temporal_slices as
      | boolean
      | undefined;

    const network = await getData<SocialNetworkData>(DATA.socialNetwork);

    let nodes: NetworkNode[];
    let edges: SocialNetworkEdge[] | undefined;

    if (personId) {
      nodes = buildPersonSubgraph(network, personId, includeEdges);
      if (includeEdges) {
        edges = filterEdgesForPerson(network, personId);
      }
    } else {
      nodes = getTopNodesByPagerank(network, 20);
      if (includeEdges) {
        edges = filterEdgesForNodes(network, nodes);
      }
    }

    const result: GetSocialNetworkResult = {
      metadata: {
        node_count: network.metadata.node_count,
        edge_count: network.metadata.edge_count,
        generated: network.metadata.generated,
      },
      global_metrics: network.global_metrics || {},
      nodes,
    };

    if (includeEdges && edges) {
      result.edges = edges;
    }

    if (includeTemporalSlices && network.temporal_slices) {
      result.temporal_slices = network.temporal_slices;
    }

    return result;
  },
};

// ============================================================================
// Helper Functions for get_social_network
// ============================================================================

function buildPersonSubgraph(
  network: SocialNetworkData,
  personId: string,
  includeEdges: boolean
): NetworkNode[] {
  const personNode = network.nodes.find(
    (n) => n.id === personId || n.canonical === personId
  );

  if (!personNode) {
    throw new Error(`Person ${personId} not found in social network`);
  }

  const nodes: NetworkNode[] = [personNode as NetworkNode];

  if (includeEdges) {
    const relatedEdges = network.edges.filter(
      (e) => e.source === personNode.id || e.target === personNode.id
    );

    const connectedIds = new Set<string>();
    relatedEdges.forEach((e) => {
      connectedIds.add(e.source === personNode.id ? e.target : e.source);
    });

    connectedIds.forEach((id) => {
      const node = network.nodes.find((n) => n.id === id);
      if (node) {
        nodes.push(node as NetworkNode);
      }
    });
  }

  return nodes;
}

function getTopNodesByPagerank(
  network: SocialNetworkData,
  limit: number
): NetworkNode[] {
  const sorted = [...network.nodes].sort((a, b) => b.pagerank - a.pagerank);
  return sorted.slice(0, limit) as NetworkNode[];
}

function filterEdgesForPerson(
  network: SocialNetworkData,
  personId: string
): SocialNetworkEdge[] {
  const personNode = network.nodes.find(
    (n) => n.id === personId || n.canonical === personId
  );
  return network.edges.filter(
    (e) => e.source === personNode?.id || e.target === personNode?.id
  );
}

function filterEdgesForNodes(
  network: SocialNetworkData,
  nodes: NetworkNode[]
): SocialNetworkEdge[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  return network.edges.filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
  );
}

export const retrievalTools: WebMCPToolRegistration[] = [
  getLetterTool,
  getPersonTool,
  getPlaceTool,
  getSocialNetworkTool,
];
