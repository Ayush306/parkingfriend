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

async function main() {
  await db.init(); // create tables + run column migrations
  console.log(`[seed] schema ready (db: ${db.backend}) — no demo data seeded.`);
  console.log(
    `[seed] row counts — users: ${await db.countRows("users")}, spots: ${await db.countRows("spots")}, ` +
      `bookings: ${await db.countRows("bookings")}, requests: ${await db.countRows("host_requests")}, ` +
      `earnings: ${await db.countRows("earnings")}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });
