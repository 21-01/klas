import { useEffect, useState } from "react";
import {
  createRealtimeClient,
  type MaterializedLiveQuerySubscription,
  type RealtimeClient,
  type SealedLiveQuery,
} from "@neon/realtime/client";
import { api } from "./api";
import { getAccessToken } from "./auth";

const SSR = import.meta.env.SSR;

type RealtimeRow = Record<string, unknown>;

type PresensiPayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

type NotifikasiPayload = {
  eventType: "INSERT" | "UPDATE";
  new: Record<string, unknown>;
};

// One lazily-created client multiplexes every subscription, so no app-wide
// RealtimeProvider is required. It opens its socket on the first subscribe.
let realtimeClient: RealtimeClient | null = null;

function getRealtimeClient(): RealtimeClient {
  if (!realtimeClient) {
    realtimeClient = createRealtimeClient({
      url: import.meta.env.VITE_NEON_REALTIME_URL,
    });
  }
  return realtimeClient;
}

/**
 * Ask the API to seal a live query for the current user and return the
 * short-lived capability the Realtime client subscribes with.
 */
async function sealQuery<Row>(path: string, body?: unknown): Promise<SealedLiveQuery<Row>> {
  const token = await getAccessToken();
  const res = await fetch(`${import.meta.env.VITE_NEON_API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data: any = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  }

  // The seal endpoints may return the capability directly or under a wrapper.
  return (data?.sealed ?? data?.query ?? data) as SealedLiveQuery<Row>;
}

function rowTime(row: RealtimeRow): number {
  const value = row.waktu_check_in ?? row.tanggal ?? row.created_at;
  if (typeof value !== "string") return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

export function useRealtimePresensi(sesi_id?: string) {
  const [checkins, setCheckins] = useState<PresensiPayload[]>([]);

  useEffect(() => {
    if (SSR || !sesi_id) return;

    let cancelled = false;
    let subscription: MaterializedLiveQuerySubscription<RealtimeRow> | null = null;

    (async () => {
      try {
        const sealed = await sealQuery<RealtimeRow>("/realtime/presensi", { sesi_id });
        if (cancelled) return;

        subscription = getRealtimeClient().subscribe(sealed);
        subscription.onChange((snapshot) => {
          if (!snapshot.data) return;
          const rows = [...snapshot.data].sort((a, b) => rowTime(b) - rowTime(a));
          setCheckins(
            rows.slice(0, 50).map((row) => ({
              eventType: "INSERT" as const,
              new: row,
              old: {},
            }))
          );
        });
      } catch {
        /* keep the last known rows if the capability could not be obtained */
      }
    })();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [sesi_id]);

  return checkins;
}

export function useRealtimeSession(sesi_id?: string) {
  const [sessionData, setSessionData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (SSR || !sesi_id) return;

    let cancelled = false;
    let subscription: MaterializedLiveQuerySubscription<RealtimeRow> | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchSession = async () => {
      try {
        const data = await api.getLiveSession(sesi_id);
        if (!cancelled) {
          setSessionData(data as unknown as Record<string, unknown>);
        }
      } catch {
        /* ignore transient fetch failures */
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        void fetchSession();
      }, 250);
    };

    void fetchSession();

    (async () => {
      try {
        const sealed = await sealQuery<RealtimeRow>("/realtime/sesi", { sesi_id });
        if (cancelled) return;

        subscription = getRealtimeClient().subscribe(sealed);
        subscription.onChange(() => {
          // The row changed: refetch the api.getLiveSession shape consumers use.
          scheduleRefresh();
        });
      } catch {
        /* keep polling the initial fetch result */
      }
    })();

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      subscription?.unsubscribe();
    };
  }, [sesi_id]);

  return sessionData;
}

export function useRealtimeNotifikasi(user_id?: string) {
  const [notifications, setNotifications] = useState<NotifikasiPayload[]>([]);

  useEffect(() => {
    if (SSR || !user_id) return;

    let cancelled = false;
    let subscription: MaterializedLiveQuerySubscription<RealtimeRow> | null = null;

    (async () => {
      try {
        // The API scopes notifications to the bearer token's user.
        const sealed = await sealQuery<RealtimeRow>("/realtime/notifikasi");
        if (cancelled) return;

        subscription = getRealtimeClient().subscribe(sealed);
        subscription.onChange((snapshot) => {
          if (!snapshot.data) return;
          setNotifications(
            snapshot.data.map((row) => ({
              eventType: "INSERT" as const,
              new: row,
            }))
          );
        });
      } catch {
        /* keep the last known notifications */
      }
    })();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [user_id]);

  return notifications;
}

/**
 * Neon Realtime has no broadcast channels. QR rotation is now observed through
 * `useRealtimePresensi` / `useRealtimeSession` live queries instead. The
 * signature is kept so existing consumers keep compiling.
 */
export function useSessionBroadcast(_sesi_id?: string): Record<string, unknown> | null {
  return null;
}
