"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Building2,
  MessageSquare,
  Send,
  Loader2,
  User,
  Trash2,
  Pencil,
  Check,
  X,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { usePermission } from "@/hooks/use-permission";
import { useAuth } from "@/hooks/use-auth";
import { formatTimestamp as formatDate } from "@/lib/date-utils";
import {
  CriteriaRatingDisplay,
  CriteriaRatingForm,
} from "@/components/comments/CriteriaRatingForm";

interface BuildingComment {
  id: string;
  comment: string | null;
  point: number | null;
  created_date: string | null;
  evaluator_id: string | null;
  evaluator_name: string | null;
}

export type BuildingCommentContext =
  | { type: "project"; id: string }
  | { type: "bwf_project"; id: string }
  | { type: "pitching"; id: string }
  | { type: "bwf_pitching"; id: string };

interface BuildingCommentPanelProps {
  buildingId: string | null | undefined;
  buildingName?: string | null;
  context: BuildingCommentContext;
  permissionModule?: string;
}

/** Context FK for scoping comments. BWF pitching has no dedicated column. */
function resolveContextInsert(
  context: BuildingCommentContext
): Record<string, string> {
  switch (context.type) {
    case "project":
      return { project_id: context.id };
    case "bwf_project":
      return { bwf_project_id: context.id };
    case "pitching":
      return { pitching_id: context.id };
    case "bwf_pitching":
      return {};
  }
}


