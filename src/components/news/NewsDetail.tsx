"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { handleNavClick } from "@/lib/nav-click";
import {
  ChevronLeft,
  Clock,
  User,
  Eye,
  ThumbsUp,
  Share2,
  MessageCircle,
  Send,
  Loader2,
  Newspaper,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/ui/use-toast";
import {
  fetchNewsDetail,
  fetchNewsComments,
  createNewsComment,
  incrementNewsView,
  toggleNewsLike,
  isNewsLikedByMember,
  type NewsItem,
  type NewsComment,
} from "@/lib/data-service";
import { renderBubbleRichText, isHtmlBody } from "@/lib/bubble-richtext";
import RichTextEditor from "@/components/ui/rich-text-editor";
import { formatHongKongDate, formatHongKongDateTime } from "@/lib/date-utils";

export default function NewsDetail({ newsId }: { newsId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { staff, profile, displayName } = useAuth();

  const [item, setItem] = useState<NewsItem | null>(null);
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewCount, setViewCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);

  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const memberId = profile?.member_id || staff?.id || null;

  const loadComments = useCallback(async () => {
    const c = await fetchNewsComments(newsId);
    setComments(c);
  }, [newsId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const detail = await fetchNewsDetail(newsId);
      if (cancelled) return;
      setItem(detail);
      setLikeCount(detail?.liked_count || 0);
      setViewCount(detail?.view_count || 0);
      await loadComments();
      setLoading(false);

      // Best-effort view increment + like state (after first paint).
      const newView = await incrementNewsView(newsId);
      if (!cancelled && newView != null) setViewCount(newView);
      if (memberId) {
        const isLiked = await isNewsLikedByMember(newsId, memberId);
        if (!cancelled) setLiked(isLiked);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [newsId, loadComments, memberId]);

  const handleLike = async () => {
    if (!memberId) {
      toast({ title: "請先登入", description: "登入後才能讚好", variant: "destructive" });
      return;
    }
    setLiking(true);
    // Optimistic.
    setLiked((p) => !p);
    setLikeCount((c) => c + (liked ? -1 : 1));
    try {
      const res = await toggleNewsLike(newsId, memberId);
      setLiked(res.liked);
      setLikeCount(res.count);
    } catch {
      // Revert on error.
      setLiked((p) => !p);
      setLikeCount((c) => c + (liked ? 1 : -1));
      toast({ title: "操作失敗", description: "讚好未能儲存", variant: "destructive" });
    } finally {
      setLiking(false);
    }
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: item?.title || "新聞", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "已複製連結", description: "新聞連結已複製到剪貼簿" });
      }
    } catch {
      /* user cancelled share — ignore */
    }
  };

  const handlePost = async () => {
    if (!draft.trim()) return;
    setPosting(true);
    const res = await createNewsComment(newsId, draft, displayName || staff?.name || null, memberId);
    if (res.success) {
      setDraft("");
      await loadComments();
      toast({ title: "已發表", description: "留言已成功發表" });
    } else {
      toast({ title: "發表失敗", description: res.error || "請稍後再試", variant: "destructive" });
    }
    setPosting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-500 text-sm">載入新聞...</span>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <Newspaper className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 mb-6">找不到此新聞，可能已被刪除。</p>
        <button
          onClick={(e) => handleNavClick("/news", e, (href) => router.push(href))}
          className="text-blue-600 hover:underline text-sm"
        >
          返回新聞中心
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      {/* ─── BACK LINK ───────────────────────────────── */}
      <button
        onClick={(e) => handleNavClick("/news", e, (href) => router.push(href))}
        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        返回新聞中心
      </button>

      {/* ─── BANNER ──────────────────────────────────── */}
      {item.banner_image ? (
        <div className="rounded-2xl overflow-hidden bg-slate-800 max-h-[520px]">
          <img src={item.banner_image} alt={item.title || ""} className="w-full object-cover" />
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-800 h-64 flex items-center justify-center">
          <Newspaper className="w-16 h-16 text-slate-600" />
        </div>
      )}

      {/* ─── ARTICLE CARD ────────────────────────────── */}
      <article className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        {item.type_label && (
          <span
            className="inline-block px-3 py-1 rounded-md text-xs font-medium text-white"
            style={{ backgroundColor: item.type_color || "#6366f1" }}
          >
            {item.type_label}
          </span>
        )}

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-4 leading-snug">
          {item.title}
        </h1>

        {/* Meta */}
        <div className="flex items-center justify-between mt-3 text-sm text-gray-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {formatHongKongDate(item.created_date)}
            </span>
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4" />
              {item.creator_member || "—"}
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <Eye className="w-4 h-4" />
            {viewCount}
          </span>
        </div>

        <hr className="my-5 border-gray-100" />

        {/* Body — HTML (new editor) renders via the read-only rich editor,
            legacy bubble bbcode via the bbcode renderer. */}
        {isHtmlBody(item.body_text) ? (
          <RichTextEditor content={item.body_text || ""} onChange={() => {}} readOnly />
        ) : (
          <div className="text-[15px] text-gray-700 leading-relaxed space-y-3">
            {renderBubbleRichText(item.body_text)}
          </div>
        )}

        <hr className="my-6 border-gray-100" />

        {/* Like / Share */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleLike}
            disabled={liking}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              liked
                ? "bg-blue-50 border-blue-200 text-blue-600"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <ThumbsUp className={`w-4 h-4 ${liked ? "fill-blue-600" : ""}`} />
            讚好{likeCount > 0 ? ` ${likeCount}` : ""}
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            分享
          </button>
        </div>
      </article>

      {/* ─── COMMENTS ────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800">
          <MessageCircle className="w-5 h-5 text-gray-400" />
          {item.title}
        </h2>

        {/* Composer */}
        <div className="mt-5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type here..."
            rows={3}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={handlePost}
              disabled={posting || !draft.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {posting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              發表留言
            </button>
          </div>
        </div>

        {/* Comment list */}
        <div className="mt-6">
          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
              <MessageCircle className="w-10 h-10 opacity-30" />
              <p className="text-sm">暫無留言，快來發表第一條留言吧！</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold shrink-0">
                    {(c.creator_member || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">
                        {c.creator_member || "匿名"}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatHongKongDateTime(c.created_date)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">
                      {c.comment}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
