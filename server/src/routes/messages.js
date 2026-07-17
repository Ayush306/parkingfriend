"use strict";

/**
 * Chat routes (mounted at /api/messages, all require auth).
 *
 * A booking's chat connects exactly two people — the driver who requested and
 * the host who owns the spot — and is available the WHOLE parking lifespan:
 * from the moment the request is sent (yes, before the host accepts; unlike
 * the phone number, chat needs no unlock) until the parking completes or the
 * request dies (declined/cancelled). After that the chat closes and its
 * messages are deleted — conversations don't outlive the parking.
 *
 *   GET  /api/messages/:bookingId -> { open, with: {name, avatar}, messages }
 *   POST /api/messages/:bookingId -> { text } -> the stored message
 */

const express = require("express");
const db = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();
router.use(requireAuth);

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const MAX_TEXT = 500;

/** Loads the booking and verifies the caller is one of its two participants. */
async function loadChat(req, res) {
  const booking = await db.getBookingRow(req.params.bookingId);
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return null;
  }
  const spot = await db.getSpotRow(booking.spotId);
  const hostId = spot ? spot.hostId : null;
  const isDriver = booking.userId === req.user.id;
  const isHost = hostId === req.user.id;
  if (!isDriver && !isHost) {
    res.status(403).json({ error: "This chat isn't yours." });
    return null;
  }
  // The person on the other side of the conversation.
  const otherId = isDriver ? hostId : booking.userId;
  const other = otherId ? await db.getUserById(otherId) : null;
  return { booking, spot, other };
}

/**
 * GET /api/messages — summary of every live chat the caller is in, with the
 * last message. The app polls this to raise "new message" notifications.
 * (Registered before /:bookingId so "summary" is never treated as an id.)
 */
router.get("/", ah(async (req, res) => {
  res.json(await db.chatSummaryForUser(req.user.id));
}));

router.get("/:bookingId", ah(async (req, res) => {
  const ctx = await loadChat(req, res);
  if (!ctx) return;
  // Housekeeping: quietly clear chats whose parking has ended (throttled).
  db.purgeDeadChats().catch(() => {});

  const open = db.isChatOpen(ctx.booking);
  const messages = open ? (await db.listMessages(ctx.booking.id)).map(db.toMessage) : [];
  res.json({
    open,
    with: {
      name: (ctx.other && ctx.other.name) || "ParkingFriend user",
      avatar: (ctx.other && ctx.other.avatar) || null,
    },
    messages,
  });
}));

router.post("/:bookingId", ah(async (req, res) => {
  const ctx = await loadChat(req, res);
  if (!ctx) return;

  if (!db.isChatOpen(ctx.booking)) {
    return res.status(410).json({ error: "This chat has closed — the parking has ended." });
  }
  const text = typeof (req.body || {}).text === "string" ? req.body.text.trim() : "";
  if (!text) {
    return res.status(400).json({ error: "Type a message first." });
  }
  const row = {
    id: db.genId("msg"),
    bookingId: ctx.booking.id,
    senderId: req.user.id,
    text: text.slice(0, MAX_TEXT),
    createdAt: new Date().toISOString(),
  };
  await db.insertMessage(row);
  res.status(201).json(db.toMessage(row));
}));

module.exports = router;
