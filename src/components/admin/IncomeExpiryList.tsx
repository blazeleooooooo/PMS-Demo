"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ProjectFilterBar, {
  applyProjectFilters,
  EMPTY_PROJECT_FILTERS,
  type ProjectFilterState,
} from "@/components/reports/ProjectFilterBar";
import {
  fetchIncomesWithExpiryReason,
  type IncomeExpiryRow,
  type IncomeExpirySource,
} from "@/lib/data/income-expiry";
import { formatMoney, toHkYmd } from "@/lib/date-utils";

type SortField =
  | "project_code"
  | "project_name"
  | "pm_name"
  | "cost_centre_bu_code"
  | "installment_label"
  | "income_amount"
  | "due_date"
  | "expected_payment_date"
  | "expiry_reason"
  | "payment_status";

function paymentStatusStyle(status: string | null): string {
  switch ((status || "").trim().toLowerCase()) {
    case "zoho completed":
      return "bg-emerald-800 text-emerald-50 border-emerald-900";
    case "received":
      return "bg-green-50 text-green-700 border-green-200";
    case "pending check":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "not received":
      return "bg-red-50 text-red-600 border-red-200";
    case "bounced payment":
      return "bg-orange-50 text-orange-700 border-orange-200";
    default:
      return "bg-gray-50 text-gray-500 border-gray-200";
  }
}

function fmtDate(d: string | null): string {
  const ymd = toHkYmd(d);
  return ymd ? ymd.replace(/-/g, "/") : "—";
}

function projectHref(row: IncomeExpiryRow): string | null {
  if (!row.project_id) return null;
  return row.bw_type === "BWF"
    ? `/bwf/projects/${row.project_id}`
    : `/projects/bwa/${row.project_id}`;
}

