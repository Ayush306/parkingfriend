"use strict";

/**
 * Storage layer for the ParkingFriend API — built on @libsql/client.
 *
 * One client, two modes (selected purely by env):
 *   - Local dev (no env needed): plain SQLite file at server/data/parkingfriend.db
 *     via the default url "file:data/parkingfriend.db".
 *   - Production: Turso (free cloud SQLite) via TURSO_DATABASE_URL
 *     (libsql://...) + TURSO_AUTH_TOKEN.
 *
 * libsql is ASYNC — every repository function here returns a Promise, and the
 * row → JSON serializers that need extra lookups (toSpot, toBooking) are async
 * too. Multi-statement writes (booking + host request creation, respond →
 * booking update + earning insert) run inside client.batch(..., "write") so a
 * failure can never leave a partial write behind.
 *
 * Serializers produce JSON that mirrors the app's src/models/types.ts exactly.
 *
 * Note: src/jsondb.js (the old JSON-file fallback store) is kept in the repo
 * for reference but is NO LONGER wired up — the libsql "file:" URL is the
 * local mode now.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@libsql/client");

/* ───────────────────────── client ───────────────────────── */

const DB_URL = process.env.TURSO_DATABASE_URL || "file:data/parkingfriend.db";
const IS_FILE_DB = DB_URL.startsWith("file:");

// Local file mode: make sure the parent directory exists (libsql won't create it).
if (IS_FILE_DB) {
  const filePath = DB_URL.slice("file:".length).replace(/^\/\//, "").split("?")[0];
  const dir = path.dirname(filePath);
  if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });
}

