"use client";

import React, { Suspense } from "react";
import AppShell from "@/components/layout/AppShell";
import SettingsSubNav from "@/components/settings/SettingsSubNav";
import SettingsGroupHeader from "@/components/settings/SettingsGroupHeader";

/** Card that fills the settings content pane; only its list should scroll. */
export const SETTINGS_FILL_CARD =
  "flex h-full min-h-0 flex-col overflow-hidden";
export const SETTINGS_FILL_CARD_HEADER = "shrink-0 pb-3";
export const SETTINGS_FILL_CARD_CONTENT =
  "flex min-h-0 flex-1 flex-col overflow-hidden";
export const SETTINGS_FILL_LIST =
  "min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain";

/**
 * Pins settings group header + sub-nav and gives children the remaining
 * viewport height so the page itself does not scroll.
 */
export default function SettingsPageShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell
      className="h-dvh overflow-hidden"
      contentClassName="h-full overflow-hidden"
      mainClassName="flex h-full min-h-0 flex-col gap-6 overflow-hidden"
    >
      <Suspense fallback={null}>
        <div className="shrink-0 space-y-6">
          <SettingsGroupHeader />
          <SettingsSubNav />
        </div>
      </Suspense>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </AppShell>
  );
}
