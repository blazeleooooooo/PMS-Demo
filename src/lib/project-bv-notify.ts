import type { SupabaseClient } from "@supabase/supabase-js";
import { COMPANY_BV_HANDLER_ID } from "@/lib/bwf-initial-project-bv";

export const PROJECT_BV_CREATED_TITLE = "已獲分配項目 BV";

export type ProjectBvCreatedRow = {
  handler_id?: string | null;
  ratio?: number | null;
  project_id?: string | null;
  bwf_project_id?: string | null;
};

export function formatProjectBvRatioPercent(
  ratio: number | null | undefined
): string | null {
  if (ratio == null || !Number.isFinite(ratio)) return null;
  const rounded = Math.round(ratio * 100) / 100;
  return String(rounded);
}

export function projectBvCreatedProjectLabel(
  projectCode?: string | null,
  projectName?: string | null
): string {
  return (projectCode || "").trim() || (projectName || "").trim() || "項目";
}

export function buildProjectBvCreatedMessage(input: {
  assignerName?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  ratio?: number | null;
}): string {
  const assigner = (input.assignerName || "").trim() || "系統";
  const projectLabel = projectBvCreatedProjectLabel(
    input.projectCode,
    input.projectName
  );
  const ratioText = formatProjectBvRatioPercent(input.ratio);
  const ratioPart = ratioText ? `（比例 ${ratioText}%）` : "";
  return `${assigner} 已將你加入項目 ${projectLabel} 的 BV 分配${ratioPart}。`;
}

export function shouldNotifyProjectBvHandler(input: {
  handlerId?: string | null;
  assignerStaffId?: string | null;
}): boolean {
  const handlerId = (input.handlerId || "").trim();
  if (!handlerId) return false;
  if (handlerId === COMPANY_BV_HANDLER_ID) return false;
  const assigner = (input.assignerStaffId || "").trim();
  if (assigner && handlerId === assigner) return false;
  return true;
}

function projectLinkUrl(row: ProjectBvCreatedRow): string | null {
  if (row.project_id) return `/projects/bwa/${row.project_id}`;
  if (row.bwf_project_id) return `/bwf/projects/${row.bwf_project_id}`;
  return null;
}

async function resolveProjectLabels(
  supabase: SupabaseClient,
  rows: ProjectBvCreatedRow[],
  provided: { projectCode?: string | null; projectName?: string | null }
): Promise<{ projectCode: string | null; projectName: string | null }> {
  const providedCode = (provided.projectCode || "").trim() || null;
  const providedName = (provided.projectName || "").trim() || null;
  if (providedCode || providedName) {
    return { projectCode: providedCode, projectName: providedName };
  }

  const bwaId = rows.find((r) => r.project_id)?.project_id ?? null;
  if (bwaId) {
    const { data } = await supabase
      .from("bwa_projects")
      .select("project_code, project_name")
      .eq("id", bwaId)
      .maybeSingle();
    return {
      projectCode: data?.project_code ?? null,
      projectName: data?.project_name ?? null,
    };
  }

  const bwfId = rows.find((r) => r.bwf_project_id)?.bwf_project_id ?? null;
  if (bwfId) {
    const { data } = await supabase
      .from("bwf_projects")
      .select("project_code, project_name")
      .eq("id", bwfId)
      .maybeSingle();
    return {
      projectCode: data?.project_code ?? null,
      projectName: data?.project_name ?? null,
    };
  }

  return { projectCode: null, projectName: null };
}

/**
 * In-app notification center only: tell each new project_bv handler they
 * were assigned. Skips company BV, missing handler, and self-assign.
 * Never throws — create flows must not fail because notify failed.
 */
export async function notifyProjectBvCreated(
  supabase: SupabaseClient,
  input: {
    rows: ProjectBvCreatedRow[];
    assignerStaffId?: string | null;
    assignerName?: string | null;
    projectCode?: string | null;
    projectName?: string | null;
  }
): Promise<void> {
  try {
    const eligible: ProjectBvCreatedRow[] = [];
    const seen = new Set<string>();
    for (const row of input.rows) {
      const handlerId = (row.handler_id || "").trim();
      if (
        !shouldNotifyProjectBvHandler({
          handlerId,
          assignerStaffId: input.assignerStaffId,
        })
      ) {
        continue;
      }
      if (seen.has(handlerId)) continue;
      seen.add(handlerId);
      eligible.push({ ...row, handler_id: handlerId });
    }
    if (eligible.length === 0) return;

    const labels = await resolveProjectLabels(supabase, eligible, input);
    const payloads = eligible.map((row) => ({
      recipient_staff_id: row.handler_id as string,
      title: PROJECT_BV_CREATED_TITLE,
      message: buildProjectBvCreatedMessage({
        assignerName: input.assignerName,
        projectCode: labels.projectCode,
        projectName: labels.projectName,
        ratio: row.ratio,
      }),
      type: "project_update",
      bwa_project_id: row.project_id || null,
      bwf_project_id: row.bwf_project_id || null,
      link_url: projectLinkUrl(row),
      metadata: {
        kind: "project_bv_created",
        handler_id: row.handler_id,
        ratio: row.ratio ?? null,
        assigner_staff_id: input.assignerStaffId ?? null,
      },
      delivery: {},
    }));

    if (payloads.length === 0) return;

    const { error } = await supabase.from("notifications").insert(payloads);
    if (error) {
      console.error("[project-bv-notify] insert failed:", error.message);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[project-bv-notify] failed:", message);
  }
}
