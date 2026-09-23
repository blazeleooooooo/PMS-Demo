import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  let url = searchParams.get("url");
  const filename = searchParams.get("filename") || "download.jpg";

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Handle protocol-relative URLs (e.g. //cdn.bubble.io/...)
  if (url.startsWith("//")) {
    url = `https:${url}`;
  }

  try {
    // Validate that the URL is from a trusted domain
    const parsedUrl = new URL(url);
    const allowedHosts = [
      // Supabase storage
      "supabase.co",
      "supabase.com",
      "supabase.in",
      // Legacy Bubble.io CDN (old project data)
      "cdn.bubble.io",
    ];
    const isTrusted = allowedHosts.some(
      (host) =>
        parsedUrl.hostname === host ||
        parsedUrl.hostname.endsWith(`.${host}`) ||
        parsedUrl.hostname === "localhost"
    );

    if (!isTrusted) {
      return NextResponse.json(
        { error: `URL domain not allowed: ${parsedUrl.hostname}` },
        { status: 403 }
      );
    }

    const response = await fetch(url, {
      headers: {
        // Some CDNs need a User-Agent to respond properly
        "User-Agent": "Mozilla/5.0 (compatible; BWA-PMS/1.0)",
      },
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${response.status}` },
        { status: response.status }
      );
    }

    const blob = await response.blob();

    // Determine content type - use response type, or infer from filename/url
    let contentType = blob.type;
    if (!contentType || contentType === "application/octet-stream") {
      const ext = (filename || url).split(".").pop()?.split("?")[0]?.toLowerCase();
      const mimeMap: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
        svg: "image/svg+xml",
        pdf: "application/pdf",
      };
      contentType = (ext && mimeMap[ext]) || "application/octet-stream";
    }

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(filename)}"`
    );
    headers.set("Content-Length", String(blob.size));
    headers.set("Cache-Control", "no-store");

    return new NextResponse(blob, { status: 200, headers });
  } catch (error: unknown) {
    console.error("Download proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch image" },
      { status: 500 }
    );
  }
}
