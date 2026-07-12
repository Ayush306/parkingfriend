import React from "react";
import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import type { LiveMapProps } from "@/components/ui/LiveMap.shared";
import { LiveMapChrome } from "@/components/ui/LiveMapChrome";

/**
 * Native implementation — renders the Leaflet map inside a WebView.
 * (The web build uses LiveMap.web.tsx with an <iframe> instead.)
 * All behavior (inline preview, full-screen expand, GPS locate, directions)
 * lives in the shared LiveMapChrome.
 */
export const LiveMap: React.FC<LiveMapProps> = (props) => (
  <LiveMapChrome
    {...props}
    renderHtml={(html, key) => (
      <WebView
        key={key}
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.web}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        androidLayerType="hardware"
      />
    )}
  />
);

const styles = StyleSheet.create({
  web: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
