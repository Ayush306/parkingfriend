"use strict";

/**
 * Storage layer for the Parkmitter API.
 *
 * Backends (hidden from the rest of the app):
 *   - better-sqlite3 file DB at server/data/parkmitter.db  (preferred)
 *   - JSON file store at server/data/parkmitter.json       (fallback / DB_BACKEND=json)
 *
 * Both backends implement the same low-level store interface (see jsondb.js);
 * the repository functions and serializers below are backend-agnostic.
 * Serializers produce JSON that mirrors the app's src/models/types.ts exactly.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createJsonStore } = require("./jsondb");

const DATA_DIR = path.join(__dirname, "..", "data");
const SQLITE_FILE = path.join(DATA_DIR, "parkmitter.db");
const JSON_FILE = path.join(DATA_DIR, "parkmitter.json");

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

/* ───────────────────────── sqlite backend ───────────────────────── */

function createSqliteStore(Database) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const sqlite = new Database(SQLITE_FILE);
  sqlite.pragma("journal_mode = WAL");
  for (const stmt of DDL) sqlite.exec(stmt);

  // Lightweight migration for pre-existing db files: add columns that were
  // introduced after the table was first created.
  const requestCols = sqlite.prepare("PRAGMA table_info(host_requests)").all().map((c) => c.name);
  if (!requestCols.includes("requesterPhone")) {
    sqlite.exec("ALTER TABLE host_requests ADD COLUMN requesterPhone TEXT");
  }

  const stmtCache = new Map();
  function prepared(key, sql) {
    if (!stmtCache.has(key)) stmtCache.set(key, sqlite.prepare(sql));
    return stmtCache.get(key);
  }

  function encodeRow(table, row) {
    const out = {};
    const jsonCols = JSON_COLUMNS[table] || [];
    const boolCols = BOOL_COLUMNS[table] || [];
    for (const col of COLUMNS[table]) {
      let v = row[col];
      if (v === undefined) v = null;
      if (jsonCols.includes(col)) v = JSON.stringify(v == null ? [] : v);
      else if (boolCols.includes(col)) v = v ? 1 : 0;
      out[col] = v;
    }
    return out;
  }

  function decodeRow(table, row) {
    if (!row) return null;
    const out = { ...row };
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

  function insertSql(table, orReplace) {
    const cols = COLUMNS[table];
    return `INSERT ${orReplace ? "OR REPLACE " : ""}INTO ${table} (${cols.join(", ")}) VALUES (${cols.map((c) => `@${c}`).join(", ")})`;
  }

  return {
    name: "sqlite",

    all(table) {
      return prepared(`all:${table}`, `SELECT * FROM ${table}`)
        .all()
        .map((r) => decodeRow(table, r));
    },

    get(table, id) {
      const row = prepared(`get:${table}`, `SELECT * FROM ${table} WHERE id = ?`).get(id);
      return decodeRow(table, row);
    },

    insert(table, row) {
      prepared(`ins:${table}`, insertSql(table, false)).run(encodeRow(table, row));
      return this.get(table, row.id);
    },

    upsert(table, row) {
      prepared(`ups:${table}`, insertSql(table, true)).run(encodeRow(table, row));
      return this.get(table, row.id);
    },

    update(table, id, patch) {
      const existing = this.get(table, id);
      if (!existing) return null;
      const merged = encodeRow(table, { ...existing, ...patch, id });
      prepared(`ups:${table}`, insertSql(table, true)).run(merged);
      return this.get(table, id);
    },

    count(table) {
      return prepared(`cnt:${table}`, `SELECT COUNT(*) AS n FROM ${table}`).get().n;
    },
  };
}

/* ───────────────────────── backend selection ───────────────────────── */

function pickStore() {
  const forced = (process.env.DB_BACKEND || "").toLowerCase();
  if (forced !== "json") {
    try {
      const Database = require("better-sqlite3");
      const probe = new Database(":memory:"); // smoke-test the native binding
      probe.close();
      return createSqliteStore(Database);
    } catch (err) {
      if (forced === "sqlite") throw err;
      console.warn(`[db] better-sqlite3 unavailable (${err.message.split("\n")[0]}) — using JSON file store.`);
    }
  }
  return createJsonStore(JSON_FILE, Object.keys(COLUMNS));
}

