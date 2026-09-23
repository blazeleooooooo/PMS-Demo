import { redirect } from "next/navigation";

/** Legacy URL — page moved to 測試中頁面 at /testing/designer-daily-feed */
export default function DesignerDailyFeedRedirect() {
  redirect("/testing/designer-daily-feed");
}
