"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Known FK relationship map ───
// Maps table.column → target table (based on Bubble Swagger analysis)
//
// IMPORTANT: In Bubble.io, "Created By" is a SYSTEM field that ALWAYS references
// the "user" type (→ Supabase "users" table), NOT "member" (→ "staff").
// Custom fields like "Creator Member", "Member Created By", "Evaluator",
// "Approve Creator" explicitly reference "member" (→ "staff").
//
const KNOWN_FK_MAP: Record<string, Record<string, { target_table: string; target_column: string; description: string }>> = {
  staff: {
    bu: { target_table: "cost_centres", target_column: "bubble_id", description: "Business Unit → 成本中心" },
    n_team_type: { target_table: "team_types", target_column: "bubble_id", description: "團隊類型" },
  },
  users: {
    member: { target_table: "staff", target_column: "bubble_id", description: "職員關聯 (user→member)" },
    supplier: { target_table: "suppliers", target_column: "bubble_id", description: "供應商關聯 (user→supplier)" },
  },
  // ─── BWA Projects ───
  bwa_projects: {
    main_pm: { target_table: "staff", target_column: "id", description: "主 PM (member)" },
    main_designer: { target_table: "staff", target_column: "id", description: "主設計師 (member)" },
    other_pm: { target_table: "staff", target_column: "id", description: "其他 PM (member)" },
    more_pm: { target_table: "staff", target_column: "id", description: "更多 PM (member, 可能逗號分隔)" },
    customer: { target_table: "customers", target_column: "id", description: "客戶" },
    r_building: { target_table: "buildings", target_column: "id", description: "大廈" },
    // r_nos_district dropped in migration 20251058 — r_nos_district_id FK remains
    n_financial_year: { target_table: "financial_years", target_column: "bubble_id", description: "財政年度" },
    n_project_type: { target_table: "project_types", target_column: "bubble_id", description: "項目類型" },
    n_service_type: { target_table: "service_types", target_column: "bubble_id", description: "服務類型" },
    n_team_type: { target_table: "team_types", target_column: "bubble_id", description: "團隊類型" },
    cost_centre: { target_table: "cost_centres", target_column: "bubble_id", description: "成本中心" },
    pitching: { target_table: "bwa_pitchings", target_column: "id", description: "競標來源" },
    supplier: { target_table: "suppliers", target_column: "id", description: "主供應商" },
    main_contractor: { target_table: "suppliers", target_column: "id", description: "主承包商" },
    main_air_supplier: { target_table: "suppliers", target_column: "id", description: "冷氣供應商" },
    main_network_supplier: { target_table: "suppliers", target_column: "id", description: "網路供應商" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── BWF Projects ───
  bwf_projects: {
    main_pm: { target_table: "staff", target_column: "id", description: "主 PM (member)" },
    main_designer: { target_table: "staff", target_column: "id", description: "主設計師 (member)" },
    other_pm: { target_table: "staff", target_column: "id", description: "其他 PM (member)" },
    more_pm: { target_table: "staff", target_column: "id", description: "更多 PM (member, 可能逗號分隔)" },
    customer: { target_table: "customers", target_column: "id", description: "客戶" },
    r_building: { target_table: "buildings", target_column: "id", description: "大廈" },
    district: { target_table: "districts", target_column: "bubble_id", description: "地區" },
    r_district: { target_table: "districts", target_column: "bubble_id", description: "地區 (備用)" },
    n_financial_year: { target_table: "financial_years", target_column: "bubble_id", description: "財政年度" },
    n_team_type: { target_table: "team_types", target_column: "bubble_id", description: "團隊類型" },
    n_customer_type: { target_table: "client_types", target_column: "bubble_id", description: "客戶類型" },
    n_source: { target_table: "source_types", target_column: "bubble_id", description: "來源類型" },
    n_bwf_service_types: { target_table: "nos_service_type_2", target_column: "bubble_id", description: "BWF 服務類型" },
    n_major_quotes: { target_table: "bwf_major_quotes", target_column: "bubble_id", description: "主報價" },
    n_service_items: { target_table: "service_items", target_column: "bubble_id", description: "服務項目" },
    cost_center: { target_table: "cost_centres", target_column: "bubble_id", description: "成本中心" },
    bwf_pitching: { target_table: "bwf_pitchings", target_column: "id", description: "BWF 競標來源" },
    supplier: { target_table: "suppliers", target_column: "id", description: "供應商" },
    main_contractor: { target_table: "suppliers", target_column: "id", description: "主承包商" },
    factories: { target_table: "factories", target_column: "id", description: "工廠 (可能逗號分隔)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── BWA Pitchings ───
  bwa_pitchings: {
    customer: { target_table: "customers", target_column: "id", description: "客戶" },
    main_pm: { target_table: "staff", target_column: "id", description: "主 PM (member)" },
    main_designer: { target_table: "staff", target_column: "id", description: "主設計師 (member)" },
    other_pm: { target_table: "staff", target_column: "id", description: "其他 PM (member)" },
    more_pm: { target_table: "staff", target_column: "id", description: "更多 PM (member)" },
    r_building: { target_table: "buildings", target_column: "id", description: "大廈" },
    district: { target_table: "districts", target_column: "bubble_id", description: "地區 (district reference)" },
    // r_nos_district removed — duplicate of district, dropped in migration 20251057
    n_financial_year: { target_table: "financial_years", target_column: "bubble_id", description: "財政年度" },
    n_service_type: { target_table: "service_types", target_column: "bubble_id", description: "服務類型" },
    n_team_type: { target_table: "team_types", target_column: "bubble_id", description: "團隊類型" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── BWF Pitchings ───
  bwf_pitchings: {
    customer: { target_table: "customers", target_column: "id", description: "客戶" },
    main_pm: { target_table: "staff", target_column: "id", description: "主 PM (member)" },
    main_designer: { target_table: "staff", target_column: "id", description: "主設計師 (member)" },
    other_pms: { target_table: "staff", target_column: "id", description: "其他 PM (member)" },
    more_pms: { target_table: "staff", target_column: "id", description: "更多 PM (member)" },
    r_building: { target_table: "buildings", target_column: "id", description: "大廈" },
    district: { target_table: "districts", target_column: "bubble_id", description: "地區 (district reference)" },
    r_district: { target_table: "districts", target_column: "bubble_id", description: "地區 (NOS district)" },
    n_financial_year: { target_table: "financial_years", target_column: "bubble_id", description: "財政年度" },
    n_team_type: { target_table: "team_types", target_column: "bubble_id", description: "團隊類型" },
    n_customer_type: { target_table: "client_types", target_column: "bubble_id", description: "客戶類型" },
    n_source: { target_table: "source_types", target_column: "bubble_id", description: "來源類型" },
    n_bwf_service_types: { target_table: "nos_service_type_2", target_column: "bubble_id", description: "BWF 服務類型" },
    n_major_quotes: { target_table: "bwf_major_quotes", target_column: "bubble_id", description: "BWF 主報價" },
    n_service_items: { target_table: "service_items", target_column: "bubble_id", description: "服務項目" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Incomes (Bubble: income) ───
  incomes: {
    project: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    bwf_project: { target_table: "bwf_projects", target_column: "id", description: "BWF 項目" },
    approve_creator: { target_table: "staff", target_column: "bubble_id", description: "審批者 (member)" },
    n_contract_type: { target_table: "nos_contracts", target_column: "bubble_id", description: "合約類型" },
    payment_method: { target_table: "nos_payment_methods", target_column: "bubble_id", description: "付款方式" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Expenses (Bubble: expense) ───
  expenses: {
    project: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    bwf_project: { target_table: "bwf_projects", target_column: "id", description: "BWF 項目" },
    supplier: { target_table: "suppliers", target_column: "id", description: "供應商" },
    factory: { target_table: "factories", target_column: "id", description: "工廠" },
    approve_creator: { target_table: "staff", target_column: "bubble_id", description: "審批者 (member)" },
    n_contract_type: { target_table: "nos_contracts", target_column: "bubble_id", description: "合約類型" },
    n_product_types: { target_table: "product_types", target_column: "bubble_id", description: "產品類型" },
    n_supplier_type: { target_table: "supplier_types", target_column: "bubble_id", description: "供應商類型" },
    payment_method: { target_table: "nos_payment_methods", target_column: "bubble_id", description: "付款方式" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Income Invoices (Bubble: invoice) ───
  income_invoices: {
    income: { target_table: "incomes", target_column: "id", description: "收入" },
    cost_center_bu: { target_table: "cost_centres", target_column: "bubble_id", description: "成本中心 (BU)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Receipts ───
  receipts: {
    expense: { target_table: "expenses", target_column: "id", description: "支出" },
    income: { target_table: "incomes", target_column: "id", description: "收入" },
    invoices: { target_table: "income_invoices", target_column: "id", description: "發票" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Purchase Orders ───
  purchase_orders: {
    expense: { target_table: "expenses", target_column: "id", description: "支出" },
    cost_centre: { target_table: "cost_centres", target_column: "bubble_id", description: "成本中心" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── PO Sub Items ───
  po_sub_items: {
    purchase_order: { target_table: "purchase_orders", target_column: "id", description: "採購訂單" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Quotations ───
  quotations: {
    project: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    pitching: { target_table: "bwa_pitchings", target_column: "id", description: "BWA 競標" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Quotation Sections ───
  quotation_sections: {
    quotation: { target_table: "quotations", target_column: "id", description: "報價單" },
    quote: { target_table: "quotations", target_column: "id", description: "報價單 (Quote ref)" },
    r_section: { target_table: "nos_sections", target_column: "bubble_id", description: "NOS 區段" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Quotation Section Items ───
  quotation_section_items: {
    section: { target_table: "quotation_sections", target_column: "id", description: "報價區段" },
    quote: { target_table: "quotations", target_column: "id", description: "報價單 (Quote ref)" },
    item: { target_table: "nos_items", target_column: "bubble_id", description: "NOS 項目" },
    c_unit: { target_table: "nos_units", target_column: "bubble_id", description: "單位" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── BWF Orders ───
  bwf_orders: {
    bwf_project: { target_table: "bwf_projects", target_column: "id", description: "BWF 項目" },
    bwf_pitching: { target_table: "bwf_pitchings", target_column: "bubble_id", description: "BWF 競標" },
    factory: { target_table: "factories", target_column: "id", description: "工廠" },
    supplier: { target_table: "suppliers", target_column: "id", description: "供應商" },
    product: { target_table: "bwf_products", target_column: "id", description: "BWF 產品" },
    defect_factory: { target_table: "factories", target_column: "id", description: "瑕疵工廠" },
    defect_supplier: { target_table: "suppliers", target_column: "id", description: "瑕疵供應商" },
    defect_member: { target_table: "staff", target_column: "bubble_id", description: "瑕疵處理人 (member)" },
    n_defect_cause: { target_table: "nos_defect_causes", target_column: "bubble_id", description: "瑕疵原因" },
    installation_team: { target_table: "suppliers", target_column: "id", description: "安裝團隊" },
    deliver_to_factory: { target_table: "factories", target_column: "id", description: "送貨工廠" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Project Schedules (Bubble: s2schedule — actual schedule RECORDS) ───
  // Actual columns: bubble_id, bwf_project, date, is_na, main_pm, payment_schedule, project, schedule_type, working_schedule
  project_schedules: {
    project: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    bwf_project: { target_table: "bwf_projects", target_column: "id", description: "BWF 項目" },
    main_pm: { target_table: "staff", target_column: "id", description: "主 PM (member)" },
    payment_schedule: { target_table: "project_schedule_tasks", target_column: "bubble_id", description: "付款排程 (references NOS task definition)" },
    working_schedule: { target_table: "project_schedule_tasks", target_column: "bubble_id", description: "工作排程 (references NOS task definition)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Project Documents ───
  project_documents: {
    project: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    bwf_project: { target_table: "bwf_projects", target_column: "id", description: "BWF 項目" },
    pitching: { target_table: "bwa_pitchings", target_column: "id", description: "BWA 競標" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Tenders ───
  tenders: {
    project: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    pitching: { target_table: "bwa_pitchings", target_column: "id", description: "BWA 競標" },
    bwf_project: { target_table: "bwf_projects", target_column: "id", description: "BWF 項目" },
    bwf_pitching: { target_table: "bwf_pitchings", target_column: "id", description: "BWF 競標" },
    drawing_designer: { target_table: "staff", target_column: "bubble_id", description: "繪圖設計師 (member)" },
    selective_supplier: { target_table: "suppliers", target_column: "id", description: "選定供應商 (list)" },
    rejected_supplier: { target_table: "suppliers", target_column: "id", description: "拒絕供應商 (list)" },
    supplier_type: { target_table: "supplier_types", target_column: "bubble_id", description: "供應商類型" },
    project_type: { target_table: "project_types", target_column: "bubble_id", description: "項目類型" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Tender Bids ───
  tender_bids: {
    tender: { target_table: "tenders", target_column: "id", description: "投標" },
    supplier: { target_table: "suppliers", target_column: "id", description: "供應商" },
    factory: { target_table: "factories", target_column: "id", description: "工廠" },
    witness: { target_table: "staff", target_column: "bubble_id", description: "見證人 (member)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Tender Responds (Bubble: tenderrespond) ───
  tender_responds: {
    tender: { target_table: "tenders", target_column: "id", description: "投標" },
    supplier: { target_table: "suppliers", target_column: "id", description: "供應商" },
    factory: { target_table: "factories", target_column: "id", description: "工廠" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Tender Messages (Bubble: tendermessage) ───
  tender_messages: {
    tender: { target_table: "tenders", target_column: "id", description: "投標" },
    bids: { target_table: "tender_bids", target_column: "id", description: "投標出價" },
    reply_to: { target_table: "tender_messages", target_column: "id", description: "回覆訊息 (self-ref)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Pitching BV ───
  pitching_bv: {
    project: { target_table: "bwa_pitchings", target_column: "id", description: "BWA 競標" },
    pitching: { target_table: "bwa_pitchings", target_column: "bubble_id", description: "BWA 競標 (Pitching ref) → UUID: pitching_id" },
    pitching_id: { target_table: "bwa_pitchings", target_column: "id", description: "BWA 競標 (UUID FK)" },
    bwf_pitching: { target_table: "bwf_pitchings", target_column: "id", description: "BWF 競標" },
    handler: { target_table: "staff", target_column: "bubble_id", description: "處理人 (member)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Project BV ───
  project_bv: {
    project: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    bwf_project: { target_table: "bwf_projects", target_column: "id", description: "BWF 項目" },
    handler: { target_table: "staff", target_column: "bubble_id", description: "處理人 (member)" },
    n_financial_year: { target_table: "financial_years", target_column: "bubble_id", description: "財政年度" },
    n_team_type: { target_table: "team_types", target_column: "bubble_id", description: "團隊類型" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── News (Bubble: news) ───
  news: {
    nos_news_type: { target_table: "news_types", target_column: "bubble_id", description: "新聞類型" },
    liked_member: { target_table: "staff", target_column: "bubble_id", description: "點讚職員 (member, list)" },
    creator_member: { target_table: "staff", target_column: "bubble_id", description: "建立者職員 (Creator Member → member)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── News Comments (Bubble: newscomment) ───
  news_comments: {
    news: { target_table: "news", target_column: "id", description: "新聞" },
    creator_member: { target_table: "staff", target_column: "bubble_id", description: "建立者職員 (Creator Member → member)" },
    liked_member: { target_table: "staff", target_column: "bubble_id", description: "點讚職員 (member, list)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── 3D Renders ───
  three_d_renders: {
    pitching: { target_table: "bwa_pitchings", target_column: "id", description: "BWA 競標" },
    project: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    r_3d_collection: { target_table: "three_d_collections", target_column: "id", description: "3D 合集" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── 3D Collections ───
  three_d_collections: {
    collab_designer: { target_table: "staff", target_column: "bubble_id", description: "協作設計師 (member)" },
    main_designer: { target_table: "staff", target_column: "bubble_id", description: "主設計師 (member)" },
    r_pitching: { target_table: "bwa_pitchings", target_column: "id", description: "BWA 競標" },
    r_project: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    liked_staff: { target_table: "staff", target_column: "bubble_id", description: "點讚職員 (member, list)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Customers (Bubble: customer) ───
  customers: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
    member_created_by: { target_table: "staff", target_column: "bubble_id", description: "建立者職員 (Member Created By → member)" },
  },
  // ─── Customer Comments (Bubble: customercomment) ───
  customer_comments: {
    customer: { target_table: "customers", target_column: "id", description: "客戶" },
    evaluator: { target_table: "staff", target_column: "bubble_id", description: "評估者 (Evaluator → member)" },
    pitching: { target_table: "bwa_pitchings", target_column: "id", description: "BWA 競標" },
    project: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Customer Relations (Bubble: customerrelationsevent) ───
  customer_relations: {
    cr_event_detail: { target_table: "cr_event_details", target_column: "id", description: "CR 活動詳情 (list)" },
    event_theme: { target_table: "nos_cr_event_themes", target_column: "bubble_id", description: "活動主題" },
    event_type: { target_table: "nos_cr_event_types", target_column: "bubble_id", description: "活動類型" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── CR Event Details (Bubble: creventdetail) ───
  cr_event_details: {
    customer: { target_table: "customers", target_column: "bubble_id", description: "客戶" },
    event: { target_table: "customer_relations", target_column: "id", description: "CR 活動 (parent)" },
    handler: { target_table: "staff", target_column: "bubble_id", description: "處理人 (member)" },
    cust_gift_item: { target_table: "cr_gift_items", target_column: "id", description: "禮品項目" },
    delivery_method: { target_table: "nos_cr_delivery_methods", target_column: "bubble_id", description: "送遞方式" },
    related_staff: { target_table: "staff", target_column: "bubble_id", description: "相關職員 (member, list)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Suppliers ───
  // NOTE: n_type (供應商類型) resolved via junction table supplier_supplier_types
  // NOTE: supplier_tags resolved via junction table supplier_supplier_tags
  suppliers: {
    district: { target_table: "districts", target_column: "bubble_id", description: "地區" },
    n_type: { target_table: "supplier_types", target_column: "bubble_id", description: "供應商類型 (legacy — now via junction supplier_supplier_types)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Supplier Feedback (Bubble: commentfromsupplier) ───
  supplier_feedback: {
    member: { target_table: "staff", target_column: "bubble_id", description: "職員 (Member → member)" },
    supplier: { target_table: "suppliers", target_column: "id", description: "供應商" },
    tender: { target_table: "tenders", target_column: "id", description: "投標" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Staff Supplier Comments (Bubble: supplier&factorycomment) ───
  staff_supplier_comments: {
    evaluator: { target_table: "staff", target_column: "bubble_id", description: "評估者 (Evaluator → member)" },
    supplier: { target_table: "suppliers", target_column: "id", description: "供應商" },
    factory: { target_table: "factories", target_column: "id", description: "工廠" },
    project: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    bwf_project: { target_table: "bwf_projects", target_column: "id", description: "BWF 項目" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Supplier Files (Bubble: supplierfile) ───
  supplier_files: {
    supplier: { target_table: "suppliers", target_column: "id", description: "供應商" },
    type: { target_table: "supplier_file_types", target_column: "bubble_id", description: "檔案類型" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Supplier Register Forms (Bubble: supplierquestionnaire) ───
  supplier_register_forms: {
    supplier: { target_table: "suppliers", target_column: "id", description: "供應商" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Factories ───
  factories: {
    district: { target_table: "districts", target_column: "bubble_id", description: "地區" },
    n_type: { target_table: "supplier_types", target_column: "bubble_id", description: "供應商類型" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Factory Files (Bubble: factoryfile) ───
  factory_files: {
    factory: { target_table: "factories", target_column: "id", description: "工廠" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Buildings ───
  buildings: {
    district: { target_table: "districts", target_column: "bubble_id", description: "地區" },
    real_creator: { target_table: "staff", target_column: "bubble_id", description: "建立者職員 (Real_Creator → member)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Building Comments (Bubble: buildingcomment) ───
  building_comments: {
    building: { target_table: "buildings", target_column: "id", description: "大廈" },
    evaluator: { target_table: "staff", target_column: "bubble_id", description: "評估者 (Evaluator → member)" },
    pitching: { target_table: "bwa_pitchings", target_column: "id", description: "BWA 競標" },
    project: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    bwf_project: { target_table: "bwf_projects", target_column: "id", description: "BWF 項目" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Building Contacts (Bubble: buildingcontact) ───
  building_contacts: {
    building: { target_table: "buildings", target_column: "id", description: "大廈" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Building Files (Bubble: buildingfile) ───
  building_files: {
    building: { target_table: "buildings", target_column: "bubble_id", description: "大廈" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Internal Comments (Bubble: internalcomment) ───
  internal_comments: {
    bwf_pitching: { target_table: "bwf_pitchings", target_column: "bubble_id", description: "BWF 競標" },
    bwf_project: { target_table: "bwf_projects", target_column: "bubble_id", description: "BWF 項目" },
    evaluator: { target_table: "staff", target_column: "bubble_id", description: "評估者 (member)" },
    pitching: { target_table: "bwa_pitchings", target_column: "bubble_id", description: "BWA 競標" },
    project: { target_table: "bwa_projects", target_column: "bubble_id", description: "BWA 項目" },
    staff: { target_table: "staff", target_column: "bubble_id", description: "職員 (member)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Notifications (Bubble: notification) ───
  notifications: {
    bwf_project: { target_table: "bwf_projects", target_column: "id", description: "BWF 項目" },
    expense: { target_table: "expenses", target_column: "id", description: "支出" },
    income: { target_table: "incomes", target_column: "id", description: "收入" },
    pitching: { target_table: "bwa_pitchings", target_column: "id", description: "BWA 競標" },
    project: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    receiver: { target_table: "users", target_column: "bubble_id", description: "接收者 (user)" },
    sender: { target_table: "users", target_column: "bubble_id", description: "發送者 (user)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Site Statuses (Bubble: sitestatus) ───
  site_statuses: {
    project: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    pitching: { target_table: "bwa_pitchings", target_column: "id", description: "BWA 競標" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Site Status Item Quantities ───
  site_status_item_quantities: {
    item: { target_table: "nos_site_status_items", target_column: "bubble_id", description: "地盤狀態項目" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Project Weekly Reports ───
  project_weekly_reports: {
    project: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Project Initial Expenses ───
  project_initial_expenses: {
    project: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    pitching: { target_table: "bwa_pitchings", target_column: "id", description: "BWA 競標" },
    n_expense_type: { target_table: "nos_contracts", target_column: "bubble_id", description: "支出類型 (NOS)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Recurring Incomes ───
  recurring_incomes: {
    project: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    r_incomes: { target_table: "incomes", target_column: "id", description: "收入 (list)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Quotation Expenses ───
  quotation_expenses: {
    quotation: { target_table: "quotations", target_column: "id", description: "報價單" },
    pitching: { target_table: "bwa_pitchings", target_column: "id", description: "BWA 競標" },
    bwf_pitching: { target_table: "bwf_pitchings", target_column: "id", description: "BWF 競標" },
    n_expense_type: { target_table: "nos_contracts", target_column: "bubble_id", description: "支出類型 (NOS)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── AI Quotes (Bubble: aiquote) ───
  ai_quotes: {
    project: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    pitching: { target_table: "bwa_pitchings", target_column: "id", description: "BWA 競標" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── AI Quote Sub Items ───
  ai_quote_sub_items: {
    ai_quote: { target_table: "ai_quotes", target_column: "id", description: "AI 報價 (parent)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── AI Quote Sub Item Details ───
  ai_quote_sub_item_details: {
    ai_quote: { target_table: "ai_quotes", target_column: "id", description: "AI 報價 (parent)" },
    ai_quote_sub_item: { target_table: "ai_quote_sub_items", target_column: "id", description: "AI 報價子項 (parent)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── AI Quote Demo Items ───
  ai_quote_demo_items: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── BWF Products (Bubble: bwfproduct) ───
  bwf_products: {
    product_types: { target_table: "product_types", target_column: "bubble_id", description: "產品類型" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Invoice Sub Items ───
  invoice_sub_items: {
    invoice: { target_table: "income_invoices", target_column: "id", description: "發票 (parent)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Login Logs (Bubble: loginlog) ───
  login_logs: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Outstanding Remarks ───
  outstanding_remarks: {
    project: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    bwf_project: { target_table: "bwf_projects", target_column: "id", description: "BWF 項目" },
    n_contract_type: { target_table: "nos_contracts", target_column: "bubble_id", description: "合約類型" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── AP Report Remarks ───
  ap_report_remarks: {
    project: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    bwf_project: { target_table: "bwf_projects", target_column: "id", description: "BWF 項目" },
    supplier: { target_table: "suppliers", target_column: "id", description: "供應商" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Target Sales ───
  target_sales: {
    member: { target_table: "staff", target_column: "bubble_id", description: "職員 (member)" },
    financial_year: { target_table: "financial_years", target_column: "bubble_id", description: "財政年度" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Supplier Pricings ───
  supplier_pricings: {
    supplier: { target_table: "suppliers", target_column: "id", description: "供應商" },
    editor: { target_table: "staff", target_column: "bubble_id", description: "編輯者 (member)" },
    item: { target_table: "nos_items", target_column: "bubble_id", description: "NOS 項目" },
    unit: { target_table: "nos_units", target_column: "bubble_id", description: "單位" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Supplier Recent Statuses ───
  supplier_recent_statuses: {
    supplier: { target_table: "suppliers", target_column: "id", description: "供應商" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Supplier Level Roles ───
  supplier_level_roles: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Supplier Level Pass Out Dates ───
  supplier_level_pass_out_dates: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Supplier Login Codes ───
  supplier_login_codes: {
    supplier: { target_table: "suppliers", target_column: "id", description: "供應商" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── CR Gift Items ───
  cr_gift_items: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Blocked Views ───
  blocked_views: {
    blocked_member: { target_table: "staff", target_column: "bubble_id", description: "封鎖職員 (member)" },
    blocked_bu: { target_table: "cost_centres", target_column: "bubble_id", description: "封鎖業務單位 (BU)" },
    blocked_team: { target_table: "team_types", target_column: "bubble_id", description: "封鎖團隊類型" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Q Term Sections ───
  q_term_sections: {
    quote: { target_table: "quotations", target_column: "id", description: "報價單" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Q Term Section Details ───
  q_term_section_details: {
    quote: { target_table: "quotations", target_column: "id", description: "報價單" },
    term_head: { target_table: "q_term_sections", target_column: "id", description: "條款標題區段" },
    term_section: { target_table: "q_term_sections", target_column: "id", description: "條款區段 (alt)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },

  // ═══════════════════════════════════════════════════════
  // BATCH 2: Previously unmapped tables (added 2025-06-23)
  // ═══════════════════════════════════════════════════════

  // ─── Lookup Tables (NOS / Reference Data) ───
  // All lookup tables have created_by → users
  client_types: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  cost_centres: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  districts: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  financial_years: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  product_types: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  project_types: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  service_types: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  source_types: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  supplier_types: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  team_types: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  bwf_major_quotes: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  service_items: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  news_types: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_contracts: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_units: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_payment_methods: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_regions: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_customer_tags: {
    collection: { target_table: "nos_customer_tags_collection", target_column: "bubble_id", description: "標籤合集" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_customer_purpose: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_cr_event_types: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_cr_event_themes: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_cr_delivery_methods: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_defect_causes: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_bv_values: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_supplier_tags: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_tender_reject_presets: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_site_status_items: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_quote_project_types: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_sections: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_service_type_2: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_ai_quote_types: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_website_functions: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  supplier_file_types: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  supplier_rule_displays: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_templates: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  term_template_types: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  dashboard_sentences: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  // ─── Project Schedule Tasks (Bubble: noss2schedule — NOS lookup/definitions) ───
  // Actual columns: bubble_id, bwf_project_with_custom, display, is_bwa, is_bwf_ob, is_custom, is_fast_build,
  //   is_handover_date, is_start_date, os_schedule_groups, project_with_custom, sort, stage
  project_schedule_tasks: {
    os_schedule_groups: { target_table: "project_schedule_tasks", target_column: "bubble_id", description: "排程群組 (self-ref NOS group)" },
    project_with_custom: { target_table: "bwa_projects", target_column: "bubble_id", description: "BWA 項目 (with custom schedule)" },
    bwf_project_with_custom: { target_table: "bwf_projects", target_column: "bubble_id", description: "BWF 項目 (with custom schedule)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  pitching_close_reasons: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_customer_tags_collection: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },

  // ─── Tables with created_by + additional FK columns ───
  ai_prompt_by_project_types: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_items: {
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
    section: { target_table: "nos_sections", target_column: "bubble_id", description: "部門 (Section)" },
    quote_project_type: { target_table: "nos_quote_project_types", target_column: "bubble_id", description: "報價項目類型 (多對多 → junction: nos_item_quote_project_types)" },
    unit: { target_table: "nos_units", target_column: "bubble_id", description: "單位" },
  },
  nos_item_quote_project_types: {
    nos_item_id: { target_table: "nos_items", target_column: "id", description: "NOS 項目 (多對多)" },
    quote_project_type_id: { target_table: "nos_quote_project_types", target_column: "id", description: "報價項目類型 (多對多)" },
  },
  nos_template_items: {
    item: { target_table: "nos_items", target_column: "bubble_id", description: "NOS 項目" },
    template: { target_table: "nos_templates", target_column: "bubble_id", description: "模板" },
    template_section: { target_table: "nos_template_sections", target_column: "bubble_id", description: "模板區段" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  nos_template_sections: {
    section: { target_table: "nos_sections", target_column: "bubble_id", description: "NOS 區段" },
    template: { target_table: "nos_templates", target_column: "bubble_id", description: "模板" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  default_quote_details: {
    default_quote: { target_table: "default_quote_mains", target_column: "id", description: "預設報價單 (parent)" },
    default_section: { target_table: "default_quote_sections", target_column: "id", description: "預設報價區段" },
    r_item: { target_table: "nos_items", target_column: "bubble_id", description: "NOS 項目" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  default_quote_mains: {
    real_creator: { target_table: "staff", target_column: "bubble_id", description: "建立者職員 (Real_Creator → member)" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  default_quote_sections: {
    default_quote: { target_table: "default_quote_mains", target_column: "id", description: "預設報價單 (parent)" },
    r_section: { target_table: "nos_sections", target_column: "bubble_id", description: "NOS 區段" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  term_template_sections: {
    template_name: { target_table: "term_template_types", target_column: "bubble_id", description: "模板類型" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },
  term_template_section_details: {
    template_name: { target_table: "term_template_types", target_column: "bubble_id", description: "模板類型" },
    template_section: { target_table: "term_template_sections", target_column: "id", description: "模板區段" },
    term_head: { target_table: "term_template_sections", target_column: "id", description: "條款標題區段" },
    created_by: { target_table: "users", target_column: "bubble_id", description: "建立者 (Bubble Created By → user)" },
  },

  // ═══════════════════════════════════════════════════════
  // BATCH 3: Junction / Many-to-Many Tables (added 2025-07-08)
  // These are pure junction tables with UUID _id columns
  // ═══════════════════════════════════════════════════════

  // ─── BWA Pitching ↔ Project Types ───
  bwa_pitching_project_types: {
    pitching_id: { target_table: "bwa_pitchings", target_column: "id", description: "BWA 競標" },
    project_type_id: { target_table: "project_types", target_column: "id", description: "項目類型" },
  },
  // ─── BWA Pitching ↔ Service Types ───
  bwa_pitching_service_types: {
    pitching_id: { target_table: "bwa_pitchings", target_column: "id", description: "BWA 競標" },
    service_type_id: { target_table: "service_types", target_column: "id", description: "服務類型" },
  },
  // ─── BWA Project ↔ Project Types ───
  bwa_project_project_types: {
    project_id: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    project_type_id: { target_table: "project_types", target_column: "id", description: "項目類型" },
  },
  // ─── BWA Project ↔ Service Types ───
  bwa_project_service_types: {
    project_id: { target_table: "bwa_projects", target_column: "id", description: "BWA 項目" },
    service_type_id: { target_table: "service_types", target_column: "id", description: "服務類型" },
  },
  // ─── BWF Pitching ↔ BWF Service Types ───
  bwf_pitching_bwf_service_types: {
    pitching_id: { target_table: "bwf_pitchings", target_column: "id", description: "BWF 競標" },
    service_type_id: { target_table: "nos_service_type_2", target_column: "id", description: "BWF 服務類型" },
  },
  // ─── BWF Pitching ↔ Major Quotes ───
  bwf_pitching_major_quotes: {
    pitching_id: { target_table: "bwf_pitchings", target_column: "id", description: "BWF 競標" },
    major_quote_id: { target_table: "bwf_major_quotes", target_column: "id", description: "BWF 主報價" },
  },
  // ─── BWF Pitching ↔ Service Items ───
  bwf_pitching_service_items: {
    pitching_id: { target_table: "bwf_pitchings", target_column: "id", description: "BWF 競標" },
    service_item_id: { target_table: "service_items", target_column: "id", description: "服務項目" },
  },
  // ─── BWF Project ↔ BWF Service Types ───
  bwf_project_bwf_service_types: {
    project_id: { target_table: "bwf_projects", target_column: "id", description: "BWF 項目" },
    service_type_id: { target_table: "nos_service_type_2", target_column: "id", description: "BWF 服務類型" },
  },
  // ─── BWF Project ↔ Major Quotes ───
  bwf_project_major_quotes: {
    project_id: { target_table: "bwf_projects", target_column: "id", description: "BWF 項目" },
    major_quote_id: { target_table: "bwf_major_quotes", target_column: "id", description: "BWF 主報價" },
  },
  // ─── BWF Project ↔ Service Items ───
  bwf_project_service_items: {
    project_id: { target_table: "bwf_projects", target_column: "id", description: "BWF 項目" },
    service_item_id: { target_table: "service_items", target_column: "id", description: "服務項目" },
  },
  bwf_project_factories: {
    project_id: { target_table: "bwf_projects", target_column: "id", description: "BWF 項目" },
    factory_id: { target_table: "factories", target_column: "id", description: "工廠" },
  },
  bwf_project_suppliers: {
    project_id: { target_table: "bwf_projects", target_column: "id", description: "BWF 項目" },
    supplier_id: { target_table: "suppliers", target_column: "id", description: "供應商" },
  },
  bwf_product_product_types: {
    product_id: { target_table: "bwf_products", target_column: "id", description: "BWF 產品" },
    product_type_id: { target_table: "product_types", target_column: "id", description: "產品類型" },
  },
  // ─── Customer ↔ CR Events ───
  customer_cr_events: {
    customer_id: { target_table: "customers", target_column: "id", description: "客戶" },
    cr_event_id: { target_table: "customer_relations", target_column: "id", description: "客戶關係事件" },
  },
  // ─── Customer ↔ Tags ───
  customer_tags: {
    customer_id: { target_table: "customers", target_column: "id", description: "客戶" },
    tag_id: { target_table: "nos_customer_tags", target_column: "id", description: "客戶標籤" },
  },
  // ─── Expense ↔ Product Types ───
  expense_product_types: {
    expense_id: { target_table: "expenses", target_column: "id", description: "支出" },
    product_type_id: { target_table: "product_types", target_column: "id", description: "產品類型" },
  },
  // ─── CR Event Detail ↔ Staff ───
  cr_event_detail_staff: {
    cr_event_detail_id: { target_table: "cr_event_details", target_column: "id", description: "CR 活動明細" },
    staff_id: { target_table: "staff", target_column: "id", description: "職員" },
  },
  // ─── News Comment ↔ Liked Members ───
  news_comment_liked_members: {
    comment_id: { target_table: "news_comments", target_column: "id", description: "新聞評論" },
    member_id: { target_table: "staff", target_column: "id", description: "點讚職員" },
  },
  // ─── News ↔ Liked Members ───
  news_liked_members: {
    news_id: { target_table: "news", target_column: "id", description: "新聞" },
    member_id: { target_table: "staff", target_column: "id", description: "點讚職員" },
  },
  // ─── Notification ↔ Seen ───
  notification_seen: {
    notification_id: { target_table: "notifications", target_column: "id", description: "通知" },
    seen_id: { target_table: "staff", target_column: "id", description: "已讀職員" },
  },
  // ─── Tender Message ↔ Bids ───
  tender_message_bids: {
    message_id: { target_table: "tender_messages", target_column: "id", description: "投標訊息" },
    bid_id: { target_table: "tender_bids", target_column: "id", description: "投標出價" },
  },
  // ─── Tender Message ↔ Receivers ───
  tender_message_receivers: {
    message_id: { target_table: "tender_messages", target_column: "id", description: "投標訊息" },
    receiver_id: { target_table: "suppliers", target_column: "id", description: "接收供應商" },
  },
  // ─── Tender Message ↔ Seen ───
  tender_message_seen: {
    message_id: { target_table: "tender_messages", target_column: "id", description: "投標訊息" },
    seen_id: { target_table: "suppliers", target_column: "id", description: "已讀供應商" },
  },
  // ─── Tender ↔ Rejected Suppliers ───
  tender_rejected_suppliers: {
    tender_id: { target_table: "tenders", target_column: "id", description: "投標" },
    supplier_id: { target_table: "suppliers", target_column: "id", description: "被拒供應商" },
  },
  // ─── Tender ↔ Seen ───
  tender_seen: {
    tender_id: { target_table: "tenders", target_column: "id", description: "投標" },
    seen_id: { target_table: "suppliers", target_column: "id", description: "已讀供應商" },
  },
  // ─── Tender ↔ Selective Suppliers ───
  tender_selective_suppliers: {
    tender_id: { target_table: "tenders", target_column: "id", description: "投標" },
    supplier_id: { target_table: "suppliers", target_column: "id", description: "指定供應商" },
  },
  // ─── 3D Collection ↔ Liked Staff ───
  three_d_collection_liked_staff: {
    collection_id: { target_table: "three_d_collections", target_column: "id", description: "3D 合集" },
    staff_id: { target_table: "staff", target_column: "id", description: "點讚職員" },
  },
  // ─── Supplier ↔ Supplier Types (junction) ───
  supplier_supplier_types: {
    supplier_id: { target_table: "suppliers", target_column: "id", description: "供應商" },
    supplier_type_id: { target_table: "supplier_types", target_column: "id", description: "供應商類型" },
  },
  // ─── Supplier ↔ Supplier Tags (junction) ───
  supplier_supplier_tags: {
    supplier_id: { target_table: "suppliers", target_column: "id", description: "供應商" },
    supplier_tag_id: { target_table: "nos_supplier_tags", target_column: "id", description: "供應商標籤" },
  },
};

// ─── Detect bubble_id-like strings ───
// Bubble IDs are typically 18-char alphanumeric strings starting with digits
const BUBBLE_ID_REGEX = /^[0-9]{13}x[0-9]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Bubble backend admin user IDs — format: "admin_user_..." — these are valid user bubble_ids
const BUBBLE_ADMIN_USER_REGEX = /^admin_user_/;

type ColumnInfo = {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  has_unique_constraint: boolean;
  has_fk_constraint: boolean;
  fk_target_table: string | null;
  fk_target_column: string | null;
};

type TableSummary = {
  table_name: string;
  total_columns: number;
  text_columns: number;
  fk_candidate_columns: number;
  fk_mapped_columns: number;
  fk_existing_columns: number;
  columns: ColumnInfo[];
};

type FKCandidate = {
  table_name: string;
  column_name: string;
  data_type: string;
  known_target?: { target_table: string; target_column: string; description: string };
  has_existing_fk: boolean;
  fk_target_table: string | null;
  fk_target_column: string | null;
  sample_values?: string[];
  uuid_sample_values?: string[];
  value_type?: "bubble_id" | "uuid" | "mixed" | "unknown" | "empty" | "mapped";
};

type FilterMode = "all" | "fk_candidates" | "needs_fk" | "has_fk";

// Generate the UUID column name: original column name + "_id"
// e.g. main_pm → main_pm_id, customer → customer_id
function getUuidColumnName(originalColumnName: string): string {
  return `${originalColumnName}_id`;
}

export default function FKAuditPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allColumns, setAllColumns] = useState<ColumnInfo[]>([]);
  const [tableSummaries, setTableSummaries] = useState<TableSummary[]>([]);
  const [fkCandidates, setFkCandidates] = useState<FKCandidate[]>([]);
  const [samplingProgress, setSamplingProgress] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("fk_candidates");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  const [selectedTab, setSelectedTab] = useState<"overview" | "tables" | "fk_map">("overview");
  const [overviewFkFilter, setOverviewFkFilter] = useState<"all" | "has_fk" | "pending" | "unmapped">("all");
  const [overviewSearchQuery, setOverviewSearchQuery] = useState("");
  const [rowCounts, setRowCounts] = useState<Record<string, number>>({});

  // Step 3: UUID column creation state
  const [uuidColumnStatus, setUuidColumnStatus] = useState<Record<string, "exists" | "creating" | "created" | "error">>({});
  const [uuidCreationLog, setUuidCreationLog] = useState<string[]>([]);
  const [batchCreating, setBatchCreating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [step3GeneratedSQL, setStep3GeneratedSQL] = useState<string | null>(null);

  // Known FK column patterns (column names that are likely references)
  const FK_COLUMN_PATTERNS = [
    "main_pm", "main_designer", "other_pm", "more_pm", "other_pms", "more_pms",
    "customer", "supplier", "factory", "factories",
    "r_building", "r_district", "district",
    "n_financial_year", "n_project_type", "n_service_type", "n_team_type",
    "n_customer_type", "n_source", "n_bwf_service_types", "n_major_quotes", "n_service_items",
    "cost_centre", "cost_center",
    "pitching", "bwf_pitching", "project", "bwf_project",
    "main_contractor", "main_air_supplier", "main_network_supplier",
    "income", "expense", "purchase_order", "quotation", "section", "task",
    "tender", "r_3d_collection", "creator_member", "created_by", "member_created_by",
    "approve_creator", "member", "n_type",
    // Additional patterns identified from Bubble schema
    "evaluator", "building", "news",
    // Schedule / reference patterns
    "payment_schedule", "working_schedule", "schedule",
    "r_project", "r_pitching", "r_factory", "r_supplier", "r_incomes",
    "handler", "editor", "witness", "sender", "receiver",
    "blocked_member", "blocked_bu", "blocked_team",
    "collection", "event", "event_theme", "event_type",
    "delivery_method", "cust_gift_item", "related_staff",
    "defect_factory", "defect_supplier", "defect_member", "n_defect_cause",
    "installation_team", "deliver_to_factory",
    "product", "product_types", "bids", "reply_to",
    "invoice", "cost_center_bu", "template", "template_section", "template_name",
    "term_head", "term_section", "quote", "r_section", "item", "c_unit", "unit",
    "default_quote", "default_section", "r_item",
    "liked_member", "liked_staff", "nos_news_type",
    "n_expense_type", "cr_event_detail",
    "collab_designer", "staff",
    "ai_quote", "ai_quote_sub_item",
    "quote_project", "os_schedule_groups", "bwf_project_with_custom", "project_with_custom",
  ];

  // Columns that are definitely NOT FK references even though they're TEXT
  const NON_FK_COLUMNS = new Set([
    "id", "bubble_id", "slug", "created_date", "modified_date",
    "name", "display_name", "full_name", "email", "phone", "address",
    "status", "payment_status", "role", "position", "image",
    "description", "remark", "remark_t", "project_name", "project_code",
    "site_address", "size", "project_size", "os_size", "b2b_b2c",
    "asana_link", "working_folder", "branding_icon",
    "company_name", "brand_name_cn", "brand_name_en", "chinese_name",
    "sort_type", "real_level", "admin_level", "auto_level", "professional_skill",
    "fax_no", "website", "moq", "order_days", "establish_year", "join_date", "entry_date",
    "termination_date", "quote_initial", "private_phone", "work_phone",
    "contact1_chn_surname", "contact1_chn_given_name", "contact1_chn_nickname",
    "contact1_eng_surname", "contact1_eng_givenname", "contact1_eng_nickname",
    "contact1_gender", "contact1_job_title", "contact1_phone", "contact1_name_card",
    "contact2_chn_surname", "contact2_chn_given_name",
    "contact2_eng_surname", "contact2_eng_givenname",
    "contact2_gender", "contact2_job_title", "contact2_phone",
    "invoice_number", "invoice_hash", "cheque_no", "pdf_file",
    "po_number", "po_date", "quotation_no", "tender_code", "tender_name",
    "fixed_search", "project_type_search", "service_type_search",
    "x_name_district_building_site_search",
    "real_building_name", "real_customer_name", "real_customer_display_name",
    "real_district_name", "real_cost_centre", "real_creator_name", "real_customer_co_name",
    "phone_number_a", "phone_number_b", "phone_display", "tags", "supplier_tags",
    "view_system", "two_fa_code", "ip", "user_type", "special",
    "text", "code", "region", "value",
    "sort_financial_year", "n_pitching_financial_year",
    "enquiry_date", "signed_date", "start_date", "handover_date", "e_outstanding_date",
    "required_check_date", "due_date", "receive_date", "payment_date",
    "approved_date", "date", "delivery_date", "submission_date",
    "pitching_code", "pitching_name", "pitching_stages",
    "p2_code", "project_content", "project_approval", "os_project_defect",
    "closed_reason", "case_close_reason", "quote_content",
    "x_f_form_s1", "x_f_form_s2", "x_f_form_s3", "xf_site_work_insurance",
    "type_display", "rank_report", "payment_terms",
    "main_item_name", "main_item_description", "main_item_completion_date",
    "t_and_c", "signed_file", "receiver_name",
    "company_address", "contact_person", "contact_tel",
    "work_address", "contract_type",
    "quo_head", "reference_number", "l_version",
    "discount_method", "discount_type_p",
    "remark_under_section", "quote_updated_name",
    "item_name", "unit", "type", "order_no", "order_date",
    "ao_client_follow_up", "ao_design_firm_status", "ao_issue_date",
    "ao_quotation_firm_date", "ao_request_date", "ao_work_status",
    "tender_type", "project_description",
    "tender_deadline", "tender_deadline_b4_extend",
    "est_start_date", "est_end_date",
    "briefing_session_date", "briefing_session_location",
    "site_visit_date", "additional_information",
    "dropbox_link", "files", "pdf_requirement",
    "image_1", "image_2", "image_3",
    "seen_list",
    "date_remark", "outstanding_remark",
    "status_filter_value",
    "building_type", "management_company", "management_contact",
    "management_phone", "management_email",
    "fire_service_install_company", "remarks", "district_name",
    "site_photos", "send_email",
    "height_to_bs", "height_to_fc", "height_to_tc", "os_money_size", "actual_size",
    "display", "start_date", "end_date",
    "actual_start", "actual_end", "file_url",
    "converter_input_amount",
  ]);

  // ─── Fetch schema data ───
  const fetchAuditData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc("get_table_columns_audit");

      if (rpcError) {
        throw new Error(`RPC error: ${rpcError.message}`);
      }

      if (!data || !Array.isArray(data)) {
        throw new Error("No data returned from audit function");
      }

      const columns = data as ColumnInfo[];
      setAllColumns(columns);

      // Group by table
      const tableMap: Record<string, ColumnInfo[]> = {};
      for (const col of columns) {
        if (!tableMap[col.table_name]) tableMap[col.table_name] = [];
        tableMap[col.table_name].push(col);
      }

      // Build summaries
      const summaries: TableSummary[] = Object.entries(tableMap).map(([tableName, cols]) => {
        // Build a quick lookup for this table's columns
        const colMap: Record<string, ColumnInfo> = {};
        for (const c of cols) colMap[c.column_name] = c;

        const textCols = cols.filter(c => c.data_type === "text");
        // FK candidates: ALL TEXT columns not in NON_FK_COLUMNS and not bubble_id/slug
        // This ensures we catch columns containing Bubble IDs even if they're not 
        // in FK_COLUMN_PATTERNS or KNOWN_FK_MAP (they'll show as "unmapped")
        const fkCandCols = textCols.filter(c =>
          !NON_FK_COLUMNS.has(c.column_name) &&
          c.column_name !== "bubble_id"
        );
        const fkMappedCols = cols.filter(c => KNOWN_FK_MAP[tableName]?.[c.column_name]);
        // Count FK existing: for FK candidate TEXT columns, check if either the TEXT column itself 
        // OR its UUID sibling (_id) has an FK constraint.
        // This ensures the count aligns with fk_mapped_columns (which counts TEXT columns only).
        const fkExistingCols = fkMappedCols.filter(c => {
          if (c.has_fk_constraint) return true;
          const uuidSibling = colMap[`${c.column_name}_id`];
          if (uuidSibling?.has_fk_constraint) return true;
          return false;
        });

        return {
          table_name: tableName,
          total_columns: cols.length,
          text_columns: textCols.length,
          fk_candidate_columns: fkCandCols.length,
          fk_mapped_columns: fkMappedCols.length,
          fk_existing_columns: fkExistingCols.length,
          columns: cols,
        };
      }).sort((a, b) => b.fk_candidate_columns - a.fk_candidate_columns);

      setTableSummaries(summaries);

      // Build FK candidates list
      const candidates: FKCandidate[] = [];
      for (const [tableName, cols] of Object.entries(tableMap)) {
        // Build a lookup map for columns in this table to check UUID siblings
        const colLookup: Record<string, ColumnInfo> = {};
        for (const c of cols) {
          colLookup[c.column_name] = c;
        }

        for (const col of cols) {
          if (col.data_type !== "text") continue;
          if (NON_FK_COLUMNS.has(col.column_name)) continue;
          if (col.column_name === "bubble_id") continue;

          const knownTarget = KNOWN_FK_MAP[tableName]?.[col.column_name];
          const isKnownPattern = FK_COLUMN_PATTERNS.includes(col.column_name);

          // Include ALL qualifying TEXT columns as FK candidates
          // Columns in KNOWN_FK_MAP or FK_COLUMN_PATTERNS are "mapped/known"
          // Other columns will show as "unmapped" — user can investigate via sampling
          {
            // Check if the corresponding UUID column (e.g. "created_by" → "created_by_id") 
            // already has an FK constraint. The TEXT column itself won't have the FK,
            // but the UUID sibling column will.
            const uuidColName = getUuidColumnName(col.column_name);
            const uuidCol = colLookup[uuidColName];
            const hasExistingFk = col.has_fk_constraint || (uuidCol?.has_fk_constraint ?? false);
            const fkTargetTable = col.fk_target_table || uuidCol?.fk_target_table || null;
            const fkTargetColumn = col.fk_target_column || uuidCol?.fk_target_column || null;

            candidates.push({
              table_name: tableName,
              column_name: col.column_name,
              data_type: col.data_type,
              known_target: knownTarget,
              has_existing_fk: hasExistingFk,
              fk_target_table: fkTargetTable,
              fk_target_column: fkTargetColumn,
            });
          }
        }
      }

      setFkCandidates(candidates);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
    }

    setLoading(false);
  }, []);

  // ─── Sample FK candidate values ───
  const sampleFKCandidates = useCallback(async () => {
    if (fkCandidates.length === 0) return;
    setSamplingProgress("開始取樣...");

    const updated = [...fkCandidates];
    const tableColumnGroups: Record<string, string[]> = {};

    for (const c of updated) {
      if (!tableColumnGroups[c.table_name]) tableColumnGroups[c.table_name] = [];
      if (!tableColumnGroups[c.table_name].includes(c.column_name)) {
        tableColumnGroups[c.table_name].push(c.column_name);
      }
    }

    let processed = 0;
    const total = Object.keys(tableColumnGroups).length;

    for (const [tableName, columnNames] of Object.entries(tableColumnGroups)) {
      processed++;
      setSamplingProgress(`取樣中 ${processed}/${total}: ${tableName}...`);

      // For each column, query rows where that column is NOT null
      // This avoids the problem of first N rows having null FK columns
      // Also check the UUID sibling column (_id) to determine true migration status
      for (const colName of columnNames) {
        try {
          // Sample the original TEXT column
          const { data: rows } = await supabase
            .from(tableName)
            .select(colName)
            .not(colName, "is", null)
            .neq(colName, "")
            .limit(5);

          const values = ((rows || []) as unknown as Record<string, unknown>[])
            .map((r) => r[colName])
            .filter((v): v is string => typeof v === "string" && v.length > 0)
            .slice(0, 5);

          // Also sample the UUID sibling column (e.g. pitching → pitching_id)
          const uuidColName = getUuidColumnName(colName);
          let uuidValues: string[] = [];
          try {
            const { data: uuidRows, error: uuidErr } = await supabase
              .from(tableName)
              .select(uuidColName)
              .not(uuidColName, "is", null)
              .limit(5);

            if (!uuidErr && uuidRows) {
              uuidValues = (uuidRows as unknown as Record<string, unknown>[])
                .map((r) => r[uuidColName])
                .filter((v): v is string => typeof v === "string" && v.length > 0)
                .slice(0, 5);
            }
          } catch {
            // UUID sibling column might not exist — that's fine
          }

          const candidate = updated.find(
            c => c.table_name === tableName && c.column_name === colName
          );
          if (candidate) {
            candidate.sample_values = values;
            candidate.uuid_sample_values = uuidValues;

            // Determine value_type based on BOTH original TEXT and UUID sibling columns
            const hasUuidSiblingData = uuidValues.length > 0 && uuidValues.some(v => UUID_REGEX.test(v));

            if (hasUuidSiblingData) {
              // UUID sibling column has valid UUID data → migration is complete
              // Check if the TEXT column still has bubble IDs (normal after migration)
              const bubbleCount = values.filter(v => BUBBLE_ID_REGEX.test(v) || BUBBLE_ADMIN_USER_REGEX.test(v)).length;
              if (bubbleCount > 0) {
                // TEXT has bubble IDs but UUID _id column is populated → mapped successfully
                candidate.value_type = "mapped";
              } else {
                // Both columns have UUIDs (or TEXT is also UUID)
                candidate.value_type = "uuid";
              }
            } else if (values.length === 0 && uuidValues.length === 0) {
              candidate.value_type = "empty";
            } else {
              // No UUID sibling data — classify based on original TEXT column only
              const bubbleCount = values.filter(v => BUBBLE_ID_REGEX.test(v) || BUBBLE_ADMIN_USER_REGEX.test(v)).length;
              const uuidCount = values.filter(v => UUID_REGEX.test(v)).length;

              if (bubbleCount > 0 && uuidCount === 0) candidate.value_type = "bubble_id";
              else if (uuidCount > 0 && bubbleCount === 0) candidate.value_type = "uuid";
              else if (bubbleCount > 0 && uuidCount > 0) candidate.value_type = "mixed";
              else candidate.value_type = "unknown";
            }
          }
        } catch {
          // Skip columns that can't be queried
        }
      }
    }

    setFkCandidates(updated);
    setSamplingProgress(null);
  }, [fkCandidates]);

  // ─── Fetch row counts for all tables ───
  const fetchRowCounts = useCallback(async () => {
    const counts: Record<string, number> = {};
    const tableNames = Array.from(new Set(tableSummaries.map(t => t.table_name)));

    for (const tn of tableNames) {
      try {
        const { count } = await supabase.from(tn).select("*", { count: "exact", head: true });
        counts[tn] = count || 0;
      } catch {
        counts[tn] = -1;
      }
    }
    setRowCounts(counts);
  }, [tableSummaries]);

  // ─── Step 3: Check if UUID columns already exist ───
  const checkUuidColumnsExist = useCallback(async () => {
    const mappedCandidates = fkCandidates.filter(c => c.known_target);
    if (mappedCandidates.length === 0) return;

    // Query information_schema to check which columns already exist
    const { data, error: queryErr } = await supabase.rpc("get_table_columns_audit");
    if (queryErr || !data) return;

    const existingCols = new Set(
      (data as ColumnInfo[]).map(c => `${c.table_name}.${c.column_name}`)
    );

    // Merge with existing state instead of replacing — preserves "created"/"creating"/"error" 
    // entries for columns not yet visible in RPC response (e.g. due to timing)
    setUuidColumnStatus(prev => {
      const merged: Record<string, "exists" | "creating" | "created" | "error"> = { ...prev };
      for (const c of mappedCandidates) {
        const uuidColName = getUuidColumnName(c.column_name);
        const key = `${c.table_name}.${c.column_name}`;
        if (existingCols.has(`${c.table_name}.${uuidColName}`)) {
          // Column confirmed in DB — upgrade to "exists"
          merged[key] = "exists";
        }
        // If not found in DB, keep whatever status was already there ("created", "error", etc.)
        // Don't overwrite with undefined/missing
      }
      return merged;
    });
  }, [fkCandidates]);

  // ─── Step 3: Create a single UUID column ───
  const createSingleUuidColumn = useCallback(async (tableName: string, columnName: string) => {
    const key = `${tableName}.${columnName}`;
    const uuidColName = getUuidColumnName(columnName);

    setUuidColumnStatus(prev => ({ ...prev, [key]: "creating" }));

    try {
      const sql = `ALTER TABLE public."${tableName}" ADD COLUMN IF NOT EXISTS "${uuidColName}" UUID;`;
      const { error: execErr } = await supabase.rpc("exec_sql", { query: sql });

      if (execErr) {
        // Try direct approach if RPC not available
        throw new Error(execErr.message);
      }

      setUuidColumnStatus(prev => ({ ...prev, [key]: "created" }));
      setUuidCreationLog(prev => [...prev, `✅ ${tableName}.${uuidColName} — 已建立`]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setUuidColumnStatus(prev => ({ ...prev, [key]: "error" }));
      setUuidCreationLog(prev => [...prev, `❌ ${tableName}.${uuidColName} — 錯誤: ${errMsg}`]);
    }
  }, []);

  // ─── Step 3: Batch create all UUID columns ───
  const batchCreateUuidColumns = useCallback(async () => {
    const mappedCandidates = fkCandidates.filter(c => c.known_target);
    const toCreate = mappedCandidates.filter(c => {
      const key = `${c.table_name}.${c.column_name}`;
      return uuidColumnStatus[key] !== "exists" && uuidColumnStatus[key] !== "created";
    });

    if (toCreate.length === 0) {
      setUuidCreationLog(prev => [...prev, "🎉 所有 UUID 欄位已存在，無需建立！"]);
      return;
    }

    setBatchCreating(true);
    setUuidCreationLog([`🚀 開始批量建立 ${toCreate.length} 個 UUID 欄位...`]);

    for (let i = 0; i < toCreate.length; i++) {
      const c = toCreate[i];
      setBatchProgress(`${i + 1}/${toCreate.length}: ${c.table_name}.${getUuidColumnName(c.column_name)}`);
      await createSingleUuidColumn(c.table_name, c.column_name);
    }

    setBatchProgress(null);
    setBatchCreating(false);
    setUuidCreationLog(prev => [...prev, `\n📊 完成！共處理 ${toCreate.length} 個欄位`]);

    // Notify PostgREST to reload its schema cache so new columns are visible
    try {
      await supabase.rpc("exec_sql", { query: "NOTIFY pgrst, 'reload schema';" });
    } catch {
      // Non-critical — schema cache will eventually refresh
    }

    // Small delay to allow schema cache refresh to propagate
    await new Promise(resolve => setTimeout(resolve, 500));

    // Reload audit data first (refreshes fkCandidates with new column data from pg_catalog)
    await fetchAuditData();
    // Then re-check UUID column existence status
    await checkUuidColumnsExist();
  }, [fkCandidates, uuidColumnStatus, createSingleUuidColumn, checkUuidColumnsExist, fetchAuditData]);

  // ─── Step 3: Generate SQL preview (no execution) ───
  const generateStep3SQL = useCallback(() => {
    const mappedCandidates = fkCandidates.filter(c => c.known_target);
    const toCreate = mappedCandidates.filter(c => {
      const key = `${c.table_name}.${c.column_name}`;
      return uuidColumnStatus[key] !== "exists" && uuidColumnStatus[key] !== "created";
    });

    if (toCreate.length === 0) {
      setStep3GeneratedSQL("-- 🎉 所有 UUID FK 欄位已存在，無需建立！");
      return;
    }

    // Group by table for cleaner SQL
    const byTable: Record<string, typeof toCreate> = {};
    for (const c of toCreate) {
      if (!byTable[c.table_name]) byTable[c.table_name] = [];
      byTable[c.table_name].push(c);
    }

    let sql = `-- ═══════════════════════════════════════════════════════\n`;
    sql += `-- Step 3: 新增 UUID FK 欄位\n`;
    sql += `-- 共 ${toCreate.length} 個欄位跨 ${Object.keys(byTable).length} 張表\n`;
    sql += `-- 命名規則: 原始欄位名稱 + _id (e.g. main_pm → main_pm_id)\n`;
    sql += `-- ═══════════════════════════════════════════════════════\n\n`;

    for (const [tableName, cols] of Object.entries(byTable)) {
      sql += `-- ${tableName}\n`;
      for (const c of cols) {
        const uuidColName = getUuidColumnName(c.column_name);
        const desc = c.known_target?.description || "";
        sql += `ALTER TABLE public."${tableName}" ADD COLUMN IF NOT EXISTS "${uuidColName}" UUID; -- ${c.column_name} → ${c.known_target?.target_table}.${c.known_target?.target_column} (${desc})\n`;
      }
      sql += `\n`;
    }

    setStep3GeneratedSQL(sql);
  }, [fkCandidates, uuidColumnStatus]);

  useEffect(() => {
    fetchAuditData();
  }, [fetchAuditData]);

  useEffect(() => {
    if (tableSummaries.length > 0) {
      fetchRowCounts();
    }
  }, [tableSummaries, fetchRowCounts]);

  // Check UUID column existence after FK candidates are loaded
  useEffect(() => {
    if (fkCandidates.length > 0) {
      checkUuidColumnsExist();
    }
  }, [fkCandidates, checkUuidColumnsExist]);

  // ─── Computed stats ───
  const stats = useMemo(() => {
    const totalTables = tableSummaries.length;
    const totalColumns = allColumns.length;
    const totalTextColumns = allColumns.filter(c => c.data_type === "text").length;
    const totalFkCandidates = fkCandidates.length;
    const totalMapped = fkCandidates.filter(c => c.known_target).length;
    const totalExistingFk = fkCandidates.filter(c => c.has_existing_fk).length;
    const totalNeedsFk = totalMapped - totalExistingFk;

    const byValueType = {
      bubble_id: fkCandidates.filter(c => c.value_type === "bubble_id").length,
      uuid: fkCandidates.filter(c => c.value_type === "uuid").length,
      mapped: fkCandidates.filter(c => c.value_type === "mapped").length,
      mixed: fkCandidates.filter(c => c.value_type === "mixed").length,
      unknown: fkCandidates.filter(c => c.value_type === "unknown").length,
      empty: fkCandidates.filter(c => c.value_type === "empty").length,
      unsampled: fkCandidates.filter(c => !c.value_type).length,
    };

    const tablesWithFkCandidates = tableSummaries.filter(t => t.fk_candidate_columns > 0).length;

    // Step 3 stats
    const mappedCandidates = fkCandidates.filter(c => c.known_target);
    const uuidColExists = mappedCandidates.filter(c => uuidColumnStatus[`${c.table_name}.${c.column_name}`] === "exists" || uuidColumnStatus[`${c.table_name}.${c.column_name}`] === "created").length;
    const uuidColPending = mappedCandidates.length - uuidColExists;

    return {
      totalTables,
      totalColumns,
      totalTextColumns,
      totalFkCandidates,
      totalMapped,
      totalExistingFk,
      totalNeedsFk,
      byValueType,
      tablesWithFkCandidates,
      uuidColExists,
      uuidColPending,
    };
  }, [tableSummaries, fkCandidates, allColumns, uuidColumnStatus]);

  // ─── Filtered tables ───
  const filteredTables = useMemo(() => {
    let filtered = tableSummaries;
    if (filterMode === "fk_candidates") {
      filtered = filtered.filter(t => t.fk_candidate_columns > 0);
    } else if (filterMode === "needs_fk") {
      filtered = filtered.filter(t =>
        t.fk_mapped_columns > 0 && t.fk_existing_columns < t.fk_mapped_columns
      );
    } else if (filterMode === "has_fk") {
      filtered = filtered.filter(t => t.fk_existing_columns > 0);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.table_name.toLowerCase().includes(q) ||
        t.columns.some(c => c.column_name.toLowerCase().includes(q))
      );
    }

    return filtered;
  }, [tableSummaries, filterMode, searchQuery]);

  // ─── Overview merged FK list with filter ───
  const overviewFilteredCandidates = useMemo(() => {
    let filtered = fkCandidates;

    // Apply FK status filter
    if (overviewFkFilter === "has_fk") {
      filtered = filtered.filter(c => c.has_existing_fk);
    } else if (overviewFkFilter === "pending") {
      filtered = filtered.filter(c => c.known_target && !c.has_existing_fk);
    } else if (overviewFkFilter === "unmapped") {
      filtered = filtered.filter(c => !c.known_target && !c.has_existing_fk);
    }

    // Apply search
    if (overviewSearchQuery) {
      const q = overviewSearchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.table_name.toLowerCase().includes(q) ||
        c.column_name.toLowerCase().includes(q) ||
        (c.known_target?.target_table || "").toLowerCase().includes(q) ||
        (c.known_target?.description || "").toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [fkCandidates, overviewFkFilter, overviewSearchQuery]);

  const toggleTable = (tableName: string) => {
    setExpandedTables(prev => ({ ...prev, [tableName]: !prev[tableName] }));
  };

  const getValueTypeBadge = (vt?: string) => {
    switch (vt) {
      case "bubble_id":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-orange-100 text-orange-700 border border-orange-200">🔶 Bubble ID</span>;
      case "uuid":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-blue-100 text-blue-700 border border-blue-200">🔷 UUID</span>;
      case "mapped":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">✅ 已映射 UUID</span>;
      case "mixed":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-purple-100 text-purple-700 border border-purple-200">⚠️ 混合</span>;
      case "unknown":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-gray-100 text-gray-700 border border-gray-200">❓ 未知格式</span>;
      case "empty":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-gray-50 text-gray-400 border border-gray-200">— 全部為空</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-yellow-50 text-yellow-600 border border-yellow-200">🔍 未取樣</span>;
    }
  };

  const getFkStatusBadge = (candidate: FKCandidate) => {
    if (candidate.has_existing_fk) {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">✅ 已設置 FK</span>;
    }
    if (candidate.known_target) {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-amber-100 text-amber-700 border border-amber-200">🔧 待設置</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-red-100 text-red-600 border border-red-200">❓ 未映射</span>;
  };

  if (loading) {
    return (
      <div className="h-screen overflow-y-auto bg-[#F5F6FA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-gray-500 mt-3">正在載入資料庫結構...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen overflow-y-auto bg-[#F5F6FA] flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6 max-w-lg">
          <h2 className="text-lg font-bold text-red-700 mb-2">❌ 錯誤</h2>
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={fetchAuditData}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition"
          >
            重試
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-[#F5F6FA]">
      {/* Header */}
      <div className="bg-[#1A2035] text-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                🔗 FK 審計面板 — 外鍵設置狀態
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Foreign Key Audit Dashboard · Step 1 & 2: 審計 TEXT 欄位 + UUID FK 欄位規劃
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/admin/migration"
                className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition"
              >
                ← 返回遷移控制台
              </a>
              <button
                onClick={fetchAuditData}
                className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition"
              >
                🔄 重新載入
              </button>
            </div>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-6">
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-gray-400 text-[12px] uppercase tracking-wider">總資料表</p>
              <p className="text-2xl font-bold mt-1">{stats.totalTables}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-gray-400 text-[12px] uppercase tracking-wider">總欄位數</p>
              <p className="text-2xl font-bold mt-1">{stats.totalColumns.toLocaleString()}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-gray-400 text-[12px] uppercase tracking-wider">TEXT 欄位</p>
              <p className="text-2xl font-bold mt-1">{stats.totalTextColumns}</p>
            </div>
            <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
              <p className="text-amber-400 text-[12px] uppercase tracking-wider">FK 候選欄位</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{stats.totalFkCandidates}</p>
            </div>
            <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20">
              <p className="text-blue-400 text-[12px] uppercase tracking-wider">已映射目標</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{stats.totalMapped}</p>
            </div>
            <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
              <p className="text-emerald-400 text-[12px] uppercase tracking-wider">已有 FK</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.totalExistingFk}</p>
            </div>
            <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/20">
              <p className="text-red-400 text-[12px] uppercase tracking-wider">待設置 FK</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{stats.totalNeedsFk}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-400">FK 設置進度</span>
              <span className="text-white font-medium">
                {stats.totalMapped > 0 ? Math.round((stats.totalExistingFk / stats.totalMapped) * 100) : 0}%
                ({stats.totalExistingFk}/{stats.totalMapped})
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-3 rounded-full transition-all duration-700"
                style={{
                  width: `${stats.totalMapped > 0 ? Math.round((stats.totalExistingFk / stats.totalMapped) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-1">
          {(["overview", "tables", "fk_map"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                selectedTab === tab
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "overview" ? "📊 總覽" : tab === "tables" ? "📋 所有表格" : "🔗 FK 關係圖"}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* ═══════ OVERVIEW TAB ═══════ */}
        {selectedTab === "overview" && (
          <div className="space-y-6">
            {/* Value Type Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-[#1A2035]">🔍 FK 候選欄位值類型分佈</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    取樣 FK 候選欄位及其 UUID 對應欄位 (_id)，判斷映射狀態
                  </p>
                </div>
                <button
                  onClick={sampleFKCandidates}
                  disabled={!!samplingProgress}
                  className="text-xs bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition font-medium"
                >
                  {samplingProgress || "📡 取樣所有 FK 候選欄位"}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                  <p className="text-[12px] text-emerald-600 uppercase font-medium">✅ 已映射 UUID</p>
                  <p className="text-xl font-bold text-emerald-700 mt-1">{stats.byValueType.mapped}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-[12px] text-blue-600 uppercase font-medium">🔷 UUID</p>
                  <p className="text-xl font-bold text-blue-700 mt-1">{stats.byValueType.uuid}</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                  <p className="text-[12px] text-orange-600 uppercase font-medium">🔶 Bubble ID</p>
                  <p className="text-xl font-bold text-orange-700 mt-1">{stats.byValueType.bubble_id}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                  <p className="text-[12px] text-purple-600 uppercase font-medium">⚠️ 混合</p>
                  <p className="text-xl font-bold text-purple-700 mt-1">{stats.byValueType.mixed}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-[12px] text-gray-500 uppercase font-medium">❓ 未知格式</p>
                  <p className="text-xl font-bold text-gray-700 mt-1">{stats.byValueType.unknown}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-[12px] text-gray-400 uppercase font-medium">— 空值</p>
                  <p className="text-xl font-bold text-gray-500 mt-1">{stats.byValueType.empty}</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                  <p className="text-[12px] text-yellow-600 uppercase font-medium">🔍 未取樣</p>
                  <p className="text-xl font-bold text-yellow-700 mt-1">{stats.byValueType.unsampled}</p>
                </div>
              </div>
            </div>

            {/* Merged FK Candidates List with Status Filter + Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-[#1A2035]">
                    🔗 所有 FK 候選欄位
                    <span className="ml-2 text-sm font-normal text-gray-400">
                      ({overviewFilteredCandidates.length} / {fkCandidates.length} 個)
                    </span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    合併顯示已設置、待設置及未映射的 FK 候選欄位 — 可直接操作建立 UUID 欄位
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* UUID progress indicator */}
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-gray-500">
                      UUID 欄位: {stats.uuidColExists}/{stats.totalMapped}
                    </span>
                    <div className="w-20 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${stats.totalMapped > 0 ? Math.round((stats.uuidColExists / stats.totalMapped) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="搜尋表名 / 欄位名 / 目標表..."
                    value={overviewSearchQuery}
                    onChange={e => setOverviewSearchQuery(e.target.value)}
                    className="max-w-xs border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* FK Status Filter Tabs + Action Buttons Row */}
              <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                <div className="flex gap-1 bg-gray-50 rounded-lg border border-gray-200 p-0.5">
                  {([
                    { key: "all" as const, label: "全部", count: fkCandidates.length, color: "blue" },
                    { key: "has_fk" as const, label: "✅ 已設置 FK", count: fkCandidates.filter(c => c.has_existing_fk).length, color: "emerald" },
                    { key: "pending" as const, label: "🔧 待設置", count: fkCandidates.filter(c => c.known_target && !c.has_existing_fk).length, color: "amber" },
                    { key: "unmapped" as const, label: "❓ 未映射", count: fkCandidates.filter(c => !c.known_target && !c.has_existing_fk).length, color: "red" },
                  ]).map(f => (
                    <button
                      key={f.key}
                      onClick={() => setOverviewFkFilter(f.key)}
                      className={`px-3 py-1.5 text-xs rounded-md transition flex items-center gap-1.5 ${
                        overviewFkFilter === f.key
                          ? f.color === "emerald" ? "bg-emerald-500 text-white"
                          : f.color === "amber" ? "bg-amber-500 text-white"
                          : f.color === "red" ? "bg-red-500 text-white"
                          : "bg-blue-500 text-white"
                          : "text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {f.label}
                      <span className={`text-[12px] font-bold rounded-full px-1.5 py-0.5 ${
                        overviewFkFilter === f.key
                          ? "bg-white/20 text-white"
                          : "bg-gray-200 text-gray-600"
                      }`}>
                        {f.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Step 3 Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={generateStep3SQL}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[13px] font-medium transition border border-gray-200"
                  >
                    📝 預覽 SQL
                  </button>
                  <button
                    onClick={batchCreateUuidColumns}
                    disabled={batchCreating || stats.uuidColPending === 0}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-[13px] font-medium transition"
                  >
                    {batchCreating
                      ? `⏳ ${batchProgress || "建立中..."}`
                      : stats.uuidColPending === 0
                      ? "✅ 全部已建立"
                      : `🚀 批量建立 ${stats.uuidColPending} 個 UUID 欄位`}
                  </button>
                  <button
                    onClick={async () => {
                      setUuidCreationLog([]);
                      try { await supabase.rpc("exec_sql", { query: "NOTIFY pgrst, 'reload schema';" }); } catch {}
                      await new Promise(r => setTimeout(r, 300));
                      await fetchAuditData();
                      await checkUuidColumnsExist();
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-500 rounded-lg text-[13px] font-medium transition border border-gray-200"
                  >
                    🔄 重新檢測
                  </button>
                </div>
              </div>

              {/* SQL Preview (inline) */}
              {step3GeneratedSQL && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-medium text-gray-500">📝 SQL 預覽</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(step3GeneratedSQL);
                        }}
                        className="text-[12px] text-blue-500 hover:text-blue-700 transition"
                      >
                        📋 複製 SQL
                      </button>
                      <button
                        onClick={() => setStep3GeneratedSQL(null)}
                        className="text-[12px] text-gray-400 hover:text-gray-600 transition"
                      >
                        ✕ 關閉
                      </button>
                    </div>
                  </div>
                  <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-[13px] font-mono overflow-x-auto max-h-[250px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {step3GeneratedSQL}
                  </pre>
                </div>
              )}

              {/* Creation Log (inline) */}
              {uuidCreationLog.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-medium text-gray-500">📋 執行日誌</h3>
                    <button
                      onClick={() => setUuidCreationLog([])}
                      className="text-[12px] text-gray-400 hover:text-gray-600 transition"
                    >
                      ✕ 清除
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-[150px] overflow-y-auto">
                    {uuidCreationLog.map((log, i) => (
                      <p key={i} className="text-[13px] font-mono text-gray-600 leading-relaxed">
                        {log}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {overviewFilteredCandidates.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {overviewSearchQuery ? `找不到符合「${overviewSearchQuery}」的結果` : "此分類下沒有 FK 候選欄位"}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="px-3 py-2 text-gray-500 font-medium">資料表</th>
                        <th className="px-3 py-2 text-gray-500 font-medium">欄位名稱</th>
                        <th className="px-3 py-2 text-gray-500 font-medium">UUID 欄位</th>
                        <th className="px-3 py-2 text-gray-500 font-medium">目標表</th>
                        <th className="px-3 py-2 text-gray-500 font-medium">目標欄位</th>
                        <th className="px-3 py-2 text-gray-500 font-medium">說明</th>
                        <th className="px-3 py-2 text-gray-500 font-medium">值類型</th>
                        <th className="px-3 py-2 text-gray-500 font-medium">FK 狀態</th>
                        <th className="px-3 py-2 text-gray-500 font-medium">範例值</th>
                        <th className="px-3 py-2 text-gray-500 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overviewFilteredCandidates.map((c, idx) => {
                        const rowKey = `${c.table_name}.${c.column_name}`;
                        const rowUuidStatus = uuidColumnStatus[rowKey];
                        const rowUuidColName = getUuidColumnName(c.column_name);

                        return (
                        <tr
                          key={rowKey}
                          className={`border-b border-gray-50 hover:bg-gray-50 transition ${
                            c.has_existing_fk
                              ? "bg-emerald-50/20"
                              : c.known_target
                              ? idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                              : "bg-red-50/10"
                          }`}
                        >
                          <td className="px-3 py-2">
                            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-medium">
                              {c.table_name}
                            </code>
                          </td>
                          <td className="px-3 py-2">
                            <code className={`px-1.5 py-0.5 rounded font-medium ${
                              c.has_existing_fk
                                ? "bg-emerald-50 text-emerald-700"
                                : c.known_target
                                ? "bg-blue-50 text-blue-700"
                                : "bg-red-50 text-red-600"
                            }`}>
                              {c.column_name}
                            </code>
                          </td>
                          <td className="px-3 py-2">
                            {(() => {
                              if (rowUuidStatus === "exists" || rowUuidStatus === "created") {
                                return (
                                  <span className="inline-flex items-center gap-1">
                                    <code className="bg-emerald-50 px-1.5 py-0.5 rounded text-emerald-700 text-[12px] font-bold">{rowUuidColName}</code>
                                    <span className="text-emerald-500 text-[12px]">✅</span>
                                  </span>
                                );
                              }
                              if (c.known_target) {
                                return (
                                  <span className="inline-flex items-center gap-1">
                                    <code className="bg-amber-50 px-1.5 py-0.5 rounded text-amber-600 text-[12px]">{rowUuidColName}</code>
                                    <span className="text-amber-400 text-[12px]">🔧</span>
                                  </span>
                                );
                              }
                              return <span className="text-gray-300">—</span>;
                            })()}
                          </td>
                          <td className="px-3 py-2">
                            {c.known_target ? (
                              <code className="bg-emerald-50 px-1.5 py-0.5 rounded text-emerald-700">
                                {c.known_target.target_table}
                              </code>
                            ) : (
                              <span className="text-gray-300 italic text-[12px]">未映射</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {c.known_target ? (
                              <code className="bg-emerald-50 px-1.5 py-0.5 rounded text-emerald-600">
                                {c.known_target.target_column}
                              </code>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-500">
                            {c.known_target?.description || "—"}
                          </td>
                          <td className="px-3 py-2">{getValueTypeBadge(c.value_type)}</td>
                          <td className="px-3 py-2">{getFkStatusBadge(c)}</td>
                          <td className="px-3 py-2 max-w-[200px]">
                            {c.uuid_sample_values && c.uuid_sample_values.length > 0 ? (
                              <div className="truncate text-[12px] text-emerald-600 font-mono" title={`_id: ${c.uuid_sample_values[0]}`}>
                                _id: {c.uuid_sample_values[0]?.substring(0, 30)}...
                              </div>
                            ) : c.sample_values && c.sample_values.length > 0 ? (
                              <div className="truncate text-[12px] text-gray-500 font-mono" title={c.sample_values[0]}>
                                {c.sample_values[0]?.substring(0, 30)}...
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {c.known_target && !c.has_existing_fk ? (
                              rowUuidStatus === "exists" || rowUuidStatus === "created" ? (
                                <span className="text-emerald-500 text-[12px]">✅</span>
                              ) : rowUuidStatus === "creating" ? (
                                <span className="text-blue-500 text-[12px]">⏳</span>
                              ) : rowUuidStatus === "error" ? (
                                <button
                                  onClick={() => createSingleUuidColumn(c.table_name, c.column_name)}
                                  className="px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded text-[12px] font-medium transition"
                                >
                                  🔄 重試
                                </button>
                              ) : (
                                <button
                                  onClick={() => createSingleUuidColumn(c.table_name, c.column_name)}
                                  className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[12px] font-medium transition"
                                >
                                  ➕ 建立
                                </button>
                              )
                            ) : c.has_existing_fk ? (
                              <span className="text-emerald-500 text-[12px]">✅ FK</span>
                            ) : (
                              <span className="text-gray-300 text-[12px]">—</span>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Action Plan (compact) */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">📋 FK 設置行動計劃</h3>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-amber-700">
                <span><span className="text-emerald-600 font-bold">✅ Step 1</span> 審計 TEXT 欄位 — <strong>已完成</strong> ({stats.totalFkCandidates} 個)</span>
                <span><span className="text-blue-600 font-bold">🔷 Step 2</span> 映射目標表 — <strong>{stats.totalMapped} 個已映射</strong></span>
                <span><span className={`font-bold ${stats.uuidColPending === 0 ? "text-emerald-600" : "text-amber-600"}`}>{stats.uuidColPending === 0 ? "✅" : "⏳"} Step 3</span> UUID 欄位 — <strong>{stats.uuidColExists} 已建立{stats.uuidColPending > 0 ? `, ${stats.uuidColPending} 待建立` : ""}</strong> ↑上方操作</span>
                <span><span className="text-gray-500 font-bold">⏳ Step 4</span> 映射遷移 — 待執行</span>
                <span><span className="text-gray-500 font-bold">⏳ Step 5</span> FK 約束 — 待執行</span>
                <span><span className="text-gray-500 font-bold">⏳ Step 6</span> 更新 data-service — 待執行</span>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ TABLES TAB ═══════ */}
        {selectedTab === "tables" && (
          <div>
            {/* Filters */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-0.5">
                {[
                  { key: "all" as FilterMode, label: "全部" },
                  { key: "fk_candidates" as FilterMode, label: "有 FK 候選" },
                  { key: "needs_fk" as FilterMode, label: "待設置" },
                  { key: "has_fk" as FilterMode, label: "已有 FK" },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilterMode(f.key)}
                    className={`px-3 py-1.5 text-xs rounded-md transition ${
                      filterMode === f.key
                        ? "bg-blue-500 text-white"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="搜尋表名或欄位名..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 max-w-xs border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-400">
                顯示 {filteredTables.length} / {tableSummaries.length} 表
              </span>
            </div>

            {/* Table Cards */}
            <div className="space-y-3">
              {filteredTables.map(table => {
                const isExpanded = expandedTables[table.table_name];
                const tableFkCandidates = fkCandidates.filter(
                  c => c.table_name === table.table_name
                );
                const rows = rowCounts[table.table_name] ?? -1;

                return (
                  <div
                    key={table.table_name}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                  >
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-50/50 transition"
                      onClick={() => toggleTable(table.table_name)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-1.5 h-8 rounded-full ${
                              table.fk_existing_columns > 0
                                ? "bg-emerald-500"
                                : table.fk_candidate_columns > 0
                                ? "bg-amber-500"
                                : "bg-gray-300"
                            }`}
                          />
                          <div>
                            <h3 className="font-semibold text-[#1A2035] text-sm">
                              {table.table_name}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[12px] text-gray-400">
                                {table.total_columns} 欄位
                              </span>
                              <span className="text-[12px] text-gray-400">
                                · {table.text_columns} TEXT
                              </span>
                              {table.fk_candidate_columns > 0 && (
                                <span className="text-[12px] text-amber-600 font-medium">
                                  · 🔗 {table.fk_candidate_columns} FK 候選
                                </span>
                              )}
                              {table.fk_mapped_columns > 0 && (
                                <span className="text-[12px] text-blue-600 font-medium">
                                  · 📌 {table.fk_mapped_columns} 已映射
                                </span>
                              )}
                              {table.fk_existing_columns > 0 && (
                                <span className="text-[12px] text-emerald-600 font-medium">
                                  · ✅ {table.fk_existing_columns} FK
                                </span>
                              )}
                              {rows >= 0 && (
                                <span className="text-[12px] text-gray-400 font-mono">
                                  · {rows.toLocaleString()} rows
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="text-gray-400 text-xs">{isExpanded ? "▼" : "▶"}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 pb-3">
                        {/* All columns */}
                        <div className="mt-3">
                          <table className="w-full text-[13px]">
                            <thead>
                              <tr className="text-left text-gray-400 border-b border-gray-100">
                                <th className="px-2 py-1.5 font-medium">欄位名稱</th>
                                <th className="px-2 py-1.5 font-medium">類型</th>
                                <th className="px-2 py-1.5 font-medium">可空</th>
                                <th className="px-2 py-1.5 font-medium">唯一</th>
                                <th className="px-2 py-1.5 font-medium">FK 目標</th>
                                <th className="px-2 py-1.5 font-medium">FK 狀態</th>
                              </tr>
                            </thead>
                            <tbody>
                              {table.columns.map(col => {
                                const fkCandidate = tableFkCandidates.find(
                                  c => c.column_name === col.column_name
                                );
                                const isFkCandidate = !!fkCandidate;

                                return (
                                  <tr
                                    key={col.column_name}
                                    className={`border-b border-gray-50 ${
                                      isFkCandidate
                                        ? "bg-amber-50/50"
                                        : col.column_name === "id" || col.column_name === "bubble_id"
                                        ? "bg-blue-50/30"
                                        : ""
                                    }`}
                                  >
                                    <td className="px-2 py-1.5">
                                      <code
                                        className={`px-1 py-0.5 rounded text-[12px] ${
                                          isFkCandidate
                                            ? "bg-amber-100 text-amber-800 font-bold"
                                            : col.column_name === "id"
                                            ? "bg-blue-100 text-blue-700 font-bold"
                                            : col.column_name === "bubble_id"
                                            ? "bg-purple-100 text-purple-700 font-bold"
                                            : "bg-gray-100 text-gray-700"
                                        }`}
                                      >
                                        {col.column_name}
                                      </code>
                                    </td>
                                    <td className="px-2 py-1.5 text-gray-500">{col.data_type}</td>
                                    <td className="px-2 py-1.5">
                                      {col.is_nullable === "YES" ? (
                                        <span className="text-gray-300">✓</span>
                                      ) : (
                                        <span className="text-red-400 font-medium">NOT NULL</span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1.5">
                                      {col.has_unique_constraint ? (
                                        <span className="text-blue-500">🔑</span>
                                      ) : (
                                        <span className="text-gray-200">—</span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1.5">
                                      {fkCandidate?.known_target ? (
                                        <span className="text-emerald-600">
                                          → {fkCandidate.known_target.target_table}.
                                          {fkCandidate.known_target.target_column}
                                        </span>
                                      ) : col.fk_target_table ? (
                                        <span className="text-blue-600">
                                          → {col.fk_target_table}.{col.fk_target_column}
                                        </span>
                                      ) : isFkCandidate ? (
                                        <span className="text-amber-500 italic">需映射</span>
                                      ) : (
                                        <span className="text-gray-200">—</span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1.5">
                                      {fkCandidate ? (
                                        <div className="flex items-center gap-1">
                                          {getFkStatusBadge(fkCandidate)}
                                          {fkCandidate.value_type && getValueTypeBadge(fkCandidate.value_type)}
                                        </div>
                                      ) : col.has_fk_constraint ? (
                                        <span className="text-emerald-600 text-[12px]">✅</span>
                                      ) : (
                                        <span className="text-gray-200">—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════ FK MAP TAB ═══════ */}
        {selectedTab === "fk_map" && (
          <div className="space-y-6">
            {/* Group by target table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-[#1A2035] mb-4">🎯 按目標表分組的 FK 關係</h2>

              {(() => {
                const byTarget: Record<string, FKCandidate[]> = {};
                for (const c of fkCandidates.filter(c => c.known_target)) {
                  const target = c.known_target!.target_table;
                  if (!byTarget[target]) byTarget[target] = [];
                  byTarget[target].push(c);
                }

                return Object.entries(byTarget)
                  .sort((a, b) => b[1].length - a[1].length)
                  .map(([targetTable, candidates]) => (
                    <div key={targetTable} className="mb-4 last:mb-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                          {targetTable}
                        </span>
                        <span className="text-xs text-gray-400">
                          被 {candidates.length} 個欄位引用
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-4">
                        {candidates.map(c => (
                          <div
                            key={`${c.table_name}.${c.column_name}`}
                            className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2"
                          >
                            <code className="text-gray-600">{c.table_name}</code>
                            <span className="text-gray-300">.</span>
                            <code className="text-blue-600 font-medium">{c.column_name}</code>
                            <span className="text-gray-300 ml-auto">→</span>
                            <code className="text-emerald-600">{c.known_target?.target_column}</code>
                            {c.has_existing_fk && <span className="text-emerald-500">✅</span>}
                            {!c.has_existing_fk && <span className="text-amber-500">🔧</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
              })()}
            </div>

            {/* Tables with FK candidates but NO mapping */}
            <div className="bg-white rounded-xl shadow-sm border border-red-100 p-5">
              <h2 className="font-semibold text-red-700 mb-3">❓ 未映射的 FK 候選欄位</h2>
              <p className="text-xs text-gray-400 mb-3">
                這些欄位名稱符合 FK 模式但尚未在 KNOWN_FK_MAP 中定義目標
              </p>
              {(() => {
                const unmapped = fkCandidates.filter(c => !c.known_target && !c.has_existing_fk);
                if (unmapped.length === 0) {
                  return <p className="text-sm text-emerald-600">🎉 所有 FK 候選欄位已映射!</p>;
                }
                return (
                  <div className="space-y-1">
                    {unmapped.map(c => (
                      <div
                        key={`${c.table_name}.${c.column_name}`}
                        className="flex items-center gap-2 text-xs bg-red-50/50 rounded px-3 py-1.5"
                      >
                        <code className="text-gray-600">{c.table_name}</code>
                        <span className="text-gray-300">.</span>
                        <code className="text-red-600 font-medium">{c.column_name}</code>
                        {c.value_type && (
                          <span className="ml-auto">{getValueTypeBadge(c.value_type)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
