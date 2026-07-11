/**
 * Backend API configuration — the single switch between demo and production.
 *
 * - Leave API_URL empty ("")  → the app runs in DEMO mode on bundled mock
 *   data + AsyncStorage. No server needed. Everything works offline.
 * - Set API_URL to your deployed Parkmitter API → every service (auth,
 *   spots, bookings, host, wallet) talks to the real server instead.
 *
 * Examples:
 *   export const API_URL: string = "http://192.168.1.4:4000"; // local dev (phone must reach your PC)
 *   export const API_URL: string = "https://parkmitter-api.onrender.com"; // production
 *
 * The server code lives in the `server/` folder of this repo — see
 * server/README.md and DEPLOYMENT.md for how to run and deploy it.
 */
export const API_URL: string = "";

/** True when the app should use the real backend instead of mock data. */
export function isApiEnabled(): boolean {
  return API_URL.trim().length > 0;
}
