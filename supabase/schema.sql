


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."check_comment_guards"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_recent_count INT;
  v_parent_parent_id UUID;
  v_parent_entry_id UUID;
  v_parent_list_id UUID;
BEGIN
  -- (1) Reject insert if the same user already created 10 or more comments in the last 60 seconds
  SELECT COUNT(*)
  INTO v_recent_count
  FROM public.comments
  WHERE user_id = NEW.user_id
    AND created_at >= (NOW() - INTERVAL '60 seconds');

  IF v_recent_count >= 10 THEN
    RAISE EXCEPTION 'Comment rate limit exceeded: maximum 10 comments per 60 seconds.'
      USING ERRCODE = 'P0001';
  END IF;

  -- (2) If parent_id is set, require the parent to be a top-level comment (parent_id is null)
  -- on the same entry_id or list_id as the new comment
  IF NEW.parent_id IS NOT NULL THEN
    SELECT parent_id, entry_id, list_id
    INTO v_parent_parent_id, v_parent_entry_id, v_parent_list_id
    FROM public.comments
    WHERE id = NEW.parent_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parent comment not found.'
        USING ERRCODE = 'P0002';
    END IF;

    -- Parent must be a top-level comment (its parent_id is null)
    IF v_parent_parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Replies are one level only: parent comment must be a top-level comment.'
        USING ERRCODE = 'P0003';
    END IF;

    -- Parent must be on the same entry_id or list_id as the new comment
    IF (v_parent_entry_id IS DISTINCT FROM NEW.entry_id) OR (v_parent_list_id IS DISTINCT FROM NEW.list_id) THEN
      RAISE EXCEPTION 'Reply target must match the parent comment target.'
        USING ERRCODE = 'P0004';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_comment_guards"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."import_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "row" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "media_id" "uuid",
    "candidates" "jsonb",
    "error" "text",
    "claimed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."import_items" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_import_items"("p_job_id" "uuid", "p_limit" integer) RETURNS SETOF "public"."import_items"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT id
    FROM public.import_items
    WHERE job_id = p_job_id
      AND (
        status = 'pending'
        OR (
          status = 'processing'
          AND (claimed_at IS NULL OR claimed_at < (pg_catalog.now() - INTERVAL '2 minutes'))
        )
      )
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.import_items i
  SET status = 'processing',
      claimed_at = pg_catalog.now()
  FROM claimable c
  WHERE i.id = c.id
  RETURNING i.*;
END;
$$;


