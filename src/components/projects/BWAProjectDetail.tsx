"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  Trash2,
  ExternalLink,
  FolderOpen,
  User,
  Palette,
  Briefcase,
  Tag,
  Phone,
  Mail,
  FileText,
  AlertTriangle,

  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ClipboardList,
  Gavel,
  CalendarDays,
  HardHat,
  Clock,
  Box,
  ImageIcon,
  MoreHorizontal,
  CreditCard,
  Shield,
  Wrench,
  Wind,
  Wifi,
  Receipt,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  MessageCircle,
  Save,
  X,
  Plus,
  Eye,
  Paperclip,
  Upload,
  ChevronsUpDown,
  Check,
  Search,
  UserPlus,
  ClipboardCheck,
} from "lucide-react";
import { AsanaIcon } from "@/components/ui/asana-icon";
import { resolveOsScheduleGroup } from "@/lib/os-schedule-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  fetchBWAProjectDetail,
  deleteBWAProject,
  updateCustomer,
  createIncome,
  updateIncome,
  persistIncomeBelowEstimatedReason,
  deleteIncome,
  setIncomePaymentStatus,
  setExpensePaymentStatus,
  fetchContractTypes,
  fetchPaymentMethods,
  fetchCostCentres,
  fetchSupplierTypes,
  fetchSupplierOptions,
  fetchOsScheduleGroupOptions,
  createExpense,
  updateExpense,
  deleteExpense,
  updateBWAProject,
  analyzeCascadeDelete,
  executeCascadeDelete,
  type CascadeRelatedRecord,
  type CascadeAnalysisResult,
  type BWAProjectDetailData,
  type BWAProjectIncome,
  type BWAProjectExpense,
  type ContractTypeOption,
  type PaymentMethodOption,
  type SupplierTypeOption,
  type IncomeFormData,
  type ExpenseFormData,
  type CostCentreData,
  type LinkOption,
} from "@/lib/data-service";
import { EMPTY_INCOME_AO_FIELDS, incomeAoFieldsFromRow, isAoContractType } from "@/lib/income-ao";
import { incomeNetOutstanding } from "@/lib/income-outstanding";
import { isIncomeDecisionStatus, isIncomeSettled } from "@/lib/income-payment-status";
import {
  hasIncomeBelowEstimatedReason,
  INCOME_BELOW_ESTIMATED_REASON_CLEARED_MESSAGE,
  INCOME_BELOW_ESTIMATED_REASON_REQUIRED_MESSAGE,
  isProjectIncomeBelowEstimated,
  normalizeIncomeBelowEstimatedReason,
  otherProjectIncomeTotal,
} from "@/lib/income-estimated-floor";
import {
  IncomeBelowEstimatedReasonDialog,
  IncomeBelowEstimatedReasonField,
} from "@/components/projects/IncomeBelowEstimatedReasonDialog";
import { IncomeDeleteBlockedDialog } from "@/components/projects/IncomeDeleteBlockedDialog";
import { isExpenseDecisionStatus } from "@/lib/expense-payment-status";
import { IncomeAOFields } from "@/components/projects/IncomeAOFields";
import { IncomeBadDebtsField } from "@/components/projects/IncomeBadDebtsField";
import { IncomeCollectionSituationField } from "@/components/projects/IncomeCollectionSituationField";
import { IncomeExpiryReasonField } from "@/components/projects/IncomeExpiryReasonField";
import { IncomePaymentStatusField } from "@/components/projects/IncomePaymentStatusField";
import { ExpensePaymentStatusField } from "@/components/projects/ExpensePaymentStatusField";
import { createClient } from "@/lib/supabase/client";
import { notifyProjectBvCreated } from "@/lib/project-bv-notify";
import { buildStorageObjectKeyWithSanitizedName } from "@/lib/storage-utils";
import { cn } from "@/lib/utils";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SiteStatusPanel from "@/components/projects/SiteStatusPanel";
import { fetchSiteStatus } from "@/lib/site-status-service";
import SchedulePanel from "@/components/projects/SchedulePanel";
import PaymentSchedulePanel from "@/components/projects/PaymentSchedulePanel";
import ExpenseControlPanel from "@/components/projects/ExpenseControlPanel";
import { evaluateExpenseControl, siteCompletionRatio, type ExpenseControlItem, type ExpenseControlResult } from "@/lib/expense-control-service";
import {
  EXPENSE_CONTROL_CUSTOMER_DOC_TYPE_KEYS,
  EXPENSE_CONTROL_DOC_UPLOAD_KEYS,
  EXPENSE_CONTROL_FIX_ACTIONS,
} from "@/lib/expense-control-actions";
import {
  evaluateExpenseGroupRules,
  emptySupplierDocumentEligibility,
  fetchSupplierDocumentEligibility,
  getExpenseSupplierDocumentError,
  groupHasSupplierQuotation,
  isSupplierEligibleForExpenseAmount,
  parseExpenseFileUrls,
  resolveGroupSupplierQuotationFile,
  supplierMeetsDocumentRules,
  type SupplierDocumentEligibility,
} from "@/lib/expense-amount-rules";
import ProjectInternalCommentPanel from "@/components/projects/ProjectInternalCommentPanel";
import ProjectThreeDRenderPanel from "@/components/projects/ProjectThreeDRenderPanel";
import ProjectDocumentsPanel, { type ProjectDocumentsFocus } from "@/components/projects/ProjectDocumentsPanel";
import WeeklyReportPanel from "@/components/projects/WeeklyReportPanel";
import ManHourPanel from "@/components/projects/ManHourPanel";
import SupplierCommentPanel from "@/components/projects/SupplierCommentPanel";
import BuildingCommentPanel from "@/components/projects/BuildingCommentPanel";
import SupplierEditDialog from "@/components/suppliers/SupplierEditDialog";
import {
  ExpenseAmountRulesBox,
  ExpenseSupplierDocFilterHint,
} from "@/components/projects/ExpenseAmountRulesBox";
import ExpenseOutstandingSplitDialog from "@/components/projects/ExpenseOutstandingSplitDialog";
import { DisabledSubmitControl } from "@/components/projects/DisabledSubmitControl";
import {
  EXPENSE_CONTROL_LOCKED_MESSAGE,
  getExpenseSubmitBlockers,
  getIncomeSubmitBlockers,
} from "@/lib/finance-form-submit-blockers";
import {
  buildSplitPayloads,
  buildStayAsIsPayload,
  hasPartialOutstanding,
  nextExpenseInstallmentIdentity,
  outstandingAmount,
  paidExceedsInstallment,
} from "@/lib/expense-outstanding-split";
import BWAProjectEditDialog from "@/components/projects/BWAProjectEditDialog";
import FinancialEditDialog from "@/components/projects/FinancialEditDialog";
import SitePhotosGallery from "@/components/ui/site-photos-gallery";
import { usePermission } from "@/hooks/use-permission";
import { useAuth } from "@/hooks/use-auth";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { isBwaMiniProjectSize } from "@/lib/bwa-project-size";
import { isBoxWorkingFolder } from "@/lib/box-path";

const supabase = createClient();

interface BWAProjectDetailProps {
  projectId: string;
}

interface ProjectBVRow {
  id: string;
  handler_id: string | null;
  handler_name: string | null;
  ratio: number | null;
  estimated_bv: number | null;
  actual_bv: number | null;
  created_date: string | null;
  modified_date: string | null;
}

// Use centralized date utils — handles both full timestamps (browser TZ)
// and date-only strings (HK dates, no TZ shift) correctly.
import { countOverdueIncomesMissingExpectedDate, formatDate, formatDateTime, isDueDateExpired, isDueDateLocked, isExpectedPaymentDateMissing, isExpectedPaymentDateRequired, isIncomeExpiryReasonMissing, isPastDueUnpaid, overdueIncomeExpectedDateItemLabel, toDateInputValue } from "@/lib/date-utils";
import { PROJECT_STATUS_OPTIONS } from "@/lib/project-status-rules";
import { ProjectStatusBadge } from "@/components/ui/entity-status-badges";
const formatShortDate = formatDate; // alias for backwards compat

function paymentBadge(status: string | null) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s.includes("paid") || s.includes("full") || s.includes("已付"))
    return <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/10 text-xs px-2.5 py-0.5">已付清</Badge>;
  if (s.includes("partial") || s.includes("部分"))
    return <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/10 text-xs px-2.5 py-0.5">部分付款</Badge>;
  if (s.includes("outstanding") || s.includes("pending") || s.includes("未付"))
    return <Badge className="bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/10 text-xs px-2.5 py-0.5">待收款</Badge>;
  return <Badge variant="outline" className="text-xs px-2.5 py-0.5">{status}</Badge>;
}

