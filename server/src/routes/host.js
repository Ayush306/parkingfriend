"use strict";

/**
 * Host routes (mounted at /api/host, all require auth):
 *   GET  /api/host/listings              -> ParkingSpot[] owned by the user
 *   POST /api/host/listings              -> body = CreateListingPayload (see app's hostService.ts)
 *   GET  /api/host/requests              -> HostRequest[] (incl. requesterPhone so the
 *                                           host can call the driver after accepting)
 *   POST /api/host/requests/:id/respond  -> {accept:boolean}
 *        accept  → request "accepted", linked booking "confirmed" + contactUnlocked
 *                  (driver now sees hostPhone); income accrues later, per
 *                  completed parking day (db.hostAccruals)
 *        decline → request "declined", linked booking "cancelled" (phone never revealed)
 */

const express = require("express");
const db = require("../db");
const { requireAuth } = require("../auth");
const { pushToUserAsync } = require("../push");

const router = express.Router();
router.use(requireAuth);

/** Route async handlers' rejections to the central error handler (Express 4). */
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const SPOT_TYPES = ["home", "driveway", "garage", "openlot", "basement"];
const VEHICLE_TYPES = ["car", "bike", "bicycle", "suv"]; // suv kept for legacy rows
const MAX_CAPACITY = 50;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

router.get("/listings", ah(async (req, res) => {
  res.json(await db.toSpots(await db.listSpotsByHost(req.user.id)));
}));

router.post("/listings", ah(async (req, res) => {
  const p = req.body || {};

  for (const field of ["title", "address", "area", "landmark", "nearStation", "availableFrom", "availableTo"]) {
    if (!isNonEmptyString(p[field])) {
      return res.status(400).json({ error: `"${field}" is required` });
    }
  }
  if (!SPOT_TYPES.includes(p.type)) {
    return res.status(400).json({ error: `"type" must be one of: ${SPOT_TYPES.join(", ")}` });
  }
  if (!Array.isArray(p.vehicleTypes)) {
    return res.status(400).json({ error: '"vehicleTypes" must be an array' });
  }
  const vehicleTypes = p.vehicleTypes.filter((v) => VEHICLE_TYPES.includes(v));
  // Mandatory: the host must say what fits (car / bike / bicycle).
  if (!vehicleTypes.length) {
    return res.status(400).json({ error: "Pick at least one vehicle type (car, bike or bicycle)" });
  }
  // Mandatory: how many vehicles fit. Defaults to 1 for old clients.
  let capacity = 1;
  if (p.capacity !== undefined && p.capacity !== null && p.capacity !== "") {
    capacity = Number(p.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAPACITY) {
      return res.status(400).json({ error: `"capacity" must be a whole number between 1 and ${MAX_CAPACITY}` });
    }
  }
  const isFree = !!p.isFree;
  const pricePerDay = Number(p.pricePerDay);
  // Mandatory: a real price (unless the host explicitly lists it as free).
  if (!isFree && (!Number.isFinite(pricePerDay) || pricePerDay <= 0)) {
    return res.status(400).json({ error: "A price per day is required (or mark the space as free)" });
  }
  const pricePerHour = Number.isFinite(Number(p.pricePerHour)) && Number(p.pricePerHour) >= 0
    ? Number(p.pricePerHour)
    : Math.max(1, Math.round(pricePerDay / 8));
  // Mandatory, no fallback city/coordinates: hosts list from anywhere in the
  // world, so a missing pin is a real error, never a guessed location.
  const latitude = Number(p.latitude);
  const longitude = Number(p.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ error: "A pinned location (latitude/longitude) is required" });
  }

  // Availability: "always available" (default) needs no dates; a dated listing
  // needs a valid from→to range (YYYY-MM-DD, end on/after start).
  const availableAlways = p.availableAlways === undefined ? true : !!p.availableAlways;
  let availableStartDate = null;
  let availableEndDate = null;
  if (!availableAlways) {
    const start = isNonEmptyString(p.availableStartDate) ? p.availableStartDate.trim() : "";
    const end = isNonEmptyString(p.availableEndDate) ? p.availableEndDate.trim() : "";
    if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
      return res.status(400).json({ error: "Pick a start and end date, or choose Always available" });
    }
    if (end < start) {
      return res.status(400).json({ error: "The end date must be on or after the start date" });
    }
    availableStartDate = start;
    availableEndDate = end;
  }

  const id = db.genId("spot");
  const row = {
    id,
    hostId: req.user.id,
    title: p.title.trim(),
    type: p.type,
    vehicleTypes,
    capacity,
    address: p.address.trim(),
    area: p.area.trim(),
    // No fallback city — real listings only ever carry the host's actual
    // picked location; blank is honest when no city name was resolved.
    city: isNonEmptyString(p.city) ? p.city.trim() : "",
    landmark: p.landmark.trim(),
    nearStation: p.nearStation.trim(),
    distanceMeters: 400,
    latitude,
    longitude,
    pricePerHour: isFree ? 0 : pricePerHour,
    pricePerDay: isFree ? 0 : pricePerDay,
    isFree,
    rating: 0,
    reviewsCount: 0,
    views: 0,
    // Empty when the host added no photos — the app renders a vehicle-type
    // graphic tile instead of a random stock image.
    images: Array.isArray(p.images) ? p.images.map(String) : [],
    amenities: Array.isArray(p.amenities) ? p.amenities.map(String) : [],
    availableFrom: p.availableFrom.trim(),
    availableTo: p.availableTo.trim(),
    instructions: typeof p.instructions === "string" ? p.instructions.trim() : "",
    isFavorite: false,
    available: true,
    availableAlways,
    availableStartDate,
    availableEndDate,
    createdAt: new Date().toISOString(),
  };

  await db.insertSpot(row);
  res.status(201).json(await db.toSpot(row));
}));

