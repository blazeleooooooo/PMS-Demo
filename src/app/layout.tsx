import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProviderClient } from "@/components/auth-provider-client";
import { getUserContextServer } from "@/lib/supabase/get-user-context-server";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Acme Project OS",
  description: "Demo project management workspace",
  icons: {
    icon: "/images/pms-logo.png",
    apple: "/images/pms-logo.png",
  },
  appleWebApp: {
    capable: true,
    title: "Acme Project OS",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1A2035",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch auth + user context server-side — eliminates client re-fetch on every page load
  const initialAuthData = await getUserContextServer();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProviderClient initialData={initialAuthData}>
          {children}
        </AuthProviderClient>
        <Toaster />
      </body>
    </html>
  );
}
