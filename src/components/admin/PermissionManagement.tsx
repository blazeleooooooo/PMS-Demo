"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePermission, permissionCacheInvalidateAll } from "@/hooks/use-permission";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2,
  ShieldCheck,
  Plus,
  Trash2,
  Edit2,
  Save,
  RefreshCw,
  Search,
  User,
  Building2,
  Users,
  Briefcase,
  Mail,
  ChevronRight,
  ChevronDown,
  Eye,
} from "lucide-react";
import { navigationGroups } from "@/lib/mock-data";
import { LOOKUP_TABLES } from "@/lib/lookup-tables-config";
import { navHrefToPermissionModule } from "@/lib/route-modules";

// ─── TYPES ──────────────────────────────────────────────

interface Role {
  id: string;
  role_key: string;
  display_name: string;
  level: number;
}

interface Permission {
  id: string;
  module: string;
  action: string;
  display_name: string;
}

interface PermissionAssignment {
  id: string;
  permission_id: string;
  dimension: string;
  dimension_value: string;
  effect: string;
  priority: number;
}

interface SpecificRule {
  id: string;
  dimension: string;
  dimension_value: string;
  module: string;
  rule_key: string;
  condition_json: Record<string, any>;
  effect: string;
  priority: number;
  description: string | null;
  is_active: boolean;
}

interface ModuleViewSummary {
  module: string;
  can_view_count: number;
  cannot_view_count: number;
}

interface ModuleViewRosterRow {
  staff_id: string;
  staff_name: string;
  role: string | null;
  bu_id: string | null;
  n_team_type_id: string | null;
  position: string | null;
  can_view: boolean;
  decided_by: string;
}

// ─── MODULE METADATA ────────────────────────────────────

interface ModuleItem {
  rowKey: string;
  key: string;
  label: string;
  level?: number; // 0 = top-level (default), 1 = sub-module
  parent?: string; // parent rowKey for collapsible grouping
  sectionHeader?: string;
}

// ── Sub-module definitions for detail pages (tabs within a page) ──
const SUB_MODULES: Record<string, { key: string; label: string }[]> = {
  projects: [
    { key: "projects.overview", label: "總覽 Overview" },
    { key: "projects.income", label: "收入 Income" },
    { key: "projects.expense", label: "支出 Expense" },
    { key: "projects.cost-structure", label: "成本結構 Cost Structure" },
    { key: "projects.payment-schedule", label: "收款進度 Payment Schedule" },
    { key: "projects.docs", label: "文件 Docs" },
    { key: "projects.3d", label: "3D效果圖 3D Render" },
    { key: "projects.weekly-report", label: "每10天工地報告 10 Day's Report" },
    { key: "projects.manhour", label: "工時 Man Hour" },
    { key: "projects.work-schedule", label: "工作排程 Work Schedule" },
    { key: "projects.site-status", label: "工地狀況 Site Status" },
    { key: "projects.supplier-comment", label: "供應商評語 Supplier Comment" },
    { key: "projects.building-comment", label: "大廈評語 Building Comment" },
    { key: "projects.internal-review", label: "內部評審 Internal Review" },
    { key: "projects.tender", label: "工程招標 RFQ" },
  ],
  proposals: [
    { key: "proposals.overview", label: "總覽 Overview" },
    { key: "proposals.l1-budget", label: "L1預算 L1 Budget" },
    { key: "proposals.site", label: "工地狀況 Site Status" },
    { key: "proposals.tender", label: "投標 RFQ" },
    { key: "proposals.quotation", label: "報價 Quote" },
    { key: "proposals.tag", label: "標籤 Tag" },
    { key: "proposals.internal-comment", label: "內部評語 Internal Comment" },
    { key: "proposals.building-comment", label: "大廈評語 Building Comment" },
    { key: "proposals.3d", label: "3D效果圖 3D Render" },
    { key: "proposals.manhour", label: "工時 Man Hour" },
  ],
  "bwf/proposals": [
    { key: "proposals.overview", label: "總覽 Overview" },
    { key: "proposals.l1-budget", label: "L1預算 L1 Budget" },
    { key: "proposals.quotation", label: "報價 Quote" },
    { key: "proposals.internal-comment", label: "內部評語 Internal Comment" },
    { key: "proposals.building-comment", label: "大廈評語 Building Comment" },
    { key: "proposals.manhour", label: "工時 Man Hour" },
  ],
  "bwf/projects": [
    { key: "projects.overview", label: "總覽 Overview" },
    { key: "proposals.quotation", label: "報價 Quote" },
    { key: "projects.income", label: "收入 Income" },
    { key: "projects.expense", label: "支出 Expense" },
    { key: "projects.work-schedule", label: "工作排程 Work Schedule" },
    { key: "projects.payment-schedule", label: "收款進度 Payment Schedule" },
    { key: "projects.supplier-comment", label: "供應商評語 Supplier Comment" },
    { key: "projects.building-comment", label: "大廈評語 Building Comment" },
    { key: "projects.internal-review", label: "內部評審 Internal Review" },
    { key: "projects.manhour", label: "工時 Man Hour" },
  ],
};

// ── Map navigation href to permission module key (shared with RouteGuard) ──
function hrefToModuleKey(href: string): string | null {
  return navHrefToPermissionModule(href);
}

// Pages gated by a module key not represented as its own top-level nav row.
const EXTRA_MATRIX_MODULES: { key: string; label: string }[] = [];

const MODULE_LABEL_OVERRIDES: Record<string, string> = {
  dashboard: "首頁 Dashboard",
  news: "項目新聞 News",
  dates: "重要日子 Important Dates",
  reports: "工作匯報 Work Reports",
  "reports.aug14-deadline": "14/8前必須完成 Site Status Deadline",
  "work-report-check": "工作匯報檢查 Work Report Check",
  "work-report-leaderboard": "工作匯報排行榜 Work Report Leaderboard",
  "settings.cost_centres": "公司單位 Cost Centres",
  "settings.income_expiry_reasons": "收入逾期原因 Income Expiry Reasons",
  "settings.bwf_products": "BWF 產品 BWF Products",
  proposals: "Pitching (BWA)",
  "asana-import": "Asana 匯入 Asana Import",
  "key-pitching": "重點 Pitching",
  projects: "Project (BWA)",
  "defect-crisis": "執漏危機表 Defect Crisis",
  "case-pdf": "個案PDF Case PDF",
  "bwf/proposals": "Pitching (BWF)",
  "bwf/projects": "Project (BWF)",
  "bwf/payment-progress": "收款進度 Payment Progress",
  "bwf/orders": "訂單管理 BWF Orders",
  "paid-pending-orders": "已收款待下單 Paid Pending Orders",
  production: "生產管理 Production",
  "consolidation-warehouse": "集運倉 Consolidation Warehouse",
  "installation-team": "安裝團隊 Installation Team",
  "completion-defect": "完工及執漏 Completion & Defect",
  "major-inquiry": "主要查詢列表 Major Inquiry",
  settings: "設定 Settings",
  "business-reports": "業務報表 Business Reports",
  "business-reports.risky-project": "L2 L3 比較表 L2 L3 Comparison Table",
  "design-reports": "設計業務報表 Design Reports",
  "design-reports.designer-hit-rate": "設計師命中率 Designer Hit Rate",
  "design-reports.project-type-analysis": "項目類型分析 Project Type Analysis",
  "design-reports.project-manhour-analysis": "項目工時分析 Project Manhour Analysis",
  "design-reports.3d-output": "3D數量統計 3D Quantity Stats",
  "design-reports.design-jobs": "設計工作項詳情 Design Job Detail",
  "testing.designer-daily-feed": "設計師每日匯報 Designer Daily Feed (Testing)",
  "team-reports": "團隊業務報表 Team Reports",
  "team-reports.pm-hit-rate": "項目經理命中率 PM Hit Rate (Team)",
  "team-reports.personal-performance": "個人BV表現 Personal BV Performance (Team)",
  "team-reports.project-manhour-analysis": "項目工時分析 Project Manhour (Team)",
  "team-reports.project-type-analysis": "項目類型分析 Project Type (Team)",
  "team-reports.overdue-receivable": "逾期應收項目 Overdue Receivable (Team)",
  "team-reports.outstanding-project": "未收款項目 Outstanding Project (Team)",
  "team-reports.bad-debt-project": "壞帳項目 Bad Debt Project (Team)",
  "team-reports.sales-by-pm": "按PM銷售統計 Sales by PM (Team)",
  "individual-reports": "個人業務報表 Individual Reports",
  "individual-reports.personal-performance": "個人BV表現 Personal BV Performance (Individual)",
  "individual-reports.risky-project": "L2 L3 比較表 L2 L3 Comparison Table",
  "individual-reports.overdue-receivable": "個人逾期應收 Overdue Receivable (Individual)",
  "individual-reports.shared-gp-trend": "Shared GP趨勢 Shared GP Trend",
  "individual-reports.pitch-hit-rate": "投標Hit Rate Pitch Hit Rate",
  "team-grouping": "分組工具 Team Grouping",
  "team-assign-bv": "BV分配 Assign BV (Team)",
  "assign-bv": "BV分配 Assign BV",
  "expense-control-waivers": "支出鎖定豁免 Expense Control Waivers",
  "site-photos": "現場相片 Site Photos",
  "completion-photos": "完成項目相片 Completion Photos",
  "designer-load": "設計師負載 Designer Load",
  "frequent-suppliers": "常用供應商報告 Frequent Suppliers",
  "bni-projects": "BNI合作項目 BNI Projects",
  "br-labour-update": "BR/勞保更新 BR / Labour Insurance Update",
  deposits: "BMO代付退款 BMO Refund",
  "ar-receive-dates": "AR收款申報 AR Collection Declaration",
  "collection-emails": "追收款電郵 Collection Emails",
  "ap-payment-dates": "AP大額支出申請 AP Large Expenditure Application",
  "expected-payments": "預計收付款 Expected Receipts & Payments",
  admin: "管理員 Admin",
  "admin.accounts": "帳戶管理 Accounts",
  "admin.roles": "角色管理 Roles",
  "admin.permissions": "權限管理 Permissions",
  "admin.expense-locked": "支出鎖定項目 Expense Locked",
  "admin.expense-installment-waivers": "支出總額豁免 Expense Total Waivers",
  "admin.income-expiry": "逾期收入原因 Expired Income Reasons",
  "admin.pms-login": "PMS登入報告 PMS Login Report",
  "admin.annual-bonus-settlement": "年度獎金結算 Annual Bonus Settlement",
  "admin.migration": "資料遷移 Migration",
  "admin.fk-audit": "外鍵稽核 FK Audit",
  testing: "測試中頁面 Testing Pages",
  "testing.reports": "工作匯報 Work Reports (Testing)",
  staff: "角色管理 Roles",
};

