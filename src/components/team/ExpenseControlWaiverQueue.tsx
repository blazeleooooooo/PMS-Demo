"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Unlock,
  XCircle,
  Ban,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { usePermission } from "@/hooks/use-permission";
import { useAuth } from "@/hooks/use-auth";
import { useIsSuperAdmin } from "@/hooks/use-report-staff-lock";
import { type WaiverStatus } from "@/lib/expense-control-waiver-service";
import { formatHongKongDateTime } from "@/lib/date-utils";

export type ExpenseControlWaiverQueueVariant = "default" | "installment";

export interface ExpenseControlWaiverQueueProps {
  /** default = team queue; installment = admin installment-vs-income queue */
  variant?: ExpenseControlWaiverQueueVariant;
  /** Permission module used for approve/reject/revoke (edit). */
  permissionModule?: string;
  title?: string;
  description?: string;
}

interface QueueItem {
  id: string;
  bwa_project_id: string;
  item_keys: string[];
  item_labels: string[];
  reason: string;
  status: WaiverStatus;
  applicant_id: string | null;
  applicant_name: string | null;
  reviewer_name: string | null;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  project_code: string | null;
  project_name: string | null;
}

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "pending", label: "待審核" },
  { value: "approved", label: "已批准" },
  { value: "rejected", label: "已拒絕" },
  { value: "revoked", label: "已撤銷" },
  { value: "all", label: "全部" },
];

function statusBadge(status: WaiverStatus) {
  switch (status) {
    case "pending":
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 gap-1">
          <Clock className="w-3 h-3" /> 待審核
        </Badge>
      );
    case "approved":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 gap-1">
          <CheckCircle2 className="w-3 h-3" /> 已批准
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 gap-1">
          <XCircle className="w-3 h-3" /> 已拒絕
        </Badge>
      );
    case "revoked":
      return (
        <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 gap-1">
          <Ban className="w-3 h-3" /> 已撤銷
        </Badge>
      );
  }
}

