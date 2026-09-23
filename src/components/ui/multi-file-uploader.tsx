"use client";

import React, { useState, useRef, useCallback } from "react";
import { Paperclip, X, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buildStorageObjectKey } from "@/lib/storage-utils";
import { AttachmentThumbnail } from "@/components/ui/attachment-thumbnail";
import { getAttachmentFileName, isImageAttachmentUrl } from "@/lib/attachment-utils";

interface MultiFileUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  bucket: string;
  pathPrefix?: string;
  minFiles?: number;
  maxFiles?: number;
  label?: string;
  required?: boolean;
  error?: string;
}

export function MultiFileUploader({
  value,
  onChange,
  bucket,
  pathPrefix = "",
  minFiles = 0,
  maxFiles = 10,
  label = "附加檔案 Attachments",
  required = false,
  error,
}: MultiFileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const remainingSlots = maxFiles - value.length;
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
            .upload(fileName, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });

          if (uploadErr) {
            console.error("Upload error:", uploadErr);
            continue;
          }

          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
          if (urlData?.publicUrl) newUrls.push(urlData.publicUrl);
        } catch (err) {
          console.error("Upload failed:", err);
        }

        setUploadProgress(Math.round(((i + 1) / filesToUpload.length) * 100));
      }

      onChange([...value, ...newUrls]);
      setUploading(false);
      setUploadProgress(0);

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [value, onChange, bucket, pathPrefix, maxFiles],
  );

  const removeFile = useCallback(
    (index: number) => {
      const updated = [...value];
      updated.splice(index, 1);
      onChange(updated);
    },
    [value, onChange],
  );

  const hasError = error || (required && minFiles > 0 && value.length < minFiles);
  const errorMessage =
    error ||
    (required && minFiles > 0 && value.length < minFiles
      ? `最少需要 ${minFiles} 個檔案 (目前: ${value.length})`
      : "");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-blue-500" />
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
        <span className="text-[12px] text-gray-400">
          {value.length}/{maxFiles} 個
        </span>
      </div>

      {value.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
          {value.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50"
            >
              <AttachmentThumbnail url={url} alt={getAttachmentFileName(url)} showLabel={!isImageAttachmentUrl(url)} />
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <X className="w-3 h-3" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[11px] text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity truncate px-1">
                {getAttachmentFileName(url)}
              </div>
            </div>
          ))}
        </div>
      )}

      {value.length < maxFiles && (
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
              <span className="text-xs text-blue-600">上傳中... {uploadProgress}%</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <Paperclip className="w-6 h-6 text-gray-400" />
              <span className="text-xs text-gray-500">點擊上傳檔案 (可多選)</span>
              <span className="text-[12px] text-gray-400">支援 JPG, PDF, PPT 及其他格式</span>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />

      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-red-500">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {errorMessage}
        </div>
      )}
    </div>
  );
}
