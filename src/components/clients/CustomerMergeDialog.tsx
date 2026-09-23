"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  Loader2,
  Merge,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { CUSTOMER_STATUS_FILTER_VALUES } from "@/lib/customer-status";
import {
  CUSTOMER_RECORD_STATUSES,
  CUSTOMER_RECORD_STATUS_LABELS,
  customerRecordStatusLabel,
  type CustomerRecordStatus,
} from "@/lib/customer-record-status";
import {
  buildMergedCustomerDefaults,
  fetchCustomerMergeCandidates,
  fetchCustomerMergeRelatedCounts,
  fetchCustomerMergeSource,
  mergeCustomers,
  sumCustomerMergeRelatedCounts,
  type CustomerMergeRelatedCounts,
  type CustomerMergeScalarPayload,
  type CustomerMergeSource,
  type CustomerRow,
} from "@/lib/data-service";

type Step = "select" | "review";

const COUNT_LABELS: { key: keyof CustomerMergeRelatedCounts; label: string }[] = [
  { key: "bwaProjects", label: "BWA projects" },
  { key: "bwfProjects", label: "BWF projects" },
  { key: "bwaPitchings", label: "BWA pitchings" },
  { key: "bwfPitchings", label: "BWF pitchings" },
  { key: "comments", label: "Comments / 評論" },
  { key: "documents", label: "Documents / 文件" },
  { key: "tags", label: "Tags / 標籤" },
  { key: "quotations", label: "Quotations / 報價" },
  { key: "crEventDetails", label: "CR event details" },
  { key: "crEvents", label: "CR events" },
  { key: "portalUsers", label: "Portal users" },
];

const SCALAR_FIELDS: {
  key: keyof CustomerMergeScalarPayload;
  label: string;
  multiline?: boolean;
}[] = [
  { key: "display_name", label: "Display name" },
  { key: "customer_name", label: "Customer name" },
  { key: "company_name", label: "Company name" },
  { key: "brand_name_cn", label: "Brand name (CN)" },
  { key: "brand_name_en", label: "Brand name (EN)" },
  { key: "phone_display", label: "Phone display" },
  { key: "phone_number_a", label: "Phone A" },
  { key: "phone_number_b", label: "Phone B" },
  { key: "email", label: "Email" },
  { key: "address", label: "Address", multiline: true },
  { key: "view_system", label: "View system" },
  { key: "asana", label: "Asana" },
  { key: "enquiry_create_date", label: "Enquiry create date" },
  { key: "remark", label: "Remark", multiline: true },
];

function displayCustomerName(
  c: Pick<CustomerMergeSource | CustomerRow, "display_name" | "customer_name" | "company_name">
) {
  return c.display_name || c.customer_name || c.company_name || "—";
}

