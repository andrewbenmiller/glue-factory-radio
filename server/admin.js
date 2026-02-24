// Glue Factory Radio Admin Portal JavaScript
const API_BASE_URL = window.location.origin; // Use the same domain as the admin interface

// Global variables
let shows = [];
let allSeries = [];
let currentDeleteId = null;
let expandedShows = new Set();

// Initialize admin portal
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎵 Admin portal loaded');
    setupTabNavigation();
    setupUploadForm();
    setupAddTrackForm();
    setupEventDelegation();
    setupPasteToLink('description');
    setupPasteToLink('editDescription');
    loadShows();
    loadStats();
    loadSeriesList();
    setupSeriesSelect();
    setupCreateSeriesForm();
});



// Tab Navigation
function setupTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show target content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetTab) {
                    content.classList.add('active');
                }
            });

            // Load data for the tab
            if (targetTab === 'manage') {
                loadShows();
            } else if (targetTab === 'backgrounds') {
                loadBackgroundImages();
            } else if (targetTab === 'pages') {
                loadPages();
            } else if (targetTab === 'stats') {
                loadStats();
            } else if (targetTab === 'series') {
                loadSeriesManagement();
            }
        });
    });
}

// Upload Form - Create New Show
function setupUploadForm() {
    const form = document.getElementById('uploadForm');
    const uploadBtn = document.getElementById('uploadBtn');
    const audioInput = document.getElementById('audio');
    const filePreview = document.getElementById('filePreview');
    const fileList = document.getElementById('fileList');

    // Show file preview when files are selected
    audioInput.addEventListener('change', function(e) {
        const files = e.target.files;
        if (files.length > 0) {
            filePreview.style.display = 'block';
            fileList.innerHTML = '';
            
            let fallbackOrder = 1;
            Array.from(files).forEach((file) => {
                const li = document.createElement('li');
                li.style.padding = '5px 0';
                li.style.borderBottom = '1px solid #dee2e6';

                // Extract track name and order from filename (preview)
                const trackName = extractTrackNameFromFilename(file.name);
                const fileOrder = extractTrackOrderFromFilename(file.name);
                const displayOrder = fileOrder !== null ? fileOrder : fallbackOrder++;
                li.innerHTML = `<strong>${displayOrder}.</strong> ${file.name} <em style="color: #666;">→ "${trackName}"</em>`;
                fileList.appendChild(li);
            });
        } else {
            filePreview.style.display = 'none';
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const title = formData.get('title');
        const description = formData.get('description');
        const trackTitle = formData.get('trackTitle');
        const audioFiles = audioInput.files;

        if (!title.trim()) {
            showStatus('Please enter an episode title', 'error');
            return;
        }

        if (!audioFiles || audioFiles.length === 0) {
            showStatus('Please select at least one audio file', 'error');
            return;
        }

        // Add all files to FormData
        // Note: trackTitle is optional - if provided, it will be used for the first track
        // If not provided, all track names will be extracted from filenames
        if (trackTitle && trackTitle.trim()) {
            formData.set('trackTitle', trackTitle.trim());
        }

        // Add tags to FormData
        const createShowTags = getTagsForContext('createShow');
        if (createShowTags.length > 0) {
            formData.set('tags', JSON.stringify(createShowTags));
        }

        // Add series info to FormData
        const seriesId = document.getElementById('seriesSelect').value;
        if (seriesId) {
            formData.set('series_id', seriesId);
            const epNum = document.getElementById('episodeNumber').value;
            if (epNum) {
                formData.set('episode_number', epNum);
            }
        }

        // Disable upload button and show progress
        uploadBtn.disabled = true;
        const fileCount = audioFiles.length;
        uploadBtn.textContent = `Uploading ${fileCount} track${fileCount > 1 ? 's' : ''}...`;
        
        // Show progress indicator
        const progressContainer = document.getElementById('uploadProgress');
        const progressBar = document.getElementById('progressBar');
        const progressPercent = document.getElementById('progressPercent');
        const progressStatus = document.getElementById('progressStatus');
        const currentFile = document.getElementById('currentFile');
        const uploadSpeed = document.getElementById('uploadSpeed');
        
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressPercent.textContent = '0%';
        progressStatus.textContent = 'Preparing upload...';
        currentFile.textContent = 'Initializing...';
        uploadSpeed.textContent = '';

        // Calculate total file size for progress tracking
        let totalSize = 0;
        Array.from(audioFiles).forEach(file => {
            totalSize += file.size;
        });

        // Upload progress tracking variables
        let uploadedBytes = 0;
        let startTime = Date.now();
        let lastUpdateTime = startTime;
        let lastUploadedBytes = 0;

        // Use XMLHttpRequest for progress tracking
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                uploadedBytes = e.loaded;
                const percent = Math.round((e.loaded / e.total) * 100);
                
                // Update progress bar
                progressBar.style.width = percent + '%';
                progressPercent.textContent = percent + '%';
                
                // Calculate upload speed
                const now = Date.now();
                const timeDiff = (now - lastUpdateTime) / 1000; // seconds
                if (timeDiff >= 0.5) { // Update speed every 0.5 seconds
                    const bytesDiff = uploadedBytes - lastUploadedBytes;
                    const speed = bytesDiff / timeDiff; // bytes per second
                    const speedMBps = (speed / (1024 * 1024)).toFixed(2);
                    const speedKBps = (speed / 1024).toFixed(0);
                    
                    if (speedMBps >= 1) {
                        uploadSpeed.textContent = `${speedMBps} MB/s`;
                    } else {
                        uploadSpeed.textContent = `${speedKBps} KB/s`;
                    }
                    
                    // Calculate ETA
                    const remainingBytes = e.total - e.loaded;
                    if (speed > 0) {
                        const etaSeconds = Math.round(remainingBytes / speed);
                        const etaMinutes = Math.floor(etaSeconds / 60);
                        const etaSecs = etaSeconds % 60;
                        if (etaMinutes > 0) {
                            uploadSpeed.textContent += ` • ${etaMinutes}m ${etaSecs}s remaining`;
                        } else {
                            uploadSpeed.textContent += ` • ${etaSecs}s remaining`;
                        }
                    }
                    
                    lastUpdateTime = now;
                    lastUploadedBytes = uploadedBytes;
                }
                
                // Update status
                const fileIndex = Math.floor((e.loaded / e.total) * fileCount);
                if (fileIndex < fileCount) {
                    progressStatus.textContent = `Uploading file ${fileIndex + 1} of ${fileCount}...`;
                    currentFile.textContent = audioFiles[fileIndex] ? audioFiles[fileIndex].name : 'Processing...';
                } else {
                    progressStatus.textContent = 'Processing files...';
                    currentFile.textContent = 'Creating tracks...';
                }
            }
        });

        // Handle completion
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    const tracksCount = result.tracks ? result.tracks.length : 1;
                    
                    // Show success
                    progressBar.style.width = '100%';
                    progressPercent.textContent = '100%';
                    progressStatus.textContent = '✅ Upload complete!';
                    currentFile.textContent = `Created episode "${result.show.title}" with ${tracksCount} track${tracksCount > 1 ? 's' : ''}`;
                    uploadSpeed.textContent = '';
                    
                    showStatus(`✅ Successfully created episode "${result.show.title}" with ${tracksCount} track${tracksCount > 1 ? 's' : ''}`, 'success');
                    
                    // Reset form after a brief delay
                    setTimeout(() => {
                        form.reset();
                        filePreview.style.display = 'none';
                        progressContainer.style.display = 'none';
                        uploadBtn.disabled = false;
                        uploadBtn.textContent = 'Create Episode';
                        clearTags('createShow');
                        document.getElementById('seriesSelect').value = '';
                        document.getElementById('episodeNumberGroup').style.display = 'none';

                        // Refresh shows list
                        loadShows();
                        loadStats();
                    }, 2000);
                    
                } catch (error) {
                    console.error('Error parsing response:', error);
                    showStatus(`❌ Episode creation failed: Invalid response`, 'error');
                    progressContainer.style.display = 'none';
                    uploadBtn.disabled = false;
                    uploadBtn.textContent = 'Create Episode';
                }
            } else {
                // Handle error response
                let errorMessage = `Episode creation failed: ${xhr.status}`;
                try {
                    const errorData = JSON.parse(xhr.responseText);
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    // If response isn't JSON, use status text
                    errorMessage = xhr.statusText || errorMessage;
                }
                
                showStatus(`❌ ${errorMessage}`, 'error');
                progressContainer.style.display = 'none';
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Create Episode';
            }
        });

        // Handle errors
        xhr.addEventListener('error', () => {
            showStatus('❌ Upload failed: Network error', 'error');
            progressContainer.style.display = 'none';
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Create Episode';
        });

        // Handle abort
        xhr.addEventListener('abort', () => {
            showStatus('❌ Upload cancelled', 'error');
            progressContainer.style.display = 'none';
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Create Episode';
        });

        // Start upload
        xhr.open('POST', `${API_BASE_URL}/api/upload/show`);
        xhr.send(formData);
    });

    // Background image upload form
    const backgroundUploadForm = document.getElementById('backgroundUploadForm');
    const backgroundUploadBtn = document.getElementById('backgroundUploadBtn');

    if (backgroundUploadForm) {
        backgroundUploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(backgroundUploadForm);
            const imageFile = formData.get('image');

            if (!imageFile) {
                showStatus('Please select an image file', 'error');
                return;
            }

            // Check file type
            if (!imageFile.type.startsWith('image/jpeg') && !imageFile.name.toLowerCase().match(/\.(jpg|jpeg)$/)) {
                showStatus('Only JPG/JPEG images are allowed', 'error');
            return;
        }

        // Disable upload button and show loading
            backgroundUploadBtn.disabled = true;
            backgroundUploadBtn.textContent = 'Uploading...';

        try {
                const response = await fetch(`${API_BASE_URL}/api/upload/background-image`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                    throw new Error(errorData.error || `Background image upload failed: ${response.status}`);
            }

            const result = await response.json();
                showStatus(`✅ Successfully uploaded background image: ${result.image.original_name}`, 'success');
            
            // Reset form
                backgroundUploadForm.reset();
                
                // Refresh background images list
                loadBackgroundImages();
        } catch (error) {
                console.error('Background upload error:', error);
                showStatus(`❌ Upload failed: ${error.message}`, 'error');
        } finally {
                // Re-enable upload button
                backgroundUploadBtn.disabled = false;
                backgroundUploadBtn.textContent = 'Upload Background Image';
        }
    });
    }
}

