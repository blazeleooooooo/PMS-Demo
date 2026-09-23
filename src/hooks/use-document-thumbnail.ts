"use client";

import { useEffect, useState } from "react";
import { getAttachmentKind } from "@/lib/attachment-utils";
import { getDocumentThumbnailUrl } from "@/lib/document-thumbnail";

export function useDocumentThumbnail(
  url: string,
  previewWidth = 320,
): { previewUrl: string | null; loading: boolean; failed: boolean } {
  const kind = getAttachmentKind(url);
  const needsPreview = kind === "pdf" || kind === "ppt";

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(needsPreview);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!needsPreview) {
      setPreviewUrl(null);
      setLoading(false);
      setFailed(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setPreviewUrl(null);

    getDocumentThumbnailUrl(url, kind as "pdf" | "ppt", previewWidth)
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setPreviewUrl(result);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url, kind, needsPreview, previewWidth]);

  return { previewUrl, loading, failed };
}
