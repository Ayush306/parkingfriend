# ParkingFriend — Launch Checklist

What's done, and exactly what's left before real users. Items marked 🔑 need an
account/payment only you can create — everything else is already in the repo.

## ✅ Done (in this repo)
- [x] Full app UI (~26 screens), Expo SDK 57, dual-role Home/Post, map-first listing
- [x] Real maps (Leaflet + OSM/Mapbox) and real place search (Photon) — free, no keys
- [x] Backend REST API (`server/`): JWT auth, spots, bookings, host requests, wallet
- [x] Database with seed data (SQLite; Postgres-ready repository layer)
- [x] One-line switch demo ↔ real backend (`src/config/apiConfig.ts`)
- [x] App icon set + splash, crash boundary, UI layout standard (`UI-GUIDE.md`)
- [x] Store-ready build profiles (`eas.json`: preview APK / production AAB)

## 🔜 Before a public pilot (ordered)

1. 🔑 **Host the API** — Render/Railway free tier (see DEPLOYMENT.md). ~15 min.
2. 🔑 **Play Console account** — $25 one-time → internal testing track first.
3. **Privacy policy URL** — required (location + phone number). A one-page
   policy hosted anywhere (even a GitHub Pages page on parkingfriend.com) works.
4. 🔑 **Real SMS OTP** — right now OTP is the dev code 123456. Plug an SMS
   provider into `server/src/routes/auth.js` (the TODO hook is marked):
   MSG91 / Twilio / Fast2SMS. Costs ~₹0.15–0.25 per SMS in India. Until then,
   keep the app in internal testing only.
5. **Persistent database** — move SQLite → free Postgres (Neon/Supabase/Render)
   before inviting strangers; free-tier disks are wiped on redeploy.
6. **Seed real supply** — list 5–10 real spaces near your target stations
   (your own network in Gurugram) so first users don't see an empty app.

## 🔭 Soon after (not blocking)
- [ ] Crash reporting (Sentry free tier) — hook exists in `ErrorBoundary.componentDidCatch`
- [ ] Replace remaining demo imagery (picsum/pravatar) with real photos/uploads
      (host photo upload needs storage — Supabase Storage/Cloudinary free tiers)
- [ ] Rate limiting + input validation hardening on the API before scale
- [ ] iOS App Store — 🔑 $99/year when you're ready for iPhone distribution
- [ ] AdMob integration for the reserved ad slot (needs 🔑 AdMob account;
      keep ads off until real traffic exists)
- [ ] Trademark + company registration (already discussed — name is somewhat
      descriptive; talk to a CA/CS when revenue is in sight)

## The honest gate list (nobody can code around these)
| Gate | Cost | Needed for |
|---|---|---|
| Play Console | $25 once | Android store release |
| SMS provider | ~₹0.2/SMS | Real OTP login |
| API hosting | Free tier OK | App works outside your Wi-Fi |
| Apple Developer | $99/year | iPhone store release (optional for launch) |
