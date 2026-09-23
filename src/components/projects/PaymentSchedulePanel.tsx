"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  CreditCard,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Calendar,
  ChevronRight,
  Receipt,
  TrendingUp,
  ArrowDownCircle,
  Printer,
  FileText,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type BWAProjectIncome, type CostCentreData } from "@/lib/data-service";
import { fetchIssuedInvoiceNumbersByIncomeIds } from "@/lib/data/finance";
import { incomeNetOutstanding, isIncomeSettledByStatus } from "@/lib/income-outstanding";
import {
  formatIssuedInvoiceNumber,
  formatProjectInvoiceRowHash,
} from "@/lib/project-invoice-summary";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";

// ─── TYPES ──────────────────────────────────────────────
interface PaymentSchedulePanelProps {
  incomes: BWAProjectIncome[];
  estimatedIncome?: number | null;
  projectCode?: string;
  onIncomeClick?: (incomeId: string) => void;
  // Project info for 工程對數表
  projectName?: string;
  customerName?: string;
  customerAddress?: string;
  pmName?: string;
  costCentre?: CostCentreData | null;
  /** Override the permission module used for CRUD checks. Defaults to "projects". */
  permissionModule?: string;
}

import { formatDate, formatDateShort } from "@/lib/date-utils";
const formatDateFull = formatDate; // alias

function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

type DueStatus = "overdue" | "due-soon" | "upcoming" | "paid" | "no-date";

function getDueStatus(income: BWAProjectIncome): DueStatus {
  const amount = income.amount || 0;
  const paid = income.payment_amount || 0;

  // Fully paid, or fully written off via bad debts
  if (amount > 0 && paid >= amount) return "paid";
  if (incomeNetOutstanding(income) <= 0) return "paid";

  if (isIncomeSettledByStatus(income.payment_status)) return "paid";

  const days = getDaysUntil(income.due_date);
  if (days === null) return "no-date";
  if (days < 0) return "overdue";
  if (days <= 7) return "due-soon";
  return "upcoming";
}

const STATUS_CONFIG: Record<DueStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  icon: React.ElementType;
  badgeBg: string;
  badgeText: string;
}> = {
  overdue: {
    label: "逾期",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-l-red-500",
    iconColor: "text-red-500",
    icon: AlertTriangle,
    badgeBg: "bg-red-100",
    badgeText: "text-red-700",
  },
  "due-soon": {
    label: "即將到期",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-l-amber-500",
    iconColor: "text-amber-500",
    icon: AlertCircle,
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-700",
  },
  upcoming: {
    label: "未到期",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-l-blue-500",
    iconColor: "text-blue-500",
    icon: Clock,
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-700",
  },
  paid: {
    label: "已收款",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-l-emerald-500",
    iconColor: "text-emerald-500",
    icon: CheckCircle2,
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-700",
  },
  "no-date": {
    label: "未設定到期日",
    color: "text-gray-500",
    bgColor: "bg-gray-50",
    borderColor: "border-l-gray-300",
    iconColor: "text-gray-400",
    icon: Calendar,
    badgeBg: "bg-gray-100",
    badgeText: "text-gray-600",
  },
};

// ─── CONTRACT GROUP TYPE ─────────────────────────────────
interface ContractGroup {
  contractTypeId: string | null;
  contractTypeName: string;
  incomes: BWAProjectIncome[];
  totalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
}

