-- Directory product hardening:
-- 1. The public app can never assign or remove roles directly.
-- 2. No more than three administrator roles may exist.
-- 3. The final approved administrator cannot be demoted, suspended, or deleted.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.enforce_admin_role_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  administrator_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO administrator_count
  FROM public.user_roles
  WHERE role = 'admin';

  IF TG_OP = 'INSERT' AND NEW.role = 'admin' AND administrator_count >= 3 THEN
    RAISE EXCEPTION 'A maximum of three administrators is allowed.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.role IS DISTINCT FROM NEW.role
     AND NEW.role = 'admin'
     AND administrator_count >= 3 THEN
    RAISE EXCEPTION 'A maximum of three administrators is allowed.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.role = 'admin'
     AND NEW.role <> 'admin'
     AND administrator_count <= 1 THEN
    RAISE EXCEPTION 'The final administrator cannot be demoted.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' AND OLD.role = 'admin' AND administrator_count <= 1 THEN
    RAISE EXCEPTION 'The final administrator cannot be deleted.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_admin_role_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_admin_role_limit ON public.user_roles;
CREATE TRIGGER enforce_admin_role_limit
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION private.enforce_admin_role_limit();

CREATE OR REPLACE FUNCTION private.protect_final_approved_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  approved_administrator_count INTEGER;
  affected_user_id UUID;
  removes_approval BOOLEAN;
BEGIN
  affected_user_id := OLD.id;
  removes_approval := TG_OP = 'DELETE'
    OR (
      TG_OP = 'UPDATE'
      AND OLD.membership_status = 'approved'
      AND NEW.membership_status <> 'approved'
    );

  IF removes_approval
     AND EXISTS (
       SELECT 1
       FROM public.user_roles
       WHERE user_id = affected_user_id AND role = 'admin'
     ) THEN
    SELECT COUNT(*)::INTEGER
    INTO approved_administrator_count
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'admin'
      AND p.membership_status = 'approved';

    IF approved_administrator_count <= 1 THEN
      RAISE EXCEPTION 'The final approved administrator cannot be suspended, rejected, or deleted.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.protect_final_approved_admin() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_final_approved_admin ON public.profiles;
CREATE TRIGGER protect_final_approved_admin
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.protect_final_approved_admin();

-- All privileged changes flow through the authenticated Edge Function, which
-- validates the caller before using the server-only service role.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_roles FROM anon, authenticated;
