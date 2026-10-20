-- RLS privacy test, part 3: shared years and the public Year in Review data path.
-- Ends with a deliberate error containing the PASS/FAIL report; all test data is rolled back.
DO $$
DECLARE
  a uuid := '09739170-aace-4311-a658-8c6d760db4b4';
  b uuid := 'e5a62fbf-2ee4-458c-9cf2-708e1184d1fc';
  ca text; cb text;
  m uuid; m2 uuid;
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
  DELETE FROM public.follows WHERE follower_id IN (a, b) AND following_id IN (a, b);
  DELETE FROM public.shared_years WHERE user_id IN (a, b);

  -- A shares a year, logs one public and one private entry, profile public
  RESET ROLE; PERFORM set_config('request.jwt.claims', ca, true); SET LOCAL ROLE authenticated;
  UPDATE public.profiles SET profile_visibility = 'public' WHERE id = a;
  INSERT INTO public.shared_years (user_id, year) VALUES (a, 2025);
  SELECT count(*) INTO n FROM public.shared_years WHERE user_id = a AND year = 2025;
  report := report || CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END || ': owner can share a year' || E'\n';
  INSERT INTO public.entries (user_id, media_id, status, privacy) VALUES (a, m, 'completed', 'public');
  INSERT INTO public.entries (user_id, media_id, status, privacy) VALUES (a, m2, 'completed', 'private');

  -- B (a stranger)
  RESET ROLE; PERFORM set_config('request.jwt.claims', cb, true); SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.shared_years WHERE user_id = a;
  report := report || CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END || ': stranger can see that a year is shared (by design)' || E'\n';
  blocked := false;
  BEGIN
    INSERT INTO public.shared_years (user_id, year) VALUES (a, 2026);
  EXCEPTION WHEN OTHERS THEN blocked := true;
  END;
  report := report || CASE WHEN blocked THEN 'PASS' ELSE 'FAIL' END || ': stranger cannot share a year for someone else' || E'\n';
  DELETE FROM public.shared_years WHERE user_id = a;
  GET DIAGNOSTICS n = ROW_COUNT;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': stranger cannot unshare someone else year' || E'\n';
  SELECT count(*) INTO n FROM public.entries WHERE user_id = a AND media_id IN (m, m2);
  report := report || CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END || ': stranger sees only the public entry of a sharing user' || E'\n';

  -- Logged-out visitor
  RESET ROLE; PERFORM set_config('request.jwt.claims', '', true); SET LOCAL ROLE anon;
  SELECT count(*) INTO n FROM public.shared_years WHERE user_id = a;
  report := report || CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END || ': logged-out visitor can check whether a year is shared' || E'\n';
  blocked := false;
  BEGIN
    INSERT INTO public.shared_years (user_id, year) VALUES (a, 2027);
  EXCEPTION WHEN OTHERS THEN blocked := true;
  END;
  report := report || CASE WHEN blocked THEN 'PASS' ELSE 'FAIL' END || ': logged-out visitor cannot share a year' || E'\n';
  SELECT count(*) INTO n FROM public.entries WHERE user_id = a AND media_id IN (m, m2);
  report := report || CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END || ': logged-out visitor sees only the public entry of a sharing user' || E'\n';
  SELECT count(*) INTO n FROM public.entries WHERE user_id = a AND privacy = 'private';
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': logged-out visitor sees no private entries' || E'\n';
  SELECT count(*) INTO n FROM public.profiles WHERE id = a;
  report := report || CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END || ': public profile is readable, so its shared page can load' || E'\n';
  blocked := false;
  BEGIN
    SELECT count(*) INTO n FROM auth.users;
    blocked := (n = 0);
  EXCEPTION WHEN OTHERS THEN blocked := true;
  END;
  report := report || CASE WHEN blocked THEN 'PASS' ELSE 'FAIL' END || ': logged-out visitor cannot read auth.users (emails)' || E'\n';

  -- A hides the profile: the shared page must become not found
  RESET ROLE; PERFORM set_config('request.jwt.claims', ca, true); SET LOCAL ROLE authenticated;
  UPDATE public.profiles SET profile_visibility = 'private' WHERE id = a;

  RESET ROLE; PERFORM set_config('request.jwt.claims', '', true); SET LOCAL ROLE anon;
  SELECT count(*) INTO n FROM public.profiles WHERE id = a;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': hidden profile is not readable, so its shared page is not found' || E'\n';

  -- A unshares
  RESET ROLE; PERFORM set_config('request.jwt.claims', ca, true); SET LOCAL ROLE authenticated;
  DELETE FROM public.shared_years WHERE user_id = a AND year = 2025;
  GET DIAGNOSTICS n = ROW_COUNT;
  report := report || CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END || ': owner can unshare their year' || E'\n';

  RESET ROLE; PERFORM set_config('request.jwt.claims', '', true); SET LOCAL ROLE anon;
  SELECT count(*) INTO n FROM public.shared_years WHERE user_id = a;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': unshared year is no longer visible' || E'\n';

  RESET ROLE;
  RAISE EXCEPTION E'TEST REPORT PART 3 (everything rolled back)\n%', report;
END $$;
