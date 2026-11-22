# Setup and deployment

## Local development

```bash
npm install
npm run dev
```

The local full-stack compatibility server runs at `http://localhost:3000`. Production uses the Supabase Edge Function for `/api/*` requests.

## Production services

1. Link the Supabase project and configure the Edge Function secrets required by `portal-api`.
2. Apply the SQL files in `supabase/migrations` in version order.
3. Deploy `supabase/functions/portal-api/index.ts` with platform JWT verification disabled; the function validates bearer tokens itself because registration and sign-in are public routes.
4. Configure the Vercel frontend with its public Supabase URL and publishable/anonymous key.
5. Deploy the Vite build to Vercel.

The Supabase service-role key is server-only. Do not add it to a `VITE_*` variable, client bundle, browser storage, or public repository.

## Provisioning the first administrator

The public first-admin endpoint and UI are disabled. The first administrator must already have completed the ordinary registration flow.

Use a protected project-owner database session to perform these exact steps:

1. Locate the existing account by its normalized email address.
2. Confirm the profile name and email identify the intended fellowship administrator.
3. In one protected operation, set `profiles.membership_status` to `approved` and the matching `user_roles.role` to `admin`.
4. Add an `admin_bootstrapped` activity-log entry.
5. Verify that the account is approved, has the administrator role, and is included in the administrator count.

Example transaction for a project owner to run in the Supabase SQL Editor after replacing the email placeholder:

```sql
begin;

do $$
declare
  target_id uuid;
begin
  select id into target_id
  from public.profiles
  where lower(email) = lower('existing.member@example.com');

  if target_id is null then
    raise exception 'Existing registered member not found';
  end if;

  update public.profiles
  set membership_status = 'approved', updated_at = now()
  where id = target_id;

  update public.user_roles
  set role = 'admin'
  where user_id = target_id;

  insert into public.activity_logs (user_id, action, details)
  values (target_id, 'admin_bootstrapped', 'Existing registered account promoted by project owner');
end $$;

commit;
```

Do not create a replacement account and do not implement automatic self-promotion. Additional administrators are assigned by an existing administrator from **Membership Access**. The API and database both enforce the maximum of three administrators.

