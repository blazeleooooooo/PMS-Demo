"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  ShieldAlert,
  ChevronDown,
  Search,
  RotateCcw,
  X,
  UserCog,
  Check,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useStaffMembers } from "@/hooks/use-dashboard-data";

// Floating developer tool: visible only to accounts whose public.users row has
// is_developer = true. Lets a developer switch which staff they're "operating
// as" without logging out, shows a persistent warning while impersonating, and
// offers a one-click return to their own account.
//
// Safety: `canImpersonate` is derived from the REAL login profile, so even
// after switching to a permission-less staff the widget stays visible and the
// developer can always switch back.
export default function ImpersonationWidget() {
  const {
    canImpersonate,
    isImpersonating,
    staff,
    realStaff,
    realDisplayName,
    impersonate,
    stopImpersonating,
  } = useAuth();
  const { data: staffMembers } = useStaffMembers();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [switching, setSwitching] = useState<string | null>(null);

  // Drag state — null means "use default bottom-right CSS position"
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset position on every page navigation
  const pathname = usePathname();
  useEffect(() => { setPos(null); }, [pathname]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only drag from the pill itself (not the expanded panel)
    if ((e.target as HTMLElement).closest(".imp-panel")) return;
    dragging.current = true;
    const rect = containerRef.current!.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    containerRef.current!.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    setPos({
      x: e.clientX - dragOffset.current.x,
      y: e.clientY - dragOffset.current.y,
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // Hide entirely for non-developers — the whole feature is gated on the real
  // login's developer flag.
  if (!canImpersonate) return null;

  const currentName = staff?.name || staff?.full_name || "Unknown";
  const realName = realStaff?.name || realStaff?.full_name || realDisplayName || "我的帳戶";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? staffMembers.filter((s) => (s.name || "").toLowerCase().includes(q))
      : staffMembers;
    return list;
  }, [staffMembers, search]);

  async function handlePick(id: string) {
    setSwitching(id);
    await impersonate(id);
    setSwitching(null);
    setOpen(false);
    setSearch("");
  }

  const posStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, bottom: "auto", right: "auto" }
    : { bottom: 16, right: 16 };

  return (
    <div
      ref={containerRef}
      className="fixed z-[9998]"
      style={posStyle}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* ─── Expanded panel — absolutely positioned above-left of the pill ─── */}
      {open && (
        <div className="imp-panel absolute bottom-full right-0 mb-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
            <div className="flex items-center gap-2">
              <UserCog className="w-4 h-4" />
              <span className="text-sm font-semibold">開發者：切換身分</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Current identity */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">我的帳戶</span>
              <span className="font-medium text-gray-700">{realName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">目前操作為</span>
              <span className={`font-semibold ${isImpersonating ? "text-amber-600" : "text-gray-700"}`}>
                {currentName}
                {!isImpersonating && " (本人)"}
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜尋員工..."
                className="w-full pl-8 pr-3 h-8 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
              />
            </div>
          </div>

          {/* Staff list */}
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-8">沒有符合的員工</p>
            ) : (
              filtered.map((s) => {
                const active = s.id === staff?.id;
                const isMe = s.id === realStaff?.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => handlePick(s.id)}
                    disabled={switching === s.id}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm transition-colors ${
                      active ? "bg-bw-blue/10 text-bw-blue" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="flex-1 truncate">
                      {s.name || "(未命名)"}
                      {isMe && <span className="text-[11px] text-gray-400 ml-1.5">本人</span>}
                    </span>
                    {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Return to me */}
          {isImpersonating && (
            <div className="p-3 border-t border-gray-100">
              <button
                onClick={() => {
                  stopImpersonating();
                  setOpen(false);
                }}
                className="w-full flex items-center justify-center gap-1.5 h-9 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                返回我的帳戶 ({realName})
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Floating pill ──────────────────────────────── */}
      <div
        className={`flex items-center rounded-full shadow-lg border ${
          isImpersonating
            ? "bg-amber-500 text-white border-amber-400 animate-pulse"
            : "bg-gray-900 text-white border-gray-700"
        }`}
      >
        {/* Drag handle — left icon only */}
        <span
          onPointerDown={onPointerDown}
          className="pl-3 pr-2 py-2.5 cursor-grab active:cursor-grabbing shrink-0"
          title="拖曳移動"
        >
          {isImpersonating ? (
            <ShieldAlert className="w-4 h-4" />
          ) : (
            <UserCog className="w-4 h-4" />
          )}
        </span>

        {/* Click area — text + chevron */}
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-1.5 pr-3 py-2.5 transition-colors ${
            isImpersonating ? "hover:bg-amber-600" : "hover:bg-gray-800"
          } rounded-r-full`}
          title={isImpersonating ? `正在以 ${currentName} 身分操作` : "開發者身分切換"}
        >
          <span className="text-sm font-semibold max-w-[180px] truncate">
            {isImpersonating ? `操作中：${currentName}` : "開發者"}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
    </div>
  );
}
