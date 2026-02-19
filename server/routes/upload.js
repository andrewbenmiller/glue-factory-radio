const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const mp3Duration = require('mp3-duration');
const cloudStorage = require('../services/cloudStorage');

// Function to extract track order number from filename (e.g., "03 - Song.mp3" -> 3, "Song.mp3" -> null)
function extractTrackOrderFromFilename(filename) {
  const name = path.parse(filename).name;
  const match = name.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// Function to extract track name from filename
function extractTrackNameFromFilename(filename) {
  // Remove file extension
  let trackName = path.parse(filename).name;
  
  // Replace underscores with spaces (but keep hyphens, colons, parentheses, brackets)
  trackName = trackName.replace(/_/g, ' ');
  
  // Remove leading numbers and optional separators (e.g., "01 - ", "01-", "01.")
  trackName = trackName.replace(/^\d+\s*[-.\s]*\s*/g, '');
  
  // Clean up multiple spaces (but preserve single spaces around preserved characters)
  trackName = trackName.replace(/\s+/g, ' ').trim();
  
  // Capitalize first letter of each word (but preserve special characters)
  // Split by spaces, but be careful with words that contain preserved characters
  trackName = trackName.split(' ').map(word => {
    // Skip capitalization if word is empty or just special characters
    if (!word || /^[-:()\[\]]+$/.test(word)) {
      return word;
    }
    // Capitalize first letter, keep the rest as-is to preserve special characters
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
  
  // If empty after cleaning, use the original filename without extension
  if (!trackName) {
    trackName = path.parse(filename).name;
  }
  
  return trackName;
}

// Function to extract audio duration from MP3 files using metadata
async function extractAudioDuration(filePath) {
  try {
    console.log('🎵 Extracting duration for:', filePath);
    
    // Use mp3-duration to read the actual MP3 metadata
    const duration = await new Promise((resolve, reject) => {
      mp3Duration(filePath, (err, duration) => {
        if (err) {
          reject(err);
        } else {
          resolve(duration);
        }
      });
    });
    
    if (duration && !isNaN(duration)) {
      console.log('✅ Duration extracted from MP3 metadata:', duration, 'seconds');
      return Math.round(duration); // Round to nearest second
    } else {
      console.warn('⚠️ No valid duration found in MP3 metadata, using 0');
      return 0;
    }
  } catch (error) {
    console.error('❌ Error extracting duration from MP3 metadata:', error);
    return 0;
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/\s+/g, '_');
    const filename = `${timestamp}_${originalName}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB limit
  },
  fileFilter: (req, file, cb) => {
    // More flexible audio file detection
    const allowedMimeTypes = /audio\/(mp3|wav|ogg|aac|flac|m4a|mpeg)/;
    const allowedExtensions = /\.(mp3|wav|ogg|aac|flac|m4a|mpeg)$/i;
    
    // Check MIME type first
    if (allowedMimeTypes.test(file.mimetype)) {
      cb(null, true);
    }
    // Fallback to file extension check
    else if (allowedExtensions.test(file.originalname)) {
      cb(null, true);
    }
    // If neither works, still allow but log a warning
    else {
      console.log(`⚠️ File type warning: ${file.originalname} (${file.mimetype})`);
      cb(null, true);
    }
  }
});

// Configure multer for image uploads
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/\s+/g, '_');
    const filename = `${timestamp}_${originalName}`;
    cb(null, filename);
  }
});

const imageUpload = multer({
  storage: imageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for images
  },
  fileFilter: (req, file, cb) => {
    // Only allow JPG/JPEG images
    const allowedMimeTypes = /image\/(jpeg|jpg)/;
    const allowedExtensions = /\.(jpg|jpeg)$/i;
    
    if (allowedMimeTypes.test(file.mimetype) || allowedExtensions.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG/JPEG images are allowed'), false);
    }
  }
});

// Upload audio track(s) to existing show
router.post('/track', upload.array('audio', 50), async (req, res) => {
  try {
    console.log('📤 Track upload request received:', {
      body: req.body,
      files: req.files,
      filesCount: req.files ? req.files.length : 0
    });

    const { showId, trackTitle } = req.body;
    const audioFiles = req.files || [];

    if (!showId) {
      return res.status(400).json({ error: 'Show ID is required' });
    }

    if (audioFiles.length === 0) {
      return res.status(400).json({ error: 'At least one audio file is required' });
    }

    // Check if show exists
    const show = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM shows WHERE id = ?', [showId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    // Get next fallback track order for files without a number prefix
    const orderResult = await new Promise((resolve, reject) => {
      db.get('SELECT MAX(track_order) as max_order FROM show_tracks WHERE show_id = ?', [showId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    let fallbackOrder = (orderResult.max_order || 0) + 1;
    const tracks = [];

    // Process all uploaded files
    for (const audioFile of audioFiles) {
      try {
        console.log('📁 Processing file:', {
          filename: audioFile.filename,
          originalname: audioFile.originalname
        });

        // Extract duration from the uploaded file
        const filePath = path.join(__dirname, '../uploads', audioFile.filename);
        const duration = await extractAudioDuration(filePath);

        // Upload to cloud storage (R2)
        const storageResult = await cloudStorage.uploadFile(filePath, audioFile.filename);

        if (!storageResult.success) {
          console.error('Cloud storage upload failed for:', audioFile.filename);
          continue; // Skip this file but continue with others
        }

        // Determine track title: use provided trackTitle for first file, or extract from filename
        let trackTitleToUse;
        if (tracks.length === 0 && trackTitle && trackTitle.trim()) {
          trackTitleToUse = trackTitle.trim();
        } else {
          trackTitleToUse = extractTrackNameFromFilename(audioFile.originalname);
        }

        // Determine track order: use number prefix from filename, or append at end
        const filenameOrder = extractTrackOrderFromFilename(audioFile.originalname);
        const trackOrder = filenameOrder !== null ? filenameOrder : fallbackOrder++;

        // Insert track into database
        await new Promise((resolve, reject) => {
          db.run(`
            INSERT INTO show_tracks (show_id, title, filename, file_size, track_order, duration)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [showId, trackTitleToUse, audioFile.filename, audioFile.size, trackOrder, duration], function(err) {
            if (err) {
              console.error('Error creating track:', err);
              reject(err);
            } else {
              tracks.push({
                id: this.lastID,
                title: trackTitleToUse,
                filename: audioFile.filename,
                track_order: trackOrder,
                duration: duration
              });
              resolve();
            }
          });
        });

      } catch (fileError) {
        console.error('Error processing file:', audioFile.filename, fileError);
        // Continue with next file
      }
    }

    if (tracks.length === 0) {
      return res.status(500).json({ error: 'Failed to process any audio files' });
    }

    // Update show totals
    const totalDuration = await new Promise((resolve, reject) => {
      db.get('SELECT COALESCE(SUM(duration), 0) as total FROM show_tracks WHERE show_id = ? AND is_active = true', [showId], (err, row) => {
        if (err) reject(err);
        else resolve(row.total || 0);
      });
    });

    const totalTracks = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM show_tracks WHERE show_id = ?', [showId], (err, row) => {
        if (err) reject(err);
        else resolve(row.count || 0);
      });
    });

    await new Promise((resolve, reject) => {
      db.run('UPDATE shows SET total_tracks = ?, total_duration = ? WHERE id = ?',
        [totalTracks, totalDuration, showId], (err) => {
          if (err) reject(err);
          else resolve();
        });
    });

    res.json({
      message: `${tracks.length} track(s) uploaded successfully`,
      tracks: tracks
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new show with tracks (supports single or bulk upload)
router.post('/show', upload.array('audio', 50), async (req, res) => {
  try {
    console.log('📤 Show creation request received:', { 
      body: req.body, 
      files: req.files,
      filesCount: req.files ? req.files.length : 0
    });
    
    const { title, description, trackTitle, tags: tagsRaw } = req.body;
    const audioFiles = req.files || [];

    if (!title) {
      return res.status(400).json({ error: 'Show title is required' });
    }

    // Support both single file (with trackTitle) and multiple files (names from filenames)
    if (audioFiles.length === 0) {
      return res.status(400).json({ error: 'At least one audio file is required' });
    }

    // Create the show first
    db.run(`
      INSERT INTO shows (title, description)
      VALUES (?, ?)
    `, [title, description || ''], async function(err) {
      if (err) {
        console.error('Error creating show:', err);
        return res.status(500).json({ error: 'Failed to create show' });
      }

      // Get the show ID - works for both SQLite (this.lastID) and PostgreSQL
      let showId = this.lastID;
      
      // If lastID is not available (PostgreSQL wrapper issue), query for it
      if (!showId) {
        await new Promise((resolve, reject) => {
          db.get('SELECT id FROM shows WHERE title = ? ORDER BY created_date DESC LIMIT 1', [title], (err, row) => {
            if (err) {
              reject(err);
            } else {
              showId = row ? row.id : null;
              resolve();
            }
          });
        });
      }
      
      if (!showId) {
        return res.status(500).json({ error: 'Failed to get show ID after creation' });
      }
      const tracks = [];
      let totalDuration = 0;
      let fallbackOrder = 1;
      let isFirstTrack = true;

      // Process all uploaded files
      for (const audioFile of audioFiles) {
        try {
          console.log('📁 Processing file:', {
            filename: audioFile.filename,
            originalname: audioFile.originalname
          });

          // Extract duration from the uploaded file
          const filePath = path.join(__dirname, '../uploads', audioFile.filename);
          const duration = await extractAudioDuration(filePath);
          totalDuration += duration;

          // Upload to cloud storage (R2)
          const storageResult = await cloudStorage.uploadFile(filePath, audioFile.filename);

          if (!storageResult.success) {
            console.error('Cloud storage upload failed for:', audioFile.filename);
            continue; // Skip this file but continue with others
          }

          // Determine track title: use provided trackTitle for first track, or extract from filename
          let trackTitleToUse;
          if (isFirstTrack && trackTitle) {
            // Use provided title for first track if given
            trackTitleToUse = trackTitle;
          } else {
            // Extract track name from filename
            trackTitleToUse = extractTrackNameFromFilename(audioFile.originalname);
          }

          // Determine track order: use number prefix from filename, or assign sequentially
          const filenameOrder = extractTrackOrderFromFilename(audioFile.originalname);
          const trackOrder = filenameOrder !== null ? filenameOrder : fallbackOrder++;

          // Insert track into database
          await new Promise((resolve, reject) => {
            db.run(`
              INSERT INTO show_tracks (show_id, title, filename, file_size, track_order, duration)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [showId, trackTitleToUse, audioFile.filename, audioFile.size, trackOrder, duration], function(err) {
              if (err) {
                console.error('Error creating track:', err);
                reject(err);
              } else {
                tracks.push({
                  id: this.lastID,
                  title: trackTitleToUse,
                  filename: audioFile.filename,
                  track_order: trackOrder,
                  duration: duration
                });
                isFirstTrack = false;
                resolve();
              }
            });
          });

        } catch (fileError) {
          console.error('Error processing file:', audioFile.filename, fileError);
          // Continue with next file
        }
      }

      // Update show totals
      await new Promise((resolve, reject) => {
        db.run(`
          UPDATE shows
          SET total_tracks = ?,
              total_duration = ?
          WHERE id = ?
        `, [tracks.length, totalDuration, showId], (err) => {
          if (err) console.error('Error updating show totals:', err);
          resolve();
        });
      });

      // Process tags if provided (comes as comma-separated string from FormData)
      let tagNames = [];
      if (tagsRaw) {
        try {
          tagNames = JSON.parse(tagsRaw);
        } catch (e) {
          tagNames = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
        }
      }

      for (const tagName of tagNames) {
        const trimmed = tagName.trim().toLowerCase();
        if (!trimmed) continue;

        await new Promise((resolve, reject) => {
          db.run('INSERT INTO tags (name) VALUES (?) ON CONFLICT (name) DO NOTHING', [trimmed], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        const tag = await new Promise((resolve, reject) => {
          db.get('SELECT id FROM tags WHERE name = ?', [trimmed], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (tag) {
          await new Promise((resolve, reject) => {
            db.run('INSERT INTO show_tags (show_id, tag_id) VALUES (?, ?) ON CONFLICT (show_id, tag_id) DO NOTHING', [showId, tag.id], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }
      }

      // Get the created show
      const show = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM shows WHERE id = ?', [showId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      res.json({
        message: `Show created successfully with ${tracks.length} track(s)`,
        show: {
          id: show.id,
          title: show.title,
          description: show.description,
          created_date: show.created_date,
          is_active: show.is_active,
          total_duration: show.total_duration,
          total_tracks: show.total_tracks
        },
        tracks: tracks
      });
    });

  } catch (error) {
    console.error('Show creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload background image
router.post('/background-image', imageUpload.single('image'), async (req, res) => {
  try {
    console.log('🖼️ Background image upload request received:', { file: req.file });
    
    const imageFile = req.file;

    if (!imageFile) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const filename = imageFile.filename;
    const originalName = imageFile.originalname;
    const size = imageFile.size;
    
    // Upload to cloud storage (R2)
    const filePath = path.join(__dirname, '../uploads', filename);
    const storageResult = await cloudStorage.uploadFile(filePath, `images/${filename}`);
    
    if (!storageResult.success) {
      console.error('Cloud storage upload failed:', storageResult.error);
      return res.status(500).json({ error: 'Failed to upload image to storage' });
    }

    // Insert image into database
    const query = `
      INSERT INTO background_images (filename, original_name, file_size, url)
      VALUES (?, ?, ?, ?)
    `;
    
    db.run(query, [filename, originalName, size, storageResult.url], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to save image to database' });
      }

      const imageId = this.lastID;

      // Get the created image
      db.get('SELECT * FROM background_images WHERE id = ?', [imageId], (err, image) => {
        if (err) {
          return res.status(500).json({ error: 'Image uploaded but failed to retrieve' });
        }

        res.json({
          message: 'Background image uploaded successfully',
          image: {
            ...image,
            url: `https://glue-factory-radio-production.up.railway.app/api/images/${filename}`
          }
        });
      });
    });

  } catch (error) {
    console.error('Background image upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all background images
router.get('/background-images', (req, res) => {
  try {
    db.all('SELECT * FROM background_images ORDER BY upload_date DESC', [], (err, images) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch background images' });
      }

      // Use proxy route for images (similar to audio files)
      const imagesWithUrls = images.map(image => ({
        ...image,
        url: `https://glue-factory-radio-production.up.railway.app/api/images/${image.filename}`
      }));

      res.json(imagesWithUrls);
    });
  } catch (error) {
    console.error('Error fetching background images:', error);
    res.status(500).json({ error: 'Cannot fetch background images' });
  }
});

// Get all uploaded files
router.get('/files', (req, res) => {
  const uploadsDir = path.join(__dirname, '../uploads');
  
  try {
    if (!fs.existsSync(uploadsDir)) {
      return res.json([]);
    }

    const files = fs.readdirSync(uploadsDir);
    const fileList = files
      .filter(file => !file.startsWith('.') && file !== '.gitkeep')
      .map(file => {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          uploadDate: stats.mtime,
          url: `/uploads/${file}`
        };
      });
    
    res.json(fileList);
  } catch (error) {
    console.error('Error reading uploads directory:', error);
    res.status(500).json({ error: 'Cannot read uploads directory' });
  }
});

// Error handling middleware for multer errors
router.use((error, req, res, next) => {
  console.error('🚨 Upload route error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 1GB.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Only one file allowed.' });
    }
  }
  
  // Generic error response
  res.status(500).json({ 
    error: 'Upload failed', 
    message: error.message || 'Unknown error occurred'
  });
});

