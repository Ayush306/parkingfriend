import type { ViewStyle } from "react-native";
import { MAPBOX_TOKEN } from "@/config/mapConfig";
import { OLA_MAPS_API_KEY, isOlaMapsEnabled } from "@/config/olaMapsConfig";

/**
 * A proper parking map-marker — a teardrop pin whose tip sits on the exact
 * coordinate, with a white disc and a bold "P" (the universal parking mark),
 * instead of a plain coloured dot. Injected into every map document as the
 * `pmPin(color, big)` JS helper; `big` = the primary/selected spot. Callers set
 * the returned SVG as a marker element's innerHTML or a Leaflet divIcon html.
 */
const PIN_JS = `
function pmPin(color, big) {
  var w = big ? 42 : 31, h = big ? 55 : 41;
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M15 39C15 39 27 24.5 27 14A12 12 0 1 0 3 14C3 24.5 15 39 15 39Z" fill="' + color + '" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>'
    + '<circle cx="15" cy="14" r="7.4" fill="#ffffff"/>'
    + '<text x="15" y="18.4" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" fill="' + color + '">P</text>'
    + '</svg>';
}
`;

/**
 * Raster tile layer for the Leaflet-based maps (the pin-picker, and the
 * fallback path when Ola vector tiles are unavailable):
 *   1. Mapbox (only if a token is configured)  2. CARTO (free, keyless).
 * NOTE: Ola's *raster* tile endpoint is heavily rate-limited on the free
 * tier (429s on a single screen of tiles) — never use it here. The Ola
 * upgrade is the *vector* path in buildOlaVectorHtml below.
 */
