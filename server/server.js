const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5001;

// Configure CORS for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'https://glue-factory-radio-production.up.railway.app',
      'https://glue-factory-radio-production.up.railway.app/',
      'https://glue-factory-radio.vercel.app',
      'https://radio.gluefactorymusic.com',
      process.env.CORS_ORIGIN
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Configure Helmet to allow inline JavaScript for admin portal
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for now to fix audio issues
  crossOriginOpenerPolicy: false, // Disable COOP to allow audio
  crossOriginResourcePolicy: false, // Disable CORP to allow audio
}));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the upload test page
app.get("/upload-test", (req, res) => {
  res.sendFile(path.join(__dirname, "upload-test.html"));
});

// Serve the upload test JavaScript file with correct MIME type
app.get("/upload-test.js", (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, "upload-test.js"));
});

// Serve the admin portal
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// Serve the admin JavaScript file with correct MIME type
app.get("/admin.js", (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, "admin.js"));
});

// Serve the JavaScript test page
app.get("/javascript-test", (req, res) => {
  res.sendFile(path.join(__dirname, "javascript-test.html"));
});

// API routes
app.use("/api/shows", require("./routes/shows"));
app.use("/api/upload", require("./routes/upload"));

// Handle OPTIONS preflight for audio files
app.options("/api/audio/:filename", (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.sendStatus(200);
});

// Image proxy route for R2 files
app.get("/api/images/:filename", async (req, res) => {
  const { filename } = req.params;
  
  // Add CORS headers for images
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges');
  
  try {
    const cloudStorage = require('./services/cloudStorage');
    
    if (!cloudStorage.isConfigured()) {
      return res.status(500).json({ error: 'Cloud storage not configured' });
    }

    // Construct the key for the image in R2
    const key = `uploads/images/${filename}`;
    
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
    });
    
    const response = await cloudStorage.s3Client.send(command);
    
    // Set appropriate headers for images
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', response.ContentLength);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    // Stream the image data
    response.Body.pipe(res);
    
  } catch (error) {
    console.error('Error serving image from R2:', error);
    res.status(404).json({ error: 'Image not found' });
  }
});

// Audio proxy route for R2 files
const { GetObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");

app.get("/api/audio/:filename", async (req, res) => {
  const { filename } = req.params;

  // CORS (keep if you need cross-origin web playback)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range");
  res.setHeader("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length");

  try {
    const cloudStorage = require("./services/cloudStorage");
    const Bucket = process.env.S3_BUCKET_NAME;
    const Key = `uploads/${filename}`;

    // We need the true total size for Content-Range math.
    // R2/S3 doesn't always include ContentLength on ranged GetObject the way you want,
    // so do a HEAD once.
    const head = await cloudStorage.s3Client.send(
      new HeadObjectCommand({ Bucket, Key })
    );

    const total = Number(head.ContentLength || 0);
    const contentType = head.ContentType || "audio/mpeg";

    const range = req.headers.range;

    // No range -> stream full file
    if (!range) {
      res.status(200);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", total);
      res.setHeader("Accept-Ranges", "bytes");

      const obj = await cloudStorage.s3Client.send(
        new GetObjectCommand({ Bucket, Key })
      );

      return obj.Body.pipe(res);
    }

    // Parse range: "bytes=start-end"
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!match) {
      // Malformed Range
      res.status(416);
      res.setHeader("Content-Range", `bytes */${total}`);
      return res.end();
    }

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : total - 1;

    // Validate
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= total) {
      res.status(416);
      res.setHeader("Content-Range", `bytes */${total}`);
      return res.end();
    }

    const chunkSize = end - start + 1;

    res.status(206);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
    res.setHeader("Content-Length", chunkSize);

    // ✅ Critical: request the *range* from R2/S3
    const obj = await cloudStorage.s3Client.send(
      new GetObjectCommand({
        Bucket,
        Key,
        Range: `bytes=${start}-${end}`,
      })
    );

    return obj.Body.pipe(res);
  } catch (error) {
    console.error("Error streaming audio file:", error);
    res.status(404).json({ error: "Audio file not found" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Glue Factory Radio Server is running!",
    timestamp: new Date().toISOString() 
  });
});

// Serve uploads directory AFTER API routes to avoid conflicts
const uploadsPath = path.join(__dirname, "uploads");
console.log(`📁 Uploads directory path: ${uploadsPath}`);

// Create uploads directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log(`📁 Created uploads directory: ${uploadsPath}`);
}

// Handle OPTIONS preflight for uploads
app.options("/uploads/:filename", (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.sendStatus(200);
});

// Serve individual files from uploads directory
app.get("/uploads/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsPath, filename);
  
  if (fs.existsSync(filePath)) {
    // Add CORS headers for audio files
    res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges');
    
    // Handle range requests for audio streaming
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg'
      });
      
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes'
      });
      
      fs.createReadStream(filePath).pipe(res);
    }
  } else {
    res.status(404).json({ error: "File not found" });
  }
});

// List files in uploads directory
app.get("/uploads", (req, res) => {
  try {
    const files = fs.readdirSync(uploadsPath);
    const fileList = files
      .filter(file => !file.startsWith('.') && file !== '.gitkeep')
      .map(file => {
        const filePath = path.join(uploadsPath, file);
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
    res.status(500).json({ error: "Cannot read uploads directory" });
  }
});

// Test endpoint to check uploads directory
app.get("/test-uploads", (req, res) => {
  try {
    const files = fs.readdirSync(uploadsPath);
    res.json({ 
      message: "Uploads directory accessible",
      path: uploadsPath,
      files: files,
      exists: fs.existsSync(uploadsPath)
    });
  } catch (error) {
    res.status(500).json({ 
      error: "Cannot access uploads directory",
      message: error.message,
      path: uploadsPath
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!", message: err.message });
});

// Catch-all route - must be LAST
app.use("*", (req, res) => {
  console.log(`🚫 Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`🚀 Glue Factory Radio Server running on port ${PORT}`);
  console.log(`📍 Health check: /api/health`);
  console.log(`📁 Uploads served from: /uploads`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
