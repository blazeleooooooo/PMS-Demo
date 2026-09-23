import { supabase, safeQuery, logError } from "@/lib/data/_core";
import { buildStorageObjectKey } from "@/lib/storage-utils";

const CUSTOMER_DOCS_BUCKET = "customer-docs";

export type CustomerDocumentTypeKey = "br" | "form_s1" | "testimonial";

export interface CustomerDocumentType {
  id: string;
  type: string;
  type_key: CustomerDocumentTypeKey | string;
  code_number_required: boolean;
  enable_expiry_date: boolean;
  sort_order: number;
}

export interface CustomerDocument {
  id: string;
  customer_id: string;
  type_id: string;
  type_key: string | null;
  type_label: string | null;
  file_name: string | null;
  file: string | null;
  legacy_file: string | null;
  code_number: string | null;
  expiry_date: string | null;
  document_date: string | null;
  remarks: string | null;
  created_by_id: string | null;
  created_date: string | null;
  modified_date: string | null;
  migration_status: string | null;
  code_number_required: boolean;
  enable_expiry_date: boolean;
}

export interface CustomerDocumentFormData {
  type_id: string;
  file_name?: string | null;
  file?: string | null;
  code_number?: string | null;
  expiry_date?: string | null;
  document_date?: string | null;
  remarks?: string | null;
  created_by_id?: string | null;
}

function mapDocRow(d: any): CustomerDocument {
  const t = d.customer_document_types ?? d.type ?? null;
  return {
    id: d.id,
    customer_id: d.customer_id,
    type_id: d.type_id,
    type_key: t?.type_key ?? null,
    type_label: t?.type ?? null,
    file_name: d.file_name ?? null,
    file: d.file ?? null,
    legacy_file: d.legacy_file ?? null,
    code_number: d.code_number ?? null,
    expiry_date: d.expiry_date ?? null,
    document_date: d.document_date ?? null,
    remarks: d.remarks ?? null,
    created_by_id: d.created_by_id ?? null,
    created_date: d.created_date ?? null,
    modified_date: d.modified_date ?? null,
    migration_status: d.migration_status ?? null,
    code_number_required: Boolean(t?.code_number_required),
    enable_expiry_date: Boolean(t?.enable_expiry_date),
  };
}

export async function fetchCustomerDocumentTypes(): Promise<CustomerDocumentType[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("customer_document_types")
      .select("id, type, type_key, code_number_required, enable_expiry_date, sort_order")
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("fetchCustomerDocumentTypes error:", error);
      return [];
    }
    return (data || []).map((d: any) => ({
      id: d.id,
      type: d.type,
      type_key: d.type_key,
      code_number_required: Boolean(d.code_number_required),
      enable_expiry_date: Boolean(d.enable_expiry_date),
      sort_order: d.sort_order ?? 0,
    }));
  }, [], "fetchCustomerDocumentTypes");
}

export async function fetchCustomerDocuments(
  customerId: string
): Promise<CustomerDocument[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("customer_documents")
      .select(
        "id, customer_id, type_id, file_name, file, legacy_file, code_number, expiry_date, document_date, remarks, created_by_id, created_date, modified_date, migration_status, customer_document_types(type, type_key, code_number_required, enable_expiry_date)"
      )
      .eq("customer_id", customerId)
      .order("created_date", { ascending: false });
    if (error) {
      console.error("fetchCustomerDocuments error:", error);
      return [];
    }
    return (data || []).map(mapDocRow);
  }, [], "fetchCustomerDocuments");
}

/** Bulk fetch for expense-control evaluators. */
export async function fetchCustomerDocumentsByCustomerIds(
  customerIds: string[]
): Promise<CustomerDocument[]> {
  const ids = Array.from(new Set(customerIds.filter(Boolean)));
  if (!ids.length) return [];

  return safeQuery(async () => {
    const PAGE = 1000;
    const all: CustomerDocument[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("customer_documents")
          .select(
            "id, customer_id, type_id, file_name, file, legacy_file, code_number, expiry_date, document_date, remarks, created_by_id, created_date, modified_date, migration_status, customer_document_types(type, type_key, code_number_required, enable_expiry_date)"
          )
          .in("customer_id", chunk)
          .range(from, from + PAGE - 1);
        if (error) {
          console.error("fetchCustomerDocumentsByCustomerIds error:", error);
          break;
        }
        const rows = data || [];
        all.push(...rows.map(mapDocRow));
        if (rows.length < PAGE) break;
        from += PAGE;
      }
    }
    return all;
  }, [], "fetchCustomerDocumentsByCustomerIds");
}

