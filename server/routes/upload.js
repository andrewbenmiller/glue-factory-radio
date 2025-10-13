const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const mp3Duration = require('mp3-duration');
const cloudStorage = require('../services/cloudStorage');

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
    fileSize: 100 * 1024 * 1024, // 100MB limit
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
    const uploadsDir = path.join(__dirname, '../uploads/images');
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

// Upload audio track to existing show
router.post('/track', upload.single('audio'), async (req, res) => {
  try {
    console.log('📤 Track upload request received:', { body: req.body, file: req.file });
    
    const { showId, title } = req.body;
    const audioFile = req.file;

    if (!showId || !title || !audioFile) {
      return res.status(400).json({ error: 'Show ID, title, and audio file are required' });
    }

    // Check if show exists
    db.get('SELECT * FROM shows WHERE id = ?', [showId], (err, show) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!show) {
        return res.status(404).json({ error: 'Show not found' });
      }

      // Get next track order for this show
      db.get('SELECT MAX(track_order) as max_order FROM show_tracks WHERE show_id = ?', [showId], (err, result) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        const nextOrder = (result.max_order || 0) + 1;
        const filename = audioFile.filename;
        const size = audioFile.size;
        
        // Extract duration from the uploaded file
        const filePath = path.join(__dirname, '../uploads', filename);
        
        extractAudioDuration(filePath).then(duration => {
          // Upload to cloud storage (R2)
          cloudStorage.uploadFile(filePath, filename).then(storageResult => {
            if (!storageResult.success) {
              console.error('Cloud storage upload failed:', storageResult.error);
              return res.status(500).json({ error: 'Failed to upload file to storage' });
            }

                      // Insert track with cloud storage URL
            const query = `
              INSERT INTO show_tracks (show_id, title, filename, file_size, track_order, duration)
              VALUES (?, ?, ?, ?, ?, ?)
              RETURNING id
            `;
            
            console.log('🗄️ Database query:', query);
            console.log('🗄️ Database values:', [showId, title, filename, size, nextOrder, duration]);

            db.run(query, [showId, title, filename, size, nextOrder, duration], function(err, result) {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to save track to database' });
              }

              const trackId = result.rows[0].id;

              // Update show totals
              db.run(`
                UPDATE shows 
                SET total_tracks = total_tracks + 1,
                    total_duration = (
                      SELECT COALESCE(SUM(duration), 0) 
                      FROM show_tracks 
                      WHERE show_id = ? AND is_active = true
                    )
                WHERE id = ?
              `, [showId, showId], (err) => {
                if (err) {
                  console.error('Error updating show totals:', err);
                }
              });

              // Get the created track
              db.get('SELECT * FROM show_tracks WHERE id = ?', [trackId], (err, track) => {
                if (err) {
                  return res.status(500).json({ error: 'Track created but failed to retrieve' });
                }

                res.json({
                  message: 'Track uploaded successfully',
                  track: {
                    ...track,
                    url: storageResult.url // Use cloud storage URL
                  }
                });
              });
            });
          }).catch(error => {
            console.error('Error uploading to cloud storage:', error);
            res.status(500).json({ error: 'Failed to upload file to cloud storage' });
          });
        }).catch(error => {
          console.error('Error extracting audio duration:', error);
          res.status(500).json({ error: 'Failed to process audio file' });
        });
      });
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new show with first track
router.post('/show', upload.single('audio'), async (req, res) => {
  try {
    console.log('📤 Show creation request received:', { body: req.body, file: req.file });
    
    const { title, description, trackTitle } = req.body;
    const audioFile = req.file;

    if (!title || !trackTitle || !audioFile) {
      return res.status(400).json({ error: 'Show title, track title, and audio file are required' });
    }

    console.log('📁 File details:', { 
      filename: audioFile.filename, 
      originalname: audioFile.originalname, 
      mimetype: audioFile.mimetype,
      size: audioFile.size 
    });

    // Extract duration from the uploaded file
    const filePath = path.join(__dirname, '../uploads', audioFile.filename);
    const duration = await extractAudioDuration(filePath);

    // Upload to cloud storage (R2)
    const storageResult = await cloudStorage.uploadFile(filePath, audioFile.filename);
    
    if (!storageResult.success) {
      console.error('Cloud storage upload failed:', storageResult.error);
      return res.status(500).json({ error: 'Failed to upload file to storage' });
    }

    // Create the show first
    db.run(`
      INSERT INTO shows (title, description)
      VALUES (?, ?)
      RETURNING id
    `, [title, description], function(err, result) {
      if (err) {
        console.error('Error creating show:', err);
        return res.status(500).json({ error: 'Failed to create show' });
      }

      const showId = result.rows[0].id;
      
      // Create the first track for this show
      db.run(`
        INSERT INTO show_tracks (show_id, title, filename, file_size, track_order, duration)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id
      `, [showId, trackTitle, audioFile.filename, audioFile.size, 1, duration], function(err, result) {
        if (err) {
          console.error('Error creating track:', err);
          return res.status(500).json({ error: 'Failed to create track' });
        }

        const trackId = result.rows[0].id;

        // Update show totals
        db.run(`
          UPDATE shows 
          SET total_tracks = 1,
              total_duration = ?
          WHERE id = ?
        `, [duration, showId], (err) => {
          if (err) {
            console.error('Error updating show totals:', err);
          }
          
          // Get the created show with track
          db.get(`
            SELECT s.*, st.filename, st.duration, st.file_size
            FROM shows s
                          LEFT JOIN show_tracks st ON s.id = st.show_id AND st.is_active = true
            WHERE s.id = ?
          `, [showId], (err, result) => {
            if (err) {
              return res.status(500).json({ error: 'Show created but failed to retrieve' });
            }

            res.json({
              message: 'Show created successfully',
              show: {
                id: result.id,
                title: result.title,
                description: result.description,
                created_date: result.created_date,
                is_active: result.is_active,
                total_duration: result.total_duration,
                total_tracks: result.total_tracks,
                filename: result.filename,
                duration: result.duration,
                file_size: result.file_size,
                url: storageResult.url
              }
            });
          });
        });
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
    const filePath = path.join(__dirname, '../uploads/images', filename);
    const storageResult = await cloudStorage.uploadFile(filePath, `images/${filename}`);
    
    if (!storageResult.success) {
      console.error('Cloud storage upload failed:', storageResult.error);
      return res.status(500).json({ error: 'Failed to upload image to storage' });
    }

    // Insert image into database
    const query = `
      INSERT INTO background_images (filename, original_name, file_size)
      VALUES (?, ?, ?)
      RETURNING id
    `;
    
    db.run(query, [filename, originalName, size], function(err, result) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to save image to database' });
      }

      const imageId = result.rows[0].id;

      // Get the created image
      db.get('SELECT * FROM background_images WHERE id = ?', [imageId], (err, image) => {
        if (err) {
          return res.status(500).json({ error: 'Image uploaded but failed to retrieve' });
        }

        res.json({
          message: 'Background image uploaded successfully',
          image: {
            ...image,
            url: storageResult.url
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
    db.all('SELECT * FROM background_images WHERE is_active = true ORDER BY upload_date DESC', [], (err, images) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch background images' });
      }

      // Add full URLs to each image
      const imagesWithUrls = images.map(image => ({
        ...image,
        url: `https://glue-factory-radio-production.up.railway.app/uploads/images/${image.filename}`
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
      return res.status(400).json({ error: 'File too large. Maximum size is 100MB.' });
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

module.exports = router;
