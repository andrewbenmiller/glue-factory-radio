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
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(helmet());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the upload test page
app.get("/upload-test", (req, res) => {
  res.sendFile(path.join(__dirname, "upload-test.html"));
});

// API routes
app.use("/api/shows", require("./routes/shows"));
app.use("/api/upload", require("./routes/upload"));

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

// Serve individual files from uploads directory
app.get("/uploads/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsPath, filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
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