const store = pickStore();
const backend = store.name; // "sqlite" | "json"

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
  name: "Parkmitter Host",
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

/** spots row -> ParkingSpot (types.ts) with host embedded */
function toSpot(row) {
  if (!row) return null;
  const host = toHost(store.get("users", row.hostId));
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
 * bookings row -> Booking (types.ts) with spot embedded.
 * Also carries the contract's `time` and `totalAmount` fields (additive;
 * `amount` === `totalAmount`, `startTime`/`endTime` derive from `time`).
 *
 * `hostPhone` is the spot host's phone number, revealed ONLY once the host
 * has accepted the request (`contactUnlocked`). Before that it is null —
 * the phone must never leak to the driver pre-acceptance.
 */
function toBooking(row) {
  if (!row) return null;
  const spotRow = store.get("spots", row.spotId);
  let hostPhone = null;
  if (row.contactUnlocked && spotRow) {
    const hostUser = store.get("users", spotRow.hostId);
    hostPhone = (hostUser && hostUser.phone) || null;
  }
  const booking = {
    id: row.id,
    spotId: row.spotId,
    spot: spotRow ? toSpot(spotRow) : null,
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

function getUserById(id) {
  return store.get("users", id);
}

function findUserByPhone(phone) {
  const target = normalizePhone(phone);
  if (!target) return null;
  return store.all("users").find((u) => normalizePhone(u.phone) === target) || null;
}

function createUser({ phone, name }) {
  const row = {
    id: genId("u"),
    phone: String(phone).trim(),
    name: name || "Parkmitter User",
    avatar: null,
    rating: 5,
    reviewsCount: 0,
    verified: true,
    responseTime: "within an hour",
    createdAt: new Date().toISOString(),
  };
  return store.insert("users", row);
}

/* ───────────────────────── repository: spots ───────────────────────── */

function listSpots() {
  return store.all("spots");
}

function getSpotRow(id) {
  return store.get("spots", id);
}

function listSpotsByHost(hostId) {
  return store
    .all("spots")
    .filter((s) => s.hostId === hostId)
    .sort(sortByDateDesc("createdAt"));
}

function insertSpot(row) {
  return store.insert("spots", row);
}

/* ───────────────────────── repository: bookings ───────────────────────── */

function listBookingsByUser(userId) {
  return store
    .all("bookings")
    .filter((b) => b.userId === userId)
    .sort(sortByDateDesc("createdAt"));
}

function getBookingRow(id) {
  return store.get("bookings", id);
}

function insertBooking(row) {
  return store.insert("bookings", row);
}

function updateBooking(id, patch) {
  return store.update("bookings", id, patch);
}

/* ───────────────────────── repository: host requests ───────────────────────── */

function listRequestsByHost(hostId) {
  return store
    .all("host_requests")
    .filter((r) => r.hostId === hostId)
    .sort(sortByDateDesc("date"));
}

function getRequestRow(id) {
  return store.get("host_requests", id);
}

function insertRequest(row) {
  return store.insert("host_requests", row);
}

function updateRequest(id, patch) {
  return store.update("host_requests", id, patch);
}

/* ───────────────────────── repository: earnings / wallet ───────────────────────── */

function listEarningsByUser(userId) {
  return store
    .all("earnings")
    .filter((e) => e.userId === userId)
    .sort(sortByDateDesc("date"));
}

function insertEarning(row) {
  return store.insert("earnings", row);
}

/** WalletSummary exactly as typed in models/types.ts. */
function walletSummary(userId) {
  const entries = listEarningsByUser(userId);
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

const upsertUser = (row) => store.upsert("users", row);
const upsertSpot = (row) => store.upsert("spots", row);
const upsertBooking = (row) => store.upsert("bookings", row);
const upsertRequest = (row) => store.upsert("host_requests", row);
const upsertEarning = (row) => store.upsert("earnings", row);
const countRows = (table) => store.count(table);

module.exports = {
  backend,
  genId,
  normalizePhone,
  // serializers
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
  // host requests
  listRequestsByHost,
  getRequestRow,
  insertRequest,
  updateRequest,
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
