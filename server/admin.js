// Glue Factory Radio Admin Portal JavaScript
const API_BASE_URL = 'https://glue-factory-radio-production.up.railway.app';

// Global variables
let shows = [];
let currentDeleteId = null;

// Initialize admin portal
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎵 Admin portal loaded');
    setupTabNavigation();
    setupUploadForm();
    loadShows();
    loadStats();
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
            } else if (targetTab === 'stats') {
                loadStats();
            }
        });
    });
}

// Upload Form
function setupUploadForm() {
    const form = document.getElementById('uploadForm');
    const uploadBtn = document.getElementById('uploadBtn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const title = formData.get('title');
        const description = formData.get('description');
        const audioFile = formData.get('audio');

        if (!title.trim()) {
            showStatus('Please enter a title', 'error');
            return;
        }

        if (!audioFile || audioFile.size === 0) {
            showStatus('Please select an audio file', 'error');
            return;
        }

        // Disable upload button and show loading
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';

        try {
            const response = await fetch(`${API_BASE_URL}/api/upload/audio`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Upload failed: ${response.status}`);
            }

            const result = await response.json();
            showStatus(`✅ Successfully uploaded: ${result.show.title}`, 'success');
            
            // Reset form
            form.reset();
            
            // Refresh shows list
            loadShows();
            loadStats();
            
        } catch (error) {
            console.error('Upload error:', error);
            showStatus(`❌ Upload failed: ${error.message}`, 'error');
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload Show';
        }
    });
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
                <p>Upload your first show/episode to get started!</p>
            </div>
        `;
        return;
    }

    const table = `
        <table class="shows-table">
            <thead>
                <tr>
                    <th>Title</th>
                    <th>Description</th>
                    <th>Duration</th>
                    <th>File Size</th>
                    <th>Upload Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${shows.map(show => `
                    <tr>
                        <td><strong>${escapeHtml(show.title)}</strong></td>
                        <td>${escapeHtml(show.description || 'No description')}</td>
                        <td>${formatDuration(show.duration)}</td>
                        <td>${formatFileSize(show.file_size)}</td>
                        <td>${formatDate(show.upload_date)}</td>
                        <td>
                            <span class="status-${show.is_active ? 'active' : 'inactive'}">
                                ${show.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn-edit" onclick="editShow(${show.id})">
                                    ✏️ Edit
                                </button>
                                <button class="btn-toggle" onclick="toggleShowStatus(${show.id}, ${show.is_active})">
                                    ${show.is_active ? '⏸️ Pause' : '▶️ Activate'}
                                </button>
                                <button class="btn-delete" onclick="deleteShow(${show.id}, '${escapeHtml(show.title)}')">
                                    🗑️ Delete
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = table;
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
        loadShows();
        
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

        showStatus('✅ Show deleted successfully', 'success');
        closeDeleteModal();
        loadShows();
        loadStats();
        
    } catch (error) {
        console.error('Delete error:', error);
        showStatus(`❌ Delete failed: ${error.message}`, 'error');
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
        const totalDuration = showsData.reduce((sum, s) => sum + (s.duration || 0), 0);
        const totalSize = showsData.reduce((sum, s) => sum + (s.file_size || 0), 0);
        
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
                    <h3 style="color: #f57c00; font-size: 2rem;">${formatDuration(totalDuration)}</h3>
                    <p>Total Duration</p>
                </div>
                <div style="background: #fce4ec; padding: 20px; border-radius: 10px; text-align: center;">
                    <h3 style="color: #c2185b; font-size: 2rem;">${formatFileSize(totalSize)}</h3>
                    <p>Total Size</p>
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
    
    if (event.target === editModal) {
        closeEditModal();
    }
    if (event.target === deleteModal) {
        closeDeleteModal();
    }
}

// Close modals with close button
document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.onclick = function() {
        closeEditModal();
        closeDeleteModal();
    }
});
