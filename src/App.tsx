import React, { useState, useEffect, useRef, useMemo } from 'react';
import './App.css';
import AudioPlayer, { Track, AudioPlayerHandle } from './components/AudioPlayer';
import ShowList from './components/ShowList';
import BackgroundManager from './components/BackgroundManager';
import LiveStreamTicker from './components/LiveStreamTicker';
import LiveStreamButton from './components/LiveStreamButton';
import { useLiveStatus } from './hooks/useLiveStatus';
import { useAudio } from './audio/AudioProvider';
import { apiService, Show, PageContent } from './services/api';
import logo from './logo.png';

function App() {
  const playerRef = useRef<AudioPlayerHandle | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [currentShowIndex, setCurrentShowIndex] = useState(0);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [activePage, setActivePage] = useState<'about' | 'events' | 'contact' | null>(null);
  const [pageCache, setPageCache] = useState<Record<string, PageContent>>({});
  const [contactCopied, setContactCopied] = useState(false);
  const [contactHovered, setContactHovered] = useState(false);
  // const [autoPlay, setAutoPlay] = useState(true); // Currently unused but kept for future use
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live stream status and audio context
  const { isLive, nowPlaying, streamUrl } = useLiveStatus();
  const { source, playLive, stopLive, trackNowPlaying } = useAudio();
  const livePlaying = source === "live";
  
  // Custom live stream label from admin (defaults to "LIVE NOW")
  const liveLabel = pageCache.live_label?.content || 'LIVE NOW';

  // Determine what to display in the ticker based on which audio source is playing
  const tickerDisplayText = useMemo(() => {
    if (source === "live") {
      if (nowPlaying && !liveLabel.includes(nowPlaying)) {
        return `${liveLabel}: ${nowPlaying}`;
      }
      return liveLabel;
    }
    if (source === "track") {
      return `PLAYING NOW: ${trackNowPlaying ?? "Track"}`;
    }
    return "NOTHING CURRENTLY PLAYING";
  }, [source, nowPlaying, trackNowPlaying, liveLabel]);
  
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

  // Fetch all page content on mount
  useEffect(() => {
    const fetchAllPages = async () => {
      try {
        const [about, events, contact, liveLabel] = await Promise.all([
          apiService.getPageContent('about'),
          apiService.getPageContent('events'),
          apiService.getPageContent('contact'),
          apiService.getPageContent('live_label'),
        ]);
        setPageCache({
          about: about,
          events: events,
          contact: contact,
          live_label: liveLabel,
        });
      } catch (err) {
        console.error('Error fetching page content:', err);
      }
    };
    fetchAllPages();
  }, []);
  
  // Handle show selection
  const handleShowChange = (newShowIndex: number) => {
    console.log('App: Changing show to:', newShowIndex);

    if (newShowIndex !== currentShowIndex) {
      setCurrentShowIndex(newShowIndex);
      setCurrentTrackIndex(0);
    }

    // Always trigger playback (handles first load where show is already selected)
    requestAnimationFrame(() => {
      playerRef.current?.playFromUI(0);
    });
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

      {/* Logo at center top */}
      <div className="logo-container">
        <img src={logo} alt="Glue Factory Radio Logo" className="logo-image" />
      </div>

      {/* LIVE NOW button - fixed at true center of viewport */}
      <LiveStreamButton
        isLive={isLive}
        isPlaying={livePlaying}
        nowPlaying={nowPlaying ?? undefined}
        liveLabel={liveLabel}
        onClick={() => (livePlaying ? stopLive() : playLive(streamUrl))}
      />

      {/* Archive footer - fixed to bottom, expands upward */}
      <div className={`App-footer-archive ${archiveExpanded ? 'expanded' : ''}`}>
        {/* Sticky header row - must be direct child of scroll container */}
        <div
          className="archive-header-row clickable"
          onClick={() => setArchiveExpanded(!archiveExpanded)}
        >
          <span className="archive-header-text">{archiveExpanded ? 'CLOSE THE ARCHIVE' : 'OPEN THE ARCHIVE'}</span>
          <span className={`archive-arrow ${archiveExpanded ? 'expanded' : ''}`}>
            ▼
          </span>
        </div>

        <AudioPlayer
          key={shows[validShowIndex]?.id ?? validShowIndex}
          ref={playerRef}
          tracks={currentTracks}
          initialIndex={currentTrackIndex}
          showName={shows[validShowIndex]?.title || "CD Mode"}
          archiveExpanded={archiveExpanded}
          onArchiveToggle={() => setArchiveExpanded(!archiveExpanded)}
        />

        {archiveExpanded && (
          <>
            <ShowList
              shows={shows}
              currentShowIndex={validShowIndex}
              onShowSelect={handleShowChange}
              onTrackSelect={handleTrackSelect}
            />
            {/* Bottom nav footer - fixed within expanded archive */}
            <div className="archive-nav-footer">
              <span className="archive-nav-item" onClick={() => setActivePage('about')}>ABOUT</span>
              <span className="archive-nav-item" onClick={() => setActivePage('events')}>EVENTS</span>
              <span className="archive-nav-item" onClick={() => setActivePage('contact')}>CONTACT</span>
            </div>
          </>
        )}
      </div>

      {/* Page overlay for nav items */}
      {activePage && (
        <div className="page-overlay">
          <button className="page-overlay-close" onClick={() => setActivePage(null)} aria-label="Close">
          </button>
          <div className="page-overlay-content">
            {activePage && pageCache[activePage]?.content ? (
              activePage === 'contact' ? (
                <div
                  className={`page-text contact-copyable ${contactCopied ? 'copied' : ''}`}
                  onClick={() => {
                    navigator.clipboard.writeText(pageCache[activePage].content);
                    setContactCopied(true);
                    setTimeout(() => setContactCopied(false), 2000);
                  }}
                  onMouseEnter={() => setContactHovered(true)}
                  onMouseLeave={() => setContactHovered(false)}
                >
                  {/* Email stays in DOM to maintain hover area size */}
                  <span className={`contact-email ${contactCopied || (contactHovered && window.matchMedia('(hover: hover)').matches) ? 'hidden' : ''}`}>
                    {pageCache[activePage].content}
                  </span>
                  {/* Overlay text positioned on top */}
                  {contactCopied ? (
                    <span className="contact-overlay">COPIED!</span>
                  ) : contactHovered && window.matchMedia('(hover: hover)').matches ? (
                    <span className="contact-overlay">CLICK TO COPY</span>
                  ) : null}
                </div>
              ) : (
                <div className="page-text">{pageCache[activePage].content}</div>
              )
            ) : null}

            {/* Mailchimp signup form - Events page only */}
            {activePage === 'events' && (
              <div className="events-signup">
                <form
                  action="https://gluefactoryradio.us3.list-manage.com/subscribe/post?u=59fdb08d951a9fe15136d1bcf&amp;id=d929eeaa44&amp;f_id=00625ee1f0"
                  method="post"
                  target="_self"
                  className="events-signup-form"
                >
                  <label htmlFor="mce-EMAIL" className="events-signup-label">
                    Subscribe for event updates
                  </label>
                  <div className="events-signup-input-row">
                    <input
                      type="email"
                      name="EMAIL"
                      id="mce-EMAIL"
                      placeholder="Enter your email"
                      required
                      className="events-signup-input"
                    />
                    <button type="submit" className="events-signup-button">
                      Subscribe
                    </button>
                  </div>
                  {/* Honeypot field for bot protection */}
                  <div style={{ position: 'absolute', left: '-5000px' }} aria-hidden="true">
                    <input type="text" name="b_59fdb08d951a9fe15136d1bcf_d929eeaa44" tabIndex={-1} defaultValue="" />
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default App;
