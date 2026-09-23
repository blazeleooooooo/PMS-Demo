/**
 * Shared helpers for man-hour task attachments (images, PDF, PPT, etc.)
 * stored as URL strings in the `man_hour_tasks.images` TEXT[] column.
 */

export function normalizeAttachmentUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http")) return trimmed;
  return `https://${trimmed}`;
}

/** Parse legacy Bubble / Supabase attachment URL arrays. */
export function parseTaskAttachments(
  attachments: string[] | string | null | undefined,
): string[] {
  if (!attachments) return [];
  if (typeof attachments === "string") {
    return attachments
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(normalizeAttachmentUrl);
  }
  const result: string[] = [];
  for (const item of attachments) {
    if (!item) continue;
    if (item.includes(",") && !item.startsWith("http")) {
      const parts = item.split(",").map((s) => s.trim()).filter(Boolean);
      result.push(...parts.map(normalizeAttachmentUrl));
    } else {
      result.push(normalizeAttachmentUrl(item));
    }
  }
  return result.filter(Boolean);
}

/** @deprecated Use parseTaskAttachments */
export const parseTaskImages = parseTaskAttachments;

export function isImageAttachmentUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff|avif|heic)(\?|$)/i.test(lower) ||
    lower.includes("image/") ||
    lower.includes("/render/file/")
  );
}

export function getAttachmentExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const base = pathname.split("/").pop() || "";
    const dot = base.lastIndexOf(".");
    if (dot >= 0) return base.slice(dot + 1).toLowerCase();
  } catch {
    const match = url.match(/\.([a-z0-9]+)(\?|$)/i);
    if (match) return match[1].toLowerCase();
  }
  return "";
}

export function getAttachmentFileName(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const base = pathname.split("/").pop() || "file";
    return decodeURIComponent(base);
  } catch {
    const parts = url.split("/");
    return decodeURIComponent(parts[parts.length - 1]?.split("?")[0] || "file");
  }
}

export type AttachmentKind = "image" | "pdf" | "ppt" | "doc" | "other";

export function getAttachmentKind(url: string): AttachmentKind {
  const ext = getAttachmentExtension(url);
  if (isImageAttachmentUrl(url)) return "image";
  if (ext === "pdf") return "pdf";
  if (ext === "ppt" || ext === "pptx") return "ppt";
  if (ext === "doc" || ext === "docx" || ext === "xls" || ext === "xlsx") return "doc";
  return "other";
}

export function serializeAttachmentUrls(urls: string[]): string {
  return urls.join(",");
}
