import type { ViewStyle } from "react-native";
import { MAPBOX_TOKEN } from "@/config/mapConfig";

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
}

export interface BuildMapOptions {
  zoom?: number;
  primaryColor: string;
  secondaryColor: string;
  bg: string;
  dark?: boolean;
  /** Optional driving route to draw (see LiveMapProps.route). */
  route?: LiveMapRoute;
}

/**
 * Builds a self-contained Leaflet HTML document that renders real map tiles
 * (Mapbox when a token is set, free CARTO basemaps otherwise) with markers at
 * real lat/lng coordinates, plus an optional OSRM driving route. The same
 * HTML is used inside a WebView (native) and an <iframe> (web).
 */
export function buildMapHtml(
  markers: LiveMarker[],
  opts: BuildMapOptions
): string {
  const useMapbox = !!MAPBOX_TOKEN && MAPBOX_TOKEN.startsWith("pk.");
  const style = opts.dark ? "dark-v11" : "streets-v12";
  // CARTO raster basemaps: free, no key, crisp retina tiles via Leaflet's
  // native {r} placeholder (resolves to "@2x" on retina displays).
  const tileUrl = useMapbox
    ? `https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
    : opts.dark
      ? "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  const tileSize = useMapbox ? 512 : 256;
  const zoomOffset = useMapbox ? -1 : 0;
  const subdomains = useMapbox ? "abc" : "abcd";
  const attribution = useMapbox
    ? "© Mapbox © OpenStreetMap"
    : "© OpenStreetMap © CARTO";
  const zoom = opts.zoom ?? 15;
  const markersJson = JSON.stringify(markers ?? []);
  const routeJson = JSON.stringify(opts.route ?? null);
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
  .pm-pin { width: 20px; height: 20px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 1px 5px rgba(0,0,0,0.45); }
  .pm-route-badge { padding: 6px 12px; border-radius: 999px; background: ${badgeBg}; color: ${badgeFg}; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 600; box-shadow: 0 1px 6px rgba(0,0,0,0.25); white-space: nowrap; pointer-events: none; }
  .leaflet-control-attribution { font-size: 9px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var MARKERS = ${markersJson};
  var ROUTE = ${routeJson};
  var PRIMARY = ${JSON.stringify(opts.primaryColor)};
  var SECONDARY = ${JSON.stringify(opts.secondaryColor)};
  try {
    var map = L.map('map', { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    L.tileLayer(${JSON.stringify(tileUrl)}, { tileSize: ${tileSize}, zoomOffset: ${zoomOffset}, subdomains: ${JSON.stringify(subdomains)}, maxZoom: 19, attribution: ${JSON.stringify(attribution)} }).addTo(map);
    var pts = [];
    MARKERS.forEach(function (m) {
      var color = m.primary ? PRIMARY : SECONDARY;
      var icon = L.divIcon({ className: '', html: '<div class="pm-pin" style="background:' + color + '"></div>', iconSize: [20, 20], iconAnchor: [10, 10] });
      var mk = L.marker([m.latitude, m.longitude], { icon: icon }).addTo(map);
      if (m.title) { mk.bindPopup(m.title); }
      pts.push([m.latitude, m.longitude]);
    });
    function fitToMarkers() {
      if (pts.length === 1) { map.setView(pts[0], ${zoom}); }
      else if (pts.length > 1) { map.fitBounds(pts, { padding: [40, 40] }); }
      else { map.setView([28.4595, 77.0266], 12); }
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
  const useMapbox = !!MAPBOX_TOKEN && MAPBOX_TOKEN.startsWith("pk.");
  const styleName = opts.dark ? "dark-v11" : "streets-v12";
  // CARTO raster basemaps: free, no key, crisp retina tiles via Leaflet's
  // native {r} placeholder (resolves to "@2x" on retina displays).
  const tileUrl = useMapbox
    ? `https://api.mapbox.com/styles/v1/mapbox/${styleName}/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
    : opts.dark
      ? "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  const tileSize = useMapbox ? 512 : 256;
  const zoomOffset = useMapbox ? -1 : 0;
  const subdomains = useMapbox ? "abc" : "abcd";
  const attribution = useMapbox
    ? "© Mapbox © OpenStreetMap"
    : "© OpenStreetMap © CARTO";
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
  .pm-pin { width: 24px; height: 24px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 1px 6px rgba(0,0,0,0.5); }
  .pm-lm { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.4); }
  .leaflet-control-attribution { font-size: 9px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
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
    L.tileLayer(${JSON.stringify(tileUrl)}, { tileSize: ${tileSize}, zoomOffset: ${zoomOffset}, subdomains: ${JSON.stringify(subdomains)}, maxZoom: 19, attribution: ${JSON.stringify(attribution)} }).addTo(map);
    map.setView(CENTER, ${zoom});

    var pinIcon = L.divIcon({ className: '', html: '<div class="pm-pin" style="background:' + PRIMARY + '"></div>', iconSize: [24, 24], iconAnchor: [12, 12] });
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