ALTER FUNCTION "public"."claim_import_items"("p_job_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'display_name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_activity_on_entry_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.activity
    WHERE ref_id = OLD.id AND type IN ('logged','reviewed');
    RETURN OLD;
  END IF;

  IF NEW.privacy = 'private' THEN
    DELETE FROM public.activity
    WHERE ref_id = NEW.id AND type IN ('logged','reviewed');
    RETURN NEW;
  END IF;

  IF NEW.review IS NULL OR length(trim(NEW.review)) = 0 THEN
    DELETE FROM public.activity WHERE ref_id = NEW.id AND type = 'reviewed';
  END IF;

  UPDATE public.activity
  SET privacy = NEW.privacy,
      data = data || jsonb_build_object(
        'rating', NEW.rating,
        'review', NEW.review,
        'contains_spoilers', NEW.contains_spoilers,
        'status', NEW.status)
  WHERE ref_id = NEW.id AND type IN ('logged','reviewed');

  RETURN NEW;
END $$;


ALTER FUNCTION "public"."sync_activity_on_entry_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_activity_on_list_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.activity WHERE ref_id = OLD.id AND type = 'listed';
    RETURN OLD;
  END IF;

  IF NEW.privacy = 'private' THEN
    DELETE FROM public.activity WHERE ref_id = NEW.id AND type = 'listed';
    RETURN NEW;
  END IF;

  UPDATE public.activity
  SET privacy = NEW.privacy,
      data = data || jsonb_build_object('name', NEW.title, 'description', NEW.description)
  WHERE ref_id = NEW.id AND type = 'listed';

  RETURN NEW;
END $$;


ALTER FUNCTION "public"."sync_activity_on_list_change"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text",
    "ref_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "privacy" "text" DEFAULT 'public'::"text" NOT NULL,
    "media_id" "uuid",
    "media_type" "text",
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "activity_privacy_check" CHECK (("privacy" = ANY (ARRAY['public'::"text", 'friends'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entry_id" "uuid",
    "list_id" "uuid",
    "parent_id" "uuid",
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_comments_body_length" CHECK ((("length"(TRIM(BOTH FROM "body")) >= 1) AND ("length"(TRIM(BOTH FROM "body")) <= 1000))),
    CONSTRAINT "check_comments_single_target" CHECK (((("entry_id" IS NOT NULL) AND ("list_id" IS NULL)) OR (("entry_id" IS NULL) AND ("list_id" IS NOT NULL))))
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "media_id" "uuid" NOT NULL,
    "status" "text",
    "rating" numeric,
    "review" "text",
    "contains_spoilers" boolean DEFAULT false,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "rewatch_count" integer DEFAULT 0,
    "progress" "jsonb",
    "custom_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "privacy" "text" DEFAULT 'private'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "entries_rating_check" CHECK ((("rating" >= (0)::numeric) AND ("rating" <= (100)::numeric))),
    CONSTRAINT "entries_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'in_progress'::"text", 'completed'::"text", 'dropped'::"text", 'on_hold'::"text"])))
);


ALTER TABLE "public"."entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."entries" IS 'Individual user diary logs with status, rating, reviews, and privacy constraints.';



COMMENT ON COLUMN "public"."entries"."rating" IS 'Internal normalized rating between 0 and 100 (supports 5-star, 10-point, 100-point, and future rating systems).';



COMMENT ON COLUMN "public"."entries"."contains_spoilers" IS 'Flag indicating whether the user review contains plot spoilers that should be blurred behind a "Show spoilers" toggle.';



COMMENT ON COLUMN "public"."entries"."progress" IS 'Media-specific progress tracking: {season, episode} for TV, {hoursPlayed, completionPct} for games, {pagesRead} for books; null or empty for movies.';



CREATE TABLE IF NOT EXISTS "public"."follows" (
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_not_self_follow" CHECK (("follower_id" <> "following_id"))
);


ALTER TABLE "public"."follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."global_stats" (
    "id" integer DEFAULT 1 NOT NULL,
    "avg_rating_by_genre" "jsonb",
    "avg_rating_overall" numeric,
    "last_computed_at" timestamp with time zone
);


ALTER TABLE "public"."global_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "options" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "total" integer DEFAULT 0 NOT NULL,
    "matched" integer DEFAULT 0 NOT NULL,
    "already_logged" integer DEFAULT 0 NOT NULL,
    "needs_review" integer DEFAULT 0 NOT NULL,
    "failed" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."import_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entry_id" "uuid",
    "list_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_likes_single_target" CHECK (((("entry_id" IS NOT NULL) AND ("list_id" IS NULL)) OR (("entry_id" IS NULL) AND ("list_id" IS NOT NULL))))
);


ALTER TABLE "public"."likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."list_items" (
    "list_id" "uuid" NOT NULL,
    "media_id" "uuid" NOT NULL,
    "position" integer
);


ALTER TABLE "public"."list_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "is_ranked" boolean DEFAULT false,
    "privacy" "text" DEFAULT 'private'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "cover_url" "text",
    "release_date" "text",
    "genres" "jsonb",
    "synopsis" "text",
    "type_specific" "jsonb",
    "external_ids" "jsonb",
    "watch_providers" "jsonb",
    "localized_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "community_rating_avg" numeric,
    "community_rating_count" integer DEFAULT 0,
    "last_synced_at" timestamp with time zone,
    "tmdb_id" integer,
    "imdb_id" "text",
    "original_title" "text",
    "tagline" "text",
    "poster_path" "text",
    "backdrop_path" "text",
    "poster_url" "text",
    "backdrop_url" "text",
    "year" integer,
    "status" "text",
    "runtime" integer,
    "number_of_seasons" integer,
    "number_of_episodes" integer,
    "vote_average" numeric(4,2),
    "vote_count" integer,
    "popularity" numeric(10,3),
    "original_language" "text",
    "spoken_languages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "production_companies" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "cast" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "crew" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "credits" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "raw_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "overview" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "media_type_check" CHECK (("type" = ANY (ARRAY['movie'::"text", 'tv'::"text", 'game'::"text", 'book'::"text"])))
);


ALTER TABLE "public"."media" OWNER TO "postgres";


COMMENT ON TABLE "public"."media" IS 'Central catalog for media items (movies, TV shows, games, books) with synced metadata.';



