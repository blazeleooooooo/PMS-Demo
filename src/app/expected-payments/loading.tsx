import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex items-center justify-center h-screen bg-bw-bg">
      <Loader2 className="w-8 h-8 animate-spin text-bw-blue" />
      <span className="ml-3 text-gray-500 text-sm">載入中...</span>
    </div>
  );
}
