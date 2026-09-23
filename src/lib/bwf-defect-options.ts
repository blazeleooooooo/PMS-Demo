/** Defect status / source option lists for 完工及執漏 (display Chinese, store English). */

export interface BilingualOption {
  value: string;
  labelZh: string;
  labelEn: string;
}

export const DEFECT_STATUS_OPTIONS: BilingualOption[] = [
  { value: "Reported", labelZh: "已報告", labelEn: "Reported" },
  { value: "Acknowledged", labelZh: "已確認", labelEn: "Acknowledged" },
  { value: "Fix Scheduled", labelZh: "已安排維修", labelEn: "Fix Scheduled" },
  { value: "Resolved", labelZh: "已解決", labelEn: "Resolved" },
  { value: "Client Sign-off", labelZh: "客戶簽收", labelEn: "Client Sign-off" },
];

export const DEFECT_SOURCE_OPTIONS: BilingualOption[] = [
  { value: "Acme", labelZh: "Acme", labelEn: "Acme" },
  { value: "Project Manager", labelZh: "項目經理", labelEn: "Project Manager" },
  { value: "Designer", labelZh: "設計師", labelEn: "Designer" },
  { value: "Client", labelZh: "客戶", labelEn: "Client" },
  { value: "Factory", labelZh: "工廠", labelEn: "Factory" },
  { value: "Logistic", labelZh: "物流", labelEn: "Logistic" },
  { value: "Installation Team", labelZh: "安裝團隊", labelEn: "Installation Team" },
  { value: "Other Supplier", labelZh: "其他供應商", labelEn: "Other Supplier" },
  { value: "Others", labelZh: "其他", labelEn: "Others" },
];

export const PROJECT_DEFECT_SMOOTH = "Smooth Completion";
export const PROJECT_DEFECT_FIXING = "Defect Fixing";
export const PROJECT_DEFECT_DONE = "Defect Done";

const PROJECT_DEFECT_LABELS: Record<string, string> = {
  [PROJECT_DEFECT_SMOOTH]: "順利完工",
  [PROJECT_DEFECT_FIXING]: "執漏中",
  [PROJECT_DEFECT_DONE]: "執漏完成",
};

export type ProjectCompletionFilter = "hide_completed" | "show_completed" | "show_all";

export const PROJECT_COMPLETION_FILTER_OPTIONS: { value: ProjectCompletionFilter; label: string }[] = [
  { value: "hide_completed", label: "隱藏已完成" },
  { value: "show_completed", label: "顯示已完成" },
  { value: "show_all", label: "顯示全部" },
];

export const NO_DEFECT_NEEDED = "無需執漏";

export function getDefectStatusLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const opt = DEFECT_STATUS_OPTIONS.find((o) => o.value === value);
  return opt ? opt.labelZh : value;
}

export function getDefectSourceLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const opt = DEFECT_SOURCE_OPTIONS.find((o) => o.value === value);
  return opt ? opt.labelZh : value;
}

export function getProjectDefectLabel(value: string | null | undefined): string {
  if (!value) return "未設定";
  return PROJECT_DEFECT_LABELS[value] ?? value;
}

/** Order-row 執漏狀態: prefer order field, else project completion status. */
export function getCompletionDefectStatusDisplay(
  orderStatus: string | null | undefined,
  projectDefect: string | null | undefined,
): string {
  if (orderStatus) return getDefectStatusLabel(orderStatus);
  if (projectDefect === PROJECT_DEFECT_SMOOTH) return NO_DEFECT_NEEDED;
  if (projectDefect) return getProjectDefectLabel(projectDefect);
  return "—";
}

/** Order-row 事件責任: prefer order field, else 無需執漏 for smooth completion. */
export function getCompletionDefectSourceDisplay(
  source: string | null | undefined,
  projectDefect: string | null | undefined,
): string {
  if (source) return getDefectSourceLabel(source);
  if (projectDefect === PROJECT_DEFECT_SMOOTH) return NO_DEFECT_NEEDED;
  return "—";
}

/** Order-row 執漏成因: prefer resolved cause label, else 無需執漏 for smooth completion. */
export function getCompletionDefectCauseDisplay(
  causeLabel: string | null | undefined,
  projectDefect: string | null | undefined,
): string {
  if (causeLabel) return causeLabel;
  if (projectDefect === PROJECT_DEFECT_SMOOTH) return NO_DEFECT_NEEDED;
  return "—";
}

export function matchesProjectCompletionFilter(
  osProjectDefect: string | null | undefined,
  filter: ProjectCompletionFilter,
): boolean {
  if (filter === "show_all") return true;
  const completed =
    osProjectDefect === PROJECT_DEFECT_SMOOTH || osProjectDefect === PROJECT_DEFECT_DONE;
  if (filter === "show_completed") return completed;
  return !completed;
}
