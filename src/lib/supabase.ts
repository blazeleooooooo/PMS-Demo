import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Public client (anon key) — for read operations / client-side
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Re-export the full auto-generated types for use elsewhere
export type { Database } from "@/types/supabase";
