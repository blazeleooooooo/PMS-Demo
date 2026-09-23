"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Package,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  ArrowUpDown,
  Clock,
  CheckCircle2,
  ExternalLink,
  Plus} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue} from "@/components/ui/select";
import { fetchBWFOrders, type BWFOrderListRow } from "@/lib/data-service";
import { formatDate } from "@/lib/date-utils";
import { usePermission } from "@/hooks/use-permission";
import BWFOrderDialog, { getOrderStatusChinese } from "@/components/projects/BWFOrderDialog";
import { BWFOrderEditButton } from "@/components/projects/BWFOrderEditButton";

type SortField =
  | "project_code"
  | "project_name"
  | "pm_name"
  | "product_name"
  | "quantity"
  | "factory_name"
  | "est_delivery_date"
  | "est_installation_date"
  | "actual_installation_date"
  | "status";
type SortDir = "asc" | "desc";

const PAGE_SIZES = [20, 50, 100];

// ─── STAT CARD ─────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  subLabel,
  color,
  borderColor}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subLabel?: string;
  color: string;
  borderColor: string;
}) {
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 ${borderColor} transition-all hover:shadow-md`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-gray-500 truncate">{label}</p>
          <p className="text-xl font-bold text-gray-900 font-mono-num">{value}</p>
          {subLabel && <p className="text-[13px] text-gray-400 mt-0.5">{subLabel}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── STATUS BADGE ────────────────────────────────────
function statusBadge(status: string | null) {
  if (!status) return <Badge variant="outline" className="text-gray-400 text-[13px]">未設定</Badge>;
  const s = status.toLowerCase();
  const chineseText = getOrderStatusChinese(status);
  if (status === "暫時完結" || s.includes("暫時完結"))
    return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 text-[13px] font-medium">{chineseText}</Badge>;
  if (s.includes("complete") || s.includes("done") || s.includes("完成"))
    return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[13px] font-medium">{chineseText}</Badge>;
  if (s.includes("install"))
    return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[13px] font-medium">{chineseText}</Badge>;
  if (s.includes("production") || s.includes("生產"))
    return <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 text-[13px] font-medium">{chineseText}</Badge>;
  if (s.includes("pending") || s.includes("wait") || s.includes("等待"))
    return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 text-[13px] font-medium">{chineseText}</Badge>;
  if (s.includes("cancel") || s.includes("取消"))
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[13px] font-medium">{chineseText}</Badge>;
  return <Badge variant="outline" className="text-[13px]">{chineseText}</Badge>;
}

// ─── MAIN COMPONENT ─────────────────────────────────────
export default function BWFOrderList() {
  const router = useRouter();
  const { canCreate } = usePermission();
  const [orders, setOrders] = useState<BWFOrderListRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Order create/edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pmFilter, setPmFilter] = useState<string>("all");
  const [factoryFilter, setFactoryFilter] = useState<string>("all");

  const [sortField, setSortField] = useState<SortField>("est_delivery_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // ─── LOAD DATA ─────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await fetchBWFOrders();
    setOrders(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── UNIQUE VALUES FOR FILTERS ─────────────────────
  const filterOptions = useMemo(() => {
    const statuses = Array.from(new Set(orders.map((o) => o.status).filter((x): x is string => !!x)));
    const pms = Array.from(new Set(orders.map((o) => o.pm_name).filter((x): x is string => !!x)));
    const factories = Array.from(new Set(orders.map((o) => o.factory_name).filter((x): x is string => !!x)));
    return { statuses, pms, factories };
  }, [orders]);

  // ─── FILTER + SEARCH ──────────────────────────────
  const filteredOrders = useMemo(() => {
    let result = orders;
    if (statusFilter !== "all") result = result.filter((o) => o.status === statusFilter);
    if (pmFilter !== "all") result = result.filter((o) => o.pm_name === pmFilter);
    if (factoryFilter !== "all") result = result.filter((o) => o.factory_name === factoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          (o.project_code && o.project_code.toLowerCase().includes(q)) ||
          (o.project_name && o.project_name.toLowerCase().includes(q)) ||
          (o.pm_name && o.pm_name.toLowerCase().includes(q)) ||
          (o.product_name && o.product_name.toLowerCase().includes(q)) ||
          (o.factory_name && o.factory_name.toLowerCase().includes(q)) ||
          (o.status && o.status.toLowerCase().includes(q))
      );
    }
    return result;
  }, [orders, statusFilter, pmFilter, factoryFilter, search]);

  // ─── SORT ─────────────────────────────────────────
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

  // ─── PAGINATION ───────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedOrders.slice(start, start + pageSize);
  }, [sortedOrders, currentPage, pageSize]);

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, pmFilter, factoryFilter, pageSize]);

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
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />;
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPmFilter("all");
    setFactoryFilter("all");
  };

  const hasActiveFilters =
    search.trim() !== "" || statusFilter !== "all" || pmFilter !== "all" || factoryFilter !== "all";

  // ─── KPI STATS ────────────────────────────────────
  const kpiStats = useMemo(() => {
    const total = filteredOrders.length;
    const pending = filteredOrders.filter((o) => o.status === "Pending Orders").length;
    const completed = filteredOrders.filter((o) => o.status === "Completed").length;
    return { total, pending, completed };
  }, [filteredOrders]);

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-yellow-500" />
            訂單管理 Orders
            <Badge className="bg-yellow-500 text-white hover:bg-yellow-500 text-[12px] px-2 py-0 font-bold rounded-md ml-1">BWF</Badge>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">管理所有傢俬訂單。 Manage all furniture orders.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="h-9 gap-1.5 text-[15px]">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 重新整理
          </Button>
          {canCreate("bwf/orders") && (
            <Button size="sm" className="h-9 gap-1.5 text-[15px] bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => { setEditingOrderId(null); setDialogOpen(true); }}>
              <Plus className="w-3.5 h-3.5" /> 新增訂單
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Package} label="總訂單數" value={kpiStats.total} subLabel={`篩選中 ${filteredOrders.length} / 全部 ${orders.length}`} color="bg-blue-500" borderColor="border-l-blue-500" />
        <StatCard icon={Clock} label="待下單訂單" value={kpiStats.pending} color="bg-amber-500" borderColor="border-l-amber-500" />
        <StatCard icon={CheckCircle2} label="已完成訂單" value={kpiStats.completed} color="bg-teal-500" borderColor="border-l-teal-500" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search all columns..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-[15px]" />
          </div>

          {/* 狀態 */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9 text-[15px]"><SelectValue placeholder="狀態" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有狀態</SelectItem>
              {filterOptions.statuses.map((s) => (<SelectItem key={s} value={s}>{getOrderStatusChinese(s)}</SelectItem>))}
            </SelectContent>
          </Select>

          {/* Main PM */}
          <Select value={pmFilter} onValueChange={setPmFilter}>
            <SelectTrigger className="w-[150px] h-9 text-[15px]"><SelectValue placeholder="項目經理" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有PM</SelectItem>
              {filterOptions.pms.sort().map((pm) => (<SelectItem key={pm} value={pm}>{pm}</SelectItem>))}
            </SelectContent>
          </Select>

          {/* 工廠 */}
          <Select value={factoryFilter} onValueChange={setFactoryFilter}>
            <SelectTrigger className="w-[150px] h-9 text-[15px]"><SelectValue placeholder="工廠" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有工廠</SelectItem>
              {filterOptions.factories.sort().map((f) => (<SelectItem key={f} value={f}>{f}</SelectItem>))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-[15px] text-red-500 hover:text-red-600 hover:bg-red-50">
              <X className="w-3.5 h-3.5" /> 清除篩選
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-rose-500" />
              <span className="text-sm text-gray-400">載入訂單資料...</span>
            </div>
          </div>
        ) : sortedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
              <Package className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-400 mb-1">{hasActiveFilters ? "沒有符合篩選條件的訂單" : "沒有訂單資料"}</p>
            {hasActiveFilters && (
              <Button variant="link" size="sm" onClick={clearFilters} className="text-[15px] text-rose-500">清除篩選條件</Button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead className="text-[14px] font-semibold cursor-pointer select-none min-w-[140px]" onClick={() => toggleSort("project_code")}>
                      <span className="flex items-center">項目編號 <SortIcon field="project_code" /></span>
                    </TableHead>
                    <TableHead className="text-[14px] font-semibold cursor-pointer select-none min-w-[180px]" onClick={() => toggleSort("project_name")}>
                      <span className="flex items-center">項目名稱 <SortIcon field="project_name" /></span>
                    </TableHead>
                    <TableHead className="text-[14px] font-semibold cursor-pointer select-none min-w-[120px]" onClick={() => toggleSort("pm_name")}>
                      <span className="flex items-center">項目經理 <SortIcon field="pm_name" /></span>
                    </TableHead>
                    <TableHead className="text-[14px] font-semibold cursor-pointer select-none min-w-[160px]" onClick={() => toggleSort("product_name")}>
                      <span className="flex items-center">產品 <SortIcon field="product_name" /></span>
                    </TableHead>
                    <TableHead className="text-right text-[14px] font-semibold cursor-pointer select-none w-[80px]" onClick={() => toggleSort("quantity")}>
                      <span className="flex items-center justify-end">數量 <SortIcon field="quantity" /></span>
                    </TableHead>
                    <TableHead className="text-[14px] font-semibold cursor-pointer select-none min-w-[120px]" onClick={() => toggleSort("factory_name")}>
                      <span className="flex items-center">工廠 <SortIcon field="factory_name" /></span>
                    </TableHead>
                    <TableHead className="text-[14px] font-semibold cursor-pointer select-none w-[120px]" onClick={() => toggleSort("est_delivery_date")}>
                      <span className="flex items-center leading-tight">
                        <span className="flex flex-col">
                          <span>預計送貨日期</span>
                          <span className="text-[12px] font-normal text-gray-400">(到達工地)</span>
                        </span>
                        <SortIcon field="est_delivery_date" />
                      </span>
                    </TableHead>
                    <TableHead className="text-[14px] font-semibold cursor-pointer select-none w-[120px]" onClick={() => toggleSort("est_installation_date")}>
                      <span className="flex items-center leading-tight">
                        <span className="flex flex-col">
                          <span>預計安裝日期</span>
                          <span className="text-[12px] font-normal text-gray-400">(完成項目)</span>
                        </span>
                        <SortIcon field="est_installation_date" />
                      </span>
                    </TableHead>
                    <TableHead className="text-[14px] font-semibold cursor-pointer select-none w-[110px]" onClick={() => toggleSort("actual_installation_date")}>
                      <span className="flex items-center">實際安裝日期 <SortIcon field="actual_installation_date" /></span>
                    </TableHead>
                    <TableHead className="text-[14px] font-semibold cursor-pointer select-none w-[100px]" onClick={() => toggleSort("status")}>
                      <span className="flex items-center">狀態 <SortIcon field="status" /></span>
                    </TableHead>
                    <TableHead className="w-[80px] text-[14px] font-semibold text-center">動作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="group cursor-pointer transition-all hover:bg-gray-50/50"
                      onClick={() => { setEditingOrderId(order.id); setDialogOpen(true); }}
                    >
                      {/* 項目編號 */}
                      <TableCell>
                        <span className="text-[14px] text-gray-700 font-mono">{order.project_code || "-"}</span>
                      </TableCell>
                      {/* 項目名稱 */}
                      <TableCell>
                        <p className="text-[15px] text-gray-800 truncate max-w-[200px]">{order.project_name || "-"}</p>
                      </TableCell>
                      {/* 項目經理 */}
                      <TableCell>
                        <span className="text-[15px] text-gray-700">{order.pm_name || "-"}</span>
                      </TableCell>
                      {/* 產品 */}
                      <TableCell>
                        <p className="text-[15px] text-gray-700 truncate max-w-[180px]">{order.product_name || "-"}</p>
                      </TableCell>
                      {/* 數量 */}
                      <TableCell className="text-right text-[15px] font-mono text-gray-700">{order.quantity ?? "-"}</TableCell>
                      {/* 工廠 */}
                      <TableCell>
                        <p className="text-[15px] text-gray-700 truncate max-w-[130px]">{order.factory_name || "-"}</p>
                      </TableCell>
                      {/* 預計送貨日期 (到達工地) */}
                      <TableCell className="whitespace-nowrap text-[14px] text-gray-700 font-mono">
                        {order.est_delivery_date ? formatDate(order.est_delivery_date) : <span className="text-gray-400">-</span>}
                      </TableCell>
                      {/* 預計安裝日期 (完成項目) */}
                      <TableCell className="whitespace-nowrap text-[14px] text-gray-700 font-mono">
                        {order.est_installation_date ? formatDate(order.est_installation_date) : <span className="text-gray-400">-</span>}
                      </TableCell>
                      {/* 實際安裝日期 */}
                      <TableCell className="whitespace-nowrap text-[14px] text-gray-700 font-mono">
                        {order.actual_installation_date ? formatDate(order.actual_installation_date) : <span className="text-gray-400">-</span>}
                      </TableCell>
                      {/* 狀態 */}
                      <TableCell>{statusBadge(order.status)}</TableCell>
                      {/* 動作 */}
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
                              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100 transition-colors"
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

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <span className="text-[14px] text-gray-500">每頁</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="w-[70px] h-7 text-[14px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAGE_SIZES.map((s) => (<SelectItem key={s} value={String(s)}>{s}</SelectItem>))}</SelectContent>
                </Select>
                <span className="text-[14px] text-gray-400">
                  顯示 {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, sortedOrders.length)} / 共 {sortedOrders.length} 筆
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}><ChevronsLeft className="w-3.5 h-3.5" /></Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}><ChevronLeft className="w-3.5 h-3.5" /></Button>
                <span className="text-[14px] text-gray-500 px-2">{currentPage} / {totalPages}</span>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}><ChevronsRight className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          </>
        )}
      </div>

      <BWFOrderDialog
        open={dialogOpen}
        orderId={editingOrderId}
        onClose={() => setDialogOpen(false)}
        onSaved={loadData}
      />
    </div>
  );
}
