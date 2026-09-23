"use client";

import { useRouter } from "next/navigation";
import { useTransition, useCallback, useState, useEffect } from "react";
import {
  handleNavClick,
  type NavModifierEvent,
} from "@/lib/nav-click";

/**
 * Hook for instant navigation with loading state.
 * Wraps router.push in startTransition so the browser navigates immediately
 * while data loads in the background.
 *
 * Pass the click event as the second argument so Ctrl/Cmd+click (and
 * Shift / middle-click) opens the href in a new tab.
 */
export function useNavigate() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [targetHref, setTargetHref] = useState<string | null>(null);

  // Clear target once transition completes
  useEffect(() => {
    if (!isPending) {
      setTargetHref(null);
    }
  }, [isPending]);

  const navigate = useCallback(
    (href: string, event?: NavModifierEvent | null) => {
      handleNavClick(href, event, (nextHref) => {
        setTargetHref(nextHref);
        startTransition(() => {
          router.push(nextHref);
        });
      });
    },
    [router]
  );

  const prefetch = useCallback(
    (href: string) => {
      router.prefetch(href);
    },
    [router]
  );

  return {
    navigate,
    prefetch,
    isPending,
    targetHref,
  };
}
