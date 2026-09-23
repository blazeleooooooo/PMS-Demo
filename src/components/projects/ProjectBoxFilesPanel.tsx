"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  ExternalLink,
  File,
  Folder,
  FolderOpen,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTimestamp } from "@/lib/date-utils";

interface BoxFolderItem {
  id: string;
  type: "file" | "folder" | "web_link";
  name: string;
  size: number | null;
  modified_at: string | null;
  box_url: string;
}

interface BoxFolderResponse {
  success?: boolean;
  error?: string;
  help?: string;
  working_folder?: string;
  relative_path?: string;
  local_path?: string;
  folder_id?: string;
  folder_name?: string | null;
  items?: BoxFolderItem[];
  total_count?: number;
}

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

interface ProjectBoxFilesPanelProps {
  projectId: string;
  workingFolder: string | null;
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function itemTypeLabel(type: BoxFolderItem["type"]): string {
  if (type === "folder") return "資料夾";
  if (type === "web_link") return "連結";
  return "檔案";
}

export default function ProjectBoxFilesPanel({
  projectId,
  workingFolder,
}: ProjectBoxFilesPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState<string | null>(null);
  const [items, setItems] = useState<BoxFolderItem[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [localPath, setLocalPath] = useState<string | null>(null);
  const [relativePath, setRelativePath] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [trail, setTrail] = useState<BreadcrumbItem[]>([
    { id: null, name: "工作資料夾" },
  ]);

  const currentFolderUrl = useMemo(() => {
    if (!folderId) return null;
    return `https://app.box.com/folder/${folderId}`;
  }, [folderId]);

  const loadFolder = useCallback(
    async (targetFolderId: string | null, nextTrail?: BreadcrumbItem[]) => {
      if (!workingFolder) return;

      setLoading(true);
      setError(null);
      setHelp(null);

      try {
        const params = new URLSearchParams({ projectId });
        if (targetFolderId) {
          params.set("folderId", targetFolderId);
        }

        const response = await fetch(`/api/box/folder-items?${params.toString()}`);
        const payload = (await response.json()) as BoxFolderResponse;

        if (!response.ok) {
          setItems([]);
          setFolderId(null);
          setFolderName(null);
          setTotalCount(0);
          setError(payload.error || "Failed to load Box folder");
          setHelp(payload.help ?? null);
          return;
        }

        setItems(payload.items ?? []);
        setFolderId(payload.folder_id ?? null);
        setFolderName(payload.folder_name ?? null);
        setLocalPath(payload.local_path ?? null);
        setRelativePath(payload.relative_path ?? null);
        setTotalCount(payload.total_count ?? payload.items?.length ?? 0);
        if (nextTrail) {
          setTrail(nextTrail);
        } else if (!targetFolderId) {
          setTrail([
            {
              id: payload.folder_id ?? null,
              name: payload.folder_name || "工作資料夾",
            },
          ]);
        }
      } catch (err) {
        console.error("[ProjectBoxFilesPanel] loadFolder error:", err);
        setError("Failed to load Box folder");
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [projectId, workingFolder]
  );

  useEffect(() => {
    loadFolder(null);
  }, [loadFolder]);

  const openFolder = (item: BoxFolderItem) => {
    if (item.type !== "folder") return;
    const nextTrail = [...trail, { id: item.id, name: item.name }];
    loadFolder(item.id, nextTrail);
  };

  const jumpToCrumb = (index: number) => {
    const target = trail[index];
    const nextTrail = trail.slice(0, index + 1);
    loadFolder(target.id, nextTrail);
  };

  if (!workingFolder) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
          <FolderOpen className="w-7 h-7 text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-500 mb-1">尚未設定工作資料夾</p>
        <p className="text-xs text-gray-400 max-w-sm">
          在項目編輯頁面加入以 `D:\Box\` 開頭的工作資料夾路徑後，即可在此瀏覽 Box 檔案。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FolderOpen className="w-4 h-4 text-blue-500 shrink-0" />
            <p className="text-sm font-medium text-gray-800 truncate">
              {folderName || "Box 工作資料夾"}
            </p>
            {totalCount > 0 && (
              <Badge variant="outline" className="text-[11px] px-1.5 py-0 h-5">
                {totalCount} 項
              </Badge>
            )}
          </div>
          {localPath && (
            <p className="text-xs text-gray-500 break-all">{localPath}</p>
          )}
          {relativePath && (
            <p className="text-xs text-gray-400 break-all mt-1">
              Box 路徑：{relativePath}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => loadFolder(folderId, trail)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                重新整理
              </>
            )}
          </Button>
          {currentFolderUrl && (
            <Button variant="outline" size="sm" className="text-xs" asChild>
              <a href={currentFolderUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                在 Box 開啟
              </a>
            </Button>
          )}
        </div>
      </div>

      {trail.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
          {trail.map((crumb, index) => (
            <React.Fragment key={`${crumb.id ?? "root"}-${index}`}>
              {index > 0 && <ChevronRight className="w-3 h-3 text-gray-300" />}
              <button
                type="button"
                onClick={() => jumpToCrumb(index)}
                className="hover:text-blue-600 transition-colors truncate max-w-[240px]"
                disabled={loading || index === trail.length - 1}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400 mr-2" />
          <span className="text-sm text-gray-400">載入 Box 檔案中...</span>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3">
          <p className="text-sm text-amber-800">{error}</p>
          {help && <p className="text-xs text-amber-700 mt-2 whitespace-pre-wrap">{help}</p>}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Folder className="w-10 h-10 text-gray-200 mb-3" />
          <p className="text-sm text-gray-500">此資料夾暫無檔案</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="text-xs">名稱</TableHead>
                <TableHead className="text-xs w-[90px]">類型</TableHead>
                <TableHead className="text-xs w-[110px]">大小</TableHead>
                <TableHead className="text-xs w-[170px]">修改時間</TableHead>
                <TableHead className="text-xs w-[80px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="hover:bg-gray-50/50">
                  <TableCell className="py-2.5">
                    {item.type === "folder" ? (
                      <button
                        type="button"
                        onClick={() => openFolder(item)}
                        className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 text-left"
                      >
                        <Folder className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-gray-800">
                        <File className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {itemTypeLabel(item.type)}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {formatFileSize(item.size)}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {item.modified_at ? formatTimestamp(item.modified_at) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
                      <a href={item.box_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
