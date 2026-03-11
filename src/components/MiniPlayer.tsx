import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Howl, Howler } from 'howler';
import { useAudio } from '../audio/AudioProvider';
import { useLiveStatus } from '../hooks/useLiveStatus';
import { useMediaSession } from '../hooks/useMediaSession';
import { apiService, API_BASE_URL, Show } from '../services/api';
import prevIcon from '../assets/icons/prev-icon.svg';
import playIcon from '../assets/icons/play-icon.svg';
import pauseIcon from '../assets/icons/pause-icon.svg';
import nextIcon from '../assets/icons/next-icon.svg';
import './AudioPlayer.css';
import './MiniPlayer.css';

const lockScreenArt = window.location.origin + '/web-app-manifest-512x512.png';

type MiniTrack = { src: string; title?: string };

function getShowDisplayName(show: Show): string {
  if (show.series_title && show.episode_number && !show.hide_episode_numbers) {
    return `${show.series_title} - Ep. ${show.episode_number}: ${show.title}`;
  }
  if (show.series_title && show.episode_number && show.hide_episode_numbers) {
    return `${show.series_title}: ${show.title}`;
  }
  return show.title;
}

function convertShowToTracks(show: Show): MiniTrack[] {
  return show.tracks.map(track => ({
    src: `${API_BASE_URL}/api${track.url.split('/').map(s => encodeURIComponent(s)).join('/')}`,
    title: track.title,
  }));
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function MiniPlayer() {
  const audio = useAudio();
  const { isLive, nowPlaying, showTitle, streamUrl } = useLiveStatus();

  // Shows data
  const [shows, setShows] = useState<Show[]>([]);
  const [showIndex, setShowIndex] = useState(0);
  const [trackIndex, setTrackIndex] = useState(0);

  // Howler state
  const howlsRef = useRef<Howl[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const playGenRef = useRef(0);
  const prevTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Progress
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressRef = useRef<number>();

  // Volume
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  // Live mode
  const [isLiveMode, setIsLiveMode] = useState(false);

  // Current tracks
  const tracks = useMemo(() => {
    if (!shows[showIndex]) return [];
    return convertShowToTracks(shows[showIndex]);
  }, [shows, showIndex]);

  const currentShowName = shows[showIndex] ? getShowDisplayName(shows[showIndex]) : '';

  // ─── Fetch shows ───
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const showParam = params.get('show');
    const trackParam = params.get('track');

    apiService.getShows().then(fetched => {
      const activeShows = fetched.filter(s => s.is_active);
      setShows(activeShows);

      if (showParam) {
        const id = parseInt(showParam, 10);
        const idx = activeShows.findIndex(s => s.id === id);
        if (idx >= 0) {
          setShowIndex(idx);
          if (trackParam) {
            setTrackIndex(parseInt(trackParam, 10));
          }
        }
      }
    }).catch(err => console.error('MiniPlayer: failed to fetch shows', err));
  }, []);

  // ─── BroadcastChannel: coordinate with main window ───
  const bcRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const bc = new BroadcastChannel('gfr-miniplayer');
    bcRef.current = bc;
    bc.postMessage({ type: 'opened' });

    bc.onmessage = (e) => {
      if (e.data?.type === 'playing') {
        // Main site started playing — stop miniplayer audio
        Howler.stop();
        setIsPlaying(false);
        if (isLiveMode) {
          audio.stopLive();
          setIsLiveMode(false);
        }
      }
    };

    const handleUnload = () => {
      bc.postMessage({ type: 'closed' });
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      handleUnload();
      bc.close();
      bcRef.current = null;
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [audio, isLiveMode]);

  // ─── Enforce minimum window size ───
  useEffect(() => {
    const MIN_W = 221;
    const MIN_H = 300;
    const enforceMinSize = () => {
      const w = window.outerWidth;
      const h = window.outerHeight;
      if (w < MIN_W || h < MIN_H) {
        window.resizeTo(Math.max(w, MIN_W), Math.max(h, MIN_H));
      }
    };
    // Correct size on initial load in case the browser ignored window.open dimensions
    enforceMinSize();
    window.addEventListener('resize', enforceMinSize);
    return () => window.removeEventListener('resize', enforceMinSize);
  }, []);

  // ─── Build Howls when tracks change ───
  useEffect(() => {
    Howler.stop();
    setIsPlaying(false);

    howlsRef.current.forEach(h => { try { h.unload(); } catch {} });

    howlsRef.current = tracks.map(t => new Howl({
      src: [t.src],
      html5: true,
      preload: false,
      onplay: () => setIsPlaying(true),
      onpause: () => setIsPlaying(false),
      onstop: () => setIsPlaying(false),
    }));

    const clamped = Math.min(Math.max(trackIndex, 0), Math.max(tracks.length - 1, 0));
    setTrackIndex(clamped);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);

    return () => {
      Howler.stop();
      setIsPlaying(false);
      if (prevTimerRef.current) clearTimeout(prevTimerRef.current);
      howlsRef.current.forEach(h => { try { h.unload(); } catch {} });
      howlsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.map(t => t.src).join('|')]);

  // ─── Volume sync ───
  useEffect(() => {
    const v = muted ? 0 : volume;
    Howler.volume(v);
    audio.setLiveVolume(v);
  }, [volume, muted, audio]);

  // ─── Progress polling ───
  useEffect(() => {
    if (!isPlaying || isLiveMode) {
      if (progressRef.current) cancelAnimationFrame(progressRef.current);
      return;
    }

    const poll = () => {
      const h = howlsRef.current[trackIndex];
      if (h && h.state() === 'loaded') {
        const seek = h.seek() as number;
        const dur = h.duration();
        setProgress(seek);
        setDuration(dur);
      }
      progressRef.current = requestAnimationFrame(poll);
    };
    progressRef.current = requestAnimationFrame(poll);

    return () => {
      if (progressRef.current) cancelAnimationFrame(progressRef.current);
    };
  }, [isPlaying, trackIndex, isLiveMode]);

  // ─── Playback functions ───
  const startTrack = useCallback((targetIndex: number, retries = 3) => {
    if (!howlsRef.current.length) {
      if (retries > 0) setTimeout(() => startTrack(targetIndex, retries - 1), 50);
      return;
    }
    if (targetIndex < 0 || targetIndex >= howlsRef.current.length) return;

    playGenRef.current += 1;
    const token = playGenRef.current;

    Howler.stop();
    setIsPlaying(false);
    audio.notifyTrackWillPlay();
    setTrackIndex(targetIndex);
    setIsLiveMode(false);
    bcRef.current?.postMessage({ type: 'playing' });

    const t = tracks[targetIndex];
    audio.setTrackNowPlaying(t?.title ?? `Track ${targetIndex + 1}`);

    const h = howlsRef.current[targetIndex];
    if (!h) return;

    const doPlay = () => {
      if (token !== playGenRef.current) return;
      try { h.stop(); } catch {}
      h.seek(0);
      setIsPlaying(true);

      h.once('end', () => {
        if (token !== playGenRef.current) return;
        if (targetIndex >= howlsRef.current.length - 1) {
          setIsPlaying(false);
          audio.setTrackNowPlaying(null);
          audio.notifyTrackDidStop();
          return;
        }
        startTrack(targetIndex + 1);
      });

      h.play();
    };

    if (h.state() === 'loaded') {
      doPlay();
    } else {
      h.once('load', () => {
        if (token !== playGenRef.current) return;
        doPlay();
      });
      h.once('loaderror', (_id: any, error: any) => {
        console.error('MiniPlayer: load error', targetIndex, error);
        if (token !== playGenRef.current) return;
        setIsPlaying(false);
      });
      h.load();
    }

    try {
      const ctx = (Howler as any).ctx;
      if (ctx && ctx.state === 'suspended') ctx.resume();
    } catch {}
  }, [tracks, audio]);

  const pauseTrack = useCallback(() => {
    const h = howlsRef.current[trackIndex];
    if (h) h.pause();
    setIsPlaying(false);
    audio.notifyTrackPaused?.();
  }, [trackIndex, audio]);

  const resumeOrStart = useCallback(() => {
    const h = howlsRef.current[trackIndex];
    if (!h) return;

    if (h.state() === 'loaded' && ((h.seek() as number) || 0) > 0) {
      if (audio.source !== 'track') audio.notifyTrackWillPlay();
      h.play();
      setIsPlaying(true);
    } else {
      startTrack(trackIndex);
    }
  }, [trackIndex, startTrack, audio]);

  const nextTrack = useCallback(() => {
    if (!howlsRef.current.length) return;
    startTrack((trackIndex + 1) % howlsRef.current.length);
  }, [trackIndex, startTrack]);

  const prevTrack = useCallback(() => {
    if (!howlsRef.current.length) return;

    if (prevTimerRef.current !== null) {
      clearTimeout(prevTimerRef.current);
      prevTimerRef.current = null;
      startTrack((trackIndex - 1 + howlsRef.current.length) % howlsRef.current.length);
    } else {
      prevTimerRef.current = setTimeout(() => {
        prevTimerRef.current = null;
        const h = howlsRef.current[trackIndex];
        if (h && h.state() === 'loaded') {
          h.seek(0);
          if (!isPlaying) resumeOrStart();
        } else {
          startTrack(trackIndex);
        }
      }, 300);
    }
  }, [trackIndex, startTrack, isPlaying, resumeOrStart]);

  // ─── Live stream ───
  const toggleLive = useCallback(() => {
    if (isLiveMode) {
      audio.stopLive();
      setIsLiveMode(false);
    } else {
      Howler.stop();
      setIsPlaying(false);
      audio.playLive(streamUrl);
      setIsLiveMode(true);
      bcRef.current?.postMessage({ type: 'playing' });
    }
  }, [isLiveMode, audio, streamUrl]);

  // ─── Archive play/pause (always controls archive, stops live if needed) ───
  const toggleArchivePlayPause = useCallback(() => {
    if (isPlaying) {
      pauseTrack();
    } else {
      // Stop live stream if active, then play archive
      if (isLiveMode) {
        audio.stopLive();
        setIsLiveMode(false);
      }
      bcRef.current?.postMessage({ type: 'playing' });
      resumeOrStart();
    }
  }, [isLiveMode, isPlaying, audio, pauseTrack, resumeOrStart]);

  // ─── Show selector ───
  const handleShowChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = parseInt(e.target.value, 10);
    setShowIndex(idx);
    setTrackIndex(0);
    setProgress(0);
    setDuration(0);
    // Stop current playback when switching shows
    Howler.stop();
    setIsPlaying(false);
    audio.notifyTrackDidStop();
    setIsLiveMode(false);
  }, [audio]);

  // ─── Expand to full site ───
  const expandToFull = () => {
    // Focus existing main site tab without reloading, or open new if not found
    const w = window.open('', 'gfr-main');
    if (!w || w.closed || !w.document.title) {
      // No existing tab — open fresh
      window.open(window.location.origin, 'gfr-main');
    }
  };

  // ─── Media Session ───
  useMediaSession({
    source: isLiveMode ? (audio.source === 'live' ? 'live' : 'none') : (isPlaying ? 'track' : 'none'),
    trackTitle: tracks[trackIndex]?.title ?? null,
    showName: currentShowName,
    liveNowPlaying: nowPlaying,
    liveShowTitle: showTitle,
    artworkUrl: lockScreenArt,
    onPlay: toggleArchivePlayPause,
    onPause: isLiveMode ? () => { audio.stopLive(); setIsLiveMode(false); } : pauseTrack,
    onNext: isLiveMode ? null : nextTrack,
    onPrev: isLiveMode ? null : prevTrack,
  });

  // Window title
  useEffect(() => {
    if (isLiveMode && audio.source === 'live') {
      document.title = nowPlaying ? `${nowPlaying} - GFR` : 'LIVE - GFR';
    } else if (isPlaying && tracks[trackIndex]) {
      document.title = `${tracks[trackIndex].title} - GFR`;
    } else {
      document.title = 'Glue Factory Radio';
    }
  }, [isLiveMode, isPlaying, trackIndex, tracks, nowPlaying, audio.source]);

  return (
    <div className="mini-player">
      {/* Header */}
      <div className={`mini-header ${audio.source === 'live' ? 'mini-header-streaming' : ''}`}>
        <div className="mini-live-banner">
          {audio.source === 'live' ? (
            <div className="mini-live-banner-scroll">
              <span className="mini-live-banner-text">Streaming live now: {nowPlaying || showTitle || 'Live Stream'}</span>
              <span className="mini-live-banner-text">Streaming live now: {nowPlaying || showTitle || 'Live Stream'}</span>
            </div>
          ) : (
            <span className="mini-live-banner-text">
              {isLive ? `Streaming live now: ${nowPlaying || showTitle || 'Live Stream'}` : 'Glue Factory Radio'}
            </span>
          )}
        </div>
        <div className="mini-header-actions">
          <button className="mini-expand-btn" onClick={expandToFull} title="Open full site">
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="4,1 11,1 11,8" />
              <line x1="11" y1="1" x2="5" y2="7" />
              <polyline points="1,4 1,11 8,11" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body - live stream play/stop */}
      <div className="mini-body">
        <div className="mini-body-center">
          <button
            className={`mini-play-btn ${audio.source === 'live' ? 'mini-play-btn-playing' : ''}`}
            onClick={toggleLive}
            title={audio.source === 'live' ? 'Stop live stream' : 'Play live stream'}
          >
            <span className="mini-play-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="4,2 4,22 22,12" />
              </svg>
            </span>
            <span className="mini-stop-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="18" height="18" />
              </svg>
            </span>
          </button>
        </div>
      </div>

      {/* Bottom group: transport + footer, pinned to bottom */}
      <div className="mini-bottom">
        {/* Transport section */}
        <div className="mini-transport-section">
            <div className="mini-controls-row">
              <div className="mini-transport">
                <button className="info-control-btn" onClick={prevTrack} disabled={!tracks.length} title="Previous">
                  <img src={prevIcon} alt="Previous" />
                </button>
                <button className="info-control-btn" onClick={toggleArchivePlayPause} disabled={!tracks.length} title={isPlaying ? 'Pause' : 'Play'}>
                  <img src={isPlaying ? pauseIcon : playIcon} alt={isPlaying ? 'Pause' : 'Play'} />
                </button>
                <button className="info-control-btn" onClick={nextTrack} disabled={!tracks.length} title="Next">
                  <img src={nextIcon} alt="Next" />
                </button>
              </div>

              {/* Volume */}
              <div className="mini-volume">
                <svg
                  className="mini-volume-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  onClick={() => setMuted(m => !m)}
                >
                  <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" />
                  {!muted && volume > 0 && (
                    <>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      {volume > 0.5 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
                    </>
                  )}
                  {muted && <line x1="1" y1="1" x2="23" y2="23" />}
                </svg>
                <input
                  type="range"
                  className="mini-volume-slider"
                  min="0"
                  max="1"
                  step="0.05"
                  value={muted ? 0 : volume}
                  onChange={e => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
                />
              </div>
            </div>

            <div className="mini-title">
              {isPlaying ? (
                <div className="mini-title-scroll">
                  <span className="mini-title-text">{tracks[trackIndex]?.title ?? 'No track loaded'}</span>
                  <span className="mini-title-text">{tracks[trackIndex]?.title ?? 'No track loaded'}</span>
                </div>
              ) : (
                <span className="mini-title-text">{tracks[trackIndex]?.title ?? 'No track loaded'}</span>
              )}
            </div>

            <div className="mini-info-row">
              <select className="mini-show-select" value={showIndex} onChange={handleShowChange}>
                {shows.map((show, i) => (
                  <option key={show.id} value={i}>
                    {getShowDisplayName(show)}
                  </option>
                ))}
              </select>
              <span className="mini-time">
                {tracks.length > 0 ? `${trackIndex + 1}/${tracks.length}` : ''}{' '}
                {duration > 0 ? `${formatTime(progress)} / ${formatTime(duration)}` : ''}
              </span>
            </div>
          </div>

        {/* Footer */}
        <div className="mini-footer" />
      </div>
    </div>
  );
}
