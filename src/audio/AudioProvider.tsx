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
  // called by track player
  notifyTrackWillPlay: () => void;
  notifyTrackDidStop: () => void;

  // called by live button
  playLive: (url: string) => Promise<void>;
  stopLive: () => void;
};

const Ctx = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const liveAudioRef = useRef<HTMLAudioElement | null>(null);
  const [source, setSource] = useState<AudioSource>("none");

  const stopLive = useCallback(() => {
    const a = liveAudioRef.current;
    if (!a) return;
    a.pause();
    a.src = "";
    setSource((s) => (s === "live" ? "none" : s));
  }, []);

  const playLive = useCallback(async (url: string) => {
    // Live takes over: hard stop Howler
    try { Howler.stop(); } catch {}
    setSource("live");

    let a = liveAudioRef.current;
    if (!a) {
      a = new Audio();
      a.preload = "none";
      liveAudioRef.current = a;
      a.addEventListener("ended", () => setSource("none"));
      a.addEventListener("error", () => setSource("none"));
    }

    if (a.src !== url) a.src = url;
    await a.play();
  }, []);

  const notifyTrackWillPlay = useCallback(() => {
    // Track takes over: stop live
    stopLive();
    setSource("track");
  }, [stopLive]);

  const notifyTrackDidStop = useCallback(() => {
    if (source === "track") setSource("none");
  }, [source]);

  const value = useMemo<AudioContextValue>(
    () => ({ source, notifyTrackWillPlay, notifyTrackDidStop, playLive, stopLive }),
    [source, notifyTrackWillPlay, notifyTrackDidStop, playLive, stopLive]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAudio() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAudio must be used within AudioProvider");
  return ctx;
}

