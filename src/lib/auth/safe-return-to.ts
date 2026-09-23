/** Allow only same-app relative paths (no open redirects). */
export function getSafeReturnTo(
  path: string | null | undefined
): string | null {
  if (!path) return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.includes("\\") || path.includes("\0")) return null;
  return path;
}
