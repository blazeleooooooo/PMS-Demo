"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useNavigate } from "@/hooks/use-navigate";
import {
  Users,
  Search,
  Phone,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  DollarSign,
  FolderOpen,
  Image as ImageIcon,
  Eye,
  Tag,
  Building2,
  Mail,
  UserCircle,
  CircleDot,
  FileText,
  Link as LinkIcon,
  Calendar,
  X,
  Filter} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter} from "@/components/ui/dialog";
import {
  fetchCustomersPaginated,
  fetchCustomerKPIStats,
  fetchCustomerFilterOptions,
  deleteCustomer,
  setCustomerWellKnownBrandTag,
  type CustomerRow,
  type CustomerFilters,
  type CustomerKPIStats,
  type CustomerFilterOptions} from "@/lib/data-service";
import CustomerEditDialog from "@/components/clients/CustomerEditDialog";
import {
  customerStatusBadgeClass,
  customerStatusFilterLabel,
  CUSTOMER_STATUS_FILTER_VALUES,
} from "@/lib/customer-status";
import {
  CUSTOMER_RECORD_STATUSES,
  customerRecordStatusBadgeClass,
  customerRecordStatusLabel,
} from "@/lib/customer-record-status";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type SortField = "created_date" | "view_system" | "display_name" | "bwa_receivable" | "bwa_profit" | "status_filter_value" | "customer_name" | "company_name" | "bwa_project_number" | "bwa_income" | "bwf_income";
type SortDir = "asc" | "desc";

// ─── STAT CARD ─────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-[15px] text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

import { formatDate } from "@/lib/date-utils";



