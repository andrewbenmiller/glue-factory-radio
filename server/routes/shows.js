const express = require('express');
const router = express.Router();
const db = require('../config/database');
const fs = require('fs');
const path = require('path');

// GET all shows (admin endpoint - includes inactive)
router.get('/admin', (req, res) => {
  const query = `
    SELECT s.*, st.filename, st.duration, st.file_size
    FROM shows s
    LEFT JOIN show_tracks st ON s.id = st.show_id AND st.is_active = 1
    ORDER BY s.created_date DESC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching shows:', err);
      return res.status(500).json({ error: 'Failed to fetch shows' });
    }
    
    // Add URLs to shows
    const showsWithUrls = rows.map(show => ({
      ...show,
      url: show.filename ? `/uploads/${show.filename}` : null
    }));
    
    res.json(showsWithUrls);
  });
});

// GET all shows (public endpoint - only active)
router.get('/', (req, res) => {
  const query = `
    SELECT s.*, st.filename, st.duration, st.file_size
    FROM shows s
    LEFT JOIN show_tracks st ON s.id = st.show_id AND st.is_active = 1
    WHERE s.is_active = 1
    ORDER BY s.created_date DESC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching shows:', err);
      return res.status(500).json({ error: 'Failed to fetch shows' });
    }
    
    // Add URLs to shows
    const showsWithUrls = rows.map(show => ({
      ...show,
      url: show.filename ? `/uploads/${show.filename}` : null
    }));
    
    res.json(showsWithUrls);
  });
});

// GET single show by ID with all tracks
router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  // Get show details
  db.get('SELECT * FROM shows WHERE id = ?', [id], (err, show) => {
    if (err) {
      console.error('Error fetching show:', err);
      return res.status(500).json({ error: 'Failed to fetch show' });
    }
    
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }
    
    // Get all tracks for this show
    db.all(`
      SELECT * FROM show_tracks 
      WHERE show_id = ? AND is_active = 1 
      ORDER BY track_order
    `, [id], (err, tracks) => {
      if (err) {
        console.error('Error fetching tracks:', err);
        return res.status(500).json({ error: 'Failed to fetch tracks' });
      }
      
      // Add URLs to tracks
      const tracksWithUrls = tracks.map(track => ({
        ...track,
        url: `/uploads/${track.filename}`
      }));
      
      const showWithTracks = {
        ...show,
        tracks: tracksWithUrls
      };
      
      res.json(showWithTracks);
    });
  });
});

// PUT update show
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;
  
  const query = `
    UPDATE shows 
    SET title = ?, description = ?
    WHERE id = ?
  `;
  
  db.run(query, [title, description, id], function(err) {
    if (err) {
      console.error('Error updating show:', err);
      return res.status(500).json({ error: 'Failed to update show' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Show not found' });
    }
    
    // Get the updated show
    db.get('SELECT * FROM shows WHERE id = ?', [id], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Show updated but failed to retrieve' });
      }
      
      res.json(row);
    });
  });
});

// PUT toggle show status (active/inactive)
router.put('/:id/toggle', (req, res) => {
  const { id } = req.params;
  
  // First get current status
  db.get('SELECT is_active FROM shows WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Error fetching show status:', err);
      return res.status(500).json({ error: 'Failed to fetch show status' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Show not found' });
    }
    
    // Toggle the status
    const newStatus = row.is_active ? 0 : 1;
    
    db.run('UPDATE shows SET is_active = ? WHERE id = ?', [newStatus, id], function(err) {
      if (err) {
        console.error('Error toggling show status:', err);
        return res.status(500).json({ error: 'Failed to toggle show status' });
      }
      
      res.json({ 
        message: 'Show status toggled successfully',
        is_active: newStatus === 1
      });
    });
  });
});

// DELETE show (soft delete)
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('UPDATE shows SET is_active = 0 WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Error deleting show:', err);
      return res.status(500).json({ error: 'Failed to delete show' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Show not found' });
    }
    
    res.json({ message: 'Show deleted successfully' });
  });
});

// POST increment play count for a track
router.post('/:showId/tracks/:trackId/play', (req, res) => {
  const { showId, trackId } = req.params;
  
  const query = `
    UPDATE show_tracks 
    SET play_count = play_count + 1, last_played = CURRENT_TIMESTAMP
    WHERE id = ? AND show_id = ?
  `;
  
  db.run(query, [trackId, showId], function(err) {
    if (err) {
      console.error('Error updating play count:', err);
      return res.status(500).json({ error: 'Failed to update play count' });
    }
    
    res.json({ message: 'Play count updated' });
  });
});

// Handle OPTIONS preflight for audio files
router.options('/audio/:filename', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.sendStatus(200);
});

// GET audio file proxy (serves audio files with proper CORS)
router.get('/audio/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '..', 'uploads', filename);
  
  // Add CORS headers for audio files
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges');
  
  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg'
      });
      
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes'
      });
      
      fs.createReadStream(filePath).pipe(res);
    }
  } else {
    res.status(404).json({ error: "Audio file not found" });
  }
});

module.exports = router;
