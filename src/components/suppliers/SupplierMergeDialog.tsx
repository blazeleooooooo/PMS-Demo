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
import {
  buildMergedSupplierDefaults,
  fetchSupplierDetail,
  fetchSupplierMergeRelatedCounts,
  fetchSuppliersPage,
  mergeSuppliers,
  sumMergeRelatedCounts,
  type SupplierDetailData,
  type SupplierMergeRelatedCounts,
  type SupplierMergeScalarPayload,
  type SupplierRow,
} from "@/lib/data-service";

type Step = "select" | "review";

const COUNT_LABELS: { key: keyof SupplierMergeRelatedCounts; label: string }[] = [
  { key: "expenses", label: "Expenses / 開支" },
  { key: "bwaProjectLinks", label: "BWA project links" },
  { key: "bwfProjectLinks", label: "BWF project links" },
  { key: "bwfProjectSuppliers", label: "BWF project suppliers" },
  { key: "bwfOrders", label: "BWF orders" },
  { key: "comments", label: "Comments / 評論" },
  { key: "files", label: "Files / 檔案" },
  { key: "pricings", label: "Pricings / 報價" },
  { key: "recentStatuses", label: "Recent statuses" },
  { key: "registerForms", label: "Register forms" },
  { key: "types", label: "Types / 類型" },
  { key: "tags", label: "Tags / 標籤" },
  { key: "portalUsers", label: "Portal users" },
  { key: "loginCodes", label: "Login codes" },
  { key: "feedback", label: "Feedback" },
  { key: "apRemarks", label: "AP remarks" },
];

const SCALAR_FIELDS: {
  key: keyof SupplierMergeScalarPayload;
  label: string;
  multiline?: boolean;
}[] = [
  { key: "display_name", label: "Display name" },
  { key: "name", label: "English name" },
  { key: "chinese_name", label: "Chinese name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "fax_no", label: "Fax" },
  { key: "website", label: "Website" },
  { key: "address", label: "Address", multiline: true },
  { key: "contact_persons", label: "Contact persons" },
  { key: "account_status", label: "Account status" },
  { key: "real_level", label: "Level" },
  { key: "establish_year", label: "Establish year" },
  { key: "join_date", label: "Join date" },
  { key: "asana_link", label: "Asana link" },
  { key: "moq", label: "MOQ" },
  { key: "order_days", label: "Order days" },
  { key: "professional_skill", label: "Professional skill", multiline: true },
  { key: "remark", label: "Remark", multiline: true },
  { key: "contact1_eng_givenname", label: "Contact1 Eng given" },
  { key: "contact1_eng_surname", label: "Contact1 Eng surname" },
  { key: "contact1_phone", label: "Contact1 phone" },
  { key: "contact1_job_title", label: "Contact1 job title" },
  { key: "contact2_eng_givenname", label: "Contact2 Eng given" },
  { key: "contact2_eng_surname", label: "Contact2 Eng surname" },
  { key: "contact2_phone", label: "Contact2 phone" },
  { key: "contact2_job_title", label: "Contact2 job title" },
];

function displaySupplierName(s: Pick<SupplierRow, "display_name" | "name" | "chinese_name">) {
  return s.display_name || s.name || s.chinese_name || "—";
}

function NameCardReadonly({
  label,
  url,
}: {
  label: string;
  url: string | null | undefined;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-gray-400">{label}</p>
      {url && String(url).trim() ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={url}
            alt={label}
            className="w-full max-w-[180px] h-auto rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
          />
        </a>
      ) : (
        <p className="text-sm text-gray-400">—</p>
      )}
    </div>
  );
}

function NameCardMergeField({
  label,
  value,
  urlA,
  urlB,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  urlA: string | null | undefined;
  urlB: string | null | undefined;
  onChange: (url: string) => void;
}) {
  const a = urlA && String(urlA).trim() ? String(urlA).trim() : "";
  const b = urlB && String(urlB).trim() ? String(urlB).trim() : "";
  const current = value && String(value).trim() ? String(value).trim() : "";

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <p className="text-[11px] text-gray-400">
        預設取 A；若無則用 B。可手動切換。
      </p>
      {current ? (
        <a href={current} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={current}
            alt={label}
            className="w-full max-w-[200px] h-auto rounded-lg border border-gray-200 bg-white shadow-sm"
          />
        </a>
      ) : (
        <p className="text-sm text-gray-400 bg-white rounded-md border px-3 py-2">無名片 No name card</p>
      )}
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
          清除 Clear
        </Button>
      </div>
    </div>
  );
}

