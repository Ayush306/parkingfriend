"use strict";

/**
 * Host routes (mounted at /api/host, all require auth):
 *   GET  /api/host/listings              -> ParkingSpot[] owned by the user
 *   POST /api/host/listings              -> body = CreateListingPayload (see app's hostService.ts)
 *   GET  /api/host/requests              -> HostRequest[] (incl. requesterPhone so the
 *                                           host can call the driver after accepting)
 *   POST /api/host/requests/:id/respond  -> {accept:boolean}
 *        accept  → request "accepted", linked booking "confirmed" + contactUnlocked
 *                  (driver now sees hostPhone), and an earning is recorded
 *        decline → request "declined", linked booking "cancelled" (phone never revealed)
 */

const express = require("express");
const db = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();
router.use(requireAuth);

const SPOT_TYPES = ["home", "driveway", "garage", "openlot", "basement"];
const VEHICLE_TYPES = ["car", "bike", "suv"];

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

router.get("/listings", (req, res) => {
  res.json(db.listSpotsByHost(req.user.id).map(db.toSpot));
});

router.post("/listings", (req, res) => {
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
  const isFree = !!p.isFree;
  const pricePerHour = Number(p.pricePerHour);
  const pricePerDay = Number(p.pricePerDay);
  if (!isFree && (!Number.isFinite(pricePerHour) || pricePerHour < 0 || !Number.isFinite(pricePerDay) || pricePerDay < 0)) {
    return res.status(400).json({ error: '"pricePerHour" and "pricePerDay" must be non-negative numbers' });
  }
  const latitude = Number.isFinite(Number(p.latitude)) ? Number(p.latitude) : 28.4595;
  const longitude = Number.isFinite(Number(p.longitude)) ? Number(p.longitude) : 77.0266;

  const id = db.genId("spot");
  const row = {
    id,
    hostId: req.user.id,
    title: p.title.trim(),
    type: p.type,
    vehicleTypes: vehicleTypes.length ? vehicleTypes : ["car"],
    address: p.address.trim(),
    area: p.area.trim(),
    city: isNonEmptyString(p.city) ? p.city.trim() : "Gurugram",
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
    images:
      Array.isArray(p.images) && p.images.length
        ? p.images.map(String)
        : [`https://picsum.photos/seed/pm-${id}/800/520`],
    amenities: Array.isArray(p.amenities) ? p.amenities.map(String) : [],
    availableFrom: p.availableFrom.trim(),
    availableTo: p.availableTo.trim(),
    instructions: typeof p.instructions === "string" ? p.instructions.trim() : "",
    isFavorite: false,
    available: true,
    createdAt: new Date().toISOString(),
  };

  db.insertSpot(row);
  res.status(201).json(db.toSpot(row));
});

router.get("/requests", (req, res) => {
  res.json(db.listRequestsByHost(req.user.id).map(db.toHostRequest));
});

router.post("/requests/:id/respond", (req, res) => {
  const request = db.getRequestRow(req.params.id);
  if (!request || request.hostId !== req.user.id) {
    return res.status(404).json({ error: "Request not found" });
  }
  const accept = (req.body || {}).accept;
  if (typeof accept !== "boolean") {
    return res.status(400).json({ error: '"accept" must be a boolean' });
  }

  const wasAccepted = request.status === "accepted";
  const updated = db.updateRequest(request.id, {
    status: accept ? "accepted" : "declined",
  });

  // Sync the linked booking: accept confirms it and reveals the host's phone
  // to the driver (contactUnlocked); decline cancels it (phone stays hidden).
  if (request.bookingId && db.getBookingRow(request.bookingId)) {
    db.updateBooking(
      request.bookingId,
      accept
        ? { status: "confirmed", contactUnlocked: true }
        : { status: "cancelled" }
    );
  }

  // Record hosting income when a request is newly accepted so the wallet reflects it.
  if (accept && !wasAccepted) {
    let amount = 150; // fallback when the spot's pricing can't be resolved
    const spotRow = request.spotId ? db.getSpotRow(request.spotId) : null;
    if (spotRow && Number(spotRow.pricePerDay) > 0) {
      amount = Number(spotRow.pricePerDay);
    }
    db.insertEarning({
      id: db.genId("e"),
      userId: req.user.id,
      kind: "earning",
      title: request.spotTitle,
      subtitle: `${request.requesterName} parked · request accepted`,
      amount,
      date: new Date().toISOString(),
      bookingId: request.bookingId || null,
    });
  }

  res.json(db.toHostRequest(updated));
});

module.exports = router;
