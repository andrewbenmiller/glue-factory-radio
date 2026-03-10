import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";

type AudioSource = "none" | "track" | "live";

type RemotePlaybackState = "disconnected" | "connecting" | "connected";

type AudioContextValue = {
  source: AudioSource;

  // Display-only now playing for track playback
  trackNowPlaying: string | null;

  // Live stream
  playLive: (url: string) => Promise<void>;
  stopLive: () => void;

  // Track playback (replaces Howler)
  playTrack: (url: string, title: string) => void;
  pauseTrack: () => void;
  resumeTrack: () => void;
  seekTrack: (time: number) => void;
  stopAll: () => void;

  // Playback state
  isPlaying: boolean;
  progress: number;
  duration: number;

  // Unified volume (0–1)
  setVolume: (v: number) => void;

  // Consumer callback for track ended (auto-advance)
  onEndedRef: React.MutableRefObject<(() => void) | null>;

  // Remote Playback (AirPlay / Cast)
  remotePlaybackAvailable: boolean;
  remotePlaybackState: RemotePlaybackState;
  promptRemotePlayback: () => void;
};

const Ctx = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [source, setSource] = useState<AudioSource>("none");
  const [trackNowPlaying, setTrackNowPlaying] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Token that increments whenever we "switch modes"
  const genRef = useRef(0);
  // Consumer callback for when a track ends (auto-advance)
  const onEndedRef = useRef<(() => void) | null>(null);

  // Remote Playback API (AirPlay on Safari, Cast on Chrome)
  const [remotePlaybackAvailable, setRemotePlaybackAvailable] = useState(false);
  const [remotePlaybackState, setRemotePlaybackState] = useState<RemotePlaybackState>("disconnected");

  const stopAll = useCallback(() => {
    genRef.current += 1;
    const a = audioRef.current;
    if (a) {
      try { a.pause(); } catch {}
      a.removeAttribute("src");
      a.load(); // reset the element
    }
    setSource("none");
    setTrackNowPlaying(null);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
  }, []);

  const stopLive = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;

    genRef.current += 1;

    try { a.pause(); } catch {}
    a.removeAttribute("src");
    a.load();

    setSource((s) => (s === "live" ? "none" : s));
    setIsPlaying(false);
  }, []);

  const playLive = useCallback(async (url: string) => {
    genRef.current += 1;
    const myGen = genRef.current;

    const a = audioRef.current;
    if (!a) return;

    // Stop whatever was playing
    try { a.pause(); } catch {}

    setSource("live");
    setTrackNowPlaying(null);
    setProgress(0);
    setDuration(0);

    a.src = url;

    try {
      await a.play();
      if (genRef.current === myGen) {
        setIsPlaying(true);
      }
    } catch (error: any) {
      if (error?.name === "AbortError" || String(error?.message || "").includes("interrupted")) {
        return;
      }
      if (genRef.current === myGen) {
        setSource("none");
        setIsPlaying(false);
        throw error;
      }
    }
  }, []);

  const playTrack = useCallback((url: string, title: string) => {
    genRef.current += 1;
    const myGen = genRef.current;

    const a = audioRef.current;
    if (!a) return;

    // Stop whatever was playing
    try { a.pause(); } catch {}

    setSource("track");
    setTrackNowPlaying(title);
    setProgress(0);
    setDuration(0);

    a.src = url;
    a.currentTime = 0;

    a.play().then(() => {
      if (genRef.current === myGen) {
        setIsPlaying(true);
      }
    }).catch((error: any) => {
      if (error?.name === "AbortError" || String(error?.message || "").includes("interrupted")) {
        return;
      }
      if (genRef.current === myGen) {
        console.error("playTrack error:", error);
        setIsPlaying(false);
      }
    });
  }, []);

  const pauseTrack = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    try { a.pause(); } catch {}
    setIsPlaying(false);
    setSource((s) => (s === "track" ? "none" : s));
  }, []);

  const resumeTrack = useCallback(() => {
    const myGen = genRef.current;
    const a = audioRef.current;
    if (!a) return;

    setSource("track");

    a.play().then(() => {
      if (genRef.current === myGen) {
        setIsPlaying(true);
      }
    }).catch((error: any) => {
      if (error?.name === "AbortError" || String(error?.message || "").includes("interrupted")) {
        return;
      }
      console.error("resumeTrack error:", error);
    });
  }, []);

  const seekTrack = useCallback((time: number) => {
    const a = audioRef.current;
    if (a) a.currentTime = time;
  }, []);

  const setVolume = useCallback((v: number) => {
    const a = audioRef.current;
    if (a) a.volume = v;
  }, []);

  // --- Audio element event handlers ---

  const handleTimeUpdate = useCallback(() => {
    const a = audioRef.current;
    if (a) setProgress(a.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const a = audioRef.current;
    if (a && isFinite(a.duration)) {
      setDuration(a.duration);
    }
  }, []);

  const handleDurationChange = useCallback(() => {
    const a = audioRef.current;
    if (a && isFinite(a.duration)) {
      setDuration(a.duration);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    if (onEndedRef.current) {
      onEndedRef.current();
    } else {
      setSource("none");
      setTrackNowPlaying(null);
    }
  }, []);

  const handleError = useCallback(() => {
    setIsPlaying(false);
    setSource("none");
    setTrackNowPlaying(null);
  }, []);

  // --- Remote Playback API ---

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !("remote" in a)) return;

    const remote = (a as any).remote;

    // Watch for device availability
    let cancelId: number | undefined;
    try {
      remote.watchAvailability((available: boolean) => {
        setRemotePlaybackAvailable(available);
      }).then((id: number) => {
        cancelId = id;
      }).catch(() => {
        // watchAvailability not supported — fall back to assuming available
        // (Safari may not support watchAvailability but still supports prompt)
        setRemotePlaybackAvailable(true);
      });
    } catch {
      // Remote Playback API exists but watchAvailability throws
      setRemotePlaybackAvailable(true);
    }

    // Track connection state changes
    const onConnecting = () => setRemotePlaybackState("connecting");
    const onConnect = () => setRemotePlaybackState("connected");
    const onDisconnect = () => setRemotePlaybackState("disconnected");

    remote.addEventListener("connecting", onConnecting);
    remote.addEventListener("connect", onConnect);
    remote.addEventListener("disconnect", onDisconnect);

    return () => {
      if (cancelId !== undefined) {
        try { remote.cancelWatchAvailability(cancelId); } catch {}
      }
      remote.removeEventListener("connecting", onConnecting);
      remote.removeEventListener("connect", onConnect);
      remote.removeEventListener("disconnect", onDisconnect);
    };
  }, []);

  const promptRemotePlayback = useCallback(() => {
    const a = audioRef.current;
    if (!a || !("remote" in a)) return;
    try {
      (a as any).remote.prompt().catch((err: any) => {
        // User cancelled or no devices — not an error
        if (err.name !== "NotAllowedError" && err.name !== "InvalidStateError") {
          console.warn("Remote playback prompt failed:", err);
        }
      });
    } catch {}
  }, []);

  const value = useMemo<AudioContextValue>(
    () => ({
      source,
      trackNowPlaying,
      playLive,
      stopLive,
      playTrack,
      pauseTrack,
      resumeTrack,
      seekTrack,
      stopAll,
      isPlaying,
      progress,
      duration,
      setVolume,
      onEndedRef,
      remotePlaybackAvailable,
      remotePlaybackState,
      promptRemotePlayback,
    }),
    [source, trackNowPlaying, playLive, stopLive, playTrack, pauseTrack, resumeTrack, seekTrack, stopAll, isPlaying, progress, duration, setVolume, remotePlaybackAvailable, remotePlaybackState, promptRemotePlayback]
  );

  return (
    <Ctx.Provider value={value}>
      {/* eslint-disable-next-line */}
      <audio
        ref={audioRef}
        preload="none"
        // @ts-ignore: WebKit-specific AirPlay attribute
        x-webkit-airplay="allow"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleDurationChange}
        onEnded={handleEnded}
        onError={handleError}
      />
      {children}
    </Ctx.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAudio must be used within AudioProvider");
  return ctx;
}
