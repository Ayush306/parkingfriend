"use strict";

/**
 * Creates the database schema only. Idempotent — safe to re-run any time.
 *
 * NO demo/dummy data is seeded. All rows come from real usage:
 *   - users            created on OTP login (POST /api/auth/verify-otp)
 *   - spots            created by hosts    (POST /api/host/listings)
 *   - bookings         created by drivers  (POST /api/bookings, status "pending")
 *   - host_requests    auto-created with each booking
 *   - earnings         recorded when a host accepts a request
 */

const db = require("./db");

function main() {
  // Requiring ./db already created the schema (tables + migrations).
  console.log(`[seed] schema ready (db: ${db.backend}) — no demo data seeded.`);
  console.log(
    `[seed] row counts — users: ${db.countRows("users")}, spots: ${db.countRows("spots")}, ` +
      `bookings: ${db.countRows("bookings")}, requests: ${db.countRows("host_requests")}, ` +
      `earnings: ${db.countRows("earnings")}`
  );
}

main();
