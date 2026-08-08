-- DriveDrop full Supabase database reset.
--
-- Deletes every row from every application-owned public table and every Auth
-- user while preserving schemas, migrations, extensions, policies, and files.
-- Run from the Supabase SQL editor only after taking a backup.

BEGIN;

-- Required safety latch: uncomment this line before intentionally running.
-- SET LOCAL app.confirm_full_reset = 'ERASE_ALL_DRIVEDROP_DATA';

DO $$
BEGIN
  IF current_setting('app.confirm_full_reset', true) IS DISTINCT FROM 'ERASE_ALL_DRIVEDROP_DATA' THEN
    RAISE EXCEPTION 'Reset blocked. Uncomment the confirmation SET line after verifying the target project and backup.';
  END IF;
END $$;

-- Truncate all root tables in public in one statement. CASCADE handles foreign
-- keys from dependent tables and RESTART IDENTITY resets owned sequences.
DO $$
DECLARE
  table_list TEXT;
BEGIN
  SELECT string_agg(format('%I.%I', namespace.nspname, class.relname), ', ' ORDER BY class.relname)
  INTO table_list
  FROM pg_class AS class
  JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'public'
    AND class.relkind IN ('r', 'p')
    AND NOT class.relispartition
    AND NOT EXISTS (
      SELECT 1
      FROM pg_depend AS dependency
      WHERE dependency.classid = 'pg_class'::regclass
        AND dependency.objid = class.oid
        AND dependency.deptype = 'e'
    );

  IF table_list IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE ' || table_list || ' RESTART IDENTITY CASCADE';
  END IF;
END $$;

-- Removing Auth users cascades to identities, sessions, refresh tokens, MFA
-- factors, and profile-linked rows not already cleared above.
DELETE FROM auth.users;

DO $$
DECLARE
  table_record RECORD;
  table_rows BIGINT;
  public_rows BIGINT := 0;
  auth_users BIGINT;
BEGIN
  FOR table_record IN
    SELECT class.relname
    FROM pg_class AS class
    JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'public'
      AND class.relkind IN ('r', 'p')
      AND NOT class.relispartition
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend AS dependency
        WHERE dependency.classid = 'pg_class'::regclass
          AND dependency.objid = class.oid
          AND dependency.deptype = 'e'
      )
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', table_record.relname) INTO table_rows;
    public_rows := public_rows + table_rows;
  END LOOP;

  SELECT count(*) INTO auth_users FROM auth.users;

  IF public_rows <> 0 OR auth_users <> 0 THEN
    RAISE EXCEPTION 'Reset verification failed: % public row(s) and % Auth user(s) remain.', public_rows, auth_users;
  END IF;

  RAISE NOTICE 'Reset complete. Public rows: %, Auth users: %.', public_rows, auth_users;
END $$;

COMMIT;

-- Storage bucket definitions and files are deliberately preserved. Delete
-- Storage objects through the Supabase Storage API if file cleanup is required.