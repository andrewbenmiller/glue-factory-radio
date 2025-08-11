const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET all shows
router.get('/', (req, res) => {
  const query = `
    SELECT * FROM shows 
    WHERE is_active = 1 
    ORDER BY upload_date DESC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching shows:', err);
      return res.status(500).json({ error: 'Failed to fetch shows' });
    }
    
    // Add full URL to each show
    const shows = rows.map(show => ({
      ...show,
      url: `/uploads/${show.filename}`,
      duration: show.duration || 0
    }));
    
    res.json(shows);
  });
});

// GET single show by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM shows WHERE id = ? AND is_active = 1', [id], (err, row) => {
    if (err) {
      console.error('Error fetching show:', err);
      return res.status(500).json({ error: 'Failed to fetch show' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Show not found' });
    }
    
    // Add full URL
    const show = {
      ...row,
      url: `/uploads/${row.filename}`,
      duration: row.duration || 0
    };
    
    res.json(show);
  });
});

// POST create new show
router.post('/', (req, res) => {
  const { title, description, filename, duration, file_size } = req.body;
  
  if (!title || !filename) {
    return res.status(400).json({ error: 'Title and filename are required' });
  }
  
  const query = `
    INSERT INTO shows (title, description, filename, duration, file_size)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  db.run(query, [title, description, filename, duration, file_size], function(err) {
    if (err) {
      console.error('Error creating show:', err);
      return res.status(500).json({ error: 'Failed to create show' });
    }
    
    // Get the created show
    db.get('SELECT * FROM shows WHERE id = ?', [this.lastID], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Show created but failed to retrieve' });
      }
      
      const show = {
        ...row,
        url: `/uploads/${row.filename}`,
        duration: row.duration || 0
      };
      
      res.status(201).json(show);
    });
  });
});

// PUT update show
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, is_active } = req.body;
  
  const query = `
    UPDATE shows 
    SET title = ?, description = ?, is_active = ?
    WHERE id = ?
  `;
  
  db.run(query, [title, description, is_active, id], function(err) {
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
      
      const show = {
        ...row,
        url: `/uploads/${row.filename}`,
        duration: row.duration || 0
      };
      
      res.json(show);
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

// POST increment play count
router.post('/:id/play', (req, res) => {
  const { id } = req.params;
  
  const query = `
    UPDATE shows 
    SET play_count = play_count + 1, last_played = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  db.run(query, [id], function(err) {
    if (err) {
      console.error('Error updating play count:', err);
      return res.status(500).json({ error: 'Failed to update play count' });
    }
    
    res.json({ message: 'Play count updated' });
  });
});

module.exports = router;
