"use client";
import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  Receipt,
  Construction,
  CreditCard,
  ArrowLeftRight,
  Wallet,
  ListPlus,
  Banknote,
  TrendingUp,
  ExternalLink,
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
  Quote,
  Mail,
  Import,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import TopNav from "@/components/dashboard/TopNav";
import { navigationGroups, type NavItem } from "@/lib/mock-data";
import { isNavItemPermissionBlocked } from "@/lib/route-modules";
import { fetchDashboardSentences } from "@/lib/data-service";

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
  Mail,
  Import,
};

const colorPalette = [
  { color: "text-bw-blue", bgColor: "bg-blue-50" },
  { color: "text-amber-600", bgColor: "bg-amber-50" },
  { color: "text-violet-600", bgColor: "bg-violet-50" },
  { color: "text-teal-600", bgColor: "bg-teal-50" },
  { color: "text-orange-600", bgColor: "bg-orange-50" },
  { color: "text-pink-600", bgColor: "bg-pink-50" },
  { color: "text-emerald-600", bgColor: "bg-emerald-50" },
  { color: "text-slate-600", bgColor: "bg-slate-50" },
  { color: "text-red-600", bgColor: "bg-red-50" },
];

function colorForHref(href: string) {
  let hash = 0;
  for (let i = 0; i < href.length; i++) {
    hash = (hash * 31 + href.charCodeAt(i)) | 0;
  }
  return colorPalette[Math.abs(hash) % colorPalette.length];
}

/** Home launcher: main services only (no settings, no self-link). */
function isHomeNavItem(item: NavItem): boolean {
  if (item.href === "/") return false;
  if (item.href.startsWith("/settings")) return false;
  return true;
}

function pickRandomSentence(pool: string[], current: string | null): string | null {
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  let next = pool[Math.floor(Math.random() * pool.length)];
  let guard = 0;
  while (next === current && guard++ < 12) {
    next = pool[Math.floor(Math.random() * pool.length)];
  }
  return next;
}

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();
  const { displayName, isLoading: authLoading } = useAuth();
  const { canView, loading: permLoading } = usePermission();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [greetingText, setGreetingText] = useState("");
  const [sentences, setSentences] = useState<string[]>([]);
  const [quote, setQuote] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);

  // Portal redirect check
  useEffect(() => {
    const checkUserType = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const email = user.email;
        if (email) {
          const { data: profile } = await supabase
            .from("users")
            .select("user_type")
            .eq("email", email.toLowerCase().trim())
            .single();

          const type = profile?.user_type;
          if (type === "Supplier") {
            router.replace("/portal/supplier");
          } else if (type === "Customer") {
            router.replace("/portal/customer");
          }
        }
      } catch {
        // ignore — staff users proceed normally
      }
    };

    checkUserType();
  }, [supabase, router]);

  useEffect(() => {
    const hourPart = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Hong_Kong",
      hour: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date())
      .find((part) => part.type === "hour")?.value ?? "0";
    const hour = Number(hourPart) % 24;
    if (hour < 12) setGreetingText("早上好");
    else if (hour < 18) setGreetingText("下午好");
    else setGreetingText("晚上好");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setQuoteLoading(true);
      const pool = await fetchDashboardSentences();
      if (cancelled) return;
      setSentences(pool);
      setQuote(pickRandomSentence(pool, null));
      setQuoteLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleGroups = useMemo(() => {
    return navigationGroups
      .map((group) => ({
        title: group.title,
        items: group.items.filter(
          (item) =>
            isHomeNavItem(item) &&
            !isNavItemPermissionBlocked(
              item.href,
              canView,
              permLoading,
              item.external
            )
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [canView, permLoading]);

  const renderTile = (item: NavItem) => {
    const Icon = iconMap[item.icon] ?? LayoutDashboard;
    const { color, bgColor } = colorForHref(item.href);
    return (
      <Link
        key={item.label + item.href}
        href={item.href}
        target={item.external ? "_blank" : undefined}
        rel={item.external ? "noopener noreferrer" : undefined}
        className="flex flex-col items-center gap-2.5 py-3 px-2 rounded-xl hover:bg-gray-50 transition-all duration-200 group relative"
      >
        {item.external && (
          <span className="absolute top-1 right-1 text-[12px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
            外部
          </span>
        )}
        <div
          className={`w-12 h-12 rounded-full ${bgColor} flex items-center justify-center transition-transform duration-200 group-hover:scale-110 relative`}
        >
          <Icon className={`w-5 h-5 ${color}`} />
          {item.external && (
            <ExternalLink className="w-3 h-3 text-gray-400 absolute -top-0.5 -right-0.5" />
          )}
        </div>
        <span className="text-xs font-medium text-gray-700 text-center leading-tight">
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <TopNav
        sidebarCollapsed={sidebarCollapsed}
        onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div
        className={`pt-[52px] transition-all duration-300 ${
          sidebarCollapsed ? "lg:ml-[56px]" : "lg:ml-[200px]"
        }`}
      >
        <header className="sticky top-[52px] z-30 bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-center">
            <h1 className="text-base font-semibold text-gray-900">全部服務</h1>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-lg font-semibold text-gray-900">
              {greetingText}，{authLoading ? "..." : displayName || "用戶"} 👋
            </p>
            <p className="text-sm text-gray-500 mt-1">歡迎使用 BW PMS 系統</p>

            {(quoteLoading || quote) && (
              <button
                type="button"
                onClick={() => {
                  if (sentences.length === 0) return;
                  setQuote(pickRandomSentence(sentences, quote));
                }}
                disabled={quoteLoading || sentences.length === 0}
                className="w-full text-left mt-4 pt-4 border-t border-gray-100 hover:opacity-90 transition-opacity group disabled:cursor-default"
                aria-label="點擊換一句勵志語錄"
              >
                <div className="flex gap-3 items-center">
                  <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                    <Quote className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {quoteLoading ? (
                      <p className="text-sm text-gray-400">載入中…</p>
                    ) : (
                      <p className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-line font-medium">
                        {quote}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )}
          </div>

          {visibleGroups.map((group) => (
            <div
              key={group.title}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
            >
              <h2 className="text-sm font-bold text-gray-900 mb-4">
                {group.title}
              </h2>
              <div className="grid grid-cols-4 gap-x-4 gap-y-5">
                {group.items.map(renderTile)}
              </div>
            </div>
          ))}

          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}
