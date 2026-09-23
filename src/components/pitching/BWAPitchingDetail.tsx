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
  Trash2,
  ExternalLink,
  FolderOpen,
  User,
  Palette,
  Briefcase,
  Tag,
  Phone,
  FileText,
  AlertTriangle,
  Link2,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ClipboardList,
  Gavel,
  HardHat,
  Clock,
  Box,
  MessageSquare,
  MoreHorizontal,
  ArrowRightLeft,
  Mail,
  Save,
  X,
  Ban,
  CheckCircle2,
  Play,
  ArrowUpRight,
  Plus,
  UserPlus,
  ImagePlus,
  ChevronDown,
  ChevronUp,
  Minus,
  Info,
  Search,
  Copy,
  Upload,
} from "lucide-react";
import { AsanaIcon } from "@/components/ui/asana-icon";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { computeOsScheduleGroup } from "@/lib/os-schedule-group";
import {
  getBwaProjectSize,
  isBwaMiniProjectSize,
  isBwaProjectSizeAtLeast,
  resolveBwaProjectSize,
} from "@/lib/bwa-project-size";
import {
  fetchBWAPitchingDetail,
  deleteBWAPitching,
  updateBWAPitching,
  updateCustomer,
  fetchDistrictOptions,
  searchBuildingOptions,
  fetchCustomerTagsGrouped,
  saveCustomerTags,
  fetchDocTypes,
  analyzePitchingCascadeDelete,
  executePitchingCascadeDelete,
  fetchPitchingProjectTypeIds,
  syncBWAProjectProjectTypes,
  type BWAPitchingDetailData,
  type LinkOption,
  type TagCollection,
  type CustomerTagEntry,
  type DocType,
  type CascadeRelatedRecord,
  type PitchingCascadeAnalysisResult,
} from "@/lib/data-service";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, addDays, differenceInDays } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BWAPitchingDialog from "./BWAPitchingDialog";
import SiteStatusPanel from "@/components/projects/SiteStatusPanel";
import ManHourPanel from "@/components/projects/ManHourPanel";
import InternalCommentPanel from "./InternalCommentPanel";
import BuildingCommentPanel from "@/components/projects/BuildingCommentPanel";
import ThreeDRenderPanel from "./ThreeDRenderPanel";
import CustomerTagsPanel from "@/components/clients/CustomerTagsPanel";
import CustomerDocumentsPanel from "@/components/clients/CustomerDocumentsPanel";
import L1BudgetTab from "./L1BudgetTab";
import SitePhotosGallery from "@/components/ui/site-photos-gallery";
import BuildingEditDialog from "@/components/buildings/BuildingEditDialog";
import QuotationListPanel from "./QuotationListPanel";
import {
  MultiImageUploader,
  parseBubbleImageUrls,
  serializeImageUrls,
} from "@/components/ui/multi-image-uploader";
import { createClient } from "@/lib/supabase/client";
import { notifyProjectBvCreated } from "@/lib/project-bv-notify";
import { buildStorageObjectKey } from "@/lib/storage-utils";
import { useAuth } from "@/hooks/use-auth";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { useToast } from "@/components/ui/use-toast";
import { usePermission } from "@/hooks/use-permission";

interface BWAPitchingDetailProps {
  pitchingId: string;
}

interface PitchingBVRow {
  id: string;
  handler_id: string | null;
  handler_name: string | null;
  pitching_status: string | null;
  pitching_count: number | null;
  project_count: number | null;
  case_closed_count: number | null;
  quotation_count: number | null;
  created_date: string | null;
  modified_date: string | null;
  enquiry_date: string | null;
}

import { formatDate, formatDateTime } from "@/lib/date-utils";
const formatShortDate = formatDate; // alias

/** BR / Form S1 / Testimonial — customer-level docs; exclude from project initial uploads. */
function isMigratedCustomerProjectDocType(dt: DocType): boolean {
  const label = (dt.display || "").toLowerCase();
  return (
    label.includes("商業登記") ||
    /\bbr\b/.test(label) ||
    /form\s*s\s*1/.test(label) ||
    label.includes("testimonial") ||
    label.includes("推薦信")
  );
}

