import React, { useEffect, useRef, useState } from "react";
import { Howl, Howler } from "howler";
import './AudioPlayer.css';

export type Track = { src: string; title?: string };

type Props = {
  tracks: Track[];
  initialIndex?: number;
  className?: string;
  // Skip amount for +/- controls (seconds)
  skipSeconds?: number;
  showName?: string;
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
  showName = "CD Mode",
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
  const playGenRef = useRef<number>(0); // generation token to guard async events

  const current = () => howlsRef.current[index];

  // Build/teardown Howl objects when tracks change
  useEffect(() => {
    // hard stop any prior audio, reset UI state
    Howler.stop();
              setIsPlaying(false);

    // cleanup old
    howlsRef.current.forEach((h) => {
      try {
        h.unload();
      } catch {}
    });

    // init howls (bind events to keep isPlaying in sync)
    howlsRef.current = tracks.map((t, i) =>
      new Howl({
        src: [t.src],
        html5: true,
        preload: true,
        onplay: () => {
        setIsPlaying(true);
          startRaf();
        },
        onpause: () => {
          setIsPlaying(false);
          stopRaf();
        },
        onstop: () => {
          setIsPlaying(false);
          stopRaf();
        },
        onend: () => {
          // momentarily not playing; next() will flip it back on play
        setIsPlaying(false);
          // Auto-advance to next track
          stopAll();
          const nxt = (i + 1) % howlsRef.current.length;
          const h = howlsRef.current[nxt];
          if (h) {
            if (h.state() !== "loaded") {
              h.once("load", () => { h.seek(0); h.play(); });
              h.load();
            } else {
              h.seek(0);
              h.play();
            }
          }
        },
      })
    );
    return () => {
      Howler.stop();
      setIsPlaying(false);
      howlsRef.current.forEach((h) => h.unload());
      stopRaf();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.map((t) => t.src).join("|")]);

  // When initialIndex changes (from external track selection), update our index
  useEffect(() => {
    const newIndex = Math.min(Math.max(initialIndex, 0), Math.max(tracks.length - 1, 0));
    if (newIndex !== index) {
      setIndex(newIndex);
    }
  }, [initialIndex, tracks.length, index]);

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

  // Tokenized end handler to prevent stale callbacks
  const handleTrackEnd = (endedIdx: number, genAtRegistration: number) => {
    if (endedIdx !== index) return;
    if (genAtRegistration !== playGenRef.current) return; // stale callback => ignore
    // Auto-advance to next track
    Howler.stop();
    const nxt = (index + 1) % howlsRef.current.length;
    play(nxt);
  };

  // Rock-solid play function
  const play = (i = index) => {
    if (!howlsRef.current.length) return;
    stopAll();
    if (i !== index) setIndex(i);
    const h = howlsRef.current[i];
    if (!h) return;
    if (h.state() !== "loaded") {
      h.once("load", () => { h.seek(0); h.play(); }); // onplay will set isPlaying
      h.load();
    } else {
      h.seek(0);
      h.play();
    }
  };

  // Global stop to prevent rogue tracks
  const stopAll = () => {
    Howler.stop();          // guarantees no stragglers
    setIsPlaying(false);    // reflect UI state
    stopRaf();
    syncTimes();
  };

  // Controls (CD-mode: no scrubbing)
  function handlePlayPause() {
    const h = current();
    if (!h) return;
    if (h.playing()) {
      h.pause(); // onpause will set isPlaying false
    } else {
      stopAll();     // sets isPlaying=false
      h.seek(0);
      h.play();      // onplay -> isPlaying=true
    }
  }

  function handleNext() {
    stopAll();
    setIndex((prev) => {
      const nxt = (prev + 1) % howlsRef.current.length;
      const h = howlsRef.current[nxt];
      if (h) {
        if (h.state() !== "loaded") {
          h.once("load", () => { h.seek(0); h.play(); });
          h.load();
        } else {
          h.seek(0);
          h.play();
        }
      }
      return nxt;
    });
  }

  function handlePrev() {
    stopAll();
    setIndex((prev) => {
      const prv = (prev - 1 + howlsRef.current.length) % howlsRef.current.length;
      const h = howlsRef.current[prv];
      if (h) {
        if (h.state() !== "loaded") {
          h.once("load", () => { h.seek(0); h.play(); });
          h.load();
        } else {
          h.seek(0);
          h.play();
        }
      }
      return prv;
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
          <h3>{showName}</h3>
          <p>Track {index + 1} of {tracks.length}</p>
        </div>
        
        <div className="track-info" style={{ textAlign: 'center' }}>
          <h4 className="track-title" style={{ textAlign: 'center' }}>{title}</h4>
        </div>
      </div>

        <div className="progress-container">
          <div className="time-display">
          <span>{formatTime(curTime)} / {formatTime(dur)}</span>
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
            className="control-btn play-btn" 
          onClick={handlePlayPause}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          <button 
            className="control-btn skip-btn" 
          onClick={handleNext}
            title="Next Track"
          >
            ⏭
          </button>
        </div>
    </div>
  );
}
