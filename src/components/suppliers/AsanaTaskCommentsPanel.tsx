"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, MessageCircle, Unplug, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AsanaIcon } from "@/components/ui/asana-icon";
import { formatTimestamp } from "@/lib/date-utils";

interface AsanaComment {
  id: string;
  text: string;
  created_at: string | null;
  author_name: string | null;
}

interface AsanaTaskCommentsPanelProps {
  asanaLink: string | null;
  /** Shown when no Asana link is configured */
  emptyStateHint?: string;
}

function currentReturnTo(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete("asana_oauth");
  return `${url.pathname}${url.search}`;
}

export default function AsanaTaskCommentsPanel({
  asanaLink,
  emptyStateHint = "加入 Asana 任務連結後，即可在此查看 Asana 評論。",
}: AsanaTaskCommentsPanelProps) {
  const [statusLoading, setStatusLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [asanaUserName, setAsanaUserName] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskName, setTaskName] = useState<string | null>(null);
  const [comments, setComments] = useState<AsanaComment[]>([]);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const response = await fetch("/api/asana/status", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setConnected(false);
        setAsanaUserName(null);
        return;
      }
      setConnected(!!payload.connected);
      setAsanaUserName(payload.asana_user_name ?? null);
    } catch (err) {
      console.error("[AsanaTaskCommentsPanel] loadStatus error:", err);
      setConnected(false);
      setAsanaUserName(null);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadComments = useCallback(async () => {
    if (!asanaLink || !connected) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ url: asanaLink });
      const response = await fetch(`/api/asana/task-comments?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok) {
        setTaskName(null);
        setComments([]);
        setError(payload.error || "Failed to load Asana comments");
        if (payload.code === "asana_not_connected") {
          setConnected(false);
          setAsanaUserName(null);
        }
        return;
      }

      setTaskName(payload.task_name ?? null);
      setComments(payload.comments ?? []);
    } catch (err) {
      console.error("[AsanaTaskCommentsPanel] loadComments error:", err);
      setError("Failed to load Asana comments");
      setTaskName(null);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [asanaLink, connected]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const oauth = url.searchParams.get("asana_oauth");
    if (oauth === "connected") {
      setOauthNotice("已連接你的 Asana 帳號。");
    } else if (oauth === "error") {
      setOauthNotice("Asana 授權失敗，請再試一次。");
    }
    if (oauth) {
      url.searchParams.delete("asana_oauth");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!connected) {
      setTaskName(null);
      setComments([]);
      setError(null);
      setLoading(false);
      return;
    }
    void loadComments();
  }, [connected, loadComments]);

  const connectAsana = () => {
    const returnTo = encodeURIComponent(currentReturnTo());
    window.location.href = `/api/asana/oauth/start?returnTo=${returnTo}`;
  };

  const disconnectAsana = async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/asana/disconnect", { method: "POST" });
      setConnected(false);
      setAsanaUserName(null);
      setTaskName(null);
      setComments([]);
      setError(null);
      setOauthNotice(null);
    } finally {
      setDisconnecting(false);
    }
  };

  if (!asanaLink) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
          <AsanaIcon size={28} />
        </div>
        <p className="text-sm font-medium text-gray-500 mb-1">尚未設定 Asana 連結</p>
        <p className="text-xs text-gray-400 max-w-sm">{emptyStateHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <AsanaIcon size={16} />
            <p className="text-sm font-medium text-gray-800">
              {taskName || "Asana 任務"}
            </p>
            {comments.length > 0 && (
              <Badge variant="outline" className="text-[11px] px-1.5 py-0 h-5">
                {comments.length} 則評論
              </Badge>
            )}
          </div>
          <p className="text-xs text-gray-500 break-all">{asanaLink}</p>
          {statusLoading ? (
            <p className="text-[11px] text-gray-400 mt-1">檢查 Asana 連接中...</p>
          ) : connected ? (
            <p className="text-[11px] text-gray-500 mt-1">
              已連接：{asanaUserName || "Asana 帳號"}
            </p>
          ) : (
            <p className="text-[11px] text-gray-500 mt-1">
              以你自己的 Asana 帳號查看此任務評論
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {connected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={loadComments}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  "重新整理"
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-gray-500"
                onClick={disconnectAsana}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Unplug className="w-3.5 h-3.5 mr-1" />
                    中斷連接
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              className="text-xs"
              onClick={connectAsana}
              disabled={statusLoading}
            >
              連接 Asana
            </Button>
          )}
          <Button variant="outline" size="sm" className="text-xs" asChild>
            <a href={asanaLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              開啟 Asana
            </a>
          </Button>
        </div>
      </div>

      {oauthNotice && (
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-2">
          <p className="text-xs text-gray-600">{oauthNotice}</p>
        </div>
      )}

      {!connected && !statusLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
            <AsanaIcon size={28} />
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">尚未連接 Asana</p>
          <p className="text-xs text-gray-400 max-w-sm mb-4">
            連接後只會看到你自己的 Asana 帳號有權限的任務評論。
          </p>
          <Button size="sm" onClick={connectAsana}>
            連接 Asana 帳號
          </Button>
        </div>
      ) : loading || statusLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400 mr-2" />
          <span className="text-sm text-gray-400">載入 Asana 評論中...</span>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 space-y-2">
          <p className="text-sm text-amber-800">{error}</p>
          {error.includes("MCP") && (
            <ol className="text-xs text-amber-800/90 list-decimal pl-4 space-y-1">
              <li>
                到{" "}
                <a
                  href="https://app.asana.com/0/my-apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Asana 開發者後台
                </a>{" "}
                按 Create new app，類型選 <strong>API app</strong>（不要選 MCP app）。
              </li>
              <li>
                OAuth Redirect URL 加入{" "}
                <code className="text-[11px]">http://localhost:3000/api/asana/callback</code>{" "}
                和{" "}
                <code className="text-[11px]">http://localhost:3000/api/asana/callback</code>
              </li>
              <li>
                把新的 <code className="text-[11px]">ASANA_CLIENT_ID</code> /{" "}
                <code className="text-[11px]">ASANA_CLIENT_SECRET</code> 寫入{" "}
                <code className="text-[11px]">.env.local</code>，在 IDE 終端重啟{" "}
                <code className="text-[11px]">npm run dev</code>。
              </li>
              <li>按「中斷連接」，再按「連接 Asana」。</li>
            </ol>
          )}
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <MessageCircle className="w-10 h-10 text-gray-200 mb-3" />
          <p className="text-sm text-gray-500">此 Asana 任務暫無評論</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-lg border border-gray-100 p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-[#F06A6A]/10 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-[#F06A6A]" />
                  </div>
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {comment.author_name || "Asana 用戶"}
                  </p>
                </div>
                {comment.created_at && (
                  <span className="text-[12px] text-gray-400 shrink-0">
                    {formatTimestamp(comment.created_at)}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed pl-9">
                {comment.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
