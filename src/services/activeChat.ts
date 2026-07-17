/**
 * Which chat the user is looking at RIGHT NOW (null when none). The Chat
 * screen sets it on focus and clears it on blur; the notification watcher
 * checks it so we never pop a "new message" notification for the very
 * conversation the user is already reading.
 */
export const activeChat: { bookingId: string | null } = { bookingId: null };
