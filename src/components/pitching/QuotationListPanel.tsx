"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { handleNavClick } from "@/lib/nav-click";
import {
  FileText,
  Plus,
  Calendar,
  Eye,
  Copy,
  MoreHorizontal,
  Trash2,
  Loader2,
  Languages,
  Hash,
  Building2,
  SendHorizontal,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { format } from "date-fns";
import QuotationCreateDialog from "@/components/quotation/QuotationCreateDialog";

// Status workflow transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  Draft: ["Sent"],
  Sent: ["Accepted", "Rejected"],
  Accepted: [],
  Rejected: ["Draft"],
};

interface QuotationRow {
  id: string;
  quotation_no: string | null;
  name: string | null;
  status: string | null;
  date: string | null;
  l_version: string | null;
  version_number: number | null;
  company_name: string | null;
  contact_person: string | null;
  pitching_id: string | null;
  customer_id: string | null;
  cost_centre_id: string | null;
  created_by_id: string | null;
  discount_method: string | null;
  discount_percent: number | null;
  fixed_discount: number | null;
  created_date: string | null;
  modified_date: string | null;
  // Joined
  cost_centre_display?: string | null;
  cost_centre_bu_code?: string | null;
}

interface QuotationListPanelProps {
  pitchingId: string;
  pitchingCode: string | null;
  customerName: string | null;
  customerCompany: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  siteAddress: string | null;
  size: string | null;
  pmName: string | null;
  projectTypeName: string | null;
  customerId: string | null;
}

