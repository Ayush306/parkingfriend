"use strict";

/**
 * JWT sign/verify helpers + requireAuth middleware.
 * Tokens carry { sub: <userId> } and are signed with JWT_SECRET
 * (dev default "parkmitter-dev-secret" — override in production).
 */

const jwt = require("jsonwebtoken");
const db = require("./db");

const JWT_SECRET = process.env.JWT_SECRET || "parkmitter-dev-secret";
const TOKEN_TTL = "30d";

function signToken(user) {
  return jwt.sign({ sub: user.id, phone: user.phone }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/** Express middleware: requires a valid `Authorization: Bearer <jwt>` header. */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  let payload;
  try {
    payload = verifyToken(match[1]);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  const user = db.getUserById(payload.sub);
  if (!user) {
    return res.status(401).json({ error: "User no longer exists" });
  }
  req.user = user; // raw users row; serialize with db.toUser / db.toHost
  next();
}

module.exports = { signToken, verifyToken, requireAuth, JWT_SECRET };
