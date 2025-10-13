import React, { useState } from 'react';
import './ShowList.css';
import { Show } from '../services/api';

interface ShowListProps {
  shows: Show[];
  currentShowIndex: number;
  onShowSelect: (index: number) => void;
  onTrackSelect: (showIndex: number, trackIndex: number) => void;
}

const ShowList: React.FC<ShowListProps> = ({ shows, currentShowIndex, onShowSelect, onTrackSelect }) => {
  const [expandedShows, setExpandedShows] = useState<Set<number>>(new Set());
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString();
  };

  const toggleShowExpansion = (showIndex: number, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent show selection when clicking dropdown
    setExpandedShows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(showIndex)) {
        newSet.delete(showIndex);
      } else {
        newSet.add(showIndex);
      }
      return newSet;
    });
  };

  const handleTrackClick = (showIndex: number, trackIndex: number, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent show selection when clicking track
    onTrackSelect(showIndex, trackIndex);
  };

  return (
    <div className="show-list">
      <h3 className="show-list-title">Available Shows</h3>
      <div className="shows-container">
        {shows.map((show, index) => (
          <div
            key={show.id}
            className={`show-item ${index === currentShowIndex ? 'active' : ''}`}
            onClick={() => onShowSelect(index)}
          >
            <div className="show-item-header">
              <h4 className="show-item-title">{show.title}</h4>
              <div className="show-item-controls">
                <span className="show-item-duration">{formatDuration(show.total_duration)}</span>
                <button 
                  className={`dropdown-button ${expandedShows.has(index) ? 'rotated' : ''}`}
                  onClick={(e) => toggleShowExpansion(index, e)}
                  title={expandedShows.has(index) ? "Hide tracks" : "Show tracks"}
                >
                  +
                </button>
              </div>
            </div>
            {show.description && (
              <p className="show-item-description">{show.description}</p>
            )}
            <div className="show-item-meta">
              <span className="show-item-date">{formatDate(show.created_date)}</span>
              <span className="show-item-number">#{shows.length - index}</span>
              <span className="show-item-tracks">{show.total_tracks} tracks</span>
            </div>
            
            {/* Track listing dropdown */}
            {expandedShows.has(index) && (
              <div className="tracks-dropdown">
                <div className="tracks-header">
                  <h5>🎵 Tracks in this Show</h5>
                </div>
                <div className="tracks-list">
                  {show.tracks.map((track, trackIndex) => (
                    <div
                      key={track.id}
                      className="track-item"
                      onClick={(e) => handleTrackClick(index, trackIndex, e)}
                    >
                      <div className="track-info">
                        <span className="track-number">{trackIndex + 1}</span>
                        <span className="track-title">{track.title}</span>
                        <span className="track-duration">{formatDuration(track.duration)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {shows.length === 0 && (
        <div className="no-shows">
          <p>No shows uploaded yet.</p>
          <p>Upload some MP3 files to get started!</p>
        </div>
      )}
    </div>
  );
};

export default ShowList;
