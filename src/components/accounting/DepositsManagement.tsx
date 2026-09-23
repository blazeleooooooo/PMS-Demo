"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Loader2,
  RefreshCw,
  Search,
  Wallet,
  DollarSign,
  CheckCircle2,
  Filter,
  Check,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription} from "@/components/ui/dialog";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { useReportRange } from "@/components/reports/ReportDateRangeContext";
import { ReportSourceToggle } from "@/components/reports/ReportDateRangeBar";
import {
  confirmDepositRefund,
  fetchDepositConfirmIncomes,
  fetchDepositRows,
  type DepositIncomeOption,
  type DepositRow,
} from "@/lib/data/deposits";

function fmtDate(d: string | null): string {
  if (!d) return "-";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  } catch {
    return d;
  }
}

function projectDetailUrl(bwType: "BWA" | "BWF", projectId: string | null): string | null {
  if (!projectId) return null;
  return bwType === "BWF" ? `/bwf/projects/${projectId}` : `/projects/bwa/${projectId}`;
}

type SortField =
  | "pm_name"
  | "project_name"
  | "handover_date"
  | "supplier_type_label"
  | "supplier_name"
  | "paid_amount"
  | "latest_payment_date"
  | "confirm"
  | "refunded_amount"
  | "latest_receive_date";

type SortDir = "asc" | "desc";

function dateSortValue(d: string | null, dir: number): number {
  if (!d) return Number.POSITIVE_INFINITY * dir;
  const t = new Date(d).getTime();
  return isNaN(t) ? Number.POSITIVE_INFINITY * dir : t;
}

function compareDepositRows(a: DepositRow, b: DepositRow, field: SortField, dir: number): number {
  let cmp = 0;
  switch (field) {
    case "pm_name":
      cmp = (a.pm_name || "").localeCompare(b.pm_name || "", "zh-Hant");
      break;
    case "project_name":
      cmp = (a.project_name || "").localeCompare(b.project_name || "", "zh-Hant");
      break;
    case "handover_date":
      cmp = dateSortValue(a.handover_date, dir) - dateSortValue(b.handover_date, dir);
      break;
    case "supplier_type_label":
      cmp = (a.supplier_type_label || "").localeCompare(b.supplier_type_label || "", "zh-Hant");
      break;
    case "supplier_name":
      cmp = (a.supplier_name || "").localeCompare(b.supplier_name || "", "zh-Hant");
      break;
    case "paid_amount":
      cmp = (a.paid_amount || 0) - (b.paid_amount || 0);
      break;
    case "latest_payment_date":
      cmp = dateSortValue(a.latest_payment_date, dir) - dateSortValue(b.latest_payment_date, dir);
      break;
    case "confirm":
      cmp = Number(a.disappear) - Number(b.disappear);
      break;
    case "refunded_amount":
      cmp = (a.refunded_amount || 0) - (b.refunded_amount || 0);
      break;
    case "latest_receive_date":
      cmp = dateSortValue(a.latest_receive_date, dir) - dateSortValue(b.latest_receive_date, dir);
      break;
  }
  if (cmp !== 0) return cmp * dir;
  return (a.project_name || "").localeCompare(b.project_name || "", "zh-Hant");
}

