"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  User,
  UserPlus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  Palette,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/client";
import { notifyProjectBvCreated } from "@/lib/project-bv-notify";
import { useAuth } from "@/hooks/use-auth";
import { useFinancialFormat } from "@/hooks/use-financial-format";

const COMPANY_BV_HANDLER_ID = "00000000-0000-4000-8000-000000000001";

export interface ProjectBVRow {
  id: string;
  handler_id: string | null;
  handler_name: string | null;
  ratio: number | null;
}

export type ProjectCollaboratorEntity = "bwa" | "bwf";

interface ProjectCollaboratorPanelProps {
  entityType: ProjectCollaboratorEntity;
  projectId: string;
  mainPmId: string | null;
  mainPmName: string | null;
  mainDesignerId?: string | null;
  mainDesignerName?: string | null;
  nTeamTypeId?: string | null;
  onProjectReload?: () => void;
}

export default function ProjectCollaboratorPanel({
  entityType,
  projectId,
  mainPmId,
  mainPmName,
  mainDesignerId,
  mainDesignerName,
  nTeamTypeId,
  onProjectReload,
}: ProjectCollaboratorPanelProps) {
  const supabase = createClient();
  const { staff } = useAuth();
  const { formatBVRatio, canViewBVPercentage, financialMask } = useFinancialFormat();

  const [bvList, setBvList] = useState<ProjectBVRow[]>([]);
  const [bvLoading, setBvLoading] = useState(false);
  const [staffOptions, setStaffOptions] = useState<{ id: string; name: string }[]>([]);
  const [showBVDialog, setShowBVDialog] = useState(false);
  const [bvEditingId, setBvEditingId] = useState<string | null>(null);
  const [bvFormHandlerId, setBvFormHandlerId] = useState("");
  const [bvFormRatio, setBvFormRatio] = useState("0");
  const [bvSaving, setBvSaving] = useState(false);
  const [bvDeleting, setBvDeleting] = useState<string | null>(null);
  const [confirmDeleteBVId, setConfirmDeleteBVId] = useState<string | null>(null);
  const [bvReloadKey, setBvReloadKey] = useState(0);

  const fkColumn = entityType === "bwf" ? "bwf_project_id" : "project_id";
  const projectTable = entityType === "bwf" ? "bwf_projects" : "bwa_projects";

  const isSuperAdmin = (staff as { role?: string } | null)?.role === "Super Admin";
  const isAdminOrAbove = isSuperAdmin || (staff as { role?: string } | null)?.role === "Admin";
  const isCompanyBV = (handlerId: string | null) => handlerId === COMPANY_BV_HANDLER_ID;

  const loadBV = useCallback(async () => {
    if (!projectId) return;
    setBvLoading(true);
    try {
      const bvRes = await supabase
        .from("project_bv")
        .select("id, handler_id, ratio, handler:staff!fk_project_bv_handler_id(id, name)")
        .eq(fkColumn, projectId)
        .order("created_date", { ascending: true });

      let rows: ProjectBVRow[] = [];
      if (bvRes.error) {
        const { data: fallback } = await supabase
          .from("project_bv")
          .select("id, handler_id, ratio")
          .eq(fkColumn, projectId)
          .order("created_date", { ascending: true });
        rows = (fallback || []).map((r: { id: string; handler_id: string | null; ratio: number | null }) => ({
          id: r.id,
          handler_id: r.handler_id,
          handler_name: null,
          ratio: r.ratio,
        }));
      } else {
        rows = (bvRes.data || []).map((r: { id: string; handler_id: string | null; ratio: number | null; handler?: { name?: string } | null }) => ({
          id: r.id,
          handler_id: r.handler_id,
          handler_name: r.handler?.name || null,
          ratio: r.ratio,
        }));
      }
      setBvList(rows);
    } catch {
      setBvList([]);
    }
    setBvLoading(false);
  }, [projectId, fkColumn, supabase]);

  useEffect(() => {
    loadBV();
  }, [loadBV, bvReloadKey]);

  useEffect(() => {
    const loadStaff = async () => {
      const { data: staffData } = await supabase
        .from("staff")
        .select("id, name")
        .eq("status", "Active")
        .order("name", { ascending: true });
      if (staffData) setStaffOptions(staffData);
    };
    loadStaff();
  }, [supabase]);

  const handleBVAdd = () => {
    setBvEditingId(null);
    setBvFormHandlerId("");
    setBvFormRatio("0");
    setShowBVDialog(true);
  };

  const handleBVEdit = (bv: ProjectBVRow) => {
    if (isCompanyBV(bv.handler_id) && !isSuperAdmin) return;
    setBvEditingId(bv.id);
    setBvFormHandlerId(bv.handler_id || "");
    setBvFormRatio(bv.ratio != null ? String(bv.ratio) : "0");
    setShowBVDialog(true);
  };

  const handleBVSave = async () => {
    if (!bvFormHandlerId) return;
    setBvSaving(true);
    const now = new Date().toISOString();
    const ratioVal = bvFormRatio ? parseFloat(bvFormRatio) : null;

    if (bvEditingId) {
      const editedBV = bvList.find((bv) => bv.id === bvEditingId);
      const originalHandlerId = editedBV?.handler_id;

      await supabase
        .from("project_bv")
        .update({
          handler_id: bvFormHandlerId,
          ratio: ratioVal,
          modified_date: now,
        })
        .eq("id", bvEditingId);

      if (originalHandlerId && originalHandlerId !== bvFormHandlerId) {
        const projectUpdates: Record<string, string> = {};
        if (originalHandlerId === mainPmId) projectUpdates.main_pm_id = bvFormHandlerId;
        if (originalHandlerId === mainDesignerId) projectUpdates.main_designer_id = bvFormHandlerId;
        if (Object.keys(projectUpdates).length > 0) {
          projectUpdates.modified_date = now;
          await supabase.from(projectTable).update(projectUpdates).eq("id", projectId);
          onProjectReload?.();
        }
      }
    } else {
      const { error: bvInsertErr } = await supabase.from("project_bv").insert({
        [fkColumn]: projectId,
        handler_id: bvFormHandlerId,
        ratio: ratioVal,
        created_date: now,
        modified_date: now,
      });
      if (!bvInsertErr) {
        void notifyProjectBvCreated(supabase, {
          rows: [
            {
              handler_id: bvFormHandlerId,
              ratio: ratioVal,
              project_id: entityType === "bwa" ? projectId : null,
              bwf_project_id: entityType === "bwf" ? projectId : null,
            },
          ],
          assignerStaffId: staff?.id ?? null,
          assignerName: staff?.name ?? null,
        });
      }
    }

    setBvSaving(false);
    setShowBVDialog(false);
    setBvReloadKey((k) => k + 1);
  };

  const handleBVDelete = (bvId: string) => {
    const targetBV = bvList.find((bv) => bv.id === bvId);
    if (targetBV && isCompanyBV(targetBV.handler_id) && !isSuperAdmin) return;
    setConfirmDeleteBVId(bvId);
  };

  const confirmBVDelete = async () => {
    if (!confirmDeleteBVId) return;
    setBvDeleting(confirmDeleteBVId);
    await supabase.from("project_bv").delete().eq("id", confirmDeleteBVId);
    setBvDeleting(null);
    setConfirmDeleteBVId(null);
    setBvReloadKey((k) => k + 1);
  };

  const extraCollaborators = bvList.filter(
    (bv) => bv.handler_id !== mainPmId && bv.handler_id !== mainDesignerId,
  );

  const staffRole = (staff as { role?: string; n_team_type_id?: string } | null)?.role;
  const canEditRatio =
    staffRole === "Super Admin" ||
    staffRole === "Admin" ||
    (staffRole === "Senior User" &&
      !!(staff as { n_team_type_id?: string })?.n_team_type_id &&
      (staff as { n_team_type_id?: string }).n_team_type_id === nTeamTypeId);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        <div>
          <p className="text-[12px] text-gray-400 mb-0.5">
            <span className="text-gray-500">項目經理</span> Main PM
          </p>
          <p className="text-[14px] text-gray-800">{mainPmName || <span className="text-gray-300">N/A</span>}</p>
        </div>

        {mainDesignerName && (
          <div>
            <p className="text-[12px] text-gray-400 mb-0.5">
              <span className="text-gray-500">設計師</span> Designer
            </p>
            <p className="text-[14px] text-gray-800 flex items-center gap-1.5">
              <Palette className="w-3 h-3 text-violet-400" />
              {mainDesignerName}
            </p>
          </div>
        )}

        {bvLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
        ) : (
          extraCollaborators.length > 0 && (
            <div className="space-y-1.5">
              {extraCollaborators.map((bv) => (
                <div
                  key={bv.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-lg border border-gray-100 bg-gray-50/50 group"
                >
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-3 h-3 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[14px] text-gray-700 truncate block">
                      {bv.handler_name || "未知"}
                    </span>
                    {bv.ratio != null && canViewBVPercentage && (
                      <span className="text-[12px] text-gray-400">佔比 {formatBVRatio(bv.ratio)}</span>
                    )}
                  </div>
                  {!(isCompanyBV(bv.handler_id) && !isSuperAdmin) && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="p-1 rounded hover:bg-gray-200" onClick={() => handleBVEdit(bv)}>
                            <Pencil className="w-3 h-3 text-gray-500" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top"><p className="text-xs">編輯負責人</p></TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-red-100"
                            onClick={() => handleBVDelete(bv.id)}
                            disabled={bvDeleting === bv.id}
                          >
                            {bvDeleting === bv.id ? (
                              <Loader2 className="w-3 h-3 animate-spin text-red-400" />
                            ) : (
                              <Trash2 className="w-3 h-3 text-red-400" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top"><p className="text-xs">刪除</p></TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        <button
          type="button"
          className="flex items-center gap-1.5 text-[14px] text-blue-600 hover:text-blue-700 font-medium hover:underline pt-1"
          onClick={handleBVAdd}
        >
          <UserPlus className="w-3.5 h-3.5" /> Add Collaborator
        </button>
      </div>

      <Dialog open={showBVDialog} onOpenChange={setShowBVDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-violet-600">
              <UserPlus className="w-5 h-5" />
              {bvEditingId ? "編輯團隊成員" : "新增團隊成員"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">負責人 (Handler)</label>
              <Select value={bvFormHandlerId} onValueChange={setBvFormHandlerId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="選擇負責人..." />
                </SelectTrigger>
                <SelectContent>
                  {staffOptions
                    .filter((s) => {
                      const existingHandlerIds = bvList
                        .filter((bv) => bv.id !== bvEditingId)
                        .map((bv) => bv.handler_id);
                      return !existingHandlerIds.includes(s.id);
                    })
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">佔比 (%) — 可選</label>
              <Input
                type={canViewBVPercentage ? "number" : "text"}
                min="0"
                max="100"
                placeholder="例如: 30"
                value={canViewBVPercentage ? bvFormRatio : financialMask}
                onChange={(e) => setBvFormRatio(e.target.value)}
                disabled={!canEditRatio || !canViewBVPercentage}
                readOnly={!canViewBVPercentage}
                className={!canEditRatio || !canViewBVPercentage ? "bg-gray-100 cursor-not-allowed" : ""}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBVDialog(false)} disabled={bvSaving}>
              取消
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700 text-white"
              onClick={handleBVSave}
              disabled={bvSaving || !bvFormHandlerId}
            >
              {bvSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              {bvEditingId ? "儲存變更" : "新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDeleteBVId} onOpenChange={(open) => !open && setConfirmDeleteBVId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> 確認刪除團隊成員
            </AlertDialogTitle>
            <AlertDialogDescription>確定要移除此團隊成員嗎？此操作無法復原。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmBVDelete}>
              <Trash2 className="w-4 h-4 mr-1" /> 刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