const client = createClient({
  url: DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

const backend = "libsql";

/* ───────────────────────── schema ───────────────────────── */

const COLUMNS = {
  users: [
    "id", "phone", "name", "email", "avatar", "rating", "reviewsCount",
    "driverRating", "driverRatingCount",
    "verified", "responseTime", "createdAt",
  ],
  spots: [
    "id", "hostId", "title", "type", "vehicleTypes", "capacity", "address", "area", "city",
    "landmark", "nearStation", "distanceMeters", "latitude", "longitude",
    "pricePerHour", "pricePerDay", "isFree", "rating", "reviewsCount",
    "images", "amenities", "availableFrom", "availableTo", "instructions",
    "isFavorite", "available", "removed", "views",
    "availableAlways", "availableStartDate", "availableEndDate", "createdAt",
  ],
  bookings: [
    "id", "userId", "spotId", "date", "time", "startTime", "endTime",
    "durationHours", "vehicleType", "vehicleNumber", "status", "totalAmount",
    "contactUnlocked", "otp", "cancelReason", "createdAt",
  ],
  host_requests: [
    "id", "hostId", "spotId", "bookingId", "spotTitle", "requesterId", "requesterName",
    "requesterPhone", "requesterAvatar", "vehicleType", "date", "time", "status",
  ],
  earnings: [
    "id", "userId", "kind", "title", "subtitle", "amount", "date", "bookingId",
  ],
  ratings: [
    "id", "bookingId", "spotId", "raterId", "rateeId", "raterRole",
    "stars", "comment", "createdAt",
  ],
  messages: [
    "id", "bookingId", "senderId", "text", "createdAt",
  ],
};

const JSON_COLUMNS = { spots: ["vehicleTypes", "images", "amenities"] };
const BOOL_COLUMNS = {
  users: ["verified"],
  spots: ["isFree", "isFavorite", "available", "removed", "availableAlways"],
  bookings: ["contactUnlocked"],
};

const DDL = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE,
    name TEXT NOT NULL,
    email TEXT,
    avatar TEXT,
    rating REAL DEFAULT 5,
    reviewsCount INTEGER DEFAULT 0,
    driverRating REAL DEFAULT 0,
    driverRatingCount INTEGER DEFAULT 0,
    verified INTEGER DEFAULT 0,
    responseTime TEXT,
    createdAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS spots (
    id TEXT PRIMARY KEY,
    hostId TEXT REFERENCES users(id),
    title TEXT NOT NULL,
    type TEXT,
    vehicleTypes TEXT,
    capacity INTEGER DEFAULT 1,
    address TEXT,
    area TEXT,
    city TEXT,
    landmark TEXT,
    nearStation TEXT,
    distanceMeters INTEGER DEFAULT 0,
    latitude REAL,
    longitude REAL,
    pricePerHour REAL DEFAULT 0,
    pricePerDay REAL DEFAULT 0,
    isFree INTEGER DEFAULT 0,
    rating REAL DEFAULT 0,
    reviewsCount INTEGER DEFAULT 0,
    images TEXT,
    amenities TEXT,
    availableFrom TEXT,
    availableTo TEXT,
    instructions TEXT,
    isFavorite INTEGER DEFAULT 0,
    available INTEGER DEFAULT 1,
    removed INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    availableAlways INTEGER DEFAULT 1,
    availableStartDate TEXT,
    availableEndDate TEXT,
    createdAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    userId TEXT REFERENCES users(id),
    spotId TEXT REFERENCES spots(id),
    date TEXT,
    time TEXT,
    startTime TEXT,
    endTime TEXT,
    durationHours REAL,
    vehicleType TEXT,
    vehicleNumber TEXT,
    status TEXT,
    totalAmount REAL DEFAULT 0,
    contactUnlocked INTEGER DEFAULT 0,
    otp TEXT,
    cancelReason TEXT,
    createdAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS host_requests (
    id TEXT PRIMARY KEY,
    hostId TEXT REFERENCES users(id),
    spotId TEXT,
    bookingId TEXT,
    spotTitle TEXT,
    requesterId TEXT,
    requesterName TEXT,
    requesterPhone TEXT,
    requesterAvatar TEXT,
    vehicleType TEXT,
    date TEXT,
    time TEXT,
    status TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS earnings (
    id TEXT PRIMARY KEY,
    userId TEXT REFERENCES users(id),
    kind TEXT,
    title TEXT,
    subtitle TEXT,
    amount REAL DEFAULT 0,
    date TEXT,
    bookingId TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS ratings (
    id TEXT PRIMARY KEY,
    bookingId TEXT,
    spotId TEXT,
    raterId TEXT,
    rateeId TEXT,
    raterRole TEXT,
    stars INTEGER,
    comment TEXT,
    createdAt TEXT
  )`,
  // One rating per side per booking — makes a double-submit race impossible
  // even if two requests slip past the check-then-act guard in the route.
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_booking_role ON ratings(bookingId, raterRole)`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    bookingId TEXT,
    senderId TEXT,
    text TEXT,
    createdAt TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_messages_booking ON messages(bookingId, createdAt)`,
];

/**
 * Columns added after a table first shipped — applied to pre-existing db
 * files with "ALTER TABLE ... ADD COLUMN if missing" (the libsql equivalent
 * of the old PRAGMA-based migration; pragma_table_info works as a plain
 * SELECT on both local files and Turso).
 */
const MIGRATIONS = [
  { table: "host_requests", column: "requesterPhone", ddl: "ALTER TABLE host_requests ADD COLUMN requesterPhone TEXT" },
  { table: "host_requests", column: "bookingId", ddl: "ALTER TABLE host_requests ADD COLUMN bookingId TEXT" },
  { table: "spots", column: "capacity", ddl: "ALTER TABLE spots ADD COLUMN capacity INTEGER DEFAULT 1" },
  { table: "spots", column: "views", ddl: "ALTER TABLE spots ADD COLUMN views INTEGER DEFAULT 0" },
  { table: "users", column: "email", ddl: "ALTER TABLE users ADD COLUMN email TEXT" },
  // Availability window: a listing is either "always available" (default) or
  // open only within a from→to date range the host picked.
  { table: "spots", column: "availableAlways", ddl: "ALTER TABLE spots ADD COLUMN availableAlways INTEGER DEFAULT 1" },
  { table: "spots", column: "availableStartDate", ddl: "ALTER TABLE spots ADD COLUMN availableStartDate TEXT" },
  { table: "spots", column: "availableEndDate", ddl: "ALTER TABLE spots ADD COLUMN availableEndDate TEXT" },
  // Soft-removed listings (host cancelled them) stay in the DB so linked
  // bookings keep their spot details, but disappear from every public/host view.
  { table: "spots", column: "removed", ddl: "ALTER TABLE spots ADD COLUMN removed INTEGER DEFAULT 0" },
  // Why a driver cancelled (free text or a picked preset) — kept for the host/records.
  { table: "bookings", column: "cancelReason", ddl: "ALTER TABLE bookings ADD COLUMN cancelReason TEXT" },
  // Two-sided ratings: a user's reputation AS A DRIVER (hosts rate drivers);
  // the host reputation stays on users.rating/reviewsCount (drivers rate hosts).
  { table: "users", column: "driverRating", ddl: "ALTER TABLE users ADD COLUMN driverRating REAL DEFAULT 0" },
  { table: "users", column: "driverRatingCount", ddl: "ALTER TABLE users ADD COLUMN driverRatingCount INTEGER DEFAULT 0" },
  // Link a request back to the driver who made it, so the host can see that
  // driver's rating on the incoming request and rate them after the parking.
  { table: "host_requests", column: "requesterId", ddl: "ALTER TABLE host_requests ADD COLUMN requesterId TEXT" },
];

/**
 * One-time DATA resets, each keyed in the app_meta table so it runs exactly
 * once per database, ever — shipped through the normal deploy pipeline.
 * fresh_start_2026_07_16: wipe all pilot/test data (users, spots, bookings,
 * requests, earnings, ratings) for the public fresh start. A database created
 * after this key exists is never touched.
 */
const DATA_RESETS = [
  {
    key: "fresh_start_2026_07_16",
    statements: [
      "DELETE FROM ratings",
      "DELETE FROM earnings",
      "DELETE FROM host_requests",
      "DELETE FROM bookings",
      "DELETE FROM spots",
      "DELETE FROM users",
    ],
  },
];

let initPromise = null;

/** Create schema + run column migrations. Idempotent; runs once per process. */
function init() {
  if (!initPromise) {
    initPromise = (async () => {
      if (IS_FILE_DB) {
        // Same journal mode the old better-sqlite3 backend used. File mode
        // only — Turso manages its own storage settings.
        try {
          await client.execute("PRAGMA journal_mode = WAL");
        } catch {
          /* non-fatal */
        }
      }
      await client.batch(DDL, "write");
      for (const m of MIGRATIONS) {
        const rs = await client.execute({
          sql: "SELECT name FROM pragma_table_info(?)",
          args: [m.table],
        });
        const names = rs.rows.map((r) => r.name);
        if (!names.includes(m.column)) await client.execute(m.ddl);
      }
      // One-time keyed data resets (see DATA_RESETS above).
      await client.execute(
        "CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, appliedAt TEXT)"
      );
      for (const reset of DATA_RESETS) {
        const done = await client.execute({
          sql: "SELECT key FROM app_meta WHERE key = ?",
          args: [reset.key],
        });
        if (done.rows.length) continue;
        await client.batch(
          [
            ...reset.statements,
            {
              sql: "INSERT INTO app_meta (key, appliedAt) VALUES (?, ?)",
              args: [reset.key, new Date().toISOString()],
            },
          ],
          "write"
        );
        console.log(`[db] one-time data reset applied: ${reset.key}`);
      }
    })();
  }
  return initPromise;
}

/* ───────────────────────── row (en|de)coding ───────────────────────── */

function encodeValue(table, col, value) {
  let v = value === undefined ? null : value;
  if ((JSON_COLUMNS[table] || []).includes(col)) v = JSON.stringify(v == null ? [] : v);
  else if ((BOOL_COLUMNS[table] || []).includes(col)) v = v ? 1 : 0;
  return v;
}

function decodeRow(table, row) {
  if (!row) return null;
  const out = {};
  for (const col of COLUMNS[table]) out[col] = row[col];
  for (const col of JSON_COLUMNS[table] || []) {
    try {
      out[col] = JSON.parse(out[col] || "[]");
    } catch {
      out[col] = [];
    }
  }
  for (const col of BOOL_COLUMNS[table] || []) out[col] = !!out[col];
  return out;
}

/** Full-row INSERT statement ({sql, args}) for client.execute / client.batch. */
function insertStmt(table, row, orReplace) {
  const cols = COLUMNS[table];
  return {
    sql: `INSERT ${orReplace ? "OR REPLACE " : ""}INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
    args: cols.map((c) => encodeValue(table, c, row[c])),
  };
}

/** Partial UPDATE statement ({sql, args}) from a patch object. */
function updateStmt(table, id, patch) {
  const cols = COLUMNS[table].filter((c) => c !== "id" && patch[c] !== undefined);
  return {
    sql: `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`,
    args: [...cols.map((c) => encodeValue(table, c, patch[c])), id],
  };
}

/* ───────────────────────── low-level store ───────────────────────── */

async function allRows(table) {
  await init();
  const rs = await client.execute(`SELECT * FROM ${table}`);
  return rs.rows.map((r) => decodeRow(table, r));
}

async function getRow(table, id) {
  await init();
  const rs = await client.execute({ sql: `SELECT * FROM ${table} WHERE id = ?`, args: [id] });
  return decodeRow(table, rs.rows[0]);
}

async function insertRow(table, row) {
  await init();
  await client.execute(insertStmt(table, row, false));
  return getRow(table, row.id);
}

async function upsertRow(table, row) {
  await init();
  await client.execute(insertStmt(table, row, true));
  return getRow(table, row.id);
}

async function updateRow(table, id, patch) {
  await init();
  const existing = await getRow(table, id);
  if (!existing) return null;
  await client.execute(updateStmt(table, id, patch));
  return getRow(table, id);
}

async function countTable(table) {
  await init();
  const rs = await client.execute(`SELECT COUNT(*) AS n FROM ${table}`);
  return Number(rs.rows[0].n);
}

/* ───────────────────────── helpers ───────────────────────── */

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(3).toString("hex")}`;
}

/** Compare phone numbers by digits only ("+91 98110 24567" === "9811024567"). */
function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function sortByDateDesc(field) {
  return (a, b) => new Date(b[field] || 0).getTime() - new Date(a[field] || 0).getTime();
}

/* ───────────────────────── serializers (mirror types.ts) ───────────────────────── */

const FALLBACK_HOST = {
  id: "unknown",
  name: "ParkingFriend Host",
  avatar: undefined,
  rating: 0,
  reviewsCount: 0,
  verified: false,
  responseTime: "within a day",
};

/** users row -> Host (types.ts) */
function toHost(userRow) {
  if (!userRow) return { ...FALLBACK_HOST };
  return {
    id: userRow.id,
    name: userRow.name,
    avatar: userRow.avatar || undefined,
    rating: Number(userRow.rating) || 0,
    reviewsCount: Number(userRow.reviewsCount) || 0,
    verified: !!userRow.verified,
    responseTime: userRow.responseTime || "within a day",
  };
}

/** users row -> User (types.ts) */
function toUser(userRow) {
  return {
    id: userRow.id,
    name: userRow.name,
    phone: userRow.phone,
    email: userRow.email || undefined,
    avatar: userRow.avatar || undefined,
    verified: !!userRow.verified,
    memberSince: (userRow.createdAt || new Date().toISOString()).slice(0, 10),
    rating: Number(userRow.rating) || 0,
    reviewsCount: Number(userRow.reviewsCount) || 0,
    driverRating: Number(userRow.driverRating) || 0,
    driverRatingCount: Number(userRow.driverRatingCount) || 0,
    role: "both",
  };
}

/** Today's date in the server's local timezone as "YYYY-MM-DD". */
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * A booking counts as "completed" (and so both parties may rate each other)
 * once it was accepted (confirmed/active) AND every parking day has fully
 * passed — a 3-day parking isn't complete after its first night. There's no
 * separate "finished" action — time passing is the signal.
 * (bookingDays / completedDaysOf are declared below; function hoisting.)
 */
function isBookingCompleted(row) {
  if (!row) return false;
  if (row.status !== "confirmed" && row.status !== "active") return false;
  return completedDaysOf(row, todayLocal()) >= bookingDays(row);
}

/**
 * Accepted bookings currently holding a slot at this spot.
 * "pending" doesn't hold a slot — only what the host has accepted counts,
 * and only for today or a future date: yesterday's parking frees its slot
 * automatically at midnight (bookings never transition to "completed" on
 * their own, so without the date scope a slot would be held forever).
 */
async function countActiveBookings(spotId) {
  await init();
  const rs = await client.execute({
    sql: "SELECT COUNT(*) AS n FROM bookings WHERE spotId = ? AND status IN ('confirmed', 'active') AND date >= ?",
    args: [spotId, todayLocal()],
  });
  return Number(rs.rows[0].n) || 0;
}

/**
 * Whether a spot is open for new bookings right now, considering BOTH the
 * host's on/off flag and the availability window:
 *   - always-available listings (default) are open whenever `available` is on;
 *   - date-ranged listings are open only from availableStartDate to
 *     availableEndDate (inclusive), in the server's local date.
 * Legacy rows (availableAlways null) are treated as always-available.
 */
function isSpotAvailableNow(row) {
  if (!row) return false;
  if (!row.available) return false;
  const always =
    row.availableAlways === undefined || row.availableAlways === null
      ? true
      : !!row.availableAlways;
  if (always) return true;
  const today = todayLocal();
  if (row.availableStartDate && today < row.availableStartDate) return false;
  if (row.availableEndDate && today > row.availableEndDate) return false;
  return true;
}

/* ── Bulk lookup helpers ──────────────────────────────────────────────
 * Turso is a NETWORK database: every query is a round-trip. Serializing a
 * list one row at a time (host lookup + slot count per row) turned a screen
 * of data into dozens of sequential round-trips — the "endless shimmer".
 * These helpers fetch everything a batch needs in a fixed handful of
 * queries, so list endpoints answer in ~4 round-trips no matter the size. */

/** Rows by id from ONE IN(...) query (chunked). Returns Map<id, row>. */
async function getRowsByIds(table, ids) {
  await init();
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  const out = new Map();
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const rs = await client.execute({
      sql: `SELECT * FROM ${table} WHERE id IN (${chunk.map(() => "?").join(", ")})`,
      args: chunk,
    });
    for (const r of rs.rows) {
      const d = decodeRow(table, r);
      out.set(String(d.id), d);
    }
  }
  return out;
}

/** Taken-slot counts for MANY spots in one GROUP BY query. Map<spotId, n>. */
async function countActiveBookingsBulk(spotIds) {
  await init();
  const unique = [...new Set(spotIds.filter(Boolean).map(String))];
  const out = new Map();
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const rs = await client.execute({
      sql: `SELECT spotId, COUNT(*) AS n FROM bookings WHERE spotId IN (${chunk.map(() => "?").join(", ")}) AND status IN ('confirmed', 'active') AND date >= ? GROUP BY spotId`,
      args: [...chunk, todayLocal()],
    });
    for (const r of rs.rows) out.set(String(r.spotId), Number(r.n) || 0);
  }
  return out;
}

/** Shared lookups for serializing a batch of spots: hosts + taken-slot counts. */
async function spotContext(rows) {
  const list = rows.filter(Boolean);
  const [hosts, counts] = await Promise.all([
    getRowsByIds("users", list.map((r) => r.hostId)),
    countActiveBookingsBulk(list.map((r) => r.id)),
  ]);
  return { hosts, counts };
}

/** spots row -> ParkingSpot (types.ts). SYNC — all lookups come via ctx. */
function toSpotWith(row, ctx) {
  if (!row) return null;
  const host = toHost(ctx.hosts.get(String(row.hostId)) || null);
  const capacity = Math.max(1, Number(row.capacity) || 1);
  const remainingCount = Math.max(0, capacity - (ctx.counts.get(String(row.id)) || 0));
  const availableAlways =
    row.availableAlways === undefined || row.availableAlways === null
      ? true
      : !!row.availableAlways;
  // Authoritative availability state (computed in the server's timezone so the
  // client never has to guess the reason from the device clock):
  //   off = switched off; upcoming = window not open yet; ended = window passed.
  let availabilityState = "open";
  if (!row.available) {
    availabilityState = "off";
  } else if (!availableAlways) {
    const today = todayLocal();
    if (row.availableStartDate && today < row.availableStartDate) availabilityState = "upcoming";
    else if (row.availableEndDate && today > row.availableEndDate) availabilityState = "ended";
  }
  return {
    id: row.id,
    title: row.title,
    hostId: row.hostId,
    host,
    type: row.type,
    vehicleTypes: Array.isArray(row.vehicleTypes) ? row.vehicleTypes : ["car"],
    capacity,
    remainingCount,
    address: row.address || "",
    area: row.area || "",
    city: row.city || "",
    landmark: row.landmark || "",
    nearStation: row.nearStation || "",
    distanceMeters: Number(row.distanceMeters) || 0,
    latitude: Number(row.latitude) || 0,
    longitude: Number(row.longitude) || 0,
    pricePerHour: Number(row.pricePerHour) || 0,
    pricePerDay: Number(row.pricePerDay) || 0,
    isFree: !!row.isFree,
    rating: Number(row.rating) || 0,
    reviewsCount: Number(row.reviewsCount) || 0,
    // Strip legacy random-placeholder URLs so old rows render the app's
    // vehicle-type graphic instead of a meaningless stock photo.
    images: (Array.isArray(row.images) ? row.images : []).filter(
      (u) => !String(u).includes("picsum.photos")
    ),
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    availableFrom: row.availableFrom || "00:00",
    availableTo: row.availableTo || "23:59",
    instructions: row.instructions || "",
    isFavorite: !!row.isFavorite,
    // `available` reflects BOTH the host's on/off flag and the date window, so
    // a listing outside its dates stops taking requests and reads as closed.
    available: isSpotAvailableNow(row),
    views: Math.max(0, Number(row.views) || 0),
    availableAlways,
    availableStartDate: row.availableStartDate || null,
    availableEndDate: row.availableEndDate || null,
    availabilityState,
  };
}

/** Serialize MANY spot rows with two lookup queries total (hosts + counts). */
async function toSpots(rows) {
  const ctx = await spotContext(rows);
  return rows.map((r) => (r ? toSpotWith(r, ctx) : null));
}

/** spots row -> ParkingSpot with host embedded. ASYNC (bulk path with one row). */
async function toSpot(row) {
  if (!row) return null;
  return (await toSpots([row]))[0];
}

/** Whole days a booking covers — a parking request is at least one full day. */
function bookingDays(row) {
  const hours = Number(row && row.durationHours) || 0;
  return Math.max(1, Math.ceil(hours / 24));
}

/**
 * What the driver pays: the LISTING's per-day price × days. Computed from the
 * live spot row (never an hourly formula), so the number the driver sees is
 * exactly the price on the listing — "₹50/day" can never turn into ₹48.
 * Falls back to the stored totalAmount only if the spot row is gone.
 */
function bookingAmount(row, spotRow) {
  if (spotRow) {
    if (spotRow.isFree) return 0;
    const perDay = Number(spotRow.pricePerDay) || 0;
    if (perDay > 0) return Math.round(perDay * bookingDays(row));
  }
  return Number(row.totalAmount) || 0;
}

/**
 * bookings row -> Booking (types.ts). SYNC — spotRow + ctx come prefetched.
 * Also carries the contract's `time` and `totalAmount` fields (additive;
 * `amount` === `totalAmount`, `startTime`/`endTime` derive from `time`).
 *
 * `hostPhone` is the spot host's phone number, revealed ONLY once the host
 * has accepted the request (`contactUnlocked`). Before that it is null —
 * the phone must never leak to the driver pre-acceptance.
 */
function toBookingWith(row, spotRow, ctx) {
  if (!row) return null;
  let hostPhone = null;
  if (row.contactUnlocked && spotRow) {
    const hostUser = ctx.hosts.get(String(spotRow.hostId));
    hostPhone = (hostUser && hostUser.phone) || null;
  }
  const amount = bookingAmount(row, spotRow);
  const booking = {
    id: row.id,
    spotId: row.spotId,
    spot: spotRow ? toSpotWith(spotRow, ctx) : null,
    userId: row.userId,
    vehicleType: row.vehicleType,
    vehicleNumber: row.vehicleNumber,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    time: row.time,
    durationHours: Number(row.durationHours) || 0,
    amount,
    totalAmount: amount,
    status: row.status,
    createdAt: row.createdAt,
    contactUnlocked: !!row.contactUnlocked,
    hostPhone,
    completed: isBookingCompleted(row),
  };
  if (row.otp) booking.otp = row.otp;
  if (row.cancelReason) booking.cancelReason = row.cancelReason;
  return booking;
}

/** Serialize MANY booking rows in ~4 lookup queries total. */
async function toBookings(rows) {
  const list = rows.filter(Boolean);
  const spotRows = await getRowsByIds("spots", list.map((b) => b.spotId));
  const ctx = await spotContext([...spotRows.values()]);
  return rows.map((b) =>
    b ? toBookingWith(b, spotRows.get(String(b.spotId)) || null, ctx) : null
  );
}

/** bookings row -> Booking with spot embedded. ASYNC (bulk path with one row). */
async function toBooking(row) {
  if (!row) return null;
  return (await toBookings([row]))[0];
}

/** host_requests row -> HostRequest (types.ts) */
function toHostRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookingId: row.bookingId || undefined,
    spotTitle: row.spotTitle,
    requesterId: row.requesterId || undefined,
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone || null,
    requesterAvatar: row.requesterAvatar || undefined,
    vehicleType: row.vehicleType,
    date: row.date,
    time: row.time,
    status: row.status,
  };
}

/** earnings row -> EarningEntry (types.ts) */
function toEarning(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    subtitle: row.subtitle || "",
    amount: Number(row.amount) || 0,
    date: row.date,
  };
}

/* ───────────────────────── repository: users ───────────────────────── */

async function getUserById(id) {
  return getRow("users", id);
}

async function findUserByPhone(phone) {
  const target = normalizePhone(phone);
  if (!target) return null;
  const users = await allRows("users");
  return users.find((u) => normalizePhone(u.phone) === target) || null;
}

async function createUser({ phone, name, email, avatar }) {
  const row = {
    id: genId("u"),
    phone: String(phone).trim(),
    name: (name && String(name).trim()) || "ParkingFriend User",
    email: email ? String(email).trim() : null,
    avatar: avatar || null,
    // No stars until real ratings arrive — reviewsCount 0 reads as "New".
    rating: 0,
    reviewsCount: 0,
    driverRating: 0,
    driverRatingCount: 0,
    verified: true,
    responseTime: "within an hour",
    createdAt: new Date().toISOString(),
  };
  return insertRow("users", row);
}

/** Update a user's editable profile fields (name / email / avatar). */
async function updateUserProfile(id, patch) {
  const clean = {};
  if (typeof patch.name === "string" && patch.name.trim()) clean.name = patch.name.trim();
  if (patch.email !== undefined) clean.email = patch.email ? String(patch.email).trim() : null;
  if (patch.avatar !== undefined) clean.avatar = patch.avatar || null;
  if (Object.keys(clean).length === 0) return getRow("users", id);
  return updateRow("users", id, clean);
}

/* ───────────────────────── repository: spots ───────────────────────── */

async function listSpots() {
  return allRows("spots");
}

async function getSpotRow(id) {
  return getRow("spots", id);
}

async function listSpotsByHost(hostId) {
  const spots = await allRows("spots");
  return spots
    .filter((s) => s.hostId === hostId && !s.removed)
    .sort(sortByDateDesc("createdAt"));
}

async function insertSpot(row) {
  return insertRow("spots", row);
}

/**
 * The host removes a listing. In ONE atomic write batch:
 *   - every still-live booking on the spot (pending/confirmed/active) is
 *     cancelled and its host contact re-locked (drivers see it as cancelled),
 *   - every pending incoming request for the spot is declined,
 *   - the spot is soft-removed (removed = 1, available = 0) so it vanishes from
 *     the map and My Space but stays on disk — the drivers' cancelled bookings
 *     keep their spot details (and it never trips the bookings→spots FK).
 * Returns { cancelledBookings } so the caller can tell the host what happened.
 * No reason is recorded here — cancelling a listing is the host's call.
 */
async function removeListingWithCascade(spotId) {
  await init();
  // Cancel everything that hasn't fully happened: future bookings AND
  // multi-day parkings still in progress (they must stop accruing once the
  // listing is gone). Only FULLY completed parkings are preserved as history,
  // so both sides can still rate each other for days that really happened.
  const today = todayLocal();
  const liveRs = await client.execute({
    sql: "SELECT * FROM bookings WHERE spotId = ? AND status IN ('pending', 'confirmed', 'active')",
    args: [spotId],
  });
  const toCancel = liveRs.rows
    .map((r) => decodeRow("bookings", r))
    // Pending requests are never history; accepted ones survive only if done.
    .filter((b) => b.status === "pending" || completedDaysOf(b, today) < bookingDays(b))
    .map((b) => b.id);
  const stmts = toCancel.map((id) =>
    updateStmt("bookings", id, { status: "cancelled", contactUnlocked: false })
  );
  stmts.push(
    {
      // Host removed the listing = host-initiated: retire BOTH pending and
      // accepted requests, so no "Confirmed guest" ghost survives the removal.
      sql: "UPDATE host_requests SET status = 'declined' WHERE spotId = ? AND status IN ('pending', 'accepted')",
      args: [spotId],
    },
    { sql: "UPDATE spots SET removed = 1, available = 0 WHERE id = ?", args: [spotId] }
  );
  await client.batch(stmts, "write");
  return { cancelledBookings: toCancel.length };
}

/**
 * Bump a spot's view counter by one (a driver opened its detail page).
 * COALESCE guards legacy rows whose `views` might be NULL. Returns the new count.
 */
async function incrementSpotViews(id) {
  await init();
  await client.execute({
    sql: "UPDATE spots SET views = COALESCE(views, 0) + 1 WHERE id = ?",
    args: [id],
  });
  const rs = await client.execute({
    sql: "SELECT views FROM spots WHERE id = ?",
    args: [id],
  });
  return Number(rs.rows[0] && rs.rows[0].views) || 0;
}

/* ───────────────────────── repository: bookings ───────────────────────── */

async function listBookingsByUser(userId) {
  const bookings = await allRows("bookings");
  return bookings.filter((b) => b.userId === userId).sort(sortByDateDesc("createdAt"));
}

async function getBookingRow(id) {
  return getRow("bookings", id);
}

async function insertBooking(row) {
  return insertRow("bookings", row);
}

async function updateBooking(id, patch) {
  return updateRow("bookings", id, patch);
}

/**
 * Create a booking AND its pending host request atomically (one write batch —
 * either both rows land or neither does). Returns the stored booking row.
 */
async function createBookingWithRequest(bookingRow, requestRow) {
  await init();
  await client.batch(
    [insertStmt("bookings", bookingRow, false), insertStmt("host_requests", requestRow, false)],
    "write"
  );
  return getRow("bookings", bookingRow.id);
}

/**
 * Cancel a booking AND retire its linked pending host request atomically, so
 * the host never sees (or accepts) a request the driver already withdrew.
 * `reason` (optional) is the driver's stated reason for cancelling.
 */
async function cancelBookingWithRequest(bookingRow, reason) {
  await init();
  const patch = { status: "cancelled", contactUnlocked: false };
  if (reason) patch.cancelReason = String(reason);
  const stmts = [updateStmt("bookings", bookingRow.id, patch)];
  const request = await findRequestByBookingId(bookingRow.id);
  // The DRIVER withdrew: retire the linked request whatever its state — a
  // PENDING one must never be acceptable afterwards, and an ACCEPTED one must
  // not keep showing as a confirmed guest on the host's side. The distinct
  // "cancelled" status lets the host's app say "the driver cancelled" (and
  // notify them) instead of it looking like the host declined.
  if (request && (request.status === "pending" || request.status === "accepted")) {
    stmts.push(updateStmt("host_requests", request.id, { status: "cancelled" }));
  }
  await client.batch(stmts, "write");
  return getRow("bookings", bookingRow.id);
}

/* ───────────────────────── repository: host requests ───────────────────────── */

async function listRequestsByHost(hostId) {
  const requests = await allRows("host_requests");
  return requests.filter((r) => r.hostId === hostId).sort(sortByDateDesc("date"));
}

async function getRequestRow(id) {
  return getRow("host_requests", id);
}

async function findRequestByBookingId(bookingId) {
  if (!bookingId) return null;
  const requests = await allRows("host_requests");
  return requests.find((r) => r.bookingId === bookingId) || null;
}

async function insertRequest(row) {
  return insertRow("host_requests", row);
}

async function updateRequest(id, patch) {
  return updateRow("host_requests", id, patch);
}

/**
 * Apply a host's accept/decline atomically (one write batch):
 *   - request status -> "accepted" | "declined"
 *   - linked booking (when it exists) -> "confirmed" + contactUnlocked on
 *     accept, "cancelled" on decline
 *   - optional earning row insert (accept only; caller builds it)
 * Partial writes can't happen — all statements commit or none do.
 * Returns the updated host_requests row.
 */
async function respondToRequest(requestRow, accept, earningRow) {
  await init();
  const stmts = [
    updateStmt("host_requests", requestRow.id, { status: accept ? "accepted" : "declined" }),
  ];
  if (requestRow.bookingId && (await getRow("bookings", requestRow.bookingId))) {
    stmts.push(
      updateStmt(
        "bookings",
        requestRow.bookingId,
        accept ? { status: "confirmed", contactUnlocked: true } : { status: "cancelled" }
      )
    );
  }
  if (earningRow) stmts.push(insertStmt("earnings", earningRow, false));
  await client.batch(stmts, "write");
  return getRow("host_requests", requestRow.id);
}

/* ───────────────────────── repository: earnings / wallet ───────────────────────── */

async function listEarningsByUser(userId) {
  const earnings = await allRows("earnings");
  return earnings.filter((e) => e.userId === userId).sort(sortByDateDesc("date"));
}

async function insertEarning(row) {
  return insertRow("earnings", row);
}

/** How many of a booking's parking days are fully in the past (a day earns once it's over). */
function completedDaysOf(row, today) {
  const start = String(row.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return 0;
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  if (!Number.isFinite(ms)) return 0;
  const elapsed = Math.floor(ms / 86400000);
  return Math.min(bookingDays(row), Math.max(0, elapsed));
}

/**
 * Hosting income, accrued DAY BY DAY: an accepted booking pays out the
 * listing's pricePerDay for every parking day that has fully passed —
 * nothing at accept time, the first ₹ appears the morning after the first
 * parked day, and a multi-day parking keeps adding each day. walletSummary
 * and /wallet/entries both build on this, so the numbers always agree.
 */
async function hostAccruals(userId) {
  await init();
  const today = todayLocal();
  const rs = await client.execute({
    sql: `SELECT b.*, s.pricePerDay AS spotPricePerDay, s.isFree AS spotIsFree, s.title AS spotTitle
          FROM bookings b JOIN spots s ON s.id = b.spotId
          WHERE s.hostId = ? AND b.status IN ('confirmed', 'active')`,
    args: [userId],
  });
  const out = [];
  for (const raw of rs.rows) {
    const daysTotal = bookingDays(raw);
    const daysDone = completedDaysOf(raw, today);
    if (daysDone <= 0) continue; // nothing earned until a day has passed
    const perDay = raw.spotIsFree ? 0 : Number(raw.spotPricePerDay) || 0;
    out.push({
      bookingId: raw.id,
      title: raw.spotTitle || "Your space",
      date: raw.date,
      daysDone,
      daysTotal,
      amount: Math.round(perDay * daysDone),
      completed: daysDone >= daysTotal,
    });
  }
  return out;
}

/**
 * WalletSummary exactly as typed in models/types.ts.
 * Host earnings are computed live from completed parking days (hostAccruals);
 * legacy accept-time 'earning' rows are IGNORED so nothing double-counts.
 * Driver savings still come from stored 'saving' rows.
 */
async function walletSummary(userId) {
  const entries = await listEarningsByUser(userId);
  const savings = entries.filter((e) => e.kind === "saving");
  const accruals = await hostAccruals(userId);
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 3);
  const cutoffMs = cutoff.getTime();
  const within3m = (x) => new Date(x.date).getTime() >= cutoffMs;
  const sum = (list) => list.reduce((total, e) => total + (Number(e.amount) || 0), 0);
  // Driver side: how many of the user's own parkings are fully done.
  const today = todayLocal();
  const own = await listBookingsByUser(userId);
  const completedAsDriver = own.filter(
    (b) =>
      (b.status === "confirmed" || b.status === "active") &&
      completedDaysOf(b, today) >= bookingDays(b)
  ).length;
  return {
    savingsLast3Months: sum(savings.filter(within3m)),
    savingsLifetime: sum(savings),
    earningsLast3Months: sum(accruals.filter(within3m)),
    earningsLifetime: sum(accruals),
    completedAsDriver,
    completedAsHost: accruals.filter((a) => a.completed).length,
  };
}

/* ───────────────────────── repository: ratings ───────────────────────── */

/** ratings row -> plain object for the API (rater name is added by the route). */
function toRating(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookingId: row.bookingId,
    spotId: row.spotId || null,
    raterId: row.raterId,
    rateeId: row.rateeId,
    raterRole: row.raterRole,
    stars: Number(row.stars) || 0,
    comment: row.comment || "",
    createdAt: row.createdAt,
  };
}

/** The rating already left for a booking by a given side ('driver'|'host'), or null. */
async function getRatingByBookingRole(bookingId, raterRole) {
  await init();
  const rs = await client.execute({
    sql: "SELECT * FROM ratings WHERE bookingId = ? AND raterRole = ? LIMIT 1",
    args: [bookingId, raterRole],
  });
  return decodeRow("ratings", rs.rows[0]);
}

async function insertRating(row) {
  return insertRow("ratings", row);
}

/** The driver-left reviews for a spot, newest first (for the public reviews list). */
async function listRatingsBySpot(spotId) {
  await init();
  const rs = await client.execute({
    sql: "SELECT * FROM ratings WHERE spotId = ? AND raterRole = 'driver' ORDER BY createdAt DESC",
    args: [spotId],
  });
  return rs.rows.map((r) => decodeRow("ratings", r));
}

/**
 * Recompute the denormalized reputation numbers after a driver rates a host:
 *   - the host's overall rating (users.rating/reviewsCount) = all driver→host
 *     ratings they've received, and
 *   - that specific spot's rating (spots.rating/reviewsCount) = driver→host
 *     ratings left for the spot.
 */
async function recomputeHostAndSpot(spotId, hostId) {
  await init();
  const hr = await client.execute({
    sql: "SELECT AVG(stars) AS a, COUNT(*) AS c FROM ratings WHERE rateeId = ? AND raterRole = 'driver'",
    args: [hostId],
  });
  const hAvg = hr.rows[0].a == null ? 0 : Number(hr.rows[0].a);
  const hCount = Number(hr.rows[0].c) || 0;
  await client.execute({
    sql: "UPDATE users SET rating = ?, reviewsCount = ? WHERE id = ?",
    args: [Math.round(hAvg * 100) / 100, hCount, hostId],
  });
  if (spotId) {
    const sr = await client.execute({
      sql: "SELECT AVG(stars) AS a, COUNT(*) AS c FROM ratings WHERE spotId = ? AND raterRole = 'driver'",
      args: [spotId],
    });
    const sAvg = sr.rows[0].a == null ? 0 : Number(sr.rows[0].a);
    const sCount = Number(sr.rows[0].c) || 0;
    await client.execute({
      sql: "UPDATE spots SET rating = ?, reviewsCount = ? WHERE id = ?",
      args: [Math.round(sAvg * 100) / 100, sCount, spotId],
    });
  }
}

/** Recompute a user's driver reputation after a host rates them. */
async function recomputeDriver(driverId) {
  await init();
  const r = await client.execute({
    sql: "SELECT AVG(stars) AS a, COUNT(*) AS c FROM ratings WHERE rateeId = ? AND raterRole = 'host'",
    args: [driverId],
  });
  const avg = r.rows[0].a == null ? 0 : Number(r.rows[0].a);
  const count = Number(r.rows[0].c) || 0;
  await client.execute({
    sql: "UPDATE users SET driverRating = ?, driverRatingCount = ? WHERE id = ?",
    args: [Math.round(avg * 100) / 100, count, driverId],
  });
}

/**
 * Every completed booking the user still needs to rate — as the driver (rating
 * the host) AND as the host (rating the driver). Each item carries the other
 * person's name/avatar and their relevant rating so the app can prompt nicely.
 */
async function pendingRatingsForUser(userId) {
  await init();
  const today = todayLocal();
  const out = [];

  // As a DRIVER — rate the host.
  const asDriver = await client.execute({
    sql: `SELECT b.* FROM bookings b
          WHERE b.userId = ? AND b.status IN ('confirmed','active') AND b.date < ?
          AND NOT EXISTS (SELECT 1 FROM ratings r WHERE r.bookingId = b.id AND r.raterRole = 'driver')`,
    args: [userId, today],
  });
  const driverRows = asDriver.rows.map((raw) => decodeRow("bookings", raw));

  // As a HOST — rate the driver.
  const asHost = await client.execute({
    sql: `SELECT b.* FROM bookings b JOIN spots s ON s.id = b.spotId
          WHERE s.hostId = ? AND b.status IN ('confirmed','active') AND b.date < ?
          AND NOT EXISTS (SELECT 1 FROM ratings r WHERE r.bookingId = b.id AND r.raterRole = 'host')`,
    args: [userId, today],
  });
  const hostRows = asHost.rows.map((raw) => decodeRow("bookings", raw));

  // Bulk-fetch every spot and person these prompts mention (2 queries).
  const spots = await getRowsByIds("spots", [...driverRows, ...hostRows].map((b) => b.spotId));
  const users = await getRowsByIds("users", [
    ...driverRows.map((b) => {
      const s = spots.get(String(b.spotId));
      return s && s.hostId;
    }),
    ...hostRows.map((b) => b.userId),
  ]);

  for (const b of driverRows) {
    const spot = spots.get(String(b.spotId));
    if (!spot) continue;
    const host = users.get(String(spot.hostId)) || null;
    out.push({
      bookingId: b.id,
      role: "driver",
      spotId: spot.id,
      spotTitle: spot.title,
      date: b.date,
      counterparty: {
        id: spot.hostId,
        name: (host && host.name) || "Host",
        avatar: (host && host.avatar) || null,
        rating: host ? Math.round((Number(host.rating) || 0) * 10) / 10 : 0,
        ratingCount: host ? Number(host.reviewsCount) || 0 : 0,
      },
    });
  }

  for (const b of hostRows) {
    const spot = spots.get(String(b.spotId)) || null;
    const driver = users.get(String(b.userId)) || null;
    out.push({
      bookingId: b.id,
      role: "host",
      spotId: b.spotId,
      spotTitle: spot ? spot.title : "Your space",
      date: b.date,
      counterparty: {
        id: b.userId,
        name: (driver && driver.name) || "Driver",
        avatar: (driver && driver.avatar) || null,
        rating: driver ? Math.round((Number(driver.driverRating) || 0) * 10) / 10 : 0,
        ratingCount: driver ? Number(driver.driverRatingCount) || 0 : 0,
      },
    });
  }

  return out;
}

/* ───────────────────────── repository: chat messages ───────────────────────── */

/**
 * Chat lives exactly as long as the parking does: it opens the moment the
 * request exists (pending — before the host even accepts) and stays open
 * through confirmed/active days. Once the parking is COMPLETED, CANCELLED or
 * DECLINED, the chat closes and its messages are deleted ("vanish").
 */
function isChatOpen(bookingRow) {
  if (!bookingRow) return false;
  if (bookingRow.status === "pending") return true;
  if (bookingRow.status !== "confirmed" && bookingRow.status !== "active") return false;
  return !isBookingCompleted(bookingRow);
}

function toMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookingId: row.bookingId,
    senderId: row.senderId,
    text: row.text || "",
    at: row.createdAt,
  };
}

async function listMessages(bookingId) {
  await init();
  const rs = await client.execute({
    sql: "SELECT * FROM messages WHERE bookingId = ? ORDER BY createdAt ASC",
    args: [bookingId],
  });
  return rs.rows.map((r) => decodeRow("messages", r));
}

async function insertMessage(row) {
  return insertRow("messages", row);
}

async function deleteMessagesForBooking(bookingId) {
  await init();
  await client.execute({
    sql: "DELETE FROM messages WHERE bookingId = ?",
    args: [bookingId],
  });
}

/**
 * Every LIVE chat the user participates in (as driver or host), with its last
 * message — one call the app can poll to raise "new message" notifications.
 * Only bookings whose chat is still open are included.
 */
async function chatSummaryForUser(userId) {
  await init();
  // Bookings where I'm the driver…
  const asDriver = (await allRows("bookings")).filter((b) => b.userId === userId);
  // …and bookings on spots I host.
  const mySpotIds = new Set(
    (await allRows("spots")).filter((s) => s.hostId === userId).map((s) => s.id)
  );
  const asHost = (await allRows("bookings")).filter((b) => mySpotIds.has(b.spotId));

  const summaries = [];
  const seen = new Set();
  for (const b of [...asDriver, ...asHost]) {
    if (seen.has(b.id) || !isChatOpen(b)) continue;
    seen.add(b.id);
    const msgs = await listMessages(b.id);
    if (msgs.length === 0) continue;
    const last = msgs[msgs.length - 1];
    const spot = await getRow("spots", b.spotId);
    const sender = await getRow("users", last.senderId);
    summaries.push({
      bookingId: b.id,
      spotTitle: spot ? spot.title : "Parking",
      lastText: last.text || "",
      lastAt: last.createdAt,
      lastFrom: last.senderId,
      lastFromName: (sender && sender.name) || "ParkingFriend user",
    });
  }
  return summaries;
}

let lastChatPurgeAt = 0;

/**
 * Deletes every chat whose parking has ended (completed/cancelled/declined or
 * the booking is gone). Lazy + throttled: runs at most once a minute, piggy-
 * backing on chat traffic — no cron needed, and a dead chat can never be read
 * again anyway because the routes check isChatOpen first.
 */
async function purgeDeadChats() {
  const now = Date.now();
  if (now - lastChatPurgeAt < 60000) return;
  lastChatPurgeAt = now;
  await init();
  const rs = await client.execute("SELECT DISTINCT bookingId FROM messages");
  for (const r of rs.rows) {
    const bookingId = String(r.bookingId);
    const booking = await getRow("bookings", bookingId);
    if (!isChatOpen(booking)) {
      await deleteMessagesForBooking(bookingId);
    }
  }
}

/* ───────────────────────── seed support ───────────────────────── */

const upsertUser = (row) => upsertRow("users", row);
const upsertSpot = (row) => upsertRow("spots", row);
const upsertBooking = (row) => upsertRow("bookings", row);
const upsertRequest = (row) => upsertRow("host_requests", row);
const upsertEarning = (row) => upsertRow("earnings", row);
const countRows = (table) => countTable(table);

module.exports = {
  backend,
  init,
  genId,
  normalizePhone,
  // serializers (toSpot/toBooking are async; the plural forms are bulk)
  toHost,
  toUser,
  toSpot,
  toSpots,
  toBooking,
  toBookings,
  toHostRequest,
  toEarning,
  toRating,
  isSpotAvailableNow,
  isBookingCompleted,
  getRowsByIds,
  // users
  getUserById,
  findUserByPhone,
  createUser,
  updateUserProfile,
  // spots
  listSpots,
  getSpotRow,
  listSpotsByHost,
  insertSpot,
  removeListingWithCascade,
  incrementSpotViews,
  countActiveBookings,
  // bookings
  listBookingsByUser,
  getBookingRow,
  insertBooking,
  updateBooking,
  createBookingWithRequest,
  cancelBookingWithRequest,
  // host requests
  listRequestsByHost,
  getRequestRow,
  findRequestByBookingId,
  insertRequest,
  updateRequest,
  respondToRequest,
  // earnings / wallet
  listEarningsByUser,
  insertEarning,
  walletSummary,
  hostAccruals,
  // ratings
  getRatingByBookingRole,
  insertRating,
  listRatingsBySpot,
  recomputeHostAndSpot,
  recomputeDriver,
  pendingRatingsForUser,
  // chat
  isChatOpen,
  toMessage,
  listMessages,
  insertMessage,
  deleteMessagesForBooking,
  purgeDeadChats,
  chatSummaryForUser,
  // seed helpers
  upsertUser,
  upsertSpot,
  upsertBooking,
  upsertRequest,
  upsertEarning,
  countRows,
};
