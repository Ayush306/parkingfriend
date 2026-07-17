"use strict";

/**
 * Server → phone push notifications, the way production apps do it.
 *
 * When something happens (new request, accept/decline, cancel, chat message)
 * the server sends ONE message to Expo's push service, which relays it through
 * FCM to the recipient's phone — instantly, even when the app is killed. No
 * client polling involved.
 *
 * Everything here is fire-and-forget and failure-proof: a push is a nicety,
 * never allowed to break (or slow down) the API response that triggered it.
 *
 * NOTE: tokens only exist once the app is built with FCM credentials
 * (google-services.json via EAS). Until then no user has a token and every
 * call here is a silent no-op — the app's polling fallback still covers them.
 */

const db = require("./db");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** True for strings that look like a real Expo push token. */
function isExpoToken(token) {
  return typeof token === "string" && /^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(token);
}

/** Sends one push message to a user by id. Fire-and-forget; never throws. */
async function pushToUser(userId, title, body, data) {
  try {
    if (!userId) return;
    const user = await db.getUserById(userId);
    const token = user && user.pushToken;
    if (!isExpoToken(token)) return;
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        to: token,
        title,
        body,
        data: data || {},
        sound: "default",
        priority: "high",
        channelId: "default",
      }),
    });
    // If the device is gone (uninstalled), drop the dead token so we stop
    // sending to it.
    const json = await res.json().catch(() => null);
    const detail = json && json.data && (Array.isArray(json.data) ? json.data[0] : json.data);
    if (detail && detail.details && detail.details.error === "DeviceNotRegistered") {
      await db.savePushToken(userId, null).catch(() => {});
    }
  } catch {
    // Never let a push failure affect the request that triggered it.
  }
}

/** Same, but does not block the caller at all. */
function pushToUserAsync(userId, title, body, data) {
  pushToUser(userId, title, body, data).catch(() => {});
}

module.exports = { pushToUserAsync, isExpoToken };
