"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Loader2,
  RefreshCw,
  ClipboardCheck,
  Truck,
  AlertTriangle,
  FileWarning,
  Upload,
  Eye,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  X,
  FolderOpen,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchBrLabourUpdateList,
  uploadSupplierBrLabourFile,
  BR_LABOUR_AMOUNT_THRESHOLD,
  BR_LABOUR_LOOKBACK_MONTHS,
  type BrLabourDocKind,
  type BrLabourSupplierRow,
} from "@/lib/data/supplier-br-labour";
import { formatDate, isDatePast, parseDate } from "@/lib/date-utils";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";

type SortField =
  | "supplier_name"
  | "latest_project_name"
  | "project_count"
  | "total_installment_amount"
  | "max_project_amount"
  | "latest_expense_date"
  | "br_expiry_date"
  | "labour_insurance_expiry_date";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "needs_update" | "br_issue" | "labour_issue" | "ok";
type CriteriaFilter = "all" | "large" | "multi" | "both";

const PAGE_SIZES = [20, 50, 100];

function isExpirySoon(dateStr: string | null | undefined, days = 30): boolean {
  if (!dateStr || isDatePast(dateStr)) return false;
  const expiry = parseDate(dateStr);
  if (!expiry) return false;
  const limit = new Date();
  limit.setDate(limit.getDate() + days);
  limit.setHours(23, 59, 59, 999);
  return expiry <= limit;
}

