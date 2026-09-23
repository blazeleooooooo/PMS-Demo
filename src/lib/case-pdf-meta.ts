export type CasePdfMetaKey =
  | "district"
  | "building"
  | "size"
  | "period"
  | "days";

export type CasePdfMetaFieldKey =
  | "districtName"
  | "buildingName"
  | "actualSize"
  | "constructionPeriod"
  | "constructionDays";

export interface CasePdfMetaRow {
  key: CasePdfMetaKey;
  field: CasePdfMetaFieldKey;
  label: string;
  raw: string;
  display: string;
}

export function isCasePdfFieldPresent(
  value: string | null | undefined,
): boolean {
  return Boolean(value && String(value).trim());
}

function trimmed(value: string | null | undefined): string {
  return value ? String(value).trim() : "";
}

/** Date range with optional day count, e.g. `2025年12月 – 2026年5月 (159 日)`. */
export function formatCasePdfPeriodDisplay(
  period?: string | null,
  days?: string | null,
): string {
  const p = trimmed(period);
  const d = trimmed(days);
  if (p && d) return `${p} (${d} 日)`;
  if (p) return p;
  if (d) return `${d} 日`;
  return "";
}

/** Prefix a dollar sign unless the value already has one. */
export function formatCasePdfDealAmount(
  value?: string | null,
): string {
  const t = trimmed(value);
  if (!t) return "";
  if (t.startsWith("$") || t.startsWith("＄")) return t;
  return `$${t}`;
}

export interface BuildCasePdfMetaRowsOptions {
  /** Combine date range + days onto one period row. Default true. */
  mergePeriodDays?: boolean;
}

/** District / building / size / date range / days — omit blank values. */
export function buildCasePdfMetaRows(
  row: {
    districtName?: string | null;
    buildingName?: string | null;
    actualSize?: string | null;
    constructionPeriod?: string | null;
    constructionDays?: string | null;
  },
  options?: BuildCasePdfMetaRowsOptions,
): CasePdfMetaRow[] {
  const size = trimmed(row.actualSize);
  const period = trimmed(row.constructionPeriod);
  const days = trimmed(row.constructionDays);
  const mergePeriodDays = options?.mergePeriodDays !== false;
  const items: CasePdfMetaRow[] = [
    {
      key: "district",
      field: "districtName",
      label: "地區",
      raw: trimmed(row.districtName),
      display: trimmed(row.districtName),
    },
    {
      key: "building",
      field: "buildingName",
      label: "大廈名稱",
      raw: trimmed(row.buildingName),
      display: trimmed(row.buildingName),
    },
    {
      key: "size",
      field: "actualSize",
      label: "實用尺數",
      raw: size,
      display: size ? `${size} 呎` : "",
    },
  ];

  if (mergePeriodDays) {
    const combined = formatCasePdfPeriodDisplay(period, days);
    if (combined) {
      items.push({
        key: period ? "period" : "days",
        field: period ? "constructionPeriod" : "constructionDays",
        label: period ? "施工時段" : "施工日數",
        raw: period || days,
        display: combined,
      });
    }
  } else {
    items.push(
      {
        key: "period",
        field: "constructionPeriod",
        label: "施工時段",
        raw: period,
        display: period,
      },
      {
        key: "days",
        field: "constructionDays",
        label: "施工日數",
        raw: days,
        display: days ? `${days} 日` : "",
      },
    );
  }

  return items.filter((item) => isCasePdfFieldPresent(item.raw));
}
