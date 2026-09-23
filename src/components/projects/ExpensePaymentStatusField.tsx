"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXPENSE_APPROVED,
  EXPENSE_PENDING_CHECK,
  EXPENSE_REJECTED,
  EXPENSE_ZOHO_COMPLETED,
  isExpenseDecisionStatus,
} from "@/lib/expense-payment-status";

const NONE = "__none__";

function statusLabel(status: string | null): string {
  if (status == null || status === "") return "未申請";
  if (status === EXPENSE_PENDING_CHECK) return "Pending Check";
  if (status === EXPENSE_APPROVED) return "Approved";
  if (status === EXPENSE_ZOHO_COMPLETED) return "Zoho Completed";
  if (status === EXPENSE_REJECTED) return "Rejected";
  return status;
}

export function ExpensePaymentStatusField({
  value,
  onChange,
  isAdmin,
  disabled,
  error,
  required,
  showZohoCompleted = false,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  isAdmin: boolean;
  disabled?: boolean;
  error?: string | null;
  required?: boolean;
  /** BWF only — hidden on BWA expense dialogs. */
  showZohoCompleted?: boolean;
}) {
  const label = (
    <label className="text-xs font-medium text-gray-600 mb-1 block">
      審批狀態{required ? <span className="text-red-500"> *</span> : null}
    </label>
  );
  if (isAdmin) {
    return (
      <div>
        {label}
        <Select
          value={value || NONE}
          disabled={disabled}
          onValueChange={(val) => onChange(val === NONE ? null : val)}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="未申請" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>未申請</SelectItem>
            <SelectItem value={EXPENSE_PENDING_CHECK}>Pending Check</SelectItem>
            <SelectItem value={EXPENSE_APPROVED}>Approved</SelectItem>
            {showZohoCompleted && (
              <SelectItem value={EXPENSE_ZOHO_COMPLETED}>Zoho Completed</SelectItem>
            )}
            <SelectItem value={EXPENSE_REJECTED}>Rejected</SelectItem>
          </SelectContent>
        </Select>
        {error && <p className="text-[12px] text-red-500 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      {label}
      {isExpenseDecisionStatus(value) ? (
        <div className="h-9 px-3 rounded-md border border-gray-200 bg-gray-50 text-sm flex items-center text-gray-700">
          {statusLabel(value)}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="h-9 px-3 rounded-md border border-gray-200 bg-gray-50 text-sm flex items-center text-gray-700 flex-1">
            {statusLabel(value)}
          </div>
          {value === EXPENSE_PENDING_CHECK ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={disabled}
              onClick={() => onChange(null)}
            >
              取消申請
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={disabled}
              onClick={() => onChange(EXPENSE_PENDING_CHECK)}
            >
              申請審核
            </Button>
          )}
        </div>
      )}
      {error && <p className="text-[12px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}
