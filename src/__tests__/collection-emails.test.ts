import { describe, expect, it } from "vitest";
import {
  COLLECTION_ALWAYS_BCC_STAFF_IDS,
  formatEmailList,
  groupArIncomesByProject,
  isCollectionBccExcludedEmail,
  isCollectionFinanceBccEmail,
  isValidEmailAddress,
  parseEmailList,
  parseValidEmailList,
  pickDefaultCollectionBcc,
} from "@/lib/collection-email-groups";
import {
  addHongKongWorkingDays,
  buildCollectionEmailCopy,
  buildCollectionEmailHtml,
  attachIssuedInvoiceNumbers,
  buildProjectInvoiceSummaryHtml,
  defaultCollectionEmailBody,
  defaultCollectionEmailSignature,
  defaultCollectionEmailSubject,
  formatIssuedInvoiceNumber,
  formatProjectInvoiceRowHash,
  getDaysRemainingLabel,
  getPaymentStatusLabel,
  toChineseNumeral,
} from "@/lib/project-invoice-summary";
import type { ArReceiveDateIncomeRow } from "@/lib/data/ar-receive-dates";

function income(partial: Partial<ArReceiveDateIncomeRow> & { id: string; project_id: string }): ArReceiveDateIncomeRow {
  return {
    bw_type: "BWA",
    created_date: "2026-09-01",
    due_date: "2026-09-10",
    expected_payment_date: "2026-09-12",
    expected_payment_date_log: [],
    receive_date: null,
    enquiry_date: null,
    signed_date: null,
    income_amount: 1000,
    payment_amount: 0,
    outstanding: 1000,
    bad_debts: 0,
    payment_status: "Not Received",
    payment_method: null,
    payment_method_label: null,
    invoice_number: "1",
    type_display: "主體工程",
    remark: null,
    project_code: "BWA2627CY-007",
    project_name: "青衣 Dental",
    project_status: "Active",
    pm_id: null,
    pm_name: "Candy",
    asana_link: null,
    contract_type_label: "主體工程",
    expiry_reason_id: null,
    expiry_reason_label: null,
    ...partial,
  };
}

describe("collection email grouping", () => {
  it("groups incomes by project and sums amounts", () => {
    const rows = [
      income({ id: "a", project_id: "p1", income_amount: 100, outstanding: 100 }),
      income({ id: "b", project_id: "p1", income_amount: 50, outstanding: 50, remark: "催收" }),
      income({ id: "c", project_id: "p2", income_amount: 20, outstanding: 20, project_code: "BWF-1" }),
    ];
    const grouped = groupArIncomesByProject(rows);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].income_count).toBe(2);
    expect(grouped[0].income_amount).toBe(150);
    expect(grouped[0].outstanding).toBe(150);
    expect(grouped[0].remark).toBe("催收");
    expect(grouped[1].project_id).toBe("p2");
  });

  it("marks mixed payment status as 部分已收", () => {
    const grouped = groupArIncomesByProject([
      income({ id: "a", project_id: "p1", payment_status: "Received", outstanding: 0, payment_amount: 100 }),
      income({ id: "b", project_id: "p1", payment_status: "Not Received", outstanding: 80 }),
    ]);
    expect(grouped[0].payment_status).toBe("部分已收");
  });
});