function docStatus(expiry: string | null, valid: boolean): {
  label: string;
  className: string;
} {
  if (!expiry) {
    return {
      label: "未上傳",
      className: "bg-gray-100 text-gray-600 border-gray-200",
    };
  }
  if (!valid || isDatePast(expiry)) {
    return {
      label: "已過期",
      className: "bg-red-50 text-red-600 border-red-200",
    };
  }
  if (isExpirySoon(expiry)) {
    return {
      label: "即將到期",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  return {
    label: "有效",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
}

function DocActionCell({
  status,
  expiry,
  fileUrl,
  canUpload,
  onUpload,
}: {
  status: { label: string; className: string };
  expiry: string | null;
  fileUrl: string | null;
  canUpload: boolean;
  onUpload: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <Badge
        variant="outline"
        className={`${status.className} text-[12px] shrink-0`}
      >
        {status.label}
        {expiry ? ` · ${formatDate(expiry)}` : ""}
      </Badge>
      <TooltipProvider>
        {fileUrl && (
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-bw-blue hover:bg-blue-50"
                aria-label="檢視"
              >
                <Eye className="w-4 h-4" />
              </a>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">檢視</p>
            </TooltipContent>
          </Tooltip>
        )}
        {canUpload && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-600 hover:text-gray-900"
                onClick={onUpload}
                aria-label="上載"
              >
                <Upload className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">上載</p>
            </TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subLabel,
  color,
  borderColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subLabel?: string;
  color: string;
  borderColor: string;
}) {
  return (
    <div
      className={`bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 ${borderColor} transition-all hover:shadow-md`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-gray-500 truncate">{label}</p>
          <p className="text-xl font-bold text-gray-900 font-mono-num">{value}</p>
          {subLabel && (
            <p className="text-[13px] text-gray-400 mt-0.5">{subLabel}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BrLabourUpdateList() {
  const { formatMoney } = useFinancialFormat();
  const { profile } = useAuth();
  const { canEdit } = usePermission();
  const canUpload = canEdit("br-labour-update");

  const [rows, setRows] = useState<BrLabourSupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("needs_update");
  const [criteriaFilter, setCriteriaFilter] = useState<CriteriaFilter>("all");
  const [sortField, setSortField] = useState<SortField>("total_installment_amount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadKind, setUploadKind] = useState<BrLabourDocKind>("br");
  const [uploadRow, setUploadRow] = useState<BrLabourSupplierRow | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [institution, setInstitution] = useState("");
  const [codeNumber, setCodeNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await fetchBrLabourUpdateList();
    setRows(data.rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const brOk = r.br_valid;
      const labourOk = r.labour_insurance_valid;
      if (statusFilter === "needs_update" && brOk && labourOk) return false;
      if (statusFilter === "br_issue" && brOk) return false;
      if (statusFilter === "labour_issue" && labourOk) return false;
      if (statusFilter === "ok" && (!brOk || !labourOk)) return false;
      const isMulti = r.project_count > 1;
      if (criteriaFilter === "large" && !r.has_large_project) return false;
      if (criteriaFilter === "multi" && !isMulti) return false;
      if (criteriaFilter === "both" && !(r.has_large_project && isMulti))
        return false;
      if (!q) return true;
      const hay = [
        r.supplier_name,
        r.chinese_name,
        r.status,
        r.latest_project_name,
        r.latest_project_pm_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, statusFilter, criteriaFilter]);

  const kpi = useMemo(() => {
    let brIssue = 0;
    let labourIssue = 0;
    let either = 0;
    let totalInstallment = 0;
    for (const r of filtered) {
      totalInstallment += r.total_installment_amount;
      const brBad = !r.br_valid;
      const labourBad = !r.labour_insurance_valid;
      if (brBad) brIssue++;
      if (labourBad) labourIssue++;
      if (brBad || labourBad) either++;
    }
    return {
      supplier_count: filtered.length,
      br_expired_or_missing: brIssue,
      labour_expired_or_missing: labourIssue,
      either_needs_update: either,
      total_installment_amount: totalInstallment,
    };
  }, [filtered]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""), "zh-Hant");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, criteriaFilter, pageSize]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(
        field.includes("amount") ||
          field.includes("count") ||
          field.includes("date")
          ? "desc"
          : "asc"
      );
    }
  };

  const SortHead = ({
    field,
    children,
    className,
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <TableHead
      className={`cursor-pointer select-none whitespace-nowrap ${className ?? ""}`}
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown
          className={`w-3.5 h-3.5 ${
            sortField === field ? "text-bw-blue" : "text-gray-300"
          }`}
        />
      </span>
    </TableHead>
  );

  const openUpload = (row: BrLabourSupplierRow, kind: BrLabourDocKind) => {
    setUploadRow(row);
    setUploadKind(kind);
    setUploadFile(null);
    setFileName(kind === "br" ? "商業登記證明" : "勞工保險");
    setExpiryDate("");
    setInstitution(kind === "br" ? "稅務局" : "");
    setCodeNumber("");
    setUploadError(null);
    setUploadOpen(true);
  };

  const handleUpload = async () => {
    if (!uploadRow || !uploadFile) {
      setUploadError("請選擇檔案");
      return;
    }
    setSaving(true);
    setUploadError(null);
    const result = await uploadSupplierBrLabourFile({
      supplierId: uploadRow.supplier_id,
      kind: uploadKind,
      file: uploadFile,
      fileName,
      expiryDate,
      institution,
      codeNumber,
      createdById: profile?.id ?? null,
    });
    setSaving(false);
    if (!result.success) {
      setUploadError(result.error || "上傳失敗");
      return;
    }
    setUploadOpen(false);
    await loadData();
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("needs_update");
    setCriteriaFilter("all");
  };

  const hasFilters =
    search.trim() !== "" ||
    statusFilter !== "needs_update" ||
    criteriaFilter !== "all";
  const thresholdLabel = formatMoney(BR_LABOUR_AMOUNT_THRESHOLD, {
    showZero: true,
  });

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-bw-blue" />
            BR/勞保更新
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            近 {BR_LABOUR_LOOKBACK_MONTHS}{" "}
            個月支出中，單項目合計 ≥ {thresholdLabel}，或合作超過 1
            個項目的供應商 — 快速檢查商業登記 / 勞工保險並上載更新
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadData()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-1.5" />
          )}
          重新整理
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Truck}
          label="符合條件供應商"
          value={kpi.supplier_count}
          subLabel={`近${BR_LABOUR_LOOKBACK_MONTHS}個月 · 合計支出 ${formatMoney(kpi.total_installment_amount, { showZero: true })}`}
          color="bg-bw-blue"
          borderColor="border-l-bw-blue"
        />
        <StatCard
          icon={FileWarning}
          label="需更新（任一）"
          value={kpi.either_needs_update}
          subLabel="BR 或 勞保過期/未上傳"
          color="bg-amber-500"
          borderColor="border-l-amber-500"
        />
        <StatCard
          icon={AlertTriangle}
          label="BR 問題"
          value={kpi.br_expired_or_missing}
          subLabel="過期或未上傳"
          color="bg-rose-500"
          borderColor="border-l-rose-500"
        />
        <StatCard
          icon={FileWarning}
          label="勞保問題"
          value={kpi.labour_expired_or_missing}
          subLabel="過期或未上傳"
          color="bg-violet-500"
          borderColor="border-l-violet-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋供應商、項目、PM…"
            className="pl-9"
          />
        </div>
        <Select
          value={criteriaFilter}
          onValueChange={(v) => setCriteriaFilter(v as CriteriaFilter)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="篩選條件" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部條件</SelectItem>
            <SelectItem value="large">≥{thresholdLabel}</SelectItem>
            <SelectItem value="multi">多項目</SelectItem>
            <SelectItem value="both">兩者皆有</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="狀態篩選" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="needs_update">需更新</SelectItem>
            <SelectItem value="br_issue">BR 問題</SelectItem>
            <SelectItem value="labour_issue">勞保問題</SelectItem>
            <SelectItem value="ok">全部有效</SelectItem>
            <SelectItem value="all">全部</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" /> 清除
          </Button>
        )}
        <span className="text-sm text-gray-400 ml-auto">
          {sorted.length} 筆
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            載入中…
          </div>
        ) : pageRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <FolderOpen className="w-10 h-10 mb-2 opacity-40" />
            <p>沒有符合的供應商</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead field="supplier_name">供應商</SortHead>
                  <SortHead field="latest_project_name">最近項目</SortHead>
                  <TableHead className="whitespace-nowrap">篩選條件</TableHead>
                  <SortHead field="project_count" className="text-right">
                    項目數
                  </SortHead>
                  <SortHead
                    field="total_installment_amount"
                    className="text-right"
                  >
                    合計支出
                  </SortHead>
                  <SortHead field="max_project_amount" className="text-right">
                    最高單項
                  </SortHead>
                  <SortHead field="br_expiry_date">商業登記 BR</SortHead>
                  <SortHead field="labour_insurance_expiry_date">
                    勞工保險
                  </SortHead>
                  <SortHead field="latest_expense_date">最近支出</SortHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => {
                  const br = docStatus(row.br_expiry_date, row.br_valid);
                  const labour = docStatus(
                    row.labour_insurance_expiry_date,
                    row.labour_insurance_valid
                  );
                  return (
                    <TableRow key={row.supplier_id}>
                      <TableCell>
                        <button
                          type="button"
                          className="text-left hover:text-bw-blue"
                          onClick={() =>
                            window.open(
                              `/suppliers/${row.supplier_id}`,
                              "_blank",
                              "noopener"
                            )
                          }
                        >
                          <div className="font-medium text-gray-900 flex items-center gap-1">
                            {row.supplier_name || "—"}
                            <ExternalLink className="w-3 h-3 text-gray-300" />
                          </div>
                          {row.chinese_name &&
                            row.chinese_name !== row.supplier_name && (
                              <div className="text-xs text-gray-400">
                                {row.chinese_name}
                              </div>
                            )}
                        </button>
                      </TableCell>
                      <TableCell>
                        {row.latest_project_id ? (
                          <button
                            type="button"
                            className="text-left hover:text-bw-blue max-w-[220px]"
                            onClick={() =>
                              window.open(
                                row.latest_project_kind === "bwf"
                                  ? `/bwf/projects/${row.latest_project_id}`
                                  : `/projects/bwa/${row.latest_project_id}`,
                                "_blank",
                                "noopener"
                              )
                            }
                          >
                            <div className="font-medium text-gray-900 truncate flex items-center gap-1">
                              {row.latest_project_name || "—"}
                              <ExternalLink className="w-3 h-3 text-gray-300 shrink-0" />
                            </div>
                            {row.latest_project_pm_name && (
                              <div className="text-xs text-gray-400 truncate">
                                {row.latest_project_pm_name}
                              </div>
                            )}
                          </button>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.has_large_project && (
                            <Badge
                              variant="outline"
                              className="text-[11px] bg-rose-50 text-rose-700 border-rose-200"
                            >
                              ≥{thresholdLabel}
                            </Badge>
                          )}
                          {row.project_count > 1 && (
                            <Badge
                              variant="outline"
                              className="text-[11px] bg-blue-50 text-blue-700 border-blue-200"
                            >
                              多項目
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono-num">
                        {row.project_count}
                      </TableCell>
                      <TableCell className="text-right font-mono-num">
                        {formatMoney(row.total_installment_amount, {
                          showZero: true,
                        })}
                      </TableCell>
                      <TableCell className="text-right font-mono-num">
                        {formatMoney(row.max_project_amount, {
                          showZero: true,
                        })}
                      </TableCell>
                      <TableCell>
                        <DocActionCell
                          status={br}
                          expiry={row.br_expiry_date}
                          fileUrl={row.br_file_url}
                          canUpload={canUpload}
                          onUpload={() => openUpload(row, "br")}
                        />
                      </TableCell>
                      <TableCell>
                        <DocActionCell
                          status={labour}
                          expiry={row.labour_insurance_expiry_date}
                          fileUrl={row.labour_insurance_file_url}
                          canUpload={canUpload}
                          onUpload={() => openUpload(row, "labour_insurance")}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                        {row.latest_expense_date
                          ? formatDate(row.latest_expense_date)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {!loading && sorted.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span>每頁</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => setPageSize(Number(v))}
              >
                <SelectTrigger className="w-[80px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={safePage <= 1}
                onClick={() => setPage(1)}
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="px-2">
                {safePage} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={safePage >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              上載{uploadKind === "br" ? "商業登記 BR" : "勞工保險"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-gray-600">
              {uploadRow?.supplier_name || "—"}
            </p>
            <div>
              <Label className="text-sm font-medium">
                檔案名稱 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">
                到期日 <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">
                {uploadKind === "br" ? "發證機構" : "保險公司"}
              </Label>
              <Input
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder={
                  uploadKind === "br" ? "稅務局" : "Insurance Company Name"
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">
                {uploadKind === "br" ? "證書編號" : "保單號碼"}
              </Label>
              <Input
                value={codeNumber}
                onChange={(e) => setCodeNumber(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">
                檔案 <span className="text-red-500">*</span>
              </Label>
              <Input
                type="file"
                accept=".pdf,image/*"
                className="mt-1"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {uploadError && (
              <p className="text-sm text-red-600">{uploadError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadOpen(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button onClick={() => void handleUpload()} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-1.5" />
              )}
              上載
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
