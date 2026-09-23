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
  ChevronLeft,
  ChevronRight,
  Loader2,
  Settings,
  Lock,
  Fence,
  ClipboardList,
  Warehouse,
  HardHat,
  FileSearch,
  AlertTriangle,
  Target,
  Layers,
  Clock,
  Bot,
  Tags,
  MessageSquare,
  UsersRound,
  Unlock,
  ImageIcon,
  Focus,
  Mail,
  Import,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { navigationGroups } from "@/lib/mock-data";
import { isNavItemActive } from "@/lib/nav-active";
import { isNavItemPermissionBlocked } from "@/lib/route-modules";
import { usePermission } from "@/hooks/use-permission";

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
  Lock,
  Fence,
  ClipboardList,
  Warehouse,
  HardHat,
  FileSearch,
  AlertTriangle,
  Target,
  Layers,
  Clock,
  Bot,
  Tags,
  MessageSquare,
  UsersRound,
  Unlock,
  ImageIcon,
  Focus,
  Mail,
  Import,
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(navigationGroups.map((g) => [g.title, true]))
  );
  // Use unified auth context — displayName, initials, and profile all resolved via single RPC
  const { user, signOut, isLoading: authLoading, displayName: resolvedName, initials } = useAuth();
  const { canView, loading: permLoading } = usePermission();
  const displayName = authLoading ? "..." : resolvedName || (user?.email?.split("@")[0]) || "用戶";

  // Debug logging
  React.useEffect(() => {
    console.log("[Sidebar] render state:", {
      userEmail: user?.email ?? null,
      authLoading,
      initials,
      displayName,
    });
  }, [user?.email, authLoading, initials, displayName]);

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  // Clear navigating state once transition completes
  React.useEffect(() => {
    if (!isPending) {
      setNavigatingTo(null);
    }
  }, [isPending]);

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-bw-navy flex flex-col z-50 transition-all duration-300 ${
        collapsed ? "w-[68px]" : "w-[220px]"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-center px-4 h-[60px] border-b border-white/10 shrink-0">
        <Image
          src="/images/pms-logo-white.png"
          alt="PMS 3.0"
          width={collapsed ? 36 : 140}
          height={collapsed ? 36 : 48}
          className="object-contain transition-all duration-300"
          priority
        />
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {navigationGroups.map((group) => (
          <div key={group.title} className="mb-1">
            {!collapsed && (
              <button
                onClick={() => toggleGroup(group.title)}
                className="w-full text-[14px] font-semibold text-white/40 uppercase tracking-wider px-2 py-1.5 text-left hover:text-white/60 transition-colors"
              >
                {group.title}
              </button>
            )}
            {(collapsed || openGroups[group.title]) && (
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = iconMap[item.icon];
                  const active = !item.external && isNavItemActive(pathname, item.href);
                  const isNavigating = navigatingTo === item.href && isPending;
                  const permissionBlocked = isNavItemPermissionBlocked(
                    item.href,
                    canView,
                    permLoading,
                    item.external
                  );

                  // Section header above this item
                  const sectionHeader = item.section && !collapsed ? (
                    <div className="text-[12px] font-semibold text-white/40 uppercase tracking-wider px-2 pt-3 pb-1">
                      {item.section}
                    </div>
                  ) : null;

                  // External links open in a new tab
                  if (item.external) {
                    return (
                      <React.Fragment key={item.label}>
                        {sectionHeader}
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`w-full flex items-center gap-2.5 rounded-lg transition-all duration-200 group relative ${
                            collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2"
                          } text-white/60 hover:text-white hover:bg-white/5`}
                          title={collapsed ? item.label : undefined}
                        >
                          {Icon && <Icon className="w-4 h-4 shrink-0" />}
                          {!collapsed && (
                            <span className="text-[15px] font-medium truncate">
                              {item.label}
                            </span>
                          )}
                        </a>
                      </React.Fragment>
                    );
                  }

                  return (
                    <React.Fragment key={item.label}>
                      {sectionHeader}
                      <Link
                        href={item.href}
                        onMouseEnter={() => router.prefetch(item.href)}
                        onClick={(e) => {
                          if (isModifiedClick(e)) return;
                          e.preventDefault();
                          if (pathname === item.href) return; // Already on this page
                          setNavigatingTo(item.href);
                          startTransition(() => {
                            router.push(item.href);
                          });
                        }}
                        className={`w-full flex items-center gap-2.5 rounded-lg transition-all duration-200 group relative min-w-0 ${
                          collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2"
                        } ${
                          active || isNavigating
                            ? "bg-bw-blue text-white shadow-md shadow-bw-blue/20"
                            : "text-white/60 hover:text-white hover:bg-white/5"
                        }`}
                        title={
                          collapsed
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
                        {!collapsed && (
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
                        {collapsed && permissionBlocked && (
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
            )}
          </div>
        ))}
      </div>

      {/* Bottom User Section */}
      <div className="border-t border-white/10 p-3 shrink-0">
        <div
          className={`flex items-center ${
            collapsed ? "justify-center" : "gap-3"
          }`}
        >
          <Avatar className="w-9 h-9 shrink-0">
            <AvatarFallback className="bg-bw-blue/20 text-white text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-white text-[15px] font-medium truncate">
                {displayName}
              </p>
              <p className="text-white/40 text-[13px] truncate">Company</p>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => {
                console.log("[Sidebar] Logout button clicked");
                signOut();
              }}
              className="flex-1 flex items-center justify-center gap-1.5 text-white/50 hover:text-white text-xs py-1.5 rounded-md hover:bg-white/5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>登出</span>
            </button>
            <button
              type="button"
              className="relative p-2 text-white/50 hover:text-white rounded-md hover:bg-white/5 transition-colors"
              title="通知（請使用頂部導航鈴鐺）"
              disabled
            >
              <Bell className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="absolute top-[70px] -right-3 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center text-bw-navy hover:bg-gray-50 transition-colors z-10"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>
    </aside>
  );
}
