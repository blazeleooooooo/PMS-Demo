import { supabase } from "@/lib/data/_core";

// ============================================================
// Expense amount rules — thresholds that gate quotation uploads
// and supplier document eligibility in the expense dialog.
// ============================================================

export const SUPPLIER_FILE_TYPE_BR = "37b3e05b-dd02-4a8b-b143-712eb8a02eb5";
export const SUPPLIER_FILE_TYPE_INSURANCE = "ff6045cc-a51c-46ef-bde0-b37e6c02ad65";

export const EXPENSE_QUOTATION_THRESHOLD = 3_000;
export const EXPENSE_BR_THRESHOLD = 30_000;
export const EXPENSE_INSURANCE_THRESHOLD = 250_000;

/** 可退還 / Refundable — group quotation, BR, and Insurance rules do not apply. */
export const EXPENSE_RULES_EXEMPT_CONTRACT_TYPE_ID = "7c663cb6-aaf4-4378-9e69-211f16f545ac";

export function isExpenseRulesExemptContractType(
  contractTypeId: string | null | undefined
): boolean {
  return contractTypeId === EXPENSE_RULES_EXEMPT_CONTRACT_TYPE_ID;
}

export type ExpenseAmountRuleKey = "quotation" | "br" | "insurance";

export interface ExpenseAmountRuleDefinition {
  key: ExpenseAmountRuleKey;
  label: string;
  threshold: number;
  /** `gte` = amount >= threshold; `gt` = amount > threshold */
  compare: "gte" | "gt";
}

export const EXPENSE_AMOUNT_RULE_DEFINITIONS: ExpenseAmountRuleDefinition[] = [
  {
    key: "quotation",
    label: "群組須上傳供應商報價單（全組只需一份）",
    threshold: EXPENSE_QUOTATION_THRESHOLD,
    compare: "gte",
  },
  {
    key: "br",
    label: "供應商須持有有效商業登記 (BR) 文件",
    threshold: EXPENSE_BR_THRESHOLD,
    compare: "gt",
  },
  {
    key: "insurance",
    label: "供應商須持有有效保險 (Insurance) 文件",
    threshold: EXPENSE_INSURANCE_THRESHOLD,
    compare: "gt",
  },
];

export interface ExpenseAmountRulesState {
  quotationRequired: boolean;
  brRequired: boolean;
  insuranceRequired: boolean;
}

export interface ExpenseAmountRuleStatus extends ExpenseAmountRuleDefinition {
  active: boolean;
}

export interface ExpenseCriteriaExpense {
  id?: string;
  supplier_id: string | null;
  n_contract_type_id: string | null;
  amount: number | null;
}

export interface SupplierDocumentEligibility {
  withValidBr: Set<string>;
  withValidInsurance: Set<string>;
  /** Supplier has at least one BR file on record (any expiry). Used for error copy only. */
  withAnyBr: Set<string>;
  /** Supplier has at least one Insurance file on record (any expiry). Used for error copy only. */
  withAnyInsurance: Set<string>;
}

export function emptySupplierDocumentEligibility(): SupplierDocumentEligibility {
  return {
    withValidBr: new Set(),
    withValidInsurance: new Set(),
    withAnyBr: new Set(),
    withAnyInsurance: new Set(),
  };
}

function hkTodayDateString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
}

