-- RLS privacy test. Paste into the Supabase SQL Editor with two real user IDs.
-- It ends with a deliberate error that contains the PASS/FAIL report;
-- all test data is rolled back.
DO $$
DECLARE
  a uuid := '09739170-aace-4311-a658-8c6d760db4b4';
  b uuid := 'e5a62fbf-2ee4-458c-9cf2-708e1184d1fc';
  ca text; cb text;
  m uuid; m2 uuid; e uuid;
  n int; blocked boolean;
  report text := '';
BEGIN
  ca := json_build_object('sub', a, 'role', 'authenticated')::text;
  cb := json_build_object('sub', b, 'role', 'authenticated')::text;

  SELECT id INTO m FROM public.media mm
   WHERE NOT EXISTS (SELECT 1 FROM public.entries x WHERE x.user_id IN (a, b) AND x.media_id = mm.id)
   LIMIT 1;
  SELECT id INTO m2 FROM public.media mm
   WHERE mm.id <> m AND NOT EXISTS (SELECT 1 FROM public.entries x WHERE x.user_id IN (a, b) AND x.media_id = mm.id)
   LIMIT 1;
  IF m IS NULL OR m2 IS NULL THEN
    RAISE EXCEPTION 'Need two media rows that neither test user has logged';
  END IF;
  UPDATE public.profiles SET profile_visibility = 'public' WHERE id IN (a, b);

  -- A logs a PRIVATE entry
  RESET ROLE; PERFORM set_config('request.jwt.claims', ca, true); SET LOCAL ROLE authenticated;
  INSERT INTO public.entries (user_id, media_id, status, privacy, review)
    VALUES (a, m, 'completed', 'private', 'secret review') RETURNING id INTO e;

  RESET ROLE; PERFORM set_config('request.jwt.claims', cb, true); SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.entries WHERE id = e;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': stranger cannot see a private entry' || E'\n';

  -- A makes it PUBLIC and posts to the feed
  RESET ROLE; PERFORM set_config('request.jwt.claims', ca, true); SET LOCAL ROLE authenticated;
  UPDATE public.entries SET privacy = 'public' WHERE id = e;
  INSERT INTO public.activity (user_id, type, ref_id, privacy, media_id, media_type)
    VALUES (a, 'logged', e, 'public', m, 'movie');

  RESET ROLE; PERFORM set_config('request.jwt.claims', cb, true); SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.entries WHERE id = e;
  report := report || CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END || ': stranger can see a public entry' || E'\n';
  SELECT count(*) INTO n FROM public.activity WHERE ref_id = e;
  report := report || CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END || ': stranger can see public feed row' || E'\n';

  -- A switches to FRIENDS (no follows yet)
  RESET ROLE; PERFORM set_config('request.jwt.claims', ca, true); SET LOCAL ROLE authenticated;
  UPDATE public.entries SET privacy = 'friends' WHERE id = e;

  RESET ROLE; PERFORM set_config('request.jwt.claims', cb, true); SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.entries WHERE id = e;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': friends entry hidden with no follows' || E'\n';
  SELECT count(*) INTO n FROM public.activity WHERE ref_id = e;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': feed row follows entry to friends-only' || E'\n';

  -- B follows A (one-way)
  INSERT INTO public.follows (follower_id, following_id) VALUES (b, a);
  SELECT count(*) INTO n FROM public.entries WHERE id = e;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': one-way follow does not unlock friends entry' || E'\n';

  -- A follows B back (mutual)
  RESET ROLE; PERFORM set_config('request.jwt.claims', ca, true); SET LOCAL ROLE authenticated;
  INSERT INTO public.follows (follower_id, following_id) VALUES (a, b);

  RESET ROLE; PERFORM set_config('request.jwt.claims', cb, true); SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.entries WHERE id = e;
  report := report || CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END || ': mutual follow unlocks friends entry' || E'\n';

  -- A makes it PRIVATE again and likes it
  RESET ROLE; PERFORM set_config('request.jwt.claims', ca, true); SET LOCAL ROLE authenticated;
  UPDATE public.entries SET privacy = 'private' WHERE id = e;
  SELECT count(*) INTO n FROM public.activity WHERE ref_id = e;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': feed row deleted when entry goes private' || E'\n';
  INSERT INTO public.likes (user_id, entry_id) VALUES (a, e);

  -- B tries to read, edit, delete, impersonate
  RESET ROLE; PERFORM set_config('request.jwt.claims', cb, true); SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.likes WHERE entry_id = e;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': likes on a private entry are hidden' || E'\n';

  UPDATE public.entries SET review = 'hacked' WHERE id = e;
  GET DIAGNOSTICS n = ROW_COUNT;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': stranger cannot edit another user entry' || E'\n';

  DELETE FROM public.entries WHERE id = e;
  GET DIAGNOSTICS n = ROW_COUNT;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': stranger cannot delete another user entry' || E'\n';

  blocked := false;
  BEGIN
    INSERT INTO public.entries (user_id, media_id, status, privacy) VALUES (a, m2, 'planned', 'public');
  EXCEPTION WHEN OTHERS THEN blocked := true;
  END;
  report := report || CASE WHEN blocked THEN 'PASS' ELSE 'FAIL' END || ': cannot insert an entry as someone else' || E'\n';

  blocked := false;
  BEGIN
    INSERT INTO public.media (type, title) VALUES ('movie', 'client-write-test');
  EXCEPTION WHEN OTHERS THEN blocked := true;
  END;
  report := report || CASE WHEN blocked THEN 'PASS' ELSE 'FAIL' END || ': logged-in user cannot write to media catalog' || E'\n';

  -- Hidden profile
  RESET ROLE; PERFORM set_config('request.jwt.claims', ca, true); SET LOCAL ROLE authenticated;
  UPDATE public.profiles SET profile_visibility = 'private' WHERE id = a;

  RESET ROLE; PERFORM set_config('request.jwt.claims', cb, true); SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.profiles WHERE id = a;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': hidden profile page not readable by others' || E'\n';
  SELECT count(*) INTO n FROM public.safe_profiles WHERE id = a;
  report := report || 'INFO: hidden profile name visible via safe_profiles = ' || n || ' (expected 1, accepted)' || E'\n';

  -- Logged-out visitor
  RESET ROLE; PERFORM set_config('request.jwt.claims', '', true); SET LOCAL ROLE anon;
  SELECT count(*) INTO n FROM public.entries WHERE id = e;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': logged-out visitor cannot see private entry' || E'\n';

  blocked := false;
  BEGIN
    PERFORM public.claim_import_items(gen_random_uuid(), 1);
  EXCEPTION WHEN OTHERS THEN blocked := true;
  END;
  report := report || CASE WHEN blocked THEN 'PASS' ELSE 'FAIL' END || ': logged-out visitor cannot run claim_import_items' || E'\n';

  RESET ROLE;
  RAISE EXCEPTION E'TEST REPORT (everything rolled back)\n%', report;
END $$;
