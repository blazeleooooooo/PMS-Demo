"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  fetchProductionOrders,
  type ProductionOrderRow,
} from "@/lib/data-service";
import { Loader2, Factory, Search, AlertCircle, Clock, Truck, LayoutList, CalendarCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/date-utils";
import {
  PROJECT_STATUS_OPTIONS,
  projectStatusFilterLabel,
} from "@/lib/project-status-rules";
import BWFOrderDialog, { getOrderStatusChinese } from "@/components/projects/BWFOrderDialog";
import { BWFOrderEditButton } from "@/components/projects/BWFOrderEditButton";
import BulkSetProductionFinishDialog from "@/components/production/BulkSetProductionFinishDialog";
import ListLogicPanel from "@/components/furniture/ListLogicPanel";
import { usePermission } from "@/hooks/use-permission";

type TabKey = "in_production" | "overdue" | "over_20_days" | "logistics" | "factory_overview";

const IN_PRODUCTION_STATUSES = new Set(["In Production", "Overdue Production"]);

function hasProduct(order: ProductionOrderRow): boolean {
  return !!order.product_id;
}

function isEmptyDate(value: string | null | undefined): boolean {
  return value == null || value === "";
}

function matchesInProductionTab(order: ProductionOrderRow): boolean {
  return (
    hasProduct(order) &&
    !!order.status &&
    IN_PRODUCTION_STATUSES.has(order.status)
  );
}

function matchesOverdueTab(order: ProductionOrderRow, now: Date): boolean {
  if (!hasProduct(order)) return false;
  if (order.status === "Completed") return false;

  const byStatus = order.status === "Overdue Production";

  const byOverdueDates =
    !!order.production_finish_date_est &&
    new Date(order.production_finish_date_est) < now &&
    isEmptyDate(order.production_finish_date);

  return byStatus || byOverdueDates;
}

function matchesOver20DaysTab(order: ProductionOrderRow, twentyDaysAgo: Date): boolean {
  return (
    hasProduct(order) &&
    !!order.status &&
    IN_PRODUCTION_STATUSES.has(order.status) &&
    !!order.production_start_date &&
    new Date(order.production_start_date) < twentyDaysAgo
  );
}

function matchesLogisticsTab(order: ProductionOrderRow): boolean {
  return hasProduct(order) && order.status === "Upcoming Deliveries";
}

function matchesTab(order: ProductionOrderRow, tab: TabKey, now: Date, twentyDaysAgo: Date): boolean {
  switch (tab) {
    case "in_production":
    case "factory_overview":
      return matchesInProductionTab(order);
    case "overdue":
      return matchesOverdueTab(order, now);
    case "over_20_days":
      return matchesOver20DaysTab(order, twentyDaysAgo);
    case "logistics":
      return matchesLogisticsTab(order);
    default:
      return false;
  }
}

export default function ProductionManagement() {
  const { canEdit, loading: permLoading } = usePermission();
  const canModify = canEdit("production") && !permLoading;
  const [orders, setOrders] = useState<ProductionOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("in_production");

  // Dialog State
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [pmFilter, setPmFilter] = useState("all");
  const [projectStatusFilter, setProjectStatusFilter] = useState("all");

  const loadData = async () => {
    setLoading(true);
    const data = await fetchProductionOrders();
    setOrders(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Extract filter options
  const factoryOptions = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.factory_name) set.add(o.factory_name);
    });
    return Array.from(set).sort();
  }, [orders]);

  const pmOptions = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.pm_name) set.add(o.pm_name);
    });
    return Array.from(set).sort();
  }, [orders]);

  const projectStatusOptions = PROJECT_STATUS_OPTIONS;

  // Filter logic
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const twentyDaysAgo = new Date();
    twentyDaysAgo.setDate(now.getDate() - 20);

    return orders.filter((o) => {
      // 1. Apply global filters
      if (
        search &&
        !o.project_code?.toLowerCase().includes(search.toLowerCase()) &&
        !o.project_name?.toLowerCase().includes(search.toLowerCase()) &&
        !o.product_name?.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      if (factoryFilter !== "all" && o.factory_name !== factoryFilter) return false;
      if (pmFilter !== "all" && o.pm_name !== pmFilter) return false;
      if (projectStatusFilter !== "all" && o.project_status !== projectStatusFilter) return false;

      // 2. Apply tab-specific logic
      return matchesTab(o, activeTab, now, twentyDaysAgo);
    });
  }, [orders, activeTab, search, factoryFilter, pmFilter, projectStatusFilter]);

  const groupedByFactory = useMemo(() => {
    if (activeTab !== "factory_overview") return {};
    const groups: Record<string, ProductionOrderRow[]> = {};
    filteredOrders.forEach((o) => {
      const fac = o.factory_name || "未指定工廠";
      if (!groups[fac]) groups[fac] = [];
      groups[fac].push(o);
    });
    return groups;
  }, [filteredOrders, activeTab]);

  const tabs = [
    {
      key: "in_production",
      label: "正在生產",
      icon: Factory,
      hint: "狀態為 In Production 或 Overdue Production，且已選產品（product 不為空）的訂單。",
    },
    {
      key: "overdue",
      label: "過期生產",
      icon: AlertCircle,
      hint: "狀態為 Overdue Production 且有產品；或預計完成日期已過、實際完成日期為空、且有產品（狀態未正確標為過期亦會顯示，並排除已完成訂單）。",
    },
    {
      key: "over_20_days",
      label: "生產多於20天",
      icon: Clock,
      hint: "狀態為 In Production 或 Overdue Production，生產開始日期早於 20 天前，且有產品的訂單。",
    },
    {
      key: "logistics",
      label: "集運倉物流",
      icon: Truck,
      hint: "狀態為 Upcoming Deliveries，且有產品的訂單。",
    },
    {
      key: "factory_overview",
      label: "工廠總覽",
      icon: LayoutList,
      hint: "符合「正在生產」條件的訂單，按工廠分組顯示。",
    },
  ];

  const handleEdit = (id: string) => {
    setSelectedOrderId(id);
    setDialogOpen(true);
  };

  const handleSaved = async () => {
    const data = await fetchProductionOrders();
    setOrders(data);
    setSelectedIds(new Set());
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setSelectedIds(new Set());
    setFinishDialogOpen(false);
  };

  const canBulkFinish = canModify && activeTab !== "logistics";
  const visibleIds = filteredOrders.map((o) => o.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected =
    visibleIds.some((id) => selectedIds.has(id)) && !allVisibleSelected;

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
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

  const toggleGroup = (ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id));
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Factory className="w-6 h-6 text-bw-amber" />
            生產管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">管理生產中及相關階段的訂單</p>
        </div>
        {canBulkFinish && (
          <Button
            size="sm"
            className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={selectedIds.size === 0}
            onClick={() => setFinishDialogOpen(true)}
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            設定完結日期 ({selectedIds.size})
          </Button>
        )}
      </div>

      <ListLogicPanel pageId="production" />

      {/* Global Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜尋項目編號、名稱或產品..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={factoryFilter} onValueChange={setFactoryFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="所有工廠" />
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
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="所有 PM" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有 PM</SelectItem>
            {pmOptions.map((pm) => (
              <SelectItem key={pm} value={pm}>
                {pm}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={projectStatusFilter} onValueChange={setProjectStatusFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="所有項目狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有項目狀態</SelectItem>
            {projectStatusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {projectStatusFilterLabel(opt.value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key as TabKey)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-b-2 border-bw-amber text-bw-amber bg-amber-50/30"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="p-4 bg-gray-50/50 border-b border-gray-100">
          <p className="text-sm text-gray-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-bw-amber" />
            {tabs.find((t) => t.key === activeTab)?.hint}
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-bw-amber mr-2" />
            <span className="text-gray-500">載入資料中...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Factory className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>無符合條件的訂單</p>
          </div>
        ) : activeTab === "factory_overview" ? (
          <div className="p-6 space-y-8">
            {Object.entries(groupedByFactory).map(([factoryName, factoryOrders]) => (
              <div key={factoryName} className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b pb-2">
                  <Factory className="w-5 h-5 text-gray-400" />
                  {factoryName}
                  <Badge variant="secondary" className="ml-2">
                    {factoryOrders.length} 筆
                  </Badge>
                </h3>
                <OrdersTable
                  orders={factoryOrders}
                  onEdit={handleEdit}
                  selectable={canBulkFinish}
                  selectedIds={selectedIds}
                  allSelected={
                    factoryOrders.length > 0 &&
                    factoryOrders.every((o) => selectedIds.has(o.id))
                  }
                  someSelected={
                    factoryOrders.some((o) => selectedIds.has(o.id)) &&
                    !factoryOrders.every((o) => selectedIds.has(o.id))
                  }
                  onToggleAll={() => toggleGroup(factoryOrders.map((o) => o.id))}
                  onToggleOne={toggleOne}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="p-0">
            <OrdersTable
              orders={filteredOrders}
              onEdit={handleEdit}
              selectable={canBulkFinish}
              selectedIds={selectedIds}
              allSelected={allVisibleSelected}
              someSelected={someVisibleSelected}
              onToggleAll={toggleAllVisible}
              onToggleOne={toggleOne}
            />
          </div>
        )}
      </div>

      <BWFOrderDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedOrderId(null);
        }}
        onSaved={handleSaved}
        orderId={selectedOrderId}
      />

      <BulkSetProductionFinishDialog
        open={finishDialogOpen}
        orderIds={[...selectedIds]}
        onClose={() => setFinishDialogOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}

function OrdersTable({
  orders,
  onEdit,
  selectable = false,
  selectedIds,
  allSelected = false,
  someSelected = false,
  onToggleAll,
  onToggleOne,
}: {
  orders: ProductionOrderRow[];
  onEdit: (id: string) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  allSelected?: boolean;
  someSelected?: boolean;
  onToggleAll?: () => void;
  onToggleOne?: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/50">
            {selectable && (
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={onToggleAll}
                  aria-label="全選"
                />
              </TableHead>
            )}
            <TableHead>項目編號</TableHead>
            <TableHead>項目名稱</TableHead>
            <TableHead>PM</TableHead>
            <TableHead>產品</TableHead>
            <TableHead>數量</TableHead>
            <TableHead>工廠</TableHead>
            <TableHead>狀態</TableHead>
            <TableHead>生產開始</TableHead>
            <TableHead>預計完成</TableHead>
            <TableHead className="w-16 text-center">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => (
            <TableRow
              key={o.id}
              className={`cursor-pointer hover:bg-amber-50/30 transition-colors ${
                selectedIds?.has(o.id) ? "bg-emerald-50/40" : ""
              }`}
              onClick={() => onEdit(o.id)}
            >
              {selectable && (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds?.has(o.id) ?? false}
                    onCheckedChange={() => onToggleOne?.(o.id)}
                    aria-label={`選取 ${o.project_code || o.id}`}
                  />
                </TableCell>
              )}
              <TableCell className="font-medium">{o.project_code || "-"}</TableCell>
              <TableCell className="max-w-[200px] truncate" title={o.project_name || ""}>
                {o.project_name || "-"}
              </TableCell>
              <TableCell>{o.pm_name || "-"}</TableCell>
              <TableCell className="max-w-[200px] truncate" title={o.product_name || ""}>
                {o.product_name || "-"}
              </TableCell>
              <TableCell>{o.quantity || "-"}</TableCell>
              <TableCell>{o.factory_name || "-"}</TableCell>
              <TableCell>
                <Badge variant="outline" className="bg-white">
                  {getOrderStatusChinese(o.status)}
                </Badge>
              </TableCell>
              <TableCell>{formatDate(o.production_start_date)}</TableCell>
              <TableCell>
                <span
                  className={
                    o.production_finish_date_est &&
                    new Date(o.production_finish_date_est) < new Date() &&
                    !o.production_finish_date
                      ? "text-red-600 font-medium"
                      : ""
                  }
                >
                  {formatDate(o.production_finish_date_est)}
                </span>
              </TableCell>
              <TableCell className="text-center">
                <div onClick={(e) => e.stopPropagation()}>
                  <BWFOrderEditButton onClick={() => onEdit(o.id)} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
