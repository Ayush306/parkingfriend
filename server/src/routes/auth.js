"use strict";

/**
 * Auth routes (mounted at /api):
 *   POST /api/auth/request-otp  {phone}       -> {ok, devOtp}
 *   POST /api/auth/verify-otp   {phone, otp}  -> {token, user}
 *   GET  /api/me                (auth)        -> User
 *
 * Dev OTP is always "123456". Real SMS delivery is a TODO hook — see README.
 */

const express = require("express");
const db = require("../db");
const { signToken, requireAuth } = require("../auth");

const router = express.Router();

const DEV_OTP = "123456";

function readPhone(body) {
  const phone = typeof (body || {}).phone === "string" ? body.phone.trim() : "";
  const digits = db.normalizePhone(phone);
  if (digits.length < 8 || digits.length > 15) return null;
  return phone;
}

router.post("/auth/request-otp", (req, res) => {
  const phone = readPhone(req.body);
  if (!phone) {
    return res.status(400).json({ error: "A valid phone number is required" });
  }
  // TODO(sms): hand `phone` + generated OTP to an SMS provider here (MSG91/Twilio).
  // For now every login uses the fixed dev OTP below.
  res.json({ ok: true, devOtp: DEV_OTP });
});

router.post("/auth/verify-otp", (req, res) => {
  const phone = readPhone(req.body);
  if (!phone) {
    return res.status(400).json({ error: "A valid phone number is required" });
  }
  const otp = typeof (req.body || {}).otp === "string" ? req.body.otp.trim() : "";
  if (otp !== DEV_OTP) {
    return res.status(401).json({ error: "Invalid OTP" });
  }
  let user = db.findUserByPhone(phone);
  if (!user) {
    user = db.createUser({ phone });
  }
  res.json({ token: signToken(user), user: db.toUser(user) });
});

router.get("/me", requireAuth, (req, res) => {
  res.json(db.toUser(req.user));
});

module.exports = router;
