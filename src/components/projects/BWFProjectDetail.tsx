"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { handleNavClick } from "@/lib/nav-click";
import {
  ArrowLeft,
  Loader2,
  Building2,
  Calendar,
  Pencil,
  ExternalLink,
  FolderOpen,
  User,
  Phone,
  Mail,
  AlertTriangle,
  ChevronRight,
  ClipboardList,
  MessageSquare,
  MessageCircle,
  Clock,
  MoreHorizontal,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarDays,
  CreditCard,
  Trash2,
  DollarSign,
  FileText,
  Settings2,
  BarChart3,
} from "lucide-react";
import { AsanaIcon } from "@/components/ui/asana-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  fetchBWFProjectDetail,
  fetchBWFProjectCostStructure,
  fetchBWFProjectOrders,
  fetchWorkingSchedules,
  fetchPaymentSchedules,
  analyzeBWFCascadeDelete,
  executeBWFCascadeDelete,
  updateBWFProject,
  type BWFProjectDetailData,
  type BWFCostStructureRow,
  type BWFOrderRow,
  type ProjectScheduleRow,
} from "@/lib/data-service";
import SitePhotosGallery from "@/components/ui/site-photos-gallery";
import { usePermission } from "@/hooks/use-permission";
import { useAuth } from "@/hooks/use-auth";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { formatDate } from "@/lib/date-utils";
import { PROJECT_STATUS_OPTIONS } from "@/lib/project-status-rules";
import { ProjectStatusBadge } from "@/components/ui/entity-status-badges";
import ProjectInternalCommentPanel from "@/components/projects/ProjectInternalCommentPanel";
import SupplierCommentPanel from "@/components/projects/SupplierCommentPanel";
import BuildingCommentPanel from "@/components/projects/BuildingCommentPanel";
import ManHourPanel from "@/components/projects/ManHourPanel";
import ProjectFinancePanels, {
  type ProjectFinancePanelsHandle,
} from "@/components/projects/ProjectFinancePanels";
import SchedulePanel from "@/components/projects/SchedulePanel";
import PaymentSchedulePanel from "@/components/projects/PaymentSchedulePanel";
import ProjectCollaboratorPanel from "@/components/projects/ProjectCollaboratorPanel";
import BWFProjectEditDialog from "@/components/projects/BWFProjectEditDialog";
import BWFOrderDialog, { getOrderStatusChinese } from "@/components/projects/BWFOrderDialog";
import { BWFOrderEditButton } from "@/components/projects/BWFOrderEditButton";
import BWFBulkAssignInitialDateDialog from "@/components/projects/BWFBulkAssignInitialDateDialog";
import ProjectCascadeDeleteDialog from "@/components/projects/ProjectCascadeDeleteDialog";
import FinancialEditDialog from "@/components/projects/FinancialEditDialog";
import CustomerDocumentsPanel from "@/components/clients/CustomerDocumentsPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface BWFProjectDetailProps {
  projectId: string;
}

const supabase = createClient();


function paymentBadge(status: string | null) {
  if (!status) return null;
  return <Badge variant="outline" className="text-[12px]">{status}</Badge>;
}

function MultiValueBadges({ value }: { value: string | null }) {
  if (!value) return <Badge variant="secondary" className="text-[12px] font-normal text-gray-400">Null</Badge>;
  const parts = value.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return <Badge variant="secondary" className="text-[12px] font-normal text-gray-400">Null</Badge>;
  return (
    <span className="flex flex-wrap gap-1">
      {parts.map((part) => (
        <Badge key={part} variant="secondary" className="text-[12px] font-normal">{part}</Badge>
      ))}
    </span>
  );
}

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
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-[14px] text-blue-600 hover:text-blue-700 hover:underline break-words inline-flex items-start gap-1">
          <span className="break-all">{value}</span>
          <ExternalLink className="w-3 h-3 flex-shrink-0 mt-1" />
        </a>
      ) : (
        <p className="text-[14px] text-gray-800 break-words">{value || <span className="text-gray-300">N/A</span>}</p>
      )}
    </div>
  );
}

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

