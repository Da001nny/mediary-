-- RLS privacy test, part 2: lists, comments, import jobs.
-- Ends with a deliberate error containing the PASS/FAIL report; all test data is rolled back.
DO $$
DECLARE
  a uuid := '09739170-aace-4311-a658-8c6d760db4b4';
  b uuid := 'e5a62fbf-2ee4-458c-9cf2-708e1184d1fc';
  ca text; cb text;
  m uuid; m2 uuid; e uuid; lid uuid; jid uuid; iid uuid; c1 uuid; c2 uuid;
  n int; i int; ok int; blocked boolean;
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

  -- ===== LISTS =====
  RESET ROLE; PERFORM set_config('request.jwt.claims', ca, true); SET LOCAL ROLE authenticated;
  INSERT INTO public.lists (user_id, title, privacy) VALUES (a, 'rls-test-list', 'private') RETURNING id INTO lid;
  INSERT INTO public.list_items (list_id, media_id, position) VALUES (lid, m, 0);

  RESET ROLE; PERFORM set_config('request.jwt.claims', cb, true); SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.lists WHERE id = lid;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': private list hidden from stranger' || E'\n';
  SELECT count(*) INTO n FROM public.list_items WHERE list_id = lid;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': items of a private list hidden' || E'\n';

  RESET ROLE; PERFORM set_config('request.jwt.claims', ca, true); SET LOCAL ROLE authenticated;
  UPDATE public.lists SET privacy = 'friends' WHERE id = lid;

  RESET ROLE; PERFORM set_config('request.jwt.claims', cb, true); SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.lists WHERE id = lid;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': friends list hidden with no follows' || E'\n';
  INSERT INTO public.follows (follower_id, following_id) VALUES (b, a);
  SELECT count(*) INTO n FROM public.lists WHERE id = lid;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': one-way follow does not unlock friends list' || E'\n';

  RESET ROLE; PERFORM set_config('request.jwt.claims', ca, true); SET LOCAL ROLE authenticated;
  INSERT INTO public.follows (follower_id, following_id) VALUES (a, b);

  RESET ROLE; PERFORM set_config('request.jwt.claims', cb, true); SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.lists WHERE id = lid;
  report := report || CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END || ': mutual follow unlocks friends list' || E'\n';
  SELECT count(*) INTO n FROM public.list_items WHERE list_id = lid;
  report := report || CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END || ': mutual follow unlocks friends list items' || E'\n';

  RESET ROLE; PERFORM set_config('request.jwt.claims', ca, true); SET LOCAL ROLE authenticated;
  UPDATE public.lists SET privacy = 'public' WHERE id = lid;

  RESET ROLE; PERFORM set_config('request.jwt.claims', '', true); SET LOCAL ROLE anon;
  SELECT count(*) INTO n FROM public.lists WHERE id = lid;
  report := report || CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END || ': logged-out visitor can see a public list' || E'\n';

  RESET ROLE; PERFORM set_config('request.jwt.claims', cb, true); SET LOCAL ROLE authenticated;
  UPDATE public.lists SET title = 'hacked' WHERE id = lid;
  GET DIAGNOSTICS n = ROW_COUNT;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': stranger cannot edit another user list' || E'\n';
  DELETE FROM public.lists WHERE id = lid;
  GET DIAGNOSTICS n = ROW_COUNT;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': stranger cannot delete another user list' || E'\n';
  blocked := false;
  BEGIN
    INSERT INTO public.list_items (list_id, media_id, position) VALUES (lid, m2, 5);
  EXCEPTION WHEN OTHERS THEN blocked := true;
  END;
  report := report || CASE WHEN blocked THEN 'PASS' ELSE 'FAIL' END || ': stranger cannot add items to another user list' || E'\n';

  -- ===== COMMENTS =====
  RESET ROLE; PERFORM set_config('request.jwt.claims', ca, true); SET LOCAL ROLE authenticated;
  INSERT INTO public.entries (user_id, media_id, status, privacy) VALUES (a, m, 'completed', 'public') RETURNING id INTO e;
  INSERT INTO public.comments (user_id, entry_id, body) VALUES (a, e, 'owner comment') RETURNING id INTO c1;

  RESET ROLE; PERFORM set_config('request.jwt.claims', cb, true); SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.comments WHERE id = c1;
  report := report || CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END || ': stranger can read comments on a public entry' || E'\n';
  INSERT INTO public.comments (user_id, entry_id, body) VALUES (b, e, 'stranger comment') RETURNING id INTO c2;
  report := report || CASE WHEN c2 IS NOT NULL THEN 'PASS' ELSE 'FAIL' END || ': stranger can comment on a public entry' || E'\n';

  blocked := false;
  BEGIN
    INSERT INTO public.comments (user_id, entry_id, body) VALUES (a, e, 'impersonation');
  EXCEPTION WHEN OTHERS THEN blocked := true;
  END;
  report := report || CASE WHEN blocked THEN 'PASS' ELSE 'FAIL' END || ': cannot post a comment as someone else' || E'\n';

  DELETE FROM public.comments WHERE id = c1;
  GET DIAGNOSTICS n = ROW_COUNT;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': stranger cannot delete the entry owner comment' || E'\n';

  RESET ROLE; PERFORM set_config('request.jwt.claims', ca, true); SET LOCAL ROLE authenticated;
  DELETE FROM public.comments WHERE id = c2;
  GET DIAGNOSTICS n = ROW_COUNT;
  report := report || CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END || ': entry owner can delete a stranger comment' || E'\n';

  UPDATE public.entries SET privacy = 'private' WHERE id = e;

  RESET ROLE; PERFORM set_config('request.jwt.claims', cb, true); SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.comments WHERE entry_id = e;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': comments on a private entry are hidden' || E'\n';
  blocked := false;
  BEGIN
    INSERT INTO public.comments (user_id, entry_id, body) VALUES (b, e, 'sneaky');
  EXCEPTION WHEN OTHERS THEN blocked := true;
  END;
  report := report || CASE WHEN blocked THEN 'PASS' ELSE 'FAIL' END || ': cannot comment on a private entry' || E'\n';

  RESET ROLE; PERFORM set_config('request.jwt.claims', '', true); SET LOCAL ROLE anon;
  SELECT count(*) INTO n FROM public.comments WHERE entry_id = e;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': logged-out visitor cannot read comments on a private entry' || E'\n';

  RESET ROLE; PERFORM set_config('request.jwt.claims', ca, true); SET LOCAL ROLE authenticated;
  UPDATE public.entries SET privacy = 'public' WHERE id = e;
  ok := 0;
  FOR i IN 1..15 LOOP
    BEGIN
      INSERT INTO public.comments (user_id, entry_id, body) VALUES (a, e, 'spam ' || i);
      ok := ok + 1;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
  report := report || CASE WHEN ok <= 10 THEN 'PASS' ELSE 'FAIL' END || ': comment rate limit stops spam (' || ok || ' of 15 went through)' || E'\n';

  -- ===== IMPORT JOBS =====
  RESET ROLE; PERFORM set_config('request.jwt.claims', ca, true); SET LOCAL ROLE authenticated;
  INSERT INTO public.import_jobs (user_id, source, status) VALUES (a, 'rls-test', 'completed') RETURNING id INTO jid;
  INSERT INTO public.import_items (job_id, "row", status) VALUES (jid, '{}'::jsonb, 'pending') RETURNING id INTO iid;

  RESET ROLE; PERFORM set_config('request.jwt.claims', cb, true); SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.import_jobs WHERE id = jid;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': stranger cannot see another user import job' || E'\n';
  SELECT count(*) INTO n FROM public.import_items WHERE id = iid;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': stranger cannot see another user import items' || E'\n';
  blocked := false;
  BEGIN
    INSERT INTO public.import_items (job_id, "row", status) VALUES (jid, '{}'::jsonb, 'pending');
  EXCEPTION WHEN OTHERS THEN blocked := true;
  END;
  report := report || CASE WHEN blocked THEN 'PASS' ELSE 'FAIL' END || ': stranger cannot add items to another user import job' || E'\n';
  UPDATE public.import_jobs SET status = 'failed' WHERE id = jid;
  GET DIAGNOSTICS n = ROW_COUNT;
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': stranger cannot modify another user import job' || E'\n';
  SELECT count(*) INTO n FROM public.claim_import_items(jid, 5);
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ': stranger cannot claim another user import items' || E'\n';

  RESET ROLE; PERFORM set_config('request.jwt.claims', ca, true); SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.claim_import_items(jid, 5);
  report := report || CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END || ': owner can claim own import items' || E'\n';

  RESET ROLE; PERFORM set_config('request.jwt.claims', '', true); SET LOCAL ROLE anon;
  blocked := false;
  BEGIN
    SELECT count(*) INTO n FROM public.import_jobs WHERE id = jid;
    blocked := (n = 0);
  EXCEPTION WHEN OTHERS THEN blocked := true;
  END;
  report := report || CASE WHEN blocked THEN 'PASS' ELSE 'FAIL' END || ': logged-out visitor cannot see import jobs' || E'\n';

  RESET ROLE;
  RAISE EXCEPTION E'TEST REPORT PART 2 (everything rolled back)\n%', report;
END $$;