// Add Track Form
function setupAddTrackForm() {
    const form = document.getElementById('addTrackForm');
    const submitBtn = document.getElementById('addTrackSubmitBtn');
    const audioInput = document.getElementById('addTrackAudio');
    const filePreview = document.getElementById('addTrackFilePreview');
    const fileList = document.getElementById('addTrackFileList');

    // Show file preview when files are selected
    audioInput.addEventListener('change', function(e) {
        const files = e.target.files;
        if (files.length > 0) {
            filePreview.style.display = 'block';
            fileList.innerHTML = '';

            let fallbackOrder = 1;
            Array.from(files).forEach((file) => {
                const li = document.createElement('li');
                li.style.padding = '5px 0';
                li.style.borderBottom = '1px solid #dee2e6';

                const trackName = extractTrackNameFromFilename(file.name);
                const fileOrder = extractTrackOrderFromFilename(file.name);
                const displayOrder = fileOrder !== null ? fileOrder : fallbackOrder++;
                li.innerHTML = `<strong>${displayOrder}.</strong> ${file.name} <em style="color: #666;">→ "${trackName}"</em>`;
                fileList.appendChild(li);
            });
        } else {
            filePreview.style.display = 'none';
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        console.log('🎵 Add Track form submitted');

        const showId = document.getElementById('addTrackShowId').value;
        const trackTitle = document.getElementById('addTrackFirstTitle').value;
        const audioFiles = audioInput.files;

        console.log('📊 Form data:', { showId, trackTitle, fileCount: audioFiles ? audioFiles.length : 0 });

        if (!showId) {
            showStatus('❌ Show ID is missing', 'error');
            return;
        }

        if (!audioFiles || audioFiles.length === 0) {
            showStatus('Please select at least one audio file', 'error');
            return;
        }

        // Build FormData with all files
        const formData = new FormData();
        formData.append('showId', showId);
        if (trackTitle && trackTitle.trim()) {
            formData.append('trackTitle', trackTitle.trim());
        }
        for (const file of audioFiles) {
            formData.append('audio', file);
        }

        // prevent double submit
        const fileCount = audioFiles.length;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = `Uploading ${fileCount} track${fileCount > 1 ? 's' : ''}...`;
        }

        // Show progress bar
        const progressContainer = document.getElementById('addTrackProgress');
        const progressBar = document.getElementById('addTrackProgressBar');
        const progressPercent = document.getElementById('addTrackProgressPercent');
        const progressStatus = document.getElementById('addTrackProgressStatus');
        const currentFile = document.getElementById('addTrackCurrentFile');
        const uploadSpeed = document.getElementById('addTrackUploadSpeed');

        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressPercent.textContent = '0%';
        progressStatus.textContent = 'Preparing upload...';
        currentFile.textContent = 'Initializing...';
        uploadSpeed.textContent = '';

        let lastUpdateTime = Date.now();
        let lastUploadedBytes = 0;

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                progressBar.style.width = percent + '%';
                progressPercent.textContent = percent + '%';

                const now = Date.now();
                const timeDiff = (now - lastUpdateTime) / 1000;
                if (timeDiff >= 0.5) {
                    const bytesDiff = e.loaded - lastUploadedBytes;
                    const speed = bytesDiff / timeDiff;
                    const speedMBps = (speed / (1024 * 1024)).toFixed(2);
                    const speedKBps = (speed / 1024).toFixed(0);

                    uploadSpeed.textContent = speedMBps >= 1 ? `${speedMBps} MB/s` : `${speedKBps} KB/s`;

                    const remainingBytes = e.total - e.loaded;
                    if (speed > 0) {
                        const etaSeconds = Math.round(remainingBytes / speed);
                        const etaMinutes = Math.floor(etaSeconds / 60);
                        const etaSecs = etaSeconds % 60;
                        uploadSpeed.textContent += etaMinutes > 0
                            ? ` • ${etaMinutes}m ${etaSecs}s remaining`
                            : ` • ${etaSecs}s remaining`;
                    }

                    lastUpdateTime = now;
                    lastUploadedBytes = e.loaded;
                }

                const fileIndex = Math.floor((e.loaded / e.total) * fileCount);
                if (fileIndex < fileCount) {
                    progressStatus.textContent = `Uploading file ${fileIndex + 1} of ${fileCount}...`;
                    currentFile.textContent = audioFiles[fileIndex] ? audioFiles[fileIndex].name : 'Processing...';
                } else {
                    progressStatus.textContent = 'Processing files...';
                    currentFile.textContent = 'Creating tracks...';
                }
            }
        });

        xhr.addEventListener('load', async () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    const tracksCount = result.tracks ? result.tracks.length : 1;

                    progressBar.style.width = '100%';
                    progressPercent.textContent = '100%';
                    progressStatus.textContent = 'Upload complete!';
                    currentFile.textContent = `Added ${tracksCount} track${tracksCount > 1 ? 's' : ''}`;
                    uploadSpeed.textContent = '';

                    showStatus(`✅ Successfully added ${tracksCount} track${tracksCount > 1 ? 's' : ''}`, 'success');

                    setTimeout(async () => {
                        form.reset();
                        filePreview.style.display = 'none';
                        progressContainer.style.display = 'none';
                        closeAddTrackModal();

                        const showIdNum = Number(showId);
                        await loadShows();
                        await loadStats();
                        if (expandedShows.has(showIdNum)) {
                            await loadShowTracks(showIdNum);
                        }
                    }, 1500);
                } catch (error) {
                    console.error('Error parsing response:', error);
                    showStatus('❌ Track upload failed: Invalid response', 'error');
                    progressContainer.style.display = 'none';
                }
            } else {
                let errorMessage = `Track upload failed: ${xhr.status}`;
                try {
                    const errorData = JSON.parse(xhr.responseText);
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {}
                showStatus(`❌ ${errorMessage}`, 'error');
                progressContainer.style.display = 'none';
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add Track(s)';
            }
        });

        xhr.addEventListener('error', () => {
            showStatus('❌ Upload failed: Network error', 'error');
            progressContainer.style.display = 'none';
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add Track(s)';
            }
        });

        xhr.addEventListener('abort', () => {
            showStatus('❌ Upload cancelled', 'error');
            progressContainer.style.display = 'none';
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add Track(s)';
            }
        });

        xhr.open('POST', `${API_BASE_URL}/api/upload/track`);
        xhr.send(formData);
    });
}

