export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PrivacyLevel = "private" | "friends" | "public";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          bio: string | null;
          avatar_url: string | null;
          region: string | null;
          locale: string;
          rating_scale: string;
          theme: string;
          default_privacy: PrivacyLevel;
          dashboard_widgets: Json;
          joined_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          region?: string | null;
          locale?: string;
          rating_scale?: string;
          theme?: string;
          default_privacy?: PrivacyLevel;
          dashboard_widgets?: Json;
          joined_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          region?: string | null;
          locale?: string;
          rating_scale?: string;
          theme?: string;
          default_privacy?: PrivacyLevel;
          dashboard_widgets?: Json;
          joined_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Profile = Tables<"profiles">;
