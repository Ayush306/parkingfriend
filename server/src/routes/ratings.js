"use strict";

/**
 * Rating routes (mounted at /api/ratings, all require auth).
 *
 * Two-sided reputation, like a ride-share: after a parking is COMPLETED (it was
 * accepted and its date has passed) each side rates the other, once.
 *   - the DRIVER rates the HOST  → feeds the host's rating + that spot's rating
 *     (both shown publicly to anyone browsing parking)
 *   - the HOST rates the DRIVER  → feeds the driver's rating (shown to hosts on
 *     the incoming request, before they accept)
 *
 *   GET  /api/ratings/pending  -> everything the caller still needs to rate,
 *                                 each with the other person + their rating.
 *   POST /api/ratings          -> { bookingId, stars (1-5), comment? }. The
 *                                 caller's role is derived from the booking.
 */

const express = require("express");
const db = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();
router.use(requireAuth);

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get("/pending", ah(async (req, res) => {
  res.json(await db.pendingRatingsForUser(req.user.id));
}));

router.post("/", ah(async (req, res) => {
  const body = req.body || {};
  const bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : "";
  const stars = Number(body.stars);

  if (!bookingId) {
    return res.status(400).json({ error: '"bookingId" is required' });
  }
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return res.status(400).json({ error: "Give a star rating from 1 to 5" });
  }

  const booking = await db.getBookingRow(bookingId);
  if (!booking) {
    return res.status(404).json({ error: "Booking not found" });
  }
  const spot = await db.getSpotRow(booking.spotId);

  // Which side is the caller? Driver (made the booking) or host (owns the spot)?
  let raterRole = null;
  let rateeId = null;
  if (booking.userId === req.user.id) {
    raterRole = "driver";
    rateeId = spot ? spot.hostId : null;
  } else if (spot && spot.hostId === req.user.id) {
    raterRole = "host";
    rateeId = booking.userId;
  } else {
    return res.status(403).json({ error: "You weren't part of this parking." });
  }
  if (!rateeId) {
    return res.status(409).json({ error: "The other person is no longer available to rate." });
  }

  // Ratable = fully completed, OR cancelled mid-stay after days that really
  // happened (accruedDays) — cancelling can't dodge an earned review.
  if (!db.isBookingRatable(booking)) {
    return res.status(409).json({ error: "You can rate once the parking date has passed." });
  }
  const existing = await db.getRatingByBookingRole(bookingId, raterRole);
  if (existing) {
    return res.status(409).json({ error: "You've already rated this parking." });
  }

  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 400) : "";
  const row = {
    id: db.genId("rt"),
    bookingId,
    spotId: booking.spotId,
    raterId: req.user.id,
    rateeId,
    raterRole,
    stars,
    comment,
    createdAt: new Date().toISOString(),
  };
  try {
    await db.insertRating(row);
  } catch (e) {
    // The UNIQUE(bookingId, raterRole) index caught a double-submit race.
    if (String((e && e.code) || e).includes("CONSTRAINT")) {
      return res.status(409).json({ error: "You've already rated this parking." });
    }
    throw e;
  }

  // Update the denormalized reputation numbers used everywhere in the app.
  if (raterRole === "driver") {
    await db.recomputeHostAndSpot(booking.spotId, rateeId);
  } else {
    await db.recomputeDriver(rateeId);
  }

  res.status(201).json({ ok: true, rating: db.toRating(row) });
}));

module.exports = router;
