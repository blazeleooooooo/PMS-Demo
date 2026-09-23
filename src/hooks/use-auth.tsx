"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { setActingStaffId } from "@/lib/acting-staff";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";

// ─── INTERFACES ──────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string | null;
  user_type: string | null;
  member: string | null;
  member_id: string | null;
  supplier: string | null;
  supplier_id: string | null;
  customer: string | null;
  customer_id: string | null;
  // When true, this account may impersonate (switch to) other staff in-app
  // without logging out. Sourced from public.users.is_developer and ALWAYS
  // resolved from the real login — impersonation never changes it.
  is_developer: boolean;
}

export interface StaffData {
  id: string;
  name: string | null;
  full_name: string | null;
  email: string | null;
  bubble_id: string | null;
  [key: string]: any;
}

export interface UserContext {
  profile: UserProfile | null;
  staff: StaffData | null;
  displayName: string;
  initials: string;
}

/**
 * Initial data fetched server-side and passed down to avoid client-side re-fetching.
 */
export interface ServerAuthData {
  user: { id: string; email: string } | null;
  userContext: UserContext | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  /** Effective profile — the impersonated staff's profile when impersonating, else the real one. */
  profile: UserProfile | null;
  /** Effective staff — the impersonated staff when impersonating, else the real one. Permissions key off this. */
  staff: StaffData | null;
  displayName: string;
  initials: string;
  isLoading: boolean;
  isLoggedIn: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  // ─── Developer impersonation ───────────────────────────────
  /** True when a developer is currently viewing the app as another staff. */
  isImpersonating: boolean;
  /** Whether the REAL logged-in account is allowed to impersonate (public.users.is_developer). */
  canImpersonate: boolean;
  /** The real logged-in staff (unchanged while impersonating). */
  realStaff: StaffData | null;
  /** The real logged-in display name (unchanged while impersonating). */
  realDisplayName: string;
  /** Switch to viewing the app as the given staff id. No-op for non-developers. */
  impersonate: (staffId: string) => Promise<void>;
  /** Return to the real logged-in account. */
  stopImpersonating: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  staff: null,
  displayName: "",
  initials: "??",
  isLoading: true,
  isLoggedIn: false,
  signOut: async () => {},
  refreshProfile: async () => {},
  isImpersonating: false,
  canImpersonate: false,
  realStaff: null,
  realDisplayName: "",
  impersonate: async () => {},
  stopImpersonating: () => {},
});

// sessionStorage key holding the impersonated staff id. Survives navigation
// within the tab but is cleared on sign-out / new login.
const IMPERSONATION_KEY = "pms_impersonate_staff_id";

// ─── IN-MEMORY CACHE ─────────────────────────────────────
// Prevents re-fetching when component re-mounts in same session
const contextCache = new Map<string, UserContext>();

// ─── HELPERS ─────────────────────────────────────────────

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function emailToDisplayName(email: string): string {
  return email.split("@")[0] || "用戶";
}

// ─── PROVIDER ────────────────────────────────────────────

interface AuthProviderProps {
  children: React.ReactNode;
  /** Server-fetched initial auth data — avoids client-side re-fetch on page load */
  initialData?: ServerAuthData | null;
}

