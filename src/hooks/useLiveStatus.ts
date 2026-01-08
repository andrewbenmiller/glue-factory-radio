import { useEffect, useState } from "react";
import {
  ICECAST_STREAM_URL,
  ICECAST_MOUNT_PATH,
} from "../config/liveStream";
import { parseIcecastLiveStatus } from "../utils/parseIcecastLiveStatus";

export function useLiveStatus(pollMs = 15000) {
  const [isLive, setIsLive] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<string | null>(null);
  const [showTitle, setShowTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function tick() {
      try {
        setError(null);
        const res = await fetch(`/api/live-status?ts=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        const parsed = parseIcecastLiveStatus(
          json,
          ICECAST_MOUNT_PATH
        );

        if (!cancelled) {
          setIsLive(parsed.isLive);
          setNowPlaying(parsed.nowPlaying);
          setShowTitle(parsed.showTitle);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Live status fetch failed");
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(tick, pollMs);
        }
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [pollMs]);

  return {
    isLive,
    nowPlaying, // Song/track title from Icecast 'yp_currently_playing' field (falls back to 'title')
    showTitle, // Show title from Icecast 'title' field
    streamUrl: ICECAST_STREAM_URL,
    error,
  };
}

