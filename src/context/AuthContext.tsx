import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@/models/types";
import { authService } from "@/services/authService";
import { telemetry } from "@/services/telemetry";

export interface AuthContextValue {
  /** The currently signed-in user, or null when signed out. */
  user: User | null;
  /** Convenience flag: whether a user session exists. */
  isAuthed: boolean;
  /** Whether the user has completed onboarding. */
  isOnboarded: boolean;
  /** True while the initial session/onboarding state is loading. */
  initializing: boolean;
  /** Sends an OTP to the given phone number. */
  sendOtp: (phone: string) => Promise<void>;
  /**
   * Verifies an OTP and logs the user in. Pass `extra.name` to REGISTER a new
   * account; omit it to LOG IN an existing one.
   */
  verifyOtp: (
    phone: string,
    code: string,
    extra?: { name?: string; email?: string }
  ) => Promise<User>;
  /** Directly sets the signed-in user and persists the session. */
  login: (user: User) => Promise<void>;
  /** Clears the session and signs the user out. */
  logout: () => Promise<void>;
  /** Marks onboarding as complete and persists it. */
  completeOnboarding: () => Promise<void>;
  /** Applies a patch to the in-memory user (e.g. after profile edits). */
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isOnboarded, setIsOnboarded] = useState<boolean>(false);
  const [initializing, setInitializing] = useState<boolean>(true);

  // Bootstrap session + onboarding state on mount.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [session, onboarded] = await Promise.all([
          authService.getSession(),
          authService.isOnboarded(),
        ]);
        if (!mounted) return;
        setIsOnboarded(onboarded);

        // A saved session is only trusted after the server confirms it still
        // works. This is what routes a fresh/reinstalled app (whose stored
        // session points at a gone/expired account) to Login/Register instead
        // of silently landing on Home. A network/cold-start hiccup is treated
        // as "still logged in" so we never sign out a genuine user offline.
        if (session) {
          const status = await authService.validateSession();
          if (!mounted) return;
          if (status === "invalid") {
            await authService.logout();
            setUser(null);
          } else {
            setUser(session);
          }
        } else {
          setUser(null);
        }
      } catch {
        if (mounted) {
          setUser(null);
          setIsOnboarded(false);
        }
      } finally {
        if (mounted) setInitializing(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const sendOtp = useCallback(async (phone: string) => {
    await authService.sendOtp(phone);
  }, []);

  const verifyOtp = useCallback(
    async (
      phone: string,
      code: string,
      extra?: { name?: string; email?: string }
    ) => {
      const result = await authService.verifyOtp(phone, code, extra);
      setUser(result.user);
      // `extra.name` present = the Register flow; absent = Login. Fires AFTER
      // success so the funnel counts real accounts, not failed attempts.
      telemetry.track(extra?.name ? "signup" : "login");
      return result.user;
    },
    []
  );

  const login = useCallback(async (nextUser: User) => {
    await authService.saveSession(nextUser);
    setUser(nextUser);
  }, []);

  const logout = useCallback(async () => {
    // Track BEFORE the token is dropped so the event still attributes to the
    // user; flush is best-effort (an offline logout must still work).
    telemetry.track("logout");
    telemetry.flushNow();
    await authService.logout();
    setUser(null);
  }, []);

  const completeOnboarding = useCallback(async () => {
    await authService.setOnboarded();
    setIsOnboarded(true);
  }, []);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch, id: prev.id };
      // Persist the refreshed session without blocking the UI.
      authService.saveSession(next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthed: !!user,
      isOnboarded,
      initializing,
      sendOtp,
      verifyOtp,
      login,
      logout,
      completeOnboarding,
      updateUser,
    }),
    [
      user,
      isOnboarded,
      initializing,
      sendOtp,
      verifyOtp,
      login,
      logout,
      completeOnboarding,
      updateUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the auth context. Must be used within an AuthProvider. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
