"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, PlusCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import type { NosItem, NosSection } from "./NosItemPicker";

interface QuickCreateItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: NosSection[];
  language: "Chi" | "Eng";
  onCreated: (item: NosItem) => void;
  defaultSectionId?: string;
}

export default function QuickCreateItemDialog({
  open,
  onOpenChange,
  sections,
  language,
  onCreated,
  defaultSectionId,
}: QuickCreateItemDialogProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [units, setUnits] = useState<{ id: string; chi_name: string | null; eng_name: string | null }[]>([]);
  const [form, setForm] = useState({
    chinese_name: "",
    english_name: "",
    unit_price: "",
    cost: "",
    section_id: defaultSectionId || "",
    unit_id: "",
    status: "Active" as "Active" | "Inactive",
    remark: "",
  });

  useEffect(() => {
    if (open) {
      loadUnits();
    }
  }, [open]);

  async function loadUnits() {
    const { data } = await supabase
      .from("nos_units")
      .select("id, chi_name, eng_name")
      .order("order", { ascending: true });
    setUnits(data || []);
  }

  function resetForm() {
    setForm({
      chinese_name: "",
      english_name: "",
      unit_price: "",
      cost: "",
      section_id: defaultSectionId || "",
      unit_id: "",
      status: "Active",
      remark: "",
    });
  }

  async function handleCreate() {
    if (!form.chinese_name && !form.english_name) {
      toast({ title: "Error", description: "Please enter at least one name", variant: "destructive" });
      return;
    }
    if (!form.section_id) {
      toast({ title: "Error", description: "Please select a section", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const record: any = {
        chinese_name: form.chinese_name || null,
        english_name: form.english_name || null,
        unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
        cost: form.cost ? parseFloat(form.cost) : null,
        section_id: form.section_id,
        status: form.status,
        unit_id: form.unit_id || null,
        remark: form.remark || null,
      };

      const { data, error } = await supabase
        .from("nos_items")
        .insert(record)
        .select("id, chinese_name, english_name, unit_price, cost, section_id, unit_id")
        .single();

      if (error) throw error;

      toast({ title: "Success", description: language === "Eng" ? "Item created" : "項目已建立" });
      onCreated(data as NosItem);
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function getSectionName(section: NosSection) {
    if (language === "Eng") return section.english_name || section.chinese_name || "";
    return section.chinese_name || section.english_name || "";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-violet-600" />
            {language === "Eng" ? "Quick Create NOS Item" : "快速建立項目"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Chinese Name 中文名稱</Label>
              <Input
                value={form.chinese_name}
                onChange={(e) => setForm((p) => ({ ...p, chinese_name: e.target.value }))}
                placeholder="e.g. 設計費用"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">English Name 英文名稱</Label>
              <Input
                value={form.english_name}
                onChange={(e) => setForm((p) => ({ ...p, english_name: e.target.value }))}
                placeholder="e.g. Design Fee"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Section 分區 <span className="text-red-500">*</span></Label>
            <Select value={form.section_id} onValueChange={(v) => setForm((p) => ({ ...p, section_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select section..." />
              </SelectTrigger>
              <SelectContent>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {getSectionName(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Unit Price 單價 (HKD)</Label>
              <Input
                type="number"
                value={form.unit_price}
                onChange={(e) => setForm((p) => ({ ...p, unit_price: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cost 成本 (HKD)</Label>
              <Input
                type="number"
                value={form.cost}
                onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Unit 單位</Label>
            <Select value={form.unit_id || "none"} onValueChange={(v) => setForm((p) => ({ ...p, unit_id: v === "none" ? "" : v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select unit..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {language === "Eng" ? (u.eng_name || u.chi_name || u.id) : (u.chi_name || u.eng_name || u.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Status 狀態</Label>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${form.status === "Inactive" ? "text-muted-foreground" : "text-muted-foreground/50"}`}>Inactive</span>
              <Switch
                checked={form.status === "Active"}
                onCheckedChange={(checked) => setForm((p) => ({ ...p, status: checked ? "Active" : "Inactive" }))}
              />
              <span className={`text-xs ${form.status === "Active" ? "text-green-600 font-medium" : "text-muted-foreground/50"}`}>Active</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Remarks 備註</Label>
            <Textarea
              value={form.remark}
              onChange={(e) => setForm((p) => ({ ...p, remark: e.target.value }))}
              placeholder={language === "Eng" ? "Enter remarks..." : "輸入備註..."}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {language === "Eng" ? "Cancel" : "取消"}
          </Button>
          <Button onClick={handleCreate} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {language === "Eng" ? "Create & Add" : "建立並加入"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
