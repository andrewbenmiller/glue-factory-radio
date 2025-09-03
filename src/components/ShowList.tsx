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
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString();
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
              </div>
            </div>
            {show.description && (
              <p className="show-item-description">{show.description}</p>
            )}
            <div className="show-item-meta">
              <span className="show-item-date">{formatDate(show.created_date)}</span>
              <span className="show-item-number">#{index + 1}</span>
              <span className="show-item-tracks">🎵 {show.total_tracks} tracks</span>
            </div>
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
