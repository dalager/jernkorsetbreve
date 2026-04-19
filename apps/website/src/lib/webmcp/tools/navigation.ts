import { WebMCPToolRegistration, NavigateResult } from "../types";

const VIEW_ROUTES: Record<string, string> = {
  letters: "/breve",
  map: "/map",
  search: "/search",
  network: "/network",
  sentiment: "/sentiment",
  explorer: "/explorer",
  sproganalyse: "/sproganalyse",
  billeder: "/billeder",
  steder: "/steder",
  personer: "/personer",
  timeline: "/timeline",
  statistics: "/statistics",
};

const VALID_VIEWS = new Set(Object.keys(VIEW_ROUTES));

/**
 * Validates a person or place ID (must be a valid slug string)
 */
function isValidSlug(id: unknown): id is string {
  return typeof id === "string" && /^[a-z0-9\-_]+$/.test(id);
}

/**
 * Validates a letter ID (must be an integer between 1 and 665)
 */
function isValidLetterId(id: unknown): id is number {
  return typeof id === "number" && Number.isInteger(id) && id >= 1 && id <= 665;
}

/**
 * Builds the URL based on validated target type and ID
 * Assumes target and id are already validated by the caller
 */
function buildUrl(target: "letter" | "person" | "place" | "view", id: string | number): string {
  switch (target) {
    case "letter":
      return `/letters/${id}`;
    case "person":
      return `/personer/${id}`;
    case "place":
      return `/steder/${id}`;
    case "view": {
      const route = VIEW_ROUTES[id as string];
      if (!route) {
        throw new Error(
          `Invalid view ID: ${id}. Valid views are: ${Array.from(VALID_VIEWS).join(", ")}`
        );
      }
      return route;
    }
  }
}

/**
 * Tool 10: navigate_to
 * Navigates to a letter, person, place, or view within the app
 */
const navigateTo: WebMCPToolRegistration = {
  definition: {
    name: "navigate_to",
    title: "Navigate to Letter, Person, Place, or View",
    description:
      "Navigates to a specific letter, person, place, or application view within the jernkorsetbreve app",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          enum: ["letter", "person", "place", "view"],
          description: "What to navigate to: a letter, person, place, or application view",
        },
        id: {
          oneOf: [
            {
              type: "integer",
              description: "Letter ID (1-665)",
            },
            {
              type: "string",
              description: "Person/place slug or view name",
            },
          ],
          description: "The ID or identifier for the target (letter ID, person slug, place slug, or view name)",
        },
      },
      required: ["target", "id"],
    },
    annotations: {
      readOnlyHint: false,
    },
  },
  execute: async (input: Record<string, unknown>): Promise<NavigateResult> => {
    const { target, id } = input;

    // Validate target
    if (typeof target !== "string") {
      throw new Error("target must be a string");
    }
    const validTargets = ["letter", "person", "place", "view"] as const;
    if (!validTargets.includes(target as any)) {
      throw new Error(`target must be one of: ${validTargets.join(", ")}`);
    }

    // Validate id based on target type
    if (id === null || id === undefined) {
      throw new Error("id is required");
    }

    const typedTarget = target as "letter" | "person" | "place" | "view";
    switch (typedTarget) {
      case "letter": {
        if (!isValidLetterId(id)) {
          throw new Error(`Invalid letter ID: ${id}. Must be an integer between 1 and 665.`);
        }
        break;
      }
      case "person":
      case "place": {
        if (!isValidSlug(id)) {
          throw new Error(
            `Invalid ${typedTarget} ID: ${id}. Must be a slug containing only lowercase letters, numbers, hyphens, and underscores.`
          );
        }
        break;
      }
      case "view": {
        if (!isValidSlug(id)) {
          throw new Error(
            `Invalid view ID: ${id}. Must be a valid view name (lowercase, hyphens/underscores allowed).`
          );
        }
        break;
      }
    }

    // Build and navigate
    const url = buildUrl(typedTarget, id as string | number);
    if (typeof window !== "undefined") {
      window.location.assign(url);
    }

    return {
      navigated: true,
      url,
      target: typedTarget,
      id: id as string | number,
    };
  },
};

export const navigationTools: WebMCPToolRegistration[] = [navigateTo];
