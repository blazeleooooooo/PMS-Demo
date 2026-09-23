// ─── LOOKUP TABLE SETTINGS — CONFIG REGISTRY ──────────────────
// Single source of truth for the generic lookup-table settings engine
// (src/components/settings/LookupTableSettings.tsx). Each entry describes ONE
// lookup table: which columns to show, how to edit them, and how "active"
// state is stored. Adding a new settings screen = add a config entry here,
// create a thin page at src/app/settings/<route>/page.tsx, and add a nav line
// under the right tab's 設定 section in src/lib/mock-data.ts.
//
// This file is APPEND-ONLY for parallel work: add your table's entry, never
// reformat or reorder existing ones, to avoid merge collisions.
//
// BWF lookup tables (nos_service_type_2, bwf_major_quotes, service_items, bwf_products) live
// under tab「傢俬管理」; shared lookups (client_types, districts, etc.) stay
// on their home tabs — link them from mock-data without duplicating pages.

// A single editable column within a lookup table.
export interface LookupField {
  col: string;                 // DB column name
  labelZh: string;             // Chinese field label
  labelEn?: string;            // optional English label
  type:
    | "text"                   // single-line text
    | "textarea"               // multi-line text
    | "code"                   // short uppercase code (mono, e.g. BU code)
    | "color"                  // hex colour, shown with a swatch + picker
    | "bool"                   // boolean flag → Switch
    | "number"                 // numeric
    | "select";                // choose from a fixed option list
  required?: boolean;
  placeholder?: string;
  // For type "select": the allowed options.
  options?: { value: string; label: string }[];
  // For type "select": load options from a related table (UUID FK). Prefer this
  // over legacy TEXT FK columns — never show Bubble IDs as labels.
  optionsFrom?: {
    table: string;
    valueCol?: string; // default "id"
    labelCol: string;
    orderBy?: string;
  };
  // For type "select": render as pill buttons instead of a dropdown.
  // Defaults to "dropdown".
  selectUi?: "dropdown" | "pills";
  // Treat this field as the row's PRIMARY label in the list (first one wins).
  primary?: boolean;
  // Treat this field as a SECONDARY label (shown muted next to the primary).
  secondary?: boolean;
  // Render this secondary field as a coloured pill/badge instead of muted text
  // (good for categorical values like an item type). Ignored unless secondary.
  badge?: boolean;
  // Include this column in the search filter.
  searchable?: boolean;
}

// How a table stores its "active / enabled" state. The engine renders an
// inline toggle and a "顯示停用" filter only when this is not "none".
//   • "status"    → text column, "active" / "inactive"  (e.g. cost_centres)
//   • "is_active" → boolean column                       (e.g. news_types)
//   • "none"      → no active concept; rows are just created / deleted
export type ActiveMode = "status" | "is_active" | "none";

// Optional client-side bool filter toggles shown in the list toolbar.
// When ON, only rows where `col === true` are shown.
export interface LookupBoolFilter {
  col: string;
  labelZh: string;
  labelEn?: string;
}

// Optional client-side select filter shown in the list toolbar.
// Options come from the matching field's `options` / `optionsFrom`.
export interface LookupSelectFilter {
  col: string;
  labelZh: string;
  labelEn?: string;
  /** Label for the "show all" option. Defaults to「全部」. */
  allLabelZh?: string;
}

export interface LookupTableConfig {
  key: string;                 // Supabase table name (also the URL segment)
  route?: string;              // URL segment if different from key
  labelZh: string;             // page + nav Chinese label
  labelEn: string;             // page + nav English label
  icon: string;                // lucide icon name (matches mock-data nav icons)
  tab: string;                 // which top-nav tab this belongs under (中文)
  description?: string;        // short subtitle for the page header
  fields: LookupField[];       // editable columns
  activeMode: ActiveMode;
  activeCol?: string;          // override the active column name (defaults: status / is_active)
  /** When true, inactive rows stay visible (greyed) instead of requiring「顯示停用」. */
  alwaysShowInactive?: boolean;
  orderBy?: string;            // list sort column (defaults to first primary field)
  permissionKey?: string;      // permission module gate (defaults to "settings.<key>"; falls back to parent "settings")
  boolFilters?: LookupBoolFilter[];
  selectFilters?: LookupSelectFilter[];
  /** Block delete when any row in `table` still references this lookup id. */
  usageGuard?: {
    table: string;
    fkCol: string;
    messageZh?: string;
  };
}