// PUT toggle background image active status (ensures only one is active at a time)
router.put('/background/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    console.log('🔄 Background image toggle request for ID:', id, 'is_active:', is_active);
    
    // If we're activating this image, deactivate all others first
    if (is_active) {
      db.run('UPDATE background_images SET is_active = false', [], (err) => {
        if (err) {
          console.error('Error deactivating other images:', err);
          return res.status(500).json({ error: 'Failed to deactivate other images' });
        }
        
        // Now activate the selected image
        db.run('UPDATE background_images SET is_active = true WHERE id = ?', [id], function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to activate image' });
          }
          
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Background image not found' });
          }
          
          console.log('✅ Background image activated, others deactivated');
          res.json({ message: 'Background image activated successfully' });
        });
      });
    } else {
      // If we're deactivating, just update this image
      db.run('UPDATE background_images SET is_active = false WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to deactivate image' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Background image not found' });
        }
        
        console.log('✅ Background image deactivated');
        res.json({ message: 'Background image deactivated successfully' });
      });
    }
    
  } catch (error) {
    console.error('Error toggling background image:', error);
    res.status(500).json({ error: 'Failed to toggle background image' });
  }
});

// DELETE background image (hard delete - removes from database and cloud storage)
router.delete('/background/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Background image delete request for ID:', id);
    
    // First, get the image info to delete from cloud storage
    db.get('SELECT * FROM background_images WHERE id = ?', [id], async (err, image) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch image info' });
      }
      
      if (!image) {
        return res.status(404).json({ error: 'Background image not found' });
      }
      
      console.log('📋 Image to delete:', image);
      
      // Delete from cloud storage (R2)
      try {
        const cloudStorage = require('../services/cloudStorage');
        const deleteResult = await cloudStorage.deleteFile(image.filename);
        if (!deleteResult.success) {
          console.error('Error deleting file from R2:', deleteResult.error);
          // Continue with database deletion even if cloud deletion fails
        } else {
          console.log('✅ File deleted from R2:', image.filename);
        }
      } catch (deleteErr) {
        console.error('Error deleting file from R2:', deleteErr);
        // Continue with database deletion even if cloud deletion fails
      }
      
      // Hard delete the image from database
      db.run('DELETE FROM background_images WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to delete image from database' });
        }
        
        console.log('✅ Background image deleted from database');
        res.json({ message: 'Background image deleted successfully' });
      });
    });
    
  } catch (error) {
    console.error('Error deleting background image:', error);
    res.status(500).json({ error: 'Failed to delete background image' });
  }
});

module.exports = router;
