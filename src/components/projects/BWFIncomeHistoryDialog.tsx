"use client";

/** Thin wrapper — payment-progress list still imports this income-only dialog. */
import ProjectFinanceHistoryDialog from "@/components/projects/ProjectFinanceHistoryDialog";

type BWFIncomeHistoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  onDataChanged?: () => void;
};

export default function BWFIncomeHistoryDialog({
  open,
  onOpenChange,
  projectId,
  projectCode,
  projectName,
  onDataChanged,
}: BWFIncomeHistoryDialogProps) {
  return (
    <ProjectFinanceHistoryDialog
      open={open}
      onOpenChange={onOpenChange}
      projectId={projectId}
      entityType="bwf_project"
      projectCode={projectCode}
      projectName={projectName}
      initialTab="income"
      showExpenseTab={false}
      onDataChanged={onDataChanged}
    />
  );
}
