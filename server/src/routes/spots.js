"use strict";

/**
 * Public spot search/browse routes (mounted at /api/spots):
 *   GET /api/spots?query=&vehicleType=&freeOnly=&maxPrice=&sort=
 *   GET /api/spots/popular
 *   GET /api/spots/:id
 *
 * Filter/sort semantics mirror the app's spotService:
 *   query      — case-insensitive match on title/area/city/landmark/nearStation/address
 *   vehicleType— spot.vehicleTypes includes it
 *   freeOnly   — "true" -> only isFree spots
 *   maxPrice   — pricePerDay <= maxPrice
 *   sort       — recommended (rating desc, then distance asc) | price_low | price_high | rating
 */

const express = require("express");
const db = require("../db");

const router = express.Router();

/** Route async handlers' rejections to the central error handler (Express 4). */
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get("/", ah(async (req, res) => {
  const { query, vehicleType, freeOnly, maxPrice, sort } = req.query;
  let spots = await Promise.all((await db.listSpots()).map(db.toSpot));

  const q = typeof query === "string" ? query.trim().toLowerCase() : "";
  if (q) {
    spots = spots.filter((s) =>
      [s.title, s.area, s.city, s.landmark, s.nearStation, s.address]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }
  if (typeof vehicleType === "string" && vehicleType.trim()) {
    const vt = vehicleType.trim().toLowerCase();
    spots = spots.filter((s) => s.vehicleTypes.includes(vt));
  }
  if (freeOnly === "true") {
    spots = spots.filter((s) => s.isFree);
  }
  if (maxPrice !== undefined) {
    const cap = Number(maxPrice);
    if (Number.isFinite(cap)) {
      spots = spots.filter((s) => s.pricePerDay <= cap);
    }
  }

  switch (sort) {
    case "price_low":
      spots.sort((a, b) => a.pricePerDay - b.pricePerDay);
      break;
    case "price_high":
      spots.sort((a, b) => b.pricePerDay - a.pricePerDay);
      break;
    case "rating":
      spots.sort((a, b) => b.rating - a.rating);
      break;
    case "recommended":
    default:
      spots.sort((a, b) => b.rating - a.rating || a.distanceMeters - b.distanceMeters);
      break;
  }

  res.json(spots);
}));

router.get("/popular", ah(async (req, res) => {
  const spots = (await Promise.all((await db.listSpots()).map(db.toSpot)))
    .sort((a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount)
    .slice(0, 6);
  res.json(spots);
}));

router.get("/:id", ah(async (req, res) => {
  const row = await db.getSpotRow(req.params.id);
  if (!row) {
    return res.status(404).json({ error: "Parking spot not found" });
  }
  res.json(await db.toSpot(row));
}));

/**
 * POST /api/spots/:id/view — a driver opened this spot's detail page.
 * Public (no auth): the app suppresses the call for the spot's own host, so
 * a host viewing their own listing doesn't inflate the count. Returns {views}.
 */
router.post("/:id/view", ah(async (req, res) => {
  const row = await db.getSpotRow(req.params.id);
  if (!row) {
    return res.status(404).json({ error: "Parking spot not found" });
  }
  const views = await db.incrementSpotViews(row.id);
  res.json({ views });
}));

module.exports = router;
