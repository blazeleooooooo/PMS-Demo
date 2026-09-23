"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import ExpectedPaymentsInspectDialog from "@/components/accounting/ExpectedPaymentsInspectDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPercent } from "@/lib/date-utils";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { usePermission } from "@/hooks/use-permission";
import {
  aggregateExpectedPayments,
  applyDateBasis,
  buildExpectedPaymentColumns,
  fetchExpectedPaymentLines,
  groupExpectedPaymentsByProject,
  todayHkYmd,
  type ExpectedPaymentBucketMode,
  type ExpectedPaymentCell,
  type ExpectedPaymentColumn,
  type ExpectedPaymentDateBasis,
  type ExpectedPaymentKind,
  type ExpectedPaymentLine,
  type ExpectedPaymentProject,
  type ExpectedPaymentSource,
} from "@/lib/data/expected-payments";

const MODE_OPTIONS: { value: ExpectedPaymentBucketMode; label: string }[] = [
  { value: "horizon", label: "長中短期" },
  { value: "days30", label: "按30天" },
  { value: "month", label: "按月份" },
];

const DATE_BASIS_OPTIONS: { value: ExpectedPaymentDateBasis; label: string }[] = [
  { value: "mixed", label: "混合預計 Mixed Expected" },
  { value: "due_date", label: "到期日 Due Date" },
  { value: "expected_payment_date", label: "預計收款日期 Expected Receipt" },
];

const DATE_BASIS_HINT: Record<ExpectedPaymentDateBasis, string> = {
  mixed: "以預計收款日期分欄，空白則用到期日；已結案／內部工程不計入",
  due_date: "以到期日分欄，無到期日的款項不計入；已結案／內部工程不計入",
  expected_payment_date: "以預計收款日期分欄，無預計收款日期的款項不計入；已結案／內部工程不計入",
};

type DetailKind = "expected" | "actual" | "ratio";
type RowKind = DetailKind | "inspect";

const DETAIL_OPTIONS: { value: DetailKind; label: string }[] = [
  { value: "expected", label: "預計" },
  { value: "actual", label: "實際" },
  { value: "ratio", label: "比率" },
];

const ALL_DETAILS: Record<DetailKind, boolean> = {
  expected: true,
  actual: true,
  ratio: true,
};

const SOURCES: ExpectedPaymentSource[] = ["BWA", "BWF"];

function cellOf(
  matrix: ReturnType<typeof aggregateExpectedPayments>,
  source: ExpectedPaymentSource,
  kind: ExpectedPaymentKind,
  key: string
): ExpectedPaymentCell {
  return matrix[source][kind][key] ?? { amount: 0, counterpart: 0 };
}

function sumCells(cells: ExpectedPaymentCell[]): ExpectedPaymentCell {
  return cells.reduce(
    (acc, cell) => ({
      amount: acc.amount + cell.amount,
      counterpart: acc.counterpart + cell.counterpart,
    }),
    { amount: 0, counterpart: 0 }
  );
}

function ratioPct(expected: number, actual: number): number | null {
  if (expected <= 0) return null;
  return (actual / expected) * 100;
}

function changePct(expected: number, actual: number): number | null {
  if (expected === 0) return actual === 0 ? 0 : null;
  return ((actual - expected) / Math.abs(expected)) * 100;
}

function MoneyCell({
  value,
  tone,
  formatMoney,
}: {
  value: number;
  tone: "income" | "expense" | "profit";
  formatMoney: (val: number, options?: { showZero?: boolean }) => string;
}) {
  const money = formatMoney(Math.abs(value), { showZero: true });
  const signed =
    tone === "expense" && value > 0
      ? `-${money}`
      : value < 0
        ? `-${money}`
        : money;
  const color =
    tone === "income"
      ? "text-emerald-700"
      : tone === "expense" || value < 0
        ? "text-rose-600"
        : "text-bw-navy";

  return (
    <div className={`text-right text-sm tabular-nums font-medium ${color}`}>
      {signed}
    </div>
  );
}

