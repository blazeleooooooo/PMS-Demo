// Static navigation structure for the BW PMS Dashboard
// NOTE: Only navigation groups are used (by Sidebar.tsx / TopNav.tsx).
// All dashboard DATA is fetched from Supabase via src/lib/data-service.ts.

export interface NavItem {
  label: string;
  icon: string;
  href: string;
  active?: boolean;
  external?: boolean;
  section?: string; // Optional section header displayed above this item
}

export interface NavGroup {
  title: string;
  /** English label for settings page headers (`{title}設定` / `{titleEn} Settings`) */
  titleEn: string;
  items: NavItem[];
  /** Settings pages for this group — shown as a single sidebar button + page pill tabs */
  settingsItems?: NavItem[];
}

export const navigationGroups: NavGroup[] = [
  {
    title: "主選單",
    titleEn: "Main Menu",
    items: [
      { label: "首頁", icon: "LayoutDashboard", href: "/", active: true },
      { label: "項目新聞", icon: "Newspaper", href: "/news" },
      { label: "重要日子", icon: "CalendarDays", href: "/dates" },
      { label: "工作匯報", icon: "FileBarChart", href: "/reports" },
      { label: "3D數量統計", icon: "Box", href: "/3d-output" },
      { label: "工作匯報檢查", icon: "ClipboardCheck", href: "/work-report-check" },
      { label: "工作匯報排行榜", icon: "Trophy", href: "/work-report-leaderboard" },
      { label: "14/8前必須完成", icon: "CalendarClock", href: "/reports/aug14-deadline" },
    ],
    settingsItems: [
      { label: "工作類型", icon: "Tag", href: "/settings/task-reporting" },
      { label: "工作項目", icon: "ListChecks", href: "/settings/task-reporting?tab=tasks" },
      { label: "AI 工具類型", icon: "Tags", href: "/settings/task-reporting?tab=ai-tool-types" },
      { label: "AI 工具", icon: "Bot", href: "/settings/task-reporting?tab=ai-tools" },
      { label: "新聞類型", icon: "Newspaper", href: "/settings/news_types" },
    ],
  },
  {
    title: "項目管理",
    titleEn: "Project Management",
    items: [
      { label: "Pitching", icon: "Volume2", href: "/proposals" },
      { label: "重點 Pitching", icon: "Focus", href: "/key-pitching" },
      { label: "Project", icon: "FolderOpen", href: "/projects/bwa" },
      { label: "大廈管理", icon: "Building2", href: "/buildings" },
      { label: "成本分析", icon: "PieChart", href: "/cost-analysis" },
      { label: "供應商負載", icon: "BarChart3", href: "/supplier-load" },
      { label: "個案PDF", icon: "FileText", href: "/case-pdf" },
      { label: "執漏危機表", icon: "AlertTriangle", href: "/defect-crisis" },
      { label: "BR/勞保更新", icon: "ClipboardCheck", href: "/br-labour-update" },
      // ─── 業務報表 (individual-locked Staff filter + related PM tools) ───
      // AI WARNING: /individual-reports/* reuse shared report components with
      // reportScope="individual" (Staff → 員工 locked to current user unless Super Admin).
      { label: "個人BV表現", icon: "Users", href: "/individual-reports/personal-performance", section: "業務報表" },
      { label: "Shared GP趨勢", icon: "TrendingUp", href: "/individual-reports/shared-gp-trend" },
      { label: "投標Hit Rate", icon: "Target", href: "/individual-reports/pitch-hit-rate" },
    ],
    settingsItems: [
      { label: "項目類型", icon: "Layers", href: "/settings/project_types" },
      { label: "服務類型", icon: "Wrench", href: "/settings/service_types" },
      { label: "地區", icon: "MapPin", href: "/settings/districts" },
      { label: "地區區域", icon: "Globe", href: "/settings/nos_regions" },
      { label: "文件類型", icon: "FileText", href: "/settings/nos_doc_types" },
      { label: "工地狀況問卷", icon: "Fence", href: "/settings/site-status-questionnaire" },
      { label: "瑕疵原因", icon: "AlertTriangle", href: "/settings/nos_defect_causes" },
      { label: "項目排程任務", icon: "ListChecks", href: "/settings/project_schedule_tasks" },
      { label: "競標結案原因", icon: "XCircle", href: "/settings/pitching_close_reasons" },
      { label: "投標拒絕預設", icon: "Ban", href: "/settings/nos_tender_reject_presets" },
    ],
  },
  {
    title: "項目收支",
    titleEn: "Project Income & Expense",
    items: [
      { label: "AR收款申報", icon: "CalendarClock", href: "/ar-receive-dates" },
      { label: "AP大額支出申請", icon: "CalendarClock", href: "/ap-payment-dates" },
      { label: "L2 L3 比較表", icon: "AlertTriangle", href: "/individual-reports/risky-project" },
      { label: "個人逾期應收", icon: "Clock", href: "/individual-reports/overdue-receivable" },
      { label: "BMO代付退款", icon: "Wallet", href: "/deposits" },
      { label: "追收款電郵", icon: "Mail", href: "/collection-emails" },
    ],
    settingsItems: [
      { label: "收入逾期原因", icon: "Clock", href: "/settings/income_expiry_reasons" },
    ],
  },
  {
    title: "傢俬管理",
    titleEn: "Furniture Management",
    items: [
      { label: "完成項目相片", icon: "ImageIcon", href: "/completion-photos" },
      { label: "BWF Pitching", icon: "Volume2", href: "/bwf/proposals" },
      { label: "BWF Project", icon: "FolderOpen", href: "/bwf/projects" },
      { label: "收款進度", icon: "CreditCard", href: "/bwf/payment-progress" },
      { label: "訂單管理", icon: "ClipboardList", href: "/bwf/orders" },
      { label: "已收款待下單", icon: "Banknote", href: "/paid-pending-orders" },
      { label: "生產管理", icon: "Factory", href: "/production" },
      { label: "集運倉", icon: "Warehouse", href: "/consolidation-warehouse" },
      { label: "安裝團隊", icon: "HardHat", href: "/installation-team" },
      { label: "完工及執漏", icon: "ClipboardCheck", href: "/completion-defect" },
      { label: "主要查詢列表", icon: "FileSearch", href: "/major-inquiry" },
    ],
    settingsItems: [
      { label: "BWF 服務類型", icon: "Wrench", href: "/settings/bwf_service_types" },
      { label: "主報價", icon: "FileSpreadsheet", href: "/settings/bwf_major_quotes" },
      { label: "服務項目", icon: "ListChecks", href: "/settings/service_items" },
      { label: "客戶類型", icon: "Users", href: "/settings/client_types" },
      { label: "來源類型", icon: "Compass", href: "/settings/source_types" },
      { label: "產品類型", icon: "Package", href: "/settings/product_types" },
      { label: "BWF 產品", icon: "Boxes", href: "/settings/bwf_products" },
    ],
  },
  {
    title: "焦點設計",
    titleEn: "Focus Design",
    items: [
      { label: "3D 設計靈感庫", icon: "Box", href: "/3d-design" },
      { label: "設計師負載", icon: "BarChart3", href: "/designer-load" },
      // ─── 業務報表 ───
      { label: "設計師命中率", icon: "Target", href: "/design-reports/designer-hit-rate", section: "業務報表" },
      { label: "項目類型分析", icon: "Layers", href: "/design-reports/project-type-analysis" },
      { label: "項目工時分析", icon: "Clock", href: "/design-reports/project-manhour-analysis" },
      { label: "3D數量統計", icon: "Box", href: "/design-reports/3d-output" },
    ],
  },
  {
    title: "客戶管理",
    titleEn: "Customer Management",
    items: [
      { label: "客戶管理", icon: "Users", href: "/clients" },
      { label: "客戶關係", icon: "HeartHandshake", href: "/relations" },
      { label: "客戶品牌", icon: "Bookmark", href: "/brands" },
    ],
    settingsItems: [
      { label: "客戶用途", icon: "Target", href: "/settings/nos_customer_purpose" },
      { label: "客戶標籤", icon: "Tag", href: "/settings/nos_customer_tags" },
      { label: "客戶標籤合集", icon: "Tags", href: "/settings/nos_customer_tags_collection" },
      { label: "客戶關係事件類型", icon: "CalendarHeart", href: "/settings/nos_cr_event_types" },
      { label: "客戶關係事件主題", icon: "Palette", href: "/settings/nos_cr_event_themes" },
      { label: "客戶關係交付方式", icon: "Send", href: "/settings/nos_cr_delivery_methods" },
    ],
  },
  {
    title: "供應商",
    titleEn: "Suppliers",
    items: [
      { label: "供應商管理", icon: "Truck", href: "/suppliers" },
      { label: "供應商負載", icon: "BarChart3", href: "/supplier-load" },
      { label: "常用供應商報告", icon: "Star", href: "/frequent-suppliers" },
      { label: "BNI合作項目", icon: "HeartHandshake", href: "/bni-projects" },
      { label: "合約管理", icon: "FileText", href: "/contracts" },
      { label: "預審資格", icon: "ShieldCheck", href: "/prequalify" },
      { label: "BR/勞保更新", icon: "ClipboardCheck", href: "/br-labour-update" },
      // ─── 工廠 ───
      { label: "工廠管理", icon: "Factory", href: "/factories", section: "工廠" },
    ],
    settingsItems: [
      { label: "供應商類型", icon: "Truck", href: "/settings/supplier_types" },
      { label: "供應商標籤", icon: "Bookmark", href: "/settings/nos_supplier_tags" },
      { label: "供應商文件類型", icon: "FileType", href: "/settings/supplier_file_types" },
    ],
  },
  {
    title: "團隊工具",
    titleEn: "Team Tools",
    items: [
      { label: "分組工具", icon: "UsersRound", href: "/team-grouping" },
      { label: "BV分配", icon: "BarChart3", href: "/team-assign-bv" },
      { label: "支出鎖定豁免", icon: "Unlock", href: "/expense-control-waivers" },
      { label: "現場相片", icon: "ImageIcon", href: "/site-photos" },
      // ─── 業務報表 (team-locked Staff filter clones of business/design reports) ───
      // AI WARNING: These /team-reports/* pages reuse the same report components
      // as /business-reports/* and /design-reports/* with reportScope="team"
      // (locks Staff→團隊 unless Super Admin). Edits apply to all linked pages.
      { label: "按PM銷售統計", icon: "Users", href: "/team-reports/sales-by-pm", section: "業務報表" },
      { label: "項目經理命中率", icon: "Target", href: "/team-reports/pm-hit-rate" },
      { label: "個人BV表現", icon: "Users", href: "/team-reports/personal-performance" },
      { label: "項目工時分析", icon: "Clock", href: "/team-reports/project-manhour-analysis" },
      { label: "項目類型分析", icon: "Layers", href: "/team-reports/project-type-analysis" },
      { label: "逾期應收項目", icon: "AlertTriangle", href: "/team-reports/overdue-receivable" },
      { label: "未收款項目", icon: "Wallet", href: "/team-reports/outstanding-project" },
      { label: "壞帳項目", icon: "Ban", href: "/team-reports/bad-debt-project" },
    ],
    settingsItems: [
      { label: "財政年度", icon: "CalendarRange", href: "/settings/financial_years" },
      { label: "報價項目類型", icon: "Bot", href: "/settings/nos_quote_project_types" },
      { label: "AI 報價類型", icon: "Sparkles", href: "/settings/nos_ai_quote_types" },
      { label: "單位", icon: "Ruler", href: "/settings/nos_units" },
      { label: "範本", icon: "LayoutTemplate", href: "/settings/nos_templates" },
      { label: "報價區段", icon: "Rows", href: "/settings/nos_sections" },
      { label: "條款範本類型", icon: "FileText", href: "/settings/term_template_types" },
    ],
  },
  {
    title: "會計專區",
    titleEn: "Accounting",
    items: [
      { label: "會計審核", icon: "ClipboardCheck", href: "/audit" },
      { label: "應收未收", icon: "Receipt", href: "/receivable" },
      { label: "進行中工程欠數", icon: "Construction", href: "/wip-debt" },
      { label: "應付未付", icon: "CreditCard", href: "/payable" },
      { label: "AP & RP", icon: "ArrowLeftRight", href: "/ap-rp" },
      { label: "預計收付款", icon: "CalendarClock", href: "/expected-payments" },
      { label: "壞帳列表", icon: "ListPlus", href: "/bad-debt" },
      { label: "支票支出", icon: "Banknote", href: "/cheques" },
      { label: "BR/勞保更新", icon: "ClipboardCheck", href: "/br-labour-update" },
      { label: "BMO代付退款", icon: "Wallet", href: "/deposits" },
    ],
    settingsItems: [
      { label: "付款方式", icon: "CreditCard", href: "/settings/nos_payment_methods" },
      { label: "合約類型", icon: "FileSignature", href: "/settings/nos_contracts" },
    ],
  },
  {
    title: "業務報表",
    titleEn: "Business Reports",
    items: [
      // ─── 財務報告 Financial Reports ───
      { label: "財務摘要", icon: "PieChart", href: "/business-reports/financial-summary", section: "財務報告 Financial Reports" },
      { label: "項目毛利分析", icon: "BarChart3", href: "/business-reports/profitability-by-project" },
      { label: "L2 L3 比較表", icon: "AlertTriangle", href: "/business-reports/risky-project" },
      // ─── 銷售及市場營銷 Sales & Marketing ───
      { label: "銷售趨勢報表", icon: "TrendingUp", href: "/business-reports/sales-trend", section: "銷售及市場營銷 Sales & Marketing" },
      { label: "按PM銷售統計", icon: "Users", href: "/business-reports/sales-by-pm" },
      { label: "項目經理命中率", icon: "Target", href: "/business-reports/pm-hit-rate" },
      { label: "PM來源分析", icon: "Compass", href: "/business-reports/pm-analysis-source" },
      { label: "按類別銷售分析", icon: "Layers", href: "/business-reports/sales-by-category" },
      { label: "BV 業績", icon: "Star", href: "/business-reports/bv-performance" },
      // ─── PM財務管理表現 PM Management on Financial ───
      { label: "個人BV表現", icon: "Users", href: "/business-reports/personal-performance", section: "PM財務管理表現 PM Management on Financial" },
      { label: "折扣項目", icon: "Receipt", href: "/business-reports/discounted-project" },
      { label: "A.O. 項目", icon: "ListPlus", href: "/business-reports/ao-project" },
      { label: "逾期應收項目", icon: "AlertTriangle", href: "/business-reports/overdue-receivable" },
      { label: "未收款項目", icon: "Wallet", href: "/business-reports/outstanding-project" },
      { label: "壞帳項目", icon: "Ban", href: "/business-reports/bad-debt-project" },
    ],
  },
  {
    title: "管理員面板",
    titleEn: "Admin Panel",
    items: [
      { label: "BV分配", icon: "BarChart3", href: "/assign-bv" },
      { label: "帳戶管理", icon: "Users", href: "/admin/accounts" },
      { label: "角色管理", icon: "ShieldCheck", href: "/admin/roles" },
      { label: "權限管理", icon: "ShieldCheck", href: "/admin/permissions" },
      { label: "支出鎖定項目", icon: "Lock", href: "/admin/expense-locked" },
      {
        label: "支出總額豁免",
        icon: "Unlock",
        href: "/admin/expense-installment-waivers",
      },
      { label: "逾期收入原因", icon: "Clock", href: "/admin/income-expiry" },
      { label: "PMS登入報告", icon: "FileText", href: "/admin/pms-login" },
      { label: "年度獎金結算", icon: "Wallet", href: "/admin/annual-bonus-settlement" },
    ],
    settingsItems: [
      { label: "公司單位", icon: "Building2", href: "/settings/cost_centres" },
      { label: "團隊類型", icon: "UsersRound", href: "/settings/team_types" },
      { label: "BV 數值", icon: "Star", href: "/settings/nos_bv_values" },
      { label: "網站功能", icon: "Globe2", href: "/settings/nos_website_functions" },
      { label: "儀表板句子", icon: "MessageSquare", href: "/settings/dashboard_sentences" },
    ],
  },
  {
    // Pages still in testing but pushed live for boss review.
    // AI WARNING: Keep production-stable pages in their real top-nav groups;
    // only WIP review builds belong here under /testing/*.
    title: "測試中頁面",
    titleEn: "Testing Pages",
    items: [
      { label: "工作匯報", icon: "FileBarChart", href: "/testing/reports" },
      { label: "設計師每日匯報", icon: "MessageSquare", href: "/testing/designer-daily-feed" },
    ],
  },
];

