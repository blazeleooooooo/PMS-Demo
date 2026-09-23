import { supabase, safeQuery, logError } from "@/lib/data/_core";
import { parseEmailList, pickDefaultCollectionBcc } from "@/lib/collection-email-groups";

export type CollectionEmailSource = "BWA" | "BWF";

type StaffEmailRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
};

type ProjectBvHandlerRow = {
  handler_id: string | null;
  handler:
    | { id?: string; name?: string | null; email?: string | null; status?: string | null }
    | { id?: string; name?: string | null; email?: string | null; status?: string | null }[]
    | null;
};

export interface CollectionEmailRecipient {
  email: string;
  name: string | null;
  source: "customer" | "collaborator" | "finance" | "always";
  staffId?: string | null;
}

export interface CollectionEmailStaffOption {
  id: string;
  name: string;
  email: string | null;
}

export interface CollectionEmailRecipients {
  to: CollectionEmailRecipient[];
  bcc: CollectionEmailRecipient[];
}

function relOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function pushUnique(
  list: CollectionEmailRecipient[],
  seen: Set<string>,
  email: string | null | undefined,
  name: string | null,
  source: CollectionEmailRecipient["source"],
  staffId?: string | null
) {
  for (const addr of parseEmailList(email || "")) {
    const key = addr.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ email: addr, name, source, staffId: staffId || null });
  }
}

export async function fetchCollectionEmailRecipients(input: {
  projectId: string;
  bwType: CollectionEmailSource;
}): Promise<CollectionEmailRecipients> {
  return safeQuery(
    async () => {
      const projectTable = input.bwType === "BWF" ? "bwf_projects" : "bwa_projects";
      const customerFk =
        input.bwType === "BWF"
          ? "cust:customers!fk_bwf_projects_customer_id(id, email, customer_name, display_name, company_name)"
          : "cust:customers!fk_bwa_projects_customer_id(id, email, customer_name, display_name, company_name)";
      const bvFk = input.bwType === "BWF" ? "bwf_project_id" : "project_id";

      const [projectRes, staffRes, bvRes] = await Promise.all([
        supabase.from(projectTable).select(`id, ${customerFk}`).eq("id", input.projectId).maybeSingle(),
        supabase
          .from("staff")
          .select("id, name, email, role, status")
          .eq("status", "Active"),
        supabase
          .from("project_bv")
          .select("handler_id, handler:staff!fk_project_bv_handler_id(id, name, email, status)")
          .eq(bvFk, input.projectId),
      ]);

      if (projectRes.error) logError("fetchCollectionEmailRecipients/project", projectRes.error);
      if (staffRes.error) logError("fetchCollectionEmailRecipients/staff", staffRes.error);
      if (bvRes.error) logError("fetchCollectionEmailRecipients/project_bv", bvRes.error);

      const customer = relOne<{
        email?: string | null;
        customer_name?: string | null;
        display_name?: string | null;
        company_name?: string | null;
      }>(projectRes.data?.cust as never);
      const to: CollectionEmailRecipient[] = [];
      const toSeen = new Set<string>();
      pushUnique(
        to,
        toSeen,
        customer?.email,
        customer?.display_name || customer?.company_name || customer?.customer_name || null,
        "customer"
      );

      const staffRows = (staffRes.data ?? []) as StaffEmailRow[];
      const bvRows = (bvRes.data ?? []) as ProjectBvHandlerRow[];
      const bcc = pickDefaultCollectionBcc({
        staff: staffRows,
        collaborators: bvRows.map((row) => {
          const handler = relOne<{
            id?: string;
            name?: string | null;
            email?: string | null;
            status?: string | null;
          }>(row.handler as never);
          return {
            id: handler?.id || row.handler_id,
            email: handler?.email,
            name: handler?.name,
            status: handler?.status,
          };
        }),
        toEmails: toSeen,
      }).map((row) => ({
        email: row.email,
        name: row.name,
        source: row.source,
        staffId: row.staffId,
      }));

      return { to, bcc };
    },
    { to: [], bcc: [] },
    "fetchCollectionEmailRecipients"
  );
}

export async function fetchCollectionEmailStaffOptions(): Promise<CollectionEmailStaffOption[]> {
  return safeQuery(
    async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, name, full_name, email, status")
        .eq("status", "Active")
        .order("name");
      if (error) {
        logError("fetchCollectionEmailStaffOptions", error);
        return [];
      }
      return ((data ?? []) as Array<{
        id: string;
        name: string | null;
        full_name: string | null;
        email: string | null;
      }>).map((row) => ({
        id: row.id,
        name: row.name || row.full_name || "未命名",
        email: row.email?.trim() || null,
      }));
    },
    [],
    "fetchCollectionEmailStaffOptions"
  );
}
