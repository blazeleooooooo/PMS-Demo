"use client";

import ManHourTaskInlineForm from "@/components/reports/ManHourTaskInlineForm";

interface DesignerManHourTaskFormProps {
  taskNumber: number;
  manHourDateId: string;
  editTaskId?: string | null;
  onSaved: () => void;
  onCancel?: () => void;
}

/** @deprecated Prefer ManHourTaskInlineForm directly — work-kind pills live inside it. */
export default function DesignerManHourTaskForm(props: DesignerManHourTaskFormProps) {
  return <ManHourTaskInlineForm {...props} />;
}
