"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Send,
  Loader2,
  User,
  Search,
  X,
  ChevronDown,
  Plus,
  Trash2,
  Pencil,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { usePermission } from "@/hooks/use-permission";
import { useAuth } from "@/hooks/use-auth";
import {
  ALL_INTERNAL_CRITERION_KEYS,
  buildInternalRatingsPayload,
  criteriaForInternalRole,
  emptyCriteriaValues,
  extractCriteriaFromRow,
  filledCriteriaEntries,
  resolveInternalRatingRole,
  type CriteriaValues,
  type RatingCriterionKey,
} from "@/lib/comment-rating-criteria";
import {
  CriteriaRatingDisplay,
  CriteriaRatingForm,
} from "@/components/comments/CriteriaRatingForm";

// ─── TYPES ────────────────────────────────────────────────

interface StaffOption {
  id: string;
  name: string;
  full_name: string | null;
  position: string | null;
  isDefault: boolean; // from pitching_bv
}

interface InternalComment {
  id: string;
  comment: string | null;
  point: number | null;
  created_date: string | null;
  staff_id: string | null;
  staff_name: string | null;
  staff_position: string | null;
  evaluator_id: string | null;
  evaluator_name: string | null;
  criteria: CriteriaValues;
}

interface InternalCommentPanelProps {
  pitchingId: string; // UUID of bwa_pitchings (or bwf_pitchings when variant="bwf")
  /** Override the permission module used for CRUD checks. Defaults to "proposals.internal-comment". */
  permissionModule?: string;
  /** Which pitching system this belongs to. Switches the FK column used on
   *  pitching_bv / internal_comments between pitching_id and bwf_pitching_id. */
  variant?: "bwa" | "bwf";
}

// ─── HELPERS ──────────────────────────────────────────────

import { formatTimestamp as formatDate } from "@/lib/date-utils";

// ─── MAIN COMPONENT ───────────────────────────────────────

