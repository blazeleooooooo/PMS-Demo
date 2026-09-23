import { Loader2 } from "lucide-react";

export default function WeeklyReportLoading() {
  return (
    <div className="min-h-screen bg-bw-bg flex items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">載入10日報告編輯器...</span>
      </div>
    </div>
  );
}
