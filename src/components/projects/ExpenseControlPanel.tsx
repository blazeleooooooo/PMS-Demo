"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Lock,
  Loader2,
  RefreshCw,
  ArrowRight,
  Unlock,
  Clock,
  Ban,
  FileText,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  evaluateExpenseControl,
  type ExpenseControlItem,
  type ExpenseControlResult,
} from "@/lib/expense-control-service";
import {
  EXPENSE_CONTROL_FIX_ACTIONS,
  getExpenseControlFixDisabledReason,
  type ExpenseControlFixHandler,
  type ExpenseControlTabAvailability,
} from "@/lib/expense-control-actions";
import {
  fetchWaiversForProject,
  isInstallmentVsIncomeItemKey,
  labelForWaiverItems,
  waiverHasInstallmentVsIncomeItem,
  waiverStatusByItemKey,
  type ExpenseControlWaiver,
  type WaiverStatus,
} from "@/lib/expense-control-waiver-service";
import { formatMoney, formatTimestamp } from "@/lib/date-utils";
import { BWA_PROJECT_SIZE_LABELS } from "@/lib/bwa-project-size";

interface ExpenseControlPanelProps {
  projectId: string;
  /** Notify parent of the latest restriction state so it can gate the Expense tab. */
  onResult?: (result: ExpenseControlResult) => void;
  /** Navigate user to the screen where they can complete a failed check. */
  onFixItem?: ExpenseControlFixHandler;
  /** Whether the user may use the fix button for this item key. */
  canFixItem?: (key: string) => boolean;
  /** Which destination tabs exist for this project. */
  tabAvailability?: ExpenseControlTabAvailability;
  /** Re-run evaluation when the tab becomes visible again. */
  isActive?: boolean;
}

/** Expense-control checklist tier (not the exact project_size band). */
const CHECK_LEVEL_LABEL: Record<string, string> = {
  high: "檢查級別 : 高 (>$250K)",
  mid: "檢查級別 : 中 ($30-250K)",
  none: "檢查級別 : 無 (<$30k)",
};

const CHECK_LEVEL_BADGE_CLASS: Record<string, string> = {
  high: "border-transparent bg-violet-100 text-violet-800 hover:bg-violet-100",
  mid: "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-100",
  none: "border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
};

function WaiverBadge({ status }: { status: WaiverStatus }) {
  if (status === "approved") {
    return (
      <Badge className="flex-shrink-0 text-[11px] bg-violet-100 text-violet-800 hover:bg-violet-100">
        已豁免
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge className="flex-shrink-0 text-[11px] bg-amber-100 text-amber-800 hover:bg-amber-100">
        待審核
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge
        variant="outline"
        className="flex-shrink-0 text-[11px] text-red-600 border-red-200"
      >
        已拒絕
      </Badge>
    );
  }
  if (status === "revoked") {
    return (
      <Badge className="flex-shrink-0 text-[11px] bg-gray-100 text-gray-600 hover:bg-gray-100">
        已撤銷
      </Badge>
    );
  }
  return null;
}

