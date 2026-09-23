/**
 * User-facing inclusion-rule copy for 傢俬管理 list pages.
 * Keep in sync with matchers in data-service.ts and tab filters in ProductionManagement.
 */

export type FurnitureListLogicPageId =
  | "production"
  | "paid-pending-orders"
  | "consolidation-warehouse"
  | "installation-team"
  | "completion-defect"
  | "major-inquiry";

export interface FurnitureListLogic {
  title: string;
  bullets: string[];
  note?: string;
}

export const FURNITURE_LIST_LOGIC: Record<
  FurnitureListLogicPageId,
  FurnitureListLogic
> = {
  production: {
    title: "列表條件",
    bullets: [
      "本頁載入全部訂單，再依上方搜尋／工廠／PM／項目狀態篩選。",
      "各分頁另有獨立條件（正在生產、過期生產、生產多於20天、集運倉物流、工廠總覽）。",
    ],
    note: "切換分頁後，請查看分頁下方的條件說明。",
  },
  "paid-pending-orders": {
    title: "列表條件",
    bullets: [
      "顯示同時符合以下條件的訂單：",
      "（1）訂單狀態為「待下單」（Pending Orders）；且",
      "（2）所屬 BWF 項目在 incomes 中至少有一筆 payment_amount > 0（客人已付款）。",
      "可依上方搜尋／工廠／PM 進一步篩選。",
    ],
  },
  "consolidation-warehouse": {
    title: "列表條件",
    bullets: [
      "顯示符合以下任一條件的訂單：",
      "（1）訂單狀態為「準備送貨」；或",
      "（2）送貨目標為集運倉、生產完成日已過，且狀態不是「已完成」或「已取消訂單」。",
      "橙色「待更新狀態」：符合條件（2），但狀態尚未改為「準備送貨」。",
    ],
  },
  "installation-team": {
    title: "列表條件",
    bullets: [
      "顯示符合以下任一條件的訂單：",
      "（1）訂單狀態為「待安裝」；或",
      "（2）到場日已過，且狀態不是「已完成」或「已取消訂單」。",
      "橙色「待更新狀態」：符合條件（2），但狀態尚未改為「待安裝」。",
    ],
  },
  "completion-defect": {
    title: "列表條件",
    bullets: [
      "顯示已有實際安裝完成日的訂單，並按項目分組。",
      "預設隱藏項目執漏狀態為「順利完工」或「執漏完成」的項目。",
      "可改為「顯示已完成」或「顯示全部」以調整項目篩選。",
    ],
  },
  "major-inquiry": {
    title: "列表條件",
    bullets: [
      "顯示 bwf_pitchings 中已設定主報價（n_major_quotes_id 不為空）的提案。",
      "列表欄位與 BWF Pitching（/bwf/proposals）相同，並額外顯示主報價名稱。",
      "可依上方搜尋／高級篩選進一步篩選。",
    ],
  },
};
