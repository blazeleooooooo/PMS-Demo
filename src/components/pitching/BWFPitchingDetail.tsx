"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { handleNavClick } from "@/lib/nav-click";
import {
  ArrowLeft,
  Loader2,
  Building2,
  MapPin,
  DollarSign,
  Users,
  Calendar,
  Pencil,
  ExternalLink,
  FolderOpen,
  User,
  Palette,
  Tag,
  Phone,
  Mail,
  FileText,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ClipboardList,
  MessageSquare,
  Clock,
  MoreHorizontal,
  UserPlus,
  Package,
  Plus,
  Play,
  CheckCircle2,
  ArrowUpRight,
  ArrowRightLeft,
  Ban,
} from "lucide-react";
import { AsanaIcon } from "@/components/ui/asana-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchBWFPitchingDetail,
  fetchBWFPitchingCostStructure,
  fetchBWFPitchingOrders,
  updateBWFPitching,
  type BWFPitchingDetailData,
  type BWFCostStructureRow,
  type BWFOrderRow,
} from "@/lib/data-service";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { formatDate } from "@/lib/date-utils";
import InternalCommentPanel from "./InternalCommentPanel";
import BuildingCommentPanel from "@/components/projects/BuildingCommentPanel";
import L1BudgetTab from "./L1BudgetTab";
import CustomerDocumentsPanel from "@/components/clients/CustomerDocumentsPanel";
import ManHourPanel from "@/components/projects/ManHourPanel";
import BWFPitchingDialog from "./BWFPitchingDialog";
import BWFConvertDialog from "./BWFConvertDialog";
import BWFOrderDialog, { getOrderStatusChinese } from "@/components/projects/BWFOrderDialog";
import { BWFOrderEditButton } from "@/components/projects/BWFOrderEditButton";
import { useToast } from "@/components/ui/use-toast";
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

interface BWFPitchingDetailProps {
  pitchingId: string;
}

interface PitchingBVRow {
  id: string;
  handler_id: string | null;
  handler_name: string | null;
}


// ─── STAGE BADGE ────────────────────────────────────────
function stageBadge(stage: string | null) {
  if (!stage)
    return <Badge variant="outline" className="text-gray-400 text-xs">未知</Badge>;
  const s = stage.toLowerCase();
  if (s.includes("confirm") || s.includes("won") || s.includes("成功"))
    return <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/10 text-xs px-2.5 py-0.5">{stage}</Badge>;
  if (s.includes("lost") || s.includes("close") || s.includes("結案"))
    return <Badge className="bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/10 text-xs px-2.5 py-0.5">{stage}</Badge>;
  if (s.includes("pending") || s.includes("wait"))
    return <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/10 text-xs px-2.5 py-0.5">{stage}</Badge>;
  if (s.includes("enquiry"))
    return <Badge className="bg-slate-500/10 text-slate-600 border border-slate-500/20 hover:bg-slate-500/10 text-xs px-2.5 py-0.5">{stage}</Badge>;
  return <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/20 hover:bg-blue-500/10 text-xs px-2.5 py-0.5">{stage}</Badge>;
}

function MultiValueBadges({ value }: { value: string | null }) {
  if (!value) {
    return <Badge variant="secondary" className="text-[12px] font-normal text-gray-400">Null</Badge>;
  }
  const parts = value.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) {
    return <Badge variant="secondary" className="text-[12px] font-normal text-gray-400">Null</Badge>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {parts.map((part) => (
        <Badge key={part} variant="secondary" className="text-[12px] font-normal">
          {part}
        </Badge>
      ))}
    </span>
  );
}

