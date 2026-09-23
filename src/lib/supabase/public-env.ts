const BUILD_PLACEHOLDER_URL = "http://127.0.0.1:54321";
const BUILD_PLACEHOLDER_KEY = "build-time-placeholder-anon-key";

/**
 * Public Supabase URL and anon key.
 *
 * `next build` collects page data and may prerender client components before
 * env vars exist. Placeholders are used only in that phase so `createClient`
 * does not throw. At runtime, missing env throws.
 */
export function resolvePublicSupabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) return { url, key };

  if (process.env.NEXT_PHASE === "phase-production-build") {
    return {
      url: url || BUILD_PLACEHOLDER_URL,
      key: key || BUILD_PLACEHOLDER_KEY,
    };
  }

  throw new Error(
    "Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required"
  );
}

/** Defer client construction until the first property access. */
export function lazyProxy<T extends object>(factory: () => T): T {
  let real: T | null = null;
  return new Proxy({} as T, {
    get(_target, prop) {
      if (!real) real = factory();
      const value = Reflect.get(real, prop, real);
      if (typeof value === "function") {
        return (value as (...args: unknown[]) => unknown).bind(real);
      }
      return value;
    },
  });
}
