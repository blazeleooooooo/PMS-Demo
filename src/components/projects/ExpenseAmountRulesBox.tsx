"use client";

import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import {
  getExpenseAmountRuleCompliances,
  type ExpenseGroupRulesEvaluation,
  type SupplierDocumentEligibility,
} from "@/lib/expense-amount-rules";

interface ExpenseAmountRulesBoxProps {
  evaluation: ExpenseGroupRulesEvaluation;
  hasQuotation: boolean;
  supplierId: string | null;
  eligibility: SupplierDocumentEligibility | null;
  eligibilityLoading: boolean;
  formatMoney: (amount: number) => string;
  costCentreBuCode?: string | null;
  contractTypeLabel?: string | null;
}

export function ExpenseAmountRulesBox({
  evaluation,
  hasQuotation,
  supplierId,
  eligibility,
  eligibilityLoading,
  formatMoney,
  costCentreBuCode,
  contractTypeLabel,
}: ExpenseAmountRulesBoxProps) {
  const activeCount = evaluation.ruleStatuses.filter((rule) => rule.active).length;
  const compliances = getExpenseAmountRuleCompliances(evaluation.ruleStatuses, {
    hasQuotation,
    supplierId,
    eligibility,
    eligibilityLoading,
  });

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50/60 p-2.5">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-[12px] font-medium text-gray-600">群組支出金額規則 Group Expense Rules</p>
        {evaluation.expenseControlApplicable && (
          <span className="text-[12px] text-gray-500 shrink-0">{activeCount}/3 項已啟用</span>
        )}
      </div>
      {!evaluation.expenseControlApplicable ? (
        <p className="text-[11px] text-gray-500 mb-1.5">
          {evaluation.skipReason === "contract_type"
            ? `合約類型 ${contractTypeLabel || "可退還"} 不適用群組支出金額規則，無需依群組總額上傳報價單或檢查供應商 BR / Insurance。`
            : `成本中心 ${costCentreBuCode || "—"} 不適用群組支出金額規則，無需依群組總額上傳報價單或檢查供應商 BR / Insurance。`}
        </p>
      ) : evaluation.canEvaluate ? (
        <p className="text-[11px] text-gray-600 mb-1.5">
          群組總額 {formatMoney(evaluation.groupAmount ?? 0)}
          （現有 {formatMoney(evaluation.otherGroupAmount)} + 本期 {formatMoney(evaluation.currentAmount)}）
        </p>
      ) : (
        <p className="text-[11px] text-gray-500 mb-1.5">
          請先選擇合約類型及供應商，規則將依同項目、同合約類型、同供應商之群組總額計算
        </p>
      )}
      {evaluation.expenseControlApplicable && (
        <ul className="space-y-1">
          {compliances.map((rule) => {
            const label = (
              <span>
                {rule.compare === "gte" ? "≥" : ">"} {formatMoney(rule.threshold)}：{rule.label}
              </span>
            );
            if (rule.compliance === "met") {
              return (
                <li key={rule.key} className="flex items-start gap-1.5 text-[12px] text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
                  {label}
                </li>
              );
            }
            if (rule.compliance === "unmet") {
              return (
                <li key={rule.key} className="flex items-start gap-1.5 text-[12px] text-amber-700">
                  <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                  {label}
                </li>
              );
            }
            if (rule.compliance === "loading") {
              return (
                <li key={rule.key} className="flex items-start gap-1.5 text-[12px] text-gray-500">
                  <Loader2 className="w-3.5 h-3.5 shrink-0 mt-0.5 animate-spin" />
                  {label}
                </li>
              );
            }
            return (
              <li key={rule.key} className="flex items-start gap-1.5 text-[12px] text-gray-400">
                <span className="w-3.5 h-3.5 shrink-0 mt-0.5 rounded-full border border-gray-300" />
                {label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ExpenseSupplierDocFilterHint({
  brRequired,
  insuranceRequired,
  canEvaluate,
  expenseControlApplicable,
  supplierId,
  eligibility,
  eligibilityLoading,
}: {
  brRequired: boolean;
  insuranceRequired: boolean;
  canEvaluate: boolean;
  expenseControlApplicable: boolean;
  supplierId: string | null;
  eligibility: SupplierDocumentEligibility | null;
  eligibilityLoading: boolean;
}) {
  if (!expenseControlApplicable || !canEvaluate || (!brRequired && !insuranceRequired)) {
    return null;
  }

  const docsOk =
    !!supplierId &&
    !!eligibility &&
    (!brRequired || eligibility.withValidBr.has(supplierId)) &&
    (!insuranceRequired || eligibility.withValidInsurance.has(supplierId));

  return (
    <div className="mb-1 space-y-0.5">
      <p className="text-[11px] text-gray-500">
        {insuranceRequired
          ? "下拉只列出群組總額超過 $250,000 且持有有效 BR 及 Insurance 的供應商"
          : "下拉只列出群組總額超過 $30,000 且持有有效 BR 的供應商"}
      </p>
      {eligibilityLoading && !eligibility && (
        <p className="text-[11px] text-gray-500 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          正在核對供應商文件...
        </p>
      )}
      {supplierId && !eligibilityLoading && docsOk && (
        <p className="text-[11px] text-emerald-700">
          {insuranceRequired
            ? "此供應商已持有有效商業登記 (BR) 及保險文件"
            : "此供應商已持有有效商業登記 (BR)"}
        </p>
      )}
    </div>
  );
}
