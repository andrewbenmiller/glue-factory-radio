const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Default pages to seed if none exist
const DEFAULT_PAGES = ['about', 'events', 'contact', 'live_label'];

// Helper to seed default pages
function seedDefaultPages(callback) {
  let completed = 0;
  DEFAULT_PAGES.forEach(pageName => {
    const defaultContent = pageName === 'live_label' ? 'LIVE NOW' : '';
    db.run(
      'INSERT INTO page_content (page_name, content) VALUES (?, ?) ON CONFLICT (page_name) DO NOTHING',
      [pageName, defaultContent],
      (err) => {
        if (err) console.error('Error seeding page:', pageName, err);
        completed++;
        if (completed === DEFAULT_PAGES.length) {
          callback();
        }
      }
    );
  });
}

// Get all page content
router.get('/', (req, res) => {
  db.all('SELECT * FROM page_content ORDER BY page_name', [], (err, rows) => {
    if (err) {
      console.error('Error fetching page content:', err);
      return res.status(500).json({ error: 'Failed to fetch page content' });
    }

    // If no pages exist, seed them and return
    if (!rows || rows.length === 0) {
      seedDefaultPages(() => {
        db.all('SELECT * FROM page_content ORDER BY page_name', [], (err, newRows) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to fetch page content after seeding' });
          }
          res.json(newRows || []);
        });
      });
      return;
    }

    res.json(rows);
  });
});

// Get single page content by name
router.get('/:pageName', (req, res) => {
  const { pageName } = req.params;

  db.get('SELECT * FROM page_content WHERE page_name = ?', [pageName], (err, row) => {
    if (err) {
      console.error('Error fetching page:', err);
      return res.status(500).json({ error: 'Failed to fetch page' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Page not found' });
    }
    res.json(row);
  });
});

// Update page content
router.put('/:pageName', (req, res) => {
  const { pageName } = req.params;
  const { content } = req.body;

  if (content === undefined) {
    return res.status(400).json({ error: 'Content is required' });
  }

  db.run(
    'UPDATE page_content SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE page_name = ?',
    [content, pageName],
    function(err) {
      if (err) {
        console.error('Error updating page:', err);
        return res.status(500).json({ error: 'Failed to update page' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Page not found' });
      }

      // Fetch and return the updated page
      db.get('SELECT * FROM page_content WHERE page_name = ?', [pageName], (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch updated page' });
        }
        res.json(row);
      });
    }
  );
});

module.exports = router;
