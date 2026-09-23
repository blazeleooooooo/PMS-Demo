export const CUSTOMER_RECORD_STATUSES = [
  "Active",
  "Inactive",
  "Blacklist",
] as const;

export type CustomerRecordStatus = (typeof CUSTOMER_RECORD_STATUSES)[number];

export const CUSTOMER_RECORD_STATUS_LABELS: Record<CustomerRecordStatus, string> = {
  Active: "啟用 Active",
  Inactive: "停用 Inactive",
  Blacklist: "黑名單 Blacklist",
};

export function isCustomerRecordStatus(
  value: string | null | undefined
): value is CustomerRecordStatus {
  return CUSTOMER_RECORD_STATUSES.includes(value as CustomerRecordStatus);
}

export function customerRecordStatusLabel(status: string | null | undefined): string {
  if (!status) return "-";
  return CUSTOMER_RECORD_STATUS_LABELS[status as CustomerRecordStatus] ?? status;
}

export function customerRecordStatusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case "Active":
      return "border-green-200 text-green-700 bg-green-50 text-xs";
    case "Inactive":
      return "border-gray-200 text-gray-500 bg-gray-50 text-xs";
    case "Blacklist":
      return "border-red-200 text-red-700 bg-red-50 text-xs";
    default:
      return "border-gray-200 text-gray-600 bg-gray-50 text-xs";
  }
}
