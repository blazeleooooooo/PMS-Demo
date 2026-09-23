"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { handleNavClick } from "@/lib/nav-click";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DesignJobReportCard from "@/components/reports/DesignJobReportCard";
import {
  listDesignerDailyFeed,
  type DesignerDailyFeedItem,
} from "@/lib/design-job-service";
import { createClient } from "@/lib/supabase/client";

export default function DesignerDailyFeed() {
  const router = useRouter();
  const [date, setDate] = useState<Date>(() => new Date());
  const [staffId, setStaffId] = useState<string>("all");
  const [staffOptions, setStaffOptions] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<DesignerDailyFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("staff")
        .select("id, name, full_name, position, status")
        .or("position.eq.Designer,position.eq.3D Designer")
        .order("name");
      setStaffOptions(
        ((data || []) as { id: string; name: string | null; full_name: string | null }[]).map(
          (s) => ({
            id: s.id,
            name: s.full_name || s.name || s.id,
          })
        )
      );
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ymd = format(date, "yyyy-MM-dd");
      const rows = await listDesignerDailyFeed(ymd, { staffId });
      setItems(rows);
    } catch (err: any) {
      console.error("[DesignerDailyFeed]", err);
      setError(err?.message || "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [date, staffId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">設計師每日匯報</h1>
          <p className="text-sm text-gray-500 mt-1">
            檢視當日設計工作項匯報
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(date, "yyyy-MM-dd")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="設計師" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部設計師</SelectItem>
              {staffOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          載入中...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
          此日沒有設計工作匯報
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <DesignJobReportCard
              key={item.task_id}
              workHour={item.work_hour}
              displayName={item.display_name}
              description={item.task_description}
              progressPct={item.progress_pct ?? 0}
              accumHours={item.accum_hours}
              budgetHours={item.budget_hours}
              dueDate={item.due_date}
              designStage={item.design_stage}
              nosTaskDisplay={item.nos_task_display}
              staffName={item.staff_name}
              onClick={(e) =>
                handleNavClick(
                  `/design-reports/design-jobs/${item.design_job_id}`,
                  e,
                  (href) => router.push(href)
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
