/**
 * Map an Asana BWA Active task (plus custom fields) onto BWA pitching dialog inputs.
 * Lookups are injected so this stays unit-testable.
 */

export type AsanaImportCustomField = {
  name: string;
  type: string | null;
  displayValue: string | null;
};

export type AsanaImportTaskDetail = {
  gid: string;
  name: string;
  notes: string | null;
  assigneeName: string | null;
  createdAt: string | null;
  permalinkUrl: string | null;
  customFields: AsanaImportCustomField[];
};

export type AsanaImportLookupOption = {
  id: string;
  label: string;
  searchText?: string | null;
  teamTypeId?: string | null;
};

export type AsanaImportLookups = {
  staff: AsanaImportLookupOption[];
  districts: AsanaImportLookupOption[];
  serviceTypes: AsanaImportLookupOption[];
  projectTypes: AsanaImportLookupOption[];
  quoteProjectTypes: AsanaImportLookupOption[];
  customers: AsanaImportLookupOption[];
  buildings: AsanaImportLookupOption[];
};

export type AsanaImportMappingNote = {
  field: string;
  source: string;
  value: string;
};

export type BwaPitchingImportPrefill = {
  asanaTaskGid: string;
  description: string;
  realCustomerDisplayName: string;
  customerId: string;
  customerLabel: string;
  enquiryDate: string;
  workingFolder: string;
  asanaLink: string;
  siteAddress: string;
  actualSize: string;
  size: string;
  districtId: string;
  districtLabel: string;
  buildingId: string;
  buildingLabel: string;
  mainPmId: string;
  teamTypeId: string;
  serviceTypeId: string;
  projectTypeIds: string;
  quoteProjectTypeId: string;
  mappingNotes: AsanaImportMappingNote[];
};

const CATEGORY_PROJECT_TYPE: Record<string, string> = {
  "office 寫字樓": "Office Fast Build",
  "big office 6000+ 大型寫字樓": "Office 6000ft+",
  "ngo office 非牟利辦公室": "Office NGO",
  "school 學校": "School Education",
  "clinic 診所": "Clinic",
  "clean room 無塵車間": "Technology",
  "beauty + clinic 醫美": "Beauty & Clinic",
  "beauty 美容院": "Beauty",
  "retail shop 零售店": "Retail / Fashion",
  "sport 運動": "Sports Design & Facilities",
  "care home 安老院": "Care Home",
  "f&b restaurant 餐飲": "Restaurant",
  "furniture 傢俬": "Furniture Office",
  "dismantle 清拆工程": "Dismantle",
  "club house 會所": "Club House",
  "hotel 酒店": "Building",
  "air only 冷氣": "Air",
  "kitchen only 餐廳廚房": "Food Kitchen Only",
  "water only 水務工程": "Water",
  "material only 物料訂單": "Material",
};

const CATEGORY_SERVICE_TYPE: Record<string, string> = {
  "air only 冷氣": "Air Only",
  "furniture 傢俬": "Furniture Only",
  "dismantle 清拆工程": "Dismantle & Reinstate",
  "material only 物料訂單": "Material",
};

const CATEGORY_QUOTE_TYPE: Record<string, string> = {
  "office 寫字樓": "Office",
  "big office 6000+ 大型寫字樓": "Office",
  "ngo office 非牟利辦公室": "Office",
  "clinic 診所": "Clinic",
  "beauty + clinic 醫美": "Beauty",
  "beauty 美容院": "Beauty",
  "clean room 無塵車間": "Clean Room",
  "retail shop 零售店": "Retail",
  "f&b restaurant 餐飲": "F&B Food",
  "kitchen only 餐廳廚房": "F&B Kitchen",
  "dismantle 清拆工程": "Dismantle",
  "material only 物料訂單": "Material",
};

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function customField(task: AsanaImportTaskDetail, name: string): string {
  const match = task.customFields.find((field) => field.name === name);
  return match?.displayValue?.trim() || "";
}

