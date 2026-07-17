"use strict";

/**
 * Auth routes (mounted at /api):
 *   POST /api/auth/request-otp  {phone}                       -> {ok, devOtp}
 *   POST /api/auth/verify-otp   {phone, otp, name?, email?}   -> {token, user}
 *        - name present  => REGISTER: create the account (or log in if the
 *          number is already registered).
 *        - name absent   => LOGIN: only succeeds for an existing account;
 *          an unknown number returns 404 so the app can send them to Register.
 *   GET   /api/me               (auth)                        -> User
 *   PATCH /api/me               (auth) {name?, email?, avatar?} -> User
 *
 * Dev OTP is always "123456". Real SMS delivery is a TODO hook — see README.
 */

const express = require("express");
const db = require("../db");
const { signToken, requireAuth } = require("../auth");

const router = express.Router();

/** Route async handlers' rejections to the central error handler (Express 4). */
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

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

router.post("/auth/verify-otp", ah(async (req, res) => {
  const body = req.body || {};
  const phone = readPhone(body);
  if (!phone) {
    return res.status(400).json({ error: "A valid phone number is required" });
  }
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  if (otp !== DEV_OTP) {
    return res.status(401).json({ error: "Invalid OTP" });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const isRegister = name.length > 0;

  let user = await db.findUserByPhone(phone);
  if (!user) {
    // LOGIN into a number that was never registered → tell the app to register.
    if (!isRegister) {
      return res
        .status(404)
        .json({ error: "No account found for this number. Please register first." });
    }
    user = await db.createUser({ phone, name, email });
  }
  res.json({ token: signToken(user), user: db.toUser(user) });
}));

router.get("/me", requireAuth, (req, res) => {
  res.json(db.toUser(req.user));
});

router.patch("/me", requireAuth, ah(async (req, res) => {
  const body = req.body || {};
  const patch = {};
  if (typeof body.name === "string") {
    if (body.name.trim().length < 2) {
      return res.status(400).json({ error: "Name must be at least 2 characters" });
    }
    patch.name = body.name;
  }
  if (body.email !== undefined) patch.email = body.email;
  if (body.avatar !== undefined) patch.avatar = body.avatar;
  const updated = await db.updateUserProfile(req.user.id, patch);
  res.json(db.toUser(updated));
}));

/**
 * POST /api/me/push-token {token} — register (or clear with null/"") this
 * device's Expo push token so the server can notify the phone directly.
 */
router.post("/me/push-token", requireAuth, ah(async (req, res) => {
  const token = (req.body || {}).token;
  const clean = typeof token === "string" && token.trim() ? token.trim() : null;
  if (clean && !/^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(clean)) {
    return res.status(400).json({ error: "That doesn't look like an Expo push token" });
  }
  await db.savePushToken(req.user.id, clean);
  res.json({ ok: true, registered: !!clean });
}));

module.exports = router;
