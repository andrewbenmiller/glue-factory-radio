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

// Serve uploads directory with better path handling
const uploadsPath = path.join(__dirname, "uploads");
console.log(`📁 Uploads directory path: ${uploadsPath}`);

// Create uploads directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log(`📁 Created uploads directory: ${uploadsPath}`);
}

app.use("/uploads", express.static(uploadsPath));

// Serve the upload test page
app.get("/upload-test", (req, res) => {
  res.sendFile(path.join(__dirname, "upload-test.html"));
});

app.use("/api/shows", require("./routes/shows"));
app.use("/api/upload", require("./routes/upload"));

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Glue Factory Radio Server is running!",
    timestamp: new Date().toISOString() 
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!", message: err.message });
});

app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`🚀 Glue Factory Radio Server running on port ${PORT}`);
  console.log(`📍 Health check: /api/health`);
  console.log(`📁 Uploads served from: /uploads`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
