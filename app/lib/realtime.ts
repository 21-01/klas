import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { api } from "./api";
import type { RealtimeChannel } from "@supabase/supabase-js";

type PresensiPayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

type NotifikasiPayload = {
  eventType: "INSERT" | "UPDATE";
  new: Record<string, unknown>;
};

export function useRealtimePresensi(sesi_id?: string) {
  const [checkins, setCheckins] = useState<PresensiPayload[]>([]);

  useEffect(() => {
    if (!sesi_id) return;

    const channel: RealtimeChannel = supabase
      .channel("presensi-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "presensi",
          filter: `sesi_id=eq.${sesi_id}`,
        },
        (payload: PresensiPayload) => {
          setCheckins((prev) => [payload, ...prev.slice(0, 49)]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sesi_id]);

  return checkins;
}

export function useRealtimeSession(sesi_id?: string) {
  const [sessionData, setSessionData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!sesi_id) return;

    const fetchSession = async () => {
      try {
        const data = await api.getLiveSession(sesi_id);
        setSessionData(data as unknown as Record<string, unknown>);
      } catch { /* ignore */ }
    };
    fetchSession();

    const channel: RealtimeChannel = supabase
      .channel("session-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sesi_kehadiran",
          filter: `sesi_id=eq.${sesi_id}`,
        },
        async () => {
          await fetchSession();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sesi_id]);

  return sessionData;
}

export function useRealtimeNotifikasi(user_id?: string) {
  const [notifications, setNotifications] = useState<NotifikasiPayload[]>([]);

  useEffect(() => {
    if (!user_id) return;

    const channel: RealtimeChannel = supabase
      .channel("notifikasi-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifikasi",
          filter: `user_id=eq.${user_id}`,
        },
        (payload: NotifikasiPayload) => {
          setNotifications((prev) => [payload, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user_id]);

  return notifications;
}

export function useSessionBroadcast(sesi_id?: string) {
  const [broadcast, setBroadcast] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!sesi_id) return;

    const channel: RealtimeChannel = supabase
      .channel(`session-${sesi_id}`)
      .on("broadcast", { event: "qr-update" }, (payload) => {
        setBroadcast(payload as Record<string, unknown>);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sesi_id]);

  return broadcast;
}
