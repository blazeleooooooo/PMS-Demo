"use client";

import { Building2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CostCentreData } from "@/lib/data/finance";
import {
  applySlotSourceChange,
  applySlotVisibility,
  slotSourceId,
  type PdfBranding,
  type PdfBrandingSlotKey,
} from "@/lib/pdf-branding";

type Accent = "blue" | "emerald";

const ACCENT: Record<Accent, { box: string; title: string; hint: string }> = {
  blue: {
    box: "border-blue-100 bg-blue-50/40",
    title: "text-blue-600",
    hint: "text-blue-400",
  },
  emerald: {
    box: "border-emerald-100 bg-emerald-50/40",
    title: "text-emerald-600",
    hint: "text-emerald-400",
  },
};

interface PdfBrandingFieldsProps {
  branding: PdfBranding;
  costCentres: CostCentreData[];
  primaryId: string | null;
  accent?: Accent;
  showPaymentInfo?: boolean;
  onChange: (next: PdfBranding) => void;
}

function SourceSelect({
  value,
  costCentres,
  onChange,
}: {
  value: string;
  costCentres: CostCentreData[];
  onChange: (id: string) => void;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-[108px] text-[11px]">
        <SelectValue placeholder="來源" />
      </SelectTrigger>
      <SelectContent>
        {costCentres.map((cc) => (
          <SelectItem key={cc.id} value={cc.id}>
            {cc.bu_code || cc.display || cc.id.slice(0, 8)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function PdfBrandingFields({
  branding,
  costCentres,
  primaryId,
  accent = "blue",
  showPaymentInfo = true,
  onChange,
}: PdfBrandingFieldsProps) {
  const colors = ACCENT[accent];

  const setVisible = (key: PdfBrandingSlotKey, visible: boolean) => {
    onChange(applySlotVisibility(branding, key, visible));
  };

  const setSource = (key: PdfBrandingSlotKey, sourceId: string) => {
    onChange(applySlotSourceChange(branding, key, sourceId, costCentres));
  };

  return (
    <div className={`rounded-lg border p-3 space-y-3 ${colors.box}`}>
      <p className={`text-[13px] font-semibold ${colors.title}`}>
        <Building2 className="w-3 h-3 inline mr-1" />
        已選 BU 自動填入資料
        <span className={`ml-2 font-normal text-[11px] ${colors.hint}`}>
          勾選項目會顯示於 PDF；來源可改為其他 BU
        </span>
      </p>

      <div className="space-y-3 text-xs">
        <label className={`flex items-start gap-2 ${!branding.companyName.visible ? "opacity-50" : ""}`}>
          <Checkbox
            checked={branding.companyName.visible}
            onCheckedChange={(v) => setVisible("companyName", v === true)}
            className="mt-0.5 rounded-full"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-gray-400 text-[12px]">公司名稱</p>
                <p className="font-medium text-gray-800">{branding.companyName.value.display || "N/A"}</p>
                {branding.companyName.value.chineseDisplay && (
                  <p className="text-gray-500 text-[12px]">{branding.companyName.value.chineseDisplay}</p>
                )}
              </div>
              <SourceSelect
                value={slotSourceId(branding, "companyName", primaryId)}
                costCentres={costCentres}
                onChange={(id) => setSource("companyName", id)}
              />
            </div>
          </div>
        </label>

        <label className={`flex items-start gap-2 ${!branding.companyLogo.visible ? "opacity-50" : ""}`}>
          <Checkbox
            checked={branding.companyLogo.visible}
            onCheckedChange={(v) => setVisible("companyLogo", v === true)}
            className="mt-0.5 rounded-full"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                {branding.companyLogo.value.url ? (
                  <img
                    src={branding.companyLogo.value.url}
                    alt="Logo"
                    className="h-8 w-auto object-contain rounded border bg-white p-0.5"
                  />
                ) : (
                  <span className="text-gray-400 text-[12px]">無 Logo</span>
                )}
                <div>
                  <p className="text-gray-400 text-[12px]">公司 Logo</p>
                  <p className="font-medium text-gray-800">{branding.companyLogo.value.url ? "已設定" : "未設定"}</p>
                </div>
              </div>
              <SourceSelect
                value={slotSourceId(branding, "companyLogo", primaryId)}
                costCentres={costCentres}
                onChange={(id) => setSource("companyLogo", id)}
              />
            </div>
          </div>
        </label>

        <label className={`flex items-start gap-2 ${!branding.companyChop.visible ? "opacity-50" : ""}`}>
          <Checkbox
            checked={branding.companyChop.visible}
            onCheckedChange={(v) => setVisible("companyChop", v === true)}
            className="mt-0.5 rounded-full"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                {branding.companyChop.value.url ? (
                  <img
                    src={branding.companyChop.value.url}
                    alt="Chop"
                    className="h-8 w-auto object-contain rounded border bg-white p-0.5"
                  />
                ) : (
                  <span className="text-gray-400 text-[12px]">無印章</span>
                )}
                <div>
                  <p className="text-gray-400 text-[12px]">公司蓋章</p>
                  <p className="font-medium text-gray-800">{branding.companyChop.value.url ? "已設定" : "未設定"}</p>
                </div>
              </div>
              <SourceSelect
                value={slotSourceId(branding, "companyChop", primaryId)}
                costCentres={costCentres}
                onChange={(id) => setSource("companyChop", id)}
              />
            </div>
          </div>
        </label>

        {showPaymentInfo && (
          <label className={`flex items-start gap-2 ${!branding.paymentInfo.visible ? "opacity-50" : ""}`}>
            <Checkbox
              checked={branding.paymentInfo.visible}
              onCheckedChange={(v) => setVisible("paymentInfo", v === true)}
              className="mt-0.5 rounded-full"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-gray-400 text-[12px]">付款資料</p>
                  <p className="text-gray-700 whitespace-pre-wrap line-clamp-3">
                    {branding.paymentInfo.value.bankNotes || "未設定"}
                  </p>
                </div>
                <SourceSelect
                  value={slotSourceId(branding, "paymentInfo", primaryId)}
                  costCentres={costCentres}
                  onChange={(id) => setSource("paymentInfo", id)}
                />
              </div>
            </div>
          </label>
        )}
      </div>
    </div>
  );
}