// Helper: load tracks for all expanded shows
async function loadAllExpandedTracks() {
    for (const expandedShowId of expandedShows) {
        await loadShowTracks(expandedShowId);
    }
}

// Load Shows
async function loadShows() {
    const container = document.getElementById('showsTableContainer');
    
    try {
        container.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Loading episodes...</p>
            </div>
        `;

        const response = await fetch(`${API_BASE_URL}/api/shows/admin`);
        if (!response.ok) {
            throw new Error(`Failed to fetch shows: ${response.status}`);
        }

        shows = await response.json();
        renderShowsTable();
        // critical: fill in the "Loading tracks…" placeholders we just rendered
        await loadAllExpandedTracks();
        
    } catch (error) {
        console.error('Error loading shows:', error);
        container.innerHTML = `
            <div class="error-state">
                <p>Error loading episodes: ${error.message}</p>
                <button onclick="loadShows()">Retry</button>
            </div>
        `;
    }
}

// Render Shows Table
function renderShowsTable() {
    const container = document.getElementById('showsTableContainer');
    
    if (shows.length === 0) {
        container.innerHTML = `
            <div class="no-shows">
                <h3>No Episodes Yet</h3>
                <p>Create your first episode to get started!</p>
            </div>
        `;
        return;
    }

            const table = `
            <table class="shows-table">
                <thead>
                    <tr>
                        <th>Episode Title</th>
                        <th>Description</th>
                        <th>Tracks</th>
                        <th>Total Duration</th>
                        <th>Created Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${shows.map(show => `
                        <tr class="show-row ${expandedShows.has(show.id) ? 'expanded' : ''}" 
                            data-show-id="${show.id}">
                            <td>
                                <span class="expand-icon">▶</span>
                                <strong>${escapeHtml(show.title)}</strong>
                                ${show.series_title ? `<br><small style="color:#666;">Show: ${escapeHtml(show.series_title)} &bull; Ep. ${show.episode_number || '?'}</small>` : ''}
                            </td>
                            <td>
                                ${renderDescriptionWithLinks(show.description)}
                                ${show.tags && show.tags.length > 0 ? `
                                    <div class="show-tags">
                                        ${show.tags.map(t => `<span class="show-tag-badge">${escapeHtml(t)}</span>`).join('')}
                                    </div>
                                ` : ''}
                            </td>
                            <td>${show.total_tracks || 0}</td>
                            <td>${formatDuration(show.total_duration)}</td>
                            <td>${formatDate(show.created_date)}</td>
                            <td>
                                <span class="status-${show.is_active ? 'active' : 'inactive'}">
                                    ${show.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td>
                                <div class="action-buttons" data-show-id="${show.id}" data-show-title="${escapeHtml(show.title)}" data-show-status="${show.is_active}">
                                    <button class="btn-edit" data-action="edit">
                                        ✏️ Edit
                                    </button>
                                    <button class="btn-toggle" data-action="toggle">
                                        ${show.is_active ? '⏸️ Pause' : '▶️ Activate'}
                                    </button>
                                    <button class="btn-delete" data-action="delete">
                                        🗑️ Delete
                                    </button>
                                </div>
                            </td>
                        </tr>
                        ${expandedShows.has(show.id) ? renderTracksSection(show.id) : ''}
                    `).join('')}
                </tbody>
            </table>
        `;
    
    container.innerHTML = table;
}

// Render Tracks Section
function renderTracksSection(showId) {
    const show = shows.find(s => s.id === showId);
    if (!show) return '';

            return `
            <tr>
                <td colspan="7">
                    <div class="tracks-section">
                        <div class="tracks-header">
                            <h4>🎵 Tracks in this Episode</h4>
                            <button class="btn-add-track" data-action="add-track" data-show-id="${showId}">
                                ➕ Add Track
                            </button>
                        </div>
                        <div id="tracks-${showId}">
                            <div class="loading">
                                <div class="spinner"></div>
                                <p>Loading tracks...</p>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
}

// Toggle Show Expansion
async function toggleShowExpansion(showId) {
    if (expandedShows.has(showId)) {
        expandedShows.delete(showId);
        // Re-render the table to remove the tracks section
        renderShowsTable();
        // Load tracks for any remaining expanded shows
        for (const expandedShowId of expandedShows) {
            await loadShowTracks(expandedShowId);
        }
    } else {
        expandedShows.add(showId);
        // Re-render the table to create all track containers
        renderShowsTable();
        // Load tracks for all expanded shows
        for (const expandedShowId of expandedShows) {
            await loadShowTracks(expandedShowId);
        }
    }
}

// Load Show Tracks
async function loadShowTracks(showId) {
    console.log(`🎵 Loading tracks for show ${showId}...`);
    const container = document.getElementById(`tracks-${showId}`);
    if (!container) {
        console.error(`❌ Container not found for tracks-${showId}`);
        return;
    }

    try {
        console.log(`📡 Fetching from: ${API_BASE_URL}/api/shows/${showId}`);
        const response = await fetch(`${API_BASE_URL}/api/shows/${showId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch tracks: ${response.status}`);
        }

        const showData = await response.json();
        console.log('📊 Show data received:', showData);
        const tracks = showData.tracks || [];
        console.log(`🎵 Found ${tracks.length} tracks:`, tracks);

        if (tracks.length === 0) {
            container.innerHTML = `
                <p style="text-align: center; color: #666; padding: 20px;">
                    No tracks yet. Add your first track!
                </p>
            `;
            return;
        }

        const tracksTable = `
            <table class="tracks-table">
                <thead>
                    <tr>
                        <th>Track</th>
                        <th>Title</th>
                        <th>Duration</th>
                        <th>File Size</th>
                        <th>Upload Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${tracks.map(track => `
                        <tr>
                            <td>${track.track_order}</td>
                            <td><strong>${escapeHtml(track.title)}</strong></td>
                            <td>${formatDuration(track.duration)}</td>
                            <td>${formatFileSize(track.file_size)}</td>
                            <td>${formatDate(track.upload_date)}</td>
                            <td>
                                <div class="action-buttons" data-show-id="${showId}" data-track-id="${track.id}" data-track-title="${escapeHtml(track.title)}">
                                    <button class="btn-delete" data-action="delete-track">
                                        🗑️
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = tracksTable;
        
    } catch (error) {
        console.error('Error loading tracks:', error);
        container.innerHTML = `
            <div class="error-state">
                <p>Error loading tracks: ${error.message}</p>
                <button data-action="retry-tracks" data-show-id="${showId}">Retry</button>
            </div>
        `;
    }
}

