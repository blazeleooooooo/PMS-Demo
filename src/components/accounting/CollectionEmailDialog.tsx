"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Mail, Send, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchBWAProjectDetail,
  type BWAProjectDetailData,
} from "@/lib/data/bwa-projects";
import {
  fetchBWFProjectDetail,
  type BWFProjectDetailData,
} from "@/lib/data/bwf-projects";
import { fetchCostCentres, fetchIssuedInvoiceNumbersByIncomeIds, type CostCentreData } from "@/lib/data/finance";
import {
  fetchCollectionEmailRecipients,
  fetchCollectionEmailStaffOptions,
  type CollectionEmailSource,
  type CollectionEmailStaffOption,
} from "@/lib/data/collection-emails";
import { parseValidEmailList, pickDefaultCollectionBcc } from "@/lib/collection-email-groups";
import {
  attachIssuedInvoiceNumbers,
  buildCollectionEmailCopy,
  buildCollectionEmailHtml,
  buildProjectInvoiceSummaryHtml,
  buildProjectInvoiceSummaryText,
  COLLECTION_EMAIL_MODES,
  type CollectionEmailCopyInput,
  type CollectionEmailMode,
} from "@/lib/project-invoice-summary";
import { cn } from "@/lib/utils";

export interface CollectionEmailTarget {
  projectId: string;
  bwType: CollectionEmailSource;
}

function customerNameFromDetail(
  detail: BWAProjectDetailData | BWFProjectDetailData
): string | null {
  return detail.customer_display_name || detail.customer_name || null;
}

