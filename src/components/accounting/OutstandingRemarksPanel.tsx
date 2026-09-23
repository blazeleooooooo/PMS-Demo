"use client";

import React, { useEffect, useState } from "react";
import { Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import { useFinancialFormat } from "@/hooks/use-financial-format";

export interface OutstandingRemarksGroup {
  project_id: string | null;
  bw_type: "BWA" | "BWF";
  project_name?: string | null;
  project_code?: string | null;
  contract_type_label?: string | null;
  n_contract_type_id?: string | null;
}

export interface OutstandingRemarksPanelProps {
  group: OutstandingRemarksGroup;
  supabase?: any;
  title?: string;
  emptyText?: string;
  placeholder?: string;
  onChanged?: () => void;
}

interface RemarkMessage {
  id: string;
  outstanding_remark: string | null;
  invoice_number: string | null;
  contract_type_label: string | null;
  income_amount: number | null;
  due_date: string | null;
  created_date: string | null;
  creator_name: string | null;
  created_by_id: string | null;
}

function fmtDate(d: string | null): string {
  if (!d) return "-";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString("zh-HK", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return d;
  }
}

function groupSubtitle(group: OutstandingRemarksGroup): string {
  const parts = [
    group.project_name || group.project_code,
    group.contract_type_label,
  ].filter((part): part is string => !!part);
  return parts.join(" · ") || "-";
}

export function OutstandingRemarksPanel({
  group,
  supabase: supabaseProp,
  title = "會計備註",
  emptyText = "暫無會計備註",
  placeholder = "輸入會計備註...",
  onChanged,
}: OutstandingRemarksPanelProps) {
  const supabase = supabaseProp ?? createClient();
  const { formatMoney } = useFinancialFormat();
  const [remarks, setRemarks] = useState<RemarkMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRemark, setNewRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentPublicUserId, setCurrentPublicUserId] = useState<string | null>(null);
  const [currentUserBubbleId, setCurrentUserBubbleId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    async function getUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) return;

        setCurrentUserId(user.id);
        const email = user.email?.toLowerCase().trim();

        let memberId: string | null = null;
        let memberBubbleId: string | null = null;
        let userBubbleId: string | null = null;
        let publicUserId: string | null = null;

        if (email) {
          const { data: userRecord } = await supabase
            .from("users")
            .select("id, bubble_id, member_id, member")
            .ilike("email", email)
            .maybeSingle();
          if (userRecord) {
            publicUserId = userRecord.id;
            memberId = userRecord.member_id;
            memberBubbleId = userRecord.member;
            userBubbleId = userRecord.bubble_id;
          }
        }

        if (publicUserId) {
          setCurrentPublicUserId(publicUserId);
        }
        if (userBubbleId) {
          setCurrentUserBubbleId(userBubbleId);
        }

        if (memberId) {
          const { data: staffRecord } = await supabase
            .from("staff")
            .select("name, full_name")
            .eq("id", memberId)
            .maybeSingle();
          if (staffRecord) {
            const name = staffRecord.full_name || staffRecord.name;
            if (name) {
              setCurrentUserName(name);
              return;
            }
          }
        }

        if (memberBubbleId) {
          const { data: staffRecord } = await supabase
            .from("staff")
            .select("name, full_name")
            .eq("bubble_id", memberBubbleId)
            .maybeSingle();
          if (staffRecord) {
            const name = staffRecord.full_name || staffRecord.name;
            if (name) {
              setCurrentUserName(name);
              return;
            }
          }
        }

        if (email) {
          const { data: staffByEmail } = await supabase
            .from("staff")
            .select("name, full_name")
            .ilike("email", email)
            .maybeSingle();
          if (staffByEmail) {
            const name = staffByEmail.full_name || staffByEmail.name;
            if (name) {
              setCurrentUserName(name);
              return;
            }
          }
        }
      } catch (err) {
        console.error("[AccountingRemarks] getUser error:", err);
      }
    }
    getUser();
  }, [supabase]);

  useEffect(() => {
    async function fetchRemarks() {
      setLoading(true);
      try {
        if (!group.project_id) {
          setRemarks([]);
          return;
        }

        let query = supabase
          .from("outstanding_remarks")
          .select("id, remarks, project_id, bwf_project_id, n_contract_type_id, created_date, created_by, created_by_id")
          .order("created_date", { ascending: false });

        query = group.bw_type === "BWF"
          ? query.eq("bwf_project_id", group.project_id)
          : query.eq("project_id", group.project_id);

        if (group.n_contract_type_id) {
          query = query.eq("n_contract_type_id", group.n_contract_type_id);
        }

        const { data, error } = await query.limit(200);

        if (error) {
          console.error("[AccountingRemarks] Fetch error:", error.message);
          return;
        }

        const filtered = (data || []).filter((r: any) => !!r.remarks?.trim());

        const creatorIds = [...new Set(filtered.map((r: any) => r.created_by_id).filter(Boolean))];
        const creatorByValues = [...new Set(filtered.map((r: any) => r.created_by).filter(Boolean))];
        const creatorNameMap: Record<string, string> = {};

        if (creatorIds.length > 0) {
          const { data: usersData } = await supabase
            .from("users")
            .select("id, member_id")
            .in("id", creatorIds);

          if (usersData && usersData.length > 0) {
            const memberIds = usersData.map((u: any) => u.member_id).filter(Boolean);
            if (memberIds.length > 0) {
              const { data: staffData } = await supabase
                .from("staff")
                .select("id, name, full_name")
                .in("id", memberIds);

              if (staffData) {
                const memberNameMap: Record<string, string> = {};
                for (const s of staffData) {
                  memberNameMap[s.id] = s.full_name || s.name || "";
                }
                for (const u of usersData) {
                  if (u.member_id && memberNameMap[u.member_id]) {
                    creatorNameMap[u.id] = memberNameMap[u.member_id];
                  }
                }
              }
            }
          }

          const unresolvedIds = creatorIds.filter((id) => !creatorNameMap[id as string]);
          if (unresolvedIds.length > 0) {
            const { data: staffDirect } = await supabase
              .from("staff")
              .select("id, name, full_name")
              .in("id", unresolvedIds);

            if (staffDirect) {
              for (const s of staffDirect) {
                creatorNameMap[s.id] = s.full_name || s.name || "";
              }
            }
          }
        }

        const unresolvedBy = creatorByValues.filter((v) => !creatorNameMap[v as string]);
        if (unresolvedBy.length > 0) {
          const { data: staffById } = await supabase
            .from("staff")
            .select("id, name, full_name")
            .in("id", unresolvedBy);
          if (staffById) {
            for (const s of staffById) {
              creatorNameMap[s.id] = s.full_name || s.name || "";
            }
          }
        }

        const withRemarks: RemarkMessage[] = filtered.map((r: any) => ({
          id: r.id,
          outstanding_remark: r.remarks,
          invoice_number: null,
          contract_type_label: group.contract_type_label ?? null,
          income_amount: null,
          due_date: null,
          created_date: r.created_date,
          creator_name: creatorNameMap[r.created_by_id] || creatorNameMap[r.created_by] || null,
          created_by_id: r.created_by_id || r.created_by || null,
        }));

        setRemarks(withRemarks);
      } catch (err) {
        console.error("[AccountingRemarks] Error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchRemarks();
  }, [group.project_id, group.bw_type, group.n_contract_type_id, group.contract_type_label, supabase]);

  const handleSendRemark = async () => {
    const text = newRemark.trim();
    if (!text) return;
    if (!group.project_id) {
      console.error("[AccountingRemarks] Cannot send: no project_id");
      setSendError("無法發送：缺少項目ID");
      return;
    }
    setSaving(true);
    setSendError(null);
    try {
      const insertData: Record<string, any> = {
        remarks: text,
        created_date: new Date().toISOString(),
      };

      if (group.bw_type === "BWF") {
        insertData.bwf_project_id = group.project_id;
      } else {
        insertData.project_id = group.project_id;
      }

      if (group.n_contract_type_id) {
        insertData.n_contract_type_id = group.n_contract_type_id;
      }

      if (currentPublicUserId) {
        insertData.created_by_id = currentPublicUserId;
      } else if (currentUserBubbleId) {
        insertData.created_by_id = currentUserBubbleId;
      }

      const { data: insertedData, error } = await supabase
        .from("outstanding_remarks")
        .insert(insertData)
        .select("id")
        .single();

      if (error) {
        console.error("[AccountingRemarks] Failed to save remark:", error.message, error.details, error.hint);
        setSendError(`儲存失敗: ${error.message}`);
      } else {
        setRemarks((prev) => [
          {
            id: insertedData?.id || `group-remark-${Date.now()}`,
            outstanding_remark: text,
            invoice_number: null,
            contract_type_label: group.contract_type_label ?? null,
            income_amount: null,
            due_date: null,
            created_date: new Date().toISOString(),
            creator_name: "我",
            created_by_id: currentPublicUserId || currentUserBubbleId || currentUserId,
          },
          ...prev,
        ]);
        setNewRemark("");
        onChanged?.();
      }
    } catch (err) {
      console.error("[AccountingRemarks] Remark save error:", err);
      setSendError("備註儲存失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRemark = async (remarkId: string) => {
    if (!remarkId || remarkId.startsWith("group-remark-")) {
      setRemarks((prev) => prev.filter((r) => r.id !== remarkId));
      onChanged?.();
      return;
    }
    setDeletingId(remarkId);
    try {
      const { error } = await supabase
        .from("outstanding_remarks")
        .delete()
        .eq("id", remarkId);

      if (error) {
        console.error("Failed to delete remark:", error);
      } else {
        setRemarks((prev) => prev.filter((r) => r.id !== remarkId));
        onChanged?.();
      }
    } catch (err) {
      console.error("Remark delete error:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const isOwnRemark = (msg: RemarkMessage) => {
    if (msg.creator_name === "我") return true;
    if (currentPublicUserId && msg.created_by_id === currentPublicUserId) return true;
    if (currentUserId && msg.created_by_id === currentUserId) return true;
    if (currentUserBubbleId && msg.created_by_id === currentUserBubbleId) return true;
    if (currentUserName && msg.creator_name === currentUserName) return true;
    return false;
  };

  return (
    <div className="w-[320px] flex-shrink-0 border border-gray-200 rounded-lg bg-white flex flex-col">
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs font-medium text-gray-700">{title}</span>
          <Badge variant="secondary" className="text-[11px] px-1 py-0 ml-auto">
            {remarks.length}
          </Badge>
        </div>
        <div className="text-[12px] text-gray-400 mt-0.5">
          {groupSubtitle(group)}
        </div>
      </div>

      <ScrollArea className="flex-1 max-h-[250px] min-h-[120px]">
        <div className="px-3 py-2 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-16">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
            </div>
          ) : remarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-16 text-gray-400">
              <MessageSquare className="w-5 h-5 mb-1 opacity-30" />
              <span className="text-[12px]">{emptyText}</span>
            </div>
          ) : (
            remarks.map((msg) => (
              <div key={msg.id} className={`rounded-lg p-2 relative ${isOwnRemark(msg) ? "bg-emerald-50 border border-emerald-100" : "bg-blue-50 border border-blue-100"}`}>
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  {isOwnRemark(msg) ? (
                    <span className="text-[11px] font-medium text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      我
                    </span>
                  ) : msg.creator_name ? (
                    <span className="text-[11px] font-medium text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                      {msg.creator_name}
                    </span>
                  ) : null}
                  {msg.invoice_number && (
                    <Badge variant="outline" className="text-[11px] px-1 py-0 border-blue-200 text-blue-600">
                      #{msg.invoice_number}
                    </Badge>
                  )}
                  {msg.income_amount && (
                    <span className="text-[11px] text-gray-500 font-mono">{formatMoney(msg.income_amount)}</span>
                  )}
                  {msg.created_date && (
                    <span className="text-[11px] text-gray-400 ml-auto">{fmtDate(msg.created_date)}</span>
                  )}
                  {isOwnRemark(msg) && (
                    <button
                      onClick={() => handleDeleteRemark(msg.id)}
                      disabled={deletingId === msg.id}
                      className="ml-1 p-0.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                      title="刪除備註"
                    >
                      {deletingId === msg.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
                <p className="text-[13px] text-gray-700 leading-relaxed">{msg.outstanding_remark}</p>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="px-3 py-2 border-t border-gray-100 space-y-1">
        {sendError && (
          <div className="text-[11px] text-red-500 px-1">{sendError}</div>
        )}
        <div className="flex items-center gap-1.5">
          <Input
            value={newRemark}
            onChange={(e) => { setNewRemark(e.target.value); setSendError(null); }}
            placeholder={placeholder}
            className="h-7 text-[13px] flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendRemark();
              }
            }}
          />
          <Button
            variant="default"
            size="sm"
            className="h-7 w-7 p-0 flex-shrink-0"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSendRemark(); }}
            disabled={saving || !newRemark.trim()}
            type="button"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OutstandingRemarksPopover({
  projectId,
  projectName,
  projectCode,
  title = "收款備註",
  emptyText = "暫無收款備註",
  placeholder = "輸入收款備註...",
  onChanged,
  children,
}: {
  projectId: string;
  projectName?: string | null;
  projectCode?: string | null;
  title?: string;
  emptyText?: string;
  placeholder?: string;
  onChanged?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] p-0 border-0 shadow-none bg-transparent"
        align="end"
        side="left"
        sideOffset={8}
        onClick={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <OutstandingRemarksPanel
          group={{
            project_id: projectId,
            bw_type: "BWF",
            project_name: projectName,
            project_code: projectCode,
          }}
          title={title}
          emptyText={emptyText}
          placeholder={placeholder}
          onChanged={onChanged}
        />
      </PopoverContent>
    </Popover>
  );
}
