import type { ExpenseControlItem } from "@/lib/expense-control-service";

/** UI labels and permission module for each expense-control checklist fix action. */
export const EXPENSE_CONTROL_FIX_ACTIONS: Record<
  string,
  { label: string; labelEn: string; permissionModule: string }
> = {
  dates: {
    label: "填寫日期",
    labelEn: "Set dates",
    permissionModule: "projects",
  },
  "installment-vs-income": {
    label: "前往支出/收入",
    labelEn: "Open expense/income",
    permissionModule: "projects.expense",
  },
  "overdue-income-expected-date": {
    label: "前往收入",
    labelEn: "Open income",
    permissionModule: "projects.income",
  },
  schedule: {
    label: "前往時間表",
    labelEn: "Open schedule",
    permissionModule: "projects.work-schedule",
  },
  "customer-br": {
    label: "前往客戶 BR",
    labelEn: "Open customer BR",
    permissionModule: "clients",
  },
  "customer-form-s1": {
    label: "前往客戶 Form S1",
    labelEn: "Open customer Form S1",
    permissionModule: "clients",
  },
  "customer-testimonial": {
    label: "前往客戶推薦信",
    labelEn: "Open customer testimonial",
    permissionModule: "clients",
  },
  insurance: {
    label: "上載工地保險",
    labelEn: "Upload Insurance",
    permissionModule: "projects.docs",
  },
  "main-contractor": {
    label: "設定承辦商",
    labelEn: "Set contractor",
    permissionModule: "projects.expense",
  },
  "site-status": {
    label: "填寫工地狀況",
    labelEn: "Complete site status",
    permissionModule: "projects.site-status",
  },
  "ten-day-reports": {
    label: "前往每10天報告",
    labelEn: "Open 10 Day's Report",
    permissionModule: "projects.weekly-report",
  },
  "internal-comment": {
    label: "填寫內部評論",
    labelEn: "Add internal review",
    permissionModule: "projects.internal-review",
  },
  "supplier-comment": {
    label: "填寫供應商評論",
    labelEn: "Add supplier comment",
    permissionModule: "projects.supplier-comment",
  },
  plan: {
    label: "上載平面圖",
    labelEn: "Upload 8 Plan",
    permissionModule: "projects.docs",
  },
  "detailed-drawing": {
    label: "上載施工圖紙",
    labelEn: "Upload Detailed Drawing",
    permissionModule: "projects.docs",
  },
  rendering: {
    label: "前往 3D Render",
    labelEn: "Open 3D Render",
    permissionModule: "projects.3d",
  },
  "project-ppt": {
    label: "上載項目ppt",
    labelEn: "Upload Project PPT",
    permissionModule: "projects.docs",
  },
  "completion-photos": {
    label: "上載完工相片",
    labelEn: "Upload completion photos",
    permissionModule: "projects.docs",
  },
  "form-s3": {
    label: "上載 Form S3",
    labelEn: "Upload Form S3",
    permissionModule: "projects.docs",
  },
};

/** Checklist keys that open the project Docs tab to upload a missing document. */
export const EXPENSE_CONTROL_DOC_UPLOAD_KEYS = new Set([
  "insurance",
  "plan",
  "detailed-drawing",
  "project-ppt",
  "completion-photos",
  "form-s3",
]);

/** Checklist keys that navigate to customer documents (not project Docs). */
export const EXPENSE_CONTROL_CUSTOMER_DOC_KEYS = new Set([
  "customer-br",
  "customer-form-s1",
  "customer-testimonial",
]);

/** Maps expense-control checklist key → customer_document_types.type_key. */
export const EXPENSE_CONTROL_CUSTOMER_DOC_TYPE_KEYS: Record<string, string> = {
  "customer-br": "br",
  "customer-form-s1": "form_s1",
  "customer-testimonial": "testimonial",
};

export interface ExpenseControlTabAvailability {
  workSchedule: boolean;
  siteStatus: boolean;
}

export function getExpenseControlFixDisabledReason(
  key: string,
  availability: ExpenseControlTabAvailability,
): string | undefined {
  if (key === "schedule" && !availability.workSchedule) {
    return "此項目未分配時間表組別，請聯絡管理員";
  }
  if (key === "site-status" && !availability.siteStatus) {
    return "此項目不適用工地狀況（需項目規模 ≥ $250-500K中小型，且服務類型與項目類型均標記「需填工地狀況」）";
  }
  return undefined;
}

export type ExpenseControlFixHandler = (key: string, item: ExpenseControlItem) => void;
