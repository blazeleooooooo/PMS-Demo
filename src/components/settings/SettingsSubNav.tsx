"use client";

import React, { useTransition, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isModifiedClick } from "@/lib/nav-click";
import * as Icons from "lucide-react";
import { Loader2, Lock } from "lucide-react";
import { getSettingsItemsForPath, type NavItem } from "@/lib/mock-data";
import { isSettingsHrefActive } from "@/lib/nav-active";
import { isNavItemPermissionBlocked } from "@/lib/route-modules";
import { usePermission } from "@/hooks/use-permission";

/**
 * One-level settings sub-tabs (TabsList style) for the current top-nav group.
 * Header sits above this; content below — no nested second tab row.
 */
export default function SettingsSubNav({
  items: itemsProp,
}: {
  items?: NavItem[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const { canView, loading: permLoading } = usePermission();

  const search = searchParams.toString();
  const items = itemsProp ?? getSettingsItemsForPath(pathname) ?? [];

  useEffect(() => {
    if (!isPending) setNavigatingTo(null);
  }, [isPending]);

  if (items.length === 0) return null;

  const navigate = (href: string) => {
    const current = search ? `${pathname}?${search}` : pathname;
    if (current === href || (href === pathname && !search)) return;
    // Default task-types href has no query — treat as equal when no tab / task-types
    if (
      href === pathname &&
      (!search || search === "tab=task-types")
    ) {
      return;
    }
    setNavigatingTo(href);
    startTransition(() => router.push(href));
  };

  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground w-fit max-w-full">
      {items.map((item) => {
        const active = isSettingsHrefActive(pathname, search, item.href);
        const isNavigating = navigatingTo === item.href && isPending;
        const permissionBlocked = isNavItemPermissionBlocked(
          item.href.split("?")[0],
          canView,
          permLoading,
          item.external
        );
        const Icon = ((Icons as Record<string, unknown>)[item.icon] ??
          Icons.Settings) as React.ElementType;

        return (
          <Link
            key={item.href}
            href={item.href}
            onMouseEnter={() => router.prefetch(item.href)}
            onClick={(e) => {
              if (isModifiedClick(e)) return;
              e.preventDefault();
              navigate(item.href);
            }}
            title={permissionBlocked ? "無權限" : undefined}
            className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              active || isNavigating
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {isNavigating ? (
              <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
            ) : (
              <Icon className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{item.label}</span>
            {permissionBlocked && (
              <Lock
                className={`w-3 h-3 shrink-0 ${
                  active || isNavigating ? "text-foreground/50" : "text-muted-foreground/60"
                }`}
                aria-hidden
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