describe("email list helpers", () => {
  it("parses and dedupes addresses", () => {
    expect(parseEmailList("a@x.com, B@x.com; a@x.com\nc@x.com")).toEqual([
      "a@x.com",
      "B@x.com",
      "c@x.com",
    ]);
    expect(formatEmailList(["a@x.com", "b@x.com"])).toBe("a@x.com, b@x.com");
  });

  it("rejects To values that are not email addresses", () => {
    expect(isValidEmailAddress("n/a")).toBe(false);
    expect(isValidEmailAddress("not-an-email")).toBe(false);
    expect(isValidEmailAddress("customer@example.com")).toBe(true);
    expect(parseValidEmailList("n/a")).toBeNull();
    expect(parseValidEmailList("a@x.com, n/a")).toBeNull();
    expect(parseValidEmailList("a@x.com, B@x.com")).toEqual(["a@x.com", "B@x.com"]);
    expect(parseValidEmailList("")).toBeNull();
  });

  it("matches the finance BCC mailbox", () => {
    expect(isCollectionFinanceBccEmail("finance@example.com")).toBe(true);
    expect(isCollectionFinanceBccEmail(" Finance@example.com ")).toBe(true);
    expect(isCollectionFinanceBccEmail("other@example.net")).toBe(false);
  });

  it("excludes the demo mailbox from BCC", () => {
    expect(isCollectionBccExcludedEmail("excluded@example.com")).toBe(true);
    expect(isCollectionBccExcludedEmail(" Excluded@example.com ")).toBe(true);
    expect(isCollectionBccExcludedEmail("alex@example.com")).toBe(false);
  });

  it("picks finance staff, collaborators, and always-include staff, then drops the excluded mailbox", () => {
    const [angelId, francoId] = COLLECTION_ALWAYS_BCC_STAFF_IDS;
    const picks = pickDefaultCollectionBcc({
      staff: [
        { id: "fin-1", email: "finance@example.com", name: "Casey" },
        { id: "fin-2", email: "finance@example.com", name: "Other Finance" },
        { id: angelId, email: "alex@example.com", name: "Alex" },
        { id: francoId, email: "blair@example.com", name: "Blair" },
        { id: "excluded", email: "excluded@example.com", name: "Acme" },
        { id: "other", email: "other@x.com", name: "Other" },
      ],
      collaborators: [
        { id: "collab", email: "collab@x.com", name: "Collab", status: "Active" },
        { id: "excluded", email: "excluded@example.com", name: "Acme", status: "Active" },
        { id: "inactive", email: "old@x.com", name: "Old", status: "Inactive" },
        { id: angelId, email: "alex@example.com", name: "Alex", status: "Active" },
      ],
      toEmails: ["customer@x.com"],
    });
    expect(picks.map((row) => row.staffId)).toEqual(["fin-1", "fin-2", "collab", angelId, francoId]);
    expect(picks.some((row) => isCollectionBccExcludedEmail(row.email))).toBe(false);
    expect(picks.some((row) => row.staffId === "other" || row.staffId === "inactive")).toBe(false);
  });
});