COMMENT ON COLUMN "public"."media"."last_synced_at" IS 'Timestamp of the last metadata fetch from external providers.';



COMMENT ON COLUMN "public"."media"."tmdb_id" IS 'Unique identifier from The Movie Database (TMDB).';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "bio" "text",
    "avatar_url" "text",
    "region" "text",
    "locale" "text" DEFAULT 'en'::"text",
    "rating_scale" "text" DEFAULT 'stars5'::"text",
    "theme" "text" DEFAULT 'light'::"text",
    "default_privacy" "text" DEFAULT 'private'::"text",
    "dashboard_widgets" "jsonb" DEFAULT '[]'::"jsonb",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "profile_visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    CONSTRAINT "profiles_profile_visibility_check" CHECK (("profile_visibility" = ANY (ARRAY['public'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'Extends auth.users with user profile information, privacy, and preferences.';



CREATE OR REPLACE VIEW "public"."safe_profiles" AS
 SELECT "id",
    "display_name",
    "avatar_url"
   FROM "public"."profiles";


ALTER VIEW "public"."safe_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_stats" (
    "user_id" "uuid" NOT NULL,
    "genre_counts" "jsonb",
    "rating_distribution" "jsonb",
    "entries_by_month" "jsonb",
    "type_mix_pct" "jsonb",
    "completion_averages" "jsonb",
    "last_computed_at" timestamp with time zone
);


ALTER TABLE "public"."user_stats" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity"
    ADD CONSTRAINT "activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_user_id_media_id_key" UNIQUE ("user_id", "media_id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id", "following_id");



ALTER TABLE ONLY "public"."global_stats"
    ADD CONSTRAINT "global_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_items"
    ADD CONSTRAINT "import_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."list_items"
    ADD CONSTRAINT "list_items_pkey" PRIMARY KEY ("list_id", "media_id");



