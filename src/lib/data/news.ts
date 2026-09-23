import { supabase, safeQuery, logError } from "@/lib/data/_core";
import { buildStorageObjectKey } from "@/lib/storage-utils";

// ─── PROJECT NEWS CENTRE (項目新聞中心) ─────────────────────
// The /news page recreates the old bubble.io "項目新聞中心" screen: a
// filterable grid of news cards, each opening a detail page with a banner,
// rich body, like button and comment thread. News type (公司動態 / 項目新聞 /
// 行業資訊 / 專業知識) is stored on news.nos_news_type as the legacy Bubble id,
// so we join it back to news_types.bubble_id to resolve the label + colour.
export interface NewsType {
  id: string;
  bubble_id: string | null;
  display: string | null;
  color: string | null;
}

export interface NewsItem {
  id: string;
  title: string | null;
  body_text: string | null;
  banner_image: string | null;
  view_count: number;
  liked_count: number;
  comment_count: number;
  created_date: string | null;
  creator_member: string | null;
  // Resolved news-type label + colour (joined via bubble_id).
  type_label: string | null;
  type_color: string | null;
  // Raw news-type reference (bubble_id) + active flag — used by the editor.
  nos_news_type: string | null;
  is_active: boolean;
}

export interface NewsComment {
  id: string;
  comment: string | null;
  creator_member: string | null;
  liked_count: number;
  created_date: string | null;
}

// Bubble stores image urls protocol-relative ("//xxx.cdn.bubble.io/..."),
// which break in <img src> on some browsers — normalise to https.
function normalizeImageUrl(url: string | null): string | null {
  if (!url) return null;
  const u = url.trim();
  if (u.startsWith("//")) return `https:${u}`;
  return u;
}

// Build a bubble_id → { label, color } lookup for resolving news types.
async function fetchNewsTypeMap(): Promise<Map<string, { label: string | null; color: string | null }>> {
  const map = new Map<string, { label: string | null; color: string | null }>();
  const { data, error } = await supabase
    .from("news_types")
    .select("id, bubble_id, display, color");
  if (error) {
    logError("fetchNewsTypeMap", error);
    return map;
  }
  for (const t of data ?? []) {
    const entry = { label: t.display ?? null, color: t.color ?? null };
    // Key by both bubble_id and uuid so either reference style resolves.
    if (t.bubble_id) map.set(t.bubble_id, entry);
    if (t.id) map.set(t.id, entry);
  }
  return map;
}

export async function fetchNewsTypes(): Promise<NewsType[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("news_types")
      .select("id, bubble_id, display, color")
      .eq("is_active", true)
      .order("created_date", { ascending: true });
    if (error) {
      logError("fetchNewsTypes", error);
      return [];
    }
    return (data ?? []).map((t: any) => ({
      id: t.id,
      bubble_id: t.bubble_id,
      display: t.display,
      color: t.color,
    }));
  }, [], "fetchNewsTypes");
}

export async function fetchNewsList(): Promise<NewsItem[]> {
  return safeQuery(async () => {
    const [typeMap, listRes] = await Promise.all([
      fetchNewsTypeMap(),
      supabase
        .from("news")
        .select("id, title, body_text, banner_image, view_count, liked_count, created_date, creator_member, nos_news_type, nos_news_type_id")
        .eq("is_active", true)
        .order("created_date", { ascending: false, nullsFirst: false }),
    ]);

    if (listRes.error) {
      logError("fetchNewsList", listRes.error);
      return [];
    }
    const rows = listRes.data ?? [];

    // Count comments per news item in one grouped pass.
    const commentCounts = new Map<string, number>();
    const ids = rows.map((r: any) => r.id);
    if (ids.length) {
      const { data: cData, error: cErr } = await supabase
        .from("news_comments")
        .select("news_id")
        .in("news_id", ids);
      if (cErr) logError("fetchNewsList/comments", cErr);
      for (const c of cData ?? []) {
        if (c.news_id) commentCounts.set(c.news_id, (commentCounts.get(c.news_id) || 0) + 1);
      }
    }

    return rows.map((r: any) => {
      const t = typeMap.get(r.nos_news_type) || typeMap.get(r.nos_news_type_id) || null;
      return {
        id: r.id,
        title: r.title,
        body_text: r.body_text,
        banner_image: normalizeImageUrl(r.banner_image),
        view_count: r.view_count || 0,
        liked_count: r.liked_count || 0,
        comment_count: commentCounts.get(r.id) || 0,
        created_date: r.created_date,
        creator_member: r.creator_member,
        type_label: t?.label ?? null,
        type_color: t?.color ?? null,
        nos_news_type: r.nos_news_type ?? null,
        is_active: true,
      };
    });
  }, [], "fetchNewsList");
}

