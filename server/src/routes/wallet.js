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
  res.json((await db.listEarningsByUser(req.user.id)).map(db.toEarning));
}));

module.exports = router;
