"use client";

import React, { useState } from "react";
import { File, FileText, Loader2, Presentation } from "lucide-react";
import {
  getAttachmentExtension,
  getAttachmentKind,
  isImageAttachmentUrl,
} from "@/lib/attachment-utils";
import { useDocumentThumbnail } from "@/hooks/use-document-thumbnail";

interface AttachmentThumbnailProps {
  url: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  /** Render width used for PDF/PPT preview generation */
  previewWidth?: number;
  /** Show extension badge when preview is unavailable */
  showLabel?: boolean;
}

function FileKindIcon({ kind, className }: { kind: ReturnType<typeof getAttachmentKind>; className?: string }) {
  switch (kind) {
    case "pdf":
      return <FileText className={className} />;
    case "ppt":
      return <Presentation className={className} />;
    default:
      return <File className={className} />;
  }
}

function FileKindFallback({
  kind,
  ext,
  showLabel,
  className,
}: {
  kind: ReturnType<typeof getAttachmentKind>;
  ext: string;
  showLabel: boolean;
  className: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1 bg-gray-50 text-gray-500 ${className}`}>
      <FileKindIcon kind={kind} className="w-6 h-6 text-gray-400" />
      {showLabel && ext && (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{ext}</span>
      )}
    </div>
  );
}

export function AttachmentThumbnail({
  url,
  alt = "attachment",
  className = "w-full h-full",
  imgClassName = "w-full h-full object-cover",
  previewWidth = 320,
  showLabel = false,
}: AttachmentThumbnailProps) {
  const [imgError, setImgError] = useState(false);
  const kind = getAttachmentKind(url);
  const ext = getAttachmentExtension(url).toUpperCase();
  const needsDocumentPreview = kind === "pdf" || kind === "ppt";
  const { previewUrl, loading, failed } = useDocumentThumbnail(
    needsDocumentPreview ? url : "",
    previewWidth,
  );

  if (isImageAttachmentUrl(url) && !imgError) {
    return (
      <img
        src={url}
        alt={alt}
        className={imgClassName}
        loading="lazy"
        onError={() => setImgError(true)}
      />
    );
  }

  if (needsDocumentPreview) {
    if (loading) {
      return (
        <div className={`flex items-center justify-center bg-gray-50 ${className}`}>
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      );
    }

    if (previewUrl && !failed && !imgError) {
      return (
        <img
          src={previewUrl}
          alt={alt}
          className={imgClassName}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      );
    }
  }

  return (
    <FileKindFallback
      kind={kind}
      ext={ext}
      showLabel={showLabel}
      className={className}
    />
  );
}
