const path = require('path');
const fs = require('fs');

// Determine database type based on environment
const isProduction = process.env.NODE_ENV === 'production';
const usePostgreSQL = isProduction && process.env.DATABASE_URL;

let db;

if (usePostgreSQL) {
  // PostgreSQL for Railway production
  const { Pool } = require('pg');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  console.log('✅ Connected to PostgreSQL database');
  
  // Create a database interface that mimics SQLite3
  db = {
    run: (sql, params, callback) => {
      // Convert ? placeholders to $1, $2, etc. for PostgreSQL
      let convertedSql = sql;
      const paramArray = Array.isArray(params) ? params : [];
      if (paramArray.length > 0) {
        paramArray.forEach((_, index) => {
          convertedSql = convertedSql.replace('?', `$${index + 1}`);
        });
      }
      
      pool.query(convertedSql, paramArray, (err, result) => {
        if (callback) callback(err, result);
      });
    },
    get: (sql, params, callback) => {
      // Convert ? placeholders to $1, $2, etc. for PostgreSQL
      let convertedSql = sql;
      const paramArray = Array.isArray(params) ? params : [];
      if (paramArray.length > 0) {
        paramArray.forEach((_, index) => {
          convertedSql = convertedSql.replace('?', `$${index + 1}`);
        });
      }
      
      pool.query(convertedSql, paramArray, (err, result) => {
        if (callback) callback(err, result ? result.rows[0] : null);
      });
    },
    all: (sql, params, callback) => {
      // Convert ? placeholders to $1, $2, etc. for PostgreSQL
      let convertedSql = sql;
      const paramArray = Array.isArray(params) ? params : [];
      if (paramArray.length > 0) {
        paramArray.forEach((_, index) => {
          convertedSql = convertedSql.replace('?', `$${index + 1}`);
        });
      }
      
      pool.query(convertedSql, paramArray, (err, result) => {
        if (callback) callback(err, result ? result.rows : []);
      });
    },
    close: (callback) => {
      pool.end(callback);
    }
  };
  
  initializePostgreSQLDatabase();
} else {
  // SQLite for local development
  const sqlite3 = require('sqlite3').verbose();
  
  // Database file path
  const dbPath = path.join(__dirname, '../data/radio.db');

  // Create database directory if it doesn't exist
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Create database connection
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
    } else {
      console.log('✅ Connected to SQLite database');
      initializeSQLiteDatabase();
    }
  });
}

// Initialize SQLite database tables
function initializeSQLiteDatabase() {
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
      playlist_id INTEGER NOT NULL,
      show_id INTEGER NOT NULL,
      track_id INTEGER,
      position INTEGER DEFAULT 0,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
      FOREIGN KEY (show_id) REFERENCES shows (id) ON DELETE CASCADE,
      FOREIGN KEY (track_id) REFERENCES show_tracks (id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('Error creating playlist_items table:', err.message);
    } else {
      console.log('✅ Playlist items table ready');
    }
  });

  // Background images table
  db.run(`
    CREATE TABLE IF NOT EXISTS background_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT TRUE,
      display_order INTEGER DEFAULT 0,
      url TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creating background_images table:', err.message);
    } else {
      console.log('✅ Background images table ready');
    }
  });

  // Add url column if it doesn't exist (for existing databases)
  db.run(`ALTER TABLE background_images ADD COLUMN url TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding url column:', err.message);
    }
  });

  // Page content table for nav pages (About, Events, Contact)
  db.run(`
    CREATE TABLE IF NOT EXISTS page_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_name TEXT UNIQUE NOT NULL,
      content TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating page_content table:', err.message);
    } else {
      console.log('✅ Page content table ready');
      // Insert default pages if they don't exist
      const defaultPages = ['about', 'events', 'contact'];
      defaultPages.forEach(pageName => {
        db.run(`INSERT OR IGNORE INTO page_content (page_name, content) VALUES (?, '')`, [pageName]);
      });
    }
  });

  // Create indexes for better performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_show_tracks_show_id ON show_tracks(show_id)`, (err) => {
    if (err) {
      console.error('Error creating index:', err.message);
    } else {
      console.log('✅ Database indexes ready');
    }
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_show_tracks_active ON show_tracks(is_active)`, (err) => {
    if (err) {
      console.error('Error creating index:', err.message);
    }
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_shows_active ON shows(is_active)`, (err) => {
    if (err) {
      console.error('Error creating index:', err.message);
    }
  });

  // Log current schema
  db.all("PRAGMA table_info(shows)", [], (err, rows) => {
    if (err) {
      console.error('Error getting table info:', err.message);
    } else {
      console.log('📋 Current shows table columns:', rows.map(row => row.name));
    }
  });
}

// Initialize PostgreSQL database tables
function initializePostgreSQLDatabase() {
  // Shows table - Main show information
  db.run(`
    CREATE TABLE IF NOT EXISTS shows (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT TRUE,
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
      id SERIAL PRIMARY KEY,
      show_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      duration REAL DEFAULT 0,
      file_size INTEGER,
      track_order INTEGER DEFAULT 0,
      upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT TRUE,
      play_count INTEGER DEFAULT 0,
      last_played TIMESTAMP,
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
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT TRUE
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
      id SERIAL PRIMARY KEY,
      playlist_id INTEGER NOT NULL,
      show_id INTEGER NOT NULL,
      track_id INTEGER,
      position INTEGER DEFAULT 0,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
      FOREIGN KEY (show_id) REFERENCES shows (id) ON DELETE CASCADE,
      FOREIGN KEY (track_id) REFERENCES show_tracks (id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('Error creating playlist_items table:', err.message);
    } else {
      console.log('✅ Playlist items table ready');
    }
  });

  // Background images table
  db.run(`
    CREATE TABLE IF NOT EXISTS background_images (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT TRUE,
      display_order INTEGER DEFAULT 0,
      url TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creating background_images table:', err.message);
    } else {
      console.log('✅ Background images table ready');
    }
  });

  // Add url column if it doesn't exist (for existing databases)
  db.run(`ALTER TABLE background_images ADD COLUMN url TEXT`, (err) => {
    if (err && !err.message.includes('already exists')) {
      console.error('Error adding url column:', err.message);
    }
  });

  // Page content table for nav pages (About, Events, Contact)
  db.run(`
    CREATE TABLE IF NOT EXISTS page_content (
      id SERIAL PRIMARY KEY,
      page_name TEXT UNIQUE NOT NULL,
      content TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating page_content table:', err.message);
    } else {
      console.log('✅ Page content table ready');
      // Insert default pages if they don't exist
      const defaultPages = ['about', 'events', 'contact'];
      defaultPages.forEach(pageName => {
        db.run(`INSERT INTO page_content (page_name, content) VALUES (?, '') ON CONFLICT (page_name) DO NOTHING`, [pageName]);
      });
    }
  });

  // Create indexes for better performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_show_tracks_show_id ON show_tracks(show_id)`, (err) => {
    if (err) {
      console.error('Error creating index:', err.message);
    } else {
      console.log('✅ Database indexes ready');
    }
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_show_tracks_active ON show_tracks(is_active)`, (err) => {
    if (err) {
      console.error('Error creating index:', err.message);
    }
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_shows_active ON shows(is_active)`, (err) => {
    if (err) {
      console.error('Error creating index:', err.message);
    }
  });

  console.log('✅ Database schema is up to date');
}

module.exports = db;