function moduleLabel(key: string, navLabel?: string): string {
  return MODULE_LABEL_OVERRIDES[key] ?? navLabel ?? key;
}

// ── Collect every /business-reports/<key> page as a sub-module ──
function buildBusinessReportsSubModules(): { key: string; label: string }[] {
  const subs: { key: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const group of navigationGroups) {
    for (const item of group.items) {
      if (item.external) continue;
      if (!item.href.startsWith("/business-reports/")) continue;
      const key = navHrefToPermissionModule(item.href);
      if (!key || !key.startsWith("business-reports.")) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      subs.push({ key, label: item.label });
    }
  }
  return subs;
}

// ── Collect every /design-reports/<key> page as a sub-module ──
function buildDesignReportsSubModules(): { key: string; label: string }[] {
  const subs: { key: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const group of navigationGroups) {
    for (const item of group.items) {
      if (item.external) continue;
      if (!item.href.startsWith("/design-reports/")) continue;
      const key = navHrefToPermissionModule(item.href);
      if (!key || !key.startsWith("design-reports.")) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      subs.push({ key, label: item.label });
    }
  }
  // Detail route /design-reports/design-jobs/[id] has no sidebar row.
  if (!seen.has("design-reports.design-jobs")) {
    subs.push({
      key: "design-reports.design-jobs",
      label: moduleLabel("design-reports.design-jobs"),
    });
  }
  return subs;
}

// ── Collect every /team-reports/<key> page as a sub-module ──
function buildTeamReportsSubModules(): { key: string; label: string }[] {
  const subs: { key: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const group of navigationGroups) {
    for (const item of group.items) {
      if (item.external) continue;
      if (!item.href.startsWith("/team-reports/")) continue;
      const key = navHrefToPermissionModule(item.href);
      if (!key || !key.startsWith("team-reports.")) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      subs.push({ key, label: item.label });
    }
  }
  return subs;
}

// ── Collect /individual-reports/<key> pages still under 項目管理 ──
function buildIndividualReportsSubModules(): { key: string; label: string }[] {
  const subs: { key: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const group of navigationGroups) {
    if (group.title !== "項目管理") continue;
    for (const item of group.items) {
      if (item.external) continue;
      if (!item.href.startsWith("/individual-reports/")) continue;
      const key = navHrefToPermissionModule(item.href);
      if (!key || !key.startsWith("individual-reports.")) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      subs.push({ key, label: item.label });
    }
  }
  return subs;
}

// ── Collect every /testing/<key> page as a sub-module ──
function buildTestingSubModules(): { key: string; label: string }[] {
  const subs: { key: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const group of navigationGroups) {
    for (const item of group.items) {
      if (item.external) continue;
      if (!item.href.startsWith("/testing/")) continue;
      const key = navHrefToPermissionModule(item.href);
      if (!key || !key.startsWith("testing.")) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      subs.push({ key, label: moduleLabel(key, item.label) });
    }
  }
  return subs;
}

// ── Collect every /admin/<key> page as a sub-module ──
function buildAdminSubModules(): { key: string; label: string }[] {
  const subs: { key: string; label: string }[] = [];
  const seen = new Set<string>();

  for (const group of navigationGroups) {
    for (const item of group.items) {
      if (item.external) continue;
      if (!item.href.startsWith("/admin/")) continue;
      const key = navHrefToPermissionModule(item.href);
      if (!key || !key.startsWith("admin.")) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      subs.push({ key, label: moduleLabel(key, item.label) });
    }
  }

  // Dev-only /admin tools (migration, fk-audit) stay out of the matrix.

  return subs;
}

// ── Collect every /settings page (lookup registry + fixed pages + nav labels) ──
function buildSettingsSubModules(): { key: string; label: string }[] {
  const subs: { key: string; label: string }[] = [];
  const seen = new Set<string>();

  for (const cfg of LOOKUP_TABLES) {
    const key = cfg.permissionKey ?? `settings.${cfg.key}`;
    if (!key.startsWith("settings.")) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    subs.push({
      key,
      label: cfg.labelEn ? `${cfg.labelZh} ${cfg.labelEn}` : cfg.labelZh,
    });
  }

  const fixedSettingsPages: { key: string; label: string }[] = [
    {
      key: "settings.task-reporting",
      label: "工作匯報設定 Task Reporting",
    },
    {
      key: "settings.site-status-questionnaire",
      label: "工地狀況問卷 Site Status Questionnaire",
    },
    {
      key: "settings.cost_centres",
      label: "公司單位 Cost Centres",
    },
  ];
  for (const page of fixedSettingsPages) {
    if (seen.has(page.key)) continue;
    seen.add(page.key);
    subs.push(page);
  }

  for (const group of navigationGroups) {
    const navItems = [...group.items, ...(group.settingsItems ?? [])];
    for (const item of navItems) {
      if (item.external) continue;
      if (!item.href.startsWith("/settings/")) continue;
      const key = navHrefToPermissionModule(item.href);
      if (!key || !key.startsWith("settings.")) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      subs.push({ key, label: item.label });
    }
  }

  subs.sort((a, b) => a.label.localeCompare(b.label, "zh-HK"));
  return subs;
}

function addModuleWithSubs(
  result: ModuleItem[],
  nextRowKey: () => string,
  permissionKey: string,
  label: string,
  subModules?: { key: string; label: string }[]
): string {
  const parentRowKey = nextRowKey();
  result.push({
    rowKey: parentRowKey,
    key: permissionKey,
    label,
    level: 0,
  });

  if (subModules?.length) {
    for (const sub of subModules) {
      result.push({
        rowKey: nextRowKey(),
        key: sub.key,
        label: sub.label,
        level: 1,
        parent: parentRowKey,
      });
    }
  }

  return parentRowKey;
}