/**
 * DELETE /api/host/listings/:id — the host removes their listing.
 * Cascade-cancels every live booking and declines every pending request on the
 * spot, then deletes it. No reason is asked of the host.
 */
router.delete("/listings/:id", ah(async (req, res) => {
  const spot = await db.getSpotRow(req.params.id);
  if (!spot || spot.removed || spot.hostId !== req.user.id) {
    return res.status(404).json({ error: "Listing not found" });
  }
  // Who loses their upcoming parking? Tell each of them directly.
  const affected = (await db.listBookingsForSpot(spot.id)).filter(
    (b) => ["pending", "confirmed", "active"].includes(b.status) && !db.isBookingCompleted(b)
  );
  const result = await db.removeListingWithCascade(spot.id);
  for (const b of [...new Map(affected.map((x) => [x.userId, x])).values()]) {
    pushToUserAsync(
      b.userId,
      "Booking cancelled",
      `${spot.title} is no longer available. Tap to find another spot nearby.`,
      { type: "booking_update", bookingId: b.id }
    );
  }
  res.json({ ok: true, ...result });
}));

router.get("/requests", ah(async (req, res) => {
  const rows = await db.listRequestsByHost(req.user.id);
  // Bulk lookups (no per-row queries): requesters for ratings, bookings for
  // reconciliation + the parking's end date.
  const requesters = await db.getRowsByIds("users", rows.map((row) => row.requesterId));
  const bookings = await db.getRowsByIds("bookings", rows.map((row) => row.bookingId));

  const out = [];
  for (const row of rows) {
    const booking = row.bookingId ? bookings.get(String(row.bookingId)) : null;

    // Self-heal: a live-looking request whose booking the driver already
    // cancelled (data from before the "cancelled" status existed, or a race)
    // flips to "cancelled" here, so ghost guests never reach the app.
    if (
      (row.status === "pending" || row.status === "accepted") &&
      booking && booking.status === "cancelled"
    ) {
      await db.updateRequest(row.id, { status: "cancelled" });
      row.status = "cancelled";
    }

    const r = db.toHostRequest(row);

    // The parking's LAST day — lets the app keep a multi-day guest visible
    // (and the chat button honest) until the parking actually ends.
    if (booking && booking.date) {
      const days = Math.max(1, Math.ceil((Number(booking.durationHours) || 0) / 24));
      const d = new Date(`${booking.date}T00:00:00Z`);
      if (!isNaN(d.getTime())) {
        d.setUTCDate(d.getUTCDate() + days - 1);
        r.endDate = d.toISOString().slice(0, 10);
      }
    }

    const u = row.requesterId ? requesters.get(String(row.requesterId)) : null;
    if (u) {
      r.requesterRating = Math.round((Number(u.driverRating) || 0) * 10) / 10;
      r.requesterRatingCount = Number(u.driverRatingCount) || 0;
    }
    out.push(r);
  }
  res.json(out);
}));

router.post("/requests/:id/respond", ah(async (req, res) => {
  const request = await db.getRequestRow(req.params.id);
  if (!request || request.hostId !== req.user.id) {
    return res.status(404).json({ error: "Request not found" });
  }
  const accept = (req.body || {}).accept;
  if (typeof accept !== "boolean") {
    return res.status(400).json({ error: '"accept" must be a boolean' });
  }

  // A withdrawn booking must never be resurrected: if the driver already
  // cancelled, retire the request as "cancelled" (the DRIVER's action — not
  // "declined", which would read as the host's) and tell the host.
  if (accept && request.bookingId) {
    const booking = await db.getBookingRow(request.bookingId);
    if (booking && booking.status === "cancelled") {
      await db.updateRequest(request.id, { status: "cancelled" });
      return res
        .status(409)
        .json({ error: "The driver has withdrawn this request." });
    }
  }

  const wasAccepted = request.status === "accepted";

  // Capacity guard: don't let a host accept more vehicles than the space holds.
  // (Check-then-act: two literally simultaneous accepts could oversell by one.
  //  Acceptable for the pilot — the app disables the button while responding.)
  if (accept && !wasAccepted && request.spotId) {
    const spotRow = await db.getSpotRow(request.spotId);
    if (spotRow) {
      const capacity = Math.max(1, Number(spotRow.capacity) || 1);
      const taken = await db.countActiveBookings(request.spotId);
      if (taken >= capacity) {
        return res.status(409).json({
          error: `All ${capacity} spot${capacity > 1 ? "s" : ""} at "${spotRow.title}" are already taken. Decline this request or wait for a spot to free up.`,
        });
      }
    }
  }

  // NOTE: no earning row is recorded here. Hosting income accrues per
  // COMPLETED parking day (see db.hostAccruals) — accepting a request earns
  // nothing until the parking actually happens.
  const updated = await db.respondToRequest(request, accept, null);

  // Tell the DRIVER's phone the moment the host decides — no polling needed.
  if (request.requesterId) {
    pushToUserAsync(
      request.requesterId,
      accept ? "Parking accepted 🎉" : "Request declined",
      accept
        ? `${request.spotTitle} is yours — the host's number is in your Bookings.`
        : `${request.spotTitle} isn't available. Try another spot nearby.`,
      { type: "booking_update", bookingId: request.bookingId }
    );
  }

  res.json(db.toHostRequest(updated));
}));

module.exports = router;
