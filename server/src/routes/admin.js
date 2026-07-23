"use strict";

/**
 * Founder admin dashboard (mounted at app root):
 *
 *   GET  /admin            -> self-contained HTML dashboard (login built in)
 *   POST /admin/login      -> {key} — timing-safe check against ADMIN_KEY env,
 *                             sets an HttpOnly signed-cookie session (7 days)
 *   POST /admin/logout     -> clears the session cookie
 *   GET  /api/admin/stats  -> the full stats JSON (cookie or x-admin-key)
 *
 * Security model:
 *   - Enabled ONLY when ADMIN_KEY (>= 8 chars) is set in the environment —
 *     there is no default key, so a fresh deploy can't be opened by guessing.
 *   - Login attempts are rate-limited per IP (10 per 15 min).
 *   - The session cookie is an HttpOnly JWT {role:"admin"} — the browser JS
 *     never sees it; Secure is set behind HTTPS (Render).
 */

const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { JWT_SECRET } = require("../auth");

const router = express.Router();

const ADMIN_KEY = process.env.ADMIN_KEY || "";
const COOKIE_NAME = "pf_admin";
const SESSION_TTL = "7d";

const adminEnabled = () => ADMIN_KEY.length >= 8;

// Admin sessions get their OWN signing secret, derived from BOTH JWT_SECRET
// and ADMIN_KEY. If a deployment forgets to override the dev JWT_SECRET, an
// attacker who knows the public dev default still can't forge an admin cookie
// without also knowing ADMIN_KEY — and rotating ADMIN_KEY invalidates all
// admin sessions for free.
const ADMIN_SESSION_SECRET = crypto
  .createHmac("sha256", JWT_SECRET)
  .update(`pf-admin:${ADMIN_KEY}`)
  .digest();

