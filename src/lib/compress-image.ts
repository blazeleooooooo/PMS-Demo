/** Client-side image compression for large uploads (Canvas API). */

export const COMPRESS_THRESHOLD_BYTES = 5 * 1024 * 1024; // 5 MB — compress above this
export const TARGET_MAX_BYTES = 4 * 1024 * 1024; // aim below 4 MB after compression
export const MAX_DIMENSION = 4096;

export interface CompressImageResult {
  file: File;
  compressed: boolean;
  originalSize: number;
  finalSize: number;
}

export function computeScaledDimensions(
  width: number,
  height: number,
  maxDimension: number,
  scaleFactor = 1
): { width: number; height: number } {
  let w = width * scaleFactor;
  let h = height * scaleFactor;
  const longest = Math.max(w, h);
  if (longest > maxDimension) {
    const ratio = maxDimension / longest;
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }
  return { width: Math.max(1, w), height: Math.max(1, h) };
}

function replaceExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, "") || name;
  return `${base}.${ext}`;
}

async function loadImageDimensions(
  file: File
): Promise<{ width: number; height: number; cleanup: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    return { ...dims, cleanup: () => bitmap.close() };
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to decode image"));
      el.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

async function drawToCanvas(
  file: File,
  width: number,
  height: number
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas;
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to decode image"));
      el.src = url;
    });
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function compressWithCanvas(file: File, targetMaxBytes: number): Promise<File> {
  const { width, height, cleanup } = await loadImageDimensions(file);
  cleanup();

  let dimensionScale = 1;
  const outputType = "image/jpeg";
  const baseName = replaceExtension(file.name, "jpg");

  for (let dimAttempt = 0; dimAttempt < 6; dimAttempt++) {
    const { width: w, height: h } = computeScaledDimensions(
      width,
      height,
      MAX_DIMENSION,
      dimensionScale
    );
    const canvas = await drawToCanvas(file, w, h);

    for (let q = 0.88; q >= 0.45; q -= 0.08) {
      const blob = await canvasToBlob(canvas, outputType, q);
      if (!blob) continue;
      if (blob.size <= targetMaxBytes || q <= 0.46) {
        return new File([blob], baseName, { type: outputType, lastModified: Date.now() });
      }
    }

    dimensionScale *= 0.82;
  }

  // Last resort: smallest scale / quality we attempted
  const { width: w, height: h } = computeScaledDimensions(
    width,
    height,
    MAX_DIMENSION,
    dimensionScale
  );
  const canvas = await drawToCanvas(file, w, h);
  const blob = await canvasToBlob(canvas, outputType, 0.45);
  if (!blob) throw new Error("Compression failed");
  return new File([blob], baseName, { type: outputType, lastModified: Date.now() });
}

/**
 * Compresses image files larger than {@link COMPRESS_THRESHOLD_BYTES}.
 * Non-images and GIFs are returned unchanged.
 */
export async function compressImageIfNeeded(file: File): Promise<CompressImageResult> {
  const originalSize = file.size;

  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return { file, compressed: false, originalSize, finalSize: originalSize };
  }

  if (file.size <= COMPRESS_THRESHOLD_BYTES) {
    return { file, compressed: false, originalSize, finalSize: originalSize };
  }

  try {
    const compressedFile = await compressWithCanvas(file, TARGET_MAX_BYTES);
    return {
      file: compressedFile,
      compressed: true,
      originalSize,
      finalSize: compressedFile.size,
    };
  } catch (err) {
    console.error("Image compression failed, using original:", err);
    return { file, compressed: false, originalSize, finalSize: originalSize };
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
