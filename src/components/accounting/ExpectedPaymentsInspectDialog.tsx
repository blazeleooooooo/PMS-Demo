"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import ProjectFinanceHistoryDialog from "@/components/projects/ProjectFinanceHistoryDialog";
import type { ProjectEntityType } from "@/components/projects/ProjectFinancePanels";
import {
  groupInspectProjects,
  type ExpectedPaymentInspectGroupBy,
  type ExpectedPaymentProjectGroup,
  type ExpectedPaymentSource,
} from "@/lib/data/expected-payments";
import { ProjectStatusDot } from "@/components/ui/entity-status-badges";
import { projectStatusShortLabel } from "@/lib/project-status-rules";

function projectUrl(source: ExpectedPaymentSource, id: string): string {
  return source === "BWF" ? `/bwf/projects/${id}` : `/projects/bwa/${id}`;
}

const GROUP_OPTIONS: { value: ExpectedPaymentInspectGroupBy; label: string }[] = [
  { value: "none", label: "不分組" },
  { value: "staff", label: "主PM" },
  { value: "project_size", label: "項目規模" },
  { value: "status", label: "狀態" },
];

function MetricCells({
  income,
  expense,
  gp,
  money,
  emphasize,
}: {
  income: number;
  expense: number;
  gp: number;
  money: (val: number) => string;
  emphasize?: boolean;
}) {
  const weight = emphasize ? "font-semibold" : "font-medium";
  return (
    <>
      <TableCell className={`text-right text-sm tabular-nums text-emerald-700 ${weight}`}>
        {money(income)}
      </TableCell>
      <TableCell className={`text-right text-sm tabular-nums text-rose-600 ${weight}`}>
        {expense > 0 ? `-${money(expense)}` : money(0)}
      </TableCell>
      <TableCell
        className={`text-right text-sm tabular-nums ${weight} ${
          gp < 0 ? "text-rose-600" : "text-bw-navy"
        }`}
      >
        {gp < 0 ? `-${money(Math.abs(gp))}` : money(gp)}
      </TableCell>
    </>
  );
}

function entityTypeOf(source: ExpectedPaymentSource): ProjectEntityType {
  return source === "BWF" ? "bwf_project" : "bwa_project";
}