function StaffBccMultiSelect({
  options,
  selectedIds,
  onChange,
}: {
  options: CollectionEmailStaffOption[];
  selectedIds: string[];
  onChange: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const [open, setOpen] = useState(false);
  const lastToggleRef = useRef<{ id: string; at: number } | null>(null);
  const selected = useMemo(
    () => options.filter((row) => selectedIds.includes(row.id)),
    [options, selectedIds]
  );

  const toggle = (id: string) => {
    const option = options.find((row) => row.id === id);
    if (!option?.email) return;
    const now = Date.now();
    if (lastToggleRef.current?.id === id && now - lastToggleRef.current.at < 80) {
      return;
    }
    lastToggleRef.current = { id, at: now };
    onChange((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex min-h-10 w-full items-start justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-left text-sm shadow-sm hover:bg-gray-50"
        >
          <div className="flex flex-1 flex-wrap gap-1.5">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">搜尋並選擇同事...</span>
            ) : (
              selected.map((row) => (
                <Badge
                  key={row.id}
                  variant="secondary"
                  className="gap-1 font-normal"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggle(row.id);
                  }}
                >
                  {row.name}
                  <X className="h-3 w-3" />
                </Badge>
              ))
            )}
          </div>
          <ChevronsUpDown className="mt-0.5 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[80] w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onWheel={(e) => e.stopPropagation()}
      >
        <Command className="h-auto max-h-[min(320px,50vh)] overflow-hidden">
          <CommandInput placeholder="搜尋姓名或電郵..." />
          <CommandList className="min-h-0 max-h-[260px] overflow-y-auto overscroll-contain">
            <CommandEmpty>沒有符合的同事</CommandEmpty>
            <CommandGroup>
              {options.map((row) => {
                const checked = selectedIds.includes(row.id);
                const disabled = !row.email;
                return (
                  <CommandItem
                    key={row.id}
                    value={`${row.name} ${row.email || ""}`}
                    disabled={disabled}
                    onSelect={() => {
                      if (!disabled) toggle(row.id);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0">
                      <div className="truncate">{row.name}</div>
                      <div className="truncate text-[11px] text-gray-400">
                        {row.email || "無電郵"}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function CollectionEmailDialog({
  target,
  onClose,
}: {
  target: CollectionEmailTarget | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toText, setToText] = useState("");
  const [staffOptions, setStaffOptions] = useState<CollectionEmailStaffOption[]>([]);
  const [bccStaffIds, setBccStaffIds] = useState<string[]>([]);
  const [emailMode, setEmailMode] = useState<CollectionEmailMode>("progress");
  const [copyInput, setCopyInput] = useState<CollectionEmailCopyInput | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [signature, setSignature] = useState("");
  const [summaryHtml, setSummaryHtml] = useState("");
  const [summaryText, setSummaryText] = useState("");

  const applyCopy = (mode: CollectionEmailMode, input: CollectionEmailCopyInput) => {
    const copy = buildCollectionEmailCopy(mode, input);
    setSubject(copy.subject);
    setBody(copy.body);
    setSignature(copy.signature);
  };

  const handleModeChange = (mode: CollectionEmailMode) => {
    if (mode === emailMode) return;
    setEmailMode(mode);
    if (copyInput) applyCopy(mode, copyInput);
  };

  useEffect(() => {
    if (!target) {
      setToText("");
      setStaffOptions([]);
      setBccStaffIds([]);
      setEmailMode("progress");
      setCopyInput(null);
      setSubject("");
      setBody("");
      setSignature("");
      setSummaryHtml("");
      setSummaryText("");
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const [detail, recipients, centres, staffRows] = await Promise.all([
          target.bwType === "BWF"
            ? fetchBWFProjectDetail(target.projectId)
            : fetchBWAProjectDetail(target.projectId),
          fetchCollectionEmailRecipients({
            projectId: target.projectId,
            bwType: target.bwType,
          }),
          fetchCostCentres(),
          fetchCollectionEmailStaffOptions(),
        ]);

        if (cancelled) return;
        if (!detail) {
          setError("找不到項目資料");
          setLoading(false);
          return;
        }

        const centre =
          centres.find((row: CostCentreData) => row.id === detail.cost_centre_id) || null;
        const companyName = centre?.display || "Acme Design Limited";
        const incomes = attachIssuedInvoiceNumbers(
          detail.incomes || [],
          await fetchIssuedInvoiceNumbersByIncomeIds((detail.incomes || []).map((row) => row.id))
        );
        if (cancelled) return;
        const summaryInput = {
          incomes,
          projectCode: detail.project_code,
          projectName: detail.project_name || detail.customer_display_name,
          customerName: customerNameFromDetail(detail),
          customerAddress: detail.customer_address || detail.site_address,
          pmName: detail.pm_name,
          companyName,
          companyChineseName: centre?.chinese_display || "Acme 設計有限公司",
          logoUrl: centre?.business_logo,
        };

        const emailToStaffId = new Map(
          staffRows
            .filter((row) => row.email)
            .map((row) => [row.email!.toLowerCase(), row.id])
        );
        const nextBccIds: string[] = [];
        const seen = new Set<string>();
        const defaultPicks = pickDefaultCollectionBcc({
          staff: staffRows,
          collaborators: recipients.bcc
            .filter((row) => row.source === "collaborator")
            .map((row) => ({
              id: row.staffId,
              email: row.email,
              name: row.name,
            })),
          toEmails: recipients.to.map((row) => row.email),
        });
        for (const row of defaultPicks) {
          const id = row.staffId || (row.email ? emailToStaffId.get(row.email.toLowerCase()) : null);
          if (!id || seen.has(id)) continue;
          seen.add(id);
          nextBccIds.push(id);
        }

        const nextCopyInput: CollectionEmailCopyInput = {
          projectName: detail.project_name || detail.project_code,
          customerName: customerNameFromDetail(detail),
          companyName: centre?.chinese_display || "Acme 設計有限公司",
          incomes,
          handoverDate: detail.handover_date,
        };

        setToText(recipients.to.map((row) => row.email).join(", "));
        setStaffOptions(staffRows);
        setBccStaffIds(nextBccIds);
        setEmailMode("progress");
        setCopyInput(nextCopyInput);
        applyCopy("progress", nextCopyInput);
        setSummaryHtml(buildProjectInvoiceSummaryHtml(summaryInput));
        setSummaryText(buildProjectInvoiceSummaryText(summaryInput));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "載入電郵預覽失敗");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [target?.projectId, target?.bwType]);

  const bccEmails = useMemo(
    () =>
      staffOptions
        .filter((row) => bccStaffIds.includes(row.id) && row.email)
        .map((row) => row.email as string),
    [staffOptions, bccStaffIds]
  );

  const previewHtml = useMemo(
    () => (summaryHtml ? buildCollectionEmailHtml(body, summaryHtml, signature) : ""),
    [body, summaryHtml, signature]
  );

  const toEmails = useMemo(() => parseValidEmailList(toText), [toText]);
  const toInvalidReason = !toText.trim()
    ? "請填寫收件人電郵"
    : toEmails
      ? null
      : "收件人必須為有效電郵地址";

  const handleSend = async () => {
    const to = toEmails;
    if (!to?.length) {
      setError(toInvalidReason || "收件人必須為有效電郵地址");
      return;
    }
    if (!subject.trim()) {
      setError("請填寫電郵主旨");
      return;
    }
    const text = `${body.trim()}\n\n${summaryText}\n\n${signature.trim()}`.trim();
    if (!text) {
      setError("請填寫電郵內容");
      return;
    }

    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/collection-emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          bcc: bccEmails,
          subject,
          text,
          html: previewHtml,
          idempotencyKey: `collection-email/${target?.projectId}/${Date.now()}`,
        }),
      });
      const data = (await res.json()) as { error?: string; id?: string };
      if (!res.ok) {
        setError(data.error || "發送失敗");
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "發送失敗");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[960px] w-[calc(100%-1.5rem)] h-[min(90dvh,calc(100dvh-1.5rem))] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b border-gray-100 px-6 pt-6 pb-4 pr-12">
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-bw-blue" />
            追收款電郵預覽
          </DialogTitle>
          <DialogDescription>
            預設寄給客戶，並密件副本會計部同事、指定同事與項目 BV 協作者。主旨、內文、署名與收件人可在發送前修改。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin text-bw-blue" />
              <span className="ml-2 text-sm">載入工程對數表與收件人...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <label className="space-y-1">
                  <span className="text-[12px] font-medium text-gray-500">收件人 To</span>
                  <Input
                    value={toText}
                    onChange={(e) => setToText(e.target.value)}
                    placeholder="customer@example.com"
                    aria-invalid={!!toInvalidReason}
                    className={toInvalidReason ? "border-red-400 focus-visible:ring-red-400" : undefined}
                  />
                  {toInvalidReason && (
                    <p className="text-[12px] text-red-600">{toInvalidReason}</p>
                  )}
                </label>
                <div className="space-y-1">
                  <span className="text-[12px] font-medium text-gray-500">密件副本 BCC</span>
                  <StaffBccMultiSelect
                    options={staffOptions}
                    selectedIds={bccStaffIds}
                    onChange={setBccStaffIds}
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[12px] font-medium text-gray-500">電郵情景</span>
                  <div className="inline-flex w-full rounded-md border border-input bg-muted/30 p-0.5 sm:w-auto">
                    {COLLECTION_EMAIL_MODES.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleModeChange(option.value)}
                        className={cn(
                          "flex-1 px-3 py-1.5 text-sm rounded-sm transition-colors sm:flex-none",
                          emailMode === option.value
                            ? "bg-white shadow-sm text-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[12px] leading-5 text-gray-500">
                    {COLLECTION_EMAIL_MODES.find((option) => option.value === emailMode)?.description}
                  </p>
                </div>
                <label className="space-y-1">
                  <span className="text-[12px] font-medium text-gray-500">主旨 Title</span>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[12px] font-medium text-gray-500">內文 Body</span>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="min-h-[220px]"
                  />
                </label>
              </div>

              <div className="space-y-1.5">
                <span className="text-[12px] font-medium text-gray-500">工程對數表預覽</span>
                <div className="border border-gray-200 rounded-lg bg-gray-100 overflow-auto">
                  {summaryHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: summaryHtml }} />
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-10">沒有可預覽的工程對數表</p>
                  )}
                </div>
              </div>

              <label className="block space-y-1">
                <span className="text-[12px] font-medium text-gray-500">署名 Signature</span>
                <Textarea
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  className="min-h-[96px]"
                />
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-gray-100 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={sending}>
            取消
          </Button>
          <Button
            type="button"
            className="gap-1.5"
            onClick={() => void handleSend()}
            disabled={loading || sending || !!toInvalidReason}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            發送電郵
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