ALTER TABLE ONLY "public"."lists"
    ADD CONSTRAINT "lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media"
    ADD CONSTRAINT "media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media"
    ADD CONSTRAINT "media_tmdb_id_key" UNIQUE ("tmdb_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "unique_user_media" UNIQUE ("user_id", "media_id");



COMMENT ON CONSTRAINT "unique_user_media" ON "public"."entries" IS 'Ensures each user can have at most one active entry row per media item.';



ALTER TABLE ONLY "public"."user_stats"
    ADD CONSTRAINT "user_stats_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "idx_activity_created_at" ON "public"."activity" USING "btree" ("created_at");



CREATE INDEX "idx_activity_media_type" ON "public"."activity" USING "btree" ("media_type");



CREATE INDEX "idx_activity_user_id" ON "public"."activity" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_activity_user_type_ref" ON "public"."activity" USING "btree" ("user_id", "type", "ref_id");



CREATE INDEX "idx_comments_created_at" ON "public"."comments" USING "btree" ("created_at");



CREATE INDEX "idx_comments_entry_id" ON "public"."comments" USING "btree" ("entry_id");



CREATE INDEX "idx_comments_list_id" ON "public"."comments" USING "btree" ("list_id");



CREATE INDEX "idx_comments_parent_id" ON "public"."comments" USING "btree" ("parent_id");



CREATE INDEX "idx_comments_user_id" ON "public"."comments" USING "btree" ("user_id");



CREATE INDEX "idx_entries_contains_spoilers" ON "public"."entries" USING "btree" ("contains_spoilers");



CREATE INDEX "idx_entries_created_at" ON "public"."entries" USING "btree" ("created_at");



CREATE INDEX "idx_entries_media_id" ON "public"."entries" USING "btree" ("media_id");



CREATE INDEX "idx_entries_privacy" ON "public"."entries" USING "btree" ("privacy");



CREATE INDEX "idx_entries_progress" ON "public"."entries" USING "gin" ("progress");



CREATE INDEX "idx_entries_status" ON "public"."entries" USING "btree" ("status");



CREATE INDEX "idx_entries_user_id" ON "public"."entries" USING "btree" ("user_id");



CREATE INDEX "idx_follows_created_at" ON "public"."follows" USING "btree" ("created_at");



CREATE INDEX "idx_follows_follower_id" ON "public"."follows" USING "btree" ("follower_id");



CREATE INDEX "idx_follows_following_id" ON "public"."follows" USING "btree" ("following_id");



CREATE INDEX "idx_import_items_claim" ON "public"."import_items" USING "btree" ("job_id", "status", "claimed_at");



CREATE INDEX "idx_import_items_job_id" ON "public"."import_items" USING "btree" ("job_id");



CREATE INDEX "idx_import_items_job_status" ON "public"."import_items" USING "btree" ("job_id", "status");



CREATE INDEX "idx_import_items_status" ON "public"."import_items" USING "btree" ("status");



CREATE INDEX "idx_import_jobs_status" ON "public"."import_jobs" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_import_jobs_user_active" ON "public"."import_jobs" USING "btree" ("user_id") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'paused'::"text"]));



CREATE INDEX "idx_import_jobs_user_id" ON "public"."import_jobs" USING "btree" ("user_id");



CREATE INDEX "idx_likes_created_at" ON "public"."likes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_likes_entry_id" ON "public"."likes" USING "btree" ("entry_id");



CREATE INDEX "idx_likes_list_id" ON "public"."likes" USING "btree" ("list_id");



CREATE UNIQUE INDEX "idx_likes_user_entry" ON "public"."likes" USING "btree" ("user_id", "entry_id") WHERE ("entry_id" IS NOT NULL);



CREATE INDEX "idx_likes_user_id" ON "public"."likes" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_likes_user_list" ON "public"."likes" USING "btree" ("user_id", "list_id") WHERE ("list_id" IS NOT NULL);



CREATE INDEX "idx_list_items_list_id" ON "public"."list_items" USING "btree" ("list_id");



CREATE INDEX "idx_list_items_media_id" ON "public"."list_items" USING "btree" ("media_id");



CREATE INDEX "idx_list_items_position" ON "public"."list_items" USING "btree" ("list_id", "position");



CREATE INDEX "idx_lists_created_at" ON "public"."lists" USING "btree" ("created_at");



CREATE INDEX "idx_lists_privacy" ON "public"."lists" USING "btree" ("privacy");



CREATE INDEX "idx_lists_user_id" ON "public"."lists" USING "btree" ("user_id");



CREATE INDEX "idx_media_release_date" ON "public"."media" USING "btree" ("release_date");



CREATE INDEX "idx_media_title" ON "public"."media" USING "gin" ("to_tsvector"('"english"'::"regconfig", "title"));



CREATE INDEX "idx_media_tmdb_id" ON "public"."media" USING "btree" ("tmdb_id");



CREATE INDEX "idx_media_type" ON "public"."media" USING "btree" ("type");



CREATE OR REPLACE TRIGGER "set_entries_updated_at" BEFORE UPDATE ON "public"."entries" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_lists_updated_at" BEFORE UPDATE ON "public"."lists" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_media_updated_at" BEFORE UPDATE ON "public"."media" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "tr_entry_activity_sync" AFTER DELETE OR UPDATE OF "privacy", "review", "rating", "status", "contains_spoilers" ON "public"."entries" FOR EACH ROW EXECUTE FUNCTION "public"."sync_activity_on_entry_change"();



CREATE OR REPLACE TRIGGER "tr_list_activity_sync" AFTER DELETE OR UPDATE OF "privacy", "title", "description" ON "public"."lists" FOR EACH ROW EXECUTE FUNCTION "public"."sync_activity_on_list_change"();



CREATE OR REPLACE TRIGGER "trigger_comment_guards" BEFORE INSERT ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."check_comment_guards"();



ALTER TABLE ONLY "public"."activity"
    ADD CONSTRAINT "activity_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity"
    ADD CONSTRAINT "activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id");



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."import_items"
    ADD CONSTRAINT "import_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_items"
    ADD CONSTRAINT "import_items_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."list_items"
    ADD CONSTRAINT "list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id");



ALTER TABLE ONLY "public"."list_items"
    ADD CONSTRAINT "list_items_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id");



ALTER TABLE ONLY "public"."lists"
    ADD CONSTRAINT "lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_stats"
    ADD CONSTRAINT "user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



CREATE POLICY "Activity is viewable based on privacy and visibility" ON "public"."activity" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (("privacy" = 'public'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "activity"."user_id") AND ("profiles"."profile_visibility" = 'public'::"text"))))) OR (("privacy" = 'friends'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."follows"
  WHERE (("follows"."follower_id" = "auth"."uid"()) AND ("follows"."following_id" = "activity"."user_id")))) AND (EXISTS ( SELECT 1
   FROM "public"."follows"
  WHERE (("follows"."follower_id" = "activity"."user_id") AND ("follows"."following_id" = "auth"."uid"())))))));



