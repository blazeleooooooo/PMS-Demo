"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
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
  Truck,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  fetchConsolidationWarehouseOrders,
  type ConsolidationWarehouseOrderRow,
} from "@/lib/data-service";
import { formatDate } from "@/lib/date-utils";
import { usePermission } from "@/hooks/use-permission";
import BWFOrderDialog, { getOrderStatusChinese } from "@/components/projects/BWFOrderDialog";
import { BWFOrderEditButton } from "@/components/projects/BWFOrderEditButton";
import ArrangeDeliveryDialog from "@/components/consolidation/ArrangeDeliveryDialog";
import ListLogicPanel from "@/components/furniture/ListLogicPanel";

type SortField =
  | "project_code"
  | "project_name"
  | "pm_name"
  | "product_name"
  | "factory_name"
  | "production_finish_date"
  | "warehouse_name"
  | "site_arrival_date_est"
  | "status";
type SortDir = "asc" | "desc";

const PAGE_SIZES = [20, 50, 100];

function statusBadge(status: string | null, needsUpdate: boolean) {
  const chineseText = getOrderStatusChinese(status);
  if (needsUpdate) {
    return (
      <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-[13px] font-medium gap-1">
        <AlertCircle className="w-3 h-3" />
        {chineseText}
      </Badge>
    );
  }
  if (status === "Upcoming Deliveries") {
    return (
      <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100 text-[13px] font-medium">
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

export default function ConsolidationWarehouse() {
  const { canEdit, loading: permLoading } = usePermission();
  const [orders, setOrders] = useState<ConsolidationWarehouseOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "upcoming" | "needs_update">("all");
  const [sortField, setSortField] = useState<SortField>("production_finish_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await fetchConsolidationWarehouseOrders();
    setOrders(data);
    setSelectedIds(new Set());
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

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (factoryFilter !== "all") {
      result = result.filter((o) => o.factory_name === factoryFilter);
    }
    if (statusFilter === "upcoming") {
      result = result.filter((o) => o.status === "Upcoming Deliveries");
    } else if (statusFilter === "needs_update") {
      result = result.filter((o) => o.needs_status_update);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          (o.project_code && o.project_code.toLowerCase().includes(q)) ||
          (o.project_name && o.project_name.toLowerCase().includes(q)) ||
          (o.pm_name && o.pm_name.toLowerCase().includes(q)) ||
          (o.product_name && o.product_name.toLowerCase().includes(q)) ||
          (o.factory_name && o.factory_name.toLowerCase().includes(q)) ||
          (o.warehouse_name && o.warehouse_name.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [orders, factoryFilter, statusFilter, search]);

  const sortedOrders = useMemo(() => {
    const sorted = [...filteredOrders];
    sorted.sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[sortField];
      const bVal = (b as unknown as Record<string, unknown>)[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
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
  }, [search, factoryFilter, statusFilter, pageSize]);

  const pageIds = paginatedOrders.map((o) => o.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected =
    pageIds.some((id) => selectedIds.has(id)) && !allPageSelected;

  const toggleAllPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
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

  const kpi = useMemo(
    () => ({
      total: orders.length,
      upcoming: orders.filter((o) => o.status === "Upcoming Deliveries").length,
      needsUpdate: orders.filter((o) => o.needs_status_update).length,
    }),
    [orders],
  );

  const canArrange = canEdit("consolidation-warehouse") && !permLoading;

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-600" />
            集運倉
            <Badge className="bg-blue-600 text-white hover:bg-blue-600 text-[12px] px-2 py-0 font-bold rounded-md ml-1">
              BWF
            </Badge>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            管理物流及安排批量送貨至香港。Manage logistics and bulk delivery to Hong Kong.
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
          {canArrange && (
            <Button
              size="sm"
              className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={selectedIds.size === 0}
              onClick={() => setArrangeOpen(true)}
            >
              <Truck className="w-3.5 h-3.5" />
              安排送貨 ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      <ListLogicPanel pageId="consolidation-warehouse" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 border-l-blue-500">
          <p className="text-[15px] text-gray-500">待處理訂單</p>
          <p className="text-xl font-bold text-gray-900 font-mono-num">{kpi.total}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 border-l-sky-500">
          <p className="text-[15px] text-gray-500">準備送貨</p>
          <p className="text-xl font-bold text-gray-900 font-mono-num">{kpi.upcoming}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 border-l-orange-500">
          <p className="text-[15px] text-gray-500">待更新狀態</p>
          <p className="text-xl font-bold text-gray-900 font-mono-num">{kpi.needsUpdate}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜尋項目、產品、工廠、集運倉..."
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
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="w-[170px] h-9">
              <SelectValue placeholder="狀態篩選" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="upcoming">準備送貨</SelectItem>
              <SelectItem value="needs_update">待更新狀態</SelectItem>
            </SelectContent>
          </Select>
          {(search || factoryFilter !== "all" || statusFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setFactoryFilter("all");
                setStatusFilter("all");
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
            <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
          </div>
        ) : sortedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Truck className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">沒有符合條件的訂單</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                        onCheckedChange={toggleAllPage}
                        aria-label="全選本頁"
                      />
                    </TableHead>
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
                      onClick={() => toggleSort("production_finish_date")}
                    >
                      <span className="flex items-center">
                        生產完結 <SortIcon field="production_finish_date" />
                      </span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none min-w-[220px]"
                      onClick={() => toggleSort("warehouse_name")}
                    >
                      <span className="flex items-center">
                        集運倉 <SortIcon field="warehouse_name" />
                      </span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("site_arrival_date_est")}
                    >
                      <span className="flex items-center">
                        預計送貨 <SortIcon field="site_arrival_date_est" />
                      </span>
                    </TableHead>
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
                      className={`cursor-pointer hover:bg-gray-50/50 ${selectedIds.has(order.id) ? "bg-blue-50/40" : ""}`}
                      onClick={() => { setEditingOrderId(order.id); setDialogOpen(true); }}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(order.id)}
                          onCheckedChange={() => toggleOne(order.id)}
                          aria-label={`選取 ${order.project_code}`}
                        />
                      </TableCell>
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
                      <TableCell className="text-sm">{order.factory_name || "-"}</TableCell>
                      <TableCell className="text-sm font-mono whitespace-nowrap">
                        {order.production_finish_date
                          ? formatDate(order.production_finish_date)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm min-w-[220px]">
                        {order.warehouse_name || "-"}
                      </TableCell>
                      <TableCell className="text-sm font-mono whitespace-nowrap">
                        {order.site_arrival_date_est
                          ? formatDate(order.site_arrival_date_est)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {statusBadge(order.status, order.needs_status_update)}
                      </TableCell>
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
                  {selectedIds.size > 0 && ` · 已選 ${selectedIds.size} 筆`}
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

      <ArrangeDeliveryDialog
        open={arrangeOpen}
        orderIds={[...selectedIds]}
        onClose={() => setArrangeOpen(false)}
        onSaved={loadData}
      />

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
