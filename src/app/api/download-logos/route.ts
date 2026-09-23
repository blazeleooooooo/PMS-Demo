import { NextRequest, NextResponse } from "next/server";

// ─── BULK LOGO DOWNLOAD (store-mode ZIP, no dependency) ───────
// POST { items: [{ url, name }] } → a .zip of the fetched logo images.
// Images are already compressed, so we use ZIP "store" mode (no deflate),
// which lets us build a valid archive without any third-party library.

interface ZipEntry {
  name: string;
  data: Uint8Array;
  crc: number;
}

// Same trusted-host allowlist as /api/download-image.
const ALLOWED_HOSTS = ["supabase.co", "supabase.com", "supabase.in", "cdn.bubble.io"];

function isTrusted(hostname: string): boolean {
  return ALLOWED_HOSTS.some(
    (h) => hostname === h || hostname.endsWith(`.${h}`) || hostname === "localhost"
  );
}

// CRC-32 (used by the ZIP format).
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Sanitize + de-duplicate file names within the archive.
function uniqueName(base: string, used: Set<string>): string {
  let name = base.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim() || "logo";
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let i = 2;
  let candidate = `${stem} (${i})${ext}`;
  while (used.has(candidate)) candidate = `${stem} (${++i})${ext}`;
  used.add(candidate);
  return candidate;
}

function ext(contentType: string, url: string): string {
  const fromUrl = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (fromUrl && /^(png|jpe?g|gif|webp|svg)$/.test(fromUrl)) return fromUrl === "jpeg" ? "jpg" : fromUrl;
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("svg")) return "svg";
  return "img";
}

function buildZip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const size = e.data.length;

    // Local file header (sig 0x04034b50).
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true); // version needed
    lh.setUint16(6, 0x0800, true); // flags: UTF-8 names
    lh.setUint16(8, 0, true); // method: store
    lh.setUint16(10, 0, true); // mod time
    lh.setUint16(12, 0, true); // mod date
    lh.setUint32(14, e.crc, true);
    lh.setUint32(18, size, true); // compressed
    lh.setUint32(22, size, true); // uncompressed
    lh.setUint16(26, nameBytes.length, true);
    lh.setUint16(28, 0, true); // extra len
    const localHeader = new Uint8Array(lh.buffer);

    chunks.push(localHeader, nameBytes, e.data);

    // Central directory record (sig 0x02014b50).
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true); // version made by
    cd.setUint16(6, 20, true); // version needed
    cd.setUint16(8, 0x0800, true); // flags
    cd.setUint16(10, 0, true); // method
    cd.setUint16(12, 0, true);
    cd.setUint16(14, 0, true);
    cd.setUint32(16, e.crc, true);
    cd.setUint32(20, size, true);
    cd.setUint32(24, size, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint16(30, 0, true); // extra
    cd.setUint16(32, 0, true); // comment
    cd.setUint16(34, 0, true); // disk
    cd.setUint16(36, 0, true); // internal attrs
    cd.setUint32(38, 0, true); // external attrs
    cd.setUint32(42, offset, true); // local header offset
    central.push(new Uint8Array(cd.buffer), nameBytes);

    offset += localHeader.length + nameBytes.length + size;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const c of central) centralSize += c.length;

  // End of central directory.
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, entries.length, true);
  eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, centralStart, true);
  eocd.setUint16(20, 0, true);

  const all = [...chunks, ...central, new Uint8Array(eocd.buffer)];
  let total = 0;
  for (const c of all) total += c.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of all) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

export async function POST(request: NextRequest) {
  let body: { items?: { url: string; name: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "No items provided" }, { status: 400 });
  }
  if (items.length > 500) {
    return NextResponse.json({ error: "Too many items (max 500)" }, { status: 400 });
  }

  const entries: ZipEntry[] = [];
  const used = new Set<string>();
  const failed: string[] = [];

  await Promise.all(
    items.map(async (it) => {
      let url = it.url;
      if (!url) return;
      if (url.startsWith("//")) url = `https:${url}`;
      try {
        const parsed = new URL(url);
        if (!isTrusted(parsed.hostname)) {
          failed.push(it.name);
          return;
        }
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; BWA-PMS/1.0)" },
        });
        if (!res.ok) {
          failed.push(it.name);
          return;
        }
        const buf = new Uint8Array(await res.arrayBuffer());
        const fileName = uniqueName(
          `${it.name}.${ext(res.headers.get("content-type") || "", url)}`,
          used
        );
        entries.push({ name: fileName, data: buf, crc: crc32(buf) });
      } catch {
        failed.push(it.name);
      }
    })
  );

  if (entries.length === 0) {
    return NextResponse.json(
      { error: "No images could be downloaded", failed },
      { status: 502 }
    );
  }

  const zip = buildZip(entries);
  const headers = new Headers();
  headers.set("Content-Type", "application/zip");
  headers.set("Content-Disposition", `attachment; filename="brand-logos.zip"`);
  headers.set("Content-Length", String(zip.length));
  headers.set("Cache-Control", "no-store");
  if (failed.length) headers.set("X-Failed-Count", String(failed.length));
  // Body must be a fresh ArrayBuffer slice for the Response type.
  return new NextResponse(zip.slice().buffer as ArrayBuffer, { status: 200, headers });
}