CREATE POLICY "Comments are readable if target is readable" ON "public"."comments" FOR SELECT USING (((("entry_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."entries"
  WHERE ("entries"."id" = "comments"."entry_id")))) OR (("list_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."lists"
  WHERE ("lists"."id" = "comments"."list_id"))))));



CREATE POLICY "Entries are viewable based on privacy and ownership" ON "public"."entries" FOR SELECT USING ((("privacy" = 'public'::"text") OR ("auth"."uid"() = "user_id") OR (("privacy" = 'friends'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."follows"
  WHERE (("follows"."follower_id" = "auth"."uid"()) AND ("follows"."following_id" = "entries"."user_id")))) AND (EXISTS ( SELECT 1
   FROM "public"."follows"
  WHERE (("follows"."follower_id" = "entries"."user_id") AND ("follows"."following_id" = "auth"."uid"())))))));



CREATE POLICY "Follows are viewable based on ownership or public profiles" ON "public"."follows" FOR SELECT USING ((("auth"."uid"() = "follower_id") OR ("auth"."uid"() = "following_id") OR ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p1"
  WHERE (("p1"."id" = "follows"."follower_id") AND ("p1"."profile_visibility" = 'public'::"text")))) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p2"
  WHERE (("p2"."id" = "follows"."following_id") AND ("p2"."profile_visibility" = 'public'::"text")))))));



CREATE POLICY "Likes are readable if target is readable" ON "public"."likes" FOR SELECT USING (((("entry_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."entries"
  WHERE ("entries"."id" = "likes"."entry_id")))) OR (("list_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."lists"
  WHERE ("lists"."id" = "likes"."list_id"))))));



CREATE POLICY "List items deletable by list owner" ON "public"."list_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."lists"
  WHERE (("lists"."id" = "list_items"."list_id") AND ("lists"."user_id" = "auth"."uid"())))));



CREATE POLICY "List items insertable by list owner" ON "public"."list_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lists"
  WHERE (("lists"."id" = "list_items"."list_id") AND ("lists"."user_id" = "auth"."uid"())))));



CREATE POLICY "List items updatable by list owner" ON "public"."list_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."lists"
  WHERE (("lists"."id" = "list_items"."list_id") AND ("lists"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lists"
  WHERE (("lists"."id" = "list_items"."list_id") AND ("lists"."user_id" = "auth"."uid"())))));



CREATE POLICY "List items viewable if parent list is accessible" ON "public"."list_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."lists"
  WHERE (("lists"."id" = "list_items"."list_id") AND (("lists"."privacy" = 'public'::"text") OR ("lists"."user_id" = "auth"."uid"()) OR (("lists"."privacy" = 'friends'::"text") AND (EXISTS ( SELECT 1
           FROM "public"."follows"
          WHERE (("follows"."follower_id" = "auth"."uid"()) AND ("follows"."following_id" = "lists"."user_id")))) AND (EXISTS ( SELECT 1
           FROM "public"."follows"
          WHERE (("follows"."follower_id" = "lists"."user_id") AND ("follows"."following_id" = "auth"."uid"()))))))))));



CREATE POLICY "Lists are viewable based on privacy and ownership" ON "public"."lists" FOR SELECT USING ((("privacy" = 'public'::"text") OR ("auth"."uid"() = "user_id") OR (("privacy" = 'friends'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."follows"
  WHERE (("follows"."follower_id" = "auth"."uid"()) AND ("follows"."following_id" = "lists"."user_id")))) AND (EXISTS ( SELECT 1
   FROM "public"."follows"
  WHERE (("follows"."follower_id" = "lists"."user_id") AND ("follows"."following_id" = "auth"."uid"())))))));



CREATE POLICY "Media items are viewable by everyone" ON "public"."media" FOR SELECT USING (true);



CREATE POLICY "Profiles are viewable based on visibility or owner" ON "public"."profiles" FOR SELECT USING ((("profile_visibility" = 'public'::"text") OR ("auth"."uid"() = "id")));



