import type { User } from "@/models/types";
import currentUser from "@/data/currentUser.json";
import {
  clone,
  delay,
  randomLatency,
  readPersisted,
  STORAGE_KEYS,
  writePersisted,
} from "@/services/mockClient";
import { isApiEnabled } from "@/config/apiConfig";
import { apiUser } from "@/services/api/apiServices";
import { authService } from "@/services/authService";

const seedUser = currentUser as User;

/** Returns the current user profile. From the server in API mode (so it
 *  reflects what other users see), from local storage otherwise. */
async function getProfile(): Promise<User> {
  if (isApiEnabled()) {
    // Prefer the signed-in session (already fresh); fall back to /api/me.
    const session = await authService.getSession();
    if (session) return session;
    return apiUser.getProfile();
  }
  await delay(randomLatency());
  return readPersisted<User>(STORAGE_KEYS.user, seedUser);
}

/**
 * Applies a partial patch to the user profile. In API mode this PATCHes the
 * server so the change is visible to everyone (host name/photo on listings),
 * then refreshes the saved session; offline it just persists locally.
 */
async function updateProfile(patch: Partial<User>): Promise<User> {
  if (isApiEnabled()) {
    const updated = await apiUser.updateProfile({
      name: patch.name,
      email: patch.email,
      avatar: patch.avatar,
    });
    await authService.saveSession(updated);
    return updated;
  }
  await delay(randomLatency());
  const current = await readPersisted<User>(STORAGE_KEYS.user, seedUser);
  // Never allow id to be overwritten.
  const { id: _ignored, ...safePatch } = patch;
  const next: User = { ...current, ...safePatch, id: current.id };
  await writePersisted(STORAGE_KEYS.user, next);
  return clone(next);
}

export const userService = {
  getProfile,
  updateProfile,
};
