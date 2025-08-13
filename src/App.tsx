import React, { useState, useEffect } from 'react';
import './App.css';
import AudioPlayer from './components/AudioPlayer';
import ShowList from './components/ShowList';
import { apiService, Show } from './services/api';

function App() {
  const [shows, setShows] = useState<Show[]>([]);
  const [currentShowIndex, setCurrentShowIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch shows from Railway backend
  const fetchShows = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const showsData = await apiService.getShows();
      setShows(showsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch shows');
      console.error('Error fetching shows:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load shows on component mount
  useEffect(() => {
    fetchShows();
  }, []);

  const handleShowChange = (index: number) => {
    setCurrentShowIndex(index);
  };

  const handleAutoPlayToggle = () => {
    setAutoPlay(!autoPlay);
  };



  return (
    <div className="App">
      <header className="App-header">
        <h1 className="app-title">🎵 Glue Factory Radio 🎵</h1>
        <p className="app-subtitle">Your Internet Radio Station</p>
      </header>
      
      <main className="App-main">
        {/* Loading State */}
        {isLoading && (
          <div className="loading-state">
            <p>Loading shows from Railway...</p>
          </div>
        )}
        
        {/* Error State */}
        {error && (
          <div className="error-state">
            <p>Error: {error}</p>
            <button onClick={fetchShows}>Retry</button>
          </div>
        )}
        
        {/* Audio Player and Show List */}
        {!isLoading && !error && shows.length > 0 && (
          <>
            <AudioPlayer
              shows={shows}
              currentShowIndex={currentShowIndex}
              onShowChange={handleShowChange}
              autoPlay={autoPlay}
              onAutoPlayToggle={handleAutoPlayToggle}
            />
            
            <ShowList
              shows={shows}
              currentShowIndex={currentShowIndex}
              onShowSelect={handleShowChange}
            />
          </>
        )}
        
        {/* No Shows State */}
        {!isLoading && !error && shows.length === 0 && (
          <div className="no-shows-state">
            <h3>No Shows Yet</h3>
            <p>Shows will appear here once they're uploaded via the admin interface.</p>
          </div>
        )}
      </main>
      
      <footer className="App-footer">
        <p>&copy; 2024 Glue Factory Radio. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