// Setup Event Delegation
function setupEventDelegation() {
    // Handle show row clicks for expansion
    document.addEventListener('click', function(e) {
        const showRow = e.target.closest('.show-row');
        if (showRow && !e.target.closest('.action-buttons')) {
            const showId = parseInt(showRow.dataset.showId);
            toggleShowExpansion(showId);
        }
    });

    // Handle action button clicks
    document.addEventListener('click', function(e) {
        const button = e.target.closest('button');
        if (!button) return;

        const action = button.dataset.action;
        if (!action) return;

        // Actions that live outside .action-buttons (e.g., add-track in header, retry-tracks in error state)
        if (action === 'add-track') {
            const showId = Number(button.dataset.showId);
            addTrackToShow(showId);
            return;
        }
        if (action === 'retry-tracks') {
            const showId = Number(button.dataset.showId);
            loadShowTracks(showId);
            return;
        }

        // Handle buttons that are in action-buttons containers
        const actionButtons = button.closest('.action-buttons');
        if (!actionButtons) return;

        const showId = Number(actionButtons.dataset.showId);
        


        switch (action) {
            case 'edit':
                console.log('✏️ Edit show case executed');
                editShow(showId);
                break;
            case 'toggle':
                console.log('🔄 Toggle show case executed');
                const currentStatus = actionButtons.dataset.showStatus === 'true';
                toggleShowStatus(showId, currentStatus);
                break;
            case 'delete':
                console.log('🗑️ Delete show case executed');
                const showTitle = actionButtons.dataset.showTitle;
                deleteShow(showId, showTitle);
                break;
            case 'restore':
                console.log('🔄 Restore show case executed');
                restoreShow(showId);
                break;
            case 'add-track':
                console.log('➕ Add track case executed');
                addTrackToShow(showId);
                break;
            case 'delete-track':
                console.log('🗑️ Delete track case executed');
                const trackId = parseInt(actionButtons.dataset.trackId);
                const trackTitle = actionButtons.dataset.trackTitle;
                deleteTrack(showId, trackId, trackTitle);
                break;
            case 'retry-tracks':
                console.log('🔄 Retry tracks case executed');
                loadShowTracks(showId);
                break;
            default:
                console.log('❓ Unknown action:', action);
        }
    });
}

// Add Track to Show
function addTrackToShow(showId) {
    console.log('🎵 addTrackToShow called with showId:', showId);
    
    const showIdField = document.getElementById('addTrackShowId');
    const modal = document.getElementById('addTrackModal');
    
    if (!showIdField) {
        console.error('❌ addTrackShowId field not found');
        return;
    }
    
    if (!modal) {
        console.error('❌ addTrackModal not found');
        return;
    }
    
    
    showIdField.value = showId;
    modal.style.display = 'block';
    
    
}

// Close Add Track Modal
function closeAddTrackModal() {
    document.getElementById('addTrackModal').style.display = 'none';
    document.getElementById('addTrackForm').reset();
    document.getElementById('addTrackFilePreview').style.display = 'none';
    document.getElementById('addTrackProgress').style.display = 'none';
}

// Delete Track
async function deleteTrack(showId, trackId, trackTitle) {
    if (confirm(`⚠️ PERMANENT DELETE: Are you sure you want to permanently delete track "${trackTitle}"?\n\nThis will remove the track from the database AND delete the audio file from storage. This action cannot be undone.`)) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/shows/${showId}/tracks/${trackId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`Delete failed: ${response.status}`);
            }

            showStatus('✅ Track permanently deleted from database and storage', 'success');
            
            // Refresh the tracks section for the specific show
            if (expandedShows.has(showId)) {
                // Re-render the table to recreate the tracks container
                renderShowsTable();
                // Then load the updated tracks
                await loadShowTracks(showId);
            }
            
            loadShows();
            loadStats();
            
        } catch (error) {
            console.error('Delete track error:', error);
            showStatus(`❌ Track delete failed: ${error.message}`, 'error');
        }
    }
}

// Edit Show
function editShow(showId) {
    const show = shows.find(s => s.id === showId);
    if (!show) return;

    document.getElementById('editShowId').value = show.id;
    document.getElementById('editTitle').value = show.title;
    document.getElementById('editDescription').value = show.description || '';

    // Populate created date
    if (show.created_date) {
        const dt = new Date(show.created_date);
        const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        document.getElementById('editCreatedDate').value = local;
    }

    // Populate series fields
    document.getElementById('editSeriesSelect').value = show.series_id || '';
    document.getElementById('editEpisodeNumber').value = show.episode_number || '';
    document.getElementById('editEpisodeNumberGroup').style.display = show.series_id ? 'block' : 'none';

    // Populate tags
    clearTags('edit');
    if (show.tags && Array.isArray(show.tags)) {
        show.tags.forEach(tag => addTag('edit', tag));
    }

    document.getElementById('editModal').style.display = 'block';
}

// Close Edit Modal
function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

// Save Edit
document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const showId = document.getElementById('editShowId').value;
    const title = document.getElementById('editTitle').value;
    const description = document.getElementById('editDescription').value;
    const createdDateInput = document.getElementById('editCreatedDate').value;
    const created_date = createdDateInput ? new Date(createdDateInput).toISOString() : undefined;
    const series_id = document.getElementById('editSeriesSelect').value || null;
    const episode_number = document.getElementById('editEpisodeNumber').value || null;

    try {
        const response = await fetch(`${API_BASE_URL}/api/shows/${showId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, description, created_date, tags: getTagsForContext('edit'), series_id, episode_number })
        });

        if (!response.ok) {
            throw new Error(`Update failed: ${response.status}`);
        }

        showStatus('✅ Episode updated successfully', 'success');
        closeEditModal();
        loadShows();
        
    } catch (error) {
        console.error('Update error:', error);
        showStatus(`❌ Update failed: ${error.message}`, 'error');
    }
});

// Toggle Show Status
async function toggleShowStatus(showId, currentStatus) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/shows/${showId}/toggle`, {
            method: 'PUT'
        });

        if (!response.ok) {
            throw new Error(`Toggle failed: ${response.status}`);
        }

        showStatus(`✅ Episode ${currentStatus ? 'paused' : 'activated'} successfully`, 'success');
        
        // Clear expanded shows to prevent spinning wheel issues
        expandedShows.clear();
        await loadShows();
        
    } catch (error) {
        console.error('Toggle error:', error);
        showStatus(`❌ Toggle failed: ${error.message}`, 'error');
    }
}