// ── Build matrix rows: 1 top-nav tab = 1 section; settings always last ──
function buildModuleList(): ModuleItem[] {
  const result: ModuleItem[] = [];
  let rowCounter = 0;
  const nextRowKey = () => `row-${++rowCounter}`;

  const settingsSubs = buildSettingsSubModules();
  const businessReportsSubs = buildBusinessReportsSubModules();
  const designReportsSubs = buildDesignReportsSubModules();
  const teamReportsSubs = buildTeamReportsSubModules();
  const individualReportsSubs = buildIndividualReportsSubModules();
  const testingSubs = buildTestingSubModules();
  const adminSubs = buildAdminSubModules();

  for (const group of navigationGroups) {
    result.push({
      rowKey: nextRowKey(),
      key: "",
      label: group.title,
      sectionHeader: group.title,
    });

    const addedInGroup = new Set<string>();

    if (group.title === "業務報表") {
      addModuleWithSubs(
        result,
        nextRowKey,
        "business-reports",
        moduleLabel("business-reports"),
        businessReportsSubs
      );
      addedInGroup.add("business-reports");
      continue;
    }

    for (const item of group.items) {
      if (item.external) continue;
      if (item.href.startsWith("/settings/")) continue;
      if (item.href.startsWith("/business-reports/")) continue;
      if (item.href.startsWith("/design-reports/")) continue;
      // 主選單 alias of /design-reports/3d-output — same permission row under 焦點設計.
      if (item.href === "/3d-output") continue;
      if (item.href.startsWith("/team-reports/")) continue;
      // Nested under 項目管理 → 個人業務報表. Pages moved to 項目收支 stay as rows.
      if (
        item.href.startsWith("/individual-reports/") &&
        group.title === "項目管理"
      )
        continue;
      if (item.href.startsWith("/testing/")) continue;
      if (item.href.startsWith("/admin/")) continue;

      const key = hrefToModuleKey(item.href);
      if (!key || addedInGroup.has(key)) continue;
      addedInGroup.add(key);

      const subs = SUB_MODULES[key];
      addModuleWithSubs(
        result,
        nextRowKey,
        key,
        moduleLabel(key, item.label),
        subs
      );
    }

    // Design reports live under 焦點設計 as a nested permission group.
    if (group.title === "焦點設計" && designReportsSubs.length > 0) {
      addModuleWithSubs(
        result,
        nextRowKey,
        "design-reports",
        moduleLabel("design-reports"),
        designReportsSubs
      );
      addedInGroup.add("design-reports");
    }

    // Team-scoped business reports live under 團隊工具.
    if (group.title === "團隊工具" && teamReportsSubs.length > 0) {
      addModuleWithSubs(
        result,
        nextRowKey,
        "team-reports",
        moduleLabel("team-reports"),
        teamReportsSubs
      );
      addedInGroup.add("team-reports");
    }

    // Remaining individual-scoped reports live under 項目管理 → 業務報表.
    // Cash-related individual pages (L2 L3 / 個人逾期應收) are listed under 項目收支.
    if (group.title === "項目管理" && individualReportsSubs.length > 0) {
      addModuleWithSubs(
        result,
        nextRowKey,
        "individual-reports",
        moduleLabel("individual-reports"),
        individualReportsSubs
      );
      addedInGroup.add("individual-reports");
    }

    // Admin panel /admin/* pages nest under a single 管理員 group.
    if (group.title === "管理員面板" && adminSubs.length > 0) {
      addModuleWithSubs(
        result,
        nextRowKey,
        "admin",
        moduleLabel("admin"),
        adminSubs
      );
      addedInGroup.add("admin");
    }

    // WIP review pages under 測試中頁面 → /testing/*.
    if (group.title === "測試中頁面" && testingSubs.length > 0) {
      addModuleWithSubs(
        result,
        nextRowKey,
        "testing",
        moduleLabel("testing"),
        testingSubs
      );
      addedInGroup.add("testing");
    }
  }

  // Settings section — always last; all /settings pages live here (not under top nav).
  result.push({
    rowKey: nextRowKey(),
    key: "",
    label: "設定 Settings",
    sectionHeader: "設定 Settings",
  });
  addModuleWithSubs(
    result,
    nextRowKey,
    "settings",
    moduleLabel("settings"),
    settingsSubs
  );

  for (const extra of EXTRA_MATRIX_MODULES) {
    addModuleWithSubs(result, nextRowKey, extra.key, extra.label);
  }

  return result;
}

const MODULE_LIST: ModuleItem[] = buildModuleList();

const UNIQUE_MODULE_LIST: ModuleItem[] = Array.from(
  new Map(MODULE_LIST.filter((m) => m.key).map((m) => [m.key, m])).values()
);

// Parent rowKeys that have at least one sub-module (collapsible in the matrix).
const PARENTS_WITH_CHILDREN: string[] = MODULE_LIST.filter(
  (m) => m.key && (m.level ?? 0) === 0
)
  .filter((m) => MODULE_LIST.some((child) => child.parent === m.rowKey))
  .map((m) => m.rowKey);

// Parents collapsed by default — these have many sub-rows.
const DEFAULT_COLLAPSED_KEYS = [
  "proposals",
  "projects",
  "bwf/proposals",
  "bwf/projects",
  "settings",
  "business-reports",
  "design-reports",
  "team-reports",
  "individual-reports",
  "testing",
  "admin",
];

const ACTIONS = ["view", "create", "edit", "delete"];
const ACTION_LABELS: Record<string, string> = {
  view: "查看",
  create: "建立",
  edit: "編輯",
  delete: "刪除",
};

// Override order (most specific wins): special > user > position > team > bu > role.
// Deny only wins when two rules share the same specificity/priority.
const DIMENSIONS = [
  { key: "role", label: "按角色", priority: 10 },
  { key: "bu", label: "按公司", priority: 20 },
  { key: "team", label: "按團隊", priority: 30 },
  { key: "position", label: "按職位", priority: 40 },
  { key: "user", label: "按用戶", priority: 50 },
];

// ─── MAIN COMPONENT ─────────────────────────────────────

