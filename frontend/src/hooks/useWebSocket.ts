import { useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";

const WS_URL =
  typeof window !== "undefined"
    ? `ws://${window.location.host}/ws`
    : "ws://localhost/ws";

export function useWebSocket() {
  const { sessionId, updateJob } = useStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();
  const attemptsRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    function connect() {
      if (!mounted) return;

      const url = `${WS_URL}/progress/${sessionId}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        attemptsRef.current = 0;
        console.info("[WS] Connected to", url);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "ping" || msg.type === "connected") return;

          const { job_id, type, ...patch } = msg;
          if (job_id) {
            updateJob(job_id, {
              status: patch.status,
              progress: patch.progress ?? undefined,
              error_message: patch.error ?? undefined,
              download_url: patch.download_url ?? undefined,
              title: patch.title ?? undefined,
              thumbnail_url: patch.thumbnail_url ?? undefined,
              duration: patch.duration ?? undefined,
              artist: patch.artist ?? undefined,
              file_size: patch.file_size ?? undefined,
            });
          }
        } catch (e) {
          console.warn("[WS] Parse error:", e);
        }
      };

      ws.onerror = () => {
        console.warn("[WS] Error");
      };

      ws.onclose = () => {
        if (!mounted) return;
        attemptsRef.current++;
        const delay = Math.min(1000 * 2 ** attemptsRef.current, 30000);
        console.info(`[WS] Reconnecting in ${delay}ms`);
        reconnectRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      mounted = false;
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [sessionId, updateJob]);

  return wsRef;
}
