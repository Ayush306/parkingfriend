import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

/**
 * Phone-panel notifications (the Android/iOS notification shade).
 *
 * These are LOCAL notifications fired by the app itself the moment its
 * background polling spots something new (a request for the host, an
 * accept/decline for the driver). No Firebase/FCM setup is needed, and they
 * work while the app is open or parked in the recents tray.
 *
 * TRUE server push (delivered even when the app is fully killed) needs FCM
 * credentials on EAS + a server sender — the documented next step, and this
 * module is where its token registration would live.
 */

/** Data attached to a notification so a tap can deep-open the right screen. */
export interface PushData {
  type: "host_request" | "booking_update" | "rate" | "chat";
  bookingId?: string;
  spotTitle?: string;
  /** Which HostRequests filter a host_request tap should land on. */
  filter?: "Pending" | "Accepted" | "All";
  [key: string]: unknown;
}

const isSupported = Platform.OS !== "web";

let ready: Promise<boolean> | null = null;

/** One-time setup: foreground presentation + Android channel + permission. */
function setup(): Promise<boolean> {
  if (!isSupported) return Promise.resolve(false);
  if (!ready) {
    ready = (async () => {
      try {
        // Show alerts even while the app is foregrounded.
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Booking updates",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#0FB57E",
          });
        }
        const current = await Notifications.getPermissionsAsync();
        if (current.granted) return true;
        if (!current.canAskAgain) return false;
        const asked = await Notifications.requestPermissionsAsync();
        return asked.granted;
      } catch {
        return false;
      }
    })();
  }
  return ready;
}

/** Fires a notification into the phone's notification panel right now. */
async function notify(title: string, body: string, data: PushData): Promise<void> {
  if (!isSupported) return;
  try {
    const ok = await setup();
    if (!ok) return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: "default" },
      trigger: null, // immediate
    });
  } catch {
    // Notifications are best-effort — never let them break the app.
  }
}

/**
 * Registers a tap handler. Fires for taps while running AND for the cold-start
 * tap that launched the app. Returns an unsubscribe.
 */
function addResponseListener(onData: (data: PushData) => void): () => void {
  if (!isSupported) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response?.notification?.request?.content?.data as PushData | undefined;
    if (data && data.type) onData(data);
  });
  // App launched by tapping a notification while killed.
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      const data = response?.notification?.request?.content?.data as PushData | undefined;
      if (data && data.type) onData(data);
    })
    .catch(() => {});
  return () => sub.remove();
}

export const pushService = { setup, notify, addResponseListener };
