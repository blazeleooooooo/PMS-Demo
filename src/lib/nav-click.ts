/**
 * Modifier-click helpers so SPA navigation matches native <a> behavior:
 * Ctrl/Cmd+click and Shift+click open a new tab; plain click stays in-page.
 */

export type NavModifierEvent = {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey?: boolean;
  button?: number;
  preventDefault?: () => void;
};

export function isModifiedClick(event?: NavModifierEvent | null): boolean {
  if (!event) return false;
  return Boolean(
    event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.button === 1
  );
}

export function openInNewTab(href: string): void {
  window.open(href, "_blank", "noopener,noreferrer");
}

/** Ctrl/Cmd/Shift/middle-click → new tab; otherwise same-tab push. */
export function handleNavClick(
  href: string,
  event: NavModifierEvent | null | undefined,
  push: (href: string) => void
): void {
  if (event && isModifiedClick(event)) {
    event.preventDefault?.();
    openInNewTab(href);
    return;
  }
  push(href);
}
