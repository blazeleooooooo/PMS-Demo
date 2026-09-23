"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

type DisabledSubmitControlProps = {
  blocked: boolean;
  busy?: boolean;
  reasons: string[];
  children: React.ReactNode;
  className?: string;
};

export function DisabledSubmitControl({
  blocked,
  busy = false,
  reasons,
  children,
  className,
}: DisabledSubmitControlProps) {
  const [revealed, setRevealed] = useState(false);
  const errorId = useId();
  const showReasons = revealed && reasons.length > 0;
  const captureClick = blocked && !busy;

  useEffect(() => {
    if (reasons.length === 0) setRevealed(false);
  }, [reasons.length]);

  return (
    <div className={cn("flex flex-col items-end gap-1 min-w-0", className)}>
      {showReasons && (
        <ul id={errorId} className="text-xs text-red-500 text-right space-y-0.5 max-w-[20rem]">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      <div className="relative inline-flex">
        {children}
        {captureClick && (
          <button
            type="button"
            className="absolute inset-0 z-10 cursor-not-allowed"
            aria-label="無法提交，查看未符合的條件"
            aria-describedby={showReasons ? errorId : undefined}
            onClick={() => setRevealed(true)}
          />
        )}
      </div>
    </div>
  );
}