function expiryToYmd(expiryDate: string | Date): string | null {
  if (expiryDate instanceof Date) {
    if (Number.isNaN(expiryDate.getTime())) return null;
    return expiryDate.toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
  }
  const raw = String(expiryDate).trim();
  if (!raw) return null;
  const ymd = (raw.includes("T") ? raw.split("T")[0] : raw.split(/\s+/)[0]).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

export function isSupplierFileNotExpired(
  expiryDate: string | Date | null | undefined
): boolean {
  if (expiryDate == null || expiryDate === "") return false;
  const expiry = expiryToYmd(expiryDate);
  return !!expiry && expiry >= hkTodayDateString();
}

function amountMeetsThreshold(amount: number, threshold: number, compare: "gte" | "gt"): boolean {
  return compare === "gte" ? amount >= threshold : amount > threshold;
}

export function evaluateExpenseAmountRules(amount: number): ExpenseAmountRulesState {
  return {
    quotationRequired: amountMeetsThreshold(amount, EXPENSE_QUOTATION_THRESHOLD, "gte"),
    brRequired: amountMeetsThreshold(amount, EXPENSE_BR_THRESHOLD, "gt"),
    insuranceRequired: amountMeetsThreshold(amount, EXPENSE_INSURANCE_THRESHOLD, "gt"),
  };
}

export function getExpenseAmountRuleStatuses(amount: number): ExpenseAmountRuleStatus[] {
  const rules = evaluateExpenseAmountRules(amount);
  return EXPENSE_AMOUNT_RULE_DEFINITIONS.map((definition) => ({
    ...definition,
    active:
      definition.key === "quotation"
        ? rules.quotationRequired
        : definition.key === "br"
          ? rules.brRequired
          : rules.insuranceRequired,
  }));
}

export function countActiveExpenseAmountRules(amount: number): number {
  return getExpenseAmountRuleStatuses(amount).filter((rule) => rule.active).length;
}

export interface ExpenseGroupRulesEvaluation {
  groupAmount: number | null;
  otherGroupAmount: number;
  currentAmount: number;
  rules: ExpenseAmountRulesState;
  ruleStatuses: ExpenseAmountRuleStatus[];
  /** False when the cost centre has expense_control_enabled = false or the contract type is exempt. */
  expenseControlApplicable: boolean;
  skipReason: "cost_centre" | "contract_type" | null;
  canEvaluate: boolean;
}

const INACTIVE_RULES: ExpenseAmountRulesState = {
  quotationRequired: false,
  brRequired: false,
  insuranceRequired: false,
};

function inactiveRuleStatuses(): ExpenseAmountRuleStatus[] {
  return EXPENSE_AMOUNT_RULE_DEFINITIONS.map((definition) => ({
    ...definition,
    active: false,
  }));
}

function inactiveGroupRulesEvaluation(
  currentAmount: number,
  skipReason: "cost_centre" | "contract_type"
): ExpenseGroupRulesEvaluation {
  return {
    groupAmount: null,
    otherGroupAmount: 0,
    currentAmount,
    rules: INACTIVE_RULES,
    ruleStatuses: inactiveRuleStatuses(),
    expenseControlApplicable: false,
    skipReason,
    canEvaluate: false,
  };
}

/** Group total for same project + supplier + contract type, including the current input. */
export function computeExpenseCriteriaAmount(
  installmentAmount: number | null,
  supplierId: string | null,
  contractTypeId: string | null,
  otherExpenses: ExpenseCriteriaExpense[],
  excludeExpenseId?: string
): number {
  const current = installmentAmount || 0;
  if (!supplierId || !contractTypeId) return current;

  const otherAmountSum = otherExpenses
    .filter(
      (expense) =>
        expense.supplier_id === supplierId &&
        expense.n_contract_type_id === contractTypeId &&
        expense.id !== excludeExpenseId
    )
    .reduce((sum, expense) => sum + (expense.amount || 0), 0);

  return current + otherAmountSum;
}

export function evaluateExpenseGroupRules(
  installmentAmount: number | null,
  supplierId: string | null,
  contractTypeId: string | null,
  otherExpenses: ExpenseCriteriaExpense[],
  excludeExpenseId?: string,
  expenseControlEnabled = true
): ExpenseGroupRulesEvaluation {
  const currentAmount = installmentAmount || 0;

  if (!expenseControlEnabled) {
    return inactiveGroupRulesEvaluation(currentAmount, "cost_centre");
  }

  if (isExpenseRulesExemptContractType(contractTypeId)) {
    return inactiveGroupRulesEvaluation(currentAmount, "contract_type");
  }

  if (!supplierId || !contractTypeId) {
    return {
      groupAmount: null,
      otherGroupAmount: 0,
      currentAmount,
      rules: INACTIVE_RULES,
      ruleStatuses: inactiveRuleStatuses(),
      expenseControlApplicable: true,
      skipReason: null,
      canEvaluate: false,
    };
  }

  const otherGroupAmount = otherExpenses
    .filter(
      (expense) =>
        expense.supplier_id === supplierId &&
        expense.n_contract_type_id === contractTypeId &&
        expense.id !== excludeExpenseId
    )
    .reduce((sum, expense) => sum + (expense.amount || 0), 0);
  const groupAmount = otherGroupAmount + currentAmount;
  const rules = evaluateExpenseAmountRules(groupAmount);

  return {
    groupAmount,
    otherGroupAmount,
    currentAmount,
    rules,
    ruleStatuses: getExpenseAmountRuleStatuses(groupAmount),
    expenseControlApplicable: true,
    skipReason: null,
    canEvaluate: true,
  };
}

export type ExpenseQuotationSource = {
  id?: string;
  supplier_id: string | null;
  n_contract_type_id: string | null;
  supplier_quotation_file: string | null;
};

/** Normalize comma-separated storage URLs (pdf_file / supplier_quotation_file). */
export function parseExpenseFileUrls(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((url) => {
      let normalized = url.trim();
      if (normalized.startsWith("//")) normalized = `https:${normalized}`;
      return normalized;
    })
    .filter(Boolean);
}

/**
 * Resolve the supplier quotation file for a criteria group (same supplier + contract type).
 * Prefers the current expense row, then any sibling in the group (全組只需一份).
 */
export function resolveGroupSupplierQuotationFile(
  supplierId: string | null,
  contractTypeId: string | null,
  expenses: ExpenseQuotationSource[],
  preferExpenseId?: string
): string | null {
  if (!supplierId || !contractTypeId) return null;

  const inGroup = expenses.filter(
    (expense) =>
      expense.supplier_id === supplierId && expense.n_contract_type_id === contractTypeId
  );

  if (preferExpenseId) {
    const preferred = inGroup.find(
      (expense) =>
        expense.id === preferExpenseId &&
        !!(expense.supplier_quotation_file && expense.supplier_quotation_file.trim())
    );
    if (preferred?.supplier_quotation_file?.trim()) {
      return preferred.supplier_quotation_file.trim();
    }
  }

  const sibling = inGroup.find(
    (expense) => !!(expense.supplier_quotation_file && expense.supplier_quotation_file.trim())
  );
  return sibling?.supplier_quotation_file?.trim() || null;
}

export function groupHasSupplierQuotation(
  supplierId: string | null,
  contractTypeId: string | null,
  otherExpenses: ExpenseQuotationSource[],
  currentQuotationFile: string | null | undefined,
  excludeExpenseId?: string
): boolean {
  const hasCurrent = !!(currentQuotationFile && currentQuotationFile.trim());
  if (hasCurrent) return true;
  if (!supplierId || !contractTypeId) return false;

  return otherExpenses.some(
    (expense) =>
      expense.supplier_id === supplierId &&
      expense.n_contract_type_id === contractTypeId &&
      expense.id !== excludeExpenseId &&
      !!(expense.supplier_quotation_file && expense.supplier_quotation_file.trim())
  );
}

export type ExpenseAmountRuleComplianceState = "inactive" | "loading" | "met" | "unmet";

export interface ExpenseAmountRuleCompliance extends ExpenseAmountRuleStatus {
  compliance: ExpenseAmountRuleComplianceState;
}

export function getExpenseAmountRuleCompliances(
  ruleStatuses: ExpenseAmountRuleStatus[],
  options: {
    hasQuotation: boolean;
    supplierId: string | null | undefined;
    eligibility: SupplierDocumentEligibility | null | undefined;
    eligibilityLoading?: boolean;
  }
): ExpenseAmountRuleCompliance[] {
  return ruleStatuses.map((rule) => {
    if (!rule.active) return { ...rule, compliance: "inactive" as const };
    if (rule.key === "quotation") {
      return { ...rule, compliance: options.hasQuotation ? "met" : "unmet" };
    }
    if (!options.supplierId) return { ...rule, compliance: "unmet" as const };
    if (!options.eligibility) {
      return {
        ...rule,
        compliance: options.eligibilityLoading ? "loading" : "unmet",
      };
    }
    const ok =
      rule.key === "br"
        ? options.eligibility.withValidBr.has(options.supplierId)
        : options.eligibility.withValidInsurance.has(options.supplierId);
    return { ...rule, compliance: ok ? "met" : "unmet" };
  });
}

export function supplierMeetsDocumentRules(
  supplierId: string | null | undefined,
  rules: ExpenseAmountRulesState,
  eligibility: SupplierDocumentEligibility | null | undefined
): boolean {
  if (!supplierId || (!rules.brRequired && !rules.insuranceRequired)) return true;
  if (!eligibility) return false;
  if (rules.insuranceRequired && !eligibility.withValidInsurance.has(supplierId)) return false;
  if (rules.brRequired && !eligibility.withValidBr.has(supplierId)) return false;
  return true;
}

export function isSupplierEligibleForExpenseAmount(
  supplierId: string,
  rules: ExpenseAmountRulesState,
  eligibility: SupplierDocumentEligibility | null | undefined
): boolean {
  if (!rules.brRequired && !rules.insuranceRequired) return true;
  return supplierMeetsDocumentRules(supplierId, rules, eligibility);
}

function documentIssueMessage(
  docLabel: string,
  threshold: number,
  hasAnyOnFile: boolean
): string {
  const prefix = `群組支出金額超過 $${threshold.toLocaleString("en-US")}，`;
  if (hasAnyOnFile) {
    return `${prefix}供應商的${docLabel}文件已過期或缺少有效到期日，請更新。`;
  }
  return `${prefix}供應商須上傳${docLabel}文件。`;
}

/** Returns user-facing messages for each document rule the supplier fails. */
export function getExpenseSupplierDocumentError(
  supplierId: string | null | undefined,
  rules: ExpenseAmountRulesState,
  eligibility: SupplierDocumentEligibility | null | undefined
): string | null {
  if (!supplierId || !eligibility) return null;

  const messages: string[] = [];

  if (rules.brRequired && !eligibility.withValidBr.has(supplierId)) {
    messages.push(
      documentIssueMessage(
        "商業登記 (BR)",
        EXPENSE_BR_THRESHOLD,
        eligibility.withAnyBr.has(supplierId)
      )
    );
  }

  if (rules.insuranceRequired && !eligibility.withValidInsurance.has(supplierId)) {
    messages.push(
      documentIssueMessage(
        "保險 (Insurance)",
        EXPENSE_INSURANCE_THRESHOLD,
        eligibility.withAnyInsurance.has(supplierId)
      )
    );
  }

  return messages.length > 0 ? messages.join("\n") : null;
}

export async function fetchSupplierDocumentEligibility(): Promise<SupplierDocumentEligibility> {
  const PAGE_SIZE = 1000;
  let from = 0;
  let hasMore = true;
  const withValidBr = new Set<string>();
  const withValidInsurance = new Set<string>();
  const withAnyBr = new Set<string>();
  const withAnyInsurance = new Set<string>();

  while (hasMore) {
    const { data, error } = await supabase
      .from("supplier_files")
      .select("supplier_id, type_id, expiry_date")
      .in("type_id", [SUPPLIER_FILE_TYPE_BR, SUPPLIER_FILE_TYPE_INSURANCE])
      .not("supplier_id", "is", null)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("[fetchSupplierDocumentEligibility]", error.message);
      break;
    }

    for (const row of data ?? []) {
      if (!row.supplier_id) continue;
      if (row.type_id === SUPPLIER_FILE_TYPE_BR) {
        withAnyBr.add(row.supplier_id);
        if (isSupplierFileNotExpired(row.expiry_date)) withValidBr.add(row.supplier_id);
      }
      if (row.type_id === SUPPLIER_FILE_TYPE_INSURANCE) {
        withAnyInsurance.add(row.supplier_id);
        if (isSupplierFileNotExpired(row.expiry_date)) withValidInsurance.add(row.supplier_id);
      }
    }

    hasMore = (data?.length ?? 0) === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  return { withValidBr, withValidInsurance, withAnyBr, withAnyInsurance };
}
