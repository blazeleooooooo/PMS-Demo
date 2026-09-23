"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { handleNavClick } from "@/lib/nav-click";
import {
  Search,
  Plus,
  Clock,
  Eye,
  ThumbsUp,
  MessageCircle,
  Share2,
  Pencil,
  Trash2,
  Newspaper,
  Loader2,
} from "lucide-react";
import {
  fetchNewsList,
  fetchNewsTypes,
  deleteNews,
  type NewsItem,
  type NewsType,
} from "@/lib/data-service";
import { bubblePlainText } from "@/lib/bubble-richtext";
import { useToast } from "@/components/ui/use-toast";
import NewsFormDialog from "@/components/news/NewsFormDialog";
import NewsProjectSpotlight from "@/components/news/NewsProjectSpotlight";
import { formatHongKongDate } from "@/lib/date-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Set true to restore the legacy news card listing (type pills / CRUD / news grid). */
const SHOW_LEGACY_NEWS_LISTING = false;

export default function NewsCenter() {
  return (
    <div className="min-h-screen bg-bw-bg">
      {/* ─── GRADIENT HEADER ─────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-10">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-white">項目新聞中心</h1>
          <p className="text-white/80 text-sm mt-1 tracking-wide">
            即時資訊 · 專業知識 · 行業動態
          </p>
        </div>
      </div>

      {SHOW_LEGACY_NEWS_LISTING ? <LegacyNewsListing /> : <NewsProjectSpotlight />}
    </div>
  );
}

// ─── LEGACY NEWS LISTING (hidden; kept for easy restore) ──────
function LegacyNewsListing() {
  const router = useRouter();
  const { toast } = useToast();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [types, setTypes] = useState<NewsType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<string>("__all__");
  const [search, setSearch] = useState("");

  // CRUD dialog state.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NewsItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadNews = async () => {
    const list = await fetchNewsList();
    setNews(list);
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [list, typeList] = await Promise.all([fetchNewsList(), fetchNewsTypes()]);
      setNews(list);
      setTypes(typeList);
      setLoading(false);
    }
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (item: NewsItem) => {
    setEditing(item);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await deleteNews(deleteTarget.id);
    setDeleting(false);
    if (res.success) {
      toast({ title: "已刪除", description: `「${deleteTarget.title}」已刪除` });
      setDeleteTarget(null);
      loadNews();
    } else {
      toast({ title: "刪除失敗", description: res.error || "請稍後再試", variant: "destructive" });
    }
  };

  const handleShare = async (item: NewsItem) => {
    const url = `${window.location.origin}/news/${item.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title || "新聞", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "已複製連結", description: "新聞連結已複製到剪貼簿" });
      }
    } catch {
      /* user cancelled — ignore */
    }
  };

  const filtered = useMemo(() => {
    let rows = news;
    if (activeType !== "__all__") {
      rows = rows.filter((n) => n.type_label === activeType);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (n) =>
          (n.title || "").toLowerCase().includes(q) ||
          bubblePlainText(n.body_text).toLowerCase().includes(q) ||
          (n.type_label || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [news, activeType, search]);

  return (
    <>
      <div className="max-w-6xl mx-auto px-8 py-6 space-y-5">
        {/* ─── TYPE FILTER PILLS + ADD ─────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveType("__all__")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeType === "__all__"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            全部
          </button>
          {types.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveType(t.display || "")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeType === t.display
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t.display}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            新增
          </button>
        </div>

        {/* ─── SEARCH BAR ──────────────────────────────── */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all columns..."
            className="w-full bg-slate-600 text-white placeholder:text-gray-300 rounded-xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* ─── NEWS GRID ───────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
            <span className="ml-3 text-gray-500 text-sm">載入新聞...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
            <Newspaper className="w-10 h-10 opacity-30" />
            <p className="text-sm">{search || activeType !== "__all__" ? "沒有符合的新聞" : "暫無新聞"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((n) => (
              <NewsCard
                key={n.id}
                item={n}
                onOpen={(e) => handleNavClick(`/news/${n.id}`, e, (href) => router.push(href))}
                onEdit={() => openEdit(n)}
                onDelete={() => setDeleteTarget(n)}
                onShare={() => handleShare(n)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── CREATE / EDIT DIALOG ────────────────────── */}
      <NewsFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSaved={loadNews}
      />

      {/* ─── DELETE CONFIRM ──────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{deleteTarget?.title}」嗎？此操作將一併刪除其留言與讚好，且無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── NEWS CARD ────────────────────────────────────────────────
function NewsCard({
  item,
  onOpen,
  onEdit,
  onDelete,
  onShare,
}: {
  item: NewsItem;
  onOpen: (e: React.MouseEvent) => void;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
}) {
  const preview = bubblePlainText(item.body_text);

  return (
    <div
      onClick={onOpen}
      className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow flex flex-col group"
    >
      {/* Banner */}
      <div className="relative h-48 bg-slate-800 overflow-hidden">
        {item.banner_image ? (
          <img
            src={item.banner_image}
            alt={item.title || ""}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-700">
            <Newspaper className="w-12 h-12 text-slate-500" />
          </div>
        )}
        {item.type_label && (
          <span
            className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-xs font-medium text-white shadow"
            style={{ backgroundColor: item.type_color || "#6366f1" }}
          >
            {item.type_label}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-base font-bold text-gray-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
          {item.title || "(無標題)"}
        </h3>
        <p className="text-sm text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
          {preview}
        </p>

        {/* Meta row */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {formatHongKongDate(item.created_date)}
          </span>
          <span className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            {item.view_count}
          </span>
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3 text-gray-400">
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-4 h-4" />
            </span>
            <span className="flex items-center gap-1 text-sm">
              <MessageCircle className="w-4 h-4" />
              {item.comment_count}
            </span>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShare();
              }}
              className="p-1.5 rounded hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="分享"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-1.5 rounded hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="編輯"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1.5 rounded hover:bg-red-50 hover:text-red-500 transition-colors"
              title="刪除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
