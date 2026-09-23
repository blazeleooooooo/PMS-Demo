"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { formatMoney2 } from "@/lib/date-utils";

interface ExpenseOutstandingSplitDialogProps {
  open: boolean;
  outstandingAmount: number;
  defaultExpectedPaymentDate: string | null;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onStay: () => void;
  onSplit: (childExpectedPaymentDate: string) => void;
}

export default function ExpenseOutstandingSplitDialog({
  open,
  outstandingAmount,
  defaultExpectedPaymentDate,
  saving = false,
  onOpenChange,
  onStay,
  onSplit,
}: ExpenseOutstandingSplitDialogProps) {
  const [childExpectedPaymentDate, setChildExpectedPaymentDate] = useState("");

  useEffect(() => {
    if (open) {
      setChildExpectedPaymentDate(defaultExpectedPaymentDate || "");
    }
  }, [open, defaultExpectedPaymentDate]);

  const canSplit = childExpectedPaymentDate.trim().length > 0 && !saving;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="w-5 h-5" /> 偵測到未付金額
          </AlertDialogTitle>
          <AlertDialogDescription>
            此支出尚有未付{" "}
            <span className="font-semibold text-amber-700">
              {formatMoney2(outstandingAmount)}
            </span>
            。可維持現狀（一筆支出同時記錄已付與未付），或將未付金額拆成另一筆 0% 已付的支出。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <label className="text-sm text-gray-700 block">
            新支出到期日 <span className="text-red-500">*</span>
          </label>
          <Input
            type="date"
            className="h-9 text-sm"
            value={childExpectedPaymentDate}
            onChange={(e) => setChildExpectedPaymentDate(e.target.value)}
            disabled={saving}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving} onClick={onStay}>
            維持現狀
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-500 hover:bg-red-600 text-white"
            disabled={!canSplit}
            onClick={(event) => {
              if (!canSplit) {
                event.preventDefault();
                return;
              }
              onSplit(childExpectedPaymentDate);
            }}
          >
            自動建立未付支出
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
