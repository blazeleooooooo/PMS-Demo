"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Loader2,
  RefreshCw,
  HeartHandshake,
  FolderOpen,
  Truck,
  DollarSign,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProjectStatusBadge } from "@/components/ui/entity-status-badges";
import { Button } from "@/components/ui/button";
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
  fetchBniProjects,
  type BniProjectRow,
} from "@/lib/data/bni-projects";
import { formatDate } from "@/lib/date-utils";
import { useFinancialFormat } from "@/hooks/use-financial-format";

type SortField =
  | "latest_payment_date"
  | "project_code"
  | "project_name"
  | "customer_name"
  | "expense_category_name"
  | "supplier_name"
  | "entity"
  | "pm_name"
  | "installment_amount"
  | "status";
type SortDir = "asc" | "desc";

const PAGE_SIZES = [20, 50, 100];

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


function entityBadge(entity: "BWA" | "BWF") {
  if (entity === "BWA") {
    return (
      <Badge className="bg-blue-500 hover:bg-blue-500 text-white text-[12px] font-bold">
        BWA
      </Badge>
    );
  }
  return (
    <Badge className="bg-violet-500 hover:bg-violet-500 text-white text-[12px] font-bold">
      BWF
    </Badge>
  );
}

export default function BniProjectsList() {
  const { formatMoney } = useFinancialFormat();
  const [rows, setRows] = useState<BniProjectRow[]>([]);
  const [tagName, setTagName] = useState("BNI");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<"all" | "BWA" | "BWF">("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("latest_payment_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await fetchBniProjects();
    setRows(data.rows);
    setTagName(data.tag_name);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const supplierOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.supplier_id && !map.has(r.supplier_id)) {
        map.set(r.supplier_id, r.supplier_name || r.supplier_id);
      }
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (entityFilter !== "all" && r.entity !== entityFilter) return false;
      if (supplierFilter !== "all" && r.supplier_id !== supplierFilter)
        return false;
      if (!q) return true;
      const hay = [
        r.project_code,
        r.project_name,
        r.customer_name,
        r.expense_category_name,
        r.supplier_name,
        r.pm_name,
        r.status,
        r.entity,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, entityFilter, supplierFilter]);

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
  }, [search, entityFilter, supplierFilter, pageSize]);

  const kpi = useMemo(() => {
    const projectKeys = new Set(
      filtered.map((r) => `${r.entity}:${r.project_id}`)
    );
    const suppliers = new Set(filtered.map((r) => r.supplier_id));
    return {
      projects: projectKeys.size,
      suppliers: suppliers.size,
      installment: filtered.reduce((s, r) => s + r.installment_amount, 0),
      outstanding: filtered.reduce((s, r) => s + r.outstanding_amount, 0),
      pairs: filtered.length,
    };
  }, [filtered]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(
        field === "latest_payment_date" || field.includes("amount")
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

  const openProject = (row: BniProjectRow) => {
    const href =
      row.entity === "BWA"
        ? `/projects/bwa/${row.project_id}`
        : `/bwf/projects/${row.project_id}`;
    window.open(href, "_blank", "noopener");
  };

  const openSupplier = (supplierId: string) => {
    window.open(`/suppliers/${supplierId}`, "_blank", "noopener");
  };

  const clearFilters = () => {
    setSearch("");
    setEntityFilter("all");
    setSupplierFilter("all");
  };

  const hasFilters =
    search.trim() !== "" ||
    entityFilter !== "all" ||
    supplierFilter !== "all";

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <HeartHandshake className="w-6 h-6 text-rose-500" />
            BNI合作項目
            <Badge className="bg-rose-500 hover:bg-rose-500 text-white text-[12px] px-2 py-0 font-bold rounded-md ml-1">
              {tagName}
            </Badge>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            顯示支出供應商標籤為「{tagName}」的項目與供應商組合。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading}
          className="h-9 gap-1.5 text-[15px]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          重新整理
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={FolderOpen}
          label="合作項目數"
          value={kpi.projects}
          subLabel={`${kpi.pairs} 組項目×供應商`}
          color="bg-blue-500"
          borderColor="border-l-blue-500"
        />
        <StatCard
          icon={Truck}
          label="BNI供應商數"
          value={kpi.suppliers}
          color="bg-violet-500"
          borderColor="border-l-violet-500"
        />
        <StatCard
          icon={DollarSign}
          label="費用總額"
          value={formatMoney(kpi.installment)}
          color="bg-emerald-500"
          borderColor="border-l-emerald-500"
        />
        <StatCard
          icon={AlertCircle}
          label="未付金額"
          value={formatMoney(kpi.outstanding)}
          color="bg-amber-500"
          borderColor="border-l-amber-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋項目、客戶、供應商、PM…"
              className="pl-9 h-9"
            />
          </div>
          <Select
            value={entityFilter}
            onValueChange={(v) => setEntityFilter(v as "all" | "BWA" | "BWF")}
          >
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="系統" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部系統</SelectItem>
              <SelectItem value="BWA">BWA</SelectItem>
              <SelectItem value="BWF">BWF</SelectItem>
            </SelectContent>
          </Select>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-[240px] h-9">
              <SelectValue placeholder="供應商" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部供應商</SelectItem>
              {supplierOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 gap-1 text-gray-500"
            >
              <X className="w-3.5 h-3.5" />
              清除篩選
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            載入中…
          </div>
        ) : pageRows.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            沒有符合條件的 BNI 合作項目
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <SortHead field="entity">系統</SortHead>
                  <SortHead field="project_code" className="w-0 whitespace-nowrap">
                    項目編號
                  </SortHead>
                  <SortHead field="project_name">項目名稱</SortHead>
                  <SortHead field="customer_name">客戶</SortHead>
                  <SortHead field="expense_category_name">支出類別</SortHead>
                  <SortHead field="supplier_name" className="min-w-[260px] w-[280px]">
                    BNI供應商
                  </SortHead>
                  <SortHead field="pm_name" className="w-[110px] min-w-[110px]">
                    主要PM
                  </SortHead>
                  <SortHead field="installment_amount" className="text-right">
                    費用總額
                  </SortHead>
                  <SortHead field="latest_payment_date">最近付款</SortHead>
                  <SortHead field="status">狀態</SortHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-blue-50/40"
                    onClick={() => openProject(row)}
                  >
                    <TableCell>{entityBadge(row.entity)}</TableCell>
                    <TableCell className="w-0 font-mono text-[13px] text-gray-700 whitespace-nowrap">
                      {row.project_code || "—"}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <div className="truncate font-medium text-gray-900">
                        {row.project_name || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[160px]">
                      <div className="truncate text-gray-700">
                        {row.customer_name || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[140px]">
                      <div
                        className="truncate text-gray-700"
                        title={row.expense_category_name || undefined}
                      >
                        {row.expense_category_name || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[260px] w-[280px] max-w-[280px] pr-4 align-middle overflow-hidden">
                      <button
                        type="button"
                        title={row.supplier_name || undefined}
                        className="block w-full truncate text-left text-bw-blue hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openSupplier(row.supplier_id);
                        }}
                      >
                        {row.supplier_name || "—"}
                      </button>
                    </TableCell>
                    <TableCell className="w-[110px] min-w-[110px] max-w-[110px] align-middle overflow-hidden">
                      <div
                        className="truncate text-gray-700"
                        title={row.pm_name || undefined}
                      >
                        {row.pm_name || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono-num whitespace-nowrap">
                      {formatMoney(row.installment_amount)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-gray-600">
                      {row.latest_payment_date
                        ? formatDate(row.latest_payment_date)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <ProjectStatusBadge status={row.status} className="text-[13px]" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {!loading && sorted.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span>
                顯示 {(safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, sorted.length)} / {sorted.length}
              </span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => setPageSize(Number(v))}
              >
                <SelectTrigger className="w-[90px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}/頁
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={safePage <= 1}
                onClick={() => setPage(1)}
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="px-2 tabular-nums">
                {safePage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
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
    </div>
  );
}
