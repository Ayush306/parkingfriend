/**
 * Map tile source configuration.
 *
 * - Leave MAPBOX_TOKEN empty ("") to use FREE OpenStreetMap tiles — no account,
 *   no key, works right away.
 * - To use Mapbox tiles: create a free account at
 *   https://account.mapbox.com/access-tokens (free tier ~50,000 map loads/month),
 *   copy your PUBLIC token (it starts with "pk."), and paste it below.
 *
 * The token is a *publishable* client key (safe to ship in the app). For
 * production, restrict it to your app's URL/bundle id in the Mapbox dashboard.
 */
export const MAPBOX_TOKEN: string = "";
