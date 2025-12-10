import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { Howl, Howler } from "howler";
import "./AudioPlayer.css";
import prevIcon from "../assets/icons/prev-icon.svg";
import playIcon from "../assets/icons/play-icon.svg";
import pauseIcon from "../assets/icons/pause-icon.svg";
import nextIcon from "../assets/icons/next-icon.svg";

export type Track = { src: string; title?: string };

export type AudioPlayerHandle = {
  /** Called from a user click (e.g. track dropdown) to start a specific track */
  playFromUI: (i?: number) => void;
  pause: () => void;
};

type Props = {
  tracks: Track[];
  initialIndex?: number;
  className?: string;
  showName?: string;
};

const AudioPlayer = forwardRef<AudioPlayerHandle, Props>(function AudioPlayer(
  { tracks, initialIndex = 0, className = "", showName = "CD Mode" },
  ref
) {
  const howlsRef = useRef<Howl[]>([]);
  const [index, setIndex] = useState(
    Math.min(Math.max(initialIndex, 0), Math.max(tracks.length - 1, 0))
  );
  const [isPlaying, setIsPlaying] = useState(false);

  // Used to avoid race conditions when rapidly switching tracks
  const playGenRef = useRef(0);

  const current = useCallback(() => howlsRef.current[index], [index]);

  const pauseInternal = useCallback(() => {
    const h = current();
    if (!h) return;
    h.pause();
    setIsPlaying(false);
  }, [current]);

  /** Stop ALL audio immediately */
  function stopAll() {
    Howler.stop();
    setIsPlaying(false);
  }

  const startTrack = useCallback(
    (targetIndex: number) => {
      if (!howlsRef.current.length) return;
      if (targetIndex < 0 || targetIndex >= howlsRef.current.length) return;

      playGenRef.current += 1;
      const token = playGenRef.current;

      stopAll();
      if (targetIndex !== index) setIndex(targetIndex);

      const h = howlsRef.current[targetIndex];
      if (!h) return;

      const doPlay = () => {
        if (token !== playGenRef.current) return;

        try {
          h.stop();
        } catch {}

        // CD-style: always start this track from the top
        h.seek(0);
        setIsPlaying(true);

        // ✅ NO AUTO-ADVANCE HERE – just stop when the track ends
        h.once("end", () => {
          if (token !== playGenRef.current) return;
          setIsPlaying(false);
        });

        h.play();
      };

      const state = h.state();
      if (state === "loaded") {
        doPlay();
      } else {
        h.once("load", () => {
          if (token !== playGenRef.current) return;
          doPlay();
        });
        h.once("loaderror", (_id, error) => {
          console.error("🎵 AudioPlayer: load error for track", targetIndex, error);
          if (token !== playGenRef.current) return;
          setIsPlaying(false);
        });
        h.load();
      }

      // Make sure the Howler audio context is resumed (mobile-safe)
      try {
        const ctx = (Howler as any).ctx;
        if (ctx && ctx.state === "suspended") {
          ctx.resume();
        }
      } catch (e) {
        console.warn("🎵 AudioPlayer: ctx.resume failed", e);
      }
    },
    [index]
  );

  const nextInternal = useCallback(() => {
    if (!howlsRef.current.length) return;
    const nxt = (index + 1) % howlsRef.current.length;
    startTrack(nxt);
  }, [index, startTrack]);

  const prevInternal = useCallback(() => {
    if (!howlsRef.current.length) return;
    const prv = (index - 1 + howlsRef.current.length) % howlsRef.current.length;
    startTrack(prv);
  }, [index, startTrack]);

  const resumeOrStart = useCallback(() => {
    const h = current();
    if (!h) return;

    const state = h.state();
    const pos = (h.seek() as number) || 0;

    // If we have a loaded track and we're somewhere in the middle,
    // just resume from the current position
    if (state === "loaded" && pos > 0) {
      h.play();
      setIsPlaying(true);
    } else {
      // Otherwise, start this track from the top
      startTrack(index);
    }
  }, [current, startTrack, index]);

  // Build/unload Howls when the track list changes
  useEffect(() => {
    console.log("🎵 AudioPlayer: Building Howl instances for", tracks.length, "tracks");

    stopAll();
    howlsRef.current.forEach((h) => {
      try {
        h.unload();
      } catch {}
    });

    howlsRef.current = tracks.map((t) => {
      const howl = new Howl({
        src: [t.src],
        html5: true,   // Progressive HTTP streaming
        preload: false, // Load on demand only

        // Keep React state in sync with Howler playback events
        onplay: () => setIsPlaying(true),
        onpause: () => setIsPlaying(false),
        onstop: () => setIsPlaying(false),
      });
      return howl;
    });

    const clamped = Math.min(
      Math.max(initialIndex, 0),
      Math.max(tracks.length - 1, 0)
    );
    setIndex(clamped);
    setIsPlaying(false);

    return () => {
      stopAll();
      howlsRef.current.forEach((h) => {
        try {
          h.unload();
        } catch {}
      });
      howlsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.map((t) => t.src).join("|")]);

  // Update current index when parent changes initialIndex (e.g. dropdown select)
  useEffect(() => {
    const newIndex = Math.min(
      Math.max(initialIndex, 0),
      Math.max(tracks.length - 1, 0)
    );
    if (newIndex !== index && tracks.length > 0) {
      stopAll();
      setIndex(newIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIndex]);

  // Imperative API for the parent (ShowList click)
  useImperativeHandle(
    ref,
    () => ({
      playFromUI: (i?: number) => {
        const target = typeof i === "number" ? i : index;
        startTrack(target);
      },
      pause: pauseInternal,
    }),
    [index, startTrack, pauseInternal]
  );

  const title = tracks[index]?.title ?? `Track ${index + 1}`;

  return (
    <div className={`audio-player ${className}`}>
      <div className="player-info">
        <div className="show-info">
          <h3>{showName}</h3>
          <p className="track-count">
            Track {index + 1} of {tracks.length}
          </p>
        </div>
        <div className="track-info" style={{ textAlign: "center" }}>
          <h4 className="track-title" style={{ textAlign: "center" }}>
            {title}
          </h4>
        </div>
      </div>

      <div className="controls">
        <button
          className="control-btn skip-btn"
          onClick={prevInternal}
          title="Previous Track"
        >
          <span className="desktop-icon">⏮</span>
          <img
            src={prevIcon}
            alt="Previous"
            className="mobile-icon"
            style={{ width: "48px", height: "48px" }}
          />
        </button>

        <button
          className="control-btn play-btn"
          onClick={() => (isPlaying ? pauseInternal() : resumeOrStart())}
          title={isPlaying ? "Pause" : "Play"}
        >
          <span className="desktop-icon">{isPlaying ? "⏸" : "▶"}</span>
          <img
            src={isPlaying ? pauseIcon : playIcon}
            alt={isPlaying ? "Pause" : "Play"}
            className="mobile-icon"
            style={{ width: "48px", height: "48px" }}
          />
        </button>

        <button
          className="control-btn skip-btn"
          onClick={nextInternal}
          title="Next Track"
        >
          <span className="desktop-icon">⏭</span>
          <img
            src={nextIcon}
            alt="Next"
            className="mobile-icon"
            style={{ width: "48px", height: "48px" }}
          />
        </button>
      </div>
    </div>
  );
});

export default AudioPlayer;
