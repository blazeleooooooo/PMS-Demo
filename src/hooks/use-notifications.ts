"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface Notification {
  id: string;
  recipient_staff_id: string;
  title: string;
  message: string | null;
  type: string;
  bwa_project_id: string | null;
  bwf_project_id: string | null;
  income_id: string | null;
  expense_id: string | null;
  link_url: string | null;
  metadata: Record<string, any>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data (optional)
  bwa_projects?: { id: string; project_name: string; project_code: string } | null;
  bwf_projects?: { id: string; project_name: string; project_code: string } | null;
  incomes?: { id: string; invoice_number: string; income_amount: number } | null;
  expenses?: { id: string; invoice_number: string; installment_amount: number } | null;
}

export function useNotifications() {
  const { staff } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const staffId = staff?.id ?? null;

  const fetchNotifications = useCallback(async () => {
    if (!staffId) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("notifications")
      .select(`
        *,
        bwa_projects:bwa_project_id(id, project_name, project_code),
        bwf_projects:bwf_project_id(id, project_name, project_code),
        incomes:income_id(id, invoice_number, income_amount),
        expenses:expense_id(id, invoice_number, installment_amount)
      `)
      .eq("recipient_staff_id", staffId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[useNotifications] Fetch error:", error);
      setIsLoading(false);
      return;
    }

    setNotifications((data as Notification[]) || []);
    setUnreadCount(data?.filter((n: any) => !n.is_read).length || 0);
    setIsLoading(false);
  }, [staffId]);

  // Mark a single notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      const supabase = createClient();
      await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId);

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    },
    []
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!staffId) return;
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("recipient_staff_id", staffId)
      .eq("is_read", false);

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
    );
    setUnreadCount(0);
  }, [staffId]);

  // Initial fetch (and again when impersonated staff changes)
  useEffect(() => {
    setIsLoading(true);
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time subscription keyed by effective staff.id
  useEffect(() => {
    if (!staffId) return;

    const supabase = createClient();
    const channelName = `notifications:${staffId}`;

    const existingChannel = supabase.getChannels().find((ch: any) => ch.topic === `realtime:${channelName}`);
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }

    const channel = supabase.channel(channelName);

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `recipient_staff_id=eq.${staffId}`,
      },
      (payload: any) => {
        const newNotif = payload.new as Notification;
        setNotifications((prev) => [newNotif, ...prev]);
        setUnreadCount((prev) => prev + 1);
      }
    );

    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "notifications",
        filter: `recipient_staff_id=eq.${staffId}`,
      },
      (payload: any) => {
        const updated = payload.new as Notification;
        setNotifications((prev) =>
          prev.map((n) => (n.id === updated.id ? { ...updated, ...n, ...updated } : n))
        );
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [staffId]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
