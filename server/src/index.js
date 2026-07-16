"use strict";

/**
 * ParkingFriend REST API entry point.
 *   npm run seed   — load demo data from the app's src/data JSONs
 *   npm start      — serve on PORT (default 4000)
 */

const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Tiny request log (method path -> status ms)
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt}ms)`);
  });
  next();
});

app.get("/health", (req, res) => {
  res.json({ ok: true, db: db.backend });
});

app.use("/api", require("./routes/auth")); // /api/auth/*, /api/me
app.use("/api/spots", require("./routes/spots"));
app.use("/api/host", require("./routes/host"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/wallet", require("./routes/wallet"));
app.use("/api/ratings", require("./routes/ratings"));

// 404 for anything unmatched
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Central error handler — bad JSON bodies, unexpected throws, etc. Never crash.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && (err.type === "entity.parse.failed" || err instanceof SyntaxError)) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  console.error("[api] Unhandled error:", err);
  const status = err && Number.isInteger(err.status) ? err.status : 500;
  res.status(status).json({ error: status === 500 ? "Internal server error" : String(err.message || err) });
});

const PORT = Number(process.env.PORT) || 4000;
// Make sure the schema exists (libsql is async) before accepting traffic.
db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`ParkingFriend API listening on http://localhost:${PORT} (db: ${db.backend})`);
    });
  })
  .catch((err) => {
    console.error("[db] Failed to initialize database:", err);
    process.exit(1);
  });

module.exports = app;