export default function PermissionManagement() {
  const { loading: permLoading, refreshPermissions } = usePermission();
  const { toast } = useToast();
  const supabase = createClient();

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [assignments, setAssignments] = useState<PermissionAssignment[]>([]);
  const [specificRules, setSpecificRules] = useState<SpecificRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialPermLoaded, setInitialPermLoaded] = useState(false);

  // Track when the first permission load finishes
  useEffect(() => {
    if (!permLoading && !initialPermLoaded) {
      setInitialPermLoaded(true);
    }
  }, [permLoading, initialPermLoaded]);

  // Dimension tab selectors
  const [selectedDimension, setSelectedDimension] = useState("role");
  const [selectedDimensionValue, setSelectedDimensionValue] = useState("");

  // Which parent module rows are expanded in the matrix. proposals / projects /
  // settings start collapsed because they carry many sub-rows.
  const [expandedParents, setExpandedParents] = useState<Set<string>>(
    () =>
      new Set(
        PARENTS_WITH_CHILDREN.filter((rowKey) => {
          const mod = MODULE_LIST.find((m) => m.rowKey === rowKey);
          return mod && !DEFAULT_COLLAPSED_KEYS.includes(mod.key);
        })
      )
  );
  function toggleParentExpanded(parentRowKey: string) {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentRowKey)) next.delete(parentRowKey);
      else next.add(parentRowKey);
      return next;
    });
  }

  // Available dimension values
  const [dimensionValues, setDimensionValues] = useState<
    { value: string; label: string }[]
  >([]);

  // Staff list (for "user" dimension) — extended with dimension fields
  const [staffList, setStaffList] = useState<
    { id: string; name: string; role: string; bu_id: string | null; n_team_type_id: string | null; position: string | null; email: string | null }[]
  >([]);

  // Team types list
  const [teamTypes, setTeamTypes] = useState<
    { id: string; name: string }[]
  >([]);

  // Cost centres (BU) list
  const [costCentres, setCostCentres] = useState<
    { id: string; display: string; bu_code: string }[]
  >([]);

  // Specific rules dialog
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SpecificRule | null>(null);

  // ─── STAFF PERMISSION LOOKUP ─────────────────────────────
  const [lookupStaffId, setLookupStaffId] = useState<string>("");
  const [lookupStaffData, setLookupStaffData] = useState<typeof staffList[0] | null>(null);
  const [lookupAssignments, setLookupAssignments] = useState<(PermissionAssignment & { permission?: Permission })[]>([]);

  // ─── MODULE VIEW ACCESS (who can / cannot view) ─────────
  const [viewSummaries, setViewSummaries] = useState<
    Record<string, ModuleViewSummary>
  >({});
  const [viewSummariesLoading, setViewSummariesLoading] = useState(false);
  const [accessSheetOpen, setAccessSheetOpen] = useState(false);
  const [accessSheetModule, setAccessSheetModule] = useState<{
    key: string;
    label: string;
  } | null>(null);
  const [accessRoster, setAccessRoster] = useState<ModuleViewRosterRow[]>([]);
  const [accessRosterLoading, setAccessRosterLoading] = useState(false);
  const [accessSheetTab, setAccessSheetTab] = useState<"can" | "cannot">("can");
  const [accessSheetSearch, setAccessSheetSearch] = useState("");

  // ─── SYNC MISSING PERMISSION ROWS ───────────────────
  // Matrix rows come from MODULE_LIST (nav). Each cell needs a matching
  // permissions(module, action) row or toggleAssignment is a silent no-op.
  // On conflict / race (React Strict Mode double-fetch), re-select from DB
  // instead of returning a stale snapshot that would gray out cells.
  async function syncMissingPermissions(
    currentPerms: Permission[]
  ): Promise<Permission[]> {
    const existing = new Set(
      currentPerms.map((p) => `${p.module}|${p.action}`)
    );
    const toInsert: { module: string; action: string; display_name: string }[] =
      [];

    for (const mod of UNIQUE_MODULE_LIST) {
      for (const action of ACTIONS) {
        const key = `${mod.key}|${action}`;
        if (existing.has(key)) continue;
        toInsert.push({
          module: mod.key,
          action,
          display_name: `${ACTION_LABELS[action]} ${mod.label}`,
        });
      }
    }

    if (toInsert.length === 0) return currentPerms;

    const { error } = await supabase.from("permissions").upsert(toInsert, {
      onConflict: "module,action",
      ignoreDuplicates: true,
    });

    if (error) {
      console.warn(
        "[PermissionManagement] syncMissingPermissions upsert:",
        error.message
      );
    } else {
      console.info(
        `[PermissionManagement] synced ${toInsert.length} missing permission row(s)`
      );
    }

    // Always re-fetch so concurrent mounts cannot wipe newly inserted rows.
    const { data: refreshed, error: refreshError } = await supabase
      .from("permissions")
      .select("*")
      .order("module")
      .order("action");

    if (refreshError || !refreshed) {
      console.warn(
        "[PermissionManagement] syncMissingPermissions refresh:",
        refreshError?.message
      );
      return currentPerms;
    }

    return refreshed;
  }

  // ─── DATA FETCHING ──────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes, assignRes, rulesRes, staffRes, teamRes, costCentreRes] =
        await Promise.all([
          supabase
            .from("roles")
            .select("*")
            .order("level", { ascending: false }),
          supabase
            .from("permissions")
            .select("*")
            .order("module")
            .order("action"),
          supabase.from("permission_assignments").select("*"),
          supabase.from("specific_rules").select("*").order("created_at", { ascending: false }),
          supabase
            .from("staff")
            .select("id, name, role, position, bu_id, n_team_type_id, email, status")
            .eq("status", "Active")
            .order("name"),
          supabase
            .from("team_types")
            .select("id, display")
            .eq("is_active", true)
            .order("display"),
          supabase
            .from("cost_centres")
            .select("id, display, chinese_display, bu_code")
            .order("display"),
        ]);

      if (rolesRes.data) setRoles(rolesRes.data);
      if (permsRes.data) {
        const synced = await syncMissingPermissions(permsRes.data);
        setPermissions(synced);
      }
      if (assignRes.data) setAssignments(assignRes.data);
      if (rulesRes.data) setSpecificRules(rulesRes.data as SpecificRule[]);
      if (staffRes.data)
        setStaffList(
          staffRes.data
            .map((s: any) => ({
              id: s.id,
              name: s.name || s.id,
              role: s.role || "",
              bu_id: s.bu_id || null,
              n_team_type_id: s.n_team_type_id || null,
              position: s.position || null,
              email: s.email || null,
            }))
            .sort((a: { name: string }, b: { name: string }) =>
              a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
            )
        );
      if (teamRes.data)
        setTeamTypes(
          teamRes.data.map((t: any) => ({ id: t.id, name: t.display || t.id }))
        );
      if (costCentreRes.data)
        setCostCentres(
          costCentreRes.data.map((c: any) => ({
            id: c.id,
            display: c.chinese_display || c.display || c.bu_code || c.id,
            bu_code: c.bu_code || "",
          }))
        );
    } catch (err) {
      console.error("[PermissionManagement] fetchData error:", err);
      toast({
        title: "載入錯誤",
        description: "無法載入權限數據",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchViewSummaries = useCallback(async () => {
    const modules = UNIQUE_MODULE_LIST.map((m) => m.key).filter(Boolean);
    if (modules.length === 0) return;
    setViewSummariesLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_modules_view_summary", {
        p_modules: modules,
        p_action: "view",
      });
      if (error) throw error;
      const map: Record<string, ModuleViewSummary> = {};
      for (const row of (data ?? []) as ModuleViewSummary[]) {
        map[row.module] = {
          module: row.module,
          can_view_count: Number(row.can_view_count) || 0,
          cannot_view_count: Number(row.cannot_view_count) || 0,
        };
      }
      setViewSummaries(map);
    } catch (err) {
      console.warn("[PermissionManagement] fetchViewSummaries:", err);
    } finally {
      setViewSummariesLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- createClient() is stable enough for this page
  }, []);

  useEffect(() => {
    if (!loading) {
      void fetchViewSummaries();
    }
  }, [loading, assignments, fetchViewSummaries]);

  async function openAccessSheet(moduleKey: string, moduleLabel: string) {
    setAccessSheetModule({ key: moduleKey, label: moduleLabel });
    setAccessSheetOpen(true);
    setAccessSheetTab("can");
    setAccessSheetSearch("");
    setAccessRoster([]);
    setAccessRosterLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_module_view_roster", {
        p_module: moduleKey,
        p_action: "view",
      });
      if (error) throw error;
      setAccessRoster(
        ((data ?? []) as ModuleViewRosterRow[]).map((row) => ({
          ...row,
          staff_id: String(row.staff_id),
          can_view: Boolean(row.can_view),
        }))
      );
      const cannot = ((data ?? []) as ModuleViewRosterRow[]).filter(
        (r) => !r.can_view
      ).length;
      if (cannot > 0) setAccessSheetTab("cannot");
    } catch (err: any) {
      console.error("[PermissionManagement] openAccessSheet:", err);
      toast({
        title: "無法載入存取名單",
        description: err.message || "請稍後再試",
        variant: "destructive",
      });
    } finally {
      setAccessRosterLoading(false);
    }
  }

  // ─── STAFF LOOKUP LOGIC ─────────────────────────────────

  useEffect(() => {
    if (!lookupStaffId) {
      setLookupStaffData(null);
      setLookupAssignments([]);
      return;
    }
    const staff = staffList.find((s) => s.id === lookupStaffId);
    if (!staff) {
      setLookupStaffData(null);
      setLookupAssignments([]);
      return;
    }
    setLookupStaffData(staff);

    // Resolve role_key same as RPC
    const roleKey = staff.role
      ? staff.role.toLowerCase().replace(/ /g, "_")
      : "";

    // Find all matching permission_assignments for this staff across all dimensions
    const matchingAssignments = assignments.filter((a) => {
      if (a.dimension === "role" && a.dimension_value === roleKey) return true;
      if (a.dimension === "bu" && staff.bu_id && a.dimension_value === staff.bu_id) return true;
      if (a.dimension === "team" && staff.n_team_type_id && a.dimension_value === staff.n_team_type_id) return true;
      if (a.dimension === "position" && staff.position && a.dimension_value === staff.position) return true;
      if (a.dimension === "user" && a.dimension_value === staff.id) return true;
      return false;
    });

    // Attach permission details
    const enriched = matchingAssignments.map((a) => ({
      ...a,
      permission: permissions.find((p) => p.id === a.permission_id),
    }));

    setLookupAssignments(enriched);
  }, [lookupStaffId, staffList, assignments, permissions]);

  // Quick update staff field
  async function updateStaffField(field: string, value: string) {
    if (!lookupStaffId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("staff")
        .update({ [field]: value || null })
        .eq("id", lookupStaffId);
      if (error) throw error;
      // Update local state
      setStaffList((prev) =>
        prev.map((s) =>
          s.id === lookupStaffId ? { ...s, [field]: value || null } : s
        )
      );
      toast({ title: "✓ 已更新", description: `${field} 已更新`, duration: 2000 });
    } catch (err: any) {
      toast({ title: "更新錯誤", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ─── DIMENSION VALUE OPTIONS ─────────────────────────

  useEffect(() => {
    switch (selectedDimension) {
      case "role":
        setDimensionValues(
          roles.map((r) => ({ value: r.role_key, label: r.display_name }))
        );
        break;
      case "bu":
        setDimensionValues(
          costCentres.map((c) => ({
            value: c.id,
            label: `${c.bu_code} — ${c.display}`,
          }))
        );
        break;
      case "team":
        setDimensionValues(
          teamTypes.map((t) => ({ value: t.id, label: t.name }))
        );
        break;
      case "position":
        setDimensionValues([
          { value: "PM", label: "PM" },
          { value: "Designer", label: "Designer" },
          { value: "Company", label: "Company" },
        ]);
        break;
      case "user":
        setDimensionValues(
          staffList.map((s) => ({
            value: s.id,
            label: `${s.name} (${s.role})`,
          }))
        );
        break;
      default:
        setDimensionValues([]);
    }
    setSelectedDimensionValue("");
  }, [selectedDimension, roles, teamTypes, staffList, costCentres]);

  // Auto-sync dimension value to staff's dimension when lookup staff changes or tab changes
  useEffect(() => {
    if (!lookupStaffData) return;
    const roleKey = lookupStaffData.role
      ? lookupStaffData.role.toLowerCase().replace(/ /g, "_")
      : "";
    switch (selectedDimension) {
      case "role":
        if (roleKey) setSelectedDimensionValue(roleKey);
        break;
      case "bu":
        if (lookupStaffData.bu_id) setSelectedDimensionValue(lookupStaffData.bu_id);
        break;
      case "team":
        if (lookupStaffData.n_team_type_id) setSelectedDimensionValue(lookupStaffData.n_team_type_id);
        break;
      case "position":
        if (lookupStaffData.position) setSelectedDimensionValue(lookupStaffData.position);
        break;
      case "user":
        setSelectedDimensionValue(lookupStaffData.id);
        break;
    }
  }, [lookupStaffData, selectedDimension]);

  // ─── DIMENSION VALUE LABEL RESOLVER ─────────────────────

  function resolveDimensionValueLabel(dimension: string, value: string): string {
    switch (dimension) {
      case "role": {
        const role = roles.find((r) => r.role_key === value);
        return role ? role.display_name : value;
      }
      case "bu": {
        const cc = costCentres.find((c) => c.id === value);
        return cc ? `${cc.bu_code} — ${cc.display}` : value;
      }
      case "team": {
        const team = teamTypes.find((t) => t.id === value);
        return team ? team.name : value;
      }
      case "user": {
        const staff = staffList.find((s) => s.id === value);
        return staff ? staff.name : value;
      }
      default:
        return value;
    }
  }

  // ─── MATRIX HELPERS ──────────────────────────────────

  /**
   * Get the current assignment state for a specific dimension_value + module + action.
   * Returns "allow" | "deny" | null (no assignment = inherit)
   */
  function getAssignmentState(
    dimensionValue: string,
    moduleKey: string,
    actionKey: string
  ): "allow" | "deny" | null {
    // Find the permission_id for this module+action
    const perm = permissions.find(
      (p) => p.module === moduleKey && p.action === actionKey
    );
    if (!perm) return null;

    // Find the assignment
    const assignment = assignments.find(
      (a) =>
        a.dimension === selectedDimension &&
        a.dimension_value === dimensionValue &&
        a.permission_id === perm.id
    );
    if (!assignment) return null;
    return assignment.effect as "allow" | "deny";
  }

  // Check if there's a wildcard (all modules / all actions) assignment for this dimension_value
  function hasWildcardAll(dimensionValue: string): boolean {
    const wildcardPerm = permissions.find(
      (p) => p.module === "*" && p.action === "*"
    );
    if (!wildcardPerm) return false;
    return assignments.some(
      (a) =>
        a.dimension === selectedDimension &&
        a.dimension_value === dimensionValue &&
        a.permission_id === wildcardPerm.id &&
        a.effect === "allow"
    );
  }

  // ─── SAVE ASSIGNMENT ──────────────────────────────────

  /** Ensure permissions(module, action) exists so matrix cells stay clickable. */
  async function ensurePermissionRow(
    moduleKey: string,
    actionKey: string
  ): Promise<Permission | null> {
    const existing = permissions.find(
      (p) => p.module === moduleKey && p.action === actionKey
    );
    if (existing) return existing;

    const mod = UNIQUE_MODULE_LIST.find((m) => m.key === moduleKey);
    const displayName = `${ACTION_LABELS[actionKey] ?? actionKey} ${
      mod?.label ?? moduleKey
    }`;

    const { error } = await supabase.from("permissions").upsert(
      {
        module: moduleKey,
        action: actionKey,
        display_name: displayName,
      },
      { onConflict: "module,action", ignoreDuplicates: true }
    );
    if (error) {
      console.warn("[PermissionManagement] ensurePermissionRow upsert:", error.message);
    }

    const { data, error: selErr } = await supabase
      .from("permissions")
      .select("*")
      .eq("module", moduleKey)
      .eq("action", actionKey)
      .maybeSingle();

    if (selErr || !data) {
      console.warn(
        "[PermissionManagement] ensurePermissionRow select:",
        selErr?.message
      );
      return null;
    }

    setPermissions((prev) => {
      if (prev.some((p) => p.id === data.id)) return prev;
      return [...prev, data];
    });
    return data;
  }

  async function toggleAssignment(
    dimensionValue: string,
    moduleKey: string,
    actionKey: string
  ) {
    if (saving) return;
    setSaving(true);
    try {
      const perm = await ensurePermissionRow(moduleKey, actionKey);
      if (!perm) {
        toast({
          title: "無法儲存",
          description: `模組 ${moduleKey}/${actionKey} 尚未在資料庫註冊。請重新整理頁面或聯絡開發人員。`,
          variant: "destructive",
        });
        return;
      }

      const existing = assignments.find(
        (a) =>
          a.dimension === selectedDimension &&
          a.dimension_value === dimensionValue &&
          a.permission_id === perm.id
      );
      if (existing) {
        if (existing.effect === "allow") {
          // allow → deny
          const { error } = await supabase
            .from("permission_assignments")
            .update({ effect: "deny" })
            .eq("id", existing.id);
          if (error) throw error;
          setAssignments((prev) =>
            prev.map((a) =>
              a.id === existing.id ? { ...a, effect: "deny" } : a
            )
          );
        } else {
          // deny → remove (inherit)
          const { error } = await supabase
            .from("permission_assignments")
            .delete()
            .eq("id", existing.id);
          if (error) throw error;
          setAssignments((prev) => prev.filter((a) => a.id !== existing.id));
        }
      } else {
        // no assignment → allow
        const dimMeta = DIMENSIONS.find((d) => d.key === selectedDimension);
        const priority = dimMeta?.priority || 10;
        const { data, error } = await supabase
          .from("permission_assignments")
          .insert({
            permission_id: perm.id,
            dimension: selectedDimension,
            dimension_value: dimensionValue,
            effect: "allow",
            priority,
          })
          .select()
          .single();
        if (error) throw error;
        if (data) setAssignments((prev) => [...prev, data]);
      }
      // Invalidate global permission cache so other pages get fresh permissions on next navigation
      // NOTE: We do NOT call refreshPermissions() here because that triggers a loading state
      // which causes the entire page to re-render and scroll back to top — bad UX when
      // the admin is setting multiple permissions in a row and needs to stay in position.
      permissionCacheInvalidateAll();
      toast({
        title: "✓ 已儲存",
        description: "權限變更將於導航至其他頁面時生效",
        duration: 2000,
      });
    } catch (err: any) {
      console.error("[PermissionManagement] toggleAssignment error:", err);
      toast({
        title: "儲存錯誤",
        description: err.message || "無法更新權限",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  // ─── SPECIFIC RULES CRUD ──────────────────────────────

  async function saveRule(rule: Partial<SpecificRule>) {
    setSaving(true);
    try {
      if (editingRule?.id) {
        // Update
        const { error } = await supabase
          .from("specific_rules")
          .update({
            dimension: rule.dimension,
            dimension_value: rule.dimension_value,
            module: rule.module,
            rule_key: rule.rule_key,
            condition_json: rule.condition_json,
            effect: rule.effect,
            priority: rule.priority,
            description: rule.description,
            is_active: rule.is_active,
          })
          .eq("id", editingRule.id);
        if (error) throw error;
        setSpecificRules((prev) =>
          prev.map((r) =>
            r.id === editingRule.id ? { ...r, ...rule } as SpecificRule : r
          )
        );
        toast({ title: "已更新", description: "特殊規則已更新" });
      } else {
        // Insert
        const { data, error } = await supabase
          .from("specific_rules")
          .insert(rule)
          .select()
          .single();
        if (error) throw error;
        if (data) setSpecificRules((prev) => [data as SpecificRule, ...prev]);
        toast({ title: "已建立", description: "特殊規則已建立" });
      }
      setRuleDialogOpen(false);
      setEditingRule(null);
    } catch (err: any) {
      console.error("[PermissionManagement] saveRule error:", err);
      toast({
        title: "儲存錯誤",
        description: err.message || "無法儲存規則",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule(ruleId: string) {
    if (!confirm("確認刪除此規則？")) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("specific_rules")
        .delete()
        .eq("id", ruleId);
      if (error) throw error;
      setSpecificRules((prev) => prev.filter((r) => r.id !== ruleId));
      toast({ title: "已刪除", description: "特殊規則已刪除" });
    } catch (err: any) {
      toast({
        title: "刪除錯誤",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleRuleActive(rule: SpecificRule) {
    const newActive = !rule.is_active;
    const { error } = await supabase
      .from("specific_rules")
      .update({ is_active: newActive })
      .eq("id", rule.id);
    if (error) {
      toast({
        title: "更新錯誤",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setSpecificRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, is_active: newActive } : r))
    );
  }

  // ─── LOADING ────────────────────────────────────────────
  // Only show full-page spinner on initial load, not on subsequent refreshes
  if ((!initialPermLoaded && permLoading) || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-3 text-sm text-muted-foreground">載入權限數據...</span>
      </div>
    );
  }

  // ─── RENDER: PERMISSION MATRIX ──────────────────────────

  function renderPermissionMatrix() {
    if (!selectedDimensionValue) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          請選擇一個{DIMENSIONS.find((d) => d.key === selectedDimension)?.label.slice(1)}來查看權限矩陣
        </div>
      );
    }

    const isWildcard = hasWildcardAll(selectedDimensionValue);

    return (
      <div className="space-y-4">
        {isWildcard && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <p className="text-sm text-green-700 dark:text-green-300">
              ✅ 此{DIMENSIONS.find((d) => d.key === selectedDimension)?.label.slice(1)}擁有全部權限（萬用字元 */*）。下方矩陣顯示額外的明確指定。
            </p>
          </div>
        )}

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[240px] font-semibold">模組</TableHead>
                {ACTIONS.map((action) => (
                  <TableHead key={action} className="text-center w-[100px] font-semibold">
                    {ACTION_LABELS[action]}
                  </TableHead>
                ))}
                <TableHead className="text-center w-[120px] font-semibold">
                  存取 Access
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODULE_LIST.map((mod) => {
                if (mod.sectionHeader) {
                  return (
                    <TableRow
                      key={mod.rowKey}
                      className="bg-muted/60 hover:bg-muted/60"
                    >
                      <TableCell
                        colSpan={2 + ACTIONS.length}
                        className="py-2.5 border-t border-border/80"
                      >
                        <span className="text-sm font-bold tracking-wide text-foreground">
                          {mod.sectionHeader}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                }

                const isSubModule = (mod.level ?? 0) === 1;
                if (isSubModule && mod.parent && !expandedParents.has(mod.parent)) {
                  return null;
                }
                const hasChildren = PARENTS_WITH_CHILDREN.includes(mod.rowKey);
                const isExpanded = expandedParents.has(mod.rowKey);
                const childCount = hasChildren
                  ? MODULE_LIST.filter((m) => m.parent === mod.rowKey).length
                  : 0;
                return (
                  <TableRow
                    key={mod.rowKey}
                    className={`hover:bg-muted/30 ${isSubModule ? "bg-muted/10" : ""}`}
                  >
                    <TableCell className={`font-medium ${isSubModule ? "pl-8" : ""}`}>
                      {isSubModule ? (
                        <>
                          <span className="text-xs text-muted-foreground mr-1">└</span>
                          <span className="text-sm">{mod.label}</span>
                          <span className="text-[12px] text-muted-foreground ml-1.5 font-mono">
                            {mod.key}
                          </span>
                        </>
                      ) : hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggleParentExpanded(mod.rowKey)}
                          className="flex items-center gap-1.5 text-left w-full group"
                          title={isExpanded ? "收合 Collapse" : "展開 Expand"}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span className="text-sm font-semibold group-hover:text-foreground">{mod.label}</span>
                          <span className="text-xs text-muted-foreground ml-1">{mod.key}</span>
                          <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                            {childCount}
                          </Badge>
                        </button>
                      ) : (
                        <>
                          <span className="text-sm font-semibold">{mod.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {mod.key}
                          </span>
                        </>
                      )}
                    </TableCell>
                    {ACTIONS.map((action) => {
                      const state = getAssignmentState(
                        selectedDimensionValue,
                        mod.key,
                        action
                      );
                      // Always clickable: toggleAssignment ensures the
                      // permissions(module, action) row exists on demand.
                      return (
                        <TableCell key={action} className="text-center">
                          <PermissionCell
                            state={state}
                            actionable
                            onClick={() =>
                              toggleAssignment(
                                selectedDimensionValue,
                                mod.key,
                                action
                              )
                            }
                            disabled={saving}
                          />
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center">
                      <AccessSummaryCell
                        summary={viewSummaries[mod.key]}
                        loading={viewSummariesLoading && !viewSummaries[mod.key]}
                        onClick={() => openAccessSheet(mod.key, mod.label)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-4 rounded bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700" />
            允許 (Allow)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-4 rounded bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700" />
            拒絕 (Deny)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-4 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600" />
            繼承 (Inherit / No assignment)
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            存取 = 有效查看權限人數（點擊查看名單）
          </span>
        </div>
      </div>
    );
  }

  // ─── RENDER: SPECIFIC RULES ───────────────────────────

  function renderSpecificRules() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            特殊規則用於根據數據狀態動態控制權限（例如：已確認的提案不可編輯）
          </p>
          <Button
            size="sm"
            onClick={() => {
              setEditingRule(null);
              setRuleDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            新增規則
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">描述</TableHead>
                <TableHead className="font-semibold">維度</TableHead>
                <TableHead className="font-semibold">模組</TableHead>
                <TableHead className="font-semibold">規則鍵</TableHead>
                <TableHead className="font-semibold text-center">效果</TableHead>
                <TableHead className="font-semibold text-center">啟用</TableHead>
                <TableHead className="font-semibold text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {specificRules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    暫無特殊規則
                  </TableCell>
                </TableRow>
              ) : (
                specificRules.map((rule) => (
                  <TableRow key={rule.id} className={!rule.is_active ? "opacity-50" : ""}>
                    <TableCell className="max-w-[200px]">
                      <span className="text-sm">{rule.description || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {rule.dimension}: {resolveDimensionValueLabel(rule.dimension, rule.dimension_value)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{rule.module}</span>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {rule.rule_key}
                      </code>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={rule.effect === "allow" ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {rule.effect === "allow" ? "允許" : "拒絕"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => toggleRuleActive(rule)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingRule(rule);
                            setRuleDialogOpen(true);
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteRule(rule.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // ─── MAIN RENDER ──────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">權限管理</h1>
            <p className="text-sm text-muted-foreground">
              管理各角色、公司、團隊、職位和用戶的模組存取權限
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={async () => {
              await refreshPermissions();
              toast({
                title: "✓ 已套用",
                description: "您的權限已即時更新",
                duration: 2000,
              });
            }}
            disabled={loading}
          >
            <ShieldCheck className="h-4 w-4 mr-1" />
            套用變更至本機
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            重新整理
          </Button>
        </div>
      </div>

      {/* Staff Permission Lookup Panel */}
      <Card className="border-violet-200 dark:border-violet-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-violet-500" />
            <CardTitle className="text-base">員工權限查詢 Staff Permission Lookup</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            選擇一位員工，查看其權限標籤及相關的權限分配
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Staff Selector */}
          <Select value={lookupStaffId} onValueChange={setLookupStaffId}>
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="選擇員工..." />
            </SelectTrigger>
            <SelectContent>
              {staffList.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.role || "—"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {lookupStaffData && (
            <div className="space-y-4">
              {/* Permission Tags (dimension values) */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">權限維度標籤 Dimension Tags</p>
                <div className="flex flex-wrap gap-2">
                  {/* Role */}
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="gap-1 py-1 px-2 bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700">
                      <User className="h-3 w-3" />
                      <span className="text-xs font-medium">角色:</span>
                      <Select
                        value={lookupStaffData.role || ""}
                        onValueChange={(v) => updateStaffField("role", v)}
                      >
                        <SelectTrigger className="h-6 w-auto min-w-[80px] border-0 bg-transparent p-0 text-xs font-semibold shadow-none focus:ring-0">
                          <SelectValue placeholder="未設定" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Super Admin">Super Admin</SelectItem>
                          <SelectItem value="Admin">Admin</SelectItem>
                          <SelectItem value="Senior User">Senior User</SelectItem>
                          <SelectItem value="User">User</SelectItem>
                        </SelectContent>
                      </Select>
                    </Badge>
                  </div>

                  {/* BU */}
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="gap-1 py-1 px-2 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
                      <Building2 className="h-3 w-3" />
                      <span className="text-xs font-medium">公司:</span>
                      <Select
                        value={lookupStaffData.bu_id || ""}
                        onValueChange={(v) => updateStaffField("bu_id", v)}
                      >
                        <SelectTrigger className="h-6 w-auto min-w-[80px] border-0 bg-transparent p-0 text-xs font-semibold shadow-none focus:ring-0">
                          <SelectValue placeholder="未設定" />
                        </SelectTrigger>
                        <SelectContent>
                          {costCentres.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.bu_code} — {c.display}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Badge>
                  </div>

                  {/* Team */}
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="gap-1 py-1 px-2 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700">
                      <Users className="h-3 w-3" />
                      <span className="text-xs font-medium">團隊:</span>
                      <Select
                        value={lookupStaffData.n_team_type_id || ""}
                        onValueChange={(v) => updateStaffField("n_team_type_id", v)}
                      >
                        <SelectTrigger className="h-6 w-auto min-w-[80px] border-0 bg-transparent p-0 text-xs font-semibold shadow-none focus:ring-0">
                          <SelectValue placeholder="未設定" />
                        </SelectTrigger>
                        <SelectContent>
                          {teamTypes.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Badge>
                  </div>

                  {/* Position */}
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="gap-1 py-1 px-2 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700">
                      <Briefcase className="h-3 w-3" />
                      <span className="text-xs font-medium">職位:</span>
                      <Select
                        value={lookupStaffData.position || ""}
                        onValueChange={(v) => updateStaffField("position", v)}
                      >
                        <SelectTrigger className="h-6 w-auto min-w-[80px] border-0 bg-transparent p-0 text-xs font-semibold shadow-none focus:ring-0">
                          <SelectValue placeholder="未設定" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PM">PM</SelectItem>
                          <SelectItem value="Designer">Designer</SelectItem>
                          <SelectItem value="Company">Company</SelectItem>
                        </SelectContent>
                      </Select>
                    </Badge>
                  </div>

                  {/* Email (read-only tag) */}
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="gap-1 py-1 px-2 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600">
                      <Mail className="h-3 w-3" />
                      <span className="text-xs font-medium">Email:</span>
                      <span className="text-xs">{lookupStaffData.email || "未設定"}</span>
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Related Permission Assignments */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  相關權限分配 Related Assignments
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {lookupAssignments.length}
                  </Badge>
                </p>
                {lookupAssignments.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3">此員工沒有匹配的權限分配記錄</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden max-h-[280px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-xs font-semibold w-[100px]">維度</TableHead>
                          <TableHead className="text-xs font-semibold w-[140px]">維度值</TableHead>
                          <TableHead className="text-xs font-semibold">模組</TableHead>
                          <TableHead className="text-xs font-semibold">動作</TableHead>
                          <TableHead className="text-xs font-semibold text-center w-[80px]">效果</TableHead>
                          <TableHead className="text-xs font-semibold text-center w-[60px]">優先</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lookupAssignments.map((a) => (
                          <TableRow key={a.id} className="text-xs">
                            <TableCell>
                              <Badge variant="outline" className="text-[12px]">
                                {DIMENSIONS.find((d) => d.key === a.dimension)?.label || a.dimension}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {resolveDimensionValueLabel(a.dimension, a.dimension_value)}
                            </TableCell>
                            <TableCell>
                              <code className="text-[12px] bg-muted px-1 py-0.5 rounded">
                                {a.permission?.module || "?"}
                              </code>
                            </TableCell>
                            <TableCell className="text-xs">
                              {a.permission?.action || "?"}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={a.effect === "allow" ? "default" : "destructive"}
                                className="text-[12px]"
                              >
                                {a.effect === "allow" ? "允許" : "拒絕"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-xs">
                              {a.priority}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="role" onValueChange={(v) => setSelectedDimension(v)}>
        <p className="text-xs text-muted-foreground mb-2">
          覆蓋優先序（較具體者優先）：特殊規則 / 按用戶 &gt; 按職位 &gt; 按團隊 &gt; 按公司 &gt; 按角色。同層級時拒絕優先於允許。
        </p>
        <TabsList className="grid w-full grid-cols-6">
          {DIMENSIONS.map((dim) => (
            <TabsTrigger key={dim.key} value={dim.key}>
              {dim.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="rules">特殊規則</TabsTrigger>
        </TabsList>

        {/* Dimension Matrix Tabs */}
        {DIMENSIONS.map((dim) => (
          <TabsContent key={dim.key} value={dim.key}>
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {dim.label} — 權限矩陣
                  </CardTitle>
                  <Select
                    value={selectedDimensionValue}
                    onValueChange={setSelectedDimensionValue}
                  >
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder={`選擇${dim.label.slice(1)}...`} />
                    </SelectTrigger>
                    <SelectContent>
                      {dimensionValues.map((dv) => (
                        <SelectItem key={dv.value} value={dv.value}>
                          {dv.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>{renderPermissionMatrix()}</CardContent>
            </Card>
          </TabsContent>
        ))}

        {/* Specific Rules Tab */}
        <TabsContent value="rules">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">特殊規則管理</CardTitle>
            </CardHeader>
            <CardContent>{renderSpecificRules()}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Specific Rule Dialog */}
      <SpecificRuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        rule={editingRule}
        onSave={saveRule}
        saving={saving}
        moduleList={UNIQUE_MODULE_LIST}
        dimensions={DIMENSIONS}
      />

      <Sheet
        open={accessSheetOpen}
        onOpenChange={(open) => {
          setAccessSheetOpen(open);
          if (!open) {
            setAccessSheetModule(null);
            setAccessRoster([]);
            setAccessSheetSearch("");
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl flex flex-col gap-4 overflow-hidden"
        >
          <SheetHeader>
            <SheetTitle className="pr-6">
              {accessSheetModule
                ? `存取名單 · ${accessSheetModule.label}`
                : "存取名單"}
            </SheetTitle>
            <SheetDescription>
              以員工為主列出目前 Active 員工對此模組的有效「查看」權限
              {accessSheetModule ? (
                <code className="ml-1 text-[11px] bg-muted px-1 py-0.5 rounded">
                  {accessSheetModule.key}/view
                </code>
              ) : null}
            </SheetDescription>
          </SheetHeader>

          {(() => {
            const q = accessSheetSearch.trim().toLowerCase();
            const filtered = accessRoster.filter((row) => {
              if (!q) return true;
              return (
                row.staff_name.toLowerCase().includes(q) ||
                (row.role || "").toLowerCase().includes(q) ||
                (row.position || "").toLowerCase().includes(q) ||
                row.decided_by.toLowerCase().includes(q)
              );
            });
            const canRows = filtered.filter((r) => r.can_view);
            const cannotRows = filtered.filter((r) => !r.can_view);
            const shown = accessSheetTab === "can" ? canRows : cannotRows;

            return (
              <div className="flex flex-col gap-3 min-h-0 flex-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={accessSheetSearch}
                    onChange={(e) => setAccessSheetSearch(e.target.value)}
                    placeholder="搜尋員工姓名、角色、職位…"
                    className="pl-8"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={accessSheetTab === "can" ? "default" : "outline"}
                    onClick={() => setAccessSheetTab("can")}
                    className="flex-1"
                  >
                    可查看 ({canRows.length})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={accessSheetTab === "cannot" ? "destructive" : "outline"}
                    onClick={() => setAccessSheetTab("cannot")}
                    className="flex-1"
                  >
                    不可查看 ({cannotRows.length})
                  </Button>
                </div>

                {accessRosterLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    載入中…
                  </div>
                ) : shown.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    {accessRoster.length === 0
                      ? "沒有 Active 員工資料"
                      : accessSheetTab === "can"
                        ? "沒有可查看的員工"
                        : "沒有被拒絕查看的員工"}
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-hidden flex-1 min-h-0">
                    <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-xs font-semibold">員工</TableHead>
                            <TableHead className="text-xs font-semibold w-[90px]">角色</TableHead>
                            <TableHead className="text-xs font-semibold">決定依據</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {shown.map((row) => (
                            <TableRow key={row.staff_id} className="text-xs">
                              <TableCell>
                                <div className="font-medium text-sm">{row.staff_name}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  {[
                                    row.position,
                                    row.bu_id
                                      ? resolveDimensionValueLabel("bu", row.bu_id)
                                      : null,
                                    row.n_team_type_id
                                      ? resolveDimensionValueLabel(
                                          "team",
                                          row.n_team_type_id
                                        )
                                      : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ") || "—"}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs">
                                {row.role || "—"}
                              </TableCell>
                              <TableCell>
                                <code className="text-[10px] bg-muted px-1 py-0.5 rounded break-all">
                                  {row.decided_by}
                                </code>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── ACCESS SUMMARY CELL ──────────────────────────────────

function AccessSummaryCell({
  summary,
  loading,
  onClick,
}: {
  summary?: ModuleViewSummary;
  loading?: boolean;
  onClick: () => void;
}) {
  if (loading) {
    return (
      <span className="inline-flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </span>
    );
  }

  const can = summary?.can_view_count ?? 0;
  const cannot = summary?.cannot_view_count ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[11px] hover:bg-muted/80 transition-colors"
      title="查看可／不可查看此頁的員工名單"
    >
      <span className="text-green-700 dark:text-green-400 font-medium">可 {can}</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-red-700 dark:text-red-400 font-medium">不可 {cannot}</span>
    </button>
  );
}

// ─── PERMISSION CELL COMPONENT ────────────────────────────

function PermissionCell({
  state,
  onClick,
  disabled,
  actionable = true,
}: {
  state: "allow" | "deny" | null;
  onClick: () => void;
  disabled?: boolean;
  actionable?: boolean;
}) {
  let bgClass = "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600";
  let label = "—";

  if (state === "allow") {
    bgClass = "bg-green-100 dark:bg-green-900/40 border-green-400 dark:border-green-700";
    label = "✓";
  } else if (state === "deny") {
    bgClass = "bg-red-100 dark:bg-red-900/40 border-red-400 dark:border-red-700";
    label = "✗";
  }

  const cycleHint =
    state === "allow"
      ? "允許 → 點擊切換為拒絕"
      : state === "deny"
      ? "拒絕 → 點擊切換為繼承"
      : "繼承 → 點擊切換為允許";

  return (
    <button
      type="button"
      onClick={actionable ? onClick : undefined}
      disabled={disabled || !actionable}
      className={`inline-flex items-center justify-center w-8 h-8 rounded border text-sm font-medium transition-colors disabled:opacity-50 ${
        actionable ? "hover:opacity-80 cursor-pointer" : "cursor-not-allowed opacity-40"
      } ${bgClass}`}
      title={
        actionable
          ? cycleHint
          : "此模組尚未註冊 — 請重新整理或聯絡開發人員"
      }
    >
      {label}
    </button>
  );
}

// ─── SPECIFIC RULE DIALOG ─────────────────────────────────

function SpecificRuleDialog({
  open,
  onOpenChange,
  rule,
  onSave,
  saving,
  moduleList,
  dimensions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: SpecificRule | null;
  onSave: (rule: Partial<SpecificRule>) => void;
  saving: boolean;
  moduleList: { key: string; label: string }[];
  dimensions: { key: string; label: string; priority: number }[];
}) {
  const [form, setForm] = useState<Partial<SpecificRule>>({
    dimension: "role",
    dimension_value: "",
    module: "",
    rule_key: "",
    condition_json: { field: "", operator: "=", value: "" },
    effect: "deny",
    priority: 10,
    description: "",
    is_active: true,
  });

  useEffect(() => {
    if (rule) {
      setForm({
        dimension: rule.dimension,
        dimension_value: rule.dimension_value,
        module: rule.module,
        rule_key: rule.rule_key,
        condition_json: rule.condition_json,
        effect: rule.effect,
        priority: rule.priority,
        description: rule.description || "",
        is_active: rule.is_active,
      });
    } else {
      setForm({
        dimension: "role",
        dimension_value: "",
        module: "",
        rule_key: "",
        condition_json: { field: "", operator: "=", value: "" },
        effect: "deny",
        priority: 10,
        description: "",
        is_active: true,
      });
    }
  }, [rule, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? "編輯特殊規則" : "新增特殊規則"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>維度 (Dimension)</Label>
              <Select
                value={form.dimension}
                onValueChange={(v) => setForm({ ...form, dimension: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dimensions.map((d) => (
                    <SelectItem key={d.key} value={d.key}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>維度值 (Dimension Value)</Label>
              <Input
                value={form.dimension_value || ""}
                onChange={(e) =>
                  setForm({ ...form, dimension_value: e.target.value })
                }
                placeholder="e.g. user, admin, PM..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>模組 (Module)</Label>
              <Select
                value={form.module}
                onValueChange={(v) => setForm({ ...form, module: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇模組..." />
                </SelectTrigger>
                <SelectContent>
                  {moduleList.map((m) => (
                    <SelectItem key={m.key} value={m.key}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>規則鍵 (Rule Key)</Label>
              <Input
                value={form.rule_key || ""}
                onChange={(e) => setForm({ ...form, rule_key: e.target.value })}
                placeholder="e.g. block_edit_when_confirmed"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>條件 JSON (Condition)</Label>
            <Textarea
              value={JSON.stringify(form.condition_json, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setForm({ ...form, condition_json: parsed });
                } catch {
                  // Allow invalid JSON while typing
                }
              }}
              rows={3}
              className="font-mono text-xs"
              placeholder='{"field": "pitching_stage", "operator": "=", "value": "Confirmed Project"}'
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>效果 (Effect)</Label>
              <Select
                value={form.effect}
                onValueChange={(v) => setForm({ ...form, effect: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allow">允許 (Allow)</SelectItem>
                  <SelectItem value="deny">拒絕 (Deny)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>優先級 (Priority)</Label>
              <Input
                type="number"
                value={form.priority ?? 10}
                onChange={(e) =>
                  setForm({ ...form, priority: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_active ?? true}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
                <Label className="text-sm">啟用</Label>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>描述 (Description)</Label>
            <Input
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="人類可讀的規則描述..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => onSave(form)} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            <Save className="h-4 w-4 mr-1" />
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
