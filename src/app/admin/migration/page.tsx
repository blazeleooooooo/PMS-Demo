"use client";

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import FKAuditPage from "@/app/admin/fk-audit/page";

// ─── DANGER CONFIRMATION DIALOG ───
const CONFIRMATION_SENTENCE = "I confirm this migration will overwrite production data";

function DangerConfirmDialog({
  open,
  onConfirm,
  onCancel,
  actionLabel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  actionLabel: string;
}) {
  const [typed, setTyped] = useState("");
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setTyped("");
      setAttempts(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  if (!open) return null;

  const isMatch = typed === CONFIRMATION_SENTENCE;

  const handleSubmit = () => {
    if (isMatch) {
      onConfirm();
    } else {
      setAttempts((a) => a + 1);
    }
  };

  // Block paste
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
  };

  // Block drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Block context menu (right-click paste)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="text-white font-bold text-lg">危險操作確認</h3>
              <p className="text-red-100 text-sm">Dangerous Operation Confirmation</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm font-medium mb-1">⚠️ 此操作會覆寫生產環境數據！</p>
            <p className="text-red-700 text-xs">
              You are about to execute: <strong className="text-red-900">{actionLabel}</strong>
            </p>
            <p className="text-red-700 text-xs mt-1">
              This will overwrite existing production data and cannot be undone.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              請準確輸入以下句子確認 (Please type the sentence below to confirm):
            </label>
            <div className="bg-gray-100 rounded-lg px-4 py-3 border border-gray-200">
              <code className="text-sm font-mono text-gray-800 select-none">{CONFIRMATION_SENTENCE}</code>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onPaste={handlePaste}
              onDrop={handleDrop}
              onContextMenu={handleContextMenu}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
                if (e.key === "Escape") onCancel();
              }}
              placeholder="Type the sentence above exactly..."
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className={`w-full border-2 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none transition ${
                typed.length === 0
                  ? "border-gray-200 focus:border-blue-400"
                  : isMatch
                  ? "border-emerald-400 bg-emerald-50 focus:border-emerald-500"
                  : "border-red-300 focus:border-red-400"
              }`}
            />
            {attempts > 0 && !isMatch && (
              <p className="text-red-500 text-xs">❌ 輸入不正確，請重新輸入。Sentence does not match exactly.</p>
            )}
            {typed.length > 0 && !isMatch && (
              <div className="text-xs text-gray-400">
                {typed.length}/{CONFIRMATION_SENTENCE.length} characters
              </div>
            )}
            {isMatch && (
              <p className="text-emerald-600 text-xs font-medium">✅ 確認句子正確！You may proceed.</p>
            )}
          </div>

          <p className="text-[13px] text-gray-400 italic">
            🚫 Copy & paste is disabled. You must type the sentence manually.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-100 transition"
          >
            取消 Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isMatch}
            className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            🔥 確認執行 Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GROUPS = [
  {
    key: "lookups",
    label: "📋 查閱資料表 (Lookup Tables)",
    color: "bg-violet-500",
    colorText: "text-violet-500",
    colorBg: "bg-violet-50",
    colorBorder: "border-violet-200",
    colorBar: "bg-violet-500",
    tables: [
      { key: "cost_centres", label: "成本中心", bubble: "noscostcentre" },
      { key: "districts", label: "地區", bubble: "nosdistrict" },
      { key: "team_types", label: "團隊類型", bubble: "nosteamtype" },
      { key: "client_types", label: "客戶類型", bubble: "noscustomertype" },
      { key: "source_types", label: "來源類型", bubble: "nossource" },
      { key: "service_types", label: "服務類型", bubble: "nosservicetype" },
      { key: "project_types", label: "項目類型", bubble: "nosprojecttype" },
      { key: "supplier_types", label: "供應商類型", bubble: "nossuppliertype" },
      { key: "financial_years", label: "財政年度", bubble: "nosfinancialyear" },
      { key: "product_types", label: "產品類型", bubble: "nosproducttype" },
      { key: "bwf_major_quotes", label: "BWF 主報價", bubble: "nosbwfmajorquote" },
      { key: "service_items", label: "服務項目", bubble: "nosbwfserviceitem" },
      { key: "news_types", label: "新聞類型", bubble: "nosnewstype" },
      { key: "nos_contracts", label: "合約類型", bubble: "noscontract" },
      { key: "nos_units", label: "單位", bubble: "nosunit" },
      { key: "nos_payment_methods", label: "付款方式", bubble: "nospaymentmethod" },
      { key: "nos_regions", label: "地區區域", bubble: "nosregion" },
      { key: "nos_customer_tags", label: "客戶標籤", bubble: "noscustomertags" },
      { key: "nos_customer_purpose", label: "客戶用途", bubble: "noscustomerpurpose" },
      { key: "nos_cr_event_types", label: "客戶關係事件類型", bubble: "noscustomerrelationseventtype" },
      { key: "nos_cr_event_themes", label: "客戶關係事件主題", bubble: "noscustomerrelationseventtheme" },
      { key: "nos_cr_delivery_methods", label: "客戶關係交付方式", bubble: "noscrdeliverymethod" },
      { key: "nos_defect_causes", label: "瑕疵原因", bubble: "nosdefectcause" },
      { key: "nos_doc_types", label: "文件類型", bubble: "nosdoctype" },
      { key: "nos_bv_values", label: "BV 數值", bubble: "nosbvvalue" },
      { key: "nos_supplier_tags", label: "供應商標籤", bubble: "nossuppliertag" },
      { key: "nos_tender_reject_presets", label: "投標拒絕預設", bubble: "nostenderrejectpreset" },
      { key: "nos_site_status_items", label: "工地狀態項目", bubble: "nossitestatusitems" },
      { key: "nos_quote_project_types", label: "報價項目類型", bubble: "nosquoteprojecttype" },
      { key: "nos_sections", label: "部門", bubble: "nossection" },
      { key: "nos_service_type_2", label: "服務類型 2", bubble: "nosbwfservicetype" },
      { key: "nos_ai_quote_types", label: "AI 報價類型", bubble: "nos_aiquotetype" },
      { key: "nos_items", label: "項目 Items", bubble: "nositem" },
      { key: "nos_website_functions", label: "網站功能", bubble: "noswebsitefunction" },
      { key: "supplier_file_types", label: "供應商文件類型", bubble: "nossupplierfiletype" },
      { key: "supplier_rule_displays", label: "供應商規則顯示", bubble: "supplierruledisplay" },
      { key: "nos_templates", label: "範本", bubble: "nostemplate" },
      { key: "term_template_types", label: "條款範本類型", bubble: "termtemplatetype" },
      { key: "dashboard_sentences", label: "儀表板句子", bubble: "dashboardsentence" },
      { key: "project_schedule_tasks", label: "項目排程任務", bubble: "noss2schedule" },  /* 90 records in Bubble */
    ],
  },
  {
    key: "core",
    label: "🏢 核心實體 (Core Entities)",
    color: "bg-blue-500",
    colorText: "text-blue-500",
    colorBg: "bg-blue-50",
    colorBorder: "border-blue-200",
    colorBar: "bg-blue-500",
    tables: [
      { key: "staff", label: "👥 職員 (Staff)", bubble: "member" },
      { key: "customers", label: "🏢 客戶 (Customers)", bubble: "customer" },
      { key: "suppliers", label: "🔧 供應商 (Suppliers)", bubble: "supplier" },
      { key: "buildings", label: "🏗️ 大廈 (Buildings)", bubble: "building" },
      { key: "factories", label: "🏭 工廠 (Factories)", bubble: "factory" },
      { key: "users", label: "👤 用戶 (Users)", bubble: "user" },
    ],
  },
  {
    key: "projects",
    label: "📁 項目資料 (Projects)",
    color: "bg-amber-500",
    colorText: "text-amber-500",
    colorBg: "bg-amber-50",
    colorBorder: "border-amber-200",
    colorBar: "bg-amber-500",
    tables: [
      { key: "bwa_pitchings", label: "BWA 競標", bubble: "pitching" },
      { key: "bwa_projects", label: "BWA 工程項目", bubble: "project" },
      { key: "bwf_pitchings", label: "BWF 競標", bubble: "bwfpitching" },
      { key: "bwf_projects", label: "BWF 家具項目", bubble: "bwfproject" },
      { key: "bwf_products", label: "BWF 產品", bubble: "bwfproduct" },
    ],
  },
  {
    key: "financial",
    label: "💰 財務及關聯資料 (Financial & Relations)",
    color: "bg-green-500",
    colorText: "text-green-500",
    colorBg: "bg-green-50",
    colorBorder: "border-green-200",
    colorBar: "bg-green-500",
    tables: [
      { key: "incomes", label: "收入記錄", bubble: "income" },
      { key: "expenses", label: "支出記錄", bubble: "expense" },
      { key: "income_invoices", label: "收入發票", bubble: "invoice" },
      { key: "receipts", label: "收據", bubble: "receipt" },
      { key: "purchase_orders", label: "採購訂單", bubble: "po" },
      { key: "po_sub_items", label: "PO 子項目", bubble: "posubitem" },
      { key: "quotations", label: "報價單", bubble: "quotation" },
      { key: "quotation_sections", label: "報價區段", bubble: "qsection" },
      { key: "quotation_section_items", label: "報價明細", bubble: "qsectiondetail" },
      { key: "bwf_orders", label: "BWF 訂單", bubble: "bwforder" },
      { key: "project_schedules", label: "項目排程", bubble: "s2schedule" },
      { key: "project_documents", label: "項目文件", bubble: "projectdoc" },
      { key: "outstanding_remarks", label: "未完成備註", bubble: "outstandingremarks" },
      { key: "supplier_feedback", label: "供應商回饋", bubble: "commentfromsupplier" },
      { key: "staff_supplier_comments", label: "員工評論供應商/工廠", bubble: "supplier%26factorycomment" },
      { key: "building_comments", label: "大廈評論", bubble: "buildingcomment" },
      { key: "notifications", label: "通知", bubble: "notification" },
      { key: "customer_comments", label: "客戶評論", bubble: "customercomment" },
      { key: "customer_relations", label: "客戶關係", bubble: "customerrelationsevent" },
      { key: "supplier_files", label: "供應商文件", bubble: "supplierfile" },
      { key: "tenders", label: "投標", bubble: "tender" },
      { key: "tender_bids", label: "投標出價", bubble: "tenderbids" },
      { key: "pitching_bv", label: "競標 BV", bubble: "pitchingbv" },
      { key: "project_bv", label: "項目 BV", bubble: "projectbv" },
      { key: "news", label: "新聞", bubble: "news" },
    ],
  },
  {
    key: "extra",
    label: "🔄 額外資料表 (Extra Bubble Tables)",
    color: "bg-orange-500",
    colorText: "text-orange-500",
    colorBg: "bg-orange-50",
    colorBorder: "border-orange-200",
    colorBar: "bg-orange-500",
    tables: [
      { key: "three_d_collections", label: "🎨 3D 合集", bubble: "3dcollection" },
      { key: "three_d_renders", label: "🖼️ 3D 渲染", bubble: "3drender" },
      { key: "ai_quotes", label: "🤖 AI 報價", bubble: "aiquote" },
      { key: "ai_quote_sub_items", label: "AI 報價子項目", bubble: "aiquotesubitem" },
      { key: "ai_quote_demo_items", label: "AI 報價示範項目", bubble: "aiquotedemoitem" },
      { key: "blocked_views", label: "🚫 封鎖視圖", bubble: "blockedview" },
      { key: "building_contacts", label: "🏗️ 大廈聯絡人", bubble: "buildingcontact" },
      { key: "building_files", label: "📄 大廈文件", bubble: "buildingfile" },
      { key: "cr_event_details", label: "🎁 客戶關係事件明細", bubble: "creventdetail" },
      { key: "cr_gift_items", label: "🎁 客戶關係禮品", bubble: "crgiftitem" },
      { key: "factory_files", label: "🏭 工廠文件", bubble: "factoryfile" },
      { key: "internal_comments", label: "💬 內部評論", bubble: "internalcomment" },
      { key: "invoice_sub_items", label: "🧾 發票子項目", bubble: "invoicesubitem" },
      { key: "login_logs", label: "🔑 登入記錄", bubble: "loginlog" },
      { key: "news_comments", label: "📰 新聞評論", bubble: "newscomment" },
      { key: "project_initial_expenses", label: "💵 項目初始費用", bubble: "projectinitialexpense" },
      { key: "project_weekly_reports", label: "📋 每10天工地報告", bubble: "projectweeklyreport" },
      { key: "quotation_expenses", label: "💰 報價費用", bubble: "quotationexpense" },
      { key: "site_statuses", label: "🏗️ 工地狀態", bubble: "sitestatus" },
      { key: "site_status_item_quantities", label: "📊 工地狀態項目數量", bubble: "sitestatusitemsquantity" },
      { key: "supplier_pricings", label: "💲 供應商定價", bubble: "supplierpricing" },
      { key: "supplier_recent_statuses", label: "📝 供應商近況", bubble: "supplierrecentstatus" },
      { key: "tender_messages", label: "✉️ 投標訊息", bubble: "tendermessage" },
      { key: "tender_responds", label: "📩 投標回覆", bubble: "tenderrespond" },
    ],
  },
  {
    key: "additional",
    label: "📦 額外實體表 (Additional Entity Tables)",
    color: "bg-teal-500",
    colorText: "text-teal-500",
    colorBg: "bg-teal-50",
    colorBorder: "border-teal-200",
    colorBar: "bg-teal-500",
    tables: [
      { key: "nos_customer_tags_collection", label: "客戶標籤合集", bubble: "noscustomertagscollection" },
      { key: "pitching_close_reasons", label: "競標結案原因", bubble: "noscaseclosereasons" },
      { key: "nos_template_items", label: "範本項目", bubble: "nostemplateitem" },
      { key: "nos_template_sections", label: "範本區段", bubble: "nostemplatesection" },
      { key: "ai_prompt_by_project_types", label: "AI 提示 (按項目類型)", bubble: "aipromptbyprojecttype" },
      { key: "ai_quote_sub_item_details", label: "AI 報價子項目明細", bubble: "aiquotesubitemdetails" },
      { key: "ap_report_remarks", label: "AP 報表備註", bubble: "apreportremark" },
      { key: "default_quote_details", label: "預設報價明細", bubble: "defaultquotedetail" },
      { key: "default_quote_mains", label: "預設報價主表", bubble: "defaultquotemain" },
      { key: "default_quote_sections", label: "預設報價區段", bubble: "defaultquotesection" },
      { key: "q_term_sections", label: "條款區段", bubble: "q_term_section" },
      { key: "q_term_section_details", label: "條款明細", bubble: "q_term_section_detail" },
      { key: "recurring_incomes", label: "定期收入", bubble: "recurringincome" },
      { key: "supplier_level_pass_out_dates", label: "供應商等級到期日", bubble: "supplierlevelpassoutdate" },
      { key: "supplier_level_roles", label: "供應商等級角色", bubble: "supplierlevelrole" },
      { key: "supplier_login_codes", label: "供應商登入碼", bubble: "supplierlogincode" },
      { key: "supplier_register_forms", label: "供應商登記表", bubble: "supplierquestionnaire" },
      { key: "target_sales", label: "目標銷售額", bubble: "targetsales" },
      { key: "term_template_sections", label: "條款範本區段", bubble: "termtemplatesection" },
      { key: "term_template_section_details", label: "條款範本明細", bubble: "termtemplatesectiondetail" },
    ],
  },
  {
    key: "junctions",
    label: "🔗 關聯表 (Junction / Many-to-Many)",
    color: "bg-pink-500",
    colorText: "text-pink-500",
    colorBg: "bg-pink-50",
    colorBorder: "border-pink-200",
    colorBar: "bg-pink-500",
    tables: [
      { key: "bwa_pitching_project_types", label: "BWA 競標 ↔ 項目類型", bubble: "" },
      { key: "bwa_pitching_service_types", label: "BWA 競標 ↔ 服務類型", bubble: "" },
      { key: "bwa_project_service_types", label: "BWA 項目 ↔ 服務類型", bubble: "" },
      { key: "bwa_project_project_types", label: "BWA 項目 ↔ 項目類型", bubble: "" },
      { key: "bwf_pitching_major_quotes", label: "BWF 競標 ↔ 主報價", bubble: "" },
      { key: "bwf_pitching_service_items", label: "BWF 競標 ↔ 服務項目", bubble: "" },
      { key: "bwf_pitching_bwf_service_types", label: "BWF 競標 ↔ BWF 服務類型", bubble: "" },
      { key: "bwf_project_major_quotes", label: "BWF 項目 ↔ 主報價", bubble: "" },
      { key: "bwf_project_service_items", label: "BWF 項目 ↔ 服務項目", bubble: "" },
      { key: "bwf_project_bwf_service_types", label: "BWF 項目 ↔ BWF 服務類型", bubble: "" },
      { key: "bwf_project_factories", label: "BWF 項目 ↔ 工廠", bubble: "" },
      { key: "bwf_project_suppliers", label: "BWF 項目 ↔ 供應商", bubble: "" },
      { key: "bwf_product_product_types", label: "BWF 產品 ↔ 產品類型", bubble: "" },
      { key: "customer_tags", label: "客戶 ↔ 標籤", bubble: "" },
      { key: "customer_cr_events", label: "客戶 ↔ 客戶關係事件", bubble: "" },
      { key: "cr_event_detail_staff", label: "客戶關係事件明細 ↔ 職員", bubble: "" },
      { key: "tender_message_bids", label: "投標訊息 ↔ 出價", bubble: "" },
      { key: "tender_message_receivers", label: "投標訊息 ↔ 接收者", bubble: "" },
      { key: "tender_message_seen", label: "投標訊息 ↔ 已讀", bubble: "" },
      { key: "tender_seen", label: "投標 ↔ 已讀", bubble: "" },
      { key: "tender_selective_suppliers", label: "投標 ↔ 指定供應商", bubble: "" },
      { key: "tender_rejected_suppliers", label: "投標 ↔ 被拒供應商", bubble: "" },
      { key: "notification_seen", label: "通知 ↔ 已讀職員", bubble: "" },
      { key: "expense_product_types", label: "支出 ↔ 產品類型", bubble: "" },
      { key: "news_liked_members", label: "新聞 ↔ 按讚職員", bubble: "" },
      { key: "news_comment_liked_members", label: "新聞評論 ↔ 按讚職員", bubble: "" },
      { key: "three_d_collection_liked_staff", label: "3D 合集 ↔ 按讚職員", bubble: "" },
      { key: "nos_item_quote_project_types", label: "NOS 項目 ↔ 報價項目類型", bubble: "" },
    ],
  },
];