export default function BuildingCommentPanel({
  buildingId,
  buildingName,
  context,
  permissionModule = "projects.building-comment",
}: BuildingCommentPanelProps) {
  const { canCreate: canCreatePerm, canDelete: canDeletePerm } = usePermission();
  const { staff } = useAuth();
  const _canCreate = canCreatePerm(permissionModule);
  const _canDelete = canDeletePerm(permissionModule);
  const isSuperAdmin = (staff as { role?: string } | null)?.role === "Super Admin";

  const [comments, setComments] = useState<BuildingComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [commentText, setCommentText] = useState("");
  const [commentPoint, setCommentPoint] = useState<number | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editComment, setEditComment] = useState("");
  const [editPoint, setEditPoint] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const supabase = createClient();

  const resolveCurrentUser = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) return;
      const email = user.email.toLowerCase().trim();
      const { data: userRecord } = await supabase
        .from("users")
        .select("id, member_id")
        .eq("email", email)
        .maybeSingle();
      if (userRecord) {
        setCurrentUserId(userRecord.id);
        setCurrentStaffId(userRecord.member_id);
        return;
      }
      const { data: userRecordIlike } = await supabase
        .from("users")
        .select("id, member_id")
        .ilike("email", email)
        .maybeSingle();
      if (userRecordIlike) {
        setCurrentUserId(userRecordIlike.id);
        setCurrentStaffId(userRecordIlike.member_id);
      }
    } catch (err) {
      console.error("[BuildingCommentPanel] resolveCurrentUser error:", err);
    }
  }, [supabase]);

  const loadComments = useCallback(async () => {
    if (!buildingId || !currentStaffId) {
      setComments([]);
      return;
    }
    try {
      let query = supabase
        .from("building_comments")
        .select("id, comment, point, created_date, evaluator_id")
        .eq("building_id", buildingId)
        .eq("evaluator_id", currentStaffId);

      if (context.type === "project") {
        query = query.eq("project_id", context.id);
      } else if (context.type === "bwf_project") {
        query = query.eq("bwf_project_id", context.id);
      } else if (context.type === "pitching") {
        query = query.eq("pitching_id", context.id);
      }

      const { data: commentRows, error } = await query.order("created_date", {
        ascending: false,
      });
      if (error) {
        console.warn("[BuildingCommentPanel] load error:", error.message);
        return;
      }
      if (!commentRows?.length) {
        setComments([]);
        return;
      }

      const evalIds = [
        ...new Set(
          commentRows
            .map((c: { evaluator_id: string | null }) => c.evaluator_id)
            .filter(Boolean)
        ),
      ] as string[];
      let nameMap = new Map<string, string | null>();
      if (evalIds.length > 0) {
        const { data: staffRecords } = await supabase
          .from("staff")
          .select("id, name, full_name")
          .in("id", evalIds);
        nameMap = new Map(
          (staffRecords || []).map(
            (s: { id: string; name: string | null; full_name: string | null }) => [
              s.id,
              s.full_name || s.name,
            ]
          )
        );
      }

      setComments(
        commentRows.map(
          (c: {
            id: string;
            comment: string | null;
            point: number | null;
            created_date: string | null;
            evaluator_id: string | null;
          }) => ({
            id: c.id,
            comment: c.comment,
            point: c.point,
            created_date: c.created_date,
            evaluator_id: c.evaluator_id,
            evaluator_name: c.evaluator_id
              ? nameMap.get(c.evaluator_id) || null
              : null,
          })
        )
      );
    } catch (err) {
      console.error("[BuildingCommentPanel] loadComments error:", err);
    }
  }, [buildingId, currentStaffId, context, supabase]);

  useEffect(() => {
    resolveCurrentUser();
  }, [resolveCurrentUser]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      if (currentStaffId) await loadComments();
      setLoading(false);
    };
    init();
  }, [currentStaffId, loadComments]);

  const handleSubmit = async () => {
    if (!buildingId || !currentStaffId || !commentText.trim()) return;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("building_comments").insert({
        building_id: buildingId,
        ...resolveContextInsert(context),
        evaluator_id: currentStaffId,
        created_by_id: currentUserId,
        comment: commentText.trim(),
        point: commentPoint,
        created_date: now,
        modified_date: now,
      });
      if (error) {
        console.error("[BuildingCommentPanel] insert error:", error);
        return;
      }
      setCommentText("");
      setCommentPoint(null);
      await loadComments();
    } catch (err) {
      console.error("[BuildingCommentPanel] handleSubmit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!currentStaffId) return;
    if (!window.confirm("確定要刪除此評論嗎？此操作無法撤銷。")) return;
    setDeletingId(commentId);
    try {
      const { error } = await supabase
        .from("building_comments")
        .delete()
        .eq("id", commentId)
        .eq("evaluator_id", currentStaffId);
      if (error) {
        console.error("[BuildingCommentPanel] delete error:", error);
        return;
      }
      await loadComments();
    } catch (err) {
      console.error("[BuildingCommentPanel] handleDelete error:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const canEditComment = (comment: BuildingComment) => {
    if (isSuperAdmin) return true;
    return !!(currentStaffId && comment.evaluator_id === currentStaffId);
  };

  const startEdit = (comment: BuildingComment) => {
    setEditingId(comment.id);
    setEditComment(comment.comment || "");
    setEditPoint(comment.point ?? null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditComment("");
    setEditPoint(null);
  };

  const handleEditSave = async (commentId: string) => {
    if (!editComment.trim()) return;
    setSavingEdit(true);
    try {
      const now = new Date().toISOString();
      let query = supabase
        .from("building_comments")
        .update({
          comment: editComment.trim(),
          point: editPoint,
          modified_date: now,
        })
        .eq("id", commentId);
      if (!isSuperAdmin && currentStaffId) {
        query = query.eq("evaluator_id", currentStaffId);
      }
      const { error } = await query;
      if (error) {
        console.error("[BuildingCommentPanel] edit error:", error);
        return;
      }
      cancelEdit();
      await loadComments();
    } catch (err) {
      console.error("[BuildingCommentPanel] handleEditSave error:", err);
    } finally {
      setSavingEdit(false);
    }
  };

  if (!buildingId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
          <Building2 className="w-8 h-8 text-gray-200" />
        </div>
        <p className="text-sm font-medium text-gray-400 mb-1">尚未關聯大廈</p>
        <p className="text-xs text-gray-300">
          請先在項目／提案資料中選擇大廈，才能新增 BMO Building 評語
        </p>
      </div>
    );
  }

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
      <div className="bg-blue-50/50 rounded-md p-3 flex items-start gap-2">
        <Building2 className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-medium text-blue-700">
            BMO Building 評語
            {buildingName ? ` — ${buildingName}` : ""}
          </p>
          <p className="text-[13px] text-blue-500/70 mt-0.5">
            整體評分 + 評語（管理處）
          </p>
        </div>
      </div>

      {_canCreate && (
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-500" />
              新增大廈評語
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-1 space-y-4">
            <Separator className="mb-2" />
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500">
                評分（可選）
              </label>
              <CriteriaRatingForm
                criteria={[]}
                values={{}}
                overall={commentPoint}
                onChangeCriterion={() => {}}
                onChangeOverall={setCommentPoint}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500">評語內容</label>
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="輸入對管理處／大廈的評語..."
                className="min-h-[80px] text-sm resize-none"
              />
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting || !commentText.trim()}
                className="gap-1.5 bg-blue-500 hover:bg-blue-600 text-white"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                提交評語
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-2 px-5 pt-4">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-violet-500" />
            我發送的評語
            {comments.length > 0 && (
              <Badge variant="outline" className="ml-1 text-[12px] bg-gray-50">
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
              <p className="text-sm text-gray-400 mb-1">尚未發送評語</p>
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className="group bg-gray-50/50 rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-teal-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          {buildingName || "大廈"}
                        </p>
                        <p className="text-[12px] text-gray-400">
                          {formatDate(c.created_date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      {canEditComment(c) && editingId !== c.id && (
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-500"
                          title="編輯"
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
                          title="刪除"
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
                  {editingId === c.id ? (
                    <div className="space-y-3">
                      <CriteriaRatingForm
                        criteria={[]}
                        values={{}}
                        overall={editPoint}
                        onChangeCriterion={() => {}}
                        onChangeOverall={setEditPoint}
                      />
                      <Textarea
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
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
                          onClick={() => handleEditSave(c.id)}
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
                    <div className="space-y-2">
                      <CriteriaRatingDisplay entries={[]} overall={c.point} />
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
    </div>
  );
}
