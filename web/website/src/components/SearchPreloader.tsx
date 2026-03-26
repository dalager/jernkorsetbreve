"use client";

import { useEffect } from "react";
import { getSearchEngine } from "@/lib/search-engine";

export default function SearchPreloader() {
  useEffect(() => {
    const timer = setTimeout(() => {
      // Respect users on slow or metered connections
      const conn = (
        navigator as unknown as {
          connection?: { saveData?: boolean; effectiveType?: string };
        }
      ).connection;
      if (conn?.saveData || conn?.effectiveType === "2g") return;

      getSearchEngine()
        .init()
        .catch(() => {
          // Silently fail — search page will show its own error if user navigates there
        });
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
