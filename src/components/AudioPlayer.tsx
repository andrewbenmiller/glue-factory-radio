import React, { useEffect, useRef, useState } from "react";
import { Howl } from "howler";
import './AudioPlayer.css';

export type Track = { src: string; title?: string };

type Props = {
  tracks: Track[];
  initialIndex?: number;
  className?: string;
  // Skip amount for +/- controls (seconds)
  skipSeconds?: number;
};

function formatTime(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function EpisodeCDPlayer({
  tracks,
  initialIndex = 0,
  className = "",
  skipSeconds = 10,
}: Props) {
  // Howler instances, one per track
  const howlsRef = useRef<Howl[]>([]);
  const [index, setIndex] = useState(
    Math.min(Math.max(initialIndex, 0), Math.max(tracks.length - 1, 0))
  );
  const [isPlaying, setIsPlaying] = useState(false);

  // UI timing
  const [curTime, setCurTime] = useState(0);
  const [dur, setDur] = useState(0);

  // RAF for smooth progress updates
  const rafId = useRef<number | null>(null);

  const current = () => howlsRef.current[index];

  // Build/teardown Howl objects when tracks change
  useEffect(() => {
    // cleanup old
    howlsRef.current.forEach((h) => {
      try {
        h.unload();
      } catch {}
    });
    howlsRef.current = tracks.map((t, i) => {
      return new Howl({
        src: [t.src],
        html5: true, // good for longer files and accurate eventing
        preload: true,
        onload: () => {
          if (i === index) setDur(Math.max(howlsRef.current[i].duration() || 0, 0));
        },
        onend: () => {
          if (i === index) handleNext();
        },
        onplay: () => {
          if (i === index) {
            setIsPlaying(true);
            startRaf();
          }
        },
        onpause: () => {
          if (i === index) {
            setIsPlaying(false);
            stopRaf();
            syncTimes();
          }
        },
        onstop: () => {
          if (i === index) {
            setIsPlaying(false);
            stopRaf();
            syncTimes();
          }
        },
      });
    });

    // initial duration (if metadata is ready)
    setTimeout(() => {
      const h = current();
      setDur(h?.duration() || 0);
      setCurTime((h?.seek() as number) || 0);
    }, 0);

    return () => {
      stopRaf();
      howlsRef.current.forEach((h) => {
        try {
          h.unload();
        } catch {}
      });
      howlsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.map((t) => t.src).join("|")]);

  // When index changes, sync duration/time and play state
  useEffect(() => {
    const h = current();
    stopRaf();
    setDur(h?.duration() || 0);
    setCurTime((h?.seek() as number) || 0);
    setIsPlaying(h?.playing() || false);
    if (h?.playing()) startRaf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function startRaf() {
    stopRaf();
    rafId.current = requestAnimationFrame(step);
  }
  function stopRaf() {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = null;
  }
  function step() {
    const h = current();
    if (h && h.playing()) {
      setCurTime((h.seek() as number) || 0);
      setDur(h.duration() || 0);
      rafId.current = requestAnimationFrame(step);
    }
  }
  function syncTimes() {
    const h = current();
    setCurTime((h?.seek() as number) || 0);
    setDur(h?.duration() || 0);
  }

  // Controls (CD-mode: no scrubbing)
  function handlePlayPause() {
    const h = current();
    if (!h) return;
    if (h.playing()) {
      h.pause();
    } else {
      h.play();
    }
  }

  function handleNext() {
    const old = current();
    if (old?.playing()) old.stop();
    setIndex((i) => {
      const next = (i + 1) % Math.max(howlsRef.current.length, 1);
      setTimeout(() => howlsRef.current[next]?.play(), 0);
      return next;
    });
  }

  function handlePrev() {
    const old = current();
    if (old?.playing()) old.stop();
    setIndex((i) => {
      const prev = (i - 1 + Math.max(howlsRef.current.length, 1)) % Math.max(
        howlsRef.current.length,
        1
      );
      setTimeout(() => howlsRef.current[prev]?.play(), 0);
      return prev;
    });
  }

  function handleSkipForward() {
    const h = current();
    if (!h) return;
    const t = Math.min((h.seek() as number) + skipSeconds, h.duration() || 0);
    h.seek(t);
    syncTimes();
  }

  function handleSkipBack() {
    const h = current();
    if (!h) return;
    const t = Math.max((h.seek() as number) - skipSeconds, 0);
    h.seek(t);
    syncTimes();
  }

  // Non-draggable progress bar (display only)
  const pct = dur > 0 ? Math.min(Math.max((curTime / dur) * 100, 0), 100) : 0;
  const title = tracks[index]?.title ?? `Track ${index + 1}`;

  return (
    <div className={`audio-player ${className}`}>
      <div className="player-info">
        <div className="show-info">
          <h3>CD Mode</h3>
          <p>Track {index + 1} of {tracks.length}</p>
        </div>
        
        <div className="track-info">
          <h4>{title}</h4>
          <p>Track {index + 1}</p>
        </div>
      </div>

      <div className="progress-container">
        <div className="time-display">
          <span>{formatTime(curTime)}</span>
          <span>{formatTime(dur)}</span>
        </div>
        
        {/* Non-draggable timeline (display only) */}
        <div className="timeline">
          <div
            className="progress"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="controls">
        <button 
          className="control-btn skip-btn" 
          onClick={handlePrev}
          title="Previous Track"
        >
          ⏮
        </button>
        
        <button 
          className="control-btn skip-btn" 
          onClick={handleSkipBack}
          title={`Back ${skipSeconds}s`}
        >
          -{skipSeconds}s
        </button>

        <button 
          className="control-btn play-btn" 
          onClick={handlePlayPause}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? '⏸' : '▶️'}
        </button>

        <button 
          className="control-btn skip-btn" 
          onClick={handleSkipForward}
          title={`Forward ${skipSeconds}s`}
        >
          +{skipSeconds}s
        </button>

        <button 
          className="control-btn skip-btn" 
          onClick={handleNext}
          title="Next Track"
        >
          ⏭
        </button>
      </div>

      <div className="mt-3 text-xs text-neutral-500">
        <div>Tracks: {tracks.length}</div>
        <div>CD Mode: No manual scrubbing. Use ±{skipSeconds}s or Next/Prev.</div>
      </div>
    </div>
  );
}
