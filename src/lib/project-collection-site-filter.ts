import { todayHkYmd, toHkYmd } from "@/lib/date-utils";

/** 收款狀態 — amount-based, never incomes.payment_status. */
export type CollectionStatusFilter = "all" | "fully_paid" | "incomplete";

/** 工地狀態 — derived from project start_date / handover_date. */
export type SiteStatusFilter =
  | "all"
  | "started"
  | "started_30"
  | "started_60"
  | "started_90"
  | "in_progress"
  | "handed_over";

export const COLLECTION_STATUS_OPTIONS: {
  value: CollectionStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "全部" },
  { value: "fully_paid", label: "全部收款" },
  { value: "incomplete", label: "未完成收款" },
];

export const SITE_STATUS_OPTIONS: { value: SiteStatusFilter; label: string }[] =
  [
    { value: "all", label: "全部" },
    { value: "started", label: "已開工" },
    { value: "started_30", label: "已開工 30天" },
    { value: "started_60", label: "已開工 60天" },
    { value: "started_90", label: "已開工 90天" },
    { value: "in_progress", label: "正在進行中" },
    { value: "handed_over", label: "已經交場" },
  ];

const AMOUNT_EPS = 0.01;

export type ProjectCollectionSiteFields = {
  /** Converted / linked project UUID when the row id is a pitching or BV row. */
  filter_project_id?: string | null;
  start_date?: string | null;
  handover_date?: string | null;
  income_amount_sum?: number | null;
  payment_amount_sum?: number | null;
};

export type ProjectFilterExtra = {
  start_date: string | null;
  handover_date: string | null;
  income_amount_sum: number;
  payment_amount_sum: number;
};

function asAmount(n: number | null | undefined): number {
  return Number(n) || 0;
}

/** Fully collected when payment covers billed income (overpay still counts). */
export function isFullyCollected(
  incomeAmountSum: number,
  paymentAmountSum: number,
): boolean {
  return asAmount(paymentAmountSum) + AMOUNT_EPS >= asAmount(incomeAmountSum);
}

export function daysSinceHkYmd(
  startYmd: string,
  todayYmd: string = todayHkYmd(),
): number {
  const start = Date.parse(`${startYmd}T00:00:00Z`);
  const today = Date.parse(`${todayYmd}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(today)) return 0;
  return Math.floor((today - start) / 86_400_000);
}

export function matchesCollectionStatus(
  incomeAmountSum: number | null | undefined,
  paymentAmountSum: number | null | undefined,
  filter: CollectionStatusFilter,
): boolean {
  if (filter === "all") return true;
  if (incomeAmountSum == null || paymentAmountSum == null) return true;
  const fully = isFullyCollected(incomeAmountSum, paymentAmountSum);
  return filter === "fully_paid" ? fully : !fully;
}

export function matchesSiteStatus(
  startDate: string | null | undefined,
  handoverDate: string | null | undefined,
  filter: SiteStatusFilter,
  todayYmd: string = todayHkYmd(),
): boolean {
  if (filter === "all") return true;
  const startYmd = toHkYmd(startDate);
  const handoverYmd = toHkYmd(handoverDate);
  const started = !!startYmd && startYmd <= todayYmd;
  const handedOver = !!handoverYmd && handoverYmd <= todayYmd;
  const days = startYmd ? daysSinceHkYmd(startYmd, todayYmd) : 0;

  switch (filter) {
    case "started":
      return started;
    case "started_30":
      return started && days >= 30;
    case "started_60":
      return started && days >= 60;
    case "started_90":
      return started && days >= 90;
    case "in_progress":
      return started && !handedOver;
    case "handed_over":
      return handedOver;
    default:
      return true;
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isProjectFilterUuid(value: string | null | undefined): boolean {
  return !!value && UUID_RE.test(value);
}

export function resolveProjectFilterId(row: {
  id: string;
  filter_project_id?: string | null;
}): string | null {
  const raw = row.filter_project_id || row.id;
  return isProjectFilterUuid(raw) ? raw : null;
}

export function mergeProjectFilterExtra<T extends ProjectCollectionSiteFields>(
  row: T,
  extra: ProjectFilterExtra | undefined,
): T {
  if (!extra) return row;
  return {
    ...row,
    start_date: row.start_date ?? extra.start_date,
    handover_date: row.handover_date ?? extra.handover_date,
    income_amount_sum: row.income_amount_sum ?? extra.income_amount_sum,
    payment_amount_sum: row.payment_amount_sum ?? extra.payment_amount_sum,
  };
}