function WaiverApplicationStatusBadge({ status }: { status: WaiverStatus }) {
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

function FixItemButton({
  item,
  onFixItem,
  canFix,
  tabAvailability,
}: {
  item: ExpenseControlItem;
  onFixItem?: ExpenseControlFixHandler;
  canFix: boolean;
  tabAvailability: ExpenseControlTabAvailability;
}) {
  const action = EXPENSE_CONTROL_FIX_ACTIONS[item.key];
  if (!action || !onFixItem) return null;

  const availabilityReason = getExpenseControlFixDisabledReason(item.key, tabAvailability);
  const disabled = !canFix || !!availabilityReason;
  const tooltip = availabilityReason
    ? availabilityReason
    : !canFix
      ? "您沒有權限修改此項目"
      : action.labelEn;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-[12px] border-red-200 text-red-700 hover:bg-red-50 whitespace-nowrap"
              disabled={disabled}
              onClick={() => onFixItem(item.key, item)}
            >
              {action.label}
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function ExpenseControlPanel({
  projectId,
  onResult,
  onFixItem,
  canFixItem,
  tabAvailability = { workSchedule: true, siteStatus: true },
  isActive = true,
}: ExpenseControlPanelProps) {
  const [result, setResult] = useState<ExpenseControlResult | null>(null);
  const [waivers, setWaivers] = useState<ExpenseControlWaiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [waiversExpanded, setWaiversExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, w] = await Promise.all([
      evaluateExpenseControl(projectId),
      fetchWaiversForProject(projectId),
    ]);
    setResult(r);
    setWaivers(w);
    onResult?.(r);
    setLoading(false);
  }, [projectId, onResult]);

  useEffect(() => {
    if (isActive) load();
  }, [isActive, projectId, load]);

  const statusByKey = waiverStatusByItemKey(waivers);
  const waivedSet = new Set(result?.waivedItemKeys ?? []);
  /** Pending applications (installment vs regular may coexist). */
  const pendingWaivers = waivers.filter((w) => w.status === "pending");
  const hasPendingWaiver = pendingWaivers.length > 0;

  const eligibleItems =
    result?.sections
      .filter((s) => s.active)
      .flatMap((s) => s.items)
      .filter((i) => {
        if (i.applicable === false) return false;
        if (i.passed) return false;
        if (waivedSet.has(i.key)) return false;
        const st = statusByKey.get(i.key);
        if (st === "pending" || st === "approved") return false;
        return true;
      }) ?? [];

  const openApply = () => {
    // Do not pre-select all eligible keys — selecting everything used to create
    // a second regular-queue waiver (e.g. schedule) alongside installment-vs-income.
    setSelectedKeys([]);
    setReason("");
    setApplyError(null);
    setApplyOpen(true);
  };

  const installmentEligible = eligibleItems.filter((i) =>
    isInstallmentVsIncomeItemKey(i.key)
  );
  const regularEligible = eligibleItems.filter(
    (i) => !isInstallmentVsIncomeItemKey(i.key)
  );

  const cancelPending = async () => {
    if (pendingWaivers.length === 0) return;
    setSubmitting(true);
    setApplyError(null);
    try {
      for (const pending of pendingWaivers) {
        const res = await fetch(`/api/expense-control-waivers/${pending.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel" }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "撤銷失敗");
      }
      await load();
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : "撤銷失敗");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleKey = (key: string, checked: boolean) => {
    setSelectedKeys((prev) =>
      checked ? [...new Set([...prev, key])] : prev.filter((k) => k !== key)
    );
  };

  const submitApply = async () => {
    if (selectedKeys.length === 0) {
      setApplyError("請至少選擇一個項目");
      return;
    }
    if (!reason.trim()) {
      setApplyError("請填寫申請原因");
      return;
    }
    setSubmitting(true);
    setApplyError(null);
    try {
      // Installment-vs-income must be its own application (special admin approvers).
      const installmentKeys = selectedKeys.filter(isInstallmentVsIncomeItemKey);
      const regularKeys = selectedKeys.filter((k) => !isInstallmentVsIncomeItemKey(k));
      const batches = [installmentKeys, regularKeys].filter((keys) => keys.length > 0);
      for (const item_keys of batches) {
        const res = await fetch("/api/expense-control-waivers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bwa_project_id: projectId,
            item_keys,
            reason: reason.trim(),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "提交失敗");
      }
      setApplyOpen(false);
      await load();
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : "提交失敗");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!result) return null;

  const {
    tier,
    restricted,
    passedCount,
    activeItemCount,
    sections,
    applicable,
    costCentreBuCode,
    storedProjectSize,
    totalAmount,
  } = result;

  // Same prefer-stored / income-fallback branch as resolveBwaProjectSize (tier logic).
  const hasStoredProjectSize =
    !!storedProjectSize &&
    (BWA_PROJECT_SIZE_LABELS as readonly string[]).includes(storedProjectSize);
  const projectSizeBadgeText = hasStoredProjectSize
    ? `項目規模：${storedProjectSize}`
    : `預計收入：${formatMoney(totalAmount, { showZero: true })}`;

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div
        className={`flex items-start gap-3 px-5 py-4 rounded-xl border ${
          !applicable
            ? "bg-gray-50 border-gray-200 text-gray-600"
            : tier === "none"
              ? "bg-gray-50 border-gray-200 text-gray-600"
              : restricted
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
        }`}
      >
        {restricted && tier !== "none" && applicable ? (
          <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
        ) : (
          <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">
            {!applicable
              ? "此成本中心不適用出票限制"
              : tier === "none"
                ? "此項目無出票限制"
                : restricted
                  ? "出支票功能受限制 Expense Restricted"
                  : "已完成所需資料，出支票功能已解鎖"}
          </p>
          <p className="text-[13px] mt-0.5 opacity-90">
            {!applicable
              ? `成本中心 ${costCentreBuCode || "—"} 已設定為不適用 Expense Control，此項目的支出新增及編輯不受清單限制。`
              : tier === "none"
                ? "項目規模為「小於$30K」的項目不受出票限制。"
                : hasPendingWaiver && eligibleItems.length === 0
                  ? "已有待審核的豁免申請。審批前出支票仍受清單限制；可按「撤銷」取消申請。"
                  : hasPendingWaiver && restricted
                    ? "部份豁免申請待審核；其餘未完成項目仍可繼續申請豁免。"
                    : restricted
                    ? "已開啟階段中尚有必填資料未完成，請完成下方清單後方可新增/編輯支出。亦可申請豁免個別項目。"
                    : waivedSet.size > 0
                      ? "部份項目經豁免後已解鎖出支票功能；清單仍顯示實際完成狀態。"
                      : "所有已開啟階段的必填資料已完成。"}
          </p>
        </div>
        {applicable && tier !== "none" && (hasPendingWaiver || (restricted && eligibleItems.length > 0)) ? (
          <div className="flex flex-shrink-0 gap-2">
            {hasPendingWaiver && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1 border-amber-300 text-amber-800 hover:bg-amber-50"
                onClick={cancelPending}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                撤銷
              </Button>
            )}
            {restricted && eligibleItems.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1 border-red-300 text-red-700 hover:bg-red-50"
                onClick={openApply}
              >
                <Unlock className="w-3.5 h-3.5" />
                申請豁免
              </Button>
            )}
          </div>
        ) : null}
      </div>
      {applyError && !applyOpen && (
        <p className="text-sm text-red-600 -mt-3">{applyError}</p>
      )}

      {/* Header bar with tier + recheck — always shown so users can re-evaluate */}
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-[13px]">
          {passedCount}/{activeItemCount} 已完成 (已開啟階段)
        </Badge>
        <div className="flex items-center gap-2">
          <Badge
            className={`text-[12px] font-normal ${CHECK_LEVEL_BADGE_CLASS[tier] ?? ""}`}
          >
            {CHECK_LEVEL_LABEL[tier] ?? "—"}
          </Badge>
          <Badge variant="outline" className="text-[12px] font-normal text-gray-500">
            {projectSizeBadgeText}
          </Badge>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-[13px]" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5" /> 重新檢查
          </Button>
        </div>
      </div>

      {/* Applied waivers — progress of user's applications (collapsed by default) */}
      {waivers.length > 0 && (
        <Collapsible open={waiversExpanded} onOpenChange={setWaiversExpanded}>
          <Card className="border shadow-sm border-gray-100">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/80 rounded-xl transition-colors"
              >
                <div className="min-w-0 flex items-center gap-2 flex-wrap">
                  <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-gray-700">
                    豁免申請進度
                  </span>
                  <Badge variant="secondary" className="text-[11px] font-normal">
                    {waivers.length}
                  </Badge>
                  {hasPendingWaiver && (
                    <Badge className="text-[11px] font-normal bg-amber-100 text-amber-800 hover:bg-amber-100">
                      {pendingWaivers.length} 待審核
                    </Badge>
                  )}
                  {!waiversExpanded && (
                    <span className="text-[12px] text-gray-400 font-normal">
                      點擊展開詳情
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
                    waiversExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="px-5 pb-4 pt-0">
                <Separator className="mb-3" />
                <p className="text-[12px] text-gray-400 mb-2">
                  本項目的豁免申請詳情與審核狀態（最新在上）。
                </p>
                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[12px]">申請時間</TableHead>
                        <TableHead className="text-[12px]">豁免項目</TableHead>
                        <TableHead className="text-[12px]">原因</TableHead>
                        <TableHead className="text-[12px]">狀態</TableHead>
                        <TableHead className="text-[12px]">審核</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {waivers.map((w) => {
                        const isInstallment = waiverHasInstallmentVsIncomeItem(
                          w.item_keys
                        );
                        return (
                          <TableRow key={w.id}>
                            <TableCell className="align-top text-xs text-gray-500 whitespace-nowrap">
                              {formatTimestamp(w.created_at)}
                              {w.applicant_name && (
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  {w.applicant_name}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="align-top max-w-[240px]">
                              <p className="text-sm text-gray-800">
                                {labelForWaiverItems(w.item_keys)}
                              </p>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {isInstallment
                                  ? "管理員審核 · 支出總額豁免"
                                  : "團隊審核 · 支出鎖定豁免"}
                              </p>
                            </TableCell>
                            <TableCell className="align-top max-w-[260px]">
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                {w.reason || "—"}
                              </p>
                            </TableCell>
                            <TableCell className="align-top">
                              <WaiverApplicationStatusBadge status={w.status} />
                            </TableCell>
                            <TableCell className="align-top text-xs text-gray-500 min-w-[140px]">
                              {w.status === "pending" ? (
                                <span className="text-amber-700">等待審核中</span>
                              ) : (
                                <>
                                  {w.reviewer_name && (
                                    <p>審核人：{w.reviewer_name}</p>
                                  )}
                                  {w.reviewed_at && (
                                    <p className="mt-0.5">
                                      {formatTimestamp(w.reviewed_at)}
                                    </p>
                                  )}
                                  {w.reviewer_note && (
                                    <p className="mt-1 text-gray-600 whitespace-pre-wrap">
                                      備註：{w.reviewer_note}
                                    </p>
                                  )}
                                  {!w.reviewer_name &&
                                    !w.reviewed_at &&
                                    !w.reviewer_note && (
                                      <span>—</span>
                                    )}
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Stage sections — hidden when cost centre excluded or 小於$30K */}
      {!applicable || tier === "none"
        ? null
        : sections.map((section, idx) => {
            const sectionCountable = section.items.filter((i) => i.applicable !== false);
            const sectionDone =
              section.active &&
              (sectionCountable.length === 0 ||
                sectionCountable.every(
                  (i) => i.passed || waivedSet.has(i.key)
                ));
            return (
              <Card
                key={section.key}
                className={`border shadow-sm ${section.active ? "border-gray-100" : "border-gray-100 opacity-70"}`}
              >
                <CardHeader className="pb-2 pt-4 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold ${
                          !section.active
                            ? "bg-gray-100 text-gray-400"
                            : sectionDone
                              ? "bg-emerald-100 text-emerald-600"
                              : "bg-red-100 text-red-600"
                        }`}
                      >
                        {idx + 1}
                      </span>
                      {section.title}
                      <span className="text-gray-400 font-normal">{section.titleEn}</span>
                    </CardTitle>
                    {section.active ? (
                      sectionDone ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[12px]">已完成</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[12px]">待完成</Badge>
                      )
                    ) : (
                      <Badge variant="outline" className="text-[12px] text-gray-400 gap-1">
                        <Lock className="w-3 h-3" /> 未開啟
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-4 pt-1">
                  <Separator className="mb-3" />
                  <p className="text-[12px] text-gray-400 mb-2">
                    {section.active
                      ? `此階段已於「${section.gateHint}」開啟，檢查項目已生效。`
                      : `此階段將於「${section.gateHint}」開啟。`}
                  </p>
                  <div className="space-y-1.5">
                    {section.items.map((item) => {
                      const isNa = item.applicable === false;
                      const dim = !section.active && !isNa;
                      const waiverSt = statusByKey.get(item.key);
                      const isWaived = waivedSet.has(item.key) || waiverSt === "approved";
                      const showFix =
                        section.active &&
                        !isNa &&
                        !item.passed &&
                        !isWaived &&
                        !!EXPENSE_CONTROL_FIX_ACTIONS[item.key];
                      const canFix = canFixItem ? canFixItem(item.key) : true;

                      return (
                        <div
                          key={item.key}
                          className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                            isNa || dim
                              ? "bg-gray-50/60 border-gray-100 opacity-70"
                              : item.passed
                                ? "bg-emerald-50/40 border-emerald-100"
                                : isWaived
                                  ? "bg-violet-50/50 border-violet-100"
                                  : "bg-red-50/40 border-red-100"
                          }`}
                        >
                          <span className="mt-0.5 flex-shrink-0">
                            {dim ? (
                              <Lock className="w-4 h-4 text-gray-300" />
                            ) : item.passed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : isWaived ? (
                              <Unlock className="w-4 h-4 text-violet-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-[14px] ${
                                isNa
                                  ? "text-gray-500 line-through"
                                  : dim
                                    ? "text-gray-400"
                                    : "text-gray-800"
                              }`}
                            >
                              {item.label}
                            </p>
                            <p
                              className={`text-[12px] ${
                                isNa ? "text-gray-400 line-through" : "text-gray-400"
                              }`}
                            >
                              {item.labelEn}
                            </p>
                            {item.hint &&
                              (isNa ||
                                (section.active && !item.passed && !isWaived)) && (
                              <p
                                className={`text-[12px] mt-0.5 leading-relaxed whitespace-pre-line ${
                                  isNa ? "text-gray-500" : "text-red-500"
                                }`}
                              >
                                {item.hint}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {waiverSt && !isNa && <WaiverBadge status={waiverSt} />}
                            {isNa ? (
                              <Badge
                                variant="outline"
                                className="flex-shrink-0 text-[11px] text-gray-500 border-gray-300"
                              >
                                不適用
                              </Badge>
                            ) : showFix ? (
                              <FixItemButton
                                item={item}
                                onFixItem={onFixItem}
                                canFix={canFix}
                                tabAvailability={tabAvailability}
                              />
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>申請豁免</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              請勾選需要豁免的項目（預設不勾選）。「支出總額」會獨立送至管理員「支出總額豁免」審核；其他項目送至「支出鎖定豁免」。
            </p>
            <div className="space-y-3 max-h-64 overflow-y-auto border rounded-lg p-3">
              {installmentEligible.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-violet-700">
                    管理員審核 · 支出總額豁免
                  </p>
                  {installmentEligible.map((item) => (
                    <label
                      key={item.key}
                      className="flex items-start gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedKeys.includes(item.key)}
                        onCheckedChange={(v) => toggleKey(item.key, v === true)}
                        className="mt-0.5"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              )}
              {regularEligible.length > 0 && (
                <div className="space-y-2">
                  {installmentEligible.length > 0 && (
                    <p className="text-xs font-medium text-gray-500 pt-1 border-t">
                      團隊審核 · 支出鎖定豁免
                    </p>
                  )}
                  {regularEligible.map((item) => (
                    <label
                      key={item.key}
                      className="flex items-start gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedKeys.includes(item.key)}
                        onCheckedChange={(v) => toggleKey(item.key, v === true)}
                        className="mt-0.5"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              )}
              {eligibleItems.length === 0 && (
                <p className="text-sm text-gray-400">沒有可申請的項目</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                申請原因 <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="mt-1"
                placeholder="請說明為何需要豁免（必填）"
              />
            </div>
            {applyError && <p className="text-sm text-red-600">{applyError}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApplyOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button onClick={submitApply} disabled={submitting}>
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "提交申請"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
