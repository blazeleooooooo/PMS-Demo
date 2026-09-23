"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { handleNavClick } from "@/lib/nav-click";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Tag,
  FileText,
  DollarSign,
  FolderOpen,
  TrendingUp,
  BarChart3,
  Users,
  Calendar,
  Loader2,
  Edit2,
  Merge,
  Volume2,
  Briefcase,
  Star,
  Clock,
  Image as ImageIcon} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProjectStatusBadge } from "@/components/ui/entity-status-badges";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  fetchCustomerDetail,
  fetchCustomerMergeSource,
  type CustomerDetailData,
  type CustomerMergeSource,
  type CustomerProjectRow,
  type CustomerPitchingRow} from "@/lib/data-service";
import CustomerTagsPanel from "@/components/clients/CustomerTagsPanel";
import CustomerDocumentsPanel from "@/components/clients/CustomerDocumentsPanel";
import { customerStatusFilterLabel } from "@/lib/customer-status";
import {
  customerRecordStatusBadgeClass,
  customerRecordStatusLabel,
} from "@/lib/customer-record-status";
import CustomerEditDialog from "@/components/clients/CustomerEditDialog";
import CustomerMergeDialog from "@/components/clients/CustomerMergeDialog";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { formatDate } from "@/lib/date-utils";


