import { Loader2 } from "lucide-react";

export default function AuditLoading() {
  return (
    <div className="min-h-screen bg-bw-bg flex items-center justify-center">
      <div className="flex items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-bw-blue" />
        <span className="text-sm text-gray-500">載入會計審核...</span>
      </div>
    </div>
  );
}
