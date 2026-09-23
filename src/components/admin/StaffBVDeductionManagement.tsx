"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  MinusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createClient } from "@/lib/supabase/client";
import { usePermission } from "@/hooks/use-permission";

interface StaffMember {
  id: string;
  full_name: string | null;
  name: string | null;
  position: string | null;
}

interface FinancialYear {
  id: string;
  display: string | null;
}

interface DeductionRow {
  id: string;
  staff_id: string;
  n_financial_year_id: string;
  deduction_bv: number;
  reason: string | null;
  created_date: string | null;
  modified_date: string | null;
}

function formatPct(val: number | null): string {
  if (val == null) return "—";
  return `${val.toFixed(2)}%`;
}

interface StaffBVDeductionManagementProps {
  /** Permission module for edit/delete gates. Defaults to admin `/assign-bv`. */
  permissionModule?: string;
}

export default function StaffBVDeductionManagement({
  permissionModule = "assign-bv",
}: StaffBVDeductionManagementProps) {
  const { canEdit, canDelete, loading: permLoading } = usePermission();
  const supabase = createClient();

  const [rows, setRows] = useState<DeductionRow[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterFY, setFilterFY] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DeductionRow | null>(null);
  const [formStaffId, setFormStaffId] = useState("");
  const [formFYId, setFormFYId] = useState("");
  const [formDeduction, setFormDeduction] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DeductionRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const staffMap = useMemo(() => {
    const map: Record<string, StaffMember> = {};
    staff.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [staff]);

  const fyMap = useMemo(() => {
    const map: Record<string, string> = {};
    financialYears.forEach((fy) => {
      map[fy.id] = fy.display || "—";
    });
    return map;
  }, [financialYears]);

  const loadReferenceData = useCallback(async () => {
    const [staffRes, fyRes] = await Promise.all([
      supabase.from("staff").select("id, full_name, name, position").order("name"),
      supabase.from("financial_years").select("id, display").order("display", { ascending: false }),
    ]);
    if (staffRes.data) setStaff(staffRes.data);
    if (fyRes.data) setFinancialYears(fyRes.data);
  }, [supabase]);

  const loadDeductions = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("staff_bv_deductions")
      .select("id, staff_id, n_financial_year_id, deduction_bv, reason, created_date, modified_date")
      .order("modified_date", { ascending: false });

    if (filterFY !== "all") {
      query = query.eq("n_financial_year_id", filterFY);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[StaffBVDeductionManagement] load failed:", error.message);
      setRows([]);
    } else {
      setRows((data as DeductionRow[]) || []);
    }
    setLoading(false);
  }, [supabase, filterFY]);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    loadDeductions();
  }, [loadDeductions]);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter((row) => {
      const s = staffMap[row.staff_id];
      const name = (s?.name || s?.full_name || "").toLowerCase();
      const reason = (row.reason || "").toLowerCase();
      const fy = (fyMap[row.n_financial_year_id] || "").toLowerCase();
      return name.includes(term) || reason.includes(term) || fy.includes(term);
    });
  }, [rows, searchTerm, staffMap, fyMap]);

  const openCreate = () => {
    setEditing(null);
    setFormStaffId("");
    setFormFYId(financialYears[0]?.id || "");
    setFormDeduction("");
    setFormReason("");
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (row: DeductionRow) => {
    setEditing(row);
    setFormStaffId(row.staff_id);
    setFormFYId(row.n_financial_year_id);
    setFormDeduction(String(row.deduction_bv));
    setFormReason(row.reason || "");
    setFormError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formStaffId) {
      setFormError("請選擇員工");
      return;
    }
    if (!formFYId) {
      setFormError("請選擇財年");
      return;
    }
    const val = parseFloat(formDeduction);
    if (isNaN(val) || val < 0 || val > 100) {
      setFormError("請輸入有效的扣減比例（0 – 100%）");
      return;
    }

    setSaving(true);
    setFormError("");

    const payload = {
      staff_id: formStaffId,
      n_financial_year_id: formFYId,
      deduction_bv: val,
      reason: formReason.trim() || null,
      modified_date: new Date().toISOString(),
    };

    const { error } = editing
      ? await supabase.from("staff_bv_deductions").update(payload).eq("id", editing.id)
      : await supabase.from("staff_bv_deductions").insert(payload);

    if (error) {
      if (error.code === "23505") {
        setFormError("此員工在該財年已有扣減記錄，請編輯現有記錄。");
      } else {
        setFormError(`儲存失敗: ${error.message}`);
      }
      setSaving(false);
      return;
    }

    setSaving(false);
    setDialogOpen(false);
    loadDeductions();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase
      .from("staff_bv_deductions")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      console.error("[StaffBVDeductionManagement] delete failed:", error.message);
    } else {
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  if (permLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">績效評估 — 個人扣減</h1>
          <p className="text-sm text-gray-500 mt-1">
            每位員工每個財年只可有一筆扣減比例記錄 · 共 {filteredRows.length} 筆
          </p>
        </div>
        {canEdit(permissionModule) && (
          <Button onClick={openCreate} className="bg-bw-amber hover:bg-bw-amber/90 text-white">
            <Plus className="w-4 h-4 mr-1.5" />
            新增扣減
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜尋員工、財年或備註..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
            />
          </div>
          <select
            value={filterFY}
            onChange={(e) => setFilterFY(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">全部財年</option>
            {financialYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {fy.display}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600">員工</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-[120px]">職位</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-[120px]">財年</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-[120px]">扣減比例</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 min-w-[180px]">備註</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-[140px]">更新日期</th>
                {(canEdit(permissionModule) || canDelete(permissionModule)) && (
                  <th className="text-right px-4 py-3 font-medium text-gray-600 w-[100px]">操作</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                    載入中...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <MinusCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    尚無個人扣減記錄
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const s = staffMap[row.staff_id];
                  return (
                    <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {s?.name || s?.full_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{s?.position || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {fyMap[row.n_financial_year_id] || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-red-600">
                        {formatPct(row.deduction_bv)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{row.reason || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {row.modified_date
                          ? new Date(row.modified_date).toLocaleDateString("zh-HK", { timeZone: "Asia/Hong_Kong" })
                          : "—"}
                      </td>
                      {(canEdit(permissionModule) || canDelete(permissionModule)) && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canEdit(permissionModule) && (
                              <button
                                type="button"
                                onClick={() => openEdit(row)}
                                className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600"
                                title="編輯"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {canDelete(permissionModule) && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(row)}
                                className="p-1.5 rounded-md hover:bg-red-50 text-red-600"
                                title="刪除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "編輯個人扣減" : "新增個人扣減"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700">員工</label>
              <select
                value={formStaffId}
                onChange={(e) => setFormStaffId(e.target.value)}
                disabled={!!editing}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
              >
                <option value="">選擇員工...</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">財年</label>
              <select
                value={formFYId}
                onChange={(e) => setFormFYId(e.target.value)}
                disabled={!!editing}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
              >
                <option value="">選擇財年...</option>
                {financialYears.map((fy) => (
                  <option key={fy.id} value={fy.id}>
                    {fy.display}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">扣減比例 (%)</label>
              <div className="relative mt-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formDeduction}
                  onChange={(e) => setFormDeduction(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
                  %
                </span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">備註（選填）</label>
              <textarea
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                rows={3}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
              />
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {editing ? "儲存" : "新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除此個人扣減記錄嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