// ─── A field in the General Information grid (label on top, value below) ──
function InfoField({
  labelZh,
  labelEn,
  value,
  isLink,
  href,
}: {
  labelZh: string;
  labelEn: string;
  value: React.ReactNode;
  isLink?: boolean;
  href?: string | null;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-gray-400 mb-0.5">
        <span className="text-gray-500">{labelZh}</span> {labelEn}
      </p>
      {isLink && href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[14px] text-blue-600 hover:text-blue-700 hover:underline break-words inline-flex items-start gap-1"
        >
          <span className="break-all">{value}</span>
          <ExternalLink className="w-3 h-3 flex-shrink-0 mt-1" />
        </a>
      ) : (
        <p className="text-[14px] text-gray-800 break-words">
          {value || <span className="text-gray-300">N/A</span>}
        </p>
      )}
    </div>
  );
}

// ─── A boxed white section with a heading ───────────────
function PanelCard({
  titleZh,
  titleEn,
  action,
  children,
}: {
  titleZh: string;
  titleEn: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[17px] font-semibold text-gray-900">
          {titleZh} <span className="text-gray-700">{titleEn}</span>
        </h3>
        {action}
      </div>
      <Separator className="mb-4" />
      {children}
    </div>
  );
}

export default function BWFPitchingDetail({ pitchingId }: BWFPitchingDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canEdit, canView, canViewSubmodule, loading: permLoading, checkRule } = usePermission();
  const { formatMoney } = useFinancialFormat();
  const { staff } = useAuth();
  const { toast } = useToast();

  const [data, setData] = useState<BWFPitchingDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [advancingStage, setAdvancingStage] = useState(false);
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null);
  const [showCaseClosedDialog, setShowCaseClosedDialog] = useState(false);
  const [closingCase, setClosingCase] = useState(false);
  const [showRecoverDialog, setShowRecoverDialog] = useState(false);
  const [recoveringCase, setRecoveringCase] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const [costRows, setCostRows] = useState<BWFCostStructureRow[]>([]);
  const [orders, setOrders] = useState<BWFOrderRow[]>([]);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [bvList, setBvList] = useState<PitchingBVRow[]>([]);
  const [bvLoading, setBvLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const result = await fetchBWFPitchingDetail(pitchingId);
    setData(result);
    setLoading(false);
  }, [pitchingId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const reloadOrders = useCallback(async () => {
    if (!pitchingId) return;
    setOrders(await fetchBWFPitchingOrders(pitchingId));
  }, [pitchingId]);

  // Cost structure + orders for the overview tab.
  useEffect(() => {
    if (!pitchingId) return;
    fetchBWFPitchingCostStructure(pitchingId).then(setCostRows);
    reloadOrders();
  }, [pitchingId, reloadOrders]);

  const openNewOrderDialog = () => {
    setEditingOrderId(null);
    setShowOrderDialog(true);
  };

  const openEditOrderDialog = (orderId: string) => {
    setEditingOrderId(orderId);
    setShowOrderDialog(true);
  };

  // Collaborator BV records (handler names).
  useEffect(() => {
    if (!pitchingId) return;
    const loadBV = async () => {
      setBvLoading(true);
      try {
        const supabase = createClient();
        const { data: bvRows } = await supabase
          .from("pitching_bv")
          .select("id, handler_id")
          .eq("bwf_pitching_id", pitchingId);
        if (!bvRows || bvRows.length === 0) {
          setBvList([]);
          setBvLoading(false);
          return;
        }
        const handlerIds = [...new Set(bvRows.map((r: any) => r.handler_id).filter(Boolean))];
        let handlerMap = new Map<string, string>();
        if (handlerIds.length > 0) {
          const { data: staffRows } = await supabase
            .from("staff")
            .select("id, name")
            .in("id", handlerIds);
          if (staffRows) handlerMap = new Map(staffRows.map((s: any) => [s.id, s.name]));
        }
        setBvList(
          bvRows.map((r: any) => ({
            id: r.id,
            handler_id: r.handler_id,
            handler_name: r.handler_id ? handlerMap.get(r.handler_id) || null : null,
          })),
        );
      } catch (err) {
        console.error("[BWFPitchingDetail] loadBV error:", err);
        setBvList([]);
      }
      setBvLoading(false);
    };
    loadBV();
  }, [pitchingId]);

  useEffect(() => {
    const action = searchParams.get("action");
    if (
      action === "convert" &&
      data &&
      (data.pitching_stages === "Enquiry" || data.pitching_stages === "Pitching")
    ) {
      setShowStageDialog(true);
    }
  }, [searchParams, data]);

  useEffect(() => {
    if (data?.pitching_stages === "Confirmed Project") {
      const supabaseClient = createClient();
      supabaseClient
        .from("bwf_projects")
        .select("id")
        .eq("bwf_pitching_id", pitchingId)
        .limit(1)
        .then(({ data: projects }: { data: { id: string }[] | null }) => {
          if (projects && projects.length > 0) {
            setLinkedProjectId(projects[0].id);
          }
        });
    } else {
      setLinkedProjectId(null);
    }
  }, [data?.pitching_stages, pitchingId]);

  const handleAdvanceStage = async () => {
    if (!data) return;
    setAdvancingStage(true);
    const nextStage =
      data.pitching_stages === "Enquiry" ? "Pitching" : "Confirmed Project";
    const result = await updateBWFPitching(pitchingId, {
      pitching_stages: nextStage,
      modified_date: new Date().toISOString(),
    });
    if (result.success) {
      await loadData();
    } else {
      toast({
        title: "階段更新失敗",
        description: result.error || "未知錯誤",
        variant: "destructive",
      });
    }
    setAdvancingStage(false);
    setShowStageDialog(false);
  };

  const handleCaseClosed = async () => {
    setClosingCase(true);
    const result = await updateBWFPitching(pitchingId, {
      pitching_stages: "Case Closed",
      modified_date: new Date().toISOString(),
    });
    if (result.success) {
      await loadData();
    }
    setClosingCase(false);
    setShowCaseClosedDialog(false);
  };

  const handleRecoverPitching = async () => {
    setRecoveringCase(true);
    const result = await updateBWFPitching(pitchingId, {
      pitching_stages: "Enquiry",
      modified_date: new Date().toISOString(),
    });
    if (result.success) {
      await loadData();
    }
    setRecoveringCase(false);
    setShowRecoverDialog(false);
  };

  // ─── Derived financials ───
  const estIncome = data?.estimated_income ?? null;
  const estExpense = data?.estimated_expense ?? null;
  const estGP =
    estIncome != null && estExpense != null ? estIncome - estExpense : null;
  const gpRatio =
    estIncome != null && estIncome > 0 && estGP != null
      ? ((estGP / estIncome) * 100).toFixed(2)
      : null;

  const tabPermissionModule: Record<string, string> = {
    overview: "proposals.overview",
    "l1-budget": "proposals.l1-budget",
    quotation: "proposals.quotation",
    "internal-comment": "proposals.internal-comment",
    "building-comment": "proposals.building-comment",
    manhour: "proposals.manhour",
  };
  const canViewTab = (tabId: string) => {
    if (permLoading) return true;
    if (!canView("bwf/proposals")) return false;
    const mod = tabPermissionModule[tabId];
    if (!mod) return true;
    return canViewSubmodule(mod);
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: ClipboardList },
    { id: "l1-budget", label: "L1 Budget", icon: BarChart3 },
    { id: "quotation", label: "Quote", icon: FileText },
    { id: "internal-comment", label: "Internal Comment", icon: MessageSquare },
    { id: "building-comment", label: "Building Comment", icon: Building2 },
    { id: "manhour", label: "Man Hour", icon: Clock },
    { id: "customer-documents", label: "客戶文件", icon: FileText },
  ].filter((t) => canViewTab(t.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-sm text-gray-400">載入提案資料...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-gray-300" />
        </div>
        <p className="text-sm text-gray-500">找不到此提案</p>
        <Button variant="outline" size="sm" onClick={(e) => handleNavClick("/bwf/proposals", e, (href) => router.push(href))}>
          <ArrowLeft className="w-4 h-4 mr-1" /> 返回提案列表
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-0 w-full">
      {/* ─── BREADCRUMB ──────────────────────────────── */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
        <button
          onClick={(e) => handleNavClick("/bwf/proposals", e, (href) => router.push(href))}
          className="hover:text-gray-600 transition-colors"
        >
          提案管理
        </button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-600 font-medium">
          {data.pitching_code || data.real_customer_display_name || "提案詳情"}
        </span>
      </div>

      {/* ─── HEADER CARD ─────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <div className="h-1 bg-gradient-to-r from-fuchsia-500 via-fuchsia-400 to-fuchsia-300" />
        <div className="p-6">
          <div className="flex items-start justify-between">
            {/* Left: Back + info */}
            <div className="flex items-start gap-4">
              <button
                onClick={(e) => handleNavClick("/bwf/proposals", e, (href) => router.push(href))}
                className="mt-1 w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-gray-500" />
              </button>
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                    {data.real_customer_display_name || data.description || "未命名提案"}
                  </h1>
                  <Badge className="bg-fuchsia-500 text-white hover:bg-fuchsia-500 text-[12px] px-2 py-0 font-bold rounded-md">
                    BWF
                  </Badge>
                  {stageBadge(data.pitching_stages)}
                </div>
                {data.pitching_code && (
                  <p className="text-[13px] text-gray-400 font-mono mb-1">
                    {data.pitching_code}
                  </p>
                )}
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  {(data.customer_raw_name || data.customer_name) && (
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      {data.customer_raw_name || data.customer_name}
                    </span>
                  )}
                  {(data.customer_raw_company || data.customer_company) && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        {data.customer_raw_company || data.customer_company}
                      </span>
                    </>
                  )}
                  {data.enquiry_date && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(data.enquiry_date)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: quick links */}
            <div className="flex items-center gap-2">
              <TooltipProvider delayDuration={200}>
                {data.asana_link && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={data.asana_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                      >
                        <AsanaIcon size={20} />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent><p className="text-xs">開啟 Asana</p></TooltipContent>
                  </Tooltip>
                )}
                {data.working_folder && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={data.working_folder}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                      >
                        <FolderOpen className="w-4 h-4 text-gray-500" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent><p className="text-xs">工作資料夾</p></TooltipContent>
                  </Tooltip>
                )}
              </TooltipProvider>

              <Separator orientation="vertical" className="h-6 mx-1" />

              {data.pitching_stages === "Enquiry" && (
                <Button
                  size="sm"
                  onClick={() => setShowStageDialog(true)}
                  className="h-9 gap-1.5 text-[15px] bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Play className="w-3.5 h-3.5" /> Pitching
                </Button>
              )}
              {data.pitching_stages === "Pitching" && (
                <Button
                  size="sm"
                  onClick={() => setShowStageDialog(true)}
                  className="h-9 gap-1.5 text-[15px] bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Project
                </Button>
              )}
              {data.pitching_stages === "Confirmed Project" && linkedProjectId && (
                <Button
                  size="sm"
                  onClick={() =>
                    window.open(`/bwf/projects/${linkedProjectId}`, "_blank", "noopener")
                  }
                  className="h-9 gap-1.5 text-[15px] bg-violet-600 hover:bg-violet-700 text-white"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" /> 查看項目
                </Button>
              )}

              {canEdit("bwf/proposals") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const ruleResult = await checkRule("pitching", "block_edit_when_confirmed", {
                      pitching_stage: data?.pitching_stages || "",
                    });
                    if (ruleResult === "deny") {
                      toast({
                        title: "無法編輯",
                        description: "已確認的提案不可編輯",
                        variant: "destructive",
                      });
                      return;
                    }
                    setShowEditDialog(true);
                  }}
                  className="h-9 gap-1.5 text-[15px]"
                >
                  <Pencil className="w-3.5 h-3.5" /> 編輯
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-9 p-0">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    className="gap-2 text-[15px]"
                    onClick={() => setShowStageDialog(true)}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" /> 轉換為項目
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {data.pitching_stages === "Case Closed" ? (
                    <DropdownMenuItem
                      className="gap-2 text-[15px] text-green-600 focus:text-green-600"
                      onClick={() => setShowRecoverDialog(true)}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" /> Recover Pitching
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      className="gap-2 text-[15px] text-red-600 focus:text-red-600"
                      onClick={() => setShowCaseClosedDialog(true)}
                    >
                      <Ban className="w-3.5 h-3.5" /> Case Closed
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* ─── TAB NAVIGATION ──────────────────────────── */}
        <div className="px-6 border-t border-gray-100">
          <div className="flex items-center gap-0 -mb-px overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {isActive && (
                    <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-blue-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── TAB CONTENT ───────────────────────────────── */}
      <div className="animate-fade-in-up pt-6">
        {!canViewTab(activeTab) ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm text-gray-500 font-medium">您沒有查看此分頁的權限</p>
          </div>
        ) : (
          <>
            {/* ═══ OVERVIEW TAB ═══ */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* ── General Information ── */}
                <PanelCard titleZh="基本資訊" titleEn="General Information">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-6">
                    <InfoField labelZh="客戶" labelEn="Customer" value={data.customer_display_name || data.customer_name} />
                    <InfoField labelZh="主要聯絡人" labelEn="Main Contact" value={data.customer_raw_name || data.customer_name} />
                    <InfoField labelZh="項目經理" labelEn="Project Manager" value={data.pm_name} />
                    <InfoField labelZh="查詢日期" labelEn="Enquiry Date" value={formatDate(data.enquiry_date)} />
                    <InfoField
                      labelZh="主要報價"
                      labelEn="Major Quote"
                      value={<MultiValueBadges value={data.major_quote_name} />}
                    />
                    <InfoField
                      labelZh="階段"
                      labelEn="Pitching Stage"
                      value={stageBadge(data.pitching_stages)}
                    />

                    <InfoField labelZh="來源" labelEn="Source" value={data.source_name} />
                    <InfoField labelZh="客戶類型" labelEn="Customer Type" value={data.customer_type_name} />
                    <InfoField labelZh="服務類型" labelEn="Service Type" value={<MultiValueBadges value={data.service_type_name} />} />
                    <InfoField labelZh="服務事項" labelEn="Service Item" value={<MultiValueBadges value={data.service_item_name} />} />
                    <InfoField labelZh="大廈" labelEn="Building" value={data.building_name} />
                    <InfoField labelZh="財政年度" labelEn="Financial Year" value={data.financial_year_name} />

                    <InfoField labelZh="地區" labelEn="District" value={data.district_name} />
                    <InfoField labelZh="工程地址" labelEn="Site Address" value={data.site_address} />
                    <InfoField labelZh="規模" labelEn="Scale" value={data.size} />
                    <InfoField labelZh="平方尺" labelEn="Size" value={data.actual_size} />
                    <InfoField labelZh="" labelEn="Asana" value={data.asana_link} isLink={!!data.asana_link} href={data.asana_link} />
                    <InfoField labelZh="" labelEn="Working Folder" value={data.working_folder} />

                    <div className="col-span-2 md:col-span-3 lg:col-span-6">
                      <InfoField
                        labelZh="提案描述"
                        labelEn="Description"
                        value={
                          data.quote_content ? (
                            <span className="whitespace-pre-wrap">{data.quote_content}</span>
                          ) : undefined
                        }
                      />
                    </div>
                  </div>
                </PanelCard>

                {/* ── Financials ── */}
                <PanelCard titleZh="財政" titleEn="Financials">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <p className="text-[12px] text-gray-400 mb-1"><span className="text-gray-500">預計收入</span> Estimated Income</p>
                      <p className="text-2xl font-bold text-emerald-600 font-mono-num">{formatMoney(estIncome)}</p>
                    </div>
                    <div>
                      <p className="text-[12px] text-gray-400 mb-1"><span className="text-gray-500">預計支出</span> Estimated Expense</p>
                      <p className="text-2xl font-bold text-red-600 font-mono-num">{formatMoney(estExpense)}</p>
                    </div>
                    <div>
                      <p className="text-[12px] text-gray-400 mb-1"><span className="text-gray-500">預計毛利</span> Estimated Gross Profit</p>
                      <p className="text-2xl font-bold text-blue-600 font-mono-num">{formatMoney(estGP)}</p>
                    </div>
                    <div>
                      <p className="text-[12px] text-gray-400 mb-1"><span className="text-gray-500">預計毛利率</span> Estimated Profit Margin</p>
                      <p className="text-2xl font-bold text-emerald-600 font-mono-num">{gpRatio != null ? `${gpRatio}%` : "-"}</p>
                    </div>
                  </div>
                </PanelCard>

                {/* ── Customer Info | Cost Structure | Collaborator ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Customer Information */}
                  <PanelCard
                    titleZh="客戶資訊"
                    titleEn="Customer Information"
                    action={
                      data.customer_id ? (
                        <button
                          className="text-blue-500 hover:text-blue-600"
                          onClick={(e) => handleNavClick(`/clients/${data.customer_id}`, e, (href) => router.push(href))}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      ) : undefined
                    }
                  >
                    <div className="space-y-3">
                      <div>
                        <p className="text-[12px] text-gray-400 mb-0.5"><span className="text-gray-500">顯示名稱</span> Display Name</p>
                        <p className="text-[14px] text-gray-800">{data.customer_display_name || data.customer_name || <span className="text-gray-300">N/A</span>}</p>
                      </div>
                      <div>
                        <p className="text-[12px] text-gray-400 mb-0.5"><span className="text-gray-500">公司名稱</span> Company Name</p>
                        <p className="text-[14px] text-gray-800">{data.customer_raw_company || data.customer_company || <span className="text-gray-300">N/A</span>}</p>
                      </div>
                      <div>
                        <p className="text-[12px] text-gray-400 mb-0.5"><span className="text-gray-500">聯絡電話</span> Contact Number</p>
                        <p className="text-[14px] text-gray-800 flex items-center gap-1.5">
                          {data.customer_phone ? (<><Phone className="w-3 h-3 text-gray-400" />{data.customer_phone}</>) : <span className="text-gray-300">N/A</span>}
                        </p>
                      </div>
                      {data.customer_email && (
                        <div>
                          <p className="text-[12px] text-gray-400 mb-0.5"><span className="text-gray-500">電郵</span> Email</p>
                          <p className="text-[14px] text-gray-800 flex items-center gap-1.5"><Mail className="w-3 h-3 text-gray-400" />{data.customer_email}</p>
                        </div>
                      )}
                    </div>
                  </PanelCard>

                  {/* Cost Structure */}
                  <PanelCard titleZh="成本結構" titleEn="Cost Structure">
                    <div className="space-y-4">
                      <div>
                        <p className="text-[12px] text-gray-400 mb-1"><span className="text-gray-500">預計收入</span> Estimated Income</p>
                        <p className="text-[15px] text-gray-800 font-mono-num">{formatMoney(estIncome)}</p>
                      </div>
                      <div>
                        <p className="text-[12px] text-gray-400 mb-2"><span className="text-gray-500">預計支出</span> Estimated Expense</p>
                        {costRows.length === 0 ? (
                          <p className="text-[13px] text-gray-300">暫無支出項目</p>
                        ) : (
                          <div className="space-y-1.5">
                            {costRows.map((row) => (
                              <div key={row.id} className="flex items-center justify-between text-[14px]">
                                <span className="text-gray-700 truncate pr-2">{row.expense_type_name || "未分類"}</span>
                                <span className="text-gray-800 font-mono-num flex-shrink-0">{formatMoney(row.amount)}</span>
                              </div>
                            ))}
                            <Separator className="my-1.5" />
                            <div className="flex items-center justify-between text-[14px] font-semibold">
                              <span className="text-gray-500">總計 Total</span>
                              <span className="text-red-600 font-mono-num">
                                {formatMoney(costRows.reduce((s, r) => s + (r.amount || 0), 0))}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </PanelCard>

                  {/* Collaborator */}
                  <PanelCard titleZh="協作者" titleEn="Collaborator">
                    <div className="space-y-3">
                      <div>
                        <p className="text-[12px] text-gray-400 mb-0.5"><span className="text-gray-500">項目經理</span> Main PM</p>
                        <p className="text-[14px] text-gray-800">{data.pm_name || <span className="text-gray-300">N/A</span>}</p>
                      </div>
                      {data.designer_name && (
                        <div>
                          <p className="text-[12px] text-gray-400 mb-0.5"><span className="text-gray-500">設計師</span> Designer</p>
                          <p className="text-[14px] text-gray-800 flex items-center gap-1.5"><Palette className="w-3 h-3 text-violet-400" />{data.designer_name}</p>
                        </div>
                      )}
                      {bvLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
                      ) : (
                        bvList
                          .filter((bv) => bv.handler_id !== data.main_pm_id && bv.handler_id !== data.main_designer_id)
                          .map((bv) => (
                            <div key={bv.id} className="flex items-center gap-2 text-[14px] text-gray-700">
                              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <User className="w-3 h-3 text-gray-500" />
                              </div>
                              {bv.handler_name || "未知"}
                            </div>
                          ))
                      )}
                      <button className="flex items-center gap-1.5 text-[14px] text-blue-600 hover:text-blue-700 font-medium hover:underline pt-1" disabled>
                        <UserPlus className="w-3.5 h-3.5" /> Add Collaborator
                      </button>
                    </div>
                  </PanelCard>
                </div>

                {/* ── Order Product ── */}
                <PanelCard
                  titleZh="訂單"
                  titleEn={`Order Product (${orders.length})`}
                  action={
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={openNewOrderDialog}
                    >
                      <Plus className="w-3.5 h-3.5" /> New Order
                    </Button>
                  }
                >
                  {orders.length === 0 ? (
                    <p className="text-[14px] text-gray-400 text-center py-6">
                      No orders match this criteria for the coming week.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product Type</TableHead>
                          <TableHead>Product Name</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Created By</TableHead>
                          <TableHead>Factory</TableHead>
                          <TableHead>Prod. Start</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((o) => (
                          <TableRow
                            key={o.id}
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => openEditOrderDialog(o.id)}
                          >
                            <TableCell className="text-[14px] text-gray-700">{o.product_type || "—"}</TableCell>
                            <TableCell className="text-[14px] text-gray-800">{o.product_name || "—"}</TableCell>
                            <TableCell className="text-[14px] text-gray-700">{o.quantity ?? "—"}</TableCell>
                            <TableCell className="text-[14px] text-gray-700">{o.created_by_name || "—"}</TableCell>
                            <TableCell className="text-[14px] text-gray-700">{o.factory_name || "—"}</TableCell>
                            <TableCell className="text-[14px] text-gray-700">{formatDate(o.production_start_date)}</TableCell>
                            <TableCell className="text-[14px] text-gray-700">{getOrderStatusChinese(o.order_status)}</TableCell>
                            <TableCell>
                              <BWFOrderEditButton onClick={() => openEditOrderDialog(o.id)} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </PanelCard>

                {/* ── Internal Comment ── */}
                <PanelCard titleZh="內部評價" titleEn="Internal Comment">
                  <InternalCommentPanel
                    pitchingId={pitchingId}
                    permissionModule="proposals.internal-comment"
                    variant="bwf"
                  />
                </PanelCard>
              </div>
            )}

            {/* ═══ L1 BUDGET TAB ═══ */}
            {activeTab === "l1-budget" && (
              <L1BudgetTab
                pitchingId={pitchingId}
                estimatedIncome={data.estimated_income}
                estimatedExpense={data.estimated_expense}
                variant="bwf"
                onDataChanged={() => {
                  fetchBWFPitchingDetail(pitchingId).then((updated) => {
                    if (updated) setData(updated);
                  });
                  fetchBWFPitchingCostStructure(pitchingId).then(setCostRows);
                }}
              />
            )}

            {/* ═══ QUOTE TAB (Furniture 1000 bwf_quote) ═══ */}
            {activeTab === "quotation" && (
              <p className="text-sm text-slate-500">Furniture quote sync is not available in this demo.</p>
            )}

            {/* ═══ INTERNAL COMMENT TAB ═══ */}
            {activeTab === "internal-comment" && (
              <InternalCommentPanel
                pitchingId={pitchingId}
                permissionModule="proposals.internal-comment"
                variant="bwf"
              />
            )}

            {/* ═══ BUILDING COMMENT TAB ═══ */}
            {activeTab === "building-comment" && (
              <BuildingCommentPanel
                buildingId={data.r_building_id}
                buildingName={data.building_name}
                context={{ type: "bwf_pitching", id: pitchingId }}
                permissionModule="proposals.building-comment"
              />
            )}

            {/* ═══ MAN HOUR TAB ═══ */}
            {activeTab === "manhour" && (
              <ManHourPanel projectId={pitchingId} mode="pitching" />
            )}

            {activeTab === "customer-documents" && (
              <CustomerDocumentsPanel
                customerId={data.customer_id}
                permissionModule="clients"
                emptyWithoutCustomerMessage="此提案尚未連結客戶，無法管理客戶文件。"
              />
            )}
          </>
        )}
      </div>

      <BWFPitchingDialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        onSaved={loadData}
        editData={data}
      />

      <BWFConvertDialog
        open={showStageDialog}
        onOpenChange={setShowStageDialog}
        data={data}
        pitchingId={pitchingId}
        advancingStage={advancingStage}
        onConfirm={handleAdvanceStage}
        onDataChanged={loadData}
      />

      <BWFOrderDialog
        open={showOrderDialog}
        orderId={editingOrderId}
        onClose={() => {
          setShowOrderDialog(false);
          setEditingOrderId(null);
        }}
        onSaved={reloadOrders}
        defaultPitchingId={pitchingId}
        defaultPitchingLabel={data.pitching_code || data.description || undefined}
        lockPitching
        defaultProjectId={linkedProjectId || undefined}
        lockProject={!!linkedProjectId}
      />

      <AlertDialog open={showCaseClosedDialog} onOpenChange={setShowCaseClosedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>結案 Case Closed</AlertDialogTitle>
            <AlertDialogDescription>
              確定要將此提案標記為 Case Closed 嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closingCase}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCaseClosed}
              disabled={closingCase}
              className="bg-red-600 hover:bg-red-700"
            >
              {closingCase ? <Loader2 className="w-4 h-4 animate-spin" /> : "確認結案"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRecoverDialog} onOpenChange={setShowRecoverDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recover Pitching</AlertDialogTitle>
            <AlertDialogDescription>
              確定要將此提案恢復至 Enquiry 階段嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={recoveringCase}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleRecoverPitching} disabled={recoveringCase}>
              {recoveringCase ? <Loader2 className="w-4 h-4 animate-spin" /> : "確認恢復"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
