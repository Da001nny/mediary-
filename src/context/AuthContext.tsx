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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isConfigured = isSupabaseConfigured();

  const [user, setUser] = useState<User | null>(() => {
    if (!isConfigured) {
      return getInitialDemoState().user;
    }
    return null;
  });

  const [profile, setProfile] = useState<Profile | null>(() => {
    if (!isConfigured) {
      return getInitialDemoState().profile;
    }
    return null;
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
            rating_scale: "100",
            theme: "system",
            default_privacy: "public",
            dashboard_widgets: [],
            joined_at: currentUser.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setProfile(fallbackProfile);
          return;
        }

        if (data) {
          setProfile(data as Profile);
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
      rating_scale: "100",
      theme: "system",
      default_privacy: "public",
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
    }
  };

  const updateProfile = async (updates: TablesUpdate<"profiles">) => {
    if (!user) return { error: new Error("Not authenticated") };

    if (!isConfigured) {
      setProfile((prev) => (prev ? { ...prev, ...updates } : null));
      return { error: null };
    }

    try {
      // Users can only update their own row per RLS policy: USING (auth.uid() = id)
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) return { error };

      setProfile((prev) => (prev ? { ...prev, ...updates } : null));
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
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