/** All nav items across groups (main + settings), excluding external links. */
export function getAllNavItems(): NavItem[] {
  return navigationGroups.flatMap((g) => [
    ...g.items,
    ...(g.settingsItems ?? []),
  ]);
}

/** Settings items for the nav group that owns the given pathname, if any. */
export function getSettingsItemsForPath(pathname: string): NavItem[] | null {
  return getSettingsNavGroupForPath(pathname)?.settingsItems ?? null;
}

function settingsHrefPath(href: string): string {
  const q = href.indexOf("?");
  return q >= 0 ? href.slice(0, q) : href;
}

/** Nav group that owns the settings path (sub-tabs + group header). */
export function getSettingsNavGroupForPath(pathname: string): NavGroup | null {
  for (const group of navigationGroups) {
    const settings = group.settingsItems;
    if (!settings?.length) continue;
    const match = settings.some((item) => {
      if (item.external) return false;
      const path = settingsHrefPath(item.href);
      if (path === "/") return pathname === "/";
      return pathname === path || pathname.startsWith(`${path}/`);
    });
    if (match) return group;
  }
  return null;
}

/**
 * Active settings nav item for the pathname (+ optional search) within its group.
 * Prefer query-specific hrefs (e.g. `?tab=ai-tools`) over the bare path.
 */
