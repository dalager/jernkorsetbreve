/**
 * WebMCP registration entry point (ADR-060).
 *
 * Detects `navigator.modelContext` and, if present, registers all 10 tools
 * defined in ADR-061. Runs once, non-blocking, after the page has loaded.
 *
 * Import this module from a client component mounted at the root layout.
 * It is a no-op on browsers without WebMCP support.
 */

import type { WebMCPToolRegistration } from "./types";
import { searchTools } from "./tools/search";
import { retrievalTools } from "./tools/retrieval";
import { analysisTools } from "./tools/analysis";
import { navigationTools } from "./tools/navigation";

// ---------------------------------------------------------------------------
// All tools, combined
// ---------------------------------------------------------------------------

const ALL_TOOLS: WebMCPToolRegistration[] = [
  ...searchTools,
  ...retrievalTools,
  ...analysisTools,
  ...navigationTools,
];

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

let registered = false;

function registerTools(): void {
  if (registered) return;
  if (typeof navigator === "undefined" || !navigator.modelContext) return;

  for (const tool of ALL_TOOLS) {
    try {
      navigator.modelContext.registerTool({
        ...tool.definition,
        execute: tool.execute,
      });
    } catch (err) {
      // InvalidStateError = duplicate name — should not happen since we
      // control all tool names, but log rather than crash.
      console.warn(`[WebMCP] Failed to register tool "${tool.definition.name}":`, err);
    }
  }

  registered = true;
  console.info(`[WebMCP] Registered ${ALL_TOOLS.length} tools`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Call once from a client component's useEffect. Idempotent — safe to call
 * multiple times. Runs synchronously (tool *definitions* are plain objects;
 * no data is fetched until an agent calls a tool).
 */
export function initWebMCP(): void {
  registerTools();
}
