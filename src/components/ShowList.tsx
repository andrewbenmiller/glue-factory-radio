import React, { useState } from 'react';
import './ShowList.css';
import { Show } from '../services/api';

// Parse [text](url) markdown links into React elements
function renderDescription(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <a
        key={match.index}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        {match[1]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

interface ShowListProps {
  shows: Show[];
  currentShowIndex: number;
  onShowSelect: (index: number) => void;
  onTrackSelect: (showIndex: number, trackIndex: number) => void;
}

const ShowList: React.FC<ShowListProps> = ({
  shows,
  currentShowIndex,
  onShowSelect,
  onTrackSelect,
}) => {
  const [expandedShows, setExpandedShows] = useState<Set<number>>(new Set());

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleShowExpansion = (showIndex: number, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedShows(prev => {
      const next = new Set(prev);
      if (next.has(showIndex)) next.delete(showIndex);
      else next.add(showIndex);
      return next;
    });
  };

  const handlePlayClick = (showIndex: number, event: React.MouseEvent) => {
    event.stopPropagation();
    onShowSelect(showIndex);
  };

  const handleTrackClick = (
    showIndex: number,
    trackIndex: number,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();
    onTrackSelect(showIndex, trackIndex);
  };

  return (
    <div className="show-list">
      <div className="shows-container">
        {shows.map((show, index) => {
          const isExpanded = expandedShows.has(index);
          const showNumber = shows.length - index;

          return (
            <div
              key={show.id}
              className={`show-item ${index === currentShowIndex ? 'active' : ''} ${isExpanded ? 'expanded' : ''}`}
            >
              {/* Main row: # | Title | Duration | Play */}
              <div
                className="show-item-row"
                onClick={(e) => toggleShowExpansion(index, e)}
              >
                <span className="show-item-number">#{showNumber}</span>
                <span className="show-item-title">{show.title}</span>
                <span className="show-item-duration">
                  {formatDuration(show.total_duration)}
                </span>
                <button
                  className="show-item-play"
                  onClick={(e) => handlePlayClick(index, e)}
                  title="Play show"
                >
                  ▶
                </button>
              </div>

              {/* Description (shown when expanded) */}
              {show.description && (
                <p className="show-item-description">{renderDescription(show.description)}</p>
              )}

              {/* Tracks dropdown */}
              <div
                className={`tracks-dropdown ${isExpanded ? 'expanded' : 'collapsed'}`}
              >
                <div className="tracks-list">
                  {show.tracks.map((track, trackIndex) => (
                    <div
                      key={track.id}
                      className="track-item"
                      onClick={(e) => handleTrackClick(index, trackIndex, e)}
                    >
                      <span className="track-number">{trackIndex + 1}</span>
                      <span className="track-title">{track.title}</span>
                      <span className="track-duration">
                        {formatDuration(track.duration)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
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