// ─── MAIN COMPONENT ─────────────────────────────────────
export default function ClientsManagement() {
  const router = useRouter();
  const { navigate } = useNavigate();
  const { canCreate, canEdit, canDelete, loading: permLoading } = usePermission();
  const { formatMoney } = useFinancialFormat();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [systemFilter, setSystemFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [recordStatusFilter, setRecordStatusFilter] = useState<string>("Active");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [createdByFilter, setCreatedByFilter] = useState<string>("all");
  const [wellKnownBrandFilter, setWellKnownBrandFilter] = useState<"all" | "yes" | "no">("all");
  const [togglingWellKnownId, setTogglingWellKnownId] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<CustomerFilterOptions>({
    statuses: [],
    industryTags: [],
    creators: [],
  });
  const [sortField, setSortField] = useState<SortField>("created_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // KPI state (loaded independently)
  const [kpiStats, setKpiStats] = useState<CustomerKPIStats>({
    totalCustomers: 0,
    bwaCustomers: 0,
    bwfCustomers: 0,
    totalBwaIncome: 0});

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce timer ref
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const listFilters = useMemo<CustomerFilters>(() => ({
    search: debouncedSearch || undefined,
    viewSystem: systemFilter,
    statusFilter: statusFilter !== "all" ? statusFilter : undefined,
    recordStatus: recordStatusFilter,
    industryTagId: industryFilter !== "all" ? industryFilter : undefined,
    createdBy: createdByFilter !== "all" ? createdByFilter : undefined,
    wellKnownBrand: wellKnownBrandFilter,
  }), [debouncedSearch, systemFilter, statusFilter, recordStatusFilter, industryFilter, createdByFilter, wellKnownBrandFilter]);

  const hasActiveFilters =
    !!debouncedSearch ||
    systemFilter !== "all" ||
    statusFilter !== "all" ||
    recordStatusFilter !== "Active" ||
    industryFilter !== "all" ||
    createdByFilter !== "all" ||
    wellKnownBrandFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setSystemFilter("all");
    setStatusFilter("all");
    setRecordStatusFilter("Active");
    setIndustryFilter("all");
    setCreatedByFilter("all");
    setWellKnownBrandFilter("all");
    setPage(1);
  };

  useEffect(() => {
    fetchCustomerFilterOptions().then(setFilterOptions);
  }, []);

  // Debounce search input
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // reset to page 1 on new search
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [systemFilter, statusFilter, recordStatusFilter, industryFilter, createdByFilter, wellKnownBrandFilter, sortField, sortDir]);

  // Main data loading (paginated)
  const loadData = useCallback(async () => {
    setLoading(true);
    const filters: CustomerFilters = {
      ...listFilters,
      sortField,
      sortDir,
    };
    const result = await fetchCustomersPaginated(page, pageSize, filters);
    setCustomers(result.data);
    setTotalCount(result.totalCount);
    setTotalPages(result.totalPages);
    setLoading(false);
  }, [page, pageSize, listFilters, sortField, sortDir]);

  // Load KPI stats when filters change (aggregates all matching rows, not just current page)
  const loadKpiStats = useCallback(async () => {
    const stats = await fetchCustomerKPIStats(listFilters);
    setKpiStats(stats);
  }, [listFilters]);

  useEffect(() => {
    loadKpiStats();
  }, [loadKpiStats]);

  // Load data when filters/pagination change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // KPIs from separate lightweight query
  const totalCustomers = kpiStats.totalCustomers;
  const bwaCustomers = kpiStats.bwaCustomers;
  const bwfCustomers = kpiStats.bwfCustomers;
  const totalBwaIncome = kpiStats.totalBwaIncome;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  // ─── CRUD HANDLERS ──────────────────────────────────────
  const handleCreate = () => {
    setSelectedCustomer(null);
    setShowCreateDialog(true);
  };

  const handleEdit = (customer: CustomerRow) => {
    setSelectedCustomer(customer);
    setShowEditDialog(true);
  };

  const handleDelete = (customer: CustomerRow) => {
    setSelectedCustomer(customer);
    setError(null);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedCustomer) return;
    setSaving(true);
    setError(null);
    const result = await deleteCustomer(selectedCustomer.id);
    setSaving(false);
    if (result.success) {
      setShowDeleteDialog(false);
      loadData();
      loadKpiStats();
    } else {
      setError(result.error || "刪除失敗");
    }
  };

  const handleDialogSaved = () => {
    loadData();
    loadKpiStats();
  };

  const handleToggleWellKnownBrand = async (customer: CustomerRow, enabled: boolean) => {
    if (!canEdit("clients") || togglingWellKnownId) return;
    const prev = customer.is_well_known_brand;
    setTogglingWellKnownId(customer.id);
    setCustomers((rows) =>
      rows.map((r) =>
        r.id === customer.id ? { ...r, is_well_known_brand: enabled } : r
      )
    );
    const result = await setCustomerWellKnownBrandTag(customer.id, enabled);
    if (!result.success) {
      setCustomers((rows) =>
        rows.map((r) =>
          r.id === customer.id ? { ...r, is_well_known_brand: prev } : r
        )
      );
    } else if (wellKnownBrandFilter !== "all") {
      // Keep list consistent with active 知名品牌 filter
      await loadData();
      await loadKpiStats();
    }
    setTogglingWellKnownId(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-bw-violet" />
            客戶管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">管理所有客戶資料、聯絡資訊及項目統計</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { loadData(); loadKpiStats(); }} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            重新整理
          </Button>
          {canCreate("clients") && (
            <Button size="sm" onClick={handleCreate} className="bg-bw-violet hover:bg-bw-violet/90">
              <Plus className="w-4 h-4 mr-1.5" />
              新增客戶
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Users} label="總客戶數" value={totalCustomers} color="bg-bw-violet" />
        <StatCard icon={FolderOpen} label="BWA 客戶" value={bwaCustomers} color="bg-bw-blue" />
        <StatCard icon={FolderOpen} label="BWF 客戶" value={bwfCustomers} color="bg-bw-amber" />
        <StatCard icon={DollarSign} label="BWA 總收入" value={formatMoney(totalBwaIncome)} color="bg-bw-teal" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜尋客戶名稱、公司、電郵、電話..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={systemFilter} onValueChange={setSystemFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="所有系統" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有系統</SelectItem>
            <SelectItem value="BWA">BWA</SelectItem>
            <SelectItem value="BWF">BWF</SelectItem>
            <SelectItem value="Both">Both</SelectItem>
          </SelectContent>
        </Select>
        <Select value={recordStatusFilter} onValueChange={setRecordStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="帳戶狀態" />
          </SelectTrigger>
          <SelectContent>
            {CUSTOMER_RECORD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {customerRecordStatusLabel(s)}
              </SelectItem>
            ))}
            <SelectItem value="all">全部狀態</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="所有階段" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有階段</SelectItem>
            {(filterOptions.statuses.length > 0 ? filterOptions.statuses : CUSTOMER_STATUS_FILTER_VALUES).map((status) => (
              <SelectItem key={status} value={status}>
                {customerStatusFilterLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={industryFilter} onValueChange={setIndustryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="所有行業" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有行業</SelectItem>
            {filterOptions.industryTags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={wellKnownBrandFilter}
          onValueChange={(v) => setWellKnownBrandFilter(v as "all" | "yes" | "no")}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="知名品牌" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有品牌</SelectItem>
            <SelectItem value="yes">知名品牌</SelectItem>
            <SelectItem value="no">非知名品牌</SelectItem>
          </SelectContent>
        </Select>
        <Select value={createdByFilter} onValueChange={setCreatedByFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="所有建立者" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有建立者</SelectItem>
            {filterOptions.creators.map((creator) => (
              <SelectItem key={creator} value={creator}>
                {creator}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-500">
            <X className="w-4 h-4 mr-1" />
            清除篩選
          </Button>
        )}
        <div className="text-sm text-gray-500 ml-auto">
          <Filter className="w-3.5 h-3.5 inline mr-1 opacity-50" />
          共 <span className="font-semibold text-gray-900">{totalCount}</span> 筆
          {totalPages > 1 && (
            <span className="ml-2">• 第 {page}/{totalPages} 頁</span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-bw-blue mr-2" />
            <span className="text-gray-500">載入客戶資料中...</span>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>無符合條件的客戶</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  {/* 1. 查詢日期 */}
                  <TableHead className="w-[110px]">
                    <button onClick={() => toggleSort("created_date")} className="flex items-center gap-1 font-semibold">
                      查詢日期 <SortIcon field="created_date" />
                    </button>
                  </TableHead>
                  {/* 2. 系統分類 */}
                  <TableHead className="w-[80px]">
                    <button onClick={() => toggleSort("view_system")} className="flex items-center gap-1 font-semibold">
                      系統 <SortIcon field="view_system" />
                    </button>
                  </TableHead>
                  {/* 3. 客戶行業 */}
                  <TableHead className="w-[140px]">客戶行業</TableHead>
                  {/* 4. 商標 */}
                  <TableHead className="w-[60px] text-center">商標</TableHead>
                  {/* 5. 知名品牌 */}
                  <TableHead className="w-[80px] text-center">知名品牌</TableHead>
                  {/* 6. 客戶顯示名稱 */}
                  <TableHead className="w-[200px]">
                    <button onClick={() => toggleSort("display_name")} className="flex items-center gap-1 font-semibold">
                      客戶顯示名稱 <SortIcon field="display_name" />
                    </button>
                  </TableHead>
                  {/* 6. 電話號碼 */}
                  <TableHead className="w-[130px]">電話號碼</TableHead>
                  {/* 7. 建立者 */}
                  <TableHead className="w-[100px]">建立者</TableHead>
                  {/* 8. 簽帳額 */}
                  <TableHead className="text-right w-[120px]">
                    <button onClick={() => toggleSort("bwa_receivable")} className="flex items-center gap-1 font-semibold ml-auto">
                      簽帳額 <SortIcon field="bwa_receivable" />
                    </button>
                  </TableHead>
                  {/* 9. 項目毛利 */}
                  <TableHead className="text-right w-[120px]">
                    <button onClick={() => toggleSort("bwa_profit")} className="flex items-center gap-1 font-semibold ml-auto">
                      項目毛利 <SortIcon field="bwa_profit" />
                    </button>
                  </TableHead>
                  {/* 10. Account status */}
                  <TableHead className="w-[100px]">帳戶狀態</TableHead>
                  {/* 11. Lifecycle stage */}
                  <TableHead className="w-[90px]">
                    <button onClick={() => toggleSort("status_filter_value")} className="flex items-center gap-1 font-semibold">
                      階段 <SortIcon field="status_filter_value" />
                    </button>
                  </TableHead>
                  {/* 11. Action */}
                  <TableHead className="w-[80px] text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow
                    key={c.id}
                    className="group hover:bg-blue-50/30 transition-colors cursor-pointer border-l-2 border-l-transparent hover:border-l-blue-400 hover:shadow-sm"
                    onClick={(e) => navigate(`/clients/${c.id}`, e)}
                  >
                    {/* 1. 查詢日期 */}
                    <TableCell className="text-sm text-gray-500">
                      {formatDate(c.created_date)}
                    </TableCell>
                    {/* 2. 系統分類 */}
                    <TableCell>
                      {c.view_system ? (
                        <Badge
                          variant="outline"
                          className={
                            c.view_system === "BWA" || c.view_system === "PMS"
                              ? "border-bw-blue/30 text-bw-blue bg-bw-blue/5 text-xs"
                              : c.view_system === "BWF" || c.view_system === "BWF2"
                              ? "border-bw-amber/30 text-bw-amber bg-bw-amber/5 text-xs"
                              : c.view_system === "Both" ||
                                c.view_system === "PMS,BWF2" ||
                                c.view_system === "BWF2,PMS"
                              ? "border-violet-200 text-violet-600 bg-violet-50 text-xs"
                              : "border-gray-200 text-gray-500 text-xs"
                          }
                        >
                          {c.view_system === "PMS"
                            ? "BWA"
                            : c.view_system === "BWF2"
                            ? "BWF"
                            : c.view_system === "PMS,BWF2" || c.view_system === "BWF2,PMS"
                            ? "Both"
                            : c.view_system}
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </TableCell>
                    {/* 3. 客戶行業 */}
                    <TableCell>
                      {c.industry_tags && c.industry_tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.industry_tags.slice(0, 3).map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-[12px] px-1.5 py-0 border-violet-200 text-violet-600 bg-violet-50">
                              {tag}
                            </Badge>
                          ))}
                          {c.industry_tags.length > 3 && (
                            <span className="text-[12px] text-gray-400">+{c.industry_tags.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </TableCell>
                    {/* 4. 商標 */}
                    <TableCell className="text-center">
                      {c.branding_icon ? (
                        <img
                          src={c.branding_icon.startsWith("//") ? `https:${c.branding_icon}` : c.branding_icon}
                          alt="商標"
                          className="w-8 h-8 rounded-md object-cover mx-auto border border-gray-100"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-gray-50 flex items-center justify-center mx-auto">
                          <ImageIcon className="w-3.5 h-3.5 text-gray-300" />
                        </div>
                      )}
                    </TableCell>
                    {/* 5. 知名品牌 */}
                    <TableCell
                      className="text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center">
                        {togglingWellKnownId === c.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-bw-violet" />
                        ) : (
                          <Checkbox
                            checked={c.is_well_known_brand}
                            disabled={!canEdit("clients") || permLoading}
                            onCheckedChange={(checked) => {
                              void handleToggleWellKnownBrand(c, checked === true);
                            }}
                            aria-label="知名品牌"
                            className={cn(
                              "h-5 w-5 rounded-full border-2 shadow-none",
                              c.is_well_known_brand
                                ? "border-bw-violet bg-bw-violet data-[state=checked]:bg-bw-violet data-[state=checked]:border-bw-violet"
                                : "border-gray-300"
                            )}
                          />
                        )}
                      </div>
                    </TableCell>
                    {/* 6. 客戶顯示名稱 */}
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900 group-hover:text-bw-blue transition-colors truncate max-w-[200px]">
                          {c.display_name || c.customer_name || "未命名"}
                        </p>
                        {c.brand_name_cn && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">
                            <Tag className="w-3 h-3 inline mr-1" />
                            {c.brand_name_cn}
                            {c.brand_name_en ? ` / ${c.brand_name_en}` : ""}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    {/* 6. 電話號碼 */}
                    <TableCell>
                      {c.phone_display ? (
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          {c.phone_display}
                        </p>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </TableCell>
                    {/* 7. 建立者 */}
                    <TableCell>
                      {c.real_created_by_name ? (
                        <div className="flex items-center gap-1.5">
                          <UserCircle className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="text-sm text-gray-600 truncate max-w-[90px]">{c.real_created_by_name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </TableCell>
                    {/* 8. 簽帳額 = bwa_receivable + bwf_receivable */}
                    <TableCell className="text-right font-mono text-sm">
                      {formatMoney((c.bwa_receivable || 0) + (c.bwf_receivable || 0))}
                    </TableCell>
                    {/* 9. 項目毛利 = bwa_profit + bwf_profit */}
                    <TableCell className="text-right font-mono text-sm">
                      {formatMoney((c.bwa_profit || 0) + (c.bwf_profit || 0))}
                    </TableCell>
                    {/* 10. Account status */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={customerRecordStatusBadgeClass(c.status)}
                      >
                        {customerRecordStatusLabel(c.status)}
                      </Badge>
                    </TableCell>
                    {/* 11. Lifecycle stage */}
                    <TableCell>
                      {c.status_filter_value ? (
                        <Badge
                          variant="outline"
                          className={customerStatusBadgeClass(c.status_filter_value)}
                        >
                          <CircleDot className="w-2.5 h-2.5 mr-1" />
                          {customerStatusFilterLabel(c.status_filter_value)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </TableCell>
                    {/* 11. Action */}
                    <TableCell>
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/clients/${c.id}`, e); }}
                          className="p-1.5 rounded-md hover:bg-blue-100 text-gray-400 hover:text-bw-blue transition-colors"
                          title="檢視"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEdit("clients") && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(c); }}
                          className="p-1.5 rounded-md hover:bg-blue-100 text-gray-400 hover:text-bw-blue transition-colors"
                          title="編輯"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        )}
                        {canDelete("clients") && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(c); }}
                          className="p-1.5 rounded-md hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
                          title="刪除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">
            顯示 {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalCount)} 筆，共 {totalCount} 筆
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(1)}
              disabled={page <= 1 || loading}
            >
              首頁
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              上一頁
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === page ? "default" : "outline"}
                    size="sm"
                    className={`w-8 h-8 p-0 ${pageNum === page ? "bg-bw-blue hover:bg-bw-blue/90" : ""}`}
                    onClick={() => setPage(pageNum)}
                    disabled={loading}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              下一頁
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || loading}
            >
              末頁
            </Button>
          </div>
        </div>
      )}

      {/* ─── CREATE DIALOG (shared component) ──────────────────────────────── */}
      <CustomerEditDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        customer={null}
        onSaved={handleDialogSaved}
      />

      {/* ─── EDIT DIALOG (shared component) ──────────────────────────────── */}
      <CustomerEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        customer={selectedCustomer}
        onSaved={handleDialogSaved}
      />


      {/* ─── DELETE DIALOG ──────────────────────────────── */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              確認刪除
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              確定要刪除客戶 <span className="font-semibold text-gray-900">{selectedCustomer?.display_name || selectedCustomer?.customer_name || "未命名"}</span> 嗎？
            </p>
            <p className="text-xs text-gray-400 mt-2">此操作無法復原。</p>
          </div>
          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={saving}>取消</Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
              刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
