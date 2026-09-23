const BOX_LOCAL_PREFIX = /^D:\\Box\\(.+)$/i;

/**
 * Extract the Box-relative path from legacy working_folder values.
 * Only paths starting with D:\\Box\\ are supported.
 */
export function parseBoxWorkingFolderPath(raw: string | null | undefined): {
  relativePath: string;
  localPath: string;
} | null {
  if (!raw) return null;

  let candidate = raw.trim();
  if (!candidate || candidate.toUpperCase() === "N/A") return null;

  if (candidate.includes("\t")) {
    const parts = candidate
      .split("\t")
      .map((part) => part.trim())
      .filter(Boolean);
    candidate =
      parts.find((part) => BOX_LOCAL_PREFIX.test(part.replace(/\//g, "\\"))) ??
      parts[parts.length - 1];
  }

  const normalized = candidate.replace(/\//g, "\\");
  const match = normalized.match(BOX_LOCAL_PREFIX);
  if (!match?.[1]) return null;

  const relativePath = match[1]
    .split("\\")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");

  if (!relativePath) return null;

  return {
    relativePath,
    localPath: `D:\\Box\\${match[1]}`,
  };
}

export function splitBoxRelativePath(relativePath: string): string[] {
  return relativePath
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function isBoxWorkingFolder(raw: string | null | undefined): boolean {
  return parseBoxWorkingFolderPath(raw) !== null;
}
