import { describe, expect, it } from "vitest";
import {
  buildBwaPitchingImportPrefill,
  enquiryDateFromAsanaCreatedAt,
  extractSiteAddress,
  mapCategoriesToProjectTypeDisplays,
  matchDistrictFromLocation,
  matchStaffFromAssignee,
  parseAsanaAssigneeName,
  parseSqftFromText,
  type AsanaImportLookups,
  type AsanaImportTaskDetail,
} from "@/lib/asana-import-map";

const lookups: AsanaImportLookups = {
  staff: [
    { id: "staff-phoebe", label: "Phoebe Yu", teamTypeId: "team-yl" },
    { id: "staff-maggie", label: "Maggie Chan", teamTypeId: "team-tm" },
  ],
  districts: [
    { id: "d-tm", label: "Tuen Mun 屯門" },
    { id: "d-yl", label: "Yuen Long 元朗" },
    { id: "d-tst", label: "Tsim Sha Tsui 尖沙咀" },
  ],
  serviceTypes: [
    { id: "svc-db", label: "Design and Build", searchText: "設計及施工" },
    { id: "svc-air", label: "Air Only", searchText: "空調" },
    { id: "svc-build", label: "Build Only", searchText: "施工" },
  ],
  projectTypes: [
    { id: "pt-school", label: "School Education", searchText: "院校及教育" },
    { id: "pt-air", label: "Air", searchText: "通風系統" },
    { id: "pt-office-fast", label: "Office Fast Build", searchText: "小型辦公室" },
    { id: "pt-office-6k", label: "Office 6000ft+", searchText: "6000呎+" },
  ],
  quoteProjectTypes: [
    { id: "q-office", label: "Office" },
    { id: "q-clinic", label: "Clinic" },
  ],
  customers: [{ id: "c-1", label: "香港青年協會李兆基書院" }],
  buildings: [{ id: "b-1", label: "信誠廣場" }],
};

function sampleTask(
  overrides: Partial<AsanaImportTaskDetail> = {}
): AsanaImportTaskDetail {
  return {
    gid: "111",
    name: "[2027] 屯門 School Lobby - 邱老師 9247 3535",
    notes: "工程地區/地址: 屯門區博愛醫院歷屆總理聯誼會鄭任安夫人學校",
    assigneeName: "Phoebe Yu - BWA PM Project 元朗 (Trainer)",
    createdAt: "2026-09-12T04:34:13.629Z",
    permalinkUrl: "https://app.asana.com/0/1/111",
    customFields: [
      { name: "Location 地區", type: "enum", displayValue: "新界西北 - 屯門 元朗 天水圍" },
      { name: "Category 分類", type: "multi_enum", displayValue: "School 學校" },
      { name: "Working Folder 檔案資料夾", type: "text", displayValue: "D:\\Box\\school" },
      { name: "Rental 租務情況", type: "enum", displayValue: "已租 - 加快跟進" },
      { name: "Chance 成交機會", type: "enum", displayValue: "High Chance 高機會" },
    ],
    ...overrides,
  };
}

describe("asana import mapping helpers", () => {
  it("parses the person name before the Asana role suffix", () => {
    expect(
      parseAsanaAssigneeName("Phoebe Yu - BWA PM Project 元朗 (Trainer)")
    ).toBe("Phoebe Yu");
  });

  it("parses sqft and converts sqm", () => {
    expect(parseSqftFromText("Showroom 300sqft")).toBe(300);
    expect(parseSqftFromText("11,288sqft office")).toBe(11288);
    expect(parseSqftFromText("Size: 300~ sq m")).toBe(3229);
  });

  it("uses Hong Kong calendar date from created_at", () => {
    expect(enquiryDateFromAsanaCreatedAt("2026-09-12T04:34:13.629Z")).toBe(
      "2026-09-12"
    );
  });

  it("extracts an address line from enquiry notes", () => {
    expect(extractSiteAddress("工程地區/地址: 12 Tin Kwai Rd, Tin Shui Wai")).toBe(
      "12 Tin Kwai Rd, Tin Shui Wai"
    );
  });

  it("matches staff and district from Asana values plus title hint", () => {
    expect(matchStaffFromAssignee("Maggie Chan - BWA PM Project (Leader) 屯門", lookups.staff)?.id).toBe(
      "staff-maggie"
    );
    expect(
      matchDistrictFromLocation(
        "新界西北 - 屯門 元朗 天水圍",
        "屯門 School Lobby",
        lookups.districts
      )?.id
    ).toBe("d-tm");
  });

  it("maps office category to a size band", () => {
    expect(mapCategoriesToProjectTypeDisplays(["Office 寫字樓"], 800)).toEqual([
      "Office Fast Build",
    ]);
    expect(mapCategoriesToProjectTypeDisplays(["Office 寫字樓"], 7000)).toEqual([
      "Office 6000ft+",
    ]);
  });
});

describe("buildBwaPitchingImportPrefill", () => {
  it("fills pitching inputs from custom fields and task metadata", () => {
    const prefill = buildBwaPitchingImportPrefill(sampleTask(), lookups);
    expect(prefill.mainPmId).toBe("staff-phoebe");
    expect(prefill.teamTypeId).toBe("team-yl");
    expect(prefill.districtId).toBe("d-tm");
    expect(prefill.projectTypeIds).toBe("pt-school");
    expect(prefill.serviceTypeId).toBe("svc-db");
    expect(prefill.workingFolder).toBe("D:\\Box\\school");
    expect(prefill.asanaLink).toContain("asana.com");
    expect(prefill.description).toContain("Asana 補充：租務=已租 - 加快跟進");
    expect(prefill.customerId).toBe("");
    expect(prefill.siteAddress).toContain("鄭任安夫人學校");
  });

  it("uses Air Only when Category is AIR Only", () => {
    const prefill = buildBwaPitchingImportPrefill(
      sampleTask({
        customFields: [
          { name: "Category 分類", type: "multi_enum", displayValue: "AIR Only 冷氣" },
        ],
      }),
      lookups
    );
    expect(prefill.serviceTypeId).toBe("svc-air");
    expect(prefill.projectTypeIds).toBe("pt-air");
  });
});