// Resolve the URL segment for a config (route override or table key).
export function lookupRoute(cfg: LookupTableConfig): string {
  return cfg.route ?? cfg.key;
}

// ─── REGISTRY ─────────────────────────────────────────────────
// All tables currently target the 管理員面板 tab's 設定 section. Later, moving
// a table to its "home" tab is a one-line `tab` change here + the nav line.
export const LOOKUP_TABLES: LookupTableConfig[] = [
  // ── REFERENCE EXAMPLE (fully wired: page + nav) ──────────────
  // districts — bilingual + a region grouping. Use this entry as the template
  // for new tables: pick the right field types and activeMode for the schema.
  {
    key: "districts",
    labelZh: "地區",
    labelEn: "Districts",
    icon: "MapPin",
    tab: "管理員面板",
    description: "項目及客戶所屬地區",
    activeMode: "none",
    orderBy: "name",
    fields: [
      { col: "name", labelZh: "地區名稱", labelEn: "Name", type: "text", required: true, primary: true, searchable: true },
      { col: "chinese_display", labelZh: "中文名稱", labelEn: "Chinese", type: "text", required: true, secondary: true, searchable: true },
      {
        col: "region_id",
        labelZh: "區域",
        labelEn: "Region",
        type: "select",
        required: true,
        secondary: true,
        badge: true,
        searchable: true,
        selectUi: "pills",
        optionsFrom: {
          table: "nos_regions",
          labelCol: "display",
          orderBy: "display",
        },
      },
    ],
  },

  // ── SIMPLE display-only tables (Bucket A — ready to wire) ────
  {
    key: "service_types",
    labelZh: "服務類型",
    labelEn: "Service Types",
    icon: "Wrench",
    tab: "管理員面板",
    description: "項目服務類型",
    activeMode: "none",
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      { col: "chin_display", labelZh: "中文名稱", labelEn: "Chinese", type: "text", secondary: true, searchable: true },
      { col: "site_status_required", labelZh: "需填工地狀況", labelEn: "Site Status Required", type: "bool" },
    ],
    boolFilters: [
      { col: "site_status_required", labelZh: "需填工地狀況", labelEn: "Site Status Required" },
    ],
  },
  {
    key: "source_types",
    labelZh: "來源類型",
    labelEn: "Source Types",
    icon: "Compass",
    tab: "傢俬管理",
    description: "客戶來源類型",
    activeMode: "none",
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
    ],
  },
  {
    key: "product_types",
    labelZh: "產品類型",
    labelEn: "Product Types",
    icon: "Package",
    tab: "傢俬管理",
    description: "產品分類",
    activeMode: "none",
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
    ],
  },
  {
    key: "news_types",
    labelZh: "新聞類型",
    labelEn: "News Types",
    icon: "Newspaper",
    tab: "管理員面板",
    description: "項目新聞分類",
    activeMode: "is_active",
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      { col: "color", labelZh: "顏色", labelEn: "Colour", type: "color" },
    ],
  },

  // ── BILINGUAL / CODED tables (Bucket B — ready to wire) ──────
  {
    key: "project_types",
    labelZh: "項目類型",
    labelEn: "Project Types",
    icon: "Layers",
    tab: "管理員面板",
    description: "工程項目分類",
    activeMode: "none",
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      { col: "chin_display", labelZh: "中文名稱", labelEn: "Chinese", type: "text", secondary: true, searchable: true },
      { col: "site_status_required", labelZh: "需填工地狀況", labelEn: "Site Status Required", type: "bool" },
    ],
    boolFilters: [
      { col: "site_status_required", labelZh: "需填工地狀況", labelEn: "Site Status Required" },
    ],
  },
  {
    key: "client_types",
    labelZh: "客戶類型",
    labelEn: "Client Types",
    icon: "Users",
    tab: "傢俬管理",
    description: "客戶分類",
    activeMode: "none",
    orderBy: "display",
    fields: [
      { col: "code", labelZh: "代碼", labelEn: "Code", type: "code", secondary: true, searchable: true },
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
    ],
  },
  {
    key: "supplier_types",
    labelZh: "供應商類型",
    labelEn: "Supplier Types",
    icon: "Truck",
    tab: "管理員面板",
    description: "供應商分類",
    activeMode: "is_active",
    alwaysShowInactive: true,
    orderBy: "order",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      { col: "chinese_display", labelZh: "中文名稱", labelEn: "Chinese", type: "text", secondary: true, searchable: true },
      { col: "order", labelZh: "排序", labelEn: "Order", type: "number" },
    ],
  },
  {
    key: "team_types",
    labelZh: "團隊類型",
    labelEn: "Team Types",
    icon: "UsersRound",
    tab: "管理員面板",
    description: "團隊分類",
    activeMode: "is_active",
    alwaysShowInactive: true,
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      { col: "is_bwf", labelZh: "BWF 團隊", labelEn: "BWF Team", type: "bool" },
    ],
  },
  {
    key: "financial_years",
    labelZh: "財政年度",
    labelEn: "Financial Years",
    icon: "CalendarRange",
    tab: "管理員面板",
    description: "公司財政年度",
    activeMode: "none",
    orderBy: "yy_code",
    fields: [
      { col: "yy_code", labelZh: "年度代碼", labelEn: "YY Code", type: "code", secondary: true, searchable: true },
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      { col: "date_range", labelZh: "日期範圍", labelEn: "Date Range", type: "text" },
    ],
  },
  {
    key: "nos_units",
    labelZh: "單位",
    labelEn: "Units",
    icon: "Ruler",
    tab: "管理員面板",
    description: "報價單位",
    activeMode: "none",
    orderBy: "order",
    fields: [
      { col: "eng_name", labelZh: "英文名稱", labelEn: "English", type: "text", required: true, primary: true, searchable: true },
      { col: "chi_name", labelZh: "中文名稱", labelEn: "Chinese", type: "text", secondary: true, searchable: true },
      { col: "order", labelZh: "排序", labelEn: "Order", type: "number" },
    ],
  },
  {
    key: "nos_payment_methods",
    labelZh: "付款方式",
    labelEn: "Payment Methods",
    icon: "CreditCard",
    tab: "管理員面板",
    description: "發票/收據付款方式",
    activeMode: "none",
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
    ],
  },

  // ── TAIL: remaining lookup tables ───────────────────────────
  {
    key: "nos_contracts",
    labelZh: "合約類型",
    labelEn: "Contract Types",
    icon: "FileSignature",
    tab: "管理員面板",
    description: "合約分類",
    activeMode: "none",
    orderBy: "rank",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      { col: "chinese_display", labelZh: "中文名稱", labelEn: "Chinese", type: "text", secondary: true, searchable: true },
      { col: "is_ao", labelZh: "A.O. 合約", labelEn: "Is A.O.", type: "bool" },
      { col: "is_recurring", labelZh: "定期合約", labelEn: "Is Recurring", type: "bool" },
      { col: "rank", labelZh: "排序", labelEn: "Rank", type: "number" },
    ],
  },
  {
    key: "nos_regions",
    labelZh: "地區區域",
    labelEn: "Regions",
    icon: "Globe",
    tab: "管理員面板",
    description: "地區所屬區域",
    activeMode: "none",
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      { col: "chn_display", labelZh: "中文名稱", labelEn: "Chinese", type: "text", secondary: true, searchable: true },
    ],
  },
  {
    key: "nos_doc_types",
    labelZh: "文件類型",
    labelEn: "Document Types",
    icon: "FileText",
    tab: "管理員面板",
    description: "項目/供應商文件分類",
    activeMode: "none",
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      { col: "category", labelZh: "分類", labelEn: "Category", type: "select", secondary: true, searchable: true, options: [
        { value: "必要文件", label: "必要文件" },
        { value: "額外文件", label: "額外文件" },
      ] },
      { col: "enable_doc_date", labelZh: "啟用文件日期", labelEn: "Doc Date", type: "bool" },
      { col: "enable_expiry_date", labelZh: "啟用到期日", labelEn: "Expiry Date", type: "bool" },
      { col: "is_project_initial_doc", labelZh: "項目初始文件", labelEn: "Initial Doc", type: "bool" },
    ],
  },
  {
    key: "nos_sections",
    labelZh: "報價區段",
    labelEn: "Sections",
    icon: "Rows",
    tab: "團隊工具",
    description: "報價單中的細項分段",
    activeMode: "none",
    orderBy: "order",
    fields: [
      { col: "english_name", labelZh: "英文名稱", labelEn: "English", type: "text", required: true, primary: true, searchable: true },
      { col: "chinese_name", labelZh: "中文名稱", labelEn: "Chinese", type: "text", secondary: true, searchable: true },
      { col: "search_type", labelZh: "搜尋類型", labelEn: "Search Type", type: "text" },
      { col: "order", labelZh: "排序", labelEn: "Order", type: "number" },
    ],
  },
  {
    key: "nos_customer_purpose",
    labelZh: "客戶用途",
    labelEn: "Customer Purpose",
    icon: "Target",
    tab: "管理員面板",
    description: "客戶用途分類",
    activeMode: "none",
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "中文名稱", labelEn: "Chinese", type: "text", required: true, primary: true, searchable: true },
      { col: "english_display", labelZh: "英文名稱", labelEn: "English", type: "text", secondary: true, searchable: true },
    ],
  },
  {
    key: "nos_customer_tags",
    labelZh: "客戶標籤",
    labelEn: "Customer Tags",
    icon: "Tag",
    tab: "管理員面板",
    description: "客戶標籤",
    activeMode: "none",
    orderBy: "display",
    selectFilters: [
      { col: "collection_id", labelZh: "合集", labelEn: "Collection", allLabelZh: "全部合集" },
    ],
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      {
        col: "collection_id",
        labelZh: "所屬合集",
        labelEn: "Collection",
        type: "select",
        required: true,
        secondary: true,
        searchable: true,
        optionsFrom: {
          table: "nos_customer_tags_collection",
          labelCol: "display",
          orderBy: "order",
        },
      },
    ],
  },
  {
    key: "nos_customer_tags_collection",
    labelZh: "客戶標籤合集",
    labelEn: "Customer Tag Collections",
    icon: "Tags",
    tab: "管理員面板",
    description: "客戶標籤分組",
    activeMode: "none",
    orderBy: "order",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      { col: "order", labelZh: "排序", labelEn: "Order", type: "number" },
    ],
  },
  {
    key: "nos_cr_event_types",
    labelZh: "客戶關係事件類型",
    labelEn: "CR Event Types",
    icon: "CalendarHeart",
    tab: "管理員面板",
    description: "客戶關係事件分類",
    activeMode: "none",
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
    ],
  },
  {
    key: "nos_cr_event_themes",
    labelZh: "客戶關係事件主題",
    labelEn: "CR Event Themes",
    icon: "Palette",
    tab: "管理員面板",
    description: "客戶關係事件主題",
    activeMode: "none",
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      { col: "value", labelZh: "數值", labelEn: "Value", type: "text", secondary: true, searchable: true },
    ],
  },
  {
    key: "nos_cr_delivery_methods",
    labelZh: "客戶關係交付方式",
    labelEn: "CR Delivery Methods",
    icon: "Send",
    tab: "管理員面板",
    description: "客戶關係交付方式",
    activeMode: "none",
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
    ],
  },
  {
    key: "nos_defect_causes",
    labelZh: "瑕疵原因",
    labelEn: "Defect Causes",
    icon: "AlertTriangle",
    tab: "管理員面板",
    description: "工程瑕疵原因",
    activeMode: "is_active",
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      { col: "chin_display", labelZh: "中文名稱", labelEn: "Chinese", type: "text", secondary: true, searchable: true },
    ],
  },
  {
    key: "nos_bv_values",
    labelZh: "BV 數值",
    labelEn: "BV Values",
    icon: "Star",
    tab: "管理員面板",
    description: "績效 BV 數值",
    activeMode: "none",
    orderBy: "value",
    fields: [
      { col: "value", labelZh: "數值", labelEn: "Value", type: "text", required: true, primary: true, searchable: true },
    ],
  },
  {
    key: "nos_supplier_tags",
    labelZh: "供應商標籤",
    labelEn: "Supplier Tags",
    icon: "Bookmark",
    tab: "管理員面板",
    description: "供應商標籤",
    activeMode: "none",
    orderBy: "tag_name",
    selectFilters: [
      { col: "tag_type", labelZh: "標籤類型", labelEn: "Tag Type", allLabelZh: "全部類型" },
    ],
    fields: [
      { col: "tag_name", labelZh: "標籤名稱", labelEn: "Tag Name", type: "text", required: true, primary: true, searchable: true },
      {
        col: "tag_type",
        labelZh: "標籤類型",
        labelEn: "Tag Type",
        type: "select",
        required: true,
        secondary: true,
        badge: true,
        searchable: true,
        options: [
          { value: "Positive", label: "Positive" },
          { value: "Negative", label: "Negative" },
          { value: "Status", label: "Status" },
        ],
      },
    ],
  },
  {
    key: "nos_tender_reject_presets",
    labelZh: "投標拒絕預設",
    labelEn: "Tender Reject Presets",
    icon: "Ban",
    tab: "管理員面板",
    description: "投標拒絕原因預設",
    activeMode: "none",
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
    ],
  },
  // `nos_site_status_items` retired — the Site Status feature is now a fully
  // dynamic questionnaire managed at /settings/site-status-questionnaire
  // (SiteStatusQuestionnaireSettings). The lookup table is kept as archive only.
  {
    key: "nos_quote_project_types",
    labelZh: "報價項目類型",
    labelEn: "Quote Project Types",
    icon: "Bot",
    tab: "管理員面板",
    description: "AI 報價項目類型",
    activeMode: "none",
    orderBy: "order",
    fields: [
      { col: "name", labelZh: "名稱", labelEn: "Name", type: "text", required: true, primary: true, searchable: true },
      { col: "prompt", labelZh: "提示", labelEn: "Prompt", type: "textarea" },
      { col: "order", labelZh: "排序", labelEn: "Order", type: "number" },
    ],
  },
  {
    key: "nos_ai_quote_types",
    labelZh: "AI 報價類型",
    labelEn: "AI Quote Types",
    icon: "Sparkles",
    tab: "管理員面板",
    description: "AI 報價分類",
    activeMode: "none",
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
    ],
  },
  {
    key: "nos_website_functions",
    labelZh: "網站功能",
    labelEn: "Website Functions",
    icon: "Globe2",
    tab: "管理員面板",
    description: "網站功能項目",
    activeMode: "none",
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "中文名稱", labelEn: "Chinese", type: "text", required: true, primary: true, searchable: true },
      { col: "english_display", labelZh: "英文名稱", labelEn: "English", type: "text", secondary: true, searchable: true },
    ],
  },
  {
    key: "supplier_file_types",
    labelZh: "供應商文件類型",
    labelEn: "Supplier File Types",
    icon: "FileType",
    tab: "管理員面板",
    description: "供應商文件分類",
    activeMode: "none",
    orderBy: "type",
    fields: [
      { col: "type", labelZh: "類型", labelEn: "Type", type: "text", required: true, primary: true, searchable: true },
    ],
  },
  {
    key: "nos_templates",
    labelZh: "範本",
    labelEn: "Templates",
    icon: "LayoutTemplate",
    tab: "管理員面板",
    description: "報價/條款範本",
    activeMode: "none",
    orderBy: "name",
    fields: [
      { col: "name", labelZh: "名稱", labelEn: "Name", type: "text", required: true, primary: true, searchable: true },
      { col: "project_type", labelZh: "項目類型", labelEn: "Project Type", type: "text", secondary: true, searchable: true },
    ],
  },
  {
    key: "term_template_types",
    labelZh: "條款範本類型",
    labelEn: "Term Template Types",
    icon: "FileText",
    tab: "管理員面板",
    description: "條款範本分類",
    activeMode: "none",
    orderBy: "name",
    fields: [
      { col: "name", labelZh: "名稱", labelEn: "Name", type: "text", required: true, primary: true, searchable: true },
      { col: "lan", labelZh: "語言", labelEn: "Language", type: "text", secondary: true, searchable: true },
      { col: "default_chi", labelZh: "預設中文", labelEn: "Default Chinese", type: "textarea" },
      { col: "default_eng", labelZh: "預設英文", labelEn: "Default English", type: "textarea" },
    ],
  },
  {
    key: "dashboard_sentences",
    labelZh: "儀表板句子",
    labelEn: "Dashboard Sentences",
    icon: "MessageSquare",
    tab: "管理員面板",
    description: "儀表板顯示句子",
    activeMode: "none",
    orderBy: "text",
    fields: [
      { col: "text", labelZh: "句子", labelEn: "Sentence", type: "textarea", required: true, primary: true, searchable: true },
      { col: "is_bwa", labelZh: "BWA", labelEn: "Is BWA", type: "bool" },
      { col: "is_bwf", labelZh: "BWF", labelEn: "Is BWF", type: "bool" },
    ],
  },
  {
    key: "pitching_close_reasons",
    labelZh: "競標結案原因",
    labelEn: "Pitching Close Reasons",
    icon: "XCircle",
    tab: "管理員面板",
    description: "提案結案原因",
    activeMode: "none",
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      { col: "is_bwf", labelZh: "BWF", labelEn: "Is BWF", type: "bool" },
    ],
  },
  {
    key: "project_schedule_tasks",
    labelZh: "項目排程任務",
    labelEn: "Project Schedule Tasks",
    icon: "ListChecks",
    tab: "管理員面板",
    description: "項目排程任務範本",
    activeMode: "none",
    orderBy: "sort",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      { col: "stage", labelZh: "階段", labelEn: "Stage", type: "text", secondary: true, searchable: true },
      { col: "is_bwa", labelZh: "BWA", labelEn: "Is BWA", type: "bool" },
      { col: "sort", labelZh: "排序", labelEn: "Sort", type: "number" },
    ],
  },

  // ── BWF lookup tables (傢俬管理) ─────────────────────────────
  {
    key: "nos_service_type_2",
    route: "bwf_service_types",
    labelZh: "BWF 服務類型",
    labelEn: "BWF Service Types",
    icon: "Wrench",
    tab: "傢俬管理",
    description: "Pitching 及 Project 的 BWF 服務類型",
    activeMode: "none",
    orderBy: "display",
    fields: [
      { col: "code", labelZh: "代碼", labelEn: "Code", type: "code", secondary: true, searchable: true },
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      { col: "is_fast_build", labelZh: "Fast Build", labelEn: "Fast Build", type: "bool" },
    ],
    boolFilters: [
      { col: "is_fast_build", labelZh: "Fast Build", labelEn: "Fast Build" },
    ],
  },
  {
    key: "bwf_major_quotes",
    labelZh: "主報價",
    labelEn: "Major Quotes",
    icon: "FileSpreadsheet",
    tab: "傢俬管理",
    description: "BWF Pitching / Project 主報價分類",
    activeMode: "none",
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      { col: "is_big_project", labelZh: "大型項目", labelEn: "Big Project", type: "bool" },
      { col: "is_pp", labelZh: "PP", labelEn: "PP", type: "bool" },
    ],
    boolFilters: [
      { col: "is_big_project", labelZh: "大型項目", labelEn: "Big Project" },
      { col: "is_pp", labelZh: "PP", labelEn: "PP" },
    ],
  },
  {
    key: "service_items",
    labelZh: "服務項目",
    labelEn: "Service Items",
    icon: "ListChecks",
    tab: "傢俬管理",
    description: "BWF Pitching / Project 服務項目",
    activeMode: "none",
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      { col: "is_branding", labelZh: "Branding", labelEn: "Branding", type: "bool" },
      { col: "is_fast_build", labelZh: "Fast Build", labelEn: "Fast Build", type: "bool" },
      { col: "is_furniture", labelZh: "傢俬", labelEn: "Furniture", type: "bool" },
      { col: "is_material", labelZh: "物料", labelEn: "Material", type: "bool" },
    ],
    boolFilters: [
      { col: "is_branding", labelZh: "Branding", labelEn: "Branding" },
      { col: "is_fast_build", labelZh: "Fast Build", labelEn: "Fast Build" },
      { col: "is_furniture", labelZh: "傢俬", labelEn: "Furniture" },
      { col: "is_material", labelZh: "物料", labelEn: "Material" },
    ],
  },
  {
    key: "nos_ai_tool_types",
    labelZh: "AI 工具類型",
    labelEn: "AI Tool Types",
    icon: "Tags",
    tab: "主選單",
    description: "工作匯報 AI 工具分類（文案 / 圖片 / 影片等）",
    // Managed as a sub-tab under /settings/task-reporting.
    permissionKey: "settings.task-reporting",
    activeMode: "is_active",
    orderBy: "sorting",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      { col: "eng_display", labelZh: "英文名稱", labelEn: "English", type: "text", secondary: true, searchable: true },
      {
        col: "code",
        labelZh: "代碼",
        labelEn: "Code",
        type: "code",
        required: true,
        searchable: true,
        placeholder: "text / image / video",
      },
      { col: "sorting", labelZh: "排序", labelEn: "Sort", type: "number" },
    ],
  },
  {
    key: "nos_ai_tools",
    labelZh: "AI 工具",
    labelEn: "AI Tools",
    icon: "Bot",
    tab: "主選單",
    description: "工作匯報 AI 工具選項",
    // Managed as a sub-tab under /settings/task-reporting (not a top-level pill).
    permissionKey: "settings.task-reporting",
    activeMode: "is_active",
    orderBy: "sorting",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      {
        col: "category",
        labelZh: "分類",
        labelEn: "Category",
        type: "select",
        required: true,
        secondary: true,
        badge: true,
        searchable: true,
        optionsFrom: {
          table: "nos_ai_tool_types",
          valueCol: "code",
          labelCol: "display",
          orderBy: "sorting",
        },
      },
      { col: "sorting", labelZh: "排序", labelEn: "Sort", type: "number" },
    ],
    selectFilters: [
      { col: "category", labelZh: "分類", labelEn: "Category", allLabelZh: "全部分類" },
    ],
  },
  {
    key: "income_expiry_reasons",
    labelZh: "收入逾期原因",
    labelEn: "Income Expiry Reasons",
    icon: "Clock",
    tab: "項目收支",
    description: "收入到期日已過時需選擇的逾期原因",
    activeMode: "is_active",
    alwaysShowInactive: true,
    orderBy: "sort",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      { col: "sort", labelZh: "排序", labelEn: "Sort", type: "number" },
    ],
    usageGuard: {
      table: "incomes",
      fkCol: "expiry_reason_id",
      messageZh: "此原因已用於至少一筆收入，無法刪除，請改為停用。",
    },
  },
  {
    key: "bwf_products",
    labelZh: "BWF 產品",
    labelEn: "BWF Products",
    icon: "Boxes",
    tab: "傢俬管理",
    description: "BWF 訂單產品主檔",
    activeMode: "none",
    orderBy: "display",
    fields: [
      { col: "display", labelZh: "名稱", labelEn: "Display", type: "text", required: true, primary: true, searchable: true },
      {
        col: "product_types_id",
        labelZh: "產品類型",
        labelEn: "Product Type",
        type: "select",
        secondary: true,
        badge: true,
        searchable: true,
        optionsFrom: {
          table: "product_types",
          labelCol: "display",
          orderBy: "display",
        },
      },
    ],
    selectFilters: [
      { col: "product_types_id", labelZh: "產品類型", labelEn: "Product Type", allLabelZh: "全部類型" },
    ],
    usageGuard: {
      table: "bwf_orders",
      fkCol: "product_id",
      messageZh: "此產品已用於至少一張訂單，無法刪除。",
    },
  },
];

// Look up a config by its table key.
export function getLookupConfig(key: string): LookupTableConfig | undefined {
  return LOOKUP_TABLES.find((c) => c.key === key);
}
