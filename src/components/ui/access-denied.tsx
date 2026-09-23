"use client";

import { ShieldX, ArrowLeft, Home, ChevronDown, User, Key, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@/hooks/use-navigate";
import { usePermission } from "@/hooks/use-permission";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ─── MODULE NAME MAPPING ─────────────────────────────────────
const MODULE_NAMES: Record<string, string> = {
  dashboard: "主控版",
  news: "項目新聞",
  projects: "項目管理",
  proposals: "提案管理",
  "asana-import": "Asana 匯入",
  "key-pitching": "重點 Pitching",
  "bwf/proposals": "傢俬提案",
  "bwf/projects": "傢俬項目",
  "bwf/payment-progress": "收款進度",
  "bwf/orders": "傢俬訂單",
  "paid-pending-orders": "已收款待下單",
  "major-inquiry": "主要查詢列表",
  clients: "客戶管理",
  brands: "客戶品牌",
  suppliers: "供應商",
  factories: "工廠管理",
  "supplier-load": "供應商負載",
  "frequent-suppliers": "常用供應商報告",
  "bni-projects": "BNI合作項目",
  "case-pdf": "個案PDF",
  "defect-crisis": "執漏危機表",
  relations: "客戶關係",
  contracts: "合約管理",
  prequalify: "預審資格",
  "br-labour-update": "BR/勞保更新",
  payable: "應付未付",
  receivable: "應收未收",
  "ap-rp": "AP & RP",
  "expected-payments": "預計收付款",
  "bad-debt": "壞帳列表",
  cheques: "支票支出",
  deposits: "BMO代付退款",
  "wip-debt": "進行中工程欠數",
  "cost-analysis": "成本分析",
  "ar-receive-dates": "AR收款申報",
  "collection-emails": "追收款電郵",
  "ap-payment-dates": "AP大額支出申請",
  "business-reports": "業務報表",
  "business-reports.risky-project": "L2 L3 比較表",
  "team-reports": "團隊業務報表",
  "team-reports.pm-hit-rate": "項目經理命中率（團隊）",
  "team-reports.personal-performance": "個人BV表現（團隊）",
  "team-reports.project-manhour-analysis": "項目工時分析（團隊）",
  "team-reports.project-type-analysis": "項目類型分析（團隊）",
  "team-reports.overdue-receivable": "逾期應收項目（團隊）",
  "team-reports.outstanding-project": "未收款項目（團隊）",
  "team-reports.bad-debt-project": "壞帳項目（團隊）",
  "team-reports.sales-by-pm": "按PM銷售統計（團隊）",
  "individual-reports": "個人業務報表",
  "individual-reports.personal-performance": "個人BV表現（個人）",
  "individual-reports.risky-project": "L2 L3 比較表",
  "individual-reports.overdue-receivable": "個人逾期應收",
  "individual-reports.shared-gp-trend": "Shared GP趨勢",
  "individual-reports.pitch-hit-rate": "投標Hit Rate",
  "team-grouping": "分組工具",
  "team-assign-bv": "BV分配",
  "expense-control-waivers": "支出鎖定豁免",
  "site-photos": "現場相片",
  "completion-photos": "完成項目相片",
  "assign-bv": "BV分配",
  audit: "會計審核",
  dates: "日期管理",
  "3d-design": "3D 設計",
  "designer-load": "設計師負載",
  "design-reports": "設計業務報表",
  "design-reports.designer-hit-rate": "設計師命中率",
  "design-reports.project-type-analysis": "項目類型分析",
  "design-reports.project-manhour-analysis": "項目工時分析",
  "design-reports.3d-output": "3D數量統計",
  "design-reports.design-jobs": "設計工作項詳情",
  "testing.designer-daily-feed": "設計師每日匯報（測試中）",
  buildings: "大廈管理",
  admin: "管理員面板",
  "admin.accounts": "帳戶管理",
  "admin.roles": "角色管理",
  "admin.permissions": "權限管理",
  "admin.expense-locked": "支出鎖定項目",
  "admin.expense-installment-waivers": "支出總額豁免",
  "admin.income-expiry": "逾期收入原因",
  "admin.pms-login": "PMS登入報告",
  "admin.annual-bonus-settlement": "年度獎金結算",
  "admin.migration": "資料遷移",
  "admin.fk-audit": "外鍵稽核",
  staff: "職員管理",
  reports: "工作匯報",
  "reports.aug14-deadline": "14/8前必須完成",
  "work-report-check": "工作匯報檢查",
  "work-report-leaderboard": "工作匯報排行榜",
  testing: "測試中頁面",
  "testing.reports": "工作匯報（測試中）",
  settings: "系統設定",
  "settings.cost_centres": "公司單位",
  "settings.task-reporting": "工作匯報設定",
  "settings.site-status-questionnaire": "工地狀況問卷",
  "settings.income_expiry_reasons": "收入逾期原因",
  "settings.bwf_products": "BWF 產品",
};

interface PermissionLayerRow {
  layer_order: number;
  dimension: string;
  dimension_label: string;
  dimension_rank: number;
  staff_value: string | null;
  staff_value_label: string | null;
  assignment_effect: string | null;
  assignment_priority: number | null;
  is_winner: boolean;
  resolved_effect: string;
  resolved_allowed: boolean;
}

interface AccessDeniedProps {
  /** The module key being denied (e.g., "proposals", "admin") */
  module?: string;
  /** Optional custom message to show */
  message?: string;
  /** Whether to show a full-page layout (centered on screen) vs inline */
  fullPage?: boolean;
}

/**
 * Unified Access Denied component.
 * Used both inline (inside a page component) and as the full /access-denied page.
 * Includes a collapsible debug panel to help users understand denial reasons.
 */
export function AccessDenied({ module, message, fullPage = false }: AccessDeniedProps) {
  const { navigate } = useNavigate();
  const router = useRouter();
  const { permissions, loading: permLoading } = usePermission();
  const { staff, isLoading: authLoading, isLoggedIn } = useAuth();
  const [debugOpen, setDebugOpen] = useState(true);
  const [layers, setLayers] = useState<PermissionLayerRow[]>([]);
  const [layersLoading, setLayersLoading] = useState(false);
  const [layersError, setLayersError] = useState<string | null>(null);

  // Unauthenticated users are redirected by RouteGuard; this is a fallback only.
  useEffect(() => {
    if (authLoading || isLoggedIn) return;
    router.replace("/login");
  }, [authLoading, isLoggedIn, router]);

  // Fetch layer-by-layer resolution for the requested module.
  useEffect(() => {
    if (!module || !staff?.id || authLoading || !isLoggedIn) {
      setLayers([]);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    (async () => {
      setLayersLoading(true);
      setLayersError(null);
      try {
        const { data, error } = await supabase.rpc("explain_permission_resolution", {
          p_user_id: staff.id,
          p_module: module,
          p_action: "view",
        });
        if (cancelled) return;
        if (error) {
          console.warn("[AccessDenied] explain_permission_resolution:", error.message);
          setLayersError(error.message);
          setLayers([]);
          return;
        }
        setLayers((data || []) as PermissionLayerRow[]);
      } catch (err) {
        if (cancelled) return;
        setLayersError(err instanceof Error ? err.message : String(err));
        setLayers([]);
      } finally {
        if (!cancelled) setLayersLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [module, staff?.id, authLoading, isLoggedIn]);

  if (!authLoading && !isLoggedIn) {
    return null;
  }

  // Resolve a friendly name; for sub-modules (e.g. "business-reports.sales-trend")
  // fall back to the parent module's name when the exact key isn't mapped.
  const friendlyName = module
    ? MODULE_NAMES[module] ||
      (module.includes(".") ? MODULE_NAMES[module.split(".")[0]] : undefined) ||
      module
    : "此頁面";

  // Determine the reason for denial
  const getDenialReason = () => {
    if (authLoading || permLoading) return "loading";
    if (!isLoggedIn) return "not-logged-in";
    if (!staff) return "no-staff-profile";
    if (permissions.length === 0) return "no-permissions-loaded";

    // Match hasPermission: exact child first, then parent cascade.
    if (module) {
      const denyEntry = permissions.find(
        (p) => p.module === module && p.action === "view" && p.effect === "deny"
      );
      if (denyEntry) return "explicitly-denied";

      const allowEntry = permissions.find(
        (p) => p.module === module && p.action === "view" && p.effect === "allow"
      );
      if (allowEntry) return "unknown"; // allowed at exact — shouldn't land here

      const parentMod = module.includes(".") ? module.split(".")[0] : null;
      if (parentMod) {
        const parentDeny = permissions.find(
          (p) =>
            p.module === parentMod &&
            p.action === "view" &&
            p.effect === "deny",
        );
        if (parentDeny) return "parent-inherited-deny";
        const parentAllow = permissions.find(
          (p) =>
            p.module === parentMod &&
            p.action === "view" &&
            p.effect === "allow",
        );
        if (parentAllow) return "unknown";
      }

      // No exact/parent rule — client fails open, so a block here is unexpected.
      return "no-permission-entry";
    }

    return "unknown";
  };

  const reason = getDenialReason();
  const winner = layers.find((l) => l.is_winner);
  const resolvedAllowed = layers[0]?.resolved_allowed;
  const resolvedEffect = layers[0]?.resolved_effect;

  // User-friendly reason messages
  const REASON_MESSAGES: Record<string, { icon: React.ReactNode; text: string; hint: string }> = {
    "loading": {
      icon: <Info className="w-4 h-4 text-blue-500" />,
      text: "正在載入權限資料...",
      hint: "系統正在驗證您的權限，請稍候。",
    },
    "not-logged-in": {
      icon: <User className="w-4 h-4 text-orange-500" />,
      text: "您尚未登入",
      hint: "請先登入系統以存取此頁面。",
    },
    "no-staff-profile": {
      icon: <User className="w-4 h-4 text-orange-500" />,
      text: "找不到您的員工資料",
      hint: "您的帳號尚未與任何員工資料連結。請聯絡管理員進行設定。",
    },
    "no-permissions-loaded": {
      icon: <Key className="w-4 h-4 text-yellow-500" />,
      text: "權限資料為空",
      hint: "系統未能取得您的權限設定。這可能是資料庫配置問題，請聯絡管理員。",
    },
    "explicitly-denied": {
      icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
      text: winner
        ? `由「${winner.dimension_label}」層級明確拒絕`
        : "您的權限規則被明確拒絕存取此模組",
      hint: winner
        ? `生效規則：${winner.dimension_label}（${winner.staff_value_label || winner.staff_value || "—"}）→ ${winner.assignment_effect}。較具體層級若設為 allow 即可覆蓋。`
        : "生效中的權限規則拒絕存取此功能（可能來自角色／職位／用戶等層級）。如需開通，請聯絡管理員調整較具體層級的權限。",
    },
    "parent-inherited-deny": {
      icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
      text: module?.includes(".")
        ? `由父模組「${module.split(".")[0]}」的拒絕規則繼承封鎖`
        : "由父模組的拒絕規則繼承封鎖",
      hint: "子頁面沒有獨立的 view 規則時，會繼承父模組的 deny。請在權限矩陣為該子頁面設 allow，或調整父模組規則。",
    },
    "no-permission-entry": {
      icon: <Key className="w-4 h-4 text-yellow-500" />,
      text: "您未被授予此模組的存取權限",
      hint: "目前沒有任何權限規則允許您檢視此頁面。請聯絡管理員新增權限。",
    },
    "unknown": {
      icon: <AlertTriangle className="w-4 h-4 text-gray-500" />,
      text: "存取被拒絕（原因不明）",
      hint: "無法確定拒絕原因。請嘗試重新整理頁面或聯絡管理員。",
    },
  };

  const reasonInfo = REASON_MESSAGES[reason] || REASON_MESSAGES["unknown"];

  const containerClass = fullPage
    ? "min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0f1117] px-4 py-8"
    : "flex items-center justify-center min-h-[60vh] px-4 py-6";

  const modulePermissions = module
    ? permissions.filter(
        (p) =>
          p.module === module ||
          p.module === "*" ||
          (module.includes(".") && p.module === module.split(".")[0])
      )
    : [];

  return (
    <div className={containerClass}>
      <div className="max-w-2xl w-full text-center space-y-5">
        {/* Icon */}
        <div className="mx-auto w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
          <ShieldX className="w-10 h-10 text-red-500" />
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            存取被拒絕
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {message || (
              <>
                您沒有權限存取「<span className="font-medium text-gray-700 dark:text-gray-300">{friendlyName}</span>」頁面。
              </>
            )}
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            如需存取此功能，請聯繫管理員調整您的權限設定。
          </p>
        </div>

        {/* Reason Card - User Friendly */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-left shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0">
              {reasonInfo.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {reasonInfo.text}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {reasonInfo.hint}
              </p>
            </div>
          </div>
        </div>

        {/* Permission resolution calculation — always visible */}
        {module && (
          <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900/40 rounded-xl p-4 text-left shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  權限計算邏輯 Permission Resolution
                </p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
                  覆蓋優先序：特殊規則 &gt; 按用戶 &gt; 按職位 &gt; 按團隊 &gt; 按公司 &gt; 按角色（較具體者優先；同層級時拒絕優先）
                </p>
              </div>
              {resolvedEffect && (
                <span
                  className={`shrink-0 inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ${
                    resolvedAllowed
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  }`}
                >
                  結果：{resolvedEffect}
                </span>
              )}
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400">
              模組 <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-900">{module}</code>
              {" · "}動作 <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-900">view</code>
            </div>

            {layersLoading && (
              <p className="text-xs text-gray-400">正在計算各層級規則…</p>
            )}

            {layersError && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                無法載入層級明細：{layersError}
              </p>
            )}

            {!layersLoading && layers.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/60 text-left text-gray-500">
                      <th className="px-3 py-2 font-medium">優先</th>
                      <th className="px-3 py-2 font-medium">層級</th>
                      <th className="px-3 py-2 font-medium">您的值</th>
                      <th className="px-3 py-2 font-medium">規則</th>
                      <th className="px-3 py-2 font-medium">狀態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {layers.map((row) => {
                      const effect = row.assignment_effect;
                      const rowBg = row.is_winner
                        ? effect === "deny"
                          ? "bg-red-50 dark:bg-red-900/20"
                          : "bg-green-50 dark:bg-green-900/20"
                        : "";
                      return (
                        <tr
                          key={row.dimension}
                          className={`border-t border-gray-100 dark:border-gray-800 ${rowBg}`}
                        >
                          <td className="px-3 py-2 font-mono text-gray-400">
                            #{row.layer_order}
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">
                            {row.dimension_label}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300 truncate max-w-[140px]">
                            {row.staff_value_label || row.staff_value || "—"}
                          </td>
                          <td className="px-3 py-2">
                            {effect ? (
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${
                                  effect === "allow"
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                }`}
                              >
                                {effect}
                                {row.assignment_priority != null
                                  ? ` · p${row.assignment_priority}`
                                  : ""}
                              </span>
                            ) : (
                              <span className="text-gray-400">無規則</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {row.is_winner ? (
                              <span
                                className={`font-semibold ${
                                  effect === "deny" ? "text-red-600" : "text-green-600"
                                }`}
                              >
                                {effect === "deny" ? "← 生效拒絕" : "← 生效允許"}
                              </span>
                            ) : effect ? (
                              <span className="text-gray-400">被覆蓋</span>
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {winner && (
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                <span className="font-semibold">結論：</span>
                「{winner.dimension_label}」對「{winner.staff_value_label || winner.staff_value}」設了{" "}
                <span
                  className={
                    winner.assignment_effect === "deny"
                      ? "text-red-600 font-semibold"
                      : "text-green-600 font-semibold"
                  }
                >
                  {winner.assignment_effect}
                </span>
                {winner.assignment_effect === "deny"
                  ? "，且沒有更高優先層級（特殊／用戶／職位等）的 allow 覆蓋，因此被拒絕。"
                  : "，覆蓋了較一般層級的規則。"}
              </p>
            )}

            {!layersLoading && !layersError && layers.length === 0 && (
              <p className="text-xs text-gray-400">
                各層級皆無規則 — 系統預設為允許（fail-open）。若仍被拒，可能是前端快取或中介層問題。
              </p>
            )}
          </div>
        )}

        {/* Collapsible Debug Panel */}
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden text-left">
          <button
            onClick={() => setDebugOpen(!debugOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5" />
              技術診斷資訊
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${debugOpen ? "rotate-180" : ""}`}
            />
          </button>

          {debugOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
              {/* User Info Section */}
              <div className="space-y-1.5">
                <p className="text-[12px] uppercase font-semibold text-gray-400 tracking-wider">用戶資訊</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="text-gray-500">登入狀態</div>
                  <div className={`font-mono ${isLoggedIn ? "text-green-600" : "text-red-500"}`}>
                    {authLoading ? "載入中..." : isLoggedIn ? "✓ 已登入" : "✗ 未登入"}
                  </div>
                  <div className="text-gray-500">員工名稱</div>
                  <div className="font-mono text-gray-700 dark:text-gray-300 truncate">
                    {staff?.name || staff?.full_name || "—"}
                  </div>
                  <div className="text-gray-500">員工 ID</div>
                  <div className="font-mono text-gray-700 dark:text-gray-300 truncate text-[12px]">
                    {staff?.id || "—"}
                  </div>
                  <div className="text-gray-500">角色</div>
                  <div className="font-mono text-gray-700 dark:text-gray-300">
                    {(staff as any)?.role || "—"}
                  </div>
                  <div className="text-gray-500">職位</div>
                  <div className="font-mono text-gray-700 dark:text-gray-300">
                    {(staff as any)?.position || "—"}
                  </div>
                </div>
              </div>

              {/* Permission Info Section */}
              <div className="space-y-1.5">
                <p className="text-[12px] uppercase font-semibold text-gray-400 tracking-wider">權限資訊</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="text-gray-500">權限載入</div>
                  <div className={`font-mono ${permLoading ? "text-yellow-600" : "text-green-600"}`}>
                    {permLoading ? "載入中..." : `✓ 已載入 (${permissions.length} 項)`}
                  </div>
                  <div className="text-gray-500">請求模組</div>
                  <div className="font-mono text-gray-700 dark:text-gray-300">
                    {module || "未指定"}
                  </div>
                  <div className="text-gray-500">拒絕原因</div>
                  <div className="font-mono text-red-500 text-[12px]">
                    {reason}
                  </div>
                  {winner && (
                    <>
                      <div className="text-gray-500">生效層級</div>
                      <div className="font-mono text-red-600 text-[12px]">
                        {winner.dimension} / {winner.assignment_effect}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Module-relevant permissions */}
              {modulePermissions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[12px] uppercase font-semibold text-gray-400 tracking-wider">
                    相關已載入權限 ({modulePermissions.length})
                  </p>
                  <div className="max-h-32 overflow-auto rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="text-left text-gray-400">
                          <th className="pb-1 pr-2">模組</th>
                          <th className="pb-1 pr-2">動作</th>
                          <th className="pb-1">效果</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {modulePermissions.map((p, i) => (
                          <tr
                            key={i}
                            className={
                              p.module === module
                                ? "bg-red-50 dark:bg-red-900/10"
                                : ""
                            }
                          >
                            <td className="py-0.5 pr-2 text-gray-700 dark:text-gray-300">
                              {p.module}
                            </td>
                            <td className="py-0.5 pr-2 text-gray-500">
                              {p.action}
                            </td>
                            <td className="py-0.5">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${
                                  p.effect === "allow"
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                }`}
                              >
                                {p.effect}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {permissions.length === 0 && !permLoading && (
                <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  <p className="text-[12px] text-red-600 dark:text-red-400">
                    權限陣列為空 — RPC 未回傳此用戶的任何權限資料。請確認資料庫中 permission_assignments 表格有正確的設定。
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回上一頁
          </Button>
          <Button
            onClick={(e) => navigate("/", e)}
            className="gap-2"
          >
            <Home className="w-4 h-4" />
            回到主頁
          </Button>
        </div>
      </div>
    </div>
  );
}
