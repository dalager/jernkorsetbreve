/**
 * WebMCP Analysis Tools
 * Tool 8: get_sentiment - sentiment analysis for single letters or date ranges
 * Tool 9: get_narrative_arc - narrative arc analysis for single letters or date ranges
 */

import { WebMCPToolRegistration } from "../types";
import type {
  SentimentSingleResult,
  SentimentRangeResult,
  NarrativeArcSingleResult,
  NarrativeArcRangeResult,
} from "../types";
import { getData, DATA } from "../data-loader";

interface LetterData {
  id: number;
  date: string;
  sender: string;
  recipient: string;
  place: string;
}

interface LetterSentimentsData {
  [key: string]: {
    cvp_mean: number;
    cvp_min: number;
    cvp_p10: number;
    cvp_p90: number;
    cvp_range: number;
    negative_ratio: number;
    sentence_count: number;
  };
}

interface EmotionScoresData {
  [key: string]: {
    fear_mean: number;
    grief_mean: number;
    hope_mean: number;
    love_mean: number;
    anger_mean: number;
    gratitude_mean: number;
    loneliness_mean: number;
  };
}

interface SentimentOverviewData {
  corpus_summary: {
    letter_count: number;
    avg_sentiment: number;
    date_from: string;
    date_to: string;
    most_positive_letter: { id: number; date: string; cvp_mean: number };
    most_negative_letter: { id: number; date: string; cvp_mean: number };
  };
  emotion_distribution: Record<string, number>;
}

interface NarrativeArcsData {
  within_letter: {
    [key: string]: {
      arc_type: string;
      arc_asymmetry: number;
      sentiment_range: number;
      sentence_count: number;
    };
  };
  across_letters: Record<string, unknown>;
  arc_type_distribution: Record<string, number>;
}

/** Find the dominant emotion by comparing all emotion means */
function findDominantEmotion(emotions: Record<string, number>): string {
  let dominant = "unknown";
  let maxMean = -Infinity;

  for (const [emotion, mean] of Object.entries(emotions)) {
    if (typeof mean === "number" && mean > maxMean) {
      maxMean = mean;
      dominant = emotion;
    }
  }

  return dominant;
}

/** Parse date string (YYYY-MM-DD) to Date object */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Check if date is within range (inclusive) */
function isDateInRange(date: string, from: string, to: string): boolean {
  const d = parseDate(date);
  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  return d >= fromDate && d <= toDate;
}

/** Find dominant arc type and its count from arc type distribution */
function findDominantArcType(arcTypeCounts: Record<string, number>): {
  type: string;
  count: number;
} {
  let dominantType = "unknown";
  let maxCount = 0;

  for (const [arcType, count] of Object.entries(arcTypeCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantType = arcType;
    }
  }

  return { type: dominantType, count: maxCount };
}

/** Extract YYYY-MM from YYYY-MM-DD */
function getMonth(date: string): string {
  return date.substring(0, 7);
}

