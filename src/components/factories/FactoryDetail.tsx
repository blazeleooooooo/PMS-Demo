"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { handleNavClick } from "@/lib/nav-click";
import {
  ArrowLeft,
  Factory,
  Mail,
  Phone,
  MapPin,
  Tag,
  FileText,
  DollarSign,
  FolderOpen,
  BarChart3,
  Users,
  Calendar,
  Loader2,
  Edit2,
  Star,
  Clock,
  Globe,
  Briefcase,
  Hash,
  Package,
  ExternalLink,
  MessageCircle,
  Award,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fetchFactoryDetail,
  fetchFactoryFilterOptions,
  type FactoryDetailData,
} from "@/lib/data-service";
import FactoryEditDialog, {
  FACTORY_LEVEL_OPTIONS,
  PRODUCT_QUALITY_OPTIONS,
} from "@/components/factories/FactoryEditDialog";
import FactoryDetailTabs from "@/components/factories/FactoryDetailTabs";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { formatDate } from "@/lib/date-utils";
import { createClient } from "@/lib/supabase/client";

function getPriorityColor(priority: string | null): string {
  if (!priority) return "bg-gray-100 text-gray-500";
  const lower = priority.toLowerCase();
  if (lower.includes("1st") || lower.includes("首選"))
    return "bg-amber-50 text-amber-700 border-amber-200";
  if (lower.includes("2nd") || lower.includes("次選"))
    return "bg-blue-50 text-blue-700 border-blue-200";
  if (lower.includes("3rd") || lower.includes("後備"))
    return "bg-orange-50 text-orange-600 border-orange-200";
  if (lower.includes("black") || lower.includes("黑名單"))
    return "bg-red-50 text-red-600 border-red-200";
  return "bg-gray-50 text-gray-600 border-gray-200";
}

function getStatusColor(status: string | null): string {
  if (!status) return "bg-gray-100 text-gray-500";
  const s = status.toLowerCase();
  if (s.includes("active") || s.includes("啟用"))
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s.includes("inactive") || s.includes("停用"))
    return "bg-red-50 text-red-600 border-red-200";
  return "bg-gray-50 text-gray-600 border-gray-200";
}

function priorityLabel(priority: string | null): string {
  if (!priority) return "";
  return FACTORY_LEVEL_OPTIONS.find((o) => o.value === priority)?.label ?? priority;
}

function qualityLabel(raw: string | null): string {
  if (!raw) return "";
  return raw
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      return (
        PRODUCT_QUALITY_OPTIONS.find((o) => o.value === trimmed)?.label ?? trimmed
      );
    })
    .filter(Boolean)
    .join(", ");
}

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

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-b-0">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] text-gray-400 mb-0.5">{label}</p>
        {href && value ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-bw-blue hover:underline inline-flex items-center gap-1"
          >
            {value}
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <p className="text-sm text-gray-800">
            {value || <span className="text-gray-300 italic">N/A</span>}
          </p>
        )}
      </div>
    </div>
  );
}