export function AuthProvider({ children, initialData }: AuthProviderProps) {
  // Hydrate from server data if available
  const hasServerData = !!(initialData?.user && initialData?.userContext);

  const [user, setUser] = useState<User | null>(
    hasServerData
      ? ({ id: initialData!.user!.id, email: initialData!.user!.email } as unknown as User)
      : null
  );
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(
    hasServerData ? initialData!.userContext!.profile : null
  );
  const [staff, setStaff] = useState<StaffData | null>(
    hasServerData ? initialData!.userContext!.staff : null
  );
  const [displayName, setDisplayName] = useState<string>(
    hasServerData ? initialData!.userContext!.displayName : ""
  );
  const [initials, setInitials] = useState<string>(
    hasServerData ? initialData!.userContext!.initials : "??"
  );
  // If we have server data, no loading needed — auth is already resolved
  const [isLoading, setIsLoading] = useState(!hasServerData);

  // ─── IMPERSONATION STATE ─────────────────────────────────
  // When a developer impersonates another staff, we OVERRIDE the exposed
  // profile/staff/displayName/initials with the target's, while keeping the
  // real values above untouched. Permissions (use-permission) key off the
  // exposed staff.id, so they resolve to the impersonated staff automatically.
  const [impersonatedStaff, setImpersonatedStaff] = useState<StaffData | null>(null);
  const [impersonatedProfile, setImpersonatedProfile] = useState<UserProfile | null>(null);
  const [impersonatedName, setImpersonatedName] = useState<string>("");

  // Prevent duplicate RPC calls
  const fetchingRef = useRef(false);
  // Track if we already seeded cache from server data
  const seededCacheRef = useRef(false);

  // Singleton client — stable across renders
  const supabase = React.useMemo(() => createClient(), []);

  // Seed cache from server data on first mount (prevents client re-fetch)
  if (hasServerData && !seededCacheRef.current) {
    const email = initialData!.user!.email.toLowerCase().trim();
    contextCache.set(email, initialData!.userContext!);
    seededCacheRef.current = true;
  }

  // ─── UNIFIED RPC FETCH ───────────────────────────────────
  const fetchUserContext = useCallback(
    async (email: string) => {
      // Immediately set email-based display name (instant, no waiting)
      const emailName = emailToDisplayName(email);
      setDisplayName(emailName);
      setInitials(computeInitials(emailName));

      // Check cache — if we've resolved before, apply immediately
      const cached = contextCache.get(email.toLowerCase().trim());
      if (cached) {
        setProfile(cached.profile);
        setStaff(cached.staff);
        setDisplayName(cached.displayName);
        setInitials(cached.initials);
        return;
      }

      // Prevent duplicate concurrent fetches
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      try {
        // Single RPC call with a 6s timeout — replaces 4+ sequential queries
        const rpcPromise = supabase.rpc("get_complete_user_context", {
          input_email: email.toLowerCase().trim(),
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("RPC timeout after 6s")), 6000)
        );

        const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);

        if (error) {
          console.warn("[useAuth] RPC get_complete_user_context error:", error.message);
          // Keep email fallback — already set above
          return;
        }

        if (data && data.length > 0) {
          const row = data[0];

          // Parse profile
          const profileData = row.profile_data as Record<string, any> | null;
          if (profileData && profileData.id) {
            const parsedProfile: UserProfile = {
              id: profileData.id,
              email: profileData.email ?? null,
              user_type: profileData.user_type ?? null,
              member: profileData.member ?? null,
              member_id: profileData.member_id ?? null,
              supplier: profileData.supplier ?? null,
              supplier_id: profileData.supplier_id ?? null,
              customer: profileData.customer ?? null,
              customer_id: profileData.customer_id ?? null,
              is_developer: profileData.is_developer === true,
            };
            setProfile(parsedProfile);
          }

          // Parse staff
          const staffData = row.staff_data as Record<string, any> | null;
          if (staffData && staffData.id) {
            setStaff(staffData as StaffData);
          }

          // Set display name from RPC result
          const resolvedName = row.display_name || emailName;
          setDisplayName(resolvedName);
          setInitials(computeInitials(resolvedName));

          // Cache the result
          contextCache.set(email.toLowerCase().trim(), {
            profile: profileData?.id ? {
              id: profileData.id,
              email: profileData.email ?? null,
              user_type: profileData.user_type ?? null,
              member: profileData.member ?? null,
              member_id: profileData.member_id ?? null,
              supplier: profileData.supplier ?? null,
              supplier_id: profileData.supplier_id ?? null,
              customer: profileData.customer ?? null,
              customer_id: profileData.customer_id ?? null,
              is_developer: profileData.is_developer === true,
            } : null,
            staff: staffData?.id ? (staffData as StaffData) : null,
            displayName: resolvedName,
            initials: computeInitials(resolvedName),
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("timeout")) {
          console.warn("[useAuth] RPC timed out — using email fallback");
        } else {
          console.warn("[useAuth] RPC failed:", msg);
        }
        // Email-based displayName is already set — no disruption
      } finally {
        fetchingRef.current = false;
      }
    },
    [supabase]
  );

  // ─── REFRESH PROFILE (manual trigger) ────────────────────
  const refreshProfile = useCallback(async () => {
    if (user?.email) {
      // Clear cache for this email so it re-fetches
      contextCache.delete(user.email.toLowerCase().trim());
      await fetchUserContext(user.email);
    }
  }, [user, fetchUserContext]);

  // ─── SIGN OUT ────────────────────────────────────────────
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[useAuth] signOut error:", err);
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setStaff(null);
    setDisplayName("");
    setInitials("??");
    setImpersonatedStaff(null);
    setImpersonatedProfile(null);
    setImpersonatedName("");
    try {
      sessionStorage.removeItem(IMPERSONATION_KEY);
    } catch {}
    contextCache.clear();
    // Clear the 7-day session login timestamp cookie
    document.cookie = "pms_last_login_at=; path=/; max-age=0";
    window.location.href = "/login";
  }, [supabase]);

  // ─── DEVELOPER IMPERSONATION ─────────────────────────────
  // Whether the REAL account may impersonate. Derived from the real profile's
  // is_developer flag — NEVER from the impersonated profile, so a developer can
  // never lose the ability to switch back by impersonating a non-admin.
  const canImpersonate = profile?.is_developer === true;

  // Load a target staff (and their linked users profile) and apply it as the
  // impersonated identity.
  const applyImpersonation = useCallback(
    async (staffId: string) => {
      // Fetch the target staff row.
      const { data: staffRow, error: staffErr } = await supabase
        .from("staff")
        .select("*")
        .eq("id", staffId)
        .maybeSingle();
      if (staffErr || !staffRow) {
        console.warn("[useAuth] impersonate: staff not found", staffErr?.message);
        return;
      }

      // Best-effort: fetch the target staff's users-table profile so permission
      // lookups and profile-derived UI match what that user would really see.
      // The impersonated profile is NEVER treated as a developer.
      let targetProfile: UserProfile | null = null;
      const { data: userRow } = await supabase
        .from("users")
        .select("*")
        .eq("member_id", staffId)
        .maybeSingle();
      if (userRow) {
        targetProfile = {
          id: userRow.id,
          email: userRow.email ?? null,
          user_type: userRow.user_type ?? null,
          member: userRow.member ?? null,
          member_id: userRow.member_id ?? null,
          supplier: userRow.supplier ?? null,
          supplier_id: userRow.supplier_id ?? null,
          customer: userRow.customer ?? null,
          customer_id: userRow.customer_id ?? null,
          is_developer: false, // impersonated identity is never a developer
        };
      }

      const name = staffRow.name || staffRow.full_name || "Staff";
      setImpersonatedStaff(staffRow as StaffData);
      setImpersonatedProfile(targetProfile);
      setImpersonatedName(name);
    },
    [supabase]
  );

  const impersonate = useCallback(
    async (staffId: string) => {
      // Guard: only real developers may impersonate.
      if (profile?.is_developer !== true) return;
      // Switching back to your own staff = stop impersonating.
      if (staff && staffId === staff.id && !impersonatedStaff) return;
      try {
        sessionStorage.setItem(IMPERSONATION_KEY, staffId);
      } catch {}
      await applyImpersonation(staffId);
    },
    [profile, staff, impersonatedStaff, applyImpersonation]
  );

  const stopImpersonating = useCallback(() => {
    setImpersonatedStaff(null);
    setImpersonatedProfile(null);
    setImpersonatedName("");
    try {
      sessionStorage.removeItem(IMPERSONATION_KEY);
    } catch {}
  }, []);

  // Restore an in-progress impersonation after navigation / reload, but only
  // once the real account is resolved AND confirmed as a developer.
  useEffect(() => {
    if (isLoading) return;
    if (profile?.is_developer !== true) return;
    if (impersonatedStaff) return;
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(IMPERSONATION_KEY);
    } catch {}
    // Don't impersonate yourself.
    if (saved && saved !== staff?.id) {
      applyImpersonation(saved);
    }
  }, [isLoading, profile, staff, impersonatedStaff, applyImpersonation]);

  // ─── 7-DAY SESSION EXPIRY CHECK (Client-Side) ──────────────
  // Periodically check if the session has exceeded 7 days
  useEffect(() => {
    const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

    const checkSessionExpiry = () => {
      const cookies = document.cookie.split(";").reduce((acc, c) => {
        const [key, val] = c.trim().split("=");
        if (key && val) acc[key] = val;
        return acc;
      }, {} as Record<string, string>);

      const lastLoginAt = cookies["pms_last_login_at"];
      if (lastLoginAt) {
        const elapsed = Date.now() - parseInt(lastLoginAt, 10);
        if (elapsed > SESSION_MAX_AGE_MS) {
          // Session expired — force sign out
          document.cookie = "pms_last_login_at=; path=/; max-age=0";
          supabase.auth.signOut().finally(() => {
            window.location.href = "/login?reason=session_expired";
          });
        }
      }
    };

    // Check every 5 minutes
    const interval = setInterval(checkSessionExpiry, 5 * 60 * 1000);
    // Also check once on mount
    checkSessionExpiry();

    return () => clearInterval(interval);
  }, [supabase]);

  // ─── INITIALIZATION ──────────────────────────────────────
  // Important for iOS/iPad Safari:
  // 1. Never register onAuthStateChange in the same tick as getSession while
  //    initialize() is still running — that deadlocks auth-js (#2344).
  // 2. Always clear isLoading within AUTH_INIT_TIMEOUT_MS so RouteGuard cannot
  //    spin forever if getSession hangs (orphaned locks / tab resume).
  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;
    const AUTH_INIT_TIMEOUT_MS = 8000;

    const applySession = async (currentSession: Session | null) => {
      setSession(currentSession);

      if (currentSession?.user) {
        setUser(currentSession.user);

        // Only fetch user context if NOT already seeded from server
        if (!hasServerData && currentSession.user.email) {
          await fetchUserContext(currentSession.user.email);
        }
      } else if (!hasServerData) {
        // No session and no server data — clear state
        setUser(null);
        setProfile(null);
        setStaff(null);
        setDisplayName("");
        setInitials("??");
      }
    };

    const recoverFromLocalStorage = async () => {
      try {
        let storageAvailable = false;
        try {
          storageAvailable = typeof localStorage !== "undefined" && localStorage !== null;
          localStorage.getItem("__test__");
        } catch {
          storageAvailable = false;
        }

        if (!storageAvailable) return;

        const storageKey = Object.keys(localStorage).find(
          (k) => k.startsWith("sb-") && k.endsWith("-auth-token")
        );
        if (!storageKey) return;

        const stored = localStorage.getItem(storageKey);
        if (!stored) return;

        const parsed = JSON.parse(stored);
        const storedUser = parsed?.user;
        const storedEmail = storedUser?.email;
        if (storedUser && storedEmail) {
          setUser(storedUser);
          setSession(parsed as Session);
          if (!hasServerData) {
            await fetchUserContext(storedEmail);
          }
        }
      } catch {
        console.warn("[useAuth] localStorage fallback failed");
      }
    };

    const initSession = async () => {
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), AUTH_INIT_TIMEOUT_MS)
        );

        type SessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>;
        const raced = await Promise.race([
          sessionPromise.then(
            (result: SessionResult): { ok: true; result: SessionResult } => ({
              ok: true,
              result,
            })
          ),
          timeoutPromise.then(
            (): { ok: false; result: null } => ({ ok: false, result: null })
          ),
        ]);

        if (!mounted) return;

        if (!raced.ok) {
          console.warn(
            `[useAuth] getSession timed out after ${AUTH_INIT_TIMEOUT_MS}ms — clearing loading state`
          );
          await recoverFromLocalStorage();
          return;
        }

        const {
          data: { session: currentSession },
        } = raced.result;

        await applySession(currentSession);
      } catch {
        if (!mounted) return;
        await recoverFromLocalStorage();
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }

      // Subscribe only AFTER init finished so we never deadlock initialize().
      if (!mounted) return;
      const { data } = supabase.auth.onAuthStateChange(
        (_event: AuthChangeEvent, newSession: Session | null) => {
          if (!mounted) return;
          setSession(newSession);
          setUser(newSession?.user ?? null);

          if (newSession?.user?.email) {
            // Fire-and-forget — do not await inside the listener (re-entry deadlock risk)
            void fetchUserContext(newSession.user.email);
          } else {
            setProfile(null);
            setStaff(null);
            setDisplayName("");
            setInitials("??");
          }
        }
      );
      subscription = data.subscription;
    };

    void initSession();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [supabase, fetchUserContext, hasServerData]);

  // ─── EFFECTIVE (possibly impersonated) IDENTITY ──────────
  const isImpersonating = !!impersonatedStaff;
  const effectiveStaff = impersonatedStaff ?? staff;
  const effectiveProfile = impersonatedStaff ? impersonatedProfile : profile;
  const effectiveDisplayName = impersonatedStaff ? impersonatedName : displayName;
  const effectiveInitials = impersonatedStaff
    ? computeInitials(impersonatedName)
    : initials;

  useEffect(() => {
    setActingStaffId(effectiveStaff?.id ?? null);
    return () => setActingStaffId(null);
  }, [effectiveStaff?.id]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile: effectiveProfile,
        staff: effectiveStaff,
        displayName: effectiveDisplayName,
        initials: effectiveInitials,
        isLoading,
        isLoggedIn: !!user,
        signOut,
        refreshProfile,
        isImpersonating,
        canImpersonate,
        realStaff: staff,
        realDisplayName: displayName,
        impersonate,
        stopImpersonating,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
