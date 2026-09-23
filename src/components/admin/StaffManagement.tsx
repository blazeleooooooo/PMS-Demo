"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Filter,
  Lock,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Eye,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchStaffForManagement,
  updateStaffMember,
  createStaffMember,
  deleteStaffMember,
  fetchCostCentres,
  fetchTeamTypeOptions,
  type StaffManagementRow,
  type CostCentreData,
  type LinkOption,
} from "@/lib/data-service";
import { formatDate } from "@/lib/date-utils";
import { usePermission } from "@/hooks/use-permission";

// Inactive team types: strikethrough + muted (same convention as inactive staff).
const INACTIVE_TEAM_STRIKE: React.CSSProperties = {
  textDecoration: "line-through",
  color: "#9ca3af",
};

// ─── HELPERS ────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatWorkDuration(entryDate: string | null): string {
  if (!entryDate) return "—";
  const entry = new Date(entryDate);
  if (isNaN(entry.getTime())) return "—";
  const now = new Date();
  const months =
    (now.getFullYear() - entry.getFullYear()) * 12 +
    (now.getMonth() - entry.getMonth());
  if (months < 1) return "少於 1 個月";
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) return `${remainingMonths} 個月`;
  if (remainingMonths === 0) return `${years} 年`;
  // years + leftover months (not a decimal year value)
  return `${years} 年 ${remainingMonths} 個月`;
}

function getBuDisplay(bu: string | null): string {
  if (!bu) return "N/A";
  return bu;
}

function getRoleDisplay(role: string | null): string {
  // Canonical permission roles: Super Admin / Admin / Senior User / User.
  if (!role) return "User";
  const lower = role.toLowerCase();
  if (lower.includes("super") && lower.includes("admin")) return "Super Admin";
  if (lower === "admin" || lower.includes("admin")) return "Admin";
  if (lower.includes("senior")) return "Senior User";
  return "User";
}

function getPositionDisplay(position: string | null, role: string | null): string {
  if (position) return position;
  if (role) return role;
  return "—";
}

function getTeamDisplay(teamType: string | null): string {
  if (!teamType) return "—";
  return teamType;
}


// ─── ROLE FILTER CARDS COMPONENT ────────────────────────────

interface RoleCountCardProps {
  label: string;
  sublabel: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function RoleCountCard({ label, sublabel, count, active, onClick }: RoleCountCardProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between px-5 py-4 rounded-xl border transition-all duration-200 min-w-[200px] ${
        active
          ? "border-bw-blue bg-bw-blue/5 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div className="text-left">
        <p
          className={`text-sm font-semibold ${
            active ? "text-bw-blue" : "text-gray-700"
          }`}
        >
          {label}
        </p>
        <p className="text-xs text-gray-400">{sublabel}</p>
      </div>
      <span
        className={`text-2xl font-bold ml-6 ${
          active ? "text-bw-blue" : "text-gray-800"
        }`}
        style={{ fontFamily: "Syne, sans-serif" }}
      >
        {count}
      </span>
    </button>
  );
}

// ─── STATUS BADGE ────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  const isActive =
    !status || status.toLowerCase() === "active";
  const isInactive = status?.toLowerCase() === "inactive";

  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Active
      </span>
    );
  }
  if (isInactive) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        Inactive
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs font-medium text-amber-500">
      未連接帳戶
    </span>
  );
}

// ─── CREATE / EDIT DIALOG ────────────────────────────────────

interface StaffFormData {
  name: string;
  full_name: string;
  email: string;
  position: string;
  role: string;
  status: string;
  dual_system: boolean;
  private_phone: string;
  work_phone: string;
  entry_date: string;
  bu_id: string;
  n_team_type_id: string;
  quote_initial: string;
}

const emptyFormData: StaffFormData = {
  name: "",
  full_name: "",
  email: "",
  position: "",
  role: "",
  status: "Active",
  dual_system: false,
  private_phone: "",
  work_phone: "",
  entry_date: new Date().toISOString().split("T")[0],
  bu_id: "",
  n_team_type_id: "",
  quote_initial: "",
};

interface StaffFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: StaffFormData) => void;
  saving: boolean;
  staff?: StaffManagementRow | null;
  mode: "create" | "edit";
}

