import type { DateRange } from "react-day-picker";
import type { CasePdfProjectRow } from "@/lib/data-service";

const STORAGE_KEY = "pms.case-pdf.draft.v1";

export interface CasePdfFilterDraft {
  projectTypeIds: string[];
  periodFrom: string | null;
  periodTo: string | null;
  minDealAmount: string;
}

export const DEFAULT_CASE_PDF_TITLE = "工程個案參考";

export interface CasePdfDraft {
  filters: CasePdfFilterDraft;
  rows: CasePdfProjectRow[];
  hiddenIds: string[];
  hasApplied: boolean;
  documentTitle?: string;
}

/** Previous calendar year: 1 Jan – 31 Dec. */
export function defaultPastYearRange(): DateRange {
  const year = new Date().getFullYear() - 1;
  return {
    from: new Date(year, 0, 1),
    to: new Date(year, 11, 31),
  };
}

function dateToIso(d: Date | undefined): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoToDate(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function serializeFilters(filters: {
  projectTypeIds: string[];
  dateRange: DateRange | undefined;
  minDealAmount: string;
}): CasePdfFilterDraft {
  return {
    projectTypeIds: filters.projectTypeIds,
    periodFrom: dateToIso(filters.dateRange?.from),
    periodTo: dateToIso(filters.dateRange?.to),
    minDealAmount: filters.minDealAmount,
  };
}

export function deserializeFilters(raw: CasePdfFilterDraft | undefined): {
  projectTypeIds: string[];
  dateRange: DateRange | undefined;
  minDealAmount: string;
} {
  if (!raw) {
    return {
      projectTypeIds: [],
      dateRange: defaultPastYearRange(),
      minDealAmount: "",
    };
  }
  const from = isoToDate(raw.periodFrom);
  const to = isoToDate(raw.periodTo);
  return {
    projectTypeIds: raw.projectTypeIds ?? [],
    dateRange: from || to ? { from, to } : defaultPastYearRange(),
    minDealAmount: raw.minDealAmount ?? "",
  };
}

export function loadCasePdfDraft(): CasePdfDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CasePdfDraft;
  } catch {
    return null;
  }
}

export function saveCasePdfDraft(draft: CasePdfDraft): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch (err) {
    console.warn("saveCasePdfDraft failed", err);
  }
}

export function clearCasePdfDraft(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Fingerprint of rows that will appear in the PDF (visible only). */
export function casePdfFingerprint(
  rows: CasePdfProjectRow[],
  hiddenIds: Set<string>,
  documentTitle?: string,
): string {
  const visible = rows.filter((r) => !hiddenIds.has(r.id));
  return JSON.stringify({
    documentTitle: documentTitle ?? "",
    rows: visible.map((r) => ({
      id: r.id,
      projectTypeName: r.projectTypeName,
      constructionPeriod: r.constructionPeriod,
      constructionDays: r.constructionDays,
      districtName: r.districtName,
      buildingName: r.buildingName,
      actualSize: r.actualSize,
      projectName: r.projectName,
      dealAmountDisplay: r.dealAmountDisplay,
      involvedWorks: r.involvedWorks,
      selectedImageId: r.selectedImageId,
    })),
  });
}