function splitMulti(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseAsanaAssigneeName(raw: string | null | undefined): string {
  const value = (raw || "").trim();
  if (!value) return "";
  return value.split(" - ")[0]?.trim() || value;
}

export function parseSqftFromText(...texts: Array<string | null | undefined>): number | null {
  const blob = texts.filter(Boolean).join(" \n ");
  if (!blob) return null;

  const sqft = blob.match(
    /(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|平方尺|呎)/i
  );
  if (sqft?.[1]) {
    const n = Number(sqft[1].replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }

  const sqm = blob.match(
    /(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(?:~)?\s*(?:sq\.?\s*m|sqm|平方米|m2|m²)/i
  );
  if (sqm?.[1]) {
    const n = Number(sqm[1].replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 10.764) : null;
  }
  return null;
}

export function enquiryDateFromAsanaCreatedAt(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
}

export function extractSiteAddress(notes: string | null | undefined): string {
  if (!notes) return "";
  const patterns = [
    /工程地區\/地址[:：]\s*(.+)/i,
    /工程地點\/地址[:：]\s*(.+)/i,
    /地址[:：]\s*(.+)/i,
    /Venue[:：]\s*(.+)/i,
  ];
  for (const pattern of patterns) {
    const match = notes.match(pattern);
    const line = match?.[1]?.split(/\r?\n/)[0]?.trim();
    if (line) return line.slice(0, 300);
  }
  return "";
}

function findOption(
  options: AsanaImportLookupOption[],
  candidates: string[]
): AsanaImportLookupOption | null {
  for (const raw of candidates) {
    const target = norm(raw);
    if (!target) continue;
    const exact = options.find(
      (opt) =>
        norm(opt.label) === target ||
        norm(opt.searchText || "") === target
    );
    if (exact) return exact;
  }
  for (const raw of candidates) {
    const target = norm(raw);
    if (target.length < 3) continue;
    const partial = options.filter((opt) => {
      const label = norm(opt.label);
      const search = norm(opt.searchText || "");
      return label.includes(target) || search.includes(target) || target.includes(label);
    });
    if (partial.length === 1) return partial[0];
  }
  return null;
}

export function matchStaffFromAssignee(
  assigneeName: string | null | undefined,
  staff: AsanaImportLookupOption[]
): AsanaImportLookupOption | null {
  const parsed = parseAsanaAssigneeName(assigneeName);
  if (!parsed) return null;
  const target = norm(parsed);
  return (
    staff.find((opt) => norm(opt.label) === target) ||
    staff.find((opt) => norm(opt.label).startsWith(target)) ||
    staff.find((opt) => target.startsWith(norm(opt.label))) ||
    null
  );
}

export function matchDistrictFromLocation(
  location: string,
  hint: string,
  districts: AsanaImportLookupOption[]
): AsanaImportLookupOption | null {
  const hintNorm = hint;
  const afterDash = location.includes(" - ")
    ? location.split(" - ").slice(1).join(" - ")
    : location;
  const tokens = afterDash
    .split(/[\s,，/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && t !== "暫時不知道" && t !== "不同地區都有");

  const scored = districts
    .map((district) => {
      const label = district.label;
      const chinese = (label.match(/[\u4e00-\u9fff]+/g) || []).filter(
        (part) => part.length >= 2 && part !== "香港" && part !== "九龍"
      );
      const english = label.replace(/[\u4e00-\u9fff]/g, "").trim();
      let score = 0;
      for (const token of [...tokens, ...chinese, english].filter(Boolean)) {
        if (token.length < 2) continue;
        if (location.includes(token)) score += 1;
        if (hintNorm.includes(token)) score += 3;
        if (label.includes(token)) score += 1;
      }
      return { district, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return null;
  if (scored[0].score >= 3) return scored[0].district;
  if (scored.length === 1) return scored[0].district;
  return null;
}

function officeProjectTypeForSqft(sqft: number | null): string {
  if (sqft != null && sqft >= 6000) return "Office 6000ft+";
  if (sqft != null && sqft >= 3000) return "Office 3000+ft";
  if (sqft != null && sqft >= 1500) return "Office 1500-3000ft";
  return "Office Fast Build";
}

export function mapCategoriesToProjectTypeDisplays(
  categories: string[],
  sqft: number | null
): string[] {
  const displays: string[] = [];
  for (const category of categories) {
    const key = norm(category);
    let display = CATEGORY_PROJECT_TYPE[key];
    if (key === "office 寫字樓") display = officeProjectTypeForSqft(sqft);
    if (display) displays.push(display);
  }
  return [...new Set(displays)];
}

function note(
  notes: AsanaImportMappingNote[],
  field: string,
  source: string,
  value: string
) {
  if (!value) return;
  notes.push({ field, source, value });
}

export function buildBwaPitchingImportPrefill(
  task: AsanaImportTaskDetail,
  lookups: AsanaImportLookups
): BwaPitchingImportPrefill {
  const notes: AsanaImportMappingNote[] = [];
  const location = customField(task, "Location 地區");
  const categories = splitMulti(customField(task, "Category 分類"));
  const rental = customField(task, "Rental 租務情況");
  const chance = customField(task, "Chance 成交機會");
  const stage = customField(task, "Project 跟進階段");
  const designStatus = customField(task, "Design Status 設計進度");
  const bw1 = customField(task, "BW1 Working 主體工程");
  const workingFolder = customField(task, "Working Folder 檔案資料夾");
  const hint = [task.name, task.notes].filter(Boolean).join("\n");
  const sqft = parseSqftFromText(task.name, task.notes);
  const enquiryDate = enquiryDateFromAsanaCreatedAt(task.createdAt);
  const siteAddress = extractSiteAddress(task.notes);

  const staff = matchStaffFromAssignee(task.assigneeName, lookups.staff);
  const district = matchDistrictFromLocation(location, hint, lookups.districts);

  const projectDisplays = mapCategoriesToProjectTypeDisplays(categories, sqft);
  const projectIds = projectDisplays
    .map((display) => findOption(lookups.projectTypes, [display])?.id)
    .filter((id): id is string => !!id);

  let serviceDisplay =
    categories
      .map((category) => CATEGORY_SERVICE_TYPE[norm(category)])
      .find(Boolean) || "Design and Build";
  if (designStatus === "No Need Designer" && !CATEGORY_SERVICE_TYPE[norm(categories[0] || "")]) {
    serviceDisplay = "Build Only";
  }
  const service = findOption(lookups.serviceTypes, [serviceDisplay]);

  const quoteDisplay = categories
    .map((category) => CATEGORY_QUOTE_TYPE[norm(category)])
    .find(Boolean);
  const quote = quoteDisplay
    ? findOption(lookups.quoteProjectTypes, [quoteDisplay])
    : null;

  const extras = [
    rental && `租務=${rental}`,
    chance && `機會=${chance}`,
    stage && `階段=${stage}`,
    designStatus && `設計=${designStatus}`,
    bw1 && `主體工程=${bw1}`,
  ].filter(Boolean);
  const descriptionParts = [task.name.trim()];
  if (task.notes?.trim()) descriptionParts.push(task.notes.trim().slice(0, 1500));
  if (extras.length) descriptionParts.push(`Asana 補充：${extras.join("；")}`);

  const customer = findOption(
    lookups.customers,
    uniqueSearchTokens(task.name)
  );
  const building = findOption(
    lookups.buildings,
    buildingCandidates(task.name, task.notes)
  );

  note(notes, "提案描述 Description", "Asana 任務名稱 + 備註 + 未對應自訂欄位", task.name);
  note(notes, "顯示名稱 Display Name", "Asana 任務名稱", task.name);
  note(notes, "Asana 連結", "permalink_url", task.permalinkUrl || "");
  note(notes, "工作資料夾 Working Folder", "Working Folder 檔案資料夾", workingFolder);
  note(notes, "查詢日期 Enquiry Date", "Asana created_at（香港日期）", enquiryDate);
  note(notes, "實用面積 SA Size", "任務名稱/備註 sqft 或 sqm", sqft != null ? String(sqft) : "");
  note(notes, "工程地址 Site Address", "備註地址欄", siteAddress);
  note(notes, "主要項目經理 Main PM", "Asana assignee 姓名（破折號前）", staff?.label || "");
  note(notes, "團隊類型 Team Type", "對應 PM 的 n_team_type_id", staff?.teamTypeId ? "staff team" : "");
  note(notes, "地區 District", "Location 地區 + 任務名稱提示", district?.label || location);
  note(notes, "項目類型 Project Type", "Category 分類", projectDisplays.join(", "));
  note(notes, "服務類型 Service Type", "Category 分類 / Design Status", service?.label || serviceDisplay);
  note(notes, "工地狀況問卷類型", "Category 分類", quote?.label || "");
  note(notes, "客戶 Customer", "任務名稱搜尋 customers", customer?.label || "");
  note(notes, "大廈 Building", "任務名稱/備註搜尋 buildings", building?.label || "");

  return {
    asanaTaskGid: task.gid,
    description: descriptionParts.join("\n\n"),
    realCustomerDisplayName: task.name.trim(),
    customerId: customer?.id || "",
    customerLabel: customer?.label || "",
    enquiryDate,
    workingFolder,
    asanaLink: task.permalinkUrl || "",
    siteAddress,
    actualSize: sqft != null ? String(sqft) : "",
    size: "",
    districtId: district?.id || "",
    districtLabel: district?.label || "",
    buildingId: building?.id || "",
    buildingLabel: building?.label || "",
    mainPmId: staff?.id || "",
    teamTypeId: staff?.teamTypeId || "",
    serviceTypeId: service?.id || "",
    projectTypeIds: projectIds.join(","),
    quoteProjectTypeId: quote?.id || "",
    mappingNotes: notes.filter((item) => item.value),
  };
}

export function uniqueSearchTokens(title: string): string[] {
  const tokens: string[] = [];
  const chineseRuns = title.match(/[\u4e00-\u9fff]{3,}/g) || [];
  tokens.push(...chineseRuns);
  const englishRuns = title.match(/[A-Za-z][A-Za-z0-9&.' ]{3,}/g) || [];
  tokens.push(...englishRuns.map((s) => s.trim()).filter((s) => s.split(" ").length <= 5));
  return [...new Set(tokens)].slice(0, 6);
}

export function buildingCandidates(
  title: string,
  notes: string | null | undefined
): string[] {
  const blob = `${title}\n${notes || ""}`;
  const matches = blob.match(
    /[A-Za-z0-9\u4e00-\u9fff]{2,}(?:廣場|中心|大廈|商場|學校|書院|醫院|會所|公園)/g
  );
  return [...new Set(matches || [])].slice(0, 6);
}