// ─── PAYMENT PROGRESS BAR ────────────────────────────────
function PaymentProgressBar({
  paid,
  total,
  small = false,
}: {
  paid: number;
  total: number;
  small?: boolean;
}) {
  const { formatMoney } = useFinancialFormat();
  const pct = total > 0 ? Math.min(Math.round((paid / total) * 100), 100) : 0;

  const getBarColor = () => {
    if (pct >= 100) return "bg-emerald-500";
    if (pct >= 75) return "bg-blue-500";
    if (pct >= 50) return "bg-amber-500";
    if (pct > 0) return "bg-orange-500";
    return "bg-gray-200";
  };

  return (
    <div className="w-full">
      <div className={`w-full bg-gray-100 rounded-full overflow-hidden ${small ? "h-1.5" : "h-2.5"}`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${getBarColor()}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!small && (
        <div className="flex items-center justify-between mt-1">
          <span className="text-[12px] text-gray-400">{pct}% 已收</span>
          <span className="text-[12px] font-mono text-gray-500">
            {formatMoney(paid)} / {formatMoney(total)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── INCOME CARD ─────────────────────────────────────────
function IncomePaymentCard({
  income,
  index,
  onClick,
}: {
  income: BWAProjectIncome;
  index: number;
  onClick?: () => void;
}) {
  const { formatMoney } = useFinancialFormat();
  const status = getDueStatus(income);
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;
  const days = getDaysUntil(income.due_date);
  const amount = income.amount || 0;
  const paid = income.payment_amount || 0;
  const outstanding = incomeNetOutstanding(income) || Math.max(0, amount - paid - (Number(income.bad_debts) || 0));
  const pct = amount > 0 ? Math.round((paid / amount) * 100) : 0;

  const daysLabel = (() => {
    if (status === "paid") return null;
    if (days === null) return null;
    if (days < 0) return `逾期 ${Math.abs(days)} 天`;
    if (days === 0) return "今日到期";
    if (days === 1) return "明日到期";
    return `${days} 天後到期`;
  })();

  return (
    <div
      className={`relative border-l-4 ${config.borderColor} rounded-xl bg-white shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group overflow-hidden`}
      onClick={onClick}
      style={{
        animationDelay: `${index * 80}ms`,
        animation: "fadeInUp 0.4s ease-out forwards",
      }}
    >
      {/* Top accent line for overdue/due-soon */}
      {(status === "overdue" || status === "due-soon") && (
        <div className={`absolute top-0 left-0 right-0 h-[2px] ${status === "overdue" ? "bg-red-500" : "bg-amber-400"}`} />
      )}

      <div className="p-4">
        {/* Header row: index + contract type + status badge */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[13px] font-bold ${config.bgColor} ${config.color}`}>
              {index + 1}
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-gray-800 truncate leading-tight">
                {income.contract_type_name || income.type_display || "收入項目"}
              </p>
              {income.invoice_number && (
                <p className="text-[12px] text-gray-400 mt-0.5 font-mono truncate">
                  #{income.invoice_number}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Badge className={`${config.badgeBg} ${config.badgeText} border-0 text-[12px] font-medium px-2 py-0.5 gap-1`}>
              <StatusIcon className="w-3 h-3" />
              {config.label}
            </Badge>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Amount details */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <p className="text-[12px] text-gray-400 mb-0.5">應收金額</p>
            <p className="text-[16px] font-bold font-mono text-gray-800">{formatMoney(amount)}</p>
          </div>
          <div>
            <p className="text-[12px] text-gray-400 mb-0.5">已收金額</p>
            <p className="text-[16px] font-bold font-mono text-emerald-600">{formatMoney(paid)}</p>
          </div>
          <div>
            <p className="text-[12px] text-gray-400 mb-0.5">待收金額</p>
            <p className={`text-[16px] font-bold font-mono ${outstanding > 0 ? "text-red-500" : "text-gray-400"}`}>
              {formatMoney(outstanding)}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <PaymentProgressBar paid={paid} total={amount} small />

        {/* Footer: Due date + days label */}
        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-50">
          <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
            <Calendar className="w-3 h-3 text-gray-400" />
            <span>到期: {income.due_date ? formatDate(income.due_date) : "—"}</span>
          </div>
          {daysLabel && (
            <span className={`text-[12px] font-semibold ${config.color} ${config.bgColor} px-2 py-0.5 rounded-full`}>
              {daysLabel}
            </span>
          )}
          {status === "paid" && income.payment_date && (
            <span className="text-[12px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              收款: {formatDate(income.payment_date)}
            </span>
          )}
        </div>

        {/* Remark */}
        {income.remark && (
          <p className="text-[12px] text-gray-400 mt-2 truncate" title={income.remark}>
            備註: {income.remark}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── CONTRACT GROUP SECTION ──────────────────────────────
function ContractGroupSection({
  group,
  onIncomeClick,
}: {
  group: ContractGroup;
  onIncomeClick?: (incomeId: string) => void;
}) {
  const { formatMoney } = useFinancialFormat();
  const pct = group.totalAmount > 0 ? Math.round((group.totalPaid / group.totalAmount) * 100) : 0;

  // Sort incomes: overdue first, then due-soon, then upcoming, then paid, then no-date
  const sortOrder: Record<DueStatus, number> = {
    overdue: 0,
    "due-soon": 1,
    upcoming: 2,
    "no-date": 3,
    paid: 4,
  };

  const sortedIncomes = [...group.incomes].sort((a, b) => {
    const sa = sortOrder[getDueStatus(a)];
    const sb = sortOrder[getDueStatus(b)];
    if (sa !== sb) return sa - sb;
    // Within same status, sort by due_date ascending
    const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    return da - db;
  });

  return (
    <div className="space-y-3">
      {/* Contract Group Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-6 rounded-full bg-blue-500" />
          <h3 className="text-[16px] font-bold text-gray-800">
            {group.contractTypeName}
          </h3>
          <Badge variant="outline" className="text-[12px] text-gray-500">
            {group.incomes.length} 筆
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-[13px]">
          <span className="text-gray-400">小計</span>
          <span className="font-mono font-semibold text-gray-700">{formatMoney(group.totalAmount)}</span>
          <span className={`font-mono font-bold ${pct >= 100 ? "text-emerald-600" : pct > 0 ? "text-blue-600" : "text-gray-400"}`}>
            {pct}%
          </span>
        </div>
      </div>

      {/* Mini progress for group */}
      <PaymentProgressBar paid={group.totalPaid} total={group.totalAmount} />

      {/* Income cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {sortedIncomes.map((income, idx) => (
          <IncomePaymentCard
            key={income.id}
            income={income}
            index={idx}
            onClick={() => onIncomeClick?.(income.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── SUMMARY DONUT ───────────────────────────────────────
function CollectionDonut({
  paid,
  total,
  overdueCount,
  dueSoonCount,
}: {
  paid: number;
  total: number;
  overdueCount: number;
  dueSoonCount: number;
}) {
  const { formatMoney } = useFinancialFormat();
  const pct = total > 0 ? Math.min(Math.round((paid / total) * 100), 100) : 0;

  const size = 100;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const getColor = () => {
    if (pct >= 100) return { stroke: "#10b981", text: "text-emerald-600" };
    if (pct >= 75) return { stroke: "#3b82f6", text: "text-blue-600" };
    if (pct >= 50) return { stroke: "#f59e0b", text: "text-amber-600" };
    return { stroke: "#ef4444", text: "text-red-500" };
  };
  const color = getColor();

  return (
    <div className="flex items-center gap-5">
      <div className="relative flex-shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={color.stroke} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-[20px] font-bold ${color.text}`}>{pct}%</span>
        </div>
      </div>
      <div className="min-w-[130px] space-y-2">
        <p className="text-[15px] font-semibold text-gray-700">收款進度</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-gray-500 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              已收款
            </span>
            <span className="font-mono font-medium text-gray-700">{formatMoney(paid)}</span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-gray-500 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" />
              待收
            </span>
            <span className="font-mono font-medium text-gray-700">{formatMoney(total - paid)}</span>
          </div>
          {overdueCount > 0 && (
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-red-500 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                逾期
              </span>
              <span className="font-mono font-bold text-red-600">{overdueCount} 筆</span>
            </div>
          )}
          {dueSoonCount > 0 && (
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-amber-600 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                即將到期
              </span>
              <span className="font-mono font-bold text-amber-600">{dueSoonCount} 筆</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TIMELINE BAR ────────────────────────────────────────
function PaymentTimeline({ incomes }: { incomes: BWAProjectIncome[] }) {
  const { formatMoney } = useFinancialFormat();
  const incomesWithDue = incomes.filter((i) => i.due_date);
  if (incomesWithDue.length === 0) return null;

  const sorted = [...incomesWithDue].sort(
    (a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()
  );

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return (
    <Card className="border border-gray-100 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-[15px] font-bold text-gray-700 flex items-center gap-2">
          <Clock className="w-4 h-4 text-violet-500" />
          收款時間軸
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-3 top-0 bottom-0 w-[2px] bg-gray-100" />

          <div className="space-y-3">
            {sorted.map((income, idx) => {
              const status = getDueStatus(income);
              const config = STATUS_CONFIG[status];
              const StatusIcon = config.icon;
              const days = getDaysUntil(income.due_date);
              const isPast = days !== null && days < 0;

              return (
                <div key={income.id} className="relative flex items-start gap-3 pl-1">
                  {/* Dot */}
                  <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center ${config.bgColor} ring-2 ring-white`}>
                    <StatusIcon className={`w-3 h-3 ${config.iconColor}`} />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-[14px] font-medium truncate ${status === "paid" ? "text-gray-400 line-through" : "text-gray-700"}`}>
                        {income.contract_type_name || income.type_display || "收入項目"}
                        {income.invoice_number && <span className="text-gray-400 ml-1">#{income.invoice_number}</span>}
                      </p>
                      <span className={`text-[14px] font-mono font-bold flex-shrink-0 ${
                        status === "paid" ? "text-emerald-600" : status === "overdue" ? "text-red-600" : "text-gray-700"
                      }`}>
                        {formatMoney(income.amount)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[12px] text-gray-400">{formatDate(income.due_date)}</span>
                      {days !== null && status !== "paid" && (
                        <Badge className={`${config.badgeBg} ${config.badgeText} border-0 text-[11px] px-1.5 py-0`}>
                          {isPast ? `逾期 ${Math.abs(days)} 天` : days === 0 ? "今日" : `${days} 天後`}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────
export default function PaymentSchedulePanel({
  incomes,
  estimatedIncome,
  projectCode,
  onIncomeClick,
  projectName,
  customerName,
  customerAddress,
  pmName,
  costCentre,
  permissionModule = "projects",
}: PaymentSchedulePanelProps) {
  const { formatMoney, formatMoney2 } = useFinancialFormat();
  // ─── PERMISSION CHECKS ──────────────────
  const { canCreate, canEdit, canDelete } = usePermission();
  const _canEdit = canEdit(permissionModule);

  const [isPrintMode, setIsPrintMode] = useState(false);
  const [issuedByIncomeId, setIssuedByIncomeId] = useState<Record<string, string | null>>({});
  const printRef = useRef<HTMLDivElement>(null);
  const incomeIdsKey = incomes.map((income) => income.id).join(",");

  useEffect(() => {
    const ids = incomeIdsKey ? incomeIdsKey.split(",") : [];
    if (ids.length === 0) {
      setIssuedByIncomeId({});
      return;
    }
    let cancelled = false;
    void fetchIssuedInvoiceNumbersByIncomeIds(ids).then((map) => {
      if (!cancelled) setIssuedByIncomeId(map);
    });
    return () => {
      cancelled = true;
    };
  }, [incomeIdsKey]);
  // Group incomes by contract type
  const { groups, stats } = useMemo(() => {
    const UNCATEGORIZED = "__uncategorized__";
    const map = new Map<string, ContractGroup>();
    const order: string[] = [];

    const validIncomes = incomes.filter((i) => (i.amount || 0) > 0 || (i.payment_amount || 0) > 0);

    for (const inc of validIncomes) {
      const key = inc.n_contract_type_id || UNCATEGORIZED;
      if (!map.has(key)) {
        map.set(key, {
          contractTypeId: inc.n_contract_type_id,
          contractTypeName: inc.contract_type_name || inc.type_display || "未分類",
          incomes: [],
          totalAmount: 0,
          totalPaid: 0,
          totalOutstanding: 0,
        });
        order.push(key);
      }
      const g = map.get(key)!;
      g.incomes.push(inc);
      g.totalAmount += inc.amount || 0;
      g.totalPaid += inc.payment_amount || 0;
      g.totalOutstanding += incomeNetOutstanding(inc);
    }

    const groups = order.map((k) => map.get(k)!);

    const totalAmount = validIncomes.reduce((s, i) => s + (i.amount || 0), 0);
    const totalPaid = validIncomes.reduce((s, i) => s + (i.payment_amount || 0), 0);
    const totalOutstanding = validIncomes.reduce((s, i) => s + incomeNetOutstanding(i), 0);
    const overdueCount = validIncomes.filter((i) => getDueStatus(i) === "overdue").length;
    const dueSoonCount = validIncomes.filter((i) => getDueStatus(i) === "due-soon").length;
    const paidCount = validIncomes.filter((i) => getDueStatus(i) === "paid").length;

    return {
      groups,
      stats: { totalAmount, totalPaid, totalOutstanding, overdueCount, dueSoonCount, paidCount, totalCount: validIncomes.length },
    };
  }, [incomes]);

  // ─── PRINT HANDLER ────────────────────────────────────
  const handlePrintSummary = () => {
    setIsPrintMode(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setIsPrintMode(false), 500);
    }, 300);
  };

  // Compute how many pages needed (each page has a header)
  const getPaymentStatusLabel = (income: BWAProjectIncome): string => {
    const status = getDueStatus(income);
    if (status === "paid") {
      const payDate = income.payment_date ? formatDateShort(income.payment_date) : "";
      return `已付 ${payDate}`;
    }
    return "未付款";
  };

  const getDaysRemainingLabel = (income: BWAProjectIncome): string => {
    const status = getDueStatus(income);
    if (status === "paid") return "/";
    const days = getDaysUntil(income.due_date);
    if (days === null) return "尚餘0天";
    if (days < 0) return `逾期${Math.abs(days)}天`;
    if (days === 0) return "尚餘0天";
    return `尚餘${days}天`;
  };

  // ─── PRINT VIEW (工程對數表) ─────────────────────────────
  const renderPrintOverlay = () => {
    if (!isPrintMode) return null;
    
    const companyName = costCentre?.display || "Acme Design Limited";
    const companyChineseName = costCentre?.chinese_display || "Acme 設計有限公司";
    const logo = costCentre?.business_logo;

    // Separate incomes into contract types
    const validIncomes = incomes.filter((i) => (i.amount || 0) > 0 || (i.payment_amount || 0) > 0);
    
    // Sort by amount descending within each group (matching PDF order pattern)
    const sortByAmountDesc = (a: BWAProjectIncome, b: BWAProjectIncome) => 
      (b.amount || 0) - (a.amount || 0);

    // Unpaid items for summary page
    const unpaidIncomes = validIncomes.filter((i) => {
      const s = getDueStatus(i);
      return s !== "paid";
    });
    const unpaidTotal = unpaidIncomes.reduce((s, i) => s + (i.amount || 0), 0);

    // Helper to render a print page header
    const PageHeader = ({ pageNum, totalPages }: { pageNum: number; totalPages: number }) => (
      <div className="flex justify-between items-start mb-6 border-b-2 border-gray-900 pb-4">
        <div>
          {logo && (
            <img src={logo} alt="Company Logo" className="h-10 w-auto object-contain mb-2" />
          )}
          <p className="text-[15px] font-semibold text-gray-900 leading-snug">{companyName}</p>
          <p className="text-[15px] text-gray-700 leading-snug">{companyChineseName}</p>
          <div className="mt-2 text-[13px] text-gray-600">
            <p className="font-medium">Bill To:</p>
            <p>{customerName || "-"}</p>
            {customerAddress && <p className="text-[12px] text-gray-500">{customerAddress}</p>}
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-black text-gray-900 tracking-wider mb-1">工程對數表</h2>
          <p className="text-[13px] text-gray-500">Project Invoice & Payment Summary</p>
          <table className="mt-3 text-[13px] ml-auto">
            <tbody>
              <tr>
                <td className="text-gray-500 pr-2 text-right">Project Manager:</td>
                <td className="font-medium text-gray-800 text-right">{pmName || "-"}</td>
              </tr>
              <tr>
                <td className="text-gray-500 pr-2 text-right">Project Code:</td>
                <td className="font-medium text-gray-800 text-right">{projectCode || "-"}</td>
              </tr>
              <tr>
                <td className="text-gray-500 pr-2 text-right">Project Name:</td>
                <td className="font-medium text-gray-800 text-right max-w-[180px] text-wrap">{projectName || "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );

    const PageFooter = ({ pageNum, totalPages }: { pageNum: number; totalPages: number }) => (
      <div className="flex justify-between items-center mt-8 pt-3 border-t border-gray-200 text-[12px] text-gray-400">
        <span>www.bwdesign.asia | (+852) 2127 4915</span>
        <span>第{pageNum}頁 | 共{totalPages}頁</span>
      </div>
    );

    // Print styles are in globals.css

    // Single-page layout for simplicity
    const overlayContent = (
      <div className="fixed inset-0 z-[9999] bg-gray-500/60 overflow-auto print:static print:bg-transparent print:overflow-visible print:inset-auto" style={{ marginLeft: 0, paddingTop: 0 }}>
        <div ref={printRef} className="bg-white p-6 max-w-[850px] mx-auto my-8 shadow-2xl print:p-4 print:my-0 print:shadow-none print:max-w-none" id="payment-summary-print">
        {/* Print styles are in globals.css */}

        {/* Close button (no-print) */}
        <div className="no-print flex items-center justify-between mb-4 bg-blue-50 p-3 rounded-lg">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span className="text-[15px] font-semibold text-blue-800">工程對數表預覽</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handlePrintSummary}>
              <Printer className="w-4 h-4" />
              列印
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsPrintMode(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ─── SINGLE-PAGE LAYOUT ─────────────────── */}
          <div>
            <PageHeader pageNum={1} totalPages={1} />

            {groups.map((group, gIdx) => {
              const groupTotal = group.totalAmount;
              const sortedIncomes = [...group.incomes].sort((a, b) => (b.amount || 0) - (a.amount || 0));

              return (
                <div key={group.contractTypeId || `group-${gIdx}`} className={`print-avoid-break ${gIdx > 0 ? "mt-6" : ""}`}>
                  {/* Section title & total */}
                  <div className="flex items-baseline justify-between mb-2">
                    <h3 className="text-[16px] font-black text-gray-900">
                      {group.contractTypeName}
                    </h3>
                    <p className="text-[14px] text-gray-500">
                      總額 <span className="font-bold font-mono text-gray-800 text-[16px] ml-1">{formatMoney2(groupTotal)}</span>
                    </p>
                  </div>

                  {/* Income table */}
                  <div className="rounded-t-md overflow-hidden">
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr>
                        <th className="py-1 px-2 text-left font-semibold text-white bg-gray-800">#</th>
                        <th className="py-1 px-2 text-right font-semibold text-white bg-gray-800">金額</th>
                        <th className="py-1 px-2 text-center font-semibold text-white bg-gray-800">發票號碼</th>
                        <th className="py-1 px-2 text-center font-semibold text-white bg-gray-800">發票日期</th>
                        <th className="py-1 px-2 text-center font-semibold text-white bg-gray-800">支票號碼</th>
                        <th className="py-1 px-2 text-center font-semibold text-white bg-gray-800">到期日</th>
                        <th className="py-1 px-2 text-center font-semibold text-white bg-gray-800">付款狀態</th>
                        <th className="py-1 px-2 text-center font-semibold text-white bg-gray-800">客人跟進</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedIncomes.map((income, idx) => {
                        const status = getDueStatus(income);
                        const isPaid = status === "paid";
                        return (
                          <tr key={income.id} className={`${idx % 2 === 1 ? "bg-gray-50" : ""}`}>
                            <td className="py-2 px-2 text-gray-600 border-b border-gray-100">
                              {formatProjectInvoiceRowHash(income)}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-medium text-gray-800 border-b border-gray-100">
                              {formatMoney2(income.amount)}
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-gray-600 border-b border-gray-100">
                              {formatIssuedInvoiceNumber(issuedByIncomeId[income.id])}
                            </td>
                            <td className="py-2 px-2 text-center text-gray-600 border-b border-gray-100">
                              {income.created_date ? formatDateFull(income.created_date) : ""}
                            </td>
                            <td className="py-2 px-2 text-center text-gray-500 border-b border-gray-100">N/A</td>
                            <td className="py-2 px-2 text-center text-gray-600 border-b border-gray-100">
                              {income.due_date ? formatDateFull(income.due_date) : ""}
                            </td>
                            <td className={`py-2 px-2 text-center font-medium border-b border-gray-100 ${
                              isPaid ? "text-emerald-700" : "text-red-600"
                            }`}>
                              {getPaymentStatusLabel(income)}
                            </td>
                            <td className="py-2 px-2 text-center text-gray-500 border-b border-gray-100">
                              {getDaysRemainingLabel(income)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>

                  {/* Group total row */}
                  <div className="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-gray-300">
                    <span className="text-[13px] text-gray-500 pl-2">總額</span>
                    <span className="text-[15px] font-bold font-mono text-gray-900 ml-2">
                      {formatMoney2(groupTotal)}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Unpaid summary section on same page */}
            {unpaidIncomes.length > 0 && (
              <div className="mt-8 print-avoid-break">
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-[16px] font-black text-gray-900">
                    Summary - 應付未付
                  </h3>
                  <p className="text-[14px] text-gray-500">
                    總額 <span className="font-bold font-mono text-gray-800 text-[16px] ml-1">{formatMoney2(unpaidTotal)}</span>
                  </p>
                </div>

                <div className="rounded-t-md overflow-hidden">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr>
                      <th className="py-1 px-2 text-left font-semibold text-white bg-gray-800">#</th>
                      <th className="py-1 px-2 text-right font-semibold text-white bg-gray-800">金額</th>
                      <th className="py-1 px-2 text-center font-semibold text-white bg-gray-800">發票號碼</th>
                      <th className="py-1 px-2 text-center font-semibold text-white bg-gray-800">發票日期</th>
                      <th className="py-1 px-2 text-center font-semibold text-white bg-gray-800">到期日</th>
                      <th className="py-1 px-2 text-center font-semibold text-white bg-gray-800">付款狀態</th>
                      <th className="py-1 px-2 text-center font-semibold text-white bg-gray-800">客人跟進</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidIncomes.map((income, idx) => {
                      return (
                        <tr key={income.id} className={`${idx % 2 === 1 ? "bg-gray-50" : ""}`}>
                          <td className="py-2 px-2 text-gray-600 border-b border-gray-100">
                            {formatProjectInvoiceRowHash(income)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-medium text-gray-800 border-b border-gray-100">
                            {formatMoney2(income.amount)}
                          </td>
                          <td className="py-2 px-2 text-center font-mono text-gray-600 border-b border-gray-100">
                            {formatIssuedInvoiceNumber(issuedByIncomeId[income.id])}
                          </td>
                          <td className="py-2 px-2 text-center text-gray-600 border-b border-gray-100">
                            {income.created_date ? formatDateFull(income.created_date) : ""}
                          </td>
                          <td className="py-2 px-2 text-center text-gray-600 border-b border-gray-100">
                            {income.due_date ? formatDateFull(income.due_date) : ""}
                          </td>
                          <td className="py-2 px-2 text-center font-medium text-red-600 border-b border-gray-100">
                            未付款
                          </td>
                          <td className="py-2 px-2 text-center text-gray-500 border-b border-gray-100">
                            {getDaysRemainingLabel(income)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>

                <div className="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-gray-300">
                  <span className="text-[13px] text-gray-500 pl-2">總額</span>
                  <span className="text-[15px] font-bold font-mono text-gray-900 ml-2">
                    {formatMoney2(unpaidTotal)}
                  </span>
                </div>
              </div>
            )}

            <PageFooter pageNum={1} totalPages={1} />
          </div>
        </div>
      </div>
    );

    // Render via portal to ensure it's above sidebar/header
    if (typeof document !== "undefined") {
      return createPortal(
        <div data-print-portal="">{overlayContent}</div>,
        document.body
      );
    }
    return overlayContent;
  };

  if (incomes.length === 0) {
    return (
      <Card className="border border-gray-100 shadow-sm">
        <CardContent className="py-16">
          <div className="flex flex-col items-center justify-center text-center">
            <CreditCard className="w-12 h-12 text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-400 mb-1">暫無收入記錄</p>
            <p className="text-xs text-gray-300">請先新增收入記錄以檢視收款進度</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Print overlay rendered via portal */}
      {renderPrintOverlay()}

      {/* fadeInUp animation is defined in globals.css */}

      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-1 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-md bg-blue-50 text-blue-500 flex-shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <h2 className="text-[16px] font-bold text-gray-900 whitespace-nowrap">收款時間表 Payment Schedule</h2>
            {projectCode && (
              <Badge variant="outline" className="text-[12px] font-mono text-gray-500 whitespace-nowrap">
                {projectCode}
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-[14px] border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 flex-shrink-0 whitespace-nowrap"
            onClick={() => setIsPrintMode(true)}
          >
            <Printer className="w-3.5 h-3.5" />
            工程對數表
          </Button>
        </div>
        <p className="text-[14px] text-gray-400 ml-9">按合約類型追蹤各筆收入的收款進度及到期提醒</p>
      </div>

      {/* Summary Card */}
      <Card className="border border-gray-100 shadow-sm bg-white">
        <CardContent className="py-4 px-5">
          <div className="flex items-start gap-6">
            {/* Left: KPI stats */}
            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <DollarSign className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[12px] text-gray-500">應收總額</span>
                  </div>
                  <p className="text-[16px] font-bold font-mono text-gray-800">{formatMoney(stats.totalAmount)}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[12px] text-gray-500">已收款</span>
                  </div>
                  <p className="text-[16px] font-bold font-mono text-emerald-600">{formatMoney(stats.totalPaid)}</p>
                </div>
                <div className={`rounded-lg p-3 ${stats.totalOutstanding > 0 ? "bg-red-50" : "bg-gray-50"}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Receipt className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-[12px] text-gray-500">待收款</span>
                  </div>
                  <p className={`text-[16px] font-bold font-mono ${stats.totalOutstanding > 0 ? "text-red-600" : "text-gray-400"}`}>
                    {formatMoney(stats.totalOutstanding)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-violet-500" />
                    <span className="text-[12px] text-gray-500">收入筆數</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[16px] font-bold font-mono text-gray-800">{stats.totalCount}</p>
                    <div className="flex gap-1">
                      {stats.overdueCount > 0 && (
                        <Badge className="bg-red-100 text-red-700 border-0 text-[11px] px-1.5 py-0">
                          {stats.overdueCount} 逾期
                        </Badge>
                      )}
                      {stats.dueSoonCount > 0 && (
                        <Badge className="bg-amber-100 text-amber-700 border-0 text-[11px] px-1.5 py-0">
                          {stats.dueSoonCount} 即將到期
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Overall progress */}
              <PaymentProgressBar paid={stats.totalPaid} total={stats.totalAmount} />
            </div>

            {/* Right: Donut */}
            <div className="flex-shrink-0 border-l border-gray-100 pl-6">
              <CollectionDonut
                paid={stats.totalPaid}
                total={stats.totalAmount}
                overdueCount={stats.overdueCount}
                dueSoonCount={stats.dueSoonCount}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Urgent alerts */}
      {stats.overdueCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[14px] font-semibold text-red-700">
              有 {stats.overdueCount} 筆收入已逾期未收款
            </p>
            <p className="text-[13px] text-red-600 mt-0.5">
              請儘快跟進處理逾期的收款項目，以維持公司現金流。
            </p>
          </div>
        </div>
      )}

      {stats.dueSoonCount > 0 && stats.overdueCount === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[14px] font-semibold text-amber-700">
              有 {stats.dueSoonCount} 筆收入將於 7 天內到期
            </p>
            <p className="text-[13px] text-amber-600 mt-0.5">
              建議提前安排收款事宜，確保款項按時入帳。
            </p>
          </div>
        </div>
      )}

      {/* Main layout: groups + timeline */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Contract group sections */}
        <div className="xl:col-span-2 space-y-6">
          {groups.map((group) => (
            <ContractGroupSection
              key={group.contractTypeId || "uncategorized"}
              group={group}
              onIncomeClick={_canEdit ? onIncomeClick : undefined}
            />
          ))}
        </div>

        {/* Timeline sidebar */}
        <div className="space-y-4">
          <PaymentTimeline incomes={incomes} />
        </div>
      </div>
    </div>
  );
}
