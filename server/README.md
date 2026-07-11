# ParkingFriend API

Production-style REST API for the ParkingFriend park-and-ride parking marketplace.
Plain JavaScript (CommonJS) + Express 4. JSON responses mirror the app's
`src/models/types.ts` shapes exactly (`ParkingSpot`, `Booking`, `HostRequest`,
`EarningEntry`, `WalletSummary`, `Host`, `User`).

## Run

```bash
cd server
npm install
npm run seed     # creates the schema only — NO demo data (idempotent)
npm start        # serves on PORT (default 4000)
```

The database starts **empty**. All data comes from real usage: users are
auto-created on OTP login, spots via `POST /api/host/listings`, and
bookings/requests/earnings through the request → accept flow below.

## Marketplace flow (request → accept → reveal phone)

1. Driver `POST /api/bookings {spotId}` → booking `status:"pending"`,
   `hostPhone:null` (contact locked). A pending host request (with the
   driver's `requesterPhone`) is auto-created for the spot's host.
2. Host sees it in `GET /api/host/requests` and responds via
   `POST /api/host/requests/:id/respond {accept:true|false}`.
   - **Accept** → request `accepted`, linked booking `confirmed` +
     `contactUnlocked:true`, and an earning is recorded for the host.
   - **Decline** → request `declined`, linked booking `cancelled`.
3. Driver's `GET /api/bookings` now shows `hostPhone` (the spot host's
   phone) — but **only** when `contactUnlocked` is true; before acceptance
   it is always `null` (privacy).

Environment (see `.env.example` — set real env vars or use a dotenv wrapper):

| Variable             | Default                    | Purpose                                   |
| -------------------- | -------------------------- | ----------------------------------------- |
| `PORT`               | `4000`                     | HTTP port                                 |
| `JWT_SECRET`         | `parkingfriend-dev-secret`    | JWT signing secret — change in production |
| `TURSO_DATABASE_URL` | `file:data/parkingfriend.db`  | libsql URL. Unset = local SQLite file; `libsql://...` = Turso cloud |
| `TURSO_AUTH_TOKEN`   | –                          | Turso auth token (only needed with a `libsql://` URL) |

## Storage