// ─── DETAIL ROW COMPONENT ───────────────────────────────
function DetailRow({
  label,
  value,
  icon: Icon,
  iconColor = "text-gray-400",
  mono = false,
  isLink = false,
  href,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
  iconColor?: string;
  mono?: boolean;
  isLink?: boolean;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-1 group hover:bg-gray-50/50 rounded-md transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${iconColor}`} />}
        <span className="text-[15px] text-gray-500 flex-shrink-0">{label}</span>
      </div>
      <div className={`text-[15px] text-right min-w-0 truncate max-w-[60%] ${mono ? "font-mono-num" : ""} ${isLink ? "" : "font-medium text-gray-800"}`}>
        {isLink && href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
          >
            <span className="truncate">開啟連結</span>
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
        ) : (
          value || <span className="text-gray-300">—</span>
        )}
      </div>
    </div>
  );
}

// ─── FINANCIAL METRIC CARD ──────────────────────────────
function MetricCard({
  label,
  value,
  subtext,
  trend,
  accentColor,
  icon: Icon,
}: {
  label: string;
  value: string;
  subtext?: string;
  trend?: "up" | "down" | null;
  accentColor: string;
  icon: React.ElementType;
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    "bg-blue-500": { bg: "bg-blue-50", text: "text-blue-500" },
    "bg-red-500": { bg: "bg-red-50", text: "text-red-500" },
    "bg-emerald-500": { bg: "bg-emerald-50", text: "text-emerald-500" },
    "bg-violet-500": { bg: "bg-violet-50", text: "text-violet-500" },
    "bg-amber-500": { bg: "bg-amber-50", text: "text-amber-500" },
  };
  const bgLight = colorMap[accentColor]?.bg || "bg-gray-50";
  const textColor = colorMap[accentColor]?.text || "text-gray-500";

  return (
    <div className="relative overflow-hidden rounded-xl border bg-white p-5 transition-all hover:shadow-md">
      <div className={`absolute top-0 left-0 w-1 h-full ${accentColor}`} />
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 font-mono-num tracking-tight">{value}</p>
          {subtext && (
            <div className="flex items-center gap-1">
              {trend === "up" && <TrendingUp className="w-3 h-3 text-emerald-500" />}
              {trend === "down" && <TrendingDown className="w-3 h-3 text-red-500" />}
              <span className={`text-xs ${trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-600" : "text-gray-400"}`}>
                {subtext}
              </span>
            </div>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgLight}`}>
          <Icon className={`w-5 h-5 ${textColor}`} />
        </div>
      </div>
    </div>
  );
}

// ─── SECTION CARD ────────────────────────────────────────
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

// ─── EMPTY TAB PLACEHOLDER ──────────────────────────────
function EmptyTab({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-400 mb-1">{title}</p>
      <p className="text-xs text-gray-300">此功能即將推出</p>
    </div>
  );
}

// ─── COST STRUCTURE PIE CHART ─────────────────────────────
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

// ─── CASCADE GROUP ITEM (used in delete dialog) ─────────
function CascadeGroupItem({
  group,
  selected,
  onToggle,
  nested = false,
}: {
  group: CascadeRelatedRecord;
  selected: boolean;
  onToggle: (val: boolean) => void;
  nested?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`rounded-lg border p-3 ${nested ? "bg-white border-gray-100" : "bg-gray-50 border-gray-200"}`}>
      <div className="flex items-center gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={(val) => onToggle(!!val)}
          className="border-gray-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{group.label}</span>
            <span className="text-[13px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono">
              {group.count}
            </span>
          </div>
          <p className="text-[13px] text-gray-400 font-mono">{group.table}</p>
        </div>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono shrink-0">
          {group.fk_action}
        </span>
        {group.records.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
          >
            {expanded ? "▲" : "▼"}
          </button>
        )}
      </div>
      {expanded && group.records.length > 0 && (
        <div className="mt-2 ml-8 space-y-1 max-h-32 overflow-y-auto">
          {group.records.map((r, i) => (
            <div key={i} className="text-[13px] text-gray-500 truncate">
              • {r.display || r.id}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Company BV handler_id — only Super Admin can edit/delete
const COMPANY_BV_HANDLER_ID = "00000000-0000-4000-8000-000000000001";

// ─── MAIN COMPONENT ─────────────────────────────────────
export default function BWAProjectDetail({ projectId }: BWAProjectDetailProps) {
  const router = useRouter();
  const { canView, canCreate, canEdit, canDelete, loading: permLoading, debugModulePermissions } = usePermission();
  const { staff } = useAuth();
  const { formatMoney, formatMoney2, formatBVRatio, canViewBVPercentage, financialMask } = useFinancialFormat();
  const fmtCS = (val: number | null) => formatMoney2(val, { fallback: "N/A" });

  // DEV: log which permission decides each project-detail tab capability, so a
  // developer can see exactly what is blocking a hidden button in the console.
  React.useEffect(() => {
    if (permLoading) return;
    debugModulePermissions("Project Detail", [
      "projects",
      "projects.overview",
      "projects.income",
      "projects.expense",
      "projects.cost-structure",
      "projects.payment-schedule",
      "projects.docs",
      "projects.3d",
      "projects.weekly-report",
      "projects.manhour",
      "projects.work-schedule",
      "projects.site-status",
      "projects.supplier-comment",
      "projects.internal-review",
      "projects.tender",
    ]);
  }, [permLoading, debugModulePermissions]);

  // ─── Role-based detail access control ──────────────────────
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  // Income tab permissions
  const canCreateIncome = canCreate("projects.income");
  const canEditIncome = canEdit("projects.income");
  const canDeleteIncome = canDelete("projects.income");

  // Expense tab permissions
  const canCreateExpense = canCreate("projects.expense");
  const canEditExpense = canEdit("projects.expense");
  const canDeleteExpense = canDelete("projects.expense");
  const [data, setData] = useState<BWAProjectDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteAttempts, setDeleteAttempts] = useState(0);
  const deleteInputRef = useRef<HTMLInputElement>(null);
  const [cascadeAnalysis, setCascadeAnalysis] = useState<CascadeAnalysisResult | null>(null);
  const [cascadeLoading, setCascadeLoading] = useState(false);
  const [cascadeStep, setCascadeStep] = useState<"analysis" | "confirm">("analysis");
  const [cascadeSelections, setCascadeSelections] = useState<Record<string, boolean>>({});
  const [deletePitching, setDeletePitching] = useState(false);
  const [deleteCustomer, setDeleteCustomer] = useState(false);
  const [cascadeExecuting, setCascadeExecuting] = useState(false);
  const [cascadeDeletionLog, setCascadeDeletionLog] = useState<{ table: string; deleted: number; error?: string }[] | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showFinancialDialog, setShowFinancialDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Confirmation states for individual delete actions
  const [confirmDeleteIncomeId, setConfirmDeleteIncomeId] = useState<string | null>(null);
  const [deleteIncomeBlockedOpen, setDeleteIncomeBlockedOpen] = useState(false);
  const [confirmDeleteExpenseId, setConfirmDeleteExpenseId] = useState<string | null>(null);
  const [showExpenseOutstandingSplit, setShowExpenseOutstandingSplit] = useState(false);
  const [confirmDeleteBVId, setConfirmDeleteBVId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [workScheduleProgress, setWorkScheduleProgress] = useState<number | null>(null);
  const handleWorkScheduleProgressChange = useCallback((progress: number) => {
    setWorkScheduleProgress(progress);
  }, []);
  const [scheduleGroupOptions, setScheduleGroupOptions] = useState<string[]>([]);
  const [savingScheduleGroup, setSavingScheduleGroup] = useState(false);
  const [scheduleGroupError, setScheduleGroupError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== "work-schedule") {
      setWorkScheduleProgress(null);
    }
  }, [activeTab, data?.id]);

  useEffect(() => {
    let active = true;
    fetchOsScheduleGroupOptions().then((opts) => {
      if (active) setScheduleGroupOptions(opts);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleScheduleGroupChange = useCallback(
    async (newGroup: string) => {
      if (!data || newGroup === (data.os_schedule_group || "")) return;
      setSavingScheduleGroup(true);
      setScheduleGroupError(null);
      const prev = data.os_schedule_group;
      setData((d) => (d ? { ...d, os_schedule_group: newGroup } : d));
      const result = await updateBWAProject(data.id, { os_schedule_group: newGroup });
      setSavingScheduleGroup(false);
      if (!result.success) {
        setScheduleGroupError(result.error || "更新時間表類型失敗");
        setData((d) => (d ? { ...d, os_schedule_group: prev } : d));
      }
    },
    [data],
  );
  const [showCustomerEdit, setShowCustomerEdit] = useState(false);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    customer_name: "",
    display_name: "",
    company_name: "",
    email: "",
    phone_display: "",
    address: "",
  });

  // ─── Invoice existence tracking ──────────────────────────
  const [incomeIdsWithInvoice, setIncomeIdsWithInvoice] = useState<Set<string>>(new Set());

  // ─── Receipt existence tracking ──────────────────────────
  const [incomeIdsWithReceipt, setIncomeIdsWithReceipt] = useState<Set<string>>(new Set());

  // ─── Income Management State ───────────────────────────
  const [contractTypes, setContractTypes] = useState<ContractTypeOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [projectCostCentre, setProjectCostCentre] = useState<CostCentreData | null>(null);
  const [expandedContractType, setExpandedContractType] = useState<string | null>(null);
  const [expandedExpenseGroup, setExpandedExpenseGroup] = useState<string | null>(null);
  const [showIncomeDialog, setShowIncomeDialog] = useState(false);
  const [editingIncome, setEditingIncome] = useState<BWAProjectIncome | null>(null);
  const [incomeSaving, setIncomeSaving] = useState(false);
  const [deletingIncomeId, setDeletingIncomeId] = useState<string | null>(null);
  const [incomeForm, setIncomeForm] = useState<IncomeFormData>({
    income_amount: null,
    payment_amount: null,
    outstanding: null,
    receive_date: null,
    due_date: null,
    expected_payment_date: null,
    invoice_number: null,
    n_contract_type_id: null,
    payment_status: null,
    payment_method: null,
    payment_method_id: null,
    remark: null,
    type_display: null,
    pdf_file: null,
    expiry_reason_id: null,
    bad_debts: null,
    ...EMPTY_INCOME_AO_FIELDS,
  });
  // Ref to always hold the latest incomeForm — avoids stale closure in handleSaveIncome
  const incomeFormRef = useRef(incomeForm);
  useEffect(() => { incomeFormRef.current = incomeForm; }, [incomeForm]);

  const [incomeFileUploading, setIncomeFileUploading] = useState(false);
  const [incomeStatusError, setIncomeStatusError] = useState<string | null>(null);
  const [incomeBelowReason, setIncomeBelowReason] = useState("");
  const [incomeBelowReasonError, setIncomeBelowReasonError] = useState<string | null>(null);
  const [showBelowReasonDialog, setShowBelowReasonDialog] = useState(false);
  const [belowReasonDraft, setBelowReasonDraft] = useState("");
  const [belowReasonDialogError, setBelowReasonDialogError] = useState<string | null>(null);

  // ─── Expense CRUD State ──────────────────────────────────
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<BWAProjectExpense | null>(null);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [supplierTypes, setSupplierTypes] = useState<SupplierTypeOption[]>([]);
  const [supplierOptionsList, setSupplierOptionsList] = useState<LinkOption[]>([]);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormData>({
    installment_amount: null,
    paid_amount: null,
    outstanding: null,
    payment_date: null,
    due_date: null,
    expected_payment_date: null,
    supplier_id: null,
    n_contract_type_id: null,
    n_supplier_type_id: null,
    payment_method_id: null,
    cheque_no: null,
    rank_report: null,
    payment_status: null,
    remark_t: null,
    type_display: null,
    invoice_number: null,
    pdf_file: null,
    supplier_quotation_file: null,
  });
  const expenseFormRef = useRef(expenseForm);
  useEffect(() => { expenseFormRef.current = expenseForm; }, [expenseForm]);
  const [expenseStatusError, setExpenseStatusError] = useState<string | null>(null);
  const [hasSiteStatus, setHasSiteStatus] = useState<boolean>(false);
  // Expense Control checklist result — gates the Expense function (出支票受限).
  const [expenseControl, setExpenseControl] = useState<ExpenseControlResult | null>(null);
  const [expenseControlDocsFocus, setExpenseControlDocsFocus] = useState<ProjectDocumentsFocus | null>(null);
  const [expenseControlFocus, setExpenseControlFocus] = useState<"main-contractor" | null>(null);
  const [editDialogScrollTo, setEditDialogScrollTo] = useState<"key-dates" | null>(null);
  const [expenseFileUploading, setExpenseFileUploading] = useState(false);
  const [expenseFileError, setExpenseFileError] = useState<string | null>(null);
  // Supplier quotation (供應商報價單) uploader — separate file field on the expense.
  const [expenseQuotationUploading, setExpenseQuotationUploading] = useState(false);
  const [expenseQuotationError, setExpenseQuotationError] = useState<string | null>(null);
  const [expenseSupplierDocError, setExpenseSupplierDocError] = useState<string | null>(null);
  const [supplierDocEligibility, setSupplierDocEligibility] = useState<SupplierDocumentEligibility | null>(null);
  const [supplierDocEligibilityLoading, setSupplierDocEligibilityLoading] = useState(false);
  const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState("");
  const [supplierTypeSearchOpen, setSupplierTypeSearchOpen] = useState(false);
  const [supplierTypeSearchQuery, setSupplierTypeSearchQuery] = useState("");
  const [quickAddSupplierOpen, setQuickAddSupplierOpen] = useState(false);
  const supplierPanelRef = useRef<HTMLDivElement>(null);
  const supplierTypePanelRef = useRef<HTMLDivElement>(null);

  // ─── Main Contractor (主要承辦商) quick-select — Expense tab ──
  // Lets the user assign bwa_projects.main_contractor inline when it's null,
  // using a searchable supplier dropdown, without leaving the Expense tab.
  const [mcSearchOpen, setMcSearchOpen] = useState(false);
  const [mcSearchQuery, setMcSearchQuery] = useState("");
  const [mcSaving, setMcSaving] = useState(false);
  const [mcError, setMcError] = useState<string | null>(null);
  const mcPanelRef = useRef<HTMLDivElement>(null);

  // Close main-contractor search panel on click outside
  useEffect(() => {
    if (!mcSearchOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (mcPanelRef.current && !mcPanelRef.current.contains(e.target as Node)) {
        setMcSearchOpen(false);
        setMcSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mcSearchOpen]);

  // Open main-contractor picker when navigated from Expense Control fix button.
  useEffect(() => {
    if (activeTab === "expense" && expenseControlFocus === "main-contractor") {
      setMcSearchOpen(true);
      setExpenseControlFocus(null);
    }
  }, [activeTab, expenseControlFocus]);

  const handleSetMainContractor = async (supplierId: string) => {
    if (!data) return;
    setMcSaving(true);
    setMcError(null);
    const result = await updateBWAProject(data.id, { main_contractor_id: supplierId });
    setMcSaving(false);
    setMcSearchOpen(false);
    setMcSearchQuery("");
    if (!result.success) {
      setMcError(result.error || "設定主要承辦商失敗");
      return;
    }
    await loadData(true);
  };

  const handleRemoveMainContractor = async () => {
    if (!data) return;
    setMcSaving(true);
    setMcError(null);
    const result = await updateBWAProject(data.id, { main_contractor_id: null });
    setMcSaving(false);
    if (!result.success) {
      setMcError(result.error || "移除主要承辦商失敗");
      return;
    }
    await loadData(true);
  };

  // Close supplier search panel on click outside
  useEffect(() => {
    if (!supplierSearchOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (supplierPanelRef.current && !supplierPanelRef.current.contains(e.target as Node)) {
        setSupplierSearchOpen(false);
        setSupplierSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [supplierSearchOpen]);

  // Close supplier type search panel on click outside
  useEffect(() => {
    if (!supplierTypeSearchOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (supplierTypePanelRef.current && !supplierTypePanelRef.current.contains(e.target as Node)) {
        setSupplierTypeSearchOpen(false);
        setSupplierTypeSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [supplierTypeSearchOpen]);

  useEffect(() => {
    if (!showExpenseDialog) return;
    let cancelled = false;
    setSupplierDocEligibilityLoading(true);
    fetchSupplierDocumentEligibility()
      .then((result) => {
        if (!cancelled) setSupplierDocEligibility(result);
      })
      .catch(() => {
        if (!cancelled) setSupplierDocEligibility(emptySupplierDocumentEligibility());
      })
      .finally(() => {
        if (!cancelled) setSupplierDocEligibilityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showExpenseDialog]);

  const expenseCriteriaExpenses = useMemo(
    () =>
      (data?.expenses || []).map((expense) => ({
        id: expense.id,
        supplier_id: expense.supplier_id,
        n_contract_type_id: expense.n_contract_type_id,
        amount: expense.amount,
        supplier_quotation_file: expense.supplier_quotation_file,
      })),
    [data?.expenses]
  );

  const expenseGroupRulesEnabled = projectCostCentre?.expense_control_enabled !== false;

  const expenseGroupRules = useMemo(
    () =>
      evaluateExpenseGroupRules(
        expenseForm.installment_amount,
        expenseForm.supplier_id,
        expenseForm.n_contract_type_id,
        expenseCriteriaExpenses,
        editingExpense?.id,
        expenseGroupRulesEnabled
      ),
    [
      expenseForm.installment_amount,
      expenseForm.supplier_id,
      expenseForm.n_contract_type_id,
      expenseCriteriaExpenses,
      editingExpense?.id,
      expenseGroupRulesEnabled,
    ]
  );

  const expenseAmountRules = expenseGroupRules.rules;

  const expenseGroupHasQuotation = useMemo(
    () =>
      groupHasSupplierQuotation(
        expenseForm.supplier_id,
        expenseForm.n_contract_type_id,
        expenseCriteriaExpenses,
        expenseForm.supplier_quotation_file,
        editingExpense?.id
      ),
    [
      expenseForm.supplier_id,
      expenseForm.n_contract_type_id,
      expenseForm.supplier_quotation_file,
      expenseCriteriaExpenses,
      editingExpense?.id,
    ]
  );

  const expenseSupplierOptionsFiltered = useMemo(() => {
    if (!expenseGroupRulesEnabled || !expenseForm.n_contract_type_id || !supplierDocEligibility) {
      return supplierOptionsList;
    }

    return supplierOptionsList.filter((supplier) => {
      const supplierGroupRules = evaluateExpenseGroupRules(
        expenseForm.installment_amount,
        supplier.id,
        expenseForm.n_contract_type_id,
        expenseCriteriaExpenses,
        editingExpense?.id,
        expenseGroupRulesEnabled
      );
      return isSupplierEligibleForExpenseAmount(
        supplier.id,
        supplierGroupRules.rules,
        supplierDocEligibility
      );
    });
  }, [
    expenseGroupRulesEnabled,
    supplierOptionsList,
    expenseForm.installment_amount,
    expenseForm.n_contract_type_id,
    expenseCriteriaExpenses,
    editingExpense?.id,
    supplierDocEligibility,
  ]);

  const expenseSupplierOptionsForDropdown = useMemo(() => {
    if (!expenseForm.supplier_id) return expenseSupplierOptionsFiltered;
    if (expenseSupplierOptionsFiltered.some((supplier) => supplier.id === expenseForm.supplier_id)) {
      return expenseSupplierOptionsFiltered;
    }
    const selected = supplierOptionsList.find((supplier) => supplier.id === expenseForm.supplier_id);
    return selected ? [selected, ...expenseSupplierOptionsFiltered] : expenseSupplierOptionsFiltered;
  }, [expenseForm.supplier_id, expenseSupplierOptionsFiltered, supplierOptionsList]);

  // ─── Project BV (Team) State ──────────────────────────────────
  const [projectBV, setProjectBV] = useState<ProjectBVRow[]>([]);
  const [bvLoading, setBvLoading] = useState(false);
  const [bvReloadKey, setBvReloadKey] = useState(0);
  const [showBVDialog, setShowBVDialog] = useState(false);
  const [bvEditingId, setBvEditingId] = useState<string | null>(null);
  const [bvFormHandlerId, setBvFormHandlerId] = useState("");
  const [bvFormRatio, setBvFormRatio] = useState("");
  const [bvSaving, setBvSaving] = useState(false);
  const [bvDeleting, setBvDeleting] = useState<string | null>(null);
  const [staffOptions, setStaffOptions] = useState<{ id: string; name: string }[]>([]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    const [result, ctList, pmList, ccList, stList, supList] = await Promise.all([
      fetchBWAProjectDetail(projectId),
      fetchContractTypes(),
      fetchPaymentMethods(),
      fetchCostCentres(),
      fetchSupplierTypes(),
      fetchSupplierOptions(),
    ]);
    setData(result);
    setContractTypes(ctList);
    setPaymentMethods(pmList);
    const assignedTypeIds = (result?.expenses ?? []).map((e) => e.n_supplier_type_id);
    const missingTypeIds = assignedTypeIds.filter(
      (id): id is string => !!id && !stList.some((t) => t.id === id),
    );
    setSupplierTypes(missingTypeIds.length ? await fetchSupplierTypes(assignedTypeIds) : stList);
    setSupplierOptionsList(supList);

    // Match cost centre to this project
    if (result?.cost_centre_id && ccList.length > 0) {
      const matched = ccList.find((cc) => cc.id === result.cost_centre_id);
      setProjectCostCentre(matched || null);
    } else {
      setProjectCostCentre(null);
    }

    // Check if site status exists for this project
    if (result) {
      const siteStatusResult = await fetchSiteStatus(result.id);
      setHasSiteStatus(!!siteStatusResult);
      // Evaluate the Expense Control checklist so the Expense tab gate is in
      // sync even before the Expense Control tab is opened.
      evaluateExpenseControl(result.id).then(setExpenseControl).catch(() => {});
    } else {
      setHasSiteStatus(false);
      setExpenseControl(null);
    }

    // Fetch which incomes already have invoices
    if (result?.incomes?.length) {
      const incomeIds = result.incomes.map((inc: BWAProjectIncome) => inc.id);
      const { data: invoiceRows } = await supabase
        .from("income_invoices")
        .select("income_id")
        .in("income_id", incomeIds);
      const invoiceSet = new Set<string>((invoiceRows || []).map((r: { income_id: string }) => r.income_id));
      setIncomeIdsWithInvoice(invoiceSet);

      // Fetch which incomes already have receipts
      const { data: receiptRows } = await supabase
        .from("receipts")
        .select("income_id")
        .in("income_id", incomeIds);
      const receiptSet = new Set<string>((receiptRows || []).map((r: { income_id: string }) => r.income_id));
      setIncomeIdsWithReceipt(receiptSet);
    } else {
      setIncomeIdsWithInvoice(new Set());
      setIncomeIdsWithReceipt(new Set());
    }

    // Fetch project BV (team assignments)
    setBvLoading(true);
    const bvRes = await supabase
      .from("project_bv")
      .select("id, handler_id, ratio, estimated_bv, actual_bv, created_date, modified_date, handler:staff!fk_project_bv_handler_id(id, name)")
      .eq("project_id", projectId)
      .order("created_date", { ascending: true });
    
    let finalBvRows: any[] = [];
    if (bvRes.error) {
      // Fallback without FK join
      console.warn("[BWAProjectDetail] project_bv FK join failed, using fallback:", bvRes.error.message);
      const { data: fallbackBv } = await supabase
        .from("project_bv")
        .select("id, handler_id, ratio, estimated_bv, actual_bv, created_date, modified_date")
        .eq("project_id", projectId)
        .order("created_date", { ascending: true });
      finalBvRows = (fallbackBv || []).map((r: any) => ({ ...r, handler_name: null }));
    } else {
      finalBvRows = (bvRes.data || []).map((r: any) => ({
        ...r,
        handler_name: r.handler?.name || null,
      }));
    }
    setProjectBV(finalBvRows);
    setBvLoading(false);

    // ─── Access check: User / Senior User role restriction ─────────
    if (staff) {
      const role = (staff as any).role as string | null;
      if (role === "User") {
        // User can only see projects where they are a handler in project_bv
        const isHandler = finalBvRows.some((bv: any) => bv.handler_id === staff.id);
        setAccessDenied(!isHandler);
      } else if (role === "Senior User") {
        // Senior User can only see projects where any handler shares same team
        const staffTeamId = (staff as any).n_team_type_id;
        if (staffTeamId && finalBvRows.length > 0) {
          // Get all handler_ids from the BV list
          const handlerIds = finalBvRows
            .map((bv: any) => bv.handler_id)
            .filter(Boolean);
          if (handlerIds.length > 0) {
            // Check if any handler is in the same team
            const { data: teamStaff } = await supabase
              .from("staff")
              .select("id")
              .eq("n_team_type_id", staffTeamId)
              .in("id", handlerIds);
            const hasTeamMember = (teamStaff || []).length > 0;
            setAccessDenied(!hasTeamMember);
          } else {
            setAccessDenied(true);
          }
        } else {
          // No team assigned or no BV entries — deny
          setAccessDenied(true);
        }
      } else {
        // Admin / Super Admin — full access
        setAccessDenied(false);
      }
    }
    setAccessChecked(true);

    setLoading(false);
    setRefreshing(false);
  }, [projectId, staff]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Reload Project BV when bvReloadKey changes ─────────────────
  useEffect(() => {
    if (!projectId || bvReloadKey === 0) return;
    const reloadBV = async () => {
      setBvLoading(true);
      const bvRes = await supabase
        .from("project_bv")
        .select("id, handler_id, ratio, estimated_bv, actual_bv, created_date, modified_date, handler:staff!fk_project_bv_handler_id(id, name)")
        .eq("project_id", projectId)
        .order("created_date", { ascending: true });

      let finalBvRows: any[] = [];
      if (bvRes.error) {
        const { data: fallbackBv } = await supabase
          .from("project_bv")
          .select("id, handler_id, ratio, estimated_bv, actual_bv, created_date, modified_date")
          .eq("project_id", projectId)
          .order("created_date", { ascending: true });
        finalBvRows = (fallbackBv || []).map((r: any) => ({ ...r, handler_name: null }));
      } else {
        finalBvRows = (bvRes.data || []).map((r: any) => ({
          ...r,
          handler_name: r.handler?.name || null,
        }));
      }
      setProjectBV(finalBvRows);
      setBvLoading(false);
    };
    reloadBV();
  }, [projectId, bvReloadKey]);

  // ─── Load staff options for BV CRUD ───────────────────────────
  useEffect(() => {
    const loadStaff = async () => {
      const { data: staffData } = await supabase
        .from("staff")
        .select("id, name")
        .eq("status", "Active")
        .order("name", { ascending: true });
      if (staffData) setStaffOptions(staffData);
    };
    loadStaff();
  }, []);

  // ─── BV CRUD Handlers ─────────────────────────────────────────
  const handleBVAdd = () => {
    setBvEditingId(null);
    setBvFormHandlerId("");
    setBvFormRatio("0");
    setShowBVDialog(true);
  };

  // Helper: check if a BV row is the protected company BV (only Super Admin can edit/delete)
  const isCompanyBV = (handlerId: string | null) => handlerId === COMPANY_BV_HANDLER_ID;
  const isSuperAdmin = (staff as any)?.role === "Super Admin";
  const isAdminOrAbove = isSuperAdmin || (staff as any)?.role === "Admin";
  // Expense create/edit is gated by the Expense Control checklist (出支票受限):
  // restricted when any applicable checklist item is incomplete. Falls back to
  // the legacy Site Status check until the checklist has loaded. Super Admin
  // bypasses the gate entirely. The checklist only applies while the project is
  // actively running — once its status is no longer "Work In Progress" (done /
  // closed / etc.) expenses are unlocked.
  const isWorkInProgress = (data?.status || "").trim() === "Work In Progress";
  const expenseUnlocked =
    isSuperAdmin ||
    !isWorkInProgress ||
    (expenseControl ? !expenseControl.restricted : hasSiteStatus);
  // 款項期數 field: on CREATE, only Super Admin / Admin can manually edit.
  // On EDIT, all staff can edit it (see expense dialog gating below).
  const canEditInstallmentNumber = isAdminOrAbove;

  const incomeSubmitBlockers = useMemo(
    () =>
      getIncomeSubmitBlockers({
        incomeAmount: incomeForm.income_amount,
        dueDate: incomeForm.due_date,
        expectedPaymentDate: incomeForm.expected_payment_date,
        expiryReasonId: incomeForm.expiry_reason_id,
        paymentStatus: incomeForm.payment_status,
        paymentAmount: incomeForm.payment_amount,
        receiveDate: incomeForm.receive_date,
        paymentMethod: incomeForm.payment_method,
      }),
    [
      incomeForm.income_amount,
      incomeForm.due_date,
      incomeForm.expected_payment_date,
      incomeForm.expiry_reason_id,
      incomeForm.payment_status,
      incomeForm.payment_amount,
      incomeForm.receive_date,
      incomeForm.payment_method,
    ]
  );
  const incomeSaveDisabled =
    incomeSaving || incomeFileUploading || incomeSubmitBlockers.length > 0;

  const expenseSubmitBlockers = useMemo(
    () =>
      getExpenseSubmitBlockers({
        installmentAmount: expenseForm.installment_amount,
        rankReport: expenseForm.rank_report,
        contractTypeId: expenseForm.n_contract_type_id,
        supplierTypeId: expenseForm.n_supplier_type_id,
        payeeMode: "supplier",
        supplierId: expenseForm.supplier_id,
        factoryId: expenseForm.factory_id,
        dueDate: expenseForm.due_date,
        expectedPaymentDate: expenseForm.expected_payment_date,
        paidAmount: expenseForm.paid_amount,
        expenseUnlocked,
      }),
    [
      expenseForm.installment_amount,
      expenseForm.rank_report,
      expenseForm.n_contract_type_id,
      expenseForm.n_supplier_type_id,
      expenseForm.supplier_id,
      expenseForm.factory_id,
      expenseForm.due_date,
      expenseForm.expected_payment_date,
      expenseForm.paid_amount,
      expenseUnlocked,
    ]
  );
  const expenseSaveDisabled =
    expenseSaving || expenseFileUploading || expenseSubmitBlockers.length > 0;

  const handleBVEdit = (bv: ProjectBVRow) => {
    // Guard: company BV can only be edited by Super Admin
    if (isCompanyBV(bv.handler_id) && !isSuperAdmin) return;
    setBvEditingId(bv.id);
    setBvFormHandlerId(bv.handler_id || "");
    setBvFormRatio(bv.ratio != null ? String(bv.ratio) : "0");
    setShowBVDialog(true);
  };

  const handleBVSave = async () => {
    if (!bvFormHandlerId || !data) return;
    setBvSaving(true);
    const now = new Date().toISOString();
    const ratioVal = bvFormRatio ? parseFloat(bvFormRatio) : null;

    if (bvEditingId) {
      // UPDATE
      const editedBV = projectBV.find((bv) => bv.id === bvEditingId);
      const originalHandlerId = editedBV?.handler_id;

      await supabase
        .from("project_bv")
        .update({
          handler_id: bvFormHandlerId,
          ratio: ratioVal,
          modified_date: now,
        })
        .eq("id", bvEditingId);

      // If main PM/Designer changed, update bwa_projects record
      if (originalHandlerId && originalHandlerId !== bvFormHandlerId) {
        const projectUpdates: Record<string, any> = {};
        if (originalHandlerId === data.main_pm_id) {
          projectUpdates.main_pm_id = bvFormHandlerId;
        }
        if (originalHandlerId === data.main_designer_id) {
          projectUpdates.main_designer_id = bvFormHandlerId;
        }
        if (Object.keys(projectUpdates).length > 0) {
          projectUpdates.modified_date = now;
          await supabase
            .from("bwa_projects")
            .update(projectUpdates)
            .eq("id", projectId);
          loadData(true);
        }
      }
    } else {
      // CREATE
      const { error: bvInsertErr } = await supabase.from("project_bv").insert({
        project_id: projectId,
        handler_id: bvFormHandlerId,
        ratio: ratioVal,
        created_date: now,
        modified_date: now,
      });
      if (!bvInsertErr) {
        void notifyProjectBvCreated(supabase, {
          rows: [
            {
              handler_id: bvFormHandlerId,
              ratio: ratioVal,
              project_id: projectId,
            },
          ],
          assignerStaffId: staff?.id ?? null,
          assignerName: staff?.name ?? null,
          projectCode: data.project_code,
          projectName: data.project_name,
        });
      }
    }

    setBvSaving(false);
    setShowBVDialog(false);
    setBvReloadKey((k) => k + 1);
  };

  const handleBVDelete = async (bvId: string) => {
    // Guard: check if this BV is the protected company BV
    const targetBV = projectBV.find((bv) => bv.id === bvId);
    if (targetBV && isCompanyBV(targetBV.handler_id) && !isSuperAdmin) return;
    setConfirmDeleteBVId(bvId);
  };

  const confirmBVDelete = async () => {
    if (!confirmDeleteBVId) return;
    setBvDeleting(confirmDeleteBVId);
    await supabase.from("project_bv").delete().eq("id", confirmDeleteBVId);
    setBvDeleting(null);
    setConfirmDeleteBVId(null);
    setBvReloadKey((k) => k + 1);
  };

  // ─── Income Handlers ──────────────────────────────────
  const resetIncomeForm = () => {
    setIncomeForm({
      income_amount: null,
      payment_amount: null,
      outstanding: null,
      receive_date: null,
      due_date: null,
      expected_payment_date: null,
      invoice_number: null,
      n_contract_type_id: null,
      payment_status: null,
      payment_method: null,
      payment_method_id: null,
      remark: null,
      type_display: null,
      pdf_file: null,
      expiry_reason_id: null,
      bad_debts: null,
      ...EMPTY_INCOME_AO_FIELDS,
    });
    setEditingIncome(null);
    setIncomeFileError(null);
    setIncomeStatusError(null);
    setIncomeBelowReason(data?.income_below_estimated_reason ?? "");
    setIncomeBelowReasonError(null);
    setShowBelowReasonDialog(false);
    setBelowReasonDraft("");
    setBelowReasonDialogError(null);
  };

  // Helper: compute next installment number for a given contract type
  const getNextInstallmentNumber = (contractTypeId?: string | null): string => {
    const incomes = data?.incomes || [];
    const matching = incomes.filter(inc => {
      if (contractTypeId) return inc.n_contract_type_id === contractTypeId;
      return !inc.n_contract_type_id; // uncategorized
    });
    return String(matching.length + 1);
  };

  const openCreateIncome = (contractTypeId?: string) => {
    resetIncomeForm();
    const nextNum = getNextInstallmentNumber(contractTypeId);
    if (contractTypeId) {
      setIncomeForm(prev => ({ ...prev, n_contract_type_id: contractTypeId, invoice_number: nextNum }));
    } else {
      setIncomeForm(prev => ({ ...prev, invoice_number: nextNum }));
    }
    setShowIncomeDialog(true);
  };

  const openEditIncome = (income: BWAProjectIncome) => {
    setEditingIncome(income);
    setIncomeForm({
      income_amount: income.amount,
      payment_amount: income.payment_amount,
      outstanding: income.outstanding,
      receive_date: toDateInputValue(income.payment_date) || null,
      due_date: toDateInputValue(income.due_date) || null,
      expected_payment_date: toDateInputValue(income.expected_payment_date) || null,
      invoice_number: income.invoice_number,
      n_contract_type_id: income.n_contract_type_id,
      payment_status: income.payment_status,
      payment_method: income.payment_method,
      payment_method_id: null,
      remark: income.remark,
      type_display: income.type_display,
      pdf_file: income.pdf_file,
      expiry_reason_id: isIncomeSettled(income.payment_status) ? null : income.expiry_reason_id,
      bad_debts: income.bad_debts ?? null,
      ...incomeAoFieldsFromRow(income),
    });
    setIncomeBelowReason(data?.income_below_estimated_reason ?? "");
    setIncomeBelowReasonError(null);
    setShowIncomeDialog(true);
  };

  const incomeAmountBelowEstimated = useMemo(() => {
    if (incomeForm.income_amount == null) return false;
    const projected =
      otherProjectIncomeTotal(data?.incomes || [], editingIncome?.id) +
      (Number(incomeForm.income_amount) || 0);
    return isProjectIncomeBelowEstimated(projected, data?.estimated_income);
  }, [data?.incomes, data?.estimated_income, editingIncome?.id, incomeForm.income_amount]);

  const persistedIncomeBelowReason = data?.income_below_estimated_reason ?? null;
  const hasPersistedIncomeBelowReason = hasIncomeBelowEstimatedReason(persistedIncomeBelowReason);

  const persistIncomeAndSave = async (reasonToSave: string | null) => {
    setIncomeSaving(true);
    const raw = incomeFormRef.current;
    const reasonResult = await persistIncomeBelowEstimatedReason(
      projectId,
      "bwa_project",
      reasonToSave,
      persistedIncomeBelowReason
    );
    if (!reasonResult.success) {
      setIncomeSaving(false);
      setIncomeBelowReasonError(reasonResult.error || INCOME_BELOW_ESTIMATED_REASON_CLEARED_MESSAGE);
      return;
    }

    const received = isIncomeSettled(raw.payment_status);
    const latestForm = {
      ...raw,
      expiry_reason_id:
        received || !isDueDateExpired(raw.due_date) ? null : raw.expiry_reason_id,
      ...(isAdminOrAbove ? {} : { bad_debts: undefined }),
    };
    console.log("[handleSaveIncome] pdf_file value being saved:", latestForm.pdf_file);
    let result;
    if (editingIncome) {
      result = await updateIncome(editingIncome.id, latestForm, staff?.id);
      if (
        result.success &&
        latestForm.payment_status !== editingIncome.payment_status
      ) {
        const statusResult = await setIncomePaymentStatus(
          editingIncome.id,
          latestForm.payment_status,
          staff?.id
        );
        if (!statusResult.success) result = statusResult;
      }
    } else {
      result = await createIncome(projectId, latestForm);
      if (
        result.success &&
        result.id &&
        isIncomeDecisionStatus(latestForm.payment_status)
      ) {
        const statusResult = await setIncomePaymentStatus(
          result.id,
          latestForm.payment_status,
          staff?.id
        );
        if (!statusResult.success) result = statusResult;
      }
    }
    setIncomeSaving(false);
    if (result.success) {
      setShowIncomeDialog(false);
      setShowBelowReasonDialog(false);
      resetIncomeForm();
      loadData(true); // silent reload — no loading spinner
    } else if (result.error) {
      setIncomeStatusError(result.error);
    }
  };

  const handleSaveIncome = async () => {
    setIncomeSaving(true);
    const raw = incomeFormRef.current;
    const projected =
      otherProjectIncomeTotal(data?.incomes || [], editingIncome?.id) +
      (Number(raw.income_amount) || 0);
    const belowEstimated = isProjectIncomeBelowEstimated(projected, data?.estimated_income);
    const nextReason = normalizeIncomeBelowEstimatedReason(incomeBelowReason);

    if (raw.payment_amount != null && !raw.payment_status) {
      setIncomeStatusError("已填寫已收金額時必須選擇收款狀態");
      setIncomeSaving(false);
      return;
    }
    setIncomeStatusError(null);
    if (!raw.due_date) {
      setIncomeSaving(false);
      return;
    }
    if (isExpectedPaymentDateMissing(raw.due_date, raw.expected_payment_date, undefined, raw.payment_status)) {
      setIncomeSaving(false);
      return;
    }
    if (isIncomeExpiryReasonMissing(raw.due_date, raw.expiry_reason_id, undefined, raw.payment_status)) {
      setIncomeSaving(false);
      return;
    }
    if (raw.payment_amount != null && (!raw.receive_date || !raw.payment_method)) {
      setIncomeSaving(false);
      return;
    }
    if (hasPersistedIncomeBelowReason && !nextReason) {
      setIncomeBelowReasonError(INCOME_BELOW_ESTIMATED_REASON_CLEARED_MESSAGE);
      setIncomeSaving(false);
      return;
    }
    if (belowEstimated && !nextReason) {
      setBelowReasonDraft("");
      setBelowReasonDialogError(null);
      setShowBelowReasonDialog(true);
      setIncomeSaving(false);
      return;
    }
    await persistIncomeAndSave(nextReason);
  };

  const handleConfirmBelowReason = async () => {
    const nextReason = normalizeIncomeBelowEstimatedReason(belowReasonDraft);
    if (!nextReason) {
      setBelowReasonDialogError(INCOME_BELOW_ESTIMATED_REASON_REQUIRED_MESSAGE);
      return;
    }
    setIncomeBelowReason(nextReason);
    setIncomeBelowReasonError(null);
    await persistIncomeAndSave(nextReason);
  };

  const handleDeleteIncome = (incomeId: string) => {
    const remaining = otherProjectIncomeTotal(data?.incomes || [], incomeId);
    if (
      !hasPersistedIncomeBelowReason &&
      isProjectIncomeBelowEstimated(remaining, data?.estimated_income)
    ) {
      setDeleteIncomeBlockedOpen(true);
      return;
    }
    setConfirmDeleteIncomeId(incomeId);
  };

  const confirmDeleteIncome = async () => {
    if (!confirmDeleteIncomeId) return;
    setDeletingIncomeId(confirmDeleteIncomeId);
    setConfirmDeleteIncomeId(null);
    const result = await deleteIncome(confirmDeleteIncomeId);
    setDeletingIncomeId(null);
    if (result.success) {
      loadData(true); // silent reload
    }
  };

  // ─── Expense Handlers ──────────────────────────────────
  const resetExpenseForm = () => {
    setExpenseForm({
      installment_amount: null,
      paid_amount: null,
      outstanding: null,
      payment_date: null,
      due_date: null,
      expected_payment_date: null,
      supplier_id: null,
      n_contract_type_id: null,
      n_supplier_type_id: null,
      payment_method_id: null,
      cheque_no: null,
      rank_report: null,
      payment_status: null,
      remark_t: null,
      type_display: null,
      invoice_number: null,
      pdf_file: null,
      supplier_quotation_file: null,
    });
    setEditingExpense(null);
    setExpenseFileError(null);
    setExpenseQuotationError(null);
    setExpenseSupplierDocError(null);
    setExpenseStatusError(null);
    setSupplierSearchOpen(false);
    setSupplierSearchQuery("");
    setSupplierTypeSearchOpen(false);
    setSupplierTypeSearchQuery("");
    setShowExpenseOutstandingSplit(false);
  };

  const openCreateExpense = (supplierIdPreset?: string, contractTypeIdPreset?: string) => {
    resetExpenseForm();
    // Compute next rank_report number for this supplier+contract group
    const expenses = data?.expenses || [];
    const matching = expenses.filter(e =>
      (supplierIdPreset ? e.supplier_id === supplierIdPreset : !e.supplier_id) &&
      (contractTypeIdPreset ? e.n_contract_type_id === contractTypeIdPreset : !e.n_contract_type_id)
    );
    const nextRank = String(matching.length + 1);
    setExpenseForm(prev => ({
      ...prev,
      supplier_id: supplierIdPreset || null,
      n_contract_type_id: contractTypeIdPreset || null,
      rank_report: nextRank,
    }));
    setShowExpenseDialog(true);
  };

  const openEditExpense = (expense: BWAProjectExpense) => {
    setEditingExpense(expense);
    const quotationFile =
      (expense.supplier_quotation_file && expense.supplier_quotation_file.trim()) ||
      resolveGroupSupplierQuotationFile(
        expense.supplier_id,
        expense.n_contract_type_id,
        data?.expenses || [],
        expense.id
      ) ||
      null;
    setExpenseForm({
      installment_amount: expense.amount,
      paid_amount: expense.paid_amount,
      outstanding: expense.outstanding,
      payment_date: toDateInputValue(expense.payment_date) || null,
      due_date: toDateInputValue(expense.due_date) || null,
      expected_payment_date: toDateInputValue(expense.expected_payment_date) || null,
      supplier_id: expense.supplier_id,
      n_contract_type_id: expense.n_contract_type_id,
      n_supplier_type_id: expense.n_supplier_type_id,
      payment_method_id: expense.payment_method_id,
      cheque_no: expense.cheque_no,
      rank_report: expense.rank_report,
      payment_status: expense.payment_status,
      remark_t: expense.remark,
      type_display: expense.type_display,
      invoice_number: expense.invoice_number,
      pdf_file: expense.pdf_file,
      supplier_quotation_file: quotationFile,
    });
    setExpenseQuotationError(null);
    setShowExpenseDialog(true);
  };

  const handleSaveExpense = async () => {
    const current = expenseFormRef.current;
    const groupRules = evaluateExpenseGroupRules(
      current.installment_amount,
      current.supplier_id,
      current.n_contract_type_id,
      expenseCriteriaExpenses,
      editingExpense?.id,
      expenseGroupRulesEnabled
    );

    if (expenseGroupRulesEnabled && groupRules.expenseControlApplicable) {
      if (!current.supplier_id || !current.n_contract_type_id) {
        setExpenseSupplierDocError(null);
      } else if (supplierDocEligibilityLoading || !supplierDocEligibility) {
        setExpenseSupplierDocError("正在核對供應商文件，請稍後再試。");
        return;
      } else if (
        !supplierMeetsDocumentRules(current.supplier_id, groupRules.rules, supplierDocEligibility)
      ) {
        setExpenseSupplierDocError(
          getExpenseSupplierDocumentError(current.supplier_id, groupRules.rules, supplierDocEligibility)
        );
        return;
      } else {
        setExpenseSupplierDocError(null);
      }

      const hasQuotation = groupHasSupplierQuotation(
        current.supplier_id,
        current.n_contract_type_id,
        expenseCriteriaExpenses,
        current.supplier_quotation_file,
        editingExpense?.id
      );

      if (groupRules.rules.quotationRequired && !hasQuotation) {
        setExpenseQuotationError("群組支出金額達 $3,000 或以上，必須上傳供應商報價單（全組只需一份）。");
        return;
      }
    } else {
      setExpenseSupplierDocError(null);
    }
    setExpenseQuotationError(null);

    if (!current.due_date) {
      return;
    }
    if (isExpectedPaymentDateMissing(current.due_date, current.expected_payment_date)) {
      return;
    }
    if (current.paid_amount != null && !current.payment_status) {
      setExpenseStatusError("已填寫已付金額時必須選擇審批狀態");
      return;
    }
    setExpenseStatusError(null);
    if (paidExceedsInstallment(current.paid_amount, current.installment_amount)) {
      return;
    }
    if (hasPartialOutstanding(current.paid_amount, current.installment_amount)) {
      setShowExpenseOutstandingSplit(true);
      return;
    }
    await persistExpense("stay");
  };

  const persistExpense = async (
    mode: "stay" | "split",
    childExpectedPaymentDate?: string
  ) => {
    const raw = expenseFormRef.current;
    const current = raw;
    setExpenseSaving(true);
    let result;
    if (mode === "split" && childExpectedPaymentDate) {
      const nextIdentity = nextExpenseInstallmentIdentity(
        data?.expenses || [],
        { supplier_id: current.supplier_id, factory_id: current.factory_id },
        current.n_contract_type_id,
        current.rank_report
      );
      const { original, child } = buildSplitPayloads({
        form: current,
        childExpectedPaymentDate,
        nextIdentity,
      });
      const childResult = await createExpense(projectId, child);
      if (!childResult.success) {
        setExpenseSaving(false);
        return;
      }
      result = editingExpense
        ? await updateExpense(editingExpense.id, original, staff?.id)
        : await createExpense(projectId, original);
    } else {
      const latestForm = buildStayAsIsPayload(current);
      result = editingExpense
        ? await updateExpense(editingExpense.id, latestForm, staff?.id)
        : await createExpense(projectId, latestForm);
    }
    if (result.success) {
      const statusTargetId = editingExpense?.id ?? result.id;
      if (statusTargetId) {
        const prevStatus = editingExpense?.payment_status ?? null;
        if (editingExpense && current.payment_status !== prevStatus) {
          const statusResult = await setExpensePaymentStatus(
            statusTargetId,
            current.payment_status,
            staff?.id
          );
          if (!statusResult.success) result = statusResult;
        } else if (!editingExpense && isExpenseDecisionStatus(current.payment_status)) {
          const statusResult = await setExpensePaymentStatus(
            statusTargetId,
            current.payment_status,
            staff?.id
          );
          if (!statusResult.success) result = statusResult;
        }
      }
    }
    setExpenseSaving(false);
    if (result.success) {
      setShowExpenseOutstandingSplit(false);
      setShowExpenseDialog(false);
      resetExpenseForm();
      loadData(true);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    setConfirmDeleteExpenseId(expenseId);
  };

  const confirmDeleteExpense = async () => {
    if (!confirmDeleteExpenseId) return;
    setDeletingExpenseId(confirmDeleteExpenseId);
    setConfirmDeleteExpenseId(null);
    const result = await deleteExpense(confirmDeleteExpenseId);
    setDeletingExpenseId(null);
    if (result.success) {
      loadData(true);
    }
  };

  // ─── Expense File Upload Handler ───────────────────────
  const handleExpenseFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setExpenseFileUploading(true);
    setExpenseFileError(null);
    try {
      // Ensure bucket exists (use list() check instead of listBuckets which requires admin)
      const bucketReady = await ensureIncomeBucket();
      if (!bucketReady) {
        setExpenseFileError("無法連接儲存服務，請稍後再試。");
        setExpenseFileUploading(false);
        return;
      }
      const uploadedUrls: string[] = [];
      const failedFiles: string[] = [];

      for (const file of Array.from(files)) {
        const filePath = buildStorageObjectKeyWithSanitizedName("expenses", file.name);
        const { error: uploadError } = await supabase.storage
          .from("income-files")
          .upload(filePath, file, { upsert: true });
        if (uploadError) {
          failedFiles.push(file.name);
          continue;
        }
        const { data: publicUrlData } = supabase.storage
          .from("income-files")
          .getPublicUrl(filePath);
        if (publicUrlData?.publicUrl) {
          uploadedUrls.push(publicUrlData.publicUrl);
        }
      }
      if (uploadedUrls.length > 0) {
        setExpenseForm(prev => {
          const existing = prev.pdf_file ? prev.pdf_file.split(",").map(u => u.trim()).filter(Boolean) : [];
          const combined = [...existing, ...uploadedUrls].join(",");
          return { ...prev, pdf_file: combined };
        });
      }
      if (failedFiles.length > 0) {
        setExpenseFileError(`以下檔案上傳失敗: ${failedFiles.join(", ")}`);
      }
    } catch (err: any) {
      setExpenseFileError(err.message || "上傳失敗");
    }
    setExpenseFileUploading(false);
  };

  // Supplier quotation (供應商報價單) uploader — same storage flow as the
  // attachment field, but writes to the supplier_quotation_file column.
  const handleExpenseQuotationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setExpenseQuotationUploading(true);
    setExpenseQuotationError(null);
    try {
      const bucketReady = await ensureIncomeBucket();
      if (!bucketReady) {
        setExpenseQuotationError("無法連接儲存服務，請稍後再試。");
        setExpenseQuotationUploading(false);
        return;
      }
      const uploadedUrls: string[] = [];
      const failedFiles: string[] = [];
      for (const file of Array.from(files)) {
        const filePath = buildStorageObjectKeyWithSanitizedName("expenses", file.name);
        const { error: uploadError } = await supabase.storage
          .from("income-files")
          .upload(filePath, file, { upsert: true });
        if (uploadError) {
          failedFiles.push(file.name);
          continue;
        }
        const { data: publicUrlData } = supabase.storage
          .from("income-files")
          .getPublicUrl(filePath);
        if (publicUrlData?.publicUrl) uploadedUrls.push(publicUrlData.publicUrl);
      }
      if (uploadedUrls.length > 0) {
        const currentForm = expenseFormRef.current;
        const existing = currentForm.supplier_quotation_file
          ? currentForm.supplier_quotation_file.split(",").map((u) => u.trim()).filter(Boolean)
          : [];
        const combined = [...existing, ...uploadedUrls].join(",");
        setExpenseForm((prev) => ({ ...prev, supplier_quotation_file: combined }));
        if (editingExpense?.id) {
          const persistResult = await updateExpense(
            editingExpense.id,
            { supplier_quotation_file: combined },
            staff?.id
          );
          if (!persistResult.success) {
            setExpenseQuotationError(persistResult.error || "報價單已上傳，但未能寫入支出記錄，請再按更新。");
          }
        }
      }
      if (failedFiles.length > 0) {
        setExpenseQuotationError(`以下檔案上傳失敗: ${failedFiles.join(", ")}`);
      }
    } catch (err: any) {
      setExpenseQuotationError(err.message || "上傳失敗");
    }
    setExpenseQuotationUploading(false);
    e.target.value = "";
  };

  // ─── Income File Upload Helpers ────────────────────────
  const normalizeFileUrl = (url: string): string => {
    let normalized = url.trim();
    if (normalized.startsWith("//")) {
      normalized = `https:${normalized}`;
    }
    return normalized;
  };

  const parseFileUrls = (pdfFile: string | null): string[] => {
    if (!pdfFile) return [];
    return pdfFile
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean)
      .map(normalizeFileUrl);
  };

  const getFileName = (url: string): string => {
    try {
      const decoded = decodeURIComponent(
        normalizeFileUrl(url).split("/").pop()?.split("?")[0] || "file"
      );
      return decoded.length > 30 ? decoded.slice(0, 27) + "..." : decoded;
    } catch {
      return "file";
    }
  };

  const getFileExtension = (url: string): string => {
    const name = normalizeFileUrl(url).split("/").pop()?.split("?")[0] || "";
    const ext = name.split(".").pop()?.toLowerCase() || "";
    return ext;
  };

  const [incomeFileError, setIncomeFileError] = useState<string | null>(null);

  const ensureIncomeBucket = async (): Promise<boolean> => {
    try {
      // Try listing to check if bucket exists
      const { error: listError } = await supabase.storage.from("income-files").list("", { limit: 1 });
      if (listError) {
        // Bucket may not exist — try creating it
        console.warn("income-files bucket check failed, attempting create:", listError.message);
        const { error: createError } = await supabase.storage.createBucket("income-files", {
          public: true,
          fileSizeLimit: 52428800, // 50MB
        });
        if (createError && !createError.message?.includes("already exists")) {
          console.error("Bucket creation failed:", createError);
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleIncomeFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIncomeFileUploading(true);
    setIncomeFileError(null);
    try {
      // Ensure bucket exists before uploading
      const bucketReady = await ensureIncomeBucket();
      if (!bucketReady) {
        setIncomeFileError("無法連接儲存服務，請稍後再試。");
        setIncomeFileUploading(false);
        e.target.value = "";
        return;
      }

      const existingUrls = parseFileUrls(incomeForm.pdf_file);
      const newUrls: string[] = [];
      const failedFiles: string[] = [];

      for (const file of Array.from(files)) {
        const path = buildStorageObjectKeyWithSanitizedName(`incomes/${projectId}`, file.name);

        const { error } = await supabase.storage
          .from("income-files")
          .upload(path, file, { upsert: true });

        if (error) {
          console.error("Upload error for", file.name, ":", error);
          failedFiles.push(file.name);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("income-files")
          .getPublicUrl(path);

        if (urlData?.publicUrl) {
          newUrls.push(urlData.publicUrl);
        }
      }

      if (failedFiles.length > 0) {
        setIncomeFileError(`以下檔案上傳失敗: ${failedFiles.join(", ")}`);
      }

      if (newUrls.length > 0) {
        console.log("[handleIncomeFileUpload] Upload success, newUrls:", newUrls);
        setIncomeForm((prev) => {
          // Read existing urls from prev state (not closure) to avoid stale data
          const currentUrls = parseFileUrls(prev.pdf_file);
          const allUrls = [...currentUrls, ...newUrls];
          const finalValue = allUrls.join(",") || null;
          console.log("[handleIncomeFileUpload] Setting pdf_file to:", finalValue);
          const next = { ...prev, pdf_file: finalValue };
          // Sync ref immediately so handleSaveIncome always has latest value
          incomeFormRef.current = next;
          return next;
        });
      }
    } catch (err) {
      console.error("File upload failed:", err);
      setIncomeFileError("檔案上傳時發生錯誤，請重試。");
    }
    setIncomeFileUploading(false);
    // Reset the input so re-upload of same file works
    e.target.value = "";
  };

  const removeIncomeFileUrl = (indexToRemove: number) => {
    setIncomeForm((prev) => {
      const urls = parseFileUrls(prev.pdf_file);
      const updated = urls.filter((_, i) => i !== indexToRemove);
      const next = {
        ...prev,
        pdf_file: updated.length > 0 ? updated.join(",") : null,
      };
      incomeFormRef.current = next;
      return next;
    });
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== "Confirm Delete") return;
    setCascadeExecuting(true);
    const result = await executeCascadeDelete(
      projectId,
      cascadeSelections,
      true, // always delete project
      deletePitching,
      deleteCustomer
    );
    setCascadeDeletionLog(result.deletion_log || null);
    if (result.success) {
      setTimeout(() => router.push("/projects/bwa"), 1500);
    }
    setCascadeExecuting(false);
  };

  // Load cascade analysis when dialog opens
  useEffect(() => {
    if (showDeleteDialog) {
      setDeleteConfirmText("");
      setDeleteAttempts(0);
      setCascadeStep("analysis");
      setCascadeAnalysis(null);
      setCascadeSelections({});
      setDeletePitching(false);
      setDeleteCustomer(false);
      setCascadeDeletionLog(null);
      setCascadeLoading(true);
      analyzeCascadeDelete(projectId).then(({ data, error }) => {
        if (data) {
          setCascadeAnalysis(data);
          // Default: select all for deletion
          const defaults: Record<string, boolean> = {};
          data.related_groups.forEach((g) => { defaults[g.table] = true; });
          if (data.pitching_chain?.children) {
            data.pitching_chain.children.forEach((c) => { defaults[c.table] = true; });
          }
          setCascadeSelections(defaults);
          setDeletePitching(!!data.pitching_chain);
        }
        setCascadeLoading(false);
      });
      setTimeout(() => deleteInputRef.current?.focus(), 300);
    }
  }, [showDeleteDialog, projectId]);

  // ─── Status Update (Super Admin / Admin only) ────────────────
  const staffRole = (staff as any)?.role as string | null;
  const canUpdateStatus = staffRole === "Super Admin" || staffRole === "Admin";

  const handleStatusUpdate = async (newStatus: string) => {
    if (!data || !canUpdateStatus) return;
    setStatusUpdating(true);
    const { error } = await supabase
      .from("bwa_projects")
      .update({ status: newStatus })
      .eq("id", projectId);
    if (error) {
      console.error("[BWAProjectDetail] Status update failed:", error.message);
    } else {
      setData({ ...data, status: newStatus });
    }
    setStatusUpdating(false);
    setShowStatusDialog(false);
  };

  const openCustomerEdit = () => {
    if (!data?.customer_id) return;
    setCustomerForm({
      customer_name: data.customer_raw_name || data.customer_name || "",
      display_name: data.customer_display_name || "",
      company_name: data.customer_raw_company || "",
      email: data.customer_email || "",
      phone_display: data.customer_phone || "",
      address: data.customer_address || "",
    });
    setShowCustomerEdit(true);
  };

  const handleCustomerSave = async () => {
    if (!data?.customer_id) return;
    setCustomerSaving(true);
    const result = await updateCustomer(data.customer_id, {
      customer_name: customerForm.customer_name || undefined,
      display_name: customerForm.display_name || undefined,
      company_name: customerForm.company_name || undefined,
      email: customerForm.email || undefined,
      phone_display: customerForm.phone_display || undefined,
      address: customerForm.address || undefined,
    });
    setCustomerSaving(false);
    if (result.success) {
      setShowCustomerEdit(false);
      loadData(true); // silent reload
    }
  };

  // Calculate margin
  const estimatedMargin = data?.estimated_income && data?.estimated_expense
    ? data.estimated_income - data.estimated_expense
    : data?.estimated_profit || null;
  const marginPercent = data?.estimated_income && estimatedMargin != null
    ? ((estimatedMargin / data.estimated_income) * 100).toFixed(2)
    : null;

  // Income/expense totals
  const totalIncome = data?.incomes?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0;
  const totalExpense = data?.expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

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
        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-gray-300" />
        </div>
        <p className="text-sm text-gray-500">找不到此項目</p>
        <Button variant="outline" size="sm" onClick={(e) => handleNavClick("/projects/bwa", e, (href) => router.push(href))}>
          <ArrowLeft className="w-4 h-4 mr-1" /> 返回項目列表
        </Button>
      </div>
    );
  }

  // ─── Access Denied for User / Senior User ─────────────────────
  if (accessChecked && accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800">存取被拒絕</h3>
        <p className="text-sm text-gray-500 text-center max-w-md">
          您沒有權限查看此項目。只有被分配到此項目的團隊成員才能查看詳情。
        </p>
        <Button variant="outline" size="sm" onClick={(e) => handleNavClick("/projects/bwa", e, (href) => router.push(href))}>
          <ArrowLeft className="w-4 h-4 mr-1" /> 返回項目列表
        </Button>
      </div>
    );
  }

  // Tab ID → permission sub-module mapping
  const tabPermissionModule: Record<string, string> = {
    "overview": "projects.overview",
    "docs": "projects.docs",
    "box-files": "projects.docs",
    "3d": "projects.3d",
    "weekly-report": "projects.weekly-report",
    "manhour": "projects.manhour",
    "work-schedule": "projects.work-schedule",
    "site-status": "projects.site-status",
    "supplier-comment": "projects.supplier-comment",
    "building-comment": "projects.building-comment",
    "asana": "projects.overview",
    "internal-review": "projects.internal-review",
    "tender": "projects.tender",
    "income": "projects.income",
    "expense": "projects.expense",
    "cost-structure": "projects.cost-structure",
    "payment-schedule": "projects.payment-schedule",
    "expense-control": "projects.expense-control",
  };

  // Helper: check if tab is viewable (falls back to true if permissions still loading)
  const canViewTab = (tabId: string) => {
    if (permLoading) return true; // Show all tabs while permissions load
    const mod = tabPermissionModule[tabId];
    if (!mod) return true;
    return canView(mod);
  };

  // Tabs matching Bubble's "Group Tab bar" structure
  // Split into two rows: 項目資料 (Project Info) and 財務資料 + 項目評論 (Financial + Comments)
  // Hide "Work Schedule" tab when the project has no os_schedule_group assigned
  // Filter tabs by canView permission
  // Hide "Site Status" tab for Mini 項目規模 projects.
  const scheduleGroup = resolveOsScheduleGroup(
    data.n_service_type_id,
    data.estimated_income,
    data.os_schedule_group,
  );
  const hasScheduleGroup = !!scheduleGroup;
  const isMiniProject = isBwaMiniProjectSize(data.project_size, data.estimated_income);

  const handleExpenseControlFix = (key: string, item: ExpenseControlItem) => {
    const customerTypeKey = EXPENSE_CONTROL_CUSTOMER_DOC_TYPE_KEYS[key];
    if (customerTypeKey) {
      setExpenseControlDocsFocus({ customerDocsFocusTypeKey: customerTypeKey });
      setActiveTab("docs");
      return;
    }
    if (EXPENSE_CONTROL_DOC_UPLOAD_KEYS.has(key)) {
      setExpenseControlDocsFocus({
        highlightDocTypeIds: item.meta?.missingDocTypeIds,
        openUploadForDocTypeId: item.meta?.firstMissingDocTypeId ?? undefined,
      });
      setActiveTab("docs");
      return;
    }
    switch (key) {
      case "dates":
        setEditDialogScrollTo("key-dates");
        setShowEditDialog(true);
        break;
      case "installment-vs-income":
        setActiveTab("expense");
        break;
      case "overdue-income-expected-date":
        setActiveTab("income");
        break;
      case "schedule":
        setActiveTab("work-schedule");
        break;
      case "main-contractor":
        setExpenseControlFocus("main-contractor");
        setActiveTab("expense");
        break;
      case "site-status":
        setActiveTab("site-status");
        break;
      case "ten-day-reports":
        setActiveTab("weekly-report");
        break;
      case "rendering":
        setActiveTab("3d");
        break;
      case "internal-comment":
        setActiveTab("internal-review");
        break;
      case "supplier-comment":
        setActiveTab("supplier-comment");
        break;
      default:
        break;
    }
  };

  const canFixExpenseControlItem = (key: string) => {
    if (EXPENSE_CONTROL_CUSTOMER_DOC_TYPE_KEYS[key]) {
      return canCreate("projects.docs") || canEdit("projects.docs") || canCreate("clients") || canEdit("clients");
    }
    const mod = EXPENSE_CONTROL_FIX_ACTIONS[key]?.permissionModule;
    if (!mod) return false;
    if (key === "dates" || key === "main-contractor") {
      return canEdit("projects") || canEdit(mod);
    }
    if (key === "installment-vs-income") {
      return (
        canEdit("projects.expense") ||
        canCreate("projects.expense") ||
        canEdit("projects.income") ||
        canCreate("projects.income")
      );
    }
    if (key === "overdue-income-expected-date") {
      return canEdit("projects.income") || canCreate("projects.income");
    }
    if (
      EXPENSE_CONTROL_DOC_UPLOAD_KEYS.has(key) ||
      key === "rendering" ||
      key === "ten-day-reports"
    ) {
      return canCreate(mod) || canEdit(mod);
    }
    if (key === "internal-comment" || key === "supplier-comment") {
      return canCreate(mod) || canEdit(mod);
    }
    return canEdit(mod);
  };

  const projectTabs = [
    { id: "overview", label: "Overview", icon: ClipboardList },
    {
      id: "asana",
      label: "Asana",
      icon: ({ className }: { className?: string }) => (
        <AsanaIcon size={14} className={className || ""} />
      ),
    },
    { id: "docs", label: "Docs", icon: FileText },
    { id: "box-files", label: "Box Files", icon: FolderOpen },
    { id: "3d", label: "3D Render", icon: Box },
    { id: "weekly-report", label: "10 Day's Report", icon: ClipboardList },
    { id: "manhour", label: "Man Hour", icon: Clock },
    ...(hasScheduleGroup ? [{ id: "work-schedule", label: "Work Schedule", icon: CalendarDays }] : []),
    ...(isMiniProject ? [] : [{ id: "site-status", label: "Site Status", icon: HardHat }]),
    { id: "tender", label: "RFQ", icon: Gavel },
  ].filter(tab => canViewTab(tab.id));
  const financeTabs = [
    { id: "income", label: "Income", icon: ArrowDownCircle },
    { id: "expense", label: "Expense", icon: ArrowUpCircle },
    { id: "cost-structure", label: "Cost Structure", icon: BarChart3 },
    { id: "payment-schedule", label: "Payment Schedule", icon: CreditCard },
    { id: "expense-control", label: "Expense Control", icon: Shield },
  ].filter(tab => canViewTab(tab.id));
  const commentTabs = [
    { id: "internal-review", label: "Internal Review", icon: Shield },
    { id: "supplier-comment", label: "Supplier Comment", icon: MessageCircle },
    { id: "building-comment", label: "Building Comment", icon: Building2 },
  ].filter(tab => canViewTab(tab.id));

  return (
    <div className="space-y-0 w-full">
      {/* ─── BREADCRUMB ──────────────────────────────── */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
        <button onClick={(e) => handleNavClick("/projects/bwa", e, (href) => router.push(href))} className="hover:text-gray-600 transition-colors">
          BWA 項目管理
        </button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-600 font-medium">{data.project_code || "項目詳情"}</span>
      </div>

      {/* ─── HEADER CARD ─────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
        {/* Top accent bar - blue for BWA */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-blue-400 to-blue-300 rounded-t-xl" />
        
        <div className="p-6">
          <div className="flex items-start justify-between">
            {/* Left: Back + Info */}
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <button
                onClick={() => router.back()}
                className="mt-1 w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-gray-500" />
              </button>
              
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                    {data.project_name || "未命名項目"}
                  </h1>
                  <Badge className="bg-blue-500 text-white hover:bg-blue-500 text-[12px] px-2 py-0 font-bold rounded-md">
                    BWA
                  </Badge>
                  {canUpdateStatus ? (
                    <button onClick={() => setShowStatusDialog(true)} className="cursor-pointer hover:opacity-80 transition-opacity" title="點擊更改狀態">
                      <ProjectStatusBadge status={data.status} className="text-xs" />
                    </button>
                  ) : (
                    <ProjectStatusBadge status={data.status} className="text-xs" />
                  )}
                  {paymentBadge(data.payment_status)}
                  {isMiniProject && (
                    <Badge className="bg-teal-500/10 text-teal-700 hover:bg-teal-500/10 text-[12px] px-2 py-0 font-bold rounded-md border border-teal-200">
                      Mini-Project
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  {data.project_code && (
                    <span className="font-medium text-gray-500">{data.project_code}</span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                  {(data.customer_raw_name || data.customer_name) && (
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      {data.customer_raw_name || data.customer_name}
                    </span>
                  )}
                  {(data.customer_raw_company || data.customer_display_name) && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        {data.customer_raw_company || data.customer_display_name}
                      </span>
                    </>
                  )}
                  {data.signed_date && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        簽約 {formatShortDate(data.signed_date)}
                      </span>
                    </>
                  )}
                  {data.pm_name && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        PM: {data.pm_name}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Quick links */}
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
                {data.working_folder && isBoxWorkingFolder(data.working_folder) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setActiveTab("box-files")}
                        className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                      >
                        <FolderOpen className="w-4 h-4 text-gray-500" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent><p className="text-xs">Box 工作資料夾</p></TooltipContent>
                  </Tooltip>
                )}
              </TooltipProvider>

              <Separator orientation="vertical" className="h-6 mx-1" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-9 p-0">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {canEdit("projects") && (
                  <DropdownMenuItem
                    className="gap-2 text-[15px]"
                    onClick={() => setShowEditDialog(true)}
                  >
                    <Pencil className="w-3.5 h-3.5" /> 編輯項目
                  </DropdownMenuItem>
                  )}
                  {canUpdateStatus && (
                  <>
                  <DropdownMenuSeparator />
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
            <div className="flex items-center gap-0 overflow-x-auto max-w-full" style={{ scrollbarWidth: 'none' }}>
              <span className="text-[12px] text-blue-500 uppercase tracking-wider font-semibold mr-2 flex-shrink-0 py-2.5">項目資料</span>
              {projectTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      relative flex items-center gap-1.5 px-3 py-2.5 text-[14px] font-medium transition-colors whitespace-nowrap flex-shrink-0
                      ${isActive
                        ? "text-blue-600"
                        : "text-gray-400 hover:text-gray-600"
                      }
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
              <div className="flex items-center gap-0 overflow-x-auto max-w-full" style={{ scrollbarWidth: 'none' }}>
                <span className="text-[12px] text-amber-400 uppercase tracking-wider font-semibold mr-2 flex-shrink-0 py-2.5">財務資料</span>
                {financeTabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        relative flex items-center gap-1.5 px-3 py-2.5 text-[14px] font-medium transition-colors whitespace-nowrap flex-shrink-0
                        ${isActive
                          ? "text-amber-600"
                          : "text-gray-400 hover:text-gray-600"
                        }
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
                <div className="flex items-center gap-0 overflow-x-auto max-w-full xl:ml-auto" style={{ scrollbarWidth: 'none' }}>
                  <span className="text-[12px] text-violet-500 uppercase tracking-wider font-semibold mr-2 flex-shrink-0 py-2.5">項目評論</span>
                  {commentTabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                          relative flex items-center gap-1.5 px-3 py-2.5 text-[14px] font-medium transition-colors whitespace-nowrap flex-shrink-0
                          ${isActive
                            ? "text-violet-600"
                            : "text-gray-400 hover:text-gray-600"
                          }
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

      {/* ─── TAB CONTENT ───────────────────────────────── */}
      <div className="animate-fade-in-up pt-6">
        {/* Permission guard: if current tab is denied, show message */}
        {!canViewTab(activeTab) ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
              <Shield className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-sm text-gray-500 font-medium">您沒有查看此分頁的權限</p>
            <p className="text-xs text-gray-400">如需存取權限，請聯繫管理員</p>
          </div>
        ) : (
        <>
        {/* OVERVIEW TAB — Bubble "Group text Overview" */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Site photos (stored on the linked pitching; editable there) */}
            <SitePhotosGallery
              rawPhotos={data.site_photos}
              pitchingId={data.pitching_id}
              editable={canEdit("projects.overview")}
              onSaved={() => loadData(true)}
            />

            {/* Financial summary — Bubble "財政 Financials" section */}
            <SectionCard title="財政 Financials" icon={DollarSign} iconColor="text-blue-500">
              {(() => {
                const actualGrossProfit = totalIncome - totalExpense;
                const actualGPRatio = totalIncome > 0 ? ((actualGrossProfit / totalIncome) * 100).toFixed(2) : "0.00";
                const estGPRatio = marginPercent ?? "0.00";
                const estGrossProfit = estimatedMargin || 0;

                return (
                  <div className="space-y-6">
                    {/* Estimated Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">預計收入 <span className="text-xs text-gray-400">Estimated Income</span></p>
                        <p className="text-xl font-bold font-mono-num text-gray-900">{formatMoney(data.estimated_income)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">預計支出 <span className="text-xs text-gray-400">Estimated Expense</span></p>
                        <p className="text-xl font-bold font-mono-num text-gray-900">{formatMoney(data.estimated_expense)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">預計毛利 <span className="text-xs text-gray-400">Estimated Gross Profit</span></p>
                        <p className="text-xl font-bold font-mono-num text-gray-900">{formatMoney(estGrossProfit)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">預計毛利率 <span className="text-xs text-gray-400">Estimated Profit Margin</span></p>
                        <p className="text-xl font-bold font-mono-num text-gray-900">{estGPRatio}%</p>
                      </div>
                    </div>

                    {/* Actual Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">實際收入 <span className="text-xs text-gray-400">Actual Income</span></p>
                        <p className="text-xl font-bold font-mono-num text-gray-900">{totalIncome > 0 ? formatMoney(totalIncome) : <span className="text-gray-400">N/A</span>}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">實際支出 <span className="text-xs text-gray-400">Actual Expense</span></p>
                        <p className="text-xl font-bold font-mono-num text-gray-900">{formatMoney(totalExpense)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">實際毛利 <span className="text-xs text-gray-400">Actual Gross Profit</span></p>
                        <p className={`text-xl font-bold font-mono-num ${actualGrossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatMoney(actualGrossProfit)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">實際毛利率 <span className="text-xs text-gray-400">Actual Profit Margin</span></p>
                        <p className={`text-xl font-bold font-mono-num ${parseFloat(actualGPRatio) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{actualGPRatio}%</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </SectionCard>

            {/* Info Grid - Row 1: 3 columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* General Info */}
              <SectionCard title="基本資訊" icon={FileText} iconColor="text-blue-500">
                <DetailRow label="項目編號" value={data.project_code} icon={Tag} iconColor="text-blue-500" />
                <DetailRow label="項目名稱" value={data.project_name} icon={FileText} />
                <DetailRow label="描述" value={data.description} icon={FileText} />
                <DetailRow label="項目規模" value={data.project_size || "N/A"} icon={BarChart3} />
                <DetailRow label="服務類型" value={data.service_type_name} icon={Tag} />
                {data.project_type_name && (
                  <DetailRow label="項目類型" value={data.project_type_name} icon={Tag} />
                )}
                {data.real_cost_centre && (
                  <DetailRow label="成本中心" value={data.real_cost_centre} icon={CreditCard} />
                )}
                <DetailRow label="財政年度" value={data.financial_year_name} icon={Calendar} />
                <DetailRow label="團隊類型" value={data.team_type_name} icon={Users} />
              </SectionCard>

              {/* Customer Info */}
              <SectionCard
                title="客戶資訊"
                icon={Building2}
                iconColor="text-amber-500"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-gray-800 truncate">
                        {data.customer_display_name ||
                          data.customer_name ||
                          "未命名客戶"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {data.customer_id && canEdit("projects.overview") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600"
                        onClick={openCustomerEdit}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {data.customer_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600"
                        onClick={(e) => handleNavClick(`/clients/${data.customer_id}`, e, (href) => router.push(href))}
                        title="查看客戶詳情"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <Separator className="my-1" />
                <DetailRow label="客戶名稱" value={data.customer_raw_name} icon={User} />
                <DetailRow label="公司名稱" value={data.customer_raw_company} icon={Building2} />
                {data.customer_email && (
                  <DetailRow label="電郵" value={data.customer_email} icon={Mail} />
                )}
                {data.customer_phone && (
                  <DetailRow label="電話" value={data.customer_phone} icon={Phone} />
                )}
                {data.customer_address && (
                  <DetailRow label="地址" value={data.customer_address} icon={MapPin} />
                )}
                <DetailRow label="地區" value={data.district_name} icon={MapPin} iconColor="text-emerald-500" />
                <DetailRow label="大廈" value={data.building_name} icon={Building2} />
                <DetailRow label="工程地址 Site Address" value={data.site_address} icon={MapPin} />
                <DetailRow label="實用面積" value={data.actual_size ? `${data.actual_size} sqft` : "N/A"} icon={FolderOpen} mono />
                {!data.customer_raw_name && !data.customer_raw_company && !data.customer_id && (
                  <p className="text-[15px] text-gray-400 py-3 text-center">
                    暫無客戶資料
                  </p>
                )}
                {data.customer_id && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <button
                      className="text-[14px] text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                      onClick={(e) => handleNavClick(`/clients/${data.customer_id}`, e, (href) => router.push(href))}
                    >
                      查看客戶詳情 <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </SectionCard>

              {/* Schedule overview */}
              <SectionCard title="工程時間表概覽" icon={CalendarDays} iconColor="text-amber-500">
                <DetailRow label="查詢日期" value={formatDate(data.enquiry_date)} icon={Calendar} />
                <DetailRow label="簽約日期" value={formatDate(data.signed_date)} icon={Calendar} iconColor="text-blue-500" />
                <DetailRow label="開工日期" value={formatDate(data.start_date)} icon={Calendar} iconColor="text-emerald-500" />
                <DetailRow label="交付日期" value={formatDate(data.handover_date)} icon={Calendar} iconColor="text-violet-500" />
                <DetailRow label="執漏完成日期" value={formatDate(data.defect_done_date)} icon={Calendar} iconColor="text-amber-500" />
                {data.e_outstanding_date && (
                  <DetailRow label="結欠日期" value={formatDate(data.e_outstanding_date)} icon={Calendar} iconColor="text-red-500" />
                )}
                {data.required_check_date && (
                  <DetailRow label="審查日期" value={formatDate(data.required_check_date)} icon={Calendar} />
                )}
              </SectionCard>
            </div>

            {/* Info Grid - Row 2: 2 columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Suppliers/Contractors + Links */}
              <SectionCard title="供應商 & 連結" icon={Wrench} iconColor="text-orange-500">
                {(data.main_contractor_name || data.main_contractor_id) && (
                  <DetailRow label="主承建商" value={data.main_contractor_name || "—"} icon={HardHat} iconColor="text-orange-500" />
                )}
                {(data.main_air_supplier_name || data.main_air_supplier_id) && (
                  <DetailRow label="冷氣供應商" value={data.main_air_supplier_name || "—"} icon={Wind} />
                )}
                {(data.main_network_supplier_name || data.main_network_supplier_id) && (
                  <DetailRow label="網絡供應商" value={data.main_network_supplier_name || "—"} icon={Wifi} />
                )}
                {!data.main_contractor_name && !data.main_contractor_id && !data.main_air_supplier_name && !data.main_air_supplier_id && !data.main_network_supplier_name && !data.main_network_supplier_id && (
                  <p className="text-[15px] text-gray-400 py-3 text-center">暫無供應商資料</p>
                )}
                <div className="border-t border-gray-100 mt-3 pt-3">
                  <DetailRow label="Asana 連結" value="開啟連結" icon={({ className }: { className?: string }) => <AsanaIcon size={14} className={className || ""} />} isLink={!!data.asana_link} href={data.asana_link || undefined} />
                  <DetailRow label="工作資料夾" value="開啟資料夾" icon={FolderOpen} isLink={!!data.working_folder} href={data.working_folder || undefined} />
                  {data.pitching_id && (
                    <DetailRow label="關聯提案" value={
                      <button className="text-blue-600 hover:text-blue-700 hover:underline text-[15px]" onClick={() => window.open(`/proposals/${data.pitching_id}`, "_blank", "noopener")}>
                        查看提案
                      </button>
                    } icon={FileText} iconColor="text-blue-500" />
                  )}
                  {data.slug && (<DetailRow label="Slug" value={data.slug} icon={Tag} />)}
                </div>
              </SectionCard>

              {/* ─── 團隊 (Project BV) Section ─────────────────────────── */}
              <SectionCard title="團隊" icon={Users} iconColor="text-violet-500">
                <TooltipProvider delayDuration={200}>
                {bvLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Main PM Row */}
                    {(() => {
                      const pmBV = projectBV.find(
                        (bv) => bv.handler_id === data.main_pm_id
                      );
                      return (
                        <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg border border-blue-100 bg-blue-50/30 group">
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <User className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[15px] font-semibold text-gray-800 truncate">
                                {pmBV?.handler_name || data.pm_name || "N/A"}
                              </span>
                              <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/20 hover:bg-blue-500/10 text-[12px] px-1.5 py-0">
                                主管 PM
                              </Badge>
                            </div>
                            {pmBV && pmBV.ratio != null && (
                              <span className="text-[13px] text-gray-400">佔比 {formatBVRatio(pmBV.ratio)}</span>
                            )}
                            {!pmBV && (
                              <span className="text-[13px] text-gray-400">N/A — 尚無 BV 記錄</span>
                            )}
                          </div>
                          {pmBV && !(isCompanyBV(pmBV.handler_id) && !isSuperAdmin) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-blue-100"
                                  onClick={() => handleBVEdit(pmBV)}
                                >
                                  <Pencil className="w-3 h-3 text-blue-500" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top"><p className="text-xs">編輯負責人</p></TooltipContent>
                            </Tooltip>
                          )}
                          {/* No delete button for main_pm BV */}
                        </div>
                      );
                    })()}

                    {/* Main Designer Row */}
                    {(() => {
                      const designerBV = projectBV.find(
                        (bv) => bv.handler_id === data.main_designer_id
                      );
                      return (
                        <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg border border-violet-100 bg-violet-50/30 group">
                          <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                            <Palette className="w-3.5 h-3.5 text-violet-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[15px] font-semibold text-gray-800 truncate">
                                {designerBV?.handler_name || data.designer_name || "N/A"}
                              </span>
                              <Badge className="bg-violet-500/10 text-violet-600 border border-violet-500/20 hover:bg-violet-500/10 text-[12px] px-1.5 py-0">
                                主管設計師
                              </Badge>
                            </div>
                            {designerBV && designerBV.ratio != null && (
                              <span className="text-[13px] text-gray-400">佔比 {formatBVRatio(designerBV.ratio)}</span>
                            )}
                            {!designerBV && (
                              <span className="text-[13px] text-gray-400">N/A — 尚無 BV 記錄</span>
                            )}
                          </div>
                          {designerBV && !(isCompanyBV(designerBV.handler_id) && !isSuperAdmin) && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className="p-1 rounded hover:bg-violet-100"
                                    onClick={() => handleBVEdit(designerBV)}
                                  >
                                    <Pencil className="w-3 h-3 text-violet-500" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-xs">編輯負責人</p></TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className="p-1 rounded hover:bg-red-100"
                                    onClick={() => handleBVDelete(designerBV.id)}
                                    disabled={bvDeleting === designerBV.id}
                                  >
                                    {bvDeleting === designerBV.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin text-red-400" />
                                    ) : (
                                      <Trash2 className="w-3 h-3 text-red-400" />
                                    )}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-xs">刪除</p></TooltipContent>
                              </Tooltip>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Other BV Records */}
                    {(() => {
                      const otherBVs = projectBV.filter(
                        (bv) =>
                          bv.handler_id !== data.main_pm_id &&
                          bv.handler_id !== data.main_designer_id
                      );
                      if (otherBVs.length === 0) return null;
                      return (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-[13px] text-gray-400 font-medium mb-2">
                            其他 BV 記錄 ({otherBVs.length})
                          </p>
                          <div className="space-y-2">
                            {otherBVs.map((bv) => (
                              <div
                                key={bv.id}
                                className="flex items-center gap-3 py-2 px-3 rounded-lg border border-gray-100 bg-gray-50/50 group"
                              >
                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                  <User className="w-3 h-3 text-gray-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-[14px] font-medium text-gray-700 truncate block">
                                    {bv.handler_name || "未知"}
                                  </span>
                                  {bv.ratio != null && (
                                    <span className="text-[13px] text-gray-400">佔比 {formatBVRatio(bv.ratio)}</span>
                                  )}
                                </div>
                                {/* Hide edit/delete for company BV unless Super Admin */}
                                {!(isCompanyBV(bv.handler_id) && !isSuperAdmin) && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        className="p-1 rounded hover:bg-gray-200"
                                        onClick={() => handleBVEdit(bv)}
                                      >
                                        <Pencil className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top"><p className="text-xs">編輯負責人</p></TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        className="p-1 rounded hover:bg-red-100"
                                        onClick={() => handleBVDelete(bv.id)}
                                        disabled={bvDeleting === bv.id}
                                      >
                                        {bvDeleting === bv.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin text-red-400" />
                                        ) : (
                                          <Trash2 className="w-3 h-3 text-red-400" />
                                        )}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top"><p className="text-xs">刪除</p></TooltipContent>
                                  </Tooltip>
                                </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {projectBV.length === 0 && !bvLoading && (
                      <p className="text-[14px] text-gray-400 text-center py-4">
                        暫無 Project BV 記錄
                      </p>
                    )}

                    {/* Add Member Button */}
                    <div className="pt-2 border-t border-gray-100">
                      <button
                        className="flex items-center gap-1.5 text-[14px] text-violet-600 hover:text-violet-700 font-medium hover:underline"
                        onClick={handleBVAdd}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        新增團隊成員
                      </button>
                    </div>
                  </div>
                )}
                </TooltipProvider>
              </SectionCard>
            </div>
          </div>
        )}

        {/* INCOME TAB — Grouped by Contract Type with CRUD */}
        {activeTab === "income" && (() => {
          // Group incomes by n_contract_type_id
          const incomes = data.incomes || [];
          const grouped = new Map<string, { name: string; incomes: BWAProjectIncome[]; total: number; paid: number; outstanding: number }>();
          const UNCATEGORIZED_KEY = "__uncategorized__";

          incomes.forEach((inc) => {
            const key = inc.n_contract_type_id || UNCATEGORIZED_KEY;
            if (!grouped.has(key)) {
              grouped.set(key, {
                name: inc.contract_type_name || "未分類",
                incomes: [],
                total: 0,
                paid: 0,
                outstanding: 0,
              });
            }
            const g = grouped.get(key)!;
            g.incomes.push(inc);
            g.total += (inc.amount || 0);
            g.paid += (inc.payment_amount || 0);
            g.outstanding += incomeNetOutstanding(inc);
          });

          // Expanded list: 到期日 newest → oldest; null/invalid dates last
          for (const g of grouped.values()) {
            g.incomes.sort((a, b) => {
              const aTime = a.due_date ? new Date(a.due_date).getTime() : -Infinity;
              const bTime = b.due_date ? new Date(b.due_date).getTime() : -Infinity;
              const aValid = !isNaN(aTime) ? aTime : -Infinity;
              const bValid = !isNaN(bTime) ? bTime : -Infinity;
              return bValid - aValid;
            });
          }

          const groupEntries = Array.from(grouped.entries());

          return (
          <div className="space-y-6">
            {/* Header with stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="預計收入 Estimated" value={formatMoney(data.estimated_income)} icon={TrendingUp} accentColor="bg-blue-500" />
              <MetricCard label="實際收入 Actual" value={formatMoney(totalIncome)} subtext={`${incomes.length} 筆收入`} icon={ArrowDownCircle} accentColor="bg-emerald-500" />
              <MetricCard label="已收款 Paid" value={formatMoney(incomes.reduce((s, i) => s + (i.payment_amount || 0), 0))} icon={CheckCircle2} accentColor="bg-violet-500" />
              <MetricCard label="待收款 Outstanding" value={formatMoney(incomes.reduce((s, i) => s + incomeNetOutstanding(i), 0))} icon={AlertTriangle} accentColor="bg-red-500" />
            </div>

            <SectionCard title={`合約類型分組 (${groupEntries.length} 類)`} icon={Receipt} iconColor="text-emerald-500">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-gray-400">按合約類型分組顯示收入，點擊展開查看明細</p>
                {canCreateIncome && (
                <Button size="sm" className="h-8 gap-1.5 text-[14px] bg-emerald-500 hover:bg-emerald-600" onClick={() => openCreateIncome()}>
                  <Plus className="w-3.5 h-3.5" /> 新增收入
                </Button>
                )}
              </div>

              {groupEntries.length > 0 ? (
                <div className="space-y-2">
                  {groupEntries.map(([ctId, group]) => {
                    const isExpanded = expandedContractType === ctId;
                    const overdueMissingCount = countOverdueIncomesMissingExpectedDate(group.incomes);
                    return (
                      <div key={ctId} className="border border-gray-100 rounded-lg overflow-hidden">
                        {/* Contract Type Header Row - Clickable */}
                        <button
                          onClick={() => setExpandedContractType(isExpanded ? null : ctId)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/80 hover:bg-gray-100/80 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-[15px] font-semibold text-gray-800">{group.name}</p>
                                {overdueMissingCount > 0 && (
                                  <span
                                    title={overdueIncomeExpectedDateItemLabel(overdueMissingCount)}
                                    className="inline-flex"
                                  >
                                    <AlertTriangle
                                      className="w-4 h-4 text-red-500 shrink-0"
                                      aria-label={overdueIncomeExpectedDateItemLabel(overdueMissingCount)}
                                    />
                                  </span>
                                )}
                              </div>
                              <p className="text-[13px] text-gray-400 mt-0.5">{group.incomes.length} 筆收入</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-8 text-right">
                            <div className="min-w-[100px]">
                              <p className="text-[12px] text-gray-400 mb-0.5">總金額</p>
                              <p className="text-[15px] font-bold font-mono-num text-emerald-600">{formatMoney(group.total)}</p>
                            </div>
                            <div className="min-w-[90px]">
                              <p className="text-[12px] text-gray-400 mb-0.5">已收</p>
                              <p className="text-[15px] font-mono text-blue-600">{formatMoney(group.paid)}</p>
                            </div>
                            <div className="min-w-[90px]">
                              <p className="text-[12px] text-gray-400 mb-0.5">待收</p>
                              <p className={`text-[15px] font-mono ${group.outstanding > 0 ? "text-red-500 font-semibold" : "text-gray-400"}`}>{formatMoney(group.outstanding)}</p>
                            </div>
                            {/* 收款比率 - Collection Ratio */}
                            <div className="min-w-[120px] pl-4 border-l border-gray-200">
                              {(() => {
                                const ratio = group.total > 0 ? Math.round((group.paid / group.total) * 100) : 0;
                                const barColor = ratio >= 100 ? "bg-emerald-500" : ratio >= 50 ? "bg-blue-500" : ratio > 0 ? "bg-amber-500" : "bg-gray-200";
                                const textColor = ratio >= 100 ? "text-emerald-600" : ratio >= 50 ? "text-blue-600" : ratio > 0 ? "text-amber-600" : "text-gray-400";
                                return (
                                  <>
                                    <p className="text-[12px] text-gray-400 mb-1">收款比率</p>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-[6px] bg-gray-100 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(ratio, 100)}%` }} />
                                      </div>
                                      <span className={`text-[15px] font-bold font-mono ${textColor}`}>{ratio}%</span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </button>

                        {/* Expanded Detail Table */}
                        {isExpanded && (
                          <div className="border-t border-gray-100">
                            <div className="px-4 py-2 flex justify-end">
                              {canCreateIncome && (
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-[13px]" onClick={() => openCreateIncome(ctId === UNCATEGORIZED_KEY ? undefined : ctId)}>
                                <Plus className="w-3 h-3" /> 新增此類收入
                              </Button>
                              )}
                            </div>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-white">
                                    <TableHead className="text-[13px]">到期日</TableHead>
                                    <TableHead className="text-[13px]">預計收款日期</TableHead>
                                    <TableHead className="text-[13px]">收款日期</TableHead>
                                    <TableHead className="text-[13px]">款項期數</TableHead>
                                    <TableHead className="text-[13px] text-right">收入金額</TableHead>
                                    <TableHead className="text-[13px] text-right">已收金額</TableHead>
                                    <TableHead className="text-[13px] text-right">待收金額</TableHead>
                                    <TableHead className="text-[13px] text-center">收款狀態</TableHead>
                                    <TableHead className="text-[13px]">備註</TableHead>
                                    <TableHead className="text-[13px] text-center">附件</TableHead>
                                    <TableHead className="text-[13px] text-center w-[100px]">操作</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.incomes.map((income) => (
                                    <TableRow key={income.id} className="hover:bg-gray-50/50 group/row">
                                      <TableCell className={`text-[14px] ${isPastDueUnpaid(income.due_date, income.amount, income.payment_amount) ? "text-red-500" : "text-gray-600"}`}>
                                        {formatShortDate(income.due_date)}
                                      </TableCell>
                                      <TableCell className="text-[14px] text-gray-600">
                                        <span className="inline-flex items-center gap-1">
                                          {formatShortDate(income.expected_payment_date)}
                                          {isExpectedPaymentDateMissing(
                                            income.due_date,
                                            income.expected_payment_date,
                                            undefined,
                                            income.payment_status
                                          ) && (
                                            <span
                                              title={overdueIncomeExpectedDateItemLabel(1)}
                                              className="inline-flex"
                                            >
                                              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                            </span>
                                          )}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-[14px] text-gray-600">{formatShortDate(income.payment_date)}</TableCell>
                                      <TableCell className="text-[14px] text-gray-700 font-medium whitespace-nowrap">
                                        {(() => {
                                          const ctName = income.contract_type_name || "未分類";
                                          const hash = income.invoice_number || "-";
                                          return `${ctName} #${hash}`;
                                        })()}
                                      </TableCell>
                                      <TableCell className="text-[14px] text-right font-mono text-emerald-600 font-medium">{formatMoney(income.amount)}</TableCell>
                                      <TableCell className="text-[14px] text-right font-mono text-blue-600">{formatMoney(income.payment_amount)}</TableCell>
                                      <TableCell className={`text-[14px] text-right font-mono ${incomeNetOutstanding(income) > 0 ? "text-red-500 font-semibold" : "text-gray-400"}`}>{formatMoney(incomeNetOutstanding(income))}</TableCell>
                                      <TableCell className="text-[14px] text-center">
                                        {(() => {
                                          const amt = income.amount || 0;
                                          const paid = income.payment_amount || 0;
                                          if (amt <= 0) return <span className="text-gray-300">-</span>;
                                          const pct = Math.round((paid / amt) * 100);
                                          const dueDateStr = income.due_date;
                                          const now = new Date();
                                          const isOverdue = dueDateStr ? new Date(dueDateStr) < now : false;
                                          const isDueSoon = dueDateStr ? (() => {
                                            const due = new Date(dueDateStr);
                                            const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                                            return diff >= 0 && diff <= 14;
                                          })() : false;
                                          let colorClass = "bg-blue-50 text-blue-600 border-blue-200"; // default blue
                                          if (pct >= 100) {
                                            colorClass = "bg-emerald-50 text-emerald-600 border-emerald-200"; // green
                                          } else if (isOverdue && pct < 100) {
                                            colorClass = "bg-red-50 text-red-600 border-red-200"; // red
                                          } else if (isDueSoon && pct < 100) {
                                            colorClass = "bg-amber-50 text-amber-600 border-amber-200"; // yellow
                                          }
                                          return (
                                            <Badge variant="outline" className={`text-[12px] font-mono ${colorClass}`}>
                                              {pct}%
                                            </Badge>
                                          );
                                        })()}
                                      </TableCell>
                                      <TableCell className="text-[14px] text-gray-600 max-w-[200px] truncate" title={income.remark || ""}>
                                        {income.remark || <span className="text-gray-300">-</span>}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {(() => {
                                          const fileUrls = parseFileUrls(income.pdf_file);
                                          if (fileUrls.length === 0) return <span className="text-gray-300">-</span>;
                                          return (
                                            <div className="flex items-center justify-center gap-1">
                                              {fileUrls.map((url, fi) => (
                                                <a
                                                  key={fi}
                                                  href={url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="inline-flex items-center gap-0.5 text-[12px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                  title={decodeURIComponent(url.split("/").pop()?.split("?")[0] || "file")}
                                                >
                                                  <Paperclip className="w-3 h-3" />
                                                  {fileUrls.length === 1 ? getFileName(url) : (fi + 1)}
                                                </a>
                                              ))}
                                            </div>
                                          );
                                        })()}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0"
                                            title={incomeIdsWithInvoice.has(income.id) ? "查看發票 View Invoice" : "建立發票 Create Invoice"}
                                            onClick={(e) => handleNavClick(`/projects/bwa/${projectId}/invoice/${income.id}`, e, (href) => router.push(href))}
                                          >
                                            <Receipt className={`w-3.5 h-3.5 ${incomeIdsWithInvoice.has(income.id) ? "text-emerald-500" : "text-gray-400"}`} />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0"
                                            title={incomeIdsWithReceipt.has(income.id) ? "查看收據 View Receipt" : "建立收據 Create Receipt"}
                                            onClick={(e) => handleNavClick(`/projects/bwa/${projectId}/receipt/${income.id}`, e, (href) => router.push(href))}
                                          >
                                            <ClipboardCheck className={`w-3.5 h-3.5 ${incomeIdsWithReceipt.has(income.id) ? "text-teal-500" : "text-gray-400"}`} />
                                          </Button>
                                          {canEditIncome && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0"
                                            onClick={() => openEditIncome(income)}
                                          >
                                            <Pencil className="w-3.5 h-3.5 text-blue-500" />
                                          </Button>
                                          )}
                                          {canDeleteIncome && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0"
                                            disabled={deletingIncomeId === income.id}
                                            onClick={() => handleDeleteIncome(income.id)}
                                          >
                                            {deletingIncomeId === income.id ? (
                                              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                                            ) : (
                                              <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                                            )}
                                          </Button>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[15px] text-gray-400 py-6 text-center">暫無收入記錄</p>
              )}
            </SectionCard>

            {/* Create / Edit Income Dialog */}
            <Dialog open={showIncomeDialog} onOpenChange={(open) => { if (!open) { setShowIncomeDialog(false); resetIncomeForm(); } }}>
              <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col overflow-hidden">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle className="text-base">{editingIncome ? "編輯收入" : "新增收入"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2 flex-1 overflow-y-auto -mx-1 px-1">
                  {/* Row 1: 合約類型 + 款項期數 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">合約類型</label>
                      <Select
                        value={incomeForm.n_contract_type_id || ""}
                        onValueChange={(val) => {
                          const newCtId = val || null;
                          setIncomeForm(prev => {
                            if (!editingIncome) {
                              return { ...prev, n_contract_type_id: newCtId, invoice_number: getNextInstallmentNumber(newCtId) };
                            }
                            return { ...prev, n_contract_type_id: newCtId };
                          });
                        }}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="選擇合約類型" />
                        </SelectTrigger>
                        <SelectContent>
                          {contractTypes.map((ct) => (
                            <SelectItem key={ct.id} value={ct.id} className="text-sm">
                              {ct.chinese_display || ct.display}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">款項期數</label>
                      <Input
                        placeholder="第1期"
                        value={incomeForm.invoice_number || ""}
                        onChange={(e) => setIncomeForm(prev => ({ ...prev, invoice_number: e.target.value || null }))}
                        className="h-9 text-sm"
                        disabled={!canEditInstallmentNumber}
                      />
                    </div>
                  </div>

                  {/* Row 2: 收入金額 + 收款狀態 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">收入金額 <span className="text-red-500">*</span></label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={incomeForm.income_amount ?? ""}
                        onChange={(e) => {
                          const val = e.target.value ? parseFloat(e.target.value) : null;
                          setIncomeForm(prev => ({
                            ...prev,
                            income_amount: val,
                            outstanding: val != null ? (val - (prev.payment_amount || 0)) : null,
                          }));
                        }}
                        className={cn(
                          "h-9 text-sm font-mono",
                          incomeAmountBelowEstimated && !hasPersistedIncomeBelowReason && "border-amber-500 focus-visible:ring-amber-500"
                        )}
                      />
                      {incomeAmountBelowEstimated && !hasPersistedIncomeBelowReason && (
                        <p className="text-[11px] text-amber-600 mt-1">
                          項目收入總額少於預計收入 {formatMoney(data.estimated_income)}，提交時需填寫原因
                        </p>
                      )}
                    </div>
                    <IncomePaymentStatusField
                      value={incomeForm.payment_status}
                      isAdmin={isAdminOrAbove}
                      required={incomeForm.payment_amount != null}
                      error={incomeStatusError}
                      onChange={(val) => {
                        setIncomeStatusError(null);
                        setIncomeForm((prev) => ({
                          ...prev,
                          payment_status: val,
                          ...(isIncomeSettled(val)
                            ? { expected_payment_date: null, expiry_reason_id: null }
                            : {}),
                        }));
                      }}
                    />
                  </div>

                  {/* Row 3: 到期日 + 預計付款日期 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">到期日 <span className="text-red-500">*</span></label>
                      <Input
                        type="date"
                        value={incomeForm.due_date || ""}
                        onChange={(e) => {
                          const val = e.target.value || null;
                          setIncomeForm(prev => ({
                            ...prev,
                            due_date: val,
                            expiry_reason_id: isDueDateExpired(val) ? prev.expiry_reason_id : null,
                          }));
                        }}
                        className="h-9 text-sm"
                        disabled={isDueDateLocked(editingIncome?.due_date)}
                      />
                      <p className="text-[11px] text-gray-500 mt-1">
                        {isDueDateLocked(editingIncome?.due_date)
                          ? "建立記錄後將無法變更"
                          : "空白記錄可補填，填寫後將無法變更"}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">
                        預計付款日期
                        {isExpectedPaymentDateRequired(incomeForm.due_date, undefined, incomeForm.payment_status) && <span className="text-red-500"> *</span>}
                      </label>
                      <Input
                        type="date"
                        value={incomeForm.expected_payment_date || ""}
                        onChange={(e) => setIncomeForm(prev => ({ ...prev, expected_payment_date: e.target.value || null }))}
                        className="h-9 text-sm"
                      />
                      {isExpectedPaymentDateRequired(incomeForm.due_date, undefined, incomeForm.payment_status) && !incomeForm.expected_payment_date && (
                        <p className="text-[11px] text-red-500 mt-1">到期日已過，請填寫預計付款日期</p>
                      )}
                    </div>
                  </div>
                  <IncomeCollectionSituationField
                    key={`${showIncomeDialog}-${editingIncome?.id ?? "new"}`}
                    dueDate={incomeForm.due_date}
                    expectedPaymentDate={incomeForm.expected_payment_date}
                  />
                  <IncomeExpiryReasonField
                    dueDate={incomeForm.due_date}
                    value={incomeForm.expiry_reason_id}
                    required={!isIncomeSettled(incomeForm.payment_status)}
                    onChange={(id) => setIncomeForm((prev) => ({ ...prev, expiry_reason_id: id }))}
                  />

                  {isAoContractType(contractTypes, incomeForm.n_contract_type_id) && (
                    <IncomeAOFields
                      value={incomeForm}
                      onChange={(patch) => setIncomeForm((prev) => ({ ...prev, ...patch }))}
                    />
                  )}

                  {/* Section: 完成收款時填寫 */}
                  <div className="rounded-lg border border-gray-200 bg-gray-50/30 p-4 space-y-3">
                    <p className="text-[13px] font-medium text-gray-500 mb-2">完成收款時填寫</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[13px] text-gray-500 mb-1 block">已收金額</label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={incomeForm.payment_amount ?? ""}
                          onChange={(e) => {
                            const val = e.target.value ? parseFloat(e.target.value) : null;
                            setIncomeForm(prev => ({
                              ...prev,
                              payment_amount: val,
                              outstanding: (prev.income_amount || 0) - (val || 0),
                            }));
                          }}
                          className="h-8 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[13px] text-gray-500 mb-1 block">
                          收款日期
                          {incomeForm.payment_amount != null && <span className="text-red-500"> *</span>}
                        </label>
                        <Input
                          type="date"
                          value={incomeForm.receive_date || ""}
                          onChange={(e) => setIncomeForm(prev => ({ ...prev, receive_date: e.target.value || null }))}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[13px] text-gray-500 mb-1 block">
                        付款方式
                        {incomeForm.payment_amount != null && <span className="text-red-500"> *</span>}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={cn(
                            "rounded-full px-3 py-1 text-[13px] border transition-all",
                            !incomeForm.payment_method
                              ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
                              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                          )}
                          onClick={() => setIncomeForm(prev => ({ ...prev, payment_method: null }))}
                        >
                          未選擇
                        </button>
                        {paymentMethods.map((pm) => (
                          <button
                            key={pm.id}
                            type="button"
                            className={cn(
                              "rounded-full px-3 py-1 text-[13px] border transition-all",
                              incomeForm.payment_method === pm.display
                                ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
                                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                            )}
                            onClick={() => setIncomeForm(prev => ({ ...prev, payment_method: pm.display }))}
                          >
                            {pm.display}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {isAdminOrAbove && (
                    <IncomeBadDebtsField
                      value={incomeForm.bad_debts}
                      onChange={(val) => setIncomeForm((prev) => ({ ...prev, bad_debts: val }))}
                    />
                  )}

                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">備註</label>
                    <Textarea
                      placeholder="輸入備註..."
                      className="text-sm min-h-[72px] resize-y"
                      rows={3}
                      value={incomeForm.remark || ""}
                      onChange={(e) => setIncomeForm(prev => ({ ...prev, remark: e.target.value || null }))}
                    />
                  </div>

                  {hasPersistedIncomeBelowReason && (
                    <IncomeBelowEstimatedReasonField
                      value={incomeBelowReason}
                      onChange={(val) => {
                        setIncomeBelowReason(val);
                        setIncomeBelowReasonError(null);
                      }}
                      error={incomeBelowReasonError}
                      required
                    />
                  )}

                  {/* File Attachments */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">附件</label>
                    
                    {/* Upload error message */}
                    {incomeFileError && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                        <span className="text-[13px] text-red-600">{incomeFileError}</span>
                        <button type="button" onClick={() => setIncomeFileError(null)} className="ml-auto text-red-400 hover:text-red-600">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Existing files list */}
                    {(() => {
                      const fileUrls = parseFileUrls(incomeForm.pdf_file);
                      if (fileUrls.length === 0) return null;
                      return (
                        <div className="space-y-1.5 mb-2">
                          {fileUrls.map((url, fi) => {
                            const ext = getFileExtension(url);
                            const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext);
                            return (
                              <div key={fi} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 group/file">
                                <div className={`w-7 h-7 rounded flex items-center justify-center text-[12px] font-bold uppercase ${
                                  ext === "pdf" ? "bg-red-100 text-red-600" :
                                  isImage ? "bg-blue-100 text-blue-600" :
                                  "bg-gray-200 text-gray-600"
                                }`}>
                                  {ext === "pdf" ? "PDF" : isImage ? <ImageIcon className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                                </div>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 text-[14px] text-blue-600 hover:text-blue-800 truncate underline decoration-blue-200 hover:decoration-blue-400"
                                  title={decodeURIComponent(url.split("/").pop()?.split("?")[0] || "file")}
                                >
                                  {decodeURIComponent(url.split("/").pop()?.split("?")[0] || "file")}
                                </a>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-400 hover:text-blue-500 transition-colors"
                                  title="開啟檔案"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => removeIncomeFileUrl(fi)}
                                  className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover/file:opacity-100"
                                  title="移除附件"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Upload button */}
                    <label className="relative cursor-pointer">
                      <div className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg py-3 px-4 transition-colors ${
                        incomeFileUploading
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-200 hover:border-blue-400 hover:bg-blue-50/50"
                      }`}>
                        {incomeFileUploading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                            <span className="text-[14px] text-blue-500">上傳中...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 text-gray-400" />
                            <span className="text-[14px] text-gray-500">點擊上傳檔案（支援任何檔案類型）</span>
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        multiple
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleIncomeFileUpload}
                        disabled={incomeFileUploading}
                      />
                    </label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={() => { setShowIncomeDialog(false); resetIncomeForm(); }}>
                    取消
                  </Button>
                  <DisabledSubmitControl
                    key={`${showIncomeDialog}-${editingIncome?.id ?? "new"}`}
                    blocked={incomeSaveDisabled}
                    busy={incomeSaving || incomeFileUploading}
                    reasons={incomeSubmitBlockers}
                  >
                    <Button
                      size="sm"
                      className="gap-1.5 bg-emerald-500 hover:bg-emerald-600"
                      disabled={incomeSaveDisabled}
                      onClick={handleSaveIncome}
                    >
                      {incomeSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {editingIncome ? "更新" : "新增"}
                    </Button>
                  </DisabledSubmitControl>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          );
        })()}

        {/* EXPENSE TAB — Grouped by Supplier + Contract Type */}
        {activeTab === "expense" && (() => {
          // Group expenses by supplier_id + n_contract_type_id combo
          const expenses = data.expenses || [];
          const UNCATEGORIZED_SUPPLIER = "__no_supplier__";
          const UNCATEGORIZED_CT = "__no_ct__";

          const grouped = new Map<string, {
            supplierName: string;
            contractTypeName: string;
            expenses: BWAProjectExpense[];
            total: number;
            paid: number;
            outstanding: number;
          }>();

          expenses.forEach((exp) => {
            const supKey = exp.supplier_id || UNCATEGORIZED_SUPPLIER;
            const ctKey = exp.n_contract_type_id || UNCATEGORIZED_CT;
            const groupKey = `${supKey}::${ctKey}`;

            if (!grouped.has(groupKey)) {
              grouped.set(groupKey, {
                supplierName: exp.supplier_name || "未分類供應商",
                contractTypeName: exp.contract_type_name || "未分類合約",
                expenses: [],
                total: 0,
                paid: 0,
                outstanding: 0,
              });
            }
            const g = grouped.get(groupKey)!;
            g.expenses.push(exp);
            g.total += (exp.amount || 0);
            g.paid += (exp.paid_amount || 0);
            g.outstanding += (exp.outstanding || 0);
          });

          const groupEntries = Array.from(grouped.entries());
          const totalPaid = expenses.reduce((s, e) => s + (e.paid_amount || 0), 0);
          const totalOutstanding = expenses.reduce((s, e) => s + (e.outstanding || 0), 0);

          return (
          <div className="space-y-6">
            {/* Warning when Expense Control checklist is incomplete (Super Admin is exempt) */}
            {!expenseUnlocked && (
              <button
                type="button"
                onClick={() => setActiveTab("expense-control")}
                className="w-full flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-left hover:bg-amber-100 transition-colors"
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <p className="text-[13px]">出支票功能受限制：尚有必填資料未完成。請前往「Expense Control」分頁查看清單。Expense is restricted — complete the Expense Control checklist first.</p>
              </button>
            )}
            {/* Header with stats — mirrors income tab but for 付 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="預計支出 Estimated" value={formatMoney(data.estimated_expense)} icon={TrendingDown} accentColor="bg-blue-500" />
              <MetricCard label="實際支出 Actual" value={formatMoney(totalExpense)} subtext={`${expenses.length} 筆支出`} icon={ArrowUpCircle} accentColor="bg-red-500" />
              <MetricCard label="已付款 Paid" value={formatMoney(totalPaid)} icon={CheckCircle2} accentColor="bg-violet-500" />
              <MetricCard label="待付款 Outstanding" value={formatMoney(totalOutstanding)} icon={AlertTriangle} accentColor="bg-amber-500" />
            </div>

            {/* ─── 主要承辦商 Main Contractor section ─────────────── */}
            {(() => {
              const mcId = data.main_contractor_id;
              const mcExpenses = mcId ? expenses.filter((e) => e.supplier_id === mcId) : [];
              const mcTotal = mcExpenses.reduce((s, e) => s + (e.amount || 0), 0);
              const mcPaid = mcExpenses.reduce((s, e) => s + (e.paid_amount || 0), 0);
              const mcOutstanding = mcExpenses.reduce((s, e) => s + (e.outstanding || 0), 0);
              const mcRatio = mcTotal > 0 ? Math.round((mcPaid / mcTotal) * 100) : 0;

              return (
                <SectionCard title="主要承辦商 Main Contractor" icon={HardHat} iconColor="text-orange-500">
                  {mcId ? (
                    <div className="space-y-4">
                      {/* Contractor header + summary */}
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-2">
                          <p className="text-[16px] font-semibold text-gray-800">{data.main_contractor_name || "—"}</p>
                          <Badge variant="outline" className="text-[12px] px-1.5 py-0 border-orange-200 text-orange-600 bg-orange-50">主要承辦商</Badge>
                          <span className="text-[13px] text-gray-400">· {mcExpenses.length} 筆支出</span>
                          {/* Removing is only allowed while there are no related expenses. */}
                          {canEditExpense && mcExpenses.length === 0 && (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="移除主要承辦商"
                              onClick={handleRemoveMainContractor}
                              disabled={mcSaving}
                            >
                              {mcSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                              移除
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-6 text-right">
                          <div className="min-w-[90px]">
                            <p className="text-[12px] text-gray-400 mb-0.5">總金額</p>
                            <p className="text-[15px] font-bold font-mono-num text-red-600">{formatMoney(mcTotal)}</p>
                          </div>
                          <div className="min-w-[80px]">
                            <p className="text-[12px] text-gray-400 mb-0.5">已付</p>
                            <p className="text-[15px] font-mono text-blue-600">{formatMoney(mcPaid)}</p>
                          </div>
                          <div className="min-w-[80px]">
                            <p className="text-[12px] text-gray-400 mb-0.5">待付</p>
                            <p className={`text-[15px] font-mono ${mcOutstanding > 0 ? "text-amber-500 font-semibold" : "text-gray-400"}`}>{formatMoney(mcOutstanding)}</p>
                          </div>
                          <div className="min-w-[60px] pl-4 border-l border-gray-200">
                            <p className="text-[12px] text-gray-400 mb-0.5">付款比率</p>
                            <p className={`text-[15px] font-bold font-mono ${mcRatio >= 100 ? "text-emerald-600" : mcRatio >= 50 ? "text-violet-600" : mcRatio > 0 ? "text-orange-600" : "text-gray-400"}`}>{mcRatio}%</p>
                          </div>
                        </div>
                      </div>

                      {/* Related expenses */}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-400">此承辦商的相關支出</p>
                        {canCreateExpense && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 h-7 text-[12px] border-orange-200 text-orange-600 hover:bg-orange-50"
                            onClick={() => openCreateExpense(mcId)}
                            disabled={!expenseUnlocked}
                            title={!expenseUnlocked ? "出支票功能受限制：請先完成 Expense Control 清單" : undefined}
                          >
                            <Plus className="w-3 h-3" /> 新增承辦商支出
                          </Button>
                        )}
                      </div>

                      {mcExpenses.length > 0 ? (
                        <div className="overflow-x-auto border border-gray-100 rounded-lg">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-50/80">
                                <TableHead className="text-[13px]">到期日</TableHead>
                                <TableHead className="text-[13px]">預計付款日期</TableHead>
                                <TableHead className="text-[13px]">實際付款日期</TableHead>
                                <TableHead className="text-[13px]">款項期數</TableHead>
                                <TableHead className="text-[13px]">合約類型</TableHead>
                                <TableHead className="text-[13px]">付款方式</TableHead>
                                <TableHead className="text-[13px] text-right">支出金額</TableHead>
                                <TableHead className="text-[13px] text-right">已付金額</TableHead>
                                <TableHead className="text-[13px] text-right">待付金額</TableHead>
                                <TableHead className="text-[13px] text-center">操作</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {mcExpenses.map((expense) => (
                                <TableRow key={expense.id} className="hover:bg-gray-50/50">
                                  <TableCell className={`text-[14px] ${isPastDueUnpaid(expense.due_date, expense.amount, expense.paid_amount) ? "text-red-500" : "text-gray-600"}`}>{formatShortDate(expense.due_date)}</TableCell>
                                  <TableCell className="text-[14px] text-gray-600">{formatShortDate(expense.expected_payment_date)}</TableCell>
                                  <TableCell className="text-[14px] text-gray-600">{formatShortDate(expense.payment_date)}</TableCell>
                                  <TableCell className="text-[14px] text-gray-600">{expense.rank_report || <span className="text-gray-300">-</span>}</TableCell>
                                  <TableCell className="text-[14px] text-gray-700">
                                    {expense.contract_type_name ? (
                                      <Badge variant="outline" className="text-[12px] px-1.5 py-0 border-amber-200 text-amber-600 bg-amber-50">{expense.contract_type_name}</Badge>
                                    ) : (
                                      <span className="text-gray-300">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-[14px] text-gray-700">
                                    {expense.payment_method_name || <span className="text-gray-300">-</span>}
                                    {expense.cheque_no && <p className="text-[12px] text-gray-400 mt-0.5 font-mono">支票: {expense.cheque_no}</p>}
                                  </TableCell>
                                  <TableCell className="text-[14px] text-right font-mono text-red-600 font-medium">{formatMoney(expense.amount)}</TableCell>
                                  <TableCell className="text-[14px] text-right font-mono text-blue-600">{formatMoney(expense.paid_amount)}</TableCell>
                                  <TableCell className={`text-[14px] text-right font-mono ${(expense.outstanding || 0) > 0 ? "text-amber-500 font-semibold" : "text-gray-400"}`}>{formatMoney(expense.outstanding)}</TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      {canEditExpense && (
                                        <button
                                          className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded bg-gray-50 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                          title={!expenseUnlocked ? "請先填寫工地狀況 (Site Status) 才可編輯支出" : "編輯支出"}
                                          onClick={() => openEditExpense(expense)}
                                          disabled={!expenseUnlocked}
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                      )}
                                      {canDeleteExpense && (
                                        <button
                                          className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                                          title="刪除支出"
                                          disabled={deletingExpenseId === expense.id}
                                          onClick={() => handleDeleteExpense(expense.id)}
                                        >
                                          {deletingExpenseId === expense.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                        </button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-[14px] text-gray-400 py-4 text-center">此承辦商暫無支出記錄</p>
                      )}
                      {mcError && <p className="text-[13px] text-red-500">{mcError}</p>}
                    </div>
                  ) : (
                    /* No main contractor yet — searchable quick-select */
                    <div className="space-y-3">
                      <p className="text-[14px] text-gray-500">尚未設定主要承辦商。請先選擇一個供應商作為主要承辦商，即可建立及編輯其相關支出。</p>
                      <div ref={mcPanelRef} className="relative max-w-md">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full h-9 justify-between text-sm font-normal px-3 overflow-hidden border-orange-200 hover:bg-orange-50"
                          onClick={() => {
                            setMcSearchOpen((prev) => !prev);
                            if (!mcSearchOpen) setMcSearchQuery("");
                          }}
                          disabled={mcSaving}
                        >
                          {mcSaving ? (
                            <span className="flex items-center gap-2 text-gray-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> 設定中...</span>
                          ) : (
                            <span className="text-muted-foreground">選擇主要承辦商供應商</span>
                          )}
                          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                        {mcSearchOpen && (
                          <div className="absolute z-20 mt-1 border rounded-md bg-white shadow-md w-full overflow-hidden max-w-full">
                            <div className="flex items-center border-b px-3 min-w-0">
                              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                              <input
                                className="flex h-9 w-full min-w-0 rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                placeholder="搜尋名稱/電話/Email/專業技能..."
                                value={mcSearchQuery}
                                onChange={(e) => setMcSearchQuery(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                              />
                              {mcSearchQuery && (
                                <button type="button" onClick={() => setMcSearchQuery("")} className="text-gray-400 hover:text-gray-600">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            <div className="max-h-52 overflow-y-auto overflow-x-hidden overscroll-contain p-1">
                              {supplierOptionsList
                                .filter((sup) => {
                                  if (!mcSearchQuery) return true;
                                  const q = mcSearchQuery.toLowerCase();
                                  return (
                                    (sup.label || "").toLowerCase().includes(q) ||
                                    (sup.sublabel || "").toLowerCase().includes(q) ||
                                    (sup.searchText || "").toLowerCase().includes(q)
                                  );
                                })
                                .map((sup) => (
                                  <div
                                    key={sup.id}
                                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground overflow-hidden min-w-0"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleSetMainContractor(sup.id);
                                    }}
                                  >
                                    <span className="truncate min-w-0">{sup.label}</span>
                                    {sup.sublabel && <span className="text-[12px] text-gray-400 ml-1 truncate min-w-0 max-w-[40%]">({sup.sublabel})</span>}
                                  </div>
                                ))}
                              {supplierOptionsList.filter((sup) => {
                                if (!mcSearchQuery) return true;
                                const q = mcSearchQuery.toLowerCase();
                                return (sup.label || "").toLowerCase().includes(q) || (sup.sublabel || "").toLowerCase().includes(q) || (sup.searchText || "").toLowerCase().includes(q);
                              }).length === 0 && mcSearchQuery && (
                                <div className="py-4 text-center text-sm text-muted-foreground">找不到「{mcSearchQuery}」的供應商</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      {mcError && <p className="text-[13px] text-red-500">{mcError}</p>}
                    </div>
                  )}
                </SectionCard>
              );
            })()}

            <SectionCard title={`供應商 × 合約類型分組 (${groupEntries.length} 組)`} icon={Receipt} iconColor="text-red-500">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-gray-400">按供應商及合約類型分組顯示支出，點擊展開查看明細</p>
                {canCreateExpense && (
                  <DisabledSubmitControl
                    blocked={!expenseUnlocked}
                    reasons={!expenseUnlocked ? [EXPENSE_CONTROL_LOCKED_MESSAGE] : []}
                  >
                    <Button size="sm" className="gap-1.5 bg-red-500 hover:bg-red-600 text-white" onClick={() => openCreateExpense()} disabled={!expenseUnlocked}>
                      <Plus className="w-3.5 h-3.5" /> 新增支出
                    </Button>
                  </DisabledSubmitControl>
                )}
              </div>

              {groupEntries.length > 0 ? (
                <div className="space-y-2">
                  {groupEntries.map(([groupKey, group]) => {
                    const isExpanded = expandedExpenseGroup === groupKey;
                    return (
                      <div key={groupKey} className="border border-gray-100 rounded-lg overflow-hidden">
                        {/* Group Header Row - Clickable */}
                        <button
                          onClick={() => setExpandedExpenseGroup(isExpanded ? null : groupKey)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/80 hover:bg-gray-100/80 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            <div>
                              <p className="text-[15px] font-semibold text-gray-800">{group.supplierName}</p>
                              <div className="text-[13px] text-gray-400 mt-0.5">
                                <span className="inline-flex items-center gap-1">
                                  <Badge variant="outline" className="text-[12px] px-1.5 py-0 border-amber-200 text-amber-600 bg-amber-50">{group.contractTypeName}</Badge>
                                  <span className="text-gray-300">·</span>
                                  {group.expenses.length} 筆支出
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-8 text-right">
                            <div className="min-w-[100px]">
                              <p className="text-[12px] text-gray-400 mb-0.5">總金額</p>
                              <p className="text-[15px] font-bold font-mono-num text-red-600">{formatMoney(group.total)}</p>
                            </div>
                            <div className="min-w-[90px]">
                              <p className="text-[12px] text-gray-400 mb-0.5">已付</p>
                              <p className="text-[15px] font-mono text-blue-600">{formatMoney(group.paid)}</p>
                            </div>
                            <div className="min-w-[90px]">
                              <p className="text-[12px] text-gray-400 mb-0.5">待付</p>
                              <p className={`text-[15px] font-mono ${group.outstanding > 0 ? "text-amber-500 font-semibold" : "text-gray-400"}`}>{formatMoney(group.outstanding)}</p>
                            </div>
                            {/* 付款比率 - Payment Ratio */}
                            <div className="min-w-[120px] pl-4 border-l border-gray-200">
                              {(() => {
                                const ratio = group.total > 0 ? Math.round((group.paid / group.total) * 100) : 0;
                                const barColor = ratio >= 100 ? "bg-emerald-500" : ratio >= 50 ? "bg-violet-500" : ratio > 0 ? "bg-orange-500" : "bg-gray-200";
                                const textColor = ratio >= 100 ? "text-emerald-600" : ratio >= 50 ? "text-violet-600" : ratio > 0 ? "text-orange-600" : "text-gray-400";
                                return (
                                  <>
                                    <p className="text-[12px] text-gray-400 mb-1">付款比率</p>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-[6px] bg-gray-100 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(ratio, 100)}%` }} />
                                      </div>
                                      <span className={`text-[15px] font-bold font-mono ${textColor}`}>{ratio}%</span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </button>

                        {/* Expanded Detail Table */}
                        {isExpanded && (() => {
                          const [supKey, ctKey] = groupKey.split("::");
                          const groupSupplierId = supKey === UNCATEGORIZED_SUPPLIER ? undefined : supKey;
                          const groupContractTypeId = ctKey === UNCATEGORIZED_CT ? undefined : ctKey;
                          return (
                          <div className="border-t border-gray-100">
                            <div className="flex items-center justify-end px-4 py-2 bg-gray-50/50">
                              {canCreateExpense && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 h-6 text-[12px] border-red-200 text-red-500 hover:bg-red-50"
                                  onClick={() => openCreateExpense(groupSupplierId, groupContractTypeId)}
                                  disabled={!expenseUnlocked}
                                  title={!expenseUnlocked ? "出支票功能受限制：請先完成 Expense Control 清單" : undefined}
                                >
                                  <Plus className="w-3 h-3" /> 新增此組支出
                                </Button>
                              )}
                            </div>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-white">
                                    <TableHead className="text-[13px]">到期日</TableHead>
                                    <TableHead className="text-[13px]">預計付款日期</TableHead>
                                    <TableHead className="text-[13px]">實際付款日期</TableHead>
                                    <TableHead className="text-[13px]">款項期數</TableHead>
                                    <TableHead className="text-[13px]">支出分類</TableHead>
                                    <TableHead className="text-[13px]">付款方式</TableHead>
                                    <TableHead className="text-[13px] text-right">支出金額</TableHead>
                                    <TableHead className="text-[13px] text-right">已付金額</TableHead>
                                    <TableHead className="text-[13px] text-right">待付金額</TableHead>
                                    <TableHead className="text-[13px] text-center">收款狀態</TableHead>
                                    <TableHead className="text-[13px]">備註</TableHead>
                                    <TableHead className="text-[13px] text-center">附件</TableHead>
                                    <TableHead className="text-[13px] text-center">操作</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.expenses.map((expense) => (
                                    <TableRow key={expense.id} className="hover:bg-gray-50/50 group/row">
                                      <TableCell className={`text-[14px] ${isPastDueUnpaid(expense.due_date, expense.amount, expense.paid_amount) ? "text-red-500" : "text-gray-600"}`}>{formatShortDate(expense.due_date)}</TableCell>
                                      <TableCell className="text-[14px] text-gray-600">{formatShortDate(expense.expected_payment_date)}</TableCell>
                                      <TableCell className="text-[14px] text-gray-600">{formatShortDate(expense.payment_date)}</TableCell>
                                      <TableCell className="text-[14px] text-gray-600">
                                        {expense.rank_report || <span className="text-gray-300">-</span>}
                                      </TableCell>
                                      <TableCell className="text-[14px] text-gray-700">
                                        {expense.supplier_type_name ? (
                                          <Badge variant="outline" className="text-[12px] px-1.5 py-0 border-gray-200 text-gray-600 bg-gray-50">{expense.supplier_type_name}</Badge>
                                        ) : (
                                          <span className="text-gray-300">-</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-[14px] text-gray-700">
                                        <div>
                                          {expense.payment_method_name || <span className="text-gray-300">-</span>}
                                          {expense.cheque_no && (
                                            <p className="text-[12px] text-gray-400 mt-0.5 font-mono">支票: {expense.cheque_no}</p>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-[14px] text-right font-mono text-red-600 font-medium">{formatMoney(expense.amount)}</TableCell>
                                      <TableCell className="text-[14px] text-right font-mono text-blue-600">{formatMoney(expense.paid_amount)}</TableCell>
                                      <TableCell className={`text-[14px] text-right font-mono ${(expense.outstanding || 0) > 0 ? "text-amber-500 font-semibold" : "text-gray-400"}`}>{formatMoney(expense.outstanding)}</TableCell>
                                      <TableCell className="text-[14px] text-center">
                                        {(() => {
                                          const amt = expense.amount || 0;
                                          const paid = expense.paid_amount || 0;
                                          if (amt <= 0) return <span className="text-gray-300">-</span>;
                                          const pct = Math.round((paid / amt) * 100);
                                          let colorClass = "bg-blue-50 text-blue-600 border-blue-200";
                                          if (pct >= 100) {
                                            colorClass = "bg-emerald-50 text-emerald-600 border-emerald-200";
                                          } else if (pct === 0) {
                                            colorClass = "bg-red-50 text-red-600 border-red-200";
                                          } else if (pct < 100) {
                                            colorClass = "bg-amber-50 text-amber-600 border-amber-200";
                                          }
                                          return (
                                            <Badge variant="outline" className={`text-[12px] font-mono ${colorClass}`}>
                                              {pct}%
                                            </Badge>
                                          );
                                        })()}
                                      </TableCell>
                                      <TableCell className="text-[14px] text-gray-600 max-w-[200px] truncate" title={expense.remark || ""}>
                                        {expense.remark || <span className="text-gray-300">-</span>}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {(() => {
                                          const attachmentUrls = parseFileUrls(expense.pdf_file);
                                          const quotationUrls = parseExpenseFileUrls(expense.supplier_quotation_file);
                                          const fileEntries = [
                                            ...quotationUrls.map((url) => ({ url, kind: "quotation" as const })),
                                            ...attachmentUrls.map((url) => ({ url, kind: "attachment" as const })),
                                          ];
                                          if (fileEntries.length === 0) return <span className="text-gray-300">-</span>;
                                          return (
                                            <div className="flex items-center justify-center gap-1 flex-wrap">
                                              {fileEntries.map((entry, fi) => (
                                                <a
                                                  key={`${entry.kind}-${fi}`}
                                                  href={entry.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className={cn(
                                                    "inline-flex items-center gap-0.5 text-[12px] px-1.5 py-0.5 rounded transition-colors",
                                                    entry.kind === "quotation"
                                                      ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                                      : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                                  )}
                                                  title={
                                                    entry.kind === "quotation"
                                                      ? `供應商報價單: ${decodeURIComponent(entry.url.split("/").pop()?.split("?")[0] || "file")}`
                                                      : decodeURIComponent(entry.url.split("/").pop()?.split("?")[0] || "file")
                                                  }
                                                >
                                                  <Paperclip className="w-3 h-3" />
                                                  {fileEntries.length === 1 ? getFileName(entry.url) : (fi + 1)}
                                                </a>
                                              ))}
                                            </div>
                                          );
                                        })()}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-1">
                                          {canEditExpense && (
                                            <button
                                              className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded bg-gray-50 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-50 disabled:hover:text-gray-500"
                                              title={!expenseUnlocked ? "請先填寫工地狀況 (Site Status) 才可編輯支出" : "編輯支出"}
                                              onClick={() => openEditExpense(expense)}
                                              disabled={!expenseUnlocked}
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </button>
                                          )}
                                          {canDeleteExpense && (
                                            <button
                                              className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                                              title="刪除支出"
                                              disabled={deletingExpenseId === expense.id}
                                              onClick={() => handleDeleteExpense(expense.id)}
                                            >
                                              {deletingExpenseId === expense.id ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                              ) : (
                                                <Trash2 className="w-3 h-3" />
                                              )}
                                            </button>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[15px] text-gray-400 py-6 text-center">暫無支出記錄</p>
              )}
            </SectionCard>

            {/* Create / Edit Expense Dialog */}
            <Dialog open={showExpenseDialog} onOpenChange={(open) => { if (!open) { setShowExpenseDialog(false); resetExpenseForm(); } }}>
              <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col overflow-hidden">
                <DialogHeader>
                  <DialogTitle className="text-base">{editingExpense ? "編輯支出" : "新增支出"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2 min-w-0 overflow-y-auto overflow-x-hidden flex-1">
                  {/* Row 1: 款項期數 + 支出金額 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[13px] text-gray-900 mb-1 block">款項期數 <span className="text-red-500">*</span></label>
                      <Input
                        placeholder="e.g. 1, 2, 3..."
                        className="h-8 text-sm"
                        value={expenseForm.rank_report ?? ""}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, rank_report: e.target.value || null }))}
                        disabled={!editingExpense && !canEditInstallmentNumber}
                      />
                    </div>
                    <div>
                      <label className="text-[13px] text-gray-900 mb-1 block">支出金額 <span className="text-red-500">*</span></label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        className="h-8 text-sm"
                        value={expenseForm.installment_amount ?? ""}
                        onChange={(e) => {
                          const val = e.target.value ? parseFloat(e.target.value) : null;
                          setExpenseForm(prev => ({
                            ...prev,
                            installment_amount: val,
                          }));
                          setExpenseSupplierDocError(null);
                        }}
                      />
                    </div>
                  </div>

                  <ExpensePaymentStatusField
                    value={expenseForm.payment_status}
                    isAdmin={isAdminOrAbove}
                    required={expenseForm.paid_amount != null}
                    error={expenseStatusError}
                    onChange={(val) => {
                      setExpenseStatusError(null);
                      setExpenseForm((prev) => ({ ...prev, payment_status: val }));
                    }}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[13px] text-gray-900 mb-1 block">到期日 <span className="text-red-500">*</span></label>
                      <Input
                        type="date"
                        className="h-8 text-sm"
                        value={expenseForm.due_date ?? ""}
                        onChange={(e) => {
                          const val = e.target.value || null;
                          setExpenseForm(prev => ({
                            ...prev,
                            due_date: val,
                          }));
                        }}
                        disabled={isDueDateLocked(editingExpense?.due_date)}
                      />
                      <p className="text-[11px] text-gray-500 mt-1">
                        {isDueDateLocked(editingExpense?.due_date)
                          ? "建立記錄後將無法變更"
                          : "空白記錄可補填，填寫後將無法變更"}
                      </p>
                    </div>
                    <div>
                      <label className="text-[13px] text-gray-900 mb-1 block">
                        預計付款日期
                        {isExpectedPaymentDateRequired(expenseForm.due_date) && <span className="text-red-500"> *</span>}
                      </label>
                      <Input
                        type="date"
                        className="h-8 text-sm"
                        value={expenseForm.expected_payment_date ?? ""}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, expected_payment_date: e.target.value || null }))}
                      />
                      {isExpectedPaymentDateRequired(expenseForm.due_date) && !expenseForm.expected_payment_date && (
                        <p className="text-[11px] text-red-500 mt-1">到期日已過，請填寫預計付款日期</p>
                      )}
                    </div>
                  </div>

                  <ExpenseAmountRulesBox
                    evaluation={expenseGroupRules}
                    hasQuotation={expenseGroupHasQuotation}
                    supplierId={expenseForm.supplier_id}
                    eligibility={supplierDocEligibility}
                    eligibilityLoading={supplierDocEligibilityLoading}
                    formatMoney={(amount) => formatMoney(amount)}
                    costCentreBuCode={projectCostCentre?.bu_code}
                    contractTypeLabel={
                      contractTypes.find((ct) => ct.id === expenseForm.n_contract_type_id)
                        ?.chinese_display ||
                      contractTypes.find((ct) => ct.id === expenseForm.n_contract_type_id)?.display
                    }
                  />

                  {/* Row 2: 合約類型 */}
                  <div>
                    <label className="text-[13px] text-gray-900 mb-1 block">合約類型 <span className="text-red-500">*</span></label>
                    <Select
                      value={expenseForm.n_contract_type_id || "__none__"}
                      onValueChange={(val) => {
                        const newCtId = val === "__none__" ? null : val;
                        setExpenseForm(prev => {
                          // Auto-update rank_report only when creating (not editing)
                          if (!editingExpense) {
                            const expenses = data?.expenses || [];
                            const matching = expenses.filter(e =>
                              (prev.supplier_id ? e.supplier_id === prev.supplier_id : !e.supplier_id) &&
                              (newCtId ? e.n_contract_type_id === newCtId : !e.n_contract_type_id)
                            );
                            return { ...prev, n_contract_type_id: newCtId, rank_report: String(matching.length + 1) };
                          }
                          return { ...prev, n_contract_type_id: newCtId };
                        });
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="選擇合約類型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">未選擇</SelectItem>
                        {contractTypes.map((ct) => (
                          <SelectItem key={ct.id} value={ct.id}>{ct.chinese_display || ct.display}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Row 3: 供應商 (full width, searchable) */}
                  <div ref={supplierPanelRef} className="relative min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[13px] text-gray-900 block">供應商 <span className="text-red-500">*</span></label>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium transition-colors"
                        onClick={() => setQuickAddSupplierOpen(true)}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        快速新增
                      </button>
                    </div>
                    <ExpenseSupplierDocFilterHint
                      brRequired={expenseAmountRules.brRequired}
                      insuranceRequired={expenseAmountRules.insuranceRequired}
                      canEvaluate={expenseGroupRules.canEvaluate}
                      expenseControlApplicable={expenseGroupRules.expenseControlApplicable}
                      supplierId={expenseForm.supplier_id}
                      eligibility={supplierDocEligibility}
                      eligibilityLoading={supplierDocEligibilityLoading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-8 justify-between text-sm font-normal px-3 overflow-hidden"
                      onClick={() => {
                        setSupplierSearchOpen(prev => !prev);
                        if (!supplierSearchOpen) setSupplierSearchQuery("");
                      }}
                    >
                      {expenseForm.supplier_id
                        ? (() => {
                            const found = supplierOptionsList.find(s => s.id === expenseForm.supplier_id);
                            return found
                              ? <span className="truncate">{found.label}{found.sublabel ? <span className="text-[12px] text-gray-400 ml-1">({found.sublabel})</span> : null}</span>
                              : "選擇供應商";
                          })()
                        : <span className="text-muted-foreground">選擇供應商</span>
                      }
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                    {expenseForm.supplier_id &&
                      expenseGroupRules.expenseControlApplicable &&
                      (expenseAmountRules.brRequired || expenseAmountRules.insuranceRequired) &&
                      !supplierDocEligibilityLoading &&
                      !supplierMeetsDocumentRules(expenseForm.supplier_id, expenseAmountRules, supplierDocEligibility) && (
                        <p className="text-[11px] text-red-600 mt-1 whitespace-pre-line">
                          {getExpenseSupplierDocumentError(
                            expenseForm.supplier_id,
                            expenseAmountRules,
                            supplierDocEligibility
                          )}
                        </p>
                      )}
                    {supplierSearchOpen && (
                      <div className="mt-1 border rounded-md bg-white shadow-md w-full overflow-hidden max-w-full">
                        <div className="flex items-center border-b px-3 min-w-0">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <input
                            className="flex h-9 w-full min-w-0 rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                            placeholder="搜尋名稱/電話/Email/專業技能..."
                            value={supplierSearchQuery}
                            onChange={(e) => {
                              e.stopPropagation();
                              setSupplierSearchQuery(e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                          />
                          {supplierSearchQuery && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSupplierSearchQuery("");
                              }}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="max-h-52 overflow-y-auto overflow-x-hidden overscroll-contain p-1">
                          <div
                            className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setExpenseForm(prev => ({ ...prev, supplier_id: null }));
                              setSupplierSearchOpen(false);
                              setSupplierSearchQuery("");
                            }}
                          >
                            <Check className={cn("mr-2 h-3.5 w-3.5", !expenseForm.supplier_id ? "opacity-100" : "opacity-0")} />
                            未選擇
                          </div>
                          {expenseSupplierOptionsForDropdown
                            .filter(sup => {
                              if (!supplierSearchQuery) return true;
                              const q = supplierSearchQuery.toLowerCase();
                              return (
                                (sup.label || "").toLowerCase().includes(q) ||
                                (sup.sublabel || "").toLowerCase().includes(q) ||
                                (sup.searchText || "").toLowerCase().includes(q)
                              );
                            })
                            .map((sup) => (
                              <div
                                key={sup.id}
                                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground overflow-hidden min-w-0"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setExpenseForm(prev => {
                                    // Auto-update rank_report only when creating (not editing)
                                    if (!editingExpense) {
                                      const expenses = data?.expenses || [];
                                      const matching = expenses.filter(ex =>
                                        ex.supplier_id === sup.id &&
                                        (prev.n_contract_type_id ? ex.n_contract_type_id === prev.n_contract_type_id : !ex.n_contract_type_id)
                                      );
                                      return { ...prev, supplier_id: sup.id, rank_report: String(matching.length + 1) };
                                    }
                                    return { ...prev, supplier_id: sup.id };
                                  });
                                  setSupplierSearchOpen(false);
                                  setSupplierSearchQuery("");
                                }}
                              >
                                <Check className={cn("mr-2 h-3.5 w-3.5 shrink-0", expenseForm.supplier_id === sup.id ? "opacity-100" : "opacity-0")} />
                                <span className="truncate min-w-0">{sup.label}</span>
                                {sup.sublabel && <span className="text-[12px] text-gray-400 ml-1 truncate min-w-0 max-w-[40%]">({sup.sublabel})</span>}
                              </div>
                            ))
                          }
                          {expenseSupplierOptionsForDropdown.filter(sup => {
                            if (!supplierSearchQuery) return true;
                            const q = supplierSearchQuery.toLowerCase();
                            return (sup.label || "").toLowerCase().includes(q) || (sup.sublabel || "").toLowerCase().includes(q) || (sup.searchText || "").toLowerCase().includes(q);
                          }).length === 0 && supplierSearchQuery && (
                            <div className="py-4 text-center text-sm text-muted-foreground">
                              找不到「{supplierSearchQuery}」的供應商
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {expenseSupplierDocError && (
                      <p className="text-[13px] text-red-500 mt-1 whitespace-pre-line">{expenseSupplierDocError}</p>
                    )}
                    <SupplierEditDialog
                      open={quickAddSupplierOpen}
                      onOpenChange={setQuickAddSupplierOpen}
                      supplier={null}
                      onSaved={(_id, created) => {
                        if (!created) return;
                        setSupplierOptionsList((prev) => {
                          if (prev.some((s) => s.id === created.id)) return prev;
                          return [{ id: created.id, label: created.label }, ...prev];
                        });
                        setExpenseForm((prev) => {
                          if (!editingExpense) {
                            const expenses = data?.expenses || [];
                            const matching = expenses.filter(
                              (ex) =>
                                ex.supplier_id === created.id &&
                                (prev.n_contract_type_id
                                  ? ex.n_contract_type_id === prev.n_contract_type_id
                                  : !ex.n_contract_type_id),
                            );
                            return {
                              ...prev,
                              supplier_id: created.id,
                              rank_report: String(matching.length + 1),
                            };
                          }
                          return { ...prev, supplier_id: created.id };
                        });
                        setSupplierSearchOpen(false);
                        setSupplierSearchQuery("");
                      }}
                    />
                  </div>

                  {/* Row 3b: 支出分類 (full width panel) */}
                  <div ref={supplierTypePanelRef}>
                    <label className="text-[13px] text-gray-900 mb-1 block">支出分類 <span className="text-red-500">*</span></label>
                    <div className="rounded-md border border-input bg-gray-50/50 p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <Search className="h-3.5 w-3.5 shrink-0 opacity-50" />
                        <input
                          className="flex h-7 w-full min-w-0 rounded-md bg-white border border-input px-3 py-1 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                          placeholder="搜尋服務類型..."
                          value={supplierTypeSearchQuery}
                          onChange={(e) => setSupplierTypeSearchQuery(e.target.value)}
                        />
                        {supplierTypeSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setSupplierTypeSearchQuery("")}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {supplierTypes
                          .filter(st => {
                            if (!supplierTypeSearchQuery) return true;
                            const q = supplierTypeSearchQuery.toLowerCase();
                            return (st.chinese_display || "").toLowerCase().includes(q) || (st.display || "").toLowerCase().includes(q);
                          })
                          .map((st) => (
                            <button
                              key={st.id}
                              type="button"
                              className={cn(
                                "rounded-md border px-3 py-2 text-[13px] text-center cursor-pointer transition-all truncate",
                                expenseForm.n_supplier_type_id === st.id
                                  ? "border-blue-400 bg-blue-50 text-blue-700 font-medium shadow-sm"
                                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                              )}
                              onClick={() => {
                                setExpenseForm(prev => ({
                                  ...prev,
                                  n_supplier_type_id: prev.n_supplier_type_id === st.id ? null : st.id
                                }));
                              }}
                              title={st.chinese_display || st.display}
                            >
                              {st.chinese_display || st.display}
                            </button>
                          ))
                        }
                      </div>
                      {supplierTypes.filter(st => {
                        if (!supplierTypeSearchQuery) return true;
                        const q = supplierTypeSearchQuery.toLowerCase();
                        return (st.chinese_display || "").toLowerCase().includes(q) || (st.display || "").toLowerCase().includes(q);
                      }).length === 0 && supplierTypeSearchQuery && (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          找不到「{supplierTypeSearchQuery}」的分類
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section: 完成付款時填寫 */}
                  <div className="rounded-lg border border-gray-200 bg-gray-50/30 p-4 space-y-3">
                    <p className="text-[13px] font-medium text-gray-500 mb-2">完成付款時填寫</p>
                    {/* Row 4: 已付金額 + 付款日期 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[13px] text-gray-500 mb-1 block">已付金額</label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          className={cn(
                            "h-8 text-sm",
                            paidExceedsInstallment(expenseForm.paid_amount, expenseForm.installment_amount) &&
                              "border-red-500 focus-visible:ring-red-500"
                          )}
                          aria-invalid={paidExceedsInstallment(expenseForm.paid_amount, expenseForm.installment_amount)}
                          value={expenseForm.paid_amount ?? ""}
                          onChange={(e) => {
                            const val = e.target.value ? parseFloat(e.target.value) : null;
                            setExpenseForm(prev => ({
                              ...prev,
                              paid_amount: val,
                            }));
                          }}
                        />
                        {paidExceedsInstallment(expenseForm.paid_amount, expenseForm.installment_amount) && (
                          <p className="text-[11px] text-red-500 mt-1">已付金額不可大於支出金額</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[13px] text-gray-500 mb-1 block">付款日期</label>
                        <Input
                          type="date"
                          className="h-8 text-sm"
                          value={expenseForm.payment_date ?? ""}
                          onChange={(e) => setExpenseForm(prev => ({ ...prev, payment_date: e.target.value || null }))}
                        />
                      </div>
                    </div>

                    {/* Row 5: 付款方式 (pill shape options) */}
                    <div>
                      <label className="text-[13px] text-gray-500 mb-1 block">付款方式</label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={cn(
                            "rounded-full px-3 py-1 text-[13px] border transition-all",
                            !expenseForm.payment_method_id
                              ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
                              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                          )}
                          onClick={() => setExpenseForm(prev => ({ ...prev, payment_method_id: null }))}
                        >
                          未選擇
                        </button>
                        {paymentMethods.map((pm) => (
                          <button
                            key={pm.id}
                            type="button"
                            className={cn(
                              "rounded-full px-3 py-1 text-[13px] border transition-all",
                              expenseForm.payment_method_id === pm.id
                                ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
                                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                            )}
                            onClick={() => setExpenseForm(prev => ({ ...prev, payment_method_id: pm.id }))}
                          >
                            {pm.display}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Row 6: 支票號碼 (only visible when payment method is Cheque) */}
                    {(() => {
                      const selectedPm = paymentMethods.find(pm => pm.id === expenseForm.payment_method_id);
                      const isCheque = selectedPm?.display?.toLowerCase().includes("cheque");
                      return isCheque ? (
                        <div>
                          <label className="text-[13px] text-gray-500 mb-1 block">支票號碼</label>
                          <Input
                            placeholder="支票號碼"
                            className="h-8 text-sm"
                            value={expenseForm.cheque_no ?? ""}
                            onChange={(e) => setExpenseForm(prev => ({ ...prev, cheque_no: e.target.value || null }))}
                          />
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* Row 6b: 供應商報價單 (supplier quotation file) */}
                  <div>
                    <label className="text-[13px] text-gray-500 mb-1 block">
                      供應商報價單
                      {expenseGroupRules.expenseControlApplicable && expenseAmountRules.quotationRequired && (
                        <>
                          {!expenseGroupHasQuotation ? (
                            <>
                              <span className="text-red-500 ml-0.5">*</span>
                              <span className="text-[12px] text-amber-600 ml-2">
                                群組支出金額達 $3,000 或以上，必須上傳供應商報價單（全組只需一份）
                              </span>
                            </>
                          ) : (
                            <span className="text-[12px] text-emerald-600 ml-2">
                              群組支出金額達 $3,000 或以上（全組已有報價單）
                            </span>
                          )}
                        </>
                      )}
                    </label>
                    {expenseForm.supplier_quotation_file && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {expenseForm.supplier_quotation_file.split(",").filter(Boolean).map((url, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-[12px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">
                            <Paperclip className="w-3 h-3" />
                            <a
                              href={url.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline max-w-[180px] truncate"
                              title={decodeURIComponent(url.split("/").pop()?.split("?")[0] || `file-${i + 1}`)}
                            >
                              {decodeURIComponent(url.split("/").pop()?.split("?")[0] || `file-${i + 1}`).substring(0, 28)}
                            </a>
                            <button
                              type="button"
                              className="text-red-400 hover:text-red-600 ml-0.5"
                              onClick={() => {
                                const urls = expenseForm.supplier_quotation_file!.split(",").filter(Boolean);
                                urls.splice(i, 1);
                                setExpenseForm(prev => ({ ...prev, supplier_quotation_file: urls.join(",") || null }));
                              }}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {!expenseForm.supplier_quotation_file && expenseGroupHasQuotation && (
                      <p className="text-[12px] text-emerald-600 mb-2">
                        此群組其他支出已有供應商報價單（全組只需一份）
                      </p>
                    )}
                    <label className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-gray-300 hover:border-emerald-400 transition-colors cursor-pointer bg-gray-50">
                      <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
                        {expenseQuotationUploading ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 上傳中...</>
                        ) : (
                          <><Upload className="w-3.5 h-3.5" /> 選擇檔案</>
                        )}
                      </div>
                      <input
                        type="file"
                        multiple
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleExpenseQuotationUpload}
                        disabled={expenseQuotationUploading}
                      />
                    </label>
                    {expenseQuotationError && (
                      <p className="text-[13px] text-red-500 mt-1">{expenseQuotationError}</p>
                    )}
                  </div>

                  {/* Row 7: 附件 */}
                  <div>
                    <label className="text-[13px] text-gray-500 mb-1 block">附件</label>
                    {expenseForm.pdf_file && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {expenseForm.pdf_file.split(",").filter(Boolean).map((url, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-[12px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                            <Paperclip className="w-3 h-3" />
                            {decodeURIComponent(url.split("/").pop()?.split("?")[0] || `file-${i + 1}`).substring(0, 20)}
                            <button
                              type="button"
                              className="text-red-400 hover:text-red-600 ml-0.5"
                              onClick={() => {
                                const urls = expenseForm.pdf_file!.split(",").filter(Boolean);
                                urls.splice(i, 1);
                                setExpenseForm(prev => ({ ...prev, pdf_file: urls.join(",") || null }));
                              }}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <label className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-gray-300 hover:border-blue-400 transition-colors cursor-pointer bg-gray-50">
                      <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
                        {expenseFileUploading ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 上傳中...</>
                        ) : (
                          <><Upload className="w-3.5 h-3.5" /> 選擇檔案</>
                        )}
                      </div>
                      <input
                        type="file"
                        multiple
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleExpenseFileUpload}
                        disabled={expenseFileUploading}
                      />
                    </label>
                    {expenseFileError && (
                      <p className="text-[13px] text-red-500 mt-1">{expenseFileError}</p>
                    )}
                  </div>

                  {/* Row 8: 備註 */}
                  <div>
                    <label className="text-[13px] text-gray-500 mb-1 block">備註</label>
                    <Textarea
                      placeholder="輸入備註..."
                      className="text-sm min-h-[72px] resize-y"
                      rows={3}
                      value={expenseForm.remark_t ?? ""}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, remark_t: e.target.value || null }))}
                    />
                  </div>
                </div>
                <DialogFooter className="border-t pt-4 mt-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => { setShowExpenseDialog(false); resetExpenseForm(); }}>
                    取消
                  </Button>
                  <DisabledSubmitControl
                    key={`${showExpenseDialog}-${editingExpense?.id ?? "new"}`}
                    blocked={expenseSaveDisabled}
                    busy={expenseSaving || expenseFileUploading}
                    reasons={expenseSubmitBlockers}
                  >
                    <Button
                      size="sm"
                      className="gap-1.5 bg-red-500 hover:bg-red-600"
                      disabled={expenseSaveDisabled}
                      onClick={handleSaveExpense}
                    >
                      {expenseSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {editingExpense ? "更新" : "新增"}
                    </Button>
                  </DisabledSubmitControl>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          );
        })()}

        {/* COST STRUCTURE TAB — Bubble "Group View Cost Structure v2" → "成本結構" */}
        {activeTab === "cost-structure" && (() => {
          const expenses = data.expenses || [];
          const quotExpenses = data.quotation_expenses || [];
          const projInitExpenses = data.project_initial_expenses || [];

          // ─── Group L1 quotation_expenses by expense_type_name ───
          const l1CatMap = new Map<string, { name: string; amount: number }>();
          quotExpenses.forEach((q) => {
            const catName = q.expense_type_name || "其他 Other";
            if (!l1CatMap.has(catName)) {
              l1CatMap.set(catName, { name: catName, amount: 0 });
            }
            l1CatMap.get(catName)!.amount += (q.amount || 0);
          });
          const l1Categories = Array.from(l1CatMap.values()).sort((a, b) => b.amount - a.amount);

          // ─── Group L2 project_initial_expenses by expense_type_name ───
          const l2CatMap = new Map<string, { name: string; amount: number }>();
          projInitExpenses.forEach((p) => {
            const catName = p.expense_type_name || "其他 Other";
            if (!l2CatMap.has(catName)) {
              l2CatMap.set(catName, { name: catName, amount: 0 });
            }
            l2CatMap.get(catName)!.amount += (p.amount || 0);
          });
          const l2Categories = Array.from(l2CatMap.values()).sort((a, b) => b.amount - a.amount);

          // ─── Group L3 actual expenses by supplier_type_name (category) ───
          const l3CatMap = new Map<string, { name: string; actual: number }>();
          expenses.forEach((e) => {
            const catName = e.supplier_type_name || e.contract_type_name || "其他 Other";
            if (!l3CatMap.has(catName)) {
              l3CatMap.set(catName, { name: catName, actual: 0 });
            }
            l3CatMap.get(catName)!.actual += (e.amount || 0);
          });
          const l3Categories = Array.from(l3CatMap.values()).sort((a, b) => b.actual - a.actual);

          // ─── Merge all category names across L1/L2/L3 ───
          const allCatNames = new Set<string>();
          l1Categories.forEach(c => allCatNames.add(c.name));
          l2Categories.forEach(c => allCatNames.add(c.name));
          l3Categories.forEach(c => allCatNames.add(c.name));
          
          const l1ByName = new Map(l1Categories.map(c => [c.name, c.amount]));
          const l2ByName = new Map(l2Categories.map(c => [c.name, c.amount]));
          const l3ByName = new Map(l3Categories.map(c => [c.name, c.actual]));

          // Sort by L1 amount desc, then L2, then L3
          const mergedCategories = Array.from(allCatNames).map(name => ({
            name,
            l1: l1ByName.get(name) || 0,
            l2: l2ByName.get(name) || 0,
            l3: l3ByName.get(name) || 0,
          })).sort((a, b) => (b.l1 + b.l2 + b.l3) - (a.l1 + a.l2 + a.l3));

          // ─── Totals ───
          const l1QuotationRevenue = data.estimated_income || 0;
          const l1QuotationExpense = quotExpenses.reduce((s, q) => s + (q.amount || 0), 0);
          const l1GrossProfit = l1QuotationRevenue - l1QuotationExpense;

          const l2ForecastRevenue = l1QuotationRevenue;
          const l2ForecastExpense = projInitExpenses.reduce((s, p) => s + (p.amount || 0), 0);
          const l2GrossProfit = l2ForecastRevenue - l2ForecastExpense;

          const l3ActualRevenue = totalIncome;
          const l3ActualExpense = totalExpense;
          const l3GrossProfit = l3ActualRevenue - l3ActualExpense;

          // ─── Pie chart data ───
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

              {/* ─── Accounting Statement Table ─── */}
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
                    {/* Total Revenue Row */}
                    <tr className="border-b border-gray-100 bg-blue-50/30">
                      <td className="py-3 px-3 font-semibold text-blue-600">Total Revenue 總營收</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-gray-900">{fmtCS(l1QuotationRevenue)}</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-violet-600">{fmtCS(l2ForecastRevenue)}</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-gray-900">{fmtCS(l3ActualRevenue)}</td>
                    </tr>

                    {/* Expense Category Rows — merged across L1/L2/L3 */}
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

                    {/* Total Expense Row */}
                    <tr className="border-b border-gray-200 bg-red-50/30">
                      <td className="py-3 px-3 font-semibold text-red-600">- Total Expense 總支出</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-gray-900">{fmtCS(l1QuotationExpense)}</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-violet-600">{fmtCS(l2ForecastExpense)}</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-gray-900">{fmtCS(l3ActualExpense)}</td>
                    </tr>

                    {/* Gross Profit Row */}
                    <tr className="bg-emerald-50/30">
                      <td className="py-3 px-3 font-bold text-emerald-600">= Gross Profit 毛利</td>
                      <td className={`py-3 px-3 text-right font-mono font-bold ${l1GrossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmtCS(l1GrossProfit)}</td>
                      <td className={`py-3 px-3 text-right font-mono font-bold ${l2GrossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmtCS(l2GrossProfit)}</td>
                      <td className={`py-3 px-3 text-right font-mono font-bold ${l3GrossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmtCS(l3GrossProfit)}</td>
                    </tr>

                    {/* Gross Margin % Row */}
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

              {/* Record counts */}
              <div className="flex gap-4 mt-3 text-[12px] text-gray-400">
                <span>L1: {quotExpenses.length} 筆報價支出</span>
                <span>L2: {projInitExpenses.length} 筆初始費用</span>
                <span>L3: {expenses.length} 筆實際支出</span>
              </div>
            </SectionCard>

            {/* ─── Pie Charts: Quotation / Initial / Actual ─── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* L1 Quotation Expense Pie */}
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

              {/* L2 Project Initial Expense Pie */}
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

              {/* L3 Actual Expense Pie */}
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

        {/* WORK SCHEDULE TAB — Bubble "Group text Work Schedule" → "工作時間表" */}
        {activeTab === "work-schedule" && (
          <div className="space-y-6">
            {/* Alert: Work schedule completion required for expense access (初期檢查 @ 40% progress) */}
            {workScheduleProgress !== null && workScheduleProgress < 70 && (() => {
              const completion = siteCompletionRatio(data.start_date, data.handover_date);
              if (completion == null) return null;
              const stage2Active = completion >= 0.4;
              const isOverdue = stage2Active;
              const milestoneDate = (() => {
                const s = new Date(data.start_date!).getTime();
                const h = new Date(data.handover_date!).getTime();
                if (isNaN(s) || isNaN(h) || h <= s) return null;
                return new Date(s + 0.4 * (h - s));
              })();
              return (
                <div className={`flex items-start gap-3 rounded-xl px-4 py-3 ${isOverdue ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
                  <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isOverdue ? 'text-red-500' : 'text-amber-500'}`} />
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${isOverdue ? 'text-red-800' : 'text-amber-800'}`}>
                      {isOverdue ? '🚨' : '⚠️'} 重要提醒：未完成工程進度表將無法使用支出功能
                    </p>
                    <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                      {isOverdue
                        ? '工地進度已達 40%，工程進度表須填寫 70% 以上，否則系統已限制此項目的支出相關操作。'
                        : '請於工地進度達 40% 前完成工程進度表（70% 以上），否則系統將限制此項目的支出相關操作。'}
                      {data.start_date && data.handover_date && (
                        <span className="ml-1 font-medium">
                          目前工地進度：{Math.round(completion * 100)}%
                        </span>
                      )}
                      {milestoneDate && !stage2Active && (
                        <span className={`ml-1 font-bold text-amber-700`}>
                          ｜40% 里程碑：{formatDate(milestoneDate.toISOString())}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Basic dates */}
            <SectionCard title="基本工程日期" icon={CalendarDays} iconColor="text-blue-500">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-2">
                <div>
                  <p className="text-xs text-gray-400 mb-1">簽約日期</p>
                  <p className="text-sm font-medium text-gray-800">{formatDate(data.signed_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">開工日期</p>
                  <p className="text-sm font-medium text-gray-800">{formatDate(data.start_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">交付日期</p>
                  <p className="text-sm font-medium text-gray-800">{formatDate(data.handover_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">結欠日期</p>
                  <p className="text-sm font-medium text-gray-800">{formatDate(data.e_outstanding_date)}</p>
                </div>
              </div>
            </SectionCard>

            {/* 時間表類型 — schedule group drives which default task list is shown */}
            <SectionCard title="時間表類型" icon={CalendarDays} iconColor="text-amber-500">
              <div className="py-2">
                <div className="max-w-md">
                  <p className="text-xs text-gray-400 mb-1">
                    選擇時間表類型，下方任務清單將根據所選類型自動更新。
                  </p>
                  <Select
                    value={data.os_schedule_group || scheduleGroup || ""}
                    onValueChange={handleScheduleGroupChange}
                    disabled={
                      savingScheduleGroup ||
                      !(canEdit("projects.work-schedule") || canEdit("projects"))
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="選擇時間表類型" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(
                        new Set(
                          [
                            ...scheduleGroupOptions,
                            ...(scheduleGroup ? [scheduleGroup] : []),
                            ...(data.os_schedule_group ? [data.os_schedule_group] : []),
                          ].filter(Boolean),
                        ),
                      ).map((opt) => (
                        <SelectItem key={opt} value={opt} className="text-sm">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {savingScheduleGroup && (
                    <p className="text-xs text-gray-400 mt-1">儲存中…</p>
                  )}
                  {scheduleGroupError && (
                    <p className="text-xs text-red-500 mt-1">{scheduleGroupError}</p>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* Working Schedule Panel — live data from project_schedules */}
            <SchedulePanel
              projectId={data.id}
              entityType="bwa_project"
              mode="working"
              projectCode={data.project_code || undefined}
              projectOsScheduleGroup={scheduleGroup || undefined}
              permissionModule="projects.work-schedule"
              onDefaultTaskProgressChange={handleWorkScheduleProgressChange}
            />
          </div>
        )}

        {/* PAYMENT SCHEDULE TAB — 收款進度追蹤面板 */}
        {activeTab === "payment-schedule" && (
          <div className="space-y-6">
            <PaymentSchedulePanel
              incomes={data.incomes || []}
              estimatedIncome={data.estimated_income}
              projectCode={data.project_code || undefined}
              projectName={data.project_name || data.customer_display_name || undefined}
              customerName={data.customer_display_name || data.customer_name || undefined}
              customerAddress={data.customer_address || data.site_address || undefined}
              pmName={data.pm_name || undefined}
              costCentre={projectCostCentre}
              permissionModule="projects.payment-schedule"
              onIncomeClick={(incomeId) => {
                // Navigate to invoice editor for this income
                router.push(`/projects/bwa/${data.id}/invoice/${incomeId}`);
              }}
            />
          </div>
        )}

        {/* EXPENSE CONTROL TAB — 出支票受限 checklist */}
        {activeTab === "expense-control" && (
          <div className="space-y-6">
            <ExpenseControlPanel
              projectId={projectId}
              onResult={setExpenseControl}
              onFixItem={handleExpenseControlFix}
              canFixItem={canFixExpenseControlItem}
              tabAvailability={{
                workSchedule: hasScheduleGroup,
                siteStatus: !isMiniProject,
              }}
              isActive={activeTab === "expense-control"}
            />
          </div>
        )}

        {/* DOCS TAB — Bubble "Group text Docs" → "文件管理" */}
        {activeTab === "docs" && (
          <div className="space-y-6">
            <ProjectDocumentsPanel
              projectId={projectId}
              permissionModule="projects.docs"
              customerId={data.customer_id}
              customerDocsFocusTypeKey={expenseControlDocsFocus?.customerDocsFocusTypeKey}
              onCustomerDocsFocusHandled={() => {
                setExpenseControlDocsFocus((prev) => {
                  if (!prev?.customerDocsFocusTypeKey) return prev;
                  const next = { ...prev, customerDocsFocusTypeKey: undefined };
                  const hasProjectFocus =
                    (next.highlightDocTypeIds?.length ?? 0) > 0 ||
                    !!next.openUploadForDocTypeId;
                  return hasProjectFocus ? next : null;
                });
              }}
              docsFocus={expenseControlDocsFocus}
              onDocsFocusHandled={() => setExpenseControlDocsFocus(null)}
            />
          </div>
        )}

        {/* BOX FILES TAB — browse project working_folder on Box */}
        {activeTab === "box-files" && (
          <div className="space-y-6">
            <SectionCard title="Box 工作資料夾" icon={FolderOpen} iconColor="text-blue-500">
              <p className="text-sm text-slate-500">Box file sync is not available in this demo.</p>
            </SectionCard>
          </div>
        )}

        {/* 3D RENDER TAB — Bubble "Group View 3D Render" → "3D效果圖" */}
        {activeTab === "3d" && (
          <div className="space-y-6">
            <ProjectThreeDRenderPanel projectId={projectId} permissionModule="projects.3d" />
          </div>
        )}

        {/* 10 DAY'S REPORT TAB — formerly Weekly Report / 每10天工地報告 */}
        {activeTab === "weekly-report" && (
          <div className="space-y-6">
            <WeeklyReportPanel
              projectId={projectId}
              startDate={data.start_date}
              handoverDate={data.handover_date}
              projectName={data.project_name ?? undefined}
              projectCode={data.project_code ?? undefined}
              pmName={data.pm_name ?? undefined}
              designerName={data.designer_name ?? undefined}
              costCentreId={data.cost_centre_id ?? projectCostCentre?.id ?? null}
              permissionModule="projects.weekly-report"
            />
          </div>
        )}

        {/* MAN HOUR TAB — Bubble "Group Man Hour" → "工時管理" */}
        {activeTab === "manhour" && (
          <div className="space-y-6">
            <SectionCard title="工時管理" icon={Clock} iconColor="text-amber-500">
              <p className="text-xs text-gray-400 mb-3">
                管理此項目相關的工作時數記錄（資料來源：Base44）
              </p>
              <ManHourPanel
                projectBubbleId={data.bubble_id}
                projectId={data.id}
                permissionModule="projects.manhour"
              />
            </SectionCard>
          </div>
        )}

        {/* SITE STATUS TAB — Bubble "Group Site Status" → "工地狀況" */}
        {activeTab === "site-status" && (
          <div className="space-y-6">
            <SectionCard title="工地狀況 Site Status" icon={HardHat} iconColor="text-orange-500">
              <p className="text-xs text-gray-400 mb-4">管理項目工地現場狀況，包括冷氣、地板、間隔等。</p>
              <SiteStatusPanel projectId={data.id} permissionModule="projects.site-status" />
            </SectionCard>
            {(data.main_air_supplier_name || data.main_air_supplier_id) && (
              <SectionCard title="其他相關冷氣工程" icon={Wind} iconColor="text-blue-500">
                <DetailRow label="冷氣供應商" value={data.main_air_supplier_name || "—"} icon={Wind} />
              </SectionCard>
            )}
          </div>
        )}

        {/* SUPPLIER COMMENT TAB — Bubble "Group text Supplier Comment" */}
        {activeTab === "supplier-comment" && (
          <div className="space-y-6">
            {/* Alert: Supplier comment completion required for expense access at 80% paid out */}
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">
                  ⚠️ 重要提醒：未完成供應商評論將限制支出功能
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  當項目已付款比率達到 80% 時，若尚未完成供應商評論，系統將自動停用該項目的支出功能。請及時完成所有供應商評論以避免影響付款流程。
                </p>
              </div>
            </div>

            <div className="bg-blue-50/50 rounded-md p-3 flex items-start gap-2">
              <MessageCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-blue-700">供應商評論</p>
                <p className="text-[13px] text-blue-500/70 mt-0.5">
                  查看及評論此項目相關供應商的表現，所有評論對團隊成員可見。
                </p>
              </div>
            </div>
            <SupplierCommentPanel projectId={projectId} permissionModule="projects.supplier-comment" />
          </div>
        )}

        {/* BUILDING COMMENT TAB — BMO Building management */}
        {activeTab === "building-comment" && (
          <BuildingCommentPanel
            buildingId={data.r_building_id}
            buildingName={data.building_name}
            context={{ type: "project", id: projectId }}
            permissionModule="projects.building-comment"
          />
        )}

        {/* ASANA TAB — comments from linked Asana task */}
        {activeTab === "asana" && (
          <div className="space-y-6">
            <div className="bg-blue-50/50 rounded-md p-3 flex items-start gap-2">
              <AsanaIcon size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-blue-700">Asana 評論</p>
                <p className="text-[13px] text-blue-500/70 mt-0.5">
                  顯示此項目 Asana 連結對應任務的評論，資料由 Asana 同步。
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-500">Asana sync is not available in this demo.</p>
          </div>
        )}

        {/* INTERNAL REVIEW TAB — Bubble "Group text Internal Review" */}
        {activeTab === "internal-review" && (
          <div className="space-y-6">
            <div className="bg-blue-50/50 rounded-md p-3 flex items-start gap-2">
              <Shield className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-[14px] text-blue-700">This can be viewed by you and super admin only</p>
            </div>
            <ProjectInternalCommentPanel projectId={projectId} permissionModule="projects.internal-review" />
          </div>
        )}

        {/* TENDER TAB — Bubble "Group View Tender" → "工程招標" */}
        {activeTab === "tender" && <EmptyTab title="工程招標" icon={Gavel} />}
        </>
        )}
      </div>

      {/* ─── EDIT PROJECT DIALOG ────────────────────────────── */}
      {data && (
        <BWAProjectEditDialog
          open={showEditDialog}
          onClose={() => {
            setShowEditDialog(false);
            setEditDialogScrollTo(null);
          }}
          onSaved={() => {
            setShowEditDialog(false);
            setEditDialogScrollTo(null);
            loadData(true);
          }}
          data={data}
          scrollToSection={editDialogScrollTo}
        />
      )}

      {/* ─── EDIT FINANCIALS DIALOG (Super Admin / Admin only) ── */}
      {data && isAdminOrAbove && (
        <FinancialEditDialog
          open={showFinancialDialog}
          onOpenChange={setShowFinancialDialog}
          projectId={data.id}
          pitchingId={data.pitching_id || data.pitching || null}
          projectEstIncome={data.estimated_income ?? null}
          onSaved={() => loadData(true)}
        />
      )}

      {/* ─── STATUS UPDATE DIALOG (Super Admin / Admin only) ──── */}
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

      {/* ─── CASCADE DELETE DIALOG (Super Admin Only — Danger Confirm) ────── */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-red-600 px-6 py-4 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="text-white font-bold text-lg">危險操作確認 — 級聯刪除</h3>
                  <p className="text-red-100 text-sm">Cascade Delete — {data?.project_code}</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {cascadeLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-red-500" />
                  <p className="text-sm text-gray-500">正在分析關聯數據鏈...</p>
                  <p className="text-xs text-gray-400">Analyzing relationship chain...</p>
                </div>
              ) : cascadeDeletionLog ? (
                /* ─── RESULT LOG ────────────────────── */
                <div className="space-y-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <p className="text-emerald-800 text-sm font-bold mb-2">✅ 刪除完成 Deletion Complete</p>
                    <div className="space-y-1">
                      {cascadeDeletionLog.map((log, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {log.error ? (
                            <span className="text-red-600">❌ {log.table}: {log.error}</span>
                          ) : (
                            <span className="text-emerald-700">✓ {log.table} — deleted</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 text-center">正在跳轉到項目列表...</p>
                </div>
              ) : cascadeStep === "analysis" && cascadeAnalysis ? (
                /* ─── STEP 1: SELECTION ─────────────── */
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-amber-800 text-sm font-medium">⚠️ 以下數據與此項目有關聯。請選擇要一併刪除的項目：</p>
                    <p className="text-amber-700 text-xs mt-1">The following data is related to this project. Select items to delete together:</p>
                  </div>

                  {/* Summary */}
                  <div className="flex items-center gap-3 text-xs text-gray-500 border-b pb-2">
                    <span>📊 共發現 <strong className="text-gray-800">{cascadeAnalysis.total_related_count}</strong> 條關聯記錄</span>
                    <span>|</span>
                    <button
                      className="text-blue-600 hover:underline"
                      onClick={() => {
                        const allOn: Record<string, boolean> = {};
                        cascadeAnalysis.related_groups.forEach((g) => { allOn[g.table] = true; });
                        if (cascadeAnalysis.pitching_chain?.children) {
                          cascadeAnalysis.pitching_chain.children.forEach((c) => { allOn[c.table] = true; });
                        }
                        setCascadeSelections(allOn);
                        setDeletePitching(!!cascadeAnalysis.pitching_chain);
                      }}
                    >
                      全選 Select All
                    </button>
                    <button
                      className="text-blue-600 hover:underline"
                      onClick={() => {
                        setCascadeSelections({});
                        setDeletePitching(false);
                        setDeleteCustomer(false);
                      }}
                    >
                      取消全選 Deselect All
                    </button>
                  </div>

                  {/* Direct Relations */}
                  {cascadeAnalysis.related_groups.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        直接關聯 Direct Relations
                      </h4>
                      {cascadeAnalysis.related_groups.map((group) => (
                        <CascadeGroupItem
                          key={group.table}
                          group={group}
                          selected={!!cascadeSelections[group.table]}
                          onToggle={(val) => setCascadeSelections((prev) => ({ ...prev, [group.table]: val }))}
                        />
                      ))}
                    </div>
                  )}

                  {/* Pitching Chain */}
                  {cascadeAnalysis.pitching_chain && (
                    <div className="space-y-2 border-t pt-4">
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        競標鏈 Pitching Chain (二級關聯)
                      </h4>
                      <div className="ml-2 border-l-2 border-amber-200 pl-3">
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-amber-50 border border-amber-100">
                          <Checkbox
                            checked={deletePitching}
                            onCheckedChange={(val) => {
                              setDeletePitching(!!val);
                              if (!val && cascadeAnalysis.pitching_chain?.children) {
                                const updated = { ...cascadeSelections };
                                cascadeAnalysis.pitching_chain.children.forEach((c) => { updated[c.table] = false; });
                                setCascadeSelections(updated);
                              }
                            }}
                            className="border-amber-400 data-[state=checked]:bg-amber-500"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-amber-800">
                              {cascadeAnalysis.pitching_chain.label}
                            </span>
                            <p className="text-[13px] text-amber-600">
                              {cascadeAnalysis.pitching_chain.records[0]?.display}
                            </p>
                          </div>
                          <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-mono">
                            {cascadeAnalysis.pitching_chain.fk_action}
                          </span>
                        </div>

                        {deletePitching && cascadeAnalysis.pitching_chain.children && (
                          <div className="mt-2 ml-4 space-y-2">
                            {cascadeAnalysis.pitching_chain.children.map((child) => (
                              <CascadeGroupItem
                                key={child.table}
                                group={child}
                                selected={!!cascadeSelections[child.table]}
                                onToggle={(val) => setCascadeSelections((prev) => ({ ...prev, [child.table]: val }))}
                                nested
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Customer Chain */}
                  {cascadeAnalysis.customer_chain && (() => {
                    // Check if customer has other projects → disable delete option
                    const otherProjectsChild = cascadeAnalysis.customer_chain.children?.find(
                      (c) => c.table === "customer_other_projects"
                    );
                    const hasOtherProjects = otherProjectsChild && otherProjectsChild.count > 0;
                    return (
                    <div className="space-y-2 border-t pt-4">
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        客戶鏈 Customer Chain
                      </h4>
                      <div className="ml-2 border-l-2 border-emerald-200 pl-3">
                        <div className={`flex items-center gap-3 p-2 rounded-lg border ${deleteCustomer ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-100"}`}>
                          <Checkbox
                            checked={deleteCustomer}
                            onCheckedChange={(val) => setDeleteCustomer(!!val)}
                            disabled={!!hasOtherProjects}
                            className="border-gray-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          <span className="text-lg">👥</span>
                          <div className="flex-1">
                            <span className={`text-sm font-medium ${deleteCustomer ? "text-red-800" : "text-emerald-800"}`}>
                              {cascadeAnalysis.customer_chain.label}
                            </span>
                            <p className={`text-[13px] ${deleteCustomer ? "text-red-600" : "text-emerald-600"}`}>
                              {cascadeAnalysis.customer_chain.records[0]?.display}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${deleteCustomer ? "bg-red-200 text-red-800" : "bg-emerald-200 text-emerald-800"}`}>
                            {deleteCustomer ? "DELETE" : "KEEP"}
                          </span>
                        </div>

                        {hasOtherProjects && (
                          <p className="mt-2 text-[13px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                            ⚠️ 此客戶尚有其他 BWA/BWF 項目關聯，無法刪除。This customer has other linked BWA or BWF projects and cannot be deleted.
                          </p>
                        )}

                        {cascadeAnalysis.customer_chain.children && cascadeAnalysis.customer_chain.children.length > 0 && (
                          <div className="mt-2 ml-4 space-y-2">
                            {cascadeAnalysis.customer_chain.children.map((child) => (
                              <div
                                key={child.table}
                                className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-100"
                              >
                                <span className="text-lg">ℹ️</span>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700">{child.label}</span>
                                    <span className="text-[12px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{child.count}</span>
                                  </div>
                                  {child.records.length > 0 && (
                                    <ul className="mt-1 space-y-0.5">
                                      {child.records.slice(0, 3).map((r) => (
                                        <li key={r.id} className="text-[13px] text-gray-500 flex items-center gap-1">
                                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                                          {r.display}
                                        </li>
                                      ))}
                                      {child.records.length > 3 && (
                                        <li className="text-[13px] text-gray-400 italic">
                                          ...及其他 {child.records.length - 3} 條
                                        </li>
                                      )}
                                    </ul>
                                  )}
                                </div>
                                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-mono whitespace-nowrap">
                                  {child.fk_action}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {!deleteCustomer && (
                          <p className="mt-2 text-[13px] text-emerald-600 italic">
                            ℹ️ 客戶不會被刪除。Customer will NOT be deleted.
                          </p>
                        )}
                        {deleteCustomer && (
                          <p className="mt-2 text-[13px] text-red-600 font-semibold">
                            ⚠️ 客戶及其所有關聯數據將被刪除！Customer and all related data will be PERMANENTLY deleted!
                          </p>
                        )}
                      </div>
                    </div>
                    );
                  })()}

                  {cascadeAnalysis.related_groups.length === 0 && !cascadeAnalysis.pitching_chain && !cascadeAnalysis.customer_chain && (
                    <div className="text-center py-6">
                      <p className="text-gray-500 text-sm">✅ 此項目沒有關聯數據</p>
                      <p className="text-gray-400 text-xs">No related data found. Safe to delete directly.</p>
                    </div>
                  )}
                </div>
              ) : cascadeStep === "confirm" ? (
                /* ─── STEP 2: TYPE CONFIRM ──────────── */
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 text-sm font-medium mb-1">⚠️ 此操作無法撤銷！</p>
                    <p className="text-red-700 text-xs">
                      You are about to permanently delete project: <strong className="text-red-900">{data?.project_code}</strong>
                    </p>
                    <div className="mt-2 text-xs text-red-600">
                      <p>將刪除 Will delete:</p>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>此項目本身 The project itself</li>
                        {Object.entries(cascadeSelections).filter(([, v]) => v).map(([key]) => {
                          const group = cascadeAnalysis?.related_groups.find((g) => g.table === key)
                            || cascadeAnalysis?.pitching_chain?.children?.find((c) => c.table === key);
                          return group ? <li key={key}>{group.label} ({group.count})</li> : null;
                        })}
                        {deletePitching && <li>關聯競標 Linked Pitching</li>}
                      </ul>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      請準確輸入以下句子確認 (Please type to confirm):
                    </label>
                    <div className="bg-gray-100 rounded-lg px-4 py-3 border border-gray-200">
                      <code className="text-sm font-mono text-gray-800 select-none">Confirm Delete</code>
                    </div>
                    <input
                      ref={deleteInputRef}
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      onPaste={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                      onContextMenu={(e) => e.preventDefault()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && deleteConfirmText === "Confirm Delete") handleDelete();
                        if (e.key === "Escape") {
                          setShowDeleteDialog(false);
                        }
                      }}
                      placeholder="Type the sentence above exactly..."
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      className={`w-full border-2 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none transition ${
                        deleteConfirmText.length === 0
                          ? "border-gray-200 focus:border-blue-400"
                          : deleteConfirmText === "Confirm Delete"
                          ? "border-emerald-400 bg-emerald-50 focus:border-emerald-500"
                          : "border-red-300 focus:border-red-400"
                      }`}
                    />
                    {deleteAttempts > 0 && deleteConfirmText !== "Confirm Delete" && (
                      <p className="text-red-500 text-xs">❌ 輸入不正確，請重新輸入。</p>
                    )}
                    {deleteConfirmText.length > 0 && deleteConfirmText !== "Confirm Delete" && (
                      <div className="text-xs text-gray-400">
                        {deleteConfirmText.length}/{"Confirm Delete".length} characters
                      </div>
                    )}
                    {deleteConfirmText === "Confirm Delete" && (
                      <p className="text-emerald-600 text-xs font-medium">✅ 確認句子正確！You may proceed.</p>
                    )}
                  </div>
                  <p className="text-[13px] text-gray-400 italic">
                    🚫 Copy & paste is disabled. You must type the sentence manually.
                  </p>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            {!cascadeDeletionLog && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0">
                <button
                  onClick={() => {
                    if (cascadeStep === "confirm") {
                      setCascadeStep("analysis");
                      setDeleteConfirmText("");
                      setDeleteAttempts(0);
                    } else {
                      setShowDeleteDialog(false);
                    }
                  }}
                  disabled={cascadeExecuting}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-100 transition disabled:opacity-50"
                >
                  {cascadeStep === "confirm" ? "← 返回選擇 Back" : "取消 Cancel"}
                </button>

                <div className="flex items-center gap-2">
                  {cascadeStep === "analysis" && !cascadeLoading && (
                    <button
                      onClick={() => {
                        setCascadeStep("confirm");
                        setTimeout(() => deleteInputRef.current?.focus(), 100);
                      }}
                      className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
                    >
                      下一步：確認刪除 →
                    </button>
                  )}
                  {cascadeStep === "confirm" && (
                    <button
                      onClick={() => {
                        if (deleteConfirmText === "Confirm Delete") {
                          handleDelete();
                        } else {
                          setDeleteAttempts((a) => a + 1);
                        }
                      }}
                      disabled={deleteConfirmText !== "Confirm Delete" || cascadeExecuting}
                      className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      {cascadeExecuting ? (
                        <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 刪除中...</span>
                      ) : (
                        "🔥 確認級聯刪除 Execute"
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── BV CRUD DIALOG ────────────────────────────── */}
      <Dialog open={showBVDialog} onOpenChange={setShowBVDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-violet-600">
              <UserPlus className="w-5 h-5" />
              {bvEditingId ? "編輯團隊成員" : "新增團隊成員"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">
                負責人 (Handler)
              </label>
              <Select value={bvFormHandlerId} onValueChange={setBvFormHandlerId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="選擇負責人..." />
                </SelectTrigger>
                <SelectContent>
                  {staffOptions
                    .filter((s) => {
                      // Exclude handlers already assigned (prevent duplicates)
                      // But allow the currently edited handler to remain selectable
                      const existingHandlerIds = projectBV
                        .filter((bv) => bv.id !== bvEditingId)
                        .map((bv) => bv.handler_id);
                      return !existingHandlerIds.includes(s.id);
                    })
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">
                佔比 (%) — 可選
              </label>
              {(() => {
                // Ratio input is disabled unless:
                // 1. Super Admin
                // 2. Admin
                // 3. Senior User AND same team as project
                const staffRole = (staff as any)?.role as string | null;
                const isSuperAdmin = staffRole === "Super Admin";
                const isAdmin = staffRole === "Admin";
                const isSeniorUserSameTeam =
                  staffRole === "Senior User" &&
                  !!(staff as any)?.n_team_type_id &&
                  (staff as any)?.n_team_type_id === data?.n_team_type_id;
                const canEditRatio = isSuperAdmin || isAdmin || isSeniorUserSameTeam;
                return (
                  <Input
                    type={canViewBVPercentage ? "number" : "text"}
                    min="0"
                    max="100"
                    placeholder="例如: 30"
                    value={canViewBVPercentage ? bvFormRatio : financialMask}
                    onChange={(e) => setBvFormRatio(e.target.value)}
                    disabled={!canEditRatio || !canViewBVPercentage}
                    readOnly={!canViewBVPercentage}
                    className={!canEditRatio || !canViewBVPercentage ? "bg-gray-100 cursor-not-allowed" : ""}
                  />
                );
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBVDialog(false)}
              disabled={bvSaving}
            >
              取消
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700 text-white"
              onClick={handleBVSave}
              disabled={bvSaving || !bvFormHandlerId}
            >
              {bvSaving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              {bvEditingId ? "儲存變更" : "新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IncomeBelowEstimatedReasonDialog
        open={showBelowReasonDialog}
        onOpenChange={setShowBelowReasonDialog}
        estimatedLabel={formatMoney(data?.estimated_income)}
        value={belowReasonDraft}
        error={belowReasonDialogError}
        onChange={(val) => {
          setBelowReasonDraft(val);
          setBelowReasonDialogError(null);
        }}
        onConfirm={handleConfirmBelowReason}
      />

      <IncomeDeleteBlockedDialog
        open={deleteIncomeBlockedOpen}
        onOpenChange={setDeleteIncomeBlockedOpen}
        estimatedLabel={formatMoney(data?.estimated_income)}
      />

      {/* ─── CONFIRM DELETE INCOME ─────────────────────────── */}
      <AlertDialog open={!!confirmDeleteIncomeId} onOpenChange={(open) => !open && setConfirmDeleteIncomeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> 確認刪除收入
            </AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除此收入記錄嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmDeleteIncome}
            >
              <Trash2 className="w-4 h-4 mr-1" /> 刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExpenseOutstandingSplitDialog
        open={showExpenseOutstandingSplit}
        outstandingAmount={outstandingAmount(expenseForm.installment_amount, expenseForm.paid_amount)}
        defaultExpectedPaymentDate={expenseForm.expected_payment_date}
        saving={expenseSaving}
        onOpenChange={setShowExpenseOutstandingSplit}
        onStay={() => { void persistExpense("stay"); }}
        onSplit={(childExpectedPaymentDate) => { void persistExpense("split", childExpectedPaymentDate); }}
      />

      {/* ─── CONFIRM DELETE EXPENSE ─────────────────────────── */}
      <AlertDialog open={!!confirmDeleteExpenseId} onOpenChange={(open) => !open && setConfirmDeleteExpenseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> 確認刪除支出
            </AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除此支出記錄嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmDeleteExpense}
            >
              <Trash2 className="w-4 h-4 mr-1" /> 刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── CONFIRM DELETE BV ─────────────────────────── */}
      <AlertDialog open={!!confirmDeleteBVId} onOpenChange={(open) => !open && setConfirmDeleteBVId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> 確認刪除 BV
            </AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除此 BV 分配記錄嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmBVDelete}
            >
              <Trash2 className="w-4 h-4 mr-1" /> 刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
