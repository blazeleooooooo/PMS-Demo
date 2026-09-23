"use client";

import React, { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isModifiedClick } from "@/lib/nav-click";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Newspaper,
  CalendarDays,
  CalendarClock,
  FileBarChart,
  Volume2,
  FolderOpen,
  Box,
  Building2,
  Users,
  HeartHandshake,
  Bookmark,
  Truck,
  Factory,
  BarChart3,
  FileText,
  ShieldCheck,
  FolderClosed,
  Sparkles,
  PieChart,
  ClipboardCheck,
  Trophy,
  Receipt,
  Construction,
  CreditCard,
  ArrowLeftRight,
  Wallet,
  ListPlus,
  Banknote,
  TrendingUp,
  Bell,
  LogOut,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Settings,
  MapPin,
  Layers,
  Wrench,
  Compass,
  UsersRound,
  Package,
  CalendarRange,
  Ruler,
  FileSignature,
  FileSpreadsheet,
  Globe,
  Rows,
  Target,
  Tag,
  Tags,
  CalendarHeart,
  Palette,
  Send,
  AlertTriangle,
  Star,
  Ban,
  Bot,
  Globe2,
  FileType,
  LayoutTemplate,
  MessageSquare,
  XCircle,
  ListChecks,
  ClipboardList,
  Lock,
  Fence,
  Warehouse,
  HardHat,
  FileSearch,
  Clock,
  Unlock,
  ImageIcon,
  Focus,
  Mail,
  Import,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { navigationGroups } from "@/lib/mock-data";
import { getActiveNavGroupIndex, isNavItemActive } from "@/lib/nav-active";
import { isNavItemPermissionBlocked } from "@/lib/route-modules";
import { usePermission } from "@/hooks/use-permission";
import { useNotifications } from "@/hooks/use-notifications";
import NotificationPanel from "@/components/dashboard/NotificationPanel";

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard,
  Newspaper,
  CalendarDays,
  CalendarClock,
  FileBarChart,
  Volume2,
  FolderOpen,
  Box,
  Building2,
  Users,
  HeartHandshake,
  Bookmark,
  Truck,
  Factory,
  BarChart3,
  FileText,
  ShieldCheck,
  FolderClosed,
  Sparkles,
  PieChart,
  ClipboardCheck,
  Trophy,
  Receipt,
  Construction,
  CreditCard,
  ArrowLeftRight,
  Wallet,
  ListPlus,
  Banknote,
  TrendingUp,
  Settings,
  MapPin,
  Layers,
  Wrench,
  Compass,
  UsersRound,
  Package,
  CalendarRange,
  Ruler,
  FileSignature,
  FileSpreadsheet,
  Globe,
  Rows,
  Target,
  Tag,
  Tags,
  CalendarHeart,
  Palette,
  Send,
  AlertTriangle,
  Star,
  Ban,
  Bot,
  Globe2,
  FileType,
  LayoutTemplate,
  MessageSquare,
  XCircle,
  ListChecks,
  ClipboardList,
  Lock,
  Fence,
  Warehouse,
  HardHat,
  FileSearch,
  Clock,
  Unlock,
  ImageIcon,
  Focus,
  Mail,
  Import,
};

interface TopNavProps {
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
}

