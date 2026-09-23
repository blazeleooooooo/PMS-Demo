import {
  BoxClient,
  BoxDeveloperTokenAuth,
  BoxJwtAuth,
  JwtConfig,
} from "box-node-sdk";
import {
  parseBoxWorkingFolderPath,
  splitBoxRelativePath,
} from "@/lib/box-path";

export { parseBoxWorkingFolderPath, splitBoxRelativePath } from "@/lib/box-path";

interface BoxApiItem {
  id?: string;
  type?: string;
  name?: string;
  size?: number;
  modifiedAt?: string;
  contentModifiedAt?: string;
}

export interface BoxFolderItem {
  id: string;
  type: "file" | "folder" | "web_link";
  name: string;
  size: number | null;
  modified_at: string | null;
  box_url: string;
}

export interface BoxFolderListing {
  folder_id: string;
  folder_name: string | null;
  relative_path: string;
  local_path: string | null;
  items: BoxFolderItem[];
  total_count: number;
  offset: number;
  limit: number;
}

function normalizePrivateKey(raw: string): string {
  return raw.replace(/\\n/g, "\n");
}

export function isBoxConfigured(): boolean {
  if (process.env.BOX_DEVELOPER_TOKEN?.trim()) return true;
  if (process.env.BOX_JWT_CONFIG_JSON?.trim()) return true;
  return Boolean(
    process.env.BOX_CLIENT_ID?.trim() &&
      process.env.BOX_CLIENT_SECRET?.trim() &&
      process.env.BOX_JWT_KEY_ID?.trim() &&
      process.env.BOX_PRIVATE_KEY?.trim() &&
      (process.env.BOX_ENTERPRISE_ID?.trim() || process.env.BOX_USER_ID?.trim())
  );
}

export function getBoxConfigHelpMessage(): string {
  return [
    "Configure Box in `.env.local` using one of:",
    "1) `BOX_JWT_CONFIG_JSON` — paste the full JSON from the Box Developer Console, or",
    "2) `BOX_CLIENT_ID`, `BOX_CLIENT_SECRET`, `BOX_JWT_KEY_ID`, `BOX_PRIVATE_KEY`, and `BOX_ENTERPRISE_ID`.",
    "Optional: `BOX_USER_ID` to read folders from a specific user's Box Drive, and `BOX_ROOT_FOLDER_ID` if the cloud root is not folder 0.",
    "For quick testing only: `BOX_DEVELOPER_TOKEN` (expires in ~60 minutes).",
  ].join(" ");
}

function createBoxAuth(): BoxJwtAuth | BoxDeveloperTokenAuth {
  const developerToken = process.env.BOX_DEVELOPER_TOKEN?.trim();
  if (developerToken) {
    return new BoxDeveloperTokenAuth({ token: developerToken });
  }

  const configJson = process.env.BOX_JWT_CONFIG_JSON?.trim();
  if (configJson) {
    const jwtConfig = JwtConfig.fromConfigJsonString(configJson);
    const jwtAuth = new BoxJwtAuth({ config: jwtConfig });
    const userId = process.env.BOX_USER_ID?.trim();
    return userId ? jwtAuth.withUserSubject(userId) : jwtAuth;
  }

  const clientId = process.env.BOX_CLIENT_ID?.trim();
  const clientSecret = process.env.BOX_CLIENT_SECRET?.trim();
  const jwtKeyId = process.env.BOX_JWT_KEY_ID?.trim();
  const privateKey = process.env.BOX_PRIVATE_KEY?.trim();
  const enterpriseId = process.env.BOX_ENTERPRISE_ID?.trim();
  const userId = process.env.BOX_USER_ID?.trim();

  if (!clientId || !clientSecret || !jwtKeyId || !privateKey) {
    throw new Error(getBoxConfigHelpMessage());
  }

  if (!enterpriseId && !userId) {
    throw new Error(
      "BOX_ENTERPRISE_ID or BOX_USER_ID is required for JWT authentication."
    );
  }

  const jwtConfig = new JwtConfig({
    clientId,
    clientSecret,
    jwtKeyId,
    privateKey: normalizePrivateKey(privateKey),
    privateKeyPassphrase: process.env.BOX_PRIVATE_KEY_PASSPHRASE?.trim() ?? "",
    enterpriseId: enterpriseId || undefined,
    userId: userId || undefined,
  });

  const jwtAuth = new BoxJwtAuth({ config: jwtConfig });
  return userId ? jwtAuth.withUserSubject(userId) : jwtAuth;
}

export function createBoxClient(): BoxClient {
  if (!isBoxConfigured()) {
    throw new Error(getBoxConfigHelpMessage());
  }

  const auth = createBoxAuth();
  return new BoxClient({ auth });
}

