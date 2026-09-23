"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { AccessDenied } from "@/components/ui/access-denied";
import { isPublicRoute, resolvePermissionModule } from "@/lib/route-modules";

interface RouteGuardProps {
  children: React.ReactNode;
}

/** Fail-safe: never leave iPad Safari on a blank spinner if auth init hangs. */
const AUTH_WAIT_MAX_MS = 10000;

/**
 * Global client-side gate for staff routes:
 * - Redirect unauthenticated users to /login
 * - Block pages the user cannot view (module permission)
 */
export function RouteGuard({ children }: RouteGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  const { canView, loading: permLoading } = usePermission();
  const [authWaitTimedOut, setAuthWaitTimedOut] = useState(false);

  const isPublic = isPublicRoute(pathname);
  const module = resolvePermissionModule(pathname);

  useEffect(() => {
    if (isPublic || !authLoading) {
      setAuthWaitTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setAuthWaitTimedOut(true), AUTH_WAIT_MAX_MS);
    return () => clearTimeout(timer);
  }, [isPublic, authLoading]);

  useEffect(() => {
    if (isPublic) return;
    if (authLoading && !authWaitTimedOut) return;
    if (isLoggedIn) return;
    router.replace("/login");
  }, [isPublic, authLoading, authWaitTimedOut, isLoggedIn, router]);

  if (isPublic) {
    return <>{children}</>;
  }

  const waitingForAuth = authLoading && !authWaitTimedOut;
  const waitingForPermission = isLoggedIn && !!module && permLoading;

  if (waitingForAuth || waitingForPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bw-bg">
        <Loader2 className="w-8 h-8 animate-spin text-bw-blue" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bw-bg">
        <Loader2 className="w-8 h-8 animate-spin text-bw-blue" />
      </div>
    );
  }

  if (module && !canView(module)) {
    return <AccessDenied module={module} fullPage />;
  }

  return <>{children}</>;
}
