"use client";

import React, { useCallback, useEffect } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Image as ImageIcon,
  Maximize2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AttachmentThumbnail } from "@/components/ui/attachment-thumbnail";
import {
  getAttachmentFileName,
  getAttachmentKind,
  isImageAttachmentUrl,
} from "@/lib/attachment-utils";
import { formatDate } from "@/lib/date-utils";

export interface AttachmentLightboxImage {
  url: string;
  title: string;
  reportDate?: string | null;
  taskDescription?: string | null;
  workHour?: number | null;
  staffName?: string | null;
  taskImageCount?: number | null;
}

interface AttachmentLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: AttachmentLightboxImage[];
  index: number;
  onIndexChange: (index: number) => void;
}

async function downloadAttachment(url: string, filename: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank");
  }
}

/** Full-screen attachment preview — same chrome as /3d-design. */
export function AttachmentLightbox({
  open,
  onOpenChange,
  images,
  index,
  onIndexChange,
}: AttachmentLightboxProps) {
  const safeIndex = images.length === 0 ? 0 : Math.min(Math.max(index, 0), images.length - 1);
  const current = images[safeIndex];

  const goPrev = useCallback(() => {
    if (images.length < 2) return;
    onIndexChange(safeIndex > 0 ? safeIndex - 1 : images.length - 1);
  }, [images.length, onIndexChange, safeIndex]);

  const goNext = useCallback(() => {
    if (images.length < 2) return;
    onIndexChange(safeIndex < images.length - 1 ? safeIndex + 1 : 0);
  }, [images.length, onIndexChange, safeIndex]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, goPrev, goNext, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-0 overflow-hidden [&>button]:text-white [&>button]:hover:bg-white/10">
        {current && (
          <div className="relative flex items-center justify-center w-full h-[90vh]">
            {(() => {
              const kind = getAttachmentKind(current.url);
              if (isImageAttachmentUrl(current.url)) {
                return (
                  <img
                    src={current.url}
                    alt=""
                    className="max-w-full max-h-full object-contain"
                  />
                );
              }
              if (kind === "pdf" || kind === "ppt") {
                return (
                  <div className="flex flex-col items-center justify-center gap-3 px-6 max-w-full max-h-full">
                    <AttachmentThumbnail
                      url={current.url}
                      alt={getAttachmentFileName(current.url)}
                      className="max-w-full max-h-[75vh] flex items-center justify-center"
                      imgClassName="max-w-full max-h-[75vh] object-contain rounded shadow-lg"
                      previewWidth={960}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/90 hover:text-white hover:bg-white/10"
                      onClick={() => window.open(current.url, "_blank", "noopener")}
                    >
                      開啟檔案
                    </Button>
                  </div>
                );
              }
              return (
                <div className="flex flex-col items-center justify-center gap-4 text-white px-6 text-center">
                  <AttachmentThumbnail
                    url={current.url}
                    className="w-24 h-24 rounded-xl border border-white/20"
                    showLabel
                  />
                  <p className="text-sm font-medium max-w-md truncate">
                    {getAttachmentFileName(current.url)}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/90 hover:text-white hover:bg-white/10"
                    onClick={() => window.open(current.url, "_blank", "noopener")}
                  >
                    開啟檔案
                  </Button>
                </div>
              );
            })()}

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-16">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-white font-medium text-sm">{current.title}</p>
                  {(() => {
                    if (
                      current.reportDate == null &&
                      current.taskDescription == null &&
                      current.workHour == null &&
                      current.staffName == null &&
                      current.taskImageCount == null
                    ) {
                      return null;
                    }
                    const extra = (current.taskImageCount ?? 1) - 1;
                    return (
                      <div className="mt-1.5 space-y-1">
                        {current.taskDescription && (
                          <p className="text-white/80 text-[13px] leading-snug line-clamp-3 max-w-xl">
                            {current.taskDescription}
                          </p>
                        )}
                        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-white/60 text-[12px]">
                          {current.reportDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(current.reportDate)}
                            </span>
                          )}
                          {current.workHour != null && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {(Math.round(current.workHour * 10) / 10).toLocaleString("en-US")}h 工時
                            </span>
                          )}
                          {current.staffName && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {current.staffName}
                            </span>
                          )}
                          {extra > 0 && (
                            <span className="flex items-center gap-1 text-white/45">
                              <ImageIcon className="w-3 h-3" />
                              +{extra} 個相關附件
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  <p className="text-white/50 text-xs mt-1.5">
                    {safeIndex + 1} / {images.length}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/70 hover:text-white hover:bg-white/10 text-xs gap-1"
                    onClick={() =>
                      downloadAttachment(
                        current.url,
                        `${current.title}_${safeIndex + 1}.jpg`
                      )
                    }
                  >
                    <Download className="w-4 h-4" />
                    下載
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/70 hover:text-white hover:bg-white/10 text-xs gap-1"
                    onClick={() => window.open(current.url, "_blank")}
                  >
                    <Maximize2 className="w-4 h-4" />
                    原圖
                  </Button>
                </div>
              </div>
            </div>

            {images.length > 1 && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/40 rounded-full px-3 py-1.5">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onIndexChange(idx)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === safeIndex
                        ? "bg-white w-6"
                        : "bg-white/30 hover:bg-white/60"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
