/**
 * Client-side thumbnail generation for PDF and PPTX attachments.
 * Results are cached in memory by URL + width.
 */

type ThumbnailCache = Map<string, string>;

const thumbnailCache: ThumbnailCache = new Map();

function cacheKey(url: string, width: number, kind: string) {
  return `${kind}:${width}:${url}`;
}

async function loadPdfJs() {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  return pdfjsLib;
}

export async function renderPdfThumbnail(url: string, width = 320): Promise<string | null> {
  const key = cacheKey(url, width, "pdf");
  const cached = thumbnailCache.get(key);
  if (cached) return cached;

  try {
    const pdfjsLib = await loadPdfJs();
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 1 });
    const scale = width / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    thumbnailCache.set(key, dataUrl);
    return dataUrl;
  } catch (err) {
    console.warn("PDF thumbnail failed:", err);
    return null;
  }
}

export async function renderPptxThumbnail(url: string): Promise<string | null> {
  const key = cacheKey(url, 0, "pptx");
  const cached = thumbnailCache.get(key);
  if (cached) return cached;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const buffer = new Uint8Array(await response.arrayBuffer());
    const { unzip } = await import("fflate");

    const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
      unzip(buffer, (err, data) => (err ? reject(err) : resolve(data)));
    });

    const mediaImages = Object.keys(files)
      .filter((k) => /^ppt\/media\/.*\.(jpe?g|png|webp)$/i.test(k))
      .sort();

    const candidates = [
      "docProps/thumbnail.jpeg",
      "docProps/thumbnail.png",
      ...mediaImages,
    ];

    for (const path of candidates) {
      const file = files[path];
      if (!file) continue;
      const mime = path.endsWith(".png") ? "image/png" : "image/jpeg";
      const blob = new Blob([new Uint8Array(file)], { type: mime });
      const objectUrl = URL.createObjectURL(blob);
      thumbnailCache.set(key, objectUrl);
      return objectUrl;
    }

    return null;
  } catch (err) {
    console.warn("PPTX thumbnail failed:", err);
    return null;
  }
}

export async function getDocumentThumbnailUrl(
  url: string,
  kind: "pdf" | "ppt",
  width = 320,
): Promise<string | null> {
  if (kind === "pdf") return renderPdfThumbnail(url, width);
  return renderPptxThumbnail(url);
}
