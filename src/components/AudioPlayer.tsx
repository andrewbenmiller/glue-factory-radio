import React, {
  useEffect, useRef, useState,
  forwardRef, useImperativeHandle, useCallback
} from "react";
import { Howl, Howler } from "howler";
import './AudioPlayer.css';
import prevIcon from '../assets/icons/prev-icon.svg';
import playIcon from '../assets/icons/play-icon.svg';
import pauseIcon from '../assets/icons/pause-icon.svg';
import nextIcon from '../assets/icons/next-icon.svg';

export type Track = { src: string; title?: string };

export type AudioPlayerHandle = {
  playFromUI: (i?: number) => void;  // must be called in a user click
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

  const playGenRef = useRef(0);

  // Mobile-safe play function
  async function playFromGesture(target = index) {
    playGenRef.current += 1;
    const token = playGenRef.current;

    const ctx = (Howler as any).ctx;
    try {
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
        console.log('AudioContext resumed');
        // Play a 1-sample silent buffer to fully unlock iOS
        const node = ctx.createBufferSource();
        node.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        node.connect(ctx.destination);
        node.start(0);
        node.disconnect();
      }
    } catch (e) {
      console.warn('resume failed', e);
    }

    // Stop only the current track, not global Howler
    const currentHowl = howlsRef.current[index];
    currentHowl?.stop();
    setIsPlaying(false);

    if (target !== index) setIndex(target);

    const h = howlsRef.current[target];
    if (!h) return console.warn('No howl found for target', target);

    const onReady = () => {
      if (token !== playGenRef.current) return;
      try {
        const id = h.play();
        console.log('play id', id);
        h.seek(0, id);
        h.once("end", () => { if (token === playGenRef.current) next(); });
      } catch (e) {
        console.error('play threw', e);
        // Fallback: recreate with html5:true
        console.warn('Play error, retrying with html5:true', e);
        const fallbackHowl = new Howl({ 
          src: [tracks[target].src], 
          html5: true, 
          preload: true
        });
        howlsRef.current[target] = fallbackHowl;
        fallbackHowl.play();
      }
    };

    if (h.state() !== "loaded") { 
      h.once("load", onReady); 
      h.load(); 
    } else { 
      onReady(); 
    }
  }

  const current = useCallback(() => howlsRef.current[index], [index]);

  // Build/unload Howls when tracks change
  useEffect(() => {
    Howler.stop();
    setIsPlaying(false);
    howlsRef.current.forEach((h) => { try { h.unload(); } catch {} });

    howlsRef.current = tracks.map((t, i) => new Howl({
      src: [t.src],
      // Use html5:true for mobile compatibility, html5:false for desktop
      html5: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
      preload: true,
      // Mobile-specific configuration
      mobileAutoEnable: true,
      xhr: {
        method: 'GET',
        headers: {},
        withCredentials: false
      },
      onplay: () => { 
        setIsPlaying(true); 
      },
      onpause: () => { 
        setIsPlaying(false); 
      },
      onstop: () => { 
        setIsPlaying(false); 
      },
    }));

    const clamped = Math.min(Math.max(initialIndex, 0), Math.max(tracks.length - 1, 0));
    setIndex(clamped);

    return () => {
      Howler.stop();
      howlsRef.current.forEach((h) => { try { h.unload(); } catch {} });
      howlsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.map((t) => t.src).join("|")]);

  // If only the selected track within the same show changes,
  // just update index (we will call playFromUI from the click).
  useEffect(() => {
    const newIndex = Math.min(Math.max(initialIndex, 0), Math.max(tracks.length - 1, 0));
    if (newIndex !== index && tracks.length > 0) {
      // Stop current playback
      Howler.stop();
      setIsPlaying(false);
      
      // Update index
      setIndex(newIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIndex]);

  const next = useCallback(() => {
    if (!howlsRef.current.length) return;
    const nxt = (index + 1) % howlsRef.current.length;
    
    playGenRef.current += 1;
    const token = playGenRef.current;
    
    // Stop all sounds first to prevent double playback
    Howler.stop();
    setIsPlaying(false);
    
    setIndex(nxt);
    const h = howlsRef.current[nxt];
    if (!h) return;
    
    const start = () => {
      if (token !== playGenRef.current) return;
      try { h.stop(); } catch {}
      h.seek(0);
      h.once("end", () => { if (token === playGenRef.current) next(); });
      h.play();
    };
    if (h.state() !== "loaded") { h.once("load", start); h.load(); } else { start(); }
  }, [index]);

  // Imperative API: must be called in the user click handler
  useImperativeHandle(ref, () => ({
    playFromUI: (i?: number) => {
      const target = typeof i === "number" ? i : index;
      if (!howlsRef.current[target]) return;

      playGenRef.current += 1;
      const token = playGenRef.current;

      // Stop everything, switch index
      Howler.stop();
      setIsPlaying(false);
      if (target !== index) setIndex(target);

      const h = howlsRef.current[target];

      // 1) Start immediately in the click (gesture)
      const id = h.play();

      // 2) When metadata is ready, snap to 0 and wire end
      const onReady = () => {
        if (token !== playGenRef.current) return;
        // no stop/replay; just seek and wire 'end'
        h.seek(0, id);
        h.once("end", () => { if (token === playGenRef.current) next(); });
      };

      if (h.state() !== "loaded") {
        h.once("load", onReady);
        h.load();
      } else {
        onReady();
      }

      // Kick the Howler context just in case
      try { (Howler as any).ctx?.resume?.(); } catch {}
    },
    pause: () => current()?.pause()
  }), [index, current, next]);

  function prev() {
    if (!howlsRef.current.length) return;
    const prv = (index - 1 + howlsRef.current.length) % howlsRef.current.length;
    
    playGenRef.current += 1;
    const token = playGenRef.current;
    
    // Stop all sounds first to prevent double playback
    Howler.stop();
    setIsPlaying(false);
    
    setIndex(prv);
    const h = howlsRef.current[prv];
    if (!h) return;
    
    const start = () => {
      if (token !== playGenRef.current) return;
      try { h.stop(); } catch {}
      h.seek(0);
      h.once("end", () => { if (token === playGenRef.current) next(); });
      h.play();
    };
    if (h.state() !== "loaded") { h.once("load", start); h.load(); } else { start(); }
  }

  const title = tracks[index]?.title ?? `Track ${index + 1}`;

  return (
    <div className={`audio-player ${className}`}>
      <div className="player-info">
        <div className="show-info">
          <h3>{showName}</h3>
          <p className="track-count">Track {index + 1} of {tracks.length}</p>
        </div>
        <div className="track-info" style={{ textAlign: 'center' }}>
          <h4 className="track-title" style={{ textAlign: 'center' }}>{title}</h4>
        </div>
      </div>


        <div className="controls">
        <button className="control-btn skip-btn" onClick={prev} title="Previous Track">
          <span className="desktop-icon">⏮</span>
          <img src={prevIcon} alt="Previous" className="mobile-icon" style={{width: '48px', height: '48px'}} />
        </button>
          <button 
            className="control-btn play-btn" 
          onClick={() => (isPlaying ? current()?.pause() : playFromGesture(index))}
            title={isPlaying ? "Pause" : "Play"}
          >
          <span className="desktop-icon">{isPlaying ? '⏸' : '▶'}</span>
          <img src={isPlaying ? pauseIcon : playIcon} alt={isPlaying ? "Pause" : "Play"} className="mobile-icon" style={{width: '48px', height: '48px'}} />
          </button>
        <button className="control-btn skip-btn" onClick={next} title="Next Track">
          <span className="desktop-icon">⏭</span>
          <img src={nextIcon} alt="Next" className="mobile-icon" style={{width: '48px', height: '48px'}} />
        </button>
      </div>
    </div>
  );
});

export default AudioPlayer;