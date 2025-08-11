const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../config/database');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${originalName}`;
    cb(null, filename);
  }
});

// File filter for audio files
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/aac',
    'audio/flac'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed!'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 1 // Only one file at a time
  }
});

// POST upload single audio file
router.post('/audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, description } = req.body;
    const { filename, originalname, size, path: filePath } = req.file;

    if (!title) {
      // Delete uploaded file if no title provided
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Title is required' });
    }

    // Get audio duration (you can enhance this later with audio metadata libraries)
    let duration = 0;
    
    // For now, we'll set a default duration
    // Later you can use libraries like 'get-audio-duration' or 'ffprobe' to get actual duration
    
    // Create show record in database
    const query = `
      INSERT INTO shows (title, description, filename, file_size, duration)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    db.run(query, [title, description, filename, size, duration], function(err) {
      if (err) {
        console.error('Error saving show to database:', err);
        // Delete uploaded file if database save fails
        fs.unlinkSync(filePath);
        return res.status(500).json({ error: 'Failed to save show information' });
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
        
        res.status(201).json({
          message: 'File uploaded successfully',
          show: show,
          file: {
            filename: filename,
            originalName: originalname,
            size: size,
            url: `/uploads/${filename}`
          }
        });
      });
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up uploaded file if there's an error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file after upload error:', unlinkError);
      }
    }
    
    res.status(500).json({ error: 'Upload failed', message: error.message });
  }
});

// GET list of uploaded files
router.get('/files', (req, res) => {
  const uploadDir = path.join(__dirname, '../uploads');
  
  if (!fs.existsSync(uploadDir)) {
    return res.json([]);
  }
  
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      console.error('Error reading uploads directory:', err);
      return res.status(500).json({ error: 'Failed to read uploads directory' });
    }
    
    const fileList = files
      .filter(file => !file.startsWith('.')) // Exclude hidden files
      .map(file => {
        const filePath = path.join(uploadDir, file);
        const stats = fs.statSync(filePath);
        
        return {
          filename: file,
          size: stats.size,
          uploadDate: stats.mtime,
          url: `/uploads/${file}`
        };
      });
    
    res.json(fileList);
  });
});

// DELETE uploaded file
router.delete('/files/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '../uploads', filename);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  try {
    // Delete file from filesystem
    fs.unlinkSync(filePath);
    
    // Remove from database (soft delete)
    db.run('UPDATE shows SET is_active = 0 WHERE filename = ?', [filename], function(err) {
      if (err) {
        console.error('Error updating database:', err);
        // File deleted but database update failed
        return res.status(500).json({ 
          warning: 'File deleted but database update failed',
          error: err.message 
        });
      }
      
      res.json({ message: 'File deleted successfully' });
    });
    
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file', message: error.message });
  }
});

// Error handling for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 100MB.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Only one file allowed.' });
    }
  }
  
  if (error.message === 'Only audio files are allowed!') {
    return res.status(400).json({ error: error.message });
  }
  
  next(error);
});

module.exports = router;
