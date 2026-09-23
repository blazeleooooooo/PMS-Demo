"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Plus,
  Loader2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { formatDate } from "@/lib/date-utils";
import {
  buildFurnitureQuoteCreateSsoUrl,
  type BwfQuoteListRow,
} from "@/lib/bwf-quote-service";

interface BWFQuoteListPanelBaseProps {
  pmName: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  customerTypeName: string | null;
}

type BWFQuoteListPanelProps = BWFQuoteListPanelBaseProps &
  (
    | {
        mode?: "pitching";
        pitchingId: string;
        pitchingCode: string | null;
        projectId?: never;
        projectCode?: never;
      }
    | {
        mode: "project";
        projectId: string;
        projectCode: string | null;
        pitchingId?: never;
        pitchingCode?: never;
      }
  );

function formatAmount(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  return new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency: "HKD",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function statusBadge(status: string | null) {
  const s = status || "—";
  if (s.includes("待審") || s.toLowerCase().includes("pending")) {
    return (
      <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
        {s}
      </Badge>
    );
  }
  if (s.includes("通過") || s.includes("核准") || s.toLowerCase().includes("approved")) {
    return (
      <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">
        {s}
      </Badge>
    );
  }
  if (s.includes("拒") || s.toLowerCase().includes("reject")) {
    return (
      <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">
        {s}
      </Badge>
    );
  }
  return (
    <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">{s}</Badge>
  );
}

export default function BWFQuoteListPanel(props: BWFQuoteListPanelProps) {
  const {
    pmName,
    clientName,
    clientPhone,
    clientEmail,
    customerTypeName,
  } = props;
  const isProject = props.mode === "project";
  const entityId = isProject ? props.projectId : props.pitchingId;
  const entityCode = isProject ? props.projectCode : props.pitchingCode;

  const { toast } = useToast();
  const { canCreate } = usePermission();
  const [quotes, setQuotes] = useState<BwfQuoteListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);

  const permissionKey = "proposals.quotation";
  const hasCreatePermission = canCreate(permissionKey);

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(
        isProject
          ? { projectId: entityId }
          : { pitchingId: entityId }
      );
      if (entityCode?.trim()) {
        params.set(isProject ? "projectCode" : "pitchingCode", entityCode.trim());
      }

      const res = await fetch(`/api/bwf/quotes?${params.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as {
        quotes?: BwfQuoteListRow[];
        error?: string;
      };

      if (res.status === 503 || body.error === "bwf_not_configured") {
        setConfigured(false);
        setQuotes([]);
        return;
      }

      setConfigured(true);

      if (!res.ok) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      setQuotes(body.quotes ?? []);
    } catch (err: unknown) {
      console.error("[BWFQuoteListPanel]", err);
      setQuotes([]);
      toast({
        title: "載入失敗",
        description:
          err instanceof Error ? err.message : "無法載入傢俬報價列表",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [entityId, entityCode, isProject, toast]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  const handleCreate = () => {
    const url = buildFurnitureQuoteCreateSsoUrl(
      isProject
        ? {
            projectId: entityId,
            entityCode,
            pmName,
            clientName,
            clientPhone,
            clientEmail,
            customerTypeName,
          }
        : {
            pitchingId: entityId,
            pitchingCode: entityCode,
            pmName,
            clientName,
            clientPhone,
            clientEmail,
            customerTypeName,
          }
    );
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const linkLabel = isProject ? "關聯此項目的 bwf_quote" : "關聯此提案的 bwf_quote";
  const emptyHint = isProject
    ? "點擊「建立報價」前往 Furniture 快速報價，並帶入此項目資料"
    : "點擊「建立報價」前往 Furniture 快速報價，並帶入此提案資料";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">傢俬報價 Quote</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Furniture 1000 快速報價 · {linkLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadQuotes}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            重新整理
          </Button>
          {hasCreatePermission && (
            <Button type="button" size="sm" onClick={handleCreate} disabled={!configured}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              建立報價
              <ExternalLink className="w-3 h-3 ml-1.5 opacity-70" />
            </Button>
          )}
        </div>
      </div>

      {!configured ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-6 py-12 text-center">
          <FileText className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            Furniture Supabase 尚未設定（NEXT_PUBLIC_BWF_SUPABASE_URL）
          </p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">載入報價...</span>
        </div>
      ) : quotes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-6 py-12 text-center">
          <FileText className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-1">尚未有關聯報價</p>
          <p className="text-xs text-gray-400 mb-4">{emptyHint}</p>
          {hasCreatePermission && (
            <Button type="button" size="sm" onClick={handleCreate}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              建立報價
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="text-xs">報價單號</TableHead>
                <TableHead className="text-xs">狀態</TableHead>
                <TableHead className="text-xs">版本</TableHead>
                <TableHead className="text-xs text-right">金額</TableHead>
                <TableHead className="text-xs">提交人</TableHead>
                <TableHead className="text-xs">建立日期</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => (
                <TableRow key={q.id} className="hover:bg-gray-50/60">
                  <TableCell className="font-medium text-sm text-gray-900">
                    {q.quote_id}
                  </TableCell>
                  <TableCell>{statusBadge(q.status)}</TableCell>
                  <TableCell className="text-sm text-gray-600">{q.version}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {formatAmount(q.total_amount)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{q.submitter || "—"}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {q.created_at ? formatDate(q.created_at) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
