import React, { useState, useEffect, useRef, useMemo } from 'react';
import './App.css';
import AudioPlayer, { Track, AudioPlayerHandle } from './components/AudioPlayer';
import ShowList from './components/ShowList';
import BackgroundManager from './components/BackgroundManager';
import LiveStreamTicker from './components/LiveStreamTicker';
import LiveStreamButton from './components/LiveStreamButton';
import { useLiveStatus } from './hooks/useLiveStatus';
import { useAudio } from './audio/AudioProvider';
import { apiService, Show } from './services/api';
import logo from './logo.png'; // Import the PNG logo

function App() {
  const playerRef = useRef<AudioPlayerHandle | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [currentShowIndex, setCurrentShowIndex] = useState(0);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  // const [autoPlay, setAutoPlay] = useState(true); // Currently unused but kept for future use
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live stream status and audio context
  const { isLive, nowPlaying, streamUrl } = useLiveStatus();
  const { source, playLive, stopLive, trackNowPlaying } = useAudio();
  const livePlaying = source === "live";
  
  // Determine what to display in the ticker based on which audio source is playing
  const tickerDisplayText = useMemo(() => {
    if (source === "live") {
      return `LIVE NOW: ${nowPlaying ?? "Live Stream"}`;
    }
    if (source === "track") {
      return `PLAYING NOW: ${trackNowPlaying ?? "Track"}`;
    }
    return "NOTHING CURRENTLY PLAYING";
  }, [source, nowPlaying, trackNowPlaying]);
  
  const tickerIsEmpty = source === "none";
  
  // Fetch shows on component mount
  useEffect(() => {
    const fetchShows = async () => {
      try {
        setIsLoading(true);
        console.log('App: Fetching shows...');
        const fetchedShows = await apiService.getShows();
        console.log('App: Fetched', fetchedShows.length, 'shows');
        fetchedShows.forEach((show, idx) => {
          console.log(`App: Show ${idx}: "${show.title}" with ${show.tracks?.length || 0} tracks`);
        });
        setShows(fetchedShows);
        setError(null);
      } catch (err) {
        console.error('App: Error fetching shows:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch shows');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchShows();
  }, []);
  
  // Monitor state changes for debugging
  useEffect(() => {
    console.log('App: State changed - Show:', currentShowIndex, 'Track:', currentTrackIndex);
  }, [currentShowIndex, currentTrackIndex]);

  // Debug audio source changes
  useEffect(() => {
    console.log("[AUDIO SOURCE]", source);
  }, [source]);
  
  // Handle show selection
  const handleShowChange = (newShowIndex: number) => {
    console.log('App: Changing show to:', newShowIndex);

    // If user clicks the *currently active* show, do nothing.
    // This prevents resetting the track index and stopping playback.
    if (newShowIndex === currentShowIndex) {
      return;
    }

    // Only when switching to a different show:
    setCurrentShowIndex(newShowIndex);
    setCurrentTrackIndex(0); // jump to first track of the new show
  };
  
  // Handle track selection from ShowList
  const handleTrackSelect = (showIndex: number, trackIndex: number) => {
    console.log('App: handleTrackSelect CALLED!');
    console.log('App: Track selected - Show:', showIndex, 'Track:', trackIndex);
    console.log('App: Previous state - Show:', currentShowIndex, 'Track:', currentTrackIndex);
    
    // 1) Switch show/track state so UI reflects selection
    if (showIndex !== currentShowIndex) setCurrentShowIndex(showIndex);
    setCurrentTrackIndex(trackIndex);

    // 2) MOST IMPORTANT: start playback in the same user click
    //    This satisfies autoplay policies reliably.
    //    We also pass the target index explicitly.
    requestAnimationFrame(() => {
      playerRef.current?.playFromUI(trackIndex);
    });
    
    console.log('App: Updated currentShowIndex to:', showIndex, 'and currentTrackIndex to:', trackIndex);
  };
  
  // Handle track navigation from AudioPlayer (currently unused but kept for future use)
  // const handleTrackChange = (newTrackIndex: number) => {
  //   setCurrentTrackIndex(newTrackIndex);
  // };
  
  // Handle auto-play toggle (currently unused but kept for future use)
  // const handleAutoPlayToggle = () => {
  //   setAutoPlay(!autoPlay);
  // };
  
  // Ensure indices are valid (handle empty shows array safely)
  const validShowIndex = shows.length > 0 
    ? Math.min(Math.max(0, currentShowIndex), shows.length - 1)
    : 0;
  
  // Convert show tracks to EpisodePlayer format
  const convertShowToTracks = (show: Show): Track[] => {
    return show.tracks.map(track => ({
      src: `https://glue-factory-radio-production.up.railway.app/api${track.url}`,
      title: track.title
    }));
  };

  // Get tracks for current show
  const currentTracks = shows[validShowIndex] ? convertShowToTracks(shows[validShowIndex]) : [];
  
  console.log('App: Final values - validShowIndex:', validShowIndex, 'tracks:', currentTracks.length);
  if (currentTracks.length > 0) {
    console.log('App: First track URL:', currentTracks[0].src);
  }
  
  return (
    <>
      <BackgroundManager />
      <LiveStreamTicker
        displayText={tickerDisplayText}
        isEmpty={tickerIsEmpty}
      />
      
      <div className="logo-container">
        <div className="logo-image-container">
          <img src={logo} alt="Glue Factory Radio Logo" className="logo-image" />
        </div>
      </div>
      
      <LiveStreamButton
        isLive={isLive}
        isPlaying={livePlaying}
        nowPlaying={nowPlaying ?? undefined}
        onClick={() => (livePlaying ? stopLive() : playLive(streamUrl))}
      />
      
      <main className="App-main">
        
        <AudioPlayer
          key={shows[validShowIndex]?.id ?? validShowIndex}  // force remount on show change
          ref={playerRef}
          tracks={currentTracks}
          initialIndex={currentTrackIndex}
          showName={shows[validShowIndex]?.title || "CD Mode"}
        />
        
        <ShowList
          shows={shows}
          currentShowIndex={validShowIndex}
          onShowSelect={handleShowChange}
          onTrackSelect={handleTrackSelect}
          isLoading={isLoading}
          error={error}
        />
      </main>
    </>
  );
}

export default App;
