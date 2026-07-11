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
    "id", "phone", "name", "avatar", "rating", "reviewsCount",
    "verified", "responseTime", "createdAt",
  ],
  spots: [
    "id", "hostId", "title", "type", "vehicleTypes", "address", "area", "city",
    "landmark", "nearStation", "distanceMeters", "latitude", "longitude",
    "pricePerHour", "pricePerDay", "isFree", "rating", "reviewsCount",
    "images", "amenities", "availableFrom", "availableTo", "instructions",
    "isFavorite", "available", "createdAt",
  ],
  bookings: [
    "id", "userId", "spotId", "date", "time", "startTime", "endTime",
    "durationHours", "vehicleType", "vehicleNumber", "status", "totalAmount",
    "contactUnlocked", "otp", "createdAt",
  ],
  host_requests: [
    "id", "hostId", "spotId", "bookingId", "spotTitle", "requesterName",
    "requesterPhone", "requesterAvatar", "vehicleType", "date", "time", "status",
  ],
  earnings: [
    "id", "userId", "kind", "title", "subtitle", "amount", "date", "bookingId",
  ],
};

const JSON_COLUMNS = { spots: ["vehicleTypes", "images", "amenities"] };
const BOOL_COLUMNS = {
  users: ["verified"],
  spots: ["isFree", "isFavorite", "available"],
  bookings: ["contactUnlocked"],
};

const DDL = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE,
    name TEXT NOT NULL,
    avatar TEXT,
    rating REAL DEFAULT 5,
    reviewsCount INTEGER DEFAULT 0,
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
    createdAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS host_requests (
    id TEXT PRIMARY KEY,
    hostId TEXT REFERENCES users(id),
    spotId TEXT,
    bookingId TEXT,
    spotTitle TEXT,
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
    avatar: userRow.avatar || undefined,
    verified: !!userRow.verified,
    memberSince: (userRow.createdAt || new Date().toISOString()).slice(0, 10),
    rating: Number(userRow.rating) || 5,
    role: "both",
  };
}

/** spots row -> ParkingSpot (types.ts) with host embedded. ASYNC (host lookup). */
async function toSpot(row) {
  if (!row) return null;
  const host = toHost(await getRow("users", row.hostId));
  return {
    id: row.id,
    title: row.title,
    hostId: row.hostId,
    host,
    type: row.type,
    vehicleTypes: Array.isArray(row.vehicleTypes) ? row.vehicleTypes : ["car"],
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
    images: Array.isArray(row.images) ? row.images : [],
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    availableFrom: row.availableFrom || "00:00",
    availableTo: row.availableTo || "23:59",
    instructions: row.instructions || "",
    isFavorite: !!row.isFavorite,
    available: !!row.available,
  };
}

/**
 * bookings row -> Booking (types.ts) with spot embedded. ASYNC (spot/host lookups).
 * Also carries the contract's `time` and `totalAmount` fields (additive;
 * `amount` === `totalAmount`, `startTime`/`endTime` derive from `time`).
 *
 * `hostPhone` is the spot host's phone number, revealed ONLY once the host
 * has accepted the request (`contactUnlocked`). Before that it is null —
 * the phone must never leak to the driver pre-acceptance.
 */
async function toBooking(row) {
  if (!row) return null;
  const spotRow = await getRow("spots", row.spotId);
  let hostPhone = null;
  if (row.contactUnlocked && spotRow) {
    const hostUser = await getRow("users", spotRow.hostId);
    hostPhone = (hostUser && hostUser.phone) || null;
  }
  const booking = {
    id: row.id,
    spotId: row.spotId,
    spot: spotRow ? await toSpot(spotRow) : null,
    userId: row.userId,
    vehicleType: row.vehicleType,
    vehicleNumber: row.vehicleNumber,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    time: row.time,
    durationHours: Number(row.durationHours) || 0,
    amount: Number(row.totalAmount) || 0,
    totalAmount: Number(row.totalAmount) || 0,
    status: row.status,
    createdAt: row.createdAt,
    contactUnlocked: !!row.contactUnlocked,
    hostPhone,
  };
  if (row.otp) booking.otp = row.otp;
  return booking;
}

/** host_requests row -> HostRequest (types.ts) */
function toHostRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookingId: row.bookingId || undefined,
    spotTitle: row.spotTitle,
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

async function createUser({ phone, name }) {
  const row = {
    id: genId("u"),
    phone: String(phone).trim(),
    name: name || "ParkingFriend User",
    avatar: null,
    rating: 5,
    reviewsCount: 0,
    verified: true,
    responseTime: "within an hour",
    createdAt: new Date().toISOString(),
  };
  return insertRow("users", row);
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
  return spots.filter((s) => s.hostId === hostId).sort(sortByDateDesc("createdAt"));
}

async function insertSpot(row) {
  return insertRow("spots", row);
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
 */
async function cancelBookingWithRequest(bookingRow) {
  await init();
  const stmts = [
    updateStmt("bookings", bookingRow.id, { status: "cancelled", contactUnlocked: false }),
  ];
  const request = await findRequestByBookingId(bookingRow.id);
  if (request && request.status === "pending") {
    stmts.push(updateStmt("host_requests", request.id, { status: "declined" }));
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

/** WalletSummary exactly as typed in models/types.ts. */
async function walletSummary(userId) {
  const entries = await listEarningsByUser(userId);
  const savings = entries.filter((e) => e.kind === "saving");
  const earnings = entries.filter((e) => e.kind === "earning");
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 3);
  const cutoffMs = cutoff.getTime();
  const within3m = (e) => new Date(e.date).getTime() >= cutoffMs;
  const sum = (list) => list.reduce((total, e) => total + (Number(e.amount) || 0), 0);
  return {
    savingsLast3Months: sum(savings.filter(within3m)),
    savingsLifetime: sum(savings),
    earningsLast3Months: sum(earnings.filter(within3m)),
    earningsLifetime: sum(earnings),
    completedAsDriver: savings.length,
    completedAsHost: earnings.length,
  };
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
  // serializers (toSpot/toBooking are async)
  toHost,
  toUser,
  toSpot,
  toBooking,
  toHostRequest,
  toEarning,
  // users
  getUserById,
  findUserByPhone,
  createUser,
  // spots
  listSpots,
  getSpotRow,
  listSpotsByHost,
  insertSpot,
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
  // seed helpers
  upsertUser,
  upsertSpot,
  upsertBooking,
  upsertRequest,
  upsertEarning,
  countRows,
};