// Delete Show
function deleteShow(showId, showTitle) {
    currentDeleteId = showId;
    document.getElementById('deleteShowTitle').textContent = showTitle;
    document.getElementById('deleteModal').style.display = 'block';
}

// Close Delete Modal
function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    currentDeleteId = null;
}

// Confirm Delete
async function confirmDelete() {
    if (!currentDeleteId) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/shows/${currentDeleteId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`Delete failed: ${response.status}`);
        }

        showStatus('✅ Episode and all tracks permanently deleted from database and storage', 'success');
        closeDeleteModal();
        expandedShows.clear(); // Clear all expanded shows
        await loadShows();
        await loadStats();
        
    } catch (error) {
        console.error('Delete error:', error);
        showStatus(`❌ Delete failed: ${error.message}`, 'error');
    }
}

// Restore Show
async function restoreShow(showId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/shows/${showId}/restore`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error(`Restore failed: ${response.status}`);
        }

        showStatus('✅ Episode restored successfully', 'success');
        expandedShows.clear(); // Clear all expanded shows
        await loadShows();
        await loadStats();
        // if you ever stop clearing expandedShows, also do: await loadAllExpandedTracks();
        
    } catch (error) {
        console.error('Restore error:', error);
        showStatus(`❌ Restore failed: ${error.message}`, 'error');
    }
}

// Load Background Images
async function loadBackgroundImages() {
    const container = document.getElementById('backgroundImagesContainer');
    
    if (!container) {
        console.error('❌ backgroundImagesContainer not found');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/upload/background-images`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch background images: ${response.status}`);
        }

        const images = await response.json();
        
        if (images.length === 0) {
            container.innerHTML = `
                <h3>Current Background Images</h3>
                <div class="loading">
                    <p>No background images uploaded yet.</p>
                    <p>Upload some JPG images to get started!</p>
                </div>
            `;
            return;
        }

        const imagesHtml = images.map(image => `
            <div class="background-image-card ${image.is_active ? 'background-image-active' : ''}">
                <img src="${image.url}" alt="${image.original_name}" class="background-image-preview">
                <div class="background-image-info">
                    <div class="background-image-name">${image.original_name}</div>
                    <div class="background-image-meta">
                        ${(image.file_size / 1024 / 1024).toFixed(2)} MB • 
                        Uploaded: ${new Date(image.upload_date).toLocaleDateString()}
                    </div>
                    <div class="background-image-actions">
                        <button class="btn-toggle ${image.is_active ? 'btn-toggle-active' : 'btn-toggle-inactive'}" 
                                onclick="toggleBackgroundImage(${image.id}, ${image.is_active})">
                            ${image.is_active ? 'De-activate' : 'Make active'}
                        </button>
                        <button class="btn-delete" onclick="deleteBackgroundImage(${image.id}, '${image.original_name}')">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <h3>Current Background Images</h3>
            <div class="background-images-grid">
                ${imagesHtml}
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading background images:', error);
        container.innerHTML = `
            <h3>Current Background Images</h3>
            <div class="loading">
                <p>❌ Error loading background images: ${error.message}</p>
            </div>
        `;
    }
}

// Load Pages
async function loadPages() {
    const container = document.getElementById('pagesContainer');

    if (!container) {
        console.error('❌ pagesContainer not found');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/pages`);

        if (!response.ok) {
            throw new Error(`Failed to fetch pages: ${response.status}`);
        }

        const pages = await response.json();

        const pageLabels = {
            live_label: 'Live Stream Label',
            about: 'About',
            events: 'Events',
            contact: 'Contact'
        };

        // Sort so live_label appears first
        pages.sort((a, b) => {
            if (a.page_name === 'live_label') return -1;
            if (b.page_name === 'live_label') return 1;
            return 0;
        });

        const pagesHtml = pages.map(page => {
            const isLiveLabel = page.page_name === 'live_label';
            const inputHtml = isLiveLabel
                ? `<input
                    type="text"
                    id="page-content-${page.page_name}"
                    style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 14px; font-family: Helvetica, Arial, sans-serif;"
                    placeholder="e.g. LIVE NOW: DJ TRUE FACE PRESENTS:"
                    value="${escapeHtml(page.content || '')}"
                  />
                  <small style="display: block; margin-top: 8px; color: #666;">
                    This text replaces "LIVE NOW" on the main page and in the ticker when the stream is live. Default: LIVE NOW
                  </small>`
                : `<textarea
                    id="page-content-${page.page_name}"
                    style="width: 100%; height: 200px; padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 14px; font-family: Helvetica, Arial, sans-serif; resize: vertical;"
                    placeholder="Enter content for ${pageLabels[page.page_name] || page.page_name} page..."
                  >${escapeHtml(page.content || '')}</textarea>`;

            return `
            <div class="page-content-card" style="margin-bottom: 30px; padding: 25px; border: 1px solid black;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0;">${pageLabels[page.page_name] || page.page_name}</h3>
                    <span style="font-size: 12px; color: #666;">
                        Last updated: ${page.updated_at ? new Date(page.updated_at).toLocaleString() : 'Never'}
                    </span>
                </div>
                <div class="form-group" style="margin-bottom: 15px;">
                    ${inputHtml}
                </div>
                <button
                    class="upload-button"
                    onclick="savePage('${page.page_name}')"
                    id="save-btn-${page.page_name}"
                >
                    Save ${pageLabels[page.page_name] || page.page_name}
                </button>
            </div>
            `;
        }).join('');

        container.innerHTML = pagesHtml;

    } catch (error) {
        console.error('Error loading pages:', error);
        container.innerHTML = `
            <div class="loading">
                <p>❌ Error loading pages: ${error.message}</p>
                <button onclick="loadPages()" class="upload-button" style="margin-top: 15px;">Retry</button>
            </div>
        `;
    }
}

// Save Page Content
async function savePage(pageName) {
    const textarea = document.getElementById(`page-content-${pageName}`);
    const saveBtn = document.getElementById(`save-btn-${pageName}`);

    if (!textarea) {
        showStatus(`❌ Could not find content for ${pageName}`, 'error');
        return;
    }

    const content = textarea.value;

    // Disable button while saving
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/pages/${pageName}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to save ${pageName}`);
        }

        const result = await response.json();
        showStatus(`✅ ${pageName.charAt(0).toUpperCase() + pageName.slice(1)} page saved successfully`, 'success');

        // Reload pages to show updated timestamp
        await loadPages();

    } catch (error) {
        console.error(`Error saving ${pageName}:`, error);
        showStatus(`❌ Failed to save ${pageName}: ${error.message}`, 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = `Save ${pageName.charAt(0).toUpperCase() + pageName.slice(1)}`;
        }
    }
}

