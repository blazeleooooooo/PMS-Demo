import { supabase, safeQuery } from "@/lib/data/_core";
import { buildStorageObjectKey } from "@/lib/storage-utils";

// ─── PROJECT DOCUMENTS (DOCS TAB) ────────────────────────

export interface DocType {
  id: string;
  display: string | null;
  category: string | null;
  enable_doc_date: boolean;
  enable_expiry_date: boolean;
  is_project_initial_doc: boolean;
}

export interface ProjectDocument {
  id: string;
  doc_name: string | null;
  doc_type_id: string | null;
  doc_type_display: string | null;
  doc_type_category: string | null;
  document_date: string | null;
  expiry_date: string | null;
  remark: string | null;
  file: string | null;
  created_date: string | null;
  modified_date: string | null;
}

export async function fetchDocTypes(): Promise<DocType[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("nos_doc_types")
      .select("id, display, category, enable_doc_date, enable_expiry_date, is_project_initial_doc")
      .order("display", { ascending: true });
    if (error) { console.error("fetchDocTypes error:", error); return []; }
    return (data || []).map((d: any) => ({
      id: d.id,
      display: d.display,
      category: d.category,
      enable_doc_date: d.enable_doc_date ?? false,
      enable_expiry_date: d.enable_expiry_date ?? false,
      is_project_initial_doc: d.is_project_initial_doc ?? false,
    }));
  }, [], "fetchDocTypes");
}

export async function fetchProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("project_documents")
      .select("id, doc_name, doc_type_id, document_date, expiry_date, remark, file, created_date, modified_date, doc_type:nos_doc_types!fk_project_documents_doc_type_id(display, category)")
      .eq("project_id", projectId)
      .order("created_date", { ascending: false });
    if (error) { console.error("fetchProjectDocuments error:", error); return []; }
    return (data || []).map((d: any) => ({
      id: d.id,
      doc_name: d.doc_name,
      doc_type_id: d.doc_type_id,
      doc_type_display: d.doc_type?.display || null,
      doc_type_category: d.doc_type?.category || null,
      document_date: d.document_date,
      expiry_date: d.expiry_date,
      remark: d.remark,
      file: d.file,
      created_date: d.created_date,
      modified_date: d.modified_date,
    }));
  }, [], "fetchProjectDocuments");
}

export interface ProjectDocFormData {
  doc_name: string;
  doc_type_id: string | null;
  document_date: string | null;
  expiry_date: string | null;
  remark: string | null;
  file: string | null;
}

export async function createProjectDocument(
  projectId: string,
  formData: ProjectDocFormData
): Promise<{ success: boolean; id?: string; error?: string }> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("project_documents")
      .insert({
        project_id: projectId,
        doc_name: formData.doc_name,
        doc_type_id: formData.doc_type_id,
        document_date: formData.document_date,
        expiry_date: formData.expiry_date,
        remark: formData.remark,
        file: formData.file,
        created_date: new Date().toISOString(),
        modified_date: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
  }, { success: false, error: "Network error" }, "createProjectDocument");
}

export async function updateProjectDocument(
  docId: string,
  formData: Partial<ProjectDocFormData>
): Promise<{ success: boolean; error?: string }> {
  return safeQuery(async () => {
    const { error } = await supabase
      .from("project_documents")
      .update({
        ...formData,
        modified_date: new Date().toISOString(),
      })
      .eq("id", docId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, { success: false, error: "Network error" }, "updateProjectDocument");
}

export async function deleteProjectDocument(
  docId: string
): Promise<{ success: boolean; error?: string }> {
  return safeQuery(async () => {
    const { error } = await supabase
      .from("project_documents")
      .delete()
      .eq("id", docId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, { success: false, error: "Network error" }, "deleteProjectDocument");
}

export async function uploadProjectDocFile(
  projectId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  return safeQuery(async () => {
    const fileName = buildStorageObjectKey(projectId, file.name);
    const { error: uploadError } = await supabase.storage
      .from("project-docs")
      .upload(fileName, file, { upsert: false });
    if (uploadError) return { success: false, error: uploadError.message };
    const { data: urlData } = supabase.storage.from("project-docs").getPublicUrl(fileName);
    return { success: true, url: urlData.publicUrl };
  }, { success: false, error: "Network error" }, "uploadProjectDocFile");
}

export async function deleteProjectDocFile(
  fileUrl: string
): Promise<{ success: boolean; error?: string }> {
  return safeQuery(async () => {
    // Extract path from full URL  e.g. .../project-docs/xxx/yyy.pdf → xxx/yyy.pdf
    const parts = fileUrl.split("/project-docs/");
    if (parts.length < 2) return { success: false, error: "Invalid file URL" };
    const filePath = parts[1];
    const { error } = await supabase.storage
      .from("project-docs")
      .remove([filePath]);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, { success: false, error: "Network error" }, "deleteProjectDocFile");
}
