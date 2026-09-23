"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  MessageCircle,
  Send,
  Loader2,
  Star,
  User,
  ChevronDown,
  ChevronUp,
  Trash2,
  Building2,
  Package,
  DollarSign,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import {
  ALL_SUPPLIER_CRITERION_KEYS,
  SUPPLIER_CRITERIA,
  buildSupplierRatingsPayload,
  emptyCriteriaValues,
  extractCriteriaFromRow,
  filledCriteriaEntries,
  type CriteriaValues,
  type RatingCriterionKey,
} from "@/lib/comment-rating-criteria";
import {
  CriteriaRatingDisplay,
  CriteriaRatingForm,
} from "@/components/comments/CriteriaRatingForm";

// ─── TYPES ────────────────────────────────────────────────

interface SupplierGroup {
  supplierId: string;
  supplierName: string;
  totalExpense: number;
  expenseCount: number;
  supplierTypes: string[]; // unique resolved type names from expenses
}

interface SupplierComment {
  id: string;
  comment: string | null;
  point: number | null;
  created_date: string | null;
  evaluator_id: string | null;
  evaluator_name: string | null;
  evaluator_position: string | null;
  supplier_id: string | null;
  criteria: CriteriaValues;
}

interface SupplierCommentPanelProps {
  projectId: string; // UUID of bwa_projects or bwf_projects
  /** Override the permission module used for CRUD checks. Defaults to "projects". */
  permissionModule?: string;
  /** Which project system — switches FK on expenses / staff_supplier_comments. */
  variant?: "bwa" | "bwf";
}

// ─── HELPERS ──────────────────────────────────────────────

import { formatTimestamp as formatDate } from "@/lib/date-utils";

// ─── SUPPLIER CARD ─────────────────────────────────────

