import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

  const prevTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Volume
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  // Live mode
  const [isLiveMode, setIsLiveMode] = useState(false);

  // Admin live label
  const [liveLabel, setLiveLabel] = useState('LIVE NOW');

  // Current tracks
  const tracks = useMemo(() => {
    if (!shows[showIndex]) return [];
    return convertShowToTracks(shows[showIndex]);
  }, [shows, showIndex]);

  const currentShowName = shows[showIndex] ? getShowDisplayName(shows[showIndex]) : '';

  // Derive playback state from AudioProvider
  const isPlaying = audio.isPlaying && audio.source === 'track';
  const progress = audio.progress;
  const duration = audio.duration;

  // ─── Fetch shows & auto-play handoff ───
  const autoplayHandled = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const showParam = params.get('show');
    const trackParam = params.get('track');
    const autoplayParam = params.get('autoplay');
    const timeParam = params.get('time');

    apiService.getPageContent('live_label').then(page => {
      if (page?.content) setLiveLabel(page.content);
    }).catch(() => {});

    apiService.getShows().then(fetched => {
      const activeShows = fetched.filter(s => s.is_active);
      setShows(activeShows);

      let targetShowIdx = 0;
      let targetTrackIdx = 0;

      if (showParam) {
        const id = parseInt(showParam, 10);
        const idx = activeShows.findIndex(s => s.id === id);
        if (idx >= 0) {
          targetShowIdx = idx;
          if (trackParam) {
            targetTrackIdx = parseInt(trackParam, 10);
          }
        }
      }

      setShowIndex(targetShowIdx);
      setTrackIndex(targetTrackIdx);

      // Auto-start playback to seamlessly continue from main app
      if (autoplayParam && !autoplayHandled.current) {
        autoplayHandled.current = true;

        if (autoplayParam === 'live') {
          // Resume live stream
          setIsLiveMode(true);
          // Small delay to let BroadcastChannel 'opened' message stop main app first
          setTimeout(() => {
            audio.playLive(streamUrl);
            bcRef.current?.postMessage({ type: 'playing' });
          }, 100);
        } else if (autoplayParam === 'track') {
          // Resume archive track
          const show = activeShows[targetShowIdx];
          if (show) {
            const tracks = convertShowToTracks(show);
            const t = tracks[targetTrackIdx];
            if (t) {
              const seekTime = timeParam ? parseInt(timeParam, 10) : 0;
              setTimeout(() => {
                audio.playTrack(t.src, t.title ?? `Track ${targetTrackIdx + 1}`);
                if (seekTime > 0) {
                  // Seek after audio starts loading
                  setTimeout(() => audio.seekTrack(seekTime), 200);
                }
                bcRef.current?.postMessage({ type: 'playing' });
              }, 100);
            }
          }
        }
      }
    }).catch(err => console.error('MiniPlayer: failed to fetch shows', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        audio.stopAll();
        if (isLiveMode) {
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
    const MIN_W = 280;
    const MIN_H = 340;
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

  // ─── Reset track index when tracks change ───
  useEffect(() => {
    const clamped = Math.min(Math.max(trackIndex, 0), Math.max(tracks.length - 1, 0));
    setTrackIndex(clamped);

    return () => {
      if (prevTimerRef.current) clearTimeout(prevTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.map(t => t.src).join('|')]);

  // ─── Volume sync ───
  useEffect(() => {
    const v = muted ? 0 : volume;
    audio.setVolume(v);
  }, [volume, muted, audio]);

  // ─── Playback functions ───
  const startTrack = useCallback((targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= tracks.length) return;

    setTrackIndex(targetIndex);
    setIsLiveMode(false);
    bcRef.current?.postMessage({ type: 'playing' });

    const t = tracks[targetIndex];
    audio.playTrack(t.src, t?.title ?? `Track ${targetIndex + 1}`);
  }, [tracks, audio]);

  const pauseTrack = useCallback(() => {
    audio.pauseTrack();
  }, [audio]);

  const resumeOrStart = useCallback(() => {
    if (audio.progress > 0 && audio.source === 'none') {
      audio.resumeTrack();
    } else {
      startTrack(trackIndex);
    }
  }, [audio, startTrack, trackIndex]);

  const nextTrack = useCallback(() => {
    if (!tracks.length) return;
    startTrack((trackIndex + 1) % tracks.length);
  }, [trackIndex, tracks.length, startTrack]);

  const prevTrack = useCallback(() => {
    if (!tracks.length) return;

    if (prevTimerRef.current !== null) {
      clearTimeout(prevTimerRef.current);
      prevTimerRef.current = null;
      startTrack((trackIndex - 1 + tracks.length) % tracks.length);
    } else {
      prevTimerRef.current = setTimeout(() => {
        prevTimerRef.current = null;
        audio.seekTrack(0);
        if (!isPlaying) resumeOrStart();
      }, 300);
    }
  }, [trackIndex, tracks.length, startTrack, isPlaying, audio, resumeOrStart]);

  // ─── Auto-advance callback ───
  useEffect(() => {
    audio.onEndedRef.current = () => {
      if (trackIndex >= tracks.length - 1) {
        audio.stopAll();
        return;
      }
      const nextIndex = trackIndex + 1;
      setTrackIndex(nextIndex);
      const t = tracks[nextIndex];
      if (t) {
        audio.playTrack(t.src, t.title ?? `Track ${nextIndex + 1}`);
      }
    };

    return () => {
      audio.onEndedRef.current = null;
    };
  }, [trackIndex, tracks, audio]);

  // ─── Live stream ───
  const toggleLive = useCallback(() => {
    if (isLiveMode) {
      audio.stopLive();
      setIsLiveMode(false);
    } else {
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
    // Stop current playback when switching shows
    audio.stopAll();
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
              <span className="mini-live-banner-text">{nowPlaying && !liveLabel.includes(nowPlaying) ? `${liveLabel}: ${nowPlaying}` : liveLabel}</span>
              <span className="mini-live-banner-text">{nowPlaying && !liveLabel.includes(nowPlaying) ? `${liveLabel}: ${nowPlaying}` : liveLabel}</span>
            </div>
          ) : (
            <span className="mini-live-banner-text">
              {isLive ? (nowPlaying && !liveLabel.includes(nowPlaying) ? `${liveLabel}: ${nowPlaying}` : liveLabel) : 'Glue Factory Radio'}
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

              {/* AirPlay / Cast */}
              {audio.remotePlaybackAvailable && (
                <button
                  className={`mini-stream-btn ${audio.remotePlaybackState !== 'disconnected' ? 'mini-stream-btn-active' : ''}`}
                  onClick={() => audio.promptRemotePlayback()}
                  title={audio.remotePlaybackState === 'connected' ? 'Streaming (tap to change)' : 'Stream to device'}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
                    <line x1="2" y1="20" x2="2.01" y2="20" />
                  </svg>
                </button>
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