/** Stage 2 BWF sync — mirrors supabase/functions/bubble-sync-bwf/sync-config.ts */
const BWF_SYNC_GROUPS = [
  {
    key: "lookups",
    label: "📋 查閱資料表 (Lookups)",
    color: "bg-violet-500",
    tables: [
      "nos_ai_quote_types", "nos_bv_values", "bwf_major_quotes", "service_items", "nos_service_type_2",
      "pitching_close_reasons", "nos_contracts", "cost_centres", "nos_cr_delivery_methods",
      "nos_customer_purpose", "nos_cr_event_themes", "nos_cr_event_types", "nos_customer_tags",
      "nos_customer_tags_collection", "client_types", "nos_defect_causes", "nos_doc_types", "districts",
      "financial_years", "nos_items", "news_types", "nos_payment_methods", "product_types", "project_types",
      "nos_quote_project_types", "nos_regions", "project_schedule_tasks", "nos_sections", "service_types",
      "nos_site_status_items", "source_types", "supplier_file_types", "nos_supplier_tags", "supplier_types",
      "team_types", "nos_templates", "nos_template_items", "nos_template_sections", "nos_tender_reject_presets",
      "nos_units", "nos_website_functions", "supplier_rule_displays", "term_template_types", "dashboard_sentences",
    ],
  },
  {
    key: "core",
    label: "🏢 核心實體 (Core)",
    color: "bg-blue-500",
    tables: ["staff", "customers", "suppliers", "buildings", "factories", "users", "building_contacts", "building_files", "factory_files"],
  },
  {
    key: "bwf_projects",
    label: "📁 BWF 項目",
    color: "bg-amber-500",
    tables: ["bwf_pitchings", "bwf_projects", "bwf_products", "bwf_orders", "pitching_bv", "project_bv", "project_schedules"],
  },
  {
    key: "financial",
    label: "💰 財務 (BWF-linked)",
    color: "bg-green-500",
    tables: ["incomes", "income_invoices", "invoice_sub_items", "receipts", "expenses", "purchase_orders", "po_sub_items", "outstanding_remarks", "quotation_expenses"],
  },
  {
    key: "relations",
    label: "🔄 關聯 / 其他",
    color: "bg-orange-500",
    tables: [
      "building_comments", "internal_comments", "customer_relations", "cr_event_details", "cr_gift_items",
      "tenders", "tender_bids", "tender_messages", "tender_responds", "staff_supplier_comments", "supplier_feedback",
      "supplier_files", "supplier_pricings", "supplier_recent_statuses", "supplier_register_forms",
      "supplier_level_pass_out_dates", "supplier_level_roles", "supplier_login_codes",
      "ap_report_remarks", "notifications", "news", "news_comments",
    ],
  },
];

const BWF_SYNC_FUNCTION = "supabase-functions-bubble-sync-bwf";
const BWA_CUTOFF_LABEL = "2026-06-02 00:00 HKT";

// All table keys flat
const ALL_TABLE_KEYS = GROUPS.flatMap((g) => g.tables.map((t) => t.key));

type TableProgress = {
  supabaseCount: number;
  bubbleCount: number | null; // null = unknown
  loading?: boolean;
  error?: string;
};

type MigrationStatus = {
  [key: string]: {
    status: "idle" | "running" | "success" | "error";
    message?: string;
    inserted?: number;
  };
};

type ViewMode = "progress" | "migrate" | "bwf-sync" | "fk-audit" | "auth-sync" | "man-hours";

function ProgressBar({
  percent,
  colorClass,
  height = "h-2",
}: {
  percent: number;
  colorClass: string;
  height?: string;
}) {
  return (
    <div className={`w-full bg-gray-100 rounded-full ${height} overflow-hidden`}>
      <div
        className={`${colorClass} ${height} rounded-full transition-all duration-700 ease-out`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

function StatusBadge({
  supabaseCount,
  bubbleCount,
}: {
  supabaseCount: number;
  bubbleCount: number | null;
}) {
  if (bubbleCount === null) {
    if (supabaseCount === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
          未同步
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        {supabaseCount} 筆
      </span>
    );
  }

  // Bubble has 0 records — no data at source
  if (bubbleCount === 0 && supabaseCount === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-yellow-50 text-yellow-700 border border-yellow-300">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
        Bubble.io 沒有數據
      </span>
    );
  }

  const percent = bubbleCount > 0 ? Math.round((supabaseCount / bubbleCount) * 100) : supabaseCount > 0 ? 100 : 0;

  if (percent === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-red-50 text-red-600 border border-red-200">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        0% 未同步
      </span>
    );
  }
  if (percent >= 100) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        ✓ 已完成
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      {percent}% 部分同步
    </span>
  );
}

