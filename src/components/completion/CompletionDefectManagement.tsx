"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProjectStatusBadge } from "@/components/ui/entity-status-badges";
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
  fetchCompletionDefectOrders,
  updateBWFProjectDefectStatus,
  type CompletionDefectOrderRow,
} from "@/lib/data-service";
import { formatDate } from "@/lib/date-utils";
import { usePermission } from "@/hooks/use-permission";
import ListLogicPanel from "@/components/furniture/ListLogicPanel";
import {
  getCompletionDefectCauseDisplay,
  getCompletionDefectSourceDisplay,
  getCompletionDefectStatusDisplay,
  getProjectDefectLabel,
  matchesProjectCompletionFilter,
  PROJECT_COMPLETION_FILTER_OPTIONS,
  PROJECT_DEFECT_DONE,
  PROJECT_DEFECT_FIXING,
  PROJECT_DEFECT_SMOOTH,
  type ProjectCompletionFilter,
} from "@/lib/bwf-defect-options";
import UpdateDefectInfoDialog from "@/components/completion/UpdateDefectInfoDialog";
import BWFOrderDialog from "@/components/projects/BWFOrderDialog";
import { BWFOrderEditButton } from "@/components/projects/BWFOrderEditButton";

interface ProjectGroup {
  project_id: string;
  project_code: string | null;
  project_name: string | null;
  pm_name: string | null;
  project_status: string | null;
  os_project_defect: string | null;
  orders: CompletionDefectOrderRow[];
}

type ConfirmAction =
  | { type: "smooth"; projectId: string; projectCode: string; currentDefect: string | null }
  | { type: "needs_defect"; projectId: string; projectCode: string };


