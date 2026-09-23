"use client";

import React, { useState, useEffect, useRef } from "react";
import { ImageIcon, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth";
import RichTextEditor from "@/components/ui/rich-text-editor";
import {
  createNews,
  updateNews,
  uploadNewsBanner,
  fetchNewsTypes,
  type NewsItem,
  type NewsType,
  type NewsFormData,
} from "@/lib/data-service";

interface NewsFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // When provided the dialog is in edit mode; otherwise create mode.
  editing?: NewsItem | null;
  onSaved: () => void;
}

export default function NewsFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: NewsFormDialogProps) {
  const { toast } = useToast();
  const { staff, profile, displayName } = useAuth();
  const memberId = profile?.member_id || staff?.id || null;

  const [types, setTypes] = useState<NewsType[]>([]);
  const [banner, setBanner] = useState<string>("");
  const [typeBubbleId, setTypeBubbleId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load news types once.
  useEffect(() => {
    fetchNewsTypes().then(setTypes);
  }, []);

  // Reset / prefill the form whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setBanner(editing.banner_image || "");
      setTypeBubbleId(editing.nos_news_type || "");
      setTitle(editing.title || "");
      setBody(editing.body_text || "");
      setIsActive(editing.is_active);
    } else {
      setBanner("");
      setTypeBubbleId("");
      setTitle("");
      setBody("");
      setIsActive(true);
    }
  }, [open, editing]);

  const handleBannerUpload = async (file: File) => {
    setUploading(true);
    const res = await uploadNewsBanner(file);
    if (res.url) {
      setBanner(res.url);
    } else {
      toast({ title: "上傳失敗", description: res.error || "無法上傳圖片", variant: "destructive" });
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "請輸入標題", variant: "destructive" });
      return;
    }
    const selectedType = types.find((t) => t.bubble_id === typeBubbleId);
    const form: NewsFormData = {
      title,
      body_text: body,
      banner_image: banner || null,
      nos_news_type: typeBubbleId || null,
      nos_news_type_id: selectedType?.id || null,
      is_active: isActive,
    };

    setSaving(true);
    const res = editing
      ? await updateNews(editing.id, form)
      : await createNews(form, displayName || staff?.name || null, memberId);
    setSaving(false);

    if (res.success) {
      toast({ title: editing ? "已更新" : "已建立", description: `「${title}」已成功${editing ? "更新" : "建立"}` });
      onOpenChange(false);
      onSaved();
    } else {
      toast({ title: "儲存失敗", description: res.error || "請稍後再試", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="text-xl">
            {editing ? "編輯項目新聞" : "建立項目新聞"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-2 overflow-y-auto flex-1 space-y-5">
          {/* ─── 封面圖片 ─────────────────────────── */}
          <div className="space-y-2">
            <label className="text-sm text-gray-600">封面圖片</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleBannerUpload(file);
                e.target.value = "";
              }}
            />
            {banner ? (
              <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50 group">
                <img src={banner} alt="banner" className="w-full max-h-56 object-contain" />
                <button
                  onClick={() => setBanner("")}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"
                  title="移除圖片"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full h-40 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors flex flex-col items-center justify-center gap-2 text-gray-400"
              >
                {uploading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <ImageIcon className="w-7 h-7" />
                )}
                <span className="text-sm">{uploading ? "上傳中..." : "Click to upload an image"}</span>
              </button>
            )}
          </div>

          {/* ─── 新聞類型 ─────────────────────────── */}
          <div className="space-y-2">
            <label className="text-sm text-gray-600">新聞類型</label>
            <select
              value={typeBubbleId}
              onChange={(e) => setTypeBubbleId(e.target.value)}
              className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Choose an option...</option>
              {types.map((t) => (
                <option key={t.id} value={t.bubble_id || ""}>
                  {t.display}
                </option>
              ))}
            </select>
          </div>

          {/* ─── 標題 ─────────────────────────────── */}
          <div className="space-y-2">
            <label className="text-sm text-gray-600">標題</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Type here..."
              className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* ─── 內文 (rich text) ─────────────────── */}
          <div className="space-y-2">
            <label className="text-sm text-gray-600">內文</label>
            <RichTextEditor
              content={body}
              onChange={setBody}
              minHeight="280px"
              placeholder="輸入新聞內容..."
            />
          </div>

          {/* ─── 啟用狀態 toggle ──────────────────── */}
          <div className="flex items-center gap-3 pb-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <div>
              <p className="text-sm font-medium text-gray-700">
                {isActive ? "已啟用 (顯示於新聞中心)" : "已停用 (隱藏)"}
              </p>
              <p className="text-xs text-gray-400">控制此新聞是否公開顯示</p>
            </div>
          </div>
        </div>

        {/* ─── FOOTER ─────────────────────────────── */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={() => onOpenChange(false)}
            className="px-5 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            確定
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