export default function MigrationPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("progress");
  const [bubbleBaseUrl, setBubbleBaseUrl] = useState("");
  const [bubbleToken, setBubbleToken] = useState("");
  const [statuses, setStatuses] = useState<MigrationStatus>({});
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runningGroup, setRunningGroup] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    lookups: true,
    core: true,
    projects: true,
    financial: true,
    extra: true,
    additional: false,
    junctions: false,
  });

  // Progress tracking state
  const [progress, setProgress] = useState<Record<string, TableProgress>>({});
  const [progressLoading, setProgressLoading] = useState(false);
  const [bubbleCountsLoading, setBubbleCountsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Debug state
  const [debugData, setDebugData] = useState<any>(null);
  const [debugLoading, setDebugLoading] = useState<string | null>(null);
  const [scanAllData, setScanAllData] = useState<any>(null);
  const [scanAllLoading, setScanAllLoading] = useState(false);

  // Auth sync state
  const [authSyncStatus, setAuthSyncStatus] = useState<any>(null);
  const [authSyncLoading, setAuthSyncLoading] = useState(false);
  const [authSyncResult, setAuthSyncResult] = useState<any>(null);
  const [authSyncing, setAuthSyncing] = useState(false);

  // Man Hour migration state
  const [mhStatus, setMhStatus] = useState<Record<string, { status: "idle" | "running" | "done" | "error"; fetched: number; upserted: number; errors: string[]; hasMore: boolean; nextOffset: number; duration_ms: number }>>({
    nos_task_types: { status: "idle", fetched: 0, upserted: 0, errors: [], hasMore: false, nextOffset: 0, duration_ms: 0 },
    nos_tasks: { status: "idle", fetched: 0, upserted: 0, errors: [], hasMore: false, nextOffset: 0, duration_ms: 0 },
    man_hour_dates: { status: "idle", fetched: 0, upserted: 0, errors: [], hasMore: true, nextOffset: 0, duration_ms: 0 },
    man_hour_tasks: { status: "idle", fetched: 0, upserted: 0, errors: [], hasMore: true, nextOffset: 0, duration_ms: 0 },
    resolve_fks: { status: "idle", fetched: 0, upserted: 0, errors: [], hasMore: false, nextOffset: 0, duration_ms: 0 },
  });
  const [mhRunning, setMhRunning] = useState(false);
  const [mhBatchSize, setMhBatchSize] = useState(5000);
  const [mhAutoRunning, setMhAutoRunning] = useState<string | null>(null); // which step is auto-running
  const mhAbortRef = useRef(false); // abort flag for auto-continue

  // Stage 2 BWF sync state
  const [bwfSyncStatuses, setBwfSyncStatuses] = useState<MigrationStatus>({});
  const [bwfSyncRunningGroup, setBwfSyncRunningGroup] = useState<string | null>(null);
  const [bwfSyncRunningAll, setBwfSyncRunningAll] = useState(false);
  const [bwfFkRunningGroup, setBwfFkRunningGroup] = useState<string | null>(null);
  const [bwfDryRun, setBwfDryRun] = useState(true);

  // ─── Danger Confirmation State ───
  const [dangerDialogOpen, setDangerDialogOpen] = useState(false);
  const [dangerActionLabel, setDangerActionLabel] = useState("");
  const dangerCallbackRef = useRef<(() => void) | null>(null);

  const requireDangerConfirmation = (actionLabel: string, callback: () => void) => {
    setDangerActionLabel(actionLabel);
    dangerCallbackRef.current = callback;
    setDangerDialogOpen(true);
  };

  const handleDangerConfirm = () => {
    setDangerDialogOpen(false);
    if (dangerCallbackRef.current) {
      dangerCallbackRef.current();
      dangerCallbackRef.current = null;
    }
  };

  const handleDangerCancel = () => {
    setDangerDialogOpen(false);
    dangerCallbackRef.current = null;
  };

  // Core function that runs ONE batch and returns the result (for looping)
  const runManHourBatch = async (mode: string, offset: number, batchSize: number) => {
    const res = await supabase.functions.invoke("supabase-functions-migrate-man-hours", {
      body: { mode, offset, batchSize },
    });
    if (res.error) throw new Error(res.error.message);
    const result = res.data;
    if (result.error) throw new Error(result.error);
    return result;
  };

  const runManHourMigration = async (mode: string) => {
    const current = mhStatus[mode];
    setMhRunning(true);
    setMhStatus((prev) => ({ ...prev, [mode]: { ...prev[mode], status: "running" } }));
    addLog(`[Man Hour] Starting ${mode} (offset: ${current.nextOffset}, batch: ${mhBatchSize})...`);

    try {
      const result = await runManHourBatch(mode, current.nextOffset, mhBatchSize);

      setMhStatus((prev) => ({
        ...prev,
        [mode]: {
          status: result.errors?.length > 0 ? "error" : "done",
          fetched: (prev[mode].fetched || 0) + (result.totalFetched || 0),
          upserted: (prev[mode].upserted || 0) + (result.totalUpserted || 0),
          errors: [...(prev[mode].errors || []), ...(result.errors || [])],
          hasMore: result.hasMore || false,
          nextOffset: result.nextOffset || 0,
          duration_ms: (prev[mode].duration_ms || 0) + (result.duration_ms || 0),
        },
      }));

      addLog(`[Man Hour] ${mode} batch done: fetched=${result.totalFetched}, upserted=${result.totalUpserted}, hasMore=${result.hasMore}, duration=${result.duration_ms}ms`);
      if (result.errors?.length > 0) {
        result.errors.forEach((e: string) => addLog(`[Man Hour] ⚠️ ${e}`));
      }
    } catch (err: any) {
      setMhStatus((prev) => ({
        ...prev,
        [mode]: { ...prev[mode], status: "error", errors: [...prev[mode].errors, err.message] },
      }));
      addLog(`[Man Hour] ❌ ${mode} failed: ${err.message}`);
    } finally {
      setMhRunning(false);
    }
  };

  // Auto-continue: runs a step repeatedly until hasMore=false or aborted
  const runManHourAutoStep = async (mode: string) => {
    mhAbortRef.current = false;
    setMhAutoRunning(mode);
    setMhRunning(true);

    let currentOffset = mhStatus[mode].nextOffset;
    let totalFetched = mhStatus[mode].fetched;
    let totalUpserted = mhStatus[mode].upserted;
    let totalDuration = mhStatus[mode].duration_ms;
    let allErrors: string[] = [...mhStatus[mode].errors];
    let batchCount = 0;

    setMhStatus((prev) => ({ ...prev, [mode]: { ...prev[mode], status: "running" } }));
    addLog(`[Man Hour] 🚀 Auto-continue starting for ${mode} (offset: ${currentOffset})...`);

    try {
      let hasMore = true;
      while (hasMore && !mhAbortRef.current) {
        batchCount++;
        addLog(`[Man Hour] ${mode} auto batch #${batchCount} (offset: ${currentOffset})...`);

        const result = await runManHourBatch(mode, currentOffset, mhBatchSize);

        totalFetched += result.totalFetched || 0;
        totalUpserted += result.totalUpserted || 0;
        totalDuration += result.duration_ms || 0;
        if (result.errors?.length > 0) {
          allErrors = [...allErrors, ...result.errors];
          result.errors.forEach((e: string) => addLog(`[Man Hour] ⚠️ ${e}`));
        }

        hasMore = result.hasMore || false;
        currentOffset = result.nextOffset || 0;

        // Update state after each batch so progress bar updates live
        setMhStatus((prev) => ({
          ...prev,
          [mode]: {
            status: "running",
            fetched: totalFetched,
            upserted: totalUpserted,
            errors: allErrors,
            hasMore,
            nextOffset: currentOffset,
            duration_ms: totalDuration,
          },
        }));

        addLog(`[Man Hour] ${mode} batch #${batchCount} done: +${result.totalUpserted} (total: ${totalUpserted}), hasMore=${hasMore}`);

        // Small delay between batches to avoid rate limiting
        if (hasMore && !mhAbortRef.current) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      // Final status
      const finalStatus = mhAbortRef.current ? "done" : allErrors.length > 0 ? "error" : "done";
      setMhStatus((prev) => ({
        ...prev,
        [mode]: {
          status: finalStatus,
          fetched: totalFetched,
          upserted: totalUpserted,
          errors: allErrors,
          hasMore,
          nextOffset: currentOffset,
          duration_ms: totalDuration,
        },
      }));

      if (mhAbortRef.current) {
        addLog(`[Man Hour] ⏸️ ${mode} auto-continue stopped by user after ${batchCount} batches. Total upserted: ${totalUpserted}`);
      } else {
        addLog(`[Man Hour] ✅ ${mode} auto-continue complete! ${batchCount} batches, total upserted: ${totalUpserted}, duration: ${(totalDuration / 1000).toFixed(1)}s`);
      }
    } catch (err: any) {
      setMhStatus((prev) => ({
        ...prev,
        [mode]: {
          status: "error",
          fetched: totalFetched,
          upserted: totalUpserted,
          errors: [...allErrors, err.message],
          hasMore: true,
          nextOffset: currentOffset,
          duration_ms: totalDuration,
        },
      }));
      addLog(`[Man Hour] ❌ ${mode} auto-continue failed at batch #${batchCount}: ${err.message}`);
    } finally {
      setMhRunning(false);
      setMhAutoRunning(null);
    }
  };

  const stopAutoRun = () => {
    mhAbortRef.current = true;
    addLog("[Man Hour] ⏸️ Stopping auto-continue... (will finish current batch)");
  };

  const runManHourAll = async () => {
    mhAbortRef.current = false;
    const steps: string[] = ["nos_task_types", "nos_tasks", "man_hour_dates", "man_hour_tasks", "resolve_fks"];
    for (const step of steps) {
      if (mhAbortRef.current) break;
      await runManHourAutoStep(step);
    }
  };

  const addLog = (msg: string) => {
    setLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] ${msg}`,
      ...prev,
    ]);
  };

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  // ─── Fetch Supabase row counts for all tables ───
  const fetchSupabaseCounts = useCallback(async () => {
    setProgressLoading(true);

    // Count each table individually using Supabase client
    // Use functional setState to avoid stale closure issues with bubbleCount
    const counts: Record<string, { supabaseCount: number; error?: string }> = {};
    for (const key of ALL_TABLE_KEYS) {
      try {
        const { count, error: countErr } = await supabase
          .from(key)
          .select("*", { count: "exact", head: true });
        if (countErr) {
          // PostgREST returns error when table doesn't exist in schema cache
          const msg = countErr.message || "";
          const isTableMissing = msg.includes("schema cache") || msg.includes("relation") || msg.includes("does not exist");
          counts[key] = { supabaseCount: 0, error: isTableMissing ? "表不存在" : msg.substring(0, 40) };
        } else {
          counts[key] = { supabaseCount: count || 0 };
        }
      } catch {
        counts[key] = { supabaseCount: 0, error: "無法查詢" };
      }
    }

    // Use functional update to preserve existing bubbleCount values
    setProgress((prev) => {
      const newProgress: Record<string, TableProgress> = {};
      for (const key of ALL_TABLE_KEYS) {
        newProgress[key] = {
          supabaseCount: counts[key]?.supabaseCount ?? 0,
          bubbleCount: prev[key]?.bubbleCount ?? null,
          error: counts[key]?.error,
        };
      }
      return newProgress;
    });

    setProgressLoading(false);
    setLastRefreshed(new Date());
  }, []);

  // ─── Fetch Bubble source counts via edge function scan ───
  const fetchBubbleCounts = async () => {
    if (!bubbleBaseUrl || !bubbleToken) {
      alert("請先輸入 Bubble API URL 和 Token 以獲取 Bubble 來源數量");
      return;
    }
    setBubbleCountsLoading(true);
    addLog("🔍 正在掃描所有 Bubble 資料表的記錄數量...");

    const allBubbleTables = GROUPS.flatMap((g) =>
      g.tables.map((t) => ({ key: t.key, bubble: t.bubble }))
    );
    const BATCH_SIZE = 8;
    const batches: { key: string; bubble: string }[][] = [];
    for (let i = 0; i < allBubbleTables.length; i += BATCH_SIZE) {
      batches.push(allBubbleTables.slice(i, i + BATCH_SIZE));
    }

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      const bubbleNames = batch.map((t) => t.bubble);
      addLog(`📡 掃描批次 ${batchIdx + 1}/${batches.length}...`);

      try {
        const response = await supabase.functions.invoke(
          "supabase-functions-bubble-migration",
          {
            body: {
              scanAll: true,
              tables: bubbleNames,
              bubbleBaseUrl,
              bubbleToken,
            },
          }
        );
        const { data, error } = response;
        if (error) throw new Error(error.message || String(error));

        let parsedData = data;
        if (typeof data === "string") {
          try { parsedData = JSON.parse(data); } catch { continue; }
        }

        const results = parsedData?.results || {};
        // Use functional setState to preserve existing state
        setProgress((prev) => {
          const updated = { ...prev };
          for (const item of batch) {
            const result = results[item.bubble];
            if (result && !result.error && typeof result.totalRows === "number") {
              updated[item.key] = {
                ...updated[item.key],
                supabaseCount: updated[item.key]?.supabaseCount || 0,
                bubbleCount: result.totalRows,
              };
            }
          }
          return updated;
        });
      } catch (err: any) {
        addLog(`❌ 批次 ${batchIdx + 1} 錯誤: ${err.message}`);
      }
    }

    setBubbleCountsLoading(false);
    addLog("✅ Bubble 來源數量掃描完成");
  };

  // Auto-load Supabase counts on mount
  useEffect(() => {
    fetchSupabaseCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Migration functions ───
  const debugBubbleTable = async (bubbleTableName: string, label: string) => {
    if (!bubbleBaseUrl || !bubbleToken) {
      alert("請先輸入 Bubble API URL 和 Token");
      return;
    }
    setDebugLoading(bubbleTableName);
    setDebugData(null);
    addLog(`🔍 Debug: 檢查 Bubble 表 ${bubbleTableName} 的欄位...`);
    try {
      const response = await supabase.functions.invoke(
        "supabase-functions-bubble-migration",
        {
          body: {
            debug: true,
            bubbleTable: bubbleTableName,
            bubbleBaseUrl,
            bubbleToken,
          },
        }
      );
      const { data, error } = response;
      if (error) {
        let errMsg = error.message || String(error);
        try {
          if (error.context) {
            const errBody = await error.context.json();
            errMsg = errBody?.error || JSON.stringify(errBody);
          }
        } catch {}
        throw new Error(errMsg);
      }
      if (!data) throw new Error("Edge function 回傳空數據");
      let parsedData = data;
      if (typeof data === "string") {
        try { parsedData = JSON.parse(data); } catch {
          throw new Error(`回傳非 JSON: ${data.substring(0, 200)}`);
        }
      }
      setDebugData({ label, bubbleTable: bubbleTableName, ...parsedData });
      addLog(`✅ Debug ${bubbleTableName}: ${parsedData?.totalRows} 行`);
    } catch (err: any) {
      addLog(`❌ Debug ${bubbleTableName} 錯誤: ${err.message}`);
      alert(`Debug 錯誤: ${err.message}`);
    }
    setDebugLoading(null);
  };

  const scanAllTables = async () => {
    if (!bubbleBaseUrl || !bubbleToken) {
      alert("請先輸入 Bubble API URL 和 Token");
      return;
    }
    setScanAllLoading(true);
    setScanAllData(null);
    const allBubbleTables = GROUPS.flatMap((g) => g.tables.map((t) => t.bubble));
    const BATCH_SIZE = 8;
    const batches: string[][] = [];
    for (let i = 0; i < allBubbleTables.length; i += BATCH_SIZE) {
      batches.push(allBubbleTables.slice(i, i + BATCH_SIZE));
    }
    addLog(`🔍 掃描全部 ${allBubbleTables.length} 個 Bubble 資料表...`);
    const allResults: Record<string, any> = {};
    let hasError = false;
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      addLog(`📡 掃描批次 ${batchIdx + 1}/${batches.length}: ${batch.join(", ")}`);
      try {
        const response = await supabase.functions.invoke(
          "supabase-functions-bubble-migration",
          { body: { scanAll: true, tables: batch, bubbleBaseUrl, bubbleToken } }
        );
        const { data, error } = response;
        if (error) throw new Error(error.message || String(error));
        let parsedData = data;
        if (typeof data === "string") {
          try { parsedData = JSON.parse(data); } catch {
            throw new Error(`回傳非 JSON: ${data.substring(0, 200)}`);
          }
        }
        Object.assign(allResults, parsedData?.results || {});
        setScanAllData({
          scanAll: true,
          tablesScanned: Object.keys(allResults).length,
          results: { ...allResults },
        });
      } catch (err: any) {
        addLog(`❌ 批次 ${batchIdx + 1} 錯誤: ${err.message}`);
        for (const tbl of batch) {
          if (!allResults[tbl]) allResults[tbl] = { error: `Batch failed: ${err.message}` };
        }
        setScanAllData({
          scanAll: true,
          tablesScanned: Object.keys(allResults).length,
          results: { ...allResults },
        });
        hasError = true;
      }
    }
    if (hasError) addLog(`⚠️ 掃描完成 (有錯誤)`);
    else addLog(`✅ 全部掃描完成`);
    setScanAllLoading(false);
  };

  const runSingleTable = async (tableKey: string) => {
    // Check if this table has a bubble source - junction tables don't
    const tableDef = GROUPS.flatMap((g) => g.tables).find((t) => t.key === tableKey);
    if (tableDef && !tableDef.bubble) {
      setStatuses((prev) => ({ ...prev, [tableKey]: { status: "success", message: "SQL 遷移 (非 Bubble)", inserted: 0 } }));
      addLog(`⏭️ ${tableKey} 跳過: 此關聯表由 SQL 遷移建立，無需 Bubble 同步`);
      return;
    }
    setStatuses((prev) => ({ ...prev, [tableKey]: { status: "running" } }));
    addLog(`開始遷移: ${tableKey}`);
    try {
      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-bubble-migration",
        { body: { table: tableKey, bubbleBaseUrl, bubbleToken } }
      );
      if (error) {
        let errMsg = error.message;
        try {
          if (error.context) {
            const errBody = await error.context.json();
            errMsg = errBody?.error || JSON.stringify(errBody);
          }
        } catch {}
        throw new Error(errMsg);
      }
      const tableResult = data?.results?.[tableKey];
      if (tableResult?.error) {
        setStatuses((prev) => ({ ...prev, [tableKey]: { status: "error", message: tableResult.error } }));
        addLog(`❌ ${tableKey} 失敗: ${tableResult.error}`);
      } else if (tableResult?.skipped) {
        setStatuses((prev) => ({ ...prev, [tableKey]: { status: "success", message: "無資料跳過", inserted: 0 } }));
        addLog(`⚠️ ${tableKey} 跳過 (無資料)`);
      } else {
        setStatuses((prev) => ({ ...prev, [tableKey]: { status: "success", inserted: tableResult?.inserted || 0 } }));
        addLog(`✅ ${tableKey} 完成: ${tableResult?.inserted || 0} 筆記錄`);
        // Refresh supabase count for this table after successful migration
        try {
          const { count } = await supabase.from(tableKey).select("*", { count: "exact", head: true });
          setProgress((prev) => ({
            ...prev,
            [tableKey]: { ...prev[tableKey], supabaseCount: count || 0 },
          }));
        } catch {}

        // Auto-sync auth.users after users table migration
        if (tableKey === "users") {
          addLog("🔐 自動觸發 auth.users 同步...");
          try {
            const { data: syncData, error: syncErr } = await supabase.functions.invoke(
              "supabase-functions-sync-auth-users",
              { body: { action: "sync" } }
            );
            if (syncErr) throw new Error(syncErr.message || String(syncErr));
            if (syncData?.success) {
              addLog(`✅ Auth 同步完成: 新建 ${syncData.created}, 連結 ${syncData.linked}, 錯誤 ${syncData.errors}`);
            } else {
              addLog(`⚠️ Auth 同步回應異常: ${syncData?.error || "unknown"}`);
            }
          } catch (authErr: any) {
            addLog(`⚠️ Auth 同步失敗 (不影響資料遷移): ${authErr.message}`);
          }
        }
      }
    } catch (err: any) {
      setStatuses((prev) => ({ ...prev, [tableKey]: { status: "error", message: err.message } }));
      addLog(`❌ ${tableKey} 錯誤: ${err.message}`);
    }
  };

  const runGroup = async (groupKey: string) => {
    if (!bubbleBaseUrl || !bubbleToken) {
      alert("請輸入 Bubble API URL 和 Token");
      return;
    }
    setRunningGroup(groupKey);
    addLog(`🚀 開始遷移群組: ${groupKey} (逐表遷移模式)...`);
    const group = GROUPS.find((g) => g.key === groupKey);
    if (!group) return;

    // Migrate tables one-at-a-time to avoid IDLE_TIMEOUT on large groups
    for (const t of group.tables) {
      // Skip junction tables with no Bubble source
      if (!t.bubble) {
        setStatuses((prev) => ({ ...prev, [t.key]: { status: "success", message: "SQL 遷移 (非 Bubble)", inserted: 0 } }));
        addLog(`⏭️ ${t.label || t.key}: 關聯表由 SQL 遷移建立，跳過`);
        continue;
      }
      setStatuses((prev) => ({ ...prev, [t.key]: { status: "running" } }));
      addLog(`📡 遷移中: ${t.label || t.key}...`);

      try {
        const { data, error } = await supabase.functions.invoke(
          "supabase-functions-bubble-migration",
          { body: { table: t.key, bubbleBaseUrl, bubbleToken } }
        );
        if (error) {
          let errMsg = error.message;
          try {
            if (error.context) {
              const errBody = await error.context.json();
              errMsg = errBody?.error || JSON.stringify(errBody);
            }
          } catch {}
          throw new Error(errMsg);
        }
        const result = data?.results?.[t.key];
        if (!result) {
          setStatuses((prev) => ({ ...prev, [t.key]: { status: "success", message: "無回應", inserted: 0 } }));
        } else if (result.error) {
          setStatuses((prev) => ({ ...prev, [t.key]: { status: "error", message: result.error } }));
          addLog(`❌ ${t.key} 失敗: ${result.error}`);
        } else if (result.skipped) {
          setStatuses((prev) => ({ ...prev, [t.key]: { status: "success", message: "無資料跳過", inserted: 0 } }));
        } else {
          setStatuses((prev) => ({ ...prev, [t.key]: { status: "success", inserted: result.inserted || 0 } }));
          addLog(`✅ ${t.key} 完成: ${result.inserted || 0} 筆記錄`);
        }

        // Refresh count for this table
        try {
          const { count } = await supabase.from(t.key).select("*", { count: "exact", head: true });
          setProgress((prev) => ({
            ...prev,
            [t.key]: { ...prev[t.key], supabaseCount: count || 0 },
          }));
        } catch {}

        // Auto-sync auth.users after users table migration in group
        if (t.key === "users" && !result?.error && !result?.skipped) {
          addLog("🔐 自動觸發 auth.users 同步...");
          try {
            const { data: syncData, error: syncErr } = await supabase.functions.invoke(
              "supabase-functions-sync-auth-users",
              { body: { action: "sync" } }
            );
            if (syncErr) throw new Error(syncErr.message || String(syncErr));
            if (syncData?.success) {
              addLog(`✅ Auth 同步完成: 新建 ${syncData.created}, 連結 ${syncData.linked}, 錯誤 ${syncData.errors}`);
            }
          } catch (authErr: any) {
            addLog(`⚠️ Auth 同步失敗 (不影響資料遷移): ${authErr.message}`);
          }
        }
      } catch (err: any) {
        setStatuses((prev) => ({ ...prev, [t.key]: { status: "error", message: err.message } }));
        addLog(`❌ ${t.key} 錯誤: ${err.message}`);
      }
    }

    addLog(`🎉 群組 ${groupKey} 遷移完成!`);
    setRunningGroup(null);
  };

  const runAll = async () => {
    if (!bubbleBaseUrl || !bubbleToken) {
      alert("請輸入 Bubble API URL 和 Token");
      return;
    }
    setIsRunningAll(true);
    addLog("🚀 開始全部遷移...");
    for (const group of GROUPS) {
      await runGroup(group.key);
    }
    setIsRunningAll(false);
    addLog("🎉 全部遷移完成!");
    // Final refresh
    fetchSupabaseCounts();
  };

  // ─── Stage 2 BWF Bubble sync (protected) ───
  const formatBwfSyncResult = (result: Record<string, unknown> | undefined) => {
    if (!result) return "無回應";
    if (result.error) return String(result.error);
    if (result.skipped_empty) return "Bubble 無資料";
    const parts = [
      result.fk_only ? "[UUID FK]" : result.dry_run ? "[預覽]" : "",
      result.fk_only ? "" : `+${result.inserted ?? 0}`,
      result.fk_only ? "" : `~${result.updated ?? 0}`,
      result.skipped ? `跳過 ${result.skipped}` : "",
      result.skipped_pms3 ? `(PMS3≥cutoff ${result.skipped_pms3})` : "",
      result.skipped_bubble_pre_cutoff ? `(Bubble≤cutoff ${result.skipped_bubble_pre_cutoff})` : "",
      result.fk_resolved != null ? `FK ${result.fk_resolved} 欄` : "",
      result.fk_rows_remaining != null && Number(result.fk_rows_remaining) > 0
        ? `未填 ${result.fk_rows_remaining}`
        : result.fk_resolved != null && !(Array.isArray(result.fk_errors) && result.fk_errors.length)
          ? "FK ✓"
          : "",
      Array.isArray(result.fk_errors) && result.fk_errors.length
        ? `FK錯 ${result.fk_errors.length}: ${String(result.fk_errors[0]).slice(0, 80)}`
        : "",
      result.fk_skipped ? String(result.message ?? "略過 FK") : "",
    ].filter(Boolean);
    return parts.join(" ");
  };

  const runBwfSyncTable = async (tableKey: string) => {
    if (!bubbleBaseUrl || !bubbleToken) {
      alert("請輸入 Bubble API URL 和 Token");
      return;
    }
    setBwfSyncStatuses((prev) => ({ ...prev, [tableKey]: { status: "running" } }));
    addLog(`${bwfDryRun ? "🔍 預覽" : "🔄 同步"} BWF: ${tableKey}`);
    try {
      const { data, error } = await supabase.functions.invoke(BWF_SYNC_FUNCTION, {
        body: { table: tableKey, bubbleBaseUrl, bubbleToken, dryRun: bwfDryRun },
      });
      if (error) throw new Error(error.message || String(error));
      const result = data?.results?.[tableKey];
      if (result?.error) {
        setBwfSyncStatuses((prev) => ({ ...prev, [tableKey]: { status: "error", message: result.error } }));
        addLog(`❌ BWF ${tableKey}: ${result.error}`);
      } else {
        const msg = formatBwfSyncResult(result);
        setBwfSyncStatuses((prev) => ({
          ...prev,
          [tableKey]: { status: "success", message: msg, inserted: (result?.inserted as number) || 0 },
        }));
        addLog(`✅ BWF ${tableKey}: ${msg}`);
        if (!bwfDryRun) {
          try {
            const { count } = await supabase.from(tableKey).select("*", { count: "exact", head: true });
            setProgress((prev) => ({ ...prev, [tableKey]: { ...prev[tableKey], supabaseCount: count || 0 } }));
          } catch {}
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setBwfSyncStatuses((prev) => ({ ...prev, [tableKey]: { status: "error", message: msg } }));
      addLog(`❌ BWF ${tableKey}: ${msg}`);
    }
  };

  const runBwfSyncGroup = async (groupKey: string) => {
    if (!bubbleBaseUrl || !bubbleToken) {
      alert("請輸入 Bubble API URL 和 Token");
      return;
    }
    const group = BWF_SYNC_GROUPS.find((g) => g.key === groupKey);
    if (!group) return;
    setBwfSyncRunningGroup(groupKey);
    addLog(`${bwfDryRun ? "🔍 預覽" : "🔄 同步"} BWF 群組: ${group.label}`);
    for (const tableKey of group.tables) {
      await runBwfSyncTable(tableKey);
    }
    setBwfSyncRunningGroup(null);
    addLog(`🎉 BWF 群組 ${groupKey} 完成`);
    if (!bwfDryRun) fetchSupabaseCounts();
  };

  const runBwfSyncAll = async () => {
    if (!bubbleBaseUrl || !bubbleToken) {
      alert("請輸入 Bubble API URL 和 Token");
      return;
    }
    setBwfSyncRunningAll(true);
    addLog(`${bwfDryRun ? "🔍 預覽" : "🔄 同步"} Stage 2 BWF 全部表...`);
    for (const group of BWF_SYNC_GROUPS) {
      await runBwfSyncGroup(group.key);
    }
    setBwfSyncRunningAll(false);
    addLog("🎉 Stage 2 BWF 同步完成");
    if (!bwfDryRun) fetchSupabaseCounts();
  };

  const runBwfResolveFksGroup = async (groupKey: string) => {
    const group = BWF_SYNC_GROUPS.find((g) => g.key === groupKey);
    if (!group) return;
    setBwfFkRunningGroup(groupKey);
    addLog(`🔗 補填 UUID FK: ${group.label}`);
    for (const tableKey of group.tables) {
      setBwfSyncStatuses((prev) => ({ ...prev, [tableKey]: { status: "running" } }));
      try {
        const { data, error } = await supabase.functions.invoke(BWF_SYNC_FUNCTION, {
          body: { table: tableKey, resolveFKsOnly: true },
        });
        if (error) throw new Error(error.message || String(error));
        const result = data?.results?.[tableKey];
        if (result?.error) {
          setBwfSyncStatuses((prev) => ({ ...prev, [tableKey]: { status: "error", message: result.error } }));
          addLog(`❌ FK ${tableKey}: ${result.error}`);
        } else {
          const msg = formatBwfSyncResult(result);
          setBwfSyncStatuses((prev) => ({ ...prev, [tableKey]: { status: "success", message: msg } }));
          addLog(`✅ FK ${tableKey}: ${msg}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setBwfSyncStatuses((prev) => ({ ...prev, [tableKey]: { status: "error", message: msg } }));
        addLog(`❌ FK ${tableKey}: ${msg}`);
      }
    }
    setBwfFkRunningGroup(null);
    addLog(`🎉 UUID FK 補填完成: ${group.label}`);
  };

  // ─── Auth Users Sync functions ───
  const fetchAuthSyncStatus = async () => {
    setAuthSyncLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-sync-auth-users",
        { body: { action: "status" } }
      );
      if (error) throw new Error(error.message || String(error));
      if (data?.success) {
        setAuthSyncStatus(data.status);
      } else {
        throw new Error(data?.error || "Unknown error");
      }
    } catch (err: any) {
      addLog(`❌ Auth 狀態查詢失敗: ${err.message}`);
      alert(`查詢失敗: ${err.message}`);
    }
    setAuthSyncLoading(false);
  };

  const runAuthSync = async () => {
    setAuthSyncing(true);
    setAuthSyncResult(null);
    addLog("🔐 開始同步 auth.users...");
    try {
      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-sync-auth-users",
        { body: { action: "sync" } }
      );
      if (error) throw new Error(error.message || String(error));
      if (data?.success) {
        setAuthSyncResult(data);
        addLog(`✅ Auth 同步完成: 新建 ${data.created}, 連結 ${data.linked}, 錯誤 ${data.errors}`);
        // Refresh status
        fetchAuthSyncStatus();
      } else {
        throw new Error(data?.error || "Unknown error");
      }
    } catch (err: any) {
      addLog(`❌ Auth 同步失敗: ${err.message}`);
      setAuthSyncResult({ success: false, error: err.message });
    }
    setAuthSyncing(false);
  };

  // ─── Computed stats ───
  const getGroupProgress = (groupKey: string) => {
    const group = GROUPS.find((g) => g.key === groupKey);
    if (!group) return { total: 0, synced: 0, partial: 0, empty: 0, missing: 0, supabaseTotal: 0, bubbleTotal: 0, hasBubbleCounts: false };
    
    let synced = 0, partial = 0, empty = 0, missing = 0, supabaseTotal = 0, bubbleTotal = 0, hasBubbleCounts = false;
    
    for (const t of group.tables) {
      const p = progress[t.key];
      
      // Table doesn't exist in DB
      if (p?.error) {
        missing++;
        continue;
      }
      
      const sc = p?.supabaseCount || 0;
      const bc = p?.bubbleCount ?? null;
      supabaseTotal += sc;
      
      if (bc !== null) {
        hasBubbleCounts = true;
        bubbleTotal += bc;
        if (bc === 0) {
          // Bubble has no data — treat as fully synced
          synced++;
        } else {
          const pct = (sc / bc) * 100;
          if (pct >= 100) synced++;
          else if (pct > 0) partial++;
          else empty++;
        }
      } else {
        if (sc > 0) synced++;
        else empty++;
      }
    }
    
    return { total: group.tables.length, synced, partial, empty, missing, supabaseTotal, bubbleTotal, hasBubbleCounts };
  };

  const getOverallStats = () => {
    let totalTables = 0, synced = 0, partial = 0, empty = 0, supabaseTotal = 0, bubbleTotal = 0, hasBubbleCounts = false;
    
    for (const group of GROUPS) {
      const stats = getGroupProgress(group.key);
      totalTables += stats.total;
      synced += stats.synced;
      partial += stats.partial;
      empty += stats.empty;
      supabaseTotal += stats.supabaseTotal;
      bubbleTotal += stats.bubbleTotal;
      if (stats.hasBubbleCounts) hasBubbleCounts = true;
    }
    
    return { totalTables, synced, partial, empty, supabaseTotal, bubbleTotal, hasBubbleCounts };
  };

  const overall = getOverallStats();
  const overallPercent = overall.totalTables > 0
    ? Math.round((overall.synced / overall.totalTables) * 100)
    : 0;

  const getTablePercent = (key: string) => {
    const p = progress[key];
    if (!p) return 0;
    const sc = p.supabaseCount || 0;
    const bc = p.bubbleCount;
    if (bc === null) return sc > 0 ? 100 : 0;
    if (bc === 0) return 100; // Bubble has no data = 100% complete
    return Math.min(100, Math.round((sc / bc) * 100));
  };

  const getTableStatus = (key: string): "synced" | "partial" | "empty" => {
    const pct = getTablePercent(key);
    const p = progress[key];
    if (!p) return "empty";
    if (p.bubbleCount === null) return p.supabaseCount > 0 ? "synced" : "empty";
    if (pct >= 100) return "synced";
    if (pct > 0) return "partial";
    return "empty";
  };

  const getMigrationStatusBadge = (key: string) => {
    const s = statuses[key];
    if (!s) return null;
    if (s.status === "running")
      return <span className="text-blue-500 text-[12px] animate-pulse font-medium">⏳ 遷移中...</span>;
    if (s.status === "success")
      return (
        <span className="text-emerald-600 text-[12px] font-medium">
          ✅ {s.inserted !== undefined ? `+${s.inserted}` : s.message || "完成"}
        </span>
      );
    if (s.status === "error")
      return (
        <span className="text-red-500 text-[12px] font-medium truncate max-w-[180px]" title={s.message}>
          ❌ {s.message?.substring(0, 40)}
        </span>
      );
    return null;
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      {/* Production Warning Banner */}
      <div className="bg-red-600 border-b-4 border-red-800">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="text-white font-bold text-sm">⚠️ 生產環境 — PRODUCTION DATABASE</p>
            <p className="text-red-100 text-xs">所有操作都需要輸入確認句子。遷移會覆寫現有數據，不可撤銷。All actions require typing a confirmation sentence. Migrations will overwrite existing data irreversibly.</p>
          </div>
          <span className="ml-auto bg-red-900/50 text-red-100 text-[12px] font-mono px-3 py-1 rounded-full border border-red-400">🔒 LOCKED</span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-[#1A2035] text-white">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                📊 資料遷移進度控制台
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Bubble.io → Supabase · {ALL_TABLE_KEYS.length} 個資料表
              </p>
            </div>
            <div className="flex items-center gap-3">
              {lastRefreshed && (
                <span className="text-gray-500 text-[12px]">
                  最後更新: {lastRefreshed.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={fetchSupabaseCounts}
                disabled={progressLoading}
                className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition disabled:opacity-50"
              >
                {progressLoading ? "⏳" : "🔄"} 重新整理
              </button>
            </div>
          </div>

          {/* Overall KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-gray-400 text-[12px] uppercase tracking-wider">總資料表</p>
              <p className="text-2xl font-bold mt-1">{overall.totalTables}</p>
            </div>
            <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
              <p className="text-emerald-400 text-[12px] uppercase tracking-wider">✓ 已同步</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{overall.synced}</p>
            </div>
            <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
              <p className="text-amber-400 text-[12px] uppercase tracking-wider">⚡ 部分同步</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{overall.partial}</p>
            </div>
            <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
              <p className="text-red-400 text-[12px] uppercase tracking-wider">⭕ 未同步</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{overall.empty}</p>
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-400">整體遷移進度</span>
              <span className="text-white font-medium">{overallPercent}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-3 rounded-full transition-all duration-700"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
            {overall.hasBubbleCounts && (
              <p className="text-gray-500 text-[12px] mt-1">
                Supabase: {overall.supabaseTotal.toLocaleString()} 筆 / Bubble: {overall.bubbleTotal.toLocaleString()} 筆
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 flex items-center gap-1">
          <button
            onClick={() => setViewMode("progress")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              viewMode === "progress"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            📊 進度總覽
          </button>
          <button
            onClick={() => setViewMode("migrate")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              viewMode === "migrate"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            🚀 遷移控制 (Stage 1)
          </button>
          <button
            onClick={() => setViewMode("bwf-sync")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              viewMode === "bwf-sync"
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            🪑 Stage 2 BWF 同步
          </button>
          <button
            onClick={() => setViewMode("fk-audit")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              viewMode === "fk-audit"
                ? "border-purple-500 text-purple-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            🔗 FK 審計面板
          </button>
          <button
            onClick={() => setViewMode("auth-sync")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              viewMode === "auth-sync"
                ? "border-green-500 text-green-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            🔐 Auth 用戶同步
          </button>
          <button
            onClick={() => setViewMode("man-hours")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              viewMode === "man-hours"
                ? "border-cyan-500 text-cyan-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            🕐 Man Hour 遷移
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* ═══════ PROGRESS VIEW ═══════ */}
        {viewMode === "progress" && (
          <div>
            {/* Bubble source scan */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#1A2035]">🔗 Bubble 來源資料比對</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    輸入 Bubble API 憑證後掃描，即可看到每個表的完成百分比
                  </p>
                </div>
                <button
                  onClick={fetchBubbleCounts}
                  disabled={bubbleCountsLoading || !bubbleBaseUrl || !bubbleToken}
                  className="text-xs bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
                >
                  {bubbleCountsLoading ? "⏳ 掃描中..." : "📡 掃描 Bubble 來源數量"}
                </button>
              </div>
              {/* Credentials inline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <input
                  type="text"
                  placeholder="Bubble API Base URL"
                  value={bubbleBaseUrl}
                  onChange={(e) => setBubbleBaseUrl(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <input
                  type="password"
                  placeholder="Bubble API Token"
                  value={bubbleToken}
                  onChange={(e) => setBubbleToken(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Group Progress Cards */}
            {GROUPS.map((group) => {
              const stats = getGroupProgress(group.key);
              const groupPercent = stats.total > 0
                ? Math.round((stats.synced / stats.total) * 100)
                : 0;
              const isExpanded = expandedGroups[group.key];

              return (
                <div
                  key={group.key}
                  className="bg-white rounded-xl shadow-sm mb-4 border border-gray-100 overflow-hidden"
                >
                  {/* Group Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50/50 transition"
                    onClick={() => toggleGroup(group.key)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`w-1.5 h-8 rounded-full ${group.color}`} />
                        <div>
                          <h2 className="font-semibold text-[#1A2035] text-sm">{group.label}</h2>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[12px] text-gray-400">
                              {stats.total} 個資料表
                            </span>
                            <span className="text-[12px] text-emerald-600 font-medium">
                              ✓ {stats.synced}
                            </span>
                            {stats.partial > 0 && (
                              <span className="text-[12px] text-amber-600 font-medium">
                                ⚡ {stats.partial}
                              </span>
                            )}
                            {stats.empty > 0 && (
                              <span className="text-[12px] text-red-500 font-medium">
                                ⭕ {stats.empty}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-600">{groupPercent}%</span>
                        <span className="text-gray-400 text-xs">{isExpanded ? "▼" : "▶"}</span>
                      </div>
                    </div>
                    <ProgressBar percent={groupPercent} colorClass={group.colorBar} height="h-1.5" />
                  </div>

                  {/* Expanded: Table rows */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 pb-3">
                      {/* Column headers */}
                      <div className="grid grid-cols-12 gap-2 px-2 py-2 text-[12px] text-gray-400 uppercase tracking-wider font-medium">
                        <div className="col-span-4">資料表</div>
                        <div className="col-span-2 text-right">Supabase</div>
                        <div className="col-span-2 text-right">Bubble</div>
                        <div className="col-span-3">進度</div>
                        <div className="col-span-1 text-center">狀態</div>
                      </div>
                      
                      {group.tables.map((t) => {
                        const p = progress[t.key];
                        const sc = p?.supabaseCount || 0;
                        const bc = p?.bubbleCount ?? null;
                        const pct = getTablePercent(t.key);
                        const status = getTableStatus(t.key);

                        const isBubbleEmpty = bc !== null && bc === 0 && sc === 0;
                        const hasTableError = !!p?.error;

                        return (
                          <div
                            key={t.key}
                            className={`grid grid-cols-12 gap-2 items-center px-2 py-2 rounded-lg transition ${
                              hasTableError
                                ? "bg-purple-50/50 hover:bg-purple-50"
                                : isBubbleEmpty
                                ? "bg-yellow-50/50 hover:bg-yellow-50"
                                : status === "empty"
                                ? "bg-red-50/50 hover:bg-red-50"
                                : status === "partial"
                                ? "bg-amber-50/50 hover:bg-amber-50"
                                : "bg-gray-50/50 hover:bg-gray-50"
                            }`}
                          >
                            {/* Table name */}
                            <div className="col-span-4 min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{t.label}</p>
                              <p className="text-[12px] text-gray-400 truncate">
                                <code className="bg-gray-100 px-1 rounded">{t.key}</code>
                              </p>
                            </div>

                            {/* Supabase count */}
                            <div className="col-span-2 text-right">
                              {p?.error ? (
                                <span className="text-[12px] font-medium text-red-500" title={p.error}>
                                  ❌ {p.error}
                                </span>
                              ) : (
                                <span className={`text-xs font-mono font-medium ${sc > 0 ? "text-gray-800" : "text-gray-300"}`}>
                                  {progressLoading ? "..." : sc.toLocaleString()}
                                </span>
                              )}
                            </div>

                            {/* Bubble count */}
                            <div className="col-span-2 text-right">
                              {bc !== null && bc === 0 && sc === 0 ? (
                                <span className="text-xs font-mono text-yellow-600 font-medium">
                                  沒有數據
                                </span>
                              ) : (
                                <span className={`text-xs font-mono ${bc !== null ? "text-gray-600" : "text-gray-300"}`}>
                                  {bc !== null ? bc.toLocaleString() : "—"}
                                </span>
                              )}
                            </div>

                            {/* Progress bar */}
                            <div className="col-span-3">
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1">
                                  <ProgressBar
                                    percent={bc !== null ? pct : sc > 0 ? 100 : 0}
                                    colorClass={
                                      bc !== null && bc === 0 && sc === 0
                                        ? "bg-yellow-400"
                                        : status === "synced"
                                        ? "bg-emerald-500"
                                        : status === "partial"
                                        ? "bg-amber-500"
                                        : "bg-gray-200"
                                    }
                                    height="h-1.5"
                                  />
                                </div>
                                <span className={`text-[12px] font-mono w-8 text-right ${bc !== null && bc === 0 && sc === 0 ? "text-yellow-600" : "text-gray-500"}`}>
                                  {bc !== null ? (bc === 0 && sc === 0 ? "N/A" : `${pct}%`) : sc > 0 ? "✓" : "—"}
                                </span>
                              </div>
                            </div>

                            {/* Status badge */}
                            <div className="col-span-1 flex justify-center">
                              <StatusBadge supabaseCount={sc} bubbleCount={bc} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Summary Legend */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mt-4">
              <h3 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">圖例說明</h3>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs text-gray-600">✓ 已完成 (100%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-xs text-gray-600">⚡ 部分同步 (1-99%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-xs text-gray-600">⭕ 未同步 (0%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-xs text-gray-600">有資料但 Bubble 來源未掃描</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-yellow-400" />
                  <span className="text-xs text-gray-600">Bubble.io 沒有數據 (來源為空)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-gray-300" />
                  <span className="text-xs text-gray-600">未掃描 / 未同步</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ MIGRATE VIEW ═══════ */}
        {viewMode === "migrate" && (
          <div>
            {/* Credentials */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
              <h2 className="font-semibold text-[#1A2035] mb-4">🔑 Bubble API 設定</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Bubble API Base URL</label>
                  <input
                    type="text"
                    placeholder="https://your-app.bubbleapps.io/api/1.1"
                    value={bubbleBaseUrl}
                    onChange={(e) => setBubbleBaseUrl(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Bubble API Token</label>
                  <input
                    type="password"
                    placeholder="your-bubble-api-token"
                    value={bubbleToken}
                    onChange={(e) => setBubbleToken(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Global Actions */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <button
                onClick={() => requireDangerConfirmation("🚀 全部遷移 (Run All Migration)", runAll)}
                disabled={isRunningAll || !bubbleBaseUrl || !bubbleToken}
                className="bg-red-700 text-white text-sm px-6 py-2.5 rounded-lg hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium border-2 border-red-400"
              >
                {isRunningAll ? "⏳ 全部遷移中..." : "🔒 🚀 全部遷移 (按順序)"}
              </button>
              <button
                onClick={() => requireDangerConfirmation("🔍 掃描全部欄位 (Scan All Tables)", scanAllTables)}
                disabled={scanAllLoading || isRunningAll || !bubbleBaseUrl || !bubbleToken}
                className="bg-purple-700 text-white text-sm px-6 py-2.5 rounded-lg hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium border-2 border-purple-400"
              >
                {scanAllLoading ? "⏳ 掃描中..." : "🔒 🔍 掃描全部欄位"}
              </button>
              <button
                onClick={() => {
                  setStatuses({});
                  setLogs([]);
                }}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2.5 transition"
              >
                🔄 重置狀態
              </button>
            </div>

            {/* Migration Groups */}
            {GROUPS.map((group) => {
              const stats = getGroupProgress(group.key);
              const isExpanded = expandedGroups[group.key];
              const isGroupRunning = runningGroup === group.key;
              return (
                <div
                  key={group.key}
                  className="bg-white rounded-xl shadow-sm mb-4 border border-gray-100 overflow-hidden"
                >
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition"
                    onClick={() => toggleGroup(group.key)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-8 rounded-full ${group.color}`} />
                      <div>
                        <h2 className="font-semibold text-[#1A2035] text-sm">{group.label}</h2>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>{group.tables.length} 個資料表</span>
                          <span className="text-emerald-500">✓ {stats.synced}</span>
                          {stats.partial > 0 && <span className="text-amber-500">⚡ {stats.partial}</span>}
                          {stats.empty > 0 && <span className="text-red-500">⭕ {stats.empty}</span>}
                          {stats.missing > 0 && <span className="text-purple-500">🔗 {stats.missing} 未建表</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          requireDangerConfirmation(`遷移群組: ${group.label}`, () => runGroup(group.key));
                        }}
                        disabled={isGroupRunning || isRunningAll || !bubbleBaseUrl || !bubbleToken}
                        className={`text-xs text-white px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition ${group.color} hover:opacity-90`}
                      >
                        {isGroupRunning ? "⏳ 遷移中..." : "🔒 遷移群組"}
                      </button>
                      <span className="text-gray-400 text-sm">{isExpanded ? "▼" : "▶"}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 pb-4">
                      <div className="space-y-1.5 mt-3">
                        {group.tables.map((t) => {
                          const p = progress[t.key];
                          const sc = p?.supabaseCount || 0;
                          const bc = p?.bubbleCount ?? null;
                          const pct = getTablePercent(t.key);
                          const status = getTableStatus(t.key);
                          
                          const isBubbleEmpty = bc !== null && bc === 0 && sc === 0;
                          
                          return (
                            <div
                              key={t.key}
                              className={`flex items-center justify-between p-2.5 rounded-lg transition ${
                                isBubbleEmpty
                                  ? "bg-yellow-50/40"
                                  : status === "empty"
                                  ? "bg-red-50/40"
                                  : status === "partial"
                                  ? "bg-amber-50/40"
                                  : "bg-gray-50"
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-gray-800">{t.label}</p>
                                  <StatusBadge supabaseCount={sc} bubbleCount={bc} />
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <code className="bg-gray-100 px-1 rounded text-[12px] text-gray-500">{t.key}</code>
                                  <span className="text-[12px] text-gray-400">←</span>
                                  <code className="bg-gray-100 px-1 rounded text-[12px] text-gray-500">{t.bubble}</code>
                                  {sc > 0 && (
                                    <span className="text-[12px] text-gray-500 font-mono">
                                      ({sc.toLocaleString()}{bc !== null ? ` / ${bc.toLocaleString()}` : ""})
                                    </span>
                                  )}
                                  {isBubbleEmpty && (
                                    <span className="text-[12px] text-yellow-600 font-medium">
                                      (Bubble.io 沒有數據)
                                    </span>
                                  )}
                                </div>
                                {/* Mini progress bar */}
                                {bc !== null && (
                                  <div className="mt-1 max-w-[200px]">
                                    <ProgressBar
                                      percent={pct}
                                      colorClass={
                                        bc === 0 && sc === 0 ? "bg-yellow-400" :
                                        status === "synced" ? "bg-emerald-500" :
                                        status === "partial" ? "bg-amber-500" : "bg-gray-200"
                                      }
                                      height="h-1"
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                {getMigrationStatusBadge(t.key)}
                                {t.bubble ? (
                                  <>
                                    <button
                                      onClick={() => debugBubbleTable(t.bubble, t.label)}
                                      disabled={debugLoading === t.bubble || isRunningAll}
                                      className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                      title={`檢查 ${t.bubble} 的 Bubble API 欄位`}
                                    >
                                      {debugLoading === t.bubble ? "⏳" : "🔍"}
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (!bubbleBaseUrl || !bubbleToken) {
                                          alert("請先輸入 Bubble API URL 和 Token");
                                          return;
                                        }
                                        requireDangerConfirmation(`遷移單表: ${t.label} (${t.key})`, () => runSingleTable(t.key));
                                      }}
                                      disabled={statuses[t.key]?.status === "running" || isRunningAll}
                                      className="text-xs bg-red-500 text-white px-2.5 py-1 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                      🔒 遷移
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-[12px] text-purple-600 font-medium bg-purple-50 px-2 py-1 rounded-lg border border-purple-200">
                                    🔗 SQL 遷移
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Debug Data Panel */}
            {debugData && (
              <div className="bg-white rounded-xl shadow-sm border border-purple-200 p-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-purple-800">
                    🔍 Debug: {debugData.label} ({debugData.bubbleTable})
                  </h2>
                  <button onClick={() => setDebugData(null)} className="text-xs text-gray-400 hover:text-gray-700 transition">✕ 關閉</button>
                </div>
                <p className="text-xs text-gray-600 mb-2">共 <strong>{debugData.totalRows}</strong> 行</p>
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-700 mb-1">欄位名稱 ({debugData.sampleKeys?.length || 0}):</p>
                  <div className="flex flex-wrap gap-1">
                    {(debugData.sampleKeys || []).map((k: string) => (
                      <code key={k} className="text-[12px] bg-purple-50 text-purple-800 px-1.5 py-0.5 rounded border border-purple-200">{k}</code>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">範例資料 (前3行):</p>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-60 overflow-auto">
                    <pre className="text-[12px] text-gray-700 font-mono whitespace-pre-wrap break-words">
                      {JSON.stringify(debugData.sampleRows, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Scan All Results Panel */}
            {scanAllData && (
              <div className="bg-white rounded-xl shadow-sm border border-purple-200 p-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-purple-800">
                    🔍 全部欄位掃描結果 ({scanAllData.tablesScanned} 個表)
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(scanAllData, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a"); a.href = url; a.download = "bubble-field-scan.json"; a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded hover:bg-purple-200 transition"
                    >📥 下載 JSON</button>
                    <button onClick={() => setScanAllData(null)} className="text-xs text-gray-400 hover:text-gray-700 transition">✕ 關閉</button>
                  </div>
                </div>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {Object.entries(scanAllData.results || {}).map(([tableName, info]: [string, any]) => (
                    <div key={tableName} className={`rounded-lg p-3 ${info.error ? "bg-red-50 border border-red-200" : "bg-gray-50 border border-gray-200"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <code className="text-xs font-bold text-gray-800">{tableName}</code>
                        {info.error ? (
                          <span className="text-xs text-red-500">❌ {info.error.substring(0, 80)}</span>
                        ) : (
                          <span className="text-xs text-gray-500">{info.totalRows} 行</span>
                        )}
                      </div>
                      {!info.error && info.fields && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {info.fields.map((f: string) => (
                            <span key={f} className="text-[12px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100">
                              {f}
                              {info.fieldMap?.[f] && (
                                <span className="text-gray-400 ml-1">= {JSON.stringify(info.fieldMap[f][0]).substring(0, 30)}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">📋 遷移順序說明</h3>
              <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
                <li><strong>查閱資料表 (lookups)</strong> — 先遷移所有 nos_* 參照表</li>
                <li><strong>核心實體 (core)</strong> — 職員、客戶、供應商、大廈、工廠</li>
                <li><strong>項目資料 (projects)</strong> — BWA/BWF 競標、項目、產品</li>
                <li><strong>財務及關聯資料 (financial)</strong> — 收入、支出、報價、訂單等</li>
                <li><strong>額外資料表 (extra)</strong> — 附加資料表</li>
                <li>使用「全部遷移」按鈕會按以上正確順序自動執行</li>
                <li><strong>重複執行安全</strong> — UPSERT 以 bubble_id 判斷，不會產生重複資料</li>
              </ol>
            </div>
          </div>
        )}

        {/* ═══════ STAGE 2 BWF SYNC VIEW ═══════ */}
        {viewMode === "bwf-sync" && (
          <div>
            <div className="bg-white rounded-xl shadow-sm p-5 mb-6 border border-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-sm font-semibold text-[#1A2035]">執行模式</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    預覽僅統計 insert / update / skip，不寫入資料庫；同步模式會實際 upsert
                  </p>
                </div>
                <div
                  className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1"
                  role="group"
                  aria-label="Stage 2 執行模式"
                >
                  <button
                    type="button"
                    onClick={() => setBwfDryRun(true)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition ${
                      bwfDryRun
                        ? "bg-teal-600 text-white shadow-sm"
                        : "text-gray-600 hover:text-gray-900 hover:bg-white"
                    }`}
                  >
                    🔍 預覽模式
                  </button>
                  <button
                    type="button"
                    onClick={() => setBwfDryRun(false)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition ${
                      !bwfDryRun
                        ? "bg-red-600 text-white shadow-sm"
                        : "text-gray-600 hover:text-gray-900 hover:bg-white"
                    }`}
                  >
                    🔄 同步模式
                  </button>
                </div>
              </div>

              {!bwfDryRun && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  ⚠️ 目前已切換至<strong>同步模式</strong>：按「同步」按鈕會寫入資料庫，執行前需輸入確認句。
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={() =>
                    bwfDryRun
                      ? runBwfSyncAll()
                      : requireDangerConfirmation("Stage 2 BWF 同步全部表", runBwfSyncAll)
                  }
                  disabled={bwfSyncRunningAll || !bubbleBaseUrl || !bubbleToken}
                  className={`text-white text-sm px-5 py-2 rounded-lg disabled:opacity-50 font-medium ${
                    bwfDryRun ? "bg-teal-700 hover:bg-teal-800" : "bg-red-700 hover:bg-red-800"
                  }`}
                >
                  {bwfSyncRunningAll ? "⏳ 執行中..." : bwfDryRun ? "🔍 預覽全部" : "🔒 🔄 同步全部"}
                </button>
                <span className="text-xs text-gray-400">
                  目前：<strong className={bwfDryRun ? "text-teal-700" : "text-red-700"}>
                    {bwfDryRun ? "預覽模式" : "同步模式"}
                  </strong>
                  · 使用「進度總覽」分頁的 Bubble API 憑證
                </span>
              </div>
            </div>

            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-semibold text-teal-900 mb-2">Stage 2 — BWF Bubble 同步（BWA 保護）</h3>
              <ul className="text-xs text-teal-800 space-y-1 list-disc list-inside">
                <li>不會同步 <code>bwa_pitchings</code> / <code>bwa_projects</code> 及 BWA 報價樹</li>
                <li>共享表僅同步 Bubble 列有 <strong>BWF Project / BWF Pitching</strong> 的資料</li>
                <li>PMS3 列 <code>modified_date ≥ {BWA_CUTOFF_LABEL}</code> 時<strong>永不覆寫</strong>（BWA 生產資料保護）</li>
                <li>已存在列僅在 Bubble <code>Modified Date &gt; {BWA_CUTOFF_LABEL}</code> 時才更新（Stage 1 已涵蓋 cutoff 前的舊資料）</li>
                <li>BWF 專用表（<code>bwf_projects</code>、<code>bwf_orders</code> 等）採完整 upsert</li>
                <li>每次同步後會<strong>自動補填 UUID FK 欄</strong>（即使全部列被跳過也會執行）</li>
                <li>若僅需補填 UUID、不重抓 Bubble，使用群組旁的「🔗 補填 UUID FK」</li>
                <li>建議先使用「預覽模式」查看統計，確認後再切換至「同步模式」執行</li>
              </ul>
            </div>

            {BWF_SYNC_GROUPS.map((group) => (
              <div key={group.key} className="bg-white rounded-xl shadow-sm mb-4 border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-8 rounded-full ${group.color}`} />
                    <h2 className="font-semibold text-[#1A2035] text-sm">{group.label}</h2>
                    <span className="text-xs text-gray-400">{group.tables.length} 表</span>
                  </div>
                  <button
                    onClick={() =>
                      bwfDryRun
                        ? runBwfSyncGroup(group.key)
                        : requireDangerConfirmation(
                            `同步 BWF 群組: ${group.label}`,
                            () => runBwfSyncGroup(group.key),
                          )
                    }
                    disabled={bwfSyncRunningGroup === group.key || bwfSyncRunningAll || bwfFkRunningGroup === group.key || !bubbleBaseUrl || !bubbleToken}
                    className={`text-xs text-white px-3 py-1.5 rounded-lg disabled:opacity-50 ${
                      bwfDryRun ? group.color : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {bwfSyncRunningGroup === group.key ? "⏳..." : bwfDryRun ? "🔍 預覽群組" : "🔒 同步群組"}
                  </button>
                  <button
                    onClick={() =>
                      requireDangerConfirmation(
                        `補填 UUID FK: ${group.label}`,
                        () => runBwfResolveFksGroup(group.key),
                      )
                    }
                    disabled={bwfFkRunningGroup === group.key || bwfSyncRunningGroup === group.key || bwfSyncRunningAll}
                    className="text-xs text-indigo-700 border border-indigo-200 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 disabled:opacity-50"
                  >
                    {bwfFkRunningGroup === group.key ? "⏳..." : "🔗 補填 UUID FK"}
                  </button>
                </div>
                <div className="px-4 py-3 space-y-1">
                  {group.tables.map((tableKey) => {
                    const st = bwfSyncStatuses[tableKey];
                    return (
                      <div key={tableKey} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                        <code className="text-xs text-gray-700">{tableKey}</code>
                        <div className="flex items-center gap-2">
                          {st?.message && <span className="text-[11px] text-gray-500 max-w-xs truncate">{st.message}</span>}
                          {st?.status === "running" && <span className="text-xs text-blue-500">⏳</span>}
                          {st?.status === "success" && <span className="text-xs text-emerald-500">✓</span>}
                          {st?.status === "error" && <span className="text-xs text-red-500">✗</span>}
                          <button
                            onClick={() =>
                              bwfDryRun
                                ? runBwfSyncTable(tableKey)
                                : requireDangerConfirmation(
                                    `同步 ${tableKey}`,
                                    () => runBwfSyncTable(tableKey),
                                  )
                            }
                            disabled={st?.status === "running" || !bubbleBaseUrl || !bubbleToken}
                            className={`text-[11px] font-medium hover:underline disabled:opacity-40 ${
                              bwfDryRun ? "text-teal-700" : "text-red-700"
                            }`}
                          >
                            {bwfDryRun ? "🔍 預覽" : "🔒 同步"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══════ FK AUDIT VIEW ═══════ */}
        {viewMode === "fk-audit" && (
          <div className="-mx-6 -mt-6">
            <FKAuditPage />
          </div>
        )}

        {/* ═══════ AUTH SYNC VIEW ═══════ */}
        {viewMode === "auth-sync" && (
          <div>
            {/* Description */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">🔐</span>
                <div>
                  <h2 className="font-semibold text-[#1A2035] text-lg">Auth 用戶同步管理</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    確保每個 <code className="bg-gray-100 px-1 rounded">public.users</code> 都有對應的 <code className="bg-gray-100 px-1 rounded">auth.users</code> 帳戶
                  </p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                <p className="font-medium mb-1">📋 同步邏輯:</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                  <li>掃描所有 <code>public.users</code> 中 <code>auth_user_id</code> 為空且有 email 的記錄</li>
                  <li>如果 <code>auth.users</code> 已有同 email 的帳戶 → 自動連結</li>
                  <li>如果沒有 → 建立新的 auth 帳戶（密碼使用 <code>special</code> 欄位值）</li>
                  <li>更新 <code>public.users.auth_user_id</code> 完成雙向連結</li>
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={fetchAuthSyncStatus}
                disabled={authSyncLoading}
                className="bg-[#1A2035] text-white text-sm px-5 py-2.5 rounded-lg hover:bg-[#2a3a5c] disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
              >
                {authSyncLoading ? "⏳ 查詢中..." : "📊 查看同步狀態"}
              </button>
              <button
                onClick={() => requireDangerConfirmation("🔄 執行 Auth 同步 (Sync Auth Users)", runAuthSync)}
                disabled={authSyncing}
                className="bg-red-600 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium border-2 border-red-400"
              >
                {authSyncing ? "⏳ 同步中..." : "🔒 🔄 執行 Auth 同步"}
              </button>
            </div>

            {/* Status Panel */}
            {authSyncStatus && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
                <h3 className="font-semibold text-[#1A2035] text-sm mb-4">📊 當前同步狀態</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-[12px] text-gray-400 uppercase tracking-wider">Public Users</p>
                    <p className="text-xl font-bold text-gray-800 mt-1">{authSyncStatus.publicUsersTotal}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-100">
                    <p className="text-[12px] text-emerald-600 uppercase tracking-wider">✓ 已連結</p>
                    <p className="text-xl font-bold text-emerald-700 mt-1">{authSyncStatus.linked}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
                    <p className="text-[12px] text-red-600 uppercase tracking-wider">⭕ 未連結</p>
                    <p className="text-xl font-bold text-red-700 mt-1">{authSyncStatus.unlinked}</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3 text-center border border-yellow-100">
                    <p className="text-[12px] text-yellow-600 uppercase tracking-wider">⚠️ 無 Email</p>
                    <p className="text-xl font-bold text-yellow-700 mt-1">{authSyncStatus.noEmail}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                    <p className="text-[12px] text-blue-600 uppercase tracking-wider">Auth Users</p>
                    <p className="text-xl font-bold text-blue-700 mt-1">{authSyncStatus.authUsersTotal}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-gray-500">Auth 連結進度</span>
                    <span className="font-medium text-gray-700">
                      {authSyncStatus.publicUsersTotal > 0
                        ? Math.round((authSyncStatus.linked / authSyncStatus.publicUsersTotal) * 100)
                        : 0}%
                    </span>
                  </div>
                  <ProgressBar
                    percent={
                      authSyncStatus.publicUsersTotal > 0
                        ? (authSyncStatus.linked / authSyncStatus.publicUsersTotal) * 100
                        : 0
                    }
                    colorClass="bg-emerald-500"
                    height="h-2"
                  />
                </div>

                {/* Unlinked users table */}
                {authSyncStatus.unlinkedUsers && authSyncStatus.unlinkedUsers.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-600 mb-2">
                      未連結用戶列表 ({authSyncStatus.unlinkedUsers.length} 筆):
                    </h4>
                    <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-gray-500">Email</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-500">類型</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-500">ID</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {authSyncStatus.unlinkedUsers.map((u: any) => (
                            <tr key={u.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-mono text-gray-700">{u.email}</td>
                              <td className="px-3 py-2">
                                <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[12px]">
                                  {u.user_type || "—"}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-400 font-mono truncate max-w-[120px]">{u.id}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sync Result */}
            {authSyncResult && (
              <div className={`rounded-xl shadow-sm border p-6 mb-6 ${
                authSyncResult.success
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-red-50 border-red-200"
              }`}>
                <h3 className={`font-semibold text-sm mb-3 ${
                  authSyncResult.success ? "text-emerald-800" : "text-red-800"
                }`}>
                  {authSyncResult.success ? "✅ 同步結果" : "❌ 同步失敗"}
                </h3>
                {authSyncResult.success ? (
                  <div>
                    <p className="text-sm text-emerald-700 mb-3">{authSyncResult.message}</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white rounded-lg p-3 text-center">
                        <p className="text-[12px] text-gray-500">新建帳戶</p>
                        <p className="text-lg font-bold text-emerald-600">+{authSyncResult.created}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center">
                        <p className="text-[12px] text-gray-500">已連結</p>
                        <p className="text-lg font-bold text-blue-600">🔗 {authSyncResult.linked}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center">
                        <p className="text-[12px] text-gray-500">錯誤</p>
                        <p className="text-lg font-bold text-red-600">{authSyncResult.errors}</p>
                      </div>
                    </div>
                    {authSyncResult.errorDetails && authSyncResult.errorDetails.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-red-700 mb-1">錯誤詳情:</p>
                        <div className="bg-white rounded-lg p-3 max-h-40 overflow-y-auto">
                          {authSyncResult.errorDetails.map((e: any, i: number) => (
                            <p key={i} className="text-[12px] text-red-600 font-mono">
                              {e.email}: {e.error}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-red-700">{authSyncResult.error}</p>
                )}
              </div>
            )}

            {/* Instructions */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">💡 使用說明</h3>
              <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
                <li>先在「遷移控制」分頁完成 <strong>users</strong> 資料表的 Bubble 遷移</li>
                <li>回到此分頁，點擊「查看同步狀態」確認有多少用戶未連結</li>
                <li>點擊「執行 Auth 同步」為所有未連結的用戶建立 auth 帳戶</li>
                <li>每次重新遷移 users 表後，都建議再次執行 Auth 同步</li>
                <li><strong>安全:</strong> 重複執行不會產生重複帳戶（以 email 判斷）</li>
              </ol>
            </div>
          </div>
        )}

        {/* ═══════ MAN HOUR MIGRATION VIEW ═══════ */}
        {viewMode === "man-hours" && (
          <div className="space-y-4">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#1A2035]">🕐 Man Hour 數據遷移 (OTC → Supabase)</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    從 Bubble/OTC API 遷移 Man Hour 數據到 Supabase 原生表。遷移順序：NOS Task Types → NOS Tasks → Man Hour Dates → Man Hour Tasks → FK 解析
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Batch Size:</label>
                  <input
                    type="number"
                    value={mhBatchSize}
                    onChange={(e) => setMhBatchSize(Number(e.target.value) || 5000)}
                    className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Migration Steps */}
            {[
              { key: "nos_task_types", label: "NOS Task Types", expectedCount: 31, icon: "📋" },
              { key: "nos_tasks", label: "NOS Tasks", expectedCount: 614, icon: "📝" },
              { key: "man_hour_dates", label: "Man Hour Dates", expectedCount: 12752, icon: "📅" },
              { key: "man_hour_tasks", label: "Man Hour Tasks", expectedCount: 53235, icon: "⏱️" },
              { key: "resolve_fks", label: "FK Resolution (外鍵解析)", expectedCount: 0, icon: "🔗" },
            ].map(({ key, label, expectedCount, icon }) => {
              const st = mhStatus[key];
              const percent = expectedCount > 0 ? Math.min(100, Math.round((st.upserted / expectedCount) * 100)) : st.status === "done" ? 100 : 0;
              const isAutoRunningThis = mhAutoRunning === key;
              
              return (
                <div key={key} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{icon}</span>
                      <div>
                        <h4 className="text-sm font-semibold text-[#1A2035]">{label}</h4>
                        <p className="text-[12px] text-gray-400">
                          {expectedCount > 0 ? `預期: ${expectedCount.toLocaleString()} 筆` : "執行 SQL UPDATE 語句"}
                          {st.fetched > 0 && ` | 已取得: ${st.fetched.toLocaleString()}`}
                          {st.upserted > 0 && ` | 已寫入: ${st.upserted.toLocaleString()}`}
                          {st.duration_ms > 0 && ` | 耗時: ${(st.duration_ms / 1000).toFixed(1)}s`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Status badge */}
                      {st.status === "idle" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-gray-100 text-gray-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> 待執行
                        </span>
                      )}
                      {st.status === "running" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-blue-50 text-blue-600 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> {isAutoRunningThis ? "自動執行中..." : "執行中..."}
                        </span>
                      )}
                      {st.status === "done" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-emerald-50 text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {st.hasMore ? "部分完成" : "✓ 完成"}
                        </span>
                      )}
                      {st.status === "error" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-red-50 text-red-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> 錯誤
                        </span>
                      )}
                      {/* Stop button when auto-running */}
                      {isAutoRunningThis && (
                        <button
                          onClick={stopAutoRun}
                          className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 transition font-medium"
                        >
                          ⏹ 停止
                        </button>
                      )}
                      {/* Auto-continue button (runs until done) */}
                      {!isAutoRunningThis && (st.hasMore || st.status === "idle") && (
                        <button
                          onClick={() => requireDangerConfirmation(`Man Hour 自動執行: ${label}`, () => runManHourAutoStep(key))}
                          disabled={mhRunning || st.status === "running"}
                          className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
                          title="自動連續執行直到完成"
                        >
                          🔒 🔄 自動執行
                        </button>
                      )}
                      {/* Manual single batch button */}
                      {!isAutoRunningThis && (
                        <button
                          onClick={() => requireDangerConfirmation(`Man Hour 單批執行: ${label}`, () => runManHourMigration(key))}
                          disabled={mhRunning || st.status === "running"}
                          className="text-xs bg-cyan-600 text-white px-3 py-1.5 rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
                        >
                          {st.status === "running" ? "⏳" : st.hasMore && st.status === "done" ? "🔒 ▶️ 單批" : "🔒 ▶️ 執行"}
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Progress bar */}
                  {expectedCount > 0 && (
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden relative">
                      <div
                        className={`h-3 rounded-full transition-all duration-500 ease-out ${
                          isAutoRunningThis ? "bg-gradient-to-r from-cyan-500 to-emerald-500 animate-pulse" : "bg-cyan-500"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                      {/* Percentage text inside bar */}
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-gray-700">
                        {percent}% ({st.upserted.toLocaleString()} / {expectedCount.toLocaleString()})
                      </span>
                    </div>
                  )}
                  {/* Pagination info for large tables */}
                  {st.hasMore && st.status === "done" && (
                    <p className="text-[12px] text-amber-600 mt-1">
                      ⚠️ 還有更多數據。下一批次 offset: {st.nextOffset.toLocaleString()}。點擊「🔄 自動執行」自動完成剩餘遷移。
                    </p>
                  )}
                  {/* Errors */}
                  {st.errors.length > 0 && (
                    <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2 max-h-20 overflow-y-auto">
                      {st.errors.map((e, i) => (
                        <p key={i} className="text-[12px] text-red-600 font-mono">{e}</p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Action buttons */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => requireDangerConfirmation("🚀 Man Hour 一鍵全部自動執行 (Run All Man Hour Auto)", runManHourAll)}
                disabled={mhRunning}
                className="text-xs bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-2 rounded-lg hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium shadow-sm border border-red-400"
              >
                🔒 🚀 一鍵全部自動執行
              </button>
              <div className="flex items-center gap-2">
                {mhRunning && mhAutoRunning && (
                  <button
                    onClick={stopAutoRun}
                    className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 transition font-medium"
                  >
                    ⏹ 停止全部
                  </button>
                )}
                <button
                  onClick={() => {
                    setMhStatus({
                      nos_task_types: { status: "idle", fetched: 0, upserted: 0, errors: [], hasMore: false, nextOffset: 0, duration_ms: 0 },
                      nos_tasks: { status: "idle", fetched: 0, upserted: 0, errors: [], hasMore: false, nextOffset: 0, duration_ms: 0 },
                      man_hour_dates: { status: "idle", fetched: 0, upserted: 0, errors: [], hasMore: true, nextOffset: 0, duration_ms: 0 },
                      man_hour_tasks: { status: "idle", fetched: 0, upserted: 0, errors: [], hasMore: true, nextOffset: 0, duration_ms: 0 },
                      resolve_fks: { status: "idle", fetched: 0, upserted: 0, errors: [], hasMore: false, nextOffset: 0, duration_ms: 0 },
                    });
                    addLog("[Man Hour] 🔄 Reset all migration status");
                  }}
                  disabled={mhRunning}
                  className="text-xs text-gray-500 hover:text-red-600 transition px-3 py-1.5 border border-gray-200 rounded-lg hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🔄 重置所有狀態
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-cyan-800 mb-2">💡 使用說明</h3>
              <ol className="text-xs text-cyan-700 space-y-1 list-decimal list-inside">
                <li>按順序執行：NOS Task Types → NOS Tasks → Man Hour Dates → Man Hour Tasks → FK Resolution</li>
                <li>大型表（Man Hour Dates / Tasks）會分批執行，每次 batch 預設 {mhBatchSize.toLocaleString()} 筆</li>
                <li>完成一批後如還有更多數據，會顯示「繼續」按鈕，點擊繼續下一批</li>
                <li>所有數據寫入完成後，執行「FK Resolution」解析外鍵關聯（staff_id, project_id 等）</li>
                <li><strong>安全:</strong> 使用 UPSERT + bubble_id 作為 dedup key，重複執行不會產生重複數據</li>
                <li>Edge Function 超時限制 150 秒，如果 batch 太大可以調小 Batch Size</li>
              </ol>
            </div>
          </div>
        )}

        {/* Logs (always visible at bottom) */}
        {viewMode !== "fk-audit" && logs.length > 0 && (
          <div className="bg-[#1A2035] rounded-xl p-4 mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white text-sm font-semibold">📋 執行日誌</h2>
              <button onClick={() => setLogs([])} className="text-xs text-gray-400 hover:text-white transition">清除日誌</button>
            </div>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {logs.map((log, i) => (
                <p key={i} className="text-xs text-gray-300 font-mono">{log}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Danger Confirmation Dialog */}
      <DangerConfirmDialog
        open={dangerDialogOpen}
        onConfirm={handleDangerConfirm}
        onCancel={handleDangerCancel}
        actionLabel={dangerActionLabel}
      />
    </div>
  );
}