export default function InternalCommentPanel({
  pitchingId,
  permissionModule = "proposals.internal-comment",
  variant = "bwa",
}: InternalCommentPanelProps) {
  // FK column on pitching_bv / internal_comments that links to the pitching.
  const pitchingCol = variant === "bwf" ? "bwf_pitching_id" : "pitching_id";
  const { canCreate: canCreatePerm, canDelete: canDeletePerm } = usePermission();
  const { staff } = useAuth();
  const _canCreate = canCreatePerm(permissionModule);
  const _canDelete = canDeletePerm(permissionModule);
  const isSuperAdmin = (staff as any)?.role === "Super Admin";

  const [comments, setComments] = useState<InternalComment[]>([]);
  const [defaultStaff, setDefaultStaff] = useState<StaffOption[]>([]);
  const [allStaff, setAllStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit mode state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editComment, setEditComment] = useState("");
  const [editPoint, setEditPoint] = useState<number | null>(null);
  const [editCriteria, setEditCriteria] = useState<CriteriaValues>(() =>
    emptyCriteriaValues(ALL_INTERNAL_CRITERION_KEYS)
  );
  const [savingEdit, setSavingEdit] = useState(false);

  // Current user info
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // New comment form
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentPoint, setCommentPoint] = useState<number | null>(null);
  const [commentCriteria, setCommentCriteria] = useState<CriteriaValues>(() =>
    emptyCriteriaValues(ALL_INTERNAL_CRITERION_KEYS)
  );

  const selectedStaffPosition =
    defaultStaff.find((s) => s.id === selectedStaffId)?.position ??
    allStaff.find((s) => s.id === selectedStaffId)?.position ??
    null;
  const selectedRole = resolveInternalRatingRole(selectedStaffPosition);
  const selectedCriteriaDefs = criteriaForInternalRole(selectedRole);

  // Staff search
  const [staffSearch, setStaffSearch] = useState("");
  const [showStaffPopover, setShowStaffPopover] = useState(false);
  const [filteredSearchStaff, setFilteredSearchStaff] = useState<StaffOption[]>([]);

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
      console.error("[InternalCommentPanel] resolveCurrentUser error:", err);
    }
  }, [supabase]);

  // ─── Load default staff from pitching_bv ───────────────

  const loadDefaultStaff = useCallback(async () => {
    try {
      // Get pitching_bv rows where pitching_id matches this pitching UUID
      const { data: bvRows } = await supabase
        .from("pitching_bv")
        .select("handler_id")
        .eq(pitchingCol, pitchingId) as { data: { handler_id: string | null }[] | null };

      if (!bvRows || bvRows.length === 0) return [];

      // Get unique handler IDs
      const handlerIds = [
        ...new Set(bvRows.map((r) => r.handler_id).filter(Boolean)),
      ] as string[];

      if (handlerIds.length === 0) return [];

      // Fetch staff details
      const { data: staffRecords } = await supabase
        .from("staff")
        .select("id, name, full_name, position")
        .in("id", handlerIds) as { data: { id: string; name: string | null; full_name: string | null; position: string | null }[] | null };

      const staffList: StaffOption[] = (staffRecords || []).map((s) => ({
        id: s.id,
        name: s.name || "Unknown",
        full_name: s.full_name,
        position: s.position,
        isDefault: true,
      }));

      setDefaultStaff(staffList);
      return staffList;
    } catch (err) {
      console.error("[InternalCommentPanel] loadDefaultStaff error:", err);
      return [];
    }
  }, [pitchingId, pitchingCol, supabase]);

  // ─── Load all staff for search ─────────────────────────

  const loadAllStaff = useCallback(async () => {
    try {
      const { data: staffRecords } = await supabase
        .from("staff")
        .select("id, name, full_name, position, status")
        .order("name", { ascending: true }) as { data: { id: string; name: string | null; full_name: string | null; position: string | null; status: string | null }[] | null };

      const staffList: StaffOption[] = (staffRecords || []).map((s) => ({
        id: s.id,
        name: s.name || "Unknown",
        full_name: s.full_name,
        position: s.position,
        isDefault: false,
      }));

      setAllStaff(staffList);
    } catch (err) {
      console.error("[InternalCommentPanel] loadAllStaff error:", err);
    }
  }, [supabase]);

  // ─── Load comments (only sent by current user) ─────────

  const loadComments = useCallback(async () => {
    if (!currentStaffId) return;

    try {
      // Only fetch comments where evaluator_id = current staff
      // (comments that I have sent)
      const { data: commentRows } = await supabase
        .from("internal_comments")
        .select(`
          id,
          comment,
          point,
          created_date,
          staff_id,
          evaluator_id,
          rating_design_creativity,
          rating_drawing_accuracy,
          rating_professional_briefing,
          rating_client_relation,
          rating_document_logic,
          rating_supplier_relation
        `)
        .eq(pitchingCol, pitchingId)
        .eq("evaluator_id", currentStaffId)
        .order("created_date", { ascending: false }) as {
        data: (Record<string, unknown> & {
          id: string;
          comment: string | null;
          point: number | null;
          created_date: string | null;
          staff_id: string | null;
          evaluator_id: string | null;
        })[] | null;
      };

      if (!commentRows || commentRows.length === 0) {
        setComments([]);
        return;
      }

      // Get all staff IDs to resolve names
      const staffIds = [
        ...new Set([
          ...commentRows.map((c) => c.staff_id).filter(Boolean),
          ...commentRows.map((c) => c.evaluator_id).filter(Boolean),
        ]),
      ] as string[];

      const { data: staffRecords } = await supabase
        .from("staff")
        .select("id, name, full_name, position")
        .in("id", staffIds) as { data: { id: string; name: string | null; full_name: string | null; position: string | null }[] | null };

      const staffMap = new Map(
        (staffRecords || []).map((s) => [
          s.id,
          { name: s.name || s.full_name, position: s.position },
        ])
      );

      const enriched: InternalComment[] = commentRows.map((c) => ({
        id: c.id,
        comment: c.comment,
        point: c.point,
        created_date: c.created_date,
        staff_id: c.staff_id,
        staff_name: c.staff_id ? staffMap.get(c.staff_id)?.name || null : null,
        staff_position: c.staff_id
          ? staffMap.get(c.staff_id)?.position || null
          : null,
        evaluator_id: c.evaluator_id,
        evaluator_name: c.evaluator_id
          ? staffMap.get(c.evaluator_id)?.name || null
          : null,
        criteria: extractCriteriaFromRow(c, ALL_INTERNAL_CRITERION_KEYS),
      }));

      setComments(enriched);
    } catch (err) {
      console.error("[InternalCommentPanel] loadComments error:", err);
    }
  }, [pitchingId, pitchingCol, currentStaffId, supabase]);

  // ─── Submit new comment ────────────────────────────────

  const handleSubmit = async () => {
    if (!selectedStaffId || !commentText.trim() || !currentStaffId) return;

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const ratings = buildInternalRatingsPayload(selectedRole, commentCriteria);
      const { error } = await supabase.from("internal_comments").insert({
        [pitchingCol]: pitchingId,
        staff_id: selectedStaffId, // the person being commented on
        evaluator_id: currentStaffId, // the person writing the comment
        created_by_id: currentUserId,
        comment: commentText.trim(),
        point: commentPoint,
        ...ratings,
        created_date: now,
        modified_date: now,
      });

      if (error) {
        console.error("[InternalCommentPanel] insert error:", error);
        return;
      }

      // Reset form
      setCommentText("");
      setCommentPoint(null);
      setCommentCriteria(emptyCriteriaValues(ALL_INTERNAL_CRITERION_KEYS));
      setSelectedStaffId(null);

      // Reload comments
      await loadComments();
    } catch (err) {
      console.error("[InternalCommentPanel] handleSubmit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Delete comment ─────────────────────────────────────

  const handleDelete = async (commentId: string) => {
    if (!currentStaffId) return;

    const confirmed = window.confirm("確定要刪除此評論嗎？此操作無法撤銷。");
    if (!confirmed) return;

    setDeletingId(commentId);
    try {
      const { error } = await supabase
        .from("internal_comments")
        .delete()
        .eq("id", commentId)
        .eq("evaluator_id", currentStaffId); // safety: only delete own comments

      if (error) {
        console.error("[InternalCommentPanel] delete error:", error);
        return;
      }

      // Reload comments
      await loadComments();
    } catch (err) {
      console.error("[InternalCommentPanel] handleDelete error:", err);
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Edit comment ───────────────────────────────────────

  const canEditComment = (comment: InternalComment) => {
    // Super Admin can always edit
    if (isSuperAdmin) return true;
    // Comment creator can edit their own comment
    if (currentStaffId && comment.evaluator_id === currentStaffId) return true;
    return false;
  };

  const startEdit = (comment: InternalComment) => {
    setEditingId(comment.id);
    setEditComment(comment.comment || "");
    setEditPoint(comment.point ?? null);
    setEditCriteria({
      ...emptyCriteriaValues(ALL_INTERNAL_CRITERION_KEYS),
      ...comment.criteria,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditComment("");
    setEditPoint(null);
    setEditCriteria(emptyCriteriaValues(ALL_INTERNAL_CRITERION_KEYS));
  };

  const handleEditSave = async (commentId: string, staffPosition: string | null) => {
    if (!editComment.trim()) return;

    setSavingEdit(true);
    try {
      const now = new Date().toISOString();
      const role = resolveInternalRatingRole(staffPosition);
      const ratings = buildInternalRatingsPayload(role, editCriteria);
      const updatePayload: Record<string, unknown> = {
        comment: editComment.trim(),
        point: editPoint,
        ...ratings,
        modified_date: now,
      };

      let query = supabase.from("internal_comments").update(updatePayload).eq("id", commentId);

      // If not super admin, add safety check
      if (!isSuperAdmin && currentStaffId) {
        query = query.eq("evaluator_id", currentStaffId);
      }

      const { error } = await query;

      if (error) {
        console.error("[InternalCommentPanel] edit error:", error);
        return;
      }

      setEditingId(null);
      setEditComment("");
      setEditPoint(null);
      setEditCriteria(emptyCriteriaValues(ALL_INTERNAL_CRITERION_KEYS));
      await loadComments();
    } catch (err) {
      console.error("[InternalCommentPanel] handleEditSave error:", err);
    } finally {
      setSavingEdit(false);
    }
  };

  // ─── Staff search filter ───────────────────────────────

  useEffect(() => {
    if (!staffSearch.trim()) {
      setFilteredSearchStaff([]);
      return;
    }

    const q = staffSearch.toLowerCase();
    const defaultIds = new Set(defaultStaff.map((s) => s.id));

    const filtered = allStaff
      .filter(
        (s) =>
          !defaultIds.has(s.id) &&
          ((s.name && s.name.toLowerCase().includes(q)) ||
            (s.full_name && s.full_name.toLowerCase().includes(q)) ||
            (s.position && s.position.toLowerCase().includes(q)))
      )
      .slice(0, 10);

    setFilteredSearchStaff(filtered);
  }, [staffSearch, allStaff, defaultStaff]);

  // ─── Initialize ────────────────────────────────────────

  useEffect(() => {
    resolveCurrentUser();
  }, [resolveCurrentUser]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadDefaultStaff(), loadAllStaff()]);
      setLoading(false);
    };
    init();
  }, [loadDefaultStaff, loadAllStaff]);

  useEffect(() => {
    if (currentStaffId) {
      loadComments();
    }
  }, [currentStaffId, loadComments]);

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


  return (
    <div className="space-y-6">
      {/* ─── NEW COMMENT FORM ─────────────────────────── */}
      {_canCreate && (
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-2 px-5 pt-4">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-500" />
            新增內部評論
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4 pt-1 space-y-4">
          <Separator className="mb-2" />

          {/* Staff Target Selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">
              評論對象（職員）
            </label>

            {/* Default staff chips */}
            {defaultStaff.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {defaultStaff.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setSelectedStaffId(
                        selectedStaffId === s.id ? null : s.id
                      )
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selectedStaffId === s.id
                        ? "bg-blue-500 text-white shadow-sm"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
                    }`}
                  >
                    <User className="w-3 h-3" />
                    {s.name}
                    {s.position && (
                      <span
                        className={`${
                          selectedStaffId === s.id
                            ? "text-blue-100"
                            : "text-gray-400"
                        }`}
                      >
                        · {s.position}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Manual staff search */}
            <Popover open={showStaffPopover} onOpenChange={setShowStaffPopover}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-gray-500 gap-1.5"
                >
                  <Search className="w-3 h-3" />
                  搜尋其他職員
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" align="start">
                <div className="space-y-2">
                  <Input
                    placeholder="搜尋職員名稱..."
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    className="h-8 text-xs"
                    autoFocus
                  />
                  {staffSearch.trim() && (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {filteredSearchStaff.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2 px-1">
                          找不到相關職員
                        </p>
                      ) : (
                        filteredSearchStaff.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedStaffId(s.id);
                              // Add to default staff for display if not already
                              if (!defaultStaff.find((d) => d.id === s.id)) {
                                setDefaultStaff((prev) => [
                                  ...prev,
                                  { ...s, isDefault: false },
                                ]);
                              }
                              setShowStaffPopover(false);
                              setStaffSearch("");
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 text-left"
                          >
                            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                              <User className="w-3 h-3 text-gray-400" />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-700">
                                {s.name}
                              </p>
                              {s.position && (
                                <p className="text-[12px] text-gray-400">
                                  {s.position}
                                </p>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Show selected if not in default list */}
            {selectedStaffId &&
              !defaultStaff.find((s) => s.id === selectedStaffId) && (
                <div className="mt-2">
                  <Badge
                    variant="outline"
                    className="bg-blue-50 border-blue-200 text-blue-700 text-xs"
                  >
                    已選擇:{" "}
                    {allStaff.find((s) => s.id === selectedStaffId)?.name ||
                      "Unknown"}
                    <button
                      type="button"
                      onClick={() => setSelectedStaffId(null)}
                      className="ml-1.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                </div>
              )}
          </div>

          {/* Rating */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">
              評分（可選）
              {selectedStaffId && selectedRole !== "overall" && (
                <span className="ml-1 text-gray-400">
                  · {selectedRole === "designer" ? "設計師" : "項目經理"}
                </span>
              )}
            </label>
            <CriteriaRatingForm
              criteria={selectedCriteriaDefs}
              values={commentCriteria}
              overall={commentPoint}
              onChangeCriterion={(key: RatingCriterionKey, val) =>
                setCommentCriteria((prev) => ({ ...prev, [key]: val }))
              }
              onChangeOverall={setCommentPoint}
            />
          </div>

          {/* Comment Text */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">
              評論內容
            </label>
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="輸入您的評論..."
              className="min-h-[80px] text-sm resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={
                submitting || !selectedStaffId || !commentText.trim()
              }
              className="gap-1.5 bg-blue-500 hover:bg-blue-600 text-white"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              提交評論
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* ─── COMMENTS LIST ────────────────────────────── */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-2 px-5 pt-4">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-violet-500" />
            我發送的評論
            {comments.length > 0 && (
              <Badge
                variant="outline"
                className="ml-1 text-[12px] bg-gray-50"
              >
                {comments.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4 pt-1">
          <Separator className="mb-3" />

          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                <MessageSquare className="w-7 h-7 text-gray-200" />
              </div>
              <p className="text-sm text-gray-400 mb-1">尚未發送評論</p>
              <p className="text-xs text-gray-300">
                請在上方選擇職員並輸入評論內容
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className="group bg-gray-50/50 rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors"
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          → {c.staff_name || "未知職員"}
                        </p>
                        {c.staff_position && (
                          <p className="text-[12px] text-gray-400">
                            {c.staff_position}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="text-right">
                        <p className="text-[12px] text-gray-400">
                          {formatDate(c.created_date)}
                        </p>
                      </div>
                      {canEditComment(c) && editingId !== c.id && (
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-500"
                          title="編輯評論"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {_canDelete && editingId !== c.id && (
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        disabled={deletingId === c.id}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 disabled:opacity-50"
                        title="刪除評論"
                      >
                        {deletingId === c.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                      )}
                    </div>
                  </div>

                  {/* Comment body — edit mode or display mode */}
                  {editingId === c.id ? (
                    <div className="pl-10 space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">評分</label>
                        <CriteriaRatingForm
                          criteria={criteriaForInternalRole(
                            resolveInternalRatingRole(c.staff_position)
                          )}
                          values={editCriteria}
                          overall={editPoint}
                          onChangeCriterion={(key: RatingCriterionKey, val) =>
                            setEditCriteria((prev) => ({ ...prev, [key]: val }))
                          }
                          onChangeOverall={setEditPoint}
                        />
                      </div>
                      <Textarea
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                        placeholder="輸入評論..."
                        className="min-h-[60px] text-sm resize-none"
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEdit}
                          disabled={savingEdit}
                          className="text-xs h-7 px-3"
                        >
                          <X className="w-3 h-3 mr-1" />
                          取消
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleEditSave(c.id, c.staff_position)}
                          disabled={savingEdit || !editComment.trim()}
                          className="text-xs h-7 px-3 bg-blue-500 hover:bg-blue-600 text-white gap-1"
                        >
                          {savingEdit ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          儲存
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="pl-10 space-y-2">
                      <CriteriaRatingDisplay
                        entries={filledCriteriaEntries(
                          c.criteria,
                          criteriaForInternalRole(
                            resolveInternalRatingRole(c.staff_position)
                          )
                        )}
                        overall={c.point}
                      />
                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                        {c.comment || "-"}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── INFO NOTE ────────────────────────────────── */}
      <div className="bg-amber-50/50 border border-amber-100 rounded-lg px-4 py-3">
        <p className="text-xs text-amber-600">
          💡 <strong>提示：</strong>
          此頁面僅顯示您發送的評論。收到的評論將由管理員在專用報表中查閱。
        </p>
      </div>
    </div>
  );
}
