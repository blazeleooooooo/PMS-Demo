"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { CascadeAnalysisResult, CascadeRelatedRecord } from "@/lib/data-service";

function CascadeGroupItem({
  group,
  selected,
  onToggle,
  nested = false,
}: {
  group: CascadeRelatedRecord;
  selected: boolean;
  onToggle: (val: boolean) => void;
  nested?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`rounded-lg border p-3 ${nested ? "bg-white border-gray-100" : "bg-gray-50 border-gray-200"}`}>
      <div className="flex items-center gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={(val) => onToggle(!!val)}
          className="border-gray-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{group.label}</span>
            <span className="text-[13px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono">
              {group.count}
            </span>
          </div>
          <p className="text-[13px] text-gray-400 font-mono">{group.table}</p>
        </div>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono shrink-0">
          {group.fk_action}
        </span>
        {group.records.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
          >
            {expanded ? "▲" : "▼"}
          </button>
        )}
      </div>
      {expanded && group.records.length > 0 && (
        <div className="mt-2 ml-8 space-y-1 max-h-32 overflow-y-auto">
          {group.records.map((r, i) => (
            <div key={i} className="text-[13px] text-gray-500 truncate">
              • {r.display || r.id}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export interface ProjectCascadeDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectCode?: string | null;
  listRedirectPath: string;
  analyze: (projectId: string) => Promise<{ data?: CascadeAnalysisResult; error?: string }>;
  execute: (
    projectId: string,
    selections: Record<string, boolean>,
    deleteProject: boolean,
    deletePitching: boolean,
    deleteCustomer: boolean
  ) => Promise<{ success: boolean; deletion_log?: { table: string; deleted: number; error?: string }[]; error?: string }>;
}

export default function ProjectCascadeDeleteDialog({
  open,
  onOpenChange,
  projectId,
  projectCode,
  listRedirectPath,
  analyze,
  execute,
}: ProjectCascadeDeleteDialogProps) {
  const router = useRouter();
  const deleteInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteAttempts, setDeleteAttempts] = useState(0);
  const [cascadeAnalysis, setCascadeAnalysis] = useState<CascadeAnalysisResult | null>(null);
  const [cascadeLoading, setCascadeLoading] = useState(false);
  const [cascadeStep, setCascadeStep] = useState<"analysis" | "confirm">("analysis");
  const [cascadeSelections, setCascadeSelections] = useState<Record<string, boolean>>({});
  const [deletePitching, setDeletePitching] = useState(false);
  const [deleteCustomer, setDeleteCustomer] = useState(false);
  const [cascadeExecuting, setCascadeExecuting] = useState(false);
  const [cascadeDeletionLog, setCascadeDeletionLog] = useState<{ table: string; deleted: number; error?: string }[] | null>(null);

  const handleDelete = async () => {
    if (deleteConfirmText !== "Confirm Delete") return;
    setCascadeExecuting(true);
    const result = await execute(projectId, cascadeSelections, true, deletePitching, deleteCustomer);
    setCascadeDeletionLog(result.deletion_log || null);
    if (result.success) {
      setTimeout(() => router.push(listRedirectPath), 1500);
    }
    setCascadeExecuting(false);
  };

  useEffect(() => {
    if (!open) return;
    setDeleteConfirmText("");
    setDeleteAttempts(0);
    setCascadeStep("analysis");
    setCascadeAnalysis(null);
    setCascadeSelections({});
    setDeletePitching(false);
    setDeleteCustomer(false);
    setCascadeDeletionLog(null);
    setCascadeLoading(true);
    analyze(projectId).then(({ data }) => {
      if (data) {
        setCascadeAnalysis(data);
        const defaults: Record<string, boolean> = {};
        data.related_groups.forEach((g) => { defaults[g.table] = true; });
        if (data.pitching_chain?.children) {
          data.pitching_chain.children.forEach((c) => { defaults[c.table] = true; });
        }
        setCascadeSelections(defaults);
        setDeletePitching(!!data.pitching_chain);
      }
      setCascadeLoading(false);
    });
    setTimeout(() => deleteInputRef.current?.focus(), 300);
  }, [open, projectId, analyze]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-red-600 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="text-white font-bold text-lg">危險操作確認 — 級聯刪除</h3>
              <p className="text-red-100 text-sm">Cascade Delete — {projectCode}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {cascadeLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-red-500" />
              <p className="text-sm text-gray-500">正在分析關聯數據鏈...</p>
              <p className="text-xs text-gray-400">Analyzing relationship chain...</p>
            </div>
          ) : cascadeDeletionLog ? (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-emerald-800 text-sm font-bold mb-2">✅ 刪除完成 Deletion Complete</p>
                <div className="space-y-1">
                  {cascadeDeletionLog.map((log, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {log.error ? (
                        <span className="text-red-600">❌ {log.table}: {log.error}</span>
                      ) : (
                        <span className="text-emerald-700">✓ {log.table} — deleted</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center">正在跳轉到項目列表...</p>
            </div>
          ) : cascadeStep === "analysis" && cascadeAnalysis ? (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-amber-800 text-sm font-medium">⚠️ 以下數據與此項目有關聯。請選擇要一併刪除的項目：</p>
                <p className="text-amber-700 text-xs mt-1">The following data is related to this project. Select items to delete together:</p>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-500 border-b pb-2">
                <span>📊 共發現 <strong className="text-gray-800">{cascadeAnalysis.total_related_count}</strong> 條關聯記錄</span>
                <span>|</span>
                <button
                  className="text-blue-600 hover:underline"
                  onClick={() => {
                    const allOn: Record<string, boolean> = {};
                    cascadeAnalysis.related_groups.forEach((g) => { allOn[g.table] = true; });
                    if (cascadeAnalysis.pitching_chain?.children) {
                      cascadeAnalysis.pitching_chain.children.forEach((c) => { allOn[c.table] = true; });
                    }
                    setCascadeSelections(allOn);
                    setDeletePitching(!!cascadeAnalysis.pitching_chain);
                  }}
                >
                  全選 Select All
                </button>
                <button
                  className="text-blue-600 hover:underline"
                  onClick={() => {
                    setCascadeSelections({});
                    setDeletePitching(false);
                    setDeleteCustomer(false);
                  }}
                >
                  取消全選 Deselect All
                </button>
              </div>

              {cascadeAnalysis.related_groups.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    直接關聯 Direct Relations
                  </h4>
                  {cascadeAnalysis.related_groups.map((group) => (
                    <CascadeGroupItem
                      key={group.table}
                      group={group}
                      selected={!!cascadeSelections[group.table]}
                      onToggle={(val) => setCascadeSelections((prev) => ({ ...prev, [group.table]: val }))}
                    />
                  ))}
                </div>
              )}

              {cascadeAnalysis.pitching_chain && (
                <div className="space-y-2 border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    競標鏈 Pitching Chain (二級關聯)
                  </h4>
                  <div className="ml-2 border-l-2 border-amber-200 pl-3">
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-amber-50 border border-amber-100">
                      <Checkbox
                        checked={deletePitching}
                        onCheckedChange={(val) => {
                          setDeletePitching(!!val);
                          if (!val && cascadeAnalysis.pitching_chain?.children) {
                            const updated = { ...cascadeSelections };
                            cascadeAnalysis.pitching_chain.children.forEach((c) => { updated[c.table] = false; });
                            setCascadeSelections(updated);
                          }
                        }}
                        className="border-amber-400 data-[state=checked]:bg-amber-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-amber-800">
                          {cascadeAnalysis.pitching_chain.label}
                        </span>
                        <p className="text-[13px] text-amber-600">
                          {cascadeAnalysis.pitching_chain.records[0]?.display}
                        </p>
                      </div>
                      <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-mono">
                        {cascadeAnalysis.pitching_chain.fk_action}
                      </span>
                    </div>

                    {deletePitching && cascadeAnalysis.pitching_chain.children && (
                      <div className="mt-2 ml-4 space-y-2">
                        {cascadeAnalysis.pitching_chain.children.map((child) => (
                          <CascadeGroupItem
                            key={child.table}
                            group={child}
                            selected={!!cascadeSelections[child.table]}
                            onToggle={(val) => setCascadeSelections((prev) => ({ ...prev, [child.table]: val }))}
                            nested
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {cascadeAnalysis.customer_chain && (() => {
                const otherProjectsChild = cascadeAnalysis.customer_chain.children?.find(
                  (c) => c.table === "customer_other_projects"
                );
                const hasOtherProjects = otherProjectsChild && otherProjectsChild.count > 0;
                return (
                  <div className="space-y-2 border-t pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      客戶鏈 Customer Chain
                    </h4>
                    <div className="ml-2 border-l-2 border-emerald-200 pl-3">
                      <div className={`flex items-center gap-3 p-2 rounded-lg border ${deleteCustomer ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-100"}`}>
                        <Checkbox
                          checked={deleteCustomer}
                          onCheckedChange={(val) => setDeleteCustomer(!!val)}
                          disabled={!!hasOtherProjects}
                          className="border-gray-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="text-lg">👥</span>
                        <div className="flex-1">
                          <span className={`text-sm font-medium ${deleteCustomer ? "text-red-800" : "text-emerald-800"}`}>
                            {cascadeAnalysis.customer_chain.label}
                          </span>
                          <p className={`text-[13px] ${deleteCustomer ? "text-red-600" : "text-emerald-600"}`}>
                            {cascadeAnalysis.customer_chain.records[0]?.display}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${deleteCustomer ? "bg-red-200 text-red-800" : "bg-emerald-200 text-emerald-800"}`}>
                          {deleteCustomer ? "DELETE" : "KEEP"}
                        </span>
                      </div>

                      {hasOtherProjects && (
                        <p className="mt-2 text-[13px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                          ⚠️ 此客戶尚有其他 BWA/BWF 項目關聯，無法刪除。This customer has other linked BWA or BWF projects and cannot be deleted.
                        </p>
                      )}

                      {cascadeAnalysis.customer_chain.children && cascadeAnalysis.customer_chain.children.length > 0 && (
                        <div className="mt-2 ml-4 space-y-2">
                          {cascadeAnalysis.customer_chain.children.map((child) => (
                            <div
                              key={child.table}
                              className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-100"
                            >
                              <span className="text-lg">ℹ️</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-700">{child.label}</span>
                                  <span className="text-[12px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{child.count}</span>
                                </div>
                                {child.records.length > 0 && (
                                  <ul className="mt-1 space-y-0.5">
                                    {child.records.slice(0, 3).map((r) => (
                                      <li key={r.id} className="text-[13px] text-gray-500 flex items-center gap-1">
                                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                                        {r.display}
                                      </li>
                                    ))}
                                    {child.records.length > 3 && (
                                      <li className="text-[13px] text-gray-400 italic">
                                        ...及其他 {child.records.length - 3} 條
                                      </li>
                                    )}
                                  </ul>
                                )}
                              </div>
                              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-mono whitespace-nowrap">
                                {child.fk_action}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {!deleteCustomer && (
                        <p className="mt-2 text-[13px] text-emerald-600 italic">
                          ℹ️ 客戶不會被刪除。Customer will NOT be deleted.
                        </p>
                      )}
                      {deleteCustomer && (
                        <p className="mt-2 text-[13px] text-red-600 font-semibold">
                          ⚠️ 客戶及其所有關聯數據將被刪除！Customer and all related data will be PERMANENTLY deleted!
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {cascadeAnalysis.related_groups.length === 0 && !cascadeAnalysis.pitching_chain && !cascadeAnalysis.customer_chain && (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm">✅ 此項目沒有關聯數據</p>
                  <p className="text-gray-400 text-xs">No related data found. Safe to delete directly.</p>
                </div>
              )}
            </div>
          ) : cascadeStep === "confirm" ? (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm font-medium mb-1">⚠️ 此操作無法撤銷！</p>
                <p className="text-red-700 text-xs">
                  You are about to permanently delete project: <strong className="text-red-900">{projectCode}</strong>
                </p>
                <div className="mt-2 text-xs text-red-600">
                  <p>將刪除 Will delete:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li>此項目本身 The project itself</li>
                    {Object.entries(cascadeSelections).filter(([, v]) => v).map(([key]) => {
                      const group = cascadeAnalysis?.related_groups.find((g) => g.table === key)
                        || cascadeAnalysis?.pitching_chain?.children?.find((c) => c.table === key);
                      return group ? <li key={key}>{group.label} ({group.count})</li> : null;
                    })}
                    {deletePitching && <li>關聯競標 Linked Pitching</li>}
                  </ul>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  請準確輸入以下句子確認 (Please type to confirm):
                </label>
                <div className="bg-gray-100 rounded-lg px-4 py-3 border border-gray-200">
                  <code className="text-sm font-mono text-gray-800 select-none">Confirm Delete</code>
                </div>
                <input
                  ref={deleteInputRef}
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  onPaste={(e) => e.preventDefault()}
                  onDrop={(e) => e.preventDefault()}
                  onContextMenu={(e) => e.preventDefault()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && deleteConfirmText === "Confirm Delete") handleDelete();
                    if (e.key === "Escape") onOpenChange(false);
                  }}
                  placeholder="Type the sentence above exactly..."
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className={`w-full border-2 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none transition ${
                    deleteConfirmText.length === 0
                      ? "border-gray-200 focus:border-blue-400"
                      : deleteConfirmText === "Confirm Delete"
                      ? "border-emerald-400 bg-emerald-50 focus:border-emerald-500"
                      : "border-red-300 focus:border-red-400"
                  }`}
                />
                {deleteAttempts > 0 && deleteConfirmText !== "Confirm Delete" && (
                  <p className="text-red-500 text-xs">❌ 輸入不正確，請重新輸入。</p>
                )}
                {deleteConfirmText === "Confirm Delete" && (
                  <p className="text-emerald-600 text-xs font-medium">✅ 確認句子正確！You may proceed.</p>
                )}
              </div>
              <p className="text-[13px] text-gray-400 italic">
                🚫 Copy & paste is disabled. You must type the sentence manually.
              </p>
            </div>
          ) : null}
        </div>

        {!cascadeDeletionLog && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0">
            <button
              onClick={() => {
                if (cascadeStep === "confirm") {
                  setCascadeStep("analysis");
                  setDeleteConfirmText("");
                  setDeleteAttempts(0);
                } else {
                  onOpenChange(false);
                }
              }}
              disabled={cascadeExecuting}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-100 transition disabled:opacity-50"
            >
              {cascadeStep === "confirm" ? "← 返回選擇 Back" : "取消 Cancel"}
            </button>

            <div className="flex items-center gap-2">
              {cascadeStep === "analysis" && !cascadeLoading && (
                <button
                  onClick={() => {
                    setCascadeStep("confirm");
                    setTimeout(() => deleteInputRef.current?.focus(), 100);
                  }}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
                >
                  下一步：確認刪除 →
                </button>
              )}
              {cascadeStep === "confirm" && (
                <button
                  onClick={() => {
                    if (deleteConfirmText === "Confirm Delete") {
                      handleDelete();
                    } else {
                      setDeleteAttempts((a) => a + 1);
                    }
                  }}
                  disabled={deleteConfirmText !== "Confirm Delete" || cascadeExecuting}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {cascadeExecuting ? (
                    <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 刪除中...</span>
                  ) : (
                    "🔥 確認級聯刪除 Execute"
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