function ProjectDetailRow({
  row,
  money,
  indented,
  onOpenFinance,
}: {
  row: ExpectedPaymentProjectGroup;
  money: (val: number) => string;
  indented?: boolean;
  onOpenFinance: (row: ExpectedPaymentProjectGroup) => void;
}) {
  return (
    <TableRow className="hover:bg-gray-50/60">
      <TableCell className={indented ? "pl-10" : undefined}>
        <a
          href={projectUrl(row.project.source, row.project.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="block hover:text-bw-blue"
        >
          <div className="flex items-center gap-1.5">
            <ProjectStatusDot status={row.project.status} />
            <div className="text-sm font-medium text-gray-900">
              {row.project.project_name || "未命名項目"}
            </div>
          </div>
          {row.project.project_code && (
            <div className="text-xs text-gray-400 mt-0.5 ml-3.5">{row.project.project_code}</div>
          )}
        </a>
      </TableCell>
      <TableCell className="text-sm text-gray-600 whitespace-nowrap">
        {row.project.pm_name || "—"}
      </TableCell>
      <TableCell className="text-sm text-gray-600 whitespace-nowrap">
        {row.project.project_size || "—"}
      </TableCell>
      <MetricCells
        income={row.incomeOutstanding}
        expense={row.expenseOutstanding}
        gp={row.gpOutstanding}
        money={money}
      />
      <TableCell className="text-right whitespace-nowrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onClick={(e) => {
            e.stopPropagation();
            onOpenFinance(row);
          }}
        >
          <Receipt className="w-3.5 h-3.5" />
          明細
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function ExpectedPaymentsInspectDialog({
  open,
  onOpenChange,
  source,
  columnLabel,
  rows,
  onFinanceChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: ExpectedPaymentSource | null;
  columnLabel: string;
  rows: ExpectedPaymentProjectGroup[];
  onFinanceChanged?: () => void;
}) {
  const { formatMoney } = useFinancialFormat();
  const money = (val: number) => formatMoney(val, { showZero: true });
  const [groupBy, setGroupBy] = useState<ExpectedPaymentInspectGroupBy>("none");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [financeDialog, setFinanceDialog] = useState<{
    projectId: string;
    entityType: ProjectEntityType;
    projectCode: string | null;
    projectName: string | null;
  } | null>(null);

  useEffect(() => {
    setExpandedKeys(new Set());
  }, [groupBy, source, columnLabel, open]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          income: acc.income + row.incomeOutstanding,
          expense: acc.expense + row.expenseOutstanding,
          gp: acc.gp + row.gpOutstanding,
        }),
        { income: 0, expense: 0, gp: 0 }
      ),
    [rows]
  );

  const buckets = useMemo(() => groupInspectProjects(rows, groupBy), [rows, groupBy]);
  const isGrouped = groupBy !== "none";

  const toggleGroup = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openFinance = (row: ExpectedPaymentProjectGroup) => {
    setFinanceDialog({
      projectId: row.project.id,
      entityType: entityTypeOf(row.project.source),
      projectCode: row.project.project_code,
      projectName: row.project.project_name,
    });
  };

  return (
    <>
    <Dialog
      open={open}
      modal={!financeDialog}
      onOpenChange={(next) => {
        if (!next && financeDialog) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {source} · {columnLabel}
          </DialogTitle>
          <DialogDescription>
            預期於此時段內的收入與支出，按項目彙總未收／未付
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] text-gray-400 font-medium">分組</span>
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            {GROUP_OPTIONS.map((opt, idx) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGroupBy(opt.value)}
                className={`px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  idx > 0 ? "border-l border-gray-200" : ""
                } ${
                  groupBy === opt.value
                    ? "bg-bw-blue text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="text-xs font-semibold text-gray-600 min-w-[220px]">
                  {isGrouped ? "分組 / 項目" : "項目"}
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                  主PM
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                  項目規模
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 whitespace-nowrap text-right">
                  收入未收
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 whitespace-nowrap text-right">
                  支出未付
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 whitespace-nowrap text-right">
                  毛利未結
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 whitespace-nowrap text-right w-[72px]">
                  明細
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-gray-400 py-10">
                    此時段沒有收入或支出記錄
                  </TableCell>
                </TableRow>
              ) : isGrouped ? (
                buckets.map((bucket) => {
                  const expanded = expandedKeys.has(bucket.key);
                  return (
                    <React.Fragment key={bucket.key}>
                      <TableRow
                        className={`cursor-pointer hover:bg-gray-50/80 ${
                          expanded ? "bg-blue-50/40" : "bg-gray-50/40"
                        }`}
                        onClick={() => toggleGroup(bucket.key)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-0">
                            {expanded ? (
                              <ChevronDown className="w-4 h-4 text-bw-blue shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-900">
                                {groupBy === "status"
                                  ? projectStatusShortLabel(bucket.label) || bucket.label
                                  : bucket.label}
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                {bucket.rows.length} 個項目
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-400">
                          {groupBy === "staff" ? bucket.label : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-400">
                          {groupBy === "project_size" ? bucket.label : "—"}
                        </TableCell>
                        <MetricCells
                          income={bucket.incomeOutstanding}
                          expense={bucket.expenseOutstanding}
                          gp={bucket.gpOutstanding}
                          money={money}
                          emphasize
                        />
                        <TableCell />
                      </TableRow>
                      {expanded &&
                        bucket.rows.map((row) => (
                          <ProjectDetailRow
                            key={row.project.id}
                            row={row}
                            money={money}
                            indented
                            onOpenFinance={openFinance}
                          />
                        ))}
                    </React.Fragment>
                  );
                })
              ) : (
                rows.map((row) => (
                  <ProjectDetailRow
                    key={row.project.id}
                    row={row}
                    money={money}
                    onOpenFinance={openFinance}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {rows.length > 0 && (
          <div className="flex items-center justify-between gap-3 pt-2 border-t text-xs text-gray-500">
            <span>
              {rows.length} 個項目
              {isGrouped ? ` · ${buckets.length} 組` : ""}
            </span>
            <div className="flex items-center gap-4 tabular-nums">
              <span>收入未收 {money(totals.income)}</span>
              <span className="text-rose-600">
                支出未付 {totals.expense > 0 ? `-${money(totals.expense)}` : money(0)}
              </span>
              <span className={totals.gp < 0 ? "text-rose-600" : "text-bw-navy"}>
                毛利未結{" "}
                {totals.gp < 0 ? `-${money(Math.abs(totals.gp))}` : money(totals.gp)}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <ProjectFinanceHistoryDialog
      open={!!financeDialog}
      onOpenChange={(next) => {
        if (!next) setFinanceDialog(null);
      }}
      projectId={financeDialog?.projectId ?? null}
      entityType={financeDialog?.entityType ?? "bwa_project"}
      projectCode={financeDialog?.projectCode}
      projectName={financeDialog?.projectName}
      initialTab="income"
      onDataChanged={onFinanceChanged}
    />
    </>
  );
}
