import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { Howl, Howler } from "howler";
import { useAudio } from "../audio/AudioProvider";
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
  next: () => void;
  prev: () => void;
  resumeOrStart: () => void;
};

type Props = {
  tracks: Track[];
  initialIndex?: number;
  className?: string;
  showName?: string;
  archiveExpanded?: boolean;
  onArchiveToggle?: () => void;
  onSearchOpen?: () => void;
  onPlay?: () => void;
};

const AudioPlayer = forwardRef<AudioPlayerHandle, Props>(function AudioPlayer(
  { tracks, initialIndex = 0, className = "", showName = "CD Mode", archiveExpanded = false, onArchiveToggle, onSearchOpen, onPlay },
  ref
) {
  const audio = useAudio();
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
    // Don't call notifyTrackDidStop when pausing - track is still loaded
    // This keeps the ticker active and showing track info
    audio.notifyTrackPaused?.();
  }, [current, audio]);

  /** Stop ALL audio immediately */
  function stopAll(notifyStop = false) {
    Howler.stop();
    setIsPlaying(false);
    if (notifyStop) {
      audio.notifyTrackDidStop();
    }
  }

  const startTrack = useCallback(
    (targetIndex: number) => {
      if (!howlsRef.current.length) return;
      if (targetIndex < 0 || targetIndex >= howlsRef.current.length) return;

      // Prevent old "end" handlers from firing
      playGenRef.current += 1;
      const token = playGenRef.current;

      // Stop everything before starting another track
      stopAll(false); // Don't notify stop since we're about to start a new track
      audio.notifyTrackWillPlay();
      setIndex(targetIndex);

      // Set track now playing in provider
      const t = tracks[targetIndex];
      audio.setTrackNowPlaying(t?.title ?? `Track ${targetIndex + 1}`);

      const h = howlsRef.current[targetIndex];
      if (!h) return;

      const doPlay = () => {
        if (token !== playGenRef.current) return;

        try {
          h.stop(); // make sure the instance is clean before starting
        } catch {}

        // CD-style: always start track from the top
        h.seek(0);
        setIsPlaying(true);

        // ───────────────────────────────────────────────
        //       AUTO-ADVANCE THROUGH SHOW (NO LOOP)
        // ───────────────────────────────────────────────
        h.once("end", () => {
          if (token !== playGenRef.current) return;

          const total = howlsRef.current.length;
          if (!total) {
            setIsPlaying(false);
            audio.setTrackNowPlaying(null);
            audio.notifyTrackDidStop();
            return;
          }

          // Stop after the last track (NO looping)
          if (targetIndex >= total - 1) {
            setIsPlaying(false);
            audio.setTrackNowPlaying(null);
            audio.notifyTrackDidStop();
            return;
          }

          // Otherwise advance to the next track
          const nextIndex = targetIndex + 1;
          startTrack(nextIndex);
        });
        // ───────────────────────────────────────────────

        h.play();
      };

      // If already loaded, play immediately
      const state = h.state();
      if (state === "loaded") {
        doPlay();
      } else {
        // Load on demand then play
        h.once("load", () => {
          if (token !== playGenRef.current) return;
          doPlay();
        });
        h.once("loaderror", (_id, error) => {
          console.error("AudioPlayer: load error for track", targetIndex, error);
          if (token !== playGenRef.current) return;
          setIsPlaying(false);
        });
        h.load();
      }

      // Ensure Howler audio context is unlocked (mobile-safe)
      try {
        const ctx = (Howler as any).ctx;
        if (ctx && ctx.state === "suspended") {
          ctx.resume();
        }
      } catch (e) {
        console.warn("AudioPlayer: ctx.resume failed", e);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tracks.length, audio]  // only depends on track count
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
      // Make sure source is set to "track" when resuming
      if (audio.source !== "track") {
        audio.notifyTrackWillPlay();
      }
      h.play();
      setIsPlaying(true);
    } else {
      // Otherwise, start this track from the top
      startTrack(index);
    }
  }, [current, startTrack, index, audio]);

  // Build/unload Howls when the track list changes
  useEffect(() => {
    console.log("AudioPlayer: Building Howl instances for", tracks.length, "tracks");

    // Stop audio but don't notify - tracks are being rebuilt, not stopped
    Howler.stop();
    setIsPlaying(false);
    
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
      Howler.stop();
      setIsPlaying(false);
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
      stopAll(false); // Don't notify stop when just changing index
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
      next: nextInternal,
      prev: prevInternal,
      resumeOrStart,
    }),
    [index, startTrack, pauseInternal, nextInternal, prevInternal, resumeOrStart]
  );

  const title = tracks[index]?.title ?? `Track ${index + 1}`;

  return (
    <div className={`audio-player ${className}`}>
      {/* Bordered container for archive section */}
      <div className="archive-container">
        {/* Expanded content - header is now rendered in App.tsx */}
        {archiveExpanded && (
          <>
            {/* Search bar row */}
            <div className="search-bar-row" onClick={onSearchOpen} onTouchEnd={(e) => { e.preventDefault(); onSearchOpen?.(); }}>
              <div className="search-bar-field">
                <svg className="search-bar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span className="search-bar-placeholder">Search shows...</span>
              </div>
            </div>

            {/* Info row with inline transport controls */}
            <div className="archive-info-row">
              <div className="archive-info-controls">
                <button
                  className="info-control-btn"
                  onClick={prevInternal}
                  title="Previous Track"
                >
                  <img src={prevIcon} alt="Previous" />
                </button>
                <button
                  className="info-control-btn"
                  onClick={() => { if (isPlaying) { pauseInternal(); } else { resumeOrStart(); onPlay?.(); } }}
                  title={isPlaying ? "Pause" : "Play"}
                >
                  <img src={isPlaying ? pauseIcon : playIcon} alt={isPlaying ? "Pause" : "Play"} />
                </button>
                <button
                  className="info-control-btn"
                  onClick={nextInternal}
                  title="Next Track"
                >
                  <img src={nextIcon} alt="Next" />
                </button>
              </div>
              <span className="archive-info-show">
                <span className="archive-info-label">Currently loaded:</span> {showName}
              </span>
              <span className="archive-info-track">
                Track {index + 1}/{tracks.length}: {title}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

export default AudioPlayer;
