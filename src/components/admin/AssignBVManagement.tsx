"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Edit2,
  Save,
  BarChart3,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Settings2,
  Plus,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ProjectStatusBadge } from "@/components/ui/entity-status-badges";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { usePermission } from "@/hooks/use-permission";
import { useAuth } from "@/hooks/use-auth";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import {
  resolveVisibleBwaProjectIds,
  type ProjectStaffContext,
} from "@/lib/data/bwa-projects";
import { resolveVisibleBwfProjectIds } from "@/lib/data/bwf-projects";
import {
  fetchProjectFinancials,
  fetchBWFProjectFinancials,
} from "@/lib/data/finance";
import { getProjectManHourSummary } from "@/lib/man-hour-service";
import { formatDate, parseDate } from "@/lib/date-utils";
import { projectStatusDisplayLabel } from "@/lib/project-status-rules";
import { notifyProjectBvCreated } from "@/lib/project-bv-notify";
import { Loader2 } from "lucide-react";

export type AssignBvBuMode = "bwa" | "bwf";

/** Task row shown when a staff card is expanded in the bulk BV dialog */
interface BulkStaffTask {
  id: string;
  task_name: string | null;
  task_description: string | null;
  task_type: string | null;
  work_hour: number;
  report_date: string | null;
  created_at: string;
}

/** Legacy Bubble IDs — never show in UI (see no-bubble-strings rule). */
function isBubbleId(value: string | null | undefined): boolean {
  return !!value && /^\d{10,}x\d+$/.test(value);
}

/** Fixed company BV handler (Acme) — not a real staff member. */
const COMPANY_BV_HANDLER_ID = "00000000-0000-4000-8000-000000000001";
const COMPANY_BV_DESCRIPTION = "(廣告、人手、平台、行政、稅務)";

/** PostgREST `.in()` URL size — each project usually has <10 BV rows, so chunks stay well under the API row cap. */
const PROJECT_ID_CHUNK = 100;

// ─── TYPES ───────────────────────────────────────────────────

interface ProjectBVRow {
  id: string;
  actual_bv: number | null;
  actual_gp: number | null;
  estimated_bv: number | null;
  estimated_gp: number | null;
  handler_id: string | null;
  handler: string | null;
  n_financial_year_id: string | null;
  n_team_type_id: string | null;
  project: string | null;
  project_id: string | null;
  bwf_project_id: string | null;
  ratio: number | null;
  shared_actual_gp: number | null;
  shared_estimated_gp: number | null;
  total_sales: number | null;
  handover_date: string | null;
  signed_date: string | null;
}

function linkedProjectId(row: ProjectBVRow, mode: AssignBvBuMode): string | null {
  return mode === "bwf" ? row.bwf_project_id : row.project_id;
}

/** Project-level amount × this row's ratio. `estimated_gp` / `total_sales` are copied onto every BV row. */
function shareByRatio(amount: number | null | undefined, ratio: number | null | undefined): number {
  return (Number(amount) || 0) * (Number(ratio) || 0) / 100;
}

function memberSharedEstGp(row: ProjectBVRow): number {
  if (row.shared_estimated_gp != null) return Number(row.shared_estimated_gp) || 0;
  return shareByRatio(row.estimated_gp, row.ratio);
}

/** Acme first, then stable by id — used by bulk dialog / group rows. */
function sortBvRowsCompanyFirst(rows: ProjectBVRow[]): ProjectBVRow[] {
  return [...rows].sort((a, b) => {
    const aCo = a.handler_id === COMPANY_BV_HANDLER_ID ? 0 : 1;
    const bCo = b.handler_id === COMPANY_BV_HANDLER_ID ? 0 : 1;
    if (aCo !== bCo) return aCo - bCo;
    return (a.id || "").localeCompare(b.id || "");
  });
}

type SuggestPool = "company" | "pm" | "design";

/** Classify by staff.position (not project_bv.n_team_type) for suggestion pools. */
function classifySuggestPool(
  handlerId: string | null,
  position: string | null | undefined
): SuggestPool {
  if (handlerId === COMPANY_BV_HANDLER_ID) return "company";
  const p = (position || "").toLowerCase();
  if (p.includes("design")) return "design";
  return "pm";
}

/**
 * Round values to 1 decimal so they sum exactly to `target` (largest-remainder).
 */
function roundToTotal(values: number[], target: number): number[] {
  if (values.length === 0) return [];
  const scaled = values.map((v) => v * 10);
  const floors = scaled.map((v) => Math.floor(v + 1e-9));
  let leftover = Math.round(target * 10) - floors.reduce((a, b) => a + b, 0);
  const order = scaled
    .map((v, i) => ({ i, frac: v - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  const out = floors.slice();
  for (let k = 0; k < order.length && leftover > 0; k++) {
    out[order[k].i] += 1;
    leftover -= 1;
  }
  // If over-allocated due to float, trim from largest
  while (leftover < 0) {
    let maxI = 0;
    for (let i = 1; i < out.length; i++) {
      if (out[i] > out[maxI]) maxI = i;
    }
    if (out[maxI] <= 0) break;
    out[maxI] -= 1;
    leftover += 1;
  }
  return out.map((v) => v / 10);
}

interface BulkSuggestBreakdown {
  pool: SuggestPool;
  hours: number;
  /** Sum of hours in this role pool; null for company (fixed share). */
  roleHours: number | null;
  /** Pool share used in 工時 ÷ 總工時 × 份額; null if not applicable. */
  share: number | null;
}

interface BulkSuggestResult {
  suggested: Record<string, number>;
  breakdown: Record<string, BulkSuggestBreakdown>;
  /** Column sub-header: both roles, or the only detected role. */
  roleSubLabel: string;
}

function suggestRoleSubLabel(hasPm: boolean, hasDesign: boolean): string {
  if (hasPm && hasDesign) return "PM/Designer";
  if (hasPm) return "PM";
  if (hasDesign) return "Designer";
  return "—";
}

/**
 * Suggest BV% from man-hour reports:
 * - Acme fixed 30% when present
 * - Both PM + Design on list → 35% / 35%
 * - No Design → PM 70%; no PM → Design 70%
 * - Within a pool, split by hours (0h → 0%)
 */
function computeBulkRatioSuggestions(
  rows: ProjectBVRow[],
  staffById: Record<string, StaffMember>,
  hoursByStaff: Record<string, number>
): BulkSuggestResult {
  const suggested: Record<string, number> = {};
  const breakdown: Record<string, BulkSuggestBreakdown> = {};
  const empty: BulkSuggestResult = {
    suggested,
    breakdown,
    roleSubLabel: "PM/Designer",
  };
  if (rows.length === 0) return empty;

  const companyRows: ProjectBVRow[] = [];
  const pmRows: ProjectBVRow[] = [];
  const designRows: ProjectBVRow[] = [];

  for (const row of rows) {
    const pos = row.handler_id ? staffById[row.handler_id]?.position : null;
    const pool = classifySuggestPool(row.handler_id, pos);
    if (pool === "company") companyRows.push(row);
    else if (pool === "design") designRows.push(row);
    else pmRows.push(row);
  }

  const hasCompany = companyRows.length > 0;
  const hasPm = pmRows.length > 0;
  const hasDesign = designRows.length > 0;
  const platformPct = hasCompany ? 30 : 0;
  const remaining = 100 - platformPct;

  let pmPool = 0;
  let designPool = 0;
  if (hasPm && hasDesign) {
    pmPool = remaining / 2;
    designPool = remaining / 2;
  } else if (hasPm) {
    pmPool = remaining;
  } else if (hasDesign) {
    designPool = remaining;
  }

  const hoursOf = (row: ProjectBVRow) =>
    row.handler_id ? Number(hoursByStaff[row.handler_id]) || 0 : 0;

  const allocatePool = (
    poolRows: ProjectBVRow[],
    poolPct: number,
    pool: SuggestPool
  ) => {
    const hours = poolRows.map(hoursOf);
    const totalH = hours.reduce((a, b) => a + b, 0);
    if (poolRows.length === 0) return;
    let raw: number[];
    if (poolPct <= 0 || totalH <= 0) {
      raw = poolRows.map(() => 0);
    } else {
      raw = hours.map((h) => (h / totalH) * poolPct);
    }
    const rounded = roundToTotal(raw, poolPct > 0 && totalH > 0 ? poolPct : 0);
    poolRows.forEach((row, i) => {
      suggested[row.id] = rounded[i] ?? 0;
      breakdown[row.id] = {
        pool,
        hours: hours[i] ?? 0,
        roleHours: totalH,
        share: poolPct,
      };
    });
  };

  if (hasCompany) {
    const companyShare = roundToTotal(
      companyRows.map(() => platformPct / companyRows.length),
      platformPct
    );
    companyRows.forEach((row, i) => {
      suggested[row.id] = companyShare[i] ?? 0;
      breakdown[row.id] = {
        pool: "company",
        hours: hoursOf(row),
        roleHours: null,
        share: companyShare[i] ?? platformPct,
      };
    });
  }

  allocatePool(pmRows, pmPool, "pm");
  allocatePool(designRows, designPool, "design");

  // If remaining had nowhere to go (no PM/Design), dump onto first non-company row.
  const assigned = Object.values(suggested).reduce((a, b) => a + b, 0);
  if (Math.abs(assigned - 100) > 0.05 && rows.length > 0) {
    const gap = Math.round((100 - assigned) * 10) / 10;
    const target =
      rows.find((r) => r.handler_id !== COMPANY_BV_HANDLER_ID) || rows[0];
    suggested[target.id] = Math.round(((suggested[target.id] || 0) + gap) * 10) / 10;
  }

  return {
    suggested,
    breakdown,
    roleSubLabel: suggestRoleSubLabel(hasPm, hasDesign),
  };
}

function BulkCalcColHead({
  widthClass,
  title,
  sub,
  titleClassName,
}: {
  widthClass: string;
  title: string;
  sub?: string;
  titleClassName?: string;
}) {
  return (
    <span className={`${widthClass} shrink-0 text-right leading-tight`}>
      <span className={`block ${titleClassName ?? ""}`}>{title}</span>
      {sub ? (
        <span className="block text-[10px] text-gray-300 font-normal normal-case tracking-normal whitespace-nowrap">
          ({sub})
        </span>
      ) : (
        <span className="block text-[10px] invisible select-none">.</span>
      )}
    </span>
  );
}

interface ProjectGroup {
  project_id: string;
  project: BWAProject | null;
  rows: ProjectBVRow[];
  totalSales: number;
  totalEstimatedGP: number;
  totalSharedEstGP: number;
  totalActualGP: number;
  avgRatio: number;
}

interface StaffMember {
  id: string;
  full_name: string | null;
  name: string | null;
  position: string | null;
  n_team_type_id?: string | null;
  status?: string | null;
}

const DRAFT_BV_PREFIX = "draft:";

function isDraftBvRow(row: { id: string }): boolean {
  return row.id.startsWith(DRAFT_BV_PREFIX);
}

function createDraftBvRow(group: ProjectGroup, mode: AssignBvBuMode): ProjectBVRow {
  const template = group.rows.find((r) => !isDraftBvRow(r));
  return {
    id: `${DRAFT_BV_PREFIX}${crypto.randomUUID()}`,
    actual_bv: null,
    actual_gp: null,
    estimated_bv: null,
    estimated_gp: template?.estimated_gp ?? null,
    handler_id: null,
    handler: null,
    n_financial_year_id: template?.n_financial_year_id ?? null,
    n_team_type_id: null,
    project: template?.project ?? null,
    project_id: mode === "bwf" ? null : group.project_id,
    bwf_project_id: mode === "bwf" ? group.project_id : null,
    ratio: null,
    shared_actual_gp: null,
    shared_estimated_gp: null,
    total_sales: template?.total_sales ?? null,
    handover_date: template?.handover_date ?? group.project?.handover_date ?? null,
    signed_date: template?.signed_date ?? group.project?.signed_date ?? null,
  };
}

interface FinancialYear {
  id: string;
  display: string;
}

interface TeamType {
  id: string;
  display: string;
  is_bwf: boolean | null;
}

interface BWAProject {
  id: string;
  bubble_id: string;
  project_code: string | null;
  project_name: string | null;
  signed_date: string | null;
  start_date: string | null;
  handover_date: string | null;
  project_type_ids: string[];
  cost_centre_id: string | null;
  customer_id: string | null;
  main_pm_id: string | null;
  main_designer_id: string | null;
  status: string | null;
  real_customer_name: string | null;
  real_cost_centre: string | null;
}

interface ProjectType {
  id: string;
  display: string | null;
  chin_display: string | null;
}

// ─── HELPERS ─────────────────────────────────────────────────

function formatPercent(val: number | null): string {
  if (val == null) return "—";
  return `${val}%`;
}

/** Prefer YYYY-MM-DD prefix so timestamptz strings parse as calendar days. */
function toLocalDay(v: string | null | undefined): Date | null {
  if (!v) return null;
  const raw = String(v).trim();
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    return new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10));
  }
  const d = parseDate(raw);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

type AssignBvSortField =
  | "signed_date"
  | "handover_date"
  | "project"
  | "work_pct"
  | "payment_pct"
  | "project_type"
  | "bu"
  | "pm_designer"
  | "status"
  | "bv_count"
  | "ratio"
  | "total_sales"
  | "est_gp"
  | "shared_gp";

const DESC_FIRST_SORT_FIELDS = new Set<AssignBvSortField>([
  "signed_date",
  "handover_date",
  "work_pct",
  "payment_pct",
  "bv_count",
  "ratio",
  "total_sales",
  "est_gp",
  "shared_gp",
]);

function formatAssignBvDate(value: string | null | undefined): string {
  const day = toLocalDay(value);
  return day ? day.toLocaleDateString("zh-HK") : "—";
}

function dateSortMs(value: string | null | undefined): number | null {
  const day = toLocalDay(value);
  return day ? day.getTime() : null;
}

/** Nulls last in both directions. */
function cmpNullableNumber(a: number | null, b: number | null, dir: number): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (a === b) return 0;
  return (a - b) * dir;
}

