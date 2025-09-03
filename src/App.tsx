import React, { useState, useEffect } from 'react';
import './App.css';
import AudioPlayer from './components/AudioPlayer';
import ShowList from './components/ShowList';
import { apiService, Show } from './services/api';

function App() {
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
    
    // Update the track index
    setCurrentTrackIndex(trackIndex);
    
    console.log('🎵 App: Updated currentTrackIndex to:', trackIndex);
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
  
  console.log('🎵 App: Final values - validShowIndex:', validShowIndex);
  
  return (
    <>
      <AudioPlayer
        shows={shows}
        currentShowIndex={validShowIndex}
        currentTrackIndex={0}
        onShowChange={handleShowChange}
        onTrackChange={handleTrackChange}
        autoPlay={autoPlay}
        onAutoPlayToggle={handleAutoPlayToggle}
      />
      
      <ShowList
        shows={shows}
        currentShowIndex={validShowIndex}
        onShowSelect={handleShowChange}
        onTrackSelect={handleTrackSelect}
      />
    </>
  );
}

export default App;
