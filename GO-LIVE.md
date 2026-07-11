# ParkingFriend — Go Live (100% free)

Three free accounts (no credit card for any) make the app public forever:
**GitHub** (code hosting) → **Turso** (database) → **Render** (API server).
Everything in the repo is already prepared — you only click through these steps.

## Step 1 — GitHub (~5 min)
1. Sign in (or sign up) at https://github.com — free.
2. Create a new **private or public repo** named `parkingfriend` (no README).
3. In a terminal in the `Parkmitter` folder (the local folder name is
   unchanged — only the app's brand and the GitHub repo are ParkingFriend):
   ```powershell
   gh auth login          # sign in via browser (or use git with a PAT)
   git remote add origin https://github.com/<YOUR_USERNAME>/parkingfriend.git
   git push -u origin master
   ```
   (The repo is already committed locally with a safe .gitignore — no SDKs,
   secrets, or databases get pushed.)

## Step 2 — Turso: the free database (~5 min)
1. Sign up at https://turso.tech (login with GitHub) — free tier is permanent.
2. In their dashboard (or CLI) create a database named `parkingfriend`.
3. Copy two values:
   - the **Database URL** — looks like `libsql://parkingfriend-<you>.turso.io`
   - a **Token** (Database → Generate token)

## Step 3 — Render: the free API server (~5 min)
1. Sign up at https://render.com (login with GitHub) — free tier.
2. **New + → Blueprint** → select your `parkingfriend` repo → Render reads
   `render.yaml` automatically.
3. When it asks for env values, paste:
   - `TURSO_DATABASE_URL` = the libsql:// URL from Step 2
   - `TURSO_AUTH_TOKEN` = the token from Step 2
   (JWT_SECRET is auto-generated.)
4. Deploy. You get a public URL like `https://parkingfriend-api.onrender.com`.
5. One-time: open `https://<your-url>/health` — expect `{"ok":true,...}`.

## Step 4 — Point the app at it + ship the APK (~2 min + build time)
1. In `src/config/apiConfig.ts` set:
   ```ts
   export const API_URL: string = "https://<your-render-url>";
   ```
2. Build the public APK: run `build-apk.bat` (EAS cloud build, free tier).
3. Share the APK link with anyone. They install, log in with their phone
   number (OTP is the dev code **123456** until an SMS provider is added —
   see LAUNCH-CHECKLIST.md), list parking, request, call. Fully live.

## Free-tier facts (the honest part)
- **Render free**: the API sleeps after ~15 min idle; the first request after
  that takes ~30–60 s to wake. Fine for a pilot.
- **Turso free**: generous permanent tier; your data (users, listings,
  requests) survives Render's sleeps and redeploys — that's why we use it.
- **OTP**: still the dev code until you add an SMS provider (₹~0.2/SMS).
  Anyone can log in with any number — treat this as a pilot, not production
  auth.