function projectDefectBadge(defect: string | null) {
  if (defect === PROJECT_DEFECT_SMOOTH) {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[13px]">
        {getProjectDefectLabel(defect)}
      </Badge>
    );
  }
  if (defect === PROJECT_DEFECT_DONE) {
    return (
      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[13px]">
        {getProjectDefectLabel(defect)}
      </Badge>
    );
  }
  if (defect === PROJECT_DEFECT_FIXING) {
    return (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[13px]">
        {getProjectDefectLabel(defect)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[13px] text-gray-500">
      {getProjectDefectLabel(defect)}
    </Badge>
  );
}

export default function CompletionDefectManagement() {
  const { canEdit, loading: permLoading } = usePermission();
  const canModify = canEdit("completion-defect") && !permLoading;
  const [orders, setOrders] = useState<CompletionDefectOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<ProjectCompletionFilter>("hide_completed");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmSaving, setConfirmSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await fetchCompletionDefectOrders();
    setOrders(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const projectGroups = useMemo(() => {
    let filtered = orders.filter((o) =>
      matchesProjectCompletionFilter(o.os_project_defect, projectFilter),
    );

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          (o.project_code && o.project_code.toLowerCase().includes(q)) ||
          (o.project_name && o.project_name.toLowerCase().includes(q)) ||
          (o.pm_name && o.pm_name.toLowerCase().includes(q)) ||
          (o.product_name && o.product_name.toLowerCase().includes(q)) ||
          (o.factory_name && o.factory_name.toLowerCase().includes(q)),
      );
    }

    const map = new Map<string, ProjectGroup>();
    for (const order of filtered) {
      const key = order.project_id || "unassigned";
      if (!map.has(key)) {
        map.set(key, {
          project_id: key,
          project_code: order.project_code,
          project_name: order.project_name,
          pm_name: order.pm_name,
          project_status: order.project_status,
          os_project_defect: order.os_project_defect,
          orders: [],
        });
      }
      map.get(key)!.orders.push(order);
    }

    return [...map.values()].sort((a, b) =>
      (a.project_code || "").localeCompare(b.project_code || "", "zh-HK"),
    );
  }, [orders, projectFilter, search]);

  useEffect(() => {
    if (projectGroups.length > 0 && expandedProjects.size === 0) {
      setExpandedProjects(new Set(projectGroups.map((g) => g.project_id)));
    }
  }, [projectGroups, expandedProjects.size]);

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const openOrderDialog = (orderId: string) => {
    setSelectedOrderId(orderId);
    setDialogOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setConfirmSaving(true);
    let targetStatus: string;
    if (confirmAction.type === "smooth") {
      targetStatus =
        confirmAction.currentDefect === PROJECT_DEFECT_FIXING
          ? PROJECT_DEFECT_DONE
          : PROJECT_DEFECT_SMOOTH;
    } else {
      targetStatus = PROJECT_DEFECT_FIXING;
    }
    const result = await updateBWFProjectDefectStatus(confirmAction.projectId, targetStatus);
    setConfirmSaving(false);
    if (result.success) {
      setConfirmAction(null);
      loadData();
    }
  };

  const totalOrders = projectGroups.reduce((sum, g) => sum + g.orders.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-teal-600" />
            完工及執漏
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            已完工訂單按項目分組，管理執漏狀態及項目完工確認
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          重新整理
        </Button>
      </div>

      <ListLogicPanel pageId="completion-defect" />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜尋項目、產品、PM、工廠..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Select
          value={projectFilter}
          onValueChange={(v) => setProjectFilter(v as ProjectCompletionFilter)}
        >
          <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROJECT_COMPLETION_FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-gray-500">
        {projectGroups.length} 個項目 · {totalOrders} 筆已完工訂單
      </div>

      {loading || permLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : projectGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-500">
          沒有符合條件的已完工訂單
        </div>
      ) : (
        <div className="space-y-3">
          {projectGroups.map((group) => {
            const expanded = expandedProjects.has(group.project_id);
            const canMarkSmooth =
              !group.os_project_defect || group.os_project_defect === PROJECT_DEFECT_FIXING;

            return (
              <div
                key={group.project_id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/80 border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => toggleProject(group.project_id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    {expanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <ProjectStatusBadge status={group.project_status} className="text-[13px]" />
                        <span className="font-semibold text-gray-900">
                          {group.project_code || "未分配項目"}
                        </span>
                        {group.project_name && (
                          <span className="text-sm text-gray-500 truncate">{group.project_name}</span>
                        )}
                        {projectDefectBadge(group.os_project_defect)}
                        <Badge variant="outline" className="text-[12px]">
                          {group.orders.length} 筆訂單
                        </Badge>
                      </div>
                      {group.pm_name && (
                        <p className="text-xs text-gray-500 mt-0.5">PM: {group.pm_name}</p>
                      )}
                    </div>
                  </button>

                  {canModify && group.project_id !== "unassigned" && (
                    <div className="flex items-center gap-2 shrink-0">
                      {canMarkSmooth && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          onClick={() =>
                            setConfirmAction({
                              type: "smooth",
                              projectId: group.project_id,
                              projectCode: group.project_code || group.project_id,
                              currentDefect: group.os_project_defect,
                            })
                          }
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          順利完工
                        </Button>
                      )}
                      {group.os_project_defect !== PROJECT_DEFECT_FIXING && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                          onClick={() =>
                            setConfirmAction({
                              type: "needs_defect",
                              projectId: group.project_id,
                              projectCode: group.project_code || group.project_id,
                            })
                          }
                        >
                          <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                          需要執漏
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {expanded && (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs">產品</TableHead>
                        <TableHead className="text-xs w-16">數量</TableHead>
                        <TableHead className="text-xs">工廠</TableHead>
                        <TableHead className="text-xs">完工日期</TableHead>
                        <TableHead className="text-xs">執漏狀態</TableHead>
                        <TableHead className="text-xs">事件責任</TableHead>
                        <TableHead className="text-xs">執漏成因</TableHead>
                        <TableHead className="text-xs w-16" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.orders.map((order) => (
                        <TableRow
                          key={order.id}
                          className="cursor-pointer hover:bg-teal-50/40"
                          onClick={() => canModify && openOrderDialog(order.id)}
                        >
                          <TableCell className="text-sm font-medium">
                            {order.product_name || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {order.quantity ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {order.factory_name || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {order.complete_installation_date
                              ? formatDate(order.complete_installation_date)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {getCompletionDefectStatusDisplay(
                              order.o_defect_status,
                              group.os_project_defect,
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {getCompletionDefectSourceDisplay(
                              order.o_defect_source,
                              group.os_project_defect,
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {getCompletionDefectCauseDisplay(
                              order.defect_cause_label,
                              group.os_project_defect,
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 justify-center" onClick={(e) => e.stopPropagation()}>
                              <BWFOrderEditButton
                                onClick={() => {
                                  setEditingOrderId(order.id);
                                  setOrderDialogOpen(true);
                                }}
                              />
                              {group.project_id && group.project_id !== "unassigned" && (
                                <a
                                  href={`/bwf/projects/${group.project_id}`}
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
                )}
              </div>
            );
          })}
        </div>
      )}

      <UpdateDefectInfoDialog
        open={dialogOpen}
        orderId={selectedOrderId}
        onClose={() => {
          setDialogOpen(false);
          setSelectedOrderId(null);
        }}
        onSaved={loadData}
      />

      <BWFOrderDialog
        open={orderDialogOpen}
        orderId={editingOrderId}
        onClose={() => {
          setOrderDialogOpen(false);
          setEditingOrderId(null);
        }}
        onSaved={loadData}
      />

      <AlertDialog open={!!confirmAction} onOpenChange={() => !confirmSaving && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            {confirmAction?.type === "smooth" ? (
              <>
                <AlertDialogTitle className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                  確認順利完工
                </AlertDialogTitle>
                <AlertDialogDescription>
                  確定要將項目{" "}
                  <strong>{confirmAction.projectCode}</strong>{" "}
                  標記為
                  {confirmAction.currentDefect === PROJECT_DEFECT_FIXING
                    ? "「執漏完成」嗎？此項目正在執漏中，確認後將標記為執漏已完成。"
                    : "「順利完工」嗎？此操作表示項目所有訂單均已順利完成，無需執漏。"}
                </AlertDialogDescription>
              </>
            ) : (
              <>
                <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="w-5 h-5" />
                  確認需要執漏
                </AlertDialogTitle>
                <AlertDialogDescription>
                  確定要將項目{" "}
                  <strong>{confirmAction?.projectCode}</strong>{" "}
                  標記為「執漏中」嗎？此操作表示項目存在執漏問題，需要跟進處理。
                </AlertDialogDescription>
              </>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmSaving}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmSaving}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmAction();
              }}
              className={
                confirmAction?.type === "smooth"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-amber-600 hover:bg-amber-700"
              }
            >
              {confirmSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "確認"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
