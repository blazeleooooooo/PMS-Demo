"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  fetchPaidPendingOrders,
  type PaidPendingOrderRow,
} from "@/lib/data-service";
import { formatDate, formatMoney } from "@/lib/date-utils";
import BWFOrderDialog, { getOrderStatusChinese } from "@/components/projects/BWFOrderDialog";
import { BWFOrderEditButton } from "@/components/projects/BWFOrderEditButton";
import ListLogicPanel from "@/components/furniture/ListLogicPanel";

type SortField =
  | "project_code"
  | "project_name"
  | "pm_name"
  | "product_name"
  | "factory_name"
  | "production_finish_date_est"
  | "site_arrival_date_est"
  | "paid_income_total"
  | "created_date"
  | "status";
type SortDir = "asc" | "desc";

const PAGE_SIZES = [20, 50, 100];

const DELIVERY_LABELS: Record<string, string> = {
  Factory: "廠商",
  Warehouse: "倉庫",
  Client: "客戶",
};

function statusBadge(status: string | null) {
  const chineseText = getOrderStatusChinese(status);
  if (status === "Pending Orders") {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[13px] font-medium">
        {chineseText}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[13px]">
      {chineseText}
    </Badge>
  );
}

export default function PaidPendingOrders() {
  const [orders, setOrders] = useState<PaidPendingOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [pmFilter, setPmFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("created_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await fetchPaidPendingOrders();
    setOrders(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const factoryOptions = useMemo(() => {
    return Array.from(
      new Set(orders.map((o) => o.factory_name).filter((x): x is string => !!x)),
    ).sort();
  }, [orders]);

  const pmOptions = useMemo(() => {
    return Array.from(
      new Set(orders.map((o) => o.pm_name).filter((x): x is string => !!x)),
    ).sort();
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (factoryFilter !== "all") {
      result = result.filter((o) => o.factory_name === factoryFilter);
    }
    if (pmFilter !== "all") {
      result = result.filter((o) => o.pm_name === pmFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          (o.project_code && o.project_code.toLowerCase().includes(q)) ||
          (o.project_name && o.project_name.toLowerCase().includes(q)) ||
          (o.pm_name && o.pm_name.toLowerCase().includes(q)) ||
          (o.product_name && o.product_name.toLowerCase().includes(q)) ||
          (o.factory_name && o.factory_name.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [orders, factoryFilter, pmFilter, search]);

  const sortedOrders = useMemo(() => {
    const sorted = [...filteredOrders];
    sorted.sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[sortField];
      const bVal = (b as unknown as Record<string, unknown>)[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal), "zh-HK");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredOrders, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedOrders.slice(start, start + pageSize);
  }, [sortedOrders, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, factoryFilter, pmFilter, pageSize]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "paid_income_total" || field === "created_date" ? "desc" : "asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1" />
    );
  };

  const kpi = useMemo(() => {
    const projectIds = new Set(orders.map((o) => o.project_id).filter(Boolean));
    return {
      total: orders.length,
      projects: projectIds.size,
    };
  }, [orders]);

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Banknote className="w-6 h-6 text-emerald-600" />
            已收款待下單
            <Badge className="bg-yellow-500 text-white hover:bg-yellow-500 text-[12px] px-2 py-0 font-bold rounded-md ml-1">
              BWF
            </Badge>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            客人已付款但仍未向工廠下單的訂單。Paid by client, not yet ordered from factory.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-9 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            重新整理
          </Button>
        </div>
      </div>

      <ListLogicPanel pageId="paid-pending-orders" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 border-l-emerald-500">
          <p className="text-[15px] text-gray-500">待下單訂單</p>
          <p className="text-xl font-bold text-gray-900 font-mono-num">{kpi.total}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 border-l-amber-500">
          <p className="text-[15px] text-gray-500">涉及項目</p>
          <p className="text-xl font-bold text-gray-900 font-mono-num">{kpi.projects}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜尋項目、產品、工廠、PM..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={factoryFilter} onValueChange={setFactoryFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="工廠" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有工廠</SelectItem>
              {factoryOptions.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={pmFilter} onValueChange={setPmFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="PM" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有 PM</SelectItem>
              {pmOptions.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(search || factoryFilter !== "all" || pmFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setFactoryFilter("all");
                setPmFilter("all");
              }}
              className="h-9 text-red-500"
            >
              <X className="w-3.5 h-3.5 mr-1" /> 清除篩選
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
          </div>
        ) : sortedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Banknote className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">沒有符合條件的訂單</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("project_code")}
                    >
                      <span className="flex items-center">
                        項目編號 <SortIcon field="project_code" />
                      </span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("project_name")}
                    >
                      <span className="flex items-center">
                        項目名稱 <SortIcon field="project_name" />
                      </span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("pm_name")}
                    >
                      <span className="flex items-center">
                        PM <SortIcon field="pm_name" />
                      </span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("product_name")}
                    >
                      <span className="flex items-center">
                        產品 <SortIcon field="product_name" />
                      </span>
                    </TableHead>
                    <TableHead className="text-center">數量</TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("factory_name")}
                    >
                      <span className="flex items-center">
                        工廠 <SortIcon field="factory_name" />
                      </span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("paid_income_total")}
                    >
                      <span className="flex items-center">
                        已收款 <SortIcon field="paid_income_total" />
                      </span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("production_finish_date_est")}
                    >
                      <span className="flex items-center">
                        預計完產 <SortIcon field="production_finish_date_est" />
                      </span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("site_arrival_date_est")}
                    >
                      <span className="flex items-center">
                        預計到場 <SortIcon field="site_arrival_date_est" />
                      </span>
                    </TableHead>
                    <TableHead>送貨目標</TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("status")}
                    >
                      <span className="flex items-center">
                        狀態 <SortIcon field="status" />
                      </span>
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-gray-50/50"
                      onClick={() => { setEditingOrderId(order.id); setDialogOpen(true); }}
                    >
                      <TableCell className="font-mono text-sm">
                        {order.project_code || "-"}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm">
                        {order.project_name || "-"}
                      </TableCell>
                      <TableCell className="text-sm">{order.pm_name || "-"}</TableCell>
                      <TableCell className="max-w-[160px] truncate text-sm">
                        {order.product_name || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-center font-mono">
                        {order.quantity ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm">{order.factory_name || "-"}</TableCell>
                      <TableCell className="text-sm font-mono text-emerald-700 whitespace-nowrap">
                        {formatMoney(order.paid_income_total)}
                      </TableCell>
                      <TableCell className="text-sm font-mono whitespace-nowrap">
                        {order.production_finish_date_est
                          ? formatDate(order.production_finish_date_est)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm font-mono whitespace-nowrap">
                        {order.site_arrival_date_est
                          ? formatDate(order.site_arrival_date_est)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.o_delivery_target
                          ? DELIVERY_LABELS[order.o_delivery_target] || order.o_delivery_target
                          : "-"}
                      </TableCell>
                      <TableCell>{statusBadge(order.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-center" onClick={(e) => e.stopPropagation()}>
                          <BWFOrderEditButton
                            onClick={() => { setEditingOrderId(order.id); setDialogOpen(true); }}
                          />
                          {order.project_id && (
                            <a
                              href={`/bwf/projects/${order.project_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100"
                              title="開啟項目"
                            >
                              <ExternalLink className="w-4 h-4 text-gray-500" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">每頁</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="w-[70px] h-7 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-400">
                  顯示 {(currentPage - 1) * pageSize + 1}–
                  {Math.min(currentPage * pageSize, sortedOrders.length)} / 共{" "}
                  {sortedOrders.length} 筆
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="text-sm text-gray-500 px-2">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <BWFOrderDialog
        open={dialogOpen}
        orderId={editingOrderId}
        onClose={() => {
          setDialogOpen(false);
          setEditingOrderId(null);
        }}
        onSaved={loadData}
      />
    </div>
  );
}
