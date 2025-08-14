import React, { useState, useRef, useEffect } from 'react';
import './AudioPlayer.css';
import { Show } from '../services/api';

interface AudioPlayerProps {
  shows: Show[];
  currentShowIndex: number;
  onShowChange: (index: number) => void;
  autoPlay: boolean;
  onAutoPlayToggle: () => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  shows,
  currentShowIndex,
  onShowChange,
  autoPlay,
  onAutoPlayToggle
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const playerRef = useRef<any>(null);
  const currentShow = shows[currentShowIndex];

  // Handle show completion and auto-play
  useEffect(() => {
    if (autoPlay && currentTime > 0 && duration > 0 && currentTime >= duration - 1) {
      // Show is about to end, prepare for next
      setTimeout(() => {
        if (currentShowIndex < shows.length - 1) {
          onShowChange(currentShowIndex + 1);
        } else {
          // Loop back to first show
          onShowChange(0);
        }
      }, 1000);
    }
  }, [currentTime, duration, autoPlay, currentShowIndex, shows.length, onShowChange]);

  const handlePlay = () => {
    if (playerRef.current) {
      (playerRef.current as HTMLAudioElement).play();
      setIsPlaying(true);
    }
  };
  
  const handlePause = () => {
    if (playerRef.current) {
      (playerRef.current as HTMLAudioElement).pause();
      setIsPlaying(false);
    }
  };
  const handleEnded = () => {
    setIsPlaying(false);
    if (autoPlay && currentShowIndex < shows.length - 1) {
      onShowChange(currentShowIndex + 1);
    }
  };



  // Duration is handled by onLoadedMetadata callback

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (playerRef.current) {
      (playerRef.current as HTMLAudioElement).currentTime = seekTime;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (playerRef.current) {
      (playerRef.current as HTMLAudioElement).volume = newVolume;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (playerRef.current) {
      (playerRef.current as HTMLAudioElement).muted = !isMuted;
    }
  };

  const skipForward = () => {
    const newTime = Math.min(currentTime + 30, duration);
    setCurrentTime(newTime);
    if (playerRef.current) {
      (playerRef.current as HTMLAudioElement).currentTime = newTime;
    }
  };

  const skipBackward = () => {
    const newTime = Math.max(currentTime - 30, 0);
    setCurrentTime(newTime);
    if (playerRef.current) {
      (playerRef.current as HTMLAudioElement).currentTime = newTime;
    }
  };

  const nextShow = () => {
    if (currentShowIndex < shows.length - 1) {
      onShowChange(currentShowIndex + 1);
    }
  };

  const previousShow = () => {
    if (currentShowIndex > 0) {
      onShowChange(currentShowIndex - 1);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentShow) {
    return <div className="audio-player no-show">No shows available</div>;
  }

  return (
    <div className="audio-player">
      <div className="player-header">
        <h2 className="show-title">{currentShow.title}</h2>
        <div className="show-info">
          Show {currentShowIndex + 1} of {shows.length}
        </div>
      </div>

      <div className="player-main">
        {currentShow.tracks && currentShow.tracks.length > 0 ? (
          <>
            {/* Debug info - remove this later */}
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
              Debug: Audio URL = https://glue-factory-radio-production.up.railway.app/api/shows/audio/{currentShow.tracks[0].filename}
            </div>
            
            {console.log('🎵 AudioPlayer - Current show tracks:', currentShow.tracks)}
            {console.log('🎵 AudioPlayer - Attempting to play:', `https://glue-factory-radio-production.up.railway.app/api/shows/audio/${currentShow.tracks[0].filename}`)}
            
            {/* Native HTML5 audio element - using API proxy for better CORS */}
            <audio
              ref={playerRef}
              src={`https://glue-factory-radio-production.up.railway.app/api/shows/audio/${currentShow.tracks[0].filename}`}
              preload="metadata"
              onPlay={handlePlay}
              onPause={handlePause}
              onEnded={handleEnded}
              onTimeUpdate={(e) => {
                const target = e.target as HTMLAudioElement;
                setCurrentTime(target.currentTime);
              }}
              onLoadedMetadata={(e) => {
                const target = e.target as HTMLAudioElement;
                if (target.duration) {
                  setDuration(target.duration);
                  setIsLoading(false);
                }
              }}
              onLoadStart={() => setIsLoading(true)}
              onError={(e) => {
                console.error('Audio element error:', e);
                console.error('Attempted URL:', `https://glue-factory-radio-production.up.railway.app/api/shows/audio/${currentShow.tracks[0].filename}`);
              }}
              style={{ display: 'none' }}
            />
          </>
        ) : (
          <div className="no-tracks">
            <p>No tracks available for this show</p>
          </div>
        )}

        <div className="progress-container">
          <div className="time-display">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="progress-bar"
          />
        </div>

        <div className="controls">
          <button 
            className="control-btn skip-btn" 
            onClick={previousShow}
            disabled={currentShowIndex === 0}
          >
            ⏮
          </button>
          
          <button 
            className="control-btn skip-btn" 
            onClick={skipBackward}
          >
            ⏪
          </button>

          <button 
            className="control-btn play-btn" 
            onClick={isPlaying ? handlePause : handlePlay}
          >
            {isPlaying ? '⏸' : '▶️'}
          </button>

          <button 
            className="control-btn skip-btn" 
            onClick={skipForward}
          >
            ⏩
          </button>

          <button 
            className="control-btn skip-btn" 
            onClick={nextShow}
            disabled={currentShowIndex === shows.length - 1}
          >
            ⏭
          </button>
        </div>

        <div className="volume-container">
          <button 
            className="control-btn volume-btn" 
            onClick={toggleMute}
          >
            {isMuted ? '🔇' : volume > 0.5 ? '🔊' : '🔉'}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolumeChange}
            className="volume-slider"
          />
        </div>

        <div className="auto-play-toggle">
          <label>
            <input
              type="checkbox"
              checked={autoPlay}
              onChange={onAutoPlayToggle}
            />
            Auto-play next show
          </label>
        </div>
      </div>

      {isLoading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          Loading...
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;
