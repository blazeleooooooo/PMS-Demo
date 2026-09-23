"use client";

import React, { useTransition, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isModifiedClick } from "@/lib/nav-click";
import { Loader2, Lock } from "lucide-react";
import { getSettingsItemsForPath, type NavItem } from "@/lib/mock-data";
import { isNavItemActive } from "@/lib/nav-active";
import { isNavItemPermissionBlocked } from "@/lib/route-modules";
import { usePermission } from "@/hooks/use-permission";

/**
 * Horizontal pill tabs for settings pages belonging to the same nav group.
 * Renders nothing when the current path is not under a group's settingsItems.
 */
export default function SettingsPillNav({
  items: itemsProp,
}: {
  items?: NavItem[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const { canView, loading: permLoading } = usePermission();

  const items = itemsProp ?? getSettingsItemsForPath(pathname) ?? [];

  useEffect(() => {
    if (!isPending) setNavigatingTo(null);
  }, [isPending]);

  if (items.length === 0) return null;

  const navigate = (href: string) => {
    if (pathname === href) return;
    setNavigatingTo(href);
    startTransition(() => router.push(href));
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pb-1">
      {items.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        const isNavigating = navigatingTo === item.href && isPending;
        const permissionBlocked = isNavItemPermissionBlocked(
          item.href,
          canView,
          permLoading,
          item.external
        );
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
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              active || isNavigating
                ? "bg-bw-blue text-white shadow-sm shadow-bw-blue/20"
                : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            {isNavigating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : null}
            <span>{item.label}</span>
            {permissionBlocked && (
              <Lock
                className={`w-3 h-3 shrink-0 ${
                  active || isNavigating ? "text-white/70" : "text-gray-400"
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
