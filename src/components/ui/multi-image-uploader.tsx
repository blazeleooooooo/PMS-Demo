"use client";

import React, { useState, useRef, useCallback, useMemo } from "react";
import { ImagePlus, X, Loader2, AlertCircle, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { buildStorageObjectKey } from "@/lib/storage-utils";

interface MultiImageUploaderProps {
  value: string[]; // array of URLs
  onChange: (urls: string[]) => void;
  bucket: string;
  pathPrefix?: string;
  minImages?: number;
  maxImages?: number;
  label?: string;
  required?: boolean;
  error?: string;
}

export function itemsFromUrls(urls: string[]) {
  const seen = new Map<string, number>();
  return urls.map((url) => {
    const n = seen.get(url) ?? 0;
    seen.set(url, n + 1);
    return { id: n === 0 ? url : `${url}#${n}`, url };
  });
}

function SortableImageThumb({
  id,
  url,
  index,
  sortable,
  onRemove,
}: {
  id: string;
  url: string;
  index: number;
  sortable: boolean;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !sortable,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.7 : 1,
      }}
      className={`relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50 ${
        sortable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
      {...attributes}
      {...(sortable ? listeners : {})}
    >
      <img
        src={url}
        alt={`Site photo ${index + 1}`}
        className="w-full h-full object-cover"
        draggable={false}
        onError={(e) => {
          (e.target as HTMLImageElement).src =
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23f3f4f6'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='%239ca3af' font-size='12'%3EError%3C/text%3E%3C/svg%3E";
        }}
      />
      <button
        type="button"
        onClick={onRemove}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
      >
        <X className="w-3 h-3" />
      </button>
      {sortable && (
        <span className="absolute top-1 left-1 rounded bg-black/45 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-3 h-3" />
        </span>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[11px] text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        #{index + 1}
      </div>
    </div>
  );
}

/**
 * Parse a legacy Bubble site_photos string (comma-separated, with possible // prefix)
 * into an array of full URLs.
 */
export function parseBubbleImageUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((url) => {
      // Bubble stores URLs like //xxx.cdn.bubble.io/... — add https:
      if (url.startsWith("//")) return `https:${url}`;
      return url;
    });
}

/**
 * Serialize an array of URLs back to a comma-separated string (compatible with DB column).
 */
export function serializeImageUrls(urls: string[]): string {
  return urls.join(",");
}

export function MultiImageUploader({
  value,
  onChange,
  bucket,
  pathPrefix = "",
  minImages = 0,
  maxImages = 20,
  label = "相片 Site Photos",
  required = false,
  error,
}: MultiImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const items = useMemo(() => itemsFromUrls(value), [value]);
  const canReorder = value.length > 1 && !uploading;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleFilesSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const remainingSlots = maxImages - value.length;
      const filesToUpload = Array.from(files).slice(0, remainingSlots);

      if (filesToUpload.length === 0) return;

      setUploading(true);
      setUploadProgress(0);

      const supabase = createClient();
      const newUrls: string[] = [];

      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const prefix = pathPrefix ? pathPrefix : "";
        const fileName = buildStorageObjectKey(prefix, file.name);

        try {
          const { error: uploadErr } = await supabase.storage
            .from(bucket)
            .upload(fileName, file, { cacheControl: "3600", upsert: false });

          if (uploadErr) {
            console.error("Upload error:", uploadErr);
            continue;
          }

          const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(fileName);

          if (urlData?.publicUrl) {
            newUrls.push(urlData.publicUrl);
          }
        } catch (err) {
          console.error("Upload failed:", err);
        }

        setUploadProgress(Math.round(((i + 1) / filesToUpload.length) * 100));
      }

      onChange([...value, ...newUrls]);
      setUploading(false);
      setUploadProgress(0);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [value, onChange, bucket, pathPrefix, maxImages],
  );

  const removeImage = useCallback(
    (index: number) => {
      const updated = [...value];
      updated.splice(index, 1);
      onChange(updated);
    },
    [value, onChange],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      onChange(arrayMove(value, oldIndex, newIndex));
    },
    [items, onChange, value],
  );

  const hasError = error || (required && minImages > 0 && value.length < minImages);
  const errorMessage =
    error ||
    (required && minImages > 0 && value.length < minImages
      ? `最少需要 ${minImages} 張相片 (目前: ${value.length})`
      : "");

  return (
    <div className="space-y-3">
      {/* Label */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
          <ImagePlus className="w-3.5 h-3.5 text-blue-500" />
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
        <span className="text-[12px] text-gray-400">
          {value.length}/{maxImages} 張{canReorder ? " · 拖曳調整順序" : ""}
        </span>
      </div>

      {/* Image Grid Preview */}
      {value.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={canReorder ? handleDragEnd : undefined}
        >
          <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
              {items.map((item, idx) => (
                <SortableImageThumb
                  key={item.id}
                  id={item.id}
                  url={item.url}
                  index={idx}
                  sortable={canReorder}
                  onRemove={() => removeImage(idx)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Upload Button */}
      {value.length < maxImages && (
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
            ${uploading ? "border-blue-300 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/50"}
            ${hasError ? "border-red-300 bg-red-50/30" : ""}
          `}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-xs text-blue-600">
                上傳中... {uploadProgress}%
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <ImagePlus className="w-6 h-6 text-gray-400" />
              <span className="text-xs text-gray-500">
                點擊上傳相片 (可多選)
              </span>
              <span className="text-[12px] text-gray-400">
                支援 JPG, PNG, WEBP
              </span>
            </div>
          )}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />

      {/* Error / Minimum Warning */}
      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-red-500">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {errorMessage}
        </div>
      )}
    </div>
  );
}