function pickTiles(dark: boolean | undefined) {
  const useMapbox = !!MAPBOX_TOKEN && MAPBOX_TOKEN.startsWith("pk.");
  const cartoUrl = dark
    ? "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  if (useMapbox) {
    const style = dark ? "dark-v11" : "streets-v12";
    return {
      url: `https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
      fallbackUrl: cartoUrl,
      tileSize: 512,
      zoomOffset: -1,
      subdomains: "abc",
      attribution: "© Mapbox © OpenStreetMap",
    };
  }
  return {
    url: cartoUrl,
    fallbackUrl: null as string | null,
    tileSize: 256,
    zoomOffset: 0,
    subdomains: "abcd",
    attribution: "© OpenStreetMap © CARTO",
  };
}

export interface LiveMarker {
  latitude: number;
  longitude: number;
  title?: string;
  /** Highlighted (e.g. the spot you're viewing) vs. a secondary marker. */
  primary?: boolean;
}

/** A driving route drawn on the map via the free OSRM public server. */
export interface LiveMapRoute {
  from: { latitude: number; longitude: number };
  to: { latitude: number; longitude: number };
}

export interface LiveMapProps {
  markers: LiveMarker[];
  height?: number;
  /** Zoom used when there is a single marker. Ignored when fitting bounds. */
  zoom?: number;
  style?: ViewStyle | ViewStyle[];
  /**
   * Optional driving route. When set, the map fetches the route from the
   * free OSRM public server, draws it, fits bounds to it, and shows a small
   * distance/duration badge. Falls back to the normal marker view on failure.
   */
  route?: LiveMapRoute;
  /**
   * Whether tapping the inline map opens the full-screen interactive map
   * (with pinch-zoom, drag, GPS locate and directions). Default true.
   */
  expandable?: boolean;
}

export interface BuildMapOptions {
  zoom?: number;
  primaryColor: string;
  secondaryColor: string;
  bg: string;
  dark?: boolean;
  /** Optional driving route to draw (see LiveMapProps.route). */
  route?: LiveMapRoute;
  /**
   * true  → full gestures: drag, pinch-zoom, double-tap, zoom buttons.
   * false → calm inline preview: no gestures, so page scrolling stays smooth.
   */
  interactive?: boolean;
  /** The user's GPS position — drawn as a pulsing blue dot and kept in view. */
  userLocation?: { latitude: number; longitude: number } | null;
  /**
   * Skip the MapLibre/Ola vector path and render with Leaflet raster tiles.
   * Used on web, where embedded dev-preview browsers can't run MapLibre's
   * workers; the raster map then uses detail-rich OSM standard tiles.
   */
  forceLeaflet?: boolean;
}

/**
 * Builds a self-contained Leaflet HTML document that renders real map tiles
 * (Mapbox when a token is set, free CARTO basemaps otherwise) with markers at
 * real lat/lng coordinates, plus an optional OSRM driving route. The same
 * HTML is used inside a WebView (native) and an <iframe> (web).
 */
/**
 * MapLibre GL + Ola Maps vector tiles — India-native detail (local roads,
 * villages, shops) using the same free key as the place search. If MapLibre
 * or the Ola style fails to load, the page rebuilds itself with the plain
 * Leaflet + CARTO map so users never see a blank screen.
 */
function buildOlaVectorHtml(
  markers: LiveMarker[],
  opts: BuildMapOptions
): string {
  const zoom = opts.zoom ?? 15;
  const interactive = opts.interactive !== false;
  const styleId = opts.dark ? "default-dark-standard" : "default-light-standard";
  const styleUrl = `https://api.olamaps.io/tiles/vector/v1/styles/${styleId}/style.json?api_key=${OLA_MAPS_API_KEY}`;
  const carto = pickTiles(opts.dark);
  const markersJson = JSON.stringify(markers ?? []);
  const routeJson = JSON.stringify(opts.route ?? null);
  const userJson = JSON.stringify(opts.userLocation ?? null);
  const badgeBg = opts.dark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.95)";
  const badgeFg = opts.dark ? "#E2E8F0" : "#0F172A";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: ${opts.bg}; }
  .pm-pin-wrap { line-height: 0; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); }
  .pm-pin-wrap svg { display: block; }
  .pm-you { width: 16px; height: 16px; border-radius: 50%; background: #2E7CF6; border: 3px solid #fff; box-shadow: 0 0 0 6px rgba(46,124,246,0.25), 0 1px 5px rgba(0,0,0,0.4); }
  .pm-route-badge { position: absolute; top: 10px; left: 10px; z-index: 30; padding: 6px 12px; border-radius: 999px; background: ${badgeBg}; color: ${badgeFg}; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 600; box-shadow: 0 1px 6px rgba(0,0,0,0.25); white-space: nowrap; pointer-events: none; }
  .maplibregl-ctrl-attrib { font-size: 9px; }
</style>
</head>
<body>
<div id="map"></div>
<script>${PIN_JS}</script>
<script>
  var MARKERS = ${markersJson};
  var ROUTE = ${routeJson};
  var USER = ${userJson};
  var INTERACTIVE = ${JSON.stringify(interactive)};
  var PRIMARY = ${JSON.stringify(opts.primaryColor)};
  var SECONDARY = ${JSON.stringify(opts.secondaryColor)};
  var OLA_KEY = ${JSON.stringify(OLA_MAPS_API_KEY)};
  var ZOOM = ${zoom};
  var fellBack = false;

  // ── Plan B: plain Leaflet + CARTO if MapLibre/Ola can't load ──
  function leafletFallback(reason) {
    if (fellBack) return;
    fellBack = true;
    dbg('fallback', reason || 'unknown');
    try {
      var mapEl = document.getElementById('map');
      mapEl.innerHTML = '';
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
      var js = document.createElement('script');
      js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      js.onload = function () {
        var map = L.map('map', { zoomControl: INTERACTIVE, attributionControl: true, scrollWheelZoom: INTERACTIVE, dragging: INTERACTIVE, touchZoom: INTERACTIVE, doubleClickZoom: INTERACTIVE, boxZoom: INTERACTIVE, keyboard: INTERACTIVE });
        L.tileLayer(${JSON.stringify(carto.url)}, { tileSize: 256, zoomOffset: 0, subdomains: 'abcd', maxZoom: 19, attribution: ${JSON.stringify(carto.attribution)} }).addTo(map);
        var pts = [];
        MARKERS.forEach(function (m) {
          var big = !!m.primary;
          var w = big ? 42 : 31, h = big ? 55 : 41;
          var icon = L.divIcon({ className: 'pm-pin-wrap', html: pmPin(big ? PRIMARY : SECONDARY, big), iconSize: [w, h], iconAnchor: [w / 2, h], popupAnchor: [0, -h + 8] });
          var mk = L.marker([m.latitude, m.longitude], { icon: icon }).addTo(map);
          if (m.title) { mk.bindPopup(m.title); }
          pts.push([m.latitude, m.longitude]);
        });
        if (USER && isFinite(USER.latitude)) {
          var youIcon = L.divIcon({ className: '', html: '<div class="pm-you"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
          L.marker([USER.latitude, USER.longitude], { icon: youIcon }).addTo(map);
          pts.push([USER.latitude, USER.longitude]);
        }
        // No markers at all — zoom out to a neutral world view rather than
        // guessing any specific city (this app has users everywhere).
        if (pts.length === 1) { map.setView(pts[0], ZOOM); }
        else if (pts.length > 1) { map.fitBounds(pts, { padding: [40, 40] }); }
        else { map.setView([20, 0], 2); }
      };
      document.head.appendChild(js);
    } catch (e) {}
  }

  window.__dbg = { events: [] };
  function dbg(tag, detail) {
    try { window.__dbg.events.push(tag + (detail ? ':' + detail : '') + '@' + Math.round(performance.now())); } catch (e) {}
  }
  function boot() {
    dbg('boot');
    // MapLibre's default worker loads its code from the CDN *inside* the
    // worker (importScripts), which silently hangs in sandboxed WebView /
    // srcdoc iframes. Fetch the self-contained CSP worker build ourselves
    // and hand MapLibre a same-origin blob URL instead.
    fetch('https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl-csp-worker.js')
      .then(function (res) {
        if (!res.ok) { throw new Error('worker HTTP ' + res.status); }
        return res.blob();
      })
      .then(function (blob) {
        maplibregl.setWorkerUrl(URL.createObjectURL(blob));
        dbg('workerblob');
        bootStyle();
      })
      .catch(function (e) { leafletFallback('workerfetch:' + String(e).slice(0, 40)); });
  }

  function bootStyle() {
    // Fetch the Ola style ourselves so we can strip broken layers (their
    // styles reference a "3d_model" source-layer that doesn't exist in the
    // tileset, which would keep MapLibre in a permanent "loading" state).
    fetch(${JSON.stringify(styleUrl)})
      .then(function (res) {
        dbg('stylefetch', String(res.status));
        if (!res.ok) { throw new Error('style HTTP ' + res.status); }
        return res.json();
      })
      .then(function (style) {
        style.layers = (style.layers || []).filter(function (l) {
          return l['source-layer'] !== '3d_model';
        });
        dbg('styleready', String((style.layers || []).length));
        startMap(style);
      })
      .catch(function (e) { leafletFallback('stylefetch:' + String(e).slice(0, 50)); });
  }

  var attempt = 0;
  function startMap(styleObj) {
    attempt += 1;
    dbg('attempt', String(attempt));
    try {
      var old = document.querySelector('.pm-route-badge');
      if (old) { old.remove(); }
      var map = new maplibregl.Map({
        container: 'map',
        style: styleObj,
        // Neutral placeholder — fitAll() (called right after) always
        // re-centers on the real markers/user location before this is seen.
        center: [0, 20],
        zoom: 2,
        interactive: INTERACTIVE,
        attributionControl: { compact: true },
        transformRequest: function (url) {
          if (url.indexOf('api.olamaps.io') !== -1 && url.indexOf('api_key=') === -1) {
            return { url: url + (url.indexOf('?') === -1 ? '?' : '&') + 'api_key=' + OLA_KEY };
          }
          // Untouched URLs must return undefined — a wrapper object here
          // trips MapLibre's worker serialization and stalls tile loading.
          return undefined;
        },
      });
      window.__map = map;
      var mapReady = false;
      map.on('load', function () { mapReady = true; dbg('load'); });
      map.on('idle', function () { mapReady = true; });
      map.on('styledata', function () { dbg('styledata', String(map.isStyleLoaded())); });
      map.on('error', function (e) { dbg('error', (e && e.error && (e.error.status || e.error.message || '')).toString().slice(0, 80)); });
      if (INTERACTIVE) {
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
      }

      var pts = [];
      MARKERS.forEach(function (m) {
        var el = document.createElement('div');
        el.className = 'pm-pin-wrap';
        el.innerHTML = pmPin(m.primary ? PRIMARY : SECONDARY, !!m.primary);
        var mk = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([m.longitude, m.latitude]).addTo(map);
        if (m.title) { mk.setPopup(new maplibregl.Popup({ offset: 14, closeButton: false }).setText(m.title)); }
        pts.push([m.longitude, m.latitude]);
      });
      if (USER && isFinite(USER.latitude) && isFinite(USER.longitude)) {
        var you = document.createElement('div');
        you.className = 'pm-you';
        new maplibregl.Marker({ element: you }).setLngLat([USER.longitude, USER.latitude]).addTo(map);
        pts.push([USER.longitude, USER.latitude]);
      }
      function fitAll(extra) {
        var all = pts.concat(extra || []);
        if (all.length === 1) { map.jumpTo({ center: all[0], zoom: ZOOM }); }
        else if (all.length > 1) {
          var b = new maplibregl.LngLatBounds(all[0], all[0]);
          all.forEach(function (p) { b.extend(p); });
          map.fitBounds(b, { padding: 48, maxZoom: 16, duration: 0 });
        } else {
          // No markers at all — a neutral world view, never a guessed city.
          map.jumpTo({ center: [0, 20], zoom: 2 });
        }
      }
      fitAll();

      if (ROUTE && ROUTE.from && ROUTE.to && window.fetch) {
        var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' +
          ROUTE.from.longitude + ',' + ROUTE.from.latitude + ';' +
          ROUTE.to.longitude + ',' + ROUTE.to.latitude + '?overview=full&geometries=geojson';
        fetch(osrmUrl).then(function (res) { return res.json(); }).then(function (data) {
          if (!data || data.code !== 'Ok' || !data.routes || !data.routes.length) { return; }
          var r = data.routes[0];
          var draw = function () {
            if (map.getSource('pm-route')) return;
            map.addSource('pm-route', { type: 'geojson', data: { type: 'Feature', geometry: r.geometry } });
            map.addLayer({ id: 'pm-route', type: 'line', source: 'pm-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': PRIMARY, 'line-width': 5, 'line-opacity': 0.85 } });
            fitAll(r.geometry.coordinates);
            var badge = document.createElement('div');
            badge.className = 'pm-route-badge';
            badge.textContent = (r.distance / 1000).toFixed(1) + ' km \\u00B7 ' + Math.max(1, Math.round(r.duration / 60)) + ' min';
            document.body.appendChild(badge);
          };
          if (map.isStyleLoaded()) { draw(); } else { map.once('load', draw); }
        }).catch(function () {});
      }

      // Some embedded browsers can't run MapLibre's tile workers (observed
      // in desktop dev-preview iframes; phone WebViews are fine). If the map
      // isn't ready quickly, swap to the plain Leaflet map without fuss.
      setTimeout(function () {
        if (!fellBack && !mapReady) { try { map.remove(); } catch (e) {} leafletFallback('timeout'); }
      }, 7000);
    } catch (e) {
      leafletFallback('construct:' + String(e).slice(0, 50));
    }
  }

  // Boot only once the document has fully loaded: creating the map (and its
  // web workers) mid-parse inside a srcdoc iframe/WebView stalls silently.
  function bootWhenReady() {
    if (document.readyState === 'complete') { setTimeout(boot, 300); }
    else { window.addEventListener('load', function () { setTimeout(boot, 300); }); }
  }
  var lib = document.createElement('script');
  lib.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
  lib.onload = bootWhenReady;
  lib.onerror = function () { leafletFallback('libload'); };
  document.head.appendChild(lib);
</script>
</body>
</html>`;
}

export function buildMapHtml(
  markers: LiveMarker[],
  opts: BuildMapOptions
): string {
  const useMapbox = !!MAPBOX_TOKEN && MAPBOX_TOKEN.startsWith("pk.");
  // Ola vector tiles (India-native detail) whenever the key exists and no
  // explicit Mapbox override is configured.
  if (!useMapbox && isOlaMapsEnabled() && !opts.forceLeaflet) {
    return buildOlaVectorHtml(markers, opts);
  }
  let tiles = pickTiles(opts.dark);
  if (opts.forceLeaflet && !useMapbox && !opts.dark) {
    // Raster path chosen on purpose (web): OSM standard shows far more
    // local detail (lanes, buildings, shops) than CARTO's minimal style.
    tiles = {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      fallbackUrl: tiles.url,
      tileSize: 256,
      zoomOffset: 0,
      subdomains: "abc",
      attribution: "© OpenStreetMap contributors",
    };
  }
  const tileUrl = tiles.url;
  const tileSize = tiles.tileSize;
  const zoomOffset = tiles.zoomOffset;
  const subdomains = tiles.subdomains;
  const attribution = tiles.attribution;
  const zoom = opts.zoom ?? 15;
  const interactive = opts.interactive !== false;
  const markersJson = JSON.stringify(markers ?? []);
  const routeJson = JSON.stringify(opts.route ?? null);
  const userJson = JSON.stringify(opts.userLocation ?? null);
  const badgeBg = opts.dark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.95)";
  const badgeFg = opts.dark ? "#E2E8F0" : "#0F172A";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: ${opts.bg}; }
  .pm-pin-wrap { line-height: 0; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); }
  .pm-pin-wrap svg { display: block; }
  .pm-you { width: 16px; height: 16px; border-radius: 50%; background: #2E7CF6; border: 3px solid #fff; box-shadow: 0 0 0 6px rgba(46,124,246,0.25), 0 1px 5px rgba(0,0,0,0.4); }
  .pm-route-badge { padding: 6px 12px; border-radius: 999px; background: ${badgeBg}; color: ${badgeFg}; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 600; box-shadow: 0 1px 6px rgba(0,0,0,0.25); white-space: nowrap; pointer-events: none; }
  .leaflet-control-attribution { font-size: 9px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>${PIN_JS}</script>
<script>
  var MARKERS = ${markersJson};
  var ROUTE = ${routeJson};
  var USER = ${userJson};
  var INTERACTIVE = ${JSON.stringify(interactive)};
  var PRIMARY = ${JSON.stringify(opts.primaryColor)};
  var SECONDARY = ${JSON.stringify(opts.secondaryColor)};
  try {
    // Inline previews turn ALL gestures off so the page scrolls smoothly
    // under a finger; the full-screen map turns everything on.
    var map = L.map('map', {
      zoomControl: INTERACTIVE,
      attributionControl: true,
      scrollWheelZoom: INTERACTIVE,
      dragging: INTERACTIVE,
      touchZoom: INTERACTIVE,
      doubleClickZoom: INTERACTIVE,
      boxZoom: INTERACTIVE,
      keyboard: INTERACTIVE,
    });
    var tileLayer = L.tileLayer(${JSON.stringify(tileUrl)}, { tileSize: ${tileSize}, zoomOffset: ${zoomOffset}, subdomains: ${JSON.stringify(subdomains)}, maxZoom: 19, attribution: ${JSON.stringify(attribution)} }).addTo(map);
    // If the primary tile source misbehaves, quietly swap to the keyless
    // CARTO basemap so the map never goes blank.
    var FALLBACK_TILES = ${JSON.stringify(tiles.fallbackUrl)};
    if (FALLBACK_TILES) {
      var tileErrors = 0;
      tileLayer.on('tileerror', function () {
        tileErrors += 1;
        if (tileErrors === 6) {
          try {
            map.removeLayer(tileLayer);
            L.tileLayer(FALLBACK_TILES, { tileSize: 256, zoomOffset: 0, subdomains: 'abcd', maxZoom: 19, attribution: '© OpenStreetMap © CARTO' }).addTo(map);
          } catch (e) {}
        }
      });
    }
    var pts = [];
    MARKERS.forEach(function (m) {
      var big = !!m.primary;
      var w = big ? 42 : 31, h = big ? 55 : 41;
      var icon = L.divIcon({ className: 'pm-pin-wrap', html: pmPin(big ? PRIMARY : SECONDARY, big), iconSize: [w, h], iconAnchor: [w / 2, h], popupAnchor: [0, -h + 8] });
      var mk = L.marker([m.latitude, m.longitude], { icon: icon }).addTo(map);
      if (m.title) { mk.bindPopup(m.title); }
      pts.push([m.latitude, m.longitude]);
    });
    if (USER && isFinite(USER.latitude) && isFinite(USER.longitude)) {
      var youIcon = L.divIcon({ className: '', html: '<div class="pm-you"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
      L.marker([USER.latitude, USER.longitude], { icon: youIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup('You are here');
      pts.push([USER.latitude, USER.longitude]);
    }
    function fitToMarkers() {
      // No markers at all — a neutral world view, never a guessed city.
      if (pts.length === 1) { map.setView(pts[0], ${zoom}); }
      else if (pts.length > 1) { map.fitBounds(pts, { padding: [40, 40] }); }
      else { map.setView([20, 0], 2); }
    }
    fitToMarkers();
    if (ROUTE && ROUTE.from && ROUTE.to && window.fetch) {
      var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' +
        ROUTE.from.longitude + ',' + ROUTE.from.latitude + ';' +
        ROUTE.to.longitude + ',' + ROUTE.to.latitude +
        '?overview=full&geometries=geojson';
      fetch(osrmUrl)
        .then(function (res) {
          if (!res.ok) { throw new Error('HTTP ' + res.status); }
          return res.json();
        })
        .then(function (data) {
          if (!data || data.code !== 'Ok' || !data.routes || !data.routes.length) { throw new Error('No route'); }
          var r = data.routes[0];
          var line = L.geoJSON(r.geometry, { style: { color: PRIMARY, weight: 5, opacity: 0.8 } }).addTo(map);
          map.fitBounds(line.getBounds(), { padding: [40, 40] });
          var km = (r.distance / 1000).toFixed(1) + ' km';
          var mins = Math.max(1, Math.round(r.duration / 60)) + ' min';
          var Badge = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: function () {
              var el = L.DomUtil.create('div', 'pm-route-badge');
              el.textContent = km + ' \\u00B7 ' + mins;
              return el;
            }
          });
          map.addControl(new Badge());
        })
        .catch(function () { fitToMarkers(); });
    }
  } catch (e) {
    document.body.innerHTML = '<div style="display:flex;height:100%;align-items:center;justify-content:center;font-family:sans-serif;color:#94A3B8;font-size:13px;">Map unavailable — check your connection</div>';
  }
</script>
</body>
</html>`;
}

/** A tappable landmark shown on the picker map. */
export interface PickerLandmark {
  latitude: number;
  longitude: number;
  label?: string;
}

export interface BuildPickerOptions extends BuildMapOptions {
  /** Where the map is centred. */
  center: { latitude: number; longitude: number };
  /** Landmarks to show as tappable secondary pins. */
  landmarks?: PickerLandmark[];
}

/**
 * Builds an INTERACTIVE Leaflet map for picking a location. A draggable
 * primary pin marks the chosen point; tapping the map, dragging the pin, or
 * tapping a landmark moves it and posts the new coordinates back to React
 * (via `window.ReactNativeWebView.postMessage` in a WebView, or
 * `parent.postMessage` in an <iframe>) as JSON `{type:'pick',latitude,longitude,label?}`.
 */
export function buildPickerHtml(opts: BuildPickerOptions): string {
  const tiles = pickTiles(opts.dark);
  const tileUrl = tiles.url;
  const tileSize = tiles.tileSize;
  const zoomOffset = tiles.zoomOffset;
  const subdomains = tiles.subdomains;
  const attribution = tiles.attribution;
  const zoom = opts.zoom ?? 16;
  const centerJson = JSON.stringify([opts.center.latitude, opts.center.longitude]);
  const landmarksJson = JSON.stringify(opts.landmarks ?? []);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: ${opts.bg}; }
  .pm-pin-wrap { line-height: 0; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.35)); }
  .pm-pin-wrap svg { display: block; }
  .pm-lm { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.4); }
  .leaflet-control-attribution { font-size: 9px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>${PIN_JS}</script>
<script>
  var CENTER = ${centerJson};
  var LANDMARKS = ${landmarksJson};
  var PRIMARY = ${JSON.stringify(opts.primaryColor)};
  var SECONDARY = ${JSON.stringify(opts.secondaryColor)};
  function send(obj) {
    var s = JSON.stringify(obj);
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(s);
      } else if (window.parent) {
        window.parent.postMessage(s, '*');
      }
    } catch (e) {}
  }
  try {
    var map = L.map('map', { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    var tileLayer = L.tileLayer(${JSON.stringify(tileUrl)}, { tileSize: ${tileSize}, zoomOffset: ${zoomOffset}, subdomains: ${JSON.stringify(subdomains)}, maxZoom: 19, attribution: ${JSON.stringify(attribution)} }).addTo(map);
    var FALLBACK_TILES = ${JSON.stringify(tiles.fallbackUrl)};
    if (FALLBACK_TILES) {
      var tileErrors = 0;
      tileLayer.on('tileerror', function () {
        tileErrors += 1;
        if (tileErrors === 6) {
          try {
            map.removeLayer(tileLayer);
            L.tileLayer(FALLBACK_TILES, { tileSize: 256, zoomOffset: 0, subdomains: 'abcd', maxZoom: 19, attribution: '© OpenStreetMap © CARTO' }).addTo(map);
          } catch (e) {}
        }
      });
    }
    map.setView(CENTER, ${zoom});

    var pinIcon = L.divIcon({ className: 'pm-pin-wrap', html: pmPin(PRIMARY, true), iconSize: [42, 55], iconAnchor: [21, 55] });
    var pin = L.marker(CENTER, { icon: pinIcon, draggable: true }).addTo(map);

    function pick(lat, lng, label) {
      pin.setLatLng([lat, lng]);
      send({ type: 'pick', latitude: lat, longitude: lng, label: label || null });
    }

    map.on('click', function (e) { pick(e.latlng.lat, e.latlng.lng); });
    pin.on('dragend', function () {
      var ll = pin.getLatLng();
      send({ type: 'pick', latitude: ll.lat, longitude: ll.lng, label: null });
    });

    LANDMARKS.forEach(function (m) {
      var icon = L.divIcon({ className: '', html: '<div class="pm-lm" style="background:' + SECONDARY + '"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
      var mk = L.marker([m.latitude, m.longitude], { icon: icon }).addTo(map);
      if (m.label) { mk.bindTooltip(m.label, { direction: 'top', offset: [0, -6] }); }
      mk.on('click', function () { pick(m.latitude, m.longitude, m.label); });
    });
  } catch (e) {
    document.body.innerHTML = '<div style="display:flex;height:100%;align-items:center;justify-content:center;font-family:sans-serif;color:#94A3B8;font-size:13px;">Map unavailable — check your connection</div>';
  }
</script>
</body>
</html>`;
}
