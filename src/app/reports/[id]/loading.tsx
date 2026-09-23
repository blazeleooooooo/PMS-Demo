import { Loader2 } from "lucide-react";

export default function ManHourDetailLoading() {
  return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      <span className="ml-3 text-gray-500">載入工時詳情...</span>
    </div>
  );
}
