const express = require('express');
const router = express.Router();
const db = require('../config/database');
const fs = require('fs');
const path = require('path');

// DEBUG: Check database tables and try creating show_tags (TEMPORARY)
router.get('/debug/tables', (req, res) => {
  db.all(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`, [], (err, rows) => {
    if (err) return res.json({ error: err.message });
    // Try creating show_tags and report the result
    db.run(`
      CREATE TABLE IF NOT EXISTS show_tags (
        id SERIAL PRIMARY KEY, show_id INTEGER NOT NULL, tag_id INTEGER NOT NULL,
        FOREIGN KEY (show_id) REFERENCES shows (id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
        UNIQUE(show_id, tag_id)
      )
    `, function(createErr) {
      res.json({
        tables: rows.map(r => r.table_name),
        show_tags_create: createErr ? createErr.message : 'OK'
      });
    });
  });
});

// GET all shows (admin endpoint - includes inactive)
router.get('/admin', (req, res) => {
  const query = `
    SELECT s.*, st.filename, st.duration, st.file_size, st.title as track_title, st.id as track_id, st.track_order, st.upload_date, st.is_active as track_active, st.play_count, st.last_played
    FROM shows s
    LEFT JOIN show_tracks st ON s.id = st.show_id AND st.is_active = true
    ORDER BY s.created_date DESC, st.track_order
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching shows:', err);
      return res.status(500).json({ error: 'Failed to fetch shows' });
    }

    // Group tracks by show
    const showsMap = new Map();

    rows.forEach(row => {
      if (!showsMap.has(row.id)) {
        showsMap.set(row.id, {
          id: row.id,
          title: row.title,
          description: row.description,
          created_date: row.created_date,
          is_active: row.is_active,
          total_duration: row.total_duration,
          total_tracks: 0, // Will be calculated from actual tracks
          tags: [],
          tracks: []
        });
      }

      if (row.track_id) {
        showsMap.get(row.id).tracks.push({
          id: row.track_id,
          show_id: row.id,
          title: row.track_title,
          filename: row.filename,
          duration: row.duration,
          file_size: row.file_size,
          track_order: row.track_order,
          upload_date: row.upload_date,
          is_active: row.track_active,
          play_count: row.play_count,
          last_played: row.last_played,
          url: `/audio/${row.filename}`
        });
      }
    });

    // Calculate actual track counts and total duration
    showsMap.forEach((show, showId) => {
      show.total_tracks = show.tracks.length;
      show.total_duration = show.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
    });

    // Fetch tags for all shows
    const showIds = Array.from(showsMap.keys());
    if (showIds.length === 0) {
      return res.json([]);
    }

    const placeholders = showIds.map(() => '?').join(',');
    db.all(`
      SELECT st.show_id, t.name
      FROM show_tags st
      JOIN tags t ON st.tag_id = t.id
      WHERE st.show_id IN (${placeholders})
      ORDER BY t.name
    `, showIds, (err, tagRows) => {
      if (err) {
        console.error('Error fetching tags:', err);
        // Return shows without tags rather than failing
        return res.json(Array.from(showsMap.values()));
      }

      (tagRows || []).forEach(row => {
        const show = showsMap.get(row.show_id);
        if (show) {
          show.tags.push(row.name);
        }
      });

      res.json(Array.from(showsMap.values()));
    });
  });
});

