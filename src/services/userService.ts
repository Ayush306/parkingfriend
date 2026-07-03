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

const seedUser = currentUser as User;

/** Returns the current user profile, seeded from JSON and persisted. */
async function getProfile(): Promise<User> {
  await delay(randomLatency());
  return readPersisted<User>(STORAGE_KEYS.user, seedUser);
}

/** Applies a partial patch to the user profile and persists it. */
async function updateProfile(patch: Partial<User>): Promise<User> {
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
