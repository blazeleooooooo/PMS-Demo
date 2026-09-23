"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Send, Sparkles, Unplug, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AsanaIcon } from "@/components/ui/asana-icon";
import { cn } from "@/lib/utils";
import {
  WEEKLY_REPORT_AI_FIELD_LABELS,
  type WeeklyReportAiFields,
} from "@/lib/weekly-report-ai";

export type WeeklyReportAiApplyPayload = {
  fields: WeeklyReportAiFields;
  filledKeys: string[];
};

type ChatItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  filledKeys?: string[];
  asanaWarning?: string | null;
};

interface WeeklyReportAiChatProps {
  projectId: string;
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  meetingDate: string;
  projectName?: string;
  projectCode?: string;
  pmName?: string;
  designerName?: string;
  currentFields: Record<string, string>;
  onApply: (payload: WeeklyReportAiApplyPayload) => void;
  onClose: () => void;
}

function toDateParam(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function WeeklyReportAiChat({
  projectId,
  weekNumber,
  weekStart,
  weekEnd,
  meetingDate,
  projectName,
  projectCode,
  pmName,
  designerName,
  currentFields,
  onApply,
  onClose,
}: WeeklyReportAiChatProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [asanaLoading, setAsanaLoading] = useState(true);
  const [asanaConnected, setAsanaConnected] = useState(false);
  const [asanaTitle, setAsanaTitle] = useState<string | null>(null);
  const [asanaLink, setAsanaLink] = useState<string | null>(null);
  const [asanaNotice, setAsanaNotice] = useState<string | null>(null);
  const [asanaHint, setAsanaHint] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "把工地會議筆記、WhatsApp、電郵或現場觀察貼在下方。我會一併閱讀此項目的 Asana 任務內容，並自動填入適用的報告欄位。沒有筆記也可以先按「分析並填入」，只根據 Asana 整理。",
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const loadAsanaStatus = useCallback(async () => {
    setAsanaLoading(true);
    try {
      const response = await fetch(
        `/api/asana/link-summary?projectId=${encodeURIComponent(projectId)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as {
        connected?: boolean;
        asana_link?: string | null;
        title?: string | null;
        warning?: string | null;
        error?: string;
      };
      if (!response.ok) {
        setAsanaConnected(false);
        setAsanaTitle(null);
        setAsanaLink(null);
        setAsanaNotice(payload.error || "無法檢查 Asana 連接");
        return;
      }
      setAsanaConnected(!!payload.connected);
      setAsanaLink(payload.asana_link ?? null);
      setAsanaTitle(payload.title ?? null);
      if (payload.warning) setAsanaNotice(payload.warning);
    } catch {
      setAsanaConnected(false);
      setAsanaTitle(null);
      setAsanaNotice("無法檢查 Asana 連接");
    } finally {
      setAsanaLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const oauth = url.searchParams.get("asana_oauth");
    if (oauth === "connected") {
      setAsanaNotice("已連接你的 Asana 帳號。");
    } else if (oauth === "error") {
      setAsanaNotice("Asana 授權失敗，請再試一次。");
    }
    if (oauth) {
      url.searchParams.delete("asana_oauth");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    void loadAsanaStatus();
  }, [loadAsanaStatus]);

  const connectAsana = () => {
    setConnecting(true);
    setAsanaNotice("正在跳轉到 Asana 授權頁…");
    const url = new URL(window.location.href);
    url.searchParams.delete("asana_oauth");
    const returnTo = encodeURIComponent(`${url.pathname}${url.search}`);
    window.location.href = `/api/asana/oauth/start?returnTo=${returnTo}`;
  };

  const disconnectAsana = async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/asana/disconnect", { method: "POST" });
      setAsanaConnected(false);
      setAsanaTitle(null);
      setAsanaNotice("已中斷 Asana 連接。分析時只會使用聊天內容。");
    } catch {
      setAsanaNotice("中斷 Asana 連接失敗。");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSend = async () => {
    const note = input.trim();
    if (sending) return;

    const userMessage: ChatItem | null = note
      ? { id: nextId(), role: "user", content: note }
      : null;
    if (userMessage) {
      setMessages((prev) => [...prev, userMessage]);
    }
    setInput("");
    setSending(true);

    try {
      const history = [...messages, ...(userMessage ? [userMessage] : [])]
        .filter((item) => item.id !== "welcome")
        .map((item) => ({ role: item.role, content: item.content }));

      const response = await fetch("/api/weekly-reports/ai-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          weekNumber,
          weekStart: toDateParam(weekStart),
          weekEnd: toDateParam(weekEnd),
          meetingDate,
          projectName,
          projectCode,
          pmName,
          designerName,
          userNote: note,
          history,
          currentFields,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        code?: string;
        reply?: string;
        fields?: WeeklyReportAiFields;
        filledKeys?: string[];
        asana?: { used?: boolean; title?: string | null; warning?: string | null };
      };

      if (!response.ok) {
        const errorText = payload.error || "AI 分析失敗";
        setAsanaHint(payload.asana?.warning ?? null);
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: "assistant", content: errorText },
        ]);
        return;
      }

      const filledKeys = payload.filledKeys ?? [];
      if (payload.fields && filledKeys.length > 0) {
        onApply({ fields: payload.fields, filledKeys });
      }
      if (payload.asana?.title) setAsanaTitle(payload.asana.title);
      setAsanaHint(payload.asana?.warning ?? null);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: payload.reply || "已完成分析。",
          filledKeys,
          asanaWarning: payload.asana?.warning ?? null,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: error instanceof Error ? error.message : "AI 分析失敗",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-violet-100 bg-white">
      <div className="flex items-start justify-between gap-2 border-b border-violet-100 bg-violet-50/70 px-3 py-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-violet-800">
            <Sparkles className="h-3.5 w-3.5" />
            AI 填寫報告
          </p>
          <p className="mt-0.5 text-[11px] text-violet-600/80">Grok 分析筆記與 Asana</p>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4 text-gray-400" />
        </Button>
      </div>

      <div className="space-y-1.5 border-b border-gray-100 px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <AsanaIcon size={14} />
              {asanaLoading ? (
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  檢查 Asana 連接中…
                </span>
              ) : asanaConnected ? (
                <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-emerald-700">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  {asanaLink ? (
                    <a
                      href={asanaLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={asanaTitle || "開啟 Asana"}
                      className="flex min-w-0 items-center gap-1 truncate hover:underline"
                    >
                      <span className="truncate">
                        {asanaTitle || "已連接 · Asana 任務"}
                      </span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="truncate">已連接 · 此項目未設定 Asana 任務</span>
                  )}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[11px] text-amber-700">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  未連接 Asana 帳號
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate pl-[22px] text-[10px] text-gray-400">
              {asanaLink
                ? "此項目已設定 Asana 連結，分析時會一併讀取任務"
                : "此項目尚未設定 Asana 連結，只會分析聊天內容"}
            </p>
            {(asanaNotice || asanaHint) && (
              <p className="mt-0.5 pl-[22px] text-[10px] text-amber-700">
                {asanaNotice || asanaHint}
              </p>
            )}
          </div>
          {asanaLoading ? null : asanaConnected ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 px-1.5 text-[11px] text-gray-500"
              onClick={() => void disconnectAsana()}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Unplug className="mr-0.5 h-3 w-3" />
                  中斷
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 px-1.5 text-[11px] text-violet-700"
              onClick={connectAsana}
              disabled={connecting}
            >
              {connecting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "連接 Asana"
              )}
            </Button>
          )}
        </div>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "rounded-lg px-2.5 py-2 text-[13px] leading-relaxed",
              message.role === "user"
                ? "ml-6 bg-blue-50 text-gray-800"
                : "mr-4 bg-gray-50 text-gray-700"
            )}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
            {message.filledKeys && message.filledKeys.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {message.filledKeys.map((key) => (
                  <span
                    key={key}
                    className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700"
                  >
                    {WEEKLY_REPORT_AI_FIELD_LABELS[key as keyof typeof WEEKLY_REPORT_AI_FIELD_LABELS] ||
                      key}
                  </span>
                ))}
              </div>
            )}
            {message.asanaWarning && (
              <p className="mt-1.5 text-[11px] text-amber-700">{message.asanaWarning}</p>
            )}
          </div>
        ))}
        {sending && (
          <div className="mr-4 flex items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-2 text-[13px] text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            正在分析並填入欄位...
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="貼上會議筆記、參與者、進度、客人待確認事項..."
          className="min-h-[120px] resize-none bg-white text-[13px]"
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[10px] text-gray-400">Ctrl + Enter 送出</p>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 bg-violet-600 text-[13px] text-white hover:bg-violet-700"
            onClick={() => void handleSend()}
            disabled={sending}
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            分析並填入
          </Button>
        </div>
      </div>
    </aside>
  );
}
