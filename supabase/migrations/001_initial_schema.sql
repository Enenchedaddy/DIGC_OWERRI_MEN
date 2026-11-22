-- DUNAMIS INTERNATIONAL GOSPEL CENTRE, OWERRI — Men's Fellowship Portal
-- PostgreSQL / Supabase Migration & RLS Policies
-- Matches the normalized schema implemented in the Express/SQLite runtime.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone_number TEXT NOT NULL,
  profile_image TEXT,
  date_of_birth DATE,
  gender TEXT DEFAULT 'Male',
  country TEXT DEFAULT 'Nigeria',
  state TEXT DEFAULT 'Imo State',
  city TEXT DEFAULT 'Owerri',
  lga TEXT,
  street_address TEXT,
  residential_location TEXT,
  occupation TEXT,
  workplace TEXT,
  professional_designation TEXT,
  skills TEXT,
  membership_category TEXT DEFAULT 'General Member',
  date_of_joining DATE,
  fellowship_responsibilities TEXT,
  biography TEXT,
  membership_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (membership_status IN ('pending', 'approved', 'rejected', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. User Roles (separate from profiles to prevent privilege escalation)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Profile Privacy Preferences
CREATE TABLE IF NOT EXISTS public.profile_privacy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_visibility TEXT NOT NULL DEFAULT 'members' CHECK (phone_visibility IN ('members', 'admins_only', 'private')),
  email_visibility TEXT NOT NULL DEFAULT 'members' CHECK (email_visibility IN ('members', 'admins_only', 'private')),
  workplace_visibility TEXT NOT NULL DEFAULT 'members' CHECK (workplace_visibility IN ('members', 'admins_only', 'private')),
  birthday_visibility TEXT NOT NULL DEFAULT 'day_month' CHECK (birthday_visibility IN ('day_month', 'full_date', 'admins_only', 'private')),
  location_visibility TEXT NOT NULL DEFAULT 'members' CHECK (location_visibility IN ('members', 'admins_only', 'private')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Announcement Reads
CREATE TABLE IF NOT EXISTS public.announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (announcement_id, user_id)
);

-- 6. Activity Logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Fellowship Settings
CREATE TABLE IF NOT EXISTS public.fellowship_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  fellowship_name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  logo_url TEXT,
  description TEXT NOT NULL,
  meeting_schedule TEXT NOT NULL,
  meeting_location TEXT NOT NULL,
  default_phone_visibility TEXT NOT NULL DEFAULT 'members',
  default_email_visibility TEXT NOT NULL DEFAULT 'members',
  default_workplace_visibility TEXT NOT NULL DEFAULT 'members',
  default_birthday_visibility TEXT NOT NULL DEFAULT 'day_month',
  default_location_visibility TEXT NOT NULL DEFAULT 'members',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(membership_status);
CREATE INDEX IF NOT EXISTS idx_profiles_name ON public.profiles(full_name);
CREATE INDEX IF NOT EXISTS idx_announcements_status_pinned ON public.announcements(status, is_pinned, created_at DESC);

-- Helper Security Functions
CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
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
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid AND p.membership_status = 'approved'
  );
$$;

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_privacy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fellowship_settings ENABLE ROW LEVEL SECURITY;

-- Profiles RLS
CREATE POLICY "profiles_select_self_or_approved" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id
    OR public.is_admin(auth.uid())
    OR (public.is_approved_member(auth.uid()) AND membership_status = 'approved')
  );

CREATE POLICY "profiles_update_self_safe" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND membership_status = (SELECT membership_status FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL USING (public.is_admin(auth.uid()));

-- User Roles RLS (read self, admin-only write)
CREATE POLICY "roles_select_self_or_admin" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "roles_admin_manage" ON public.user_roles
  FOR ALL USING (public.is_admin(auth.uid()));

-- Privacy RLS
CREATE POLICY "privacy_self_or_admin" ON public.profile_privacy
  FOR ALL USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Announcements RLS
CREATE POLICY "announcements_approved_read_published" ON public.announcements
  FOR SELECT USING (
    (status = 'published' AND public.is_approved_member(auth.uid()))
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "announcements_admin_manage" ON public.announcements
  FOR ALL USING (public.is_admin(auth.uid()));

-- Announcement Reads RLS
CREATE POLICY "announcement_reads_self" ON public.announcement_reads
  FOR ALL USING (auth.uid() = user_id);

-- Activity Logs RLS
CREATE POLICY "activity_logs_admin_read" ON public.activity_logs
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Fellowship Settings RLS
CREATE POLICY "settings_public_read" ON public.fellowship_settings
  FOR SELECT USING (TRUE);

CREATE POLICY "settings_admin_write" ON public.fellowship_settings
  FOR ALL USING (public.is_admin(auth.uid()));

-- Privacy-filtered member directory view for Supabase clients
CREATE OR REPLACE VIEW public.directory_members AS
SELECT
  p.id,
  p.full_name,
  CASE
    WHEN auth.uid() = p.id OR public.is_admin(auth.uid()) OR pp.email_visibility = 'members'
    THEN p.email ELSE NULL
  END AS email,
  CASE
    WHEN auth.uid() = p.id OR public.is_admin(auth.uid()) OR pp.phone_visibility = 'members'
    THEN p.phone_number ELSE NULL
  END AS phone_number,
  p.profile_image,
  CASE
    WHEN auth.uid() = p.id OR public.is_admin(auth.uid()) OR pp.birthday_visibility = 'full_date'
    THEN p.date_of_birth ELSE NULL
  END AS date_of_birth,
  CASE
    WHEN auth.uid() = p.id OR public.is_admin(auth.uid()) OR pp.birthday_visibility IN ('day_month', 'full_date')
    THEN TO_CHAR(p.date_of_birth, 'MM-DD') ELSE NULL
  END AS birth_month_day,
  CASE
    WHEN auth.uid() = p.id OR public.is_admin(auth.uid()) OR pp.location_visibility = 'members'
    THEN p.country ELSE NULL
  END AS country,
  CASE
    WHEN auth.uid() = p.id OR public.is_admin(auth.uid()) OR pp.location_visibility = 'members'
    THEN p.state ELSE NULL
  END AS state,
  CASE
    WHEN auth.uid() = p.id OR public.is_admin(auth.uid()) OR pp.location_visibility = 'members'
    THEN p.city ELSE NULL
  END AS city,
  CASE
    WHEN auth.uid() = p.id OR public.is_admin(auth.uid()) OR pp.location_visibility = 'members'
    THEN p.lga ELSE NULL
  END AS lga,
  CASE
    WHEN auth.uid() = p.id OR public.is_admin(auth.uid()) OR pp.location_visibility = 'members'
    THEN p.street_address ELSE NULL
  END AS street_address,
  CASE
    WHEN auth.uid() = p.id OR public.is_admin(auth.uid()) OR pp.location_visibility = 'members'
    THEN p.residential_location ELSE NULL
  END AS residential_location,
  p.occupation,
  CASE
    WHEN auth.uid() = p.id OR public.is_admin(auth.uid()) OR pp.workplace_visibility = 'members'
    THEN p.workplace ELSE NULL
  END AS workplace,
  p.professional_designation,
  p.skills,
  p.membership_category,
  p.date_of_joining,
  p.fellowship_responsibilities,
  p.biography,
  p.membership_status
FROM public.profiles p
JOIN public.profile_privacy pp ON pp.user_id = p.id
WHERE p.membership_status = 'approved';
