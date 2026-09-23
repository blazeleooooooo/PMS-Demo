"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "@/hooks/use-navigate";
import {
  Factory,
  Search,
  Phone,
  Mail,
  Star,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  DollarSign,
  Award,
  User,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight} from "lucide-react";
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
  fetchFactoriesPage,
  fetchFactoryStats,
  fetchFactoryFilterOptions,
  createFactory,
  deleteFactory,
  type FactoryRow,
  type FactoryStats,
  type FactoryFilterOptions} from "@/lib/data-service";
import { createClient } from "@/lib/supabase/client";
import FactoryEditDialog, {
  EMPTY_FACTORY_FORM,
  FACTORY_LEVEL_OPTIONS,
  FactoryFormFields,
  formToFactoryPayload,
  validateFactoryForm,
  type FactoryFormState} from "@/components/factories/FactoryEditDialog";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { formatDate } from "@/lib/date-utils";

type SortField =
  | "factory_name"
  | "priority"
  | "project_number"
  | "amount"
  | "join_date"
  | "status";
type SortDir = "asc" | "desc";

function StatCard({
  icon: Icon,
  label,
  value,
  color}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
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


function LevelBadge({ avgScore }: { avgScore: number | null }) {
  if (avgScore == null) return <span className="text-xs text-gray-300">-</span>;
  const roundedStars = Math.round(avgScore);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${i < roundedStars ? "fill-bw-amber text-bw-amber" : "text-gray-200"}`}
          />
        ))}
      </div>
      <span className="text-xs text-gray-500">{avgScore.toFixed(1)}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-gray-300">-</span>;
  const lower = status.toLowerCase();
  if (lower === "active" || lower === "approved") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-xs">
        {status}
      </Badge>
    );
  }
  if (lower === "inactive" || lower === "suspended") {
    return (
      <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0 text-xs">
        {status}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs">
      {status}
    </Badge>
  );
}

export default function FactoriesManagement() {
  const { navigate } = useNavigate();
  const { canCreate, canEdit, canDelete, loading: permLoading } = usePermission();
  const { formatMoney } = useFinancialFormat();

  const [factories, setFactories] = useState<FactoryRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 50;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("factory_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [stats, setStats] = useState<FactoryStats>({
    total: 0,
    active: 0,
    levelA: 0,
    totalAmount: 0});
  const [filterOptions, setFilterOptions] = useState<FactoryFilterOptions>({
    categories: [],
    levels: [],
    statuses: []});

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedFactory, setSelectedFactory] = useState<FactoryRow | null>(null);
  const [form, setForm] = useState<FactoryFormState>(EMPTY_FACTORY_FORM);
  const [categorySearch, setCategorySearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avgScoreMap, setAvgScoreMap] = useState<Record<string, number>>({});

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(0);
    }, 350);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  const loadPage = useCallback(async (pageNum?: number) => {
    setLoading(true);
    const pg = pageNum ?? currentPage;
    const result = await fetchFactoriesPage({
      page: pg,
      pageSize: PAGE_SIZE,
      search: debouncedSearch || undefined,
      categoryFilter: categoryFilter !== "all" ? categoryFilter : undefined,
      statusFilter: statusFilter !== "all" ? statusFilter : undefined,
      levelFilter: levelFilter !== "all" ? levelFilter : undefined,
      sortField,
      sortDir});
    setFactories(result.data);
    setTotalCount(result.totalCount);
    setLoading(false);

    if (result.data.length > 0) {
      try {
        const supabase = createClient();
        const factoryIds = result.data.map((f) => f.id);
        const { data: comments } = await supabase
          .from("staff_supplier_comments")
          .select("factory_id, point")
          .in("factory_id", factoryIds)
          .not("point", "is", null);

        if (comments) {
          const scoreAccum: Record<string, { total: number; count: number }> = {};
          for (const row of comments) {
            if (row.factory_id && row.point != null) {
              if (!scoreAccum[row.factory_id]) scoreAccum[row.factory_id] = { total: 0, count: 0 };
              scoreAccum[row.factory_id].total += row.point;
              scoreAccum[row.factory_id].count += 1;
            }
          }
          const map: Record<string, number> = {};
          for (const [factoryId, { total, count }] of Object.entries(scoreAccum)) {
            map[factoryId] = total / count;
          }
          setAvgScoreMap((prev) => ({ ...prev, ...map }));
        }
      } catch (e) {
        console.error("Failed to load factory avg scores", e);
      }
    }
  }, [
    currentPage,
    debouncedSearch,
    categoryFilter,
    statusFilter,
    levelFilter,
    sortField,
    sortDir,
  ]);

  const loadMetadata = useCallback(async () => {
    const optionsResult = await fetchFactoryFilterOptions();
    setFilterOptions(optionsResult);
  }, []);

  const loadStats = useCallback(async () => {
    const statsResult = await fetchFactoryStats({
      search: debouncedSearch || undefined,
      categoryFilter: categoryFilter !== "all" ? categoryFilter : undefined,
      statusFilter: statusFilter !== "all" ? statusFilter : undefined,
      levelFilter: levelFilter !== "all" ? levelFilter : undefined});
    setStats(statsResult);
  }, [debouncedSearch, categoryFilter, statusFilter, levelFilter]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    setCurrentPage(0);
  }, [categoryFilter, levelFilter, statusFilter, sortField, sortDir]);

  const handleRefresh = () => {
    loadMetadata();
    loadStats();
    loadPage();
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasMore = (currentPage + 1) * PAGE_SIZE < totalCount;

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
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    );
  };

  const handleCreate = () => {
    setForm(EMPTY_FACTORY_FORM);
    setError(null);
    setCategorySearch("");
    setShowCreateDialog(true);
  };

  const handleEdit = (factory: FactoryRow) => {
    setSelectedFactory(factory);
    setShowEditDialog(true);
  };

  const handleDelete = (factory: FactoryRow) => {
    setSelectedFactory(factory);
    setError(null);
    setShowDeleteDialog(true);
  };

  const handleSaveCreate = async () => {
    const validationError = validateFactoryForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createFactory(formToFactoryPayload(form));
    setSaving(false);
    if (result.success) {
      setShowCreateDialog(false);
      handleRefresh();
    } else {
      setError(result.error || "建立失敗");
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedFactory) return;
    setSaving(true);
    setError(null);
    const result = await deleteFactory(selectedFactory.id);
    setSaving(false);
    if (result.success) {
      setShowDeleteDialog(false);
      handleRefresh();
    } else {
      setError(result.error || "刪除失敗");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Factory className="w-6 h-6 text-bw-amber" />
            工廠管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">管理工廠資料、評級、產品類型及交易記錄</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            重新整理
          </Button>
          {canCreate("factories") && (
            <Button size="sm" onClick={handleCreate} className="bg-bw-amber hover:bg-bw-amber/90 text-white">
              <Plus className="w-4 h-4 mr-1.5" />
              新增工廠
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Factory} label="總工廠" value={stats.total} color="bg-bw-amber" />
        <StatCard icon={Award} label="活躍工廠" value={stats.active} color="bg-bw-teal" />
        <StatCard icon={Star} label="首選工廠" value={stats.levelA} color="bg-emerald-500" />
        <StatCard
          icon={DollarSign}
          label="總交易額"
          value={formatMoney(stats.totalAmount)}
          color="bg-bw-blue"
        />
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜尋工廠名稱、電郵、電話、類型..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="所有類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有類型</SelectItem>
            {filterOptions.categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="所有評級" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有評級</SelectItem>
            {FACTORY_LEVEL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="所有狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有狀態</SelectItem>
            {filterOptions.statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-sm text-gray-500">
          共 <span className="font-semibold text-gray-900">{totalCount}</span> 筆
          {totalCount > PAGE_SIZE && (
            <span className="ml-1 text-xs text-gray-400">
              (第 {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, totalCount)} 筆)
            </span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-bw-amber mr-2" />
            <span className="text-gray-500">載入工廠資料中...</span>
          </div>
        ) : factories.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Factory className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>無符合條件的工廠</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="w-[220px]">
                    <button
                      onClick={() => toggleSort("factory_name")}
                      className="flex items-center gap-1 font-semibold"
                    >
                      工廠名稱 <SortIcon field="factory_name" />
                    </button>
                  </TableHead>
                  <TableHead>類型</TableHead>
                  <TableHead>聯絡方式</TableHead>
                  <TableHead>
                    <button
                      onClick={() => toggleSort("priority")}
                      className="flex items-center gap-1 font-semibold"
                    >
                      評分 <SortIcon field="priority" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => toggleSort("status")}
                      className="flex items-center gap-1 font-semibold"
                    >
                      狀態 <SortIcon field="status" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      onClick={() => toggleSort("project_number")}
                      className="flex items-center gap-1 font-semibold ml-auto"
                    >
                      項目數 <SortIcon field="project_number" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      onClick={() => toggleSort("amount")}
                      className="flex items-center gap-1 font-semibold ml-auto"
                    >
                      交易額 <SortIcon field="amount" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => toggleSort("join_date")}
                      className="flex items-center gap-1 font-semibold"
                    >
                      加入日期 <SortIcon field="join_date" />
                    </button>
                  </TableHead>
                  <TableHead className="w-[80px] text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factories.map((f) => {
                  const displayName = f.display_name || f.factory_name || f.factory_eng_name || "未命名";
                  const engName =
                    f.factory_eng_name && f.factory_eng_name !== displayName ? f.factory_eng_name : null;
                  return (
                    <TableRow
                      key={f.id}
                      className="group hover:bg-amber-50/30 transition-colors cursor-pointer"
                      onClick={(e) => navigate(`/factories/${f.id}`, e)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-900 group-hover:text-bw-amber transition-colors">
                            {displayName}
                          </p>
                          {engName && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{engName}</p>
                          )}
                          {f.location && (
                            <p className="text-[12px] text-gray-400 mt-0.5 truncate max-w-[200px]">
                              {f.location}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {f.category_names.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {f.category_names.map((name, idx) => (
                              <Badge key={idx} variant="outline" className="border-gray-200 text-gray-600 text-xs">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {f.contact_person && (
                            <p className="text-xs text-gray-600 flex items-center gap-1">
                              <User className="w-3 h-3 shrink-0 text-gray-400" /> {f.contact_person}
                            </p>
                          )}
                          {f.phone && (
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Phone className="w-3 h-3 shrink-0" /> {f.phone}
                            </p>
                          )}
                          {f.email && (
                            <p className="text-xs text-gray-500 flex items-center gap-1 truncate max-w-[180px]">
                              <Mail className="w-3 h-3 shrink-0" /> {f.email}
                            </p>
                          )}
                          {!f.contact_person && !f.phone && !f.email && (
                            <span className="text-xs text-gray-300">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <LevelBadge avgScore={avgScoreMap[f.id] ?? null} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={f.status} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {f.project_number != null && f.project_number > 0 ? f.project_number : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatMoney(f.amount)}</TableCell>
                      <TableCell className="text-sm text-gray-500">{formatDate(f.join_date)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canEdit("factories") && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(f);
                              }}
                              className="p-1.5 rounded-md hover:bg-amber-100 text-gray-400 hover:text-bw-amber transition-colors"
                              title="編輯"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete("factories") && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(f);
                              }}
                              className="p-1.5 rounded-md hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
                              title="刪除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

        {!loading && totalCount > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              顯示 {currentPage * PAGE_SIZE + 1} - {Math.min((currentPage + 1) * PAGE_SIZE, totalCount)} 筆，共{" "}
              {totalCount} 筆
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(0)}
                disabled={currentPage === 0}
                className="h-8 w-8 p-0"
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="px-3 text-sm text-gray-700 font-medium">
                {currentPage + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={!hasMore}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages - 1)}
                disabled={!hasMore}
                className="h-8 w-8 p-0"
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-bw-amber" />
              新增工廠
            </DialogTitle>
          </DialogHeader>
          <FactoryFormFields
            form={form}
            setForm={setForm}
            categoryOptions={filterOptions.categories}
            categorySearch={categorySearch}
            setCategorySearch={setCategorySearch}
          />
          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={saving}>
              取消
            </Button>
            <Button
              onClick={handleSaveCreate}
              disabled={saving}
              className="bg-bw-amber hover:bg-bw-amber/90 text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
              建立
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FactoryEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        factory={selectedFactory}
        categoryOptions={filterOptions.categories}
        onSaved={handleRefresh}
      />

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              確認刪除
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            確定要刪除工廠「
            {selectedFactory?.display_name || selectedFactory?.factory_name || "未命名"}」嗎？此操作無法復原。
          </p>
          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={saving}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