export function getActiveSettingsItemForPath(
  pathname: string,
  search: string = ""
): NavItem | null {
  const group = getSettingsNavGroupForPath(pathname);
  if (!group?.settingsItems) return null;

  const pageParams = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );

  const candidates = group.settingsItems.filter((item) => {
    if (item.external) return false;
    const path = settingsHrefPath(item.href);
    return pathname === path || pathname.startsWith(`${path}/`);
  });

  // Prefer the most specific query match.
  const ranked = [...candidates].sort((a, b) => {
    const aQ = a.href.includes("?") ? 1 : 0;
    const bQ = b.href.includes("?") ? 1 : 0;
    if (aQ !== bQ) return bQ - aQ;
    return b.href.length - a.href.length;
  });

  for (const item of ranked) {
    const hrefQuery = item.href.includes("?")
      ? item.href.slice(item.href.indexOf("?") + 1)
      : "";
    const hrefParams = new URLSearchParams(hrefQuery);

    let ok = true;
    for (const [key, value] of hrefParams.entries()) {
      if (pageParams.get(key) !== value) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    if (!hrefParams.has("tab")) {
      const hasTabSiblings = candidates.some(
        (c) => c.href !== item.href && c.href.includes("tab=")
      );
      if (hasTabSiblings) {
        const tab = pageParams.get("tab");
        if (tab && tab !== "task-types") continue;
      }
    }

    return item;
  }

  return candidates[0] ?? null;
}

/** Page header copy for settings: `{group.title}設定` + English subtitle. */
export function getSettingsGroupHeader(
  pathname: string,
  search: string = ""
): {
  titleZh: string;
  titleEn: string;
  icon: string;
} {
  const group = getSettingsNavGroupForPath(pathname);
  const active = getActiveSettingsItemForPath(pathname, search);
  if (group) {
    return {
      titleZh: `${group.title}設定`,
      titleEn: `${group.titleEn} Settings`,
      icon: active?.icon || "Settings",
    };
  }
  return {
    titleZh: "設定",
    titleEn: "Settings",
    icon: active?.icon || "Settings",
  };
}