// Load Statistics
async function loadStats() {
    const container = document.getElementById('statsContainer');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/shows/admin`);
        if (!response.ok) {
            throw new Error(`Failed to fetch stats: ${response.status}`);
        }

        const showsData = await response.json();
        
        const totalShows = showsData.length;
        const activeShows = showsData.filter(s => s.is_active).length;
        const totalTracks = showsData.reduce((sum, s) => sum + (s.track_count || 0), 0);
        const totalDuration = showsData.reduce((sum, s) => sum + (s.total_duration || 0), 0);
        
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                <div style="background: #e3f2fd; padding: 20px; border-radius: 10px; text-align: center;">
                    <h3 style="color: #1976d2; font-size: 2rem;">${totalShows}</h3>
                    <p>Total Episodes</p>
                </div>
                <div style="background: #e8f5e8; padding: 20px; border-radius: 10px; text-align: center;">
                    <h3 style="color: #388e3c; font-size: 2rem;">${activeShows}</h3>
                    <p>Active Episodes</p>
                </div>
                <div style="background: #fff3e0; padding: 20px; border-radius: 10px; text-align: center;">
                    <h3 style="color: #f57c00; font-size: 2rem;">${totalTracks}</h3>
                    <p>Total Tracks</p>
                </div>
                <div style="background: #fce4ec; padding: 20px; border-radius: 10px; text-align: center;">
                    <h3 style="color: #c2185b; font-size: 2rem;">${formatDuration(totalDuration)}</h3>
                    <p>Total Duration</p>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading stats:', error);
        container.innerHTML = `
            <div class="error-state">
                <p>Error loading statistics: ${error.message}</p>
                <button onclick="loadStats()">Retry</button>
            </div>
        `;
    }
}

// Extract track order number from filename (e.g., "03 - Song.mp3" -> 3, "Song.mp3" -> null)
function extractTrackOrderFromFilename(filename) {
    const name = filename.replace(/\.[^/.]+$/, '');
    const match = name.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

// Extract track name from filename (frontend preview - matches backend logic)
function extractTrackNameFromFilename(filename) {
    // Remove file extension
    let trackName = filename.replace(/\.[^/.]+$/, '');
    
    // Replace underscores with spaces (but keep hyphens, colons, parentheses, brackets)
    trackName = trackName.replace(/_/g, ' ');
    
    // Remove leading numbers and optional separators (e.g., "01 - ", "01-", "01.")
    trackName = trackName.replace(/^\d+\s*[-.\s]*\s*/g, '');
    
    // Clean up multiple spaces (but preserve single spaces around preserved characters)
    trackName = trackName.replace(/\s+/g, ' ').trim();
    
    // Capitalize first letter of each word (but preserve special characters)
    // Split by spaces, but be careful with words that contain preserved characters
    trackName = trackName.split(' ').map(word => {
        // Skip capitalization if word is empty or just special characters
        if (!word || /^[-:()\[\]]+$/.test(word)) {
            return word;
        }
        // Capitalize first letter, keep the rest as-is to preserve special characters
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
    
    // If empty after cleaning, use the original filename without extension
    if (!trackName) {
        trackName = filename.replace(/\.[^/.]+$/, '');
    }
    
    return trackName;
}

// Utility Functions
function showStatus(message, type) {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 5000);
}

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Render description text with [text](url) markdown links converted to <a> tags
function renderDescriptionWithLinks(text) {
    if (!text) return 'No description';
    const escaped = escapeHtml(text);
    return escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: underline;">$1</a>'
    );
}

// Paste-to-link: if text is selected in a textarea and a URL is pasted, wrap selection as markdown link
function setupPasteToLink(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    textarea.addEventListener('paste', function(e) {
        const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
        if (!selected) return; // No selection, let normal paste happen
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        if (!pasted.match(/^https?:\/\//)) return; // Not a URL, let normal paste happen
        e.preventDefault();
        const before = textarea.value.substring(0, textarea.selectionStart);
        const after = textarea.value.substring(textarea.selectionEnd);
        const link = '[' + selected + '](' + pasted + ')';
        textarea.value = before + link + after;
        const newPos = before.length + link.length;
        textarea.selectionStart = newPos;
        textarea.selectionEnd = newPos;
    });
}

// Toggle background image active status
async function toggleBackgroundImage(imageId, currentStatus) {
    const newStatus = !currentStatus;
    const action = newStatus ? 'activate' : 'deactivate';
    
    try {
        showStatus(`🔄 ${action === 'activate' ? 'Activating' : 'Deactivating'} background image...`, 'info');
        
        const response = await fetch(`${API_BASE_URL}/api/upload/background/${imageId}/toggle`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_active: newStatus })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to ${action} background image`);
        }
        
        // Reload background images to reflect the changes
        await loadBackgroundImages();
        showStatus(`✅ Background image ${action}d successfully`, 'success');
        
    } catch (error) {
        console.error(`Error ${action}ing background image:`, error);
        showStatus(`❌ Background image ${action} failed: ${error.message}`, 'error');
    }
}

// Delete background image
async function deleteBackgroundImage(imageId, imageName) {
    if (confirm(`⚠️ PERMANENT DELETE: Are you sure you want to permanently delete background image "${imageName}"?\n\nThis will remove the image from the database AND delete the file from storage. This action cannot be undone.`)) {
        try {
            showStatus('🔄 Deleting background image...', 'info');
            
            const response = await fetch(`${API_BASE_URL}/api/upload/background/${imageId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete background image');
            }
            
            // Reload background images to reflect the deletion
            await loadBackgroundImages();
            showStatus('✅ Background image permanently deleted from database and storage', 'success');
            
        } catch (error) {
            console.error('Error deleting background image:', error);
            showStatus(`❌ Background image delete failed: ${error.message}`, 'error');
        }
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    const editModal = document.getElementById('editModal');
    const deleteModal = document.getElementById('deleteModal');
    const addTrackModal = document.getElementById('addTrackModal');
    
    if (event.target === editModal) {
        closeEditModal();
    }
    if (event.target === deleteModal) {
        closeDeleteModal();
    }
    if (event.target === addTrackModal) {
        closeAddTrackModal();
    }
}

// Close modals with close button
document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.onclick = function() {
        closeEditModal();
        closeDeleteModal();
        closeAddTrackModal();
    }
});

// ========== Tag Management ==========

// Store tags per context (keyed by 'createShow' or 'edit')
const tagState = {
    createShow: [],
    edit: []
};

// All known tags from the database (for autocomplete)
let allKnownTags = [];

// Fetch all known tags from server
async function loadAllTags() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/shows/tags/all`);
        if (response.ok) {
            allKnownTags = await response.json();
        }
    } catch (e) {
        console.error('Error loading tags:', e);
    }
}

// Load tags on page init
loadAllTags();

// Get current tags for a context
function getTagsForContext(context) {
    return tagState[context] || [];
}

// Clear all tags for a context
function clearTags(context) {
    tagState[context] = [];
    renderTagPills(context);
}

// Add a tag to a context
function addTag(context, tagName) {
    const trimmed = tagName.trim().toLowerCase();
    if (!trimmed) return;
    if (tagState[context].includes(trimmed)) return; // no duplicates

    tagState[context].push(trimmed);
    renderTagPills(context);

    // Add to known tags if new
    if (!allKnownTags.includes(trimmed)) {
        allKnownTags.push(trimmed);
        allKnownTags.sort();
    }
}

// Remove a tag from a context
function removeTag(context, tagName) {
    tagState[context] = tagState[context].filter(t => t !== tagName);
    renderTagPills(context);
}

// Render tag pills for a context
function renderTagPills(context) {
    const pillsContainer = document.getElementById(`${context}TagPills`);
    if (!pillsContainer) return;

    pillsContainer.innerHTML = tagState[context].map(tag =>
        `<span class="tag-pill">${escapeHtml(tag)}<span class="tag-remove" onclick="removeTag('${context}', '${escapeHtml(tag)}')">&times;</span></span>`
    ).join('');
}

// Add tag from the input field (supports comma-separated tags)
function addTagFromInput(context) {
    const input = document.getElementById(`${context}TagInput`);
    if (!input) return;

    const tags = input.value.split(',').map(t => t.trim()).filter(Boolean);
    tags.forEach(tag => addTag(context, tag));
    input.value = '';
    hideSuggestions(context);
}

// Show autocomplete suggestions
function showSuggestions(context, query) {
    const suggestionsContainer = document.getElementById(`${context}TagSuggestions`);
    if (!suggestionsContainer) return;

    const q = query.trim().toLowerCase();
    if (!q) {
        hideSuggestions(context);
        return;
    }

    const currentTags = tagState[context];
    const matches = allKnownTags.filter(t => t.includes(q) && !currentTags.includes(t));

    if (matches.length === 0) {
        hideSuggestions(context);
        return;
    }

    suggestionsContainer.innerHTML = `
        <div class="tag-suggestions-list">
            ${matches.slice(0, 8).map(tag =>
                `<div class="tag-suggestion-item" onclick="addTag('${context}', '${escapeHtml(tag)}'); document.getElementById('${context}TagInput').value = ''; hideSuggestions('${context}');">${escapeHtml(tag)}</div>`
            ).join('')}
        </div>
    `;
}

// Hide suggestions
function hideSuggestions(context) {
    const suggestionsContainer = document.getElementById(`${context}TagSuggestions`);
    if (suggestionsContainer) {
        suggestionsContainer.innerHTML = '';
    }
}

// Setup tag input event listeners
function setupTagInput(context) {
    const input = document.getElementById(`${context}TagInput`);
    if (!input) return;

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTagFromInput(context);
        }
    });

    input.addEventListener('input', (e) => {
        showSuggestions(context, e.target.value);
    });

    input.addEventListener('blur', () => {
        // Delay to allow click on suggestion
        setTimeout(() => hideSuggestions(context), 200);
    });
}