describe("工程對數表 html", () => {
  it("renders title, unpaid summary and follow-up labels", () => {
    const html = buildProjectInvoiceSummaryHtml({
      projectCode: "BWA2627CY-007",
      projectName: "青衣 Dental",
      customerName: "Clinton",
      pmName: "Candy",
      incomes: [
        {
          id: "1",
          amount: 445048,
          payment_amount: 0,
          outstanding: 445048,
          payment_date: null,
          due_date: "2026-09-10",
          payment_status: "Not Received",
          invoice_number: "1",
          n_contract_type_id: "ct1",
          contract_type_name: "主體工程",
          type_display: "主體工程",
          created_date: "2026-09-10",
        },
      ],
    });
    expect(html).toContain("工程對數表");
    expect(html).toContain("BWA2627CY-007");
    expect(html).toContain("主體工程 #1");
    expect(html).toContain("Summary - 應付未付");
    expect(html).toContain("未付款");
    expect(html).toContain(">/</td>");
    expect(defaultCollectionEmailSubject("BWA2627CY-007", "青衣 Dental")).toBe(
      "【付款提醒】青衣 Dental - 第 1 期工程進度款項通知"
    );
    expect(getPaymentStatusLabel({
      id: "1",
      amount: 10,
      payment_amount: 10,
      outstanding: 0,
      payment_date: "2026-09-01",
      due_date: "2026-09-10",
      payment_status: "Received",
      invoice_number: "1",
      n_contract_type_id: null,
      contract_type_name: null,
      type_display: null,
      created_date: null,
    })).toContain("已付");
    expect(getDaysRemainingLabel({
      id: "1",
      amount: 10,
      payment_amount: 10,
      outstanding: 0,
      payment_date: null,
      due_date: "2026-09-10",
      payment_status: "Received",
      invoice_number: null,
      n_contract_type_id: null,
      contract_type_name: null,
      type_display: null,
      created_date: null,
    })).toBe("/");
    expect(formatProjectInvoiceRowHash({
      contract_type_name: "主體工程",
      invoice_number: "4",
    })).toBe("主體工程 #4");
    expect(formatIssuedInvoiceNumber(null)).toBe("/");
    expect(formatIssuedInvoiceNumber(" 260900012 ")).toBe("260900012");
    expect(attachIssuedInvoiceNumbers(
      [{ id: "a", invoice_number: "2" }],
      { a: "260900099" }
    )[0].issued_invoice_number).toBe("260900099");
  });

  it("prints issued invoice numbers in both contract and unpaid tables", () => {
    const html = buildProjectInvoiceSummaryHtml({
      projectCode: "BWE2526CT-027",
      projectName: "Toppro",
      incomes: [
        {
          id: "paid",
          amount: 147000,
          payment_amount: 147000,
          outstanding: 0,
          payment_date: "2026-01-30",
          due_date: "2026-01-30",
          payment_status: "Received",
          invoice_number: "2",
          issued_invoice_number: "260100002",
          n_contract_type_id: "ct1",
          contract_type_name: "主體工程",
          type_display: "主體工程",
          created_date: "2026-09-01",
        },
        {
          id: "due",
          amount: 88200,
          payment_amount: 0,
          outstanding: 88200,
          payment_date: null,
          due_date: "2026-09-04",
          payment_status: "Not Received",
          invoice_number: "3",
          issued_invoice_number: null,
          n_contract_type_id: "ct1",
          contract_type_name: "主體工程",
          type_display: "主體工程",
          created_date: "2026-09-01",
        },
      ],
    });
    expect(html).toContain("主體工程 #2");
    expect(html).toContain("主體工程 #3");
    expect(html).toContain("260100002");
    expect(html).toContain("Summary - 應付未付");
    expect((html.match(/主體工程 #3/g) || []).length).toBe(2);
  });

  it("keeps signature below the statement and out of the body", () => {
    const body = defaultCollectionEmailBody({
      projectCode: "BWA1",
      projectName: "Lab",
      customerName: "Clinton",
    });
    const signature = defaultCollectionEmailSignature({
      companyName: "Acme 設計有限公司",
    });
    expect(body).not.toContain("會計部");
    expect(signature).toContain("Acme 設計有限公司 會計部 謹啟");
    expect(signature).not.toContain("Phoebe Yu");
    const html = buildCollectionEmailHtml(body, "<div>STATEMENT</div>", signature);
    expect(html.indexOf("STATEMENT")).toBeLessThan(html.indexOf("會計部"));
    expect(html.indexOf("尊貴的 Clinton")).toBeLessThan(html.indexOf("STATEMENT"));
  });

  it("builds a milder progress-payment reminder from unpaid incomes", () => {
    expect(toChineseNumeral(2)).toBe("二");
    expect(addHongKongWorkingDays(3, "2026-09-16")).toBe("2026年9月21日");
    const copy = buildCollectionEmailCopy("progress", {
      projectName: "將軍澳循道衛理小學 | 天台草坪",
      customerName: "將澳循道衛理小學",
      companyName: "Acme 設計有限公司",
      incomes: [
        {
          id: "paid",
          amount: 100000,
          payment_amount: 100000,
          outstanding: 0,
          payment_date: "2026-08-01",
          due_date: "2026-08-01",
          payment_status: "Received",
          invoice_number: "1",
          issued_invoice_number: "INV-1",
          n_contract_type_id: "ct1",
          contract_type_name: "主體工程",
          type_display: "Main",
          created_date: "2026-07-01",
        },
        {
          id: "due",
          amount: 250000,
          payment_amount: 0,
          outstanding: 250000,
          payment_date: null,
          due_date: "2026-09-10",
          payment_status: "Not Received",
          invoice_number: "2",
          issued_invoice_number: "INV-2",
          n_contract_type_id: "ct1",
          contract_type_name: "主體工程",
          type_display: "Main",
          created_date: "2026-08-15",
        },
      ],
    });
    expect(copy.subject).toBe(
      "【付款提醒】將軍澳循道衛理小學 | 天台草坪 - 第 2 期工程進度款項通知"
    );
    expect(copy.body).toContain("尊貴的 將澳循道衛理小學：");
    expect(copy.body).toContain("第二期完成");
    expect(copy.body).toContain("港幣 250,000.00 元");
    expect(copy.body).toContain("Invoice No.: INV-2");
    expect(copy.body).toContain("請致電 2127 4915");
    expect(copy.body).toContain("祝 業務蒸蒸日上！");
    expect(copy.signature).toBe("Acme 設計有限公司 會計部 謹啟");
  });

  it("builds a firmer overdue-balance warning", () => {
    const copy = buildCollectionEmailCopy("overdue", {
      projectName: "將軍澳循道衛理小學 | 天台草坪",
      customerName: "將澳循道衛理小學",
      companyName: "Acme 設計有限公司",
      handoverDate: "2026-08-20",
      asOf: "2026-09-16",
      incomes: [
        {
          id: "tail",
          amount: 88000,
          payment_amount: 0,
          outstanding: 88000,
          payment_date: null,
          due_date: "2026-08-31",
          payment_status: "Not Received",
          invoice_number: "9",
          issued_invoice_number: "INV-9",
          n_contract_type_id: "ct1",
          contract_type_name: "主體工程",
          type_display: "Main",
          created_date: "2026-08-01",
        },
      ],
    });
    expect(copy.subject).toBe(
      "【重要催繳通知】將軍澳循道衛理小學 | 天台草坪 - 尾數款項逾期未付警告"
    );
    expect(copy.body).toContain("將澳循道衛理小學 台照：");
    expect(copy.body).toContain("發票號碼：INV-9");
    expect(copy.body).toContain("港幣 88,000.00 元");
    expect(copy.body).toContain("已於 2026年8月20日 順利完工");
    expect(copy.body).toContain("3 個工作天內（即 2026年9月21日 前）");
    expect(copy.body).toContain("採取法律行動");
    expect(copy.signature).toBe("Acme 設計有限公司 會計部 啟");
  });
});