export async function fetchNewsDetail(id: string): Promise<NewsItem | null> {
  return safeQuery(async () => {
    const [typeMap, res] = await Promise.all([
      fetchNewsTypeMap(),
      supabase
        .from("news")
        .select("id, title, body_text, banner_image, view_count, liked_count, created_date, creator_member, nos_news_type, nos_news_type_id, is_active")
        .eq("id", id)
        .maybeSingle(),
    ]);
    if (res.error) {
      logError("fetchNewsDetail", res.error);
      return null;
    }
    const r = res.data;
    if (!r) return null;
    const t = typeMap.get(r.nos_news_type) || typeMap.get(r.nos_news_type_id) || null;
    return {
      id: r.id,
      title: r.title,
      body_text: r.body_text,
      banner_image: normalizeImageUrl(r.banner_image),
      view_count: r.view_count || 0,
      liked_count: r.liked_count || 0,
      comment_count: 0,
      created_date: r.created_date,
      creator_member: r.creator_member,
      type_label: t?.label ?? null,
      type_color: t?.color ?? null,
      nos_news_type: r.nos_news_type ?? null,
      is_active: r.is_active ?? true,
    };
  }, null, "fetchNewsDetail");
}

// ─── NEWS CRUD ─────────────────────────────────────────────
// nos_news_type stores the legacy Bubble id of the chosen news_types row, so
// the editor passes the news_types.bubble_id (with the uuid as nos_news_type_id).
export interface NewsFormData {
  title: string;
  body_text: string;       // HTML from the rich-text editor
  banner_image: string | null;
  nos_news_type: string | null;     // news_types.bubble_id
  nos_news_type_id: string | null;  // news_types.id (uuid)
  is_active: boolean;
}

export async function createNews(
  form: NewsFormData,
  authorName: string | null,
  authorMemberId: string | null
): Promise<{ success: boolean; id?: string; error?: string }> {
  const now = new Date().toISOString();
  const payload: Record<string, any> = {
    title: form.title.trim() || null,
    body_text: form.body_text || null,
    banner_image: form.banner_image || null,
    nos_news_type: form.nos_news_type || null,
    nos_news_type_id: form.nos_news_type_id || null,
    is_active: form.is_active,
    view_count: 0,
    liked_count: 0,
    creator_member: authorName || null,
    creator_member_id: authorMemberId || null,
    created_by: authorName || null,
    created_by_id: authorMemberId || null,
    created_date: now,
    modified_date: now,
  };
  const { data, error } = await supabase.from("news").insert(payload).select("id");
  if (error) {
    logError("createNews", error);
    return { success: false, error: error.message };
  }
  return { success: true, id: data?.[0]?.id };
}