function SectionCard({
  title,
  icon: Icon,
  iconColor = "text-blue-500",
  children,
  className = "",
  action,
}: {
  title: string;
  icon: React.ElementType;
  iconColor?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className={`border border-gray-100 shadow-sm ${className}`}>
      <CardHeader className="pb-1 pt-4 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
          <div className="w-6 h-6 rounded-md flex items-center justify-center bg-gray-50">
            <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
          </div>
          {title}
          {action && <span className="ml-auto">{action}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-1">
        <Separator className="mb-2" />
        {children}
      </CardContent>
    </Card>
  );
}

function CostStructurePie({
  data,
  colors,
  total,
}: {
  data: { name: string; value: number }[];
  colors: string[];
  total: number;
}) {
  const { formatMoney2 } = useFinancialFormat();
  const fmtPie = (val: number) => formatMoney2(val, { fallback: "N/A" });

  return (
    <div className="w-full">
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={data.length > 1 ? 2 : 0}
              dataKey="value"
              stroke="none"
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={total === 0 ? "#E5E7EB" : colors[index % colors.length]}
                />
              ))}
            </Pie>
            {total > 0 && (
              <RechartsTooltip
                formatter={(value: number, name: string) => [fmtPie(value), name]}
                contentStyle={{
                  fontSize: "12px",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center mt-1">
        <p className="text-xs text-gray-400">Total</p>
        <p className={`text-base font-bold font-mono-num ${total > 0 ? "text-gray-900" : "text-gray-300"}`}>
          {fmtPie(total)}
        </p>
      </div>
      {total > 0 && data.length > 1 && (
        <div className="mt-3 space-y-1.5 px-2">
          {data.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: colors[idx % colors.length] }}
                />
                <span className="text-gray-600 truncate max-w-[140px]">{item.name}</span>
              </div>
              <span className="font-mono text-gray-800">{fmtPie(item.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function daysRemainingBadge(days: number | null) {
  if (days === null) return <Badge variant="outline" className="text-[12px] text-gray-400">—</Badge>;
  if (days < 0) return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[12px]">{Math.abs(days)} Days Ago</Badge>;
  if (days <= 14) return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[12px]">{days} Days</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 text-[12px]">{days} Days</Badge>;
}

function ScheduleMiniTable({
  rows,
  getLabel,
  emptyText,
}: {
  rows: ProjectScheduleRow[];
  getLabel: (row: ProjectScheduleRow) => string;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <p className="text-[14px] text-gray-400 text-center py-4">{emptyText}</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Schedule</TableHead>
          <TableHead className="text-right">Days Remaining</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.slice(0, 5).map((row) => (
          <TableRow key={row.id}>
            <TableCell className="text-[14px] font-mono">{formatDate(row.date)}</TableCell>
            <TableCell className="text-[14px]">{getLabel(row)}</TableCell>
            <TableCell className="text-right">{daysRemainingBadge(getDaysUntil(row.date))}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function BWFProjectDetail({ projectId }: BWFProjectDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canView, canViewSubmodule, canEdit, loading: permLoading } = usePermission();
  const { staff } = useAuth();
  const { formatMoney, formatMoney2 } = useFinancialFormat();
  const fmtCS = (val: number | null) => formatMoney2(val, { fallback: "N/A" });

  const initialTab = searchParams.get("tab") || "overview";
  const [data, setData] = useState<BWFProjectDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [costRows, setCostRows] = useState<BWFCostStructureRow[]>([]);
  const [orders, setOrders] = useState<BWFOrderRow[]>([]);
  const [workingSchedules, setWorkingSchedules] = useState<ProjectScheduleRow[]>([]);
  const [paymentSchedules, setPaymentSchedules] = useState<ProjectScheduleRow[]>([]);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showFinancialDialog, setShowFinancialDialog] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const financeOverviewRef = useRef<ProjectFinancePanelsHandle>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const result = await fetchBWFProjectDetail(projectId);
    setData(result);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!projectId) return;
    setSelectedOrderIds(new Set());
    fetchBWFProjectOrders(projectId).then(setOrders);
    fetchWorkingSchedules(projectId, "bwf_project").then(setWorkingSchedules);
    fetchPaymentSchedules(projectId, "bwf_project").then(setPaymentSchedules);
  }, [projectId]);

  const reloadOrders = useCallback(async () => {
    if (!projectId) return;
    const next = await fetchBWFProjectOrders(projectId);
    setOrders(next);
    setSelectedOrderIds((prev) => {
      const valid = new Set(next.map((o) => o.id));
      const kept = [...prev].filter((id) => valid.has(id));
      return kept.length === prev.size ? prev : new Set(kept);
    });
  }, [projectId]);

  const openNewOrderDialog = () => {
    setEditingOrderId(null);
    setShowOrderDialog(true);
  };

  const openEditOrderDialog = (orderId: string) => {
    setEditingOrderId(orderId);
    setShowOrderDialog(true);
  };

  const allOrdersSelected = orders.length > 0 && selectedOrderIds.size === orders.length;
  const someOrdersSelected = selectedOrderIds.size > 0 && !allOrdersSelected;

  const toggleOrderSelected = (orderId: string, checked: boolean) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(orderId);
      else next.delete(orderId);
      return next;
    });
  };

  const toggleAllOrdersSelected = (checked: boolean) => {
    if (checked) setSelectedOrderIds(new Set(orders.map((o) => o.id)));
    else setSelectedOrderIds(new Set());
  };

  const selectedOrders = orders.filter((o) => selectedOrderIds.has(o.id));

  useEffect(() => {
    if (!data) return;
    fetchBWFProjectCostStructure(projectId, data.pitching_id).then(setCostRows);
  }, [projectId, data?.pitching_id, data]);

  const incomes = data?.incomes || [];
  const expenses = data?.expenses || [];
  const totalIncome = incomes.reduce((s, i) => s + (i.amount || 0), 0);
  const totalExpense = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const estIncome = data?.estimated_income ?? null;
  const estExpense = data?.estimated_expense ?? null;
  const estGP = estIncome != null && estExpense != null ? estIncome - estExpense : null;
  const estGPRatio = estIncome != null && estIncome > 0 && estGP != null ? ((estGP / estIncome) * 100).toFixed(2) : null;
  const actualGP = totalIncome - totalExpense;
  const actualGPRatio = totalIncome > 0 ? ((actualGP / totalIncome) * 100).toFixed(2) : null;

  const staffRole = (staff as { role?: string } | null)?.role ?? null;
  const isSuperAdmin = staffRole === "Super Admin";
  const isAdminOrAbove = isSuperAdmin || staffRole === "Admin";
  const canUpdateStatus = isAdminOrAbove;
  // BWF does not use BWA Expense Control / WIP cheque lock — CRUD is gated only by
  // permission_assignments (projects.expense via ProjectFinancePanels + tab canView).

  const handleStatusUpdate = async (newStatus: string) => {
    if (!data || !canUpdateStatus) return;
    setStatusUpdating(true);
    const { error } = await supabase
      .from("bwf_projects")
      .update({ status: newStatus })
      .eq("id", projectId);
    if (error) {
      console.error("[BWFProjectDetail] Status update failed:", error.message);
    } else {
      setData({ ...data, status: newStatus });
    }
    setStatusUpdating(false);
    setShowStatusDialog(false);
  };

  const tabPermissionModule: Record<string, string> = {
    overview: "projects.overview",
    quotation: "proposals.quotation",
    income: "projects.income",
    expense: "projects.expense",
    "cost-structure": "projects.cost-structure",
    "work-schedule": "projects.work-schedule",
    "payment-schedule": "projects.payment-schedule",
    "supplier-comment": "projects.supplier-comment",
    "building-comment": "projects.building-comment",
    "internal-comment": "projects.internal-review",
    manhour: "projects.manhour",
  };
  const canViewTab = (tabId: string) => {
    if (permLoading) return true;
    if (!canView("bwf/projects")) return false;
    const mod = tabPermissionModule[tabId];
    if (!mod) return true;
    return canViewSubmodule(mod);
  };

  // Two-row layout matching BWA: 項目資料 / 財務資料 + 項目評論
  const projectTabs = [
    { id: "overview", label: "Overview", icon: ClipboardList },
    { id: "quotation", label: "Quote", icon: FileText },
    { id: "work-schedule", label: "Work Schedule", icon: CalendarDays },
    { id: "manhour", label: "Man Hour", icon: Clock },
    { id: "customer-documents", label: "客戶文件", icon: FileText },
  ].filter((t) => canViewTab(t.id));
  const financeTabs = [
    { id: "income", label: "Income", icon: ArrowDownCircle },
    { id: "expense", label: "Expense", icon: ArrowUpCircle },
    { id: "cost-structure", label: "Cost Structure", icon: BarChart3 },
    { id: "payment-schedule", label: "Payment Schedule", icon: CreditCard },
  ].filter((t) => canViewTab(t.id));
  const commentTabs = [
    { id: "supplier-comment", label: "Supplier Comment", icon: MessageCircle },
    { id: "building-comment", label: "Building Comment", icon: Building2 },
    { id: "internal-comment", label: "Internal Comment", icon: MessageSquare },
  ].filter((t) => canViewTab(t.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-sm text-gray-400">載入項目資料...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <AlertTriangle className="w-8 h-8 text-gray-300" />
        <p className="text-sm text-gray-500">找不到此項目</p>
        <Button variant="outline" size="sm" onClick={(e) => handleNavClick("/bwf/projects", e, (href) => router.push(href))}>
          <ArrowLeft className="w-4 h-4 mr-1" /> 返回項目列表
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-0 w-full">
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
        <button onClick={(e) => handleNavClick("/bwf/projects", e, (href) => router.push(href))} className="hover:text-gray-600 transition-colors">項目管理</button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-600 font-medium">{data.project_code || data.project_name || "項目詳情"}</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <div className="h-1 bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-300" />
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <button onClick={(e) => handleNavClick("/bwf/projects", e, (href) => router.push(href))} className="mt-1 w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
                <ArrowLeft className="w-4 h-4 text-gray-500" />
              </button>
              <div>
                <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                  <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                    Project: {data.project_code || data.project_name || "未命名項目"}
                  </h1>
                  {data.p2_code && (
                    <Badge className="bg-blue-500 text-white hover:bg-blue-500 text-[12px] px-2 py-0 font-bold rounded-md">{data.p2_code}</Badge>
                  )}
                  <Badge className="bg-yellow-500 text-white hover:bg-yellow-500 text-[12px] px-2 py-0 font-bold rounded-md">BWF</Badge>
                  {canUpdateStatus ? (
                    <button
                      type="button"
                      onClick={() => setShowStatusDialog(true)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      title="點擊更改狀態"
                    >
                      <ProjectStatusBadge status={data.status} className="text-xs" />
                    </button>
                  ) : (
                    <ProjectStatusBadge status={data.status} className="text-xs" />
                  )}
                  {paymentBadge(data.payment_status)}
                </div>
                <p className="text-[15px] text-gray-600 mb-1">
                  {data.real_customer_display_name || data.customer_name || data.project_name}
                </p>
                <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                  {data.pm_name && <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{data.pm_name}</span>}
                  {data.signed_date && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />簽約 {formatDate(data.signed_date)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider delayDuration={200}>
                {data.asana_link && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a href={data.asana_link} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
                        <AsanaIcon size={20} />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent><p className="text-xs">開啟 Asana</p></TooltipContent>
                  </Tooltip>
                )}
                {data.working_folder && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a href={data.working_folder} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
                        <FolderOpen className="w-4 h-4 text-gray-500" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent><p className="text-xs">工作資料夾</p></TooltipContent>
                  </Tooltip>
                )}
              </TooltipProvider>
              <Separator orientation="vertical" className="h-6 mx-1" />
              <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setShowEditDialog(true)}>
                <Pencil className="w-4 h-4" /> Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-9 p-0">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {canUpdateStatus && (
                    <>
                      <DropdownMenuItem
                        className="gap-2 text-[15px]"
                        onClick={() => setShowStatusDialog(true)}
                      >
                        <ClipboardList className="w-3.5 h-3.5" /> 更改狀態
                      </DropdownMenuItem>
                    </>
                  )}
                  {/* 編輯財務 — Super Admin / Admin only */}
                  {isAdminOrAbove && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 text-[15px]"
                        onClick={() => setShowFinancialDialog(true)}
                      >
                        <DollarSign className="w-3.5 h-3.5" /> 編輯財務
                      </DropdownMenuItem>
                    </>
                  )}
                  {isSuperAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 text-[15px] text-red-600 focus:text-red-600"
                        onClick={() => setShowDeleteDialog(true)}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> 刪除項目
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        {/* ─── TAB NAVIGATION — Two-row layout ──── */}
        <div className="px-6 border-t border-gray-100">
          {/* Row 1: 項目資料 Project Info */}
          <div className="relative">
            <div className="flex items-center gap-0 overflow-x-auto max-w-full" style={{ scrollbarWidth: "none" }}>
              <span className="text-[12px] text-blue-500 uppercase tracking-wider font-semibold mr-2 flex-shrink-0 py-2.5">項目資料</span>
              {projectTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      relative flex items-center gap-1.5 px-3 py-2.5 text-[14px] font-medium transition-colors whitespace-nowrap flex-shrink-0
                      ${isActive ? "text-blue-600" : "text-gray-400 hover:text-gray-600"}
                    `}
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
          {/* Row 2: 財務資料 + 項目評論 — wrap on tablet so labels never collide */}
          <div className="relative border-t border-gray-50">
            <div className="flex flex-wrap items-center gap-x-4 -mb-px">
              <div className="flex items-center gap-0 overflow-x-auto max-w-full" style={{ scrollbarWidth: "none" }}>
                <span className="text-[12px] text-amber-400 uppercase tracking-wider font-semibold mr-2 flex-shrink-0 py-2.5">財務資料</span>
                {financeTabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        relative flex items-center gap-1.5 px-3 py-2.5 text-[14px] font-medium transition-colors whitespace-nowrap flex-shrink-0
                        ${isActive ? "text-amber-600" : "text-gray-400 hover:text-gray-600"}
                      `}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      {tab.label}
                      {isActive && (
                        <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-amber-500 rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>
              {commentTabs.length > 0 && (
                <div className="flex items-center gap-0 overflow-x-auto max-w-full xl:ml-auto" style={{ scrollbarWidth: "none" }}>
                  <span className="text-[12px] text-violet-500 uppercase tracking-wider font-semibold mr-2 flex-shrink-0 py-2.5">項目評論</span>
                  {commentTabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                          relative flex items-center gap-1.5 px-3 py-2.5 text-[14px] font-medium transition-colors whitespace-nowrap flex-shrink-0
                          ${isActive ? "text-violet-600" : "text-gray-400 hover:text-gray-600"}
                        `}
                      >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                        {isActive && (
                          <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-violet-500 rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="animate-fade-in-up pt-6">
        {!canViewTab(activeTab) ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm text-gray-500 font-medium">您沒有查看此分頁的權限</p>
          </div>
        ) : (
          <>
            {activeTab === "overview" && (
              <div className="space-y-6">
                <SitePhotosGallery
                  rawPhotos={data.completion_photos}
                  persistPhotos={(serialized) =>
                    updateBWFProject(projectId, {
                      completion_photos: serialized,
                      modified_date: new Date().toISOString(),
                    })
                  }
                  bucket="completion-photos"
                  pathPrefix={projectId}
                  editable={canEdit("projects.overview")}
                  title="完工相片 Completion Photos"
                  photoLabel="完工相片"
                  onSaved={() => {
                    fetchBWFProjectDetail(projectId).then((result) => {
                      if (result) setData(result);
                    });
                  }}
                />

                <PanelCard titleZh="基本資訊" titleEn="General Information">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-6">
                    <InfoField labelZh="客戶" labelEn="Customer" value={data.customer_display_name || data.customer_name} />
                    <InfoField labelZh="主要聯絡人" labelEn="Main Contact" value={data.customer_raw_name || data.customer_name} />
                    <InfoField labelZh="項目經理" labelEn="Project Manager" value={data.pm_name} />
                    <InfoField labelZh="查詢日期" labelEn="Enquiry Date" value={formatDate(data.enquiry_date)} />
                    <InfoField labelZh="主要報價" labelEn="Major Quote" value={<MultiValueBadges value={data.major_quote_name} />} />
                    <InfoField labelZh="項目階段" labelEn="Project Stage" value={<ProjectStatusBadge status={data.status} className="text-xs" />} />
                    <InfoField labelZh="來源" labelEn="Source" value={data.source_name} />
                    <InfoField labelZh="客戶類型" labelEn="Customer Type" value={data.customer_type_name} />
                    <InfoField labelZh="服務類型" labelEn="Service Type" value={<MultiValueBadges value={data.service_type_name} />} />
                    <InfoField labelZh="服務事項" labelEn="Service Item" value={<MultiValueBadges value={data.service_item_name} />} />
                    <InfoField labelZh="大廈" labelEn="Building" value={data.building_name} />
                    <InfoField labelZh="財政年度" labelEn="Financial Year" value={data.financial_year_name} />
                    <InfoField labelZh="地區" labelEn="District" value={data.district_name} />
                    <InfoField labelZh="工程地址" labelEn="Site Address" value={data.site_address} />
                    <InfoField labelZh="規模" labelEn="Scale" value={data.size} />
                    <InfoField labelZh="平方尺" labelEn="Size" value={data.project_size} />
                    <InfoField labelZh="" labelEn="Asana" value={data.asana_link} isLink={!!data.asana_link} href={data.asana_link} />
                    <InfoField labelZh="" labelEn="Working Folder" value={data.working_folder} />
                  </div>
                </PanelCard>

                <PanelCard titleZh="財政" titleEn="Financials">
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div><p className="text-[12px] text-gray-400 mb-1"><span className="text-gray-500">預計收入</span> Estimated Income</p><p className="text-2xl font-bold text-emerald-600 font-mono-num">{formatMoney(estIncome)}</p></div>
                      <div><p className="text-[12px] text-gray-400 mb-1"><span className="text-gray-500">預計支出</span> Estimated Expense</p><p className="text-2xl font-bold text-red-600 font-mono-num">{formatMoney(estExpense)}</p></div>
                      <div><p className="text-[12px] text-gray-400 mb-1"><span className="text-gray-500">預計毛利</span> Estimated Gross Profit</p><p className="text-2xl font-bold text-blue-600 font-mono-num">{formatMoney(estGP)}</p></div>
                      <div><p className="text-[12px] text-gray-400 mb-1"><span className="text-gray-500">預計毛利率</span> Estimated Profit Margin</p><p className="text-2xl font-bold text-emerald-600 font-mono-num">{estGPRatio != null ? `${estGPRatio}%` : "-"}</p></div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div><p className="text-[12px] text-gray-400 mb-1"><span className="text-gray-500">實際收入</span> Actual Income</p><p className="text-2xl font-bold font-mono-num">{totalIncome > 0 ? formatMoney(totalIncome) : <span className="text-gray-400">N/A</span>}</p></div>
                      <div><p className="text-[12px] text-gray-400 mb-1"><span className="text-gray-500">實際支出</span> Actual Expense</p><p className="text-2xl font-bold font-mono-num">{totalExpense > 0 ? formatMoney(totalExpense) : <span className="text-gray-400">N/A</span>}</p></div>
                      <div><p className="text-[12px] text-gray-400 mb-1"><span className="text-gray-500">實際毛利</span> Actual Gross Profit</p><p className="text-2xl font-bold text-blue-600 font-mono-num">{formatMoney(actualGP)}</p></div>
                      <div><p className="text-[12px] text-gray-400 mb-1"><span className="text-gray-500">實際毛利率</span> Actual Profit Margin</p><p className="text-2xl font-bold font-mono-num">{actualGPRatio != null ? `${actualGPRatio}%` : "N/A"}</p></div>
                    </div>
                  </div>
                </PanelCard>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <PanelCard titleZh="客戶資訊" titleEn="Customer Information" action={data.customer_id ? (
                    <button className="text-blue-500 hover:text-blue-600" onClick={(e) => handleNavClick(`/clients/${data.customer_id}`, e, (href) => router.push(href))}><ExternalLink className="w-4 h-4" /></button>
                  ) : undefined}>
                    <div className="space-y-3">
                      <div><p className="text-[12px] text-gray-400 mb-0.5"><span className="text-gray-500">顯示名稱</span> Display Name</p><p className="text-[14px] text-gray-800">{data.customer_display_name || data.customer_name || <span className="text-gray-300">N/A</span>}</p></div>
                      <div><p className="text-[12px] text-gray-400 mb-0.5"><span className="text-gray-500">公司名稱</span> Company Name</p><p className="text-[14px] text-gray-800">{data.customer_raw_company || <span className="text-gray-300">N/A</span>}</p></div>
                      <div><p className="text-[12px] text-gray-400 mb-0.5"><span className="text-gray-500">聯絡電話</span> Contact Number</p><p className="text-[14px] text-gray-800 flex items-center gap-1.5">{data.customer_phone ? (<><Phone className="w-3 h-3 text-gray-400" />{data.customer_phone}</>) : <span className="text-gray-300">N/A</span>}</p></div>
                      {data.customer_email && <div><p className="text-[12px] text-gray-400 mb-0.5"><span className="text-gray-500">電郵</span> Email</p><p className="text-[14px] text-gray-800 flex items-center gap-1.5"><Mail className="w-3 h-3 text-gray-400" />{data.customer_email}</p></div>}
                      {data.customer_type_name && <div><p className="text-[12px] text-gray-400 mb-0.5"><span className="text-gray-500">客戶標籤</span> Customer Tags</p><Badge variant="secondary">{data.customer_type_name}</Badge></div>}
                    </div>
                  </PanelCard>

                  <PanelCard titleZh="成本結構" titleEn="Cost Structure">
                    <div className="space-y-4">
                      <div><p className="text-[12px] text-gray-400 mb-1"><span className="text-gray-500">預計收入</span> Estimated Income</p><p className="text-[15px] font-mono-num">{formatMoney(estIncome)}</p></div>
                      <div>
                        <p className="text-[12px] text-gray-400 mb-2"><span className="text-gray-500">預計支出</span> Estimated Expense</p>
                        {costRows.length === 0 ? <p className="text-[13px] text-gray-300">暫無支出項目</p> : (
                          <div className="space-y-1.5">
                            {costRows.map((row) => (
                              <div key={row.id} className="flex items-center justify-between text-[14px]">
                                <span className="text-gray-700 truncate pr-2">{row.expense_type_name || "未分類"}</span>
                                <span className="text-gray-800 font-mono-num flex-shrink-0">{formatMoney(row.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </PanelCard>

                  <PanelCard titleZh="協作者" titleEn="Collaborator">
                    <ProjectCollaboratorPanel
                      entityType="bwf"
                      projectId={projectId}
                      mainPmId={data.main_pm_id}
                      mainPmName={data.pm_name}
                      mainDesignerId={data.main_designer_id}
                      mainDesignerName={data.designer_name}
                      nTeamTypeId={data.n_team_type_id}
                      onProjectReload={loadData}
                    />
                  </PanelCard>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="min-w-0">
                    <PanelCard
                      titleZh="收入"
                      titleEn={`Income (${incomes.length})`}
                      action={
                        <div className="flex gap-2">
                          <Button size="sm" className="h-8 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setActiveTab("income")}>
                            <Plus className="w-3.5 h-3.5" /> 新增收入
                          </Button>
                        </div>
                      }
                    >
                      <ProjectFinancePanels
                        projectId={projectId}
                        entityType="bwf_project"
                        data={{
                          estimated_income: data.estimated_income,
                          estimated_expense: data.estimated_expense,
                          income_below_estimated_reason: data.income_below_estimated_reason,
                          main_contractor_id: data.main_contractor_id,
                          main_contractor_name: data.main_contractor_name,
                          incomes: data.incomes || [],
                          expenses: data.expenses || [],
                        }}
                        view="overview-income"
                        onReload={loadData}
                        onViewAll={setActiveTab}
                      />
                    </PanelCard>
                  </div>

                  <div className="min-w-0">
                    <PanelCard
                      titleZh="支出"
                      titleEn={`Expense (${expenses.length})`}
                      action={
                        <div className="flex gap-2">
                          <Button size="sm" className="h-8 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setActiveTab("expense")}>
                            <Plus className="w-3.5 h-3.5" /> 新增支出
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => financeOverviewRef.current?.openCreateExpense(undefined, undefined, "factory")}>
                            <Plus className="w-3.5 h-3.5" /> 工廠支出
                          </Button>
                        </div>
                      }
                    >
                      <ProjectFinancePanels
                        ref={financeOverviewRef}
                        projectId={projectId}
                        entityType="bwf_project"
                        data={{
                          estimated_income: data.estimated_income,
                          estimated_expense: data.estimated_expense,
                          income_below_estimated_reason: data.income_below_estimated_reason,
                          main_contractor_id: data.main_contractor_id,
                          main_contractor_name: data.main_contractor_name,
                          incomes: data.incomes || [],
                          expenses: data.expenses || [],
                        }}
                        view="overview-expense"
                        onReload={loadData}
                        onViewAll={setActiveTab}
                      />
                    </PanelCard>
                  </div>
                </div>

                <PanelCard
                  titleZh="訂單"
                  titleEn={`Order Product (${orders.length})`}
                  action={
                    <div className="flex items-center gap-2">
                      {selectedOrderIds.size > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
                          onClick={() => setShowBulkAssignDialog(true)}
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                          批量設定 ({selectedOrderIds.size})
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={openNewOrderDialog}
                      >
                        <Plus className="w-3.5 h-3.5" /> New Order
                      </Button>
                    </div>
                  }
                >
                  {orders.length === 0 ? (
                    <p className="text-[14px] text-gray-400 text-center py-6">No orders match this criteria.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={allOrdersSelected ? true : someOrdersSelected ? "indeterminate" : false}
                              onCheckedChange={(v) => toggleAllOrdersSelected(v === true)}
                              aria-label="全選訂單"
                            />
                          </TableHead>
                          <TableHead>Product Type</TableHead>
                          <TableHead>Product Name</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Created By</TableHead>
                          <TableHead>Factory</TableHead>
                          <TableHead>Pred. Start</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((o) => {
                          const isSelected = selectedOrderIds.has(o.id);
                          return (
                            <TableRow
                              key={o.id}
                              className={cn(
                                "cursor-pointer hover:bg-gray-50",
                                isSelected && "bg-blue-50/60 hover:bg-blue-50",
                              )}
                              onClick={() => openEditOrderDialog(o.id)}
                            >
                              <TableCell
                                className="w-10"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(v) => toggleOrderSelected(o.id, v === true)}
                                  aria-label={`選取 ${o.product_name || o.id}`}
                                />
                              </TableCell>
                              <TableCell className="text-[14px]">{o.product_type || "—"}</TableCell>
                              <TableCell className="text-[14px]">{o.product_name || "—"}</TableCell>
                              <TableCell className="text-[14px]">{o.quantity ?? "—"}</TableCell>
                              <TableCell className="text-[14px]">{o.created_by_name || "—"}</TableCell>
                              <TableCell className="text-[14px]">{o.factory_name || "—"}</TableCell>
                              <TableCell className="text-[14px]">{formatDate(o.production_start_date)}</TableCell>
                              <TableCell className="text-[14px]">{getOrderStatusChinese(o.order_status)}</TableCell>
                              <TableCell>
                                <BWFOrderEditButton onClick={() => openEditOrderDialog(o.id)} />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </PanelCard>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <PanelCard
                    titleZh="工程時間表"
                    titleEn={`Working Schedule (${workingSchedules.length})`}
                    action={<Button size="sm" className="h-8 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setActiveTab("work-schedule")}><Plus className="w-3.5 h-3.5" /> New Schedule</Button>}
                  >
                    <ScheduleMiniTable rows={workingSchedules} getLabel={(row) => row.working_task_display || "—"} emptyText="No schedule records." />
                    {workingSchedules.length > 5 && (
                      <button className="text-[13px] text-blue-600 hover:underline mt-2" onClick={() => setActiveTab("work-schedule")}>View all schedules</button>
                    )}
                  </PanelCard>

                  <PanelCard titleZh="收款時間表" titleEn={`Payment Schedule (${paymentSchedules.length})`}>
                    <ScheduleMiniTable rows={paymentSchedules} getLabel={(row) => row.payment_task_display || "—"} emptyText="No payment schedule records." />
                    {paymentSchedules.length > 5 && (
                      <button className="text-[13px] text-blue-600 hover:underline mt-2" onClick={() => setActiveTab("payment-schedule")}>View all payment schedules</button>
                    )}
                  </PanelCard>
                </div>

                <PanelCard titleZh="內部評價" titleEn="Internal Comment">
                  <ProjectInternalCommentPanel projectId={projectId} variant="bwf" permissionModule="projects.internal-review" />
                </PanelCard>
              </div>
            )}

            {activeTab === "quotation" && (
              <p className="text-sm text-slate-500">Furniture quote sync is not available in this demo.</p>
            )}

            {activeTab === "income" && (
              <ProjectFinancePanels
                projectId={projectId}
                entityType="bwf_project"
                data={{
                  estimated_income: data.estimated_income,
                  estimated_expense: data.estimated_expense,
                  income_below_estimated_reason: data.income_below_estimated_reason,
                  main_contractor_id: data.main_contractor_id,
                  main_contractor_name: data.main_contractor_name,
                  incomes: data.incomes || [],
                  expenses: data.expenses || [],
                }}
                view="income"
                onReload={loadData}
              />
            )}

            {activeTab === "expense" && (
              <ProjectFinancePanels
                projectId={projectId}
                entityType="bwf_project"
                data={{
                  estimated_income: data.estimated_income,
                  estimated_expense: data.estimated_expense,
                  income_below_estimated_reason: data.income_below_estimated_reason,
                  main_contractor_id: data.main_contractor_id,
                  main_contractor_name: data.main_contractor_name,
                  incomes: data.incomes || [],
                  expenses: data.expenses || [],
                }}
                view="expense"
                onReload={loadData}
              />
            )}

            {activeTab === "cost-structure" && (() => {
              const expenseRows = data.expenses || [];
              const quotExpenses = data.quotation_expenses || [];
              const projInitExpenses = data.project_initial_expenses || [];

              const l1CatMap = new Map<string, { name: string; amount: number }>();
              quotExpenses.forEach((q) => {
                const catName = q.expense_type_name || "其他 Other";
                if (!l1CatMap.has(catName)) l1CatMap.set(catName, { name: catName, amount: 0 });
                l1CatMap.get(catName)!.amount += q.amount || 0;
              });
              const l1Categories = Array.from(l1CatMap.values()).sort((a, b) => b.amount - a.amount);

              const l2CatMap = new Map<string, { name: string; amount: number }>();
              projInitExpenses.forEach((p) => {
                const catName = p.expense_type_name || "其他 Other";
                if (!l2CatMap.has(catName)) l2CatMap.set(catName, { name: catName, amount: 0 });
                l2CatMap.get(catName)!.amount += p.amount || 0;
              });
              const l2Categories = Array.from(l2CatMap.values()).sort((a, b) => b.amount - a.amount);

              const l3CatMap = new Map<string, { name: string; actual: number }>();
              expenseRows.forEach((e) => {
                const catName = e.supplier_type_name || e.contract_type_name || "其他 Other";
                if (!l3CatMap.has(catName)) l3CatMap.set(catName, { name: catName, actual: 0 });
                l3CatMap.get(catName)!.actual += e.amount || 0;
              });
              const l3Categories = Array.from(l3CatMap.values()).sort((a, b) => b.actual - a.actual);

              const allCatNames = new Set<string>();
              l1Categories.forEach((c) => allCatNames.add(c.name));
              l2Categories.forEach((c) => allCatNames.add(c.name));
              l3Categories.forEach((c) => allCatNames.add(c.name));

              const l1ByName = new Map(l1Categories.map((c) => [c.name, c.amount]));
              const l2ByName = new Map(l2Categories.map((c) => [c.name, c.amount]));
              const l3ByName = new Map(l3Categories.map((c) => [c.name, c.actual]));

              const mergedCategories = Array.from(allCatNames).map((name) => ({
                name,
                l1: l1ByName.get(name) || 0,
                l2: l2ByName.get(name) || 0,
                l3: l3ByName.get(name) || 0,
              })).sort((a, b) => (b.l1 + b.l2 + b.l3) - (a.l1 + a.l2 + a.l3));

              const l1QuotationRevenue = data.estimated_income || 0;
              const l1QuotationExpense = quotExpenses.reduce((s, q) => s + (q.amount || 0), 0);
              const l1GrossProfit = l1QuotationRevenue - l1QuotationExpense;

              const l2ForecastRevenue = l1QuotationRevenue;
              const l2ForecastExpense = projInitExpenses.reduce((s, p) => s + (p.amount || 0), 0);
              const l2GrossProfit = l2ForecastRevenue - l2ForecastExpense;

              const l3ActualRevenue = totalIncome;
              const l3ActualExpense = totalExpense;
              const l3GrossProfit = l3ActualRevenue - l3ActualExpense;

              const PIE_COLORS = ["#93C5FD", "#60A5FA", "#3B82F6", "#2563EB", "#1D4ED8", "#A78BFA", "#818CF8", "#6366F1", "#4F46E5", "#C4B5FD"];

              const quotationPieData = l1Categories.length > 0
                ? l1Categories.map((c) => ({ name: c.name, value: c.amount }))
                : [{ name: "N/A", value: 1 }];
              const initialPieData = l2Categories.length > 0
                ? l2Categories.map((c) => ({ name: c.name, value: c.amount }))
                : [{ name: "N/A", value: 1 }];
              const actualPieData = l3Categories.length > 0
                ? l3Categories.map((c) => ({ name: c.name, value: c.actual }))
                : [{ name: "N/A", value: 1 }];

              return (
                <div className="space-y-6">
                  <SectionCard title="成本結構" icon={BarChart3} iconColor="text-violet-500">
                    <p className="text-xs text-gray-400 mb-1">項目成本結構分析與對比</p>
                    <p className="text-xs text-gray-400 mb-5">
                      L1 = 報價支出 (quotation_expenses) · L2 = 項目初始費用 (project_initial_expenses) · L3 = 實際支出 (expenses)
                    </p>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[40%]">Type</th>
                            <th className="text-right py-2.5 px-3 text-xs font-semibold text-blue-500 uppercase tracking-wide">
                              L1 Quotation
                              <span className="block text-[12px] font-normal text-gray-400 normal-case">報價支出</span>
                            </th>
                            <th className="text-right py-2.5 px-3 text-xs font-semibold text-violet-500 uppercase tracking-wide">
                              L2 Forecast
                              <span className="block text-[12px] font-normal text-gray-400 normal-case">項目初始費用</span>
                            </th>
                            <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              L3 Actual
                              <span className="block text-[12px] font-normal text-gray-400 normal-case">實際支出</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-gray-100 bg-blue-50/30">
                            <td className="py-3 px-3 font-semibold text-blue-600">Total Revenue 總營收</td>
                            <td className="py-3 px-3 text-right font-mono font-semibold text-gray-900">{fmtCS(l1QuotationRevenue)}</td>
                            <td className="py-3 px-3 text-right font-mono font-semibold text-violet-600">{fmtCS(l2ForecastRevenue)}</td>
                            <td className="py-3 px-3 text-right font-mono font-semibold text-gray-900">{fmtCS(l3ActualRevenue)}</td>
                          </tr>

                          {mergedCategories.length > 0 ? mergedCategories.map((cat, idx) => (
                            <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                              <td className="py-2.5 px-3 text-gray-600">
                                <span className="text-gray-400 mr-1">(-)</span> {cat.name}
                              </td>
                              <td className={`py-2.5 px-3 text-right font-mono ${cat.l1 > 0 ? "text-gray-800" : "text-gray-300"}`}>
                                {cat.l1 > 0 ? fmtCS(cat.l1) : "—"}
                              </td>
                              <td className={`py-2.5 px-3 text-right font-mono ${cat.l2 > 0 ? "text-violet-700" : "text-gray-300"}`}>
                                {cat.l2 > 0 ? fmtCS(cat.l2) : "—"}
                              </td>
                              <td className={`py-2.5 px-3 text-right font-mono ${cat.l3 > 0 ? "text-gray-800" : "text-gray-300"}`}>
                                {cat.l3 > 0 ? fmtCS(cat.l3) : "—"}
                              </td>
                            </tr>
                          )) : (
                            <tr className="border-b border-gray-50">
                              <td className="py-2.5 px-3 text-gray-400 italic" colSpan={4}>暫無支出分類記錄</td>
                            </tr>
                          )}

                          <tr className="border-b border-gray-200 bg-red-50/30">
                            <td className="py-3 px-3 font-semibold text-red-600">- Total Expense 總支出</td>
                            <td className="py-3 px-3 text-right font-mono font-semibold text-gray-900">{fmtCS(l1QuotationExpense)}</td>
                            <td className="py-3 px-3 text-right font-mono font-semibold text-violet-600">{fmtCS(l2ForecastExpense)}</td>
                            <td className="py-3 px-3 text-right font-mono font-semibold text-gray-900">{fmtCS(l3ActualExpense)}</td>
                          </tr>

                          <tr className="bg-emerald-50/30">
                            <td className="py-3 px-3 font-bold text-emerald-600">= Gross Profit 毛利</td>
                            <td className={`py-3 px-3 text-right font-mono font-bold ${l1GrossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmtCS(l1GrossProfit)}</td>
                            <td className={`py-3 px-3 text-right font-mono font-bold ${l2GrossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmtCS(l2GrossProfit)}</td>
                            <td className={`py-3 px-3 text-right font-mono font-bold ${l3GrossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmtCS(l3GrossProfit)}</td>
                          </tr>

                          <tr className="bg-gray-50/50">
                            <td className="py-2 px-3 text-xs text-gray-500">Gross Margin % 毛利率</td>
                            <td className="py-2 px-3 text-right font-mono text-xs text-gray-600">
                              {l1QuotationRevenue > 0 ? `${((l1GrossProfit / l1QuotationRevenue) * 100).toFixed(1)}%` : "N/A"}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-xs text-violet-600">
                              {l2ForecastRevenue > 0 ? `${((l2GrossProfit / l2ForecastRevenue) * 100).toFixed(1)}%` : "N/A"}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-xs text-gray-600">
                              {l3ActualRevenue > 0 ? `${((l3GrossProfit / l3ActualRevenue) * 100).toFixed(1)}%` : "N/A"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="flex gap-4 mt-3 text-[12px] text-gray-400">
                      <span>L1: {quotExpenses.length} 筆報價支出</span>
                      <span>L2: {projInitExpenses.length} 筆初始費用</span>
                      <span>L3: {expenseRows.length} 筆實際支出</span>
                    </div>
                  </SectionCard>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border border-gray-100 shadow-sm">
                      <CardHeader className="pb-2 pt-4 px-5">
                        <CardTitle className="text-sm font-semibold text-gray-700 text-center">
                          L1 Quotation Expense
                          <span className="block text-[12px] font-normal text-gray-400">報價支出</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-5 pb-4 flex flex-col items-center">
                        <CostStructurePie data={quotationPieData} colors={PIE_COLORS} total={l1QuotationExpense} />
                      </CardContent>
                    </Card>

                    <Card className="border border-gray-100 shadow-sm">
                      <CardHeader className="pb-2 pt-4 px-5">
                        <CardTitle className="text-sm font-semibold text-gray-700 text-center">
                          L2 Project Initial Expense
                          <span className="block text-[12px] font-normal text-gray-400">項目初始費用</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-5 pb-4 flex flex-col items-center">
                        <CostStructurePie data={initialPieData} colors={PIE_COLORS} total={l2ForecastExpense} />
                      </CardContent>
                    </Card>

                    <Card className="border border-gray-100 shadow-sm">
                      <CardHeader className="pb-2 pt-4 px-5">
                        <CardTitle className="text-sm font-semibold text-gray-700 text-center">
                          L3 Actual Expense
                          <span className="block text-[12px] font-normal text-gray-400">實際支出</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-5 pb-4 flex flex-col items-center">
                        <CostStructurePie data={actualPieData} colors={PIE_COLORS} total={l3ActualExpense} />
                      </CardContent>
                    </Card>
                  </div>
                </div>
              );
            })()}

            {activeTab === "work-schedule" && (
              <SchedulePanel
                projectId={projectId}
                entityType="bwf_project"
                mode="working"
                projectCode={data.project_code || undefined}
                permissionModule="projects.work-schedule"
              />
            )}

            {activeTab === "payment-schedule" && (
              <PaymentSchedulePanel
                incomes={data.incomes || []}
                estimatedIncome={data.estimated_income}
                projectCode={data.project_code || undefined}
                projectName={data.project_name || data.customer_display_name || undefined}
                customerName={data.customer_display_name || data.customer_name || undefined}
                customerAddress={data.customer_address || data.site_address || undefined}
                pmName={data.pm_name || undefined}
                permissionModule="projects.payment-schedule"
                onIncomeClick={(incomeId) => {
                  router.push(`/bwf/projects/${projectId}/invoice/${incomeId}`);
                }}
              />
            )}

            {activeTab === "supplier-comment" && (
              <SupplierCommentPanel
                projectId={projectId}
                variant="bwf"
                permissionModule="projects.supplier-comment"
              />
            )}

            {activeTab === "building-comment" && (
              <BuildingCommentPanel
                buildingId={data.r_building_id}
                buildingName={data.building_name}
                context={{ type: "bwf_project", id: projectId }}
                permissionModule="projects.building-comment"
              />
            )}

            {activeTab === "internal-comment" && (
              <ProjectInternalCommentPanel projectId={projectId} variant="bwf" permissionModule="projects.internal-review" />
            )}

            {activeTab === "manhour" && (
              <ManHourPanel projectId={projectId} mode="project" permissionModule="projects.manhour" />
            )}

            {activeTab === "customer-documents" && (
              <CustomerDocumentsPanel
                customerId={data.customer_id}
                permissionModule="clients"
                emptyWithoutCustomerMessage="此項目尚未連結客戶，無法管理客戶文件。"
              />
            )}
          </>
        )}
      </div>

      <BWFProjectEditDialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        onSaved={loadData}
        editData={data}
      />

      {/* ─── EDIT FINANCIALS DIALOG (Super Admin / Admin only) ── */}
      {data && isAdminOrAbove && (
        <FinancialEditDialog
          open={showFinancialDialog}
          onOpenChange={setShowFinancialDialog}
          projectId={data.id}
          pitchingId={data.pitching_id || null}
          projectEstIncome={data.estimated_income ?? null}
          entityType="bwf_project"
          onSaved={() => loadData()}
        />
      )}

      <BWFOrderDialog
        open={showOrderDialog}
        onClose={() => {
          setShowOrderDialog(false);
          setEditingOrderId(null);
        }}
        onSaved={reloadOrders}
        orderId={editingOrderId}
        defaultProjectId={projectId}
        defaultProjectLabel={data.project_code || data.project_name || undefined}
        lockProject
        defaultPitchingId={data.pitching_id || undefined}
        lockPitching={!!data.pitching_id}
      />

      <BWFBulkAssignInitialDateDialog
        open={showBulkAssignDialog}
        orders={selectedOrders}
        onClose={() => setShowBulkAssignDialog(false)}
        onSaved={async () => {
          await reloadOrders();
          setSelectedOrderIds(new Set());
        }}
      />

      <ProjectCascadeDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        projectId={projectId}
        projectCode={data.project_code}
        listRedirectPath="/bwf/projects"
        analyze={analyzeBWFCascadeDelete}
        execute={executeBWFCascadeDelete}
      />

      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <ClipboardList className="w-5 h-5" /> 更改項目狀態
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <p className="text-sm text-gray-500 mb-4">
              當前狀態：<ProjectStatusBadge status={data?.status || null} className="text-xs" />
            </p>
            <div className="space-y-2">
              {PROJECT_STATUS_OPTIONS.map((opt) => {
                const isCurrentStatus = data?.status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={isCurrentStatus || statusUpdating}
                    onClick={() => handleStatusUpdate(opt.value)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-lg border transition-all",
                      isCurrentStatus
                        ? "border-blue-300 bg-blue-50 cursor-default"
                        : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer",
                      statusUpdating && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-800">{opt.labelZh}</span>
                        <span className="text-xs text-gray-400 ml-2">{opt.value}</span>
                      </div>
                      {isCurrentStatus && (
                        <Badge className="bg-blue-500 text-white text-[12px] px-2 py-0">當前</Badge>
                      )}
                    </div>
                    {"description" in opt && opt.description && (
                      <p className="text-[13px] text-gray-400 mt-1">{opt.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={cn("text-[12px] font-medium px-1.5 py-0.5 rounded", opt.countMoney ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400")}>
                        {opt.countMoney ? "✓ 計錢" : "✗ 不計錢"}
                      </span>
                      <span className={cn("text-[12px] font-medium px-1.5 py-0.5 rounded", opt.countProject ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400")}>
                        {opt.countProject ? "✓ 計隻數" : "✗ 不計隻數"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)} disabled={statusUpdating}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
