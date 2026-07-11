# Parkmitter API

Production-style REST API for the Parkmitter park-and-ride parking marketplace.
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

| Variable     | Default                 | Purpose                                   |
| ------------ | ----------------------- | ----------------------------------------- |
| `PORT`       | `4000`                  | HTTP port                                 |
| `JWT_SECRET` | `parkmitter-dev-secret` | JWT signing secret — change in production |
| `DB_BACKEND` | auto                    | `json` forces the JSON store; `sqlite` forces better-sqlite3 |

## Storage

`src/db.js` hides the backend behind one repository interface:

- **better-sqlite3** file DB at `server/data/parkmitter.db` (preferred; WAL mode).
- **JSON file store** (`src/jsondb.js`, `server/data/parkmitter.json`) — automatic
  fallback when the better-sqlite3 native module cannot load (e.g. install
  failures on restricted networks). `GET /health` reports which one is active.

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
| GET    | `/health`                        | –    | `{ok:true, db:"sqlite"\|"json"}` |
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

The repository layer is the only thing that touches storage:

1. Add a third backend in `src/db.js` (e.g. `createPostgresStore()` using `pg`),
   implementing the same `all/get/insert/upsert/update/count` primitives —
   or, better, port the repository functions (`listSpots`, `insertBooking`, …)
   to real SQL queries for server-side filtering.
2. Translate the `DDL` statements: `TEXT PRIMARY KEY` → `TEXT PRIMARY KEY`,
   `INTEGER` booleans → `BOOLEAN`, JSON text columns → `JSONB`,
   `REAL` → `DOUBLE PRECISION`/`NUMERIC`.
3. Point backend selection at `DB_BACKEND=postgres` + `DATABASE_URL`.
4. Routes and serializers need no changes — they never see the backend.
