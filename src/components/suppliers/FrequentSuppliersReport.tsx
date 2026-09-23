"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Search,
  ChevronDown,
  ChevronRight,
  Star,
  Sparkles,
  History,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  fetchFrequentSuppliersReport,
  type FrequentSupplierCohort,
  type FrequentSupplierRow,
  type FrequentSuppliersReportData,
} from "@/lib/data-service";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { useNavigate } from "@/hooks/use-navigate";

type SortField =
  | "display_name"
  | "project_count_12m"
  | "expense_count_12m"
  | "amount_12m"
  | "tenure_months"
  | "join_date"
  | "last_expense_date";

function fmtDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function frequencyLabel(row: FrequentSupplierRow): { label: string; className: string } {
  const n = row.project_count_12m;
  if (n >= 8) return { label: "高頻", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (n >= 3) return { label: "中頻", className: "bg-sky-50 text-sky-700 border-sky-200" };
  if (n >= 1) return { label: "低頻", className: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "未使用", className: "bg-gray-50 text-gray-500 border-gray-200" };
}

function cohortFilter(row: FrequentSupplierRow, cohort: FrequentSupplierCohort): boolean {
  if (cohort === "frequent") return row.expense_count_12m > 0;
  if (cohort === "new_3m") return row.is_new_3m;
  if (cohort === "long_12") return row.is_long_12;
  return row.is_long_24;
}

interface TypeGroup {
  typeId: string;
  typeLabel: string;
  rows: FrequentSupplierRow[];
  totalProjects: number;
  totalExpenses: number;
  totalAmount: number;
}

export default function FrequentSuppliersReport() {
  const { formatMoney } = useFinancialFormat();
  const { navigate } = useNavigate();

  const [data, setData] = useState<FrequentSuppliersReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cohort, setCohort] = useState<FrequentSupplierCohort>("frequent");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [sortField, setSortField] = useState<SortField>("project_count_12m");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await fetchFrequentSuppliersReport();
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.suppliers ?? []).filter((row) => {
      if (!cohortFilter(row, cohort)) return false;
      if (typeFilter !== "all") {
        const match =
          row.type_id === typeFilter || row.type_ids.includes(typeFilter);
        if (!match) return false;
      }
      if (q && !row.display_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, cohort, typeFilter, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const dir = sortAsc ? 1 : -1;
    list.sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "zh-Hant") * dir;
    });
    return list;
  }, [filtered, sortField, sortAsc]);

  const groups = useMemo((): TypeGroup[] => {
    const map = new Map<string, TypeGroup>();
    for (const row of sorted) {
      const typeId = row.type_id ?? "__none__";
      const typeLabel = row.type_label || "未分類";
      let g = map.get(typeId);
      if (!g) {
        g = {
          typeId,
          typeLabel,
          rows: [],
          totalProjects: 0,
          totalExpenses: 0,
          totalAmount: 0,
        };
        map.set(typeId, g);
      }
      g.rows.push(row);
      g.totalProjects += row.project_count_12m;
      g.totalExpenses += row.expense_count_12m;
      g.totalAmount += row.amount_12m;
    }

    const orderById = new Map(
      (data?.types ?? []).map((t, i) => [t.id, t.order ?? i])
    );
    return Array.from(map.values()).sort((a, b) => {
      if (b.totalProjects !== a.totalProjects) return b.totalProjects - a.totalProjects;
      const oa = orderById.get(a.typeId) ?? 9999;
      const ob = orderById.get(b.typeId) ?? 9999;
      if (oa !== ob) return oa - ob;
      return a.typeLabel.localeCompare(b.typeLabel, "zh-Hant");
    });
  }, [sorted, data?.types]);

  const handleExpandAll = () => {
    setCollapsed({});
  };

  const handleCollapseAll = () => {
    const next: Record<string, boolean> = {};
    for (const g of groups) next[g.typeId] = true;
    setCollapsed(next);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc((v) => !v);
    else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-300" />;
    return sortAsc
      ? <ArrowUp className="w-3 h-3 text-bw-blue" />
      : <ArrowDown className="w-3 h-3 text-bw-blue" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-bw-blue" />
        <span className="ml-3 text-gray-500">載入常用供應商報告...</span>
      </div>
    );
  }

  const summary = data?.summary ?? { used_12m: 0, new_3m: 0, long_12: 0, long_24: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">常用供應商報告</h1>
        <p className="text-sm text-gray-500 mt-1">
          按供應商分類檢視近 12 個月使用頻率；並標示過去 3 個月新合作、12／24 個月長期合作供應商。
          頻率以費用單（expenses）的項目數與筆數計算。
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          icon={<Star className="w-4 h-4 text-amber-500" />}
          label="近 12 個月有使用"
          value={summary.used_12m}
          active={cohort === "frequent"}
          onClick={() => setCohort("frequent")}
        />
        <SummaryCard
          icon={<Sparkles className="w-4 h-4 text-violet-500" />}
          label="新合作（3 個月）"
          value={summary.new_3m}
          active={cohort === "new_3m"}
          onClick={() => setCohort("new_3m")}
        />
        <SummaryCard
          icon={<History className="w-4 h-4 text-sky-500" />}
          label="長期合作（≥12 個月）"
          value={summary.long_12}
          active={cohort === "long_12"}
          onClick={() => setCohort("long_12")}
        />
        <SummaryCard
          icon={<History className="w-4 h-4 text-emerald-600" />}
          label="長期合作（≥24 個月）"
          value={summary.long_24}
          active={cohort === "long_24"}
          onClick={() => setCohort("long_24")}
        />
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
        <Tabs
          value={cohort}
          onValueChange={(v) => setCohort(v as FrequentSupplierCohort)}
        >
          <TabsList className="bg-gray-50 border border-gray-200 h-auto flex-wrap">
            <TabsTrigger value="frequent" className="text-xs">常用頻率</TabsTrigger>
            <TabsTrigger value="new_3m" className="text-xs">新合作 3 個月</TabsTrigger>
            <TabsTrigger value="long_12" className="text-xs">長期 12 個月</TabsTrigger>
            <TabsTrigger value="long_24" className="text-xs">長期 24 個月</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">供應商分類</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 text-sm w-64">
                <SelectValue placeholder="全部分類" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分類</SelectItem>
                {(data?.types ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-gray-500">搜尋供應商</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="顯示名稱..."
                className="h-9 text-sm pl-8"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pb-2 ml-auto">
            {groups.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="text-xs font-medium text-gray-600 hover:text-bw-blue transition-colors px-2 py-1.5 rounded bg-gray-50 hover:bg-gray-100 border border-gray-200 shadow-sm"
                >
                  全部展開
                </button>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="text-xs font-medium text-gray-600 hover:text-bw-blue transition-colors px-2 py-1.5 rounded bg-gray-50 hover:bg-gray-100 border border-gray-200 shadow-sm"
                >
                  全部摺疊
                </button>
              </>
            )}
            <span className="text-xs text-gray-500">
              顯示 {sorted.length} 間 · {groups.length} 個分類
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          新合作：加入日期（join date）在過去 3 個月內。長期合作：首次費用早於 12／24 個月，且近 12 個月仍有費用。
          高頻 ≥8 個項目／年 · 中頻 3–7 · 低頻 1–2。
        </p>
      </div>

      {/* Grouped by type */}
      {groups.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg py-16 text-center text-gray-400 text-sm">
          此條件下沒有供應商
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const isCollapsed = !!collapsed[g.typeId];
            return (
              <div
                key={g.typeId}
                className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
              >
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50/80 hover:bg-gray-50 text-left"
                  onClick={() =>
                    setCollapsed((prev) => ({
                      ...prev,
                      [g.typeId]: !prev[g.typeId],
                    }))
                  }
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  )}
                  <span className="font-semibold text-gray-900 text-sm">{g.typeLabel}</span>
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {g.rows.length} 間
                  </Badge>
                  <span className="ml-auto text-xs text-gray-500 flex flex-wrap gap-x-3">
                    <span>{g.totalProjects} 項目／12月</span>
                    <span>{g.totalExpenses} 筆費用</span>
                    <span>{formatMoney(g.totalAmount)}</span>
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <SortableHead field="display_name" label="供應商" onClick={toggleSort} icon={<SortIcon field="display_name" />} />
                          <TableHead className="text-xs whitespace-nowrap">頻率</TableHead>
                          <SortableHead field="project_count_12m" label="項目數 12月" onClick={toggleSort} icon={<SortIcon field="project_count_12m" />} align="right" />
                          <SortableHead field="expense_count_12m" label="費用筆數 12月" onClick={toggleSort} icon={<SortIcon field="expense_count_12m" />} align="right" />
                          <SortableHead field="amount_12m" label="金額 12月" onClick={toggleSort} icon={<SortIcon field="amount_12m" />} align="right" />
                          <SortableHead field="tenure_months" label="合作月數" onClick={toggleSort} icon={<SortIcon field="tenure_months" />} align="right" />
                          <SortableHead field="join_date" label="加入日期" onClick={toggleSort} icon={<SortIcon field="join_date" />} />
                          <SortableHead field="last_expense_date" label="最近使用" onClick={toggleSort} icon={<SortIcon field="last_expense_date" />} />
                          <TableHead className="text-xs whitespace-nowrap">標記</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.rows.map((row) => {
                          const freq = frequencyLabel(row);
                          return (
                            <TableRow
                              key={row.id}
                              className="cursor-pointer"
                              onClick={(e) => navigate(`/suppliers/${row.id}`, e)}
                            >
                              <TableCell className="text-sm font-medium text-gray-900 max-w-[220px]">
                                <div className="truncate" title={row.display_name}>
                                  {row.display_name}
                                </div>
                                {row.real_level && (
                                  <div className="text-[11px] text-gray-400 mt-0.5">
                                    Level {row.real_level}
                                    {row.status ? ` · ${row.status}` : ""}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-[11px] ${freq.className}`}>
                                  {freq.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-right tabular-nums">
                                {row.project_count_12m}
                              </TableCell>
                              <TableCell className="text-sm text-right tabular-nums">
                                {row.expense_count_12m}
                              </TableCell>
                              <TableCell className="text-sm text-right tabular-nums whitespace-nowrap">
                                {formatMoney(row.amount_12m)}
                              </TableCell>
                              <TableCell className="text-sm text-right tabular-nums text-gray-600">
                                {row.tenure_months != null ? `${row.tenure_months}m` : "—"}
                              </TableCell>
                              <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                                {fmtDate(row.join_date)}
                              </TableCell>
                              <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                                {fmtDate(row.last_expense_date)}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {row.is_new_3m && (
                                    <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200">
                                      新
                                    </Badge>
                                  )}
                                  {row.is_long_24 && (
                                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                      24m+
                                    </Badge>
                                  )}
                                  {!row.is_long_24 && row.is_long_12 && (
                                    <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">
                                      12m+
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border p-4 shadow-sm transition-colors ${
        active
          ? "border-bw-blue bg-blue-50/60 ring-1 ring-bw-blue/30"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
    </button>
  );
}

function SortableHead({
  field,
  label,
  onClick,
  icon,
  align,
}: {
  field: SortField;
  label: string;
  onClick: (f: SortField) => void;
  icon: React.ReactNode;
  align?: "right";
}) {
  return (
    <TableHead className={`text-xs whitespace-nowrap ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        className={`inline-flex items-center gap-1 hover:text-gray-900 ${
          align === "right" ? "ml-auto" : ""
        }`}
        onClick={() => onClick(field)}
      >
        {label}
        {icon}
      </button>
    </TableHead>
  );
}
