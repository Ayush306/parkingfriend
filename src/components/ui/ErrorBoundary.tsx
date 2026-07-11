import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Top-level crash guard. If any screen throws during render, the user sees a
 * friendly recovery card (with a "Try again" that re-mounts the tree) instead
 * of a blank/white screen. Class component — error boundaries can't be hooks.
 *
 * Deliberately theme-independent: if the ThemeProvider itself is what crashed,
 * this still renders.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Hook point for a crash reporter (Sentry etc.) when one is added.
    console.warn("Unhandled error caught by ErrorBoundary:", error);
  }

  private reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.wrap}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="cloud-offline-outline" size={30} color="#0FB57E" />
          </View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            An unexpected error occurred. Your data is safe — just tap below to
            get back to ParkingFriend.
          </Text>
          <Pressable
            onPress={this.reset}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            style={({ pressed }) => [styles.button, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.buttonLabel}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6F8FA",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(15,181,126,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: "700",
    color: "#101828",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: "#475467",
    textAlign: "center",
  },
  button: {
    marginTop: 20,
    minHeight: 48,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: "#0FB57E",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  buttonLabel: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
