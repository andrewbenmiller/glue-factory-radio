import React, { useState, useEffect } from 'react';
import { apiService, Series, Show } from '../services/api';
import './SeriesBrowse.css';

interface SeriesBrowseProps {
  onEpisodeSelect: (episode: Show) => void;
}

const SeriesBrowse: React.FC<SeriesBrowseProps> = ({ onEpisodeSelect }) => {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<(Series & { episodes: Show[] }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSeries = async () => {
      try {
        setLoading(true);
        const data = await apiService.getSeries();
        setSeriesList(data);
      } catch (err) {
        console.error('Error loading series:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSeries();
  }, []);

  const openSeriesDetail = async (seriesId: number) => {
    try {
      setLoading(true);
      const detail = await apiService.getSeriesDetail(seriesId);
      setSelectedSeries(detail);
    } catch (err) {
      console.error('Error loading series detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="series-loading">Loading...</div>;
  }

  // Detail view
  if (selectedSeries) {
    return (
      <div className="series-detail">
        <button className="series-back" onClick={() => setSelectedSeries(null)}>
          ← ALL SERIES
        </button>
        {selectedSeries.cover_image_url && (
          <div className="series-detail-cover">
            <img src={selectedSeries.cover_image_url} alt={selectedSeries.title} />
          </div>
        )}
        <h2 className="series-detail-title">{selectedSeries.title}</h2>
        {selectedSeries.description && (
          <p className="series-detail-description">{selectedSeries.description}</p>
        )}
        <div className="series-episodes">
          {selectedSeries.episodes.length === 0 ? (
            <div className="series-empty">No episodes yet</div>
          ) : (
            selectedSeries.episodes.map(ep => (
              <div
                key={ep.id}
                className="series-episode-item"
                onClick={() => onEpisodeSelect(ep)}
              >
                <span className="episode-info">
                  <span className="episode-number">Ep. {ep.episode_number}</span>
                  <span className="episode-title">{ep.title}</span>
                </span>
                <span className="episode-meta">
                  <span className="episode-tracks">{ep.total_tracks} track{ep.total_tracks !== 1 ? 's' : ''}</span>
                  <span className="episode-duration">{formatDuration(ep.total_duration)}</span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Browse view — grid of square cards
  return (
    <div className="series-browse">
      {seriesList.length === 0 ? (
        <div className="series-empty">No series yet</div>
      ) : (
        seriesList.map(s => (
          <div
            key={s.id}
            className="series-card"
            onClick={() => openSeriesDetail(s.id)}
          >
            <div
              className="series-card-image"
              style={s.cover_image_url ? { backgroundImage: `url(${s.cover_image_url})` } : undefined}
            />
            <div className="series-card-overlay">
              <span className="series-card-title">{s.title}</span>
              <span className="series-card-meta">
                {s.episode_count} episode{s.episode_count !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default SeriesBrowse;