function PercentCell({
  value,
  tone,
  canView,
  mask,
}: {
  value: number | null;
  tone: "ratio" | "change";
  canView: boolean;
  mask: string;
}) {
  if (!canView) {
    return <div className="text-right text-sm tabular-nums text-gray-400">{mask}</div>;
  }
  const text = formatPercent(value, { fallback: "—", decimals: 1 });
  const color =
    tone === "change" && value != null
      ? value > 0
        ? "text-emerald-700"
        : value < 0
          ? "text-rose-600"
          : "text-gray-600"
      : "text-gray-600";
  const prefix = tone === "change" && value != null && value > 0 ? "+" : "";

  return (
    <div className={`text-right text-sm tabular-nums font-medium ${color}`}>
      {value == null ? text : `${prefix}${text}`}
    </div>
  );
}

export default function ExpectedPaymentsManagement() {
  const { formatMoney, canViewFinancialValues, financialMask } = useFinancialFormat();
  const { loading: permLoading } = usePermission();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lines, setLines] = useState<ExpectedPaymentLine[]>([]);
  const [projects, setProjects] = useState<Record<string, ExpectedPaymentProject>>({});
  const [mode, setMode] = useState<ExpectedPaymentBucketMode>("horizon");
  const [dateBasis, setDateBasis] = useState<ExpectedPaymentDateBasis>("mixed");
  const [visibleDetails, setVisibleDetails] = useState(ALL_DETAILS);
  const [inspect, setInspect] = useState<{
    source: ExpectedPaymentSource;
    columnKey: string | "total";
    columnLabel: string;
  } | null>(null);

  const toggleDetail = (key: DetailKind) => {
    setVisibleDetails((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.expected && !next.actual && !next.ratio) return prev;
      return next;
    });
  };

  const todayYmd = useMemo(() => todayHkYmd(), []);
  const datedLines = useMemo(
    () => applyDateBasis(lines, dateBasis),
    [lines, dateBasis]
  );
  const columns = useMemo(
    () => buildExpectedPaymentColumns(mode, todayYmd),
    [mode, todayYmd]
  );
  const matrix = useMemo(
    () => aggregateExpectedPayments(datedLines, columns, mode, todayYmd),
    [datedLines, columns, mode, todayYmd]
  );

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const bundle = await fetchExpectedPaymentLines();
      setLines(bundle.lines);
      setProjects(bundle.projects);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || permLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-bw-blue" />
        <span className="ml-3 text-gray-500 text-sm">載入預計收付款...</span>
      </div>
    );
  }

  const renderMetricBlock = (
    source: ExpectedPaymentSource,
    columnsForRow: ExpectedPaymentColumn[]
  ) => {
    const incomeCells = columnsForRow.map((col) => cellOf(matrix, source, "income", col.key));
    const expenseCells = columnsForRow.map((col) => cellOf(matrix, source, "expense", col.key));
    const incomeTotal = sumCells(incomeCells);
    const expenseTotal = sumCells(expenseCells);
    const valueCells = [...incomeCells, incomeTotal];

    const blocks: {
      group: string;
      groupClass: string;
      rows: {
        kind: RowKind;
        label: string;
        render: (idx: number) => React.ReactNode;
      }[];
    }[] = [
      {
        group: "收入",
        groupClass: "text-emerald-800",
        rows: [
          {
            kind: "expected",
            label: "預計",
            render: (idx) => (
              <MoneyCell
                value={valueCells[idx].amount}
                tone="income"
                formatMoney={formatMoney}
              />
            ),
          },
          {
            kind: "actual",
            label: "實際",
            render: (idx) => (
              <MoneyCell
                value={valueCells[idx].counterpart}
                tone="income"
                formatMoney={formatMoney}
              />
            ),
          },
          {
            kind: "ratio",
            label: "收款比率",
            render: (idx) => (
              <PercentCell
                value={ratioPct(valueCells[idx].amount, valueCells[idx].counterpart)}
                tone="ratio"
                canView={canViewFinancialValues}
                mask={financialMask}
              />
            ),
          },
        ],
      },
      {
        group: "支出",
        groupClass: "text-rose-700",
        rows: [
          {
            kind: "expected",
            label: "預計",
            render: (idx) => (
              <MoneyCell
                value={idx < expenseCells.length ? expenseCells[idx].amount : expenseTotal.amount}
                tone="expense"
                formatMoney={formatMoney}
              />
            ),
          },
          {
            kind: "actual",
            label: "實際",
            render: (idx) => (
              <MoneyCell
                value={
                  idx < expenseCells.length
                    ? expenseCells[idx].counterpart
                    : expenseTotal.counterpart
                }
                tone="expense"
                formatMoney={formatMoney}
              />
            ),
          },
          {
            kind: "ratio",
            label: "付款比率",
            render: (idx) => {
              const cell = idx < expenseCells.length ? expenseCells[idx] : expenseTotal;
              return (
                <PercentCell
                  value={ratioPct(cell.amount, cell.counterpart)}
                  tone="ratio"
                  canView={canViewFinancialValues}
                  mask={financialMask}
                />
              );
            },
          },
        ],
      },
      {
        group: "毛利",
        groupClass: "text-bw-navy",
        rows: [
          {
            kind: "expected",
            label: "預計",
            render: (idx) => {
              const income = idx < incomeCells.length ? incomeCells[idx] : incomeTotal;
              const expense = idx < expenseCells.length ? expenseCells[idx] : expenseTotal;
              return (
                <MoneyCell
                  value={income.amount - expense.amount}
                  tone="profit"
                  formatMoney={formatMoney}
                />
              );
            },
          },
          {
            kind: "actual",
            label: "實際",
            render: (idx) => {
              const income = idx < incomeCells.length ? incomeCells[idx] : incomeTotal;
              const expense = idx < expenseCells.length ? expenseCells[idx] : expenseTotal;
              return (
                <MoneyCell
                  value={income.counterpart - expense.counterpart}
                  tone="profit"
                  formatMoney={formatMoney}
                />
              );
            },
          },
          {
            kind: "ratio",
            label: "差距",
            render: (idx) => {
              const income = idx < incomeCells.length ? incomeCells[idx] : incomeTotal;
              const expense = idx < expenseCells.length ? expenseCells[idx] : expenseTotal;
              const expected = income.amount - expense.amount;
              const actual = income.counterpart - expense.counterpart;
              return (
                <PercentCell
                  value={changePct(expected, actual)}
                  tone="change"
                  canView={canViewFinancialValues}
                  mask={financialMask}
                />
              );
            },
          },
          {
            kind: "inspect",
            label: "檢視",
            render: (idx) => {
              const columnKey = idx < columnsForRow.length ? columnsForRow[idx].key : "total";
              const columnLabel =
                idx < columnsForRow.length ? columnsForRow[idx].label : "合計";
              const count = groupExpectedPaymentsByProject(
                datedLines,
                projects,
                source,
                columnKey,
                columnsForRow,
                mode,
                todayYmd
              ).length;
              return (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    disabled={count === 0}
                    onClick={() =>
                      setInspect({ source, columnKey, columnLabel })
                    }
                  >
                    <Eye className="w-3.5 h-3.5" />
                    檢視{count > 0 ? ` ${count}` : ""}
                  </Button>
                </div>
              );
            },
          },
        ],
      },
    ];

    const colKeys = [...columnsForRow.map((col) => col.key), "total"];

    const visibleBlocks = blocks
      .map((block) => ({
        ...block,
        rows: block.rows.filter(
          (row) => row.kind === "inspect" || visibleDetails[row.kind as DetailKind]
        ),
      }))
      .filter((block) => block.rows.length > 0);

    return visibleBlocks.map((block, blockIdx) =>
      block.rows.map((row, rowIdx) => {
        const isLast =
          blockIdx === visibleBlocks.length - 1 && rowIdx === block.rows.length - 1;
        return (
          <TableRow
            key={`${source}-${block.group}-${row.label}`}
            className={`hover:bg-gray-50/60 ${isLast ? "border-b-2" : ""}`}
          >
            {rowIdx === 0 && (
              <TableCell
                rowSpan={block.rows.length}
                className={`sticky left-0 bg-white z-10 align-middle text-sm font-semibold whitespace-nowrap ${block.groupClass}`}
              >
                {block.group}
              </TableCell>
            )}
            <TableCell className="sticky left-[64px] bg-white z-10 text-xs text-gray-500 whitespace-nowrap">
              {row.label}
            </TableCell>
            {colKeys.map((key, idx) => (
              <TableCell
                key={key}
                className={`min-w-[108px] ${key === "total" ? "bg-gray-50/50" : ""}`}
              >
                {row.render(idx)}
              </TableCell>
            ))}
          </TableRow>
        );
      })
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold text-bw-navy"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            預計收付款
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Expected Receipts & Payments — {DATE_BASIS_HINT[dateBasis]}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          重新整理
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] text-gray-400 font-medium">日期基準</span>
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white flex-wrap">
            {DATE_BASIS_OPTIONS.map((opt, idx) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDateBasis(opt.value)}
                className={`px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  idx > 0 ? "border-l border-gray-200" : ""
                } ${
                  dateBasis === opt.value
                    ? "bg-bw-blue text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] text-gray-400 font-medium">分欄方式</span>
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            {MODE_OPTIONS.map((opt, idx) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMode(opt.value)}
                className={`px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  idx > 0 ? "border-l border-gray-200" : ""
                } ${
                  mode === opt.value
                    ? "bg-bw-blue text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1.5 shadow-sm">
          <span className="text-xs text-gray-400 px-1.5 whitespace-nowrap">顯示</span>
          {DETAIL_OPTIONS.map((opt) => {
            const active = visibleDetails[opt.value];
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleDetail(opt.value)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${
                  active
                    ? "bg-bw-blue/10 text-bw-blue"
                    : "text-gray-400 hover:bg-gray-50 line-through decoration-gray-300"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80">
              <TableHead className="text-xs font-semibold text-gray-600 whitespace-nowrap w-[64px] min-w-[64px] sticky left-0 bg-gray-50/80 z-10">
                項目
              </TableHead>
              <TableHead className="text-xs font-semibold text-gray-600 whitespace-nowrap w-[88px] min-w-[88px] sticky left-[64px] bg-gray-50/80 z-10">
                明細
              </TableHead>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className="text-xs font-semibold text-gray-600 whitespace-nowrap text-right min-w-[108px]"
                >
                  {col.label}
                </TableHead>
              ))}
              <TableHead className="text-xs font-semibold text-gray-700 whitespace-nowrap text-right min-w-[120px] bg-gray-100/60">
                合計
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SOURCES.map((source) => (
              <React.Fragment key={source}>
                <TableRow className="bg-gray-50/90">
                  <TableCell
                    colSpan={columns.length + 3}
                    className={`sticky left-0 z-10 py-2 text-sm font-semibold ${
                      source === "BWA" ? "text-bw-navy" : "text-teal-700"
                    }`}
                  >
                    {source}
                  </TableCell>
                </TableRow>
                {renderMetricBlock(source, columns)}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      <ExpectedPaymentsInspectDialog
        open={inspect != null}
        onOpenChange={(open) => {
          if (!open) setInspect(null);
        }}
        source={inspect?.source ?? null}
        columnLabel={inspect?.columnLabel ?? ""}
        rows={
          inspect
            ? groupExpectedPaymentsByProject(
                datedLines,
                projects,
                inspect.source,
                inspect.columnKey,
                columns,
                mode,
                todayYmd
              )
            : []
        }
        onFinanceChanged={() => void load()}
      />
    </div>
  );
}
