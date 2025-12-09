import React, { useState } from 'react';
import './ShowList.css';
import { Show } from '../services/api';

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

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString();
  };

  const toggleShowExpansion = (
    showIndex: number,
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();

    // The show card container
    const cardEl = (event.currentTarget as HTMLElement).closest(
      ".show-item"
    ) as HTMLElement | null;

    // Capture card's vertical position BEFORE expanding/collapsing
    const prevTop = cardEl
      ? cardEl.getBoundingClientRect().top + window.scrollY
      : window.scrollY;

    // Toggle expanded state
    setExpandedShows((prev) => {
      const next = new Set(prev);
      if (next.has(showIndex)) next.delete(showIndex);
      else next.add(showIndex);
      return next;
    });

    // TWO-FRAME STABILIZATION — eliminates jitter & layout bounce
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cardEl) return;

        // Card's new Y position after React + browser layout settle
        const newTop = cardEl.getBoundingClientRect().top + window.scrollY;
        const delta = newTop - prevTop;

        // Scroll correction to maintain visual stability
        window.scrollTo({
          top: window.scrollY + delta,
          behavior: "instant" as any
        });
      });
    });
  };

  const handleTrackClick = (
    showIndex: number,
    trackIndex: number,
    event: React.MouseEvent
  ) => {
    event.stopPropagation(); // Prevent show selection when clicking track
    onTrackSelect(showIndex, trackIndex);
  };

  return (
    <div className="show-list">
      <div className="shows-container">
        {shows.map((show, index) => {
          const isExpanded = expandedShows.has(index);

          return (
            <div
              key={show.id}
              className={`show-item ${
                index === currentShowIndex ? 'active' : ''
              }`}
              onClick={() => onShowSelect(index)}
            >
              <div className="show-item-header">
                <h4 className="show-item-title">{show.title}</h4>
                <div className="show-item-controls">
                  <span className="show-item-duration">
                    {formatDuration(show.total_duration)}
                  </span>
                  <button
                    className={`dropdown-button ${
                      isExpanded ? 'rotated' : ''
                    }`}
                    onClick={(e) => toggleShowExpansion(index, e)}
                    title={isExpanded ? 'Hide tracks' : 'Show tracks'}
                  >
                    +
                  </button>
                </div>
              </div>

              {show.description && (
                <p className="show-item-description">{show.description}</p>
              )}

              <div className="show-item-meta">
                <span className="show-item-date">
                  {formatDate(show.created_date)}
                </span>
                <span className="show-item-number">
                  #{shows.length - index}
                </span>
                <span className="show-item-tracks">
                  🎵 {show.total_tracks} tracks
                </span>
              </div>

              {/* 🔽 Always rendered, animated via CSS */}
              <div
                className={`tracks-dropdown ${
                  isExpanded ? 'expanded' : 'collapsed'
                }`}
              >
                <div className="tracks-header">
                  <h5>🎵 Tracks in this Show</h5>
                </div>
                <div className="tracks-list">
                  {show.tracks.map((track, trackIndex) => (
                    <div
                      key={track.id}
                      className="track-item"
                      onClick={(e) =>
                        handleTrackClick(index, trackIndex, e)
                      }
                    >
                      <div className="track-info">
                        <span className="track-number">
                          {trackIndex + 1}
                        </span>
                        <span className="track-title">{track.title}</span>
                        <span className="track-duration">
                          {formatDuration(track.duration)}
                        </span>
                      </div>
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