function RelatedCountsBlock({
  title,
  counts,
  note,
}: {
  title: string;
  counts: CustomerMergeRelatedCounts | null;
  note?: string;
}) {
  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <p className="text-xs font-semibold text-gray-600 mb-2">{title}</p>
      {note && <p className="text-[11px] text-gray-400 mb-2">{note}</p>}
      {!counts ? (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {COUNT_LABELS.map(({ key, label }) => (
            <div
              key={key}
              className="flex items-center justify-between rounded bg-gray-50 px-2 py-1 text-[11px]"
            >
              <span className="text-gray-500 truncate pr-2">{label}</span>
              <span className="font-mono font-semibold text-gray-800">{counts[key]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-sm text-gray-800 break-words whitespace-pre-wrap min-h-[1.25rem]">
        {value && String(value).trim() ? String(value) : "—"}
      </p>
    </div>
  );
}

function BrandingIconField({
  label,
  url,
  editable,
  urlA,
  urlB,
  onChange,
}: {
  label: string;
  url: string | null | undefined;
  editable?: boolean;
  urlA?: string | null;
  urlB?: string | null;
  onChange?: (url: string) => void;
}) {
  const current = url && String(url).trim() ? String(url).trim() : "";
  const a = urlA && String(urlA).trim() ? String(urlA).trim() : "";
  const b = urlB && String(urlB).trim() ? String(urlB).trim() : "";

  return (
    <div className="space-y-1.5">
      <p className={editable ? "text-xs font-medium" : "text-[11px] text-gray-400"}>{label}</p>
      {current ? (
        <img
          src={current}
          alt={label}
          className="w-16 h-16 object-contain rounded-lg border border-gray-200 bg-white"
        />
      ) : (
        <p className="text-sm text-gray-400">—</p>
      )}
      {editable && onChange && (
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={current && a && current === a ? "default" : "outline"}
            className="h-7 text-xs"
            disabled={!a}
            onClick={() => onChange(a)}
          >
            用 A
          </Button>
          <Button
            type="button"
            size="sm"
            variant={current && b && current === b ? "default" : "outline"}
            className="h-7 text-xs"
            disabled={!b}
            onClick={() => onChange(b)}
          >
            用 B
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-gray-500"
            disabled={!current}
            onClick={() => onChange("")}
          >
            清除
          </Button>
        </div>
      )}
    </div>
  );
}

interface CustomerMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCustomer: CustomerMergeSource;
}

export default function CustomerMergeDialog({
  open,
  onOpenChange,
  currentCustomer,
}: CustomerMergeDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("select");
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<CustomerRow[]>([]);
  const [sideA, setSideA] = useState<CustomerMergeSource | null>(null);
  const [sideB, setSideB] = useState<CustomerMergeSource | null>(null);
  const [loadingB, setLoadingB] = useState(false);
  const [pageCounts, setPageCounts] = useState<CustomerMergeRelatedCounts | null>(null);
  const [countsSideA, setCountsSideA] = useState<CustomerMergeRelatedCounts | null>(null);
  const [countsSideB, setCountsSideB] = useState<CustomerMergeRelatedCounts | null>(null);
  const [merged, setMerged] = useState<CustomerMergeScalarPayload>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [merging, setMerging] = useState(false);

  const resetState = useCallback(() => {
    setStep("select");
    setSearch("");
    setCandidates([]);
    setSideA(null);
    setSideB(null);
    setPageCounts(null);
    setCountsSideA(null);
    setCountsSideB(null);
    setMerged({});
    setConfirmOpen(false);
    setMerging(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }
    fetchCustomerMergeRelatedCounts(currentCustomer.id, currentCustomer.bubble_id).then(
      setPageCounts
    );
  }, [open, currentCustomer.id, currentCustomer.bubble_id, resetState]);

  useEffect(() => {
    if (!open || step !== "select") return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const rows = await fetchCustomerMergeCandidates(
          search,
          currentCustomer.id,
          40
        );
        if (cancelled) return;
        setCandidates(rows);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, step, search, currentCustomer.id]);

  const countsC = useMemo(() => {
    if (!countsSideA || !countsSideB || !sideA || !sideB) return null;
    const summed = sumCustomerMergeRelatedCounts(countsSideA, countsSideB);
    const tagUnion = new Set([...(sideA.tag_ids ?? []), ...(sideB.tag_ids ?? [])]);
    summed.tags = tagUnion.size || summed.tags;
    return summed;
  }, [countsSideA, countsSideB, sideA, sideB]);

  const tagUnionLabels = useMemo(() => {
    const names = new Set<string>();
    (sideA?.tag_names ?? []).forEach((n) => names.add(n));
    (sideB?.tag_names ?? []).forEach((n) => names.add(n));
    return Array.from(names);
  }, [sideA?.tag_names, sideB?.tag_names]);

  const handleSelectB = async (row: CustomerRow) => {
    setLoadingB(true);
    try {
      const detail = await fetchCustomerMergeSource(row.id);
      if (!detail) {
        toast({
          title: "無法載入客戶",
          description: "Could not load selected customer.",
          variant: "destructive",
        });
        return;
      }
      const aCounts =
        pageCounts ??
        (await fetchCustomerMergeRelatedCounts(
          currentCustomer.id,
          currentCustomer.bubble_id
        ));
      const bCounts = await fetchCustomerMergeRelatedCounts(detail.id, detail.bubble_id);
      setSideA(currentCustomer);
      setSideB(detail);
      setCountsSideA(aCounts);
      setCountsSideB(bCounts);
      setMerged(buildMergedCustomerDefaults(currentCustomer, detail));
      setStep("review");
    } finally {
      setLoadingB(false);
    }
  };

  const handleSwapSides = () => {
    if (!sideA || !sideB) return;
    const nextA = sideB;
    const nextB = sideA;
    setSideA(nextA);
    setSideB(nextB);
    setCountsSideA(countsSideB);
    setCountsSideB(countsSideA);
    setMerged(buildMergedCustomerDefaults(nextA, nextB));
  };

  const updateMerged = (key: keyof CustomerMergeScalarPayload, value: string) => {
    setMerged((prev) => ({ ...prev, [key]: value }));
  };

  const handleConfirmMerge = async () => {
    if (!sideA || !sideB) return;
    setMerging(true);
    try {
      const result = await mergeCustomers(sideA.id, sideB.id, merged);
      if (!result.success || !result.id) {
        toast({
          title: "合併失敗 Merge failed",
          description: result.error || "Unknown error",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "合併成功 Merged",
        description: "已建立新客戶並轉移關聯資料。Redirecting…",
      });
      setConfirmOpen(false);
      onOpenChange(false);
      router.push(`/clients/${result.id}`);
    } finally {
      setMerging(false);
    }
  };

  const dialogWidth =
    step === "review"
      ? "max-w-[95vw] w-[1400px] max-h-[90vh]"
      : "max-w-lg max-h-[85vh]";

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (merging) return;
          onOpenChange(v);
        }}
      >
        <DialogContent
          className={`${dialogWidth} overflow-hidden flex flex-col p-0 gap-0`}
        >
          <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Merge className="w-5 h-5 text-bw-blue" />
              合併客戶 Merge customers
            </DialogTitle>
            <DialogDescription className="text-sm text-left space-y-2">
              {step === "select" ? (
                <>
                  <span className="block">
                    將目前客戶與另一個重複客戶合併為<strong>新</strong>客戶。兩邊的關聯資料（項目、提案、評論、文件、標籤等）都會移至新客戶；兩個原客戶會設為停用（Inactive）。
                  </span>
                  <span className="block text-gray-500">
                    Merge the current customer with a duplicate into a{" "}
                    <strong>new</strong> customer. Related records from both sides
                    move to the new one; the two originals become Inactive.
                  </span>
                </>
              ) : (
                <>
                  <span className="block">
                    左／中為原客戶（唯讀）；右欄為新合併結果（可編輯欄位）。關聯資料會合併兩邊（重複可接受）。
                  </span>
                  <span className="block text-gray-500">
                    Left/middle = originals (read-only); right = new merged result
                    (editable scalars). Related data from both sides is kept.
                  </span>
                </>
              )}
            </DialogDescription>
            <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">此操作無法還原 / This action cannot be undone</p>
                <p className="mt-0.5 text-amber-800">
                  合併後無法自動拆回兩個客戶。You cannot automatically split them
                  back after merge.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {step === "select" && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜尋名稱 / 公司 / 電話 / Email…"
                    className="pl-9"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-gray-500">
                  目前客戶（不會出現在列表）：{" "}
                  <span className="font-medium text-gray-800">
                    {displayCustomerName(currentCustomer)}
                  </span>
                </p>
                <div className="border rounded-lg divide-y max-h-[360px] overflow-y-auto">
                  {searching || loadingB ? (
                    <div className="flex items-center justify-center py-10 text-sm text-gray-500 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                    </div>
                  ) : candidates.length === 0 ? (
                    <div className="py-10 text-center text-sm text-gray-400">
                      沒有符合的客戶 No matching customers
                    </div>
                  ) : (
                    candidates.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors"
                        onClick={() => handleSelectB(c)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {displayCustomerName(c)}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {[c.company_name, c.phone_display, c.email]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </p>
                          </div>
                          {c.view_system && (
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {c.view_system}
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {step === "review" && sideA && sideB && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 -ml-2"
                    onClick={() => {
                      setStep("select");
                      setSideA(null);
                      setSideB(null);
                      setCountsSideA(null);
                      setCountsSideB(null);
                      setMerged({});
                    }}
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" /> 重新選擇客戶
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSwapSides}
                    disabled={merging}
                  >
                    <ArrowLeftRight className="w-4 h-4 mr-1.5" />
                    交換 A ↔ B / Swap sides
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  交換後左欄為優先預設來源（A），右欄為後備（B）；合併結果會依此重設。
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {([
                    { side: sideA, counts: countsSideA, label: "客戶 A（優先）", badge: "A" },
                    { side: sideB, counts: countsSideB, label: "客戶 B（後備）", badge: "B" },
                  ] as const).map(({ side, counts, label, badge }) => (
                    <div
                      key={side.id + badge}
                      className="rounded-xl border border-gray-200 bg-white p-4"
                    >
                      <div className="flex items-center justify-between mb-3 gap-2">
                        <h3 className="text-sm font-semibold text-gray-800">{label}</h3>
                        <div className="flex items-center gap-1 shrink-0">
                          {side.id === currentCustomer.id && (
                            <Badge variant="outline" className="text-[10px]">
                              目前頁面
                            </Badge>
                          )}
                          <Badge
                            className={
                              badge === "A"
                                ? "bg-gray-800 text-white text-[10px]"
                                : "text-[10px]"
                            }
                            variant={badge === "A" ? "default" : "outline"}
                          >
                            {badge}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-base font-bold text-gray-900 mb-3">
                        {displayCustomerName(side)}
                      </p>
                      <div className="space-y-2.5 max-h-[42vh] overflow-y-auto pr-1">
                        {SCALAR_FIELDS.map((f) => (
                          <ReadOnlyField
                            key={f.key}
                            label={f.label}
                            value={(side as any)[f.key] as string | null}
                          />
                        ))}
                        <ReadOnlyField
                          label="Account status"
                          value={customerRecordStatusLabel(side.status)}
                        />
                        <ReadOnlyField label="Status filter" value={side.status_filter_value} />
                        <BrandingIconField label="Logo / Branding icon" url={side.branding_icon} />
                        <ReadOnlyField
                          label="Tags"
                          value={(side.tag_names ?? []).join(", ")}
                        />
                      </div>
                      <RelatedCountsBlock title="關聯資料 Related" counts={counts} />
                    </div>
                  ))}

                  <div className="rounded-xl border-2 border-bw-blue/40 bg-blue-50/30 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-bw-blue">
                        新合併客戶（可編輯）
                      </h3>
                      <Badge className="bg-bw-blue text-white text-[10px]">New</Badge>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      預設取 A 欄位；若空白則用 B。關聯資料 = 兩邊合計（重複保留）。
                    </p>
                    <div className="space-y-3 max-h-[42vh] overflow-y-auto pr-1">
                      <div className="space-y-1">
                        <Label className="text-xs">帳戶狀態 Account status</Label>
                        <div className="flex flex-wrap gap-2">
                          {CUSTOMER_RECORD_STATUSES.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => updateMerged("status", s)}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                (merged.status || "Active") === s
                                  ? s === "Active"
                                    ? "bg-green-600 text-white border-green-600"
                                    : s === "Blacklist"
                                    ? "bg-red-600 text-white border-red-600"
                                    : "bg-gray-600 text-white border-gray-600"
                                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              {CUSTOMER_RECORD_STATUS_LABELS[s as CustomerRecordStatus]}
                            </button>
                          ))}
                        </div>
                        <p className="text-[11px] text-gray-400">
                          原客戶 A 與 B 送出後會自動設為停用 Inactive
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Status filter</Label>
                        <Select
                          value={merged.status_filter_value || "Enquiry"}
                          onValueChange={(v) => updateMerged("status_filter_value", v)}
                        >
                          <SelectTrigger className="bg-white h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CUSTOMER_STATUS_FILTER_VALUES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {SCALAR_FIELDS.map((f) => (
                        <div key={f.key} className="space-y-1">
                          <Label className="text-xs">{f.label}</Label>
                          {f.multiline ? (
                            <Textarea
                              className="bg-white text-sm min-h-[60px]"
                              value={(merged[f.key] as string) || ""}
                              onChange={(e) => updateMerged(f.key, e.target.value)}
                            />
                          ) : (
                            <Input
                              className="bg-white h-9 text-sm"
                              value={(merged[f.key] as string) || ""}
                              onChange={(e) => updateMerged(f.key, e.target.value)}
                            />
                          )}
                        </div>
                      ))}
                      <BrandingIconField
                        label="Logo / Branding icon"
                        url={merged.branding_icon}
                        editable
                        urlA={sideA.branding_icon}
                        urlB={sideB.branding_icon}
                        onChange={(url) => updateMerged("branding_icon", url)}
                      />
                      <div className="space-y-1">
                        <Label className="text-xs">Tags (A∪B, auto)</Label>
                        <p className="text-sm text-gray-800 bg-white rounded-md border px-3 py-2 min-h-[36px]">
                          {tagUnionLabels.length > 0 ? tagUnionLabels.join(", ") : "—"}
                        </p>
                      </div>
                    </div>
                    <RelatedCountsBlock
                      title="合併後關聯資料（預估）"
                      counts={countsC}
                      note="標籤為聯集；其餘為兩邊筆數相加（重複可接受）"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t shrink-0 bg-gray-50/80">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={merging}
            >
              取消 Cancel
            </Button>
            {step === "review" && (
              <Button
                type="button"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => setConfirmOpen(true)}
                disabled={!sideA || !sideB || merging}
              >
                確認合併 / Confirm merge
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認合併？ Confirm merge?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-left">
              <span className="block">
                此操作無法還原。兩個原客戶將設為停用（Inactive），所有關聯資料會移至新客戶。
              </span>
              <span className="block">
                This cannot be undone. Both original customers will become
                Inactive and all related data will move to the new customer.
              </span>
              {sideA && sideB && (
                <span className="block pt-1 text-gray-700 font-medium">
                  {displayCustomerName(sideA)} + {displayCustomerName(sideB)} →
                  new customer
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={merging}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmMerge();
              }}
            >
              {merging ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Merging…
                </>
              ) : (
                "確認合併 / Confirm merge"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
