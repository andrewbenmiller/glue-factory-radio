const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, '../data/radio.db');

// Create database directory if it doesn't exist
const fs = require('fs');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('✅ Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  // Shows table - Main show information
  db.run(`
    CREATE TABLE IF NOT EXISTS shows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT 1,
      total_duration REAL DEFAULT 0,
      total_tracks INTEGER DEFAULT 0
    )
  `, (err) => {
    if (err) {
      console.error('Error creating shows table:', err.message);
    } else {
      console.log('✅ Shows table ready');
    }
  });

  // Show tracks table - Individual MP3s within each show
  db.run(`
    CREATE TABLE IF NOT EXISTS show_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      show_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      duration REAL DEFAULT 0,
      file_size INTEGER,
      track_order INTEGER DEFAULT 0,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT 1,
      play_count INTEGER DEFAULT 0,
      last_played DATETIME,
      FOREIGN KEY (show_id) REFERENCES shows (id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('Error creating show_tracks table:', err.message);
    } else {
      console.log('✅ Show tracks table ready');
    }
  });

  // Users table for future admin features
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating users table:', err.message);
    } else {
      console.log('✅ Users table ready');
    }
  });

  // Playlists table for future features
  db.run(`
    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT 1
    )
  `, (err) => {
    if (err) {
      console.error('Error creating playlists table:', err.message);
    } else {
      console.log('✅ Playlists table ready');
    }
  });

  // Playlist items table
  db.run(`
    CREATE TABLE IF NOT EXISTS playlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER,
      show_id INTEGER,
      position INTEGER,
      FOREIGN KEY (playlist_id) REFERENCES playlists (id),
      FOREIGN KEY (show_id) REFERENCES shows (id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating playlist_items table:', err.message);
    } else {
      console.log('✅ Playlist items table ready');
    }
  });

  // Create indexes for better performance
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_show_tracks_show_id 
    ON show_tracks(show_id)
  `, (err) => {
    if (err) {
      console.error('Error creating index:', err.message);
    } else {
      console.log('✅ Database indexes ready');
    }
  });

  // Run migration to update existing database schema
  runMigrations();
}

// Database migration function
function runMigrations() {
  console.log('🔄 Running database migrations...');
  
  // Check if we need to migrate from old shows table structure
  db.get("PRAGMA table_info(shows)", (err, row) => {
    if (err) {
      console.error('Error checking shows table structure:', err);
      return;
    }

    // Check if old columns exist
    db.all("PRAGMA table_info(shows)", (err, columns) => {
      if (err) {
        console.error('Error getting shows table columns:', err);
        return;
      }

      const columnNames = columns.map(col => col.name);
      console.log('📋 Current shows table columns:', columnNames);

      // If old structure exists, migrate the data
      if (columnNames.includes('filename') && columnNames.includes('upload_date')) {
        console.log('🔄 Migrating old shows table to new structure...');
        migrateOldShowsTable();
      } else {
        console.log('✅ Database schema is up to date');
      }
    });
  });
}

// Migrate old shows table structure to new show/track structure
function migrateOldShowsTable() {
  console.log('🔄 Starting migration...');
  
  // First, create the new show_tracks table if it doesn't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS show_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      show_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      duration REAL DEFAULT 0,
      file_size INTEGER,
      track_order INTEGER DEFAULT 0,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT 1,
      play_count INTEGER DEFAULT 0,
      last_played DATETIME,
      FOREIGN KEY (show_id) REFERENCES shows (id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('Error creating show_tracks table during migration:', err);
      return;
    }

    // Get all existing shows with old structure
    db.all('SELECT * FROM shows', (err, oldShows) => {
      if (err) {
        console.error('Error fetching old shows:', err);
        return;
      }

      console.log(`🔄 Found ${oldShows.length} shows to migrate`);

      oldShows.forEach((show, index) => {
        // Insert into show_tracks table
        const trackQuery = `
          INSERT INTO show_tracks (show_id, title, filename, duration, file_size, track_order, upload_date, is_active, play_count, last_played)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.run(trackQuery, [
          show.id,
          show.title || 'Untitled Track',
          show.filename || '',
          show.duration || 0,
          show.file_size || 0,
          1, // track_order
          show.upload_date || new Date().toISOString(),
          show.is_active || 1,
          show.play_count || 0,
          show.last_played || null
        ], function(err) {
          if (err) {
            console.error(`Error migrating show ${show.id}:`, err);
          } else {
            console.log(`✅ Migrated show ${show.id}: ${show.title}`);
          }

          // Update the shows table to new structure
          const updateQuery = `
            UPDATE shows 
            SET created_date = upload_date,
                total_duration = COALESCE(duration, 0),
                total_tracks = 1
            WHERE id = ?
          `;
          
          db.run(updateQuery, [show.id], (err) => {
            if (err) {
              console.error(`Error updating show ${show.id}:`, err);
            }
          });

          // If this is the last show, remove old columns
          if (index === oldShows.length - 1) {
            console.log('🔄 Migration complete! Removing old columns...');
            removeOldColumns();
          }
        });
      });
    });
  });
}

// Remove old columns from shows table
function removeOldColumns() {
  console.log('🧹 Cleaning up old columns...');
  
  // SQLite doesn't support DROP COLUMN directly, so we'll recreate the table
  db.serialize(() => {
    // Create new table with correct structure
    db.run(`
      CREATE TABLE shows_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1,
        total_duration REAL DEFAULT 0,
        total_tracks INTEGER DEFAULT 0
      )
    `, (err) => {
      if (err) {
        console.error('Error creating new shows table:', err);
        return;
      }

      // Copy data to new table
      db.run(`
        INSERT INTO shows_new (id, title, description, created_date, is_active, total_duration, total_tracks)
        SELECT id, title, description, created_date, is_active, total_duration, total_tracks
        FROM shows
      `, (err) => {
        if (err) {
          console.error('Error copying data to new table:', err);
          return;
        }

        // Drop old table and rename new one
        db.run('DROP TABLE shows', (err) => {
          if (err) {
            console.error('Error dropping old table:', err);
            return;
          }

          db.run('ALTER TABLE shows_new RENAME TO shows', (err) => {
            if (err) {
              console.error('Error renaming table:', err);
            } else {
              console.log('✅ Database migration completed successfully!');
            }
          });
        });
      });
    });
  });
}

module.exports = db;
