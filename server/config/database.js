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
      // Handle db.run(sql, callback) with no params
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      // Convert ? placeholders to $1, $2, etc. for PostgreSQL
      let convertedSql = sql;
      const paramArray = Array.isArray(params) ? params : [];
      if (paramArray.length > 0) {
        let paramIndex = 0;
        convertedSql = convertedSql.replace(/\?/g, () => `$${++paramIndex}`);
      }

      // Add RETURNING id to INSERT statements so we can get lastID
      if (/^\s*INSERT\s/i.test(convertedSql) && !/RETURNING/i.test(convertedSql)) {
        convertedSql += ' RETURNING id';
      }

      pool.query(convertedSql, paramArray, (err, result) => {
        if (callback) {
          // Mimic SQLite's this.changes and this.lastID
          const context = {
            changes: result ? result.rowCount : 0,
            lastID: result && result.rows && result.rows[0] ? result.rows[0].id : null
          };
          callback.call(context, err);
        }
      });
    },
    get: (sql, params, callback) => {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      // Convert ? placeholders to $1, $2, etc. for PostgreSQL
      let convertedSql = sql;
      const paramArray = Array.isArray(params) ? params : [];
      if (paramArray.length > 0) {
        let paramIndex = 0;
        convertedSql = convertedSql.replace(/\?/g, () => `$${++paramIndex}`);
      }

      pool.query(convertedSql, paramArray, (err, result) => {
        if (callback) callback(err, result ? result.rows[0] : null);
      });
    },
    all: (sql, params, callback) => {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      // Convert ? placeholders to $1, $2, etc. for PostgreSQL
      let convertedSql = sql;
      const paramArray = Array.isArray(params) ? params : [];
      if (paramArray.length > 0) {
        let paramIndex = 0;
        convertedSql = convertedSql.replace(/\?/g, () => `$${++paramIndex}`);
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
      const defaultPages = ['about', 'events', 'contact', 'live_label'];
      defaultPages.forEach(pageName => {
        const defaultContent = pageName === 'live_label' ? 'LIVE NOW' : '';
        db.run(`INSERT OR IGNORE INTO page_content (page_name, content) VALUES (?, ?)`, [pageName, defaultContent]);
      });
    }
  });

  // Series table - Groups of related shows
  db.run(`
    CREATE TABLE IF NOT EXISTS series (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      cover_image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating series table:', err.message);
    } else {
      console.log('✅ Series table ready');
    }
  });

  // Add cover_image column to series (for existing databases)
  db.run(`ALTER TABLE series ADD COLUMN cover_image TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding cover_image column:', err.message);
    }
  });

  // Add series_id and episode_number columns to shows (for existing databases)
  db.run(`ALTER TABLE shows ADD COLUMN series_id INTEGER REFERENCES series(id) ON DELETE SET NULL`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding series_id column:', err.message);
    }
  });

  db.run(`ALTER TABLE shows ADD COLUMN episode_number INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding episode_number column:', err.message);
    }
  });

  // Tags table - Unique genre/category tags
  db.run(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating tags table:', err.message);
    } else {
      console.log('✅ Tags table ready');
    }
  });

  // Show-tags junction table (many-to-many)
  db.run(`
    CREATE TABLE IF NOT EXISTS show_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      show_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      FOREIGN KEY (show_id) REFERENCES shows (id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
      UNIQUE(show_id, tag_id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating show_tags table:', err.message);
    } else {
      console.log('✅ Show tags table ready');
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

  db.run(`CREATE INDEX IF NOT EXISTS idx_show_tags_show_id ON show_tags(show_id)`, (err) => {
    if (err) {
      console.error('Error creating index:', err.message);
    }
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_show_tags_tag_id ON show_tags(tag_id)`, (err) => {
    if (err) {
      console.error('Error creating index:', err.message);
    }
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_shows_series_id ON shows(series_id)`, (err) => {
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

// Helper: run a query and log result, but don't throw on failure
async function safeQuery(client, label, sql, params) {
  try {
    await client.query(sql, params || []);
    console.log(`✅ ${label}`);
  } catch (err) {
    console.error(`❌ ${label}: ${err.message}`);
  }
}

// Initialize PostgreSQL database tables (sequential to respect foreign key dependencies)
async function initializePostgreSQLDatabase() {
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    console.error('Failed to connect for DB init:', err.message);
    return;
  }

  try {
    // Base tables (no foreign key dependencies)
    await safeQuery(client, 'Shows table', `
      CREATE TABLE IF NOT EXISTS shows (
        id SERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT,
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE, total_duration REAL DEFAULT 0,
        total_tracks INTEGER DEFAULT 0
      )
    `);

    await safeQuery(client, 'Users table', `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'admin', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await safeQuery(client, 'Playlists table', `
      CREATE TABLE IF NOT EXISTS playlists (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, is_active BOOLEAN DEFAULT TRUE
      )
    `);

    await safeQuery(client, 'Background images table', `
      CREATE TABLE IF NOT EXISTS background_images (
        id SERIAL PRIMARY KEY, filename TEXT NOT NULL, original_name TEXT NOT NULL,
        file_size INTEGER NOT NULL, upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE, display_order INTEGER DEFAULT 0, url TEXT
      )
    `);

    await safeQuery(client, 'Page content table', `
      CREATE TABLE IF NOT EXISTS page_content (
        id SERIAL PRIMARY KEY, page_name TEXT UNIQUE NOT NULL, content TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await safeQuery(client, 'Series table', `
      CREATE TABLE IF NOT EXISTS series (
        id SERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT,
        cover_image TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await safeQuery(client, 'Tags table', `
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Dependent tables (have foreign keys to base tables)
    await safeQuery(client, 'Show tracks table', `
      CREATE TABLE IF NOT EXISTS show_tracks (
        id SERIAL PRIMARY KEY, show_id INTEGER NOT NULL, title TEXT NOT NULL,
        filename TEXT NOT NULL, duration REAL DEFAULT 0, file_size INTEGER,
        track_order INTEGER DEFAULT 0, upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE, play_count INTEGER DEFAULT 0, last_played TIMESTAMP,
        FOREIGN KEY (show_id) REFERENCES shows (id) ON DELETE CASCADE
      )
    `);

    await safeQuery(client, 'Playlist items table', `
      CREATE TABLE IF NOT EXISTS playlist_items (
        id SERIAL PRIMARY KEY, playlist_id INTEGER NOT NULL, show_id INTEGER NOT NULL,
        track_id INTEGER, position INTEGER DEFAULT 0,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
        FOREIGN KEY (show_id) REFERENCES shows (id) ON DELETE CASCADE,
        FOREIGN KEY (track_id) REFERENCES show_tracks (id) ON DELETE CASCADE
      )
    `);

    await safeQuery(client, 'Show tags table', `
      CREATE TABLE IF NOT EXISTS show_tags (
        id SERIAL PRIMARY KEY, show_id INTEGER NOT NULL, tag_id INTEGER NOT NULL,
        FOREIGN KEY (show_id) REFERENCES shows (id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
        UNIQUE(show_id, tag_id)
      )
    `);

    // Migrations for existing databases
    await safeQuery(client, 'Add url column', `ALTER TABLE background_images ADD COLUMN IF NOT EXISTS url TEXT`);
    await safeQuery(client, 'Add series_id column', `ALTER TABLE shows ADD COLUMN IF NOT EXISTS series_id INTEGER REFERENCES series(id) ON DELETE SET NULL`);
    await safeQuery(client, 'Add cover_image column to series', `ALTER TABLE series ADD COLUMN IF NOT EXISTS cover_image TEXT`);
    await safeQuery(client, 'Add episode_number column', `ALTER TABLE shows ADD COLUMN IF NOT EXISTS episode_number INTEGER`);

    // Insert default pages
    const defaultPages = ['about', 'events', 'contact', 'live_label'];
    for (const pageName of defaultPages) {
      const defaultContent = pageName === 'live_label' ? 'LIVE NOW' : '';
      await safeQuery(client, `Default page: ${pageName}`,
        `INSERT INTO page_content (page_name, content) VALUES ($1, $2) ON CONFLICT (page_name) DO NOTHING`,
        [pageName, defaultContent]
      );
    }

    // Create indexes
    await safeQuery(client, 'Index: show_tracks.show_id', `CREATE INDEX IF NOT EXISTS idx_show_tracks_show_id ON show_tracks(show_id)`);
    await safeQuery(client, 'Index: show_tracks.is_active', `CREATE INDEX IF NOT EXISTS idx_show_tracks_active ON show_tracks(is_active)`);
    await safeQuery(client, 'Index: shows.is_active', `CREATE INDEX IF NOT EXISTS idx_shows_active ON shows(is_active)`);
    await safeQuery(client, 'Index: show_tags.show_id', `CREATE INDEX IF NOT EXISTS idx_show_tags_show_id ON show_tags(show_id)`);
    await safeQuery(client, 'Index: show_tags.tag_id', `CREATE INDEX IF NOT EXISTS idx_show_tags_tag_id ON show_tags(tag_id)`);
    await safeQuery(client, 'Index: shows.series_id', `CREATE INDEX IF NOT EXISTS idx_shows_series_id ON shows(series_id)`);

    console.log('✅ Database schema is up to date');
  } finally {
    client.release();
  }
}

module.exports = db;
