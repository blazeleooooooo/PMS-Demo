/** Resolve a remote image URL to a data URL for @react-pdf/renderer (avoids CORS grey boxes). */
export async function resolveImageToDataUrl(
  url: string | null | undefined,
): Promise<string | null> {
  if (!url || !url.trim()) return null;
  try {
    let normalized = url.trim();
    if (normalized.startsWith("//")) {
      normalized = `https:${normalized}`;
    }
    if (normalized.startsWith("data:")) return normalized;

    const proxy = `/api/download-image?url=${encodeURIComponent(normalized)}&filename=case-render.jpg`;
    const res = await fetch(proxy);
    if (!res.ok) {
      console.warn("resolveImageToDataUrl proxy failed", res.status, normalized);
      return null;
    }
    const blob = await res.blob();
    if (!blob.size) return null;

    return await new Promise<string | null>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        resolve(typeof result === "string" ? result : null);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("resolveImageToDataUrl error", err);
    return null;
  }
}

export function selectedImageUrl(row: {
  images: { id: string; image: string }[];
  selectedImageId: string | null;
}): string | null {
  if (!row.images.length) return null;
  const found = row.images.find((img) => img.id === row.selectedImageId);
  return found?.image || row.images[0]?.image || null;
}

function normalizeSourceUrl(url: string): string {
  return url.startsWith("//") ? `https:${url}` : url;
}

/**
 * Prefetch selected thumbnails as data URLs.
 * Reuses `cacheBySourceUrl` so repeat preview/export skips network fetches.
 * Returns projectId → dataUrl map for the PDF document.
 */
export async function resolveCasePdfImageMap(
  rows: {
    id: string;
    images: { id: string; image: string }[];
    selectedImageId: string | null;
  }[],
  cacheBySourceUrl: Record<string, string> = {},
): Promise<{
  byProjectId: Record<string, string>;
  bySourceUrl: Record<string, string>;
}> {
  const bySourceUrl = { ...cacheBySourceUrl };
  const byProjectId: Record<string, string> = {};

  const needed: { projectId: string; sourceUrl: string }[] = [];
  for (const row of rows) {
    const url = selectedImageUrl(row);
    if (!url) continue;
    const key = normalizeSourceUrl(url);
    if (bySourceUrl[key]) {
      byProjectId[row.id] = bySourceUrl[key];
    } else {
      needed.push({ projectId: row.id, sourceUrl: key });
    }
  }

  const CONCURRENCY = 4;
  let i = 0;
  async function worker() {
    while (i < needed.length) {
      const idx = i++;
      const item = needed[idx];
      if (bySourceUrl[item.sourceUrl]) {
        byProjectId[item.projectId] = bySourceUrl[item.sourceUrl];
        continue;
      }
      const dataUrl = await resolveImageToDataUrl(item.sourceUrl);
      if (dataUrl) {
        bySourceUrl[item.sourceUrl] = dataUrl;
        byProjectId[item.projectId] = dataUrl;
      }
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(CONCURRENCY, Math.max(needed.length, 1)) },
      () => worker(),
    ),
  );

  return { byProjectId, bySourceUrl };
}
