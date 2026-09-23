/**
 * Lightweight connectivity check for the BWF Supabase project.
 * Safe to call from server routes or scripts.
 */
import {
  isBwfSupabaseConfigured,
  isBwfSupabaseServiceKeyConfigured,
} from "@/lib/supabase/bwf/config";
import {
  createBwfAnonServerClient,
  createBwfServerClient,
} from "@/lib/supabase/bwf/server";

export type BwfConnectionProbe = {
  ok: boolean;
  error?: string;
};

export type BwfConnectionStatus = {
  configured: boolean;
  ok: boolean;
  projectRef: string;
  tablesSampled: string[];
  anon: BwfConnectionProbe;
  serviceRole: BwfConnectionProbe & { configured: boolean };
  error?: string;
};

async function probeBwfTable(
  client: ReturnType<typeof createBwfAnonServerClient>,
  table: "bwf_product_categories" | "products" | "bwf_quote"
): Promise<BwfConnectionProbe> {
  const { error } = await client
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function checkBwfSupabaseConnection(): Promise<BwfConnectionStatus> {
  const base: BwfConnectionStatus = {
    configured: isBwfSupabaseConfigured(),
    ok: false,
    projectRef: "",
    tablesSampled: ["products", "bwf_quote", "bwf_product_categories"],
    anon: { ok: false },
    serviceRole: {
      configured: isBwfSupabaseServiceKeyConfigured(),
      ok: false,
    },
  };

  if (!base.configured) {
    return {
      ...base,
      error:
        "Missing Furniture credentials — set NEXT_PUBLIC_BWF_SUPABASE_ANON_KEY (or BWF_SUPABASE_ANON_KEY / BWF_SUPABASE_SERVICE_KEY)",
    };
  }

  try {
    base.anon = await probeBwfTable(createBwfAnonServerClient(), "bwf_product_categories");

    if (base.serviceRole.configured) {
      base.serviceRole = {
        configured: true,
        ...(await probeBwfTable(createBwfServerClient(), "products")),
      };
    } else {
      base.serviceRole.error = "BWF_SUPABASE_SERVICE_KEY not set";
    }

    base.ok = base.anon.ok && (!base.serviceRole.configured || base.serviceRole.ok);
    if (!base.ok && !base.error) {
      base.error = base.serviceRole.error || base.anon.error;
    }

    return base;
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
