"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { handleNavClick } from "@/lib/nav-click";
import {
  ArrowLeft,
  Truck,
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
  Star,
  Clock,
  Globe,
  Briefcase,
  Award,
  Hash,
  Package,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fetchSupplierDetail,
  type SupplierDetailData,
} from "@/lib/data-service";
import SupplierEditDialog from "@/components/suppliers/SupplierEditDialog";
import SupplierMergeDialog from "@/components/suppliers/SupplierMergeDialog";
import SupplierTagsPanel from "@/components/suppliers/SupplierTagsPanel";
import SupplierDetailTabs from "@/components/suppliers/SupplierDetailTabs";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { formatDate, isDatePast, parseDate } from "@/lib/date-utils";
import { AsanaIcon } from "@/components/ui/asana-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function getLevelColor(level: string | null): string {
  if (!level) return "bg-gray-100 text-gray-500";
  const l = level.toLowerCase();
  if (l.includes("a") || l.includes("gold") || l.includes("premium"))
    return "bg-amber-50 text-amber-700 border-amber-200";
  if (l.includes("b") || l.includes("silver"))
    return "bg-blue-50 text-blue-700 border-blue-200";
  if (l.includes("c") || l.includes("bronze"))
    return "bg-orange-50 text-orange-600 border-orange-200";
  return "bg-gray-50 text-gray-600 border-gray-200";
}

function getStatusColor(status: string | null): string {
  if (!status) return "bg-gray-100 text-gray-500";
  const s = status.toLowerCase();
  if (s.includes("active") || s.includes("啟用"))
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s.includes("inactive") || s.includes("停用"))
    return "bg-red-50 text-red-600 border-red-200";
  if (s.includes("pending") || s.includes("待"))
    return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-gray-50 text-gray-600 border-gray-200";
}

function isExpirySoon(dateStr: string | null | undefined, days = 30): boolean {
  if (!dateStr || isDatePast(dateStr)) return false;
  const expiry = parseDate(dateStr);
  if (!expiry) return false;
  const limit = new Date();
  limit.setDate(limit.getDate() + days);
  limit.setHours(23, 59, 59, 999);
  return expiry <= limit;
}

function getDocExpiryBadgeClass(expiry: string | null): string {
  if (!expiry) return "bg-gray-50 text-gray-500 border-gray-200";
  if (isDatePast(expiry)) return "bg-red-50 text-red-600 border-red-200";
  if (isExpirySoon(expiry)) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-sky-50 text-sky-700 border-sky-200";
}

function DocExpiryBadge({
  label,
  fullLabel,
  expiry,
}: {
  label: string;
  fullLabel: string;
  expiry: string | null;
}) {
  const dateText = expiry ? formatDate(expiry) : "未上傳";
  const statusHint = !expiry
    ? "尚未上傳"
    : isDatePast(expiry)
      ? "已過期"
      : isExpirySoon(expiry)
        ? "即將到期"
        : "有效";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`${getDocExpiryBadgeClass(expiry)} text-xs font-normal cursor-default`}
          >
            <span className="font-medium mr-1">{label}</span>
            {dateText}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {fullLabel} · 最新到期日 · {statusHint}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── STAT CARD ─────────────────────────────────────────
function FinancialCard({
  label,
  value,
  subLabel,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  subLabel?: string;
  color: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}
        >
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
function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-b-0">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm text-gray-800">
          {value || <span className="text-gray-300 italic">N/A</span>}
        </p>
      </div>
    </div>
  );
}