export default function IncomeExpiryList() {
  const [rows, setRows] = useState<IncomeExpiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ProjectFilterState>(EMPTY_PROJECT_FILTERS);
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | IncomeExpirySource>("all");
  const [sortField, setSortField] = useState<SortField>("due_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  async function load() {
    setLoading(true);
    try {
      setRows(await fetchIncomesWithExpiryReason());
    } catch {
      setRows([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const reasonOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      if (!seen.has(row.expiry_reason_id)) {
        seen.set(row.expiry_reason_id, row.expiry_reason || "未命名");
      }
    }
    return [...seen.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"));
  }, [rows]);

  const visibleRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const projectFiltered = applyProjectFilters(rows, {
      ...filters,
      search: "",
    });
    const result = projectFiltered.filter((row) => {
      if (reasonFilter !== "all" && row.expiry_reason_id !== reasonFilter) return false;
      if (sourceFilter !== "all" && row.bw_type !== sourceFilter) return false;
      if (!search) return true;
      return (
        (row.project_code && row.project_code.toLowerCase().includes(search)) ||
        (row.project_name && row.project_name.toLowerCase().includes(search)) ||
        (row.pm_name && row.pm_name.toLowerCase().includes(search)) ||
        (row.installment_label && row.installment_label.toLowerCase().includes(search)) ||
        (row.invoice_number && row.invoice_number.toLowerCase().includes(search)) ||
        (row.contract_type_label && row.contract_type_label.toLowerCase().includes(search)) ||
        (row.expiry_reason && row.expiry_reason.toLowerCase().includes(search)) ||
        (row.cost_centre_bu_code && row.cost_centre_bu_code.toLowerCase().includes(search))
      );
    });

    const valueFor = (r: IncomeExpiryRow): number | string => {
      switch (sortField) {
        case "project_code":
          return (r.project_code || "").toLowerCase();
        case "project_name":
          return (r.project_name || "").toLowerCase();
        case "pm_name":
          return (r.pm_name || "").toLowerCase();
        case "cost_centre_bu_code":
          return (r.cost_centre_bu_code || "").toLowerCase();
        case "installment_label":
          return (r.installment_label || "").toLowerCase();
        case "income_amount":
          return r.income_amount ?? 0;
        case "due_date":
          return r.due_date ? new Date(r.due_date).getTime() : 0;
        case "expected_payment_date":
          return r.expected_payment_date ? new Date(r.expected_payment_date).getTime() : 0;
        case "expiry_reason":
          return (r.expiry_reason || "").toLowerCase();
        case "payment_status":
          return (r.payment_status || "").toLowerCase();
      }
    };

    return [...result].sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
  }, [rows, filters, reasonFilter, sourceFilter, sortField, sortDir]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(
        field === "due_date" || field === "expected_payment_date" || field === "income_amount"
          ? "desc"
          : "asc"
      );
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field)
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30 inline" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 ml-1 text-bw-blue inline" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 text-bw-blue inline" />
    );
  }

  function Th({
    field,
    children,
    right,
  }: {
    field: SortField;
    children: React.ReactNode;
    right?: boolean;
  }) {
    return (
      <TableHead
        className={`text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap ${right ? "text-right" : ""}`}
        onClick={() => handleSort(field)}
      >
        <span className={`flex items-center gap-0.5 ${right ? "justify-end" : ""}`}>
          {children}
          <SortIcon field={field} />
        </span>
      </TableHead>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-6 h-6 text-amber-500" />
            逾期收入原因
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            列出所有已填寫逾期原因的收入紀錄（到期日已過並選擇了逾期原因）。
            {!loading && (
              <span className="ml-1 text-gray-400">共 {rows.length} 筆。</span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-9 gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 重新整理
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={sourceFilter}
          onValueChange={(v) => setSourceFilter(v as "all" | IncomeExpirySource)}
        >
          <SelectTrigger className="w-[140px] h-9 text-sm bg-white">
            <SelectValue placeholder="來源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部來源</SelectItem>
            <SelectItem value="BWA">BWA</SelectItem>
            <SelectItem value="BWF">BWF</SelectItem>
          </SelectContent>
        </Select>
        <Select value={reasonFilter} onValueChange={setReasonFilter}>
          <SelectTrigger className="w-[220px] h-9 text-sm bg-white">
            <SelectValue placeholder="逾期原因" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部逾期原因</SelectItem>
            {reasonOptions.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ProjectFilterBar projects={rows} value={filters} onChange={setFilters} />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-bw-blue" />
          <span className="ml-3 text-gray-500 text-sm">載入收入資料...</span>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <Th field="project_code">項目編號</Th>
                  <Th field="project_name">項目名稱</Th>
                  <Th field="pm_name">主要PM</Th>
                  <Th field="cost_centre_bu_code">BU</Th>
                  <Th field="installment_label">款項期數</Th>
                  <Th field="income_amount" right>金額</Th>
                  <Th field="due_date">到期日</Th>
                  <Th field="expected_payment_date">預計收款</Th>
                  <Th field="expiry_reason">逾期原因</Th>
                  <Th field="payment_status">收款狀態</Th>
                  <TableHead className="text-xs font-semibold text-gray-600 text-right whitespace-nowrap">
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-16 text-gray-400">
                      {rows.length === 0
                        ? "目前沒有已填寫逾期原因的收入"
                        : "沒有找到符合條件的收入"}
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((row) => {
                    const href = projectHref(row);
                    return (
                      <TableRow
                        key={row.id}
                        className="hover:bg-gray-50/80 border-b border-gray-100"
                      >
                        <TableCell className="text-sm font-medium text-gray-900 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className={`inline-block text-[10px] leading-tight px-1.5 py-0.5 rounded border font-semibold ${
                                row.bw_type === "BWF"
                                  ? "bg-violet-50 text-violet-700 border-violet-200"
                                  : "bg-sky-50 text-sky-700 border-sky-200"
                              }`}
                            >
                              {row.bw_type}
                            </span>
                            {row.project_code || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-700 max-w-[220px] truncate">
                          {row.project_name || "(未命名)"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                          {row.pm_name || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                          {row.cost_centre_bu_code || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                          {row.installment_label || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono whitespace-nowrap">
                          {formatMoney(row.income_amount, { fallback: "—" })}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500 font-mono whitespace-nowrap">
                          {fmtDate(row.due_date)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500 font-mono whitespace-nowrap">
                          {fmtDate(row.expected_payment_date)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {row.expiry_reason ? (
                            <span className="inline-block text-[11px] leading-tight px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-800">
                              {row.expiry_reason}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {row.payment_status ? (
                            <span
                              className={`inline-block text-[11px] leading-tight px-2.5 py-1 rounded-md border font-medium ${paymentStatusStyle(row.payment_status)}`}
                            >
                              {row.payment_status}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {href ? (
                            <button
                              onClick={() => window.open(href, "_blank", "noopener")}
                              className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              title="開啟項目"
                            >
                              開啟項目 <ExternalLink className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-gray-300 text-sm">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
