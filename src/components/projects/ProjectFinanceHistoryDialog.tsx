"use client";

/**
 * Shared project income/expense popup used by BWF payment-progress and /ap-rp.
 * Loads full project finance via fetchBWA/BWFProjectDetail and renders
 * ProjectFinancePanels (same UI as project detail tabs).
 */

import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProjectFinancePanels, {
  type ProjectEntityType,
  type ProjectFinanceView,
} from "@/components/projects/ProjectFinancePanels";
import {
  fetchBWAProjectDetail,
  fetchBWFProjectDetail,
  type BWAProjectDetailData,
  type BWFProjectDetailData,
} from "@/lib/data-service";

export type FinanceHistoryTab = "income" | "expense";

type ProjectFinanceHistoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  entityType: ProjectEntityType;
  projectCode?: string | null;
  projectName?: string | null;
  /** Which tab to open first — AR rows → income, AP rows → expense */
  initialTab?: FinanceHistoryTab;
  /** When false, only the income tab is shown (BWF payment-progress). Default true. */
  showExpenseTab?: boolean;
  onDataChanged?: () => void;
};

type FinanceDetail = {
  project_code: string | null;
  project_name: string | null;
  estimated_income: number | null;
  estimated_expense: number | null;
  income_below_estimated_reason: string | null;
  main_contractor_id: string | null;
  main_contractor_name: string | null;
  incomes: BWAProjectDetailData["incomes"];
  expenses: BWAProjectDetailData["expenses"];
};

function toFinanceDetail(
  entityType: ProjectEntityType,
  detail: BWAProjectDetailData | BWFProjectDetailData
): FinanceDetail {
  if (entityType === "bwf_project") {
    const d = detail as BWFProjectDetailData;
    return {
      project_code: d.project_code,
      project_name: d.project_name,
      estimated_income: d.estimated_income,
      estimated_expense: d.estimated_expense,
      income_below_estimated_reason: d.income_below_estimated_reason ?? null,
      main_contractor_id: d.main_contractor_id,
      main_contractor_name: d.main_contractor_name,
      incomes: d.incomes || [],
      expenses: d.expenses || [],
    };
  }
  const d = detail as BWAProjectDetailData;
  return {
    project_code: d.project_code,
    project_name: d.project_name,
    estimated_income: d.estimated_income,
    estimated_expense: d.estimated_expense,
    income_below_estimated_reason: d.income_below_estimated_reason ?? null,
    main_contractor_id: d.main_contractor_id ?? null,
    main_contractor_name: d.main_contractor_name ?? null,
    incomes: d.incomes || [],
    expenses: d.expenses || [],
  };
}

export default function ProjectFinanceHistoryDialog({
  open,
  onOpenChange,
  projectId,
  entityType,
  projectCode,
  projectName,
  initialTab = "income",
  showExpenseTab = true,
  onDataChanged,
}: ProjectFinanceHistoryDialogProps) {
  const [detail, setDetail] = useState<FinanceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<FinanceHistoryTab>(initialTab);

  // Reset tab when opening a different project / initial tab
  useEffect(() => {
    if (open) {
      setTab(showExpenseTab ? initialTab : "income");
    }
  }, [open, projectId, initialTab, showExpenseTab]);

  const loadDetail = useCallback(async () => {
    if (!projectId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    const result =
      entityType === "bwf_project"
        ? await fetchBWFProjectDetail(projectId)
        : await fetchBWAProjectDetail(projectId);
    setDetail(result ? toFinanceDetail(entityType, result) : null);
    setLoading(false);
  }, [projectId, entityType]);

  useEffect(() => {
    if (!open || !projectId) return;
    void loadDetail();
  }, [open, projectId, loadDetail]);

  const handleReload = useCallback(async () => {
    await loadDetail();
    onDataChanged?.();
  }, [loadDetail, onDataChanged]);

  const titleCode = projectCode || detail?.project_code || "";
  const titleName = projectName || detail?.project_name || "";
  const panelView = tab as ProjectFinanceView;
  const financeData = detail
    ? {
        estimated_income: detail.estimated_income,
        estimated_expense: detail.estimated_expense,
        income_below_estimated_reason: detail.income_below_estimated_reason,
        main_contractor_id: detail.main_contractor_id,
        main_contractor_name: detail.main_contractor_name,
        incomes: detail.incomes,
        expenses: detail.expenses,
      }
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1280px] max-h-[90vh] p-0 overflow-hidden flex flex-col gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b bg-gray-50/80 shrink-0">
          <DialogTitle className="text-base font-semibold text-gray-900">
            {showExpenseTab ? "收支明細" : "收入明細"}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            {[titleCode, titleName].filter(Boolean).join(" · ") ||
              (entityType === "bwf_project" ? "傢俬項目財務總覽" : "工程項目財務總覽")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading || !projectId ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
                <span className="text-sm text-gray-400">載入財務資料...</span>
              </div>
            </div>
          ) : !detail || !financeData ? (
            <div className="flex items-center justify-center py-24 text-sm text-gray-400">
              找不到項目資料
            </div>
          ) : showExpenseTab ? (
            <Tabs value={tab} onValueChange={(v) => setTab(v as FinanceHistoryTab)}>
              <TabsList className="mb-4">
                <TabsTrigger value="income">
                  收入 ({detail.incomes.length})
                </TabsTrigger>
                <TabsTrigger value="expense">
                  支出 ({detail.expenses.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="income" className="mt-0">
                <ProjectFinancePanels
                  projectId={projectId}
                  entityType={entityType}
                  data={financeData}
                  view="income"
                  onReload={handleReload}
                />
              </TabsContent>
              <TabsContent value="expense" className="mt-0">
                <ProjectFinancePanels
                  projectId={projectId}
                  entityType={entityType}
                  data={financeData}
                  view="expense"
                  onReload={handleReload}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <ProjectFinancePanels
              projectId={projectId}
              entityType={entityType}
              data={financeData}
              view={panelView}
              onReload={handleReload}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
