"use client";

import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type IncomeDeleteBlockedDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimatedLabel?: string;
};

export function IncomeDeleteBlockedDialog({
  open,
  onOpenChange,
  estimatedLabel,
}: IncomeDeleteBlockedDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" /> 無法刪除收入
          </AlertDialogTitle>
          <AlertDialogDescription>
            刪除此收入後，項目收入總額將少於預計收入
            {estimatedLabel ? ` ${estimatedLabel}` : ""}
            ，因此無法刪除。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>確定</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
