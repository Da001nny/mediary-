export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PrivacyLevel = "private" | "friends" | "public";
export type MediaType = "movie" | "tv" | "game" | "book";

export interface CastMember {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
  order?: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job?: string;
  department?: string;
  profile_path?: string | null;
}

export interface WatchProviderItem {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number;
}

export interface WatchProvidersCountry {
  link?: string;
  flatrate?: WatchProviderItem[];
  rent?: WatchProviderItem[];
  buy?: WatchProviderItem[];
}

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
      media: {
        Row: {
          id: string;
          type: MediaType;
          title: string;
          cover_url: string | null;
          release_date: string | null;
          genres: string[];
          synopsis: string | null;
          type_specific: Json;
          external_ids: Json;
          watch_providers: Json;
          localized_fields: Json;
          community_rating_avg: number | null;
          community_rating_count: number;
          last_synced_at: string;
        };
        Insert: {
          id?: string;
          type: MediaType;
          title: string;
          cover_url?: string | null;
          release_date?: string | null;
          genres?: string[];
          synopsis?: string | null;
          type_specific?: Json;
          external_ids?: Json;
          watch_providers?: Json;
          localized_fields?: Json;
          community_rating_avg?: number | null;
          community_rating_count?: number;
          last_synced_at?: string;
        };
        Update: {
          id?: string;
          type?: MediaType;
          title?: string;
          cover_url?: string | null;
          release_date?: string | null;
          genres?: string[];
          synopsis?: string | null;
          type_specific?: Json;
          external_ids?: Json;
          watch_providers?: Json;
          localized_fields?: Json;
          community_rating_avg?: number | null;
          community_rating_count?: number;
          last_synced_at?: string;
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
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Profile = Tables<"profiles">;
export type MediaItem = Tables<"media">;