export default function TopNav({
  sidebarCollapsed,
  onSidebarToggle,
}: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const {
    user,
    isLoading: authLoading,
    signOut,
    displayName: resolvedName,
    initials,
  } = useAuth();
  // If auth is loading, show placeholder. Once loaded, show staff name or email username.
  // "未登入" only shows if we're genuinely sure there's no user (unlikely on protected pages).
  const displayName = authLoading
    ? "..."
    : resolvedName || user?.email?.split("@")[0] || (user ? "用戶" : "未登入");

  // Debug logging
  React.useEffect(() => {
    console.log("[TopNav] render state:", {
      authLoading,
      userEmail: user?.email ?? null,
      initials,
      displayName,
    });
  }, [authLoading, user?.email, initials, displayName]);
  const {
    notifications,
    unreadCount,
    isLoading: notifLoading,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const { canView, loading: permLoading } = usePermission();
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const today = new Date();
  const dateString = today.toLocaleDateString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    day: "numeric",
    month: "short",
    year: "numeric",
    weekday: "short",
  });

  const [activeGroupIndex, setActiveGroupIndex] = useState(() =>
    getActiveNavGroupIndex(pathname),
  );
  // hoveredGroupIndex: temporarily previewed group on hover; null = not hovering
  const [hoveredGroupIndex, setHoveredGroupIndex] = useState<number | null>(
    null,
  );
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Sync active group with pathname changes; close the mobile drawer on navigate
  React.useEffect(() => {
    setActiveGroupIndex(getActiveNavGroupIndex(pathname));
    setMobileNavOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (media.matches) setMobileNavOpen(false);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  React.useEffect(() => {
    if (!mobileNavOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileNavOpen]);

  const canHoverPreview = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 1024px) and (hover: hover)").matches;

  React.useEffect(() => {
    if (!isPending) setNavigatingTo(null);
  }, [isPending]);

  // Cleanup hover timeout on unmount
  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const navigate = (href: string, event?: React.MouseEvent) => {
    if (event && isModifiedClick(event)) return;
    if (pathname === href) return;
    setNavigatingTo(href);
    startTransition(() => router.push(href));
  };

  // The displayed group is the hovered one (preview) or the locked active one
  const displayedGroupIndex =
    hoveredGroupIndex !== null ? hoveredGroupIndex : activeGroupIndex;
  const activeGroup = navigationGroups[displayedGroupIndex];
  const isPreviewMode =
    hoveredGroupIndex !== null && hoveredGroupIndex !== activeGroupIndex;
  const groupSettings = activeGroup.settingsItems ?? [];
  const settingsTarget =
    groupSettings.find((item) => {
      if (item.external) return false;
      const path = item.href.split("?")[0];
      return pathname === path || pathname.startsWith(`${path}/`);
    }) ?? groupSettings[0];
  const settingsActive =
    !isPreviewMode &&
    groupSettings.some((item) => {
      if (item.external) return false;
      const path = item.href.split("?")[0];
      return pathname === path || pathname.startsWith(`${path}/`);
    });
  const settingsNavigating =
    navigatingTo !== null &&
    groupSettings.some((item) => {
      const path = item.href.split("?")[0];
      const navPath = navigatingTo.split("?")[0];
      return path === navPath;
    }) &&
    isPending;
  const showExpanded = !sidebarCollapsed || mobileNavOpen;

  return (
    <>
      {/* ── TOP BAR ── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-[52px] bg-[#1A2035] flex items-center border-b border-white/10">
        <button
          type="button"
          className="lg:hidden flex items-center justify-center w-11 h-11 shrink-0 text-white/80 hover:bg-white/10 rounded-md ml-0.5 touch-manipulation"
          aria-label={mobileNavOpen ? "關閉選單" : "開啟選單"}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          {mobileNavOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>

        {/* Logo — compact on phone/iPad, aligned with sidebar on desktop */}
        <div
          className={`flex items-center shrink-0 justify-center transition-all duration-300 w-10 ${
            sidebarCollapsed ? "lg:w-[56px]" : "lg:w-[200px]"
          }`}
        >
          <div className="relative z-10 w-[120px] overflow-hidden flex items-center justify-center h-[40px]">
            <Image
              src="/images/pms-logo-white.png"
              alt="PMS 3.0"
              width={200}
              height={200}
              className="object-cover scale-[2.2] w-[20px] h-[20px]"
              priority
            />
          </div>
        </div>

        {/* Main nav groups — horizontal (scrolls on tablet/phone) */}
        <nav
          className="flex items-center gap-0.5 sm:gap-1 flex-1 overflow-x-auto hide-scrollbar px-1 sm:px-2 min-w-0"
          onMouseLeave={() => {
            if (!canHoverPreview()) return;
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            setHoveredGroupIndex(null);
          }}
        >
          {navigationGroups.map((group, i) => (
            <button
              key={group.title}
              onMouseEnter={() => {
                if (!canHoverPreview()) return;
                if (hoverTimeoutRef.current)
                  clearTimeout(hoverTimeoutRef.current);
                hoverTimeoutRef.current = setTimeout(() => {
                  setHoveredGroupIndex(i);
                }, 150);
              }}
              onMouseLeave={() => {
                if (!canHoverPreview()) return;
                if (hoverTimeoutRef.current)
                  clearTimeout(hoverTimeoutRef.current);
              }}
              onClick={() => {
                setActiveGroupIndex(i);
                setHoveredGroupIndex(null);
                if (
                  typeof window !== "undefined" &&
                  window.innerWidth < 1024
                ) {
                  setMobileNavOpen(true);
                }
              }}
              className={`shrink-0 px-2 sm:px-3 py-1.5 min-h-9 rounded-md text-[13px] sm:text-[14.5px] font-medium transition-all duration-200 whitespace-nowrap touch-manipulation ${
                activeGroupIndex === i
                  ? "bg-white/15 text-white"
                  : hoveredGroupIndex === i
                    ? "bg-white/8 text-white/80"
                    : "text-white/55 hover:text-white hover:bg-white/8"
              }`}
            >
              {group.title}
            </button>
          ))}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 shrink-0">
          {/* Notification bell */}
          <button
            onClick={() => setNotifPanelOpen((prev) => !prev)}
            className="relative p-1.5 text-white/50 hover:text-white rounded-md hover:bg-white/10 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {/* User avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <Avatar className="w-7 h-7 shrink-0">
              <AvatarFallback className="bg-bw-blue/30 text-white text-[12px] font-semibold">
                {initials === "??" && user?.email
                  ? user.email.slice(0, 2).toUpperCase()
                  : initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden md:inline text-white/80 text-xs font-medium max-w-[120px] truncate">
              {displayName}
            </span>
          </div>

          {/* Logout */}
          <button
            onClick={() => {
              console.log("[TopNav] Logout button clicked");
              signOut();
            }}
            className="p-1.5 text-white/40 hover:text-white rounded-md hover:bg-white/10 transition-colors"
            title="登出"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="關閉選單"
          className="fixed inset-0 top-[52px] z-[35] bg-black/40 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      {/* ── LEFT SUB-SIDEBAR (drawer below lg, persistent on desktop) ── */}
      <aside
        onMouseEnter={() => {
          // When user moves mouse into sidebar, lock the preview so it stays
        }}
        onMouseLeave={() => {
          // When leaving sidebar, clear the preview back to active
          setHoveredGroupIndex(null);
        }}
        className={`fixed left-0 top-[52px] h-[calc(100dvh-52px)] bg-[#1A2035] flex flex-col z-40 transition-all duration-300 border-r border-white/10 w-[min(280px,85vw)] ${
          mobileNavOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        } lg:translate-x-0 lg:shadow-none ${
          sidebarCollapsed ? "lg:w-[56px]" : "lg:w-[200px]"
        }`}
      >
        {/* Sub-group label */}
        {showExpanded && (
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <p
              className={`text-[12px] font-semibold uppercase tracking-wider ${
                isPreviewMode ? "text-white/50" : "text-white/35"
              }`}
            >
              {activeGroup.title}
            </p>
            {isPreviewMode && (
              <span className="text-[11px] text-bw-blue/80 bg-bw-blue/10 px-1.5 py-0.5 rounded font-medium">
                預覽
              </span>
            )}
          </div>
        )}

        {/* Sub-items */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {activeGroup.items.map((item) => {
            const Icon = iconMap[item.icon];
            // In preview mode, don't highlight based on pathname
            const active = isPreviewMode
              ? false
              : isNavItemActive(pathname, item.href);
            const isNavigating = navigatingTo === item.href && isPending;
            const permissionBlocked = isNavItemPermissionBlocked(
              item.href,
              canView,
              permLoading,
              item.external
            );
            return (
              <React.Fragment key={item.label}>
                {/* Section header */}
                {item.section && showExpanded && (
                  <div className="pt-4 pb-1.5 px-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">
                      {item.section}
                    </p>
                  </div>
                )}
                {item.section && !showExpanded && (
                  <div className="pt-3 pb-1 flex justify-center">
                    <div className="w-5 h-px bg-white/20" />
                  </div>
                )}
                <Link
                  href={item.href}
                  onMouseEnter={() => router.prefetch(item.href)}
                  onClick={(e) => {
                    if (isModifiedClick(e)) return;
                    // Lock the sidebar to this group when clicking a sidebar item
                    if (isPreviewMode) {
                      setActiveGroupIndex(displayedGroupIndex);
                      setHoveredGroupIndex(null);
                    }
                    e.preventDefault();
                    navigate(item.href, e);
                  }}
                  className={`w-full flex items-center gap-2.5 rounded-lg transition-all duration-200 group relative min-w-0 touch-manipulation ${
                    showExpanded ? "px-3 py-2.5" : "justify-center px-2 py-2.5"
                  } ${
                    active || isNavigating
                      ? "bg-bw-blue text-white shadow-md shadow-bw-blue/20"
                      : isPreviewMode
                        ? "text-white/65 hover:text-white hover:bg-white/8"
                        : "text-white/55 hover:text-white hover:bg-white/5"
                  }`}
                  title={
                    !showExpanded
                      ? permissionBlocked
                        ? `${item.label}（無權限）`
                        : item.label
                      : permissionBlocked
                        ? "無權限"
                        : undefined
                  }
                >
                  {isNavigating ? (
                    <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                  ) : (
                    Icon && <Icon className="w-4 h-4 shrink-0" />
                  )}
                  {showExpanded && (
                    <>
                      <span className="text-[15px] font-medium truncate flex-1 text-left">
                        {item.label}
                      </span>
                      {permissionBlocked && (
                        <Lock
                          className="w-3 h-3 shrink-0 text-white/35"
                          aria-hidden
                        />
                      )}
                    </>
                  )}
                  {!showExpanded && permissionBlocked && (
                    <Lock
                      className="w-2.5 h-2.5 absolute top-1 right-1 text-white/40"
                      aria-hidden
                    />
                  )}
                </Link>
              </React.Fragment>
            );
          })}
        </div>

        {/* Settings + collapse */}
        <div className="px-2 pb-2 pt-1 space-y-1 border-t border-white/10">
          {groupSettings.length > 0 && settingsTarget && (
            <Link
              href={settingsTarget.href}
              onMouseEnter={() => {
                if (!settingsTarget.external) router.prefetch(settingsTarget.href);
              }}
              onClick={(e) => {
                if (isModifiedClick(e)) return;
                if (isPreviewMode) {
                  setActiveGroupIndex(displayedGroupIndex);
                  setHoveredGroupIndex(null);
                }
                e.preventDefault();
                navigate(settingsTarget.href, e);
              }}
              className={`w-full flex items-center gap-2.5 rounded-lg transition-all duration-200 relative min-w-0 touch-manipulation ${
                showExpanded ? "px-3 py-2.5" : "justify-center px-2 py-2.5"
              } ${
                settingsActive || settingsNavigating
                  ? "bg-bw-blue text-white shadow-md shadow-bw-blue/20"
                  : isPreviewMode
                    ? "text-white/65 hover:text-white hover:bg-white/8"
                    : "text-white/55 hover:text-white hover:bg-white/5"
              }`}
              title={!showExpanded ? "設定" : undefined}
            >
              {settingsNavigating ? (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
              ) : (
                <Settings className="w-4 h-4 shrink-0" />
              )}
              {showExpanded && (
                <span className="text-[15px] font-medium truncate flex-1 text-left">
                  設定
                </span>
              )}
            </Link>
          )}
          <button
            onClick={onSidebarToggle}
            className="hidden lg:flex w-full items-center justify-center gap-1.5 text-white/30 hover:text-white/70 text-[13px] py-1.5 rounded-md hover:bg-white/5 transition-colors border border-white/10"
            title={sidebarCollapsed ? "展開" : "收合"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <>
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>收合</span>
              </>
            )}
          </button>
        </div>
      </aside>
      {/* Notification Panel */}
      <NotificationPanel
        open={notifPanelOpen}
        onClose={() => setNotifPanelOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        isLoading={notifLoading}
        markAsRead={markAsRead}
        markAllAsRead={markAllAsRead}
      />
    </>
  );
}