CREATE POLICY "Users can delete their own activity" ON "public"."activity" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own comments or target owners can delete" ON "public"."comments" FOR DELETE USING ((("auth"."uid"() = "user_id") OR (("entry_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."entries"
  WHERE (("entries"."id" = "comments"."entry_id") AND ("entries"."user_id" = "auth"."uid"()))))) OR (("list_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."lists"
  WHERE (("lists"."id" = "comments"."list_id") AND ("lists"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can delete their own follows" ON "public"."follows" FOR DELETE USING (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can delete their own import items" ON "public"."import_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "import_items"."job_id") AND ("import_jobs"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own import jobs" ON "public"."import_jobs" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own likes" ON "public"."likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own profile" ON "public"."profiles" FOR DELETE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert comments on readable targets" ON "public"."comments" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND ((("entry_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."entries"
  WHERE ("entries"."id" = "comments"."entry_id")))) OR (("list_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."lists"
  WHERE ("lists"."id" = "comments"."list_id")))))));



CREATE POLICY "Users can insert their own activity" ON "public"."activity" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own follows" ON "public"."follows" FOR INSERT WITH CHECK (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can insert their own import items" ON "public"."import_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "import_items"."job_id") AND ("import_jobs"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own import jobs" ON "public"."import_jobs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own likes on readable targets" ON "public"."likes" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND ((("entry_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."entries"
  WHERE ("entries"."id" = "likes"."entry_id")))) OR (("list_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."lists"
  WHERE ("lists"."id" = "likes"."list_id")))))));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can only delete their own entries" ON "public"."entries" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can only delete their own lists" ON "public"."lists" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can only insert their own entries" ON "public"."entries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can only insert their own lists" ON "public"."lists" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can only update their own entries" ON "public"."entries" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can only update their own lists" ON "public"."lists" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own activity" ON "public"."activity" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own import items" ON "public"."import_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "import_items"."job_id") AND ("import_jobs"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "import_items"."job_id") AND ("import_jobs"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their own import jobs" ON "public"."import_jobs" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own import items" ON "public"."import_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."import_jobs"
  WHERE (("import_jobs"."id" = "import_items"."job_id") AND ("import_jobs"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own import jobs" ON "public"."import_jobs" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."activity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."global_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."import_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."import_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."list_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_stats" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."check_comment_guards"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_comment_guards"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_comment_guards"() TO "service_role";



GRANT ALL ON TABLE "public"."import_items" TO "anon";
GRANT ALL ON TABLE "public"."import_items" TO "authenticated";
GRANT ALL ON TABLE "public"."import_items" TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_import_items"("p_job_id" "uuid", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_import_items"("p_job_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_import_items"("p_job_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_activity_on_entry_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_activity_on_entry_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_activity_on_entry_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_activity_on_list_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_activity_on_list_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_activity_on_list_change"() TO "service_role";



GRANT ALL ON TABLE "public"."activity" TO "anon";
GRANT ALL ON TABLE "public"."activity" TO "authenticated";
GRANT ALL ON TABLE "public"."activity" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."entries" TO "anon";
GRANT ALL ON TABLE "public"."entries" TO "authenticated";
GRANT ALL ON TABLE "public"."entries" TO "service_role";



GRANT ALL ON TABLE "public"."follows" TO "anon";
GRANT ALL ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";



GRANT ALL ON TABLE "public"."global_stats" TO "anon";
GRANT ALL ON TABLE "public"."global_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."global_stats" TO "service_role";



GRANT ALL ON TABLE "public"."import_jobs" TO "anon";
GRANT ALL ON TABLE "public"."import_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."import_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."likes" TO "anon";
GRANT ALL ON TABLE "public"."likes" TO "authenticated";
GRANT ALL ON TABLE "public"."likes" TO "service_role";



GRANT ALL ON TABLE "public"."list_items" TO "anon";
GRANT ALL ON TABLE "public"."list_items" TO "authenticated";
GRANT ALL ON TABLE "public"."list_items" TO "service_role";



GRANT ALL ON TABLE "public"."lists" TO "anon";
GRANT ALL ON TABLE "public"."lists" TO "authenticated";
GRANT ALL ON TABLE "public"."lists" TO "service_role";



GRANT ALL ON TABLE "public"."media" TO "anon";
GRANT ALL ON TABLE "public"."media" TO "authenticated";
GRANT ALL ON TABLE "public"."media" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."safe_profiles" TO "anon";
GRANT ALL ON TABLE "public"."safe_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."safe_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_stats" TO "anon";
GRANT ALL ON TABLE "public"."user_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."user_stats" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