/** Time elapsed from start_date → handover_date as of today (0–100), or null if dates missing. */
function computeWorkPercentage(
  startDate: string | null | undefined,
  handoverDate: string | null | undefined
): number | null {
  const start = toLocalDay(startDate);
  const handover = toLocalDay(handoverDate);
  if (!start || !handover) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const span = handover.getTime() - start.getTime();
  if (span <= 0) {
    return today.getTime() >= handover.getTime() ? 100 : 0;
  }

  const pct = ((today.getTime() - start.getTime()) / span) * 100;
  return Math.round(Math.max(0, Math.min(100, pct)));
}

interface ProjectProgressMeta {
  start_date: string | null;
  handover_date: string | null;
  total_sales: number;
  paid_sales: number;
}

function computePaymentPercentage(
  totalIncome: number | null | undefined,
  paidAmount: number | null | undefined
): number | null {
  const total = Number(totalIncome) || 0;
  if (total <= 0) return null;
  const paid = Number(paidAmount) || 0;
  return Math.round(Math.max(0, Math.min(100, (paid / total) * 100)));
}

function progressBarColor(pct: number): string {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 75) return "bg-blue-500";
  if (pct >= 50) return "bg-amber-500";
  if (pct > 0) return "bg-orange-400";
  return "bg-gray-200";
}

function progressTextColor(pct: number): string {
  if (pct >= 100) return "text-emerald-600";
  if (pct >= 75) return "text-blue-600";
  return "text-gray-600";
}

function MiniProgressBar({ percentage }: { percentage: number | null }) {
  if (percentage == null) {
    return <span className="text-[11px] text-gray-300">—</span>;
  }

  return (
    <div className="flex items-center gap-1">
      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${progressBarColor(percentage)}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <span className={`text-[11px] font-medium min-w-[28px] ${progressTextColor(percentage)}`}>
        {percentage}%
      </span>
    </div>
  );
}


type BvLogicLine =
  | { kind: "intro"; text: string }
  | { kind: "group"; label: string; pct: string }
  | { kind: "item"; label: string; pct?: string }
  | { kind: "blank" }
  | { kind: "note"; text: string };

/** Reference sheet for bulk-set RHS (FY 2026/27 percentages only). */
function bvLogicLines(mode: AssignBvBuMode): BvLogicLine[] {
  const bu = mode === "bwf" ? "BWF" : "BWA";
  return [
    {
      kind: "intro",
      text: `${bu} BV Logic — 因應公司實際情況、團隊組成 — 每年做定期修改`,
    },
    { kind: "group", label: "Project PM", pct: "35%" },
    { kind: "item", label: "Quotation / 客戶報價單及專業說明", pct: "5%" },
    { kind: "item", label: "Supplier Cost / 供應商報價", pct: "3%" },
    { kind: "item", label: "Pitching Meeting / 客戶投標會議", pct: "3%" },
    { kind: "item", label: "Weekly Meeting & Report / 每星期工地例會及報告", pct: "5%" },
    { kind: "item", label: "Defects Follow Up / 執漏跟進", pct: "2%" },
    { kind: "item", label: "Assistant PM / 團隊支援協助", pct: "3%" },
    { kind: "item", label: "Team Leader / 直屬團隊領袖", pct: "3%" },
    { kind: "item", label: "Senior Leader / 高級團隊領袖", pct: "1%" },
    { kind: "item", label: "Man Hour / 時間值分成", pct: "10%" },
    { kind: "blank" },
    { kind: "group", label: "Design", pct: "35%" },
    { kind: "item", label: "Pitching Layout / 投標平面圖", pct: "4%" },
    { kind: "item", label: "Pitching Mood PPT / 投標設計風格方案", pct: "4%" },
    { kind: "item", label: "Pitching Meeting / 客戶投標會議", pct: "3%" },
    { kind: "item", label: "3D Rendering / 效果圖", pct: "5%" },
    { kind: "item", label: "8 Plans / 功能佈局圖", pct: "5%" },
    { kind: "item", label: "Detailed Drawings & Furniture Drawings / 詳細圖紙及傢俬圖", pct: "5%" },
    { kind: "item", label: "As-Built Drawings / 竣工圖紙", pct: "0%" },
    { kind: "item", label: "Weekly Meeting / 每星期工地例會", pct: "2%" },
    { kind: "item", label: "Team Leader / 直屬團隊領袖", pct: "2%" },
    { kind: "item", label: "Man Hour / 時間值分成", pct: "5%" },
    { kind: "blank" },
    { kind: "group", label: "BW Platform", pct: "30%" },
    { kind: "item", label: "辦公室、網站建立、廣告、稅項、平台、前排同事支援" },
    { kind: "item", label: "Branding / 品牌設計" },
    { kind: "blank" },
    { kind: "group", label: "Total", pct: "100%" },
    { kind: "blank" },
    { kind: "note", text: "扣減 BV" },
    { kind: "item", label: "工程遭遇客人罰款" },
  ];
}

// ─── COMPONENT ───────────────────────────────────────────────

interface AssignBVManagementProps {
  /** Permission module for edit/delete gates. Defaults to admin `/assign-bv`. */
  permissionModule?: string;
}