function SupplierCommentCard({
  supplier,
  comments,
  currentStaffId,
  currentUserId,
  projectId,
  projectCol,
  onCommentAdded,
  onCommentDeleted,
  _canCreate,
  _canDelete,
}: {
  supplier: SupplierGroup;
  comments: SupplierComment[];
  currentStaffId: string | null;
  currentUserId: string | null;
  projectId: string;
  projectCol: "project_id" | "bwf_project_id";
  onCommentAdded: () => void;
  onCommentDeleted: () => void;
  _canCreate: boolean;
  _canDelete: boolean;
}) {
  const { formatMoney } = useFinancialFormat();
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentPoint, setCommentPoint] = useState<number | null>(null);
  const [commentCriteria, setCommentCriteria] = useState<CriteriaValues>(() =>
    emptyCriteriaValues(ALL_SUPPLIER_CRITERION_KEYS)
  );
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const supabase = createClient();

  const myComments = comments.filter((c) => c.evaluator_id === currentStaffId);
  const otherComments = comments.filter((c) => c.evaluator_id !== currentStaffId);

  // Calculate average rating
  const ratedComments = comments.filter((c) => c.point != null);
  const avgRating =
    ratedComments.length > 0
      ? ratedComments.reduce((sum, c) => sum + (c.point || 0), 0) /
        ratedComments.length
      : null;

  const handleSubmit = async () => {
    if (!currentStaffId || !commentText.trim()) return;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const ratings = buildSupplierRatingsPayload(commentCriteria);
      const { error } = await supabase.from("staff_supplier_comments").insert({
        [projectCol]: projectId,
        supplier_id: supplier.supplierId,
        evaluator_id: currentStaffId,
        created_by_id: currentUserId,
        comment: commentText.trim(),
        point: commentPoint,
        ...ratings,
        created_date: now,
        modified_date: now,
      });

      if (error) {
        console.error("[SupplierCommentPanel] insert error:", error);
        return;
      }

      setCommentText("");
      setCommentPoint(null);
      setCommentCriteria(emptyCriteriaValues(ALL_SUPPLIER_CRITERION_KEYS));
      setShowForm(false);
      onCommentAdded();
    } catch (err) {
      console.error("[SupplierCommentPanel] handleSubmit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!currentStaffId) return;
    const confirmed = window.confirm("確定要刪除此評論嗎？此操作無法撤銷。");
    if (!confirmed) return;

    setDeletingId(commentId);
    try {
      const { error } = await supabase
        .from("staff_supplier_comments")
        .delete()
        .eq("id", commentId)
        .eq("evaluator_id", currentStaffId);

      if (error) {
        console.error("[SupplierCommentPanel] delete error:", error);
        return;
      }
      onCommentDeleted();
    } catch (err) {
      console.error("[SupplierCommentPanel] handleDelete error:", err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="border border-gray-100 shadow-sm overflow-hidden">
      {/* Supplier Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-800">
                  {supplier.supplierName}
                </p>
                {supplier.supplierTypes.map((typeName) => (
                  <Badge
                    key={typeName}
                    variant="outline"
                    className="text-[12px] bg-teal-50 border-teal-200 text-teal-700 font-normal px-1.5 py-0"
                  >
                    {typeName}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[13px] text-gray-400 flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  {supplier.expenseCount} 筆支出
                </span>
                <span className="text-[13px] text-gray-400 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  {formatMoney(supplier.totalExpense)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Rating badge */}
            {avgRating != null && (
              <div className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="text-xs font-medium text-amber-600">
                  {avgRating.toFixed(1)}
                </span>
              </div>
            )}
            {/* Comment count badge */}
            <Badge
              variant="outline"
              className={`text-[12px] ${
                comments.length > 0
                  ? "bg-violet-50 border-violet-200 text-violet-600"
                  : "bg-gray-50 border-gray-200 text-gray-400"
              }`}
            >
              <MessageCircle className="w-3 h-3 mr-1" />
              {comments.length}
            </Badge>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-gray-300" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-300" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* All comments from other staff */}
          {otherComments.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-violet-400" />
                其他同事的評論 ({otherComments.length})
              </p>
              <div className="space-y-2.5">
                {otherComments.map((c) => (
                  <div
                    key={c.id}
                    className="bg-violet-50/30 rounded-lg border border-violet-100/50 p-3"
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center">
                          <User className="w-3 h-3 text-violet-500" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-700">
                            {c.evaluator_name || "未知職員"}
                          </p>
                          {c.evaluator_position && (
                            <p className="text-[12px] text-gray-400">
                              {c.evaluator_position}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] text-gray-400">
                          {formatDate(c.created_date)}
                        </p>
                      </div>
                    </div>
                    <div className="pl-8 space-y-1.5">
                      <CriteriaRatingDisplay
                        entries={filledCriteriaEntries(c.criteria, SUPPLIER_CRITERIA)}
                        overall={c.point}
                      />
                      <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                        {c.comment || "-"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* My comments */}
          {myComments.length > 0 && (
            <div className="px-5 py-4 border-t border-gray-50">
              <p className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-blue-400" />
                我的評論 ({myComments.length})
              </p>
              <div className="space-y-2.5">
                {myComments.map((c) => (
                  <div
                    key={c.id}
                    className="group bg-blue-50/30 rounded-lg border border-blue-100/50 p-3"
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="w-3 h-3 text-blue-500" />
                        </div>
                        <p className="text-xs font-medium text-blue-700">
                          我
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="text-right">
                          <p className="text-[12px] text-gray-400">
                            {formatDate(c.created_date)}
                          </p>
                        </div>
                        {_canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          disabled={deletingId === c.id}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 disabled:opacity-50"
                          title="刪除評論"
                        >
                          {deletingId === c.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </button>
                        )}
                      </div>
                    </div>
                    <div className="pl-8 space-y-1.5">
                      <CriteriaRatingDisplay
                        entries={filledCriteriaEntries(c.criteria, SUPPLIER_CRITERIA)}
                        overall={c.point}
                      />
                      <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                        {c.comment || "-"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state — no comments at all */}
          {comments.length === 0 && !showForm && (
            <div className="px-5 py-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                <MessageCircle className="w-6 h-6 text-gray-200" />
              </div>
              <p className="text-xs text-gray-400 mb-1">尚無評論</p>
              <p className="text-[12px] text-gray-300">
                點擊下方按鈕新增第一則評論
              </p>
            </div>
          )}

          {/* Add comment button / form */}
          {_canCreate && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/30">
            {showForm ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-500">
                    新增評論 — {supplier.supplierName}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowForm(false);
                      setCommentText("");
                      setCommentPoint(null);
                      setCommentCriteria(
                        emptyCriteriaValues(ALL_SUPPLIER_CRITERION_KEYS)
                      );
                    }}
                    className="h-6 text-[12px] text-gray-400 hover:text-gray-600"
                  >
                    取消
                  </Button>
                </div>
                <div className="space-y-2">
                  <label className="text-[12px] font-medium text-gray-400">
                    評分（可選）
                  </label>
                  <CriteriaRatingForm
                    criteria={SUPPLIER_CRITERIA}
                    values={commentCriteria}
                    overall={commentPoint}
                    onChangeCriterion={(key: RatingCriterionKey, val) =>
                      setCommentCriteria((prev) => ({ ...prev, [key]: val }))
                    }
                    onChangeOverall={setCommentPoint}
                  />
                </div>
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="輸入您對此供應商的評論..."
                  className="min-h-[72px] text-sm resize-none"
                  autoFocus
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={submitting || !commentText.trim()}
                    className="gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs"
                  >
                    {submitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    提交評論
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowForm(true)}
                disabled={!currentStaffId}
                className="w-full gap-1.5 text-xs border-dashed border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                新增評論
              </Button>
            )}
          </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────

export default function SupplierCommentPanel({
  projectId,
  permissionModule = "projects",
  variant = "bwa",
}: SupplierCommentPanelProps) {
  const projectCol = variant === "bwf" ? "bwf_project_id" : "project_id";
  const { canCreate: canCreatePerm, canDelete: canDeletePerm } = usePermission();
  const _canCreate = canCreatePerm(permissionModule);
  const _canDelete = canDeletePerm(permissionModule);

  const [supplierGroups, setSupplierGroups] = useState<SupplierGroup[]>([]);
  const [comments, setComments] = useState<SupplierComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const supabase = createClient();

  // ─── Resolve current user → staff ──────────────────────

  const resolveCurrentUser = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) return;

      const email = user.email.toLowerCase().trim();

      // Get users record
      const { data: userRecord } = await supabase
        .from("users")
        .select("id, member_id, member")
        .eq("email", email)
        .maybeSingle();

      if (!userRecord) {
        // fallback ilike
        const { data: userRecordIlike } = await supabase
          .from("users")
          .select("id, member_id, member")
          .ilike("email", email)
          .maybeSingle();
        if (userRecordIlike) {
          setCurrentUserId(userRecordIlike.id);
          setCurrentStaffId(userRecordIlike.member_id);
        }
      } else {
        setCurrentUserId(userRecord.id);
        setCurrentStaffId(userRecord.member_id);
      }
    } catch (err) {
      console.error("[SupplierCommentPanel] resolveCurrentUser error:", err);
    }
  }, [supabase]);

  // ─── Load suppliers from expenses ──────────────────────

  const loadSupplierGroups = useCallback(async () => {
    try {
      // Fetch all expenses for this project
      const { data: expenseData, error: expErr } = await supabase
        .from("expenses")
        .select("supplier_id, installment_amount, paid_amount, outstanding, n_supplier_type_id")
        .eq(projectCol, projectId);

      if (expErr) {
        console.warn("[SupplierCommentPanel] expense query error:", expErr.message);
        return;
      }

      if (!expenseData || expenseData.length === 0) {
        setSupplierGroups([]);
        return;
      }

      // Group by supplier_id
      const supplierMap = new Map<
        string,
        { total: number; count: number; typeIds: Set<string> }
      >();

      expenseData.forEach((exp: any) => {
        if (!exp.supplier_id) return;
        const existing = supplierMap.get(exp.supplier_id) || {
          total: 0,
          count: 0,
          typeIds: new Set<string>(),
        };
        existing.total += exp.installment_amount || 0;
        existing.count += 1;
        if (exp.n_supplier_type_id) {
          existing.typeIds.add(exp.n_supplier_type_id);
        }
        supplierMap.set(exp.supplier_id, existing);
      });

      if (supplierMap.size === 0) {
        setSupplierGroups([]);
        return;
      }

      // Fetch supplier names
      const supplierIds = Array.from(supplierMap.keys());
      const { data: supData } = await supabase
        .from("suppliers")
        .select("id, name, display_name")
        .in("id", supplierIds);

      const nameMap = new Map<string, string>(
        (supData || []).map((s: any) => [
          s.id,
          s.display_name || s.name || "未知供應商",
        ])
      );

      // Collect all unique supplier type IDs across all suppliers
      const allTypeIds = new Set<string>();
      supplierMap.forEach((stats) => {
        stats.typeIds.forEach((tid) => allTypeIds.add(tid));
      });

      // Fetch supplier type display names
      let typeNameMap = new Map<string, string>();
      if (allTypeIds.size > 0) {
        const { data: stData } = await supabase
          .from("supplier_types")
          .select("id, display, chinese_display")
          .in("id", Array.from(allTypeIds));
        typeNameMap = new Map(
          (stData || []).map((st: any) => [
            st.id,
            st.chinese_display || st.display || "未知類型",
          ])
        );
      }

      const groups: SupplierGroup[] = Array.from(supplierMap.entries())
        .map(([id, stats]) => ({
          supplierId: id,
          supplierName: nameMap.get(id) || "未知供應商",
          totalExpense: stats.total,
          expenseCount: stats.count,
          supplierTypes: Array.from(stats.typeIds)
            .map((tid) => typeNameMap.get(tid) || "未知類型")
            .sort(),
        }))
        .sort((a, b) => b.totalExpense - a.totalExpense);

      setSupplierGroups(groups);
    } catch (err) {
      console.error("[SupplierCommentPanel] loadSupplierGroups error:", err);
    }
  }, [projectId, projectCol, supabase]);

  // ─── Load all comments for this project ────────────────

  const loadComments = useCallback(async () => {
    try {
      const { data: commentRows, error } = await supabase
        .from("staff_supplier_comments")
        .select(
          "id, comment, point, created_date, evaluator_id, supplier_id, rating_time_management, rating_professional_skill, rating_service_attitude"
        )
        .eq(projectCol, projectId)
        .order("created_date", { ascending: false });

      if (error) {
        console.warn("[SupplierCommentPanel] comments query error:", error.message);
        return;
      }

      if (!commentRows || commentRows.length === 0) {
        setComments([]);
        return;
      }

      // Resolve evaluator names
      const evalIds = [
        ...new Set(commentRows.map((c: any) => c.evaluator_id).filter(Boolean)),
      ] as string[];

      let staffMap = new Map<
        string,
        { name: string | null; position: string | null }
      >();

      if (evalIds.length > 0) {
        const { data: staffRecords } = await supabase
          .from("staff")
          .select("id, name, full_name, position")
          .in("id", evalIds);

        staffMap = new Map(
          (staffRecords || []).map((s: any) => [
            s.id,
            { name: s.full_name || s.name, position: s.position },
          ])
        );
      }

      const enriched: SupplierComment[] = commentRows.map((c: any) => ({
        id: c.id,
        comment: c.comment,
        point: c.point,
        created_date: c.created_date,
        evaluator_id: c.evaluator_id,
        evaluator_name: c.evaluator_id
          ? staffMap.get(c.evaluator_id)?.name || null
          : null,
        evaluator_position: c.evaluator_id
          ? staffMap.get(c.evaluator_id)?.position || null
          : null,
        supplier_id: c.supplier_id,
        criteria: extractCriteriaFromRow(c, ALL_SUPPLIER_CRITERION_KEYS),
      }));

      setComments(enriched);
    } catch (err) {
      console.error("[SupplierCommentPanel] loadComments error:", err);
    }
  }, [projectId, projectCol, supabase]);

  // ─── Initialize ────────────────────────────────────────

  useEffect(() => {
    resolveCurrentUser();
  }, [resolveCurrentUser]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadSupplierGroups(), loadComments()]);
      setLoading(false);
    };
    init();
  }, [loadSupplierGroups, loadComments]);

  // ─── Get comments for a specific supplier ──────────────

  const getCommentsForSupplier = (supplierId: string) =>
    comments.filter((c) => c.supplier_id === supplierId);

  // ─── RENDER ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        <span className="ml-2 text-sm text-gray-400">載入中...</span>
      </div>
    );
  }

  if (!currentStaffId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
          <User className="w-8 h-8 text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-400 mb-1">
          無法識別目前登入用戶
        </p>
        <p className="text-xs text-gray-300">
          請確認已登入系統並且帳號已關聯職員資料
        </p>
      </div>
    );
  }

  if (supplierGroups.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-gray-200" />
          </div>
          <p className="text-sm font-medium text-gray-400 mb-1">
            尚無關聯供應商
          </p>
          <p className="text-xs text-gray-300">
            此項目目前沒有任何支出記錄對應的供應商，請先在支出分頁新增支出
          </p>
        </div>
      </div>
    );
  }

  // Summary stats
  const totalComments = comments.length;
  const uniqueEvaluators = new Set(
    comments.map((c) => c.evaluator_id).filter(Boolean)
  ).size;
  const ratedComments = comments.filter((c) => c.point != null);
  const avgRating =
    ratedComments.length > 0
      ? ratedComments.reduce((sum, c) => sum + (c.point || 0), 0) /
        ratedComments.length
      : null;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-800">
                {supplierGroups.length}
              </p>
              <p className="text-[13px] text-gray-400">關聯供應商</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-violet-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-800">
                {totalComments}
              </p>
              <p className="text-[13px] text-gray-400">評論總數</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-800">
                {uniqueEvaluators}
              </p>
              <p className="text-[13px] text-gray-400">評論人數</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <Star className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-800">
                {avgRating != null ? avgRating.toFixed(1) : "-"}
              </p>
              <p className="text-[13px] text-gray-400">平均評分</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-lg px-4 py-3">
        <p className="text-xs text-blue-600">
          💡 <strong>提示：</strong>
          以下列出此項目所有關聯供應商（依支出記錄），展開可查看所有同事的評論或新增您的評論。
        </p>
      </div>

      {/* Supplier Cards */}
      <div className="space-y-3">
        {supplierGroups.map((supplier) => (
          <SupplierCommentCard
            key={supplier.supplierId}
            supplier={supplier}
            comments={getCommentsForSupplier(supplier.supplierId)}
            currentStaffId={currentStaffId}
            currentUserId={currentUserId}
            projectId={projectId}
            projectCol={projectCol}
            onCommentAdded={loadComments}
            onCommentDeleted={loadComments}
            _canCreate={_canCreate}
            _canDelete={_canDelete}
          />
        ))}
      </div>

      {/* Footer info */}
      <div className="bg-amber-50/50 border border-amber-100 rounded-lg px-4 py-3">
        <p className="text-xs text-amber-600">
          💡 <strong>注意：</strong>
          您可以查看所有同事對供應商的評論，但只能刪除自己發送的評論。評分會影響供應商的整體評級。
        </p>
      </div>
    </div>
  );
}
