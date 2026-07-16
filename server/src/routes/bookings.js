"use strict";

/**
 * Booking routes (mounted at /api/bookings, all require auth).
 *
 * Request → accept → reveal-phone flow:
 *   GET  /api/bookings             -> Booking[] newest first, spot embedded.
 *                                     `hostPhone` is null until the host accepts
 *                                     (contactUnlocked), then it's the host's phone.
 *   POST /api/bookings             -> {spotId} (everything else optional:
 *                                     date=today, time "09:00", durationHours 8,
 *                                     vehicleType "car", vehicleNumber "").
 *                                     Creates status "pending", contact locked,
 *                                     plus a pending host_requests row (with the
 *                                     requester's phone) for the spot's host.
 *   POST /api/bookings/:id/cancel  -> {reason?} -> status "cancelled"
 */

const express = require("express");
const db = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();
router.use(requireAuth);

/** Route async handlers' rejections to the central error handler (Express 4). */
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

const TIME_RE = /^(\d{1,2}):(\d{2})$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function addHours(hhmm, hours) {
  const m = TIME_RE.exec(String(hhmm).trim());
  if (!m) return hhmm;
  const total = (parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + Math.round(hours * 60)) % (24 * 60);
  const norm = (total + 24 * 60) % (24 * 60);
  return `${String(Math.floor(norm / 60)).padStart(2, "0")}:${String(norm % 60).padStart(2, "0")}`;
}

/**
 * Accepts `time` as "HH:MM" or "HH:MM - HH:MM" (plus optional explicit
 * startTime/endTime fields, which the app also sends) and returns
 * {startTime, endTime, label}.
 */
function resolveTimes(body, durationHours) {
  let start = null;
  let end = null;
  if (isNonEmptyString(body.time)) {
    const parts = body.time.split("-").map((s) => s.trim());
    if (TIME_RE.test(parts[0] || "")) start = parts[0];
    if (parts.length > 1 && TIME_RE.test(parts[1] || "")) end = parts[1];
  }
  if (isNonEmptyString(body.startTime) && TIME_RE.test(body.startTime.trim())) {
    start = body.startTime.trim();
  }
  if (isNonEmptyString(body.endTime) && TIME_RE.test(body.endTime.trim())) {
    end = body.endTime.trim();
  }
  if (!start) return null;
  if (!end) end = addHours(start, durationHours);
  return { startTime: start, endTime: end, label: `${start} - ${end}` };
}

/**
 * totalAmount from spot pricing: parking is priced PER DAY — a request covers
 * whole days (min 1), each at the listing's day price. Never an hourly split,
 * so a "₹50/day" listing always shows ₹50, not ₹48.
 */
function computeAmount(spotRow, durationHours) {
  if (spotRow.isFree) return 0;
  const days = Math.max(1, Math.ceil((Number(durationHours) || 0) / 24));
  return Math.round(days * (Number(spotRow.pricePerDay) || 0));
}

router.get("/", ah(async (req, res) => {
  res.json(await db.toBookings(await db.listBookingsByUser(req.user.id)));
}));

const DEFAULT_START_TIME = "09:00";
const DEFAULT_DURATION_HOURS = 8;

/** Today's date in the server's local timezone as "YYYY-MM-DD". */
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

router.post("/", ah(async (req, res) => {
  const body = req.body || {};

  if (!isNonEmptyString(body.spotId)) {
    return res.status(400).json({ error: '"spotId" is required' });
  }
  const spotRow = await db.getSpotRow(body.spotId.trim());
  if (!spotRow) {
    return res.status(404).json({ error: "Parking spot not found" });
  }

  // A host can never request their own listing.
  if (spotRow.hostId === req.user.id) {
    return res.status(403).json({ error: "This is your own listing — you can't request your own parking space." });
  }

  // Availability guard: a listing that's switched off or outside its
  // from→to date window takes no new requests.
  if (!db.isSpotAvailableNow(spotRow)) {
    return res.status(409).json({ error: "This parking isn't available right now — try another spot nearby." });
  }

  // Capacity guard: no new requests once every slot is taken by an accepted
  // booking. (Pending requests don't hold slots — the host chooses.)
  const capacity = Math.max(1, Number(spotRow.capacity) || 1);
  const taken = await db.countActiveBookings(spotRow.id);
  if (taken >= capacity) {
    return res.status(409).json({ error: "This parking is full right now — try another spot nearby." });
  }

  // Everything beyond spotId is optional — validate only when provided.
  let durationHours = DEFAULT_DURATION_HOURS;
  if (body.durationHours !== undefined && body.durationHours !== null && body.durationHours !== "") {
    durationHours = Number(body.durationHours);
    if (!Number.isFinite(durationHours) || durationHours <= 0 || durationHours > 720) {
      return res.status(400).json({ error: '"durationHours" must be a number between 0 and 720' });
    }
  }
  let date = todayLocal();
  if (isNonEmptyString(body.date)) {
    date = body.date.trim();
    if (!DATE_RE.test(date)) {
      return res.status(400).json({ error: '"date" must be in YYYY-MM-DD format' });
    }
  }
  let times = resolveTimes(body, durationHours);
  if (!times) {
    const start = DEFAULT_START_TIME;
    const end = addHours(start, durationHours);
    times = { startTime: start, endTime: end, label: `${start} - ${end}` };
  }
  const vehicleType = isNonEmptyString(body.vehicleType) ? body.vehicleType.trim() : "car";
  const vehicleNumber = isNonEmptyString(body.vehicleNumber) ? body.vehicleNumber.trim().toUpperCase() : "";

  const now = new Date().toISOString();
  const booking = {
    id: db.genId("bk"),
    userId: req.user.id,
    spotId: spotRow.id,
    date,
    time: times.label,
    startTime: times.startTime,
    endTime: times.endTime,
    durationHours,
    vehicleType,
    vehicleNumber,
    status: "pending", // awaits the host's accept/decline
    totalAmount: computeAmount(spotRow, durationHours),
    contactUnlocked: false, // host phone stays hidden until accepted
    otp: null,
    createdAt: now,
  };
  // One atomic batch: booking + the pending host request that notifies the
  // spot's host. Either both rows land or neither does.
  await db.createBookingWithRequest(booking, {
    id: db.genId("hr"),
    hostId: spotRow.hostId,
    spotId: spotRow.id,
    bookingId: booking.id,
    spotTitle: spotRow.title,
    requesterId: req.user.id,
    requesterName: req.user.name,
    requesterPhone: req.user.phone || null,
    requesterAvatar: req.user.avatar || null,
    vehicleType: booking.vehicleType,
    date: booking.date,
    time: times.label,
    status: "pending",
  });

  res.status(201).json(await db.toBooking(booking));
}));

router.post("/:id/cancel", ah(async (req, res) => {
  const booking = await db.getBookingRow(req.params.id);
  if (!booking || booking.userId !== req.user.id) {
    return res.status(404).json({ error: "Booking not found" });
  }
  if (booking.status === "cancelled") {
    return res.json(await db.toBooking(booking)); // already cancelled — idempotent
  }
  if (booking.status === "completed") {
    return res.status(409).json({ error: "A completed booking cannot be cancelled" });
  }
  // The driver's stated reason is stored on the booking. Cancelling also
  // retires the linked pending host request, so the host's "Incoming requests"
  // never shows a request the driver already withdrew.
  const reason = isNonEmptyString((req.body || {}).reason)
    ? req.body.reason.trim().slice(0, 300)
    : null;
  const updated = await db.cancelBookingWithRequest(booking, reason);
  res.json(await db.toBooking(updated));
}));

module.exports = router;
