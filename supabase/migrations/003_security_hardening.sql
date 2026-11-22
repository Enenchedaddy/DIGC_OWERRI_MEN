-- The application reads protected data only through the Edge Function after
-- validating the caller. Remove legacy PostgREST surfaces that are not needed.

DROP VIEW IF EXISTS public.directory_members;

REVOKE ALL ON FUNCTION public.handle_new_portal_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_approved_member(UUID) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "password_resets_no_client_access" ON public.password_resets;
CREATE POLICY "password_resets_no_client_access" ON public.password_resets
  FOR ALL TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id
  ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user_id
  ON public.announcement_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by
  ON public.announcements(created_by);
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id
  ON public.password_resets(user_id);