// ─── STAGE BADGE ────────────────────────────────────────
function stageBadge(stage: string | null) {
  if (!stage)
    return (
      <Badge variant="outline" className="text-gray-400 text-xs">
        未知
      </Badge>
    );
  const s = stage.toLowerCase();
  if (s.includes("won") || s.includes("成功"))
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/10 text-xs px-2.5 py-0.5">
        成功
      </Badge>
    );
  if (
    s.includes("lost") ||
    s.includes("失敗") ||
    s.includes("close") ||
    s.includes("結案")
  )
    return (
      <Badge className="bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/10 text-xs px-2.5 py-0.5">
        結案
      </Badge>
    );
  if (s.includes("pending") || s.includes("等待") || s.includes("wait"))
    return (
      <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/10 text-xs px-2.5 py-0.5">
        等待中
      </Badge>
    );
  if (s.includes("active") || s.includes("進行") || s.includes("progress"))
    return (
      <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/20 hover:bg-blue-500/10 text-xs px-2.5 py-0.5">
        進行中
      </Badge>
    );
  if (s.includes("quotation") || s.includes("報價"))
    return (
      <Badge className="bg-violet-500/10 text-violet-600 border border-violet-500/20 hover:bg-violet-500/10 text-xs px-2.5 py-0.5">
        報價中
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-xs px-2.5 py-0.5">
      {stage}
    </Badge>
  );
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
      <div
        className={`text-[15px] text-right min-w-0 truncate max-w-[60%] ${mono ? "font-mono-num" : ""} ${isLink ? "" : "font-medium text-gray-800"}`}
      >
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
          <p className="text-2xl font-bold text-gray-900 font-mono-num tracking-tight">
            {value}
          </p>
          {subtext && (
            <div className="flex items-center gap-1">
              {trend === "up" && (
                <TrendingUp className="w-3 h-3 text-emerald-500" />
              )}
              {trend === "down" && (
                <TrendingDown className="w-3 h-3 text-red-500" />
              )}
              <span
                className={`text-xs ${trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-600" : "text-gray-400"}`}
              >
                {subtext}
              </span>
            </div>
          )}
        </div>
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgLight}`}
        >
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
}: {
  title: string;
  icon: React.ElementType;
  iconColor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`border border-gray-100 shadow-sm ${className}`}>
      <CardHeader className="pb-1 pt-4 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
          <div className="w-6 h-6 rounded-md flex items-center justify-center bg-gray-50">
            <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
          </div>
          {title}
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
function EmptyTab({
  title,
  icon: Icon,
}: {
  title: string;
  icon: React.ElementType;
}) {
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

/** YYYY-MM-DD plus one calendar month (month-end safe). */
function addOneMonthYmd(dateYmd: string): string {
  if (!dateYmd) return "";
  const [year, month, day] = dateYmd.split("-").map(Number);
  if (!year || !month || !day) return "";
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCMonth(next.getUTCMonth() + 1);
  return next.toISOString().slice(0, 10);
}

// ─── CONVERT TO PITCHING DIALOG ──────────────────────────
function ConvertToPitchingDialog({
  open,
  onOpenChange,
  data,
  pitchingId,
  advancingStage,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: BWAPitchingDetailData;
  pitchingId: string;
  advancingStage: boolean;
  onConfirm: () => void;
}) {
  const { staff, profile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const { formatMoney } = useFinancialFormat();
  const isEnquiryToPitching = data.pitching_stages === "Enquiry";
  const isSuperAdmin = (staff as any)?.role === "Super Admin";
  const isAlreadyConfirmed = data.pitching_stages === "Confirmed Project";
  /** After conversion, only Super Admin may edit/submit the project form. */
  const conversionReadOnly = isAlreadyConfirmed && !isSuperAdmin;

  // ─── Customer Info Form ────────
  const [custForm, setCustForm] = useState({
    display_name: "",
    customer_name: "",
    company_name: "",
    brand_name_cn: "",
    brand_name_en: "",
    phone_display: "",
    phone_number_a: "",
    email: "",
    view_system: "BWA",
  });

  // ─── Pitching Info Form ────────
  const [pitchForm, setPitchForm] = useState({
    district_id: "",
    project_size: "",
    size: "",
    actual_size: "",
    height_to_tc: "",
    height_to_bs: "",
    height_to_fc: "",
    site_address: "",
    asana_link: "",
    working_folder: "",
    r_building_id: "",
    // L1 budget — required on conversion ($0 acceptable).
    l1_income: "",
    l1_expense: "",
  });

  // ─── Tags ────────
  const [collections, setCollections] = useState<TagCollection[]>([]);
  const [selectedTags, setSelectedTags] = useState<
    { tagId: string; collectionId: string; customerTagRowId?: string }[]
  >([]);
  const [originalTags, setOriginalTags] = useState<CustomerTagEntry[]>([]);

  // ─── Lookups ────────
  const [districtOptions, setDistrictOptions] = useState<LinkOption[]>([]);
  const [buildingOptions, setBuildingOptions] = useState<LinkOption[]>([]);
  const [buildingSearch, setBuildingSearch] = useState("");
  const [quickAddBuildingOpen, setQuickAddBuildingOpen] = useState(false);
  const [enquiryDate, setEnquiryDate] = useState("");

  // ─── Duplicate warning ────────
  const [duplicateWarning, setDuplicateWarning] = useState<string[]>([]);
  const [savingConversion, setSavingConversion] = useState(false);
  const [conversionError, setConversionError] = useState("");

  // ─── Site Photos ────────
  const [sitePhotos, setSitePhotos] = useState<string[]>([]);
  const [sitePhotosError, setSitePhotosError] = useState("");
  // Required (min 3) only when 項目規模 is $100-250K小型 or above.
  // 小於$30K / $30-100K微型 → optional. Unknown size → still required.
  const l1IncomeRaw = pitchForm.l1_income.trim();
  const l1IncomeForSize = l1IncomeRaw === "" ? NaN : Number(l1IncomeRaw);
  const resolvedProjectSize = resolveBwaProjectSize(
    data.os_money_size,
    Number.isFinite(l1IncomeForSize) ? l1IncomeForSize : data.estimated_income,
  );
  const sitePhotosRequired =
    !resolvedProjectSize ||
    isBwaProjectSizeAtLeast(resolvedProjectSize, "$100-250K小型");

  // ─── L1 expense list (Enquiry → Pitching conversion) ────────
  // Defaults to the pitching's current L1 expense items (quotation_expenses).
  // At least one row is required (amount may be $0). Once items exist the total
  // locks to the computed sum of the list.
  const [l1ExpenseTypeOptions, setL1ExpenseTypeOptions] = useState<
    { id: string; display: string; chinese_display: string | null }[]
  >([]);
  const [l1ExpenseRows, setL1ExpenseRows] = useState<
    { id?: string; expense_type_id: string; amount: string }[]
  >([]);
  const [l1NewExpenseTypeId, setL1NewExpenseTypeId] = useState("");
  const [l1NewExpenseAmount, setL1NewExpenseAmount] = useState("");
  const [l1ExpenseLoading, setL1ExpenseLoading] = useState(false);

  // Computed L1 expense total: sum of list when items exist, else the manual
  // input value.
  const l1ListTotal = l1ExpenseRows.reduce(
    (sum, r) => sum + (parseFloat(r.amount) || 0),
    0
  );
  const hasL1Items = l1ExpenseRows.length > 0;
  const l1ExpenseTotal = hasL1Items ? l1ListTotal : Number(pitchForm.l1_expense || 0);

  const canAddL1Expense =
    l1NewExpenseTypeId.trim() !== "" &&
    l1NewExpenseAmount.trim() !== "" &&
    !isNaN(Number(l1NewExpenseAmount)) &&
    Number(l1NewExpenseAmount) >= 0;
  const addL1ExpenseRow = () => {
    if (!canAddL1Expense) return;
    setL1ExpenseRows((rows) => [
      ...rows,
      { expense_type_id: l1NewExpenseTypeId, amount: l1NewExpenseAmount },
    ]);
    setL1NewExpenseTypeId("");
    setL1NewExpenseAmount("");
  };
  const removeL1ExpenseRow = (idx: number) =>
    setL1ExpenseRows((rows) => rows.filter((_, i) => i !== idx));

  // ─── Customer Info (Project conversion) ────────
  const [customerAddress, setCustomerAddress] = useState("");
  const [tagSearch, setTagSearch] = useState("");

  // Initialize form when dialog opens
  useEffect(() => {
    if (!open) return;

    setCustForm({
      display_name:
        data.customer_display_name || data.real_customer_display_name || "",
      customer_name: data.customer_name || "",
      company_name: data.customer_company || data.real_customer_co_name || "",
      brand_name_cn: "",
      brand_name_en: "",
      phone_display: data.customer_phone || "",
      phone_number_a: "",
      email: data.customer_email || "",
      view_system: "BWA",
    });

    setPitchForm({
      district_id: data.district_id || "",
      project_size: "",
      size: data.size || "",
      actual_size: data.actual_size || "",
      height_to_tc: data.height_to_tc || "",
      height_to_bs: data.height_to_bs || "",
      height_to_fc: data.height_to_fc || "",
      site_address: data.site_address || "",
      asana_link: data.asana_link || "",
      working_folder: data.working_folder || "",
      r_building_id: data.r_building_id || "",
      l1_income: data.estimated_income != null ? String(data.estimated_income) : "",
      l1_expense: data.estimated_expense != null ? String(data.estimated_expense) : "",
    });

    setEnquiryDate(
      data.enquiry_date
        ? data.enquiry_date.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    );

    // Initialize customer address
    setCustomerAddress(data.customer_address || "N/A");
    setTagSearch("");

    // Initialize site photos from legacy Bubble string
    setSitePhotos(parseBubbleImageUrls(data.site_photos));
    setSitePhotosError("");

    // Load lookups
    fetchDistrictOptions().then(setDistrictOptions);
    searchBuildingOptions("", 50).then(setBuildingOptions);

    // Load L1 expense type options + the pitching's existing L1 expense items
    // so the conversion popup defaults to the current L1 expense list.
    setL1NewExpenseTypeId("");
    setL1NewExpenseAmount("");
    setL1ExpenseLoading(true);
    (async () => {
      const supabase = createClient();
      const { data: qe } = await supabase
        .from("quotation_expenses")
        .select("id, n_expense_type_id, amount")
        .eq("pitching_id", pitchingId)
        .order("created_date", { ascending: true });
      const rows = (qe ?? []).map((row: any) => ({
        id: row.id,
        expense_type_id: row.n_expense_type_id || "",
        amount: row.amount != null ? String(row.amount) : "",
      }));
      setL1ExpenseRows(rows);
      const { fetchSupplierTypes } = await import("@/lib/data-service");
      setL1ExpenseTypeOptions(
        await fetchSupplierTypes(rows.map((r: { expense_type_id: string }) => r.expense_type_id)),
      );
      setL1ExpenseLoading(false);
    })();

    // Load customer tags
    if (data.customer_id) {
      fetchCustomerTagsGrouped(data.customer_id).then(
        ({ collections: cols, customerTags }) => {
          setCollections(cols);
          setOriginalTags(customerTags);
          setSelectedTags(
            customerTags.map((ct) => ({
              tagId: ct.tag_uuid,
              collectionId: ct.collection_uuid,
              customerTagRowId: ct.id,
            })),
          );
        },
      );
    }
  }, [open, data]);

  // Once the L1 expense list has items, the expense total is driven by the list
  // (the manual input is disabled). Mirror the computed sum into pitchForm so it
  // is displayed and saved consistently.
  useEffect(() => {
    if (l1ExpenseRows.length > 0) {
      const sum = l1ExpenseRows.reduce(
        (s, r) => s + (parseFloat(r.amount) || 0),
        0,
      );
      setPitchForm((f) =>
        f.l1_expense === String(sum) ? f : { ...f, l1_expense: String(sum) },
      );
    }
  }, [l1ExpenseRows]);

  // Search buildings on input change
  useEffect(() => {
    const timer = setTimeout(() => {
      searchBuildingOptions(buildingSearch, 30).then(setBuildingOptions);
    }, 300);
    return () => clearTimeout(timer);
  }, [buildingSearch]);

  // Check for duplicate customer name
  useEffect(() => {
    if (!custForm.customer_name || custForm.customer_name.length < 2) {
      setDuplicateWarning([]);
      return;
    }
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data: matches } = await supabase
        .from("customers")
        .select("id, customer_name, phone_display")
        .ilike("customer_name", `%${custForm.customer_name}%`)
        .neq("id", data.customer_id || "")
        .limit(5);
      if (matches && matches.length > 0) {
        setDuplicateWarning(
          matches.map(
            (m: any) =>
              `${m.customer_name}${m.phone_display ? ` (Tel: ${m.phone_display})` : ""}`,
          ),
        );
      } else {
        setDuplicateWarning([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [custForm.customer_name, data.customer_id]);

  const isTagSelected = (tagId: string) =>
    selectedTags.some((t) => t.tagId === tagId);

  const toggleTag = (
    tagId: string,
    collectionId: string,
    isSingleSelect: boolean,
  ) => {
    setSelectedTags((prev) => {
      const exists = prev.find((t) => t.tagId === tagId);
      if (exists) {
        return prev.filter((t) => t.tagId !== tagId);
      }
      if (isSingleSelect) {
        // Remove other tags from same collection
        const filtered = prev.filter((t) => t.collectionId !== collectionId);
        return [...filtered, { tagId, collectionId }];
      }
      return [...prev, { tagId, collectionId }];
    });
  };

  const handleSaveAndAdvance = async () => {
    if (conversionReadOnly) return;

    // ─── Required field validation ───
    const missingFields: string[] = [];

    // Site Photos — min 3 only when 項目規模 ≥ $100-250K小型
    if (sitePhotosRequired && sitePhotos.length < 3) {
      missingFields.push(`現場相片 Site Photos (最少 3 張，目前: ${sitePhotos.length})`);
    }

    // Customer Info section
    if (!custForm.view_system) missingFields.push("檢示系統 View System");
    if (!custForm.display_name.trim()) missingFields.push("顯示名稱 Display Name");
    if (!custForm.customer_name.trim()) missingFields.push("聯絡人名稱 Customer Name");
    if (!custForm.company_name.trim()) missingFields.push("公司(商業登記)名稱 Company Name");
    if (!custForm.phone_display.trim()) missingFields.push("主要電話號碼 Major Phone");
    if (!custForm.email.trim()) missingFields.push("電郵 Email");
    if (!enquiryDate) missingFields.push("查詢日期 Enquiry Date");

    // Pitching Info section
    if (!pitchForm.district_id) missingFields.push("地區 District");
    if (!pitchForm.actual_size.trim()) missingFields.push("實用面積 SA Size");
    if (!pitchForm.site_address.trim()) missingFields.push("工程地址 Site Address");
    if (!pitchForm.asana_link.trim()) missingFields.push("項目Asana 連結");
    // L1 income is required ($0 is acceptable) — valid, non-negative number.
    const l1IncomeNum = Number(pitchForm.l1_income);
    const l1ExpenseNum = Number(pitchForm.l1_expense);
    if (pitchForm.l1_income.trim() === "" || isNaN(l1IncomeNum) || l1IncomeNum < 0)
      missingFields.push("L1 預計收入 Estimated Income");
    // L1 expense requires ≥1 row (amount may be $0); total must match list sum.
    if (!hasL1Items) {
      missingFields.push("L1 預計支出 Estimated Expense（至少需要一筆支出記錄）");
    } else if (isNaN(l1ExpenseNum) || l1ExpenseNum < 0 || l1ExpenseNum !== l1ListTotal) {
      missingFields.push("L1 預計支出 Estimated Expense (須與支出清單總和一致)");
    }

    if (missingFields.length > 0) {
      if (sitePhotosRequired && sitePhotos.length < 3) {
        setSitePhotosError(`最少需要 3 張相片 (目前: ${sitePhotos.length})`);
      } else {
        setSitePhotosError("");
      }
      // Set inline error + toast
      const errorMsg = `以下必填欄位尚未填寫：\n• ${missingFields.join("\n• ")}`;
      setConversionError(errorMsg);
      toast({
        variant: "destructive",
        title: "⚠️ 必填欄位未完成",
        description: `請填寫以下欄位：${missingFields.join("、")}`,
        duration: 8000,
      });
      return;
    }
    setConversionError("");
    setSitePhotosError("");
    setSavingConversion(true);

    // 1. Update customer info if customer exists
    if (data.customer_id) {
      await updateCustomer(data.customer_id, {
        customer_name: custForm.customer_name || undefined,
        display_name: custForm.display_name || undefined,
        company_name: custForm.company_name || undefined,
        brand_name_cn: custForm.brand_name_cn || undefined,
        brand_name_en: custForm.brand_name_en || undefined,
        email: custForm.email || undefined,
        phone_display: custForm.phone_display || undefined,
        phone_number_a: custForm.phone_number_a || undefined,
        view_system: custForm.view_system || undefined,
      });

      // Save tag changes
      const currentTagIds = new Set(selectedTags.map((t) => t.tagId));
      const originalTagIds = new Set(originalTags.map((t) => t.tag_uuid));

      const toAdd = selectedTags
        .filter((t) => !originalTagIds.has(t.tagId))
        .map((t) => ({ tag_uuid: t.tagId, collection_uuid: t.collectionId }));

      const toRemove = originalTags
        .filter((t) => !currentTagIds.has(t.tag_uuid))
        .map((t) => t.id);

      if (toAdd.length > 0 || toRemove.length > 0) {
        await saveCustomerTags(data.customer_id, toAdd, toRemove);
      }
    }

    // 2. Sync the L1 expense list to quotation_expenses, then derive the
    //    expense total. When the list has items the total is the computed sum;
    //    with no items the manual input value is used (allows a $0 project).
    const supabase = createClient();
    // Remove all existing L1 expenses for this pitching, then re-insert the
    // current list (simple full-replace keeps it in sync with the UI).
    await supabase.from("quotation_expenses").delete().eq("pitching_id", pitchingId);
    if (l1ExpenseRows.length > 0) {
      const nowIso = new Date().toISOString();
      await supabase.from("quotation_expenses").insert(
        l1ExpenseRows.map((r) => ({
          pitching_id: pitchingId,
          n_expense_type_id: r.expense_type_id || null,
          amount: parseFloat(r.amount) || 0,
          created_date: nowIso,
          modified_date: nowIso,
        })),
      );
    }
    const finalExpenseTotal = l1ExpenseRows.length > 0
      ? l1ExpenseRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
      : Number(pitchForm.l1_expense || 0);

    // 3. Update pitching info
    await updateBWAPitching(pitchingId, {
      district_id: pitchForm.district_id || undefined,
      size: pitchForm.size || undefined,
      actual_size: pitchForm.actual_size || undefined,
      height_to_tc: pitchForm.height_to_tc || undefined,
      height_to_bs: pitchForm.height_to_bs || undefined,
      height_to_fc: pitchForm.height_to_fc || undefined,
      site_address: pitchForm.site_address || undefined,
      asana_link: pitchForm.asana_link || undefined,
      working_folder: pitchForm.working_folder || undefined,
      r_building_id: pitchForm.r_building_id || undefined,
      enquiry_date: enquiryDate || undefined,
      // L1 budget (validated above; $0 allowed). Expense = sum of the L1 list.
      estimated_income: Number(pitchForm.l1_income),
      estimated_expense: finalExpenseTotal,
      site_photos: serializeImageUrls(sitePhotos) || undefined,
      modified_date: new Date().toISOString(),
    });

    // 4. Advance stage
    onConfirm();
    setSavingConversion(false);
  };

  // ─── Pitching → Confirmed Project form state ────────
  const [projectForm, setProjectForm] = useState({
    project_code: "",
    project_name: "",
    signed_date: "",
    start_date: "",
    handover_date: "",
    defect_done_date: "",
    cost_centre_id: "",
    estimated_income: "",
    estimated_expense: "",
    financial_year_id: "",
    project_description: "",
    r_building_id: "",
    signed_income: "",
    signed_expense: "",
  });
  const [costCentreOptions, setCostCentreOptions] = useState<{ id: string; display: string | null; bu_code: string | null }[]>([]);
  const [financialYearOptions, setFinancialYearOptions] = useState<{ id: string; label: string; yy_code: string | null; date_range: string | null }[]>([]);
  const [paymentScheduleRows, setPaymentScheduleRows] = useState<{ ratio: string; amount: string; due_date: string }[]>([
    { ratio: "", amount: "", due_date: "" },
  ]);
  const [installmentCount, setInstallmentCount] = useState(1);
  const [signedExpenseRows, setSignedExpenseRows] = useState<
    { id?: string; expense_type_id: string; amount: string }[]
  >([]);
  const [signedExpenseLoading, setSignedExpenseLoading] = useState(false);
  const [signedExpenseSaving, setSignedExpenseSaving] = useState(false);
  const [expenseTypeOptions, setExpenseTypeOptions] = useState<{ id: string; display: string; chinese_display: string | null }[]>([]);
  const [newExpenseTypeId, setNewExpenseTypeId] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [importingL1, setImportingL1] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [expandVerifyInfo, setExpandVerifyInfo] = useState(false);
  const [verifyInfoConfirmed, setVerifyInfoConfirmed] = useState(false);
  /** Existing project already linked to this pitching (if any) */
  const [linkedExistingProject, setLinkedExistingProject] = useState<{
    id: string;
    project_code: string | null;
    project_name: string | null;
  } | null>(null);
  /** Create-new vs status-only choice when a linked project already exists */
  const [showLinkedProjectChoice, setShowLinkedProjectChoice] = useState(false);
  const prevOpenRef = React.useRef(false);

  // ─── Essential Docs (is_project_initial_doc = true) ────────
  const [initialDocTypes, setInitialDocTypes] = useState<DocType[]>([]);
  const [essentialDocFiles, setEssentialDocFiles] = useState<Record<string, File | null>>({});
  const [essentialDocDates, setEssentialDocDates] = useState<Record<string, string>>({});
  const [essentialDocExpiries, setEssentialDocExpiries] = useState<Record<string, string>>({});
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const essentialFileRefs = React.useRef<Record<string, HTMLInputElement | null>>({});

  // Load cost centres, financial years & generate code when dialog opens for non-enquiry
  useEffect(() => {
    if (!open || isEnquiryToPitching) return;

    // Detect fresh open (transition from closed → open)
    const isFreshOpen = !prevOpenRef.current;
    prevOpenRef.current = open;

    // Load cost centres, financial years, supplier types, and default PM's bu_id
    import("@/lib/data-service").then(({ fetchCostCentres, fetchFinancialYearOptions, fetchSupplierTypes, fetchStaffBuId, fetchCurrentFinancialYear }) => {
      fetchSupplierTypes(l1ExpenseRows.map((r) => r.expense_type_id)).then((types) =>
        setExpenseTypeOptions(types),
      );

      // Load initial doc types (is_project_initial_doc = true; exclude migrated customer docs)
      fetchDocTypes().then((allTypes) => {
        const initial = allTypes.filter(
          (dt) => dt.is_project_initial_doc && !isMigratedCustomerProjectDocType(dt),
        );
        setInitialDocTypes(initial);
      });

      // Load cost centres then default to main PM's bu_id
      fetchCostCentres().then((centres) => {
        setCostCentreOptions(centres);
        // Default cost_centre_id to the main PM's bu_id
        if (data.main_pm_id) {
          fetchStaffBuId(data.main_pm_id).then((buId) => {
            if (buId) {
              setProjectForm((f) => ({ ...f, cost_centre_id: f.cost_centre_id || buId }));
            }
          });
        }
      });

      // Load financial years, then resolve default
      fetchFinancialYearOptions().then((opts) => {
        setFinancialYearOptions(opts);
        // If pitching has n_financial_year_id, use it; otherwise fallback to current date
        const fyId = data.n_financial_year_id;
        if (fyId) {
          setProjectForm((f) => ({ ...f, financial_year_id: f.financial_year_id || fyId }));
        } else {
          // Fallback: find financial year where date_range contains current date
          fetchCurrentFinancialYear().then((currentFY) => {
            if (currentFY) {
              setProjectForm((f) => ({ ...f, financial_year_id: f.financial_year_id || currentFY.id }));
            }
          });
        }
      });
    });

    // Pre-fill from pitching data (or linked project when one already exists)
    if (isFreshOpen) {
      setNewExpenseTypeId("");
      setNewExpenseAmount("");
      setImportingL1(false);
      setProjectError("");
      setExpandVerifyInfo(true);
      setEssentialDocFiles({});
      setEssentialDocDates({});
      setEssentialDocExpiries({});
      setUploadingDocId(null);
      setShowLinkedProjectChoice(false);
      setLinkedExistingProject(null);
      // Clear stale L2 rows from a previously opened pitching before re-fetch
      setSignedExpenseRows([]);

      // Default form from pitching; overwrite if a linked project is found
      setProjectForm({
        project_code: "",
        project_name: data.real_customer_display_name || data.description || data.pitching_code || "",
        signed_date: isAlreadyConfirmed
          ? data.enquiry_date
            ? data.enquiry_date.slice(0, 10)
            : ""
          : new Date().toISOString().slice(0, 10),
        start_date: "",
        handover_date: "",
        defect_done_date: "",
        cost_centre_id: "",
        estimated_income: data.estimated_income ? String(data.estimated_income) : "",
        estimated_expense: data.estimated_expense ? String(data.estimated_expense) : "",
        financial_year_id: data.n_financial_year_id || "",
        project_description: data.description || "",
        r_building_id: data.r_building_id || "",
        signed_income: data.estimated_income ? String(data.estimated_income) : "",
        signed_expense: "",
      });
      setBuildingSearch(data.building_name || data.real_building_name || "");
      setInstallmentCount(1);
      setPaymentScheduleRows([
        { ratio: "100", amount: data.estimated_income ? String(data.estimated_income) : "", due_date: "" },
      ]);
      setVerifyInfoConfirmed(isAlreadyConfirmed);

      (async () => {
        const supabase = createClient();
        const { data: linkedProject } = await supabase
          .from("bwa_projects")
          .select(
            "id, project_code, project_name, signed_date, start_date, handover_date, defect_done_date, cost_centre_id, estimated_income, estimated_expense, n_financial_year_id, description, r_building_id",
          )
          .eq("pitching_id", pitchingId)
          .limit(1)
          .maybeSingle();

        if (!linkedProject) {
          setLinkedExistingProject(null);
          return;
        }

        setLinkedExistingProject({
          id: linkedProject.id,
          project_code: linkedProject.project_code,
          project_name: linkedProject.project_name,
        });

        const { data: incomeRows } = await supabase
          .from("incomes")
          .select("income_amount, due_date, invoice_number")
          .eq("project_id", linkedProject.id)
          .order("invoice_number", { ascending: true });

        type IncomeScheduleRow = {
          income_amount: number | null;
          due_date: string | null;
          invoice_number: string | null;
        };
        const incomeList = (incomeRows ?? []) as IncomeScheduleRow[];

        const signedIncomeTotal = incomeList.reduce(
          (sum: number, row: IncomeScheduleRow) =>
            sum + (Number(row.income_amount) || 0),
          0,
        );
        const scheduleRows =
          incomeList.length > 0
            ? incomeList.map((row: IncomeScheduleRow) => {
                const amount = Number(row.income_amount) || 0;
                const ratio =
                  signedIncomeTotal > 0
                    ? ((amount / signedIncomeTotal) * 100).toFixed(2)
                    : "";
                return {
                  ratio,
                  amount: String(amount),
                  due_date: row.due_date ? row.due_date.slice(0, 10) : "",
                };
              })
            : [
                {
                  ratio: "100",
                  amount:
                    linkedProject.estimated_income != null
                      ? String(linkedProject.estimated_income)
                      : "",
                  due_date: "",
                },
              ];

        const linkedBuildingId =
          linkedProject.r_building_id || data.r_building_id || "";
        setProjectForm({
          project_code: linkedProject.project_code || "",
          project_name: linkedProject.project_name || "",
          signed_date: linkedProject.signed_date
            ? linkedProject.signed_date.slice(0, 10)
            : "",
          start_date: linkedProject.start_date
            ? linkedProject.start_date.slice(0, 10)
            : "",
          handover_date: linkedProject.handover_date
            ? linkedProject.handover_date.slice(0, 10)
            : "",
          defect_done_date: linkedProject.defect_done_date
            ? linkedProject.defect_done_date.slice(0, 10)
            : linkedProject.handover_date
              ? addOneMonthYmd(linkedProject.handover_date.slice(0, 10))
              : "",
          cost_centre_id: linkedProject.cost_centre_id || "",
          estimated_income:
            linkedProject.estimated_income != null
              ? String(linkedProject.estimated_income)
              : "",
          estimated_expense:
            linkedProject.estimated_expense != null
              ? String(linkedProject.estimated_expense)
              : "",
          financial_year_id: linkedProject.n_financial_year_id || data.n_financial_year_id || "",
          project_description: linkedProject.description || data.description || "",
          r_building_id: linkedBuildingId,
          signed_income:
            signedIncomeTotal > 0
              ? String(signedIncomeTotal)
              : linkedProject.estimated_income != null
                ? String(linkedProject.estimated_income)
                : "",
          signed_expense: "",
        });
        setBuildingSearch(data.building_name || data.real_building_name || "");
        setInstallmentCount(Math.max(scheduleRows.length, 1));
        setPaymentScheduleRows(scheduleRows);
      })();
    }
    // When data changes while dialog is already open, preserve user selections
    // (don't reset cost_centre_id, financial_year_id, project_code etc.)
  }, [open, isEnquiryToPitching, isAlreadyConfirmed, data, pitchingId]);

  // Reset prevOpenRef when dialog closes
  useEffect(() => {
    if (!open) {
      prevOpenRef.current = false;
    }
  }, [open]);

  // Load L2 signed expenses (project_initial_expenses) for this pitching
  const fetchSignedExpenses = useCallback(async () => {
    setSignedExpenseLoading(true);
    try {
      const supabase = createClient();
      const { data: rows, error } = await supabase
        .from("project_initial_expenses")
        .select("id, n_expense_type_id, amount")
        .eq("pitching_id", pitchingId)
        .order("created_date", { ascending: true });
      if (error) {
        console.error("[ConvertProject] Error fetching project_initial_expenses:", error.message);
        setSignedExpenseRows([]);
        return [] as { id: string; expense_type_id: string; amount: string }[];
      }
      const mapped = (rows ?? []).map((row: { id: string; n_expense_type_id: string | null; amount: number | null }) => ({
        id: row.id,
        expense_type_id: row.n_expense_type_id || "",
        amount: row.amount != null ? String(row.amount) : "",
      }));
      setSignedExpenseRows(mapped);
      const { fetchSupplierTypes } = await import("@/lib/data-service");
      setExpenseTypeOptions(
        await fetchSupplierTypes([
          ...mapped.map((r: { expense_type_id: string }) => r.expense_type_id),
          ...l1ExpenseRows.map((r: { expense_type_id: string }) => r.expense_type_id),
        ]),
      );
      return mapped;
    } catch (err) {
      console.error("[ConvertProject] fetchSignedExpenses error:", err);
      setSignedExpenseRows([]);
      return [] as { id: string; expense_type_id: string; amount: string }[];
    } finally {
      setSignedExpenseLoading(false);
    }
  }, [pitchingId, l1ExpenseRows]);

  useEffect(() => {
    if (open && !isEnquiryToPitching) {
      fetchSignedExpenses();
    }
  }, [open, isEnquiryToPitching, fetchSignedExpenses]);

  // Auto-generate project code when cost centre and financial year are both selected
  useEffect(() => {
    if (!open || isEnquiryToPitching || isAlreadyConfirmed) return;
    if (!projectForm.cost_centre_id || !projectForm.financial_year_id || !data.main_pm_id) return;

    // Find the selected cost centre's bu_code
    const selectedCC = costCentreOptions.find((cc) => cc.id === projectForm.cost_centre_id);
    const buCode = selectedCC?.bu_code;
    if (!buCode) return;

    // Find the selected financial year's yy_code
    const selectedFY = financialYearOptions.find((fy) => fy.id === projectForm.financial_year_id);
    const yyCode = selectedFY?.yy_code;
    if (!yyCode) return;

    setGeneratingCode(true);
    import("@/lib/data-service").then(({ generateProjectCode }) => {
      generateProjectCode({ buCode, yyCode, mainPmId: data.main_pm_id || "" }).then((code) => {
        if (code) {
          setProjectForm((f) => ({ ...f, project_code: code }));
        }
        setGeneratingCode(false);
      });
    });
  }, [open, isEnquiryToPitching, isAlreadyConfirmed, projectForm.cost_centre_id, projectForm.financial_year_id, costCentreOptions, financialYearOptions, data.main_pm_id]);

  // Payment schedule helpers
  const handlePaymentRowChange = (idx: number, field: string, value: string) => {
    setPaymentScheduleRows((rows) => {
      const updated = [...rows];
      updated[idx] = { ...updated[idx], [field]: value };
      // Auto-calculate amount from ratio if signed income exists
      if (field === "ratio" && projectForm.signed_income) {
        const ratio = parseFloat(value);
        if (!isNaN(ratio)) {
          updated[idx].amount = String((parseFloat(projectForm.signed_income) * ratio / 100).toFixed(2));
        }
      }
      return updated;
    });
  };
  const addPaymentRow = () => setPaymentScheduleRows((r) => [...r, { ratio: "", amount: "", due_date: "" }]);
  const removePaymentRow = (idx: number) => setPaymentScheduleRows((r) => r.filter((_, i) => i !== idx));

  // Helper: distribute dates evenly between signed_date and handover_date
  const computeEvenlyDistributedDates = (count: number, signedDate?: string, handoverDate?: string): string[] => {
    const sd = signedDate || projectForm.signed_date;
    const hd = handoverDate || projectForm.handover_date;
    if (!sd || !hd || count < 1) return Array(count).fill("");
    const start = new Date(sd + "T00:00:00");
    const end = new Date(hd + "T00:00:00");
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return Array(count).fill("");
    if (count === 1) return [format(start, "yyyy-MM-dd")];
    const totalDays = differenceInDays(end, start);
    return Array.from({ length: count }, (_, i) => {
      if (i === 0) return format(start, "yyyy-MM-dd");
      if (i === count - 1) return format(end, "yyyy-MM-dd");
      const daysOffset = Math.round((totalDays * i) / (count - 1));
      return format(addDays(start, daysOffset), "yyyy-MM-dd");
    });
  };

  // Installment count change handler - auto-generate equal split rows with default dates
  const handleInstallmentCountChange = (count: number) => {
    setInstallmentCount(count);
    const baseRatio = Math.floor(100 / count);
    const signedVal = parseFloat(projectForm.signed_income) || 0;
    const dates = computeEvenlyDistributedDates(count);
    const newRows = Array.from({ length: count }, (_, i) => {
      const ratio = i === count - 1 ? 100 - baseRatio * (count - 1) : baseRatio;
      const amount = signedVal > 0 ? (signedVal * ratio / 100).toFixed(2) : "";
      return { ratio: String(ratio), amount, due_date: dates[i] || "" };
    });
    setPaymentScheduleRows(newRows);
  };

  // Signed Expense helpers — CRUD persists to project_initial_expenses immediately
  const canAddExpenseRow =
    newExpenseTypeId.trim() !== "" &&
    newExpenseAmount.trim() !== "" &&
    !isNaN(Number(newExpenseAmount)) &&
    Number(newExpenseAmount) >= 0;

  const addSignedExpenseRow = async () => {
    if (conversionReadOnly || !canAddExpenseRow) return;
    const amount = parseFloat(newExpenseAmount);
    setSignedExpenseSaving(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          table: "project_initial_expenses",
          data: {
            pitching_id: pitchingId,
            n_expense_type_id: newExpenseTypeId,
            amount,
            created_date: new Date().toISOString(),
            modified_date: new Date().toISOString(),
            created_by_id: profile?.id || null,
          },
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "新增失敗");
      setNewExpenseTypeId("");
      setNewExpenseAmount("");
      await fetchSignedExpenses();
    } catch (err: any) {
      toast({ title: "錯誤", description: err.message || "新增支出失敗", variant: "destructive" });
    } finally {
      setSignedExpenseSaving(false);
    }
  };

  const removeSignedExpenseRow = async (idx: number) => {
    if (conversionReadOnly) return;
    const row = signedExpenseRows[idx];
    if (!row?.id) return;
    setSignedExpenseSaving(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          table: "project_initial_expenses",
          id: row.id,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "刪除失敗");
      await fetchSignedExpenses();
    } catch (err: any) {
      toast({ title: "錯誤", description: err.message || "刪除支出失敗", variant: "destructive" });
    } finally {
      setSignedExpenseSaving(false);
    }
  };

  const handleSignedExpenseChange = async (idx: number, field: string, value: string) => {
    if (conversionReadOnly) return;
    const row = signedExpenseRows[idx];
    if (!row?.id) return;

    setSignedExpenseRows((rows) => {
      const updated = [...rows];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });

    // Type changes save immediately; amount saves on blur via handleSignedExpenseAmountBlur
    if (field !== "expense_type_id") return;

    const updates: Record<string, unknown> = {
      modified_date: new Date().toISOString(),
      n_expense_type_id: value || null,
    };

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          table: "project_initial_expenses",
          id: row.id,
          updates,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "更新失敗");
    } catch (err: any) {
      toast({ title: "錯誤", description: err.message || "更新支出失敗", variant: "destructive" });
      await fetchSignedExpenses();
    }
  };

  const handleSignedExpenseAmountBlur = async (idx: number) => {
    if (conversionReadOnly) return;
    const row = signedExpenseRows[idx];
    if (!row?.id) return;

    const amount = parseFloat(row.amount);
    if (isNaN(amount) || amount < 0) {
      toast({ title: "錯誤", description: "請輸入有效金額（可為 $0）", variant: "destructive" });
      await fetchSignedExpenses();
      return;
    }

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          table: "project_initial_expenses",
          id: row.id,
          updates: {
            amount,
            modified_date: new Date().toISOString(),
          },
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "更新失敗");
    } catch (err: any) {
      toast({ title: "錯誤", description: err.message || "更新支出失敗", variant: "destructive" });
      await fetchSignedExpenses();
    }
  };

  const patchSignedExpenseAmount = (idx: number, value: string) => {
    setSignedExpenseRows((rows) => {
      const updated = [...rows];
      updated[idx] = { ...updated[idx], amount: value };
      return updated;
    });
  };

  const duplicateL1Expenses = async () => {
    if (conversionReadOnly) return;
    setImportingL1(true);
    try {
      const supabase = createClient();
      const { data: qeData, error } = await supabase
        .from("quotation_expenses")
        .select("n_expense_type_id, amount")
        .eq("pitching_id", pitchingId);
      if (error) {
        console.error("[ConvertProject] Error fetching quotation_expenses:", error.message);
        toast({ title: "錯誤", description: "無法載入 L1 報價支出", variant: "destructive" });
        return;
      }
      if (!qeData || qeData.length === 0) {
        toast({ title: "提示", description: "此提案尚無 L1 報價支出可匯入" });
        return;
      }

      // Replace existing project_initial_expenses with L1 copies
      for (const row of signedExpenseRows) {
        if (!row.id) continue;
        await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete",
            table: "project_initial_expenses",
            id: row.id,
          }),
        });
      }

      const nowIso = new Date().toISOString();
      for (const row of qeData) {
        if (!row.n_expense_type_id) continue;
        const res = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            table: "project_initial_expenses",
            data: {
              pitching_id: pitchingId,
              n_expense_type_id: row.n_expense_type_id,
              amount: row.amount ?? 0,
              created_date: nowIso,
              modified_date: nowIso,
              created_by_id: profile?.id || null,
            },
          }),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error || "匯入失敗");
      }

      await fetchSignedExpenses();
      toast({ title: "已匯入", description: `已從 L1 匯入 ${qeData.length} 筆支出至 L2 初始費用` });
    } catch (err: any) {
      console.error("[ConvertProject] duplicateL1Expenses error:", err);
      toast({ title: "錯誤", description: err.message || "匯入 L1 支出失敗", variant: "destructive" });
      await fetchSignedExpenses();
    } finally {
      setImportingL1(false);
    }
  };
  const totalSignedExpense = signedExpenseRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  // GP calculations
  const calcIncome = projectForm.estimated_income ? parseFloat(projectForm.estimated_income) : 0;
  const calcExpense = projectForm.estimated_expense ? parseFloat(projectForm.estimated_expense) : 0;
  const calcGP = calcIncome - calcExpense;
  const calcGPRatio = calcIncome > 0 ? ((calcGP / calcIncome) * 100).toFixed(1) : "0.0";
  const signedIncomeParsed =
    projectForm.signed_income !== "" ? parseFloat(projectForm.signed_income) : NaN;
  const convertProjectSize =
    getBwaProjectSize(Number.isFinite(signedIncomeParsed) ? signedIncomeParsed : null) ||
    data.os_money_size;

  const executeStatusOnly = async () => {
    setShowLinkedProjectChoice(false);
    setProjectError("");
    setCreatingProject(true);
    try {
      onConfirm();
      const code =
        linkedExistingProject?.project_code ||
        linkedExistingProject?.project_name ||
        "現有項目";
      toast({
        title: "✅ 已推進提案階段（未建立新項目）",
        description: `沿用已連結項目：${code}`,
        duration: 6000,
      });
      if (linkedExistingProject?.id) {
        setTimeout(() => {
          router.push(`/projects/bwa/${linkedExistingProject.id}`);
        }, 1500);
      }
    } finally {
      setCreatingProject(false);
    }
  };

  /** Full create-new path after optional linked-project choice */
  const continueCreateNewPath = async () => {
    setShowLinkedProjectChoice(false);

    // ─── Required field validation ───
    const missingFields: string[] = [];

    // Verification section
    if (!verifyInfoConfirmed) missingFields.push("請先勾選「我已確定上述資料正確無誤」");

    // Basic Project Info section
    if (!projectForm.project_name.trim()) missingFields.push("項目名稱 Project Name");
    if (!projectForm.cost_centre_id) missingFields.push("公司單位 Cost Centre");
    if (!projectForm.financial_year_id) missingFields.push("財政年度 Financial Year");
    if (!projectForm.project_code.trim()) missingFields.push("項目編號 Project Code");
    if (!projectForm.signed_date) missingFields.push("簽約日期 Signed Date");
    if (!projectForm.start_date) missingFields.push("開始日期 Start Date");
    if (!projectForm.handover_date) missingFields.push("交場日期 Handover Date");
    if (!projectForm.defect_done_date) missingFields.push("執漏完成日期 Defect Date");
    if (!projectForm.project_description.trim()) missingFields.push("項目描述 Project Description");
    if (!projectForm.r_building_id) missingFields.push("搜尋並選擇大廈 Search & Select Building");

    // SA must already exist on the pitching (convert UI does not edit it)
    if (!String(data.actual_size || "").trim()) {
      missingFields.push("實用面積 SA Size（請先在提案填寫）");
    }

    // Customer Info section
    if (!customerAddress.trim() || customerAddress.trim() === "N/A") missingFields.push("通訊地址 Customer Address");

    // Decision Maker Tag
    const decisionMakerCollection = collections.find((col) => col.id === "eb5a7764-9ebf-4829-9991-db09538aab76");
    if (decisionMakerCollection) {
      const hasDecisionMakerTag = selectedTags.some((t) => t.collectionId === "eb5a7764-9ebf-4829-9991-db09538aab76");
      if (!hasDecisionMakerTag) missingFields.push("Decision Maker Tag");
    }

    // L2 Signed Income — required (but $0 is acceptable)
    if (projectForm.signed_income === "" || projectForm.signed_income === null || projectForm.signed_income === undefined) {
      missingFields.push("L2 已簽署收入 Signed Income");
    }

    // L2 Signed Expense — re-fetch from DB so stale UI state cannot bypass validation
    const latestSignedExpenses = await fetchSignedExpenses();
    const validExpenseRowsForValidation = latestSignedExpenses.filter(
      (row: { id: string; expense_type_id: string; amount: string }) =>
        row.expense_type_id && row.amount && row.amount.trim() !== ""
    );
    if (validExpenseRowsForValidation.length === 0) {
      missingFields.push("L2 已簽署支出 Signed Expense（至少需要一筆支出記錄）");
    }

    if (missingFields.length > 0) {
      const errorMsg = `以下必填欄位尚未填寫：\n• ${missingFields.join("\n• ")}`;
      setProjectError(errorMsg);
      toast({
        title: "⚠️ 必填欄位未填寫",
        description: missingFields.length <= 3
          ? missingFields.join("、")
          : `${missingFields.slice(0, 3).join("、")} 等 ${missingFields.length} 項`,
        variant: "destructive",
        duration: 6000,
      });
      return;
    }

    if (!projectForm.project_code) {
      setProjectError("請先產生項目編號");
      toast({ title: "⚠️ 請先產生項目編號", variant: "destructive", duration: 4000 });
      return;
    }
    if (!projectForm.signed_date) {
      setProjectError("簽約日期為必填");
      toast({ title: "⚠️ 簽約日期為必填", variant: "destructive", duration: 4000 });
      return;
    }

    await executeCreateProject();
  };

  const handleCreateProject = async () => {
    if (conversionReadOnly) return;

    // Linked project exists → ask create-new vs status-only first
    if (linkedExistingProject) {
      setShowLinkedProjectChoice(true);
      return;
    }

    await continueCreateNewPath();
  };

  const executeCreateProject = async () => {
    setShowLinkedProjectChoice(false);
    setProjectError("");
    setCreatingProject(true);

    try {
      const { createBWAProject } = await import("@/lib/data-service");
      // L2 signed income is the source of truth for project estimated_income + project_size
      const signedParsed = projectForm.signed_income !== "" ? parseFloat(projectForm.signed_income) : NaN;
      const incomeVal = Number.isFinite(signedParsed) ? signedParsed : null;
      const expenseVal = projectForm.estimated_expense ? parseFloat(projectForm.estimated_expense) : null;
      const profitVal = incomeVal != null && expenseVal != null ? incomeVal - expenseVal : null;

      // ─── Resolve display names ───
      const resolvedCustomerDisplayName = data.customer_display_name || data.real_customer_display_name || null;
      const resolvedCustomerName = data.customer_name || null;
      const resolvedBuildingName =
        buildingOptions.find((b) => b.id === projectForm.r_building_id)?.label ||
        data.building_name ||
        data.real_building_name ||
        null;
      const resolvedDistrictName = data.district_name || data.real_district_name || null;
      const resolvedCostCentre = costCentreOptions.find(cc => cc.id === projectForm.cost_centre_id)?.display || null;

      // ─── Resolve sort_financial_year ───
      const resolvedSortFinancialYear = financialYearOptions.find(fy => fy.id === projectForm.financial_year_id)?.label || null;

      // actual_size is required on pitching; cast until CreateBWAProjectParams
      // + createBWAProject insert both accept/persist actual_size.
      const result = await createBWAProject({
        project_code: projectForm.project_code,
        project_name: projectForm.project_name || projectForm.project_code,
        description: projectForm.project_description || undefined,
        status: "Work In Progress",
        customer_id: data.customer_id || undefined,
        main_pm_id: data.main_pm_id || undefined,
        main_designer_id: data.main_designer_id || undefined,
        other_pm_id: data.other_pm_id || undefined,
        more_pm_id: data.more_pm_id || undefined,
        estimated_income: incomeVal,
        estimated_expense: expenseVal,
        estimated_profit: profitVal,
        size: data.size || undefined,
        actual_size: data.actual_size || undefined,
        project_size: getBwaProjectSize(incomeVal) || data.os_money_size || undefined,
        site_address: data.site_address || undefined,
        r_nos_district_id: data.district_id || undefined,
        r_building_id: projectForm.r_building_id || undefined,
        n_financial_year_id: projectForm.financial_year_id || data.n_financial_year_id || undefined,
        n_team_type_id: data.n_team_type_id || undefined,
        n_service_type_id: data.n_service_type_id || undefined,
        cost_centre_id: projectForm.cost_centre_id || undefined,
        enquiry_date: data.enquiry_date || undefined,
        signed_date: projectForm.signed_date || undefined,
        start_date: projectForm.start_date || undefined,
        handover_date: projectForm.handover_date || undefined,
        defect_done_date: projectForm.defect_done_date || undefined,
        asana_link: data.asana_link || undefined,
        working_folder: data.working_folder || undefined,
        pitching_id: pitchingId,
        os_schedule_group: computeOsScheduleGroup(data.n_service_type_id || null, incomeVal),
        sort_financial_year: resolvedSortFinancialYear,
        real_customer_display_name: resolvedCustomerDisplayName,
        real_customer_name: resolvedCustomerName,
        real_building_name: resolvedBuildingName,
        real_district_name: resolvedDistrictName,
        real_cost_centre: resolvedCostCentre,
      } as Parameters<typeof createBWAProject>[0]);

      if (!result.success) {
        setProjectError(result.error || "建立項目失敗");
        setCreatingProject(false);
        return;
      }

      // ✅ Step 2 Complete — Project created
      toast({
        title: "✅ 步驟 2: 項目記錄已建立",
        description: `項目編號: ${projectForm.project_code}`,
        duration: 6000,
      });

      // Upload essential docs for the new project
      const newProjectId = result.id;
      if (newProjectId) {
        const pitchingProjectTypeIds = await fetchPitchingProjectTypeIds(pitchingId);
        if (pitchingProjectTypeIds.length > 0) {
          const syncPtResult = await syncBWAProjectProjectTypes(newProjectId, pitchingProjectTypeIds);
          if (!syncPtResult.success) {
            console.warn("[ConvertPitching] project type junction sync failed:", syncPtResult.error);
          }
        }

        const supabase = createClient();
        for (const docType of initialDocTypes) {
          const file = essentialDocFiles[docType.id];
          if (!file) continue; // Skip if no file selected for this doc type
          setUploadingDocId(docType.id);
          try {
            // Upload file to storage
            const storagePath = buildStorageObjectKey(newProjectId, file.name);
            const { error: uploadErr } = await supabase.storage
              .from("project-docs")
              .upload(storagePath, file, { upsert: false });
            if (uploadErr) {
              console.error(`[EssentialDocs] Upload error for ${docType.display}:`, uploadErr.message);
              continue;
            }
            const { data: urlData } = supabase.storage.from("project-docs").getPublicUrl(storagePath);

            // Create project_documents record
            await supabase.from("project_documents").insert({
              project_id: newProjectId,
              doc_type_id: docType.id,
              doc_name: docType.display || file.name,
              file: urlData.publicUrl,
              document_date: essentialDocDates[docType.id] || null,
              expiry_date: essentialDocExpiries[docType.id] || null,
              created_date: new Date().toISOString(),
            });
          } catch (docErr) {
            console.error(`[EssentialDocs] Error uploading ${docType.display}:`, docErr);
          }
        }
        setUploadingDocId(null);

        // ✅ Step 3c Complete — Essential Documents uploaded
        const uploadedDocCount = Object.values(essentialDocFiles).filter(Boolean).length;
        if (uploadedDocCount > 0) {
          toast({
            title: "✅ 步驟 3c: 必要文件已上傳",
            description: `已上傳 ${uploadedDocCount} 個文件`,
            duration: 6000,
          });
        }

        // ─── Create Payment Schedule Records (incomes) — Step 3a ───
        const incomeErrors: string[] = [];
        if (paymentScheduleRows.length > 0) {
          const validPaymentRows = paymentScheduleRows.filter(
            (row) => row.amount && parseFloat(row.amount) > 0
          );
          if (validPaymentRows.length > 0) {
            // Lookup type_display from nos_contracts — use dynamic lookup, not hardcoded UUID
            const CONTRACT_TYPE_ID = "a5de2560-987d-4b25-ba1d-0278ab037143";
            const { data: contractType, error: contractLookupErr } = await supabase
              .from("nos_contracts")
              .select("id, display")
              .eq("id", CONTRACT_TYPE_ID)
              .single();
            
            // If the contract type UUID doesn't exist, set FK to null to avoid constraint violation
            const validContractTypeId = contractLookupErr ? null : contractType?.id ?? null;
            const typeDisplay = contractType?.display ?? null;

            if (contractLookupErr) {
              console.warn("[PaymentSchedule] nos_contracts lookup failed — setting n_contract_type_id to null:", contractLookupErr.message);
            }

            const incomeInserts = validPaymentRows.map((row, idx) => ({
              project_id: newProjectId,
              income_amount: parseFloat(row.amount) || 0,
              due_date: row.due_date || null,
              expected_payment_date: null,
              invoice_number: String(idx + 1),
              n_contract_type: null,
              outstanding: parseFloat(row.amount) || 0,
              payment_status: null,
              payment_amount: null,
              project: null,
              real_creator_name: staff?.name || null,
              receive_date: null,
              status: null,
              type_display: typeDisplay,
              created_by: null,
              created_date: new Date().toISOString(),
              modified_date: new Date().toISOString(),
              n_contract_type_id: validContractTypeId,
              created_by_id: profile?.id || null,
            }));
            const { error: incomeErr } = await supabase
              .from("incomes")
              .insert(incomeInserts);
            if (incomeErr) {
              console.error("[PaymentSchedule] Insert error:", incomeErr.message, incomeErr);
              incomeErrors.push(`收入記錄建立失敗: ${incomeErr.message}`);
              toast({
                title: "⚠️ 步驟 3a: 收入記錄建立失敗",
                description: incomeErr.message,
                variant: "destructive",
                duration: 8000,
              });
            } else {
              console.log(`[PaymentSchedule] Successfully inserted ${incomeInserts.length} income records for project ${newProjectId}`);
              toast({
                title: "✅ 步驟 3a: 收入記錄已建立",
                description: `已建立 ${incomeInserts.length} 筆付款期記錄`,
                duration: 6000,
              });
            }
          }
        }

        // ─── Create Signed Expense Records (expenses) — Step 3b ───
        // Duplicate project_initial_expenses → expenses on project confirm
        const { data: initExpRows, error: initExpFetchErr } = await supabase
          .from("project_initial_expenses")
          .select("id, n_expense_type_id, amount")
          .eq("pitching_id", pitchingId);

        if (initExpFetchErr) {
          console.error("[SignedExpenses] Fetch project_initial_expenses error:", initExpFetchErr.message);
          incomeErrors.push(`無法讀取 L2 初始費用: ${initExpFetchErr.message}`);
        } else {
          const validExpenseRows = (initExpRows ?? []).filter(
            (row: { n_expense_type_id: string | null; amount: number | null }) =>
              row.n_expense_type_id && row.amount != null && row.amount >= 0
          );
          if (validExpenseRows.length > 0) {
            const expenseInserts = validExpenseRows.map((row: { n_expense_type_id: string | null; amount: number | null }) => ({
              project_id: newProjectId,
              installment_amount: row.amount || 0,
              outstanding: row.amount || 0,
              payment_status: null,
              n_supplier_type_id: row.n_expense_type_id || null,
              invoice_number: "1",
              real_creator_name: staff?.name || null,
              created_by_id: profile?.id || null,
              created_date: new Date().toISOString(),
              modified_date: new Date().toISOString(),
              paid_amount: null,
              supplier_id: null,
              factory_id: null,
              n_contract_type_id: null,
              project: null,
            }));
            const { error: expenseErr } = await supabase
              .from("expenses")
              .insert(expenseInserts);
            if (expenseErr) {
              console.error("[SignedExpenses] Insert error:", expenseErr.message, expenseErr);
              incomeErrors.push(`支出記錄建立失敗: ${expenseErr.message}`);
              toast({
                title: "⚠️ 步驟 3b: 支出記錄建立失敗",
                description: expenseErr.message,
                variant: "destructive",
                duration: 8000,
              });
            } else {
              console.log(`[SignedExpenses] Successfully inserted ${expenseInserts.length} expense records for project ${newProjectId}`);
              // L2 stays linked via pitching_id only (no project FK on this table)
              toast({
                title: "✅ 步驟 3b: 支出記錄已建立",
                description: `已從 L2 初始費用建立 ${expenseInserts.length} 筆支出記錄`,
                duration: 6000,
              });
            }
          }
        }

        // Show warning if income/expense inserts failed (project was still created)
        if (incomeErrors.length > 0) {
          console.error("[ConvertProject] Partial failure — project created but financial records failed:", incomeErrors);
        }

        // ─── Step 3d: Create S2 Schedule Records (Start Date + Handover Date) ───
        if (newProjectId && (projectForm.start_date || projectForm.handover_date)) {
          try {
            // Get working_schedule_id for start date
            const { data: startTask } = await supabase
              .from("project_schedule_tasks")
              .select("id")
              .eq("is_start_date", true)
              .limit(1)
              .single();

            // Get working_schedule_id for handover date
            const { data: handoverTask } = await supabase
              .from("project_schedule_tasks")
              .select("id")
              .eq("is_handover_date", true)
              .limit(1)
              .single();

            const scheduleRecords: Array<{
              project_id: string;
              date: string;
              working_schedule_id: string;
              main_pm_id: string | null;
              is_na: boolean;
              created_date: string;
              modified_date: string;
            }> = [];

            if (startTask && projectForm.start_date) {
              scheduleRecords.push({
                project_id: newProjectId,
                date: projectForm.start_date,
                working_schedule_id: startTask.id,
                main_pm_id: data.main_pm_id || null,
                is_na: false,
                created_date: new Date().toISOString(),
                modified_date: new Date().toISOString(),
              });
            }

            if (handoverTask && projectForm.handover_date) {
              scheduleRecords.push({
                project_id: newProjectId,
                date: projectForm.handover_date,
                working_schedule_id: handoverTask.id,
                main_pm_id: data.main_pm_id || null,
                is_na: false,
                created_date: new Date().toISOString(),
                modified_date: new Date().toISOString(),
              });
            }

            if (scheduleRecords.length > 0) {
              const { error: schedErr } = await supabase
                .from("project_schedules")
                .insert(scheduleRecords);
              if (schedErr) {
                console.error("[S2Schedule] Insert error:", schedErr.message);
                toast({
                  title: "⚠️ 步驟 3d: 排程記錄建立失敗",
                  description: schedErr.message,
                  variant: "destructive",
                  duration: 8000,
                });
              } else {
                toast({
                  title: "✅ 步驟 3d: S2 排程已建立",
                  description: `已建立 ${scheduleRecords.length} 筆排程記錄`,
                  duration: 6000,
                });
              }
            }
          } catch (schedError: any) {
            console.error("[S2Schedule] Error creating schedules:", schedError?.message);
            // Non-blocking — project is already created successfully
          }
        }

        // ─── Step 4: Create project_bv Records (BV Value Assignment) ───
        // We only insert the INPUTS — handler_id, project_id, ratio (+ team/FY
        // for sensible defaults). Derived money fields (estimated_gp,
        // actual_gp, total_sales, shared_*_gp, estimated_bv, actual_bv) are
        // computed by recalculate_project_bv() on insert and on ratio update.
        if (newProjectId) {
          try {
            const COMPANY_BV_HANDLER_ID = "00000000-0000-4000-8000-000000000001";

            // Pitching handlers share 60% (split evenly); company takes 30%.
            const { data: pitchingBVs } = await supabase
              .from("pitching_bv")
              .select("handler_id")
              .eq("pitching_id", pitchingId);

            const handlerCount = pitchingBVs?.length ?? 0;
            const handlerRatio = handlerCount > 0 ? 60 / handlerCount : 0;

            const fyId = projectForm.financial_year_id || data.n_financial_year_id || null;
            const teamId = data.n_team_type_id || null;

            // 4a. Handler BV rows (shared 60%) + 4b. Company BV row (fixed 30%).
            const handlerBVRecords = (pitchingBVs ?? []).map((pbv: any) => ({
              handler_id: pbv.handler_id,
              project_id: newProjectId,
              ratio: handlerRatio,
              n_financial_year_id: fyId,
              n_team_type_id: teamId,
            }));
            const companyBVRecord = {
              handler_id: COMPANY_BV_HANDLER_ID,
              project_id: newProjectId,
              ratio: 30,
              n_financial_year_id: fyId,
              n_team_type_id: teamId,
            };

            // 4c. Batch insert — the DB trigger fills in all derived figures.
            const allBVRecords = [...handlerBVRecords, companyBVRecord];
            if (allBVRecords.length > 0) {
              const { error: bvErr } = await supabase.from("project_bv").insert(allBVRecords);
              if (bvErr) {
                console.error("[ProjectBV] Insert error:", bvErr.message);
                toast({
                  title: "⚠️ 步驟 4: BV 記錄建立失敗",
                  description: bvErr.message,
                  variant: "destructive",
                  duration: 8000,
                });
              } else {
                toast({
                  title: "✅ 步驟 4: BV 記錄已建立",
                  description: `已建立 ${allBVRecords.length} 筆 BV 記錄 (${handlerBVRecords.length} 處理人 + 1 公司)`,
                  duration: 6000,
                });
                void notifyProjectBvCreated(supabase, {
                  rows: allBVRecords,
                  assignerStaffId: staff?.id ?? null,
                  assignerName: staff?.name ?? null,
                  projectCode: projectForm.project_code,
                  projectName: projectForm.project_name || projectForm.project_code,
                });
              }
            }
          } catch (bvError: any) {
            console.error("[ProjectBV] Error creating BV records:", bvError?.message);
            // Non-blocking — project is already created successfully
          }
        }
      }

      // ─── Step 5b: Update Pitching Related Tables ───
      if (result.id) {
        try {
          const supabaseForStep5b = createClient();
          // Note: tenders, quotations, ai_quotes do NOT have pitching_id/project_id UUID FK columns
          // They still use legacy bubble_id text fields (pitching/project), so they are excluded here.
          const tablesToUpdate = [
            { table: "three_d_renders", pitchingCol: "pitching_id", projectCol: "project_id" },
            { table: "three_d_collections", pitchingCol: "r_pitching_id", projectCol: "r_project_id" },
            { table: "project_documents", pitchingCol: "pitching_id", projectCol: "project_id" },
            { table: "internal_comments", pitchingCol: "pitching_id", projectCol: "project_id" },
            { table: "building_comments", pitchingCol: "pitching_id", projectCol: "project_id" },
            { table: "customer_comments", pitchingCol: "pitching_id", projectCol: "project_id" },
            { table: "site_statuses", pitchingCol: "pitching_id", projectCol: "project_id" },
          ];

          const step5bErrors: string[] = [];
          for (const { table, pitchingCol, projectCol } of tablesToUpdate) {
            const { error: updateErr } = await supabaseForStep5b
              .from(table)
              .update({ [projectCol]: result.id })
              .eq(pitchingCol, pitchingId);
            if (updateErr) {
              step5bErrors.push(`${table}: ${updateErr.message}`);
            }
          }

          try {
            const { reattachDesignJobsToProject } = await import("@/lib/design-job-service");
            await reattachDesignJobsToProject({
              source: "bwa",
              pitchingId,
              projectId: result.id,
              projectJobType: "bwa_project",
            });
          } catch (designJobErr: any) {
            step5bErrors.push(`design_jobs: ${designJobErr?.message || "reattach failed"}`);
          }

          if (step5bErrors.length > 0) {
            console.warn("[Step5b] Some pitching-related table updates failed:", step5bErrors);
            toast({
              title: "⚠️ 步驟 5b: 部分關聯表更新失敗",
              description: step5bErrors.join("; "),
              variant: "destructive",
              duration: 8000,
            });
          } else {
            toast({
              title: "✅ 步驟 5b: 關聯表已更新",
              description: "所有提案關聯資料已連結至新項目",
              duration: 6000,
            });
          }
        } catch (step5bErr: any) {
          console.warn("[Step5b] Error updating pitching-related tables:", step5bErr?.message);
          // Non-blocking — project is already created successfully
        }
      }

      // Persist selected building onto the pitching as well (source of truth for convert)
      if (projectForm.r_building_id) {
        await updateBWAPitching(pitchingId, {
          r_building_id: projectForm.r_building_id,
          modified_date: new Date().toISOString(),
        });
      }

      // Now advance the pitching stage
      onConfirm();

      // ✅ Step 5a Complete — Pitching stage advanced
      toast({
        title: "✅ 步驟 5a: 提案階段已推進",
        description: "提案已推進至「Confirmed Project」階段",
        duration: 6000,
      });

      // ✅ Final toast — conversion complete, redirecting
      toast({
        title: "🎉 項目轉換完成！",
        description: `正在跳轉至項目詳情頁面...`,
        duration: 4000,
      });

      // Redirect to the new project detail page after a short delay
      if (result.id) {
        setTimeout(() => {
          router.push(`/projects/bwa/${result.id}`);
        }, 1500);
      }
    } catch (err: any) {
      setProjectError(err?.message || "Unknown error");
      toast({
        title: "❌ 轉換失敗",
        description: err?.message || "未知錯誤",
        variant: "destructive",
        duration: 8000,
      });
    }
    setCreatingProject(false);
  };

  // If not Enquiry → Pitching, show Pitching → Confirmed Project form
  if (!isEnquiryToPitching) {
    return (
      <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-emerald-600 text-lg">
              <CheckCircle2 className="w-5 h-5" /> Pitching → Confirmed Project 轉換
            </DialogTitle>
            <p className="text-xs text-gray-500 mt-1">
              {conversionReadOnly
                ? "項目已建立，此頁面僅供查閱（僅 Super Admin 可修改）"
                : "確認後將建立正式項目並推進至「Confirmed Project」階段"}
            </p>
            {conversionReadOnly && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  此提案已完成項目轉換，轉換表單為唯讀模式。如需修改請聯絡 Super Admin。
                </p>
              </div>
            )}
            {!conversionReadOnly && linkedExistingProject && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  此提案已連結項目{" "}
                  <span className="font-mono font-medium">
                    {linkedExistingProject.project_code || linkedExistingProject.id}
                  </span>
                  {linkedExistingProject.project_name
                    ? `（${linkedExistingProject.project_name}）`
                    : ""}
                  。提交時可選擇建立新項目，或僅推進提案階段。
                </p>
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto max-h-[calc(90vh-200px)]">
            <fieldset
              disabled={conversionReadOnly}
              className="min-w-0 border-0 p-0 m-0 disabled:opacity-100"
            >
            <div className="px-6 py-5 space-y-6">

              {/* ─── Section 1: 核對提案資訊 Verify Pitching Info ─── */}
              <div className="space-y-3">
                <button
                  type="button"
                  className="flex items-center gap-2 w-full text-left"
                  onClick={() => setExpandVerifyInfo(!expandVerifyInfo)}
                >
                  <ClipboardList className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold text-gray-900">核對提案資訊 Verify Pitching Info</h3>
                  {expandVerifyInfo ? (
                    <ChevronUp className="w-4 h-4 text-gray-400 ml-auto" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
                  )}
                </button>

                {/* Info notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700">請核對以下資料正確無誤，如需更改，請先返回上一頁編輯提案資料</p>
                </div>

                {/* All fields displayed in flat layout matching image */}
                <div className="bg-gray-50 rounded-lg p-4 border space-y-4">
                  {/* Row 1: Main PM | Main Designer | Other PM */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 text-xs">主要項目經理 Main PM</span>
                      <p className="font-medium">{data.pm_name || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">主要設計師 Main Designer</span>
                      <p className="font-medium">{data.designer_name || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">其他協助者 Other PM</span>
                      <p className="font-medium">{data.other_pm_name || data.more_pm_name || "N/A"}</p>
                    </div>
                  </div>

                  {/* Row 2: Service Type | Project Type | Enquiry Date */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 text-xs">服務類型 Service Type</span>
                      <p className="font-medium">{data.service_type_name || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">項目類型 Project Type</span>
                      <p className="font-medium">{data.project_types_name || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">查詢日期 Enquiry Date</span>
                      <p className="font-medium">{data.enquiry_date ? data.enquiry_date.slice(0, 10) : "N/A"}</p>
                    </div>
                  </div>

                  {/* Row 3: District | Site Address | Size */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 text-xs">地區 District</span>
                      <p className="font-medium">{data.district_name || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">工地位置 Site Address</span>
                      <p className="font-medium">{data.site_address || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">實用面積 SA Size (sq. ft.)</span>
                      <p className="font-medium">{data.actual_size || "N/A"}</p>
                    </div>
                  </div>

                  {/* Row 4: Ceiling Heights */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 text-xs">樓底高度 - 真天花 True Celling (mm)</span>
                      <p className="font-medium">{data.height_to_tc || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">樓底高度 - 陣底 Beam Soffit (mm)</span>
                      <p className="font-medium">{data.height_to_bs || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">樓底高度 - 假天花 False Celling (mm)</span>
                      <p className="font-medium">{data.height_to_fc || "N/A"}</p>
                    </div>
                  </div>

                  {/* Row 5: Asana | Working Folder | Building */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 text-xs">Asana 連結</span>
                      {data.asana_link ? (
                        <a href={data.asana_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs hover:underline break-all">
                          {data.asana_link}
                        </a>
                      ) : <p className="font-medium">N/A</p>}
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">工作資料夾 Working Folder</span>
                      {data.working_folder ? (
                        <p className="font-medium text-xs break-all">{data.working_folder}</p>
                      ) : <p className="font-medium">N/A</p>}
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">大廈 Building</span>
                      <p className="font-medium">{data.building_name || "N/A"}</p>
                    </div>
                  </div>

                  {/* Row 6: Est. Income | Est. Expense | Est. GP | Est. GP ratio */}
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 text-xs">L1預算收入 Est. Income</span>
                      <p className="font-medium">{data.estimated_income != null ? formatMoney(Number(data.estimated_income)) : "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">L1預算支出 Est. Expense</span>
                      <p className="font-medium">{data.estimated_expense != null ? formatMoney(Number(data.estimated_expense)) : "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">預算毛利 Est. GP</span>
                      <p className="font-semibold text-emerald-600">
                        {data.estimated_income != null && data.estimated_expense != null
                          ? formatMoney(Number(data.estimated_income) - Number(data.estimated_expense), { showZero: true })
                          : formatMoney(0, { fallback: "$0", showZero: true })
                        }
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">預算毛利率 Est. GP ratio</span>
                      <p className="font-medium">
                        {data.estimated_income && data.estimated_expense && Number(data.estimated_income) > 0
                          ? `${(((Number(data.estimated_income) - Number(data.estimated_expense)) / Number(data.estimated_income)) * 100).toFixed(1)}%`
                          : "N/A"
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Confirmation checkbox */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <span className="text-sm text-gray-700">我已確定上述資料正確無誤<span className="text-red-500">*</span></span>
                  <Checkbox
                    checked={verifyInfoConfirmed}
                    onCheckedChange={(checked) => setVerifyInfoConfirmed(checked === true)}
                  />
                </div>
              </div>

              <Separator />

              {/* ─── Section 2: 基本項目資訊 Basic Project Info ─── */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-500" />
                  基本項目資訊 Basic Project Info
                </h3>
                <div className="border rounded-lg p-4 space-y-4">
                  {/* Row 1: Project Name (full width) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      項目名稱 Project Name<span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={projectForm.project_name}
                      onChange={(e) =>
                        setProjectForm((f) => ({ ...f, project_name: e.target.value }))
                      }
                      placeholder="Project Name"
                    />
                  </div>

                  {/* Row 2: Cost Centre | Financial Year | Project Code */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">
                        公司單位 Cost Centre<span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={projectForm.cost_centre_id}
                        onValueChange={(v) =>
                          setProjectForm((f) => ({ ...f, cost_centre_id: v }))
                        }
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select Cost Centre" />
                        </SelectTrigger>
                        <SelectContent>
                          {costCentreOptions.map((cc) => (
                            <SelectItem key={cc.id} value={cc.id}>
                              {cc.bu_code ? `${cc.bu_code} - ` : ""}{cc.display || "未命名"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">
                        財政年度 Financial Year<span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={projectForm.financial_year_id}
                        onValueChange={(v) =>
                          setProjectForm((f) => ({ ...f, financial_year_id: v }))
                        }
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="選擇財政年度" />
                        </SelectTrigger>
                        <SelectContent>
                          {financialYearOptions.map((fy) => (
                            <SelectItem key={fy.id} value={fy.id}>
                              {fy.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">
                        項目編號 Project Code<span className="text-red-500">*</span>
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={projectForm.project_code}
                          onChange={(e) =>
                            setProjectForm((f) => ({ ...f, project_code: e.target.value }))
                          }
                          placeholder="Project Code"
                          disabled={generatingCode}
                          className="bg-gray-50"
                        />
                        {generatingCode && (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400 mt-2.5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Signed Date | Start Date | Handover Date | Defect Date */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">
                        簽約日期 Signed Date<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={projectForm.signed_date}
                        onChange={(e) => {
                          const val = e.target.value;
                          setProjectForm((f) => ({ ...f, signed_date: val }));
                          // Recalculate installment due dates
                          const dates = computeEvenlyDistributedDates(installmentCount, val, projectForm.handover_date);
                          setPaymentScheduleRows((rows) => rows.map((r, i) => ({ ...r, due_date: dates[i] || r.due_date })));
                        }}
                        placeholder="Signed Date"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">
                        開始日期 Start Date<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={projectForm.start_date}
                        onChange={(e) =>
                          setProjectForm((f) => ({ ...f, start_date: e.target.value }))
                        }
                        placeholder="Start Date"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">
                        交場日期 Handover Date<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={projectForm.handover_date}
                        onChange={(e) => {
                          const val = e.target.value;
                          setProjectForm((f) => ({
                            ...f,
                            handover_date: val,
                            defect_done_date: f.defect_done_date || addOneMonthYmd(val),
                          }));
                          // Recalculate installment due dates
                          const dates = computeEvenlyDistributedDates(installmentCount, projectForm.signed_date, val);
                          setPaymentScheduleRows((rows) => rows.map((r, i) => ({ ...r, due_date: dates[i] || r.due_date })));
                        }}
                        placeholder="Handover Date"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">
                        執漏完成日期 Defect Date<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={projectForm.defect_done_date}
                        onChange={(e) =>
                          setProjectForm((f) => ({ ...f, defect_done_date: e.target.value }))
                        }
                        placeholder="Defect Date"
                      />
                    </div>
                  </div>

                  {/* Row 4: Project Description (full width) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      項目描述 Project Description<span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      value={projectForm.project_description}
                      onChange={(e) =>
                        setProjectForm((f) => ({ ...f, project_description: e.target.value }))
                      }
                      placeholder="請輸入項目描述..."
                      rows={3}
                      className="text-sm"
                    />
                  </div>

                  {/* Row 5: Building (required) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-gray-600">
                        搜尋並選擇大廈 Search & Select Building<span className="text-red-500">*</span>
                      </Label>
                      {!conversionReadOnly && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium transition-colors"
                          onClick={() => setQuickAddBuildingOpen(true)}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          快速新增
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="搜尋大廈..."
                        value={buildingSearch}
                        onChange={(e) => {
                          setBuildingSearch(e.target.value);
                          if (projectForm.r_building_id) {
                            setProjectForm((f) => ({ ...f, r_building_id: "" }));
                          }
                        }}
                        className="pl-9 text-sm"
                        disabled={conversionReadOnly}
                      />
                      {buildingSearch &&
                        !projectForm.r_building_id &&
                        buildingOptions.length > 0 && (
                          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                            {buildingOptions.map((b) => (
                              <button
                                key={b.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors"
                                onClick={() => {
                                  setProjectForm((f) => ({
                                    ...f,
                                    r_building_id: b.id,
                                  }));
                                  setBuildingSearch(b.label);
                                }}
                              >
                                {b.label}
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                    {projectForm.r_building_id && (
                      <p className="text-xs text-emerald-600 mt-1">
                        ✓ 已選擇大廈:{" "}
                        {buildingOptions.find((b) => b.id === projectForm.r_building_id)
                          ?.label ||
                          buildingSearch ||
                          data.building_name ||
                          "已選擇"}
                      </p>
                    )}
                    <BuildingEditDialog
                      open={quickAddBuildingOpen}
                      onOpenChange={setQuickAddBuildingOpen}
                      building={null}
                      onSaved={(created) => {
                        if (created) {
                          setProjectForm((f) => ({
                            ...f,
                            r_building_id: created.id,
                          }));
                          setBuildingSearch(created.label);
                          setBuildingOptions((prev) => {
                            if (prev.some((b) => b.id === created.id)) return prev;
                            return [{ id: created.id, label: created.label }, ...prev];
                          });
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* ─── Section 4: 客戶資訊 Customer Info ─── */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-500" />
                  客戶資訊 Customer Info
                </h3>
                <div className="border rounded-lg p-4 space-y-4">
                  {/* 通訊地址 */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      通訊地址<span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="請輸入通訊地址..."
                      rows={3}
                      className="text-sm"
                    />
                  </div>

                  {/* Decision Maker Tag */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      Decision Maker Tag<span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        placeholder="Search / Create a customer tags"
                        className="pl-9 text-sm"
                      />
                    </div>
                    {collections.filter((col) => col.id === "eb5a7764-9ebf-4829-9991-db09538aab76").length > 0 && (
                      <div className="border rounded-lg p-3 bg-white">
                        {collections
                          .filter((col) => col.id === "eb5a7764-9ebf-4829-9991-db09538aab76")
                          .map((col) => {
                          const filteredTags = tagSearch
                            ? col.tags.filter((tag) =>
                                tag.display.toLowerCase().includes(tagSearch.toLowerCase())
                              )
                            : col.tags;
                          if (filteredTags.length === 0) return null;
                          return (
                            <div key={col.id} className="mb-2 last:mb-0">
                              <div className="flex flex-wrap gap-3">
                                {filteredTags.map((tag) => {
                                  const selected = isTagSelected(tag.id);
                                  return (
                                    <label
                                      key={tag.id}
                                      className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700"
                                    >
                                      <span
                                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                          selected
                                            ? "border-blue-600 bg-blue-600"
                                            : "border-gray-300"
                                        }`}
                                        onClick={() =>
                                          toggleTag(tag.id, col.id, col.isSingleSelect)
                                        }
                                      >
                                        {selected && (
                                          <span className="w-2 h-2 rounded-full bg-white" />
                                        )}
                                      </span>
                                      <span
                                        onClick={() =>
                                          toggleTag(tag.id, col.id, col.isSingleSelect)
                                        }
                                      >
                                        {tag.display}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* ─── Section 6: L2 已簽署收入 Signed Income ─── */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  L2 已簽署收入 Signed Income
                  <span className="text-red-500 text-xs">*必填</span>
                </h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    此簽約金額為記錄用途，轉換為項目後將無法更改，請謹慎填寫
                  </p>
                </div>

                {/* Input row: Signed Income + Installment slider */}
                <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">
                        輸入已簽署收入 Input Signed Income
                      </Label>
                      <Input
                        type="number"
                        value={projectForm.signed_income}
                        onChange={(e) => {
                          const val = e.target.value;
                          setProjectForm((f) => ({ ...f, signed_income: val }));
                          // Recalculate installment amounts
                          const signedVal = parseFloat(val) || 0;
                          setPaymentScheduleRows((rows) =>
                            rows.map((r) => {
                              const ratio = parseFloat(r.ratio) || 0;
                              return { ...r, amount: signedVal > 0 ? (signedVal * ratio / 100).toFixed(2) : "" };
                            })
                          );
                        }}
                        placeholder="$0"
                        className="text-lg font-mono"
                      />
                      <div className="rounded-md border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                        <p className="text-[11px] font-medium text-emerald-800">項目規模 Project Size</p>
                        <p className="text-sm font-semibold text-emerald-900 mt-0.5">
                          {(() => {
                            const parsed = projectForm.signed_income !== ""
                              ? parseFloat(projectForm.signed_income)
                              : NaN;
                            return getBwaProjectSize(Number.isFinite(parsed) ? parsed : null) || "—";
                          })()}
                        </p>
                        <p className="text-[11px] text-emerald-700/80 mt-0.5">依已簽署收入自動計算</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-gray-600">
                          分期付款期數 Number of Installments
                        </Label>
                        <span className="text-lg font-bold text-gray-900">{installmentCount}</span>
                      </div>
                      <Slider
                        value={[installmentCount]}
                        onValueChange={([val]) => handleInstallmentCountChange(val)}
                        min={1}
                        max={12}
                        step={1}
                        className="mt-3"
                      />
                    </div>
                  </div>

                  {/* Installment rows */}
                  {paymentScheduleRows.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {/* Header row */}
                      <div className="grid grid-cols-[50px_140px_1fr_1fr] gap-2 items-center">
                        <span className="text-[12px] text-gray-400 text-center font-medium">期數</span>
                        <span className="text-[12px] text-gray-400 text-center font-medium">到期日 Due Date</span>
                        <span className="text-[12px] text-gray-400 text-center font-medium">比例 %</span>
                        <span className="text-[12px] text-gray-400 text-center font-medium">金額 Amount</span>
                      </div>
                      {paymentScheduleRows.map((row, idx) => (
                        <div key={idx} className="grid grid-cols-[50px_140px_1fr_1fr] gap-2 items-center">
                          <span className="text-sm text-gray-500 text-center font-medium">第{idx + 1}期</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={`h-9 w-full justify-start text-left text-xs font-normal px-2 ${!row.due_date ? "text-muted-foreground" : ""}`}
                              >
                                <Calendar className="mr-1 h-3 w-3 shrink-0" />
                                {row.due_date ? format(new Date(row.due_date + "T00:00:00"), "yyyy-MM-dd") : "選擇日期"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarPicker
                                mode="single"
                                selected={row.due_date ? new Date(row.due_date + "T00:00:00") : undefined}
                                onSelect={(date) => {
                                  if (date) {
                                    handlePaymentRowChange(idx, "due_date", format(date, "yyyy-MM-dd"));
                                  }
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <Input
                            type="number"
                            placeholder="%"
                            value={row.ratio}
                            onChange={(e) => handlePaymentRowChange(idx, "ratio", e.target.value)}
                            className="h-9 text-sm"
                          />
                          <Input
                            type="text"
                            readOnly
                            value={row.amount ? formatMoney(parseFloat(row.amount)) : ""}
                            className="h-9 text-sm bg-gray-50 font-mono"
                          />
                        </div>
                      ))}

                      {/* Totals row */}
                      <div className="grid grid-cols-[50px_140px_1fr_1fr] gap-2 items-center border-t pt-2 mt-2">
                        <span />
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Info className="w-3 h-3" /> 日期可手動調整
                        </span>
                        <div className="text-sm font-semibold text-gray-700 text-center">
                          總計 {paymentScheduleRows.reduce((sum, r) => sum + (parseFloat(r.ratio) || 0), 0)}%
                        </div>
                        <div className="text-sm font-semibold text-gray-700 font-mono">
                          {formatMoney(paymentScheduleRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0), { showZero: true })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Validation */}
                  {projectForm.signed_income && paymentScheduleRows.some((r) => r.amount) && (
                    (() => {
                      const totalSchedule = paymentScheduleRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
                      const signedVal = parseFloat(projectForm.signed_income) || 0;
                      const totalRatio = paymentScheduleRows.reduce((sum, r) => sum + (parseFloat(r.ratio) || 0), 0);
                      if (Math.abs(totalRatio - 100) > 0.01 || Math.abs(signedVal - totalSchedule) > 1) {
                        return (
                          <div className="bg-red-50 border border-red-200 rounded-md p-2.5 text-xs text-red-600 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            驗證失敗：分期金額合計 ≠ 申報收入金額
                          </div>
                        );
                      }
                      return (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-md p-2 text-xs text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          分期總額已對齊已簽署收入 ✓
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>

              <Separator />

              {/* ─── Section 7: L2 已簽署支出 Signed Expense ─── */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  L2 已簽署支出 Signed Expense
                  <span className="text-red-500 text-xs">*必填</span>
                </h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    此簽約金額為記錄用途，轉換為項目後將無法更改，請謹慎填寫
                  </p>
                </div>

                <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                  {/* Import L1 button at top */}
                  <div className="flex items-center justify-end">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs gap-1.5 bg-indigo-500 hover:bg-indigo-600 text-white"
                      onClick={duplicateL1Expenses}
                      disabled={importingL1}
                    >
                      <Copy className="w-3.5 h-3.5" /> {importingL1 ? "載入中..." : "匯入 L1 報價支出"}
                    </Button>
                  </div>

                  {/* Column headers */}
                  {signedExpenseRows.length > 0 && (
                    <div className="grid grid-cols-[1fr_120px_36px] gap-2 items-center px-1">
                      <span className="text-[13px] font-medium text-gray-400 uppercase tracking-wide">支出類型 Type</span>
                      <span className="text-[13px] font-medium text-gray-400 uppercase tracking-wide">金額 Amount</span>
                      <span />
                    </div>
                  )}

                  {/* Existing expense rows — editable, persisted to project_initial_expenses */}
                  {signedExpenseLoading ? (
                    <div className="flex items-center justify-center py-4 text-xs text-gray-400 gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> 載入 L2 初始費用...
                    </div>
                  ) : (
                    signedExpenseRows.map((row, idx) => (
                      <div key={row.id || idx} className="grid grid-cols-[1fr_120px_36px] gap-2 items-center">
                        <Select
                          value={row.expense_type_id}
                          onValueChange={(v) => handleSignedExpenseChange(idx, "expense_type_id", v)}
                          disabled={signedExpenseSaving}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="選擇支出類型..." />
                          </SelectTrigger>
                          <SelectContent>
                            {expenseTypeOptions.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.chinese_display || t.display}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.amount}
                          onChange={(e) => patchSignedExpenseAmount(idx, e.target.value)}
                          onBlur={() => handleSignedExpenseAmountBlur(idx)}
                          className="h-9 text-xs font-mono"
                          disabled={signedExpenseSaving}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-9 w-9 p-0 text-red-400 hover:text-red-600"
                          onClick={() => removeSignedExpenseRow(idx)}
                          disabled={signedExpenseSaving}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))
                  )}

                  {!signedExpenseLoading && signedExpenseRows.length === 0 && (
                    <div className="text-center py-4 text-xs text-gray-400">
                      至少需要一筆支出記錄（金額可為 $0）。使用下方表單新增或「匯入 L1 報價支出」。
                    </div>
                  )}

                  {/* Add new row form — placed after existing rows */}
                  <div className="border-t pt-3 space-y-2">
                    <span className="text-[13px] font-medium text-gray-500">新增支出 Add Expense</span>
                    <div className="grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                      <Select
                        value={newExpenseTypeId}
                        onValueChange={(v) => setNewExpenseTypeId(v)}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="選擇支出類型..." />
                        </SelectTrigger>
                        <SelectContent>
                          {expenseTypeOptions.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.chinese_display || t.display}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="$0"
                        value={newExpenseAmount}
                        onChange={(e) => setNewExpenseAmount(e.target.value)}
                        className="h-9 text-xs font-mono"
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                        onClick={addSignedExpenseRow}
                        disabled={!canAddExpenseRow || signedExpenseSaving}
                      >
                        {signedExpenseSaving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}{" "}
                        新增
                      </Button>
                    </div>
                  </div>

                  {/* Total Signed Expense */}
                  <div className="space-y-1.5 border-t pt-3">
                    <Label className="text-xs font-medium text-gray-600">
                      總計已簽署支出 Total Signed Expense
                    </Label>
                    <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                      <span className="text-sm font-mono font-semibold text-gray-700">
                        {totalSignedExpense > 0
                          ? formatMoney(totalSignedExpense)
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* ─── Section 8: 必要文件 Essential Docs (project-level only) ─── */}
              {initialDocTypes.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Upload className="w-4 h-4 text-emerald-500" />
                      必要文件 Essential Docs
                    </h3>
                    <p className="text-xs text-gray-500 mt-1.5">
                      BR、Form S1 及推薦信請於提案「客戶文件」分頁上傳（客戶層級文件，可跨項目共用）。
                    </p>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {initialDocTypes.map((docType) => (
                        <div key={docType.id} className="space-y-2">
                          <span className="text-xs font-medium text-gray-700 block truncate" title={docType.display || ""}>
                            {docType.display || "—"}
                          </span>

                          {/* File upload area */}
                          <div
                            className={`relative border-2 border-dashed rounded-lg h-32 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                              essentialDocFiles[docType.id]
                                ? "border-emerald-300 bg-emerald-50"
                                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                            }`}
                            onClick={() => essentialFileRefs.current[docType.id]?.click()}
                          >
                            <input
                              ref={(el) => { essentialFileRefs.current[docType.id] = el; }}
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                setEssentialDocFiles((prev) => ({ ...prev, [docType.id]: file }));
                              }}
                            />
                            {essentialDocFiles[docType.id] ? (
                              <div className="flex flex-col items-center gap-1 px-2 text-center">
                                <FileText className="w-6 h-6 text-emerald-500" />
                                <span className="text-[13px] text-emerald-700 font-medium truncate max-w-[180px]">
                                  {essentialDocFiles[docType.id]!.name}
                                </span>
                                <button
                                  type="button"
                                  className="text-[12px] text-red-400 hover:text-red-600 underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEssentialDocFiles((prev) => ({ ...prev, [docType.id]: null }));
                                    if (essentialFileRefs.current[docType.id]) {
                                      essentialFileRefs.current[docType.id]!.value = "";
                                    }
                                  }}
                                >
                                  移除
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1.5 text-gray-400">
                                <Upload className="w-5 h-5" />
                                <span className="text-[13px]">Click to upload a file</span>
                              </div>
                            )}
                          </div>

                          {/* Doc date fields */}
                          {docType.enable_doc_date && (
                            <div className="space-y-1">
                              <Label className="text-[13px] text-gray-500">文件簽發日期</Label>
                              <Input
                                type="date"
                                value={essentialDocDates[docType.id] || ""}
                                onChange={(e) =>
                                  setEssentialDocDates((prev) => ({ ...prev, [docType.id]: e.target.value }))
                                }
                                className="h-8 text-xs"
                                placeholder="不適用"
                              />
                            </div>
                          )}
                          {!docType.enable_doc_date && (
                            <div className="space-y-1">
                              <Label className="text-[13px] text-gray-500">文件簽發日期</Label>
                              <div className="bg-gray-100 border border-gray-200 rounded-md px-3 py-1.5 text-xs text-gray-400">
                                不適用
                              </div>
                            </div>
                          )}

                          {docType.enable_expiry_date && (
                            <div className="space-y-1">
                              <Label className="text-[13px] text-gray-500">文件到期日</Label>
                              <Input
                                type="date"
                                value={essentialDocExpiries[docType.id] || ""}
                                onChange={(e) =>
                                  setEssentialDocExpiries((prev) => ({ ...prev, [docType.id]: e.target.value }))
                                }
                                className="h-8 text-xs"
                                placeholder="不適用"
                              />
                            </div>
                          )}
                          {!docType.enable_expiry_date && (
                            <div className="space-y-1">
                              <Label className="text-[13px] text-gray-500">文件到期日</Label>
                              <div className="bg-gray-100 border border-gray-200 rounded-md px-3 py-1.5 text-xs text-gray-400">
                                不適用
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Error message */}
              {projectError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-600 flex items-start gap-1 whitespace-pre-line">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {projectError}
                  </p>
                </div>
              )}
            </div>
            </fieldset>
          </div>

          <DialogFooter className="px-6 pt-4 pb-6 border-t flex-shrink-0 flex-row justify-end gap-3 sm:space-x-0">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={advancingStage || creatingProject}
            >
              {conversionReadOnly ? "關閉" : "取消"}
            </Button>
            {!conversionReadOnly && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleCreateProject}
              disabled={
                advancingStage ||
                creatingProject ||
                generatingCode
              }
            >
              {advancingStage || creatingProject ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-1" />
              )}
              確認建立項目並推進
            </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={showLinkedProjectChoice}
        onOpenChange={(openChoice) => {
          if (!openChoice) setShowLinkedProjectChoice(false);
        }}
      >
        <AlertDialogContent className="z-[100]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              已有連結項目
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  此提案已連結項目{" "}
                  <span className="font-mono font-medium text-foreground">
                    {linkedExistingProject?.project_code ||
                      linkedExistingProject?.id}
                  </span>
                  {linkedExistingProject?.project_name
                    ? `（${linkedExistingProject.project_name}）`
                    : ""}
                  。
                </p>
                <p>請選擇本次轉換要執行的操作：</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-col gap-2 sm:space-x-0">
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={creatingProject || advancingStage}
              onClick={() => {
                void continueCreateNewPath();
              }}
            >
              建立新項目（完整轉換流程）
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={creatingProject || advancingStage}
              onClick={() => {
                void executeStatusOnly();
              }}
            >
              {creatingProject || advancingStage ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  處理中…
                </>
              ) : (
                "僅推進階段（不建立新項目）"
              )}
            </Button>
            <AlertDialogCancel
              className="w-full mt-0"
              disabled={creatingProject || advancingStage}
            >
              取消
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-blue-600 text-lg">
            <Play className="w-5 h-5" /> Enquiry → Pitching 轉換
          </DialogTitle>
          <p className="text-xs text-gray-500 mt-1">
            請填寫客戶資訊及提案資訊，確認後將推進至「Pitching」階段
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-200px)]">
          <div className="px-6 py-5 space-y-8">
            {/* ─── SECTION 0: Site Photos (min 3 when ≥ $100K) ─── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ImagePlus className="w-4 h-4 text-blue-500" />
                現場相片 Site Photos
                {sitePhotosRequired && <span className="text-red-500">*</span>}
                <span className="text-[12px] text-gray-400 font-normal ml-auto">
                  {sitePhotosRequired ? "(最少 3 張)" : "(選填)"}
                </span>
              </h3>

              <div className="pl-1">
                <MultiImageUploader
                  value={sitePhotos}
                  onChange={(urls) => {
                    setSitePhotos(urls);
                    if (!sitePhotosRequired || urls.length >= 3) setSitePhotosError("");
                  }}
                  bucket="site-photos"
                  pathPrefix={pitchingId}
                  minImages={sitePhotosRequired ? 3 : 0}
                  maxImages={20}
                  label="現場相片 Site Photos"
                  required={sitePhotosRequired}
                  error={sitePhotosError}
                />
              </div>
            </div>

            {/* ─── SECTION 1: Customer Information ─── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                客戶資訊 Customer Information
              </h3>

              <div className="space-y-4 pl-1">
                {/* View System toggle */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">
                    檢示系統 View System<span className="text-red-500">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        custForm.view_system === "BWA" ? "default" : "outline"
                      }
                      className={
                        custForm.view_system === "BWA"
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : ""
                      }
                      onClick={() =>
                        setCustForm((f) => ({ ...f, view_system: "BWA" }))
                      }
                    >
                      BWA
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        custForm.view_system === "BWF" ? "default" : "outline"
                      }
                      className={
                        custForm.view_system === "BWF"
                          ? "bg-amber-500 hover:bg-amber-600 text-white"
                          : ""
                      }
                      onClick={() =>
                        setCustForm((f) => ({ ...f, view_system: "BWF" }))
                      }
                    >
                      BWF
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        custForm.view_system === "Both" ? "default" : "outline"
                      }
                      className={
                        custForm.view_system === "Both"
                          ? "bg-violet-500 hover:bg-violet-600 text-white"
                          : ""
                      }
                      onClick={() =>
                        setCustForm((f) => ({ ...f, view_system: "Both" }))
                      }
                    >
                      Both
                    </Button>
                  </div>
                </div>

                {/* Display Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">
                    顯示名稱 Display Name<span className="text-red-500">*</span>
                  </Label>
                  <p className="text-[13px] text-blue-500">
                    ℹ 此欄位用於搜尋用途，請加入更多說明以便日後搜尋
                  </p>
                  <Input
                    value={custForm.display_name}
                    onChange={(e) =>
                      setCustForm((f) => ({
                        ...f,
                        display_name: e.target.value,
                      }))
                    }
                    placeholder="Display Name"
                  />
                </div>

                {/* Customer Name + Company Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      聯絡人名稱 Customer Name
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={custForm.customer_name}
                      onChange={(e) =>
                        setCustForm((f) => ({
                          ...f,
                          customer_name: e.target.value,
                        }))
                      }
                      placeholder="Customer Name"
                    />
                    {duplicateWarning.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-md p-2 mt-1">
                        <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Similar customer
                          detected. Do not create a duplicate entry.
                        </p>
                        {duplicateWarning.map((w, i) => (
                          <p key={i} className="text-xs text-blue-600 mt-0.5">
                            {w}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      公司(商業登記)名稱 Company Name
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={custForm.company_name}
                      onChange={(e) =>
                        setCustForm((f) => ({
                          ...f,
                          company_name: e.target.value,
                        }))
                      }
                      placeholder="Company Name"
                    />
                  </div>
                </div>

                {/* Brand Names */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">
                    此客戶是否為知明品牌?
                  </Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[13px] text-gray-500">
                        知名品牌名稱(中文) Brand Name (Chinese)
                      </span>
                      <Input
                        value={custForm.brand_name_cn}
                        onChange={(e) =>
                          setCustForm((f) => ({
                            ...f,
                            brand_name_cn: e.target.value,
                          }))
                        }
                        placeholder="Chinese Brand Name"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[13px] text-gray-500">
                        知名品牌名稱(英文) Brand Name (English)
                      </span>
                      <Input
                        value={custForm.brand_name_en}
                        onChange={(e) =>
                          setCustForm((f) => ({
                            ...f,
                            brand_name_en: e.target.value,
                          }))
                        }
                        placeholder="English Brand Name"
                      />
                    </div>
                  </div>
                </div>

                {/* Phone + Secondary Phone + Email */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      主要電話號碼 Major Phone
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={custForm.phone_display}
                      onChange={(e) =>
                        setCustForm((f) => ({
                          ...f,
                          phone_display: e.target.value,
                        }))
                      }
                      placeholder="Major Phone"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      後備電話號碼 Secondary Phone
                    </Label>
                    <Input
                      value={custForm.phone_number_a}
                      onChange={(e) =>
                        setCustForm((f) => ({
                          ...f,
                          phone_number_a: e.target.value,
                        }))
                      }
                      placeholder="Secondary Phone"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      電郵 Email<span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="email"
                      value={custForm.email}
                      onChange={(e) =>
                        setCustForm((f) => ({ ...f, email: e.target.value }))
                      }
                      placeholder="Email"
                    />
                  </div>
                </div>

                {/* Enquiry Date */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      查詢日期 Enquiry Date
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={enquiryDate}
                      onChange={(e) => setEnquiryDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Business Tags */}
                {collections.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">
                      Business Tags
                    </Label>
                    <div className="border rounded-lg p-4 space-y-3 bg-gray-50/50">
                      {collections.map((col) => (
                        <div key={col.id}>
                          <p className="text-[13px] font-medium text-gray-500 mb-1.5">
                            {col.display}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {col.tags.map((tag) => {
                              const selected = isTagSelected(tag.id);
                              return (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() =>
                                    toggleTag(
                                      tag.id,
                                      col.id,
                                      col.isSingleSelect,
                                    )
                                  }
                                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                    selected
                                      ? "bg-blue-600 text-white border-blue-600"
                                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                                  }`}
                                >
                                  {selected && <span className="mr-1">✓</span>}
                                  {tag.display}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* ─── SECTION 2: Pitching Information ─── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-500" />
                提案資訊 Pitching Information
              </h3>

              <div className="space-y-4 pl-1">
                {/* District + GFA + SA */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      地區<span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={pitchForm.district_id}
                      onValueChange={(v) =>
                        setPitchForm((f) => ({ ...f, district_id: v }))
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="District" />
                      </SelectTrigger>
                      <SelectContent>
                        {districtOptions.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      建築面積 GFA Size (sq. ft.)
                    </Label>
                    <Input
                      placeholder="Gross Floor Area (sq. ft.)"
                      value={pitchForm.size}
                      onChange={(e) =>
                        setPitchForm((f) => ({ ...f, size: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      實用面積 SA Size (sq. ft.)
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="Saleable Area (sq. ft.)"
                      value={pitchForm.actual_size}
                      onChange={(e) =>
                        setPitchForm((f) => ({
                          ...f,
                          actual_size: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Height fields */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      樓底高度 - 真天花 True Celling (mm)
                    </Label>
                    <Input
                      placeholder="Height to TC (mm)"
                      value={pitchForm.height_to_tc}
                      onChange={(e) =>
                        setPitchForm((f) => ({
                          ...f,
                          height_to_tc: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      樓底高度 - 陣底 Beam Soffit (mm)
                    </Label>
                    <Input
                      placeholder="Height to BS (mm)"
                      value={pitchForm.height_to_bs}
                      onChange={(e) =>
                        setPitchForm((f) => ({
                          ...f,
                          height_to_bs: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      樓底高度 - 假天花 False Celling (mm)
                    </Label>
                    <Input
                      placeholder="Height to FC (mm)"
                      value={pitchForm.height_to_fc}
                      onChange={(e) =>
                        setPitchForm((f) => ({
                          ...f,
                          height_to_fc: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Site Address + Asana Link + Working Folder */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      工程地址 Site Address
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="N/A"
                      value={pitchForm.site_address}
                      onChange={(e) =>
                        setPitchForm((f) => ({
                          ...f,
                          site_address: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      項目Asana 連結<span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="https://app.asana.com/..."
                      value={pitchForm.asana_link}
                      onChange={(e) =>
                        setPitchForm((f) => ({
                          ...f,
                          asana_link: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      工作資料夾 Working Folder
                    </Label>
                    <Input
                      placeholder="Working Folder"
                      value={pitchForm.working_folder}
                      onChange={(e) =>
                        setPitchForm((f) => ({
                          ...f,
                          working_folder: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Building search — above L1 financials */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-gray-600">
                      搜尋並選擇大廈 Search & select a building
                    </Label>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium transition-colors"
                      onClick={() => setQuickAddBuildingOpen(true)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      快速新增
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      placeholder="Select a building"
                      value={buildingSearch}
                      onChange={(e) => setBuildingSearch(e.target.value)}
                    />
                    {buildingSearch && buildingOptions.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {buildingOptions.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors"
                            onClick={() => {
                              setPitchForm((f) => ({
                                ...f,
                                r_building_id: b.id,
                              }));
                              setBuildingSearch(b.label);
                            }}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {pitchForm.r_building_id && (
                    <p className="text-xs text-emerald-600 mt-1">
                      ✓ 已選擇大廈:{" "}
                      {buildingOptions.find(
                        (b) => b.id === pitchForm.r_building_id,
                      )?.label ||
                        data.building_name ||
                        pitchForm.r_building_id}
                    </p>
                  )}
                  <BuildingEditDialog
                    open={quickAddBuildingOpen}
                    onOpenChange={setQuickAddBuildingOpen}
                    building={null}
                    onSaved={(created) => {
                      if (created) {
                        setPitchForm((f) => ({
                          ...f,
                          r_building_id: created.id,
                        }));
                        setBuildingSearch(created.label);
                        setBuildingOptions((prev) => {
                          if (prev.some((b) => b.id === created.id)) return prev;
                          return [{ id: created.id, label: created.label }, ...prev];
                        });
                      }
                    }}
                  />
                </div>

                {/* ─── L1 Budget — required ($0 acceptable) ─── */}
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  L1 財務預算  Budget Estimation
                </h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    此預計金額為記錄用途，轉換為項目後將無法更改，請謹慎填寫
                  </p>
                </div>
                {/* L1 Estimated Income (manual) */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      L1 預計收入 Estimated Income (HKD)
                      <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="pl-6"
                        placeholder="0"
                        value={pitchForm.l1_income}
                        onChange={(e) =>
                          setPitchForm((f) => ({ ...f, l1_income: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* L1 Estimated Expense (itemized list, defaults to current L1) */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600 flex items-center gap-2">
                    <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                    L1 預計支出 Estimated Expense (HKD)
                    <span className="text-red-500">*</span>
                    <span className="text-[11px] text-gray-400 font-normal">
                      （至少一筆；金額可為 $0）
                    </span>
                  </Label>

                  <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                    {l1ExpenseLoading ? (
                      <div className="flex items-center justify-center py-4 text-xs text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" /> 載入 L1 支出...
                      </div>
                    ) : (
                      <>
                        {/* Column headers */}
                        {hasL1Items && (
                          <div className="grid grid-cols-[1fr_120px_36px] gap-2 items-center px-1">
                            <span className="text-[12px] font-medium text-gray-400 uppercase tracking-wide">支出類型 Type</span>
                            <span className="text-[12px] font-medium text-gray-400 uppercase tracking-wide text-right">金額 Amount</span>
                            <span />
                          </div>
                        )}

                        {/* Existing / added expense rows */}
                        {l1ExpenseRows.map((row, idx) => (
                          <div key={idx} className="grid grid-cols-[1fr_120px_36px] gap-2 items-center">
                            <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-xs text-gray-700 truncate">
                              {l1ExpenseTypeOptions.find((t) => t.id === row.expense_type_id)?.chinese_display ||
                                l1ExpenseTypeOptions.find((t) => t.id === row.expense_type_id)?.display ||
                                row.expense_type_id || "—"}
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-xs font-mono text-gray-700 text-right">
                              {formatMoney(parseFloat(row.amount || "0"), { showZero: true })}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-9 w-9 p-0 text-red-400 hover:text-red-600"
                              onClick={() => removeL1ExpenseRow(idx)}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}

                        {!hasL1Items && (
                          <div className="text-center py-3 text-xs text-amber-600">
                            至少需要新增一筆支出項目（金額可為 $0）
                          </div>
                        )}

                        {/* Add new row */}
                        <div className="border-t pt-3 grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                          <Select
                            value={l1NewExpenseTypeId}
                            onValueChange={(v) => setL1NewExpenseTypeId(v)}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="選擇支出類型..." />
                            </SelectTrigger>
                            <SelectContent>
                              {l1ExpenseTypeOptions.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.chinese_display || t.display}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="$0"
                            value={l1NewExpenseAmount}
                            onChange={(e) => setL1NewExpenseAmount(e.target.value)}
                            className="h-9 text-xs font-mono"
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="h-9 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                            onClick={addL1ExpenseRow}
                            disabled={!canAddL1Expense}
                          >
                            <Plus className="w-3.5 h-3.5" /> 新增
                          </Button>
                        </div>

                        {/* Total — disabled when list has items (dynamic sum);
                            editable manual input only when the list is empty
                            (allows confirming a $0 / zero-cost project). */}
                        <div className="border-t pt-3 grid grid-cols-2 gap-4 items-center">
                          <Label className="text-xs font-medium text-gray-600">
                            總計 L1 預計支出 Total Estimated Expense
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="pl-6 font-mono font-semibold disabled:bg-gray-50 disabled:text-gray-700"
                              placeholder="0"
                              value={hasL1Items ? String(l1ListTotal) : pitchForm.l1_expense}
                              disabled={hasL1Items}
                              onChange={(e) =>
                                setPitchForm((f) => ({ ...f, l1_expense: e.target.value }))
                              }
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Validation error — kept INSIDE the scroll area so a long list
              scrolls with the form and never pushes the footer off-screen. */}
          {conversionError && (
            <div className="mx-6 mb-5 bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600 flex items-start gap-1 whitespace-pre-line">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {conversionError}
              </p>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t bg-gray-50">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={advancingStage || savingConversion}
          >
            取消
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleSaveAndAdvance}
            disabled={advancingStage || savingConversion}
          >
            {advancingStage || savingConversion ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-1" />
            )}
            確認推進至 Pitching
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Company BV handler_id — only Super Admin can edit/delete
const COMPANY_BV_HANDLER_ID = "00000000-0000-4000-8000-000000000001";

// ─── MAIN COMPONENT ─────────────────────────────────────
export default function BWAPitchingDetail({
  pitchingId,
}: BWAPitchingDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canView, canEdit, canDelete, checkRule, loading: permLoading, debugModulePermissions } = usePermission();
  const { toast } = useToast();
  const { staff } = useAuth();
  const { formatMoney } = useFinancialFormat();

  // DEV: log which permission decides each pitching-detail tab capability, so a
  // developer can see exactly what is blocking a hidden button in the console.
  React.useEffect(() => {
    if (permLoading) return;
    debugModulePermissions("Pitching (Proposal) Detail", [
      "proposals",
      "proposals.overview",
      "proposals.l1-budget",
      "proposals.site",
      "proposals.tender",
      "proposals.quotation",
      "proposals.tag",
      "proposals.internal-comment",
      "proposals.3d",
      "proposals.manhour",
    ]);
  }, [permLoading, debugModulePermissions]);

  // Helper: check if a BV row is the protected company BV (only Super Admin can edit/delete)
  const isCompanyBV = (handlerId: string | null) => handlerId === COMPANY_BV_HANDLER_ID;
  const isSuperAdmin = (staff as any)?.role === "Super Admin";

  // ─── Role-based detail access control ──────────────────────
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  const [data, setData] = useState<BWAPitchingDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Cascade delete states (Super Admin only)
  const [showCascadeDeleteDialog, setShowCascadeDeleteDialog] = useState(false);
  const [cascadeAnalysis, setCascadeAnalysis] = useState<PitchingCascadeAnalysisResult | null>(null);
  const [cascadeLoading, setCascadeLoading] = useState(false);
  const [cascadeStep, setCascadeStep] = useState<"analysis" | "confirm">("analysis");
  const [cascadeSelections, setCascadeSelections] = useState<Record<string, boolean>>({});
  const [deleteProject, setDeleteProject] = useState(false);
  const [deleteCustomer, setDeleteCustomer] = useState(false);
  const [cascadeExecuting, setCascadeExecuting] = useState(false);
  const [cascadeDeletionLog, setCascadeDeletionLog] = useState<{ table: string; deleted: number; error?: string }[] | null>(null);
  const [cascadeDeleteConfirmText, setCascadeDeleteConfirmText] = useState("");
  const [cascadeDeleteAttempts, setCascadeDeleteAttempts] = useState(0);
  const [cascadeError, setCascadeError] = useState<string | null>(null);
  const cascadeDeleteInputRef = React.useRef<HTMLInputElement>(null);
  const [confirmDeleteBVId, setConfirmDeleteBVId] = useState<string | null>(null);
  const [showCaseClosedDialog, setShowCaseClosedDialog] = useState(false);
  const [closingCase, setClosingCase] = useState(false);
  const [showRecoverDialog, setShowRecoverDialog] = useState(false);
  const [recoveringCase, setRecoveringCase] = useState(false);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [advancingStage, setAdvancingStage] = useState(false);
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
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

  // ─── Customer Tags state ───
  const [detailCollections, setDetailCollections] = useState<TagCollection[]>([]);
  const [detailCustomerTags, setDetailCustomerTags] = useState<CustomerTagEntry[]>([]);

  // ─── Pitching BV state ───
  const [pitchingBVList, setPitchingBVList] = useState<PitchingBVRow[]>([]);
  const [bvLoading, setBvLoading] = useState(false);
  const [bvReloadKey, setBvReloadKey] = useState(0);

  // ─── Pitching BV CRUD state ───
  const [showBVDialog, setShowBVDialog] = useState(false);
  const [bvEditingId, setBvEditingId] = useState<string | null>(null);
  const [bvFormHandlerId, setBvFormHandlerId] = useState<string>("");
  const [bvSaving, setBvSaving] = useState(false);
  const [bvDeleting, setBvDeleting] = useState<string | null>(null);
  const [staffOptions, setStaffOptions] = useState<{ id: string; name: string }[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const result = await fetchBWAPitchingDetail(pitchingId);
    setData(result);
    setLoading(false);
    // Also trigger BV list reload
    setBvReloadKey((k) => k + 1);
  }, [pitchingId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Quick-edit 提案描述 Description ──────────────────────────
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);

  const startEditDescription = () => {
    setDescriptionDraft(data?.description || "");
    setEditingDescription(true);
  };

  const handleSaveDescription = async () => {
    if (!data) return;
    setSavingDescription(true);
    const next = descriptionDraft.trim();
    const result = await updateBWAPitching(pitchingId, {
      description: next,
      modified_date: new Date().toISOString(),
    });
    setSavingDescription(false);
    if (result.success) {
      // Patch locally so the UI reflects the change immediately.
      setData((prev) => (prev ? { ...prev, description: next } : prev));
      setEditingDescription(false);
      toast({ title: "✓ 提案描述已更新", duration: 2500 });
    } else {
      toast({
        title: "更新失敗",
        description: result.error || "未知錯誤",
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  // ─── Auto-open convert dialog if ?action=convert ─────────────
  useEffect(() => {
    if (!data || loading) return;
    const action = searchParams.get("action");
    if (action === "convert" && (data.pitching_stages === "Enquiry" || data.pitching_stages === "Pitching")) {
      setShowStageDialog(true);
      // Clean up URL param after opening
      router.replace(`/proposals/${pitchingId}`, { scroll: false });
    }
  }, [data, loading, searchParams, pitchingId, router]);

  // ─── Load Customer Tags for detail view ─────────────────────
  useEffect(() => {
    if (!data?.customer_id) return;
    fetchCustomerTagsGrouped(data.customer_id).then(
      ({ collections, customerTags }) => {
        setDetailCollections(collections);
        setDetailCustomerTags(customerTags);
      }
    );
  }, [data?.customer_id]);

  // ─── Load Pitching BV records ─────────────────────────────
  useEffect(() => {
    if (!pitchingId) return;
    const loadBV = async () => {
      setBvLoading(true);
      try {
        const supabaseClient = createClient();
        const { data: bvRows, error } = await supabaseClient
          .from("pitching_bv")
          .select("id, handler_id, pitching_status, pitching_count, project_count, case_closed_count, quotation_count, created_date, modified_date, enquiry_date")
          .eq("pitching_id", pitchingId);

        if (error || !bvRows || bvRows.length === 0) {
          setPitchingBVList([]);
          setBvLoading(false);
          return;
        }

        // Fetch handler names from staff table
        const handlerIds = [...new Set(bvRows.map((r: any) => r.handler_id).filter(Boolean))];
        let handlerMap = new Map<string, string>();
        if (handlerIds.length > 0) {
          const { data: staffRows } = await supabaseClient
            .from("staff")
            .select("id, name")
            .in("id", handlerIds);
          if (staffRows) {
            handlerMap = new Map(staffRows.map((s: any) => [s.id, s.name]));
          }
        }

        const mapped: PitchingBVRow[] = bvRows.map((r: any) => ({
          id: r.id,
          handler_id: r.handler_id,
          handler_name: r.handler_id ? handlerMap.get(r.handler_id) || null : null,
          pitching_status: r.pitching_status,
          pitching_count: r.pitching_count,
          project_count: r.project_count,
          case_closed_count: r.case_closed_count,
          quotation_count: r.quotation_count,
          created_date: r.created_date,
          modified_date: r.modified_date,
          enquiry_date: r.enquiry_date,
        }));

        setPitchingBVList(mapped);
      } catch (err) {
        console.error("[BWAPitchingDetail] loadBV error:", err);
        setPitchingBVList([]);
      }
      setBvLoading(false);
    };
    loadBV();
  }, [pitchingId, bvReloadKey]);

  // ─── Access check: User / Senior User role restriction ─────────
  useEffect(() => {
    if (!staff || bvLoading) return;
    const checkAccess = async () => {
      const role = (staff as any).role as string | null;
      if (role === "User") {
        // User can only see pitchings where they are a handler in pitching_bv
        const isHandler = pitchingBVList.some((bv) => bv.handler_id === staff.id);
        setAccessDenied(!isHandler);
      } else if (role === "Senior User") {
        // Senior User can only see pitchings where any handler shares same team
        const staffTeamId = (staff as any).n_team_type_id;
        if (staffTeamId && pitchingBVList.length > 0) {
          const handlerIds = pitchingBVList
            .map((bv) => bv.handler_id)
            .filter(Boolean) as string[];
          if (handlerIds.length > 0) {
            const supabaseClient = createClient();
            const { data: teamStaff } = await supabaseClient
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
      setAccessChecked(true);
    };
    checkAccess();
  }, [staff, pitchingBVList, bvLoading]);

  // ─── Load staff options for BV CRUD ───
  useEffect(() => {
    const loadStaff = async () => {
      const supabaseClient = createClient();
      const { data: staffData } = await supabaseClient
        .from("staff")
        .select("id, name")
        .eq("status", "Active")
        .order("name", { ascending: true });
      if (staffData) setStaffOptions(staffData);
    };
    loadStaff();
  }, []);

  // ─── BV CRUD Handlers ───
  const handleBVAdd = () => {
    setBvEditingId(null);
    setBvFormHandlerId("");
    setShowBVDialog(true);
  };

  const handleBVEdit = (bv: PitchingBVRow) => {
    // Guard: company BV can only be edited by Super Admin
    if (isCompanyBV(bv.handler_id) && !isSuperAdmin) return;
    setBvEditingId(bv.id);
    setBvFormHandlerId(bv.handler_id || "");
    setShowBVDialog(true);
  };

  const handleBVSave = async () => {
    if (!bvFormHandlerId || !data) return;
    setBvSaving(true);
    const supabaseClient = createClient();
    const now = new Date().toISOString();

    if (bvEditingId) {
      // Determine if the edited BV row belongs to main PM or main designer
      const editedBV = pitchingBVList.find((bv) => bv.id === bvEditingId);
      const originalHandlerId = editedBV?.handler_id;

      // UPDATE — only update handler and modified_date
      await supabaseClient
        .from("pitching_bv")
        .update({
          handler_id: bvFormHandlerId,
          modified_date: now,
        })
        .eq("id", bvEditingId);

      // If the original handler was main PM or main designer, update pitching record
      let pitchingUpdated = false;
      if (originalHandlerId && originalHandlerId !== bvFormHandlerId) {
        const pitchingUpdates: { main_pm_id?: string; main_designer_id?: string; modified_date?: string } = {};
        if (originalHandlerId === data.main_pm_id) {
          pitchingUpdates.main_pm_id = bvFormHandlerId;
        }
        if (originalHandlerId === data.main_designer_id) {
          pitchingUpdates.main_designer_id = bvFormHandlerId;
        }
        if (Object.keys(pitchingUpdates).length > 0) {
          pitchingUpdates.modified_date = now;
          await updateBWAPitching(pitchingId, pitchingUpdates);
          pitchingUpdated = true;
        }
      }

      // Reload pitching data if main PM/designer was changed
      if (pitchingUpdated) {
        loadData();
      }
    } else {
      // CREATE
      await supabaseClient.from("pitching_bv").insert({
        pitching_id: pitchingId,
        handler_id: bvFormHandlerId,
        pitching_status: data.pitching_stages || "Enquiry",
        created_date: now,
        modified_date: now,
      });
    }

    setBvSaving(false);
    setShowBVDialog(false);
    setBvReloadKey((k) => k + 1);
  };

  const handleBVDelete = async (bvId: string) => {
    // Guard: check if this BV is the protected company BV
    const targetBV = pitchingBVList.find((bv) => bv.id === bvId);
    if (targetBV && isCompanyBV(targetBV.handler_id) && !isSuperAdmin) return;
    setConfirmDeleteBVId(bvId);
  };

  const confirmBVDelete = async () => {
    if (!confirmDeleteBVId) return;
    setBvDeleting(confirmDeleteBVId);
    const supabaseClient = createClient();
    await supabaseClient.from("pitching_bv").delete().eq("id", confirmDeleteBVId);
    setBvDeleting(null);
    setConfirmDeleteBVId(null);
    setBvReloadKey((k) => k + 1);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const result = await deleteBWAPitching(pitchingId);
    if (result.success) {
      router.push("/proposals");
    }
    setDeleting(false);
    setShowDeleteDialog(false);
  };

  // ─── CASCADE DELETE HANDLERS (Super Admin) ────────────────────
  const handleCascadeDelete = async () => {
    if (cascadeDeleteConfirmText !== "Confirm Delete") return;
    setCascadeExecuting(true);
    const result = await executePitchingCascadeDelete(
      pitchingId,
      cascadeSelections,
      true, // always delete pitching
      deleteProject,
      deleteCustomer
    );
    setCascadeDeletionLog(result.deletion_log || null);
    if (result.success) {
      setTimeout(() => router.push("/proposals"), 1500);
    }
    setCascadeExecuting(false);
  };

  // Load cascade analysis when dialog opens
  useEffect(() => {
    if (showCascadeDeleteDialog) {
      setCascadeDeleteConfirmText("");
      setCascadeDeleteAttempts(0);
      setCascadeStep("analysis");
      setCascadeAnalysis(null);
      setCascadeSelections({});
      setDeleteProject(false);
      setDeleteCustomer(false);
      setCascadeDeletionLog(null);
      setCascadeError(null);
      setCascadeLoading(true);
      analyzePitchingCascadeDelete(pitchingId).then(({ data: analysisData, error }) => {
        if (analysisData) {
          setCascadeAnalysis(analysisData);
          // Default: select all for deletion
          const defaults: Record<string, boolean> = {};
          analysisData.related_groups.forEach((g) => { defaults[g.table] = true; });
          setCascadeSelections(defaults);
          setDeleteProject(false); // User must opt-in for project deletion
        } else if (error) {
          setCascadeError(error);
        }
        setCascadeLoading(false);
      });
      setTimeout(() => cascadeDeleteInputRef.current?.focus(), 300);
    }
  }, [showCascadeDeleteDialog, pitchingId]);

  const handleCaseClosed = async () => {
    setClosingCase(true);
    const result = await updateBWAPitching(pitchingId, {
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
    const result = await updateBWAPitching(pitchingId, {
      pitching_stages: "Enquiry",
      modified_date: new Date().toISOString(),
    });
    if (result.success) {
      await loadData();
    }
    setRecoveringCase(false);
    setShowRecoverDialog(false);
  };

  const handleAdvanceStage = async () => {
    if (!data) return;
    setAdvancingStage(true);
    const nextStage =
      data.pitching_stages === "Enquiry" ? "Pitching" : "Confirmed Project";
    const result = await updateBWAPitching(pitchingId, {
      pitching_stages: nextStage,
      modified_date: new Date().toISOString(),
    });
    if (result.success) {
      await loadData();
    }
    setAdvancingStage(false);
    setShowStageDialog(false);
  };

  // Find linked project when stage is "Confirmed Project"
  useEffect(() => {
    if (data?.pitching_stages === "Confirmed Project") {
      const supabaseClient = createClient();
      supabaseClient
        .from("bwa_projects")
        .select("id")
        .eq("pitching_id", pitchingId)
        .limit(1)
        .then(({ data: projects }: { data: any }) => {
          if (projects && projects.length > 0) {
            setLinkedProjectId(projects[0].id);
          }
        });
    }
  }, [data?.pitching_stages, pitchingId]);

  const openCustomerEdit = () => {
    if (!data?.customer_id) return;
    setCustomerForm({
      customer_name: data.customer_raw_name || data.customer_name || "",
      display_name: data.customer_display_name || "",
      company_name: data.customer_raw_company || data.customer_company || "",
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
      loadData();
    }
  };

  // Calculate margin
  const estimatedMargin =
    data?.estimated_income && data?.estimated_expense
      ? data.estimated_income - data.estimated_expense
      : null;
  const marginPercent =
    data?.estimated_income && estimatedMargin != null
      ? ((estimatedMargin / data.estimated_income) * 100).toFixed(1)
      : null;

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
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => handleNavClick("/proposals", e, (href) => router.push(href))}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> 返回提案列表
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
          您沒有權限查看此提案。只有被分配到此提案的團隊成員才能查看詳情。
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => handleNavClick("/proposals", e, (href) => router.push(href))}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> 返回提案列表
        </Button>
      </div>
    );
  }

  // Tab ID → permission sub-module mapping for pitching detail
  const tabPermissionModule: Record<string, string> = {
    "overview": "proposals.overview",
    "l1-budget": "proposals.l1-budget",
    "site": "proposals.site",
    "tender": "proposals.tender",
    "quotation": "proposals.quotation",
    "tag": "proposals.tag",
    "internal-comment": "proposals.internal-comment",
    "building-comment": "proposals.building-comment",
    "customer-docs": "proposals.overview",
    "3d": "proposals.3d",
    "manhour": "proposals.manhour",
  };

  // Helper: check if tab is viewable (falls back to true if permissions still loading)
  const canViewTab = (tabId: string) => {
    if (permLoading) return true; // Show all tabs while permissions load
    const mod = tabPermissionModule[tabId];
    if (!mod) return true;
    return canView(mod);
  };

  // Hide "Site Status" tab for Mini 項目規模 pitchings.
  const isMiniProject = isBwaMiniProjectSize(data.os_money_size, data.estimated_income);
  const tabs = [
    { id: "overview", label: "Overview", icon: ClipboardList },
    { id: "l1-budget", label: "L1 Budget", icon: BarChart3 },
    ...(isMiniProject ? [] : [{ id: "site", label: "Site Status", icon: HardHat }]),
    { id: "tender", label: "RFQ", icon: Gavel },
    { id: "quotation", label: "Quote", icon: FileText },
    { id: "tag", label: "Tag", icon: Tag },
    { id: "internal-comment", label: "Internal Comment", icon: MessageSquare },
    { id: "building-comment", label: "Building Comment", icon: Building2 },
    { id: "customer-docs", label: "客戶文件", icon: FolderOpen },
    { id: "3d", label: "3D Render", icon: Box },
    { id: "manhour", label: "Man Hour", icon: Clock },
  ].filter(tab => canViewTab(tab.id));

  return (
    <div className="space-y-0 w-full">
      {/* ─── BREADCRUMB ──────────────────────────────── */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
        <button
          onClick={(e) => handleNavClick("/proposals", e, (href) => router.push(href))}
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
        {/* Top accent bar — matches /proposals BWA badge cyan */}
        <div className="h-1 bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-300" />

        <div className="p-6">
          <div className="flex items-start justify-between">
            {/* Left: Back + Info */}
            <div className="flex items-start gap-4">
              <button
                onClick={(e) => handleNavClick("/proposals", e, (href) => router.push(href))}
                className="mt-1 w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-gray-500" />
              </button>

              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                    {data.real_customer_display_name || "未命名提案"}
                  </h1>
                  <Badge className="bg-cyan-500 text-white hover:bg-cyan-500 text-[12px] px-2 py-0 font-bold rounded-md">
                    BWA
                  </Badge>
                  {stageBadge(data.pitching_stages)}
                  {isMiniProject && (
                    <Badge className="bg-teal-500/10 text-teal-700 hover:bg-teal-500/10 text-[12px] px-2 py-0 font-bold rounded-md border border-teal-200">
                      Mini-Project
                    </Badge>
                  )}
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
                        {formatShortDate(data.enquiry_date)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-2">
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
                    <TooltipContent>
                      <p className="text-xs">開啟 Asana</p>
                    </TooltipContent>
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
                    <TooltipContent>
                      <p className="text-xs">工作資料夾</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </TooltipProvider>

              <Separator orientation="vertical" className="h-6 mx-1" />

              {/* ─── STAGE ADVANCE BUTTON ─── */}
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
              {data.pitching_stages === "Confirmed Project" &&
                linkedProjectId && (
                  <Button
                    size="sm"
                    onClick={() =>
                      window.open(`/projects/bwa/${linkedProjectId}`, "_blank", "noopener")
                    }
                    className="h-9 gap-1.5 text-[15px] bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" /> 查看項目
                  </Button>
                )}

              {canEdit("proposals") && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const ruleResult = await checkRule("pitching", "block_edit_when_confirmed", {
                    pitching_stage: data?.pitching_stages || ""
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
                      <ArrowRightLeft className="w-3.5 h-3.5" /> Recover
                      Pitching
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      className="gap-2 text-[15px] text-red-600 focus:text-red-600"
                      onClick={() => setShowCaseClosedDialog(true)}
                    >
                      <Ban className="w-3.5 h-3.5" /> Case Closed
                    </DropdownMenuItem>
                  )}
                  {isSuperAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 text-[15px] text-red-600 focus:text-red-600 font-semibold"
                        onClick={() => setShowCascadeDeleteDialog(true)}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> 刪除提案 Delete
                      </DropdownMenuItem>
                    </>
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
                  className={`
                    relative flex items-center gap-1.5 px-4 py-3 text-[15px] font-medium transition-colors whitespace-nowrap
                    ${
                      isActive
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
      </div>
      {/* ─── TAB CONTENT ───────────────────────────────── */}
      <div className="animate-fade-in-up pt-6">
        {/* Permission guard: if current tab is denied, show message */}
        {!canViewTab(activeTab) ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
              <Ban className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-sm text-gray-500 font-medium">您沒有查看此分頁的權限</p>
            <p className="text-xs text-gray-400">如需存取權限，請聯繫管理員</p>
          </div>
        ) : (
        <>
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Site photos */}
            <SitePhotosGallery
              rawPhotos={data.site_photos}
              pitchingId={pitchingId}
              editable={canEdit("proposals.overview")}
              onSaved={() => loadData()}
            />

            {/* Financial Summary Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="預計營收"
                value={formatMoney(data.estimated_income)}
                icon={TrendingUp}
                accentColor="bg-blue-500"
              />
              <MetricCard
                label="預計成本"
                value={formatMoney(data.estimated_expense)}
                icon={DollarSign}
                accentColor="bg-red-500"
              />
              <MetricCard
                label="預計毛利"
                value={formatMoney(estimatedMargin)}
                subtext={marginPercent ? `${marginPercent}%` : undefined}
                trend={
                  estimatedMargin != null
                    ? estimatedMargin >= 0
                      ? "up"
                      : "down"
                    : null
                }
                icon={BarChart3}
                accentColor="bg-emerald-500"
              />
              <MetricCard
                label="實用面積"
                value={data.actual_size ? `${data.actual_size} sqft` : "-"}
                subtext={
                  data.size
                    ? `建築面積 GFA: ${data.size} sqft`
                    : undefined
                }
                icon={Building2}
                accentColor="bg-violet-500"
              />
            </div>

            {/* 提案描述 Description — quick edit */}
            <SectionCard
              title="提案描述 Description"
              icon={FileText}
              iconColor="text-blue-500"
            >
              {editingDescription ? (
                <div className="space-y-3">
                  <Textarea
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    placeholder="請輸入提案描述..."
                    className="min-h-[120px] text-[14px]"
                    autoFocus
                    disabled={savingDescription}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveDescription}
                      disabled={savingDescription}
                      className="gap-1.5"
                    >
                      {savingDescription ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      儲存
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingDescription(false)}
                      disabled={savingDescription}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="group relative">
                  <p className="text-[14px] text-gray-700 whitespace-pre-wrap min-h-[1.5rem]">
                    {data.description || (
                      <span className="text-gray-400 italic">尚未填寫提案描述</span>
                    )}
                  </p>
                  {canEdit("proposals") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={startEditDescription}
                      className="gap-1.5 mt-3"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {data.description ? "編輯描述" : "新增描述"}
                    </Button>
                  )}
                </div>
              )}
            </SectionCard>

            {/* Info Grid - Row 1: 3 columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Basic Info */}
              <SectionCard
                title="基本資訊"
                icon={FileText}
                iconColor="text-blue-500"
              >
                <DetailRow
                  label="提案編號"
                  value={data.pitching_code}
                  icon={Tag}
                  iconColor="text-blue-500"
                />
                <DetailRow
                  label="項目規模"
                  value={data.os_money_size || "N/A"}
                  icon={Briefcase}
                />
                <DetailRow
                  label="查詢日期"
                  value={formatDate(data.enquiry_date)}
                  icon={Calendar}
                />
                <DetailRow
                  label="服務類型"
                  value={data.service_type_name}
                  icon={Tag}
                />
                {data.project_types_name && (
                  <DetailRow
                    label="項目類型"
                    value={data.project_types_name}
                    icon={Tag}
                  />
                )}
                <DetailRow
                  label="財政年度"
                  value={data.financial_year_name}
                  icon={Calendar}
                />
                <DetailRow
                  label="團隊類型"
                  value={data.team_type_name}
                  icon={Users}
                />
                {data.closed_reason && (
                  <DetailRow
                    label="結案原因"
                    value={data.closed_reason}
                    icon={AlertTriangle}
                    iconColor="text-red-500"
                  />
                )}
              </SectionCard>

              {/* Customer Info Card */}
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
                          data.customer_company ||
                          "未命名客戶"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {data.customer_id && canEdit("pitching.overview") && (
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
                        onClick={(e) =>
                          handleNavClick(`/clients/${data.customer_id}`, e, (href) => router.push(href))
                        }
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <Separator className="my-1" />
                <DetailRow
                  label="客戶名稱"
                  value={data.customer_raw_name}
                  icon={User}
                />
                <DetailRow
                  label="公司名稱"
                  value={data.customer_raw_company}
                  icon={Building2}
                />
                {data.customer_email && (
                  <DetailRow
                    label="電郵"
                    value={data.customer_email}
                    icon={Mail}
                  />
                )}
                {data.customer_phone && (
                  <DetailRow
                    label="電話"
                    value={data.customer_phone}
                    icon={Phone}
                  />
                )}
                {data.customer_address && (
                  <DetailRow
                    label="地址"
                    value={data.customer_address}
                    icon={MapPin}
                  />
                )}
                {!data.customer_name && !data.customer_company && (
                  <p className="text-[15px] text-gray-400 py-3 text-center">
                    暫無客戶資料
                  </p>
                )}
                {/* ─── Customer Tags Display ─── */}
                {data.customer_id && (() => {
                  const INDUSTRY_COLLECTION_UUID = "4f5de598-2dcb-45a6-a106-9d933e9a8007";
                  const TAG_COLLECTION_COLORS: Record<string, { bg: string; text: string }> = {
                    "3ec5145d-19dd-45d0-b0cf-8ffed5114e81": { bg: "bg-blue-50", text: "text-blue-700" },
                    "4f5de598-2dcb-45a6-a106-9d933e9a8007": { bg: "bg-amber-50", text: "text-amber-700" },
                    "eb5a7764-9ebf-4829-9991-db09538aab76": { bg: "bg-violet-50", text: "text-violet-700" },
                  };
                  const DEFAULT_TAG_COLOR = { bg: "bg-gray-50", text: "text-gray-700" };

                  // Build a lookup: tagId -> { display, collectionId }
                  const tagLookup = new Map<string, { display: string; collectionId: string }>();
                  detailCollections.forEach((col) => {
                    col.tags.forEach((t) => {
                      tagLookup.set(t.id, { display: t.display, collectionId: col.id });
                    });
                  });

                  // Industry tags
                  const industryTags = detailCustomerTags
                    .filter((ct) => ct.collection_uuid === INDUSTRY_COLLECTION_UUID)
                    .map((ct) => tagLookup.get(ct.tag_uuid))
                    .filter(Boolean) as { display: string; collectionId: string }[];

                  // Other tags (non-industry)
                  const otherTags = detailCustomerTags
                    .filter((ct) => ct.collection_uuid !== INDUSTRY_COLLECTION_UUID)
                    .map((ct) => {
                      const info = tagLookup.get(ct.tag_uuid);
                      return info ? { display: info.display, collectionId: info.collectionId } : null;
                    })
                    .filter(Boolean) as { display: string; collectionId: string }[];

                  return (
                    <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
                      {/* Industry Tag - always shown */}
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-gray-500 whitespace-nowrap">行業:</span>
                        {industryTags.length > 0 ? (
                          industryTags.map((t, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className={`text-[13px] px-2 py-0.5 font-medium ${TAG_COLLECTION_COLORS[INDUSTRY_COLLECTION_UUID]?.bg || DEFAULT_TAG_COLOR.bg} ${TAG_COLLECTION_COLORS[INDUSTRY_COLLECTION_UUID]?.text || DEFAULT_TAG_COLOR.text} border-0`}
                            >
                              {t.display}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-[13px] text-gray-400">N/A</span>
                        )}
                      </div>
                      {/* Other Tags */}
                      {otherTags.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[13px] text-gray-500 whitespace-nowrap">標籤:</span>
                          {otherTags.map((t, i) => {
                            const colors = TAG_COLLECTION_COLORS[t.collectionId] || DEFAULT_TAG_COLOR;
                            return (
                              <Badge
                                key={i}
                                variant="secondary"
                                className={`text-[13px] px-2 py-0.5 font-medium ${colors.bg} ${colors.text} border-0`}
                              >
                                {t.display}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {data.customer_id && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <button
                      className="text-[14px] text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                      onClick={(e) =>
                        handleNavClick(`/clients/${data.customer_id}`, e, (href) => router.push(href))
                      }
                    >
                      查看客戶詳情 <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </SectionCard>

              {/* ─── 團隊 (Pitching BV) Section ─────────────────────────── */}
              <SectionCard
                title="團隊"
                icon={Users}
                iconColor="text-violet-500"
              >
                <TooltipProvider delayDuration={200}>
                {bvLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Main PM Row — cannot delete, can edit handler */}
                    {(() => {
                      const pmBV = pitchingBVList.find(
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
                      const designerBV = pitchingBVList.find(
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
                      const otherBVs = pitchingBVList.filter(
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

                    {pitchingBVList.length === 0 && !bvLoading && (
                      <p className="text-[14px] text-gray-400 text-center py-4">
                        暫無 Pitching BV 記錄
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

            {/* Info Grid - Row 2: 2 columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Location Info */}
              <SectionCard
                title="地點資訊"
                icon={MapPin}
                iconColor="text-emerald-500"
              >
                <DetailRow
                  label="地區"
                  value={data.district_name}
                  icon={MapPin}
                  iconColor="text-emerald-500"
                />
                <DetailRow
                  label="大廈"
                  value={data.building_name}
                  icon={Building2}
                />
                <DetailRow
                  label="工地地址"
                  value={data.site_address}
                  icon={MapPin}
                />
                <DetailRow
                  label="實用面積 SA"
                  value={data.actual_size ? `${data.actual_size} sqft` : null}
                  icon={FolderOpen}
                  mono
                />
                {data.size && (
                  <DetailRow
                    label="建築面積 GFA"
                    value={`${data.size} sqft`}
                    icon={FolderOpen}
                    mono
                  />
                )}
                {data.height_to_bs && (
                  <DetailRow
                    label="樓高至 BS"
                    value={data.height_to_bs}
                    icon={Building2}
                    mono
                  />
                )}
                {data.height_to_fc && (
                  <DetailRow
                    label="樓高至 FC"
                    value={data.height_to_fc}
                    icon={Building2}
                    mono
                  />
                )}
                {data.height_to_tc && (
                  <DetailRow
                    label="樓高至 TC"
                    value={data.height_to_tc}
                    icon={Building2}
                    mono
                  />
                )}
              </SectionCard>

              {/* Links & Meta */}
              <SectionCard
                title="連結 & 其他"
                icon={Link2}
                iconColor="text-amber-500"
              >
                <DetailRow
                  label="Asana 連結"
                  value={data.asana_link ? "開啟 Asana" : null}
                  icon={({ className }: { className?: string }) => (
                    <AsanaIcon size={14} className={className || ""} />
                  )}
                  isLink={!!data.asana_link}
                  href={data.asana_link || undefined}
                />
                <DetailRow
                  label="工作資料夾"
                  value={data.working_folder ? "開啟資料夾" : null}
                  icon={FolderOpen}
                  isLink={!!data.working_folder}
                  href={data.working_folder || undefined}
                />
                <Separator className="my-1" />
                <DetailRow
                  label="建立日期"
                  value={formatDate(data.created_date)}
                  icon={Calendar}
                />
                <DetailRow
                  label="最後修改"
                  value={formatDate(data.modified_date)}
                  icon={Calendar}
                />
                <DetailRow
                  label="建立者"
                  value={data.real_creator_member_name}
                  icon={User}
                />
              </SectionCard>
            </div>
          </div>
        )}
        {/* L1 BUDGET TAB */}
        {activeTab === "l1-budget" && (
          <L1BudgetTab
            pitchingId={pitchingId}
            estimatedIncome={data.estimated_income}
            estimatedExpense={data.estimated_expense}
            onDataChanged={() => {
              // Refresh the parent detail data
              fetchBWAPitchingDetail(pitchingId).then((updated) => {
                if (updated) setData(updated);
              });
            }}
          />
        )}
        {/* SITE STATUS TAB */}
        {activeTab === "site" && (
          <div className="space-y-6">
            <SectionCard
              title="工地狀況 Site Status"
              icon={HardHat}
              iconColor="text-orange-500"
            >
              <p className="text-xs text-gray-400 mb-4">
                管理提案工地現場狀況，包括冷氣、地板、間隔等。
              </p>
              <SiteStatusPanel projectId={pitchingId} entityType="pitching" permissionModule="proposals.site" />
            </SectionCard>
          </div>
        )}

        {/* TENDER TAB */}
        {activeTab === "tender" && <EmptyTab title="投標管理" icon={Gavel} />}

        {/* QUOTE TAB */}
        {activeTab === "quotation" && data && (
          <QuotationListPanel
            pitchingId={pitchingId}
            pitchingCode={data.pitching_code}
            customerName={data.customer_name || data.customer_display_name || null}
            customerCompany={data.customer_company || data.real_customer_co_name || null}
            customerEmail={data.customer_email || null}
            customerPhone={data.customer_phone || null}
            customerAddress={data.customer_address || null}
            siteAddress={data.site_address}
            size={data.size}
            pmName={data.pm_name || null}
            projectTypeName={data.project_types_name || null}
            customerId={data.customer_id}
          />
        )}

        {/* TAG TAB */}
        {activeTab === "tag" && (
          <div className="space-y-6">
            {data.customer_id ? (
              <div className="w-full">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-violet-500" />
                    客戶標籤管理
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    管理此提案關聯客戶「
                    {data.customer_name ||
                      data.customer_company ||
                      "未命名客戶"}
                    」的標籤分類。
                  </p>
                </div>
                <CustomerTagsPanel customerId={data.customer_id} permissionModule="pitching.tag" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                  <Tag className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-400 mb-1">
                  無法管理標籤
                </p>
                <p className="text-xs text-gray-300">
                  此提案尚未關聯客戶，請先設定客戶資料
                </p>
              </div>
            )}
          </div>
        )}

        {/* INTERNAL COMMENT TAB */}
        {activeTab === "internal-comment" && (
          <InternalCommentPanel pitchingId={pitchingId} permissionModule="proposals.internal-comment" />
        )}

        {/* BUILDING COMMENT TAB — BMO Building */}
        {activeTab === "building-comment" && (
          <BuildingCommentPanel
            buildingId={data.r_building_id}
            buildingName={data.building_name}
            context={{ type: "pitching", id: pitchingId }}
            permissionModule="proposals.building-comment"
          />
        )}

        {/* CUSTOMER DOCUMENTS TAB */}
        {activeTab === "customer-docs" && (
          <CustomerDocumentsPanel
            customerId={data.customer_id}
            permissionModule="proposals.overview"
            emptyWithoutCustomerMessage="此提案尚未連結客戶，無法管理客戶文件。"
          />
        )}

        {/* 3D RENDER TAB */}
        {activeTab === "3d" && <ThreeDRenderPanel pitchingId={pitchingId} permissionModule="proposals.3d" />}

        {/* MAN HOUR TAB */}
        {activeTab === "manhour" && (
          <ManHourPanel
            projectId={pitchingId}
            mode="pitching"
            permissionModule="proposals.manhour"
          />
        )}
        </>
        )}
      </div>
      {/* ─── EDIT DIALOG ────────────────────────────────── */}
      <BWAPitchingDialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        onSaved={loadData}
        editData={data}
      />
      {/* ─── CUSTOMER EDIT DIALOG ───────────────────────── */}
      <Dialog open={showCustomerEdit} onOpenChange={setShowCustomerEdit}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Building2 className="w-5 h-5" /> 編輯客戶資料
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                客戶名稱
              </label>
              <Input
                value={customerForm.customer_name}
                onChange={(e) =>
                  setCustomerForm({
                    ...customerForm,
                    customer_name: e.target.value,
                  })
                }
                placeholder="客戶名稱"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                顯示名稱
              </label>
              <Input
                value={customerForm.display_name}
                onChange={(e) =>
                  setCustomerForm({
                    ...customerForm,
                    display_name: e.target.value,
                  })
                }
                placeholder="顯示名稱"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                公司名稱
              </label>
              <Input
                value={customerForm.company_name}
                onChange={(e) =>
                  setCustomerForm({
                    ...customerForm,
                    company_name: e.target.value,
                  })
                }
                placeholder="公司名稱"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">電郵</label>
              <Input
                value={customerForm.email}
                onChange={(e) =>
                  setCustomerForm({ ...customerForm, email: e.target.value })
                }
                placeholder="email@example.com"
                type="email"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">電話</label>
              <Input
                value={customerForm.phone_display}
                onChange={(e) =>
                  setCustomerForm({
                    ...customerForm,
                    phone_display: e.target.value,
                  })
                }
                placeholder="電話號碼"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">地址</label>
              <Input
                value={customerForm.address}
                onChange={(e) =>
                  setCustomerForm({ ...customerForm, address: e.target.value })
                }
                placeholder="地址"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCustomerEdit(false)}
              disabled={customerSaving}
            >
              <X className="w-4 h-4 mr-1" /> 取消
            </Button>
            <Button
              onClick={handleCustomerSave}
              disabled={customerSaving}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {customerSaving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ─── DELETE CONFIRMATION ─────────────────────────── */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> 確認刪除
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            確定要刪除提案 <strong>{data.pitching_code}</strong>{" "}
            嗎？此操作無法復原。
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-1" />
              )}
              刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ─── CASCADE DELETE DIALOG (Super Admin Only — Danger Confirm) ────── */}
      {showCascadeDeleteDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-red-600 px-6 py-4 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="text-white font-bold text-lg">危險操作確認 — 級聯刪除提案</h3>
                  <p className="text-red-100 text-sm">Cascade Delete Pitching — {data?.pitching_code}</p>
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
                  <p className="text-xs text-gray-400 text-center">正在跳轉到提案列表...</p>
                </div>
              ) : cascadeError ? (
                /* ─── ERROR STATE ──────────────────── */
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 w-full">
                    <p className="text-red-800 text-sm font-bold mb-2">❌ 分析失敗 Analysis Failed</p>
                    <p className="text-red-600 text-xs">{cascadeError}</p>
                  </div>
                  <button
                    onClick={() => {
                      setCascadeError(null);
                      setCascadeLoading(true);
                      analyzePitchingCascadeDelete(pitchingId).then(({ data: analysisData, error }) => {
                        if (analysisData) {
                          setCascadeAnalysis(analysisData);
                          const defaults: Record<string, boolean> = {};
                          analysisData.related_groups.forEach((g) => { defaults[g.table] = true; });
                          setCascadeSelections(defaults);
                        } else if (error) {
                          setCascadeError(error);
                        }
                        setCascadeLoading(false);
                      });
                    }}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    🔄 重試 Retry
                  </button>
                </div>
              ) : cascadeStep === "analysis" && cascadeAnalysis ? (
                /* ─── STEP 1: SELECTION ─────────────── */
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-amber-800 text-sm font-medium">⚠️ 以下數據與此提案有關聯。請選擇要一併刪除的項目：</p>
                    <p className="text-amber-700 text-xs mt-1">The following data is related to this pitching. Select items to delete together:</p>
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
                        setCascadeSelections(allOn);
                      }}
                    >
                      全選 Select All
                    </button>
                    <button
                      className="text-blue-600 hover:underline"
                      onClick={() => {
                        setCascadeSelections({});
                        setDeleteProject(false);
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
                        <div key={group.table} className="rounded-lg border p-3 bg-gray-50 border-gray-200">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={!!cascadeSelections[group.table]}
                              onCheckedChange={(val) => setCascadeSelections((prev) => ({ ...prev, [group.table]: !!val }))}
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
                          </div>
                          {group.records.length > 0 && (
                            <div className="mt-2 ml-8 space-y-1 max-h-24 overflow-y-auto">
                              {group.records.slice(0, 5).map((r, i) => (
                                <div key={i} className="text-[13px] text-gray-500 truncate">
                                  • {r.display || r.id}
                                </div>
                              ))}
                              {group.records.length > 5 && (
                                <div className="text-[13px] text-gray-400 italic">...及其他 {group.records.length - 5} 條</div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Project Chain */}
                  {cascadeAnalysis.project_chain && (
                    <div className="space-y-2 border-t pt-4">
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        項目鏈 Project Chain (二級關聯)
                      </h4>
                      <div className="ml-2 border-l-2 border-blue-200 pl-3">
                        <div className={`flex items-center gap-3 p-2 rounded-lg border ${deleteProject ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-100"}`}>
                          <Checkbox
                            checked={deleteProject}
                            onCheckedChange={(val) => setDeleteProject(!!val)}
                            className="border-gray-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                          />
                          <span className="text-lg">📁</span>
                          <div className="flex-1">
                            <span className={`text-sm font-medium ${deleteProject ? "text-red-800" : "text-blue-800"}`}>
                              {cascadeAnalysis.project_chain.label}
                            </span>
                            <p className={`text-[13px] ${deleteProject ? "text-red-600" : "text-blue-600"}`}>
                              {cascadeAnalysis.project_chain.records.map((r) => r.display).join(", ")}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${deleteProject ? "bg-red-200 text-red-800" : "bg-blue-200 text-blue-800"}`}>
                            {deleteProject ? "DELETE" : "UNLINK"}
                          </span>
                        </div>

                        {!deleteProject && (
                          <p className="mt-2 text-[13px] text-blue-600 italic">
                            ℹ️ 項目將被解除關聯但不會被刪除。Projects will be unlinked but NOT deleted.
                          </p>
                        )}
                        {deleteProject && (
                          <p className="mt-2 text-[13px] text-red-600 font-semibold">
                            ⚠️ 項目及其所有關聯數據將被刪除！Projects and all related data will be PERMANENTLY deleted!
                          </p>
                        )}

                        {cascadeAnalysis.project_chain.children && cascadeAnalysis.project_chain.children.length > 0 && (
                          <div className="mt-2 ml-4 space-y-2">
                            {cascadeAnalysis.project_chain.children.map((child) => (
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
                                    <p className="text-[13px] text-gray-500 mt-0.5">{child.records[0]?.display}</p>
                                  )}
                                </div>
                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-mono whitespace-nowrap">
                                  {child.fk_action}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Customer Chain */}
                  {cascadeAnalysis.customer_chain && (() => {
                    const hasOtherRefs = cascadeAnalysis.customer_chain.children?.some(
                      (c) => c.table === "customer_other_pitchings" || c.table === "customer_projects"
                    );
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
                            disabled={!!hasOtherRefs}
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

                        {hasOtherRefs && (
                          <p className="mt-2 text-[13px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                            ⚠️ 此客戶尚有其他提案或項目關聯，無法刪除。This customer has other linked pitchings/projects and cannot be deleted.
                          </p>
                        )}

                        {!deleteCustomer && !hasOtherRefs && (
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

                  {cascadeAnalysis.related_groups.length === 0 && !cascadeAnalysis.project_chain && !cascadeAnalysis.customer_chain && (
                    <div className="text-center py-6">
                      <p className="text-gray-500 text-sm">✅ 此提案沒有關聯數據</p>
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
                      You are about to permanently delete pitching: <strong className="text-red-900">{data?.pitching_code}</strong>
                    </p>
                    <div className="mt-2 text-xs text-red-600">
                      <p>將刪除 Will delete:</p>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>此提案本身 The pitching itself</li>
                        {Object.entries(cascadeSelections).filter(([, v]) => v).map(([key]) => {
                          const group = cascadeAnalysis?.related_groups.find((g) => g.table === key);
                          return group ? <li key={key}>{group.label} ({group.count})</li> : null;
                        })}
                        {deleteProject && <li>關聯項目 Linked Projects (and all their data)</li>}
                        {deleteCustomer && <li>關聯客戶 Linked Customer</li>}
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
                      ref={cascadeDeleteInputRef}
                      type="text"
                      value={cascadeDeleteConfirmText}
                      onChange={(e) => setCascadeDeleteConfirmText(e.target.value)}
                      onPaste={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                      onContextMenu={(e) => e.preventDefault()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && cascadeDeleteConfirmText === "Confirm Delete") handleCascadeDelete();
                        if (e.key === "Escape") {
                          setShowCascadeDeleteDialog(false);
                        }
                      }}
                      placeholder="Type the sentence above exactly..."
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      className={`w-full border-2 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none transition ${
                        cascadeDeleteConfirmText.length === 0
                          ? "border-gray-200 focus:border-blue-400"
                          : cascadeDeleteConfirmText === "Confirm Delete"
                          ? "border-emerald-400 bg-emerald-50 focus:border-emerald-500"
                          : "border-red-300 focus:border-red-400"
                      }`}
                    />
                    {cascadeDeleteAttempts > 0 && cascadeDeleteConfirmText !== "Confirm Delete" && (
                      <p className="text-red-500 text-xs">❌ 輸入不正確，請重新輸入。</p>
                    )}
                    {cascadeDeleteConfirmText.length > 0 && cascadeDeleteConfirmText !== "Confirm Delete" && (
                      <div className="text-xs text-gray-400">
                        {cascadeDeleteConfirmText.length}/{"Confirm Delete".length} characters
                      </div>
                    )}
                    {cascadeDeleteConfirmText === "Confirm Delete" && (
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
                      setCascadeDeleteConfirmText("");
                      setCascadeDeleteAttempts(0);
                    } else {
                      setShowCascadeDeleteDialog(false);
                    }
                  }}
                  disabled={cascadeExecuting}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-100 transition disabled:opacity-50"
                >
                  {cascadeStep === "confirm" ? "← 返回選擇 Back" : "取消 Cancel"}
                </button>

                <div className="flex items-center gap-2">
                  {cascadeStep === "analysis" && !cascadeLoading && cascadeAnalysis && (
                    <button
                      onClick={() => {
                        setCascadeStep("confirm");
                        setTimeout(() => cascadeDeleteInputRef.current?.focus(), 100);
                      }}
                      className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
                    >
                      下一步：確認刪除 →
                    </button>
                  )}
                  {cascadeStep === "confirm" && (
                    <button
                      onClick={() => {
                        if (cascadeDeleteConfirmText === "Confirm Delete") {
                          handleCascadeDelete();
                        } else {
                          setCascadeDeleteAttempts((a) => a + 1);
                        }
                      }}
                      disabled={cascadeDeleteConfirmText !== "Confirm Delete" || cascadeExecuting}
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
      {/* ─── CASE CLOSED CONFIRMATION ─────────────────────────── */}
      <Dialog
        open={showCaseClosedDialog}
        onOpenChange={setShowCaseClosedDialog}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="w-5 h-5" /> 確認結案
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            確定要將提案 <strong>{data.pitching_code}</strong> 設為「Case
            Closed」嗎？
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCaseClosedDialog(false)}
              disabled={closingCase}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleCaseClosed}
              disabled={closingCase}
            >
              {closingCase ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Ban className="w-4 h-4 mr-1" />
              )}
              確認結案
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ─── RECOVER PITCHING CONFIRMATION ─────────────────────────── */}
      <Dialog open={showRecoverDialog} onOpenChange={setShowRecoverDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <ArrowRightLeft className="w-5 h-5" /> 恢復提案
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            確定要將提案 <strong>{data.pitching_code}</strong> 從「Case
            Closed」恢復為「Enquiry」嗎？
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRecoverDialog(false)}
              disabled={recoveringCase}
            >
              取消
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleRecoverPitching}
              disabled={recoveringCase}
            >
              {recoveringCase ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <ArrowRightLeft className="w-4 h-4 mr-1" />
              )}
              確認恢復
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ─── STAGE ADVANCE DIALOG (Enquiry → Pitching FULL FORM) ─── */}
      <ConvertToPitchingDialog
        open={showStageDialog}
        onOpenChange={setShowStageDialog}
        data={data}
        pitchingId={pitchingId}
        advancingStage={advancingStage}
        onConfirm={handleAdvanceStage}
      />
      {/* ─── BV ADD/EDIT DIALOG ─────────────────────────────── */}
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
              <Label className="text-xs text-gray-500 mb-1.5 block">
                負責人 (Handler)
              </Label>
              <Select value={bvFormHandlerId} onValueChange={setBvFormHandlerId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="選擇負責人..." />
                </SelectTrigger>
                <SelectContent>
                  {staffOptions
                    .filter((s) => {
                      // Exclude handlers already assigned to this pitching (prevent duplicates)
                      // But allow the currently edited handler to remain selectable
                      const existingHandlerIds = pitchingBVList
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
