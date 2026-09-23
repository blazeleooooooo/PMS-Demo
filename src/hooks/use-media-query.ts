"use client";

import { useEffect, useState } from "react";

/** Tailwind `lg` — iPad landscape / desktop chrome. Below this, nav is a drawer. */
export const DESKTOP_NAV_QUERY = "(min-width: 1024px)";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export function useIsDesktopNav(): boolean {
  return useMediaQuery(DESKTOP_NAV_QUERY);
}
