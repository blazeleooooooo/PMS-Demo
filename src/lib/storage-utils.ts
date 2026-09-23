/**
 * Helpers for Supabase Storage object keys.
 * Keys must be ASCII-safe (S3-compatible). Non-ASCII characters in paths
 * cause "Invalid key" errors. Store human-readable names in DB fields instead.
 */

const SAFE_EXT = /^[a-z0-9]{1,10}$/;

/** Extract a lowercase extension from a filename, with ASCII-safe fallback. */
export function getStorageFileExtension(fileName: string, fallback = "bin"): string {
  const match = fileName.match(/\.([^.]+)$/);
  if (!match) return fallback;
  const ext = match[1].toLowerCase().replace(/[^a-z0-9]/g, "");
  return SAFE_EXT.test(ext) ? ext : fallback;
}

/** Replace non-ASCII / unsafe path characters (keeps a readable ASCII slug). */
export function sanitizeStorageFileName(fileName: string): string {
  const base = fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^\.+|\.+$/g, "")
    .replace(/^_|_$/g, "");
  return base || "file";
}

/** Short random suffix to avoid collisions within the same millisecond. */
export function storageUniqueSuffix(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build a unique ASCII-safe storage object key.
 * @param pathPrefix Folder prefix without trailing slash, e.g. "supplierId" or "factories/uuid"
 */
export function buildStorageObjectKey(
  pathPrefix: string,
  originalFileName: string,
  extensionOverride?: string,
): string {
  const ext = extensionOverride ?? getStorageFileExtension(originalFileName);
  const prefix = pathPrefix.replace(/\/+$/, "");
  return `${prefix}/${storageUniqueSuffix()}.${ext}`;
}

/**
 * Build a key that includes a sanitized version of the original basename (ASCII only).
 * Use when the URL filename should hint at the upload name.
 */
export function buildStorageObjectKeyWithSanitizedName(
  pathPrefix: string,
  originalFileName: string,
): string {
  const ext = getStorageFileExtension(originalFileName);
  const basename = originalFileName.replace(/\.[^.]+$/, "") || "file";
  const safe = sanitizeStorageFileName(basename);
  const prefix = pathPrefix.replace(/\/+$/, "");
  return `${prefix}/${storageUniqueSuffix()}_${safe}.${ext}`;
}