function RelatedCountsBlock({
  title,
  counts,
  note,
}: {
  title: string;
  counts: SupplierMergeRelatedCounts | null;
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

interface SupplierMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSupplier: SupplierDetailData;
}

export default function SupplierMergeDialog({
  open,
  onOpenChange,
  currentSupplier,
}: SupplierMergeDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("select");
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<SupplierRow[]>([]);
  /** Prefer-A-else-B sides (swappable on review step). */
  const [sideA, setSideA] = useState<SupplierDetailData | null>(null);
  const [sideB, setSideB] = useState<SupplierDetailData | null>(null);
  const [loadingB, setLoadingB] = useState(false);
  const [pageCounts, setPageCounts] = useState<SupplierMergeRelatedCounts | null>(null);
  const [countsSideA, setCountsSideA] = useState<SupplierMergeRelatedCounts | null>(null);
  const [countsSideB, setCountsSideB] = useState<SupplierMergeRelatedCounts | null>(null);
  const [merged, setMerged] = useState<SupplierMergeScalarPayload>({});
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
    fetchSupplierMergeRelatedCounts(currentSupplier.id, currentSupplier.bubble_id).then(
      setPageCounts
    );
  }, [open, currentSupplier.id, currentSupplier.bubble_id, resetState]);

  useEffect(() => {
    if (!open || step !== "select") return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await fetchSuppliersPage({
          page: 0,
          pageSize: 40,
          search: search.trim() || undefined,
          sortField: "name",
          sortDir: "asc",
        });
        if (cancelled) return;
        setCandidates(
          (result.data ?? []).filter((s) => s.id !== currentSupplier.id)
        );
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, step, search, currentSupplier.id]);

  const countsC = useMemo(() => {
    if (!countsSideA || !countsSideB || !sideA || !sideB) return null;
    const summed = sumMergeRelatedCounts(countsSideA, countsSideB);
    const typeUnion = new Set([
      ...(sideA.n_type_ids ?? []),
      ...(sideB.n_type_ids ?? []),
    ]);
    summed.types = typeUnion.size || summed.types;
    return summed;
  }, [countsSideA, countsSideB, sideA, sideB]);

  const typeUnionLabels = useMemo(() => {
    const names = new Set<string>();
    (sideA?.n_type_names ?? []).forEach((n) => names.add(n));
    (sideB?.n_type_names ?? []).forEach((n) => names.add(n));
    return Array.from(names);
  }, [sideA?.n_type_names, sideB?.n_type_names]);

  const tagUnionLabels = useMemo(() => {
    const names = new Set<string>();
    String(sideA?.supplier_tags || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((n) => names.add(n));
    String(sideB?.supplier_tags || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((n) => names.add(n));
    return Array.from(names);
  }, [sideA?.supplier_tags, sideB?.supplier_tags]);

  const handleSelectB = async (row: SupplierRow) => {
    setLoadingB(true);
    try {
      const detail = await fetchSupplierDetail(row.id);
      if (!detail) {
        toast({
          title: "無法載入供應商",
          description: "Could not load selected supplier.",
          variant: "destructive",
        });
        return;
      }
      const aCounts =
        pageCounts ??
        (await fetchSupplierMergeRelatedCounts(
          currentSupplier.id,
          currentSupplier.bubble_id
        ));
      const bCounts = await fetchSupplierMergeRelatedCounts(
        detail.id,
        detail.bubble_id
      );
      setSideA(currentSupplier);
      setSideB(detail);
      setCountsSideA(aCounts);
      setCountsSideB(bCounts);
      setMerged(buildMergedSupplierDefaults(currentSupplier, detail));
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
    setMerged(buildMergedSupplierDefaults(nextA, nextB));
  };

  const updateMerged = (key: keyof SupplierMergeScalarPayload, value: string) => {
    setMerged((prev) => ({ ...prev, [key]: value }));
  };

  const handleConfirmMerge = async () => {
    if (!sideA || !sideB) return;
    setMerging(true);
    try {
      const result = await mergeSuppliers(sideA.id, sideB.id, {
        ...merged,
        status: merged.status || "Active",
        n_type_id:
          merged.n_type_id || sideA.n_type_id || sideB.n_type_id || null,
      });
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
        description: "已建立新供應商並轉移關聯資料。Redirecting…",
      });
      setConfirmOpen(false);
      onOpenChange(false);
      router.push(`/suppliers/${result.id}`);
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
              合併供應商 Merge suppliers
            </DialogTitle>
            <DialogDescription className="text-sm text-left space-y-2">
              {step === "select" ? (
                <>
                  <span className="block">
                    將目前供應商與另一個重複供應商合併為<strong>新</strong>供應商。兩邊的關聯資料（項目、開支、評論、檔案、報價等）都會移至新供應商；兩個原供應商會設為停用（Inactive）。
                  </span>
                  <span className="block text-gray-500">
                    Merge the current supplier with a duplicate into a{" "}
                    <strong>new</strong> supplier. Related records from both sides
                    move to the new one; the two originals become Inactive.
                  </span>
                </>
              ) : (
                <>
                  <span className="block">
                    左／中為原供應商（唯讀）；右欄為新合併結果（可編輯欄位）。關聯資料會合併兩邊（重複可接受）。
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
                  合併後無法自動拆回兩個供應商。You cannot automatically split them
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
                    placeholder="搜尋名稱 / 電話 / Email…"
                    className="pl-9"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-gray-500">
                  目前供應商（不會出現在列表）：{" "}
                  <span className="font-medium text-gray-800">
                    {displaySupplierName(currentSupplier)}
                  </span>
                </p>
                <div className="border rounded-lg divide-y max-h-[360px] overflow-y-auto">
                  {searching || loadingB ? (
                    <div className="flex items-center justify-center py-10 text-sm text-gray-500 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                    </div>
                  ) : candidates.length === 0 ? (
                    <div className="py-10 text-center text-sm text-gray-400">
                      沒有符合的供應商 No matching suppliers
                    </div>
                  ) : (
                    candidates.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors"
                        onClick={() => handleSelectB(s)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {displaySupplierName(s)}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {[s.phone, s.email, s.chinese_name]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </p>
                          </div>
                          {s.status && (
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {s.status}
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
                    <ArrowLeft className="w-4 h-4 mr-1" /> 重新選擇供應商
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
                  交換後左欄為優先預設來源（A），右欄為後備（B）；中間合併結果會依此重設。
                  After swap, left is preferred (A) and C defaults reset.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {/* Column A */}
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <h3 className="text-sm font-semibold text-gray-800">
                        供應商 A（優先）
                      </h3>
                      <div className="flex items-center gap-1 shrink-0">
                        {sideA.id === currentSupplier.id && (
                          <Badge variant="outline" className="text-[10px]">
                            目前頁面
                          </Badge>
                        )}
                        <Badge className="bg-gray-800 text-white text-[10px]">A</Badge>
                      </div>
                    </div>
                    <p className="text-base font-bold text-gray-900 mb-3">
                      {displaySupplierName(sideA)}
                    </p>
                    <div className="space-y-2.5 max-h-[42vh] overflow-y-auto pr-1">
                      {SCALAR_FIELDS.map((f) => (
                        <ReadOnlyField
                          key={f.key}
                          label={f.label}
                          value={(sideA as any)[f.key] as string | null}
                        />
                      ))}
                      <NameCardReadonly
                        label="聯絡人 1 名片 Contact1 Name Card"
                        url={sideA.contact1_name_card}
                      />
                      <NameCardReadonly
                        label="聯絡人 2 名片 Contact2 Name Card"
                        url={sideA.contact2_name_card}
                      />
                      <ReadOnlyField
                        label="Types"
                        value={(sideA.n_type_names ?? []).join(", ")}
                      />
                      <ReadOnlyField label="Tags" value={sideA.supplier_tags} />
                    </div>
                    <RelatedCountsBlock title="關聯資料 Related" counts={countsSideA} />
                  </div>

                  {/* Column B */}
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <h3 className="text-sm font-semibold text-gray-800">
                        供應商 B（後備）
                      </h3>
                      <div className="flex items-center gap-1 shrink-0">
                        {sideB.id === currentSupplier.id && (
                          <Badge variant="outline" className="text-[10px]">
                            目前頁面
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">B</Badge>
                      </div>
                    </div>
                    <p className="text-base font-bold text-gray-900 mb-3">
                      {displaySupplierName(sideB)}
                    </p>
                    <div className="space-y-2.5 max-h-[42vh] overflow-y-auto pr-1">
                      {SCALAR_FIELDS.map((f) => (
                        <ReadOnlyField
                          key={f.key}
                          label={f.label}
                          value={(sideB as any)[f.key] as string | null}
                        />
                      ))}
                      <NameCardReadonly
                        label="聯絡人 1 名片 Contact1 Name Card"
                        url={sideB.contact1_name_card}
                      />
                      <NameCardReadonly
                        label="聯絡人 2 名片 Contact2 Name Card"
                        url={sideB.contact2_name_card}
                      />
                      <ReadOnlyField
                        label="Types"
                        value={(sideB.n_type_names ?? []).join(", ")}
                      />
                      <ReadOnlyField label="Tags" value={sideB.supplier_tags} />
                    </div>
                    <RelatedCountsBlock title="關聯資料 Related" counts={countsSideB} />
                  </div>

                  {/* Column C */}
                  <div className="rounded-xl border-2 border-bw-blue/40 bg-blue-50/30 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-bw-blue">
                        新合併供應商（可編輯）
                      </h3>
                      <Badge className="bg-bw-blue text-white text-[10px]">
                        New
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      預設取 A 欄位；若空白則用 B。關聯資料 = 兩邊合計（重複保留）。
                    </p>
                    <div className="space-y-3 max-h-[42vh] overflow-y-auto pr-1">
                      <div className="space-y-1">
                        <Label className="text-xs">Status</Label>
                        <Select
                          value={merged.status || "Active"}
                          onValueChange={(v) => updateMerged("status", v)}
                        >
                          <SelectTrigger className="bg-white h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Active">啟用 Active</SelectItem>
                            <SelectItem value="Inactive">停用 Inactive</SelectItem>
                            <SelectItem value="Blacklist">黑名單 Blacklist</SelectItem>
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
                      <NameCardMergeField
                        label="聯絡人 1 名片 Contact1 Name Card"
                        value={merged.contact1_name_card}
                        urlA={sideA.contact1_name_card}
                        urlB={sideB.contact1_name_card}
                        onChange={(url) => updateMerged("contact1_name_card", url)}
                      />
                      <NameCardMergeField
                        label="聯絡人 2 名片 Contact2 Name Card"
                        value={merged.contact2_name_card}
                        urlA={sideA.contact2_name_card}
                        urlB={sideB.contact2_name_card}
                        onChange={(url) => updateMerged("contact2_name_card", url)}
                      />
                      <div className="space-y-1">
                        <Label className="text-xs">Types (A∪B, auto)</Label>
                        <p className="text-sm text-gray-800 bg-white rounded-md border px-3 py-2 min-h-[36px]">
                          {typeUnionLabels.length > 0
                            ? typeUnionLabels.join(", ")
                            : "—"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tags (A∪B, auto)</Label>
                        <p className="text-sm text-gray-800 bg-white rounded-md border px-3 py-2 min-h-[36px]">
                          {tagUnionLabels.length > 0
                            ? tagUnionLabels.join(", ")
                            : "—"}
                        </p>
                      </div>
                    </div>
                    <RelatedCountsBlock
                      title="合併後關聯資料（預估）"
                      counts={countsC}
                      note="類型／標籤為聯集；其餘為兩邊筆數相加（重複可接受）"
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
                此操作無法還原。兩個原供應商將設為停用，所有關聯資料會移至新供應商。
              </span>
              <span className="block">
                This cannot be undone. Both original suppliers will be set
                Inactive and all related data will move to the new supplier.
              </span>
              {sideA && sideB && (
                <span className="block pt-1 text-gray-700 font-medium">
                  {displaySupplierName(sideA)} + {displaySupplierName(sideB)} →
                  new supplier
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
