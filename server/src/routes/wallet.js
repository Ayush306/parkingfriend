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

router.get("/summary", (req, res) => {
  res.json(db.walletSummary(req.user.id));
});

router.get("/entries", (req, res) => {
  res.json(db.listEarningsByUser(req.user.id).map(db.toEarning));
});

module.exports = router;
