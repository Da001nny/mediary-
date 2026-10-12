export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PrivacyLevel = "private" | "friends" | "public";
export type ProfileVisibility = "public" | "private";
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
          profile_visibility: ProfileVisibility;
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
          profile_visibility?: ProfileVisibility;
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
          profile_visibility?: ProfileVisibility;
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
          tmdb_id?: number | null;
          imdb_id?: string | null;
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
          tmdb_id?: number | null;
          imdb_id?: string | null;
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
          tmdb_id?: number | null;
          imdb_id?: string | null;
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
      entries: {
        Row: {
          id: string;
          user_id: string;
          media_id: string;
          status: "planned" | "in_progress" | "completed" | "dropped" | "on_hold";
          rating: number | null; // Normalized 0-100 internally
          progress: Json | MediaProgress | null;
          review: string | null;
          contains_spoilers?: boolean;
          privacy: PrivacyLevel;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          media_id: string;
          status: "planned" | "in_progress" | "completed" | "dropped" | "on_hold";
          rating?: number | null; // Normalized 0-100 internally
          progress?: Json | MediaProgress | null;
          review?: string | null;
          contains_spoilers?: boolean;
          privacy?: PrivacyLevel;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          media_id?: string;
          status?: "planned" | "in_progress" | "completed" | "dropped" | "on_hold";
          rating?: number | null; // Normalized 0-100 internally
          progress?: Json | MediaProgress | null;
          review?: string | null;
          contains_spoilers?: boolean;
          privacy?: PrivacyLevel;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entries_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lists: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          name?: string;
          description: string | null;
          is_ranked: boolean;
          privacy: PrivacyLevel;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          name?: string;
          description?: string | null;
          is_ranked?: boolean;
          privacy?: PrivacyLevel;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          name?: string;
          description?: string | null;
          is_ranked?: boolean;
          privacy?: PrivacyLevel;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lists_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      list_items: {
        Row: {
          id: string;
          list_id: string;
          media_id: string;
          position: number;
          notes: string | null;
          added_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          media_id: string;
          position?: number;
          notes?: string | null;
          added_at?: string;
        };
        Update: {
          id?: string;
          list_id?: string;
          media_id?: string;
          position?: number;
          notes?: string | null;
          added_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "list_items_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "list_items_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
        ];
      };
      follows: {
        Row: {
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: {
          follower_id?: string;
          following_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey";
            columns: ["follower_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follows_following_id_fkey";
            columns: ["following_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      activity: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          ref_id: string | null;
          privacy: PrivacyLevel;
          media_id: string | null;
          media_type: string | null;
          data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          ref_id?: string | null;
          privacy?: PrivacyLevel;
          media_id?: string | null;
          media_type?: string | null;
          data?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          ref_id?: string | null;
          privacy?: PrivacyLevel;
          media_id?: string | null;
          media_type?: string | null;
          data?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      likes: {
        Row: {
          id: string;
          user_id: string;
          entry_id: string | null;
          list_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entry_id?: string | null;
          list_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          entry_id?: string | null;
          list_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "likes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "likes_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: false;
            referencedRelation: "entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "likes_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: {
          id: string;
          user_id: string;
          entry_id: string | null;
          list_id: string | null;
          parent_id: string | null;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entry_id?: string | null;
          list_id?: string | null;
          parent_id?: string | null;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          entry_id?: string | null;
          list_id?: string | null;
          parent_id?: string | null;
          body?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: false;
            referencedRelation: "entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
        ];
      };
      import_jobs: {
        Row: {
          id: string;
          user_id: string;
          source: string;
          status: string;
          options: Json;
          total: number;
          matched: number;
          already_logged: number;
          needs_review: number;
          failed: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source: string;
          status?: string;
          options?: Json;
          total?: number;
          matched?: number;
          already_logged?: number;
          needs_review?: number;
          failed?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source?: string;
          status?: string;
          options?: Json;
          total?: number;
          matched?: number;
          already_logged?: number;
          needs_review?: number;
          failed?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      import_items: {
        Row: {
          id: string;
          job_id: string;
          row: Json;
          status: string;
          media_id: string | null;
          candidates: Json | null;
          error: string | null;
          claimed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          row: Json;
          status?: string;
          media_id?: string | null;
          candidates?: Json | null;
          error?: string | null;
          claimed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          row?: Json;
          status?: string;
          media_id?: string | null;
          candidates?: Json | null;
          error?: string | null;
          claimed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      safe_profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      claim_import_items: {
        Args: {
          p_job_id: string;
          p_limit: number;
        };
        Returns: Database["public"]["Tables"]["import_items"]["Row"][];
      };
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
export type MediaEntry = Tables<"entries">;
export type Follow = Tables<"follows">;
export type ActivityItem = Tables<"activity">;
export type EntryStatus = "planned" | "in_progress" | "completed" | "dropped" | "on_hold";

export interface MediaProgress {
  // TV Shows
  season?: number | null;
  episode?: number | null;
  // Video Games
  hoursPlayed?: number | null;
  completionPct?: number | null;
  // Books
  pagesRead?: number | null;
  // Spoilers flag fallback
  contains_spoilers?: boolean;
  // Generic / Extensible
  [key: string]: unknown;
}

export interface ReviewItem {
  id: string;
  user_id: string;
  media_id: string;
  status: EntryStatus;
  rating: number | null;
  progress?: MediaProgress | null;
  review: string | null;
  contains_spoilers: boolean;
  privacy: PrivacyLevel;
  created_at: string;
  updated_at: string;
  author?: {
    display_name: string;
    avatar_url?: string | null;
  };
}

export type CustomList = Tables<"lists">;
export type CustomListItem = Tables<"list_items">;
export type Like = Tables<"likes">;
export type Comment = Tables<"comments">;

export interface ListWithItems extends CustomList {
  item_count?: number;
  items?: (CustomListItem & {
    media?: MediaItem | null;
  })[];
  owner?: {
    id: string;
    display_name: string;
    avatar_url?: string | null;
  };
  preview_covers?: string[];
}