export default function ExpenseControlWaiverQueue({
  variant = "default",
  permissionModule = "expense-control-waivers",
  title = "支出鎖定豁免",
  description = "審核 BWA 項目 Expense Control 清單項目的豁免申請。批准後，對應項目不再封鎖出支票。",
}: ExpenseControlWaiverQueueProps) {
  const { canEdit } = usePermission();
  const { staff } = useAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const currentStaffId = staff?.id ?? null;
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionItem, setActionItem] = useState<QueueItem | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "revoke" | null>(
    null
  );
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Approve/reject/revoke: permissions matrix. Default queue also scopes rows
  // by API role filtering; installment queue is admin-permission gated.
  const canReview = canEdit(permissionModule);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ status });
      if (variant === "installment") params.set("queue", "installment");
      const res = await fetch(
        `/api/expense-control-waivers?${params.toString()}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "載入失敗");
      setItems(json.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, variant]);

  useEffect(() => {
    load();
  }, [load]);

  const isOwnApplication = (item: QueueItem) =>
    !!currentStaffId && item.applicant_id === currentStaffId;

  const canApproveOwn = isSuperAdmin;

  const openAction = (item: QueueItem, type: "approve" | "reject" | "revoke") => {
    if (type === "approve" && isOwnApplication(item) && !canApproveOwn) return;
    setActionItem(item);
    setActionType(type);
    setNote("");
    setNoteError(null);
  };

  const closeAction = () => {
    setActionItem(null);
    setActionType(null);
    setNote("");
    setNoteError(null);
  };

  const confirmAction = async () => {
    if (!actionItem || !actionType) return;
    if (actionType === "approve" && isOwnApplication(actionItem) && !canApproveOwn) {
      setError("不可批准自己的申請");
      return;
    }
    if (actionType === "reject" && !note.trim()) {
      setNoteError("請填寫審核備註");
      return;
    }
    setNoteError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/expense-control-waivers/${actionItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          reviewer_note: note.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "操作失敗");
      closeAction();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失敗");
    } finally {
      setSubmitting(false);
    }
  };

  const actionTitle =
    actionType === "approve"
      ? "批准豁免"
      : actionType === "reject"
        ? "拒絕豁免"
        : "撤銷豁免";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Unlock className="w-6 h-6 text-gray-700" />
            {title}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          重新整理
        </Button>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">申請列表</CardTitle>
            <Tabs value={status} onValueChange={setStatus}>
              <TabsList>
                {STATUS_TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="text-xs">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="text-sm text-red-600 mb-3">{error}</p>
          )}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-16">暫無申請</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>申請時間</TableHead>
                    <TableHead>申請人</TableHead>
                    <TableHead>項目</TableHead>
                    <TableHead>豁免項目</TableHead>
                    <TableHead>原因</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="align-top text-xs text-gray-500 whitespace-nowrap">
                        {formatHongKongDateTime(item.created_at)}
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        {item.applicant_name || "—"}
                        {item.reviewer_name && (
                          <p className="text-xs text-gray-400 mt-1">
                            審核：{item.reviewer_name}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Link
                          href={`/projects/bwa/${item.bwa_project_id}`}
                          className="text-sm font-medium text-blue-700 hover:underline"
                          target="_blank"
                        >
                          {item.project_code || "—"}
                        </Link>
                        <p className="text-xs text-gray-500 mt-0.5 max-w-[180px] truncate">
                          {item.project_name || "—"}
                        </p>
                      </TableCell>
                      <TableCell className="align-top max-w-[220px]">
                        <ul className="text-xs text-gray-700 space-y-0.5">
                          {item.item_labels.map((l) => (
                            <li key={l}>· {l}</li>
                          ))}
                        </ul>
                      </TableCell>
                      <TableCell className="align-top max-w-[240px]">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {item.reason}
                        </p>
                        {item.reviewer_note && (
                          <p className="text-xs text-gray-500 mt-1">
                            審核備註：{item.reviewer_note}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        {statusBadge(item.status)}
                      </TableCell>
                      <TableCell className="align-top text-right">
                        {canReview && item.status === "pending" && (
                          <div className="flex justify-end gap-1">
                            <span
                              title={
                                isOwnApplication(item) && !canApproveOwn
                                  ? "不可批准自己的申請"
                                  : undefined
                              }
                            >
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                disabled={isOwnApplication(item) && !canApproveOwn}
                                onClick={() => openAction(item, "approve")}
                              >
                                批准
                              </Button>
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => openAction(item, "reject")}
                            >
                              拒絕
                            </Button>
                          </div>
                        )}
                        {canReview && item.status === "approved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => openAction(item, "revoke")}
                          >
                            撤銷
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!actionItem && (actionType === "approve" || actionType === "reject")}
        onOpenChange={(o) => !o && closeAction()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionTitle}</DialogTitle>
          </DialogHeader>
          {actionItem && (
            <div className="space-y-3 text-sm">
              <p>
                項目{" "}
                <span className="font-medium">
                  {actionItem.project_code || actionItem.project_name}
                </span>
              </p>
              <p className="text-gray-600">
                {actionItem.item_labels.join("、")}
              </p>
              <div>
                <label className="text-xs text-gray-500">
                  審核備註
                  {actionType === "reject" ? (
                    <span className="text-red-500"> *</span>
                  ) : (
                    "（選填）"
                  )}
                </label>
                <Textarea
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    if (noteError) setNoteError(null);
                  }}
                  rows={3}
                  className="mt-1"
                  placeholder={
                    actionType === "reject"
                      ? "請填寫拒絕原因給申請人"
                      : "可填寫備註給申請人"
                  }
                />
                {noteError && (
                  <p className="text-xs text-red-600 mt-1">{noteError}</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeAction} disabled={submitting}>
              取消
            </Button>
            <Button
              onClick={confirmAction}
              disabled={
                submitting ||
                (actionType === "reject" && !note.trim()) ||
                (actionType === "approve" &&
                  !!actionItem &&
                  isOwnApplication(actionItem) &&
                  !canApproveOwn)
              }
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                actionTitle
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!actionItem && actionType === "revoke"}
        onOpenChange={(o) => !o && closeAction()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認撤銷豁免？</AlertDialogTitle>
            <AlertDialogDescription>
              撤銷後，若 Expense Control 清單仍未完成，該項目的出支票功能將再次鎖定。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1">
            <label className="text-xs text-gray-500">審核備註（選填）</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction} disabled={submitting}>
              {submitting ? "處理中…" : "確認撤銷"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
