import { getAllNavItems, navigationGroups } from "@/lib/mock-data";

/** Path part of an href (strips `?query`). */
export function hrefPathname(href: string): string {
  const q = href.indexOf("?");
  return q >= 0 ? href.slice(0, q) : href;
}

function hrefMatches(pathname: string, href: string): boolean {
  const path = hrefPathname(href);
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

const allNavHrefs = getAllNavItems()
  .filter((i) => !i.external)
  .map((i) => i.href);

/** True when pathname matches href and no other nav item has a longer matching href. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (!hrefMatches(pathname, href)) return false;
  return !allNavHrefs.some(
    (other) =>
      other !== href &&
      hrefPathname(other).length > hrefPathname(href).length &&
      hrefMatches(pathname, other)
  );
}

/**
 * Settings sub-tab active check — supports query strings
 * (e.g. `/settings/task-reporting?tab=ai-tools`).
 */
export function isSettingsHrefActive(
  pathname: string,
  search: string,
  href: string
): boolean {
  const path = hrefPathname(href);
  if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;

  const hrefQuery = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
  const hrefParams = new URLSearchParams(hrefQuery);
  const pageParams = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );

  for (const [key, value] of hrefParams.entries()) {
    if (pageParams.get(key) !== value) return false;
  }

  // Default tab on a shared path: href has no `tab`, but siblings do.
  if (!hrefParams.has("tab")) {
    const hasTabSiblings = allNavHrefs.some((other) => {
      if (other === href) return false;
      if (hrefPathname(other) !== path) return false;
      return other.includes("tab=");
    });
    if (hasTabSiblings) {
      const tab = pageParams.get("tab");
      return !tab || tab === "task-types";
    }
  }

  return true;
}

/** Index of the nav group that owns the current pathname (main or settings items). */
export function getActiveNavGroupIndex(pathname: string): number {
  for (let i = 0; i < navigationGroups.length; i++) {
    const group = navigationGroups[i];
    for (const item of group.items) {
      if (!item.external && isNavItemActive(pathname, item.href)) {
        return i;
      }
    }
    for (const item of group.settingsItems ?? []) {
      if (!item.external && hrefMatches(pathname, item.href)) {
        return i;
      }
    }
  }
  return 0;
}
