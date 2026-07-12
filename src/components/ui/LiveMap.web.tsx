import React from "react";
import type { LiveMapProps } from "@/components/ui/LiveMap.shared";
import { LiveMapChrome } from "@/components/ui/LiveMapChrome";

/**
 * Web implementation — renders the same Leaflet map inside an <iframe>
 * (react-native-webview isn't reliable on web).
 * All behavior (inline preview, full-screen expand, GPS locate, directions)
 * lives in the shared LiveMapChrome.
 */
export const LiveMap: React.FC<LiveMapProps> = (props) => (
  <LiveMapChrome
    {...props}
    renderHtml={(html, key) => (
      <iframe
        key={key}
        srcDoc={html}
        title="Map"
        style={{ border: "none", width: "100%", height: "100%" }}
      />
    )}
  />
);
