// Glue Factory Radio Admin Portal JavaScript
const API_BASE_URL = window.location.origin; // Use the same domain as the admin interface

// Global variables
let shows = [];
let currentDeleteId = null;
let expandedShows = new Set();

// Initialize admin portal
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎵 Admin portal loaded');
    setupTabNavigation();
    setupUploadForm();
    setupAddTrackForm();
    setupEventDelegation();
    loadShows();
    loadStats();
});



// Tab Navigation
function setupTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    console.log('🎯 Setting up tab navigation. Found tabs:', tabs.length, 'Found tab contents:', tabContents.length);

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            console.log('🎯 Tab clicked:', targetTab);
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show target content
            tabContents.forEach(content => {
                console.log('🎯 Checking content:', content.id, 'vs target:', targetTab);
                content.classList.remove('active');
                if (content.id === targetTab) {
                    content.classList.add('active');
                    console.log('🎯 Showing tab content:', content.id);
                    console.log('🎯 Content element:', content);
                    console.log('🎯 Content classes:', content.className);
                    console.log('🎯 Content style display:', content.style.display);
                }
            });

            // Load data for the tab
            if (targetTab === 'manage') {
                console.log('🎯 Loading shows...');
                loadShows();
            } else if (targetTab === 'backgrounds') {
                console.log('🎯 Loading background images...');
                loadBackgroundImages();
            } else if (targetTab === 'stats') {
                console.log('🎯 Loading stats...');
                loadStats();
            }
        });
    });
}

// Upload Form - Create New Show
function setupUploadForm() {
    const form = document.getElementById('uploadForm');
    const uploadBtn = document.getElementById('uploadBtn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const title = formData.get('title');
        const description = formData.get('description');
        const trackTitle = formData.get('trackTitle');
        const audioFile = formData.get('audio');

        if (!title.trim()) {
            showStatus('Please enter a show title', 'error');
            return;
        }

        if (!trackTitle.trim()) {
            showStatus('Please enter a track title', 'error');
            return;
        }

        if (!audioFile || audioFile.size === 0) {
            showStatus('Please select an audio file', 'error');
            return;
        }

        // Disable upload button and show loading
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Creating Show...';

        try {
            const response = await fetch(`${API_BASE_URL}/api/upload/show`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Show creation failed: ${response.status}`);
            }

            const result = await response.json();
            showStatus(`✅ Successfully created show: ${result.show.title}`, 'success');
            
            // Reset form
            form.reset();
            
            // Refresh shows list
            loadShows();
            loadStats();
            
        } catch (error) {
            console.error('Show creation error:', error);
            showStatus(`❌ Show creation failed: ${error.message}`, 'error');
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Create Show';
        }
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
    const submitBtn = form.querySelector('button[type="submit"]');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        console.log('🎵 Add Track form submitted');
        
        const formData = new FormData(form);
        const showId = formData.get('showId');
        const title = formData.get('title');
        const audioFile = formData.get('audio');

        console.log('📊 Form data:', { showId, title, audioFile: audioFile ? audioFile.name : 'none' });

        if (!showId) {
            showStatus('❌ Show ID is missing', 'error');
            return;
        }

        if (!title.trim()) {
            showStatus('Please enter a track title', 'error');
            return;
        }

        if (!audioFile || audioFile.size === 0) {
            showStatus('Please select an audio file', 'error');
            return;
        }

        // prevent double submit
        if (submitBtn) { 
            submitBtn.disabled = true; 
            submitBtn.textContent = 'Uploading...'; 
        }

        try {
            console.log('📡 Sending request to:', `${API_BASE_URL}/api/upload/track`);
            console.log('📁 FormData contents:', {
                showId: formData.get('showId'),
                title: formData.get('title'),
                audioFile: formData.get('audio') ? formData.get('audio').name : 'none'
            });

            const response = await fetch(`${API_BASE_URL}/api/upload/track`, {
                method: 'POST',
                body: formData
            });

            console.log('📡 Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Track upload failed: ${response.status}`);
            }

            const result = await response.json();
            showStatus(`✅ Successfully added track: ${result.track.title}`, 'success');
            
            // Reset form and close modal
            form.reset();
            closeAddTrackModal();
            
            // Refresh and refill expanded rows so the spinner disappears
            await loadShows();
            await loadStats();
            const showIdNum = Number(formData.get('showId'));
            if (expandedShows.has(showIdNum)) {
                await loadShowTracks(showIdNum);
            }
            
        } catch (error) {
            console.error('Track upload error:', error);
            showStatus(`❌ Track upload failed: ${error.message}`, 'error');
        } finally {
            if (submitBtn) { 
                submitBtn.disabled = false; 
                submitBtn.textContent = 'Add Track'; 
            }
        }
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
                <p>Loading shows...</p>
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
                <p>Error loading shows: ${error.message}</p>
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
                <h3>No Shows Yet</h3>
                <p>Create your first show to get started!</p>
            </div>
        `;
        return;
    }

            const table = `
            <table class="shows-table">
                <thead>
                    <tr>
                        <th>Show Title</th>
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
                            </td>
                            <td>${escapeHtml(show.description || 'No description')}</td>
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
                                    ${show.is_active ? 
                                        `<button class="btn-delete" data-action="delete">
                                            🗑️ Delete
                                        </button>` :
                                        `<button class="btn-restore" data-action="restore">
                                            🔄 Restore
                                        </button>`
                                    }
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
                            <h4>🎵 Tracks in this Show</h4>
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

    try {
        const response = await fetch(`${API_BASE_URL}/api/shows/${showId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, description })
        });

        if (!response.ok) {
            throw new Error(`Update failed: ${response.status}`);
        }

        showStatus('✅ Show updated successfully', 'success');
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

        showStatus(`✅ Show ${currentStatus ? 'paused' : 'activated'} successfully`, 'success');
        
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

        showStatus('✅ Show and all tracks permanently deleted from database and storage', 'success');
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

        showStatus('✅ Show restored successfully', 'success');
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
    console.log('🖼️ loadBackgroundImages called');
    const container = document.getElementById('backgroundImagesContainer');
    
    if (!container) {
        console.error('❌ backgroundImagesContainer not found');
        return;
    }
    
    console.log('🖼️ Container found, fetching images...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/upload/background-images`);
        console.log('🖼️ Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch background images: ${response.status}`);
        }

        const images = await response.json();
        console.log('🖼️ Images received:', images.length);
        
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
            <div class="background-image-card">
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
                            ${image.is_active ? 'Active' : 'Inactive'}
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
                    <p>Total Shows</p>
                </div>
                <div style="background: #e8f5e8; padding: 20px; border-radius: 10px; text-align: center;">
                    <h3 style="color: #388e3c; font-size: 2rem;">${activeShows}</h3>
                    <p>Active Shows</p>
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
