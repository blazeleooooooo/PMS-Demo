"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Filter,
  Shield,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Eye,
  Edit2,
  MoreHorizontal,
  KeyRound,
  Globe,
  User,
  Truck,
  Users as UsersIcon,
  X,
  Check,
  Link2,
  Unlink,
  Trash2,
  AlertTriangle,
  Plus,
  Loader2} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  fetchUserAccounts,
  updateUserAccount,
  approveUserAccount,
  createUserAccount,
  deleteUserAccount,
  fetchStaffOptions,
  fetchSupplierOptions,
  fetchCustomerOptions,
  type UserAccountRow,
  type LinkOption} from "@/lib/data-service";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePermission } from "@/hooks/use-permission";

// ─── HELPERS ────────────────────────────────────────────────

function getInitials(name: string | null): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getUserTypeDisplay(userType: string | null): { label: string; icon: React.ElementType; color: string } {
  if (!userType) return { label: "未指定", icon: User, color: "text-gray-400 bg-gray-50" };
  const lower = userType.toLowerCase();
  if (lower === "staff" || lower === "member") {
    return { label: "職員", icon: UsersIcon, color: "text-bw-blue bg-blue-50" };
  }
  if (lower === "supplier") {
    return { label: "供應商", icon: Truck, color: "text-bw-amber bg-amber-50" };
  }
  if (lower === "customer") {
    return { label: "客戶", icon: User, color: "text-bw-violet bg-purple-50" };
  }
  return { label: userType, icon: User, color: "text-gray-500 bg-gray-50" };
}

function isPendingApproval(user: UserAccountRow): boolean {
  return (user.approval_status || "approved").toLowerCase() === "pending";
}

function getViewSystemDisplay(viewSystem: string | null): { label: string; badgeClass: string } {
  if (!viewSystem) return { label: "未設定", badgeClass: "bg-gray-100 text-gray-400" };
  const upper = viewSystem.toUpperCase();
  if (upper === "BWA" || upper === "PMS") return { label: "BWA", badgeClass: "bg-blue-50 text-bw-blue" };
  if (upper === "BWF" || upper === "BWF2") return { label: "BWF", badgeClass: "bg-amber-50 text-bw-amber" };
  if (upper === "BOTH" || upper.includes("BWA") && upper.includes("BWF")) {
    return { label: "BWA + BWF", badgeClass: "bg-gray-100 text-gray-600" };
  }
  return { label: viewSystem, badgeClass: "bg-gray-100 text-gray-500" };
}

/** Map DB user_type (Bubble legacy e.g. "Staff") to edit-form select values. */
function normalizeUserTypeForForm(userType: string | null): string {
  if (!userType) return "";
  const lower = userType.toLowerCase();
  if (lower === "staff" || lower === "member") return "staff";
  if (lower === "supplier") return "supplier";
  if (lower === "customer") return "customer";
  return lower;
}

/** Map DB view_system (legacy PMS/BWF2 or BWA/BWF/BOTH) to edit-form select values. */
function viewSystemToFormValue(viewSystem: string | null): string {
  if (!viewSystem) return "";
  const upper = viewSystem.toUpperCase();
  if (upper === "PMS" || upper === "BWA") return "BWA";
  if (upper === "BWF2" || upper === "BWF") return "BWF";
  if (upper === "BOTH" || (upper.includes("BWA") && upper.includes("BWF"))) return "BOTH";
  return viewSystem;
}

function getDisplayName(user: UserAccountRow): string {
  if (user.staff_name) return user.staff_name;
  if (user.supplier_name) return user.supplier_name;
  if (user.customer_name) return user.customer_name;
  return user.bubble_id?.slice(0, 12) || user.id.slice(0, 8);
}

/**
 * Gets binding status for a user based on their type.
 * - Staff → should have member/member_id bound → show staff_name or "未綁定"
 * - Supplier → should have supplier/supplier_id bound → show supplier_name or "未綁定"
 * - Customer → should have customer/customer_id bound → show customer_name or "未綁定"
 */
function getBindingStatus(user: UserAccountRow): { label: string; bound: boolean; fieldLabel: string } | null {
  const lower = (user.user_type || "").toLowerCase();
  if (lower === "staff" || lower === "member") {
    const hasFk = !!(user.member || user.member_id);
    const name = user.staff_name;
    return {
      fieldLabel: "職員",
      label: name || (hasFk ? "已綁定 (無名稱)" : "未綁定"),
      bound: !!name || hasFk};
  }
  if (lower === "supplier") {
    const hasFk = !!(user.supplier || user.supplier_id);
    const name = user.supplier_name;
    return {
      fieldLabel: "供應商",
      label: name || (hasFk ? "已綁定 (無名稱)" : "未綁定"),
      bound: !!name || hasFk};
  }
  if (lower === "customer") {
    const hasFk = !!(user.customer || user.customer_id);
    const name = user.customer_name;
    return {
      fieldLabel: "客戶",
      label: name || (hasFk ? "已綁定 (無名稱)" : "未綁定"),
      bound: !!name || hasFk};
  }
  return null;
}

import { formatDate } from "@/lib/date-utils";

