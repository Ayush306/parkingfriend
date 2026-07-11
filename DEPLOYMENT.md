# ParkingFriend — Deployment Guide

How to go from this repo to a live app: backend first, then the app pointing at it.

## Part 1 — Run the API locally (5 minutes)

```powershell
cd Parkmitter\server
npm install
npm run seed          # creates + fills the database
npm start             # API on http://localhost:4000
```

Test it: open http://localhost:4000/health → `{"ok":true}`.

Point the app at it during development:
- Web (`run-on-web.bat`): set `API_URL = "http://localhost:4000"` in `src/config/apiConfig.ts`.
- Phone (Expo Go): the phone can't see "localhost" — use your PC's LAN IP, e.g. `http://192.168.1.4:4000` (PC and phone on the same hotspot/Wi-Fi; allow Node through Windows Firewall when prompted).
- Dev OTP is **123456** (until a real SMS provider is plugged in — see checklist).

Setting `API_URL` back to `""` returns the app to offline demo mode at any time.

## Part 2 — Deploy the API (free tier)

Any Node host works. Two good free options:

### Option A — Render.com (recommended, simplest)
1. Push this repo to GitHub (or just the `server/` folder as its own repo).
2. render.com → New → Web Service → connect the repo.
3. Settings: Root Directory `server` · Build `npm install` · Start `npm start`.
4. Environment: add `JWT_SECRET` = a long random string. (Render sets `PORT` automatically.)
5. Deploy → you get `https://parkingfriend-api-xxxx.onrender.com`.
6. One-time seed: Render Shell → `npm run seed`.

⚠️ Free-tier notes: the service sleeps after ~15 min idle (first request takes ~30s to wake), and the **disk is ephemeral — the SQLite file resets on redeploy**. Fine for a pilot; before real users, move the data to a persistent Postgres (Render's free Postgres, Neon, or Supabase — the repository layer in `server/src/db.js` is the single file to swap; see server/README.md).

### Option B — Railway.app
Same idea: new project from repo, root `server`, add `JWT_SECRET`, deploy. Railway offers a small monthly free credit and supports volumes (persistent SQLite) more easily.

### After deploy
Set the production URL in `src/config/apiConfig.ts`:
```ts
export const API_URL: string = "https://parkingfriend-api-xxxx.onrender.com";
```
Then rebuild the app (below). CORS is already open on the server.

## Part 3 — Build & publish the app

### Android (Play Store)
1. Google Play Console account — one-time **$25** (only you can create this).
2. Build the store bundle (AAB):
   ```powershell
   cd Parkmitter
   eas build -p android --profile production
   ```
   (EAS signs it with the keystore it already manages for you.)
3. Play Console → Create app → upload the AAB to an internal-testing track first.
4. Complete the required forms: app details, content rating questionnaire, **Data safety** (declare: location collected, phone number collected, no data sold), target audience, and a **privacy policy URL** (host a simple page; required because the app requests location).
5. Promote internal → closed → production when ready.

Sideload/testing APK instead: `build-apk.bat` (preview profile) — same app, installable directly.

### iPhone (App Store)
Requires the **$99/year Apple Developer account**. Then:
```powershell
eas build -p ios --profile production
eas submit -p ios
```
No Mac needed. Until then, iPhone users can run it via Expo Go (`run-on-iphone.bat`).

### App updates later
Code-only changes can ship over-the-air with `eas update` (no store review). Native/dependency changes need a new build + store submission.

## Part 4 — What runs where (architecture)

```
Phone app (Expo RN)
  └─ src/config/apiConfig.ts  ← the one switch
       ├─ API_URL = ""        → offline demo: bundled JSON + AsyncStorage
       └─ API_URL = "https…"  → REST API (server/): Express + JWT auth
                                  └─ SQLite (dev/pilot) → Postgres (scale)
External (both modes): OpenStreetMap/Mapbox tiles (maps) + Photon (place search) — free, no keys.
```
