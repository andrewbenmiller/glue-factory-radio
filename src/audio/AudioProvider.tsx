import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { Howler } from "howler";

type AudioSource = "none" | "track" | "live";

type AudioContextValue = {
  source: AudioSource;

  // NEW: display-only now playing for track playback (Howler)
  trackNowPlaying: string | null;
  setTrackNowPlaying: (title: string | null) => void;

  // called by track player
  notifyTrackWillPlay: () => void;
  notifyTrackDidStop: () => void;
  notifyTrackPaused: () => void; // Track is paused but still loaded

  // called by live button
  playLive: (url: string) => Promise<void>;
  stopLive: () => void;
  pauseLive: () => void;
  resumeLive: () => void;
};

const Ctx = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const liveAudioRef = useRef<HTMLAudioElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const [source, setSource] = useState<AudioSource>("none");

  // NEW
  const [trackNowPlaying, setTrackNowPlaying] = useState<string | null>(null);

  // NEW: token that increments whenever we "switch modes"
  const genRef = useRef(0);

  const stopLive = useCallback(() => {
    const a = liveAudioRef.current;
    if (!a) return;

    genRef.current += 1; // invalidate any in-flight live start
    playPromiseRef.current = null;

    try { a.pause(); } catch {}
    a.src = "";

    setSource((s) => (s === "live" ? "none" : s));
  }, []);

  // "Pause" live by muting — stream keeps playing silently so iOS preserves
  // the audio session and lock screen controls stay visible.
  // Note: iOS ignores a.volume but does support a.muted.
  const pauseLive = useCallback(() => {
    const a = liveAudioRef.current;
    if (!a) return;
    a.muted = true;
  }, []);

  // Resume by unmuting
  const resumeLive = useCallback(() => {
    const a = liveAudioRef.current;
    if (!a) return;
    a.muted = false;
  }, []);

  const playLive = useCallback(async (url: string) => {
    // Live takes over: invalidate prior track actions
    genRef.current += 1;
    const myGen = genRef.current;

    try { Howler.stop(); } catch {}
    setSource("live");

    // Optional: clear track now playing when live starts
    // (keeps ticker clean if you want)
    // setTrackNowPlaying(null);

    let a = liveAudioRef.current;
    if (!a) {
      a = new Audio();
      a.preload = "none";
      liveAudioRef.current = a;

      a.addEventListener("ended", () => {
        // only clear if still current
        if (genRef.current === myGen) setSource("none");
      });
      a.addEventListener("error", () => {
        if (genRef.current === myGen) setSource("none");
      });
    }

    if (a.src !== url) a.src = url;

    try {
      const p = a.play();
      playPromiseRef.current = p;
      await p;
      playPromiseRef.current = null;
    } catch (error: any) {
      playPromiseRef.current = null;
      if (error?.name === "AbortError" || String(error?.message || "").includes("interrupted")) {
        return;
      }
      // only throw if still current action
      if (genRef.current === myGen) throw error;
    }
  }, []);

  const notifyTrackWillPlay = useCallback(() => {
    // Track takes over: invalidate any in-flight live events
    genRef.current += 1;

    const a = liveAudioRef.current;
    if (a) {
      playPromiseRef.current = null;
      try { a.pause(); } catch {}
      a.src = "";
    }

    setSource("track");
  }, []);

  // IMPORTANT: avoid stale closure by using functional setState
  const notifyTrackDidStop = useCallback(() => {
    setSource((s) => (s === "track" ? "none" : s));
  }, []);

  const notifyTrackPaused = useCallback(() => {
    // keep source as "track" (no change)
  }, []);

  const value = useMemo<AudioContextValue>(
    () => ({
      source,
      trackNowPlaying,
      setTrackNowPlaying,
      notifyTrackWillPlay,
      notifyTrackDidStop,
      notifyTrackPaused,
      playLive,
      stopLive,
      pauseLive,
      resumeLive,
    }),
    [source, trackNowPlaying, notifyTrackWillPlay, notifyTrackDidStop, notifyTrackPaused, playLive, stopLive, pauseLive, resumeLive]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAudio() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAudio must be used within AudioProvider");
  return ctx;
}

