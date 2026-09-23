// ─── PROJECT STATUS COUNTING RULES ────────────────────────────
// Mirrors the "更改項目狀態 / Change Project Status" matrix from PMS:
// each project status decides whether the project participates in
//   • 計錢   (countMoney)  — included in estimated / actual $ sums
//   • 計隻數 (countNumber) — included in project counts
//
// These rules apply only when the report's project status filter is "all"
// (unset). When the user selects a specific status, the matrix is bypassed
// so that status can be inspected with raw money + counts.
//
//   Status                Money (計錢)   Count (計隻數)
//   Work In Progress      ✓              ✓
//   Project Done          ✓              ✓
//   Case Closed           ✗              ✗
//   Dispute Done          ✓              ✓
//   Discontinued Project  ✓              ✗
//   Internal Project      ✗              ✓

export interface StatusRule {
  countMoney: boolean;
  countNumber: boolean;
}

/** Canonical English values stored on bwa_projects.status / bwf_projects.status. */
export const PROJECT_STATUS_OPTIONS = [
  {
    value: "Work In Progress",
    label: "Work In Progress",
    labelZh: "進行中",
    countMoney: true,
    countProject: true,
  },
  {
    value: "Project Done",
    label: "Project Done",
    labelZh: "項目完成",
    countMoney: true,
    countProject: true,
    description: "計錢, 計隻數",
  },
  {
    value: "Case Closed",
    label: "Case Closed",
    labelZh: "已結案",
    countMoney: false,
    countProject: false,
    description: "不計錢, 不計隻數",
  },
  {
    value: "Dispute Done",
    label: "Dispute Done",
    labelZh: "爭議完結",
    countMoney: true,
    countProject: true,
    description: "計錢, 計隻數 (收不齊數的工程)",
  },
  {
    value: "Discontinued Project",
    label: "Discontinued Project",
    labelZh: "爛尾工程",
    countMoney: true,
    countProject: false,
    description: "計錢, 不計隻數 (有資金流動但沒有開始進行工程)",
  },
  {
    value: "Internal Project",
    label: "Internal Project",
    labelZh: "內部工程",
    countMoney: false,
    countProject: true,
    description: "不計錢, 計隻數",
  },
] as const;

export type ProjectStatusValue = (typeof PROJECT_STATUS_OPTIONS)[number]["value"];

export function projectStatusFilterLabel(status: string): string {
  const opt = PROJECT_STATUS_OPTIONS.find((o) => o.value === status);
  return opt ? `${opt.labelZh} ${opt.label}` : status;
}

/** Solid-dot colors next to a project name (canonical BWA/BWF status). */
const PROJECT_STATUS_DOT_CLASS: Record<string, string> = {
  "work in progress": "bg-yellow-400",
  "project done": "bg-emerald-500",
  "case closed": "bg-gray-400",
  "dispute done": "bg-blue-500",
  "discontinued project": "bg-red-500",
  "internal project": "bg-purple-500",
};

/** Soft badge colors — same status → hue as the dots. */
const PROJECT_STATUS_BADGE_CLASS: Record<string, string> = {
  "work in progress": "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
  "project done": "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  "case closed": "bg-gray-200 text-gray-600 hover:bg-gray-200",
  "dispute done": "bg-blue-100 text-blue-700 hover:bg-blue-100",
  "discontinued project": "bg-red-100 text-red-700 hover:bg-red-100",
  "internal project": "bg-purple-100 text-purple-700 hover:bg-purple-100",
};

function canonicalStatusKey(status: string | null | undefined): string | null {
  if (!status?.trim()) return null;
  return status.trim().toLowerCase();
}

export function projectStatusDotClass(status: string | null | undefined): string {
  const key = canonicalStatusKey(status);
  if (!key) return "bg-gray-300";
  return PROJECT_STATUS_DOT_CLASS[key] ?? "bg-gray-300";
}

export function projectStatusBadgeClass(status: string | null | undefined): string | null {
  const key = canonicalStatusKey(status);
  if (!key) return null;
  return PROJECT_STATUS_BADGE_CLASS[key] ?? null;
}

export function projectStatusShortLabel(status: string | null | undefined): string | null {
  const key = canonicalStatusKey(status);
  if (!key) return null;
  return PROJECT_STATUS_OPTIONS.find((o) => o.value.toLowerCase() === key)?.labelZh ?? null;
}

export function projectStatusDisplayLabel(status: string | null | undefined): string {
  if (!status?.trim()) return "未知狀態";
  return projectStatusShortLabel(status) ?? status.trim();
}

// Keyed by the canonical English status stored on the project.
const STATUS_RULES: Record<string, StatusRule> = Object.fromEntries(
  PROJECT_STATUS_OPTIONS.map((o) => [
    o.value.toLowerCase(),
    { countMoney: o.countMoney, countNumber: o.countProject },
  ]),
);

// Unknown / null statuses default to fully counted so new statuses don't
// silently vanish from reports — better to over-count and notice than to
// drop data invisibly.
const DEFAULT_RULE: StatusRule = { countMoney: true, countNumber: true };

const BYPASS_RULE: StatusRule = { countMoney: true, countNumber: true };

export function getStatusRule(status: string | null | undefined): StatusRule {
  if (!status) return DEFAULT_RULE;
  return STATUS_RULES[status.trim().toLowerCase()] ?? DEFAULT_RULE;
}

/**
 * Status counting rules for report aggregation.
 * When `statusFilter` is a specific status (not "all"), return full inclusion
 * so the user can inspect that bucket's raw money and counts.
 */
export function getEffectiveStatusRule(
  status: string | null | undefined,
  statusFilter: string,
): StatusRule {
  if (statusFilter !== "all") return BYPASS_RULE;
  return getStatusRule(status);
}

// Convenience predicates (always apply the matrix — prefer getEffectiveStatusRule
// in report aggregators that have a status filter).
export function countsForMoney(status: string | null | undefined): boolean {
  return getStatusRule(status).countMoney;
}

export function countsForNumber(status: string | null | undefined): boolean {
  return getStatusRule(status).countNumber;
}