// ─── STAT CARD ──────────────────────────────────────────────

interface StatCardProps {
  label: string;
  sublabel: string;
  count: number;
  active: boolean;
  onClick: () => void;
  accentColor?: string;
}

function StatCard({ label, sublabel, count, active, onClick, accentColor }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between px-5 py-4 rounded-xl border transition-all duration-200 min-w-[180px] ${
        active
          ? `border-bw-blue bg-bw-blue/5 shadow-sm`
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

// ─── SEARCHABLE LINK DROPDOWN ────────────────────────────────

function SearchableLinkDropdown({
  options,
  value,
  onChange,
  loading,
  placeholder,
  label,
  fallbackLabel,
  fallbackSublabel}: {
  options: LinkOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  loading: boolean;
  placeholder: string;
  label: string;
  fallbackLabel?: string | null;
  fallbackSublabel?: string | null;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(q))
    );
  }, [options, search]);

  const selectedOption = value
    ? options.find((o) => o.id === value) ?? (fallbackLabel
      ? { id: value, label: fallbackLabel, sublabel: fallbackSublabel ?? undefined }
      : null)
    : null;

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase">{label}</label>
      <div className="relative" ref={containerRef}>
        {/* Selected value display / trigger */}
        {selectedOption && !isOpen ? (
          <div className="flex items-center justify-between w-full text-sm border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Link2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-800 truncate block">{selectedOption.label}</span>
                {selectedOption.sublabel && (
                  <span className="text-[13px] text-gray-400 truncate block">{selectedOption.sublabel}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button
                type="button"
                onClick={() => { setIsOpen(true); setSearch(""); }}
                className="p-1 rounded hover:bg-emerald-100 text-gray-400 hover:text-gray-600 transition-colors"
                title="更換"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                title="取消綁定"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
                onFocus={() => setIsOpen(true)}
                placeholder={loading ? "載入中..." : placeholder}
                disabled={loading}
                className="w-full text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2 outline-none focus:border-bw-blue bg-white disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            {/* Dropdown list */}
            {isOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[240px] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-4 h-4 border-2 border-bw-blue/30 border-t-bw-blue rounded-full animate-spin" />
                    <span className="text-xs text-gray-400 ml-2">載入中...</span>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-xs text-gray-400">找不到符合條件的結果</p>
                  </div>
                ) : (
                  filtered.slice(0, 50).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        onChange(option.id);
                        setIsOpen(false);
                        setSearch("");
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 ${
                        option.id === value ? "bg-blue-50" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {option.id === value && <Check className="w-3 h-3 text-bw-blue shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800 truncate">{option.label}</p>
                          {option.sublabel && (
                            <p className="text-[13px] text-gray-400 truncate">{option.sublabel}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
                {filtered.length > 50 && (
                  <div className="px-3 py-2 text-center text-[13px] text-gray-400 bg-gray-50">
                    顯示前 50 筆，請輸入更多文字縮小範圍
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EDIT DIALOG ────────────────────────────────────────────

interface EditDialogProps {
  user: UserAccountRow | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, updates: {
    user_type?: string;
    view_system?: string;
    special?: string;
    approval_status?: string;
    member_id?: string | null;
    supplier_id?: string | null;
    customer_id?: string | null;
  }) => void;
  saving: boolean;
}

function EditUserDialog({ user, open, onClose, onSave, saving }: EditDialogProps) {
  const [userType, setUserType] = useState("");
  const [viewSystem, setViewSystem] = useState("");
  const [special, setSpecial] = useState("");
  // When editing a pending account, approve it on save by default.
  const [approveOnSave, setApproveOnSave] = useState(true);

  // Link fields
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Options data
  const [staffOptions, setStaffOptions] = useState<LinkOption[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<LinkOption[]>([]);
  const [customerOptions, setCustomerOptions] = useState<LinkOption[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingSupplier, setLoadingSupplier] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  useEffect(() => {
    if (user && open) {
      setUserType(normalizeUserTypeForForm(user.user_type));
      setViewSystem(viewSystemToFormValue(user.view_system));
      setSpecial(user.special || "");
      setSelectedStaffId(user.member_id || null);
      setSelectedSupplierId(user.supplier_id || null);
      setSelectedCustomerId(user.customer_id || null);
      setApproveOnSave(true);
    }
  }, [user, open]);

  // Load options based on user type
  useEffect(() => {
    const lower = userType.toLowerCase();
    if ((lower === "staff" || lower === "member") && staffOptions.length === 0 && !loadingStaff) {
      setLoadingStaff(true);
      fetchStaffOptions().then((opts) => {
        setStaffOptions(opts);
        setLoadingStaff(false);
      });
    }
    if (lower === "supplier" && supplierOptions.length === 0 && !loadingSupplier) {
      setLoadingSupplier(true);
      fetchSupplierOptions().then((opts) => {
        setSupplierOptions(opts);
        setLoadingSupplier(false);
      });
    }
    if (lower === "customer" && customerOptions.length === 0 && !loadingCustomer) {
      setLoadingCustomer(true);
      fetchCustomerOptions().then((opts) => {
        setCustomerOptions(opts);
        setLoadingCustomer(false);
      });
    }
  }, [userType]);

  if (!user) return null;

  const handleSave = () => {
    const lower = userType.toLowerCase();
    const updates: any = {
      user_type: userType || undefined,
      view_system: viewSystem || undefined,
      special: special || undefined};

    // Set the relevant FK based on user type; clear others
    if (lower === "staff" || lower === "member") {
      updates.member_id = selectedStaffId || null;
      updates.supplier_id = null;
      updates.customer_id = null;
    } else if (lower === "supplier") {
      updates.member_id = null;
      updates.supplier_id = selectedSupplierId || null;
      updates.customer_id = null;
    } else if (lower === "customer") {
      updates.member_id = null;
      updates.supplier_id = null;
      updates.customer_id = selectedCustomerId || null;
    } else {
      updates.member_id = null;
      updates.supplier_id = null;
      updates.customer_id = null;
    }

    // Approve the account on save when the admin opted in (default for a
    // pending account). Approved accounts are left untouched.
    if (pending && approveOnSave) {
      updates.approval_status = "approved";
    }

    onSave(user.id, updates);
  };

  const lowerType = userType.toLowerCase();
  const pending = isPendingApproval(user);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-lg font-bold text-bw-navy" style={{ fontFamily: "Syne, sans-serif" }}>
            編輯帳戶設定
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 flex-1 overflow-y-auto -mx-1 px-1">
          {/* Pending-approval banner + auto-approve toggle */}
          {pending && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">此帳戶尚待審批</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    填寫帳戶資料後，儲存時將自動批准此帳戶，使其可以登入系統。
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 mt-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={approveOnSave}
                  onChange={(e) => setApproveOnSave(e.target.checked)}
                  className="w-4 h-4 rounded border-amber-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-amber-800">儲存時批准此帳戶 (Approve on save)</span>
              </label>
            </div>
          )}

          {/* User info display */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Avatar className="w-10 h-10">
              {user.staff_image ? <AvatarImage src={user.staff_image} /> : null}
              <AvatarFallback className="bg-bw-navy/10 text-bw-navy text-xs font-semibold">
                {getInitials(getDisplayName(user))}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-gray-800">{getDisplayName(user)}</p>
              <p className="text-xs text-gray-400">{user.email || user.staff_email || user.id.slice(0, 12)}</p>
            </div>
          </div>

          {/* User Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase">帳戶類型 User Type</label>
            <select
              value={userType}
              onChange={(e) => {
                setUserType(e.target.value);
                // Clear link selections when type changes
                setSelectedStaffId(null);
                setSelectedSupplierId(null);
                setSelectedCustomerId(null);
              }}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-bw-blue bg-white"
            >
              <option value="">未指定</option>
              <option value="staff">職員 (Staff)</option>
              <option value="supplier">供應商 (Supplier)</option>
              <option value="customer">客戶 (Customer)</option>
            </select>
          </div>

          {/* Conditional Link Dropdown — Staff */}
          {(lowerType === "staff" || lowerType === "member") && (
            <SearchableLinkDropdown
              options={staffOptions}
              value={selectedStaffId}
              onChange={setSelectedStaffId}
              loading={loadingStaff}
              placeholder="搜尋職員姓名、電郵、職位..."
              label="關聯職員 Link to Staff"
              fallbackLabel={user.staff_name || user.staff_full_name}
              fallbackSublabel={user.staff_email || user.staff_position}
            />
          )}

          {/* Conditional Link Dropdown — Supplier */}
          {lowerType === "supplier" && (
            <SearchableLinkDropdown
              options={supplierOptions}
              value={selectedSupplierId}
              onChange={setSelectedSupplierId}
              loading={loadingSupplier}
              placeholder="搜尋供應商名稱、類別..."
              label="關聯供應商 Link to Supplier"
              fallbackLabel={user.supplier_name}
            />
          )}

          {/* Conditional Link Dropdown — Customer */}
          {lowerType === "customer" && (
            <SearchableLinkDropdown
              options={customerOptions}
              value={selectedCustomerId}
              onChange={setSelectedCustomerId}
              loading={loadingCustomer}
              placeholder="搜尋客戶名稱、公司名..."
              label="關聯客戶 Link to Customer"
              fallbackLabel={user.customer_name}
            />
          )}

          {/* View System */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase">可見系統 View System</label>
            <select
              value={viewSystem}
              onChange={(e) => setViewSystem(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-bw-blue bg-white"
            >
              <option value="">未設定</option>
              <option value="BWA">BWA (工程)</option>
              <option value="BWF">BWF (家具)</option>
              <option value="BOTH">BWA + BWF</option>
            </select>
          </div>

          {/* Special */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase">特殊權限 Special</label>
            <input
              type="text"
              value={special}
              onChange={(e) => setSpecial(e.target.value)}
              placeholder="輸入特殊權限標記..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-bw-blue"
            />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t border-gray-100 pt-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-bw-navy hover:bg-bw-navy-hover text-white"
          >
            {saving ? "儲存中..." : "儲存變更"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CREATE DIALOG ──────────────────────────────────────────

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { email?: string; user_type?: string; view_system?: string; special?: string }) => void;
  saving: boolean;
}

function CreateUserDialog({ open, onClose, onSave, saving }: CreateDialogProps) {
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState("");
  const [viewSystem, setViewSystem] = useState("");
  const [special, setSpecial] = useState("");

  useEffect(() => {
    if (open) {
      setEmail("");
      setUserType("");
      setViewSystem("");
      setSpecial("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-bw-navy" style={{ fontFamily: "Syne, sans-serif" }}>
            新增帳戶
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase">電郵地址 Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="輸入電郵地址..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-bw-blue"
            />
          </div>

          {/* User Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase">帳戶類型 User Type</label>
            <select
              value={userType}
              onChange={(e) => setUserType(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-bw-blue bg-white"
            >
              <option value="">未指定</option>
              <option value="staff">職員 (Staff)</option>
              <option value="supplier">供應商 (Supplier)</option>
              <option value="customer">客戶 (Customer)</option>
            </select>
          </div>

          {/* View System */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase">可見系統 View System</label>
            <select
              value={viewSystem}
              onChange={(e) => setViewSystem(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-bw-blue bg-white"
            >
              <option value="">未設定</option>
              <option value="BWA">BWA (工程)</option>
              <option value="BWF">BWF (家具)</option>
              <option value="BOTH">BWA + BWF</option>
            </select>
          </div>

          {/* Special */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase">特殊權限 Special</label>
            <input
              type="text"
              value={special}
              onChange={(e) => setSpecial(e.target.value)}
              placeholder="輸入特殊權限標記..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-bw-blue"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button
            onClick={() => onSave({ email: email || undefined, user_type: userType || undefined, view_system: viewSystem || undefined, special: special || undefined })}
            disabled={saving || !email.trim()}
            className="bg-bw-navy hover:bg-bw-navy-hover text-white"
          >
            {saving ? "新增中..." : "新增帳戶"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── DELETE CONFIRM DIALOG ──────────────────────────────────

interface DeleteDialogProps {
  user: UserAccountRow | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (id: string) => void;
  deleting: boolean;
}

function DeleteUserDialog({ user, open, onClose, onConfirm, deleting }: DeleteDialogProps) {
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-bw-red flex items-center gap-2" style={{ fontFamily: "Syne, sans-serif" }}>
            <AlertTriangle className="w-5 h-5" />
            確認刪除帳戶
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
            <Avatar className="w-10 h-10">
              {user.staff_image ? <AvatarImage src={user.staff_image} /> : null}
              <AvatarFallback className="bg-red-100 text-red-600 text-xs font-semibold">
                {getInitials(getDisplayName(user))}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-gray-800">{getDisplayName(user)}</p>
              <p className="text-xs text-gray-400">{user.email || user.staff_email || user.id.slice(0, 12)}</p>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            此操作將永久刪除此帳戶。刪除後<span className="font-semibold text-red-600">無法恢復</span>。
          </p>
          <p className="text-xs text-gray-400">
            注意：刪除帳戶不會影響關聯的職員、供應商或客戶資料。
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            取消
          </Button>
          <Button
            onClick={() => onConfirm(user.id)}
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

// ─── DETAIL DRAWER ──────────────────────────────────────────

interface DetailPanelProps {
  user: UserAccountRow | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (user: UserAccountRow) => void;
  onDelete?: (user: UserAccountRow) => void;
}

function DetailPanel({ user, open, onClose, onEdit, onDelete }: DetailPanelProps) {
  if (!user || !open) return null;

  const typeInfo = getUserTypeDisplay(user.user_type);
  const viewInfo = getViewSystemDisplay(user.view_system);
  const TypeIcon = typeInfo.icon;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-[420px] bg-white h-full shadow-xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header — fixed outside scroll */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-bw-navy" style={{ fontFamily: "Syne, sans-serif" }}>
            帳戶詳情
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* User Info */}
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <Avatar className="w-14 h-14">
                {user.staff_image ? <AvatarImage src={user.staff_image} /> : null}
                <AvatarFallback className="bg-bw-navy/10 text-bw-navy text-sm font-semibold">
                  {getInitials(getDisplayName(user))}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-semibold text-gray-800">{getDisplayName(user)}</p>
                <p className="text-sm text-gray-400">{user.email || user.staff_email || "—"}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${typeInfo.color}`}>
                    <TypeIcon className="w-3 h-3" />
                    {typeInfo.label}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${viewInfo.badgeClass}`}>
                    {viewInfo.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="px-6 py-4 space-y-4">
            <DetailRow label="帳戶 ID" value={user.id.slice(0, 12) + "..."} mono />

            <DetailRow label="帳戶電郵" value={user.email || "—"} />
            <DetailRow label="帳戶類型" value={typeInfo.label} />
            <DetailRow label="可見系統" value={viewInfo.label} />
            <DetailRow label="特殊權限" value={user.special || "—"} />
            <DetailRow label="最後 IP" value={user.ip || "—"} mono />
            <DetailRow label="建立日期" value={formatDate(user.created_date)} />
            <DetailRow label="修改日期" value={formatDate(user.modified_date)} />

            {/* Binding Status */}
            {(() => {
              const binding = getBindingStatus(user);
              if (!binding) return null;
              return (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-3">關聯綁定狀態</p>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs text-gray-400">{binding.fieldLabel}綁定</span>
                    {binding.bound ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        <Link2 className="w-3 h-3" />
                        {binding.label}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded">
                        <Unlink className="w-3 h-3" />
                        未綁定
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {user.staff_name && (
              <>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-3">關聯職員資料</p>
                </div>
                <DetailRow label="職員姓名" value={user.staff_full_name || user.staff_name} />
                <DetailRow label="電郵" value={user.staff_email || "—"} />
                <DetailRow label="職位" value={user.staff_position || "—"} />
                <DetailRow label="權限" value={user.staff_role || "—"} />
                <DetailRow label="BU" value={user.staff_bu || "—"} />
                <DetailRow label="狀態" value={user.staff_status || "—"} />
              </>
            )}

            {user.supplier_name && (
              <>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-3">關聯供應商資料</p>
                </div>
                <DetailRow label="供應商名稱" value={user.supplier_name} />
              </>
            )}

            {user.customer_name && (
              <>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-3">關聯客戶資料</p>
                </div>
                <DetailRow label="客戶名稱" value={user.customer_name} />
              </>
            )}
          </div>
        </div>

        {/* Actions — fixed outside scroll */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-100 space-y-2">
          {onEdit && (
            <Button
              onClick={() => onEdit(user)}
              className="w-full bg-bw-navy hover:bg-bw-navy-hover text-white"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              編輯帳戶設定
            </Button>
          )}
          {onDelete && (
            <Button
              onClick={() => onDelete(user)}
              variant="outline"
              className="w-full border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              刪除帳戶
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

export default function AccountManagement() {
  const { canCreate, canEdit, canDelete, loading: permLoading } = usePermission();
  const [userList, setUserList] = useState<UserAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState("所有類型");
  const [filterSystem, setFilterSystem] = useState("所有系統");
  const [typeCardFilter, setTypeCardFilter] = useState<string | null>(null);

  // Sort
  const [sortField, setSortField] = useState<string>("name");
  const [sortAsc, setSortAsc] = useState(true);

  // Detail / Edit / Create / Delete
  const [detailUser, setDetailUser] = useState<UserAccountRow | null>(null);
  const [editUser, setEditUser] = useState<UserAccountRow | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteUser, setDeleteUser] = useState<UserAccountRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchUserAccounts()
      .then((data) => {
        setUserList(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[AccountManagement] fetch error:", err);
        setLoading(false);
      });
  }, []);

  // ─── DERIVED DATA ─────────────────────────────────────────

  // Base filtered list (excluding typeCardFilter) — for stat card counts
  const baseFiltered = useMemo(() => {
    let result = [...userList];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          getDisplayName(u).toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.staff_email && u.staff_email.toLowerCase().includes(q)) ||
          (u.user_type && u.user_type.toLowerCase().includes(q)) ||
          (u.bubble_id && u.bubble_id.toLowerCase().includes(q)) ||
          (u.ip && u.ip.toLowerCase().includes(q))
      );
    }

    // Type filter
    if (filterType !== "所有類型") {
      result = result.filter((u) => {
        if (filterType === "staff") return u.user_type?.toLowerCase() === "staff" || u.user_type?.toLowerCase() === "member";
        return u.user_type?.toLowerCase() === filterType.toLowerCase();
      });
    }

    // System filter
    if (filterSystem !== "所有系統") {
      result = result.filter((u) => {
        const vs = (u.view_system || "").toUpperCase();
        if (filterSystem === "BWA") return vs === "BWA" || vs === "PMS";
        if (filterSystem === "BWF") return vs === "BWF" || vs === "BWF2";
        if (filterSystem === "BOTH") return vs === "BOTH" || (vs.includes("BWA") && vs.includes("BWF"));
        return true;
      });
    }

    return result;
  }, [userList, searchQuery, filterType, filterSystem]);

  // Type counts
  const typeCounts = useMemo(() => {
    let staffCount = 0;
    let supplierCount = 0;
    let customerCount = 0;
    let otherCount = 0;
    let pendingCount = 0;
    baseFiltered.forEach((u) => {
      const t = (u.user_type || "").toLowerCase();
      if (t === "staff" || t === "member") staffCount++;
      else if (t === "supplier") supplierCount++;
      else if (t === "customer") customerCount++;
      else otherCount++;
      if (isPendingApproval(u)) pendingCount++;
    });
    return { total: baseFiltered.length, staff: staffCount, supplier: supplierCount, customer: customerCount, other: otherCount, pending: pendingCount };
  }, [baseFiltered]);

  // Final list
  const filteredUsers = useMemo(() => {
    let result = [...baseFiltered];

    // Type card filter
    if (typeCardFilter) {
      result = result.filter((u) => {
        if (typeCardFilter === "pending") return isPendingApproval(u);
        const t = (u.user_type || "").toLowerCase();
        if (typeCardFilter === "staff") return t === "staff" || t === "member";
        if (typeCardFilter === "supplier") return t === "supplier";
        if (typeCardFilter === "customer") return t === "customer";
        if (typeCardFilter === "other") return t !== "staff" && t !== "member" && t !== "supplier" && t !== "customer";
        return true;
      });
    }

    // Sort
    result.sort((a, b) => {
      let aVal = "";
      let bVal = "";
      switch (sortField) {
        case "name":
          aVal = getDisplayName(a);
          bVal = getDisplayName(b);
          break;
        case "email":
          aVal = a.email || a.staff_email || "";
          bVal = b.email || b.staff_email || "";
          break;
        case "type":
          aVal = a.user_type || "";
          bVal = b.user_type || "";
          break;
        case "system":
          aVal = a.view_system || "";
          bVal = b.view_system || "";
          break;
        case "created":
          aVal = a.created_date || "";
          bVal = b.created_date || "";
          break;
        case "ip":
          aVal = a.ip || "";
          bVal = b.ip || "";
          break;
        default:
          aVal = getDisplayName(a);
          bVal = getDisplayName(b);
      }
      const cmp = aVal.localeCompare(bVal);
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [baseFiltered, typeCardFilter, sortField, sortAsc]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleSave = async (id: string, updates: {
    user_type?: string;
    view_system?: string;
    special?: string;
    approval_status?: string;
    member_id?: string | null;
    supplier_id?: string | null;
    customer_id?: string | null;
  }) => {
    setSaving(true);
    const result = await updateUserAccount(id, updates);
    if (result.success) {
      // Refresh full list to get updated join data (staff_name, supplier_name, customer_name)
      try {
        const freshData = await fetchUserAccounts();
        setUserList(freshData);
      } catch {
        // Fallback: update local state with what we know
        setUserList((prev) =>
          prev.map((u) =>
            u.id === id
              ? {
                  ...u,
                  user_type: updates.user_type ?? u.user_type,
                  view_system: updates.view_system ?? u.view_system,
                  special: updates.special ?? u.special,
                  approval_status: updates.approval_status ?? u.approval_status,
                  member_id: updates.member_id !== undefined ? updates.member_id : u.member_id,
                  supplier_id: updates.supplier_id !== undefined ? updates.supplier_id : u.supplier_id,
                  customer_id: updates.customer_id !== undefined ? updates.customer_id : u.customer_id}
              : u
          )
        );
      }
      setEditUser(null);
    } else {
      alert(`儲存失敗: ${result.error}`);
    }
    setSaving(false);
  };

  // Inline one-click approval from a table row.
  const handleApprove = async (id: string) => {
    // Optimistic local flip.
    setUserList((prev) =>
      prev.map((u) => (u.id === id ? { ...u, approval_status: "approved" } : u))
    );
    const result = await approveUserAccount(id);
    if (!result.success) {
      alert(`批准失敗: ${result.error}`);
      // Revert on failure.
      setUserList((prev) =>
        prev.map((u) => (u.id === id ? { ...u, approval_status: "pending" } : u))
      );
    }
  };

  const handleCreate = async (data: { email?: string; user_type?: string; view_system?: string; special?: string }) => {
    setSaving(true);
    const result = await createUserAccount(data);
    if (result.success && result.id) {
      // Add to local list
      const newUser: UserAccountRow = {
        id: result.id,
        bubble_id: null,
        email: data.email || null,
        user_type: data.user_type || null,
        view_system: data.view_system || null,
        special: data.special || null,
        ip: null,
        approval_status: "approved",
        created_date: new Date().toISOString(),
        modified_date: new Date().toISOString(),
        member: null,
        member_id: null,
        supplier: null,
        supplier_id: null,
        customer: null,
        customer_id: null,
        staff_name: null,
        staff_full_name: null,
        staff_email: null,
        staff_position: null,
        staff_role: null,
        staff_status: null,
        staff_image: null,
        staff_bu: null,
        supplier_name: null,
        customer_name: null};
      setUserList((prev) => [newUser, ...prev]);
      setShowCreateDialog(false);
    } else {
      alert(`新增失敗: ${result.error}`);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    const result = await deleteUserAccount(id);
    if (result.success) {
      setUserList((prev) => prev.filter((u) => u.id !== id));
      setDeleteUser(null);
      setDetailUser(null);
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
              帳戶管理
            </h1>
            <Badge className="bg-bw-violet/10 text-bw-violet border-0 text-xs px-2.5 py-0.5 font-semibold">
              管理員
            </Badge>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            管理系統登入帳戶、用戶類型及可見系統權限
          </p>
        </div>
        {canCreate("admin.accounts") && (
          <button
            onClick={() => setShowCreateDialog(true)}
            className="inline-flex items-center gap-2 bg-bw-navy text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-bw-navy-hover transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            新增帳戶
          </button>
        )}
      </div>

      {/* ─── Permission Notice ─── */}
      <div className="flex items-start gap-3 bg-violet-50 border border-violet-100 rounded-xl px-5 py-3.5">
        <Shield className="w-4 h-4 text-bw-violet mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-700">帳戶說明</p>
          <p className="text-xs text-gray-500">
            此頁面管理系統登入帳戶。每個帳戶可關聯到職員 (Staff)、供應商 (Supplier)
            或客戶 (Customer)，並控制用戶可見的業務系統 (BWA/BWF)。
          </p>
        </div>
      </div>

      {/* ─── Stat Cards ─── */}
      <div className="flex gap-4 flex-wrap">
        <StatCard
          label="全部帳戶"
          sublabel="All Accounts"
          count={typeCounts.total}
          active={typeCardFilter === null}
          onClick={() => setTypeCardFilter(null)}
        />
        {typeCounts.pending > 0 && (
          <button
            onClick={() => setTypeCardFilter(typeCardFilter === "pending" ? null : "pending")}
            className={`flex items-center justify-between px-5 py-4 rounded-xl border transition-all duration-200 min-w-[180px] ${
              typeCardFilter === "pending"
                ? "border-amber-400 bg-amber-50 shadow-sm"
                : "border-amber-200 bg-amber-50/40 hover:border-amber-300"
            }`}
          >
            <div className="text-left">
              <p className="text-sm font-semibold text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                等待審批
              </p>
              <p className="text-xs text-amber-500">Pending Approval</p>
            </div>
            <span
              className="text-2xl font-bold ml-6 text-amber-600"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              {typeCounts.pending}
            </span>
          </button>
        )}
        <StatCard
          label="職員帳戶"
          sublabel="Staff"
          count={typeCounts.staff}
          active={typeCardFilter === "staff"}
          onClick={() => setTypeCardFilter(typeCardFilter === "staff" ? null : "staff")}
        />
        <StatCard
          label="供應商帳戶"
          sublabel="Supplier"
          count={typeCounts.supplier}
          active={typeCardFilter === "supplier"}
          onClick={() => setTypeCardFilter(typeCardFilter === "supplier" ? null : "supplier")}
        />
        <StatCard
          label="客戶帳戶"
          sublabel="Customer"
          count={typeCounts.customer}
          active={typeCardFilter === "customer"}
          onClick={() => setTypeCardFilter(typeCardFilter === "customer" ? null : "customer")}
        />
        {typeCounts.other > 0 && (
          <StatCard
            label="其他"
            sublabel="Other"
            count={typeCounts.other}
            active={typeCardFilter === "other"}
            onClick={() => setTypeCardFilter(typeCardFilter === "other" ? null : "other")}
          />
        )}
      </div>

      {/* ─── Table Card ─── */}
      <div className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
        {/* Search + Filter Toggle */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showFilters
                ? "bg-bw-navy text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
              placeholder="搜尋帳戶名稱、電郵、IP..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-transparent border-0 outline-none text-gray-700 placeholder:text-gray-300"
            />
          </div>
          <span className="text-xs text-gray-400">
            共 {filteredUsers.length} 筆
          </span>
        </div>

        {/* Filter Dropdowns */}
        {showFilters && (
          <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-gray-400 uppercase">
                帳戶類型
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-xs text-gray-600 border border-gray-200 rounded-md px-2.5 py-1.5 outline-none focus:border-bw-blue bg-white min-w-[120px]"
              >
                <option>所有類型</option>
                <option value="staff">職員 (Staff)</option>
                <option value="supplier">供應商 (Supplier)</option>
                <option value="customer">客戶 (Customer)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-gray-400 uppercase">
                可見系統
              </label>
              <select
                value={filterSystem}
                onChange={(e) => setFilterSystem(e.target.value)}
                className="text-xs text-gray-600 border border-gray-200 rounded-md px-2.5 py-1.5 outline-none focus:border-bw-blue bg-white min-w-[120px]"
              >
                <option>所有系統</option>
                <option value="BWA">BWA</option>
                <option value="BWF">BWF</option>
                <option value="BOTH">BWA + BWF</option>
              </select>
            </div>
          </div>
        )}

        {/* ─── Table ─── */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-bw-violet/30 border-t-bw-violet rounded-full animate-spin" />
                <p className="text-sm text-gray-400">載入帳戶資料中...</p>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <KeyRound className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">暫無數據</p>
                <p className="text-xs text-gray-300 mt-1">找不到符合條件的帳戶</p>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="px-5 py-3 text-[13px] font-semibold text-gray-400 uppercase tracking-wider w-8" />
                  <th
                    className="px-3 py-3 text-[13px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none"
                    onClick={() => handleSort("email")}
                  >
                    電郵
                    <SortIcon field="email" />
                  </th>
                  <th
                    className="px-3 py-3 text-[13px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none"
                    onClick={() => handleSort("name")}
                  >
                    帳戶名稱
                    <SortIcon field="name" />
                  </th>
                  <th
                    className="px-3 py-3 text-[13px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none"
                    onClick={() => handleSort("type")}
                  >
                    帳戶類型
                    <SortIcon field="type" />
                  </th>
                  <th className="px-3 py-3 text-[13px] font-semibold text-gray-400 uppercase tracking-wider">
                    關聯綁定
                  </th>
                  <th
                    className="px-3 py-3 text-[13px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none"
                    onClick={() => handleSort("system")}
                  >
                    可見系統
                    <SortIcon field="system" />
                  </th>

                  <th
                    className="px-3 py-3 text-[13px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none"
                    onClick={() => handleSort("ip")}
                  >
                    最後 IP
                    <SortIcon field="ip" />
                  </th>
                  <th
                    className="px-3 py-3 text-[13px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none"
                    onClick={() => handleSort("created")}
                  >
                    建立日期
                    <SortIcon field="created" />
                  </th>
                  <th className="px-3 py-3 text-[13px] font-semibold text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    onView={() => setDetailUser(user)}
                    onEdit={canEdit("admin.accounts") ? () => setEditUser(user) : undefined}
                    onDelete={canDelete("admin.accounts") ? () => setDeleteUser(user) : undefined}
                    onApprove={canEdit("admin.accounts") ? () => handleApprove(user.id) : undefined}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <DetailPanel
        user={detailUser}
        open={!!detailUser}
        onClose={() => setDetailUser(null)}
        onEdit={canEdit("admin.accounts") ? (u) => {
          setDetailUser(null);
          setEditUser(u);
        } : undefined}
        onDelete={canDelete("admin.accounts") ? (u) => {
          setDetailUser(null);
          setDeleteUser(u);
        } : undefined}
      />

      {/* Edit Dialog */}
      <EditUserDialog
        user={editUser}
        open={!!editUser}
        onClose={() => setEditUser(null)}
        onSave={handleSave}
        saving={saving}
      />

      {/* Create Dialog */}
      <CreateUserDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSave={handleCreate}
        saving={saving}
      />

      {/* Delete Dialog */}
      <DeleteUserDialog
        user={deleteUser}
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  );
}

// ─── TABLE ROW ──────────────────────────────────────────────

function UserRow({
  user,
  onView,
  onEdit,
  onDelete,
  onApprove}: {
  user: UserAccountRow;
  onView: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onApprove?: () => void;
}) {
  const typeInfo = getUserTypeDisplay(user.user_type);
  const viewInfo = getViewSystemDisplay(user.view_system);
  const TypeIcon = typeInfo.icon;
  const displayName = getDisplayName(user);
  const binding = getBindingStatus(user);
  const pending = isPendingApproval(user);

  return (
    <tr
      className={`group border-b border-gray-50 transition-colors cursor-pointer ${
        pending ? "bg-amber-50/40 hover:bg-amber-50/70" : "hover:bg-gray-50/50"
      }`}
      onClick={onView}
    >
      {/* Avatar */}
      <td className="px-5 py-3">
        <Avatar className="w-8 h-8">
          {user.staff_image ? (
            <AvatarImage src={user.staff_image} alt={displayName} />
          ) : null}
          <AvatarFallback className="bg-bw-navy/10 text-bw-navy text-[12px] font-semibold">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
      </td>

      {/* Email — Primary Field */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">{user.email || user.staff_email || "—"}</span>
          {pending && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
              <AlertTriangle className="w-3 h-3" />
              等待審批
            </span>
          )}
        </div>
      </td>

      {/* Name */}
      <td className="px-3 py-3">
        <div>
          {(binding && !binding.bound) ? (
            <span className="text-sm font-medium text-gray-300 italic">N/A</span>
          ) : (
            <>
              <span className="text-sm font-medium text-gray-800">{displayName}</span>
              {user.staff_position && (
                <p className="text-[13px] text-gray-400">{user.staff_position}</p>
              )}
            </>
          )}
        </div>
      </td>

      {/* User Type */}
      <td className="px-3 py-3">
        <span className={`inline-flex items-center gap-1 text-[13px] font-medium px-2 py-0.5 rounded ${typeInfo.color}`}>
          <TypeIcon className="w-3 h-3" />
          {typeInfo.label}
        </span>
      </td>

      {/* Binding Status */}
      <td className="px-3 py-3">
        {binding ? (
          binding.bound ? (
            <span className="inline-flex items-center gap-1 text-[13px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
              <Link2 className="w-3 h-3" />
              {binding.label}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[13px] font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded">
              <Unlink className="w-3 h-3" />
              未綁定
            </span>
          )
        ) : (
          <span className="text-[13px] text-gray-300">—</span>
        )}
      </td>

      {/* View System */}
      <td className="px-3 py-3">
        <span className={`text-[13px] font-medium px-2 py-0.5 rounded ${viewInfo.badgeClass}`}>
          {viewInfo.label}
        </span>
      </td>



      {/* IP */}
      <td className="px-3 py-3">
        <span className="text-xs text-gray-500 tabular-nums">
          {user.ip || "—"}
        </span>
      </td>

      {/* Created Date */}
      <td className="px-3 py-3">
        <span className="text-xs text-gray-500">{formatDate(user.created_date)}</span>
      </td>

      {/* Actions */}
      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          {pending && onApprove && (
            <button
              onClick={onApprove}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
              title="批准帳戶"
            >
              <Check className="w-3.5 h-3.5" />
              批准
            </button>
          )}
          <button
            onClick={onView}
            className="p-1.5 rounded-md text-gray-400 hover:text-bw-blue hover:bg-blue-50 transition-colors"
            title="查看"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 rounded-md text-gray-400 hover:text-bw-violet hover:bg-violet-50 transition-colors"
              title="編輯"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded-md text-gray-400 hover:text-bw-red hover:bg-red-50 transition-colors"
              title="刪除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
