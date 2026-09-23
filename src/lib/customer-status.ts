export const CUSTOMER_STATUS_FILTER_VALUES = [
  "Enquiry",
  "Pitching",
  "Project",
  "Case Closed",
] as const;

export type CustomerStatusFilterValue = (typeof CUSTOMER_STATUS_FILTER_VALUES)[number];

export const CUSTOMER_STATUS_FILTER_LABELS: Record<CustomerStatusFilterValue, string> = {
  Enquiry: "查詢",
  Pitching: "提案",
  Project: "項目",
  "Case Closed": "結案",
};

export function customerStatusFilterLabel(status: string | null | undefined): string {
  if (!status) return "-";
  return CUSTOMER_STATUS_FILTER_LABELS[status as CustomerStatusFilterValue] ?? status;
}

export function customerStatusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case "Case Closed":
      return "border-gray-200 text-gray-500 bg-gray-50 text-xs";
    case "Project":
      return "border-green-200 text-green-700 bg-green-50 text-xs";
    case "Pitching":
      return "border-amber-200 text-amber-700 bg-amber-50 text-xs";
    case "Enquiry":
      return "border-blue-200 text-blue-600 bg-blue-50 text-xs";
    default:
      return "border-gray-200 text-gray-600 bg-gray-50 text-xs";
  }
}
