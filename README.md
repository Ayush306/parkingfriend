# Parkmitter 🅿️🤝

**Your parking friend.**

Parkmitter is a two-sided park-and-ride marketplace for India (Gurugram). Drivers
find and book home / near-station parking for the day, while hosts list their empty
parking space and earn from it. Warm, trustworthy, premium mobility feel.

This is a front-end prototype built with **Expo (managed workflow)**, **TypeScript**
and **React Native**. It runs entirely on **mock data** — there is no backend, no real
APIs and no auth server. Network latency and loading / success / error states are
simulated locally, with mutations persisted to `AsyncStorage`.

## Tech stack

- Expo SDK 51 (managed) + TypeScript
- React Navigation (native-stack + bottom-tabs)
- Reanimated + Gesture Handler + Moti (animations & gestures)
- `@gorhom/bottom-sheet`, `expo-linear-gradient`, `react-native-svg`
- Poppins + Inter via `@expo-google-fonts`
- `@expo/vector-icons` (Ionicons + Feather)
- `AsyncStorage` for local persistence

## Getting started

```bash
cd Parkmitter
npm install
npx expo install --fix
npx expo start --offline
```

Then, in the Expo CLI:

- press **a** to open on an Android emulator / device
- press **i** to open on an iOS simulator
- press **w** to open in a web browser (also reachable directly at http://localhost:8081)

Or scan the QR code with the **Expo Go** app on your phone (phone must be on the
same Wi-Fi as this computer).

> **Why `--offline`?** At startup Expo normally pings `api.expo.dev` to validate
> native-module versions. On restricted / corporate networks that request can be
> reset (`ECONNRESET`) and stop the server. `--offline` skips that check; the app
> runs exactly the same.

## Running on web

Web support uses `react-native-web`, `react-dom` and `@expo/metro-runtime`
(already installed). Start with `npx expo start --offline --web`.

A single React version is pinned across the whole dependency tree via the
`overrides` block in `package.json`:

```json
"overrides": { "react": "18.2.0", "react-dom": "18.2.0" }
```

This is required because `moti` → `framer-motion@6` would otherwise pull in a
second copy of React, which crashes the web build (`useContext` of `null`).
Native (Android/iOS) is unaffected either way. If you ever change deps and hit a
blank web screen, delete `node_modules/moti/node_modules`, run `npm install`, and
restart with a cleared cache: `npx expo start --offline --web -c`.

## Project structure

```
src/
  theme/          design tokens + ThemeProvider / useTheme
  constants/      app-wide constants
  utils/          formatting, delay, haptics helpers
  components/ui/  reusable, themed UI components (named exports)
  components/illustrations/  small react-native-svg illustrations
  models/         TypeScript interfaces (types.ts)
  data/           mock JSON data (spots, bookings, wallet, …)
  services/       mock client + per-domain services (async, persisted)
  hooks/          useAsync, useDebounce, useFavorites
  context/        AuthContext (AuthProvider / useAuth)
  navigation/     RootNavigator, MainTabs, route types
  screens/        one folder per screen
```

## Import alias

`@/` resolves to `src/` (configured via `babel-plugin-module-resolver` +
`tsconfig` paths):

```ts
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/theme/ThemeContext";
import { spotService } from "@/services/spotService";
```

## Auth (mock)

OTP verification accepts `123456`, `1234`, or any 6-digit code as valid — no real
SMS is sent. Sessions and onboarding state are stored in `AsyncStorage`.

---

Made with 💚 for parking friends.
