"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { User, Session, AuthError } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { getSavedRatingScale } from "@/lib/rating";
import type { Profile, TablesUpdate } from "@/types/database.types";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  signInWithEmail: (
    email: string,
    password: string
  ) => Promise<{ error: AuthError | Error | null }>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<{ error: AuthError | Error | null; user: User | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | Error | null }>;
  signOut: () => Promise<void>;
  demoSignIn: (displayName?: string, email?: string) => void;
  updateProfile: (updates: TablesUpdate<"profiles">) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_STORAGE_KEY = "mediary_demo_auth_user";
const PROFILE_STORAGE_KEY = "mediary_user_profile";

function getInitialDemoState(): { user: User | null; profile: Profile | null } {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(DEMO_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { user: parsed.user || null, profile: parsed.profile || null };
      }
    } catch {
      // Ignore JSON parse errors
    }
  }
  return { user: null, profile: null };
}

function getInitialStoredProfile(): Profile | null {
  if (typeof window !== "undefined") {
    try {
      const profileStored = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (profileStored) {
        return JSON.parse(profileStored);
      }
      const demoStored = localStorage.getItem(DEMO_STORAGE_KEY);
      if (demoStored) {
        const parsed = JSON.parse(demoStored);
        if (parsed?.profile) return parsed.profile;
      }
    } catch {
      // Ignore
    }
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isConfigured = isSupabaseConfigured();

  const [user, setUser] = useState<User | null>(() => {
    if (!isConfigured) {
      return getInitialDemoState().user;
    }
    return null;
  });

  const [profile, setProfile] = useState<Profile | null>(() => {
    return getInitialStoredProfile() || (!isConfigured ? getInitialDemoState().profile : null);
  });

  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(() => isConfigured);

  const supabase = createClient();

  const fetchProfile = useCallback(
    async (userId: string, currentUser: User): Promise<void> => {
      if (!isConfigured) return;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) {
          // If profile table hasn't been migrated yet or trigger is pending, generate a local representation
          const fallbackProfile: Profile = {
            id: userId,
            display_name:
              currentUser.user_metadata?.full_name ||
              currentUser.user_metadata?.name ||
              currentUser.email?.split("@")[0] ||
              "Coffee Reader",
            bio: "Reading and watching through slow mornings.",
            avatar_url: currentUser.user_metadata?.avatar_url || null,
            region: null,
            locale: "en",
            rating_scale: getSavedRatingScale() || "5-star",
            theme: "system",
            default_privacy: "public",
            profile_visibility: "public",
            dashboard_widgets: [],
            joined_at: currentUser.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setProfile(fallbackProfile);
          if (typeof window !== "undefined") {
            localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(fallbackProfile));
          }
          return;
        }

        if (data) {
          const loadedProfile = data as Profile;
          setProfile(loadedProfile);
          if (typeof window !== "undefined") {
            localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(loadedProfile));
            if (loadedProfile.rating_scale) {
              localStorage.setItem("mediary_user_rating_scale", loadedProfile.rating_scale);
              window.dispatchEvent(new Event("rating-scale-changed"));
            }
          }
        }
      } catch (err) {
        console.warn("Could not fetch profile record:", err);
      }
    },
    [isConfigured, supabase]
  );

  useEffect(() => {
    // If Supabase is not configured, we are immediately ready in demo preview mode
    if (!isConfigured) {
      return;
    }

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        fetchProfile(currentSession.user.id, currentSession.user);
      }
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        await fetchProfile(newSession.user.id, newSession.user);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured, supabase, fetchProfile]);

  const signInWithEmail = async (email: string, password: string) => {
    if (!isConfigured) {
      demoSignIn(email.split("@")[0], email);
      return { error: null };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { error };

      if (data.user) {
        setUser(data.user);
        await fetchProfile(data.user.id, data.user);
      }
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName?: string
  ) => {
    if (!isConfigured) {
      demoSignIn(displayName || email.split("@")[0], email);
      return { error: null, user: null };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: displayName,
            name: displayName,
          },
        },
      });

      if (error) return { error, user: null };

      if (data.user) {
        setUser(data.user);
        await fetchProfile(data.user.id, data.user);
      }
      return { error: null, user: data.user };
    } catch (err) {
      return { error: err as Error, user: null };
    }
  };

  const signInWithGoogle = async () => {
    if (!isConfigured) {
      demoSignIn("Claire Beauchamp", "claire@mediary.app");
      return { error: null };
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    if (isConfigured) {
      await supabase.auth.signOut();
    } else {
      if (typeof window !== "undefined") {
        localStorage.removeItem(DEMO_STORAGE_KEY);
      }
    }
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const demoSignIn = (
    displayName = "Claire Beauchamp",
    email = "claire@mediary.app"
  ) => {
    const demoUser = {
      id: "demo-user-1234",
      app_metadata: {},
      user_metadata: { full_name: displayName },
      aud: "authenticated",
      created_at: new Date().toISOString(),
      email,
    } as unknown as User;

    const demoProfile: Profile = {
      id: "demo-user-1234",
      display_name: displayName,
      bio: "Sipping pourover coffee, logging film noirs, reading Proust, and exploring indie games.",
      avatar_url: null,
      region: "Pacific Northwest",
      locale: "en",
      rating_scale: getSavedRatingScale() || "5-star",
      theme: "system",
      default_privacy: "public",
      profile_visibility: "public",
      dashboard_widgets: [],
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setUser(demoUser);
    setProfile(demoProfile);

    if (typeof window !== "undefined") {
      localStorage.setItem(
        DEMO_STORAGE_KEY,
        JSON.stringify({ user: demoUser, profile: demoProfile })
      );
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(demoProfile));
    }
  };

  const updateProfile = async (updates: TablesUpdate<"profiles">) => {
    // 1. Build next profile state, ensuring we have a valid baseline even for guests
    const current: Profile = profile || {
      id: user?.id || "local-user",
      display_name: user?.user_metadata?.full_name || "Coffee Reader",
      bio: null,
      avatar_url: null,
      region: null,
      locale: "en",
      rating_scale: getSavedRatingScale() || "5-star",
      theme: "system",
      default_privacy: "public",
      profile_visibility: "public",
      dashboard_widgets: [],
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const nextProfile: Profile = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // 2. Immediately update React state and persistent storage
    setProfile(nextProfile);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
        if (user) {
          localStorage.setItem(
            DEMO_STORAGE_KEY,
            JSON.stringify({ user, profile: nextProfile })
          );
        }
        if (updates.rating_scale) {
          localStorage.setItem("mediary_user_rating_scale", updates.rating_scale);
          window.dispatchEvent(new Event("rating-scale-changed"));
        }
      } catch (err) {
        console.warn("Could not save profile to localStorage:", err);
      }
    }

    // 3. Persist to server / Supabase Postgres if authenticated
    if (isConfigured && user) {
      try {
        // Upsert to ensure profile row is created or updated
        const { error } = await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            ...updates,
            updated_at: new Date().toISOString(),
          });

        if (error) {
          console.warn("Direct Supabase profile upsert error, trying API route fallback:", error);
          await fetch("/api/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          });
        }
      } catch (err) {
        console.warn("Profile update exception:", err);
      }
    } else {
      // In demo mode or offline, call API route
      try {
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
      } catch {
        // Safe to ignore in offline demo mode
      }
    }

    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isLoading,
        isConfigured,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
        demoSignIn,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