/** Constant-time comparison — a naive === leaks key length/prefix via timing. */
function keyMatches(candidate) {
  const a = Buffer.from(String(candidate || ""));
  const b = Buffer.from(ADMIN_KEY);
  if (a.length !== b.length) {
    // Compare against self to keep timing flat, then reject.
    crypto.timingSafeEqual(b, b);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

/* Wrong-key attempt limiter: 10 FAILURES / 15 min / IP, applied to BOTH
 * credential paths (the login form AND the x-admin-key header) — otherwise
 * the header path would allow unthrottled brute force of ADMIN_KEY.
 * Only failures count, so a valid monitoring key is never locked out.
 * req.ip is proxy-validated (trust proxy in index.js), not spoofable. */
const attempts = new Map();
const clientIp = (req) => req.ip || "?";

function isLimited(req) {
  const a = attempts.get(clientIp(req));
  return !!a && Date.now() < a.resetAt && a.count >= 10;
}

function recordFailedAttempt(req) {
  const ip = clientIp(req);
  const now = Date.now();
  let a = attempts.get(ip);
  if (!a || now >= a.resetAt) {
    a = { count: 0, resetAt: now + 15 * 60 * 1000 };
    attempts.set(ip, a);
  }
  a.count += 1;
  if (attempts.size > 2000) {
    for (const [k, v] of attempts) if (now >= v.resetAt) attempts.delete(k);
    // Still over after evicting expired = an active flood; clearing resets
    // counters (fail-open for one window) but bounds memory absolutely.
    if (attempts.size > 5000) attempts.clear();
  }
}

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

function isHttps(req) {
  return req.secure || String(req.headers["x-forwarded-proto"] || "").includes("https");
}

/** Cookie session OR explicit x-admin-key header (for scripts/monitoring). */
function requireAdmin(req, res, next) {
  if (!adminEnabled()) {
    return res.status(503).json({ error: "Admin is not configured (set ADMIN_KEY)" });
  }
  const headerKey = req.headers["x-admin-key"];
  if (headerKey) {
    if (isLimited(req)) {
      return res.status(429).json({ error: "Too many attempts — try again in 15 minutes" });
    }
    if (keyMatches(headerKey)) return next();
    recordFailedAttempt(req);
  }
  const cookie = readCookie(req, COOKIE_NAME);
  if (cookie) {
    try {
      const payload = jwt.verify(cookie, ADMIN_SESSION_SECRET);
      if (payload && payload.role === "admin") return next();
    } catch {
      /* fall through */
    }
  }
  return res.status(401).json({ error: "Admin login required" });
}

router.post("/admin/login", express.json(), (req, res) => {
  if (!adminEnabled()) {
    return res.status(503).json({ error: "Admin is not configured (set ADMIN_KEY)" });
  }
  if (isLimited(req)) {
    return res.status(429).json({ error: "Too many attempts — try again in 15 minutes" });
  }
  const key = (req.body || {}).key;
  if (!keyMatches(key)) {
    recordFailedAttempt(req);
    return res.status(401).json({ error: "Wrong admin key" });
  }
  const token = jwt.sign({ role: "admin" }, ADMIN_SESSION_SECRET, { expiresIn: SESSION_TTL });
  const flags = [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${7 * 24 * 3600}`,
  ];
  if (isHttps(req)) flags.push("Secure");
  res.setHeader("Set-Cookie", flags.join("; "));
  res.json({ ok: true });
});

router.post("/admin/logout", (req, res) => {
  const flags = [`${COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isHttps(req)) flags.push("Secure");
  res.setHeader("Set-Cookie", flags.join("; "));
  res.json({ ok: true });
});

router.get("/api/admin/stats", requireAdmin, async (req, res, next) => {
  try {
    res.json(await db.adminStats());
  } catch (err) {
    next(err);
  }
});

/* ── The dashboard page: one self-contained file, zero external assets ── */
router.get("/admin", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(DASHBOARD_HTML);
});

const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>ParkingFriend · Admin</title>
<style>
  :root { --brand:#0FB57E; --bg:#F4F7F6; --card:#FFFFFF; --text:#101828; --muted:#667085; --line:#E4E7EC; --bad:#D92D20; --warn:#DC6803; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:-apple-system, "Segoe UI", Roboto, sans-serif; background:var(--bg); color:var(--text); padding:16px; }
  .wrap { max-width:1080px; margin:0 auto; }
  header { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
  h1 { font-size:20px; } h1 .dot { color:var(--brand); }
  .meta { font-size:12px; color:var(--muted); }
  .btn { background:var(--brand); color:#fff; border:0; border-radius:10px; padding:10px 16px; font-size:14px; font-weight:600; cursor:pointer; }
  .btn.ghost { background:#fff; color:var(--muted); border:1px solid var(--line); }
  .grid { display:grid; gap:12px; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); margin-bottom:16px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px; }
  .kpi .label { font-size:12px; color:var(--muted); }
  .kpi .value { font-size:26px; font-weight:800; margin-top:4px; }
  .kpi .sub { font-size:11px; color:var(--muted); margin-top:2px; }
  .kpi.alert .value { color:var(--bad); }
  .section { margin:22px 0 10px; font-size:14px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
  .cols { display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th, td { text-align:left; padding:7px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--muted); font-size:11px; text-transform:uppercase; }
  .bar-row { display:flex; align-items:center; gap:8px; margin:6px 0; font-size:13px; }
  .bar-label { width:130px; color:var(--muted); flex-shrink:0; }
  .bar-track { flex:1; background:var(--bg); border-radius:6px; height:18px; overflow:hidden; }
  .bar-fill { background:var(--brand); height:100%; border-radius:6px; min-width:2px; }
  .bar-num { width:44px; text-align:right; font-weight:700; }
  .spark { display:flex; align-items:flex-end; gap:3px; height:70px; padding-top:8px; }
  .spark .b { flex:1; background:var(--brand); border-radius:3px 3px 0 0; min-height:2px; }
  .spark-dates { display:flex; justify-content:space-between; font-size:10px; color:var(--muted); margin-top:4px; }
  .pill { display:inline-block; padding:2px 8px; border-radius:99px; font-size:11px; font-weight:700; }
  .pill.ok { background:#ECFDF3; color:#067647; } .pill.bad { background:#FEF3F2; color:var(--bad); }
  #login { max-width:360px; margin:14vh auto; text-align:center; }
  #login input { width:100%; padding:12px; font-size:15px; border:1px solid var(--line); border-radius:10px; margin:14px 0 10px; }
  #login .err { color:var(--bad); font-size:13px; min-height:18px; margin-bottom:8px; }
  .muted { color:var(--muted); } .right { text-align:right; }
  @media (max-width:600px){ .bar-label{width:96px} }
</style>
</head>
<body>
<div class="wrap">
  <div id="login" style="display:none">
    <div class="card" style="padding:26px">
      <h1 style="margin-bottom:4px">ParkingFriend<span class="dot"> ·</span> Admin</h1>
      <div class="meta">Enter your admin key to open the dashboard.</div>
      <input id="key" type="password" placeholder="Admin key" autocomplete="current-password">
      <div class="err" id="loginErr"></div>
      <button class="btn" style="width:100%" onclick="doLogin()">Open dashboard</button>
    </div>
  </div>

  <div id="dash" style="display:none">
    <header>
      <div>
        <h1>ParkingFriend<span class="dot"> ·</span> Admin</h1>
        <div class="meta" id="meta"></div>
      </div>
      <div style="display:flex; gap:8px">
        <button class="btn ghost" onclick="logout()">Log out</button>
        <button class="btn" onclick="load()">Refresh</button>
      </div>
    </header>
    <div id="content"></div>
  </div>
</div>

<script>
"use strict";
function el(id){ return document.getElementById(id); }
function n(v){ return (v === null || v === undefined) ? "—" : Number(v).toLocaleString("en-IN"); }
function esc(s){ var d = document.createElement("div"); d.textContent = String(s == null ? "" : s); return d.innerHTML; }

function kpi(label, value, sub, alert){
  return '<div class="card kpi' + (alert ? ' alert' : '') + '"><div class="label">' + esc(label) +
    '</div><div class="value">' + value + '</div><div class="sub">' + esc(sub || "") + '</div></div>';
}
function bars(items){
  var max = 1;
  items.forEach(function(it){ if (it.value > max) max = it.value; });
  return items.map(function(it){
    return '<div class="bar-row"><div class="bar-label">' + esc(it.label) + '</div>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + Math.round((it.value / max) * 100) + '%"></div></div>' +
      '<div class="bar-num">' + n(it.value) + '</div></div>';
  }).join("");
}
function spark(series){
  if (!series || !series.length) return '<div class="muted" style="font-size:13px">No data yet.</div>';
  var max = 1;
  series.forEach(function(p){ if (p.value > max) max = p.value; });
  var bs = series.map(function(p){
    return '<div class="b" title="' + esc(p.date) + ': ' + n(p.value) + '" style="height:' + Math.max(3, Math.round((p.value / max) * 100)) + '%"></div>';
  }).join("");
  return '<div class="spark">' + bs + '</div><div class="spark-dates"><span>' +
    esc(series[0].date.slice(5)) + '</span><span>' + esc(series[series.length - 1].date.slice(5)) + '</span></div>';
}

function render(s){
  var uptimeH = Math.floor(s.health.uptimeSec / 3600);
  el("meta").textContent = "Updated " + new Date(s.generatedAt).toLocaleTimeString() +
    " · server up " + (uptimeH > 0 ? uptimeH + "h" : Math.floor(s.health.uptimeSec / 60) + "m") +
    " · tap Refresh for the latest";

  var h = "";
  h += '<div class="section">Users</div><div class="grid">';
  h += kpi("Total users", n(s.users.total), "+" + n(s.users.new7d) + " this week · " + n(s.users.signups30d) + " in 30d");
  h += kpi("Active now", n(s.active.now), "last 15 minutes");
  h += kpi("Active today", n(s.active.dau), "DAU · week " + n(s.active.wau) + " · month " + n(s.active.mau));
  h += kpi("Devices seen", n(s.users.devicesSeen), "installed & opened (all time)");
  h += kpi("Hosts", n(s.users.hosts), "listed at least one space");
  h += kpi("Drivers", n(s.users.drivers), "requested at least once");
  h += kpi("Push enabled", n(s.users.pushEnabled), "get phone notifications");
  h += '</div>';

  h += '<div class="section">Business</div><div class="grid">';
  h += kpi("Earnings accrued", "₹" + n(s.revenue.accruedTotal), "all hosts, completed days");
  h += kpi("Live spots", n(s.supply.spotsLive), n(s.supply.totalCapacity) + " total slots");
  h += kpi("Bookings (7d)", n(s.bookings.created7d), n(s.bookings.created24h) + " in last 24h");
  h += kpi("Acceptance rate", s.requests.acceptanceRate === null ? "—" : s.requests.acceptanceRate + "%", "of decided requests");
  h += '</div>';

  h += '<div class="cols">';
  h += '<div class="card"><div class="section" style="margin-top:0">Bookings by state</div>' + bars([
    { label: "Waiting for host", value: s.bookings.pending },
    { label: "Upcoming / active", value: s.bookings.upcoming },
    { label: "Completed", value: s.bookings.completed },
    { label: "Cancelled by driver", value: s.bookings.cancelledByDriver },
    { label: "Cancelled by host", value: s.bookings.cancelledByHost },
    { label: "Declined", value: s.bookings.declined }
  ]) + '</div>';
  h += '<div class="card"><div class="section" style="margin-top:0">User journey (30 days)</div>' + bars([
    { label: "Opened app", value: s.engagement.funnel30d.openedApp },
    { label: "Signed in", value: s.engagement.funnel30d.signedIn },
    { label: "Viewed a spot", value: s.engagement.funnel30d.viewedSpot },
    { label: "Requested", value: s.engagement.funnel30d.requestedBooking },
    { label: "Got accepted", value: s.engagement.funnel30d.gotAccepted }
  ]) + '<div class="muted" style="font-size:11px;margin-top:6px">Each step = unique people. A big drop between two steps shows where people get stuck.</div></div>';
  h += '</div>';

  h += '<div class="cols" style="margin-top:12px">';
  h += '<div class="card"><div class="section" style="margin-top:0">Daily active users (14 days)</div>' + spark(s.series.dau) + '</div>';
  h += '<div class="card"><div class="section" style="margin-top:0">New bookings per day (14 days)</div>' + spark(s.series.bookings) + '</div>';
  h += '</div>';

  h += '<div class="cols" style="margin-top:12px">';
  var scr = (s.engagement.topScreens7d || []).map(function(t){ return { label: t.screen, value: t.views }; });
  h += '<div class="card"><div class="section" style="margin-top:0">Most visited screens (7 days)</div>' +
    (scr.length ? bars(scr) : '<div class="muted" style="font-size:13px">No screen data yet.</div>') + '</div>';

  var errPill = s.errors.last24h > 0 ? '<span class="pill bad">' + n(s.errors.last24h) + ' in 24h</span>' : '<span class="pill ok">0 in 24h</span>';
  var rows = (s.errors.recent || []).map(function(e){
    return '<tr><td>' + esc(new Date(e.at).toLocaleString()) + '</td><td>' + esc(e.message) +
      (e.fatal ? ' <span class="pill bad">crash</span>' : '') + '</td><td class="muted">' +
      esc((e.screen || "?") + " · " + (e.deviceModel || e.platform || "?") + " · v" + (e.appVersion || "?")) + '</td></tr>';
  }).join("");
  h += '<div class="card"><div class="section" style="margin-top:0">App errors ' + errPill +
    ' <span class="muted" style="font-weight:400;text-transform:none">· ' + n(s.errors.usersAffected24h) + ' users affected today</span></div>' +
    (rows ? '<div style="overflow-x:auto"><table><tr><th>When</th><th>Error</th><th>Where</th></tr>' + rows + '</table></div>'
          : '<div class="muted" style="font-size:13px">No errors reported. 🎉</div>') + '</div>';
  h += '</div>';

  el("content").innerHTML = h;
}

function load(){
  fetch("/api/admin/stats", { credentials: "same-origin" })
    .then(function(r){
      if (r.status === 401 || r.status === 503) { showLogin(r.status === 503); return null; }
      return r.json();
    })
    .then(function(s){
      if (!s) return;
      el("login").style.display = "none";
      el("dash").style.display = "block";
      render(s);
    })
    .catch(function(){ /* transient — next refresh retries */ });
}
function showLogin(notConfigured){
  el("dash").style.display = "none";
  el("login").style.display = "block";
  if (notConfigured) el("loginErr").textContent = "Admin key isn't configured on the server yet (set ADMIN_KEY).";
}
function doLogin(){
  el("loginErr").textContent = "";
  fetch("/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ key: el("key").value })
  }).then(function(r){
    if (r.ok) { el("key").value = ""; load(); }
    else r.json().then(function(j){ el("loginErr").textContent = (j && j.error) || "Login failed"; })
      .catch(function(){ el("loginErr").textContent = "Login failed"; });
  }).catch(function(){ el("loginErr").textContent = "Can't reach the server."; });
}
function logout(){
  fetch("/admin/logout", { method: "POST", credentials: "same-origin" }).then(function(){ showLogin(false); });
}
document.addEventListener("keydown", function(ev){
  if (ev.key === "Enter" && el("login").style.display !== "none") doLogin();
});
// One load on open/login — after that, data only changes when you tap
// Refresh. No background polling, so leaving this tab open never spends
// your Turso read quota.
load();
</script>
</body>
</html>`;

module.exports = router;
