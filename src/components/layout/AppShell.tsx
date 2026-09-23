"use client";

import React, { useState } from "react";
import TopNav from "@/components/dashboard/TopNav";
import { cn } from "@/lib/utils";

/**
 * Staff app chrome: TopNav + content offset.
 * Desktop (lg+) keeps the persistent sidebar. Below lg (iPad portrait / phone)
 * the sidebar becomes a drawer and this offset collapses to full width.
 */
export default function AppShell({
  children,
  className,
  mainClassName,
  contentClassName,
}: {
  children: React.ReactNode;
  className?: string;
  mainClassName?: string;
  contentClassName?: string;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className={cn("min-h-screen bg-bw-bg", className)}>
      <TopNav
        sidebarCollapsed={sidebarCollapsed}
        onSidebarToggle={() => setSidebarCollapsed((open) => !open)}
      />
      <div
        className={cn(
          "app-page-offset pt-[52px] transition-all duration-300",
          sidebarCollapsed ? "lg:ml-[56px]" : "lg:ml-[200px]",
          contentClassName,
        )}
      >
        <main className={cn("app-page-main p-4 md:p-6 lg:p-8", mainClassName)}>
          {children}
        </main>
      </div>
    </div>
  );
}