`src/db.js` is the single repository layer, built on
[`@libsql/client`](https://github.com/tursodatabase/libsql-client-ts). All
repository functions are **async**. One client, two modes:

- **Local dev (default — no env needed):** plain SQLite file at
  `server/data/parkingfriend.db` (the default url `file:data/parkingfriend.db`,
  resolved from the `server/` folder — run `npm start` / `npm run seed` from
  there, which npm does automatically). WAL mode, like before.
- **Production — Turso (free cloud SQLite):** set `TURSO_DATABASE_URL` +
  `TURSO_AUTH_TOKEN`. Setup once:
  1. Sign up (free) at [turso.tech](https://turso.tech) and install the
     [Turso CLI](https://docs.turso.tech/cli/installation), then `turso auth login`.
  2. `turso db create parkingfriend`
  3. `turso db show parkingfriend --url` → copy into `TURSO_DATABASE_URL` (`libsql://...`)
  4. `turso db tokens create parkingfriend` → copy into `TURSO_AUTH_TOKEN`
  5. Deploy with both vars set; run `npm run seed` once against them to create
     the schema. `GET /health` reports `{"db":"libsql"}` either way.

Multi-statement writes (booking + host-request creation; host respond →
booking update + earning insert) run as atomic `client.batch(..., "write")`
transactions, so a failure can't leave partial state behind.

> **Note:** `src/jsondb.js` (the old JSON-file store that served as an
> automatic fallback when the better-sqlite3 native module failed to load) is
> kept in the tree for reference, but it is **no longer wired up** — with
> libsql there is no native-build failure mode to fall back from, and the
> `file:` URL *is* the local mode. The old `DB_BACKEND` variable is gone.

## Auth

OTP login flow. The dev OTP is always **`123456`**; `POST /api/auth/verify-otp`
auto-creates the user on first login and returns a 30-day JWT. Send it as
`Authorization: Bearer <token>`.

> **TODO(real SMS):** `src/routes/auth.js` has the hook point in
> `/auth/request-otp` — generate a per-phone OTP, store it with an expiry
> (new `otps` table), and hand it to an SMS provider (MSG91 / Twilio / AWS SNS).
> `verify-otp` then checks the stored OTP instead of the dev constant.

## Endpoints

All bodies/responses are JSON. Errors return proper status codes with `{"error": "message"}`.

| Method | Path                            | Auth | Description |
| ------ | ------------------------------- | ---- | ----------- |
| GET    | `/health`                        | –    | `{ok:true, db:"libsql"}` |
| POST   | `/api/auth/request-otp`          | –    | `{phone}` → `{ok:true, devOtp:"123456"}` |
| POST   | `/api/auth/verify-otp`           | –    | `{phone, otp}` → `{token, user}` (auto-creates user) |
| GET    | `/api/me`                        | ✓    | Current `User` |
| GET    | `/api/spots`                     | –    | `ParkingSpot[]`. Query: `query` (title/area/city/nearStation/landmark/address, case-insensitive), `vehicleType`, `freeOnly=true`, `maxPrice` (per-day), `sort=recommended\|price_low\|price_high\|rating` |
| GET    | `/api/spots/popular`             | –    | Top 6 by rating desc |
| GET    | `/api/spots/:id`                 | –    | `ParkingSpot` or 404 |
| GET    | `/api/host/listings`             | ✓    | Your `ParkingSpot[]` |
| POST   | `/api/host/listings`             | ✓    | Body = `CreateListingPayload` (app's `hostService.ts`, incl. `latitude`/`longitude`) → created `ParkingSpot` |
| GET    | `/api/host/requests`             | ✓    | Your `HostRequest[]`, each incl. `requesterPhone` (call the driver after accepting) |
| POST   | `/api/host/requests/:id/respond` | ✓    | `{accept:boolean}` → updated `HostRequest`. Accept: linked booking → `confirmed` + `contactUnlocked`, earning recorded (spot `pricePerDay`, fallback 150). Decline: linked booking → `cancelled` |
| GET    | `/api/bookings`                  | ✓    | Your `Booking[]`, newest first, `spot` embedded. `hostPhone` = spot host's phone **only when** `contactUnlocked`, else `null` |
| POST   | `/api/bookings`                  | ✓    | `{spotId}` — all else optional (`date`=today, `time`=`"09:00"`, `durationHours`=8, `vehicleType`=`"car"`, `vehicleNumber`=`""`) → `Booking` (status `pending`, contact locked, `totalAmount` from spot pricing) + pending host request for the spot's host |
| POST   | `/api/bookings/:id/cancel`       | ✓    | `{reason?}` → cancelled `Booking` |
| GET    | `/api/wallet/summary`            | ✓    | `WalletSummary` |
| GET    | `/api/wallet/entries`            | ✓    | `EarningEntry[]`, newest first |

Booking JSON carries both the app's fields (`startTime`, `endTime`, `amount`)
and the contract fields (`time`, `totalAmount`) — same values, additive —
plus `hostPhone` (null until the host accepts) and `contactUnlocked`.

### Quick smoke test

```bash
curl -s http://localhost:4000/health
curl -s -X POST http://localhost:4000/api/auth/verify-otp \
  -H "content-type: application/json" \
  -d '{"phone":"+91 98110 24567","otp":"123456"}'
# then use the returned token:
curl -s http://localhost:4000/api/bookings -H "Authorization: Bearer <token>"
```

## Switching to Postgres later

The repository layer is the only thing that touches storage, and it is already
fully async — so a Postgres port is mechanical:

1. Swap the `@libsql/client` calls in `src/db.js` for `pg` queries behind the
   same async repository functions (`listSpots`, `insertBooking`,
   `createBookingWithRequest`, `respondToRequest`, …), keeping the
   `client.batch` write groups as SQL transactions.
2. Translate the `DDL` statements: `TEXT PRIMARY KEY` → `TEXT PRIMARY KEY`,
   `INTEGER` booleans → `BOOLEAN`, JSON text columns → `JSONB`,
   `REAL` → `DOUBLE PRECISION`/`NUMERIC`.
3. Select the backend from `DATABASE_URL` instead of `TURSO_DATABASE_URL`.
4. Routes and serializers need no changes — they already `await` the
   repository and never see the backend.