export default function FactoryDetail({ factoryId }: { factoryId: string }) {
  const { formatMoney } = useFinancialFormat();
  const router = useRouter();
  const { canEdit } = usePermission();
  const [loading, setLoading] = useState(true);
  const [factory, setFactory] = useState<FactoryDetailData | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<
    { id: string; name: string }[]
  >([]);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const loadFactory = async () => {
    setLoading(true);
    const [result, options] = await Promise.all([
      fetchFactoryDetail(factoryId),
      fetchFactoryFilterOptions(),
    ]);
    setFactory(result);
    setCategoryOptions(options.categories);

    if (result) {
      try {
        const supabase = createClient();
        const { data: comments } = await supabase
          .from("staff_supplier_comments")
          .select("point")
          .eq("factory_id", factoryId)
          .not("point", "is", null);

        if (comments && comments.length > 0) {
          const total = comments.reduce(
            (sum: number, row: { point: number | null }) => sum + (row.point ?? 0),
            0
          );
          setAvgScore(total / comments.length);
        } else {
          setAvgScore(null);
        }
      } catch {
        setAvgScore(null);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    loadFactory();
  }, [factoryId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-bw-amber mr-2" />
        <span className="text-gray-500">載入工廠資料中...</span>
      </div>
    );
  }

  if (!factory) {
    return (
      <div className="text-center py-32">
        <Factory className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-lg">找不到此工廠</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={(e) => handleNavClick("/factories", e, (href) => router.push(href))}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> 返回工廠列表
        </Button>
      </div>
    );
  }

  const displayName =
    factory.display_name ||
    factory.factory_name ||
    factory.factory_eng_name ||
    "未命名工廠";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => handleNavClick("/factories", e, (href) => router.push(href))}
            className="text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> 返回
          </Button>
          <div className="h-6 w-px bg-gray-200" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
              {factory.priority && (
                <Badge
                  variant="outline"
                  className={`${getPriorityColor(factory.priority)} text-xs`}
                >
                  <Star className="w-3 h-3 mr-0.5" />{" "}
                  {priorityLabel(factory.priority)}
                </Badge>
              )}
              {factory.status && (
                <Badge
                  variant="outline"
                  className={`${getStatusColor(factory.status)} text-xs`}
                >
                  {factory.status}
                </Badge>
              )}
            </div>
            {factory.factory_eng_name &&
              factory.factory_eng_name !== displayName && (
                <p className="text-sm text-gray-500 mt-0.5">
                  {factory.factory_eng_name}
                </p>
              )}
            {factory.category_names.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 mt-1">
                <Tag className="w-3 h-3 text-gray-400" />
                {factory.category_names.map((name, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {canEdit("factories") && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEditDialog(true)}
          >
            <Edit2 className="w-4 h-4 mr-1.5" /> 編輯
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-bw-amber" />
          財政摘要 Financial Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FinancialCard
            icon={DollarSign}
            label="總金額"
            value={formatMoney(factory.amount)}
            color="bg-bw-blue"
          />
          <FinancialCard
            icon={BarChart3}
            label="欠款金額"
            value={formatMoney(factory.outstanding)}
            subLabel={
              factory.outstanding && factory.outstanding > 0
                ? "Outstanding"
                : undefined
            }
            color={
              factory.outstanding && factory.outstanding > 0
                ? "bg-bw-red"
                : "bg-gray-400"
            }
          />
          <FinancialCard
            icon={FolderOpen}
            label="總項目數"
            value={String(factory.project_number || 0)}
            color="bg-bw-violet"
          />
          <FinancialCard
            icon={Star}
            label="平均評分"
            value={avgScore != null ? avgScore.toFixed(1) : "-"}
            subLabel={avgScore != null ? "來自員工評價" : undefined}
            color="bg-bw-amber"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Factory className="w-4 h-4 text-bw-amber" />
              基本資訊 General Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <InfoRow icon={Factory} label="工廠中文名稱" value={factory.factory_name} />
              <InfoRow icon={Factory} label="工廠英文名稱" value={factory.factory_eng_name} />
              <InfoRow icon={Factory} label="顯示名稱" value={factory.display_name} />
              <InfoRow icon={Hash} label="工廠編號" value={factory.factory_code} />
              <InfoRow icon={Mail} label="電郵" value={factory.email} />
              <InfoRow icon={Phone} label="電話" value={factory.phone} />
              <InfoRow icon={MessageCircle} label="微信" value={factory.wechat} />
              <InfoRow icon={MapPin} label="位置" value={factory.location} />
              <InfoRow icon={Globe} label="網站" value={factory.website} href={factory.website ?? undefined} />
              <InfoRow
                icon={ExternalLink}
                label="Asana 連結"
                value={factory.asana_link}
                href={factory.asana_link ?? undefined}
              />
            </div>
          </div>

          <FactoryDetailTabs factoryId={factory.id} />
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-bw-violet" />
              聯繫人 Contact
            </h2>
            {factory.contact_person || factory.phone || factory.email || factory.wechat ? (
              <div className="bg-gray-50/50 rounded-lg p-4 border border-gray-100">
                {factory.contact_person && (
                  <p className="text-sm font-medium text-gray-900">
                    {factory.contact_person}
                  </p>
                )}
                {factory.phone && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {factory.phone}
                  </p>
                )}
                {factory.email && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {factory.email}
                  </p>
                )}
                {factory.wechat && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" /> {factory.wechat}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic text-center py-6">
                暫無聯繫人資料
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-bw-teal" />
              分類 & 狀態
            </h2>
            <InfoRow
              icon={Tag}
              label="產品類型"
              value={
                factory.category_names.length > 0
                  ? factory.category_names.join(", ")
                  : null
              }
            />
            <InfoRow icon={Star} label="優先級" value={priorityLabel(factory.priority)} />
            <InfoRow icon={Star} label="評級 (Real)" value={factory.real_level} />
            <InfoRow icon={Star} label="評級 (Auto)" value={factory.auto_level} />
            <InfoRow icon={Star} label="評級 (Admin)" value={factory.admin_level} />
            <InfoRow icon={Tag} label="狀態" value={factory.status} />
            <InfoRow
              icon={Calendar}
              label="加入日期"
              value={formatDate(factory.join_date)}
            />
            <InfoRow
              icon={Calendar}
              label="建立日期"
              value={formatDate(factory.created_date)}
            />
            <InfoRow
              icon={Clock}
              label="最後修改"
              value={formatDate(factory.modified_date)}
            />
            <InfoRow
              icon={Users}
              label="建立者"
              value={factory.created_by_name}
            />
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-bw-amber" />
              營運資訊 Operations
            </h2>
            <InfoRow icon={Hash} label="MOQ (最低訂購量)" value={factory.moq} />
            <InfoRow icon={Clock} label="交貨期" value={factory.delivery_period} />
            <InfoRow icon={Clock} label="交貨天數" value={factory.delivery_days} />
            <InfoRow icon={Clock} label="生產天數" value={factory.manufacture_days} />
            <InfoRow
              icon={Award}
              label="產品品質"
              value={qualityLabel(factory.product_quality)}
            />
          </div>

          {factory.remarks && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                備註
              </h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {factory.remarks}
              </p>
            </div>
          )}
        </div>
      </div>

      <FactoryEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        factory={factory}
        categoryOptions={categoryOptions}
        onSaved={() => loadFactory()}
      />
    </div>
  );
}
