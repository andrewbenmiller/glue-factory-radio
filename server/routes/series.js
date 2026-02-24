const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const cloudStorage = require('../services/cloudStorage');

const BACKEND_URL = process.env.BACKEND_URL || 'https://glue-factory-radio-production.up.railway.app';

// Reuse same image upload config as upload.js
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${timestamp}_${originalName}`);
  }
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = /image\/(jpeg|jpg|png|webp)/;
    const allowedExtensions = /\.(jpg|jpeg|png|webp)$/i;
    if (allowedMimeTypes.test(file.mimetype) || allowedExtensions.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and WebP images are allowed'), false);
    }
  }
});

function seriesCoverUrl(coverImage) {
  if (!coverImage) return null;
  return `${BACKEND_URL}/api/images/${coverImage}`;
}

// GET all series (public - only series with active episodes)
router.get('/', (req, res) => {
  const query = `
    SELECT s.*,
           COUNT(sh.id) as episode_count,
           COALESCE(SUM(sh.total_duration), 0) as total_duration
    FROM series s
    LEFT JOIN shows sh ON sh.series_id = s.id AND sh.is_active = true
    GROUP BY s.id
    HAVING COUNT(sh.id) > 0
    ORDER BY s.created_at DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching series:', err);
      return res.status(500).json({ error: 'Failed to fetch series' });
    }
    res.json((rows || []).map(r => ({ ...r, cover_image_url: seriesCoverUrl(r.cover_image) })));
  });
});

