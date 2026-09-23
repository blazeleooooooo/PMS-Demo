import { toDateInputValue } from "@/lib/date-utils";

export const AO_DESIGN_FIRM_CONFIRMED = "已確定" as const;
export const AO_DESIGN_FIRM_UNCONFIRMED = "未確定" as const;
export const AO_DESIGN_FIRM_URGENT = "未確定 URGENT!" as const;

export type AoDesignFirmStatus =
  | typeof AO_DESIGN_FIRM_CONFIRMED
  | typeof AO_DESIGN_FIRM_UNCONFIRMED
  | typeof AO_DESIGN_FIRM_URGENT;

export const AO_DESIGN_FIRM_STATUSES: {
  value: AoDesignFirmStatus;
  label: string;
  urgent?: boolean;
}[] = [
  { value: AO_DESIGN_FIRM_CONFIRMED, label: "已確定" },
  { value: AO_DESIGN_FIRM_UNCONFIRMED, label: "未確定" },
  { value: AO_DESIGN_FIRM_URGENT, label: "未確定 URGENT!", urgent: true },
];

export const AO_WORK_NOT_STARTED = "未做" as const;
export const AO_WORK_STARTED = "已開工" as const;

export type AoWorkStatus = typeof AO_WORK_NOT_STARTED | typeof AO_WORK_STARTED;

export const AO_WORK_STATUSES: { value: AoWorkStatus; label: string }[] = [
  { value: AO_WORK_NOT_STARTED, label: "未做" },
  { value: AO_WORK_STARTED, label: "已開工" },
];

export interface IncomeAoFormFields {
  ao_request_date: string | null;
  ao_issue_date: string | null;
  ao_work_days: number | null;
  ao_design_firm_status: string | null;
  ao_quotation_firm_date: string | null;
  ao_work_status: string | null;
  ao_client_follow_up: string | null;
}

export const EMPTY_INCOME_AO_FIELDS: IncomeAoFormFields = {
  ao_request_date: null,
  ao_issue_date: null,
  ao_work_days: null,
  ao_design_firm_status: null,
  ao_quotation_firm_date: null,
  ao_work_status: null,
  ao_client_follow_up: null,
};

export function incomeAoFieldsFromRow(income: Partial<IncomeAoFormFields> | null | undefined): IncomeAoFormFields {
  return {
    ao_request_date: toDateInputValue(income?.ao_request_date) || null,
    ao_issue_date: toDateInputValue(income?.ao_issue_date) || null,
    ao_work_days: income?.ao_work_days ?? null,
    ao_design_firm_status: income?.ao_design_firm_status ?? null,
    ao_quotation_firm_date: toDateInputValue(income?.ao_quotation_firm_date) || null,
    ao_work_status: income?.ao_work_status ?? null,
    ao_client_follow_up: income?.ao_client_follow_up ?? null,
  };
}

export function isAoContractType(
  contractTypes: { id: string; is_ao?: boolean | null }[],
  contractTypeId: string | null | undefined
): boolean {
  if (!contractTypeId) return false;
  return contractTypes.some((ct) => ct.id === contractTypeId && ct.is_ao === true);
}