export async function customerHasDocumentType(
  customerId: string,
  typeKey: CustomerDocumentTypeKey | string
): Promise<boolean> {
  return safeQuery(async () => {
    const { data: typeRow, error: typeErr } = await supabase
      .from("customer_document_types")
      .select("id")
      .eq("type_key", typeKey)
      .maybeSingle();
    if (typeErr || !typeRow?.id) return false;

    const { count, error } = await supabase
      .from("customer_documents")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId)
      .eq("type_id", typeRow.id);
    if (error) {
      console.error("customerHasDocumentType error:", error);
      return false;
    }
    return (count ?? 0) > 0;
  }, false, "customerHasDocumentType");
}

export async function createCustomerDocument(
  customerId: string,
  formData: CustomerDocumentFormData
): Promise<{ success: boolean; id?: string; error?: string }> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("customer_documents")
      .insert({
        customer_id: customerId,
        type_id: formData.type_id,
        file_name: formData.file_name ?? null,
        file: formData.file ?? null,
        code_number: formData.code_number ?? null,
        expiry_date: formData.expiry_date ?? null,
        document_date: formData.document_date ?? null,
        remarks: formData.remarks ?? null,
        created_by_id: formData.created_by_id ?? null,
        migration_status: formData.file ? "native" : "number_only",
        created_date: new Date().toISOString(),
        modified_date: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
  }, { success: false, error: "Network error" }, "createCustomerDocument");
}

export async function updateCustomerDocument(
  docId: string,
  formData: Partial<CustomerDocumentFormData> & { migration_status?: string }
): Promise<{ success: boolean; error?: string }> {
  return safeQuery(async () => {
    const payload: Record<string, unknown> = {
      modified_date: new Date().toISOString(),
    };
    if (formData.type_id !== undefined) payload.type_id = formData.type_id;
    if (formData.file_name !== undefined) payload.file_name = formData.file_name;
    if (formData.file !== undefined) payload.file = formData.file;
    if (formData.code_number !== undefined) payload.code_number = formData.code_number;
    if (formData.expiry_date !== undefined) payload.expiry_date = formData.expiry_date;
    if (formData.document_date !== undefined) payload.document_date = formData.document_date;
    if (formData.remarks !== undefined) payload.remarks = formData.remarks;
    if (formData.migration_status !== undefined) {
      payload.migration_status = formData.migration_status;
    } else if (formData.file) {
      payload.migration_status = "native";
    }

    const { error } = await supabase
      .from("customer_documents")
      .update(payload)
      .eq("id", docId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, { success: false, error: "Network error" }, "updateCustomerDocument");
}

export async function deleteCustomerDocument(
  docId: string
): Promise<{ success: boolean; error?: string }> {
  return safeQuery(async () => {
    const { data: row, error: fetchErr } = await supabase
      .from("customer_documents")
      .select("file")
      .eq("id", docId)
      .maybeSingle();
    if (fetchErr) return { success: false, error: fetchErr.message };

    const { error } = await supabase.from("customer_documents").delete().eq("id", docId);
    if (error) return { success: false, error: error.message };

    if (row?.file && row.file.includes(`/${CUSTOMER_DOCS_BUCKET}/`)) {
      await deleteCustomerDocumentFile(row.file);
    }
    return { success: true };
  }, { success: false, error: "Network error" }, "deleteCustomerDocument");
}

export async function uploadCustomerDocumentFile(
  customerId: string,
  typeKey: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  return safeQuery(async () => {
    const fileName = buildStorageObjectKey(`${customerId}/${typeKey}`, file.name);
    const { error: uploadError } = await supabase.storage
      .from(CUSTOMER_DOCS_BUCKET)
      .upload(fileName, file, { upsert: false });
    if (uploadError) return { success: false, error: uploadError.message };
    const { data: urlData } = supabase.storage
      .from(CUSTOMER_DOCS_BUCKET)
      .getPublicUrl(fileName);
    return { success: true, url: urlData.publicUrl };
  }, { success: false, error: "Network error" }, "uploadCustomerDocumentFile");
}

/** Only deletes storage objects under customer-docs — never Bubble/legacy hosts. */
export async function deleteCustomerDocumentFile(
  fileUrl: string
): Promise<{ success: boolean; error?: string }> {
  return safeQuery(async () => {
    if (!fileUrl.includes(`/${CUSTOMER_DOCS_BUCKET}/`)) {
      return { success: true };
    }
    const parts = fileUrl.split(`/${CUSTOMER_DOCS_BUCKET}/`);
    if (parts.length < 2) return { success: false, error: "Invalid file URL" };
    const filePath = parts[1].split("?")[0];
    const { error } = await supabase.storage
      .from(CUSTOMER_DOCS_BUCKET)
      .remove([filePath]);
    if (error) {
      logError("deleteCustomerDocumentFile", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  }, { success: false, error: "Network error" }, "deleteCustomerDocumentFile");
}
