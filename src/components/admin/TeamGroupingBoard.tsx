"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { GripVertical, Loader2, ArrowRightLeft, Users } from "lucide-react";
import {
  fetchTeamGroupingBoard,
  updateStaffTeamAssignment,
  updateTeamTypeActive,
  type TeamGroupingBoard as BoardData,
  type TeamGroupingStaff,
  type TeamGroupingTeam,
} from "@/lib/data-service";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const UNASSIGNED_ID = "__unassigned__";

/** Prefer team card droppables even when the pointer is over a staff chip. */
const teamCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args).filter((c) =>
    String(c.id).startsWith("team:")
  );
  if (pointerHits.length > 0) return pointerHits;
  return rectIntersection(args).filter((c) => String(c.id).startsWith("team:"));
};

function teamDropId(teamId: string) {
  return `team:${teamId}`;
}

function staffDragId(staffId: string) {
  return `staff:${staffId}`;
}

function parseTeamDropId(id: string): string | null {
  if (!id.startsWith("team:")) return null;
  return id.slice("team:".length);
}

function parseStaffDragId(id: string): string | null {
  if (!id.startsWith("staff:")) return null;
  return id.slice("staff:".length);
}

function StaffChip({
  staff,
  onSwitchClick,
  dragging,
}: {
  staff: TeamGroupingStaff;
  onSwitchClick: (staff: TeamGroupingStaff) => void;
  dragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: staffDragId(staff.id),
    data: { staff },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm shadow-sm",
        "hover:border-bw-blue/40 hover:shadow",
        (isDragging || dragging) && "opacity-40"
      )}
    >
      <button
        type="button"
        className="touch-none cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing"
        aria-label={`拖曳 ${staff.name}`}
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-gray-900">{staff.name}</div>
        {staff.position ? (
          <div className="truncate text-[11px] text-gray-400">{staff.position}</div>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-gray-400 hover:text-bw-blue"
        title="更換團隊"
        onClick={() => onSwitchClick(staff)}
      >
        <ArrowRightLeft className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function StaffChipPreview({ staff }: { staff: TeamGroupingStaff }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-bw-blue/50 bg-white px-2 py-1.5 text-sm shadow-lg">
      <GripVertical className="h-3.5 w-3.5 text-bw-blue" />
      <div className="min-w-0">
        <div className="truncate font-medium text-gray-900">{staff.name}</div>
        {staff.position ? (
          <div className="truncate text-[11px] text-gray-400">{staff.position}</div>
        ) : null}
      </div>
    </div>
  );
}

function TeamCard({
  teamId,
  title,
  subtitle,
  isActive,
  staff,
  showToggle,
  toggling,
  onToggleActive,
  onSwitchClick,
  muted,
}: {
  teamId: string;
  title: string;
  subtitle?: string;
  isActive: boolean;
  staff: TeamGroupingStaff[];
  showToggle: boolean;
  toggling: boolean;
  onToggleActive: (next: boolean) => void;
  onSwitchClick: (staff: TeamGroupingStaff) => void;
  muted?: boolean;
}) {
  // Inactive teams are collapsed — not droppable, no staff area.
  const droppableEnabled = isActive;
  const { setNodeRef, isOver } = useDroppable({
    id: teamDropId(teamId),
    data: { teamId },
    disabled: !droppableEnabled,
  });

  const canDeactivate = staff.length === 0;
  // Inactive + empty → compact header only. If data is inconsistent and staff
  // remain, keep them visible (still non-droppable) so they can be moved out.
  const collapsedEmpty = !isActive && showToggle && staff.length === 0;
  const showStaffArea = !collapsedEmpty;

  return (
    <div
      ref={droppableEnabled ? setNodeRef : undefined}
      className={cn(
        "flex flex-col rounded-xl border bg-white shadow-sm transition-colors",
        collapsedEmpty ? "min-h-0" : "min-h-[220px]",
        droppableEnabled && isOver
          ? "border-bw-blue ring-2 ring-bw-blue/20"
          : "border-gray-200",
        muted && "opacity-75"
      )}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-3 px-4 py-3",
          showStaffArea && "border-b border-gray-100"
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className="truncate text-base font-semibold text-bw-navy"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              {title}
            </h3>
            {!isActive && showToggle ? (
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                停用
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-gray-400">
            {!isActive && showToggle
              ? staff.length > 0
                ? `停用異常：仍有 ${staff.length} 位同事，請先移走`
                : "已停用 · 啟用後才可分組"
              : subtitle ?? `${staff.length} 位在職同事`}
          </p>
        </div>
        {showToggle ? (
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            <span className="text-[11px] text-gray-400">
              {isActive ? "啟用" : "停用"}
            </span>
            <Switch
              checked={isActive}
              disabled={toggling || (!canDeactivate && isActive)}
              onCheckedChange={onToggleActive}
              className="data-[state=checked]:bg-bw-blue"
              title={
                !canDeactivate && isActive
                  ? "團隊內仍有同事，無法停用"
                  : undefined
              }
            />
          </div>
        ) : null}
      </div>

      {showStaffArea ? (
        <div className="flex flex-1 flex-col gap-2 p-3">
          {staff.length === 0 ? (
            <div
              className={cn(
                "flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed px-3 py-8 text-center text-xs text-gray-400",
                isOver
                  ? "border-bw-blue bg-bw-blue/5 text-bw-blue"
                  : "border-gray-200"
              )}
            >
              <Users className="mb-2 h-5 w-5 opacity-40" />
              {isOver ? "放開以移入此團隊" : "尚無在職同事 · 可拖曳至此"}
            </div>
          ) : (
            staff.map((s) => (
              <StaffChip key={s.id} staff={s} onSwitchClick={onSwitchClick} />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function TeamGroupingBoard() {
  const { toast } = useToast();
  const [board, setBoard] = useState<BoardData>({ teams: [], unassigned: [] });
  const [loading, setLoading] = useState(true);
  const [busyStaffId, setBusyStaffId] = useState<string | null>(null);
  const [togglingTeamId, setTogglingTeamId] = useState<string | null>(null);
  const [activeStaff, setActiveStaff] = useState<TeamGroupingStaff | null>(null);

  const [switchStaff, setSwitchStaff] = useState<TeamGroupingStaff | null>(null);
  const [switchTarget, setSwitchTarget] = useState<string>("");
  const [switching, setSwitching] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTeamGroupingBoard();
      setBoard(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const teamById = useMemo(() => {
    const map = new Map<string, TeamGroupingTeam>();
    for (const t of board.teams) map.set(t.id, t);
    return map;
  }, [board.teams]);

  const findStaff = useCallback(
    (staffId: string): TeamGroupingStaff | null => {
      for (const t of board.teams) {
        const hit = t.staff.find((s) => s.id === staffId);
        if (hit) return hit;
      }
      return board.unassigned.find((s) => s.id === staffId) ?? null;
    },
    [board]
  );

  const moveStaffOptimistic = useCallback(
    (staffId: string, toTeamId: string | null) => {
      setBoard((prev) => {
        let moved: TeamGroupingStaff | null = null;
        const teams = prev.teams.map((t) => {
          const idx = t.staff.findIndex((s) => s.id === staffId);
          if (idx < 0) return t;
          moved = { ...t.staff[idx], team_id: toTeamId };
          return { ...t, staff: t.staff.filter((s) => s.id !== staffId) };
        });
        let unassigned = prev.unassigned.filter((s) => {
          if (s.id !== staffId) return true;
          moved = { ...s, team_id: toTeamId };
          return false;
        });
        if (!moved) return prev;

        if (!toTeamId) {
          unassigned = [...unassigned, moved].sort((a, b) =>
            a.name.toLowerCase().localeCompare(b.name.toLowerCase())
          );
        } else {
          const nextTeams = teams.map((t) => {
            if (t.id !== toTeamId) return t;
            const staff = [...t.staff, moved!].sort((a, b) =>
              a.name.toLowerCase().localeCompare(b.name.toLowerCase())
            );
            return { ...t, staff };
          });
          return { teams: nextTeams, unassigned };
        }
        return { teams, unassigned };
      });
    },
    []
  );

  const assignStaff = useCallback(
    async (staff: TeamGroupingStaff, toTeamId: string | null) => {
      const fromId = staff.team_id ?? null;
      if (fromId === toTeamId) return;

      if (toTeamId != null) {
        const target = teamById.get(toTeamId);
        if (!target || !target.is_active) {
          toast({
            title: "無法移入",
            description: "停用中的團隊不能加入同事，請先啟用該團隊。",
            variant: "destructive",
          });
          return;
        }
      }

      const teamDisplay =
        toTeamId == null ? null : teamById.get(toTeamId)?.display ?? null;

      setBusyStaffId(staff.id);
      moveStaffOptimistic(staff.id, toTeamId);
      const result = await updateStaffTeamAssignment(
        staff.id,
        toTeamId,
        teamDisplay
      );
      setBusyStaffId(null);

      if (!result.success) {
        moveStaffOptimistic(staff.id, fromId);
        toast({
          title: "更新失敗",
          description: result.error || "無法更改團隊",
          variant: "destructive",
        });
        return;
      }

      const toLabel =
        toTeamId == null
          ? "未分組"
          : teamById.get(toTeamId)?.display || "目標團隊";
      toast({
        title: "已更新團隊",
        description: `${staff.name} → ${toLabel}`,
      });
    },
    [moveStaffOptimistic, teamById, toast]
  );

  const activeTeams = useMemo(
    () => board.teams.filter((t) => t.is_active),
    [board.teams]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const staffId = parseStaffDragId(String(event.active.id));
    if (!staffId) return;
    setActiveStaff(findStaff(staffId));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveStaff(null);
    const staffId = parseStaffDragId(String(event.active.id));
    const overId = event.over ? String(event.over.id) : null;
    if (!staffId || !overId) return;

    const toRaw = parseTeamDropId(overId);
    if (toRaw == null) return;

    const staff = findStaff(staffId);
    if (!staff) return;
    if (busyStaffId) return;

    const toTeamId = toRaw === UNASSIGNED_ID ? null : toRaw;
    if (toTeamId != null) {
      const target = teamById.get(toTeamId);
      if (!target?.is_active) return;
    }
    await assignStaff(staff, toTeamId);
  };

  const handleToggleActive = async (team: TeamGroupingTeam, next: boolean) => {
    if (!next && team.staff.length > 0) {
      toast({
        title: "無法停用",
        description: `「${team.display}」仍有 ${team.staff.length} 位在職同事，請先移走後再停用。`,
        variant: "destructive",
      });
      return;
    }

    setTogglingTeamId(team.id);
    setBoard((prev) => ({
      ...prev,
      teams: prev.teams.map((t) =>
        t.id === team.id ? { ...t, is_active: next } : t
      ),
    }));

    const result = await updateTeamTypeActive(team.id, next);
    setTogglingTeamId(null);

    if (!result.success) {
      setBoard((prev) => ({
        ...prev,
        teams: prev.teams.map((t) =>
          t.id === team.id ? { ...t, is_active: team.is_active } : t
        ),
      }));
      toast({
        title: "更新失敗",
        description: result.error || "無法更新團隊狀態",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: next ? "已啟用團隊" : "已停用團隊",
      description: team.display,
    });
    // Re-sort active first after toggle.
    setBoard((prev) => ({
      ...prev,
      teams: [...prev.teams].sort((a, b) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        return a.display.toLowerCase().localeCompare(b.display.toLowerCase());
      }),
    }));
  };

  const openSwitchDialog = (staff: TeamGroupingStaff) => {
    setSwitchStaff(staff);
    setSwitchTarget(staff.team_id ?? UNASSIGNED_ID);
  };

  const confirmSwitch = async () => {
    if (!switchStaff) return;
    const toTeamId =
      !switchTarget || switchTarget === UNASSIGNED_ID ? null : switchTarget;
    setSwitching(true);
    await assignStaff(switchStaff, toTeamId);
    setSwitching(false);
    setSwitchStaff(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        載入團隊與同事…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold text-bw-navy"
          style={{ fontFamily: "Syne, sans-serif" }}
        >
          分組工具
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          快速調整在職同事所屬團隊。可拖曳同事到其他團隊卡片，或點擊箭頭按鈕開啟更換對話框。團隊內仍有同事時無法停用。
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={teamCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveStaff(null)}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {board.unassigned.length > 0 ? (
            <TeamCard
              teamId={UNASSIGNED_ID}
              title="未分組"
              subtitle={`${board.unassigned.length} 位尚未分組`}
              isActive
              staff={board.unassigned}
              showToggle={false}
              toggling={false}
              onToggleActive={() => {}}
              onSwitchClick={openSwitchDialog}
              muted
            />
          ) : null}

          {board.teams.map((team) => (
            <TeamCard
              key={team.id}
              teamId={team.id}
              title={team.display}
              subtitle={
                team.is_bwf
                  ? `${team.staff.length} 位在職 · BWF`
                  : `${team.staff.length} 位在職同事`
              }
              isActive={team.is_active}
              staff={team.staff}
              showToggle
              toggling={togglingTeamId === team.id}
              onToggleActive={(next) => handleToggleActive(team, next)}
              onSwitchClick={openSwitchDialog}
              muted={!team.is_active}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeStaff ? <StaffChipPreview staff={activeStaff} /> : null}
        </DragOverlay>
      </DndContext>

      <Dialog
        open={!!switchStaff}
        onOpenChange={(open) => {
          if (!open && !switching) setSwitchStaff(null);
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle
              className="text-lg font-bold text-bw-navy"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              更換團隊
            </DialogTitle>
          </DialogHeader>
          {switchStaff ? (
            <div className="space-y-4 py-1">
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <div className="font-medium text-gray-900">{switchStaff.name}</div>
                {switchStaff.position ? (
                  <div className="text-xs text-gray-400">{switchStaff.position}</div>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">目標團隊</label>
                <Select value={switchTarget} onValueChange={setSwitchTarget}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇團隊" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED_ID}>未分組</SelectItem>
                    {activeTeams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.display}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={switching}
              onClick={() => setSwitchStaff(null)}
            >
              取消
            </Button>
            <Button
              type="button"
              className="bg-bw-blue hover:bg-bw-blue/90"
              disabled={switching || !switchStaff}
              onClick={confirmSwitch}
            >
              {switching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  更新中…
                </>
              ) : (
                "確認更換"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