// Initialize tag inputs
setupTagInput('createShow');
setupTagInput('edit');

// ========== Series Management ==========

// Load series list for dropdowns
async function loadSeriesList() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/series/admin`);
        if (!response.ok) throw new Error(`Failed to fetch series: ${response.status}`);
        allSeries = await response.json();
        populateSeriesDropdowns();
        return allSeries;
    } catch (error) {
        console.error('Error loading series:', error);
        return [];
    }
}

// Populate series dropdowns on create and edit forms
function populateSeriesDropdowns() {
    const selects = [
        document.getElementById('seriesSelect'),
        document.getElementById('editSeriesSelect')
    ];

    selects.forEach(select => {
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">-- Standalone Episode --</option>';
        allSeries.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.title;
            select.appendChild(opt);
        });
        select.value = currentValue;
    });
}

// Setup series select change handlers (show/hide episode number)
function setupSeriesSelect() {
    const seriesSelect = document.getElementById('seriesSelect');
    const epGroup = document.getElementById('episodeNumberGroup');
    const epInput = document.getElementById('episodeNumber');

    if (seriesSelect) {
        seriesSelect.addEventListener('change', async () => {
            if (seriesSelect.value) {
                epGroup.style.display = 'block';
                try {
                    const resp = await fetch(`${API_BASE_URL}/api/series/${seriesSelect.value}/next-episode`);
                    if (resp.ok) {
                        const data = await resp.json();
                        epInput.placeholder = `Auto: ${data.next_episode}`;
                        epInput.value = '';
                    }
                } catch (e) { /* ignore */ }
            } else {
                epGroup.style.display = 'none';
                epInput.value = '';
            }
        });
    }

    const editSeriesSelect = document.getElementById('editSeriesSelect');
    const editEpGroup = document.getElementById('editEpisodeNumberGroup');
    if (editSeriesSelect) {
        editSeriesSelect.addEventListener('change', () => {
            editEpGroup.style.display = editSeriesSelect.value ? 'block' : 'none';
        });
    }
}

// Setup create series form
function setupCreateSeriesForm() {
    const form = document.getElementById('createSeriesForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('seriesTitle').value.trim();
        const description = document.getElementById('seriesDescription').value.trim();

        if (!title) {
            showStatus('Show title is required', 'error');
            return;
        }

        const btn = document.getElementById('createSeriesBtn');
        btn.disabled = true;
        btn.textContent = 'Creating...';

        try {
            const response = await fetch(`${API_BASE_URL}/api/series`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, description })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to create show');
            }

            const result = await response.json();

            // Upload cover image if selected
            const coverInput = document.getElementById('seriesCoverImage');
            if (coverInput.files.length > 0) {
                btn.textContent = 'Uploading cover...';
                const formData = new FormData();
                formData.append('image', coverInput.files[0]);
                const coverResp = await fetch(`${API_BASE_URL}/api/series/${result.id}/cover`, {
                    method: 'POST',
                    body: formData
                });
                if (!coverResp.ok) {
                    showStatus(`Show created but cover upload failed`, 'error');
                } else {
                    showStatus(`Created show "${result.title}" with cover`, 'success');
                }
            } else {
                showStatus(`Created show "${result.title}"`, 'success');
            }

            form.reset();
            await loadSeriesList();
            loadSeriesManagement();

        } catch (error) {
            console.error('Show creation error:', error);
            showStatus(`Failed to create show: ${error.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create Show';
        }
    });
}

// Render series management list in the Series tab
async function loadSeriesManagement() {
    const container = document.getElementById('seriesListContainer');
    if (!container) return;

    try {
        const series = await loadSeriesList();
        if (series.length === 0) {
            container.innerHTML = '<p>No shows created yet.</p>';
            return;
        }

        container.innerHTML = `
            <h3>Existing Shows</h3>
            <table class="shows-table">
                <thead><tr>
                    <th>Cover</th><th>Title</th><th>Description</th><th>Episodes</th><th>Actions</th>
                </tr></thead>
                <tbody>
                    ${series.map(s => `
                        <tr>
                            <td style="width: 80px;">
                                ${s.cover_image_url
                                    ? `<img src="${s.cover_image_url}" style="width: 60px; height: 60px; object-fit: cover; object-position: ${s.cover_position || '50% 50%'}; border: 1px solid #ddd;">`
                                    : `<span style="display: inline-block; width: 60px; height: 60px; background: #f0f0f0; border: 1px solid #ddd; text-align: center; line-height: 60px; font-size: 11px; color: #999;">No cover</span>`
                                }
                            </td>
                            <td><strong>${escapeHtml(s.title)}</strong></td>
                            <td>${escapeHtml(s.description || '')}</td>
                            <td>${s.episode_count || 0}</td>
                            <td>
                                <div class="action-buttons">
                                    <button class="btn-edit" onclick="editSeries(${s.id})">Edit</button>
                                    <label class="btn-edit" style="cursor: pointer;">Cover <input type="file" accept="image/jpeg,image/png,image/webp" style="display:none;" onchange="uploadSeriesCover(${s.id}, this)"></label>
                                    ${s.cover_image ? `<button class="btn-edit" onclick="openRepositionModal(${s.id})">Adjust</button>` : ''}
                                    ${s.cover_image ? `<button class="btn-delete" onclick="removeSeriesCover(${s.id})">Remove Cover</button>` : ''}
                                    <button class="btn-delete" onclick="deleteSeries(${s.id}, '${escapeHtml(s.title).replace(/'/g, "\\'")}')">Delete</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        container.innerHTML = `<p>Error loading shows: ${error.message}</p>`;
    }
}

