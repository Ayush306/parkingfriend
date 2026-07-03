import type { ViewStyle } from "react-native";
import { MAPBOX_TOKEN } from "@/config/mapConfig";

export interface LiveMarker {
  latitude: number;
  longitude: number;
  title?: string;
  /** Highlighted (e.g. the spot you're viewing) vs. a secondary marker. */
  primary?: boolean;
}

export interface LiveMapProps {
  markers: LiveMarker[];
  height?: number;
  /** Zoom used when there is a single marker. Ignored when fitting bounds. */
  zoom?: number;
  style?: ViewStyle | ViewStyle[];
}

export interface BuildMapOptions {
  zoom?: number;
  primaryColor: string;
  secondaryColor: string;
  bg: string;
  dark?: boolean;
}

/**
 * Builds a self-contained Leaflet HTML document that renders real map tiles
 * (Mapbox when a token is set, free OpenStreetMap otherwise) with markers at
 * real lat/lng coordinates. The same HTML is used inside a WebView (native)
 * and an <iframe> (web).
 */
export function buildMapHtml(
  markers: LiveMarker[],
  opts: BuildMapOptions
): string {
  const useMapbox = !!MAPBOX_TOKEN && MAPBOX_TOKEN.startsWith("pk.");
  const style = opts.dark ? "dark-v11" : "streets-v12";
  const tileUrl = useMapbox
    ? `https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const tileSize = useMapbox ? 512 : 256;
  const zoomOffset = useMapbox ? -1 : 0;
  const attribution = useMapbox
    ? "© Mapbox © OpenStreetMap"
    : "© OpenStreetMap contributors";
  const zoom = opts.zoom ?? 15;
  const markersJson = JSON.stringify(markers ?? []);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: ${opts.bg}; }
  .pm-pin { width: 20px; height: 20px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 1px 5px rgba(0,0,0,0.45); }
  .leaflet-control-attribution { font-size: 9px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var MARKERS = ${markersJson};
  var PRIMARY = ${JSON.stringify(opts.primaryColor)};
  var SECONDARY = ${JSON.stringify(opts.secondaryColor)};
  try {
    var map = L.map('map', { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    L.tileLayer(${JSON.stringify(tileUrl)}, { tileSize: ${tileSize}, zoomOffset: ${zoomOffset}, maxZoom: 19, attribution: ${JSON.stringify(attribution)} }).addTo(map);
    var pts = [];
    MARKERS.forEach(function (m) {
      var color = m.primary ? PRIMARY : SECONDARY;
      var icon = L.divIcon({ className: '', html: '<div class="pm-pin" style="background:' + color + '"></div>', iconSize: [20, 20], iconAnchor: [10, 10] });
      var mk = L.marker([m.latitude, m.longitude], { icon: icon }).addTo(map);
      if (m.title) { mk.bindPopup(m.title); }
      pts.push([m.latitude, m.longitude]);
    });
    if (pts.length === 1) { map.setView(pts[0], ${zoom}); }
    else if (pts.length > 1) { map.fitBounds(pts, { padding: [40, 40] }); }
    else { map.setView([28.4595, 77.0266], 12); }
  } catch (e) {
    document.body.innerHTML = '<div style="display:flex;height:100%;align-items:center;justify-content:center;font-family:sans-serif;color:#94A3B8;font-size:13px;">Map unavailable — check your connection</div>';
  }
</script>
</body>
</html>`;
}
