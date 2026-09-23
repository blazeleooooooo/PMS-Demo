import { redirect } from "next/navigation";

/** Legacy admin URL — page moved to 主選單 at /work-report-check */
export default function WorkReportCheckAdminRedirect() {
  redirect("/work-report-check");
}