function StaffFormDialog({ open, onClose, onSave, saving, staff, mode }: StaffFormDialogProps) {
  const [form, setForm] = useState<StaffFormData>(emptyFormData);
  // Reveal inline validation only after the user attempts to save.
  const [showErrors, setShowErrors] = useState(false);
  // Cost centres (BU options), loaded once when the dialog first opens.
  const [costCentres, setCostCentres] = useState<CostCentreData[]>([]);
  // Team type options, loaded once when the dialog first opens.
  const [teamTypes, setTeamTypes] = useState<LinkOption[]>([]);

  useEffect(() => {
    if (open && costCentres.length === 0) {
      fetchCostCentres().then(setCostCentres).catch(() => {});
    }
    if (open && teamTypes.length === 0) {
      fetchTeamTypeOptions(true).then(setTeamTypes).catch(() => {});
    }
  }, [open, costCentres.length, teamTypes.length]);

  // All form fields required for create/edit (dual_system is a boolean toggle).
  const missing = {
    name: !form.name.trim(),
    full_name: !form.full_name.trim(),
    email: !form.email.trim(),
    position: !form.position.trim(),
    role: !form.role.trim(),
    bu_id: !form.bu_id.trim(),
    n_team_type_id: !form.n_team_type_id.trim(),
    status: !form.status.trim(),
    entry_date: !form.entry_date.trim(),
    private_phone: !form.private_phone.trim(),
    work_phone: !form.work_phone.trim(),
  };
  const hasMissing = Object.values(missing).some(Boolean);

  function handleSave() {
    if (hasMissing) {
      setShowErrors(true);
      return;
    }
    onSave(form);
  }

  useEffect(() => {
    if (open) {
      setShowErrors(false);
      if (mode === "edit" && staff) {
        setForm({
          name: staff.name || "",
          full_name: staff.full_name || "",
          email: staff.email || "",
          position: staff.position || "",
          role: staff.role || "",
          status: staff.status || "Active",
          dual_system: staff.dual_system ?? false,
          private_phone: staff.private_phone || "",
          work_phone: staff.work_phone || "",
          // entry_date may be a full timestamp; <input type="date"> needs YYYY-MM-DD.
          entry_date: staff.entry_date ? staff.entry_date.split("T")[0] : "",
          bu_id: staff.bu_id || "",
          n_team_type_id: staff.n_team_type_id || "",
          quote_initial: staff.quote_initial || "",
        });
      } else {
        setForm(emptyFormData);
      }
    }
  }, [open, mode, staff]);

  const updateField = (field: keyof StaffFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-bw-navy" style={{ fontFamily: "Syne, sans-serif" }}>
            {mode === "create" ? "新增職員" : "編輯職員資料"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">姓名 Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="輸入姓名..."
                className={`w-full text-sm border rounded-lg px-3 py-2 outline-none focus:border-bw-blue ${
                  showErrors && missing.name ? "border-red-400" : "border-gray-200"
                }`}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">全名 Full Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => updateField("full_name", e.target.value)}
                placeholder="輸入全名..."
                className={`w-full text-sm border rounded-lg px-3 py-2 outline-none focus:border-bw-blue ${
                  showErrors && missing.full_name ? "border-red-400" : "border-gray-200"
                }`}
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase">電郵 Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="輸入電郵..."
              className={`w-full text-sm border rounded-lg px-3 py-2 outline-none focus:border-bw-blue ${
                showErrors && missing.email ? "border-red-400" : "border-gray-200"
              }`}
            />
          </div>

          {/* Position + Role */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">職位 Position <span className="text-red-500">*</span></label>
              <select
                value={form.position}
                onChange={(e) => updateField("position", e.target.value)}
                className={`w-full text-sm border rounded-lg px-3 py-2 outline-none focus:border-bw-blue bg-white ${
                  showErrors && missing.position ? "border-red-400" : "border-gray-200"
                }`}
              >
                <option value="">未指定</option>
                <option value="PM">PM</option>
                <option value="Designer">Designer</option>
                <option value="Company">Company</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">權限角色 Role <span className="text-red-500">*</span></label>
              <select
                value={form.role}
                onChange={(e) => updateField("role", e.target.value)}
                className={`w-full text-sm border rounded-lg px-3 py-2 outline-none focus:border-bw-blue bg-white ${
                  showErrors && missing.role ? "border-red-400" : "border-gray-200"
                }`}
              >
                <option value="">未指定</option>
                <option value="Super Admin">Super Admin</option>
                <option value="Admin">Admin</option>
                <option value="Senior User">Senior User</option>
                <option value="User">User</option>
              </select>
            </div>
          </div>

          {/* BU (Cost Centre) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase">公司單位 BU <span className="text-red-500">*</span></label>
            <select
              value={form.bu_id}
              onChange={(e) => updateField("bu_id", e.target.value)}
              className={`w-full text-sm border rounded-lg px-3 py-2 outline-none focus:border-bw-blue bg-white ${
                showErrors && missing.bu_id ? "border-red-400" : "border-gray-200"
              }`}
            >
              <option value="">未指定</option>
              {costCentres.map((cc) => (
                <option key={cc.id} value={cc.id}>
                  {cc.bu_code ? `${cc.bu_code} — ` : ""}{cc.display || cc.bu_code || "—"}
                </option>
              ))}
            </select>
          </div>

          {/* Team Type + Quote Initial — inactive team types: strikethrough, sorted last */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">團隊 Team <span className="text-red-500">*</span></label>
              <Select
                value={form.n_team_type_id || "__none__"}
                onValueChange={(v) =>
                  updateField("n_team_type_id", v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger
                  className={`w-full text-sm border rounded-lg px-3 py-2 h-auto outline-none focus:border-bw-blue bg-white ${
                    showErrors && missing.n_team_type_id ? "border-red-400" : "border-gray-200"
                  }`}
                >
                  <SelectValue placeholder="未指定" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">未指定</SelectItem>
                  {teamTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span
                        style={
                          t.status === "Inactive" ? INACTIVE_TEAM_STRIKE : undefined
                        }
                      >
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">報價縮寫 Quote Initial</label>
              <input
                type="text"
                value={form.quote_initial}
                onChange={(e) => updateField("quote_initial", e.target.value)}
                placeholder="例如 CY"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-bw-blue"
              />
              <p className="text-[11px] text-gray-400">用於產生報價代號及 pitching 代號</p>
            </div>
          </div>

          {/* Status + Entry Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">狀態 Status <span className="text-red-500">*</span></label>
              <select
                value={form.status}
                onChange={(e) => updateField("status", e.target.value)}
                className={`w-full text-sm border rounded-lg px-3 py-2 outline-none focus:border-bw-blue bg-white ${
                  showErrors && missing.status ? "border-red-400" : "border-gray-200"
                }`}
              >
                <option value="">未指定</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">入職日期 Entry Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={form.entry_date}
                onChange={(e) => updateField("entry_date", e.target.value)}
                className={`w-full text-sm border rounded-lg px-3 py-2 outline-none focus:border-bw-blue ${
                  showErrors && missing.entry_date ? "border-red-400" : "border-gray-200"
                }`}
              />
            </div>
          </div>

          {/* Phone numbers */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">私人電話 <span className="text-red-500">*</span></label>
              <input
                type="tel"
                value={form.private_phone}
                onChange={(e) => updateField("private_phone", e.target.value)}
                placeholder="輸入私人電話..."
                className={`w-full text-sm border rounded-lg px-3 py-2 outline-none focus:border-bw-blue ${
                  showErrors && missing.private_phone ? "border-red-400" : "border-gray-200"
                }`}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">工作電話 <span className="text-red-500">*</span></label>
              <input
                type="tel"
                value={form.work_phone}
                onChange={(e) => updateField("work_phone", e.target.value)}
                placeholder="輸入工作電話..."
                className={`w-full text-sm border rounded-lg px-3 py-2 outline-none focus:border-bw-blue ${
                  showErrors && missing.work_phone ? "border-red-400" : "border-gray-200"
                }`}
              />
            </div>
          </div>

          {/* Dual System Toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-700">容許切換系統</p>
              <p className="text-xs text-gray-400">允許此職員同時存取 BWA 及 BWF 系統</p>
            </div>
            <Switch
              checked={form.dual_system}
              onCheckedChange={(checked) => updateField("dual_system", checked)}
              className="data-[state=checked]:bg-bw-blue"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {showErrors && hasMissing && (
            <p className="text-xs text-red-500 mr-auto">請填寫所有必填欄位（*）。</p>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-bw-navy hover:bg-bw-navy-hover text-white"
          >
            {saving ? (mode === "create" ? "新增中..." : "儲存中...") : (mode === "create" ? "新增職員" : "儲存變更")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── DELETE CONFIRM DIALOG ──────────────────────────────────

interface DeleteStaffDialogProps {
  staff: StaffManagementRow | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (id: string) => void;
  deleting: boolean;
}

function DeleteStaffDialog({ staff, open, onClose, onConfirm, deleting }: DeleteStaffDialogProps) {
  if (!staff) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-bw-red flex items-center gap-2" style={{ fontFamily: "Syne, sans-serif" }}>
            <AlertTriangle className="w-5 h-5" />
            確認刪除職員
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
            <Avatar className="w-10 h-10">
              {staff.image ? <AvatarImage src={staff.image} /> : null}
              <AvatarFallback className="bg-red-100 text-red-600 text-xs font-semibold">
                {getInitials(staff.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-gray-800">{staff.name}</p>
              <p className="text-xs text-gray-400">{staff.email || "—"}</p>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            此操作將永久刪除此職員記錄。刪除後<span className="font-semibold text-red-600">無法恢復</span>。
          </p>
          <p className="text-xs text-gray-400">
            注意：如果此職員已關聯到項目或其他記錄，刪除可能失敗。建議改為將狀態設為 Inactive。
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            取消
          </Button>
          <Button
            onClick={() => onConfirm(staff.id)}
            disabled={deleting}
            className="bg-bw-red hover:bg-red-600 text-white"
          >
            {deleting ? "刪除中..." : "確認刪除"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── DETAIL PANEL (DRAWER) ──────────────────────────────────

interface StaffDetailPanelProps {
  staff: StaffManagementRow | null;
  open: boolean;
  onClose: () => void;
  onEdit: (staff: StaffManagementRow) => void;
  onDelete: (staff: StaffManagementRow) => void;
  canEditStaff: boolean;
  canDeleteStaff: boolean;
}

function StaffDetailPanel({ staff, open, onClose, onEdit, onDelete, canEditStaff, canDeleteStaff }: StaffDetailPanelProps) {
  if (!staff || !open) return null;

  const buDisplay = getBuDisplay(staff.bu);
  const teamDisplay = getTeamDisplay(staff.n_team_type);
  const positionDisplay = getPositionDisplay(staff.position, staff.role);
  const roleDisplay = getRoleDisplay(staff.role);
  const workDuration = formatWorkDuration(staff.entry_date);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-[420px] bg-white h-full shadow-xl overflow-y-auto animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-bw-navy" style={{ fontFamily: "Syne, sans-serif" }}>
            職員詳情
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Staff Info */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <Avatar className="w-14 h-14">
              {staff.image ? <AvatarImage src={staff.image} /> : null}
              <AvatarFallback className="bg-bw-navy/10 text-bw-navy text-sm font-semibold">
                {getInitials(staff.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold text-gray-800">{staff.name}</p>
              <p className="text-sm text-gray-400">{staff.email || "—"}</p>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={staff.status} />
                {staff.dual_system && (
                  <span className="text-[12px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-bw-blue">
                    雙系統
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="px-6 py-4 space-y-3">
          <DetailRow label="職員 ID" value={staff.id.slice(0, 12) + "..."} mono />
          <DetailRow label="職位" value={positionDisplay} />
          <DetailRow label="權限角色" value={roleDisplay} />
          <DetailRow label="BU" value={buDisplay} />
          <DetailRow label="團隊" value={teamDisplay} />
          <DetailRow label="報價縮寫" value={staff.quote_initial || "—"} />
          <DetailRow label="工作時長" value={workDuration} />
          <DetailRow label="入職日期" value={formatDate(staff.entry_date)} />
          <DetailRow label="容許切換系統" value={staff.dual_system ? "是" : "否"} />

          {staff.user_type && (
            <>
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-3">關聯帳戶資料</p>
              </div>
              <DetailRow label="帳戶類型" value={staff.user_type} />
              <DetailRow label="可見系統" value={staff.view_system || "—"} />
            </>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-100 space-y-2">
          {canEditStaff && (
            <Button
              onClick={() => onEdit(staff)}
              className="w-full bg-bw-navy hover:bg-bw-navy-hover text-white"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              編輯職員資料
            </Button>
          )}
          {canDeleteStaff && (
            <Button
              onClick={() => onDelete(staff)}
              variant="outline"
              className="w-full border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              刪除職員
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-gray-400 shrink-0">{label}</span>
      <span className={`text-sm text-gray-700 text-right ${mono ? "text-xs tabular-nums" : ""}`}>
        {value}
      </span>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────

export default function StaffManagement() {
  const { canView, canCreate, canEdit, canDelete, loading: permLoading } = usePermission();

  const [staffList, setStaffList] = useState<StaffManagementRow[]>([]);
  const [costCentres, setCostCentres] = useState<CostCentreData[]>([]);
  const [teamTypes, setTeamTypes] = useState<LinkOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState("所有狀態");
  const [filterBu, setFilterBu] = useState("所有BU");
  const [filterTeam, setFilterTeam] = useState("所有團隊");
  const [filterPosition, setFilterPosition] = useState("所有職位");
  const [filterRole, setFilterRole] = useState("所有角色");
  const [roleCardFilter, setRoleCardFilter] = useState<string | null>(null);

  // Sort
  const [sortField, setSortField] = useState<string>("name");
  const [sortAsc, setSortAsc] = useState(true);

  // CRUD State
  const [detailStaff, setDetailStaff] = useState<StaffManagementRow | null>(null);
  const [editStaff, setEditStaff] = useState<StaffManagementRow | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteStaffTarget, setDeleteStaffTarget] = useState<StaffManagementRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchStaffForManagement()
      .then((data) => {
        setStaffList(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[StaffManagement] fetch error:", err);
        setLoading(false);
      });
    fetchCostCentres().then(setCostCentres).catch(() => {});
    fetchTeamTypeOptions(true).then(setTeamTypes).catch(() => {});
  }, []);

  // Resolve a team-type id → its display label (for optimistic row updates).
  const teamDisplayForId = (id: string | null): string | null => {
    if (!id) return null;
    return teamTypes.find((t) => t.id === id)?.label ?? null;
  };

  // Resolve a cost-centre id → its display label (for optimistic row updates).
  const buDisplayForId = (id: string | null): string | null => {
    if (!id) return null;
    const cc = costCentres.find((c) => c.id === id);
    return cc?.display || cc?.bu_code || null;
  };

  // ─── DERIVED DATA ─────────────────────────────────────────

  const uniqueBUs = useMemo(() => {
    const set = new Set<string>();
    staffList.forEach((s) => {
      const bu = getBuDisplay(s.bu);
      if (bu !== "N/A") set.add(bu);
    });
    return Array.from(set).sort();
  }, [staffList]);

  const uniqueRoles = useMemo(() => {
    const set = new Set<string>();
    staffList.forEach((s) => {
      const role = getRoleDisplay(s.role);
      set.add(role);
    });
    return Array.from(set).sort();
  }, [staffList]);

  const baseFilteredStaff = useMemo(() => {
    let result = [...staffList];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.email && s.email.toLowerCase().includes(q)) ||
          (s.role && s.role.toLowerCase().includes(q)) ||
          (s.position && s.position.toLowerCase().includes(q))
      );
    }

    if (filterStatus !== "所有狀態") {
      result = result.filter(
        (s) => (s.status || "").toLowerCase() === filterStatus.toLowerCase()
      );
    }

    if (filterBu !== "所有BU") {
      result = result.filter((s) => getBuDisplay(s.bu) === filterBu);
    }

    if (filterTeam !== "所有團隊") {
      result = result.filter((s) => s.n_team_type_id === filterTeam);
    }

    if (filterPosition !== "所有職位") {
      result = result.filter((s) => s.position === filterPosition);
    }

    if (filterRole !== "所有角色") {
      result = result.filter((s) => getRoleDisplay(s.role) === filterRole);
    }

    return result;
  }, [staffList, searchQuery, filterStatus, filterBu, filterTeam, filterPosition, filterRole]);

  const roleCounts = useMemo(() => {
    let pmCount = 0;
    let designerCount = 0;
    let companyCount = 0;
    baseFilteredStaff.forEach((s) => {
      const pos = getPositionDisplay(s.position, s.role).toLowerCase();
      const role = (s.role || "").toLowerCase();
      if (pos.includes("pm") || role.includes("pm") || role.includes("project")) {
        pmCount++;
      } else if (pos.includes("design") || role.includes("design")) {
        designerCount++;
      } else if (pos.includes("company") || role.includes("company") || role.includes("admin")) {
        companyCount++;
      }
    });
    return { total: baseFilteredStaff.length, pm: pmCount, designer: designerCount, company: companyCount };
  }, [baseFilteredStaff]);

  const filteredStaff = useMemo(() => {
    let result = [...baseFilteredStaff];

    if (roleCardFilter) {
      result = result.filter((s) => {
        const pos = getPositionDisplay(s.position, s.role).toLowerCase();
        const role = (s.role || "").toLowerCase();
        if (roleCardFilter === "pm")
          return pos.includes("pm") || role.includes("pm") || role.includes("project");
        if (roleCardFilter === "designer")
          return pos.includes("design") || role.includes("design");
        if (roleCardFilter === "company")
          return pos.includes("company") || role.includes("company") || role.includes("admin");
        return true;
      });
    }

    result.sort((a, b) => {
      // Work duration: sort by months since entry_date (asc = shortest first)
      if (sortField === "duration") {
        const monthsOf = (d: string | null) => {
          if (!d) return -1; // missing date sorts as shortest
          const entry = new Date(d);
          if (isNaN(entry.getTime())) return -1;
          const now = new Date();
          return (
            (now.getFullYear() - entry.getFullYear()) * 12 +
            (now.getMonth() - entry.getMonth())
          );
        };
        const cmp = monthsOf(a.entry_date) - monthsOf(b.entry_date);
        return sortAsc ? cmp : -cmp;
      }

      let aVal = "";
      let bVal = "";
      switch (sortField) {
        case "name": aVal = a.name; bVal = b.name; break;
        case "email": aVal = a.email || ""; bVal = b.email || ""; break;
        case "bu": aVal = getBuDisplay(a.bu); bVal = getBuDisplay(b.bu); break;
        case "team": aVal = getTeamDisplay(a.n_team_type); bVal = getTeamDisplay(b.n_team_type); break;
        case "role": aVal = getRoleDisplay(a.role); bVal = getRoleDisplay(b.role); break;
        case "position": aVal = getPositionDisplay(a.position, a.role); bVal = getPositionDisplay(b.position, b.role); break;
        case "status": aVal = a.status || ""; bVal = b.status || ""; break;
        default: aVal = a.name; bVal = b.name;
      }
      const cmp = aVal.localeCompare(bVal);
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [baseFilteredStaff, roleCardFilter, sortField, sortAsc]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // ─── CRUD HANDLERS ─────────────────────────────────────────

  const handleCreate = async (data: StaffFormData) => {
    setSaving(true);
    const result = await createStaffMember({
      name: data.name,
      full_name: data.full_name || undefined,
      email: data.email || undefined,
      position: data.position || undefined,
      role: data.role || undefined,
      status: data.status || "Active",
      dual_system: data.dual_system,
      private_phone: data.private_phone || undefined,
      work_phone: data.work_phone || undefined,
      entry_date: data.entry_date || undefined,
      bu_id: data.bu_id || null,
      n_team_type_id: data.n_team_type_id || null,
      quote_initial: data.quote_initial.trim() || null,
    });
    if (result.success && result.id) {
      const newStaff: StaffManagementRow = {
        id: result.id,
        bubble_id: null,
        name: data.name,
        full_name: data.full_name || null,
        email: data.email || null,
        bu: buDisplayForId(data.bu_id || null),
        bu_id: data.bu_id || null,
        n_team_type: teamDisplayForId(data.n_team_type_id || null),
        n_team_type_id: data.n_team_type_id || null,
        position: data.position || null,
        role: data.role || null,
        status: data.status || "Active",
        dual_system: data.dual_system,
        entry_date: data.entry_date || null,
        image: null,
        private_phone: data.private_phone || null,
        work_phone: data.work_phone || null,
        quote_initial: data.quote_initial.trim() || null,
        user_type: null,
        view_system: null,
      };
      setStaffList((prev) => [newStaff, ...prev]);
      setShowCreateDialog(false);
    } else {
      alert(`新增失敗: ${result.error}`);
    }
    setSaving(false);
  };

  const handleUpdate = async (data: StaffFormData) => {
    if (!editStaff) return;
    setSaving(true);
    const result = await updateStaffMember(editStaff.id, {
      name: data.name,
      full_name: data.full_name || undefined,
      email: data.email || undefined,
      position: data.position || undefined,
      role: data.role || undefined,
      status: data.status || undefined,
      dual_system: data.dual_system,
      private_phone: data.private_phone || undefined,
      work_phone: data.work_phone || undefined,
      entry_date: data.entry_date || undefined,
      bu_id: data.bu_id || null,
      n_team_type_id: data.n_team_type_id || null,
      quote_initial: data.quote_initial.trim() || null,
    });
    if (result.success) {
      setStaffList((prev) =>
        prev.map((s) =>
          s.id === editStaff.id
            ? {
                ...s,
                name: data.name,
                full_name: data.full_name || null,
                email: data.email || s.email,
                position: data.position || s.position,
                role: data.role || s.role,
                status: data.status || s.status,
                dual_system: data.dual_system,
                entry_date: data.entry_date || s.entry_date,
                private_phone: data.private_phone || s.private_phone,
                work_phone: data.work_phone || s.work_phone,
                bu: buDisplayForId(data.bu_id || null),
                bu_id: data.bu_id || null,
                n_team_type: teamDisplayForId(data.n_team_type_id || null),
                n_team_type_id: data.n_team_type_id || null,
                quote_initial: data.quote_initial.trim() || null,
              }
            : s
        )
      );
      setEditStaff(null);
    } else {
      alert(`儲存失敗: ${result.error}`);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    const result = await deleteStaffMember(id);
    if (result.success) {
      setStaffList((prev) => prev.filter((s) => s.id !== id));
      setDeleteStaffTarget(null);
      setDetailStaff(null);
    } else {
      alert(`刪除失敗: ${result.error}`);
    }
    setDeleting(false);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortAsc ? (
      <ChevronUp className="w-3 h-3 inline ml-0.5" />
    ) : (
      <ChevronDown className="w-3 h-3 inline ml-0.5" />
    );
  };

  // ─── RENDER ────────────────────────────────────────────────

  // Permission loading state
  if (permLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-8 h-8 border-2 border-bw-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1
              className="text-2xl font-bold text-bw-navy tracking-tight"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              角色與權限管理
            </h1>
            <Badge className="bg-bw-blue/10 text-bw-blue border-0 text-xs px-2.5 py-0.5 font-semibold">
              管理員
            </Badge>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">管理用戶角色和系統權限</p>
        </div>
        {canCreate("admin.roles") && (
          <button
            onClick={() => setShowCreateDialog(true)}
            className="inline-flex items-center gap-2 bg-bw-navy text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-bw-navy-hover transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            新增職員
          </button>
        )}
      </div>

      {/* ─── Permission Notice ─── */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-5 py-3.5">
        <Lock className="w-4 h-4 text-bw-blue mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-700">權限說明</p>
          <p className="text-xs text-gray-500">
            只限管理員可以更改用戶角色和系統權限
          </p>
        </div>
      </div>

      {/* ─── Role Count Cards ─── */}
      <div className="flex gap-4 flex-wrap">
        <RoleCountCard
          label="全部職員"
          sublabel="All Staff"
          count={roleCounts.total}
          active={roleCardFilter === null}
          onClick={() => setRoleCardFilter(null)}
        />
        <RoleCountCard
          label="項目經理"
          sublabel="Project Manager"
          count={roleCounts.pm}
          active={roleCardFilter === "pm"}
          onClick={() => setRoleCardFilter(roleCardFilter === "pm" ? null : "pm")}
        />
        <RoleCountCard
          label="設計師"
          sublabel="Designer"
          count={roleCounts.designer}
          active={roleCardFilter === "designer"}
          onClick={() => setRoleCardFilter(roleCardFilter === "designer" ? null : "designer")}
        />
        <RoleCountCard
          label="公司"
          sublabel="Company"
          count={roleCounts.company}
          active={roleCardFilter === "company"}
          onClick={() => setRoleCardFilter(roleCardFilter === "company" ? null : "company")}
        />
      </div>

      {/* ─── Filter Bar ─── */}
      <div className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showFilters ? "bg-bw-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            高級篩選
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋職員姓名、電郵、角色..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-transparent border-0 outline-none text-gray-700 placeholder:text-gray-300"
            />
          </div>
          <span className="text-xs text-gray-400">共 {filteredStaff.length} 筆</span>
        </div>

        {showFilters && (
          <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-gray-400 uppercase">狀態</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-xs text-gray-600 border border-gray-200 rounded-md px-2.5 py-1.5 outline-none focus:border-bw-blue bg-white min-w-[120px]">
                <option>所有狀態</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-gray-400 uppercase">BU</label>
              <select value={filterBu} onChange={(e) => setFilterBu(e.target.value)} className="text-xs text-gray-600 border border-gray-200 rounded-md px-2.5 py-1.5 outline-none focus:border-bw-blue bg-white min-w-[120px]">
                <option>所有BU</option>
                {uniqueBUs.map((bu) => (<option key={bu} value={bu}>{bu}</option>))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-gray-400 uppercase">團隊</label>
              <Select value={filterTeam} onValueChange={setFilterTeam}>
                <SelectTrigger className="text-xs text-gray-600 border border-gray-200 rounded-md px-2.5 py-1.5 h-auto outline-none focus:border-bw-blue bg-white min-w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="所有團隊">所有團隊</SelectItem>
                  {teamTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span
                        style={
                          t.status === "Inactive" ? INACTIVE_TEAM_STRIKE : undefined
                        }
                      >
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-gray-400 uppercase">職位</label>
              <select
                value={filterPosition}
                onChange={(e) => setFilterPosition(e.target.value)}
                className="text-xs text-gray-600 border border-gray-200 rounded-md px-2.5 py-1.5 outline-none focus:border-bw-blue bg-white min-w-[120px]"
              >
                <option>所有職位</option>
                <option value="PM">PM</option>
                <option value="Designer">Designer</option>
                <option value="Company">Company</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-gray-400 uppercase">角色</label>
              <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="text-xs text-gray-600 border border-gray-200 rounded-md px-2.5 py-1.5 outline-none focus:border-bw-blue bg-white min-w-[120px]">
                <option>所有角色</option>
                {uniqueRoles.map((r) => (<option key={r} value={r}>{r}</option>))}
              </select>
            </div>
          </div>
        )}

        {/* ─── Table ─── */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-bw-blue/30 border-t-bw-blue rounded-full animate-spin" />
                <p className="text-sm text-gray-400">載入職員資料中...</p>
              </div>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-gray-400">暫無數據</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="px-5 py-3 text-[13px] font-semibold text-gray-400 uppercase tracking-wider w-8" />
                  <th className="px-3 py-3 text-[13px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none" onClick={() => handleSort("name")}>
                    職員姓名 <SortIcon field="name" />
                  </th>
                  <th className="px-3 py-3 text-[13px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none" onClick={() => handleSort("email")}>
                    電郵 <SortIcon field="email" />
                  </th>
                  <th className="px-3 py-3 text-[13px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none" onClick={() => handleSort("bu")}>
                    BU <SortIcon field="bu" />
                  </th>
                  <th className="px-3 py-3 text-[13px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none" onClick={() => handleSort("team")}>
                    團隊 <SortIcon field="team" />
                  </th>
                  <th className="px-3 py-3 text-[13px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none" onClick={() => handleSort("position")}>
                    職位 <SortIcon field="position" />
                  </th>
                  <th className="px-3 py-3 text-[13px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none" onClick={() => handleSort("role")}>
                    權限 <SortIcon field="role" />
                  </th>
                  <th className="px-3 py-3 text-[13px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none" onClick={() => handleSort("duration")}>
                    工作時長 <SortIcon field="duration" />
                  </th>
                  <th className="px-3 py-3 text-[13px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none" onClick={() => handleSort("status")}>
                    Status <SortIcon field="status" />
                  </th>
                  <th className="px-3 py-3 text-[13px] font-semibold text-gray-400 uppercase tracking-wider text-center">容許切換系統</th>
                  <th className="px-3 py-3 text-[13px] font-semibold text-gray-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((staff) => (
                  <StaffRow
                    key={staff.id}
                    staff={staff}
                    onView={() => setDetailStaff(staff)}
                    onEdit={() => setEditStaff(staff)}
                    onDelete={() => setDeleteStaffTarget(staff)}
                    canEditStaff={canEdit("admin.roles")}
                    canDeleteStaff={canDelete("admin.roles")}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <StaffDetailPanel
        staff={detailStaff}
        open={!!detailStaff}
        onClose={() => setDetailStaff(null)}
        onEdit={(s) => { setDetailStaff(null); setEditStaff(s); }}
        onDelete={(s) => { setDetailStaff(null); setDeleteStaffTarget(s); }}
        canEditStaff={canEdit("admin.roles")}
        canDeleteStaff={canDelete("admin.roles")}
      />

      {/* Create Dialog */}
      <StaffFormDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSave={handleCreate}
        saving={saving}
        mode="create"
      />

      {/* Edit Dialog */}
      <StaffFormDialog
        open={!!editStaff}
        onClose={() => setEditStaff(null)}
        onSave={handleUpdate}
        saving={saving}
        staff={editStaff}
        mode="edit"
      />

      {/* Delete Dialog */}
      <DeleteStaffDialog
        staff={deleteStaffTarget}
        open={!!deleteStaffTarget}
        onClose={() => setDeleteStaffTarget(null)}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  );
}

// ─── TABLE ROW ──────────────────────────────────────────────

function StaffRow({
  staff,
  onView,
  onEdit,
  onDelete,
  canEditStaff,
  canDeleteStaff,
}: {
  staff: StaffManagementRow;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEditStaff: boolean;
  canDeleteStaff: boolean;
}) {
  const buDisplay = getBuDisplay(staff.bu);
  const teamDisplay = getTeamDisplay(staff.n_team_type);
  const positionDisplay = getPositionDisplay(staff.position, staff.role);
  const roleDisplay = getRoleDisplay(staff.role);
  const workDuration = formatWorkDuration(staff.entry_date);

  const buBadgeClass = useMemo(() => {
    if (buDisplay === "N/A") return "bg-gray-50 text-gray-300 italic";
    const bu = buDisplay.toUpperCase();
    if (bu.includes("BWA") && bu.includes("BWF")) return "bg-gray-100 text-gray-600";
    if (bu.includes("CFB") || bu.includes("BW-CFB")) return "bg-gray-100 text-gray-600";
    if (bu.includes("BWA")) return "bg-blue-50 text-bw-blue";
    if (bu.includes("BWF")) return "bg-amber-50 text-bw-amber";
    if (bu.includes("BWD")) return "bg-purple-50 text-purple-600";
    if (bu.includes("BWL")) return "bg-teal-50 text-teal-600";
    return "bg-gray-100 text-gray-500";
  }, [buDisplay]);

  return (
    <tr className="group border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={onView}>
      <td className="px-5 py-3">
        <Avatar className="w-8 h-8">
          {staff.image ? <AvatarImage src={staff.image} alt={staff.name} /> : null}
          <AvatarFallback className="bg-bw-navy/10 text-bw-navy text-[12px] font-semibold">
            {buDisplay !== "N/A" && buDisplay.startsWith("BW") ? "BW" : getInitials(staff.name)}
          </AvatarFallback>
        </Avatar>
      </td>
      <td className="px-3 py-3">
        <span className="text-sm font-medium text-gray-800">{staff.name}</span>
      </td>
      <td className="px-3 py-3">
        <span className="text-xs text-gray-500">{staff.email || "—"}</span>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center text-[13px] font-medium px-2 py-0.5 rounded ${buBadgeClass}`}>{buDisplay}</span>
      </td>
      <td className="px-3 py-3">
        <span className="text-xs text-gray-600">{teamDisplay}</span>
      </td>
      <td className="px-3 py-3">
        <span className="text-xs text-gray-600">{positionDisplay}</span>
      </td>
      <td className="px-3 py-3">
        <span className="text-xs text-gray-600">{roleDisplay}</span>
      </td>
      <td className="px-3 py-3">
        <span className="text-xs text-gray-500 tabular-nums">{workDuration}</span>
      </td>
      <td className="px-3 py-3">
        <StatusBadge status={staff.status} />
      </td>
      <td className="px-3 py-3 text-center">
        <Switch checked={staff.dual_system === true} disabled className="data-[state=checked]:bg-bw-blue" />
      </td>
      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <button onClick={onView} className="p-1.5 rounded-md text-gray-400 hover:text-bw-blue hover:bg-blue-50 transition-colors" title="查看">
            <Eye className="w-3.5 h-3.5" />
          </button>
          {canEditStaff && (
            <button onClick={onEdit} className="p-1.5 rounded-md text-gray-400 hover:text-bw-violet hover:bg-violet-50 transition-colors" title="編輯">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {canDeleteStaff && (
            <button onClick={onDelete} className="p-1.5 rounded-md text-gray-400 hover:text-bw-red hover:bg-red-50 transition-colors" title="刪除">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
