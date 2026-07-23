"use strict";

/**
 * First-party telemetry ingestion (mounted at /api/telemetry).
 *
 *   POST /api/telemetry/events  -> { anonId, device, events: [{id, name, props?, at?, sessionId?}] }
 *   POST /api/telemetry/errors  -> { anonId, device, errors: [{id, message, stack?, fatal?, screen?, at?, sessionId?}] }
 *
 * DESIGN CONTRACT (frozen — shipped APKs depend on it):
 *   - Auth is OPTIONAL: a Bearer token attributes events to the user, no token
 *     attributes them to the anonymous device id. Never 401s.
 *   - Batches are idempotent: client-generated ids + INSERT OR IGNORE, so a
 *     retried batch after a network failure can never double-count.
 *   - Responses stay 2xx even for partially-invalid batches (bad rows are
 *     dropped) — telemetry must never make the app misbehave or retry-loop.
 *   - 410 Gone = kill-switch (TELEMETRY_DISABLED=1): clients stop sending for
 *     the rest of their session.
 * Everything else (metrics, dashboards, retention) is server-side and free to
 * evolve without app updates.
 */

const express = require("express");
const db = require("../db");
const { verifyToken } = require("../auth");

const router = express.Router();

const NAME_RE = /^[a-z0-9_.:-]{1,64}$/i;
const ID_RE = /^[a-z0-9_-]{6,64}$/i;
const MAX_EVENTS_PER_BATCH = 50;
const MAX_ERRORS_PER_BATCH = 10;
const MAX_PROPS_CHARS = 2000;

/* Rate limiting: telemetry is background traffic and must never be able to
 * flood the DB — but it also must never LOSE data from busy shared networks
 * (hospital WiFi, carrier CGNAT put thousands of phones behind one IP).
 * So the limit keys on the DEVICE (anonId) with a generous absolute per-IP
 * ceiling purely as flood protection. req.ip is proxy-validated ("trust
 * proxy" in index.js) — clients can't rotate identities via X-Forwarded-For.
 * In-memory is fine for one dyno; hard-capped so it can't grow unbounded. */
const buckets = new Map();
function bump(key, now, windowMs) {
  let b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (buckets.size > 20000) {
    for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
    // Still flooded after evicting expired entries: clearing resets counters
    // (fail-open for one window) but bounds memory absolutely.
    if (buckets.size > 50000) buckets.clear();
  }
  return b.count;
}
function rateLimited(req) {
  const now = Date.now();
  const ip = req.ip || "?";
  const anonId = typeof (req.body || {}).anonId === "string" ? req.body.anonId.slice(0, 64) : "";
  const perDevice = bump(`d:${ip}:${anonId}`, now, 60000);
  const perIp = bump(`ip:${ip}`, now, 60000);
  // 30/min/device ≈ 15x a legit client's cadence; 3000/min/IP only stops floods.
  return perDevice > 30 || perIp > 3000;
}

/** Bearer token → userId, or null. NEVER rejects — telemetry works signed-out. */
function optionalUserId(req) {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
  if (!match) return null;
  try {
    return verifyToken(match[1]).sub || null;
  } catch {
    return null;
  }
}

const str = (v, max) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/** Client timestamps are advisory; clamp anything unparseable/absurd to now. */
function clampClientAt(v) {
  const t = Date.parse(String(v || ""));
  if (!Number.isFinite(t)) return null;
  const now = Date.now();
  if (t > now + 5 * 60 * 1000 || t < now - 30 * 86400000) return null;
  return new Date(t).toISOString();
}

function deviceOf(body) {
  const d = (body && typeof body.device === "object" && body.device) || {};
  return {
    appVersion: str(d.appVersion, 32),
    platform: str(d.platform, 16),
    osVersion: str(String(d.osVersion ?? ""), 32),
    deviceModel: str(d.model, 64),
  };
}

router.post("/events", async (req, res, next) => {
  try {
    if (process.env.TELEMETRY_DISABLED === "1") {
      return res.status(410).json({ error: "Telemetry disabled" });
    }
    // 503, NOT 4xx: shipped clients treat 5xx as retryable (keep queue +
    // back off) — load-shedding must defer data, never destroy it.
    if (rateLimited(req)) return res.status(503).json({ error: "Busy — retry later" });

    const body = req.body || {};
    const userId = optionalUserId(req);
    const anonId = str(body.anonId, 64);
    const device = deviceOf(body);
    const list = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS_PER_BATCH) : [];
    const nowIso = new Date().toISOString();

    const rows = [];
    for (const e of list) {
      if (!e || typeof e !== "object") continue;
      const id = str(e.id, 64);
      const name = str(e.name, 64);
      if (!id || !ID_RE.test(id) || !name || !NAME_RE.test(name)) continue;
      let props = null;
      if (e.props && typeof e.props === "object" && !Array.isArray(e.props)) {
        try {
          const s = JSON.stringify(e.props);
          props = s.length <= MAX_PROPS_CHARS ? s : null;
        } catch {
          props = null;
        }
      }
      rows.push({
        id,
        userId,
        anonId,
        sessionId: str(e.sessionId, 64),
        name: name.toLowerCase(),
        props,
        ...device,
        clientAt: clampClientAt(e.at),
        createdAt: nowIso,
      });
    }

    if (rows.length) await db.insertEventsBatch(rows);
    // Identity stitching: an authed batch proves anonId ↔ userId belong to
    // the same human — retro-attribute that device's earlier anonymous rows
    // so DAU/funnels count ONE person, not "anonymous + signed-in" twice.
    if (userId && anonId) db.stitchTelemetryIdentity(anonId, userId).catch(() => {});
    // Retention cap rides along on normal traffic (throttled internally).
    db.purgeTelemetry().catch(() => {});
    res.json({ ok: true, accepted: rows.length });
  } catch (err) {
    next(err);
  }
});

router.post("/errors", async (req, res, next) => {
  try {
    if (process.env.TELEMETRY_DISABLED === "1") {
      return res.status(410).json({ error: "Telemetry disabled" });
    }
    // 503, NOT 4xx — see /events. Crash reports especially must survive.
    if (rateLimited(req)) return res.status(503).json({ error: "Busy — retry later" });

    const body = req.body || {};
    const userId = optionalUserId(req);
    const anonId = str(body.anonId, 64);
    const device = deviceOf(body);
    const list = Array.isArray(body.errors) ? body.errors.slice(0, MAX_ERRORS_PER_BATCH) : [];
    const nowIso = new Date().toISOString();

    const rows = [];
    for (const e of list) {
      if (!e || typeof e !== "object") continue;
      const id = str(e.id, 64);
      const message = str(e.message, 500);
      if (!id || !ID_RE.test(id) || !message) continue;
      rows.push({
        id,
        userId,
        anonId,
        sessionId: str(e.sessionId, 64),
        message,
        stack: str(e.stack, 8000),
        fatal: e.fatal ? 1 : 0,
        screen: str(e.screen, 64),
        ...device,
        clientAt: clampClientAt(e.at),
        createdAt: nowIso,
      });
    }

    if (rows.length) await db.insertClientErrorsBatch(rows);
    db.purgeTelemetry().catch(() => {});
    res.json({ ok: true, accepted: rows.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