// GET all series (admin - includes empty series)
router.get('/admin', (req, res) => {
  const query = `
    SELECT s.*,
           COUNT(sh.id) as episode_count
    FROM series s
    LEFT JOIN shows sh ON sh.series_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching series:', err);
      return res.status(500).json({ error: 'Failed to fetch series' });
    }
    res.json((rows || []).map(r => ({ ...r, cover_image_url: seriesCoverUrl(r.cover_image) })));
  });
});

// GET single series with episodes
router.get('/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM series WHERE id = ?', [id], (err, series) => {
    if (err) {
      console.error('Error fetching series:', err);
      return res.status(500).json({ error: 'Failed to fetch series' });
    }
    if (!series) {
      return res.status(404).json({ error: 'Series not found' });
    }

    // Fetch episodes with tracks, ordered by episode_number ASC
    const query = `
      SELECT sh.*, st.filename, st.duration, st.file_size, st.title as track_title,
             st.id as track_id, st.track_order, st.upload_date,
             st.is_active as track_active, st.play_count, st.last_played
      FROM shows sh
      LEFT JOIN show_tracks st ON sh.id = st.show_id AND st.is_active = true
      WHERE sh.series_id = ? AND sh.is_active = true
      ORDER BY sh.episode_number ASC, st.track_order
    `;

    db.all(query, [id], (err, rows) => {
      if (err) {
        console.error('Error fetching episodes:', err);
        return res.status(500).json({ error: 'Failed to fetch episodes' });
      }

      // Group tracks by show (same pattern as shows.js)
      const showsMap = new Map();
      (rows || []).forEach(row => {
        if (!showsMap.has(row.id)) {
          showsMap.set(row.id, {
            id: row.id,
            title: row.title,
            description: row.description,
            created_date: row.created_date,
            is_active: row.is_active,
            total_duration: 0,
            total_tracks: 0,
            series_id: row.series_id,
            episode_number: row.episode_number,
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

      showsMap.forEach(show => {
        show.total_tracks = show.tracks.length;
        show.total_duration = show.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
      });

      // Fetch tags for episodes
      const showIds = Array.from(showsMap.keys());
      if (showIds.length === 0) {
        return res.json({ ...series, cover_image_url: seriesCoverUrl(series.cover_image), episodes: [] });
      }

      const placeholders = showIds.map(() => '?').join(',');
      db.all(`
        SELECT st.show_id, t.name
        FROM show_tags st
        JOIN tags t ON st.tag_id = t.id
        WHERE st.show_id IN (${placeholders})
        ORDER BY t.name
      `, showIds, (err, tagRows) => {
        (tagRows || []).forEach(row => {
          const show = showsMap.get(row.show_id);
          if (show) show.tags.push(row.name);
        });

        res.json({
          ...series,
          cover_image_url: seriesCoverUrl(series.cover_image),
          episodes: Array.from(showsMap.values())
        });
      });
    });
  });
});

// GET next episode number for a series
router.get('/:id/next-episode', (req, res) => {
  const { id } = req.params;
  db.get('SELECT COALESCE(MAX(episode_number), 0) + 1 as next_episode FROM shows WHERE series_id = ?',
    [id], (err, row) => {
    if (err) {
      console.error('Error getting next episode number:', err);
      return res.status(500).json({ error: 'Failed to determine next episode number' });
    }
    res.json({ next_episode: row.next_episode });
  });
});

// POST create new series
router.post('/', (req, res) => {
  const { title, description } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Series title is required' });
  }

  db.run('INSERT INTO series (title, description) VALUES (?, ?)',
    [title.trim(), description || ''], function(err) {
    if (err) {
      console.error('Error creating series:', err);
      return res.status(500).json({ error: 'Failed to create series' });
    }
    db.get('SELECT * FROM series WHERE id = ?', [this.lastID], (err, row) => {
      if (err) {
        console.error('Error fetching created series:', err);
        return res.status(500).json({ error: 'Series created but failed to retrieve' });
      }
      res.json(row);
    });
  });
});

// PUT update series
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Series title is required' });
  }

  db.run('UPDATE series SET title = ?, description = ? WHERE id = ?',
    [title.trim(), description || '', id], function(err) {
    if (err) {
      console.error('Error updating series:', err);
      return res.status(500).json({ error: 'Failed to update series' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Series not found' });
    }
    db.get('SELECT * FROM series WHERE id = ?', [id], (err, row) => {
      if (err) {
        console.error('Error fetching updated series:', err);
        return res.status(500).json({ error: 'Failed to fetch updated series' });
      }
      res.json(row);
    });
  });
});

// DELETE series (keeps shows as standalone)
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  // Detach episodes first
  db.run('UPDATE shows SET series_id = NULL, episode_number = NULL WHERE series_id = ?', [id], (err) => {
    if (err) {
      console.error('Error detaching episodes:', err);
      return res.status(500).json({ error: 'Failed to detach episodes' });
    }

    db.run('DELETE FROM series WHERE id = ?', [id], function(err) {
      if (err) {
        console.error('Error deleting series:', err);
        return res.status(500).json({ error: 'Failed to delete series' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Series not found' });
      }
      res.json({ message: 'Series deleted, episodes converted to standalone shows' });
    });
  });
});

// PUT update cover position for a series
router.put('/:id/cover-position', express.json(), (req, res) => {
  const { id } = req.params;
  const { position } = req.body;

  if (!position || !/^\d{1,3}%\s+\d{1,3}%$/.test(position)) {
    return res.status(400).json({ error: 'Invalid position format. Expected "X% Y%" (e.g. "50% 30%")' });
  }

  db.run('UPDATE series SET cover_position = ? WHERE id = ?', [position, id], function(err) {
    if (err) {
      console.error('Error updating cover position:', err);
      return res.status(500).json({ error: 'Failed to update cover position' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Series not found' });
    }
    res.json({ message: 'Cover position updated', cover_position: position });
  });
});

// POST upload cover image for a series
router.post('/:id/cover', imageUpload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const imageFile = req.file;

    if (!imageFile) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    // Check series exists
    db.get('SELECT * FROM series WHERE id = ?', [id], async (err, series) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!series) return res.status(404).json({ error: 'Series not found' });

      const filename = imageFile.filename;
      const filePath = path.join(__dirname, '../uploads', filename);

      // Upload to R2
      const storageResult = await cloudStorage.uploadFile(filePath, `images/${filename}`);
      if (!storageResult.success) {
        return res.status(500).json({ error: 'Failed to upload image to storage' });
      }

      // Delete old cover image from R2 if it exists
      if (series.cover_image) {
        try {
          await cloudStorage.deleteFile(`images/${series.cover_image}`);
        } catch (e) {
          console.error('Error deleting old cover image:', e);
        }
      }

      // Update series with new cover_image
      db.run('UPDATE series SET cover_image = ? WHERE id = ?', [filename, id], function(err) {
        if (err) {
          console.error('Error updating series cover:', err);
          return res.status(500).json({ error: 'Failed to update series cover' });
        }
        res.json({
          message: 'Cover image uploaded',
          cover_image: filename,
          cover_image_url: seriesCoverUrl(filename)
        });
      });
    });
  } catch (error) {
    console.error('Error uploading series cover:', error);
    res.status(500).json({ error: 'Failed to upload cover image' });
  }
});

// DELETE cover image for a series
router.delete('/:id/cover', (req, res) => {
  const { id } = req.params;

  db.get('SELECT cover_image FROM series WHERE id = ?', [id], async (err, series) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!series) return res.status(404).json({ error: 'Series not found' });
    if (!series.cover_image) return res.json({ message: 'No cover image to delete' });

    // Delete from R2
    try {
      await cloudStorage.deleteFile(`images/${series.cover_image}`);
    } catch (e) {
      console.error('Error deleting cover from storage:', e);
    }

    db.run('UPDATE series SET cover_image = NULL WHERE id = ?', [id], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to remove cover image' });
      res.json({ message: 'Cover image removed' });
    });
  });
});

module.exports = router;
