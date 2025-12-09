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
  const loadingRef = useRef<Set<number>>(new Set()); // Track which tracks are actively loading
  const [index, setIndex] = useState(
    Math.min(Math.max(initialIndex, 0), Math.max(tracks.length - 1, 0))
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const playGenRef = useRef(0);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mobile-safe play function
  async function playFromGesture(target = index) {
    console.log('🎵 AudioPlayer: playFromGesture called for target', target, 'current index', index);
    playGenRef.current += 1;
    const token = playGenRef.current;

    const ctx = (Howler as any).ctx;
    try {
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
        console.log('🎵 AudioPlayer: AudioContext resumed');
        // Play a 1-sample silent buffer to fully unlock iOS
        const node = ctx.createBufferSource();
        node.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        node.connect(ctx.destination);
        node.start(0);
        node.disconnect();
      }
    } catch (e) {
      console.warn('🎵 AudioPlayer: resume failed', e);
    }

    // Stop only the current track, not global Howler
    const currentHowl = howlsRef.current[index];
    currentHowl?.stop();
    setIsPlaying(false);

    if (target !== index) setIndex(target);

    const h = howlsRef.current[target];
    if (!h) {
      console.error('🎵 AudioPlayer: No howl found for target', target, 'available:', howlsRef.current.length);
      return;
    }

    const currentState = h.state();
    console.log('🎵 AudioPlayer: Howl state for target', target, ':', currentState);

    const onReady = () => {
      if (token !== playGenRef.current) {
        console.log('🎵 AudioPlayer: Token mismatch, aborting play');
        return;
      }
      try {
        const id = h.play();
        console.log('🎵 AudioPlayer: Play started with id', id);
        h.seek(0, id);
        h.once("end", () => { if (token === playGenRef.current) next(); });
      } catch (e) {
        console.error('🎵 AudioPlayer: play threw', e);
        // Fallback: recreate with html5:true
        console.warn('🎵 AudioPlayer: Play error, retrying with html5:true', e);
        const fallbackHowl = new Howl({ 
          src: [tracks[target].src], 
          html5: true, 
          preload: true
        });
        howlsRef.current[target] = fallbackHowl;
        fallbackHowl.once('load', () => {
          console.log('🎵 AudioPlayer: Fallback howl loaded, playing');
          fallbackHowl.play();
        });
        fallbackHowl.load();
      }
    };

    // Check if this is HTML5 mode (first track or mobile)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isHtml5 = isMobile || target === 0; // First track uses HTML5 for progressive loading
    
    if (currentState !== "loaded") { 
      console.log('🎵 AudioPlayer: Howl not loaded, state:', currentState, 'HTML5 mode:', isHtml5);
      
      // For HTML5 mode, try playing immediately without waiting - browser will buffer
      if (isHtml5) {
        console.log('🎵 AudioPlayer: HTML5 mode - attempting immediate play (no wait for load)');
        setIsLoading(true);
        
        // Try to play immediately - Howler will handle buffering
        try {
          // Ensure load has been called
          if (currentState === "unloaded") {
            console.log('🎵 AudioPlayer: Howl unloaded, calling load() first');
            h.load();
          }
          
          // Try playing - in HTML5 mode this should work even if not fully loaded
          const playId = h.play();
          if (playId) {
            console.log('🎵 AudioPlayer: HTML5 play started immediately with id:', playId);
            h.seek(0, playId);
            
            // Set up end handler
            h.once("end", () => { if (token === playGenRef.current) next(); });
            
            // Monitor for when it actually starts playing
            h.once("play", () => {
              console.log('🎵 AudioPlayer: HTML5 track actually started playing');
              setIsLoading(false);
            });
            
            // Also listen for load in case play doesn't work immediately
            h.once("load", () => {
              console.log('🎵 AudioPlayer: HTML5 track loaded (after play attempt)');
              setIsLoading(false);
            });
            
            return; // Exit early, let browser handle buffering
          } else {
            console.warn('🎵 AudioPlayer: h.play() returned no playId');
          }
        } catch (e) {
          console.warn('🎵 AudioPlayer: Immediate HTML5 play failed:', e);
        }
      }
      
      setIsLoading(true); // Show loading indicator for non-HTML5 or fallback
      
      // Clear any existing timeout
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      
      // Set a timeout - if loading takes more than 10 seconds, try alternative approach
      loadTimeoutRef.current = setTimeout(() => {
        console.warn('🎵 AudioPlayer: Load timeout after 10s, trying alternative approach');
        if (isHtml5) {
          // For HTML5, try playing anyway - might work with partial buffer
          try {
            const playId = h.play();
            if (playId) {
              console.log('🎵 AudioPlayer: Timeout fallback - play started with id:', playId);
              h.seek(0, playId);
              setIsLoading(false);
              h.once("end", () => { if (token === playGenRef.current) next(); });
              loadTimeoutRef.current = null;
              return;
            }
          } catch (e) {
            console.error('🎵 AudioPlayer: Timeout fallback play also failed:', e);
          }
        }
        setIsLoading(false);
        loadTimeoutRef.current = null;
      }, 10000);
      
      // Only set up load handler and call load() if not already loading
      if (!loadingRef.current.has(target)) {
        console.log('🎵 AudioPlayer: Initiating load for track', target);
        loadingRef.current.add(target);
        h.once("load", () => {
          console.log('🎵 AudioPlayer: Load event fired, state now:', h.state());
          if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
            loadTimeoutRef.current = null;
          }
          setIsLoading(false);
          onReady();
        }); 
        h.once("loaderror", () => {
          console.error('🎵 AudioPlayer: Load error for track', target);
          if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
            loadTimeoutRef.current = null;
          }
          setIsLoading(false);
        });
        h.load();
      } else {
        console.log('🎵 AudioPlayer: Track already loading, waiting for existing load to complete');
        // Track is already loading, just wait for it
        h.once("load", () => {
          console.log('🎵 AudioPlayer: Load event fired (from existing load), state now:', h.state());
          if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
            loadTimeoutRef.current = null;
          }
          setIsLoading(false);
          onReady();
        });
        h.once("loaderror", () => {
          console.error('🎵 AudioPlayer: Load error for track', target);
          if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
            loadTimeoutRef.current = null;
          }
          setIsLoading(false);
        });
      }
    } else { 
      console.log('🎵 AudioPlayer: Howl already loaded, calling onReady immediately');
      setIsLoading(false);
      onReady(); 
    }
  }

  const current = useCallback(() => howlsRef.current[index], [index]);

  // Build/unload Howls when tracks change
  useEffect(() => {
    console.log('🎵 AudioPlayer: Building Howl instances for', tracks.length, 'tracks');
    Howler.stop();
    setIsPlaying(false);
    setIsLoading(false);
    howlsRef.current.forEach((h) => { try { h.unload(); } catch {} });

    loadingRef.current.clear(); // Reset loading tracking
    
    howlsRef.current = tracks.map((t, i) => {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      // Use html5:true for mobile and first track (desktop) to allow progressive loading
      // This allows playback to start before the entire file is downloaded
      const useHtml5 = isMobile || i === 0;
      
      const howl = new Howl({
        src: [t.src],
        html5: useHtml5,
        preload: false, // Don't preload - load on demand only to save bandwidth
        xhr: {
          method: 'GET',
          headers: {},
          withCredentials: false
        },
        onload: () => {
          console.log(`🎵 AudioPlayer: Track ${i} (${t.title || t.src}) loaded, state:`, howl.state());
          loadingRef.current.delete(i); // Mark as no longer loading
        },
        onloaderror: (id, error) => {
          console.error(`🎵 AudioPlayer: Track ${i} (${t.title || t.src}) load error:`, error);
          loadingRef.current.delete(i); // Mark as no longer loading even on error
        },
        onplay: () => { 
          console.log(`🎵 AudioPlayer: Track ${i} started playing`);
          setIsPlaying(true); 
        },
        onpause: () => { 
          setIsPlaying(false); 
        },
        onstop: () => { 
          setIsPlaying(false); 
        },
      });
      
      // Don't pre-load any tracks - load on demand only
      // This saves bandwidth and processing power
      
      return howl;
    });

    const clamped = Math.min(Math.max(initialIndex, 0), Math.max(tracks.length - 1, 0));
    setIndex(clamped);
    console.log('🎵 AudioPlayer: Set initial index to', clamped, 'out of', tracks.length, 'tracks');

    return () => {
      Howler.stop();
      howlsRef.current.forEach((h) => { try { h.unload(); } catch {} });
      howlsRef.current = [];
      loadingRef.current.clear();
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
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
          {isLoading && (
            <div className="loading-indicator" style={{ marginTop: '10px' }}>
              <div className="spinner" style={{ borderTopColor: '#FF5F1F' }}></div>
              <span style={{ color: '#FF5F1F', fontSize: '0.9rem' }}>Loading track...</span>
            </div>
          )}
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