export default function AssignBVManagement({
  permissionModule = "assign-bv",
}: AssignBVManagementProps) {
  const { canEdit, canDelete, loading: permLoading } = usePermission();
  const { staff: authStaff, isLoading: authLoading } = useAuth();
  const { formatMoney: formatCurrency, formatBV } = useFinancialFormat();
  const supabase = createClient();

  // ─── State ─────────────────────────────────────────
  const [bvRows, setBvRows] = useState<ProjectBVRow[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [teamTypes, setTeamTypes] = useState<TeamType[]>([]);
  const [projects, setProjects] = useState<BWAProject[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  /** Dates + income totals keyed by project id — loaded with BV rows (not reference snapshot). */
  const [projectProgress, setProjectProgress] = useState<
    Record<string, ProjectProgressMeta>
  >({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterFY, setFilterFY] = useState<string>("all");
  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [sortField, setSortField] = useState<AssignBvSortField>("handover_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [filterBVStatus, setFilterBVStatus] = useState<string>("under"); // "all" | "complete" | "over" | "under"
  /** BWA uses project_bv.project_id; BWF uses project_bv.bwf_project_id — same UI otherwise. */
  const [buMode, setBuMode] = useState<AssignBvBuMode>("bwa");

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ProjectBVRow | null>(null);
  const [editRatio, setEditRatio] = useState<string>("");
  const [editError, setEditError] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRow, setDeletingRow] = useState<ProjectBVRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Bulk set state
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkGroup, setBulkGroup] = useState<ProjectGroup | null>(null);
  const [bulkRatios, setBulkRatios] = useState<Record<string, string>>({});
  /** staff_id → total reported man hours on this project */
  const [bulkStaffHours, setBulkStaffHours] = useState<Record<string, number>>({});
  /** staff_id → tasks reported on this project */
  const [bulkStaffTasks, setBulkStaffTasks] = useState<Record<string, BulkStaffTask[]>>({});
  const [bulkHoursLoading, setBulkHoursLoading] = useState(false);
  /** Expanded BV row ids (project_bv.id) in bulk dialog */
  const [bulkExpandedRows, setBulkExpandedRows] = useState<Set<string>>(new Set());
  const [bulkError, setBulkError] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // ─── Load reference data ───────────────────────────
  useEffect(() => {
    loadReferenceData(buMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload lookups when BU mode changes
  }, [buMode]);

  useEffect(() => {
    if (authLoading) return;
    loadBVData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filters, BU mode, or staff scope change
  }, [
    buMode,
    filterFY,
    filterTeam,
    filterStaff,
    authLoading,
    authStaff?.id,
    authStaff?.role,
    authStaff?.n_team_type_id,
  ]);

  const loadReferenceData = async (mode: AssignBvBuMode) => {
    const [staffRes, fyRes, ttRes] = await Promise.all([
      supabase.from("staff").select("id, full_name, name, position, n_team_type_id, status").order("name"),
      supabase.from("financial_years").select("id, display").order("display", { ascending: false }),
      supabase.from("team_types").select("id, display, is_bwf").eq("is_active", true).order("display"),
    ]);

    if (staffRes.data) setStaff(staffRes.data);
    if (fyRes.data) setFinancialYears(fyRes.data);
    if (ttRes.data) setTeamTypes(ttRes.data);

    if (mode === "bwf") {
      const { data: projData } = await supabase
        .from("bwf_projects")
        .select(
          "id, project_code, project_name, signed_date, start_date, handover_date, cost_center_id, customer_id, main_pm_id, main_designer_id, status, real_customer_name, real_cost_centre"
        )
        .order("project_code");
      setProjectTypes([]);
      setProjects(
        (projData ?? []).map((p: Record<string, unknown>) => ({
          id: p.id as string,
          bubble_id: "",
          project_code: (p.project_code as string | null) ?? null,
          project_name: (p.project_name as string | null) ?? null,
          signed_date: (p.signed_date as string | null) ?? null,
          start_date: (p.start_date as string | null) ?? null,
          handover_date: (p.handover_date as string | null) ?? null,
          project_type_ids: [],
          cost_centre_id: (p.cost_center_id as string | null) ?? null,
          customer_id: (p.customer_id as string | null) ?? null,
          main_pm_id: (p.main_pm_id as string | null) ?? null,
          main_designer_id: (p.main_designer_id as string | null) ?? null,
          status: (p.status as string | null) ?? null,
          real_customer_name: (p.real_customer_name as string | null) ?? null,
          real_cost_centre: (p.real_cost_centre as string | null) ?? null,
        }))
      );
      return;
    }

    const [projRes, ptRes, ptJunctionRes] = await Promise.all([
      supabase
        .from("bwa_projects")
        .select(
          "id, bubble_id, project_code, project_name, signed_date, start_date, handover_date, cost_centre_id, customer_id, main_pm_id, main_designer_id, status, real_customer_name, real_cost_centre"
        )
        .order("project_code"),
      supabase.from("project_types").select("id, display, chin_display"),
      supabase.from("bwa_project_project_types").select("project_id, project_type_id"),
    ]);

    const ptIdsByProject = new Map<string, string[]>();
    for (const row of ptJunctionRes.data ?? []) {
      if (!row.project_id || !row.project_type_id) continue;
      const list = ptIdsByProject.get(row.project_id) ?? [];
      if (!list.includes(row.project_type_id)) list.push(row.project_type_id);
      ptIdsByProject.set(row.project_id, list);
    }

    if (ptRes.data) setProjectTypes(ptRes.data);
    if (projRes.data) {
      setProjects(
        projRes.data.map((p: BWAProject) => ({
          ...p,
          project_type_ids: ptIdsByProject.get(p.id) ?? [],
        }))
      );
    }
  };

  const loadBVData = async () => {
    setLoading(true);
    const mode = buMode;
    const fkColumn = mode === "bwf" ? "bwf_project_id" : "project_id";
    const projectsTable = mode === "bwf" ? "bwf_projects" : "bwa_projects";

    // User → projects with related project_bv; Senior → same team OR assigned; Admin → all.
    const staffContext: ProjectStaffContext | undefined = authStaff?.id
      ? {
          staffId: authStaff.id,
          role: authStaff.role ?? null,
          teamTypeId: authStaff.n_team_type_id ?? null,
        }
      : undefined;
    let projectIds =
      mode === "bwf"
        ? await resolveVisibleBwfProjectIds(staffContext)
        : await resolveVisibleBwaProjectIds(staffContext);

    // Admin / Super Admin: resolve every project id, then load BV by FK only.
    if (projectIds === null) {
      const allIds: string[] = [];
      const idPage = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data } = await supabase
          .from(projectsTable)
          .select("id")
          .range(from, from + idPage - 1);
        const rows = data ?? [];
        for (const row of rows) {
          if (row.id) allIds.push(row.id as string);
        }
        hasMore = rows.length === idPage;
        from += idPage;
      }
      projectIds = allIds;
    }

    if (projectIds.length === 0) {
      setBvRows([]);
      setTotalCount(0);
      setProjectProgress({});
      setLoading(false);
      return;
    }

    const projectIdChunks: string[][] = [];
    for (let i = 0; i < projectIds.length; i += PROJECT_ID_CHUNK) {
      projectIdChunks.push(projectIds.slice(i, i + PROJECT_ID_CHUNK));
    }

    let allRows: ProjectBVRow[] = [];

    for (const projectIdChunk of projectIdChunks) {
      let query = supabase
        .from("project_bv")
        .select("*")
        .in(fkColumn, projectIdChunk);

      if (filterFY !== "all") {
        query = query.eq("n_financial_year_id", filterFY);
      }
      if (filterTeam !== "all") {
        query = query.eq("n_team_type_id", filterTeam);
      }
      if (filterStaff !== "all") {
        query = query.eq("handler_id", filterStaff);
      }

      const { data, error } = await query;
      if (error) {
        console.error(`[AssignBV] project_bv by ${fkColumn}:`, error.message);
        continue;
      }
      if (data?.length) {
        allRows = allRows.concat(data as ProjectBVRow[]);
      }
    }

    setBvRows(allRows);
    setTotalCount(allRows.length);

    const uniqueProjectIds = [
      ...new Set(
        allRows
          .map((r) => linkedProjectId(r, mode))
          .filter((id): id is string => !!id)
      ),
    ];

    const progressMap: Record<string, ProjectProgressMeta> = {};
    for (const pid of uniqueProjectIds) {
      progressMap[pid] = {
        start_date: null,
        handover_date: null,
        total_sales: 0,
        paid_sales: 0,
      };
    }

    const ID_CHUNK = 150;
    const dateChunks: string[][] = [];
    for (let i = 0; i < uniqueProjectIds.length; i += ID_CHUNK) {
      dateChunks.push(uniqueProjectIds.slice(i, i + ID_CHUNK));
    }

    const [financials, ...dateResults] = await Promise.all([
      mode === "bwf"
        ? fetchBWFProjectFinancials(uniqueProjectIds)
        : fetchProjectFinancials(uniqueProjectIds),
      ...dateChunks.map(async (chunk) => {
        const { data, error } = await supabase
          .from(projectsTable)
          .select("id, start_date, handover_date")
          .in("id", chunk);
        if (error) {
          console.error("[AssignBV] progress dates:", error.message);
          return [] as Array<{
            id: string;
            start_date: string | null;
            handover_date: string | null;
          }>;
        }
        return data ?? [];
      }),
    ]);

    for (const rows of dateResults) {
      for (const row of rows) {
        if (!row?.id || !progressMap[row.id]) continue;
        progressMap[row.id].start_date = row.start_date ?? null;
        progressMap[row.id].handover_date = row.handover_date ?? null;
      }
    }

    for (const pid of uniqueProjectIds) {
      const fin = financials[pid];
      if (!fin) continue;
      progressMap[pid].total_sales = Number(fin.total_sales) || 0;
      progressMap[pid].paid_sales = Number(fin.paid_sales) || 0;
    }

    // Fallback: if RPC returned all zeros, aggregate incomes directly (same semantics).
    const rpcLooksEmpty =
      uniqueProjectIds.length > 0 &&
      uniqueProjectIds.every((pid) => (progressMap[pid]?.total_sales || 0) === 0);
    if (rpcLooksEmpty) {
      const incomeFk = mode === "bwf" ? "bwf_project_id" : "project_id";
      for (const chunk of dateChunks) {
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from("incomes")
            .select(`${incomeFk}, income_amount, payment_amount`)
            .in(incomeFk, chunk)
            .range(from, from + 999);
          if (error) {
            console.error("[AssignBV] progress incomes:", error.message);
            break;
          }
          const rows = data ?? [];
          for (const row of rows) {
            const pid = (row as Record<string, unknown>)[incomeFk] as string | null;
            if (!pid || !progressMap[pid]) continue;
            progressMap[pid].total_sales += Number(row.income_amount) || 0;
            progressMap[pid].paid_sales += Number(row.payment_amount) || 0;
          }
          hasMore = rows.length === 1000;
          from += 1000;
        }
      }
    }

    setProjectProgress(progressMap);
    setLoading(false);
  };

  // ─── Derived data ──────────────────────────────────
  const staffMap = useMemo(() => {
    const map: Record<string, StaffMember> = {};
    staff.forEach((s) => { map[s.id] = s; });
    return map;
  }, [staff]);

  const projectMap = useMemo(() => {
    const map: Record<string, BWAProject> = {};
    projects.forEach((p) => { map[p.bubble_id] = p; });
    return map;
  }, [projects]);

  const projectIdMap = useMemo(() => {
    const map: Record<string, BWAProject> = {};
    projects.forEach((p) => { map[p.id] = p; });
    return map;
  }, [projects]);

  const fyMap = useMemo(() => {
    const map: Record<string, string> = {};
    financialYears.forEach((fy) => { map[fy.id] = fy.display; });
    return map;
  }, [financialYears]);

  const teamMap = useMemo(() => {
    const map: Record<string, string> = {};
    teamTypes.forEach((tt) => { map[tt.id] = tt.display; });
    return map;
  }, [teamTypes]);

  const projectTypeMap = useMemo(() => {
    const map: Record<string, ProjectType> = {};
    projectTypes.forEach((pt) => { map[pt.id] = pt; });
    return map;
  }, [projectTypes]);

  const bulkRowsBySection = useMemo(() => {
    if (!bulkGroup) {
      return {
        company: [] as ProjectBVRow[],
        pm: [] as ProjectBVRow[],
        design: [] as ProjectBVRow[],
        other: [] as ProjectBVRow[],
      };
    }
    const company: ProjectBVRow[] = [];
    const pm: ProjectBVRow[] = [];
    const design: ProjectBVRow[] = [];
    const other: ProjectBVRow[] = [];
    for (const row of bulkGroup.rows) {
      // Acme company share always listed first (own section)
      if (row.handler_id === COMPANY_BV_HANDLER_ID) {
        company.push(row);
        continue;
      }
      const team = row.n_team_type_id ? teamMap[row.n_team_type_id] : "";
      const label = (team || "").toLowerCase();
      if (label === "pm") pm.push(row);
      else if (label === "design") design.push(row);
      else other.push(row);
    }
    return { company, pm, design, other };
  }, [bulkGroup, teamMap]);

  const teamsForFilter = useMemo(
    () =>
      teamTypes.filter((tt) =>
        buMode === "bwf" ? tt.is_bwf === true : tt.is_bwf !== true
      ),
    [teamTypes, buMode]
  );

  // Group rows by linked project FK (project_id or bwf_project_id) and compute sums
  const groupedProjects = useMemo(() => {
    const groups: Record<string, ProjectGroup> = {};

    bvRows.forEach((row) => {
      const pid = linkedProjectId(row, buMode);
      if (!pid) return;

      if (!groups[pid]) {
        groups[pid] = {
          project_id: pid,
          project: projectIdMap[pid] || null,
          rows: [],
          totalSales: Number(row.total_sales) || 0,
          totalEstimatedGP: Number(row.estimated_gp) || 0,
          totalSharedEstGP: 0,
          totalActualGP: Number(row.actual_gp) || 0,
          avgRatio: 0,
        };
      } else {
        if (!groups[pid].totalSales && row.total_sales) {
          groups[pid].totalSales = Number(row.total_sales) || 0;
        }
        if (!groups[pid].totalEstimatedGP && row.estimated_gp) {
          groups[pid].totalEstimatedGP = Number(row.estimated_gp) || 0;
        }
        if (!groups[pid].totalActualGP && row.actual_gp) {
          groups[pid].totalActualGP = Number(row.actual_gp) || 0;
        }
      }

      const g = groups[pid];
      g.rows.push(row);
      g.totalSharedEstGP += memberSharedEstGp(row);
    });

    // Compute ratio per group: sum of project_bv.ratio; Acme first in expand/bulk.
    Object.values(groups).forEach((g) => {
      g.rows = sortBvRowsCompanyFirst(g.rows);
      g.avgRatio = g.rows.reduce((sum, r) => sum + (r.ratio || 0), 0);
    });

    return Object.values(groups);
  }, [bvRows, projectIdMap, buMode]);

  // Filter groups by search term and BV status
  const filteredGroups = useMemo(() => {
    let result = groupedProjects;

    // Filter by BV completion status (using sum of project_bv.ratio grouped by project)
    if (filterBVStatus !== "all") {
      result = result.filter((group) => {
        const ratioSum = group.avgRatio;
        if (filterBVStatus === "complete") return ratioSum >= 99.99 && ratioSum <= 100.01; // ≈100%
        if (filterBVStatus === "over") return ratioSum > 100.01; // >100%
        if (filterBVStatus === "under") return ratioSum < 99.99; // <100% (includes 0 / not yet allocated)
        return true;
      });
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter((group) => {
        const projName = group.project?.project_name?.toLowerCase() || "";
        const projCode = group.project?.project_code?.toLowerCase() || "";
        // Also search handler names within the group
        const hasStaffMatch = group.rows.some((row) => {
          const staffMember = row.handler_id ? staffMap[row.handler_id] : null;
          const staffName = (staffMember?.name || staffMember?.full_name || "").toLowerCase();
          return staffName.includes(term);
        });
        return projName.includes(term) || projCode.includes(term) || hasStaffMatch;
      });
    }

    const dir = sortDir === "asc" ? 1 : -1;
    const projectLabel = (g: ProjectGroup) =>
      (g.project?.project_name || g.project?.project_code || "").toLowerCase();
    const projectTypeLabel = (g: ProjectGroup) =>
      (g.project?.project_type_ids ?? [])
        .map((id) => projectTypeMap[id])
        .filter(Boolean)
        .map((pt) => pt.chin_display || pt.display || "")
        .join(", ");
    const staffLabel = (id: string | null | undefined) => {
      if (!id) return "";
      const member = staffMap[id];
      return (member?.name || member?.full_name || "").toLowerCase();
    };
    const pmDesignerLabel = (g: ProjectGroup) =>
      `${staffLabel(g.project?.main_pm_id)} ${staffLabel(g.project?.main_designer_id)}`.trim();
    const handoverOf = (g: ProjectGroup) =>
      projectProgress[g.project_id]?.handover_date ?? g.project?.handover_date ?? null;
    const workPctOf = (g: ProjectGroup) =>
      computeWorkPercentage(
        projectProgress[g.project_id]?.start_date ?? g.project?.start_date,
        handoverOf(g)
      );
    const paymentPctOf = (g: ProjectGroup) =>
      computePaymentPercentage(
        projectProgress[g.project_id]?.total_sales,
        projectProgress[g.project_id]?.paid_sales
      );

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "signed_date":
          cmp = cmpNullableNumber(dateSortMs(a.project?.signed_date), dateSortMs(b.project?.signed_date), dir);
          break;
        case "handover_date":
          cmp = cmpNullableNumber(dateSortMs(handoverOf(a)), dateSortMs(handoverOf(b)), dir);
          break;
        case "work_pct":
          cmp = cmpNullableNumber(workPctOf(a), workPctOf(b), dir);
          break;
        case "payment_pct":
          cmp = cmpNullableNumber(paymentPctOf(a), paymentPctOf(b), dir);
          break;
        case "project_type":
          cmp = projectTypeLabel(a).localeCompare(projectTypeLabel(b), "zh-HK") * dir;
          break;
        case "bu":
          cmp = (buMode === "bwf" ? "BWF" : "BWA").localeCompare(buMode === "bwf" ? "BWF" : "BWA") * dir;
          break;
        case "pm_designer":
          cmp = pmDesignerLabel(a).localeCompare(pmDesignerLabel(b), "zh-HK") * dir;
          break;
        case "status":
          cmp =
            projectStatusDisplayLabel(a.project?.status).localeCompare(
              projectStatusDisplayLabel(b.project?.status),
              "zh-HK"
            ) * dir;
          break;
        case "bv_count":
          cmp = (a.rows.length - b.rows.length) * dir;
          break;
        case "ratio":
          cmp = (a.avgRatio - b.avgRatio) * dir;
          break;
        case "total_sales":
          cmp = (a.totalSales - b.totalSales) * dir;
          break;
        case "est_gp":
          cmp = (a.totalEstimatedGP - b.totalEstimatedGP) * dir;
          break;
        case "shared_gp":
          cmp = (a.totalSharedEstGP - b.totalSharedEstGP) * dir;
          break;
        case "project":
        default:
          cmp = projectLabel(a).localeCompare(projectLabel(b), "zh-HK") * dir;
          break;
      }
      if (cmp !== 0) return cmp;
      return projectLabel(a).localeCompare(projectLabel(b), "zh-HK");
    });

    return result;
  }, [groupedProjects, searchTerm, staffMap, filterBVStatus, sortField, sortDir, projectProgress, projectTypeMap, buMode]);

  // Paginate groups
  const paginatedGroups = useMemo(() => {
    const from = page * pageSize;
    return filteredGroups.slice(from, from + pageSize);
  }, [filteredGroups, page, pageSize]);

  const toggleGroup = (projectId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  // ─── Sort toggle ───────────────────────────────────
  const handleSort = (field: AssignBvSortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(DESC_FIRST_SORT_FIELDS.has(field) ? "desc" : "asc");
    }
    setPage(0);
  };

  // ─── Edit BV ───────────────────────────────────────
  const refreshProjectBvRows = async (projectId: string) => {
    const fkColumn = buMode === "bwf" ? "bwf_project_id" : "project_id";
    const { data, error } = await supabase
      .from("project_bv")
      .select("*")
      .eq(fkColumn, projectId);
    if (error) {
      console.error("[AssignBV] refresh project_bv:", error.message);
      return;
    }
    const fresh = (data ?? []) as ProjectBVRow[];
    setBvRows((prev) => {
      const others = prev.filter((r) => linkedProjectId(r, buMode) !== projectId);
      return others.concat(fresh);
    });
  };

  const openEdit = (row: ProjectBVRow) => {
    setEditingRow(row);
    setEditRatio(row.ratio != null ? String(row.ratio) : "");
    setEditError("");
    setSuccessMsg("");
    setEditDialogOpen(true);
  };

  const handleSaveRatio = async () => {
    if (!editingRow) return;
    const val = parseFloat(editRatio);
    if (isNaN(val) || val < 0) {
      setEditError("請輸入有效的 BV Ratio（≥ 0）");
      return;
    }
    if (val > 100) {
      setEditError("BV Ratio 不能超過 100%，請重新輸入！");
      return;
    }
    setSaving(true);
    setEditError("");

    const { error } = await supabase
      .from("project_bv")
      .update({ ratio: val })
      .eq("id", editingRow.id);

    if (error) {
      setEditError(`更新失敗: ${error.message}`);
      setSaving(false);
      return;
    }

    setSuccessMsg("BV Ratio 已成功更新！");
    setSaving(false);

    const projectId = linkedProjectId(editingRow, buMode);
    if (projectId) {
      await refreshProjectBvRows(projectId);
    } else {
      setBvRows((prev) =>
        prev.map((r) => (r.id === editingRow.id ? { ...r, ratio: val } : r))
      );
    }

    setTimeout(() => {
      setEditDialogOpen(false);
      setSuccessMsg("");
    }, 1200);
  };

  // ─── Bulk Set BV (group) ─────────────────────────────
  const openBulkSet = (group: ProjectGroup) => {
    const seedRows = sortBvRowsCompanyFirst(group.rows);
    const seedGroup: ProjectGroup = { ...group, rows: seedRows };
    setBulkGroup(seedGroup);
    const ratios: Record<string, string> = {};
    seedRows.forEach((r) => {
      ratios[r.id] = r.ratio != null ? String(r.ratio) : "";
    });
    setBulkRatios(ratios);
    setBulkStaffHours({});
    setBulkStaffTasks({});
    setBulkExpandedRows(new Set());
    setBulkError("");
    setBulkSuccess("");
    setBulkDialogOpen(true);

    if (!group.project_id) return;

    // Fresh rows for this project only (BWA: project_id / BWF: bwf_project_id).
    void (async () => {
      const fkColumn = buMode === "bwf" ? "bwf_project_id" : "project_id";
      const { data, error } = await supabase
        .from("project_bv")
        .select("*")
        .eq(fkColumn, group.project_id);
      if (error) {
        console.error("[AssignBV] bulk refresh project_bv:", error.message);
        return;
      }
      const freshRows = sortBvRowsCompanyFirst((data ?? []) as ProjectBVRow[]);
      const avgRatio = freshRows.reduce((sum, r) => sum + (r.ratio || 0), 0);
      setBulkGroup((prev) => {
        if (!prev || prev.project_id !== group.project_id) return prev;
        const drafts = prev.rows.filter(isDraftBvRow);
        return { ...prev, rows: [...freshRows, ...drafts], avgRatio };
      });
      setBulkRatios((prev) => {
        const next: Record<string, string> = {};
        freshRows.forEach((r) => {
          next[r.id] = r.ratio != null ? String(r.ratio) : "";
        });
        for (const [id, val] of Object.entries(prev)) {
          if (id.startsWith(DRAFT_BV_PREFIX)) next[id] = val;
        }
        return next;
      });
      // Keep list/group state in sync with the dialog.
      setBvRows((prev) => {
        const others = prev.filter(
          (r) => linkedProjectId(r, buMode) !== group.project_id
        );
        return others.concat(freshRows);
      });
    })();

    // Load per-staff reported man hours + tasks for this project
    setBulkHoursLoading(true);
    getProjectManHourSummary(group.project_id)
      .then((summary) => {
        setBulkStaffHours(summary.staffBreakdown);
        const byStaff: Record<string, BulkStaffTask[]> = {};
        for (const t of summary.tasks) {
          const dates = (
            t as typeof t & {
              man_hour_dates?: {
                staff_id: string | null;
                report_date: string | null;
              };
            }
          ).man_hour_dates;
          const staffId = dates?.staff_id;
          if (!staffId) continue;
          const entry: BulkStaffTask = {
            id: t.id,
            task_name: t.task_name,
            task_description: t.task_description,
            task_type: t.task_type,
            work_hour: Number(t.work_hour) || 0,
            report_date: dates?.report_date ?? null,
            created_at: t.created_at,
          };
          (byStaff[staffId] ??= []).push(entry);
        }
        for (const list of Object.values(byStaff)) {
          list.sort(
            (a, b) =>
              new Date(b.report_date || b.created_at || "").getTime() -
              new Date(a.report_date || a.created_at || "").getTime()
          );
        }
        setBulkStaffTasks(byStaff);
      })
      .catch((err) => {
        console.error("[AssignBV] getProjectManHourSummary error:", err);
        setBulkStaffHours({});
        setBulkStaffTasks({});
      })
      .finally(() => setBulkHoursLoading(false));
  };

  const toggleBulkRowExpand = (rowId: string) => {
    setBulkExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const bulkRatioTotal = useMemo(() => {
    return Object.values(bulkRatios).reduce((sum, v) => {
      const n = parseFloat(v);
      return sum + (isNaN(n) ? 0 : n);
    }, 0);
  }, [bulkRatios]);

  /** Suggested BV% from man-hour reports (BW 30 · PM/Design 35/35 or 70 when one side missing). */
  const bulkSuggest = useMemo(() => {
    if (!bulkGroup) {
      return {
        suggested: {} as Record<string, number>,
        breakdown: {} as Record<string, BulkSuggestBreakdown>,
        roleSubLabel: "PM/Designer",
      };
    }
    return computeBulkRatioSuggestions(
      bulkGroup.rows,
      staffMap,
      bulkStaffHours
    );
  }, [bulkGroup, staffMap, bulkStaffHours]);
  const bulkSuggestions = bulkSuggest.suggested;

  const applyBulkSuggestion = (rowId: string) => {
    const suggested = bulkSuggestions[rowId];
    if (suggested == null) return;
    setBulkRatios((prev) => ({
      ...prev,
      [rowId]: String(suggested),
    }));
  };

  const applyAllBulkSuggestions = () => {
    if (!bulkGroup) return;
    setBulkRatios((prev) => {
      const next = { ...prev };
      for (const row of bulkGroup.rows) {
        if (bulkSuggestions[row.id] != null) {
          next[row.id] = String(bulkSuggestions[row.id]);
        }
      }
      return next;
    });
  };

  const addBulkBvRow = () => {
    if (!bulkGroup) return;
    const draft = createDraftBvRow(bulkGroup, buMode);
    setBulkGroup({ ...bulkGroup, rows: [...bulkGroup.rows, draft] });
    setBulkRatios((prev) => ({ ...prev, [draft.id]: "0" }));
    setBulkError("");
  };

  const removeBulkDraftRow = (rowId: string) => {
    setBulkGroup((prev) =>
      prev ? { ...prev, rows: prev.rows.filter((r) => r.id !== rowId) } : prev
    );
    setBulkRatios((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
    setBulkError("");
  };

  const setBulkDraftHandler = (rowId: string, handlerId: string) => {
    const member = staffMap[handlerId];
    setBulkGroup((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((r) =>
          r.id === rowId
            ? {
                ...r,
                handler_id: handlerId,
                n_team_type_id: member?.n_team_type_id ?? null,
              }
            : r
        ),
      };
    });
    setBulkError("");
  };

  const handleBulkSave = async () => {
    if (!bulkGroup) return;

    const missingHandler = bulkGroup.rows.filter(
      (r) => isDraftBvRow(r) && !r.handler_id
    );
    if (missingHandler.length > 0) {
      setBulkError("請為新增的 BV 記錄選擇負責人，才能儲存全部記錄");
      return;
    }

    const seenHandlers = new Set<string>();
    for (const row of bulkGroup.rows) {
      if (!row.handler_id) continue;
      if (seenHandlers.has(row.handler_id)) {
        setBulkError("同一負責人不能重複新增");
        return;
      }
      seenHandlers.add(row.handler_id);
    }

    const updates: { id: string; ratio: number }[] = [];
    const inserts: Record<string, unknown>[] = [];
    for (const row of bulkGroup.rows) {
      const raw = (bulkRatios[row.id] ?? "").trim();
      const val = raw === "" ? 0 : parseFloat(raw);
      if (isNaN(val) || val < 0) {
        setBulkError("BV Ratio 不能為負數，請輸入 0 或以上");
        return;
      }
      if (val > 100) {
        setBulkError("單一 BV Ratio 不能超過 100%，請重新輸入！");
        return;
      }
      if (isDraftBvRow(row)) {
        inserts.push({
          handler_id: row.handler_id,
          ratio: val,
          n_financial_year_id: row.n_financial_year_id,
          n_team_type_id: row.n_team_type_id,
          ...(buMode === "bwf"
            ? { bwf_project_id: bulkGroup.project_id }
            : { project_id: bulkGroup.project_id }),
        });
      } else if (Number(row.ratio) !== val) {
        updates.push({ id: row.id, ratio: val });
      }
    }

    setBulkSaving(true);
    setBulkError("");

    // Sequential writes: each ratio change / insert triggers recalculate_project_bv,
    // which updates every row on the same project. Parallel requests deadlock.
    if (inserts.length > 0) {
      const { error } = await supabase.from("project_bv").insert(inserts);
      if (error) {
        setBulkError(`儲存失敗: ${error.message}`);
        setBulkSaving(false);
        return;
      }
      void notifyProjectBvCreated(supabase, {
        rows: inserts as {
          handler_id?: string | null;
          ratio?: number | null;
          project_id?: string | null;
          bwf_project_id?: string | null;
        }[],
        assignerStaffId: authStaff?.id ?? null,
        assignerName: authStaff?.name ?? null,
        projectCode: bulkGroup.project?.project_code,
        projectName: bulkGroup.project?.project_name,
      });
    }
    for (const { id, ratio } of updates) {
      const { error } = await supabase
        .from("project_bv")
        .update({ ratio })
        .eq("id", id);
      if (error) {
        setBulkError(`儲存失敗: ${error.message}`);
        setBulkSaving(false);
        return;
      }
    }

    await refreshProjectBvRows(bulkGroup.project_id);

    setBulkSuccess(inserts.length > 0 ? "已儲存全部 BV 記錄！" : "已批量更新 BV Ratio！");
    setBulkSaving(false);
    setTimeout(() => {
      setBulkDialogOpen(false);
      setBulkSuccess("");
      setBulkGroup(null);
    }, 1000);
  };

  // ─── Delete BV ───────────────────────────────────────
  const openDelete = (row: ProjectBVRow) => {
    setDeletingRow(row);
    setDeleteError("");
    setDeleteDialogOpen(true);
  };

  const handleDeleteBV = async () => {
    if (!deletingRow) return;
    setDeleting(true);
    setDeleteError("");

    const { error } = await supabase
      .from("project_bv")
      .delete()
      .eq("id", deletingRow.id);

    if (error) {
      setDeleteError(`刪除失敗: ${error.message}`);
      setDeleting(false);
      return;
    }

    // Remove from local state
    setBvRows((prev) => prev.filter((r) => r.id !== deletingRow.id));
    setDeleting(false);
    setDeleteDialogOpen(false);
    setDeletingRow(null);
  };

  // ─── Pagination ────────────────────────────────────
  const totalPages = Math.ceil(filteredGroups.length / pageSize);

  const SortIcon = ({ field }: { field: AssignBvSortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 text-gray-400" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-blue-500" />
      : <ChevronDown className="w-3 h-3 text-blue-500" />;
  };

  const SortableTh = ({
    field,
    children,
    align = "left",
    className = "",
  }: {
    field: AssignBvSortField;
    children: React.ReactNode;
    align?: "left" | "right" | "center";
    className?: string;
  }) => (
    <th
      className={`px-1.5 py-1.5 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 whitespace-nowrap select-none ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      } ${className}`}
      onClick={() => handleSort(field)}
    >
      <div
        className={`flex items-center gap-0.5 ${
          align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""
        }`}
      >
        {children}
        <SortIcon field={field} />
      </div>
    </th>
  );

  // ─── RENDER ────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">績效評估 — BV 分配</h1>
          <p className="text-sm text-gray-500 mt-1">
            管理{buMode === "bwf" ? "BWF" : "BWA"}項目 BV (Business Value) 分配比率 · 共{" "}
            {filteredGroups.length} 個項目（{totalCount} 筆記錄）
          </p>
        </div>
        <div
          className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm"
          role="group"
          aria-label="BU 切換"
        >
          <button
            type="button"
            onClick={() => {
              if (buMode === "bwa") return;
              setBuMode("bwa");
              setFilterTeam("all");
              setPage(0);
              setExpandedGroups(new Set());
              setBulkDialogOpen(false);
              setBulkGroup(null);
            }}
            className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${
              buMode === "bwa"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            BWA
          </button>
          <button
            type="button"
            onClick={() => {
              if (buMode === "bwf") return;
              setBuMode("bwf");
              setFilterTeam("all");
              setPage(0);
              setExpandedGroups(new Set());
              setBulkDialogOpen(false);
              setBulkGroup(null);
            }}
            className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${
              buMode === "bwf"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            BWF
          </button>
        </div>
      </div>

      {/* KPI Cards — BV 分配狀態 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Ratio = 100%</p>
              <p className="text-2xl font-bold text-emerald-600 font-mono-num">{groupedProjects.filter(g => g.avgRatio >= 99.99 && g.avgRatio <= 100.01).length}</p>
              <p className="text-[12px] text-gray-400">分配完成</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Ratio &lt; 100%</p>
              <p className="text-2xl font-bold text-amber-600 font-mono-num">{groupedProjects.filter(g => g.avgRatio < 99.99).length}</p>
              <p className="text-[12px] text-gray-400">分配不足</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Ratio &gt; 100%</p>
              <p className="text-2xl font-bold text-red-600 font-mono-num">{groupedProjects.filter(g => g.avgRatio > 100.01).length}</p>
              <p className="text-[12px] text-gray-400">分配超額</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜尋項目名稱、編碼或人員..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
            />
          </div>

          {/* Financial Year Filter */}
          <select
            value={filterFY}
            onChange={(e) => { setFilterFY(e.target.value); setPage(0); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">全部財年</option>
            {financialYears.map((fy) => (
              <option key={fy.id} value={fy.id}>{fy.display}</option>
            ))}
          </select>

          {/* Team Type Filter */}
          <select
            value={filterTeam}
            onChange={(e) => { setFilterTeam(e.target.value); setPage(0); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">全部團隊</option>
            {teamsForFilter.map((tt) => (
              <option key={tt.id} value={tt.id}>{tt.display}</option>
            ))}
          </select>

          {/* Staff Filter */}
          <select
            value={filterStaff}
            onChange={(e) => { setFilterStaff(e.target.value); setPage(0); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">全部人員</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name || s.full_name || "—"}</option>
            ))}
          </select>

          {/* BV Status Filter */}
          <select
            value={filterBVStatus}
            onChange={(e) => { setFilterBVStatus(e.target.value); setPage(0); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">全部 BV 狀態</option>
            <option value="complete">✅ BV = 100%（已完成）</option>
            <option value="under">⚠️ BV &lt; 100%（未完成）</option>
            <option value="over">🚨 BV &gt; 100%（超額）</option>
          </select>
        </div>
      </div>

      {/* Table — Grouped by Project (compact to avoid horizontal scroll) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs table-fixed">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-1.5 py-1.5 font-medium text-gray-600 w-7"></th>
                <SortableTh field="signed_date" className="w-[72px]">簽約日期</SortableTh>
                <SortableTh field="handover_date" className="w-[72px]">交場日期</SortableTh>
                <SortableTh field="project" className="w-[140px]">項目</SortableTh>
                <SortableTh field="work_pct" className="w-[88px]">工程進度</SortableTh>
                <SortableTh field="payment_pct" className="w-[88px]">收款進度</SortableTh>
                <SortableTh field="project_type" className="w-[64px]">項目類型</SortableTh>
                <SortableTh field="bu" className="w-[40px]">BU</SortableTh>
                <SortableTh field="pm_designer" className="w-[88px]">主要PM/設計師</SortableTh>
                <SortableTh field="status" className="w-[72px]">項目狀態</SortableTh>
                <SortableTh field="bv_count" className="w-[48px]">BV人數</SortableTh>
                <SortableTh field="ratio" align="right" className="w-[64px]">Ratio%</SortableTh>
                <SortableTh field="total_sales" align="right" className="w-[80px]">總銷售額</SortableTh>
                <SortableTh field="est_gp" align="right" className="w-[72px]">Est. GP</SortableTh>
                <SortableTh field="shared_gp" align="right" className="w-[80px]">Shared GP</SortableTh>
                <th className="text-center px-1.5 py-1.5 font-medium text-gray-600 w-[64px]">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={16} className="text-center py-12 text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
                      載入中...
                    </div>
                  </td>
                </tr>
              ) : paginatedGroups.length === 0 ? (
                <tr>
                  <td colSpan={16} className="text-center py-12 text-gray-400">
                    沒有符合條件的記錄
                  </td>
                </tr>
              ) : (
                paginatedGroups.map((group) => {
                  const isExpanded = expandedGroups.has(group.project_id);
                  const progress = projectProgress[group.project_id];
                  const liveProject = projectIdMap[group.project_id] || group.project;
                  const workPct = computeWorkPercentage(
                    progress?.start_date ?? liveProject?.start_date,
                    progress?.handover_date ?? liveProject?.handover_date
                  );
                  const paymentPct = computePaymentPercentage(
                    progress?.total_sales,
                    progress?.paid_sales
                  );

                  return (
                    <React.Fragment key={group.project_id}>
                      {/* Group summary row */}
                      <tr
                        className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors cursor-pointer"
                        onClick={() => toggleGroup(group.project_id)}
                      >
                        <td className="px-1.5 py-1.5">
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-blue-500" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                          )}
                        </td>
                        <td className="px-1.5 py-1.5 text-[11px] text-gray-600 whitespace-nowrap">
                          {formatAssignBvDate(liveProject?.signed_date)}
                        </td>
                        <td className="px-1.5 py-1.5 text-[11px] text-gray-600 whitespace-nowrap">
                          {formatAssignBvDate(
                            progress?.handover_date ?? liveProject?.handover_date
                          )}
                        </td>
                        <td className="px-1.5 py-1.5">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate text-[11px] leading-tight">
                              {group.project?.project_name || "未知項目"}
                            </p>
                            {group.project?.project_code && (
                              <p className="text-[10px] text-gray-400 truncate leading-tight">{group.project.project_code}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-1.5 py-1.5">
                          <MiniProgressBar percentage={workPct} />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <MiniProgressBar percentage={paymentPct} />
                        </td>
                        <td className="px-1.5 py-1.5">
                          {(() => {
                            const ptIds = group.project?.project_type_ids ?? [];
                            const labels = ptIds
                              .map((id) => projectTypeMap[id])
                              .filter(Boolean)
                              .map((pt) => pt.chin_display || pt.display || "—");
                            if (labels.length === 0) return "—";
                            return (
                              <div className="flex flex-wrap gap-0.5">
                                {labels.map((label) => (
                                  <Badge key={label} variant="outline" className="text-[10px] px-1 py-0 leading-tight">
                                    {label}
                                  </Badge>
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-1.5 py-1.5">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1 py-0 leading-tight ${
                              buMode === "bwf"
                                ? "bg-violet-50 text-violet-700"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {buMode === "bwf" ? "BWF" : "BWA"}
                          </Badge>
                        </td>
                        <td className="px-1.5 py-1.5">
                          <div className="flex flex-col gap-0 min-w-0">
                            {group.project?.main_pm_id && staffMap[group.project.main_pm_id] ? (
                              <span className="text-[11px] font-normal text-gray-900 truncate">{staffMap[group.project.main_pm_id].name || staffMap[group.project.main_pm_id].full_name}</span>
                            ) : null}
                            {group.project?.main_designer_id && staffMap[group.project.main_designer_id] ? (
                              <span className="text-[10px] font-light text-gray-400 truncate">{staffMap[group.project.main_designer_id].name || staffMap[group.project.main_designer_id].full_name}</span>
                            ) : null}
                            {!group.project?.main_pm_id && !group.project?.main_designer_id && "—"}
                          </div>
                        </td>
                        <td className="px-1.5 py-1.5">
                          <ProjectStatusBadge
                            status={group.project?.status ?? null}
                            className="text-[10px] px-1 py-0 leading-tight"
                          />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 leading-tight">
                            {group.rows.length}人
                          </Badge>
                        </td>
                        <td className="px-1.5 py-1.5 text-right">
                          <span className="font-mono font-semibold text-blue-600 text-[11px]">
                            {group.avgRatio > 0 ? `${group.avgRatio.toFixed(1)}%` : "—"}
                          </span>
                        </td>
                        <td className="px-1.5 py-1.5 text-right font-mono font-semibold text-gray-900 text-[11px] whitespace-nowrap">
                          {formatCurrency(group.totalSales)}
                        </td>
                        <td className="px-1.5 py-1.5 text-right font-mono text-gray-700 text-[11px] whitespace-nowrap">
                          {formatCurrency(group.totalEstimatedGP)}
                        </td>
                        <td className="px-1.5 py-1.5 text-right font-mono text-gray-700 text-[11px] whitespace-nowrap">
                          {formatCurrency(group.totalSharedEstGP)}
                        </td>
                        <td className="px-1.5 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                          {canEdit(permissionModule) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openBulkSet(group)}
                              className="h-6 px-1.5 text-[10px] gap-0.5 whitespace-nowrap"
                              title="批量設定 BV"
                            >
                              <Settings2 className="w-3 h-3 shrink-0" />
                              批量
                            </Button>
                          )}
                        </td>
                      </tr>

                      {/* Expanded child rows */}
                      {isExpanded && group.rows.map((row) => {
                        const handler = row.handler_id ? staffMap[row.handler_id] : null;
                        const fy = row.n_financial_year_id ? fyMap[row.n_financial_year_id] : null;
                        const team = row.n_team_type_id ? teamMap[row.n_team_type_id] : null;

                        return (
                          <tr
                            key={row.id}
                            className="border-b border-gray-50 bg-gray-50/50 hover:bg-blue-50/20 transition-colors"
                          >
                            <td className="px-1.5 py-1"></td>
                            <td className="px-1.5 py-1"></td>
                            <td className="px-1.5 py-1"></td>
                            <td className="px-1.5 py-1 pl-3">
                              <div className="flex items-center gap-1 min-w-0">
                                <div className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                                <span className="text-gray-700 text-[11px] truncate">
                                  {handler?.name || handler?.full_name || "—"}
                                </span>
                                {handler?.position && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 leading-tight shrink-0">
                                    {handler.position}
                                  </Badge>
                                )}
                                {team && (
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0 leading-tight shrink-0">{team}</Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-1.5 py-1"></td>
                            <td className="px-1.5 py-1"></td>
                            <td className="px-1.5 py-1"></td>
                            <td className="px-1.5 py-1"></td>
                            <td className="px-1.5 py-1"></td>
                            <td className="px-1.5 py-1"></td>
                            <td className="px-1.5 py-1"></td>
                            <td className="px-1.5 py-1 text-right">
                              <span className="font-mono text-[11px] text-blue-500">
                                {row.ratio != null ? `${row.ratio.toFixed(1)}%` : "—"}
                              </span>
                            </td>
                            <td className="px-1.5 py-1 text-right font-mono text-[11px] text-gray-600 whitespace-nowrap">
                              {formatCurrency(shareByRatio(row.total_sales, row.ratio))}
                            </td>
                            <td className="px-1.5 py-1 text-right font-mono text-[11px] text-gray-600 whitespace-nowrap">
                              {formatCurrency(memberSharedEstGp(row))}
                            </td>
                            <td className="px-1.5 py-1 text-right">
                              <div className="flex items-center justify-end gap-0.5">
                                <span className="font-mono text-[11px] text-gray-600 whitespace-nowrap">
                                  {formatCurrency(memberSharedEstGp(row))}
                                </span>
                                {canEdit(permissionModule) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); openEdit(row); }}
                                  className="h-5 w-5 p-0 hover:bg-blue-50"
                                >
                                  <Edit2 className="w-2.5 h-2.5 text-blue-500" />
                                </Button>
                                )}
                                {canDelete(permissionModule) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); openDelete(row); }}
                                  className="h-5 w-5 p-0 hover:bg-red-50"
                                >
                                  <Trash2 className="w-2.5 h-2.5 text-red-400" />
                                </Button>
                                )}
                              </div>
                            </td>
                            <td className="px-1.5 py-1"></td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>每頁</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
              className="border border-gray-200 rounded px-2 py-1 text-xs"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>筆 · 第 {page + 1}/{totalPages || 1} 頁 · 共 {filteredGroups.length} 個項目</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="h-7 text-xs"
            >
              上一頁
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
              className="h-7 text-xs"
            >
              下一頁
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              編輯 BV Ratio
            </DialogTitle>
          </DialogHeader>

          {editingRow && (
            <div className="space-y-4 py-2">
              {/* Project info */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <p className="text-xs text-gray-500">項目</p>
                <p className="font-medium text-gray-900">
                  {editingRow.project_id
                    ? (projectIdMap[editingRow.project_id]?.project_name || editingRow.project || "—")
                    : editingRow.project
                      ? (projectMap[editingRow.project]?.project_name || editingRow.project)
                      : "—"}
                </p>
                <p className="text-xs text-gray-400">
                  {editingRow.project_id
                    ? (projectIdMap[editingRow.project_id]?.project_code || "")
                    : editingRow.project
                      ? (projectMap[editingRow.project]?.project_code || "")
                      : ""}
                </p>
              </div>

              {/* Handler info */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <p className="text-xs text-gray-500">負責人</p>
                <p className="font-medium text-gray-900">
                  {editingRow.handler_id ? (staffMap[editingRow.handler_id]?.name || staffMap[editingRow.handler_id]?.full_name || "—") : "—"}
                </p>
              </div>

              {/* BV Ratio Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  BV Ratio (%) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={editRatio}
                    onChange={(e) => setEditRatio(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 font-mono text-lg"
                    placeholder="輸入 BV Ratio"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                </div>
                {editError && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {editError}
                  </p>
                )}
                {successMsg && (
                  <p className="mt-1 text-xs text-green-600 font-medium">{successMsg}</p>
                )}
              </div>

              {/* Dynamic stats based on ratio input */}
              {(() => {
                const ratioVal = parseFloat(editRatio) || 0;
                const dynamicSharedGP = (editingRow.estimated_gp || 0) * ratioVal / 100;
                const dynamicEstimatedBV = dynamicSharedGP / 40000;
                return (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-blue-50 rounded-lg p-2">
                      <p className="text-xs text-blue-600">Estimated BV</p>
                      <p className="font-mono font-semibold">{formatBV(dynamicEstimatedBV)}</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-2">
                      <p className="text-xs text-amber-600">總銷售額</p>
                      <p className="font-mono font-semibold">{formatCurrency(editingRow.total_sales)}</p>
                    </div>
                    <div className="bg-violet-50 rounded-lg p-2">
                      <p className="text-xs text-violet-600">Estimated GP</p>
                      <p className="font-mono font-semibold">{formatCurrency(editingRow.estimated_gp)}</p>
                    </div>
                    <div className="bg-teal-50 rounded-lg p-2">
                      <p className="text-xs text-teal-600">Shared Est. GP</p>
                      <p className="font-mono font-semibold">{formatCurrency(dynamicSharedGP)}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSaveRatio} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? (
                <div className="flex items-center gap-1">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                  儲存中...
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Save className="w-4 h-4" />
                  更新
                </div>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              確認刪除
            </DialogTitle>
          </DialogHeader>

          {deletingRow && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-gray-600">
                確定要刪除此 BV 記錄嗎？此操作無法復原。
              </p>
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 space-y-1">
                <p className="text-xs text-gray-500">項目</p>
                <p className="font-medium text-gray-900 text-sm">
                  {deletingRow.project_id
                    ? (projectIdMap[deletingRow.project_id]?.project_name || deletingRow.project || "—")
                    : deletingRow.project || "—"}
                </p>
                <p className="text-xs text-gray-500 mt-2">負責人</p>
                <p className="font-medium text-gray-900 text-sm">
                  {deletingRow.handler_id ? (staffMap[deletingRow.handler_id]?.name || staffMap[deletingRow.handler_id]?.full_name || "—") : "—"}
                </p>
                <p className="text-xs text-gray-500 mt-2">Ratio</p>
                <p className="font-mono text-sm font-semibold text-red-600">
                  {deletingRow.ratio != null ? `${deletingRow.ratio}%` : "—"}
                </p>
              </div>
              {deleteError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {deleteError}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              取消
            </Button>
            <Button
              onClick={handleDeleteBV}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <div className="flex items-center gap-1">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                  刪除中...
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Trash2 className="w-4 h-4" />
                  確認刪除
                </div>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Set BV Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-[1520px] w-[min(96vw,1520px)] h-[min(94vh,920px)] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-gray-100 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-blue-500" />
              批量設定 BV Ratio
            </DialogTitle>
            {bulkGroup && (
              <p className="text-sm text-gray-500 mt-1">
                {bulkGroup.project?.project_name || "未知項目"}
                {bulkGroup.project?.project_code ? (
                  <span className="text-gray-400 ml-2">{bulkGroup.project.project_code}</span>
                ) : null}
              </p>
            )}
          </DialogHeader>

          {bulkGroup && (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(26rem,0.9fr)] min-h-0 flex-1 overflow-hidden">
              {/* LHS — BV ratio inputs */}
              <div className="flex flex-col border-r border-gray-100 min-h-0 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-50 bg-gray-50/60 shrink-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700">BV 負責人 Ratio</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        為本項目所有 BV 人員設定分配比率 · 點擊人員可展開已匯報工時任務 · 點擊「分析建議」套用至
                        Ratio
                      </p>
                      <p className="text-xs mt-1 text-[#b45309]">
                        「分析建議」= 工時 ÷ 總職位工時 × 份額，僅供工時分析參考 · 請同時對照右側 BV Logic
                        參考再分配 Ratio
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] px-2"
                        disabled={bulkSaving}
                        onClick={addBulkBvRow}
                        title="新增一筆 BV 記錄（須選擇負責人後才能儲存）"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        新增 BV
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] px-2"
                        disabled={bulkHoursLoading || bulkGroup.rows.length === 0}
                        onClick={applyAllBulkSuggestions}
                        title="將全部分析建議套用至 Ratio（未儲存）"
                      >
                        套用全部建議
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 mt-2 px-3 text-[11px] text-gray-400">
                    <span className="w-4 shrink-0" />
                    <span className="w-[13.5rem] shrink-0">人員</span>
                    <BulkCalcColHead widthClass="w-14" title="工時" />
                    <span className="w-3 shrink-0 text-center text-gray-300">÷</span>
                    <BulkCalcColHead
                      widthClass="w-[4.75rem]"
                      title="總工時"
                      sub={
                        bulkSuggest.roleSubLabel !== "—"
                          ? bulkSuggest.roleSubLabel
                          : undefined
                      }
                    />
                    <span className="w-3 shrink-0 text-center text-gray-300">×</span>
                    <BulkCalcColHead
                      widthClass="w-[4.75rem]"
                      title="份額"
                      sub={
                        bulkSuggest.roleSubLabel !== "—"
                          ? bulkSuggest.roleSubLabel
                          : undefined
                      }
                    />
                    <span className="w-3 shrink-0 text-center text-gray-300">=</span>
                    <BulkCalcColHead
                      widthClass="w-16"
                      title="分析建議"
                      titleClassName="text-[#b45309]"
                    />
                    <span className="flex-1 min-w-0" />
                    <BulkCalcColHead widthClass="w-24" title="Ratio" />
                    <span className="w-6 shrink-0" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                  {([
                    { key: "company", title: "BW Platform", rows: bulkRowsBySection.company },
                    { key: "pm", title: "PM", rows: bulkRowsBySection.pm },
                    { key: "design", title: "Design", rows: bulkRowsBySection.design },
                    { key: "other", title: "其他", rows: bulkRowsBySection.other },
                  ] as const).map((section) =>
                    section.rows.length === 0 ? null : (
                      <div key={section.key}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                          {section.title}
                        </p>
                        <div className="space-y-2">
                          {section.rows.map((row) => {
                            const handler = row.handler_id ? staffMap[row.handler_id] : null;
                            const team = row.n_team_type_id ? teamMap[row.n_team_type_id] : null;
                            const isCompany = row.handler_id === COMPANY_BV_HANDLER_ID;
                            const isDraft = isDraftBvRow(row);
                            const hasHandler = Boolean(row.handler_id);
                            const hours = row.handler_id
                              ? bulkStaffHours[row.handler_id] ?? 0
                              : null;
                            const tasks = row.handler_id
                              ? bulkStaffTasks[row.handler_id] ?? []
                              : [];
                            const isExpanded = bulkExpandedRows.has(row.id);
                            const canExpand = hasHandler && !bulkHoursLoading && !isDraft;
                            const calc = bulkSuggest.breakdown[row.id];
                            const roleHours = calc?.roleHours;
                            const share = calc?.share;
                            const handlerOptions = staff.filter((s) => {
                              if (s.id === COMPANY_BV_HANDLER_ID) return false;
                              if (s.status && s.status.toLowerCase() !== "active") return false;
                              const usedElsewhere = bulkGroup.rows.some(
                                (other) => other.id !== row.id && other.handler_id === s.id
                              );
                              return !usedElsewhere;
                            });
                            return (
                              <div
                                key={row.id}
                                className={`rounded-lg border bg-white overflow-hidden transition-colors ${
                                  isDraft && !hasHandler
                                    ? "border-amber-300 shadow-sm"
                                    : isExpanded
                                      ? "border-blue-200 shadow-sm"
                                      : isDraft
                                        ? "border-dashed border-blue-200"
                                        : "border-gray-100"
                                }`}
                              >
                                <div className="flex items-center gap-2 px-3 py-2">
                                  <button
                                    type="button"
                                    disabled={!canExpand}
                                    onClick={() => toggleBulkRowExpand(row.id)}
                                    className={`flex shrink-0 items-center gap-2 text-left rounded-md -ml-1 pl-1 py-0.5 ${
                                      canExpand
                                        ? "hover:bg-gray-50 cursor-pointer"
                                        : "cursor-default"
                                    }`}
                                  >
                                    <span className="w-4 shrink-0 flex items-center justify-center">
                                      {canExpand ? (
                                        isExpanded ? (
                                          <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5 text-gray-300" />
                                        )
                                      ) : null}
                                    </span>
                                    <div className="w-[13.5rem] min-w-0">
                                      {isDraft ? (
                                        <div onClick={(e) => e.stopPropagation()}>
                                          <Select
                                            value={row.handler_id || undefined}
                                            onValueChange={(value) =>
                                              setBulkDraftHandler(row.id, value)
                                            }
                                          >
                                            <SelectTrigger
                                              className={`h-8 text-xs ${
                                                hasHandler
                                                  ? "border-gray-200"
                                                  : "border-amber-400 focus:ring-amber-200"
                                              }`}
                                            >
                                              <SelectValue placeholder="選擇負責人..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {handlerOptions.map((s) => (
                                                <SelectItem key={s.id} value={s.id}>
                                                  {s.name || s.full_name || s.id}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          {handler?.position && (
                                            <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                                              {handler.position}
                                            </p>
                                          )}
                                        </div>
                                      ) : (
                                        <>
                                          <p className="text-sm font-medium text-gray-900 truncate">
                                            {handler?.name || handler?.full_name || "—"}
                                          </p>
                                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                            {isCompany ? (
                                              <span className="text-[11px] text-gray-400">
                                                {COMPANY_BV_DESCRIPTION}
                                              </span>
                                            ) : (
                                              <>
                                                {handler?.position && (
                                                  <span className="text-[11px] text-gray-400">
                                                    {handler.position}
                                                  </span>
                                                )}
                                                {team && section.key === "other" && (
                                                  <Badge
                                                    variant="secondary"
                                                    className="text-[10px] px-1 py-0"
                                                  >
                                                    {team}
                                                  </Badge>
                                                )}
                                              </>
                                            )}
                                            {!isCompany && tasks.length > 0 && (
                                              <span className="text-[10px] text-gray-400">
                                                {tasks.length} 筆
                                              </span>
                                            )}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                    <div
                                      className="w-14 shrink-0 text-right"
                                      title="本項目已匯報工時"
                                    >
                                      {bulkHoursLoading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-300 ml-auto" />
                                      ) : hasHandler && hours != null ? (
                                        <span
                                          className={`font-mono text-sm ${
                                            hours > 0 ? "text-gray-700" : "text-gray-300"
                                          }`}
                                        >
                                          {hours.toFixed(1)}
                                          <span className="text-xs text-gray-400 ml-0.5">h</span>
                                        </span>
                                      ) : (
                                        <span className="text-sm text-gray-300">—</span>
                                      )}
                                    </div>
                                  </button>
                                  <span className="w-3 shrink-0 text-center text-[11px] text-gray-300">
                                    ÷
                                  </span>
                                  <div
                                    className="w-[4.75rem] shrink-0 text-right"
                                    title="該職位全部人員工時合計"
                                  >
                                    {bulkHoursLoading ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-300 ml-auto" />
                                    ) : roleHours != null ? (
                                      <span
                                        className={`font-mono text-sm ${
                                          roleHours > 0 ? "text-gray-500" : "text-gray-300"
                                        }`}
                                      >
                                        {roleHours.toFixed(1)}
                                        <span className="text-xs text-gray-400 ml-0.5">h</span>
                                      </span>
                                    ) : (
                                      <span className="text-sm text-gray-300">—</span>
                                    )}
                                  </div>
                                  <span className="w-3 shrink-0 text-center text-[11px] text-gray-300">
                                    ×
                                  </span>
                                  <div
                                    className="w-[4.75rem] shrink-0 text-right"
                                    title="該職位分配份額（兩邊都有則平分剩餘；缺 PM 或 Designer 則該邊獲得全部剩餘）"
                                  >
                                    {bulkHoursLoading ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-300 ml-auto" />
                                    ) : share != null ? (
                                      <span className="font-mono text-sm text-gray-500">
                                        {share.toFixed(1)}%
                                      </span>
                                    ) : (
                                      <span className="text-sm text-gray-300">—</span>
                                    )}
                                  </div>
                                  <span className="w-3 shrink-0 text-center text-[11px] text-gray-300">
                                    =
                                  </span>
                                  <div
                                    className="w-16 shrink-0 text-right"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {bulkHoursLoading ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-300 ml-auto" />
                                    ) : bulkSuggestions[row.id] != null ? (
                                      <button
                                        type="button"
                                        onClick={() => applyBulkSuggestion(row.id)}
                                        title="點擊套用至 Ratio"
                                        className="font-mono text-sm text-amber-700 hover:text-amber-900 hover:underline underline-offset-2"
                                      >
                                        {bulkSuggestions[row.id].toFixed(1)}%
                                      </button>
                                    ) : (
                                      <span className="text-sm text-gray-300">—</span>
                                    )}
                                  </div>
                                  <span className="flex-1 min-w-0" />
                                  <div
                                    className="relative w-24 shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      max="100"
                                      value={bulkRatios[row.id] ?? ""}
                                      onChange={(e) =>
                                        setBulkRatios((prev) => ({
                                          ...prev,
                                          [row.id]: e.target.value,
                                        }))
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-full px-2 py-1.5 pr-7 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 font-mono text-sm text-right"
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                                      %
                                    </span>
                                  </div>
                                  {isDraft ? (
                                    <button
                                      type="button"
                                      onClick={() => removeBulkDraftRow(row.id)}
                                      title="移除未儲存的 BV 記錄"
                                      className="shrink-0 p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  ) : (
                                    <span className="w-6 shrink-0" />
                                  )}
                                </div>

                                {isExpanded && (
                                  <div className="border-t border-gray-100 bg-gray-50/70 px-3 py-2">
                                    {tasks.length === 0 ? (
                                      <p className="text-xs text-gray-400 py-2 text-center">
                                        此人員尚未於本項目匯報工時任務
                                      </p>
                                    ) : (
                                      <div className="max-h-56 overflow-y-auto rounded-md border border-gray-100 bg-white">
                                        <table className="w-full text-left">
                                          <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                                            <tr>
                                              <th className="text-[11px] font-semibold text-gray-500 px-2.5 py-1.5 whitespace-nowrap">
                                                日期
                                              </th>
                                              <th className="text-[11px] font-semibold text-gray-500 px-2.5 py-1.5">
                                                任務
                                              </th>
                                              <th className="text-[11px] font-semibold text-gray-500 px-2.5 py-1.5 text-right whitespace-nowrap">
                                                工時
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {tasks.map((task) => (
                                              <tr
                                                key={task.id}
                                                className="border-b border-gray-50 last:border-0 hover:bg-amber-50/40"
                                              >
                                                <td className="text-[12px] text-gray-500 font-mono px-2.5 py-1.5 whitespace-nowrap align-top">
                                                  {formatDate(
                                                    task.report_date || task.created_at
                                                  )}
                                                </td>
                                                <td className="text-[12px] text-gray-700 px-2.5 py-1.5 align-top">
                                                  <p className="leading-snug">
                                                    {task.task_description ||
                                                      task.task_name ||
                                                      "—"}
                                                  </p>
                                                  {task.task_type &&
                                                    !isBubbleId(task.task_type) && (
                                                      <span className="text-[10px] text-gray-400 mt-0.5 inline-block">
                                                        {task.task_type}
                                                      </span>
                                                    )}
                                                </td>
                                                <td className="text-[12px] font-mono font-semibold text-gray-800 px-2.5 py-1.5 text-right whitespace-nowrap align-top">
                                                  {task.work_hour.toFixed(1)}h
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )
                  )}
                  {bulkGroup.rows.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">此項目尚未有 BV 記錄</p>
                  )}
                  <button
                    type="button"
                    onClick={addBulkBvRow}
                    disabled={bulkSaving}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-200 py-2 text-xs text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    新增 BV 記錄
                  </button>
                </div>
                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/80 shrink-0 flex items-center justify-between">
                  <span className="text-xs text-gray-500">合計 Ratio</span>
                  <span
                    className={`font-mono font-semibold text-sm ${
                      Math.abs(bulkRatioTotal - 100) < 0.01
                        ? "text-emerald-600"
                        : bulkRatioTotal > 100
                          ? "text-red-600"
                          : "text-amber-600"
                    }`}
                  >
                    {bulkRatioTotal.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* RHS — reference sheet */}
              <div className="flex flex-col min-h-0 overflow-hidden bg-amber-50/30">
                <div className="px-5 py-3 border-b border-amber-100/80 shrink-0">
                  <p className="text-base font-semibold text-amber-900">2026/27</p>
                  <p className="text-xs text-amber-700/70 mt-0.5">BV Logic 參考（本年度適用）</p>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <div className="space-y-0.5 text-sm leading-snug text-gray-700">
                    {bvLogicLines(buMode).map((line, i) => {
                      if (line.kind === "intro") {
                        return (
                          <p key={i} className="text-xs text-gray-500 mb-3">
                            {line.text}
                          </p>
                        );
                      }
                      if (line.kind === "blank") {
                        return <div key={i} className="h-2" />;
                      }
                      if (line.kind === "note") {
                        return (
                          <p key={i} className="font-semibold text-gray-800 mt-1">
                            {line.text}
                          </p>
                        );
                      }
                      const isGroup = line.kind === "group";
                      return (
                        <div
                          key={i}
                          className={`flex items-start gap-3 ${isGroup ? "font-semibold text-gray-800" : "pl-3 text-gray-600"}`}
                        >
                          <span className="min-w-0 flex-1">{line.label}</span>
                          {line.pct ? (
                            <span className="shrink-0 font-mono tabular-nums text-gray-800">
                              {line.pct}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="px-6 py-4 border-t border-gray-100 shrink-0 space-y-2">
            {bulkError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {bulkError}
              </p>
            )}
            {bulkSuccess && (
              <p className="text-xs text-green-600 font-medium">{bulkSuccess}</p>
            )}
            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setBulkDialogOpen(false)}
                disabled={bulkSaving}
              >
                取消
              </Button>
              <Button
                onClick={handleBulkSave}
                disabled={bulkSaving || !bulkGroup?.rows.length}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {bulkSaving ? (
                  <div className="flex items-center gap-1">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    儲存中...
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Save className="w-4 h-4" />
                    儲存全部
                  </div>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