// GET all shows (public endpoint - only active)
router.get('/', (req, res) => {
  const query = `
    SELECT s.*, st.filename, st.duration, st.file_size, st.title as track_title, st.id as track_id, st.track_order, st.upload_date, st.is_active as track_active, st.play_count, st.last_played
    FROM shows s
    LEFT JOIN show_tracks st ON s.id = st.show_id AND st.is_active = true
    WHERE s.is_active = true
    ORDER BY s.created_date DESC, st.track_order
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching shows:', err);
      return res.status(500).json({ error: 'Failed to fetch shows' });
    }

    // Group tracks by show
    const showsMap = new Map();

    rows.forEach(row => {
      if (!showsMap.has(row.id)) {
        showsMap.set(row.id, {
          id: row.id,
          title: row.title,
          description: row.description,
          created_date: row.created_date,
          is_active: row.is_active,
          total_duration: 0,
          total_tracks: 0,
          tags: [],
          tracks: []
        });
      }

      if (row.track_id) {
        showsMap.get(row.id).tracks.push({
          id: row.track_id,
          show_id: row.id,
          title: row.track_title,
          filename: row.filename,
          duration: row.duration,
          file_size: row.file_size,
          track_order: row.track_order,
          upload_date: row.upload_date,
          is_active: row.track_active,
          play_count: row.play_count,
          last_played: row.last_played,
          url: `/audio/${row.filename}`
        });
      }
    });

    // Calculate actual track counts and total duration
    showsMap.forEach((show, showId) => {
      show.total_tracks = show.tracks.length;
      show.total_duration = show.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
    });

    // Fetch tags for all shows
    const showIds = Array.from(showsMap.keys());
    if (showIds.length === 0) {
      return res.json([]);
    }

    const placeholders = showIds.map(() => '?').join(',');
    db.all(`
      SELECT st.show_id, t.name
      FROM show_tags st
      JOIN tags t ON st.tag_id = t.id
      WHERE st.show_id IN (${placeholders})
      ORDER BY t.name
    `, showIds, (err, tagRows) => {
      if (err) {
        console.error('Error fetching tags:', err);
        return res.json(Array.from(showsMap.values()));
      }

      (tagRows || []).forEach(row => {
        const show = showsMap.get(row.show_id);
        if (show) {
          show.tags.push(row.name);
        }
      });

      res.json(Array.from(showsMap.values()));
    });
  });
});

// GET all tags (for autocomplete)
router.get('/tags/all', (req, res) => {
  db.all('SELECT name FROM tags ORDER BY name', [], (err, rows) => {
    if (err) {
      console.error('Error fetching tags:', err);
      return res.status(500).json({ error: 'Failed to fetch tags' });
    }
    res.json((rows || []).map(r => r.name));
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
      WHERE show_id = ? AND is_active = true
      ORDER BY track_order
    `, [id], (err, tracks) => {
      if (err) {
        console.error('Error fetching tracks:', err);
        return res.status(500).json({ error: 'Failed to fetch tracks' });
      }

      // Add URLs to tracks
      const tracksWithUrls = tracks.map(track => ({
        ...track,
        url: `/audio/${track.filename}`
      }));

      // Get tags for this show
      db.all(`
        SELECT t.name FROM show_tags st
        JOIN tags t ON st.tag_id = t.id
        WHERE st.show_id = ?
        ORDER BY t.name
      `, [id], (err, tagRows) => {
        if (err) {
          console.error('Error fetching tags:', err);
        }

        const showWithTracks = {
          ...show,
          tags: (tagRows || []).map(r => r.name),
          tracks: tracksWithUrls
        };

        res.json(showWithTracks);
      });
    });
  });
});