// ─── CONTACT CARD ─────────────────────────────────────
function ContactCard({
  title,
  engName,
  chnName,
  phone,
  jobTitle,
  nameCardUrl,
}: {
  title: string;
  engName: string | null;
  chnName: string | null;
  phone: string | null;
  jobTitle: string | null;
  nameCardUrl?: string | null;
}) {
  const hasData = engName || chnName || phone || jobTitle || nameCardUrl;
  if (!hasData) return null;

  return (
    <div className="bg-gray-50/50 rounded-lg p-4 border border-gray-100">
      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
        {title}
      </h3>
      {(engName || chnName) && (
        <p className="text-sm font-medium text-gray-900">
          {engName}
          {chnName && engName ? ` (${chnName})` : chnName || ""}
        </p>
      )}
      {jobTitle && <p className="text-xs text-gray-500 mt-0.5">{jobTitle}</p>}
      {phone && (
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
          <Phone className="w-3 h-3" /> {phone}
        </p>
      )}
      {nameCardUrl && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-[13px] text-gray-400 mb-1.5 font-medium">名片 Name Card</p>
          <a href={nameCardUrl} target="_blank" rel="noopener noreferrer" className="block">
            <img
              src={nameCardUrl}
              alt={`${title} name card`}
              className="w-full max-w-[200px] h-auto rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            />
          </a>
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────
export default function SupplierDetail({
  supplierId,
}: {
  supplierId: string;
}) {
  const { formatMoney } = useFinancialFormat();
  const router = useRouter();
  const { canEdit, canDelete } = usePermission();
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<SupplierDetailData | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);

  const loadSupplier = async () => {
    setLoading(true);
    const result = await fetchSupplierDetail(supplierId);
    setSupplier(result);
    setLoading(false);
  };

  useEffect(() => {
    loadSupplier();
  }, [supplierId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-bw-blue mr-2" />
        <span className="text-gray-500">載入供應商資料中...</span>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="text-center py-32">
        <Truck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-lg">找不到此供應商</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={(e) => handleNavClick("/suppliers", e, (href) => router.push(href))}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> 返回供應商列表
        </Button>
      </div>
    );
  }

  const displayName =
    supplier.display_name || supplier.name || supplier.chinese_name || "未命名供應商";

  // Financial computed values (from expense aggregates)
  const paidPercent =
    supplier.amount && supplier.amount > 0 && supplier.paid != null
      ? ((supplier.paid / supplier.amount) * 100).toFixed(1)
      : null;
  const bwaPaidPercent =
    supplier.bwa_amount && supplier.bwa_amount > 0 && supplier.bwa_paid != null
      ? ((supplier.bwa_paid / supplier.bwa_amount) * 100).toFixed(1)
      : null;
  const bwfPaidPercent =
    supplier.bwf_amount && supplier.bwf_amount > 0 && supplier.bwf_paid != null
      ? ((supplier.bwf_paid / supplier.bwf_amount) * 100).toFixed(1)
      : null;

  // Contact 1 full name
  const contact1EngName = [
    supplier.contact1_eng_givenname,
    supplier.contact1_eng_surname,
  ]
    .filter(Boolean)
    .join(" ");
  const contact1ChnName = [
    supplier.contact1_chn_surname,
    supplier.contact1_chn_given_name,
  ]
    .filter(Boolean)
    .join("");

  // Contact 2 full name
  const contact2EngName = [
    supplier.contact2_eng_givenname,
    supplier.contact2_eng_surname,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-6">
      {/* ─── Header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => handleNavClick("/suppliers", e, (href) => router.push(href))}
            className="text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> 返回
          </Button>
          <div className="h-6 w-px bg-gray-200" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">
                {displayName}
              </h1>
              {supplier.real_level && (
                <Badge
                  variant="outline"
                  className={`${getLevelColor(supplier.real_level)} text-xs`}
                >
                  <Star className="w-3 h-3 mr-0.5" /> {supplier.real_level}
                </Badge>
              )}
              {supplier.status && (
                <Badge
                  variant="outline"
                  className={`${getStatusColor(supplier.status)} text-xs`}
                >
                  {supplier.status}
                </Badge>
              )}
              <DocExpiryBadge
                label="勞保"
                fullLabel="勞工保險"
                expiry={supplier.labour_insurance_expiry_date}
              />
              <DocExpiryBadge
                label="BR"
                fullLabel="商業登記"
                expiry={supplier.br_expiry_date}
              />
            </div>
            {supplier.chinese_name && supplier.chinese_name !== displayName && (
              <p className="text-sm text-gray-500 mt-0.5">
                {supplier.chinese_name}
              </p>
            )}
            {(supplier.n_type_names && supplier.n_type_names.length > 0) ? (
              <div className="flex flex-wrap items-center gap-1 mt-1">
                <Tag className="w-3 h-3 text-gray-400" />
                {supplier.n_type_names.map((typeName, idx) => (
                  <span key={idx} className="inline-flex items-center bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                    {typeName}
                  </span>
                ))}
              </div>
            ) : supplier.n_type_name ? (
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <Tag className="w-3 h-3" /> {supplier.n_type_name}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {supplier.asana_link && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={supplier.asana_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <AsanaIcon size={18} />
                  </a>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">開啟 Asana</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {canEdit("suppliers") && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setShowMergeDialog(true)}
                      aria-label="合併供應商"
                    >
                      <Merge className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">合併供應商 Merge suppliers</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
                <Edit2 className="w-4 h-4 mr-1.5" /> 編輯
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ─── Financial Summary (Total / BWA / BWF) ───────── */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-bw-blue" />
          財政摘要 Financial Summary
        </h2>
        {/* Row 1: Total (BWA + BWF from expenses) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <FinancialCard
            icon={DollarSign}
            label="總金額"
            value={formatMoney(supplier.amount, { showZero: true })}
            color="bg-bw-violet"
          />
          <FinancialCard
            icon={TrendingUp}
            label="已付金額"
            value={formatMoney(supplier.paid, { showZero: true })}
            subLabel={paidPercent ? `${paidPercent}% 已付` : undefined}
            color="bg-emerald-500"
          />
          <FinancialCard
            icon={BarChart3}
            label="欠款金額"
            value={formatMoney(supplier.outstanding, { showZero: true })}
            subLabel={
              supplier.outstanding && supplier.outstanding > 0
                ? "Outstanding"
                : undefined
            }
            color={
              supplier.outstanding && supplier.outstanding > 0
                ? "bg-bw-red"
                : "bg-gray-400"
            }
          />
          <FinancialCard
            icon={FolderOpen}
            label="總項目數"
            value={String(supplier.project_number || 0)}
            color="bg-bw-violet"
          />
          <FinancialCard
            icon={Package}
            label="近12月項目"
            value={String(supplier.past_12_project || 0)}
            color="bg-bw-violet"
          />
          <FinancialCard
            icon={Layers}
            label="近6月項目"
            value={String(supplier.past_6_project || 0)}
            color="bg-bw-violet"
          />
        </div>
        {/* Row 2: BWA */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
          <FinancialCard
            icon={DollarSign}
            label="BWA 總金額"
            value={formatMoney(supplier.bwa_amount, { showZero: true })}
            color="bg-bw-blue"
          />
          <FinancialCard
            icon={TrendingUp}
            label="BWA 已付金額"
            value={formatMoney(supplier.bwa_paid, { showZero: true })}
            subLabel={bwaPaidPercent ? `${bwaPaidPercent}% 已付` : undefined}
            color="bg-bw-blue"
          />
          <FinancialCard
            icon={BarChart3}
            label="BWA 欠款金額"
            value={formatMoney(supplier.bwa_outstanding, { showZero: true })}
            color="bg-bw-blue"
          />
          <FinancialCard
            icon={FolderOpen}
            label="BWA 總項目數"
            value={String(supplier.bwa_project_number || 0)}
            color="bg-bw-blue"
          />
          <FinancialCard
            icon={Package}
            label="BWA 近12月項目"
            value={String(supplier.bwa_past_12_project || 0)}
            color="bg-bw-blue"
          />
          <FinancialCard
            icon={Layers}
            label="BWA 近6月項目"
            value={String(supplier.bwa_past_6_project || 0)}
            color="bg-bw-blue"
          />
        </div>
        {/* Row 3: BWF */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
          <FinancialCard
            icon={DollarSign}
            label="BWF 總金額"
            value={formatMoney(supplier.bwf_amount, { showZero: true })}
            color="bg-bw-amber"
          />
          <FinancialCard
            icon={TrendingUp}
            label="BWF 已付金額"
            value={formatMoney(supplier.bwf_paid, { showZero: true })}
            subLabel={bwfPaidPercent ? `${bwfPaidPercent}% 已付` : undefined}
            color="bg-bw-amber"
          />
          <FinancialCard
            icon={BarChart3}
            label="BWF 欠款金額"
            value={formatMoney(supplier.bwf_outstanding, { showZero: true })}
            color="bg-bw-amber"
          />
          <FinancialCard
            icon={FolderOpen}
            label="BWF 總項目數"
            value={String(supplier.bwf_project_number || 0)}
            color="bg-bw-amber"
          />
          <FinancialCard
            icon={Package}
            label="BWF 近12月項目"
            value={String(supplier.bwf_past_12_project || 0)}
            color="bg-bw-amber"
          />
          <FinancialCard
            icon={Layers}
            label="BWF 近6月項目"
            value={String(supplier.bwf_past_6_project || 0)}
            color="bg-bw-amber"
          />
        </div>
      </div>

      {/* ─── Info Panels (3-column) ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: General Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Information */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4 text-bw-blue" />
              基本資訊 General Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <InfoRow icon={Truck} label="供應商名稱" value={supplier.name} />
              <InfoRow
                icon={Truck}
                label="顯示名稱"
                value={supplier.display_name}
              />
              <InfoRow
                icon={Truck}
                label="中文名稱"
                value={supplier.chinese_name}
              />
              <InfoRow icon={Mail} label="電郵" value={supplier.email} />
              <InfoRow icon={Phone} label="電話" value={supplier.phone} />
              <InfoRow icon={Phone} label="傳真" value={supplier.fax_no} />
              <InfoRow icon={MapPin} label="地址" value={supplier.address} />
              <InfoRow icon={MapPin} label="區域" value={supplier.district_name} />
              <InfoRow icon={Globe} label="網站" value={supplier.website} />
              <InfoRow
                icon={Calendar}
                label="成立年份"
                value={supplier.establish_year}
              />
            </div>
          </div>

          {/* Supplier Sub-tables — Projects, Comments, Files, Pricings, Statuses */}
          <SupplierDetailTabs
            supplierId={supplier.id}
            asanaLink={supplier.asana_link}
          />
        </div>

        {/* Right: Status & Meta */}
        <div className="space-y-6">
          {/* Contacts */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-bw-violet" />
              聯繫人 Contacts
            </h2>
            <div className="grid grid-cols-1 gap-4">
              <ContactCard
                title="聯繫人 1"
                engName={contact1EngName || null}
                chnName={contact1ChnName || null}
                phone={supplier.contact1_phone}
                jobTitle={supplier.contact1_job_title}
                nameCardUrl={(supplier as any).contact1_name_card || null}
              />
              <ContactCard
                title="聯繫人 2"
                engName={contact2EngName || null}
                chnName={null}
                phone={supplier.contact2_phone}
                jobTitle={supplier.contact2_job_title}
                nameCardUrl={(supplier as any).contact2_name_card || null}
              />
              {!contact1EngName &&
                !contact1ChnName &&
                !contact2EngName && (
                  <p className="text-sm text-gray-400 italic text-center py-6">
                    暫無聯繫人資料
                  </p>
                )}
            </div>
          </div>

          {/* Professional Skills */}
          {supplier.professional_skill && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-bw-amber" />
                專業技能
              </h2>
              <div>
                <div className="flex flex-wrap gap-1.5">
                  {supplier.professional_skill
                    .split(",")
                    .map((skill, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-xs border-blue-200 text-blue-700 bg-blue-50/50"
                      >
                        {skill.trim()}
                      </Badge>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Supplier Tags — Interactive Panel */}
          <SupplierTagsPanel supplierId={supplier.id} />

          {/* Classification & Status */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-bw-teal" />
              分類 & 狀態
            </h2>
            <InfoRow icon={Tag} label="類型" value={(supplier.n_type_names && supplier.n_type_names.length > 0) ? supplier.n_type_names.join(", ") : supplier.n_type_name} />
            <InfoRow icon={Tag} label="供應商狀態" value={supplier.status} />
            <InfoRow
              icon={Tag}
              label="帳戶狀態"
              value={supplier.account_status}
            />
            <InfoRow
              icon={Calendar}
              label="加入日期"
              value={formatDate(supplier.join_date)}
            />
            <InfoRow
              icon={Calendar}
              label="建立日期"
              value={formatDate(supplier.created_date)}
            />
            <InfoRow
              icon={Clock}
              label="最後修改"
              value={formatDate(supplier.modified_date)}
            />
          </div>

          {/* Operations Info */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-bw-amber" />
              營運資訊 Operations
            </h2>
            <InfoRow icon={Hash} label="MOQ (最低訂購量)" value={supplier.moq} />
            <InfoRow
              icon={Clock}
              label="訂購天數"
              value={supplier.order_days}
            />
          </div>

          {/* Remark */}
          {supplier.remark && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                備註
              </h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {supplier.remark}
              </p>
            </div>
          )}
        </div>
      </div>

      <SupplierMergeDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        currentSupplier={supplier}
      />

      {/* ─── Shared Edit Dialog ──────────────────────────── */}
      <SupplierEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        supplier={supplier}
        onSaved={() => loadSupplier()}
      />
    </div>
  );
}
