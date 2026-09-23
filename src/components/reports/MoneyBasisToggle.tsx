"use client";

// Shared L2 (Signed) / L3 (Actual) money-basis toggle for business reports.

export type MoneyBasis = "l2" | "l3";

interface MoneyBasisToggleProps {
  value: MoneyBasis;
  onChange: (next: MoneyBasis) => void;
  className?: string;
}

export default function MoneyBasisToggle({
  value,
  onChange,
  className,
}: MoneyBasisToggleProps) {
  return (
    <div
      className={`inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white ${className ?? ""}`}
    >
      <button
        type="button"
        onClick={() => onChange("l2")}
        className={`px-3 py-1.5 text-[13px] font-medium transition-colors ${
          value === "l2"
            ? "bg-bw-blue text-white"
            : "bg-white text-gray-600 hover:bg-gray-50"
        }`}
      >
        L2 Signed
      </button>
      <button
        type="button"
        onClick={() => onChange("l3")}
        className={`px-3 py-1.5 text-[13px] font-medium transition-colors border-l border-gray-200 ${
          value === "l3"
            ? "bg-bw-blue text-white"
            : "bg-white text-gray-600 hover:bg-gray-50"
        }`}
      >
        L3 Actual
      </button>
    </div>
  );
}