function getPitchingStageColor(stage: string | null): string {
  if (!stage) return "bg-gray-100 text-gray-500";
  const s = stage.toLowerCase();
  if (s.includes("won") || s.includes("成功")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s.includes("lost") || s.includes("失敗")) return "bg-red-50 text-red-600 border-red-200";
  if (s.includes("progress") || s.includes("進行")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (s.includes("close") || s.includes("結束")) return "bg-gray-100 text-gray-500 border-gray-200";
  return "bg-amber-50 text-amber-600 border-amber-200";
}

// ─── STAT CARD ─────────────────────────────────────────
function FinancialCard({
  label,
  value,
  subLabel,
  color,
  icon: Icon}: {
  label: string;
  value: string;
  subLabel?: string;
  color: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] text-gray-500 truncate">{label}</p>
          <p className="text-lg font-bold text-gray-900 font-mono-num">{value}</p>
          {subLabel && <p className="text-[13px] text-gray-400">{subLabel}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── INFO ROW ─────────────────────────────────────────
function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-b-0">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm text-gray-800">{value || <span className="text-gray-300 italic">N/A</span>}</p>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────
export default function CustomerDetail({ customerId }: { customerId: string }) {
  const { formatMoney } = useFinancialFormat();
  const router = useRouter();
  const { canEdit, canDelete, loading: permLoading } = usePermission();
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<CustomerDetailData | null>(null);
  const [projects, setProjects] = useState<CustomerProjectRow[]>([]);
  const [pitchings, setPitchings] = useState<CustomerPitchingRow[]>([]);
  const [bwaProjects, setBwaProjects] = useState<CustomerProjectRow[]>([]);
  const [bwfProjects, setBwfProjects] = useState<CustomerProjectRow[]>([]);
  const [bwaPitchings, setBwaPitchings] = useState<CustomerPitchingRow[]>([]);
  const [bwfPitchings, setBwfPitchings] = useState<CustomerPitchingRow[]>([]);
  const [activeTab, setActiveTab] = useState("bwa-pitchings");

  // ─── EDIT / MERGE DIALOG STATE ──────────────────────────
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeSource, setMergeSource] = useState<CustomerMergeSource | null>(null);
  const [loadingMergeSource, setLoadingMergeSource] = useState(false);

  const handleOpenEdit = () => {
    if (!customer) return;
    setShowEditDialog(true);
  };

  const handleOpenMerge = async () => {
    setLoadingMergeSource(true);
    try {
      const source = await fetchCustomerMergeSource(customerId);
      if (!source) return;
      setMergeSource(source);
      setShowMergeDialog(true);
    } finally {
      setLoadingMergeSource(false);
    }
  };

  const handleEditSaved = async () => {
    // Reload customer data after save
    const refreshed = await fetchCustomerDetail(customerId);
    setCustomer(refreshed.customer);
    setProjects(refreshed.projects);
    setPitchings(refreshed.pitchings);
    setBwaProjects(refreshed.bwaProjects);
    setBwfProjects(refreshed.bwfProjects);
    setBwaPitchings(refreshed.bwaPitchings);
    setBwfPitchings(refreshed.bwfPitchings);
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      const result = await fetchCustomerDetail(customerId);
      setCustomer(result.customer);
      setProjects(result.projects);
      setPitchings(result.pitchings);
      setBwaProjects(result.bwaProjects);
      setBwfProjects(result.bwfProjects);
      setBwaPitchings(result.bwaPitchings);
      setBwfPitchings(result.bwfPitchings);
      setLoading(false);
    }
    load();
  }, [customerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-bw-blue mr-2" />
        <span className="text-gray-500">載入客戶資料中...</span>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-32">
        <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-lg">找不到此客戶</p>
        <Button variant="outline" className="mt-4" onClick={(e) => handleNavClick("/clients", e, (href) => router.push(href))}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> 返回客戶列表
        </Button>
      </div>
    );
  }

  const displayName = customer.display_name || customer.customer_name || "未命名客戶";

  // Financial computed values
  // income = actual paid (payment_amount); receivable = expected/invoiced (income_amount)
  // profit = receivable - expenses; outstanding = receivable - income (invoiced minus paid)
  const totalIncome = (customer.bwa_income || 0) + (customer.bwf_income || 0);
  const totalProfit = (customer.bwa_profit || 0) + (customer.bwf_profit || 0);
  const totalReceivable = (customer.bwa_receivable || 0) + (customer.bwf_receivable || 0);
  const totalOutstanding = totalReceivable - totalIncome; // invoiced but not yet paid
  const totalProjects = (customer.bwa_project_number || 0) + (customer.bwf_project_number || 0);
  const totalPitchings = (customer.bwa_pitching_number || 0) + (customer.bwf_pitching_no || 0);
  // Margin % = profit / receivable (since profit = receivable - expenses)
  const marginPercent = totalReceivable > 0 ? ((totalProfit / totalReceivable) * 100).toFixed(1) : "-";

  return (
    <div className="space-y-6">
      {/* ─── Header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => handleNavClick("/clients", e, (href) => router.push(href))}
            className="text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> 返回
          </Button>
          <div className="h-6 w-px bg-gray-200" />
          <div className="flex items-center gap-3">
            {/* Branding Icon in header */}
            {customer.branding_icon && (
              <div className="w-11 h-11 rounded-lg border border-gray-200 bg-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src={customer.branding_icon}
                  alt="Brand"
                  className="w-9 h-9 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).parentElement!.style.display = "none";
                  }}
                />
              </div>
            )}
            <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
              {customer.view_system && (
                <Badge
                  variant="outline"
                  className={
                    customer.view_system === "BWA" || customer.view_system === "PMS"
                      ? "border-bw-blue/30 text-bw-blue bg-bw-blue/5"
                      : customer.view_system === "BWF" || customer.view_system === "BWF2"
                      ? "border-bw-amber/30 text-bw-amber bg-bw-amber/5"
                      : customer.view_system === "Both" ||
                        customer.view_system === "PMS,BWF2" ||
                        customer.view_system === "BWF2,PMS"
                      ? "border-violet-200 text-violet-600 bg-violet-50"
                      : "border-gray-200 text-gray-500"
                  }
                >
                  {customer.view_system === "PMS"
                    ? "BWA"
                    : customer.view_system === "BWF2"
                    ? "BWF"
                    : customer.view_system === "PMS,BWF2" || customer.view_system === "BWF2,PMS"
                    ? "Both"
                    : customer.view_system}
                </Badge>
              )}
              <Badge
                variant="outline"
                className={customerRecordStatusBadgeClass(customer.status)}
              >
                {customerRecordStatusLabel(customer.status)}
              </Badge>
            </div>
            {customer.company_name && (
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                <Building2 className="w-3.5 h-3.5" /> {customer.company_name}
              </p>
            )}
           </div>
          </div>
        </div>
        {canEdit("clients") && (
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => void handleOpenMerge()}
                    disabled={loadingMergeSource}
                    aria-label="合併客戶"
                  >
                    {loadingMergeSource ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Merge className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">合併客戶 Merge customers</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button variant="outline" size="sm" onClick={handleOpenEdit}>
              <Edit2 className="w-4 h-4 mr-1.5" /> 編輯
            </Button>
          </div>
        )}
      </div>

      {/* ─── Financial Summary (8 cards) ──────────────────── */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-bw-blue" />
          財政 Financials
        </h2>
        {/* Row 1: BWA */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <FinancialCard
            icon={Briefcase}
            label="BWA Pitching"
            value={String(customer.bwa_pitching_number || 0)}
            color="bg-bw-blue"
          />
          <FinancialCard
            icon={FolderOpen}
            label="BWA 項目"
            value={String(customer.bwa_project_number || 0)}
            color="bg-bw-blue"
          />
          <FinancialCard
            icon={DollarSign}
            label="BWA 簽帳額"
            value={formatMoney(customer.bwa_receivable)}
            color="bg-bw-blue"
          />
          <FinancialCard
            icon={DollarSign}
            label="BWA 已收款"
            value={formatMoney(customer.bwa_income)}
            color="bg-bw-blue"
          />
          <FinancialCard
            icon={TrendingUp}
            label="BWA 毛利"
            value={formatMoney(customer.bwa_profit)}
            subLabel={customer.bwa_receivable && customer.bwa_profit
              ? `毛利率 ${((customer.bwa_profit / customer.bwa_receivable) * 100).toFixed(1)}%`
              : undefined}
            color="bg-bw-blue"
          />
        </div>
        {/* Row 2: BWF */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
          <FinancialCard
            icon={Briefcase}
            label="BWF Pitching"
            value={String(customer.bwf_pitching_no || 0)}
            color="bg-bw-amber"
          />
          <FinancialCard
            icon={FolderOpen}
            label="BWF 項目"
            value={String(customer.bwf_project_number || 0)}
            color="bg-bw-amber"
          />
          <FinancialCard
            icon={DollarSign}
            label="BWF 簽帳額"
            value={formatMoney(customer.bwf_receivable)}
            color="bg-bw-amber"
          />
          <FinancialCard
            icon={DollarSign}
            label="BWF 已收款"
            value={formatMoney(customer.bwf_income)}
            color="bg-bw-amber"
          />
          <FinancialCard
            icon={TrendingUp}
            label="BWF 毛利"
            value={formatMoney(customer.bwf_profit)}
            subLabel={customer.bwf_receivable && customer.bwf_profit
              ? `毛利率 ${((customer.bwf_profit / customer.bwf_receivable) * 100).toFixed(1)}%`
              : undefined}
            color="bg-bw-amber"
          />
        </div>
        {/* Row 3: Total (BWA + BWF) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
          <FinancialCard
            icon={Briefcase}
            label="Pitching 總數"
            value={String(totalPitchings)}
            color="bg-bw-violet"
          />
          <FinancialCard
            icon={FolderOpen}
            label="項目總數"
            value={String(totalProjects)}
            color="bg-bw-violet"
          />
          <FinancialCard
            icon={BarChart3}
            label="總簽帳額"
            value={formatMoney(totalReceivable)}
            color="bg-bw-violet"
          />
          <FinancialCard
            icon={DollarSign}
            label="總已收款"
            value={formatMoney(totalIncome)}
            color="bg-bw-violet"
          />
          <FinancialCard
            icon={TrendingUp}
            label="總毛利"
            value={formatMoney(totalProfit)}
            subLabel={marginPercent !== "-" ? `毛利率 ${marginPercent}%` : undefined}
            color="bg-bw-violet"
          />
        </div>
      </div>

      {/* ─── Info Panels (2-column) ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: General Info + Brand Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Information */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-bw-violet" />
              基本資訊 General Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <InfoRow icon={Users} label="客戶名稱" value={customer.customer_name} />
              <InfoRow icon={Users} label="顯示名稱" value={customer.display_name} />
              <InfoRow icon={Building2} label="公司名稱" value={customer.company_name} />
              <InfoRow icon={Mail} label="電郵" value={customer.email} />
              <InfoRow icon={Phone} label="電話" value={customer.phone_display || customer.phone_number_a} />
              {customer.phone_number_b && (
                <InfoRow icon={Phone} label="電話 B" value={customer.phone_number_b} />
              )}
              <InfoRow icon={MapPin} label="地址" value={customer.address} />
            </div>
          </div>

          {/* Brand Information */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-bw-amber" />
              品牌資訊 Brand Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <InfoRow icon={Tag} label="品牌 (中文)" value={customer.brand_name_cn} />
              <InfoRow icon={Tag} label="品牌 (English)" value={customer.brand_name_en} />
            </div>
            {/* Branding Icon */}
            {customer.branding_icon && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-[14px] text-gray-400 mb-2 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" /> 品牌標誌 Branding Icon
                </p>
                <div className="inline-block border border-gray-200 rounded-lg p-2 bg-gray-50">
                  <img
                    src={customer.branding_icon}
                    alt="Branding Icon"
                    className="h-16 w-auto object-contain rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <CustomerDocumentsPanel customerId={customer.id} permissionModule="clients" />
        </div>

        {/* Right: Company Info + Tags + Meta */}
        <div className="space-y-6">
          {/* System & Status */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-bw-teal" />
              公司資訊 Company Information
            </h2>
            <InfoRow
              icon={Tag}
              label="系統"
              value={
                customer.view_system === "PMS"
                  ? "BWA"
                  : customer.view_system === "BWF2"
                  ? "BWF"
                  : customer.view_system === "PMS,BWF2" || customer.view_system === "BWF2,PMS"
                  ? "Both"
                  : customer.view_system
              }
            />
            <InfoRow icon={Tag} label="帳戶狀態" value={customerRecordStatusLabel(customer.status)} />
            <InfoRow icon={Tag} label="階段" value={customerStatusFilterLabel(customer.status_filter_value)} />
            <InfoRow icon={Users} label="建立者" value={customer.real_created_by_name} />
            <InfoRow icon={Calendar} label="建立日期" value={formatDate(customer.created_date)} />
            <InfoRow icon={Clock} label="最後修改" value={formatDate(customer.modified_date)} />
          </div>

          {/* Customer Tags — Interactive Panel */}
          <CustomerTagsPanel customerId={customer.id} />

          {/* Remark */}
          {customer.remark && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                備註
              </h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{customer.remark}</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Projects & Pitchings Tabs ────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="px-5 pt-4 pb-0 border-b border-gray-100">
            <TabsList className="bg-transparent p-0 h-auto gap-4">
              <TabsTrigger
                value="bwa-pitchings"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-bw-blue rounded-none pb-2.5 px-1 text-sm font-medium"
              >
                <Volume2 className="w-4 h-4 mr-1.5" />
                BWA 提案
                <Badge variant="secondary" className="ml-2 text-xs">
                  {bwaPitchings.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="bwa-projects"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-bw-blue rounded-none pb-2.5 px-1 text-sm font-medium"
              >
                <FolderOpen className="w-4 h-4 mr-1.5" />
                BWA 項目
                <Badge variant="secondary" className="ml-2 text-xs">
                  {bwaProjects.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="bwf-pitchings"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-bw-amber rounded-none pb-2.5 px-1 text-sm font-medium"
              >
                <Volume2 className="w-4 h-4 mr-1.5" />
                BWF 提案
                <Badge variant="secondary" className="ml-2 text-xs">
                  {bwfPitchings.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="bwf-projects"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-bw-amber rounded-none pb-2.5 px-1 text-sm font-medium"
              >
                <FolderOpen className="w-4 h-4 mr-1.5" />
                BWF 項目
                <Badge variant="secondary" className="ml-2 text-xs">
                  {bwfProjects.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ─── BWA Projects Table ───────────────────────── */}
          <TabsContent value="bwa-projects" className="m-0">
            {bwaProjects.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>暫無 BWA 項目記錄</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead>項目編號</TableHead>
                      <TableHead>項目名稱</TableHead>
                      <TableHead>PM</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead className="text-right">簽帳額</TableHead>
                      <TableHead className="text-right">已收款</TableHead>
                      <TableHead>實用面積</TableHead>
                      <TableHead>簽約日期</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bwaProjects.map((p) => (
                      <TableRow
                        key={p.id}
                        className="group hover:bg-blue-50/30 transition-colors cursor-pointer border-l-2 border-l-bw-blue"
                        onClick={() => window.open(`/projects/bwa/${p.id}`, "_blank", "noopener")}
                      >
                        <TableCell className="font-mono text-xs text-gray-600">
                          {p.project_code || "-"}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-gray-900 group-hover:text-bw-blue transition-colors text-sm">
                            {p.project_name || "未命名"}
                          </p>
                          {p.site_address && (
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {p.site_address}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {p.pm_name || <span className="text-gray-300 italic">N/A</span>}
                        </TableCell>
                        <TableCell>
                          <ProjectStatusBadge status={p.status} className="text-xs" />
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatMoney(p.income_total)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatMoney(p.payment_total)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {p.actual_size || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDate(p.signed_date)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ─── BWF Projects Table ───────────────────────── */}
          <TabsContent value="bwf-projects" className="m-0">
            {bwfProjects.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>暫無 BWF 項目記錄</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead>項目編號</TableHead>
                      <TableHead>項目名稱</TableHead>
                      <TableHead>PM</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead className="text-right">簽帳額</TableHead>
                      <TableHead className="text-right">已收款</TableHead>
                      <TableHead>面積</TableHead>
                      <TableHead>簽約日期</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bwfProjects.map((p) => (
                      <TableRow
                        key={p.id}
                        className="group hover:bg-amber-50/30 transition-colors cursor-pointer border-l-2 border-l-bw-amber"
                        onClick={() => window.open(`/bwf/projects/${p.id}`, "_blank", "noopener")}
                      >
                        <TableCell className="font-mono text-xs text-gray-600">
                          {p.project_code || "-"}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-gray-900 group-hover:text-bw-amber transition-colors text-sm">
                            {p.project_name || "未命名"}
                          </p>
                          {p.site_address && (
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {p.site_address}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {p.pm_name || <span className="text-gray-300 italic">N/A</span>}
                        </TableCell>
                        <TableCell>
                          <ProjectStatusBadge status={p.status} className="text-xs" />
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatMoney(p.income_total)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatMoney(p.payment_total)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {p.size || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDate(p.signed_date)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ─── BWA Pitchings Table ──────────────────────── */}
          <TabsContent value="bwa-pitchings" className="m-0">
            {bwaPitchings.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Volume2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>暫無 BWA 提案記錄</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead>競標編號</TableHead>
                      <TableHead>描述</TableHead>
                      <TableHead>PM</TableHead>
                      <TableHead>階段</TableHead>
                      <TableHead className="text-right">預計收入</TableHead>
                      <TableHead>實用面積</TableHead>
                      <TableHead>查詢日期</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bwaPitchings.map((p) => (
                      <TableRow
                        key={p.id}
                        className="group hover:bg-blue-50/30 transition-colors cursor-pointer border-l-2 border-l-bw-blue"
                        onClick={() => window.open(`/proposals/${p.id}`, "_blank", "noopener")}
                      >
                        <TableCell className="font-mono text-xs text-gray-600">
                          {p.pitching_code || "-"}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-gray-900 group-hover:text-bw-blue transition-colors">
                            {p.description || displayName}
                          </p>
                          {p.site_address && (
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {p.site_address}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {p.pm_name || <span className="text-gray-300 italic">N/A</span>}
                        </TableCell>
                        <TableCell>
                          {p.pitching_stages ? (
                            <Badge
                              variant="outline"
                              className={`text-xs ${getPitchingStageColor(p.pitching_stages)}`}
                            >
                              {p.pitching_stages}
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-300">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatMoney(p.estimated_income)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {p.actual_size || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDate(p.enquiry_date)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ─── BWF Pitchings Table ──────────────────────── */}
          <TabsContent value="bwf-pitchings" className="m-0">
            {bwfPitchings.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Volume2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>暫無 BWF 提案記錄</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead>競標編號</TableHead>
                      <TableHead>提案名稱</TableHead>
                      <TableHead>PM</TableHead>
                      <TableHead>階段</TableHead>
                      <TableHead className="text-right">預計收入</TableHead>
                      <TableHead>面積</TableHead>
                      <TableHead>查詢日期</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bwfPitchings.map((p) => (
                      <TableRow
                        key={p.id}
                        className="group hover:bg-amber-50/30 transition-colors cursor-pointer border-l-2 border-l-bw-amber"
                        onClick={() => window.open(`/bwf/proposals/${p.id}`, "_blank", "noopener")}
                      >
                        <TableCell className="font-mono text-xs text-gray-600">
                          {p.pitching_code || "-"}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-gray-900 group-hover:text-bw-amber transition-colors">
                            {p.pitching_name || p.description || displayName}
                          </p>
                          {p.site_address && (
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {p.site_address}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {p.pm_name || <span className="text-gray-300 italic">N/A</span>}
                        </TableCell>
                        <TableCell>
                          {p.pitching_stages ? (
                            <Badge
                              variant="outline"
                              className={`text-xs ${getPitchingStageColor(p.pitching_stages)}`}
                            >
                              {p.pitching_stages}
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-300">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatMoney(p.estimated_income)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {p.size || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDate(p.enquiry_date)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── EDIT DIALOG (shared component) ──────────────────────────────── */}
      <CustomerEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        customer={customer}
        onSaved={handleEditSaved}
      />

      {mergeSource && (
        <CustomerMergeDialog
          open={showMergeDialog}
          onOpenChange={(open) => {
            setShowMergeDialog(open);
            if (!open) setMergeSource(null);
          }}
          currentCustomer={mergeSource}
        />
      )}
    </div>
  );
}
