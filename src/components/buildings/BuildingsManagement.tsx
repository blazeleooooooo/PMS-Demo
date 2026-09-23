"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Building2,
  Search,
  MapPin,
  Phone,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  FileText,
  Clock,
  Volume2,
  Moon,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle} from "lucide-react";
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
  fetchBuildings,
  deleteBuilding,
  type BuildingRow} from "@/lib/data-service";
import { usePermission } from "@/hooks/use-permission";
import BuildingEditDialog from "@/components/buildings/BuildingEditDialog";

type SortField = "building_name" | "district" | "created_date";
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

export default function BuildingsManagement() {
  const { canCreate, canEdit, canDelete, loading: permLoading } = usePermission();
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("building_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchBuildings();
    setBuildings(data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Derive district options from data
  const districtOptions = useMemo(() => {
    const districts = new Set<string>();
    buildings.forEach((b) => {
      if (b.district) districts.add(b.district);
    });
    return Array.from(districts).sort();
  }, [buildings]);

  // Filter + Sort
  const filtered = useMemo(() => {
    let list = [...buildings];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((b) =>
        [b.building_name, b.building_name_eng, b.address, b.address_eng, b.district, b.x_display_name, b.remarks]
          .some((f) => f && f.toLowerCase().includes(q))
      );
    }

    if (districtFilter !== "all") {
      list = list.filter((b) => b.district === districtFilter);
    }

    list.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      if (aVal == null) aVal = sortDir === "asc" ? "\uffff" : "";
      if (bVal == null) bVal = sortDir === "asc" ? "\uffff" : "";
      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      return sortDir === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });

    return list;
  }, [buildings, search, districtFilter, sortField, sortDir]);

  // KPIs — reflect current search/filter results
  const totalBuildings = filtered.length;
  const withGuideline = filtered.filter((b) => b.guideline).length;
  const withNoisyControl = filtered.filter((b) => b.noisy_control).length;
  const uniqueDistricts = new Set(filtered.map((b) => b.district).filter(Boolean)).size;

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
    if (!canCreate("buildings")) return;
    setError(null);
    setShowCreateDialog(true);
  };

  const handleEdit = (building: BuildingRow) => {
    if (!canEdit("buildings")) return;
    setSelectedBuilding(building);
    setError(null);
    setShowEditDialog(true);
  };

  const handleDelete = (building: BuildingRow) => {
    setSelectedBuilding(building);
    setError(null);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedBuilding) return;
    // Double-check permission (guards against stale UI)
    if (!canDelete("buildings")) {
      setError("您沒有權限刪除大廈。請重新整理頁面。");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await deleteBuilding(selectedBuilding.id);
    setSaving(false);
    if (result.success) {
      setShowDeleteDialog(false);
      loadData();
    } else {
      setError(result.error || "刪除失敗");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-bw-blue" />
            大廈管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">管理大廈資訊、送貨指引、噪音控制及審批時間</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            重新整理
          </Button>
          {canCreate("buildings") && (
          <Button size="sm" onClick={handleCreate} className="bg-bw-blue hover:bg-bw-blue/90">
            <Plus className="w-4 h-4 mr-1.5" />
            新增大廈
          </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Building2} label="總大廈數" value={totalBuildings} color="bg-bw-blue" />
        <StatCard icon={MapPin} label="涵蓋地區" value={uniqueDistricts} color="bg-bw-violet" />
        <StatCard icon={FileText} label="已設指引" value={withGuideline} color="bg-bw-teal" />
        <StatCard icon={Volume2} label="噪音管控" value={withNoisyControl} color="bg-bw-amber" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜尋大廈名稱、地址、地區..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={districtFilter} onValueChange={setDistrictFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="所有地區" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有地區</SelectItem>
            {districtOptions.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-sm text-gray-500">
          共 <span className="font-semibold text-gray-900">{filtered.length}</span> 筆
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-bw-blue mr-2" />
            <span className="text-gray-500">載入大廈資料中...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>無符合條件的大廈</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="w-[220px]">
                    <button onClick={() => toggleSort("building_name")} className="flex items-center gap-1 font-semibold">
                      大廈名稱 <SortIcon field="building_name" />
                    </button>
                  </TableHead>
                  <TableHead className="w-[200px]">地址</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("district")} className="flex items-center gap-1 font-semibold">
                      地區 <SortIcon field="district" />
                    </button>
                  </TableHead>
                  <TableHead>聯絡人</TableHead>
                  <TableHead>送貨備註</TableHead>
                  <TableHead>管控</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("created_date")} className="flex items-center gap-1 font-semibold">
                      建立日期 <SortIcon field="created_date" />
                    </button>
                  </TableHead>
                  <TableHead className="w-[80px] text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b) => (
                  <TableRow
                    key={b.id}
                    className="group hover:bg-blue-50/30 transition-colors"
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900 group-hover:text-bw-blue transition-colors">
                          {b.building_name || b.x_display_name || "未命名"}
                        </p>
                        {b.building_name_eng && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">
                            {b.building_name_eng}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-600 truncate max-w-[200px]" title={b.address || ""}>
                        {b.address || b.address_eng || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {b.district ? (
                        <Badge variant="outline" className="border-bw-blue/20 text-bw-blue bg-bw-blue/5">
                          <MapPin className="w-3 h-3 mr-1" />
                          {b.district}
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-xs text-gray-500">
                        {b.first_contact && (
                          <p className="flex items-center gap-1 truncate max-w-[160px]">
                            <Phone className="w-3 h-3 shrink-0" /> {b.first_contact}
                          </p>
                        )}
                        {b.second_contact && (
                          <p className="flex items-center gap-1 truncate max-w-[160px]">
                            <Phone className="w-3 h-3 shrink-0" /> {b.second_contact}
                          </p>
                        )}
                        {!b.first_contact && !b.second_contact && <span className="text-gray-300">-</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {b.delivery_note ? (
                        <p className="text-xs text-gray-600 truncate max-w-[160px]" title={b.delivery_note}>
                          {b.delivery_note}
                        </p>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {b.noisy_control && (
                          <Badge variant="outline" className="border-bw-amber/30 text-bw-amber bg-bw-amber/5 text-[12px] px-1.5">
                            <Volume2 className="w-3 h-3 mr-0.5" />
                            噪音
                          </Badge>
                        )}
                        {b.x_night_works && (
                          <Badge variant="outline" className="border-bw-violet/30 text-bw-violet bg-bw-violet/5 text-[12px] px-1.5">
                            <Moon className="w-3 h-3 mr-0.5" />
                            夜間
                          </Badge>
                        )}
                        {b.vetting_approval_time && (
                          <Badge variant="outline" className="border-bw-teal/30 text-bw-teal bg-bw-teal/5 text-[12px] px-1.5">
                            <Clock className="w-3 h-3 mr-0.5" />
                            審批
                          </Badge>
                        )}
                        {!b.noisy_control && !b.x_night_works && !b.vetting_approval_time && (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatDate(b.created_date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canEdit("buildings") && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(b); }}
                          className="p-1.5 rounded-md hover:bg-blue-100 text-gray-400 hover:text-bw-blue transition-colors"
                          title="編輯"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        )}
                        {canDelete("buildings") && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(b); }}
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

      {/* ─── CREATE / EDIT DIALOG ────────────────────────── */}
      <BuildingEditDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        building={null}
        onSaved={() => loadData()}
      />
      <BuildingEditDialog
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) setSelectedBuilding(null);
        }}
        building={selectedBuilding}
        onSaved={() => loadData()}
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
              確定要刪除大廈 <span className="font-semibold text-gray-900">{selectedBuilding?.building_name || selectedBuilding?.building_name_eng || "未命名"}</span> 嗎？
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