/** Tool 8: get_sentiment */
const getSentimentTool: WebMCPToolRegistration = {
  definition: {
    name: "get_sentiment",
    title: "Get Sentiment Analysis",
    description:
      "Retrieve sentiment analysis for a single letter, a date range, or a corpus summary. Returns emotional intensity (CVP), dominant emotions, and negative ratios.",
    inputSchema: {
      type: "object",
      properties: {
        letter_id: {
          type: "integer",
          minimum: 1,
          maximum: 665,
          description: "Letter ID (1-665). If provided, returns sentiment for that letter.",
        },
        date_from: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          description: "Start date (YYYY-MM-DD). If provided with date_to, returns range analysis.",
        },
        date_to: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          description: "End date (YYYY-MM-DD). If provided with date_from, returns range analysis.",
        },
      },
      description:
        "Provide either letter_id, date_from/date_to, or neither (for corpus overview).",
    },
    annotations: { readOnlyHint: true },
  },
  execute: async (input: Record<string, unknown>) => {
    const letterId = input.letter_id as number | undefined;
    const dateFrom = input.date_from as string | undefined;
    const dateTo = input.date_to as string | undefined;

    // Case 1: Single letter
    if (letterId !== undefined) {
      const letters = await getData<LetterData[]>(DATA.letters);
      const sentiments = await getData<LetterSentimentsData>(DATA.letterSentiments);
      const emotions = await getData<EmotionScoresData>(DATA.emotionScores);

      const letter = letters.find((l) => l.id === letterId);
      if (!letter) {
        throw new Error(`Letter ${letterId} not found`);
      }

      const sentimentKey = String(letterId);
      const sentimentData = sentiments[sentimentKey];
      const emotionData = emotions[sentimentKey];

      if (!sentimentData || !emotionData) {
        throw new Error(`Sentiment or emotion data not found for letter ${letterId}`);
      }

      const dominantEmotion = findDominantEmotion(emotionData);

      const result: SentimentSingleResult = {
        letter_id: letterId,
        date: letter.date,
        sentiment: sentimentData,
        emotions: emotionData,
        dominant_emotion: dominantEmotion,
      };

      return result;
    }

    // Case 2: Date range
    if (dateFrom && dateTo) {
      const letters = await getData<LetterData[]>(DATA.letters);
      const sentiments = await getData<LetterSentimentsData>(DATA.letterSentiments);
      const emotions = await getData<EmotionScoresData>(DATA.emotionScores);

      // Filter letters in date range
      const letterIds = letters
        .filter((l) => isDateInRange(l.date, dateFrom, dateTo))
        .map((l) => l.id);

      // Group by month and calculate monthly means
      const monthlyData = new Map<string, { sentiments: number[]; letters: number[] }>();

      for (const letterId of letterIds) {
        const letter = letters.find((l) => l.id === letterId);
        if (!letter) continue;

        const sentimentKey = String(letterId);
        const sentimentData = sentiments[sentimentKey];

        if (!sentimentData) continue;

        const month = getMonth(letter.date);
        if (!monthlyData.has(month)) {
          monthlyData.set(month, { sentiments: [], letters: [] });
        }

        const monthEntry = monthlyData.get(month)!;
        monthEntry.sentiments.push(sentimentData.cvp_mean);
        monthEntry.letters.push(letterId);
      }

      // Calculate monthly trend
      const monthlyTrend = Array.from(monthlyData.entries())
        .map(([month, data]) => ({
          month,
          mean_sentiment:
            data.sentiments.reduce((a, b) => a + b, 0) / data.sentiments.length,
          letter_count: data.letters.length,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // Find most positive and negative letters
      let mostPositiveId = letterIds[0];
      let mostNegativeId = letterIds[0];
      let maxSentiment = -Infinity;
      let minSentiment = Infinity;

      for (const id of letterIds) {
        const sentimentKey = String(id);
        const sentimentData = sentiments[sentimentKey];
        if (!sentimentData) continue;

        if (sentimentData.cvp_mean > maxSentiment) {
          maxSentiment = sentimentData.cvp_mean;
          mostPositiveId = id;
        }
        if (sentimentData.cvp_mean < minSentiment) {
          minSentiment = sentimentData.cvp_mean;
          mostNegativeId = id;
        }
      }

      // Find overall dominant emotion
      const emotionTotals: Record<string, number> = {};
      const emotionCounts: Record<string, number> = {};

      for (const id of letterIds) {
        const emotionKey = String(id);
        const emotionData = emotions[emotionKey];
        if (!emotionData) continue;

        for (const [emotion, mean] of Object.entries(emotionData)) {
          emotionTotals[emotion] = (emotionTotals[emotion] || 0) + mean;
          emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
        }
      }

      const emotionMeans: Record<string, number> = {};
      for (const emotion in emotionTotals) {
        emotionMeans[emotion] = emotionTotals[emotion] / emotionCounts[emotion];
      }

      const dominantEmotion = findDominantEmotion(emotionMeans);

      // Calculate average sentiment for the period
      const allSentiments = letterIds
        .map((id) => sentiments[String(id)])
        .filter((s) => s !== undefined)
        .map((s) => s.cvp_mean);

      const avgSentiment =
        allSentiments.length > 0
          ? allSentiments.reduce((a, b) => a + b, 0) / allSentiments.length
          : 0;

      const positiveLetterDate =
        letters.find((l) => l.id === mostPositiveId)?.date || dateFrom;
      const negativeLetterDate =
        letters.find((l) => l.id === mostNegativeId)?.date || dateFrom;

      const result: SentimentRangeResult = {
        date_from: dateFrom,
        date_to: dateTo,
        letter_count: letterIds.length,
        monthly_trend: monthlyTrend,
        period_summary: {
          avg_sentiment: avgSentiment,
          most_positive_letter: {
            id: mostPositiveId,
            date: positiveLetterDate,
            cvp_mean: maxSentiment,
          },
          most_negative_letter: {
            id: mostNegativeId,
            date: negativeLetterDate,
            cvp_mean: minSentiment,
          },
          dominant_emotion: dominantEmotion,
        },
      };

      return result;
    }

    // Case 3: Corpus overview
    const overview = await getData<SentimentOverviewData>(DATA.sentimentOverview);
    return overview.corpus_summary;
  },
};

/** Tool 9: get_narrative_arc */
const getNarrativeArcTool: WebMCPToolRegistration = {
  definition: {
    name: "get_narrative_arc",
    title: "Get Narrative Arc Analysis",
    description:
      "Retrieve narrative arc analysis for a single letter or a date range. Identifies arc types (rising, falling, flat, etc.) and emotional trajectories.",
    inputSchema: {
      type: "object",
      properties: {
        letter_id: {
          type: "integer",
          minimum: 1,
          maximum: 665,
          description: "Letter ID (1-665). If provided, returns arc for that letter.",
        },
        date_from: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          description: "Start date (YYYY-MM-DD). If provided with date_to, returns range analysis.",
        },
        date_to: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          description: "End date (YYYY-MM-DD). If provided with date_from, returns range analysis.",
        },
      },
      description: "Provide either letter_id or date_from/date_to.",
    },
    annotations: { readOnlyHint: true },
  },
  execute: async (input: Record<string, unknown>) => {
    const letterId = input.letter_id as number | undefined;
    const dateFrom = input.date_from as string | undefined;
    const dateTo = input.date_to as string | undefined;

    const arcs = await getData<NarrativeArcsData>(DATA.narrativeArcs);

    // Case 1: Single letter
    if (letterId !== undefined) {
      const arcKey = String(letterId);
      const arcData = arcs.within_letter[arcKey];

      if (!arcData) {
        throw new Error(`Narrative arc data not found for letter ${letterId}`);
      }

      // Get letter date
      const letters = await getData<LetterData[]>(DATA.letters);
      const letter = letters.find((l) => l.id === letterId);

      const result: NarrativeArcSingleResult = {
        letter_id: letterId,
        date: letter?.date || "",
        arc_type: arcData.arc_type,
        arc_asymmetry: arcData.arc_asymmetry,
        sentiment_range: arcData.sentiment_range,
        sentence_count: arcData.sentence_count,
      };

      return result;
    }

    // Case 2: Date range
    if (dateFrom && dateTo) {
      const letters = await getData<LetterData[]>(DATA.letters);

      // Filter letters in date range
      const letterIds = letters
        .filter((l) => isDateInRange(l.date, dateFrom, dateTo))
        .map((l) => l.id);

      // Collect arc data
      const arcTypeCounts: Record<string, number> = {};
      let totalSentimentRange = 0;
      let totalAsymmetry = 0;
      let validLetterCount = 0;

      for (const id of letterIds) {
        const arcKey = String(id);
        const arcData = arcs.within_letter[arcKey];

        if (!arcData) continue;

        arcTypeCounts[arcData.arc_type] = (arcTypeCounts[arcData.arc_type] || 0) + 1;
        totalSentimentRange += arcData.sentiment_range;
        totalAsymmetry += arcData.arc_asymmetry;
        validLetterCount++;
      }

      // Calculate distribution percentages
      const arcDistribution: Record<string, number> = {};
      for (const [arcType, count] of Object.entries(arcTypeCounts)) {
        arcDistribution[arcType] =
          validLetterCount > 0 ? (count / validLetterCount) * 100 : 0;
      }

      // Calculate averages
      const avgSentimentRange =
        validLetterCount > 0 ? totalSentimentRange / validLetterCount : 0;
      const avgAsymmetry = validLetterCount > 0 ? totalAsymmetry / validLetterCount : 0;

      // Generate trend description by comparing first and second halves
      const midpoint = Math.floor(letterIds.length / 2);
      const firstHalf = letterIds.slice(0, midpoint);
      const secondHalf = letterIds.slice(midpoint);

      // Count arc types in each half
      const countArcTypesInHalf = (ids: number[]): Record<string, number> => {
        const arcCounts: Record<string, number> = {};
        for (const id of ids) {
          const arcKey = String(id);
          const arcData = arcs.within_letter[arcKey];
          if (arcData) {
            arcCounts[arcData.arc_type] = (arcCounts[arcData.arc_type] || 0) + 1;
          }
        }
        return arcCounts;
      };

      const firstHalfArcs = countArcTypesInHalf(firstHalf);
      const secondHalfArcs = countArcTypesInHalf(secondHalf);

      const firstHalfDominant = findDominantArcType(firstHalfArcs);
      const secondHalfDominant = findDominantArcType(secondHalfArcs);

      const firstHalfPercent =
        firstHalf.length > 0 ? Math.round((firstHalfDominant.count / firstHalf.length) * 100) : 0;
      const secondHalfPercent =
        secondHalf.length > 0 ? Math.round((secondHalfDominant.count / secondHalf.length) * 100) : 0;

      const trendDescription =
        firstHalfDominant.type !== secondHalfDominant.type
          ? `Letters shift from predominantly ${firstHalfDominant.type} arcs (${firstHalfPercent}%) ` +
            `to ${secondHalfDominant.type} arcs (${secondHalfPercent}%) in the second half of this period`
          : `Letters maintain predominantly ${firstHalfDominant.type} arcs throughout the period ` +
            `(first half: ${firstHalfPercent}%, second half: ${secondHalfPercent}%)`;

      const result: NarrativeArcRangeResult = {
        date_from: dateFrom,
        date_to: dateTo,
        letter_count: letterIds.length,
        arc_distribution: arcDistribution,
        avg_sentiment_range: avgSentimentRange,
        avg_asymmetry: avgAsymmetry,
        trend_description: trendDescription,
      };

      return result;
    }

    throw new Error("Provide either letter_id or date_from/date_to");
  },
};

export const analysisTools: WebMCPToolRegistration[] = [
  getSentimentTool,
  getNarrativeArcTool,
];
