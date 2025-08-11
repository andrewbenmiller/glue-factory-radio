import React, { useState } from 'react';
import './App.css';
import AudioPlayer from './components/AudioPlayer';
import ShowList from './components/ShowList';

interface Show {
  id: string;
  title: string;
  url: string;
  duration: number;
  description?: string;
  uploadDate?: string;
}

function App() {
  const [shows] = useState<Show[]>([
    // Sample shows for testing - replace with real data later
    {
      id: '1',
      title: 'Morning Coffee Jazz',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      duration: 180,
      description: 'Smooth jazz to start your day with a cup of coffee.',
      uploadDate: '2024-08-11'
    },
    {
      id: '2',
      title: 'Electronic Beats',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      duration: 240,
      description: 'Upbeat electronic music to get you moving.',
      uploadDate: '2024-08-11'
    },
    {
      id: '3',
      title: 'Classical Hour',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      duration: 300,
      description: 'Beautiful classical compositions for relaxation.',
      uploadDate: '2024-08-11'
    }
  ]);
  
  const [currentShowIndex, setCurrentShowIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

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
      </main>
      
      <footer className="App-footer">
        <p>&copy; 2024 Glue Factory Radio. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
