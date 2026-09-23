"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { handleNavClick } from "@/lib/nav-click";
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  CreditCard,
  FolderOpen,
  X,
} from "lucide-react";
import type { Notification } from "@/hooks/use-notifications";

type NotificationFilter = "all" | "unread" | "read";

const FILTERS: { key: NotificationFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "unread", label: "未讀" },
  { key: "read", label: "已讀" },
];

const EMPTY_COPY: Record<NotificationFilter, { title: string; hint: string }> = {
  all: { title: "暫無通知", hint: "新的通知會顯示在這裡" },
  unread: { title: "暫無未讀通知", hint: "所有通知都已讀取" },
  read: { title: "暫無已讀通知", hint: "已讀通知會顯示在這裡" },
};

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const typeConfig: Record<
  string,
  { icon: React.ElementType; color: string; bgColor: string }
> = {
  info: { icon: Info, color: "text-blue-400", bgColor: "bg-blue-500/10" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bgColor: "bg-amber-500/10" },
  success: { icon: CheckCircle2, color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
  error: { icon: XCircle, color: "text-red-400", bgColor: "bg-red-500/10" },
  reminder: { icon: Clock, color: "text-violet-400", bgColor: "bg-violet-500/10" },
  approval: { icon: FileText, color: "text-teal-400", bgColor: "bg-teal-500/10" },
  payment: { icon: CreditCard, color: "text-green-400", bgColor: "bg-green-500/10" },
  project_update: { icon: FolderOpen, color: "text-blue-400", bgColor: "bg-blue-500/10" },
};

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "剛剛";
  if (diffMins < 60) return `${diffMins} 分鐘前`;
  if (diffHours < 24) return `${diffHours} 小時前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    month: "short",
    day: "numeric",
  });
}

function NotificationItem({
  notification,
  onRead,
  onNavigate,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onNavigate: (n: Notification, event: React.MouseEvent) => void;
}) {
  const config = typeConfig[notification.type] || typeConfig.info;
  const Icon = config.icon;

  // Determine linked entity badge
  const linkedEntity = notification.bwa_project_id
    ? { label: "BWA", color: "bg-blue-500/20 text-blue-300", name: notification.bwa_projects?.project_name || notification.bwa_projects?.project_code }
    : notification.bwf_project_id
      ? { label: "BWF", color: "bg-amber-500/20 text-amber-300", name: notification.bwf_projects?.project_name || notification.bwf_projects?.project_code }
      : notification.income_id
        ? { label: "收入", color: "bg-green-500/20 text-green-300", name: notification.incomes?.invoice_number }
        : notification.expense_id
          ? { label: "支出", color: "bg-red-500/20 text-red-300", name: notification.expenses?.invoice_number }
          : null;

  return (
    <div
      onClick={(e) => {
        if (!notification.is_read) onRead(notification.id);
        onNavigate(notification, e);
      }}
      className={`px-4 py-3 border-b border-white/5 cursor-pointer transition-all duration-200 hover:bg-white/5 group ${
        !notification.is_read ? "bg-white/[0.03]" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-[15px] font-medium truncate ${!notification.is_read ? "text-white" : "text-white/70"}`}>
              {notification.title}
            </p>
            {!notification.is_read && (
              <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
            )}
          </div>

          {notification.message && (
            <p className="text-[14px] text-white/50 mt-0.5 line-clamp-2">
              {notification.message}
            </p>
          )}

          {/* Linked entity badge */}
          {linkedEntity && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className={`text-[12px] font-semibold px-1.5 py-0.5 rounded ${linkedEntity.color}`}>
                {linkedEntity.label}
              </span>
              {linkedEntity.name && (
                <span className="text-[13px] text-white/40 truncate">{linkedEntity.name}</span>
              )}
            </div>
          )}

          {/* Time */}
          <p className="text-[13px] text-white/30 mt-1">
            {getRelativeTime(notification.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function NotificationPanel({
  open,
  onClose,
  notifications,
  unreadCount,
  isLoading,
  markAsRead,
  markAllAsRead,
}: NotificationPanelProps) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<NotificationFilter>("unread");

  React.useEffect(() => {
    if (open) setFilter("unread");
  }, [open]);

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.is_read;
    if (filter === "read") return n.is_read;
    return true;
  });
  const readCount = notifications.length - unreadCount;
  const emptyCopy = EMPTY_COPY[filter];

  const handleNavigate = (n: Notification, event?: React.MouseEvent) => {
    const href = n.link_url
      ? n.link_url
      : n.income_id && n.bwa_project_id
        ? `/projects/bwa/${n.bwa_project_id}/invoice/${n.income_id}`
        : n.bwa_project_id
          ? `/projects/bwa/${n.bwa_project_id}`
          : n.bwf_project_id
            ? `/bwf/projects/${n.bwf_project_id}`
            : n.expense_id
              ? "/cost-analysis"
              : null;
    if (!href) return;
    handleNavClick(href, event, (next) => {
      router.push(next);
      onClose();
    });
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/20"
        onClick={onClose}
        onWheel={(e) => e.stopPropagation()}
      />

      {/* Panel */}
      <div className="fixed top-[52px] left-3 right-3 z-[61] w-auto max-h-[calc(100dvh-72px)] sm:left-auto sm:right-4 sm:w-[380px] bg-[#1E2540] border border-white/10 rounded-xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden animate-in slide-in-from-top-2 duration-200 overscroll-contain">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-white/70" />
            <h3 className="text-[16px] font-semibold text-white">通知中心</h3>
            {unreadCount > 0 && (
              <span className="text-[13px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[13px] text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-white/5 transition-colors flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                全部已讀
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-white/40 hover:text-white rounded hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="px-4 py-2 border-b border-white/10">
          <div className="flex rounded-lg bg-white/5 p-0.5">
            {FILTERS.map(({ key, label }) => {
              const count =
                key === "all"
                  ? notifications.length
                  : key === "unread"
                    ? unreadCount
                    : readCount;
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`flex-1 text-[13px] py-1.5 rounded-md transition-colors ${
                    active
                      ? "bg-white/15 text-white font-medium"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`ml-1 ${active ? "text-white/70" : "text-white/30"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain max-h-[500px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/40">
              <Bell className="w-8 h-8 mb-3 opacity-40" />
              <p className="text-[15px]">{emptyCopy.title}</p>
              <p className="text-[13px] text-white/25 mt-1">{emptyCopy.hint}</p>
            </div>
          ) : (
            <div>
              {filteredNotifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={markAsRead}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {filteredNotifications.length > 0 && (
          <div className="px-4 py-2.5 border-t border-white/10 text-center">
            <p className="text-[13px] text-white/30">
              {filter === "unread"
                ? `顯示 ${filteredNotifications.length} 條未讀通知`
                : filter === "read"
                  ? `顯示 ${filteredNotifications.length} 條已讀通知`
                  : `顯示最近 ${filteredNotifications.length} 條通知`}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
