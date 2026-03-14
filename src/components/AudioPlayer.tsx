import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
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

export type AutoPlayMode = 'off' | 'sequential' | 'match';

type Props = {
  tracks: Track[];
  initialIndex?: number;
  className?: string;
  showName?: string;
  archiveExpanded?: boolean;
  autoPlayMode?: AutoPlayMode;
  onAutoPlayChange?: (mode: AutoPlayMode) => void;
  onArchiveToggle?: () => void;
  onSearchOpen?: () => void;
  onPlay?: () => void;
  onShowNavigate?: () => void;
  onShowEnded?: () => void;
};

const AudioPlayer = forwardRef<AudioPlayerHandle, Props>(function AudioPlayer(
  { tracks, initialIndex = 0, className = "", showName = "CD Mode", archiveExpanded = false, autoPlayMode = 'off', onAutoPlayChange, onArchiveToggle, onSearchOpen, onPlay, onShowNavigate, onShowEnded },
  ref
) {
  const audio = useAudio();
  const [autoPlayInfoOpen, setAutoPlayInfoOpen] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [index, setIndex] = useState(
    Math.min(Math.max(initialIndex, 0), Math.max(tracks.length - 1, 0))
  );

  // CD-style prev: single tap restarts track, double tap goes to previous
  const prevTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTrack = useCallback(
    (targetIndex: number) => {
      if (targetIndex < 0 || targetIndex >= tracks.length) return;

      setIndex(targetIndex);

      const t = tracks[targetIndex];
      audio.playTrack(t.src, t?.title ?? `Track ${targetIndex + 1}`);
    },
    [tracks, audio]
  );

  const pauseInternal = useCallback(() => {
    audio.pauseTrack();
  }, [audio]);

  const nextInternal = useCallback(() => {
    if (!tracks.length) return;
    const nxt = (index + 1) % tracks.length;
    startTrack(nxt);
  }, [index, tracks.length, startTrack]);

  const resumeOrStart = useCallback(() => {
    // If we have progress on the current track, resume; otherwise start from top
    if (audio.progress > 0 && audio.source === "none") {
      audio.resumeTrack();
    } else if (audio.source === "track" && audio.isPlaying) {
      // Already playing, do nothing
    } else {
      startTrack(index);
    }
  }, [audio, startTrack, index]);

  const prevInternal = useCallback(() => {
    if (!tracks.length) return;

    if (prevTimerRef.current !== null) {
      // Second tap within window → go to previous track
      clearTimeout(prevTimerRef.current);
      prevTimerRef.current = null;
      const prv = (index - 1 + tracks.length) % tracks.length;
      startTrack(prv);
    } else {
      // First tap → wait to see if double tap
      prevTimerRef.current = setTimeout(() => {
        prevTimerRef.current = null;
        // Restart current track from beginning
        audio.seekTrack(0);
        if (!audio.isPlaying) {
          resumeOrStart();
        }
      }, 300);
    }
  }, [index, tracks.length, startTrack, audio, resumeOrStart]);

  // Register auto-advance callback
  useEffect(() => {
    audio.onEndedRef.current = () => {
      // Last track: delegate to parent (auto-play) or stop
      if (index >= tracks.length - 1) {
        if (onShowEnded) {
          onShowEnded();
        } else {
          audio.stopAll();
        }
        return;
      }
      // Otherwise advance to the next track
      const nextIndex = index + 1;
      setIndex(nextIndex);
      const t = tracks[nextIndex];
      if (t) {
        audio.playTrack(t.src, t.title ?? `Track ${nextIndex + 1}`);
      }
    };

    return () => {
      audio.onEndedRef.current = null;
    };
  }, [index, tracks, audio, onShowEnded]);

  // Reset index when track list changes
  useEffect(() => {
    const clamped = Math.min(
      Math.max(initialIndex, 0),
      Math.max(tracks.length - 1, 0)
    );
    setIndex(clamped);

    return () => {
      if (prevTimerRef.current) clearTimeout(prevTimerRef.current);
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
  const isPlaying = audio.isPlaying && audio.source === "track";

  return (
    <div className={`audio-player ${className}`}>
      {/* Bordered container for archive section */}
      <div className="archive-container">
        {/* Expanded content - header is now rendered in App.tsx */}
        {archiveExpanded && (
          <>
            {/* Search bar row with auto-play toggle below */}
            <div className="search-bar-row">
              <div className="search-bar-field" onClick={onSearchOpen} onTouchEnd={(e) => { e.preventDefault(); onSearchOpen?.(); }}>
                <svg className="search-bar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span className="search-bar-placeholder">Search shows...</span>
              </div>
              <div className="autoplay-toggle" onClick={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} onMouseLeave={() => { setAutoPlayInfoOpen(false); if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; } }}>
                <div className="autoplay-track">
                  <div
                    className={`autoplay-thumb ${autoPlayMode === 'off' ? 'pos-off' : autoPlayMode === 'sequential' ? 'pos-seq' : 'pos-match'}`}
                  />
                  <button
                    className={`autoplay-option ${autoPlayMode === 'off' ? 'active' : ''}`}
                    onClick={() => onAutoPlayChange?.('off')}
                  >
                    OFF
                  </button>
                  <button
                    className={`autoplay-option ${autoPlayMode === 'sequential' ? 'active' : ''}`}
                    onClick={() => onAutoPlayChange?.('sequential')}
                  >
                    SEQ
                  </button>
                  <button
                    className={`autoplay-option ${autoPlayMode === 'match' ? 'active' : ''}`}
                    onClick={() => onAutoPlayChange?.('match')}
                  >
                    MATCH
                  </button>
                </div>
                <div className="autoplay-label-row">
                  <span className="autoplay-label">AUTO-PLAY</span>
                  <span
                    className="autoplay-info-btn"
                    onClick={() => setAutoPlayInfoOpen(v => !v)}
                    onMouseEnter={() => {
                      hoverTimerRef.current = setTimeout(() => setAutoPlayInfoOpen(true), 1000);
                    }}
                    onMouseLeave={() => {
                      if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
                    }}
                  >
                    i
                  </span>
                </div>
                {autoPlayInfoOpen && (
                  <div className="autoplay-info-box" onClick={() => setAutoPlayInfoOpen(false)} onMouseLeave={() => setAutoPlayInfoOpen(false)}>
                    <p><strong>SEQ</strong> — Next episode plays in chronological order</p>
                    <p><strong>MATCH</strong> — Next episode plays based on similarity</p>
                  </div>
                )}
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
                {audio.remotePlaybackAvailable && (
                  <button
                    className={`info-control-btn stream-btn ${audio.remotePlaybackState !== 'disconnected' ? 'stream-btn-active' : ''}`}
                    onClick={() => audio.promptRemotePlayback()}
                    title={audio.remotePlaybackState === 'connected' ? 'Streaming (tap to change)' : 'Stream to device'}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                      <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
                      <line x1="2" y1="20" x2="2.01" y2="20" />
                    </svg>
                  </button>
                )}
              </div>
              <span className="archive-info-show" onClick={onShowNavigate} style={{ cursor: onShowNavigate ? 'pointer' : undefined }}>
                <span className="archive-info-label">Currently loaded:</span> <span className="archive-info-show-name">{showName}</span>
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
