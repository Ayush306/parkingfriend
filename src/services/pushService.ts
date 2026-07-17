import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { http } from "@/services/api/http";
import { isApiEnabled } from "@/config/apiConfig";
import { activeChat } from "@/services/activeChat";

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
        // Show alerts even while the app is foregrounded — EXCEPT for chat
        // messages of the conversation the user is reading right now
        // (messenger-standard behaviour).
        Notifications.setNotificationHandler({
          handleNotification: async (notification) => {
            const data = notification?.request?.content?.data as
              | { type?: string; bookingId?: string }
              | undefined;
            const suppress =
              data?.type === "chat" &&
              !!data?.bookingId &&
              data.bookingId === activeChat.bookingId;
            return {
              shouldShowAlert: !suppress,
              shouldPlaySound: !suppress,
              shouldSetBadge: false,
              shouldShowBanner: !suppress,
              shouldShowList: !suppress,
            };
          },
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

const PUSH_REGISTERED_KEY = "pm_push_registered";

/**
 * Registers this phone for SERVER push (the production channel: the server
 * notifies FCM, FCM delivers instantly — even when the app is killed, and
 * with zero polling). Gets the Expo push token and hands it to our API.
 *
 * Gracefully returns false when FCM credentials aren't configured in the
 * build yet — the polling watcher then remains the delivery channel.
 */
async function registerForPush(): Promise<boolean> {
  if (!isSupported || !isApiEnabled()) return false;
  try {
    const ok = await setup();
    if (!ok) return false;
    const projectId =
      (Constants as any)?.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenResult?.data;
    if (!token) throw new Error("no token");
    await http.request("/api/me/push-token", { method: "POST", body: { token } });
    await AsyncStorage.setItem(PUSH_REGISTERED_KEY, "true");
    return true;
  } catch {
    try {
      await AsyncStorage.setItem(PUSH_REGISTERED_KEY, "false");
    } catch {
      /* ignore */
    }
    return false;
  }
}

/** Whether this device successfully registered for server push. */
async function isPushRegistered(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PUSH_REGISTERED_KEY)) === "true";
  } catch {
    return false;
  }
}

/**
 * Fires whenever a push ARRIVES while the app is foregrounded — used to sync
 * the in-app feed/badges instantly instead of waiting for the next poll.
 */
function addReceivedListener(onReceive: () => void): () => void {
  if (!isSupported) return () => {};
  const sub = Notifications.addNotificationReceivedListener(() => onReceive());
  return () => sub.remove();
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

export const pushService = {
  setup,
  notify,
  addResponseListener,
  registerForPush,
  isPushRegistered,
  addReceivedListener,
};
