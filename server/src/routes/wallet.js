"use strict";

/**
 * Wallet routes (mounted at /api/wallet, all require auth):
 *   GET /api/wallet/summary  -> WalletSummary (models/types.ts)
 *   GET /api/wallet/entries  -> EarningEntry[] newest first
 */

const express = require("express");
const db = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();
router.use(requireAuth);

/** Route async handlers' rejections to the central error handler (Express 4). */
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get("/summary", ah(async (req, res) => {
  res.json(await db.walletSummary(req.user.id));
}));

router.get("/entries", ah(async (req, res) => {
  // Hosting income is listed from live per-day accruals (one entry per
  // booking, growing daily until the parking completes). Stored accept-time
  // 'earning' rows are legacy and skipped so nothing double-counts; stored
  // 'saving' rows (driver side) still pass through.
  const savings = (await db.listEarningsByUser(req.user.id))
    .filter((e) => e.kind === "saving")
    .map(db.toEarning);
  const accrued = (await db.hostAccruals(req.user.id)).map((a) => ({
    id: `he_${a.bookingId}`,
    kind: "earning",
    title: a.title,
    subtitle: a.completed
      ? `Parking completed · ${a.daysTotal} day${a.daysTotal > 1 ? "s" : ""}`
      : `${a.daysDone} of ${a.daysTotal} day${a.daysTotal > 1 ? "s" : ""} parked`,
    amount: a.amount,
    date: a.date,
  }));
  const all = [...accrued, ...savings].sort(
    (x, y) => new Date(y.date).getTime() - new Date(x.date).getTime()
  );
  res.json(all);
}));

module.exports = router;
