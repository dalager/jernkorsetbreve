"use client";

import { useEffect } from "react";

/**
 * Registers WebMCP tools on mount. Renders nothing.
 * Placed in the root layout so tools are available on every page.
 */
export default function WebMCPProvider() {
  useEffect(() => {
    // Dynamic import keeps WebMCP out of the main bundle for non-supporting browsers.
    // The navigator check inside initWebMCP handles detection, so we only guard the import.
    if (typeof navigator !== "undefined") {
      import("@/lib/webmcp").then(({ initWebMCP }) => initWebMCP());
    }
  }, []);

  return null;
}
