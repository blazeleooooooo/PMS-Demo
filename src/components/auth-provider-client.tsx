"use client";

import { AuthProvider } from "@/hooks/use-auth";
import type { ServerAuthData } from "@/hooks/use-auth";
import { PermissionProvider } from "@/hooks/use-permission";
import { RouteGuard } from "@/components/auth/route-guard";
import ImpersonationWidget from "@/components/dev/ImpersonationWidget";

interface AuthProviderClientProps {
  children: React.ReactNode;
  initialData?: ServerAuthData | null;
}

export function AuthProviderClient({ children, initialData }: AuthProviderClientProps) {
  return (
    <AuthProvider initialData={initialData}>
      <PermissionProvider>
        <RouteGuard>{children}</RouteGuard>
        {/* Developer-only floating staff switcher + impersonation notice.
            Self-hides for non-developers. */}
        <ImpersonationWidget />
      </PermissionProvider>
    </AuthProvider>
  );
}