function boxItemUrl(item: BoxApiItem): string {
  const id = item.id ?? "";
  if (!id) return "https://app.box.com";
  if (item.type === "folder") return `https://app.box.com/folder/${id}`;
  if (item.type === "file") return `https://app.box.com/file/${id}`;
  return "https://app.box.com";
}

function mapBoxItem(item: BoxApiItem): BoxFolderItem {
  return {
    id: item.id ?? "",
    type: item.type === "folder" || item.type === "web_link" ? item.type : "file",
    name: item.name ?? "Untitled",
    size: item.type === "file" && typeof item.size === "number" ? item.size : null,
    modified_at: item.modifiedAt ?? item.contentModifiedAt ?? null,
    box_url: boxItemUrl(item),
  };
}

async function findChildFolderId(
  client: BoxClient,
  parentFolderId: string,
  childName: string
): Promise<string | null> {
  const target = childName.trim();
  let offset = 0;
  const limit = 1000;

  while (true) {
    const page = await client.folders.getFolderItems(parentFolderId, {
      queryParams: { limit, offset, fields: ["id", "name", "type"] },
    });

    const match = (page.entries ?? []).find(
      (entry) => entry.type === "folder" && entry.name === target
    );

    if (match && "id" in match && match.id) {
      return match.id;
    }

    const total = page.totalCount ?? 0;
    offset += page.entries?.length ?? 0;
    if (offset >= total || (page.entries?.length ?? 0) === 0) {
      return null;
    }
  }
}

export async function resolveBoxFolderIdByRelativePath(
  client: BoxClient,
  relativePath: string
): Promise<{ folderId: string; folderName: string | null }> {
  const segments = splitBoxRelativePath(relativePath);
  if (segments.length === 0) {
    throw new Error("Working folder path is empty after removing the D:\\Box\\ prefix.");
  }

  let currentFolderId = process.env.BOX_ROOT_FOLDER_ID?.trim() || "0";
  let currentFolderName: string | null = null;

  for (const segment of segments) {
    const nextFolderId = await findChildFolderId(client, currentFolderId, segment);
    if (!nextFolderId) {
      throw new Error(
        `Could not find Box folder "${segment}" under "${currentFolderName ?? currentFolderId}". Check that the JWT app (or BOX_USER_ID) can access this folder tree.`
      );
    }
    currentFolderId = nextFolderId;
    currentFolderName = segment;
  }

  return { folderId: currentFolderId, folderName: currentFolderName };
}

export async function listBoxFolderItems(
  client: BoxClient,
  folderId: string,
  options?: { offset?: number; limit?: number }
): Promise<{
  folderId: string;
  folderName: string | null;
  items: BoxFolderItem[];
  totalCount: number;
  offset: number;
  limit: number;
}> {
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? 200;

  const [folder, page] = await Promise.all([
    client.folders.getFolderById(folderId, {
      queryParams: { fields: ["id", "name"] },
    }),
    client.folders.getFolderItems(folderId, {
      queryParams: {
        limit,
        offset,
        fields: ["id", "name", "type", "size", "modified_at", "content_modified_at"],
      },
    }),
  ]);

  const items = (page.entries ?? [])
    .map((entry) => mapBoxItem(entry as BoxApiItem))
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

  return {
    folderId,
    folderName: folder.name ?? null,
    items,
    totalCount: page.totalCount ?? items.length,
    offset: page.offset ?? offset,
    limit: page.limit ?? limit,
  };
}

export async function fetchBoxWorkingFolderListing(params: {
  workingFolder: string;
  folderId?: string | null;
  offset?: number;
  limit?: number;
}): Promise<BoxFolderListing> {
  const parsed = parseBoxWorkingFolderPath(params.workingFolder);
  if (!parsed) {
    throw new Error(
      "This project does not have a Box working folder (expected a path starting with D:\\Box\\)."
    );
  }

  const client = createBoxClient();

  if (params.folderId) {
    const listing = await listBoxFolderItems(client, params.folderId, {
      offset: params.offset,
      limit: params.limit,
    });

    return {
      folder_id: listing.folderId,
      folder_name: listing.folderName,
      relative_path: parsed.relativePath,
      local_path: parsed.localPath,
      items: listing.items,
      total_count: listing.totalCount,
      offset: listing.offset,
      limit: listing.limit,
    };
  }

  const resolved = await resolveBoxFolderIdByRelativePath(
    client,
    parsed.relativePath
  );
  const listing = await listBoxFolderItems(client, resolved.folderId, {
    offset: params.offset,
    limit: params.limit,
  });

  return {
    folder_id: listing.folderId,
    folder_name: listing.folderName ?? resolved.folderName,
    relative_path: parsed.relativePath,
    local_path: parsed.localPath,
    items: listing.items,
    total_count: listing.totalCount,
    offset: listing.offset,
    limit: listing.limit,
  };
}