export async function updateNews(
  id: string,
  form: NewsFormData
): Promise<{ success: boolean; error?: string }> {
  const payload: Record<string, any> = {
    title: form.title.trim() || null,
    body_text: form.body_text || null,
    banner_image: form.banner_image || null,
    nos_news_type: form.nos_news_type || null,
    nos_news_type_id: form.nos_news_type_id || null,
    is_active: form.is_active,
    modified_date: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("news").update(payload).eq("id", id).select("id");
  if (error) {
    logError("updateNews", error);
    return { success: false, error: error.message };
  }
  if (!data || data.length === 0) {
    return { success: false, error: "沒有權限或記錄不存在" };
  }
  return { success: true };
}

export async function deleteNews(id: string): Promise<{ success: boolean; error?: string }> {
  // Clean up dependent rows first (comments + likes) to avoid orphans / FK errors.
  await supabase.from("news_comments").delete().eq("news_id", id);
  await supabase.from("news_liked_members").delete().eq("news_id", id);
  const { error } = await supabase.from("news").delete().eq("id", id);
  if (error) {
    logError("deleteNews", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

// Flip is_active for a news item (used by the list toggle).
export async function setNewsActive(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("news")
    .update({ is_active: isActive, modified_date: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    logError("setNewsActive", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

// Upload a news banner image to the public news-banners bucket; returns its URL.
export async function uploadNewsBanner(file: File): Promise<{ url?: string; error?: string }> {
  const fileName = buildStorageObjectKey("banner", file.name);
  const { error } = await supabase.storage.from("news-banners").upload(fileName, file, {
    upsert: true,
  });
  if (error) {
    logError("uploadNewsBanner", error);
    return { error: error.message };
  }
  const { data } = supabase.storage.from("news-banners").getPublicUrl(fileName);
  return { url: data?.publicUrl };
}

// Increment view_count by 1 and return the new value. Best-effort — failures
// are swallowed so a read never blocks rendering the article.
export async function incrementNewsView(id: string): Promise<number | null> {
  return safeQuery(async () => {
    const { data: cur, error: readErr } = await supabase
      .from("news")
      .select("view_count")
      .eq("id", id)
      .maybeSingle();
    if (readErr || !cur) return null;
    const next = (cur.view_count || 0) + 1;
    const { error: updErr } = await supabase
      .from("news")
      .update({ view_count: next })
      .eq("id", id);
    if (updErr) {
      logError("incrementNewsView", updErr);
      return cur.view_count || 0;
    }
    return next;
  }, null, "incrementNewsView");
}

export async function fetchNewsComments(newsId: string): Promise<NewsComment[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("news_comments")
      .select("id, comment, creator_member, liked_count, created_date")
      .eq("news_id", newsId)
      .order("created_date", { ascending: false, nullsFirst: false });
    if (error) {
      logError("fetchNewsComments", error);
      return [];
    }
    return (data ?? []).map((c: any) => ({
      id: c.id,
      comment: c.comment,
      creator_member: c.creator_member,
      liked_count: c.liked_count || 0,
      created_date: c.created_date,
    }));
  }, [], "fetchNewsComments");
}

export async function createNewsComment(
  newsId: string,
  comment: string,
  authorName: string | null,
  authorMemberId: string | null
): Promise<{ success: boolean; error?: string }> {
  const payload: Record<string, any> = {
    news_id: newsId,
    comment: comment.trim(),
    creator_member: authorName || null,
    creator_member_id: authorMemberId || null,
    liked_count: 0,
    created_date: new Date().toISOString(),
    modified_date: new Date().toISOString(),
  };
  const { error } = await supabase.from("news_comments").insert(payload);
  if (error) {
    logError("createNewsComment", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

// Toggle the current member's like on a news item. Uses news_liked_members as
// the source of truth and keeps news.liked_count in sync. Returns the new
// liked state + count.
export async function toggleNewsLike(
  newsId: string,
  memberId: string
): Promise<{ liked: boolean; count: number }> {
  // 1. Is there an existing like row?
  const { data: existing } = await supabase
    .from("news_liked_members")
    .select("id")
    .eq("news_id", newsId)
    .eq("member_id", memberId)
    .maybeSingle();

  // 2. Current count.
  const { data: cur } = await supabase
    .from("news")
    .select("liked_count")
    .eq("id", newsId)
    .maybeSingle();
  const curCount = cur?.liked_count || 0;

  if (existing) {
    await supabase.from("news_liked_members").delete().eq("id", existing.id);
    const next = Math.max(0, curCount - 1);
    await supabase.from("news").update({ liked_count: next }).eq("id", newsId);
    return { liked: false, count: next };
  } else {
    await supabase.from("news_liked_members").insert({ news_id: newsId, member_id: memberId });
    const next = curCount + 1;
    await supabase.from("news").update({ liked_count: next }).eq("id", newsId);
    return { liked: true, count: next };
  }
}

export async function isNewsLikedByMember(newsId: string, memberId: string): Promise<boolean> {
  return safeQuery(async () => {
    const { data } = await supabase
      .from("news_liked_members")
      .select("id")
      .eq("news_id", newsId)
      .eq("member_id", memberId)
      .maybeSingle();
    return !!data;
  }, false, "isNewsLikedByMember");
}
