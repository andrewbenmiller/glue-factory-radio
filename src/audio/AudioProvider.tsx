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

// Tiny silent WAV (44 bytes of silence, ~0.01s) as a data URI.
// Used to keep the iOS audio session alive when the live stream is paused.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const liveAudioRef = useRef<HTMLAudioElement | null>(null);
  const keepAliveRef = useRef<HTMLAudioElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const [source, setSource] = useState<AudioSource>("none");

  // NEW
  const [trackNowPlaying, setTrackNowPlaying] = useState<string | null>(null);

  // NEW: token that increments whenever we "switch modes"
  const genRef = useRef(0);

  const stopKeepAlive = useCallback(() => {
    const ka = keepAliveRef.current;
    if (ka) {
      try { ka.pause(); } catch {}
      ka.src = "";
    }
  }, []);

  const stopLive = useCallback(() => {
    stopKeepAlive();
    const a = liveAudioRef.current;
    if (!a) return;

    genRef.current += 1;
    playPromiseRef.current = null;

    try { a.pause(); } catch {}
    a.src = "";

    setSource((s) => (s === "live" ? "none" : s));
  }, [stopKeepAlive]);

  // Pause live stream but play a silent audio loop to keep iOS audio session alive.
  // Lock screen controls stay visible and functional.
  const pauseLive = useCallback(() => {
    const a = liveAudioRef.current;
    if (!a) return;

    try { a.pause(); } catch {}
    a.src = "";

    // Start silent keep-alive audio
    let ka = keepAliveRef.current;
    if (!ka) {
      ka = new Audio();
      ka.loop = true;
      keepAliveRef.current = ka;
    }
    ka.src = SILENT_WAV;
    ka.play().catch(() => {});
  }, []);

  // Resume live stream and stop the keep-alive audio
  const resumeLive = useCallback(() => {
    stopKeepAlive();
  }, [stopKeepAlive]);

  const playLive = useCallback(async (url: string) => {
    // Live takes over: invalidate prior track actions
    genRef.current += 1;
    const myGen = genRef.current;

    stopKeepAlive();
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
  }, [stopKeepAlive]);

  const notifyTrackWillPlay = useCallback(() => {
    // Track takes over: invalidate any in-flight live events
    genRef.current += 1;
    stopKeepAlive();

    const a = liveAudioRef.current;
    if (a) {
      playPromiseRef.current = null;
      try { a.pause(); } catch {}
      a.src = "";
    }

    setSource("track");
  }, [stopKeepAlive]);

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

