-- Production runtime additions for the Vercel-hosted portal.
-- Authentication is provided by Supabase Auth. The Edge Function uses the
-- service role after validating each caller's access token.

INSERT INTO public.fellowship_settings (
  id,
  fellowship_name,
  tagline,
  logo_url,
  description,
  meeting_schedule,
  meeting_location,
  default_phone_visibility,
  default_email_visibility,
  default_workplace_visibility,
  default_birthday_visibility,
  default_location_visibility
) VALUES (
  'default',
  'DUNAMIS INTERNATIONAL GOSPEL CENTRE, OWERRI',
  'Men''s Fellowship · Brotherhood, Stewardship & Service',
  '/src/assets/images/dunamis_owerri_logo_1795268208018.jpg',
  'A private digital home connecting the men of DUNAMIS INTERNATIONAL GOSPEL CENTRE, OWERRI for accountability, mentorship, fellowship gatherings, and practical service across Imo State and beyond.',
  'First & Third Saturdays · 7:30 AM (WAT)',
  'Dunamis International Gospel Centre, Owerri, Imo State, Nigeria',
  'members',
  'members',
  'members',
  'day_month',
  'members'
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_resets FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = uid
      AND ur.role = 'admin'
      AND p.membership_status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved_member(uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = uid AND p.membership_status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_approved_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved_member(UUID) TO authenticated;

-- A member may read his own complete record. Directory reads are performed by
-- the backend so private fields cannot be recovered by querying PostgREST.
DROP POLICY IF EXISTS "profiles_select_self_or_approved" ON public.profiles;
CREATE POLICY "profiles_select_self_or_admin" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_new_portal_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  metadata JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::JSONB);
BEGIN
  INSERT INTO public.profiles (
    id, full_name, email, phone_number, profile_image, date_of_birth, gender,
    country, state, city, lga, street_address, residential_location,
    occupation, workplace, professional_designation, skills,
    membership_category, date_of_joining, fellowship_responsibilities,
    biography, membership_status
  ) VALUES (
    NEW.id,
    COALESCE(NULLIF(metadata->>'full_name', ''), split_part(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(NEW.email, ''),
    COALESCE(metadata->>'phone_number', ''),
    NULLIF(metadata->>'profile_image', ''),
    NULLIF(metadata->>'date_of_birth', '')::DATE,
    COALESCE(NULLIF(metadata->>'gender', ''), 'Male'),
    COALESCE(NULLIF(metadata->>'country', ''), 'Nigeria'),
    COALESCE(NULLIF(metadata->>'state', ''), 'Imo State'),
    COALESCE(NULLIF(metadata->>'city', ''), 'Owerri'),
    NULLIF(metadata->>'lga', ''),
    NULLIF(metadata->>'street_address', ''),
    NULLIF(metadata->>'residential_location', ''),
    NULLIF(metadata->>'occupation', ''),
    NULLIF(metadata->>'workplace', ''),
    NULLIF(metadata->>'professional_designation', ''),
    NULLIF(metadata->>'skills', ''),
    COALESCE(NULLIF(metadata->>'membership_category', ''), 'General Member'),
    COALESCE(NULLIF(metadata->>'date_of_joining', '')::DATE, CURRENT_DATE),
    NULLIF(metadata->>'fellowship_responsibilities', ''),
    NULLIF(metadata->>'biography', ''),
    'pending'
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');

  INSERT INTO public.profile_privacy (
    user_id,
    phone_visibility,
    email_visibility,
    workplace_visibility,
    birthday_visibility,
    location_visibility
  )
  SELECT
    NEW.id,
    s.default_phone_visibility,
    s.default_email_visibility,
    s.default_workplace_visibility,
    s.default_birthday_visibility,
    s.default_location_visibility
  FROM public.fellowship_settings s
  WHERE s.id = 'default';

  INSERT INTO public.activity_logs (user_id, action, details)
  VALUES (NEW.id, 'member_registered', 'New membership registration submitted');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_create_portal_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_create_portal_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_portal_user();

REVOKE ALL ON FUNCTION public.handle_new_portal_user() FROM PUBLIC;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portal-assets',
  'portal-assets',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "portal_assets_public_read" ON storage.objects;
CREATE POLICY "portal_assets_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'portal-assets');