export default function QuotationListPanel({
  pitchingId,
  pitchingCode,
  customerName,
  customerCompany,
  customerEmail,
  customerPhone,
  customerAddress,
  siteAddress,
  size,
  pmName,
  projectTypeName,
  customerId,
}: QuotationListPanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete } = usePermission();
  const [quotations, setQuotations] = useState<QuotationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const hasCreatePermission = canCreate("proposals.quotation");
  const hasEditPermission = canEdit("proposals.quotation");
  const hasDeletePermission = canDelete("proposals.quotation");

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("quotations")
        .select(`
          id, quotation_no, name, status, date, l_version, version_number,
          company_name, contact_person, pitching_id, customer_id, cost_centre_id,
          created_by_id, discount_method, discount_percent, fixed_discount,
          created_date, modified_date,
          cost_centre:cost_centres!fk_quotations_cost_centre_id(display, bu_code)
        `)
        .eq("pitching_id", pitchingId)
        .order("l_version", { ascending: true })
        .order("version_number", { ascending: false });

      if (error) {
        console.error("[QuotationListPanel] Error fetching:", error.message);
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        const mapped = (data || []).map((row: any) => ({
          ...row,
          cost_centre_display: row.cost_centre?.display || null,
          cost_centre_bu_code: row.cost_centre?.bu_code || null,
        }));
        setQuotations(mapped);
      }
    } catch (err: any) {
      console.error("[QuotationListPanel] Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  }, [pitchingId, toast]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  const getStatusBadge = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "draft":
        return <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">Draft</Badge>;
      case "sent":
        return <Badge className="bg-blue-100 text-blue-600 border-blue-200 text-xs">Sent</Badge>;
      case "accepted":
        return <Badge className="bg-green-100 text-green-600 border-green-200 text-xs">Accepted</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-600 border-red-200 text-xs">Rejected</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-xs">{status || "Draft"}</Badge>;
    }
  };

  const getLanguageBadge = (lang: string | null) => {
    if (lang === "Eng") {
      return <Badge variant="outline" className="text-xs border-indigo-300 text-indigo-600">EN</Badge>;
    }
    return <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">中</Badge>;
  };

  const handleDuplicate = async (quoteId: string) => {
    setDuplicating(quoteId);
    try {
      const supabase = createClient();
      // Fetch the original quotation
      const { data: original, error: fetchErr } = await supabase
        .from("quotations")
        .select("*")
        .eq("id", quoteId)
        .single();

      if (fetchErr || !original) {
        toast({ title: "Error", description: "Failed to fetch quotation", variant: "destructive" });
        return;
      }

      // Calculate next version number
      const sameGroup = quotations.filter(
        (q) => q.l_version === original.l_version
      );
      const nextVersion = Math.max(...sameGroup.map((q) => q.version_number || 0), 0) + 1;

      // Create duplicate
      const { id: _id, bubble_id: _bid, slug: _slug, created_date: _cd, modified_date: _md, ...fields } = original;
      const { data: newQuote, error: insertErr } = await supabase
        .from("quotations")
        .insert({
          ...fields,
          version_number: nextVersion,
          status: "Draft",
          quotation_no: null, // Will be generated later
          created_date: new Date().toISOString(),
          modified_date: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertErr) {
        toast({ title: "Error", description: insertErr.message, variant: "destructive" });
        return;
      }

      // Duplicate sections & items
      if (newQuote) {
        const { data: sections } = await supabase
          .from("quotation_sections")
          .select("*")
          .eq("quotation_id", quoteId)
          .order("order", { ascending: true });

        if (sections && sections.length > 0) {
          for (const section of sections) {
            const { id: _sid, bubble_id: _sbid, slug: _sslug, created_date: _scd, modified_date: _smd, ...sFields } = section;
            const { data: newSection } = await supabase
              .from("quotation_sections")
              .insert({
                ...sFields,
                quotation_id: newQuote.id,
                created_date: new Date().toISOString(),
                modified_date: new Date().toISOString(),
              })
              .select("id")
              .single();

            if (newSection) {
              const { data: items } = await supabase
                .from("quotation_section_items")
                .select("*")
                .eq("section_id", section.id)
                .order("order_number", { ascending: true });

              if (items && items.length > 0) {
                const newItems = items.map((item: Record<string, unknown>) => {
                  const { id: _iid, bubble_id: _ibid, slug: _islug, created_date: _icd, modified_date: _imd, ...iFields } = item;
                  return {
                    ...iFields,
                    section_id: newSection.id,
                    quote_id: newQuote.id,
                    created_date: new Date().toISOString(),
                    modified_date: new Date().toISOString(),
                  };
                });
                await supabase.from("quotation_section_items").insert(newItems);
              }
            }
          }
        }
      }

      toast({ title: "Success", description: "Quotation duplicated as new version" });
      fetchQuotations();
    } catch (err: any) {
      console.error("[QuotationListPanel] Duplicate error:", err);
      toast({ title: "Error", description: "Failed to duplicate", variant: "destructive" });
    } finally {
      setDuplicating(null);
    }
  };

  const handleDelete = async (quoteId: string) => {
    if (!confirm("確定刪除此報價？此操作不可復原。")) return;
    setDeleting(quoteId);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("quotations")
        .delete()
        .eq("id", quoteId);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Deleted", description: "Quotation removed" });
        fetchQuotations();
      }
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const handleCreated = () => {
    setShowCreateDialog(false);
    fetchQuotations();
  };

  const handleStatusChange = async (quoteId: string, currentStatus: string, newStatus: string) => {
    if (!hasEditPermission) {
      toast({ title: "Permission denied", description: "You don't have permission to change quotation status", variant: "destructive" });
      return;
    }
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("quotations")
        .update({ status: newStatus, modified_date: new Date().toISOString() })
        .eq("id", quoteId);
      if (error) throw error;
      toast({ title: "Status updated", description: `Changed to ${newStatus}` });
      fetchQuotations();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Group by language
  const chiQuotes = quotations.filter((q) => q.l_version !== "Eng");
  const engQuotes = quotations.filter((q) => q.l_version === "Eng");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-violet-500" />
          <h3 className="text-base font-semibold text-gray-800">報價管理 Quotations</h3>
          <Badge variant="secondary" className="text-xs">
            {quotations.length}
          </Badge>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreateDialog(true)}
          disabled={!hasCreatePermission}
          className="bg-violet-600 hover:bg-violet-700 text-white gap-1"
          title={!hasCreatePermission ? "You don't have permission to create quotations" : ""}
        >
          <Plus className="w-3.5 h-3.5" />
          New Quotation
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-violet-500 mr-2" />
          <span className="text-sm text-gray-500">Loading quotations...</span>
        </div>
      ) : quotations.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-200">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 mb-1">No quotations yet</p>
            <p className="text-xs text-gray-400 mb-4">
              Create your first quotation for this pitching
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCreateDialog(true)}
              className="gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Quotation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Chinese Quotations */}
          {chiQuotes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium text-gray-700">中文報價</span>
                <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">
                  {chiQuotes.length}
                </Badge>
              </div>
              <div className="grid gap-3">
                {chiQuotes.map((q) => (
                  <QuotationCard
                    key={q.id}
                    quotation={q}
                    onView={(e) =>
                      handleNavClick(
                        `/proposals/${pitchingId}/quotation/${q.id}`,
                        e,
                        (href) => router.push(href)
                      )
                    }
                    onDuplicate={() => handleDuplicate(q.id)}
                    onDelete={() => handleDelete(q.id)}
                    onStatusChange={(newStatus) => handleStatusChange(q.id, q.status || "Draft", newStatus)}
                    duplicating={duplicating === q.id}
                    deleting={deleting === q.id}
                    getStatusBadge={getStatusBadge}
                    getLanguageBadge={getLanguageBadge}
                    hasEditPermission={hasEditPermission}
                    hasDeletePermission={hasDeletePermission}
                  />
                ))}
              </div>
            </div>
          )}

          {/* English Quotations */}
          {engQuotes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-medium text-gray-700">English Quotations</span>
                <Badge variant="outline" className="text-xs border-indigo-300 text-indigo-600">
                  {engQuotes.length}
                </Badge>
              </div>
              <div className="grid gap-3">
                {engQuotes.map((q) => (
                  <QuotationCard
                    key={q.id}
                    quotation={q}
                    onView={(e) =>
                      handleNavClick(
                        `/proposals/${pitchingId}/quotation/${q.id}`,
                        e,
                        (href) => router.push(href)
                      )
                    }
                    onDuplicate={() => handleDuplicate(q.id)}
                    onDelete={() => handleDelete(q.id)}
                    onStatusChange={(newStatus) => handleStatusChange(q.id, q.status || "Draft", newStatus)}
                    duplicating={duplicating === q.id}
                    deleting={deleting === q.id}
                    getStatusBadge={getStatusBadge}
                    getLanguageBadge={getLanguageBadge}
                    hasEditPermission={hasEditPermission}
                    hasDeletePermission={hasDeletePermission}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <QuotationCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        pitchingId={pitchingId}
        pitchingCode={pitchingCode}
        customerName={customerName}
        customerCompany={customerCompany}
        customerEmail={customerEmail}
        customerPhone={customerPhone}
        customerAddress={customerAddress}
        siteAddress={siteAddress}
        size={size}
        pmName={pmName}
        projectTypeName={projectTypeName}
        customerId={customerId}
        existingQuotations={quotations}
        onCreated={handleCreated}
      />
    </div>
  );
}

// ─── QuotationCard Sub-component ────────────────────────────────

interface QuotationCardProps {
  quotation: QuotationRow;
  onView: (e?: React.MouseEvent) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onStatusChange: (newStatus: string) => void;
  duplicating: boolean;
  deleting: boolean;
  getStatusBadge: (status: string | null) => React.ReactNode;
  getLanguageBadge: (lang: string | null) => React.ReactNode;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
}

function QuotationCard({
  quotation,
  onView,
  onDuplicate,
  onDelete,
  onStatusChange,
  duplicating,
  deleting,
  getStatusBadge,
  getLanguageBadge,
  hasEditPermission,
  hasDeletePermission,
}: QuotationCardProps) {
  const currentStatus = quotation.status || "Draft";
  const availableTransitions = STATUS_TRANSITIONS[currentStatus] || [];
  return (
    <Card
      className="group hover:shadow-md transition-all duration-200 hover:border-violet-200 cursor-pointer"
      onClick={onView}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          {/* Left: Info */}
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {/* Version badge */}
            <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-violet-50 border border-violet-100 shrink-0">
              <span className="text-xs text-violet-400 font-medium">v</span>
              <span className="text-lg font-bold text-violet-600 leading-none">
                {quotation.version_number || 1}
              </span>
            </div>

            {/* Details */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-800 truncate">
                  {quotation.quotation_no || quotation.name || `Quotation v${quotation.version_number || 1}`}
                </span>
                {getLanguageBadge(quotation.l_version)}
                {getStatusBadge(quotation.status)}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {quotation.company_name && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {quotation.company_name}
                  </span>
                )}
                {quotation.date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(quotation.date), "yyyy-MM-dd")}
                  </span>
                )}
                {quotation.cost_centre_bu_code && (
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {quotation.cost_centre_bu_code}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={onView}
                  >
                    <Eye className="w-4 h-4 text-gray-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View / Edit</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="w-4 h-4 text-gray-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={onView}>
                  <Eye className="w-4 h-4 mr-2" />
                  Open Editor
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate} disabled={duplicating || !hasEditPermission}>
                  {duplicating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Copy className="w-4 h-4 mr-2" />
                  )}
                  Duplicate as New Version
                </DropdownMenuItem>
                {availableTransitions.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger disabled={!hasEditPermission}>
                        <SendHorizontal className="w-4 h-4 mr-2" />
                        Change Status
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-44">
                        {availableTransitions.map((target) => (
                          <DropdownMenuItem
                            key={target}
                            onClick={() => onStatusChange(target)}
                          >
                            {target === "Sent" && <SendHorizontal className="w-3.5 h-3.5 mr-2 text-blue-500" />}
                            {target === "Accepted" && <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-green-500" />}
                            {target === "Rejected" && <XCircle className="w-3.5 h-3.5 mr-2 text-red-500" />}
                            {target === "Draft" && <RotateCcw className="w-3.5 h-3.5 mr-2 text-gray-500" />}
                            Mark as {target}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  disabled={deleting || !hasDeletePermission}
                  className="text-red-600 focus:text-red-600"
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
