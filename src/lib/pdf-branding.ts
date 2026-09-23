export const PDF_BRANDING_VERSION = 1 as const;

export type PdfBrandingSlotKey =
  | "companyName"
  | "companyLogo"
  | "companyChop"
  | "paymentInfo";

export type CompanyNameValue = {
  display: string | null;
  chineseDisplay: string | null;
};

export type LogoValue = { url: string | null };
export type ChopValue = { url: string | null };
export type PaymentInfoValue = { bankNotes: string | null };

export type BrandingSlot<T> = {
  visible: boolean;
  sourceId: string | null;
  value: T;
};

export type PdfBranding = {
  version: typeof PDF_BRANDING_VERSION;
  companyName: BrandingSlot<CompanyNameValue>;
  companyLogo: BrandingSlot<LogoValue>;
  companyChop: BrandingSlot<ChopValue>;
  paymentInfo: BrandingSlot<PaymentInfoValue>;
};

export type CostCentreBrandingSource = {
  id: string;
  bu_code?: string | null;
  display: string | null;
  chinese_display: string | null;
  business_logo: string | null;
  company_chop: string | null;
  bank_notes: string | null;
};

function companyNameValue(cc: CostCentreBrandingSource | null): CompanyNameValue {
  return {
    display: cc?.display ?? null,
    chineseDisplay: cc?.chinese_display ?? null,
  };
}

function slotFromCostCentre<K extends PdfBrandingSlotKey>(
  key: K,
  cc: CostCentreBrandingSource | null
): PdfBranding[K] {
  const sourceId = cc?.id ?? null;
  if (key === "companyName") {
    return { visible: true, sourceId, value: companyNameValue(cc) } as PdfBranding[K];
  }
  if (key === "companyLogo") {
    return { visible: true, sourceId, value: { url: cc?.business_logo ?? null } } as PdfBranding[K];
  }
  if (key === "companyChop") {
    return { visible: true, sourceId, value: { url: cc?.company_chop ?? null } } as PdfBranding[K];
  }
  return { visible: true, sourceId, value: { bankNotes: cc?.bank_notes ?? null } } as PdfBranding[K];
}

export function emptyPdfBranding(primaryId: string | null = null): PdfBranding {
  return {
    version: PDF_BRANDING_VERSION,
    companyName: { visible: true, sourceId: primaryId, value: { display: null, chineseDisplay: null } },
    companyLogo: { visible: true, sourceId: primaryId, value: { url: null } },
    companyChop: { visible: true, sourceId: primaryId, value: { url: null } },
    paymentInfo: { visible: true, sourceId: primaryId, value: { bankNotes: null } },
  };
}

export function brandingFromCostCentre(cc: CostCentreBrandingSource | null): PdfBranding {
  return {
    version: PDF_BRANDING_VERSION,
    companyName: slotFromCostCentre("companyName", cc),
    companyLogo: slotFromCostCentre("companyLogo", cc),
    companyChop: slotFromCostCentre("companyChop", cc),
    paymentInfo: slotFromCostCentre("paymentInfo", cc),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown, fallback: string | null): string | null {
  if (typeof value === "string") return value;
  if (value === null) return null;
  return fallback;
}

function parseSlot<T>(
  raw: unknown,
  fallback: BrandingSlot<T>,
  parseValue: (value: unknown) => T
): BrandingSlot<T> {
  if (!isRecord(raw)) return fallback;
  return {
    visible: raw.visible !== false,
    sourceId:
      typeof raw.sourceId === "string"
        ? raw.sourceId
        : raw.sourceId === null
          ? null
          : fallback.sourceId,
    value: parseValue(raw.value),
  };
}

export function parsePdfBranding(raw: unknown): PdfBranding | null {
  if (!isRecord(raw) || raw.version !== PDF_BRANDING_VERSION) return null;
  const empty = emptyPdfBranding();
  return {
    version: PDF_BRANDING_VERSION,
    companyName: parseSlot(raw.companyName, empty.companyName, (value) => {
      if (!isRecord(value)) return empty.companyName.value;
      return {
        display: nullableString(value.display, empty.companyName.value.display),
        chineseDisplay: nullableString(value.chineseDisplay, empty.companyName.value.chineseDisplay),
      };
    }),
    companyLogo: parseSlot(raw.companyLogo, empty.companyLogo, (value) => {
      if (!isRecord(value)) return empty.companyLogo.value;
      return { url: nullableString(value.url, empty.companyLogo.value.url) };
    }),
    companyChop: parseSlot(raw.companyChop, empty.companyChop, (value) => {
      if (!isRecord(value)) return empty.companyChop.value;
      return { url: nullableString(value.url, empty.companyChop.value.url) };
    }),
    paymentInfo: parseSlot(raw.paymentInfo, empty.paymentInfo, (value) => {
      if (!isRecord(value)) return empty.paymentInfo.value;
      return { bankNotes: nullableString(value.bankNotes, empty.paymentInfo.value.bankNotes) };
    }),
  };
}

export function isSlotInherited(
  slot: BrandingSlot<unknown>,
  primaryId: string | null
): boolean {
  return slot.sourceId == null || slot.sourceId === primaryId;
}

function keepOrResetSlot<K extends PdfBrandingSlotKey>(
  prev: PdfBranding,
  next: PdfBranding,
  key: K,
  oldPrimaryId: string | null
): PdfBranding[K] {
  if (isSlotInherited(prev[key], oldPrimaryId)) {
    return { ...next[key], visible: prev[key].visible };
  }
  return prev[key];
}

export function applyPrimaryCostCentreChange(
  prev: PdfBranding | null | undefined,
  oldPrimaryId: string | null,
  newPrimary: CostCentreBrandingSource | null
): PdfBranding {
  const next = brandingFromCostCentre(newPrimary);
  if (!prev) return next;

  return {
    version: PDF_BRANDING_VERSION,
    companyName: keepOrResetSlot(prev, next, "companyName", oldPrimaryId),
    companyLogo: keepOrResetSlot(prev, next, "companyLogo", oldPrimaryId),
    companyChop: keepOrResetSlot(prev, next, "companyChop", oldPrimaryId),
    paymentInfo: keepOrResetSlot(prev, next, "paymentInfo", oldPrimaryId),
  };
}

export function applySlotSourceChange(
  prev: PdfBranding,
  key: PdfBrandingSlotKey,
  sourceId: string | null,
  all: CostCentreBrandingSource[]
): PdfBranding {
  const cc = sourceId ? all.find((item) => item.id === sourceId) ?? null : null;
  const fromSource = slotFromCostCentre(key, cc);
  return {
    ...prev,
    [key]: {
      ...fromSource,
      sourceId,
      visible: prev[key].visible,
    },
  };
}

export function applySlotVisibility(
  prev: PdfBranding,
  key: PdfBrandingSlotKey,
  visible: boolean
): PdfBranding {
  return {
    ...prev,
    [key]: { ...prev[key], visible },
  };
}

export function resolvePdfBranding(
  primary: CostCentreBrandingSource | null,
  stored: PdfBranding | null | undefined
): PdfBranding {
  return stored ?? brandingFromCostCentre(primary);
}

export function slotSourceId(
  branding: PdfBranding,
  key: PdfBrandingSlotKey,
  primaryId: string | null
): string {
  return branding[key].sourceId || primaryId || "";
}
