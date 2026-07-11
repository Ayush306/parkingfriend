"use strict";

/**
 * Tiny JSON-file data store — the drop-in fallback backend used when
 * better-sqlite3 cannot be installed (native build/download failures).
 *
 * It exposes the exact same low-level store interface that src/db.js builds
 * its repository functions on top of:
 *
 *   all(table)            -> row[]           (deep copies)
 *   get(table, id)        -> row | null
 *   insert(table, row)    -> row             (throws on duplicate id)
 *   upsert(table, row)    -> row             (insert or full replace by id)
 *   update(table, id, p)  -> row | null      (shallow merge patch)
 *   count(table)          -> number
 *
 * Rows are stored with native JS types (arrays/booleans as-is), so no
 * encode/decode step is needed. Every mutation is persisted synchronously
 * to disk (write-to-temp + rename) to survive restarts.
 */

const fs = require("fs");
const path = require("path");

function deepClone(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function createJsonStore(filePath, tableNames) {
  let data = {};

  // Load existing data if present; tolerate a corrupt/missing file.
  try {
    if (fs.existsSync(filePath)) {
      data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (err) {
    console.warn(`[jsondb] Could not read ${filePath} (${err.message}) — starting fresh.`);
    data = {};
  }
  for (const t of tableNames) {
    if (!Array.isArray(data[t])) data[t] = [];
  }

  function save() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const payload = JSON.stringify(data, null, 2);
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, payload, "utf8");
    // Atomic-ish swap. On Windows, antivirus/indexers can briefly lock the
    // target and make rename throw EPERM — retry, then fall back to a
    // direct overwrite (still safe: the payload is already on disk in tmp).
    for (let attempt = 0; ; attempt++) {
      try {
        fs.renameSync(tmp, filePath);
        return;
      } catch (err) {
        const transient = ["EPERM", "EACCES", "EBUSY"].includes(err.code);
        if (!transient || attempt >= 4) {
          fs.writeFileSync(filePath, payload, "utf8");
          try {
            fs.unlinkSync(tmp);
          } catch {}
          return;
        }
        const until = Date.now() + 25 * (attempt + 1);
        while (Date.now() < until) {} // brief synchronous backoff
      }
    }
  }

  function table(name) {
    const rows = data[name];
    if (!rows) throw new Error(`[jsondb] Unknown table: ${name}`);
    return rows;
  }

  return {
    name: "json",

    all(t) {
      return table(t).map(deepClone);
    },

    get(t, id) {
      const row = table(t).find((r) => r.id === id);
      return row ? deepClone(row) : null;
    },

    insert(t, row) {
      const rows = table(t);
      if (rows.some((r) => r.id === row.id)) {
        throw new Error(`[jsondb] Duplicate id "${row.id}" in table "${t}"`);
      }
      rows.push(deepClone(row));
      save();
      return deepClone(row);
    },

    upsert(t, row) {
      const rows = table(t);
      const idx = rows.findIndex((r) => r.id === row.id);
      if (idx === -1) rows.push(deepClone(row));
      else rows[idx] = deepClone(row);
      save();
      return deepClone(row);
    },

    update(t, id, patch) {
      const rows = table(t);
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) return null;
      rows[idx] = { ...rows[idx], ...deepClone(patch) };
      save();
      return deepClone(rows[idx]);
    },

    count(t) {
      return table(t).length;
    },
  };
}

module.exports = { createJsonStore };
