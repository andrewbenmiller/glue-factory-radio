import React, { useState, useRef, useEffect } from 'react';
import './AudioPlayer.css';
import { Show } from '../services/api';

interface AudioPlayerProps {
  shows: Show[];
  currentShowIndex: number;
  currentTrackIndex: number;
  onShowChange: (index: number) => void;
  onTrackChange: (trackIndex: number) => void;
  autoPlay: boolean;
  onAutoPlayToggle: () => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  shows,
  currentShowIndex,
  currentTrackIndex,
  onShowChange,
  onTrackChange,
  autoPlay,
  onAutoPlayToggle
}) => {
  console.log('🎵 AudioPlayer render - Props received:', { currentShowIndex, currentTrackIndex, showsLength: shows.length });
  console.log('🎵 AudioPlayer - currentTrackIndex type:', typeof currentTrackIndex, 'value:', currentTrackIndex);
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



  // Force metadata loading when show or track changes
  useEffect(() => {
    console.log('🎵 useEffect triggered - Show:', currentShowIndex, 'Track:', currentTrackIndex);
    console.log('🎵 useEffect dependencies changed - currentShowIndex:', currentShowIndex, 'currentTrackIndex:', currentTrackIndex);
    console.log('🎵 useEffect - Dependencies array:', [currentShowIndex, currentTrackIndex, currentShow]);
    if (currentShow) {
      console.log('🎵 Show changed - Show:', currentShowIndex, 'Show title:', currentShow.title);
      setDuration(0);
      setCurrentTime(0);
      setIsLoading(true);
      
      // Force metadata loading
      if (playerRef.current) {
        const audio = playerRef.current as HTMLAudioElement;
        audio.load(); // This forces metadata loading
        console.log('🎵 Forced audio.load() for metadata');
        
        // Auto-play the new track when it's ready
        const handleCanPlay = () => {
          console.log('🎵 New track ready, attempting auto-play...');
          audio.removeEventListener('canplay', handleCanPlay);
          
          // Small delay to ensure everything is loaded
          setTimeout(() => {
            audio.play().then(() => {
              setIsPlaying(true);
              console.log('✅ Auto-play successful for new track!');
            }).catch(err => {
              console.error('❌ Auto-play failed for new track:', err);
              setIsPlaying(false);
            });
          }, 200);
        };
        
        audio.addEventListener('canplay', handleCanPlay);
      }
    } else {
      console.log('❌ No current show available');
    }
  }, [currentShowIndex, currentTrackIndex, currentShow]);

  const handlePlay = async () => {
    if (playerRef.current) {
      try {
        // Simple direct play approach
        await (playerRef.current as HTMLAudioElement).play();
        setIsPlaying(true);
        console.log('✅ Audio playing directly!');
      } catch (error) {
        console.error('❌ Audio play failed:', error);
        setIsPlaying(false);
      }
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
      const audio = playerRef.current as HTMLAudioElement;
      audio.currentTime = seekTime;
      
      // Ensure audio continues playing smoothly after seek
      if (isPlaying) {
        console.log('🎵 Refreshing audio playback after progress bar seek');
        audio.pause();
        setTimeout(() => {
          audio.play().catch(err => console.error('❌ Auto-play after progress seek failed:', err));
        }, 50);
      }
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
    console.log('🎵 skipForward called, currentTime:', currentTime, 'duration:', duration);
    if (playerRef.current && duration > 0) {
      const newTime = Math.min(duration, currentTime + 10);
      console.log('✅ Skipping forward to:', newTime);
      setCurrentTime(newTime);
      
      const audio = playerRef.current as HTMLAudioElement;
      audio.currentTime = newTime;
      
      // Ensure audio continues playing smoothly after seek
      if (isPlaying) {
        console.log('🎵 Refreshing audio playback after forward seek');
        audio.pause();
        setTimeout(() => {
          audio.play().catch(err => console.error('❌ Auto-play after seek failed:', err));
        }, 50);
      }
    } else {
      console.log('⚠️ Cannot skip forward - no player or duration');
    }
  };

  const skipBackward = () => {
    console.log('🎵 skipBackward called, currentTime:', currentTime);
    if (playerRef.current) {
      const newTime = Math.max(0, currentTime - 10);
      console.log('✅ Skipping backward to:', newTime);
      setCurrentTime(newTime);
      
      const audio = playerRef.current as HTMLAudioElement;
      audio.currentTime = newTime;
      
      // Ensure audio continues playing smoothly after seek
      if (isPlaying) {
        console.log('🎵 Refreshing audio playback after backward seek');
        audio.pause();
        setTimeout(() => {
          audio.play().catch(err => console.error('❌ Auto-play after seek failed:', err));
        }, 50);
      }
    } else {
      console.log('⚠️ Cannot skip backward - no player');
    }
  };



  const nextTrack = () => {
    console.log('🎵 nextTrack called, currentShowIndex:', currentShowIndex, 'shows.length:', shows.length);
    if (currentShowIndex < shows.length - 1) {
      const newShowIndex = currentShowIndex + 1;
      console.log('✅ Moving to next show, index:', newShowIndex);
      
      // Pause current audio before switching
      if (playerRef.current && isPlaying) {
        (playerRef.current as HTMLAudioElement).pause();
        setIsPlaying(false);
      }
      
      onShowChange(newShowIndex);
      
      // Wait for the new audio source to load, then auto-play
      setTimeout(() => {
        if (playerRef.current) {
          const audio = playerRef.current as HTMLAudioElement;
          console.log('🎵 Loading new show audio source');
          
          // Force reload the audio element with new source
          audio.load();
          
          // Wait for the audio to be ready, then play
          audio.addEventListener('canplay', function onCanPlay() {
            console.log('🎵 New show ready to play, starting playback');
            audio.removeEventListener('canplay', onCanPlay);
            audio.play().then(() => {
              setIsPlaying(true);
              console.log('✅ Next show auto-played successfully');
            }).catch(err => {
              console.error('❌ Auto-play failed for next show:', err);
            });
          }, { once: true });
        }
      }, 200);
    } else {
      console.log('⚠️ Already at last show');
    }
  };

  const previousTrack = () => {
    console.log('🎵 previousTrack called, currentShowIndex:', currentShowIndex);
    if (currentShowIndex > 0) {
      const newShowIndex = currentShowIndex - 1;
      console.log('✅ Moving to previous show, index:', newShowIndex);
      
      // Pause current audio before switching
      if (playerRef.current && isPlaying) {
        (playerRef.current as HTMLAudioElement).pause();
        setIsPlaying(false);
      }
      
      onShowChange(newShowIndex);
      
      // Wait for the new audio source to load, then auto-play
      setTimeout(() => {
        if (playerRef.current) {
          const audio = playerRef.current as HTMLAudioElement;
          console.log('🎵 Loading previous show audio source');
          
          // Force reload the audio element with new source
          audio.load();
          
          // Wait for the audio to be ready, then play
          audio.addEventListener('canplay', function onCanPlay() {
            console.log('🎵 Previous show ready to play, starting playback');
            audio.removeEventListener('canplay', onCanPlay);
            audio.play().then(() => {
              setIsPlaying(true);
              console.log('✅ Previous show auto-played successfully');
            }).catch(err => {
              console.error('❌ Auto-play failed for previous show:', err);
            });
          }, { once: true });
        }
      }, 200);
    } else {
      console.log('⚠️ Already at first show');
    }
  };

  const nextShow = () => {
    console.log('🎵 nextShow called, currentShowIndex:', currentShowIndex, 'shows.length:', shows.length);
    if (currentShowIndex < shows.length - 1) {
      console.log('✅ Moving to next show, index:', currentShowIndex + 1);
      
      // Pause current audio before switching
      if (playerRef.current && isPlaying) {
        (playerRef.current as HTMLAudioElement).pause();
        setIsPlaying(false);
      }
      
      onShowChange(currentShowIndex + 1);
      
      // Wait for the new show to load, then auto-play first track
      setTimeout(() => {
        if (playerRef.current) {
          const audio = playerRef.current as HTMLAudioElement;
          console.log('🎵 Loading new show audio source');
          
          // Force reload the audio element with new source
          audio.load();
          
          // Wait for the audio to be ready, then play
          audio.addEventListener('canplay', function onCanPlay() {
            console.log('🎵 New show ready to play, starting playback');
            audio.removeEventListener('canplay', onCanPlay);
            audio.play().then(() => {
              setIsPlaying(true);
              console.log('✅ First track of new show auto-played successfully');
            }).catch(err => {
              console.error('❌ Auto-play failed for new show:', err);
            });
          }, { once: true });
        }
      }, 300);
    } else {
      console.log('⚠️ Already at last show');
    }
  };

  const previousShow = () => {
    console.log('🎵 previousShow called, currentShowIndex:', currentShowIndex);
    if (currentShowIndex > 0) {
      console.log('✅ Moving to previous show, index:', currentShowIndex - 1);
      
      // Pause current audio before switching
      if (playerRef.current && isPlaying) {
        (playerRef.current as HTMLAudioElement).pause();
        setIsPlaying(false);
      }
      
      onShowChange(currentShowIndex - 1);
      
      // Wait for the new show to load, then auto-play first track
      setTimeout(() => {
        if (playerRef.current) {
          const audio = playerRef.current as HTMLAudioElement;
          console.log('🎵 Loading new show audio source');
          
          // Force reload the audio element with new source
          audio.load();
          
          // Wait for the audio to be ready, then play
          audio.addEventListener('canplay', function onCanPlay() {
            console.log('🎵 New show ready to play, starting playback');
            audio.removeEventListener('canplay', onCanPlay);
            audio.play().then(() => {
              setIsPlaying(true);
              console.log('✅ First track of previous show auto-played successfully');
            }).catch(err => {
              console.error('❌ Auto-play failed for previous show:', err);
            });
          }, { once: true });
        }
      }, 300);
    } else {
      console.log('⚠️ Already at first show');
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };



  if (!currentShow) {
    return <div className="audio-player no-show">No shows available</div>;
  }

  // Debug current state
  console.log('🎵 AudioPlayer render - currentShowIndex:', currentShowIndex, 'shows.length:', shows.length, 'currentTime:', currentTime, 'duration:', duration);

  return (
    <div className="audio-player">
      <div className="player-header">
        <h2 className="show-title">{currentShow.title}</h2>
        <div className="show-info">
          Show {currentShowIndex + 1} of {shows.length}
        </div>
      </div>

      <div className="player-main">
        {currentShow && (
          <>
            {/* Audio element - invisible but functional for metadata loading */}
            <audio
              ref={playerRef}
              src={currentShow?.url}
              preload="metadata"
              crossOrigin="anonymous"
              key={`${currentShowIndex}-${currentTrackIndex}`}
              onPlay={handlePlay}
              onPause={handlePause}
              onEnded={handleEnded}
              onTimeUpdate={(e) => {
                const target = e.target as HTMLAudioElement;
                setCurrentTime(target.currentTime);
              }}
              onLoadedMetadata={(e) => {
                const target = e.target as HTMLAudioElement;
                if (target.duration && !isNaN(target.duration)) {
                  setDuration(target.duration);
                  setIsLoading(false);
                }
              }}
              onCanPlay={(e) => {
                const target = e.target as HTMLAudioElement;
                if (target.duration && !isNaN(target.duration) && duration === 0) {
                  setDuration(target.duration);
                  setIsLoading(false);
                }
              }}
              onLoadStart={() => {
                console.log('🎵 Audio source changed to:', currentShow?.url);
                setIsLoading(true);
              }}
              onError={(e) => {
                console.error('Audio element error:', e);
                setIsLoading(false);
              }}
              style={{ 
                position: 'absolute',
                left: '-9999px',
                width: '1px',
                height: '1px',
                opacity: 0,
                pointerEvents: 'none'
              }}
            />
          </>
        )}

        <div className="progress-container">
          {/* Track Title Display */}
          {currentShow && (
            <div className="track-title-display">
              <h3 className="current-track-title">
                🎵 {currentShow.title}
              </h3>
              <div className="track-info">
                Show {currentShowIndex + 1} of {shows.length}
              </div>
            </div>
          )}
          
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
            onClick={() => {
              console.log('🎯 Previous Track button clicked!');
              previousTrack();
            }}
            disabled={currentShowIndex === 0}
            title="Previous Show"
          >
            ⏮
          </button>
          
          <button 
            className="control-btn skip-btn" 
            onClick={() => {
              console.log('🎯 Skip Backward button clicked!');
              skipBackward();
            }}
            title="Skip Backward 10s"
          >
            ⏪
          </button>

          <button 
            className="control-btn play-btn" 
            onClick={() => {
              console.log('🎯 Play/Pause button clicked!');
              if (isPlaying) {
                handlePause();
              } else {
                handlePlay();
              }
            }}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? '⏸' : '▶️'}
          </button>

          <button 
            className="control-btn skip-btn" 
            onClick={() => {
              console.log('🎯 Skip Forward button clicked!');
              skipForward();
            }}
            title="Skip Forward 10s"
          >
            ⏩
          </button>

          <button 
            className="control-btn skip-btn" 
            onClick={() => {
              console.log('🎯 Next Track button clicked!');
              nextTrack();
            }}
            disabled={currentShowIndex === (shows.length - 1)}
            title="Next Show"
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
