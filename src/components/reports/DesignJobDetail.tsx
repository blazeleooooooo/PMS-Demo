"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DesignJobReportCard from "@/components/reports/DesignJobReportCard";
import {
  formatDueDateZh,
  getDesignJobAccumHours,
  getDesignJobById,
  getDesignJobStageHours,
  getDesignJobTasks,
  getNosTaskDisplay,
  type DesignJob,
  type DesignJobStageHours,
} from "@/lib/design-job-service";

interface DesignJobDetailProps {
  jobId: string;
}

export default function DesignJobDetail({ jobId }: DesignJobDetailProps) {
  const router = useRouter();
  const [job, setJob] = useState<DesignJob | null>(null);
  const [accum, setAccum] = useState(0);
  const [stageHours, setStageHours] = useState<DesignJobStageHours[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [nosTaskDisplay, setNosTaskDisplay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const j = await getDesignJobById(jobId);
      if (!j) {
        setError("找不到此設計工作項");
        setJob(null);
        setNosTaskDisplay(null);
        return;
      }
      setJob(j);
      const [a, stages, taskRows, taskLabel] = await Promise.all([
        getDesignJobAccumHours(jobId),
        getDesignJobStageHours(jobId),
        getDesignJobTasks(jobId),
        getNosTaskDisplay(j.nos_task_id),
      ]);
      setAccum(a);
      setStageHours(stages);
      setTasks(taskRows);
      setNosTaskDisplay(taskLabel);
    } catch (err: any) {
      console.error("[DesignJobDetail]", err);
      setError(err?.message || "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        載入中...
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> 返回
        </Button>
        <p className="text-sm text-red-600">{error || "找不到資料"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">設計工作項詳情</h1>
            <p className="text-sm text-gray-500">{job.display_name}</p>
          </div>
        </div>
        <Button variant="outline" size="icon" onClick={load}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <DesignJobReportCard
        workHour={accum}
        displayName={job.display_name}
        description={`階段：${job.design_stage}`}
        progressPct={Number(job.progress_pct) || 0}
        accumHours={accum}
        budgetHours={Number(job.budget_hours) || 0}
        dueDate={job.due_date}
        designStage={job.design_stage}
        nosTaskDisplay={nosTaskDisplay}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-400">累積工時</p>
            <p className="text-2xl font-semibold tabular-nums">{accum}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-400">預算總工時</p>
            <p className="text-2xl font-semibold tabular-nums">{job.budget_hours}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-400">完成日</p>
            <p className="text-lg font-semibold">{formatDueDateZh(job.due_date)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-800">各階段工時</h2>
          {stageHours.length === 0 ? (
            <p className="text-sm text-gray-400">尚無匯報</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>設計階段</TableHead>
                  <TableHead className="text-right">工時</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stageHours.map((row) => (
                  <TableRow key={row.design_stage}>
                    <TableCell>{row.design_stage}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.hours}h</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-800">匯報紀錄</h2>
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-400">尚無紀錄</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>同事</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>階段</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">工時</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => {
                  const dateRel = Array.isArray(t.man_hour_dates)
                    ? t.man_hour_dates[0]
                    : t.man_hour_dates;
                  const rd = dateRel?.report_date
                    ? new Date(dateRel.report_date).toLocaleDateString("zh-HK", { timeZone: "Asia/Hong_Kong" })
                    : "—";
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap">{rd}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {t.staff_name || "—"}
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate">
                        {t.task_description || "—"}
                      </TableCell>
                      <TableCell>{t.design_stage || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {t.progress_pct != null ? `${t.progress_pct}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(t.work_hour) || 0}h
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
