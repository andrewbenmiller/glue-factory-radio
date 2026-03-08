import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Howl, Howler } from 'howler';
import { useAudio } from '../audio/AudioProvider';
import { useLiveStatus } from '../hooks/useLiveStatus';
import { useMediaSession } from '../hooks/useMediaSession';
import { apiService, API_BASE_URL, Show } from '../services/api';
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

  // ─── BroadcastChannel: tell main window we're open ───
  useEffect(() => {
    const bc = new BroadcastChannel('gfr-miniplayer');
    bc.postMessage({ type: 'opened' });

    const handleUnload = () => {
      bc.postMessage({ type: 'closed' });
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      handleUnload();
      bc.close();
      window.removeEventListener('beforeunload', handleUnload);
    };
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
    Howler.volume(muted ? 0 : volume);
  }, [volume, muted]);

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
    }
  }, [isLiveMode, audio, streamUrl]);

  // ─── Play/Pause toggle ───
  const togglePlayPause = useCallback(() => {
    if (isLiveMode) {
      if (audio.source === 'live') {
        audio.stopLive();
        setIsLiveMode(false);
      } else {
        audio.playLive(streamUrl);
      }
    } else {
      if (isPlaying) {
        pauseTrack();
      } else {
        resumeOrStart();
      }
    }
  }, [isLiveMode, isPlaying, audio, streamUrl, pauseTrack, resumeOrStart]);

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

  // ─── Progress seek ───
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isLiveMode || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const seekTo = pct * duration;
    const h = howlsRef.current[trackIndex];
    if (h && h.state() === 'loaded') {
      h.seek(seekTo);
      setProgress(seekTo);
    }
  }, [isLiveMode, duration, trackIndex]);

  // ─── Expand to full site ───
  const expandToFull = () => {
    window.open(window.location.origin, '_blank');
  };

  // ─── Media Session ───
  useMediaSession({
    source: isLiveMode ? (audio.source === 'live' ? 'live' : 'none') : (isPlaying ? 'track' : 'none'),
    trackTitle: tracks[trackIndex]?.title ?? null,
    showName: currentShowName,
    liveNowPlaying: nowPlaying,
    liveShowTitle: showTitle,
    artworkUrl: lockScreenArt,
    onPlay: togglePlayPause,
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

  const isActive = isLiveMode ? audio.source === 'live' : isPlaying;

  return (
    <div className="mini-player">
      {/* Header */}
      <div className="mini-header">
        <span className="mini-brand">GLUE FACTORY RADIO</span>
        <div className="mini-header-actions">
          <button
            className={`mini-live-btn ${isLiveMode && audio.source === 'live' ? 'active' : ''}`}
            onClick={toggleLive}
            title={isLive ? 'Live stream available' : 'Live stream offline'}
          >
            LIVE{isLive ? '' : ' (OFF)'}
          </button>
          <button className="mini-expand-btn" onClick={expandToFull} title="Open full site">
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="4,1 11,1 11,8" />
              <line x1="11" y1="1" x2="5" y2="7" />
              <polyline points="1,4 1,11 8,11" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="mini-body">
        {/* Controls + Title */}
        <div className="mini-controls-row">
          {!isLiveMode && (
            <div className="mini-transport">
              <button className="mini-transport-btn" onClick={prevTrack} disabled={!tracks.length} title="Previous">
                <svg viewBox="0 0 14 14"><polygon points="3,2 3,12 1,12 1,2" /><polygon points="13,2 3,7 13,12" /></svg>
              </button>
              <button className="mini-transport-btn" onClick={togglePlayPause} disabled={!tracks.length} title={isActive ? 'Pause' : 'Play'}>
                {isActive ? (
                  <svg viewBox="0 0 14 14"><rect x="2" y="2" width="3.5" height="10" /><rect x="8.5" y="2" width="3.5" height="10" /></svg>
                ) : (
                  <svg viewBox="0 0 14 14"><polygon points="3,1 13,7 3,13" /></svg>
                )}
              </button>
              <button className="mini-transport-btn" onClick={nextTrack} disabled={!tracks.length} title="Next">
                <svg viewBox="0 0 14 14"><polygon points="1,2 11,7 1,12" /><polygon points="11,2 13,2 13,12 11,12" /></svg>
              </button>
            </div>
          )}

          {isLiveMode ? (
            <div className="mini-live-info">
              <div className="mini-live-label">
                {audio.source === 'live' ? 'LIVE NOW' : 'LIVE (PAUSED)'}
              </div>
              <div className="mini-live-now-playing">
                {nowPlaying || showTitle || 'Connecting...'}
              </div>
            </div>
          ) : (
            <div className="mini-title">
              <span className="mini-title-text">
                {tracks[trackIndex]?.title ?? 'No track loaded'}
              </span>
            </div>
          )}

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

        {/* Info row */}
        {!isLiveMode && (
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
        )}

        {/* Progress bar */}
        {!isLiveMode && (
          <div className="mini-progress-container" onClick={handleProgressClick}>
            <div className="mini-progress-bar" style={{ width: duration > 0 ? `${(progress / duration) * 100}%` : '0%' }} />
          </div>
        )}

        {/* Live mode play/pause button */}
        {isLiveMode && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
            <button className="mini-transport-btn" onClick={togglePlayPause} title={audio.source === 'live' ? 'Stop' : 'Play'}>
              {audio.source === 'live' ? (
                <svg viewBox="0 0 14 14"><rect x="3" y="3" width="8" height="8" /></svg>
              ) : (
                <svg viewBox="0 0 14 14"><polygon points="3,1 13,7 3,13" /></svg>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
