"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Returns true when the viewport width is below the given breakpoint.
 * Defaults to 768px (Tailwind md).
 * Starts false during SSR/static export, updates on hydration.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    [breakpoint]
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches,
    [breakpoint]
  );

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
