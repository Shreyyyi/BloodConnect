require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const donorRoutes = require("./routes/donors");
const campRoutes = require("./routes/camps");
const hospitalRoutes = require("./routes/hospitals");
const sosRoutes = require("./routes/sos");
const contactRoutes = require("./routes/contact");
const statsRoutes = require("./routes/stats");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/donors", donorRoutes);
app.use("/api/camps", campRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/sos", sosRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/stats", statsRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "BloodConnect API", version: "1.0.0" });
});

const publicDir = path.join(__dirname, "..");
app.use(express.static(publicDir));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API route not found" });
  }
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`BloodConnect server running at http://localhost:${PORT}`);
});