export default function DepositsManagement() {
  const { formatMoney2 } = useFinancialFormat();
  const { canEdit } = usePermission();
  const { sources } = useReportRange();
  const sourceType: "BWA" | "BWF" = sources.bwf && !sources.bwa ? "BWF" : "BWA";
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [pmFilter, setPmFilter] = useState("all");
  const [confirmFilter, setConfirmFilter] = useState<"all" | "pending" | "confirmed">("all");
  const [sortField, setSortField] = useState<SortField>("confirm");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<DepositRow | null>(null);
  const [incomeOptions, setIncomeOptions] = useState<DepositIncomeOption[]>([]);
  const [selectedIncomeId, setSelectedIncomeId] = useState<string | null>(null);
  const [loadingIncomes, setLoadingIncomes] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const fetchDeposits = useCallback(async () => {
    setRefreshing(true);
    try {
      const rows = await fetchDepositRows();
      setDeposits(rows);
    } catch (err) {
      console.error("[Deposits] Unexpected error:", err);
    }
    setRefreshing(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDeposits();
  }, [fetchDeposits]);

  useEffect(() => {
    setPmFilter("all");
    setConfirmFilter("all");
    setSortField("confirm");
    setSortDir("asc");
  }, [sourceType]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1" />
    );
  };

  const sourceDeposits = useMemo(
    () => deposits.filter((d) => d.bw_type === sourceType),
    [deposits, sourceType]
  );

  const pmOptions = useMemo(() => {
    const pmSet = new Set<string>();
    sourceDeposits.forEach((d) => {
      if (d.pm_name) pmSet.add(d.pm_name);
    });
    return Array.from(pmSet).sort();
  }, [sourceDeposits]);

  const filteredDeposits = useMemo(() => {
    let result = sourceDeposits;

    if (confirmFilter === "pending") {
      result = result.filter((d) => !d.disappear);
    } else if (confirmFilter === "confirmed") {
      result = result.filter((d) => d.disappear);
    }

    if (pmFilter !== "all") {
      result = result.filter((d) => d.pm_name === pmFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          (d.project_name || "").toLowerCase().includes(q) ||
          (d.pm_name || "").toLowerCase().includes(q) ||
          (d.supplier_name || "").toLowerCase().includes(q)
      );
    }

    const dir = sortDir === "asc" ? 1 : -1;
    return [...result].sort((a, b) => compareDepositRows(a, b, sortField, dir));
  }, [sourceDeposits, confirmFilter, pmFilter, searchQuery, sortField, sortDir]);

  const kpiStats = useMemo(() => {
    const totalDeposits = filteredDeposits.length;
    const totalPaid = filteredDeposits.reduce((sum, d) => sum + (d.paid_amount || 0), 0);
    const totalRefunded = filteredDeposits.reduce((sum, d) => sum + (d.refunded_amount || 0), 0);
    return { totalDeposits, totalPaid, totalRefunded };
  }, [filteredDeposits]);

  const handleOpenConfirm = useCallback(async (row: DepositRow) => {
    if (row.pending_expense_ids.length === 0) return;
    setConfirmTarget(row);
    setSelectedIncomeId(null);
    setConfirmDialogOpen(true);
    setLoadingIncomes(true);
    setIncomeOptions([]);

    try {
      const data = await fetchDepositConfirmIncomes(row.resolved_project_id, row.bw_type);
      setIncomeOptions(data);
    } catch (err) {
      console.error("[Deposits] Unexpected income fetch error:", err);
    }
    setLoadingIncomes(false);
  }, []);

  const handleConfirmDisappear = useCallback(async () => {
    if (!confirmTarget || !selectedIncomeId) return;
    setConfirming(true);
    try {
      const { error } = await confirmDepositRefund(confirmTarget.pending_expense_ids);
      if (error) {
        alert("操作失敗：" + error);
      } else {
        setDeposits((prev) =>
          prev.map((d) =>
            d.id === confirmTarget.id
              ? { ...d, disappear: true, pending_expense_ids: [] }
              : d
          )
        );
        setConfirmDialogOpen(false);
        setConfirmTarget(null);
        setSelectedIncomeId(null);
      }
    } catch (err) {
      console.error("[Deposits] Unexpected confirm error:", err);
    }
    setConfirming(false);
  }, [confirmTarget, selectedIncomeId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bw-navy" style={{ fontFamily: "Syne, sans-serif" }}>
            BMO代付退款
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            BMO代付退款 — 管理所有 BMO 代付退款記錄
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchDeposits()}
          disabled={refreshing}
          className="gap-2"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          重新整理
        </Button>
      </div>

      <ReportSourceToggle />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs text-gray-500">按金筆數</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {kpiStats.totalDeposits}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-violet-600" />
            </div>
            <span className="text-xs text-gray-500">BW已付金額</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {formatMoney2(kpiStats.totalPaid)}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-xs text-gray-500">已退還金額</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {formatMoney2(kpiStats.totalRefunded)}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜尋項目、PM、供應商..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={pmFilter} onValueChange={setPmFilter}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="所有PM" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有PM</SelectItem>
              {pmOptions.map((pm) => (
                <SelectItem key={pm} value={pm}>
                  {pm}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={confirmFilter}
            onValueChange={(v) => setConfirmFilter(v as "all" | "pending" | "confirmed")}
          >
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="退還狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部退還狀態</SelectItem>
              <SelectItem value="pending">未退還</SelectItem>
              <SelectItem value="confirmed">已退還</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="gap-1.5 h-9"
          >
            <Filter className="w-3.5 h-3.5" />
            高級篩選
          </Button>
          <span className="text-xs text-gray-400 ml-auto">
            共 {filteredDeposits.length} 條記錄
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b">
                <th className="text-left px-4 py-3 font-medium text-xs text-gray-600 cursor-pointer select-none" onClick={() => toggleSort("pm_name")}>
                  <span className="flex items-center">項目經理 <SortIcon field="pm_name" /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-xs text-gray-600 cursor-pointer select-none" onClick={() => toggleSort("project_name")}>
                  <span className="flex items-center">項目 <SortIcon field="project_name" /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-xs text-gray-600 cursor-pointer select-none" onClick={() => toggleSort("handover_date")}>
                  <span className="flex items-center">交場日期 <SortIcon field="handover_date" /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-xs text-gray-600 cursor-pointer select-none" onClick={() => toggleSort("supplier_type_label")}>
                  <span className="flex items-center">類別 <SortIcon field="supplier_type_label" /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-xs text-gray-600 cursor-pointer select-none" onClick={() => toggleSort("supplier_name")}>
                  <span className="flex items-center">供應商 <SortIcon field="supplier_name" /></span>
                </th>
                <th className="text-right px-4 py-3 font-medium text-xs text-gray-600 cursor-pointer select-none" onClick={() => toggleSort("paid_amount")}>
                  <span className="flex items-center justify-end">BW已付金額 <SortIcon field="paid_amount" /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-xs text-gray-600 cursor-pointer select-none" onClick={() => toggleSort("latest_payment_date")}>
                  <span className="flex items-center">最新付款日期 <SortIcon field="latest_payment_date" /></span>
                </th>
                <th className="text-center px-4 py-3 font-medium text-xs text-gray-600 cursor-pointer select-none" onClick={() => toggleSort("confirm")}>
                  <span className="flex items-center justify-center">確認 <SortIcon field="confirm" /></span>
                </th>
                <th className="text-right px-4 py-3 font-medium text-xs text-gray-600 cursor-pointer select-none" onClick={() => toggleSort("refunded_amount")}>
                  <span className="flex items-center justify-end">已退還金額 <SortIcon field="refunded_amount" /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-xs text-gray-600 cursor-pointer select-none" onClick={() => toggleSort("latest_receive_date")}>
                  <span className="flex items-center">最新收款日期 <SortIcon field="latest_receive_date" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredDeposits.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-gray-400">
                    暫無BMO代付退款記錄
                  </td>
                </tr>
              ) : (
                filteredDeposits.map((row) => {
                  const detailUrl = projectDetailUrl(row.bw_type, row.resolved_project_id);
                  return (
                  <tr
                    key={row.id}
                    className="border-b last:border-b-0 hover:bg-gray-50/50 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <span className="text-gray-700 font-medium text-xs">
                        {row.pm_name || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[12px] px-1.5 py-0 ${
                            row.bw_type === "BWA"
                              ? "border-blue-300 text-blue-600 bg-blue-50"
                              : "border-amber-300 text-amber-600 bg-amber-50"
                          }`}
                        >
                          {row.bw_type}
                        </Badge>
                        {detailUrl ? (
                          <a
                            href={detailUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline truncate max-w-[200px]"
                            title="開啟項目詳情"
                          >
                            {row.project_name || "-"}
                          </a>
                        ) : (
                          <span className="text-gray-800 text-xs truncate max-w-[200px]">
                            {row.project_name || "-"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600 text-xs font-mono-num whitespace-nowrap">
                        {fmtDate(row.handover_date)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600 text-xs">
                        {row.supplier_type_label || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-700 text-xs truncate max-w-[160px] block">
                        {row.supplier_name || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-xs font-medium text-gray-800">
                        {formatMoney2(row.paid_amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600 text-xs font-mono-num whitespace-nowrap">
                        {fmtDate(row.latest_payment_date)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.disappear ? (
                        <Badge
                          variant="secondary"
                          className="text-[12px] bg-green-100 text-green-700"
                        >
                          已退還
                        </Badge>
                      ) : canEdit("deposits") ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 border-green-300 text-green-600 hover:bg-green-50 hover:text-green-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenConfirm(row);
                          }}
                          title="確認已退還"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-mono text-xs font-medium ${
                          (row.refunded_amount || 0) > 0 ? "text-emerald-700" : "text-gray-400"
                        }`}
                      >
                        {formatMoney2(row.refunded_amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600 text-xs font-mono-num whitespace-nowrap">
                        {fmtDate(row.latest_receive_date)}
                      </span>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredDeposits.length > 0 && (
          <div className="px-4 py-3 border-t bg-gray-50/50 flex items-center justify-between text-xs text-gray-500">
            <span>共 {filteredDeposits.length} 筆按金記錄</span>
            <span>
              BW已付：{formatMoney2(kpiStats.totalPaid)} | 已退還：{formatMoney2(kpiStats.totalRefunded)}
            </span>
          </div>
        )}
      </div>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>確認退還按金</DialogTitle>
            <DialogDescription>
              請選擇此項目的相關收入記錄以確認退還。確認後此按金將標記為已退還。
            </DialogDescription>
          </DialogHeader>

          {confirmTarget && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <p className="text-gray-500">
                  項目：<span className="font-medium text-gray-800">{confirmTarget.project_name || "-"}</span>
                </p>
                <p className="text-gray-500">
                  供應商：<span className="font-medium text-gray-800">{confirmTarget.supplier_name || "-"}</span>
                </p>
                <p className="text-gray-500">
                  BW已付金額：<span className="font-mono font-medium text-gray-800">{formatMoney2(confirmTarget.paid_amount)}</span>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  選擇相關收入 <span className="text-red-500">*</span>
                </label>
                {loadingIncomes ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    <span className="ml-2 text-sm text-gray-500">載入收入記錄...</span>
                  </div>
                ) : incomeOptions.length === 0 ? (
                  <div className="text-center py-6 text-sm text-gray-400">
                    此項目暫無可退還收入記錄
                  </div>
                ) : (
                  <div className="max-h-[240px] overflow-y-auto border rounded-lg divide-y">
                    {incomeOptions.map((income) => (
                      <label
                        key={income.id}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-blue-50/50 ${
                          selectedIncomeId === income.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="income-selection"
                          checked={selectedIncomeId === income.id}
                          onChange={() => setSelectedIncomeId(income.id)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-800">
                              {formatMoney2(income.income_amount)}
                            </span>
                            {income.invoice_number && (
                              <span className="text-[12px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                #{income.invoice_number}
                              </span>
                            )}
                            {income.type_display && (
                              <span className="text-[12px] text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">
                                {income.type_display}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[13px] text-gray-400">
                              {fmtDate(income.receive_date || income.created_date)}
                            </span>
                            {income.remark && (
                              <span className="text-[13px] text-gray-400 truncate max-w-[180px]">
                                {income.remark}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDialogOpen(false);
                setConfirmTarget(null);
                setSelectedIncomeId(null);
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleConfirmDisappear}
              disabled={!selectedIncomeId || confirming}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {confirming ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Check className="w-4 h-4 mr-1" />
              )}
              確認退還
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
