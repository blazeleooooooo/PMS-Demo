"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import BWAPitchingList, {
  type PitchingListVariant,
} from "@/components/pitching/BWAPitchingList";

/**
 * Shared page shell for pitching list routes (/proposals, /key-pitching, etc.).
 * Keeps TopNav layout identical so future shell changes apply to every variant.
 */
export default function PitchingListPage({
  variant = "bwa",
}: {
  variant?: PitchingListVariant;
}) {
  return (
    <AppShell>
      <BWAPitchingList variant={variant} />
    </AppShell>
  );
}
