const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(helmet());
app.use(morgan("combined"));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📁 Uploads served from: http://localhost:${PORT}/uploads`);
});

module.exports = app;