// Edit series
function editSeries(seriesId) {
    const series = allSeries.find(s => s.id === seriesId);
    if (!series) return;

    const newTitle = prompt('Show title:', series.title);
    if (newTitle === null) return;
    const newDescription = prompt('Show description:', series.description || '');
    if (newDescription === null) return;

    fetch(`${API_BASE_URL}/api/series/${seriesId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, description: newDescription })
    })
    .then(resp => {
        if (!resp.ok) throw new Error('Failed to update show');
        return resp.json();
    })
    .then(() => {
        showStatus('Show updated', 'success');
        loadSeriesList();
        loadSeriesManagement();
    })
    .catch(err => showStatus(`Failed to update show: ${err.message}`, 'error'));
}

// Delete series
function deleteSeries(seriesId, seriesTitle) {
    if (!confirm(`Delete show "${seriesTitle}"? Episodes will become standalone.`)) return;

    fetch(`${API_BASE_URL}/api/series/${seriesId}`, { method: 'DELETE' })
    .then(resp => {
        if (!resp.ok) throw new Error('Failed to delete show');
        return resp.json();
    })
    .then(() => {
        showStatus('Show deleted, episodes are now standalone', 'success');
        loadSeriesList();
        loadSeriesManagement();
        loadShows();
    })
    .catch(err => showStatus(`Failed to delete show: ${err.message}`, 'error'));
}

// Upload cover image for an existing series
async function uploadSeriesCover(seriesId, input) {
    if (!input.files.length) return;
    const formData = new FormData();
    formData.append('image', input.files[0]);
    try {
        const resp = await fetch(`${API_BASE_URL}/api/series/${seriesId}/cover`, {
            method: 'POST',
            body: formData
        });
        if (!resp.ok) throw new Error('Upload failed');
        showStatus('Cover image uploaded', 'success');
        loadSeriesManagement();
    } catch (err) {
        showStatus(`Failed to upload cover: ${err.message}`, 'error');
    }
}

// Remove cover image from a series
async function removeSeriesCover(seriesId) {
    if (!confirm('Remove cover image?')) return;
    try {
        const resp = await fetch(`${API_BASE_URL}/api/series/${seriesId}/cover`, { method: 'DELETE' });
        if (!resp.ok) throw new Error('Delete failed');
        showStatus('Cover image removed', 'success');
        loadSeriesManagement();
    } catch (err) {
        showStatus(`Failed to remove cover: ${err.message}`, 'error');
    }
}

// ─── Cover Reposition Modal ───
let repositionSeriesId = null;
let repositionDragging = false;
let repositionStartX = 0;
let repositionStartY = 0;
let repositionOffsetX = 0;
let repositionOffsetY = 0;
let repositionImgWidth = 0;
let repositionImgHeight = 0;
const VIEWPORT_SIZE = 300;

function openRepositionModal(seriesId) {
    const series = allSeries.find(s => s.id === seriesId);
    if (!series || !series.cover_image_url) return;

    repositionSeriesId = seriesId;
    const modal = document.getElementById('repositionModal');
    const img = document.getElementById('repositionImage');
    const viewport = document.getElementById('repositionViewport');

    img.onload = function() {
        // Size image to fill the viewport (same as background-size: cover)
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const vpRatio = 1; // square viewport
        if (imgRatio > vpRatio) {
            // Image is wider — height fills viewport, width overflows
            repositionImgHeight = VIEWPORT_SIZE;
            repositionImgWidth = VIEWPORT_SIZE * imgRatio;
        } else {
            // Image is taller — width fills viewport, height overflows
            repositionImgWidth = VIEWPORT_SIZE;
            repositionImgHeight = VIEWPORT_SIZE / imgRatio;
        }
        img.style.width = repositionImgWidth + 'px';
        img.style.height = repositionImgHeight + 'px';

        // Parse saved position and convert to pixel offset
        const pos = (series.cover_position || '50% 50%').split(/\s+/);
        const pctX = parseFloat(pos[0]) / 100;
        const pctY = parseFloat(pos[1]) / 100;
        // background-position % formula: offset = pct * (container - image)
        // Since image >= container, (container - image) is <= 0
        repositionOffsetX = pctX * (VIEWPORT_SIZE - repositionImgWidth);
        repositionOffsetY = pctY * (VIEWPORT_SIZE - repositionImgHeight);
        img.style.left = repositionOffsetX + 'px';
        img.style.top = repositionOffsetY + 'px';
    };
    img.src = series.cover_image_url;
    modal.style.display = 'flex';

    // Mouse events
    viewport.onmousedown = function(e) {
        e.preventDefault();
        repositionDragging = true;
        repositionStartX = e.clientX - repositionOffsetX;
        repositionStartY = e.clientY - repositionOffsetY;
        viewport.style.cursor = 'grabbing';
    };
    document.onmousemove = function(e) {
        if (!repositionDragging) return;
        let newX = e.clientX - repositionStartX;
        let newY = e.clientY - repositionStartY;
        // Clamp so image always fills viewport
        newX = Math.min(0, Math.max(VIEWPORT_SIZE - repositionImgWidth, newX));
        newY = Math.min(0, Math.max(VIEWPORT_SIZE - repositionImgHeight, newY));
        repositionOffsetX = newX;
        repositionOffsetY = newY;
        img.style.left = newX + 'px';
        img.style.top = newY + 'px';
    };
    document.onmouseup = function() {
        repositionDragging = false;
        viewport.style.cursor = 'grab';
    };

    // Touch events
    viewport.ontouchstart = function(e) {
        e.preventDefault();
        repositionDragging = true;
        const touch = e.touches[0];
        repositionStartX = touch.clientX - repositionOffsetX;
        repositionStartY = touch.clientY - repositionOffsetY;
    };
    document.ontouchmove = function(e) {
        if (!repositionDragging) return;
        const touch = e.touches[0];
        let newX = touch.clientX - repositionStartX;
        let newY = touch.clientY - repositionStartY;
        newX = Math.min(0, Math.max(VIEWPORT_SIZE - repositionImgWidth, newX));
        newY = Math.min(0, Math.max(VIEWPORT_SIZE - repositionImgHeight, newY));
        repositionOffsetX = newX;
        repositionOffsetY = newY;
        img.style.left = newX + 'px';
        img.style.top = newY + 'px';
    };
    document.ontouchend = function() {
        repositionDragging = false;
    };
}

function closeRepositionModal() {
    document.getElementById('repositionModal').style.display = 'none';
    repositionSeriesId = null;
    repositionDragging = false;
    document.onmousemove = null;
    document.onmouseup = null;
    document.ontouchmove = null;
    document.ontouchend = null;
}

async function saveRepositionPosition() {
    if (!repositionSeriesId) return;

    // Convert pixel offset back to background-position percentages
    const rangeX = VIEWPORT_SIZE - repositionImgWidth;
    const rangeY = VIEWPORT_SIZE - repositionImgHeight;
    const pctX = rangeX === 0 ? 50 : Math.round((repositionOffsetX / rangeX) * 100);
    const pctY = rangeY === 0 ? 50 : Math.round((repositionOffsetY / rangeY) * 100);
    const position = `${pctX}% ${pctY}%`;

    try {
        const resp = await fetch(`${API_BASE_URL}/api/series/${repositionSeriesId}/cover-position`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position })
        });
        if (!resp.ok) throw new Error('Failed to save position');
        showStatus('Thumbnail position saved', 'success');
        closeRepositionModal();
        loadSeriesManagement();
    } catch (err) {
        showStatus(`Failed to save position: ${err.message}`, 'error');
    }
}