// PUT update show
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, tags } = req.body;

  try {
    // Update show fields
    await new Promise((resolve, reject) => {
      db.run('UPDATE shows SET title = ?, description = ? WHERE id = ?', [title, description, id], function(err) {
        if (err) return reject(err);
        if (this.changes === 0) return reject(new Error('Show not found'));
        resolve();
      });
    });

    // Sync tags if provided
    if (Array.isArray(tags)) {
      // Remove existing tag associations
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM show_tags WHERE show_id = ?', [id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Add new tags
      for (const tagName of tags) {
        const trimmed = tagName.trim().toLowerCase();
        if (!trimmed) continue;

        // Insert tag if it doesn't exist (ON CONFLICT works in both SQLite 3.24+ and PostgreSQL)
        await new Promise((resolve, reject) => {
          db.run('INSERT INTO tags (name) VALUES (?) ON CONFLICT (name) DO NOTHING', [trimmed], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        // Get tag id
        const tag = await new Promise((resolve, reject) => {
          db.get('SELECT id FROM tags WHERE name = ?', [trimmed], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (tag) {
          await new Promise((resolve, reject) => {
            db.run('INSERT INTO show_tags (show_id, tag_id) VALUES (?, ?) ON CONFLICT (show_id, tag_id) DO NOTHING', [id, tag.id], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }
      }
    }

    // Get updated show with tags
    const show = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM shows WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const tagRows = await new Promise((resolve, reject) => {
      db.all('SELECT t.name FROM show_tags st JOIN tags t ON st.tag_id = t.id WHERE st.show_id = ? ORDER BY t.name', [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    res.json({ ...show, tags: tagRows.map(r => r.name) });

  } catch (error) {
    console.error('Error updating show:', error);
    if (error.message === 'Show not found') {
      return res.status(404).json({ error: 'Show not found' });
    }
    res.status(500).json({ error: 'Failed to update show', details: error.message });
  }
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
        is_active: newStatus === true
      });
    });
  });
});

// DELETE show (hard delete - removes show and all tracks from database and R2)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // First, get all tracks for this show to delete from R2
    const tracks = await new Promise((resolve, reject) => {
      db.all('SELECT filename FROM show_tracks WHERE show_id = ?', [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Delete all track files from R2 storage
    const cloudStorage = require('../services/cloudStorage');
    for (const track of tracks) {
      try {
        const deleteResult = await cloudStorage.deleteFile(track.filename);
        if (!deleteResult.success) {
          console.error(`Error deleting file ${track.filename} from R2:`, deleteResult.error);
        }
      } catch (deleteErr) {
        console.error(`Error deleting file ${track.filename} from R2:`, deleteErr);
      }
    }
    
    // Delete all tracks from database
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM show_tracks WHERE show_id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Delete the show from database
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM shows WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
    
    res.json({ message: 'Show and all tracks deleted successfully' });
    
  } catch (err) {
    console.error('Error hard deleting show:', err);
    res.status(500).json({ error: 'Failed to delete show' });
  }
});

// POST restore show (soft restore)
router.post('/:id/restore', (req, res) => {
  const { id } = req.params;
  
  db.run('UPDATE shows SET is_active = true WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Error restoring show:', err);
      return res.status(500).json({ error: 'Failed to restore show' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Show not found' });
    }
    
    res.json({ message: 'Show restored successfully' });
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

// GET audio file proxy (serves audio files with proper CORS) - MOVED TO server.js
// This route is now handled at /api/audio/:filename in the main server

// DELETE track (hard delete - removes track from database and R2)
router.delete('/:showId/tracks/:trackId', async (req, res) => {
  const { showId, trackId } = req.params;
  
  try {
    // First, get the track info to delete from R2
    const track = await new Promise((resolve, reject) => {
      db.get('SELECT filename FROM show_tracks WHERE id = ? AND show_id = ?', [trackId, showId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }
    
    // Delete file from R2 storage
    const cloudStorage = require('../services/cloudStorage');
    try {
      const deleteResult = await cloudStorage.deleteFile(track.filename);
      if (!deleteResult.success) {
        console.error('Error deleting file from R2:', deleteResult.error);
        // Continue with database deletion even if R2 fails
      }
    } catch (deleteErr) {
      console.error('Error deleting file from R2:', deleteErr);
      // Continue with database deletion even if R2 fails
    }
    
    // Hard delete the track from database
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM show_tracks WHERE id = ? AND show_id = ?', [trackId, showId], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
    
    res.json({ message: 'Track deleted successfully' });
    
  } catch (err) {
    console.error('Error hard deleting track:', err);
    res.status(500).json({ error: 'Failed to delete track' });
  }
});

module.exports = router;
