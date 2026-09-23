"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { handleNavClick } from "@/lib/nav-click";
import {
  ArrowLeft,
  Save,
  Eye,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  PenLine,
  Package,
  PlusCircle,
  MoreHorizontal,
  Percent,
  DollarSign,
  Calculator,
  FileText,
  SendHorizontal,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Lock,
  Settings,
  ScrollText,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import NosItemPicker from "./NosItemPicker";
import QuickCreateItemDialog from "./QuickCreateItemDialog";
import RichTextEditor from "@/components/ui/rich-text-editor";
import { toDateInputValue } from "@/lib/date-utils";
import type { NosItem, NosSection } from "./NosItemPicker";

// ─── STATUS WORKFLOW CONSTANTS ────────────────────────────────
const STATUS_OPTIONS = [
  { value: "Draft", label: "Draft", labelChi: "草稿", color: "bg-gray-100 text-gray-600 border-gray-200" },
  { value: "Sent", label: "Sent", labelChi: "已發送", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "Accepted", label: "Accepted", labelChi: "已接受", color: "bg-green-100 text-green-700 border-green-200" },
  { value: "Rejected", label: "Rejected", labelChi: "已拒絕", color: "bg-red-100 text-red-700 border-red-200" },
] as const;

// Valid status transitions: Draft → Sent → Accepted/Rejected; Rejected → Draft (re-open)
const STATUS_TRANSITIONS: Record<string, string[]> = {
  Draft: ["Sent"],
  Sent: ["Accepted", "Rejected"],
  Accepted: [], // Final state
  Rejected: ["Draft"], // Allow re-opening
};

// ─── INTERFACES ─────────────────────────────────────────────

interface Quotation {
  id: string;
  quotation_no: string | null;
  name: string | null;
  status: string | null;
  date: string | null;
  l_version: string | null;
  version_number: number | null;
  company_name: string | null;
  company_address: string | null;
  contact_person: string | null;
  contact_tel: string | null;
  email: string | null;
  size: string | null;
  work_address: string | null;
  project_type: string | null;
  project_type_id: string | null;
  contract_type: string | null;
  project_manager: string | null;
  pm_tel: string | null;
  quo_head: string | null;
  reference_number: string | null;
  discount_method: string | null;
  discount_percent: number | null;
  fixed_discount: number | null;
  remark_under_section: string | null;
  terms_and_conditions: string | null;
  pitching_id: string | null;
  customer_id: string | null;
  cost_centre_id: string | null;
  created_by_id: string | null;
}

interface QuotationSection {
  id: string;
  name: string | null;
  order: number | null;
  real_order: number | null;
  s_discount: number | null;
  s_margin: number | null;
  s_total: number | null;
  quotation_id: string | null;
  r_section_id: string | null;
  isNew?: boolean;
}

interface QuotationSectionItem {
  id: string;
  description: string | null;
  cost: number | null;
  unit_price: number | null;
  quantity: number | null;
  unit: string | null;
  sub_total_price: number | null;
  sub_total_cost: number | null;
  order_number: number | null;
  opt: boolean | null;
  abandon: boolean | null;
  section_id: string | null;
  quote_id: string | null;
  item_id: string | null;
  c_unit_id: string | null;
  isNew?: boolean;
}

interface QuoteProjectType {
  id: string;
  name: string | null;
  order: number | null;
}

interface QuotationEditorProps {
  pitchingId: string;
  quoteId: string;
}

// ─── MAIN COMPONENT ─────────────────────────────────────────

export default function QuotationEditor({ pitchingId, quoteId }: QuotationEditorProps) {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();
  const { profile } = useAuth();
  const { canEdit, canView } = usePermission();
  const { formatMoney } = useFinancialFormat();

  // Permission check
  const hasEditPermission = canEdit("proposals.quotation");
  const hasViewPermission = canView("proposals.quotation");

  // Core state
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [sections, setSections] = useState<QuotationSection[]>([]);
  const [items, setItems] = useState<QuotationSectionItem[]>([]);
  const [nosSections, setNosSections] = useState<NosSection[]>([]);
  const [projectTypes, setProjectTypes] = useState<QuoteProjectType[]>([]);
  const [costCentres, setCostCentres] = useState<{ id: string; display: string | null; chinese_display: string | null; bu_code: string | null }[]>([]);
  const [nosUnits, setNosUnits] = useState<{ id: string; chi_name: string | null; eng_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [headerEditing, setHeaderEditing] = useState(false);

  // Section-level state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingSectionName, setEditingSectionName] = useState<string | null>(null);

  // NOS Item Picker
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemPickerSectionId, setItemPickerSectionId] = useState<string>("");
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  // Section picker (select from nos_sections before creating)
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false);
  const [sectionPickerSearch, setSectionPickerSearch] = useState("");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: "section" | "item"; id: string } | null>(null);

  // T&C Template reset
  const [tncTemplateDialogOpen, setTncTemplateDialogOpen] = useState(false);
  const [tncTemplateTypes, setTncTemplateTypes] = useState<{ id: string; name: string | null }[]>([]);
  const [selectedTncTemplateId, setSelectedTncTemplateId] = useState<string>("");
  const [tncEditorKey, setTncEditorKey] = useState(0);
  const [tncTemplateLoading, setTncTemplateLoading] = useState(false);

  // Discount editing
  const [discountForm, setDiscountForm] = useState({
    discount_method: "None" as string,
    discount_percent: "",
    fixed_discount: "",
  });

  // ─── T&C TEMPLATE FUNCTIONS ─────────────────────────────────

  async function loadTncTemplateTypes() {
    const { data } = await supabase
      .from("term_template_types")
      .select("id, name")
      .order("name");
    if (data) setTncTemplateTypes(data);
  }

  async function generateTermsAndConditionsHtml(templateTypeId: string): Promise<string> {
    // Fetch sections for this template type
    const { data: sections } = await supabase
      .from("term_template_sections")
      .select("id, head_name, order")
      .eq("template_name_id", templateTypeId)
      .order("order", { ascending: true });

    if (!sections || sections.length === 0) return "";

    // Fetch all details for these sections
    const sectionIds = sections.map((s: { id: string }) => s.id);
    const { data: details } = await supabase
      .from("term_template_section_details")
      .select("id, description, number, order, template_section_id")
      .in("template_section_id", sectionIds)
      .order("order", { ascending: true });

    // Build HTML
    let html = "";
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      // Add a line break before each section except the first
      if (i > 0) {
        html += `<p><br></p>`;
      }
      html += `<h3><strong>${section.head_name || "Untitled Section"}</strong></h3>`;
      const sectionDetails = (details || []).filter(
        (d: { template_section_id: string }) => d.template_section_id === section.id
      );
      if (sectionDetails.length > 0) {
        html += "<ol>";
        for (const detail of sectionDetails) {
          html += `<li>${detail.description || ""}</li>`;
        }
        html += "</ol>";
      }
    }

    return html;
  }

  async function handleApplyTncTemplate() {
    if (!selectedTncTemplateId || !quotation) return;
    setTncTemplateLoading(true);
    try {
      const html = await generateTermsAndConditionsHtml(selectedTncTemplateId);
      setQuotation({ ...quotation, terms_and_conditions: html });
      setTncEditorKey((k) => k + 1);
      setTncTemplateDialogOpen(false);
      setSelectedTncTemplateId("");
      toast({
        title: "條款已套用 T&C Applied",
        description: "條款及細則已重設為所選模板的預設內容。",
      });
    } catch (err) {
      toast({
        title: "錯誤 Error",
        description: "無法載入條款模板。",
        variant: "destructive",
      });
    } finally {
      setTncTemplateLoading(false);
    }
  }

  // ─── LOAD DATA ──────────────────────────────────────────────

  useEffect(() => {
    loadAll();
  }, [quoteId]);

  async function loadAll() {
    setLoading(true);
    try {
      const [quoteRes, sectionsRes, itemsRes, nosSectionsRes, projectTypesRes, nosUnitsRes, costCentresRes] = await Promise.all([
        supabase
          .from("quotations")
          .select("*")
          .eq("id", quoteId)
          .single(),
        supabase
          .from("quotation_sections")
          .select("*")
          .eq("quotation_id", quoteId)
          .order("order", { ascending: true }),
        supabase
          .from("quotation_section_items")
          .select("*")
          .eq("quote_id", quoteId)
          .or("abandon.is.null,abandon.eq.false")
          .order("order_number", { ascending: true }),
        supabase
          .from("nos_sections")
          .select("id, chinese_name, english_name, order")
          .order("order", { ascending: true }),
        supabase
          .from("nos_quote_project_types")
          .select("id, name, order")
          .order("order", { ascending: true }),
        supabase
          .from("nos_units")
          .select("id, chi_name, eng_name")
          .order("order", { ascending: true }),
        supabase
          .from("cost_centres")
          .select("id, display, chinese_display, bu_code")
          .order("display", { ascending: true }),
      ]);

      if (quoteRes.error) throw quoteRes.error;
      setQuotation(quoteRes.data as Quotation);

      // Init discount form
      const q = quoteRes.data;
      setDiscountForm({
        discount_method: q.discount_method || "None",
        discount_percent: q.discount_percent != null ? String(q.discount_percent) : "",
        fixed_discount: q.fixed_discount != null ? String(q.fixed_discount) : "",
      });

      setSections(sectionsRes.data || []);
      setItems((itemsRes.data || []) as QuotationSectionItem[]);
      setNosSections(nosSectionsRes.data || []);
      setProjectTypes(projectTypesRes.data || []);
      setNosUnits(nosUnitsRes.data || []);
      setCostCentres(costCentresRes.data || []);

      // Expand all sections by default
      const allIds = new Set<string>((sectionsRes.data || []).map((s: { id: string }) => s.id));
      setExpandedSections(allIds);
    } catch (err: any) {
      toast({ title: "Error loading quotation", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // ─── CALCULATED VALUES ────────────────────────────────────────

  const language = (quotation?.l_version as "Chi" | "Eng") || "Chi";

  function getSectionItems(sectionId: string) {
    return items.filter((i) => i.section_id === sectionId && !i.abandon);
  }

  function calcSectionTotal(sectionId: string) {
    return getSectionItems(sectionId).reduce((sum, item) => {
      const subtotal = (item.quantity || 0) * (item.unit_price || 0);
      return sum + subtotal;
    }, 0);
  }

  const subtotal = sections.reduce((sum, sec) => sum + calcSectionTotal(sec.id), 0);

  const discountAmount = (() => {
    if (discountForm.discount_method === "Percentage" && discountForm.discount_percent) {
      return subtotal * (parseFloat(discountForm.discount_percent) / 100);
    }
    if (discountForm.discount_method === "Fixed" && discountForm.fixed_discount) {
      return parseFloat(discountForm.fixed_discount);
    }
    return 0;
  })();

  const grandTotal = subtotal - discountAmount;

  // ─── SECTION CRUD ───────────────────────────────────────────

  function addSection() {
    // Open the section picker dialog so user picks from nos_sections first
    setSectionPickerSearch("");
    setSectionPickerOpen(true);
  }

  async function createSectionFromNos(nosSection: NosSection | null) {
    setSectionPickerOpen(false);
    const maxOrder = sections.reduce((max, s) => Math.max(max, s.order || 0), 0);
    const sectionName = nosSection
      ? (language === "Eng" ? nosSection.english_name : nosSection.chinese_name) || nosSection.chinese_name || nosSection.english_name || "New Section"
      : (language === "Eng" ? "New Section" : "新分區");

    const newSection = {
      quotation_id: quoteId,
      name: sectionName,
      order: maxOrder + 1,
      real_order: maxOrder + 1,
      s_total: 0,
      r_section_id: nosSection?.id || null,
    };

    const { data, error } = await supabase
      .from("quotation_sections")
      .insert(newSection)
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    setSections((prev) => [...prev, data as QuotationSection]);
    setExpandedSections((prev) => new Set([...prev, data.id]));
    setEditingSectionName(data.id);
    toast({ title: language === "Eng" ? "Section added" : "已新增分區" });
  }

  async function renameSection(sectionId: string, name: string) {
    const { error } = await supabase
      .from("quotation_sections")
      .update({ name })
      .eq("id", sectionId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, name } : s)));
    setEditingSectionName(null);
  }

  async function deleteSection(sectionId: string) {
    const { error } = await supabase
      .from("quotation_sections")
      .delete()
      .eq("id", sectionId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    // CASCADE will delete items too
    setItems((prev) => prev.filter((i) => i.section_id !== sectionId));
    setDeleteTarget(null);
    toast({ title: "Section deleted" });
  }

  async function moveSectionUp(sectionId: string) {
    const idx = sections.findIndex((s) => s.id === sectionId);
    if (idx <= 0) return;
    const newSections = [...sections];
    [newSections[idx - 1], newSections[idx]] = [newSections[idx], newSections[idx - 1]];
    // Update order values
    const updates = newSections.map((s, i) => ({ id: s.id, order: i + 1 }));
    setSections(newSections.map((s, i) => ({ ...s, order: i + 1 })));
    // Persist
    for (const u of updates) {
      await supabase.from("quotation_sections").update({ order: u.order }).eq("id", u.id);
    }
  }

  async function moveSectionDown(sectionId: string) {
    const idx = sections.findIndex((s) => s.id === sectionId);
    if (idx >= sections.length - 1) return;
    const newSections = [...sections];
    [newSections[idx], newSections[idx + 1]] = [newSections[idx + 1], newSections[idx]];
    const updates = newSections.map((s, i) => ({ id: s.id, order: i + 1 }));
    setSections(newSections.map((s, i) => ({ ...s, order: i + 1 })));
    for (const u of updates) {
      await supabase.from("quotation_sections").update({ order: u.order }).eq("id", u.id);
    }
  }

  // ─── ITEM CRUD ──────────────────────────────────────────────

  function openItemPicker(sectionId: string) {
    setItemPickerSectionId(sectionId);
    setItemPickerOpen(true);
  }

  async function addItemFromNos(nosItem: NosItem) {
    const maxOrder = items
      .filter((i) => i.section_id === itemPickerSectionId)
      .reduce((max, i) => Math.max(max, i.order_number || 0), 0);

    const newItem = {
      quote_id: quoteId,
      section_id: itemPickerSectionId,
      item_id: nosItem.id,
      c_unit_id: nosItem.unit_id || null,
      description: language === "Eng"
        ? (nosItem.english_name || nosItem.chinese_name)
        : (nosItem.chinese_name || nosItem.english_name),
      unit_price: nosItem.unit_price || 0,
      cost: nosItem.cost || 0,
      quantity: 1,
      sub_total_price: nosItem.unit_price || 0,
      sub_total_cost: nosItem.cost || 0,
      order_number: maxOrder + 1,
      opt: false,
      abandon: false,
    };

    const { data, error } = await supabase
      .from("quotation_section_items")
      .insert(newItem)
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    setItems((prev) => [...prev, data as QuotationSectionItem]);
    setItemPickerOpen(false);
    toast({ title: language === "Eng" ? "Item added" : "已加入項目" });
  }

  async function updateItem(itemId: string, field: string, value: any) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const updated = { ...i, [field]: value };
        // Recalculate subtotals
        if (field === "quantity" || field === "unit_price") {
          updated.sub_total_price = (updated.quantity || 0) * (updated.unit_price || 0);
        }
        if (field === "quantity" || field === "cost") {
          updated.sub_total_cost = (updated.quantity || 0) * (updated.cost || 0);
        }
        return updated;
      })
    );
  }

  async function saveItem(itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const { error } = await supabase
      .from("quotation_section_items")
      .update({
        description: item.description,
        unit_price: item.unit_price,
        cost: item.cost,
        quantity: item.quantity,
        unit: item.unit,
        c_unit_id: item.c_unit_id,
        sub_total_price: (item.quantity || 0) * (item.unit_price || 0),
        sub_total_cost: (item.quantity || 0) * (item.cost || 0),
        opt: item.opt,
        modified_date: new Date().toISOString(),
      })
      .eq("id", itemId);

    if (error) {
      toast({ title: "Error saving item", description: error.message, variant: "destructive" });
    }
  }

  async function deleteItem(itemId: string) {
    // Soft-delete by setting abandon = true
    const { error } = await supabase
      .from("quotation_section_items")
      .update({ abandon: true })
      .eq("id", itemId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setDeleteTarget(null);
    toast({ title: language === "Eng" ? "Item removed" : "已移除項目" });
  }

  // ─── TOGGLE SECTION EXPANSION ──────────────────────────────

  function toggleSection(sectionId: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  // ─── SAVE ALL ────────────────────────────────────────────────

  async function handleSaveAll() {
    if (!hasEditPermission) {
      toast({ title: "Permission denied", description: "You don't have permission to edit quotations", variant: "destructive" });
      return;
    }
    if (!quotation) return;
    setSaving(true);
    try {
      // Save everything: header info + settings + discount + remark
      const { error } = await supabase
        .from("quotations")
        .update({
          cost_centre_id: quotation.cost_centre_id,
          project_type: quotation.project_type,
          project_type_id: quotation.project_type_id,
          l_version: quotation.l_version,
          company_name: quotation.company_name,
          company_address: quotation.company_address,
          contact_person: quotation.contact_person,
          contact_tel: quotation.contact_tel,
          email: quotation.email,
          work_address: quotation.work_address,
          size: quotation.size,
          project_manager: quotation.project_manager,
          pm_tel: quotation.pm_tel,
          quo_head: quotation.quo_head,
          reference_number: quotation.reference_number,
          date: quotation.date,
          remark_under_section: quotation.remark_under_section,
          terms_and_conditions: quotation.terms_and_conditions,
          discount_method: discountForm.discount_method,
          discount_percent: discountForm.discount_percent ? parseFloat(discountForm.discount_percent) : null,
          fixed_discount: discountForm.fixed_discount ? parseFloat(discountForm.fixed_discount) : null,
          modified_date: new Date().toISOString(),
        })
        .eq("id", quoteId);

      if (error) throw error;

      // Save all items
      for (const item of items) {
        await supabase
          .from("quotation_section_items")
          .update({
            description: item.description,
            unit_price: item.unit_price,
            cost: item.cost,
            quantity: item.quantity,
            unit: item.unit,
            c_unit_id: item.c_unit_id,
            sub_total_price: (item.quantity || 0) * (item.unit_price || 0),
            sub_total_cost: (item.quantity || 0) * (item.cost || 0),
            order_number: item.order_number,
            opt: item.opt,
          })
          .eq("id", item.id);
      }

      // Update section totals
      for (const sec of sections) {
        const total = calcSectionTotal(sec.id);
        await supabase
          .from("quotation_sections")
          .update({ s_total: total })
          .eq("id", sec.id);
      }

      toast({ title: "All saved!", description: language === "Eng" ? "Quotation updated successfully" : "報價已更新" });
      setHeaderEditing(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ─── QUICK CREATE CALLBACK ────────────────────────────────────

  function handleQuickCreated(nosItem: NosItem) {
    // After creating in NOS library, add to the current section
    addItemFromNos(nosItem);
  }

  // ─── DRAG & DROP ──────────────────────────────────────────────

  const handleDragEnd = useCallback(async (result: DropResult) => {
    const { source, destination, type } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (type === "SECTION") {
      // Reorder sections
      const newSections = Array.from(sections);
      const [moved] = newSections.splice(source.index, 1);
      newSections.splice(destination.index, 0, moved);

      // Update order values
      const updatedSections = newSections.map((s, i) => ({ ...s, order: i + 1 }));
      setSections(updatedSections);

      // Persist to DB
      for (const s of updatedSections) {
        await supabase.from("quotation_sections").update({ order: s.order }).eq("id", s.id);
      }
    } else if (type === "ITEM") {
      // Reorder items within same section or move between sections
      const sourceSectionId = source.droppableId.replace("items-", "");
      const destSectionId = destination.droppableId.replace("items-", "");

      const sourceItems = items
        .filter((i) => i.section_id === sourceSectionId && !i.abandon)
        .sort((a, b) => (a.order_number || 0) - (b.order_number || 0));

      if (sourceSectionId === destSectionId) {
        // Reorder within same section
        const [moved] = sourceItems.splice(source.index, 1);
        sourceItems.splice(destination.index, 0, moved);

        // Update order numbers
        const updatedItems = sourceItems.map((item, i) => ({ ...item, order_number: i + 1 }));

        // Merge back into full items array
        setItems((prev) =>
          prev.map((item) => {
            const updated = updatedItems.find((u) => u.id === item.id);
            return updated || item;
          })
        );

        // Persist
        for (const item of updatedItems) {
          await supabase
            .from("quotation_section_items")
            .update({ order_number: item.order_number })
            .eq("id", item.id);
        }
      } else {
        // Move item between sections
        const destItems = items
          .filter((i) => i.section_id === destSectionId && !i.abandon)
          .sort((a, b) => (a.order_number || 0) - (b.order_number || 0));

        const [moved] = sourceItems.splice(source.index, 1);
        moved.section_id = destSectionId;
        destItems.splice(destination.index, 0, moved);

        // Update order numbers for both sections
        const updatedSourceItems = sourceItems.map((item, i) => ({ ...item, order_number: i + 1 }));
        const updatedDestItems = destItems.map((item, i) => ({ ...item, order_number: i + 1 }));

        // Merge back
        const allUpdated = [...updatedSourceItems, ...updatedDestItems];
        setItems((prev) =>
          prev.map((item) => {
            const updated = allUpdated.find((u) => u.id === item.id);
            return updated || item;
          })
        );

        // Persist
        for (const item of updatedSourceItems) {
          await supabase
            .from("quotation_section_items")
            .update({ order_number: item.order_number })
            .eq("id", item.id);
        }
        for (const item of updatedDestItems) {
          await supabase
            .from("quotation_section_items")
            .update({ order_number: item.order_number, section_id: item.section_id })
            .eq("id", item.id);
        }
      }
    }
  }, [sections, items, supabase]);

  // ─── STATUS WORKFLOW ──────────────────────────────────────────

  async function handleStatusChange(newStatus: string) {
    if (!quotation) return;
    if (!hasEditPermission) {
      toast({ title: "Permission denied", description: "You do not have permission to change quotation status", variant: "destructive" });
      return;
    }
    const currentStatus = quotation.status || "Draft";
    const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      toast({ title: "Invalid transition", description: `Cannot move from ${currentStatus} to ${newStatus}`, variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase
        .from("quotations")
        .update({ status: newStatus, modified_date: new Date().toISOString() })
        .eq("id", quoteId);
      if (error) throw error;
      setQuotation({ ...quotation, status: newStatus });
      toast({ title: "Status updated", description: `Quotation status changed to ${newStatus}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  // ─── RENDER ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Quotation not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => handleNavClick(`/proposals/${pitchingId}?tab=quotation`, e, (href) => router.push(href))}
              className="h-9 w-9"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-600" />
                {quotation.quotation_no || quotation.name || "Quotation Editor"}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[12px]">
                  {quotation.l_version === "Eng" ? "English" : "中文"}
                </Badge>
                <Badge variant="outline" className="text-[12px]">
                  v{quotation.version_number || 1}
                </Badge>
                {/* Status Workflow Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center focus:outline-none">
                      <Badge
                        className={`text-[12px] cursor-pointer hover:opacity-80 transition-opacity ${
                          quotation.status === "Draft"
                            ? "bg-gray-100 text-gray-600"
                            : quotation.status === "Sent"
                            ? "bg-blue-100 text-blue-700"
                            : quotation.status === "Accepted"
                            ? "bg-green-100 text-green-700"
                            : quotation.status === "Rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {quotation.status || "Draft"}
                        {(STATUS_TRANSITIONS[quotation.status || "Draft"] || []).length > 0 && (
                          <ChevronDown className="w-3 h-3 ml-0.5" />
                        )}
                      </Badge>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <div className="px-2 py-1.5 text-xs font-medium text-gray-500">
                      Change Status
                    </div>
                    <DropdownMenuSeparator />
                    {(STATUS_TRANSITIONS[quotation.status || "Draft"] || []).length > 0 ? (
                      (STATUS_TRANSITIONS[quotation.status || "Draft"] || []).map((target) => {
                        const opt = STATUS_OPTIONS.find((o) => o.value === target);
                        return (
                          <DropdownMenuItem
                            key={target}
                            onClick={() => handleStatusChange(target)}
                            disabled={!hasEditPermission}
                          >
                            {target === "Sent" && <SendHorizontal className="w-3.5 h-3.5 mr-2 text-blue-500" />}
                            {target === "Accepted" && <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-green-500" />}
                            {target === "Rejected" && <XCircle className="w-3.5 h-3.5 mr-2 text-red-500" />}
                            {target === "Draft" && <RotateCcw className="w-3.5 h-3.5 mr-2 text-gray-500" />}
                            Mark as {opt?.label || target}
                          </DropdownMenuItem>
                        );
                      })
                    ) : (
                      <div className="px-2 py-1.5 text-xs text-gray-400 flex items-center gap-1.5">
                        <Lock className="w-3 h-3" />
                        Final state — no transitions
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => handleNavClick(`/proposals/${pitchingId}/quotation/${quoteId}/preview`, e, (href) => router.push(href))}
            >
              <Eye className="w-4 h-4 mr-1.5" />
              Preview
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAll}
              disabled={saving || !hasEditPermission}
              className="bg-violet-600 hover:bg-violet-700"
              title={!hasEditPermission ? "You don't have permission to edit quotations" : ""}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              Save All
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* ─── QUOTATION SETTINGS CARD ────────────────────────── */}
        <Card className="border-violet-100 bg-violet-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Settings className="w-4 h-4 text-violet-500" />
              {language === "Eng" ? "Quotation Settings" : "報價設定"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Company (Cost Centre) */}
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Company (Cost Centre)</Label>
                <Select
                  value={quotation.cost_centre_id || ""}
                  onValueChange={(val) =>
                    setQuotation({ ...quotation, cost_centre_id: val || null })
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {costCentres.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.bu_code ? `${cc.bu_code} — ` : ""}{cc.chinese_display || cc.display || "Unnamed"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Project Type */}
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Project Type</Label>
                <Select
                  value={quotation.project_type_id || ""}
                  onValueChange={(val) => {
                    const selected = projectTypes.find((pt) => pt.id === val);
                    setQuotation({
                      ...quotation,
                      project_type_id: val || null,
                      project_type: selected?.name || null,
                    });
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select project type" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectTypes.map((pt) => (
                      <SelectItem key={pt.id} value={pt.id}>
                        {pt.name || "Unnamed"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Language */}
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Language</Label>
                <Select
                  value={quotation.l_version || "Chi"}
                  onValueChange={(val) =>
                    setQuotation({ ...quotation, l_version: val })
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Chi">中文 (Chinese)</SelectItem>
                    <SelectItem value="Eng">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* ─── HEADER INFO CARD ─────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <PenLine className="w-4 h-4 text-violet-500" />
                {language === "Eng" ? "Quotation Info" : "報價資料"}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHeaderEditing(!headerEditing)}
                className="text-xs"
              >
                {headerEditing ? "Cancel" : "Edit"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {headerEditing ? (
              <div className="space-y-4">
                {/* Three-column layout mimicking actual quotation document */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">
                  {/* Column 1: Company Data */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Company Name</Label>
                      <Input
                        value={quotation.company_name || ""}
                        onChange={(e) => setQuotation({ ...quotation, company_name: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Company Address</Label>
                      <Textarea
                        value={quotation.company_address || ""}
                        onChange={(e) => setQuotation({ ...quotation, company_address: e.target.value })}
                        className="text-sm min-h-[60px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Contact Person</Label>
                      <Input
                        value={quotation.contact_person || ""}
                        onChange={(e) => setQuotation({ ...quotation, contact_person: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Contact Tel</Label>
                      <Input
                        value={quotation.contact_tel || ""}
                        onChange={(e) => setQuotation({ ...quotation, contact_tel: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Email</Label>
                      <Input
                        value={quotation.email || ""}
                        onChange={(e) => setQuotation({ ...quotation, email: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  {/* Column 2: Quote Header, Size & Work Address */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Quotation Header Text</Label>
                      <Textarea
                        value={quotation.quo_head || ""}
                        onChange={(e) => setQuotation({ ...quotation, quo_head: e.target.value })}
                        className="text-sm min-h-[60px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Size</Label>
                      <Input
                        value={quotation.size || ""}
                        onChange={(e) => setQuotation({ ...quotation, size: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Work Address</Label>
                      <Input
                        value={quotation.work_address || ""}
                        onChange={(e) => setQuotation({ ...quotation, work_address: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  {/* Column 3: Reference, Date & Staff */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Reference No.</Label>
                      <Input
                        value={quotation.reference_number || ""}
                        onChange={(e) => setQuotation({ ...quotation, reference_number: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Date</Label>
                      <Input
                        type="date"
                        value={toDateInputValue(quotation.date)}
                        onChange={(e) => setQuotation({ ...quotation, date: e.target.value || null })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Project Manager</Label>
                      <Input
                        value={quotation.project_manager || ""}
                        onChange={(e) => setQuotation({ ...quotation, project_manager: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>


              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-xs text-gray-400">Company</span>
                  <p className="font-medium text-gray-700 truncate">{quotation.company_name || "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Contact</span>
                  <p className="font-medium text-gray-700 truncate">{quotation.contact_person || "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Tel</span>
                  <p className="font-medium text-gray-700">{quotation.contact_tel || "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Work Address</span>
                  <p className="font-medium text-gray-700 truncate">{quotation.work_address || "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Size</span>
                  <p className="font-medium text-gray-700">{quotation.size || "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Project Type</span>
                  <p className="font-medium text-gray-700">
                    {(quotation.project_type_id
                      ? projectTypes.find((pt) => pt.id === quotation.project_type_id)?.name
                      : quotation.project_type) || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">PM</span>
                  <p className="font-medium text-gray-700">{quotation.project_manager || "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Ref No.</span>
                  <p className="font-medium text-gray-700">{quotation.reference_number || "—"}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── SECTIONS ────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              {language === "Eng" ? "Sections & Items" : "分區與項目"} ({sections.length})
            </h2>
            <Button size="sm" variant="outline" onClick={addSection}>
              <Plus className="w-4 h-4 mr-1" />
              {language === "Eng" ? "Add Section" : "新增分區"}
            </Button>
          </div>

          {sections.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-200">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="w-12 h-12 text-gray-200 mb-3" />
                <p className="text-sm text-gray-400 mb-3">
                  {language === "Eng" ? "No sections yet. Add your first section to start." : "尚未有分區，新增第一個分區開始"}
                </p>
                <Button size="sm" variant="outline" onClick={addSection}>
                  <Plus className="w-4 h-4 mr-1" />
                  {language === "Eng" ? "Add Section" : "新增分區"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="sections-list" type="SECTION">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
                    {sections.map((section, sectionIndex) => {
                      const sectionItems = getSectionItems(section.id).sort(
                        (a, b) => (a.order_number || 0) - (b.order_number || 0)
                      );
                      const sectionTotal = calcSectionTotal(section.id);
                      const isExpanded = expandedSections.has(section.id);

                      return (
                        <Draggable key={section.id} draggableId={`section-${section.id}`} index={sectionIndex}>
                          {(dragProvided, dragSnapshot) => (
                            <Card
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className={`overflow-hidden ${dragSnapshot.isDragging ? "shadow-lg ring-2 ring-violet-200" : ""}`}
                            >
                              {/* Section Header */}
                              <div
                                className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b cursor-pointer hover:bg-gray-100 transition-colors"
                                onClick={() => toggleSection(section.id)}
                              >
                                <div
                                  {...dragProvided.dragHandleProps}
                                  className="cursor-grab active:cursor-grabbing"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <GripVertical className="w-4 h-4 text-gray-400 hover:text-gray-600 shrink-0" />
                                </div>
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                                ) : (
                                  <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                                )}

                                {editingSectionName === section.id ? (
                                  <Input
                                    autoFocus
                                    defaultValue={section.name || ""}
                                    onBlur={(e) => renameSection(section.id, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") renameSection(section.id, (e.target as HTMLInputElement).value);
                                      if (e.key === "Escape") setEditingSectionName(null);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-7 text-sm font-medium w-[300px]"
                                  />
                                ) : (
                                  <span className="text-sm font-semibold text-gray-700 flex-1">
                                    {section.name || "Unnamed Section"}
                                  </span>
                                )}

                                <Badge variant="secondary" className="text-xs font-mono ml-auto mr-2">
                                  {sectionItems.length} {language === "Eng" ? "items" : "項"}
                                </Badge>
                                <Badge className="text-xs font-mono bg-violet-100 text-violet-700 hover:bg-violet-100">
                                  {formatMoney(sectionTotal, { showZero: true })}
                                </Badge>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingSectionName(section.id); }}>
                                      <PenLine className="w-3.5 h-3.5 mr-2" /> Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); moveSectionUp(section.id); }} disabled={sectionIndex === 0}>
                                      <ChevronUp className="w-3.5 h-3.5 mr-2" /> Move Up
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); moveSectionDown(section.id); }} disabled={sectionIndex === sections.length - 1}>
                                      <ChevronDown className="w-3.5 h-3.5 mr-2" /> Move Down
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: "section", id: section.id }); }}
                                    >
                                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Section
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              {/* Section Items */}
                              {isExpanded && (
                                <div className="p-4">
                                  {/* Items Table Header */}
                                  {sectionItems.length > 0 && (
                                    <div className="grid grid-cols-[24px_1fr_80px_80px_100px_100px_40px] gap-2 px-2 py-1.5 text-[12px] font-medium text-gray-400 uppercase tracking-wider border-b mb-2">
                                      <span></span>
                                      <span>{language === "Eng" ? "Description" : "描述"}</span>
                                      <span className="text-right">Qty</span>
                                      <span className="text-right">Unit</span>
                                      <span className="text-right">{language === "Eng" ? "Unit Price" : "單價"}</span>
                                      <span className="text-right">{language === "Eng" ? "Amount" : "小計"}</span>
                                      <span></span>
                                    </div>
                                  )}

                                  {/* Items Rows with Drag & Drop */}
                                  <Droppable droppableId={`items-${section.id}`} type="ITEM">
                                    {(itemsProvided, itemsSnapshot) => (
                                      <div
                                        ref={itemsProvided.innerRef}
                                        {...itemsProvided.droppableProps}
                                        className={`min-h-[8px] rounded transition-colors ${itemsSnapshot.isDraggingOver ? "bg-violet-50" : ""}`}
                                      >
                                        {sectionItems.map((item, itemIndex) => (
                                          <Draggable key={item.id} draggableId={`item-${item.id}`} index={itemIndex}>
                                            {(itemDragProvided, itemDragSnapshot) => (
                                              <div
                                                ref={itemDragProvided.innerRef}
                                                {...itemDragProvided.draggableProps}
                                                className={`grid grid-cols-[24px_1fr_80px_80px_100px_100px_40px] gap-2 px-2 py-2 items-center hover:bg-gray-50 rounded group ${
                                                  itemDragSnapshot.isDragging ? "shadow-md bg-white ring-1 ring-violet-200" : ""
                                                }`}
                                              >
                                                <div
                                                  {...itemDragProvided.dragHandleProps}
                                                  className="cursor-grab active:cursor-grabbing flex items-center justify-center"
                                                >
                                                  <GripVertical className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500" />
                                                </div>
                                                <Input
                                                  value={item.description || ""}
                                                  onChange={(e) => updateItem(item.id, "description", e.target.value)}
                                                  onBlur={() => saveItem(item.id)}
                                                  className="h-8 text-sm border-transparent hover:border-gray-200 focus:border-violet-300"
                                                />
                                                <Input
                                                  type="number"
                                                  value={item.quantity ?? ""}
                                                  onChange={(e) => updateItem(item.id, "quantity", e.target.value ? parseFloat(e.target.value) : 0)}
                                                  onBlur={() => saveItem(item.id)}
                                                  className="h-8 text-sm text-right border-transparent hover:border-gray-200 focus:border-violet-300"
                                                />
                                                <Select
                                                  value={item.c_unit_id || "__none__"}
                                                  onValueChange={async (value) => {
                                                    const actualValue = value === "__none__" ? null : value;
                                                    const selectedUnit = nosUnits.find((u) => u.id === actualValue);
                                                    const unitLabel = selectedUnit
                                                      ? (language === "Eng" ? selectedUnit.eng_name : selectedUnit.chi_name) || selectedUnit.eng_name || selectedUnit.chi_name || ""
                                                      : "";
                                                    setItems((prev) =>
                                                      prev.map((i) => {
                                                        if (i.id !== item.id) return i;
                                                        return { ...i, c_unit_id: actualValue, unit: unitLabel };
                                                      })
                                                    );
                                                    // Save directly to DB
                                                    const { error } = await supabase
                                                      .from("quotation_section_items")
                                                      .update({ c_unit_id: actualValue, unit: unitLabel, modified_date: new Date().toISOString() })
                                                      .eq("id", item.id);
                                                    if (error) {
                                                      toast({ title: "Error saving unit", description: error.message, variant: "destructive" });
                                                    }
                                                  }}
                                                >
                                                  <SelectTrigger className="h-8 text-sm text-right border-transparent hover:border-gray-200 focus:border-violet-300 px-1.5">
                                                    <SelectValue placeholder="—">
                                                      {item.c_unit_id
                                                        ? (() => {
                                                            const u = nosUnits.find((u) => u.id === item.c_unit_id);
                                                            return u ? ((language === "Eng" ? u.eng_name : u.chi_name) || u.eng_name || u.chi_name || "—") : (item.unit || "—");
                                                          })()
                                                        : (item.unit || "—")}
                                                    </SelectValue>
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="__none__">— None —</SelectItem>
                                                    {nosUnits.map((u) => (
                                                      <SelectItem key={u.id} value={u.id}>
                                                        {(language === "Eng" ? u.eng_name : u.chi_name) || u.eng_name || u.chi_name}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                                <Input
                                                  type="number"
                                                  value={item.unit_price ?? ""}
                                                  onChange={(e) => updateItem(item.id, "unit_price", e.target.value ? parseFloat(e.target.value) : 0)}
                                                  onBlur={() => saveItem(item.id)}
                                                  className="h-8 text-sm text-right border-transparent hover:border-gray-200 focus:border-violet-300"
                                                />
                                                <div className="text-sm font-mono text-right text-gray-700 pr-2">
                                                  {formatMoney((item.quantity || 0) * (item.unit_price || 0), { showZero: true })}
                                                </div>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
                                                  onClick={() => setDeleteTarget({ type: "item", id: item.id })}
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                              </div>
                                            )}
                                          </Draggable>
                                        ))}
                                        {itemsProvided.placeholder}
                                      </div>
                                    )}
                                  </Droppable>

                                  {/* Add Item Actions */}
                                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dashed">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs"
                                      onClick={() => openItemPicker(section.id)}
                                    >
                                      <Package className="w-3.5 h-3.5 mr-1" />
                                      {language === "Eng" ? "Add from Library" : "從庫存加入"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-xs text-violet-600"
                                      onClick={() => {
                                        setItemPickerSectionId(section.id);
                                        setQuickCreateOpen(true);
                                      }}
                                    >
                                      <PlusCircle className="w-3.5 h-3.5 mr-1" />
                                      {language === "Eng" ? "Quick Create" : "快速建立"}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </Card>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>

        {/* ─── REMARK (BELOW SECTIONS) ─────────────────────────── */}
        <Card>
          <CardContent className="py-5">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-500" />
                {language === "Eng" ? "Remark (below sections)" : "備註 (分區下方)"}
              </h3>
              <Textarea
                value={quotation.remark_under_section || ""}
                onChange={(e) => setQuotation({ ...quotation, remark_under_section: e.target.value })}
                className="text-sm min-h-[80px]"
                placeholder={language === "Eng" ? "Payment terms, notes..." : "付款條款、備註..."}
              />
            </div>
          </CardContent>
        </Card>

        {/* ─── TERMS & CONDITIONS ────────────────────────────────── */}
        <Card>
          <CardContent className="py-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-amber-500" />
                  {language === "Eng" ? "Terms & Conditions" : "條款及細則"}
                </h3>
                {hasEditPermission && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={() => {
                      loadTncTemplateTypes();
                      setSelectedTncTemplateId("");
                      setTncTemplateDialogOpen(true);
                    }}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    套用預設
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-400">
                {language === "Eng"
                  ? "Rich text content that will appear as T&C on the quotation PDF"
                  : "富文本內容，將顯示為報價單 PDF 上的條款及細則"}
              </p>
              <RichTextEditor
                key={`tnc-editor-${tncEditorKey}`}
                content={quotation.terms_and_conditions || ""}
                onChange={(html) => setQuotation({ ...quotation, terms_and_conditions: html })}
                placeholder={language === "Eng" ? "Enter terms and conditions..." : "輸入條款及細則..."}
                minHeight="200px"
              />
            </div>
          </CardContent>
        </Card>

        {/* ─── DISCOUNT & TOTALS ───────────────────────────────── */}
        <Card>
          <CardContent className="py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Discount Controls */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-violet-500" />
                  {language === "Eng" ? "Discount" : "折扣"}
                </h3>
                <div className="space-y-2">
                  <Select
                    value={discountForm.discount_method}
                    onValueChange={(v) => setDiscountForm((p) => ({ ...p, discount_method: v }))}
                  >
                    <SelectTrigger className="h-8 text-sm w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="None">{language === "Eng" ? "No Discount" : "無折扣"}</SelectItem>
                      <SelectItem value="Percentage">{language === "Eng" ? "Percentage %" : "百分比 %"}</SelectItem>
                      <SelectItem value="Fixed">{language === "Eng" ? "Fixed Amount" : "固定金額"}</SelectItem>
                    </SelectContent>
                  </Select>

                  {discountForm.discount_method === "Percentage" && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={discountForm.discount_percent}
                        onChange={(e) => setDiscountForm((p) => ({ ...p, discount_percent: e.target.value }))}
                        placeholder="e.g. 10"
                        className="h-8 text-sm w-[120px]"
                      />
                      <Percent className="w-4 h-4 text-gray-400" />
                    </div>
                  )}

                  {discountForm.discount_method === "Fixed" && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <Input
                        type="number"
                        value={discountForm.fixed_discount}
                        onChange={(e) => setDiscountForm((p) => ({ ...p, fixed_discount: e.target.value }))}
                        placeholder="e.g. 5000"
                        className="h-8 text-sm w-[150px]"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Totals Summary */}
              <div className="flex flex-col justify-end">
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{language === "Eng" ? "Subtotal" : "小計"}</span>
                    <span className="font-mono font-medium text-gray-700">{formatMoney(subtotal, { showZero: true })}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">
                        {language === "Eng" ? "Discount" : "折扣"}
                        {discountForm.discount_method === "Percentage" && ` (${discountForm.discount_percent}%)`}
                      </span>
                      <span className="font-mono font-medium text-red-500">-{formatMoney(discountAmount, { showZero: true })}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-base">
                    <span className="font-semibold text-gray-700">{language === "Eng" ? "Grand Total" : "總計"}</span>
                    <span className="font-mono font-bold text-violet-700 text-lg">{formatMoney(grandTotal, { showZero: true })}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── BOTTOM SAVE BUTTON ─────────────────────────────────── */}
        <div className="flex justify-end pt-4 pb-2">
          <Button
            size="sm"
            onClick={handleSaveAll}
            disabled={saving || !hasEditPermission}
            className="bg-violet-600 hover:bg-violet-700"
            title={!hasEditPermission ? "You don't have permission to edit quotations" : ""}
          >
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Save All
          </Button>
        </div>
      </div>

      {/* ─── MODALS ────────────────────────────────────────────── */}

      {/* NOS Item Picker */}
      <NosItemPicker
        open={itemPickerOpen}
        onClose={() => setItemPickerOpen(false)}
        onSelect={addItemFromNos}
        language={language}
        defaultSectionId={sections.find((s) => s.id === itemPickerSectionId)?.r_section_id || undefined}
      />

      {/* Quick Create Item */}
      <QuickCreateItemDialog
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        sections={nosSections}
        language={language}
        onCreated={handleQuickCreated}
        defaultSectionId={sections.find((s) => s.id === itemPickerSectionId)?.r_section_id || undefined}
      />

      {/* Section Picker Dialog */}
      <Dialog open={sectionPickerOpen} onOpenChange={setSectionPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === "Eng" ? "Select Section Template" : "選擇分區範本"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder={language === "Eng" ? "Search sections..." : "搜尋分區..."}
              value={sectionPickerSearch}
              onChange={(e) => setSectionPickerSearch(e.target.value)}
              autoFocus
            />
            <ScrollArea className="h-[300px] border rounded-md">
              <div className="p-2 space-y-1">
                {nosSections
                  .filter((ns) => {
                    if (!sectionPickerSearch.trim()) return true;
                    const q = sectionPickerSearch.toLowerCase();
                    return (
                      (ns.chinese_name || "").toLowerCase().includes(q) ||
                      (ns.english_name || "").toLowerCase().includes(q)
                    );
                  })
                  .map((ns) => (
                    <button
                      key={ns.id}
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-violet-50 hover:text-violet-700 transition-colors text-sm flex items-center justify-between group"
                      onClick={() => createSectionFromNos(ns)}
                    >
                      <span>
                        {language === "Eng"
                          ? ns.english_name || ns.chinese_name
                          : ns.chinese_name || ns.english_name}
                      </span>
                      <span className="text-xs text-gray-400 group-hover:text-violet-500">
                        {language === "Eng"
                          ? ns.chinese_name
                          : ns.english_name}
                      </span>
                    </button>
                  ))}
                {nosSections.filter((ns) => {
                  if (!sectionPickerSearch.trim()) return true;
                  const q = sectionPickerSearch.toLowerCase();
                  return (
                    (ns.chinese_name || "").toLowerCase().includes(q) ||
                    (ns.english_name || "").toLowerCase().includes(q)
                  );
                }).length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-4">
                    {language === "Eng" ? "No matching sections" : "找不到匹配的分區"}
                  </p>
                )}
              </div>
            </ScrollArea>
            <div className="flex justify-between items-center pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => createSectionFromNos(null)}
              >
                <Plus className="w-4 h-4 mr-1" />
                {language === "Eng" ? "Create blank section" : "建立空白分區"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSectionPickerOpen(false)}>
                {language === "Eng" ? "Cancel" : "取消"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.type === "section" ? "Delete Section?" : "Remove Item?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "section"
                ? "This will delete the section and all its items. This cannot be undone."
                : "This item will be removed from the quotation."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteTarget?.type === "section") deleteSection(deleteTarget.id);
                else if (deleteTarget?.type === "item") deleteItem(deleteTarget.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── T&C TEMPLATE RESET DIALOG ──────────────────────────── */}
      <Dialog open={tncTemplateDialogOpen} onOpenChange={setTncTemplateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-amber-500" />
              套用預設條款 Apply Default T&C
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Warning */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">⚠️ 此操作不可還原</p>
                <p className="text-xs text-amber-700">
                  確認後，目前的條款及細則內容將被完全覆蓋為所選模板的預設內容。此操作無法撤回，請確認後再執行。
                </p>
              </div>
            </div>

            {/* Template selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                選擇條款模板 Select Template
              </Label>
              <Select
                value={selectedTncTemplateId}
                onValueChange={(val) => setSelectedTncTemplateId(val === "none" ? "" : val)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="選擇一個模板..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-gray-400">— 未選擇 No selection —</span>
                  </SelectItem>
                  {tncTemplateTypes.map((tt) => (
                    <SelectItem key={tt.id} value={tt.id}>
                      {tt.name || "Unnamed Template"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTncTemplateDialogOpen(false);
                  setSelectedTncTemplateId("");
                }}
              >
                取消 Cancel
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                disabled={!selectedTncTemplateId || tncTemplateLoading}
                onClick={handleApplyTncTemplate}
              >
                {tncTemplateLoading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                確認套用 Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
