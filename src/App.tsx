import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import AudioPlayer, { Track, AudioPlayerHandle } from './components/AudioPlayer';
import ShowList from './components/ShowList';
import BackgroundManager from './components/BackgroundManager';
import { apiService, Show } from './services/api';
import logo from './logo.png'; // Import the PNG logo

function App() {
  const playerRef = useRef<AudioPlayerHandle | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [currentShowIndex, setCurrentShowIndex] = useState(0);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch shows on component mount
  useEffect(() => {
    const fetchShows = async () => {
      try {
        setIsLoading(true);
        const fetchedShows = await apiService.getShows();
        setShows(fetchedShows);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch shows');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchShows();
  }, []);
  
  // Monitor state changes for debugging
  useEffect(() => {
    console.log('🎵 App: State changed - Show:', currentShowIndex, 'Track:', currentTrackIndex);
  }, [currentShowIndex, currentTrackIndex]);
  
  // Handle show selection
  const handleShowChange = (newShowIndex: number) => {
    console.log('🎵 App: Changing show to:', newShowIndex);
    setCurrentShowIndex(newShowIndex);
    setCurrentTrackIndex(0); // Reset to first track when changing shows
  };
  
  // Handle track selection from ShowList
  const handleTrackSelect = (showIndex: number, trackIndex: number) => {
    console.log('🎵 App: handleTrackSelect CALLED!');
    console.log('🎵 App: Track selected - Show:', showIndex, 'Track:', trackIndex);
    console.log('🎵 App: Previous state - Show:', currentShowIndex, 'Track:', currentTrackIndex);
    
    // 1) Switch show/track state so UI reflects selection
    if (showIndex !== currentShowIndex) setCurrentShowIndex(showIndex);
    setCurrentTrackIndex(trackIndex);

    // 2) MOST IMPORTANT: start playback in the same user click
    //    This satisfies autoplay policies reliably.
    //    We also pass the target index explicitly.
    requestAnimationFrame(() => {
      playerRef.current?.playFromUI(trackIndex);
    });
    
    console.log('🎵 App: Updated currentShowIndex to:', showIndex, 'and currentTrackIndex to:', trackIndex);
  };
  
  // Handle track navigation from AudioPlayer
  const handleTrackChange = (newTrackIndex: number) => {
    setCurrentTrackIndex(newTrackIndex);
  };
  
  // Handle auto-play toggle
  const handleAutoPlayToggle = () => {
    setAutoPlay(!autoPlay);
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="loading-state">
        <h2>Loading Glue Factory Radio...</h2>
        <p>Please wait while we fetch your shows.</p>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="error-state">
        <h2>Error Loading Shows</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }
  
  // No shows state
  if (shows.length === 0) {
    return (
      <div className="no-shows-state">
        <h2>No Shows Available</h2>
        <p>No shows have been uploaded yet.</p>
        <p>Check back later or contact an administrator.</p>
      </div>
    );
  }
  
  // Ensure indices are valid
  const validShowIndex = Math.min(Math.max(0, currentShowIndex), shows.length - 1);
  
  // Convert show tracks to EpisodePlayer format
  const convertShowToTracks = (show: Show): Track[] => {
    return show.tracks.map(track => ({
      src: `https://glue-factory-radio-production.up.railway.app/api${track.url}`,
      title: track.title
    }));
  };

  // Get tracks for current show
  const currentTracks = shows[validShowIndex] ? convertShowToTracks(shows[validShowIndex]) : [];
  
  console.log('🎵 App: Final values - validShowIndex:', validShowIndex);
  
  return (
    <>
      <BackgroundManager />
      
      <header className="App-header">
        <div className="logo-container">
          <div className="logo-image-container">
            <img src={logo} alt="Glue Factory Radio Logo" className="logo-image" />
          </div>
        </div>
      </header>
      
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
        />
      </main>
    </>
  );
}

export default App;
