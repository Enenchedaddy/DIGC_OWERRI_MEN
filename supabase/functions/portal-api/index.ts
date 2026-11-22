import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const defaultLogo = '/src/assets/images/dunamis_owerri_logo_1795268208018.jpg';
const assetBucket = 'portal-assets';

type PortalUser = {
  id: string;
  email: string;
  role: 'admin' | 'member';
  membership_status: 'pending' | 'approved' | 'rejected' | 'suspended';
  profile: Record<string, any>;
};

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function fail(req: Request, message: string, status = 400) {
  return json(req, { error: message }, status);
}

function clean(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function nullable(value: unknown, max = 1000) {
  const result = clean(value, max);
  return result || null;
}

function emailIsValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function phoneIsValid(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function normalizePhone(phone: string) {
  const value = phone.replace(/[\s()-]/g, '');
  if (/^0\d{10}$/.test(value)) return `+234${value.slice(1)}`;
  return value.startsWith('+') ? value : `+${value}`;
}

function apiPath(url: URL) {
  const marker = '/portal-api';
  const index = url.pathname.indexOf(marker);
  return index >= 0 ? url.pathname.slice(index + marker.length) || '/' : url.pathname;
}

async function readBody(req: Request): Promise<Record<string, any>> {
  const type = req.headers.get('content-type') || '';
  if (type.includes('multipart/form-data')) {
    const form = await req.formData();
    return Object.fromEntries(form.entries());
  }
  if (!type.includes('application/json')) return {};
  return await req.json();
}

function newAnonClient() {
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function getSettings() {
  const { data, error } = await service
    .from('fellowship_settings')
    .select('*')
    .eq('id', 'default')
    .single();
  if (error) throw error;
  return data;
}

async function getRole(userId: string): Promise<'admin' | 'member'> {
  const { data } = await service.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
  return data?.role === 'admin' ? 'admin' : 'member';
}

async function authenticate(
  req: Request,
  requirement: 'any' | 'approved' | 'admin' = 'any',
): Promise<PortalUser | Response> {
  const auth = req.headers.get('authorization') || '';
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return fail(req, 'Authentication required.', 401);

  const { data: userData, error: userError } = await service.auth.getUser(token);
  if (userError || !userData.user) return fail(req, 'Your session has expired. Please sign in again.', 401);

  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (profileError || !profile) return fail(req, 'Profile record not found.', 404);

  const role = await getRole(userData.user.id);
  if (requirement === 'approved' && profile.membership_status !== 'approved' && role !== 'admin') {
    return fail(req, 'Your membership is still awaiting administrator approval.', 403);
  }
  if (requirement === 'admin' && (role !== 'admin' || profile.membership_status !== 'approved')) {
    return fail(req, 'Administrator access is required.', 403);
  }

  return {
    id: userData.user.id,
    email: userData.user.email || profile.email,
    role,
    membership_status: profile.membership_status,
    profile,
  };
}

async function logActivity(userId: string | null, action: string, details?: string) {
  await service.from('activity_logs').insert({ user_id: userId, action, details: details || null });
}

async function uploadImage(file: File, folder: string, ownerId: string) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Only JPEG, PNG, and WebP images are allowed.');
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('Image size must not exceed 5 MB.');
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const objectPath = `${folder}/${ownerId}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await service.storage.from(assetBucket).upload(objectPath, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return service.storage.from(assetBucket).getPublicUrl(objectPath).data.publicUrl;
}

async function getRolesMap(userIds: string[]) {
  const result = new Map<string, 'admin' | 'member'>();
  if (!userIds.length) return result;
  const { data } = await service.from('user_roles').select('user_id,role').in('user_id', userIds);
  for (const row of data || []) result.set(row.user_id, row.role === 'admin' ? 'admin' : 'member');
  return result;
}

async function getPrivacyMap(userIds: string[]) {
  const result = new Map<string, Record<string, any>>();
  if (!userIds.length) return result;
  const { data } = await service.from('profile_privacy').select('*').in('user_id', userIds);
  for (const row of data || []) result.set(row.user_id, row);
  return result;
}

function memberForViewer(
  profile: Record<string, any>,
  privacy: Record<string, any> | undefined,
  role: 'admin' | 'member',
  viewer: PortalUser,
) {
  const own = profile.id === viewer.id;
  const admin = viewer.role === 'admin';
  const visible = (field: string) => own || admin || privacy?.[field] === 'members';
  const birthdayMode = own || admin ? 'full_date' : privacy?.birthday_visibility || 'private';
  const birthdayVisible = birthdayMode === 'full_date';
  const birthMonthDay = profile.date_of_birth && birthdayMode !== 'private' && birthdayMode !== 'admins_only'
    ? String(profile.date_of_birth).slice(5, 10)
    : null;

  return {
    ...profile,
    role,
    email: visible('email_visibility') ? profile.email : null,
    phone_number: visible('phone_visibility') ? profile.phone_number : null,
    workplace: visible('workplace_visibility') ? profile.workplace : null,
    country: visible('location_visibility') ? profile.country : null,
    state: visible('location_visibility') ? profile.state : null,
    city: visible('location_visibility') ? profile.city : null,
    lga: visible('location_visibility') ? profile.lga : null,
    street_address: visible('location_visibility') ? profile.street_address : null,
    residential_location: visible('location_visibility') ? profile.residential_location : null,
    date_of_birth: birthdayVisible ? profile.date_of_birth : null,
    birth_month_day: birthMonthDay,
    privacy_summary: {
      phone_visible: visible('phone_visibility'),
      email_visible: visible('email_visibility'),
      workplace_visible: visible('workplace_visibility'),
      location_visible: visible('location_visibility'),
      birthday_mode: birthdayMode,
    },
  };
}

async function getDirectory(viewer: PortalUser) {
  const { data: profiles, error } = await service
    .from('profiles')
    .select('*')
    .eq('membership_status', 'approved')
    .order('full_name');
  if (error) throw error;
  const ids = (profiles || []).map((p) => p.id);
  const [roles, privacy] = await Promise.all([getRolesMap(ids), getPrivacyMap(ids)]);
  return (profiles || []).map((profile) =>
    memberForViewer(profile, privacy.get(profile.id), roles.get(profile.id) || 'member', viewer)
  );
}

function birthdayRows(members: Record<string, any>[], viewer: PortalUser, limit?: number) {
  const today = new Date();
  const year = today.getUTCFullYear();
  const start = Date.UTC(year, today.getUTCMonth(), today.getUTCDate());
  const rows = members.flatMap((member) => {
    const raw = member.date_of_birth || member.birth_month_day;
    if (!raw) return [];
    const mmdd = String(raw).length >= 10 ? String(raw).slice(5, 10) : String(raw);
    const [month, day] = mmdd.split('-').map(Number);
    if (!month || !day) return [];
    let next = Date.UTC(year, month - 1, day);
    if (next < start) next = Date.UTC(year + 1, month - 1, day);
    const daysUntil = Math.round((next - start) / 86400000);
    const birthYear = member.date_of_birth ? Number(String(member.date_of_birth).slice(0, 4)) : null;
    return [{
      id: member.id,
      full_name: member.full_name,
      profile_image: member.profile_image,
      occupation: member.occupation,
      birth_month_day: mmdd,
      date_of_birth: member.date_of_birth,
      days_until: daysUntil,
      turning_age: birthYear && (viewer.role === 'admin' || member.id === viewer.id)
        ? new Date(next).getUTCFullYear() - birthYear
        : null,
    }];
  }).sort((a, b) => a.days_until - b.days_until);
  return typeof limit === 'number' ? rows.slice(0, limit) : rows;
}

async function announcementRows(userId?: string, includeDrafts = false) {
  let query = service.from('announcements').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
  if (!includeDrafts) query = query.eq('status', 'published');
  const { data: announcements, error } = await query;
  if (error) throw error;
  const authorIds = [...new Set((announcements || []).map((a) => a.created_by))];
  const { data: authors } = authorIds.length
    ? await service.from('profiles').select('id,full_name').in('id', authorIds)
    : { data: [] as any[] };
  const names = new Map((authors || []).map((p) => [p.id, p.full_name]));
  let readIds = new Set<string>();
  if (userId) {
    const { data: reads } = await service.from('announcement_reads').select('announcement_id').eq('user_id', userId);
    readIds = new Set((reads || []).map((r) => r.announcement_id));
  }
  return (announcements || []).map((row) => ({
    ...row,
    is_pinned: row.is_pinned ? 1 : 0,
    is_read: readIds.has(row.id) ? 1 : 0,
    author_name: names.get(row.created_by) || 'Fellowship Administrator',
  }));
}

async function authResponse(req: Request, session: any, status = 200) {
  if (!session?.access_token) return fail(req, 'Unable to create an authenticated session.', 500);
  const { data: profile } = await service.from('profiles').select('*').eq('id', session.user.id).single();
  const role = await getRole(session.user.id);
  return json(req, {
    token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: {
      id: session.user.id,
      email: session.user.email,
      full_name: profile?.full_name || session.user.email,
      role,
      membership_status: profile?.membership_status || 'pending',
    },
  }, status);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  const url = new URL(req.url);
  const path = apiPath(url);

  try {
    if (req.method === 'GET' && path === '/api/health') {
      const { error } = await service.from('fellowship_settings').select('id').limit(1);
      return error ? fail(req, 'Database unavailable.', 503) : json(req, { status: 'ok', database: 'ok' });
    }

    if (req.method === 'GET' && path === '/api/public/info') {
      const [settings, admins] = await Promise.all([
        getSettings(),
        service.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
      ]);
      return json(req, {
        fellowship_name: settings.fellowship_name,
        tagline: settings.tagline,
        logo_url: settings.logo_url || defaultLogo,
        description: settings.description,
        meeting_schedule: settings.meeting_schedule,
        meeting_location: settings.meeting_location,
        official_domain: 'digcowerri.com',
        needs_admin_setup: (admins.count || 0) === 0,
        requires_bootstrap_passcode: false,
      });
    }

    if (req.method === 'POST' && path === '/api/auth/register') {
      const body = await readBody(req);
      const fullName = clean(body.full_name, 120);
      const email = clean(body.email, 160).toLowerCase();
      const rawPhone = clean(body.phone_number, 40);
      const password = typeof body.password === 'string' ? body.password : '';
      const dob = clean(body.date_of_birth, 20);
      const occupation = clean(body.occupation, 120);
      const location = clean(body.residential_location, 200) || [
        clean(body.street_address, 160), clean(body.lga, 80), clean(body.city, 80),
        clean(body.state, 80), clean(body.country, 80),
      ].filter(Boolean).join(', ');

      if (fullName.length < 2) return fail(req, 'Full name is required.');
      if (!emailIsValid(email)) return fail(req, 'Please enter a valid email address.');
      if (!phoneIsValid(rawPhone)) return fail(req, 'Please enter a valid Nigerian or international phone number.');
      if (password.length < 8) return fail(req, 'Password must be at least 8 characters.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return fail(req, 'Please provide a valid date of birth.');
      if (!location || !occupation) return fail(req, 'Residential address and occupation are required.');

      const metadata = {
        full_name: fullName,
        phone_number: normalizePhone(rawPhone),
        date_of_birth: dob,
        gender: clean(body.gender, 30) || 'Male',
        country: clean(body.country, 80) || 'Nigeria',
        state: clean(body.state, 80) || 'Imo State',
        city: clean(body.city, 80) || 'Owerri',
        lga: clean(body.lga, 80),
        street_address: clean(body.street_address, 160),
        residential_location: location,
        occupation,
        workplace: clean(body.workplace, 160),
        professional_designation: clean(body.professional_designation, 120),
        skills: clean(body.skills, 300),
        membership_category: clean(body.membership_category, 80) || 'General Member',
        date_of_joining: clean(body.date_of_joining, 20) || new Date().toISOString().slice(0, 10),
        fellowship_responsibilities: clean(body.fellowship_responsibilities, 200),
        biography: clean(body.biography, 1000),
      };

      const { data: created, error: createError } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (createError || !created.user) {
        const duplicate = /already|registered|exists/i.test(createError?.message || '');
        return fail(req, duplicate
          ? 'An account with this email address is already registered. Please sign in or reset your password.'
          : createError?.message || 'Unable to create your account.', duplicate ? 409 : 400);
      }

      try {
        if (body.profile_photo instanceof File && body.profile_photo.size > 0) {
          const imageUrl = await uploadImage(body.profile_photo, 'profiles', created.user.id);
          const { error } = await service.from('profiles').update({ profile_image: imageUrl }).eq('id', created.user.id);
          if (error) throw error;
        }
        const anon = newAnonClient();
        const { data: signedIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        const response = await authResponse(req, signedIn.session, 201);
        return response;
      } catch (error) {
        await service.auth.admin.deleteUser(created.user.id);
        return fail(req, error instanceof Error ? error.message : 'Unable to complete registration.', 400);
      }
    }

    if (req.method === 'POST' && path === '/api/auth/bootstrap-admin') {
      return fail(
        req,
        'Administrator initialization is available only through a protected project-owner operation on an existing account.',
        403,
      );
    }

    if (req.method === 'POST' && path === '/api/auth/login') {
      const body = await readBody(req);
      const email = clean(body.email, 160).toLowerCase();
      const password = typeof body.password === 'string' ? body.password : '';
      if (!email || !password) return fail(req, 'Email address and password are required.');
      const anon = newAnonClient();
      const { data, error } = await anon.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        return fail(req, 'Incorrect email address or password. Please check your credentials or reset your password.', 401);
      }
      await logActivity(data.user.id, 'user_signed_in');
      return await authResponse(req, data.session);
    }

    if (req.method === 'POST' && path === '/api/auth/logout') {
      const user = await authenticate(req);
      if (!(user instanceof Response)) await logActivity(user.id, 'user_signed_out');
      return json(req, { ok: true });
    }

    if (req.method === 'POST' && path === '/api/auth/forgot-password') {
      const body = await readBody(req);
      const email = clean(body.email, 160).toLowerCase();
      if (!emailIsValid(email)) return fail(req, 'Please enter a valid email address.');
      const origin = req.headers.get('origin') || 'https://digcowerri.com';
      const anon = newAnonClient();
      await anon.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset-password` });
      return json(req, {
        email_configured: true,
        email_dispatched: true,
        message: 'If an account exists for that email address, password reset instructions have been sent. Check your inbox and spam folder.',
      });
    }

    if (req.method === 'POST' && path === '/api/auth/reset-password') {
      const body = await readBody(req);
      const token = clean(body.token, 4096);
      const password = typeof body.new_password === 'string' ? body.new_password : '';
      if (!token || password.length < 8) return fail(req, 'A valid reset token and password (minimum 8 characters) are required.');
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))))
        .map((b) => b.toString(16).padStart(2, '0')).join('');
      const { data: reset } = await service.from('password_resets').select('*').eq('token_hash', digest).is('used_at', null).maybeSingle();
      if (reset && new Date(reset.expires_at).getTime() >= Date.now()) {
        const { error } = await service.auth.admin.updateUserById(reset.user_id, { password });
        if (error) return fail(req, error.message, 400);
        await service.from('password_resets').update({ used_at: new Date().toISOString() }).eq('id', reset.id);
        await logActivity(reset.user_id, 'password_reset_completed');
        return json(req, { message: 'Your password has been updated. You may now sign in with your new password.' });
      }
      const { data: tokenUser } = await service.auth.getUser(token);
      if (!tokenUser.user) return fail(req, 'Reset token is invalid or has expired.');
      const { error } = await service.auth.admin.updateUserById(tokenUser.user.id, { password });
      if (error) return fail(req, error.message, 400);
      return json(req, { message: 'Your password has been updated. You may now sign in with your new password.' });
    }

    if (req.method === 'GET' && path === '/api/auth/me') {
      const user = await authenticate(req);
      if (user instanceof Response) return user;
      const [privacyResult, settings] = await Promise.all([
        service.from('profile_privacy').select('phone_visibility,email_visibility,workplace_visibility,birthday_visibility,location_visibility').eq('user_id', user.id).single(),
        getSettings(),
      ]);
      return json(req, {
        profile: { ...user.profile, role: user.role },
        privacy: privacyResult.data,
        fellowship: {
          fellowship_name: settings.fellowship_name,
          tagline: settings.tagline,
          logo_url: settings.logo_url || defaultLogo,
          meeting_schedule: settings.meeting_schedule,
          meeting_location: settings.meeting_location,
        },
      });
    }

    if (req.method === 'GET' && path === '/api/dashboard') {
      const user = await authenticate(req, 'approved');
      if (user instanceof Response) return user;
      const [members, announcements, settings] = await Promise.all([
        getDirectory(user), announcementRows(user.id), getSettings(),
      ]);
      const upcoming = birthdayRows(members, user, 6).filter((b) => b.days_until <= 60);
      return json(req, {
        stats: {
          total_approved: members.length,
          distinct_occupations: new Set(members.map((m) => m.occupation).filter(Boolean)).size,
          unread_announcements: announcements.filter((a) => !a.is_read).length,
          upcoming_birthdays_count: upcoming.length,
        },
        recent_announcements: announcements.slice(0, 4),
        upcoming_birthdays: upcoming,
        fellowship: {
          fellowship_name: settings.fellowship_name,
          meeting_schedule: settings.meeting_schedule,
          meeting_location: settings.meeting_location,
          description: settings.description,
        },
      });
    }

    if (req.method === 'GET' && path === '/api/members') {
      const user = await authenticate(req, 'approved');
      if (user instanceof Response) return user;
      const allMembers = await getDirectory(user);
      const search = clean(url.searchParams.get('search'), 120).toLowerCase();
      const occupation = clean(url.searchParams.get('occupation'), 120);
      const category = clean(url.searchParams.get('category'), 120);
      const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
      const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 12));
      const filtered = allMembers.filter((m) => {
        const haystack = `${m.full_name} ${m.occupation || ''} ${m.skills || ''} ${m.membership_category || ''}`.toLowerCase();
        return (!search || haystack.includes(search)) && (!occupation || m.occupation === occupation) && (!category || m.membership_category === category);
      });
      return json(req, {
        members: filtered.slice((page - 1) * limit, page * limit),
        pagination: { page, limit, total: filtered.length, total_pages: Math.max(1, Math.ceil(filtered.length / limit)) },
        filters: {
          occupations: [...new Set(allMembers.map((m) => m.occupation).filter(Boolean))].sort(),
          categories: [...new Set(allMembers.map((m) => m.membership_category).filter(Boolean))].sort(),
        },
      });
    }

    const memberMatch = path.match(/^\/api\/members\/([0-9a-f-]+)$/i);
    if (req.method === 'GET' && memberMatch) {
      const user = await authenticate(req, 'approved');
      if (user instanceof Response) return user;
      const member = (await getDirectory(user)).find((m) => m.id === memberMatch[1]);
      return member ? json(req, { member }) : fail(req, 'Member record not found.', 404);
    }

    if (req.method === 'GET' && path === '/api/birthdays') {
      const user = await authenticate(req, 'approved');
      if (user instanceof Response) return user;
      const birthdays = birthdayRows(await getDirectory(user), user).filter((b) => b.days_until <= 90);
      return json(req, { birthdays });
    }

    if (req.method === 'GET' && path === '/api/announcements') {
      const user = await authenticate(req, 'approved');
      if (user instanceof Response) return user;
      return json(req, { announcements: await announcementRows(user.id) });
    }

    const readMatch = path.match(/^\/api\/announcements\/([0-9a-f-]+)\/read$/i);
    if (req.method === 'POST' && readMatch) {
      const user = await authenticate(req, 'approved');
      if (user instanceof Response) return user;
      await service.from('announcement_reads').upsert({ announcement_id: readMatch[1], user_id: user.id }, { onConflict: 'announcement_id,user_id' });
      return json(req, { ok: true });
    }

    if (req.method === 'PATCH' && path === '/api/profile') {
      const user = await authenticate(req);
      if (user instanceof Response) return user;
      const body = await readBody(req);
      const fields = ['full_name','phone_number','date_of_birth','gender','country','state','city','lga','street_address','residential_location','occupation','workplace','professional_designation','skills','membership_category','date_of_joining','fellowship_responsibilities','biography'];
      const update: Record<string, any> = { updated_at: new Date().toISOString() };
      for (const field of fields) if (field in body) update[field] = nullable(body[field], field === 'biography' ? 1000 : 300);
      if (body.full_name && clean(body.full_name, 120).length < 2) return fail(req, 'Full name is required.');
      if (body.phone_number && !phoneIsValid(clean(body.phone_number, 40))) return fail(req, 'Please enter a valid phone number.');
      const { error } = await service.from('profiles').update(update).eq('id', user.id);
      if (error) return fail(req, error.message, 400);
      await logActivity(user.id, 'profile_updated');
      return json(req, { ok: true });
    }

    if (req.method === 'POST' && path === '/api/profile/photo') {
      const user = await authenticate(req);
      if (user instanceof Response) return user;
      const body = await readBody(req);
      if (!(body.photo instanceof File)) return fail(req, 'Select a profile photograph to upload.');
      const imageUrl = await uploadImage(body.photo, 'profiles', user.id);
      await service.from('profiles').update({ profile_image: imageUrl, updated_at: new Date().toISOString() }).eq('id', user.id);
      await logActivity(user.id, 'profile_photo_updated');
      return json(req, { profile_image: imageUrl });
    }

    if (req.method === 'PATCH' && path === '/api/profile/privacy') {
      const user = await authenticate(req);
      if (user instanceof Response) return user;
      const body = await readBody(req);
      const allowed = {
        phone_visibility: ['members','admins_only','private'],
        email_visibility: ['members','admins_only','private'],
        workplace_visibility: ['members','admins_only','private'],
        birthday_visibility: ['day_month','full_date','admins_only','private'],
        location_visibility: ['members','admins_only','private'],
      } as Record<string, string[]>;
      const update: Record<string, any> = { updated_at: new Date().toISOString() };
      for (const [field, values] of Object.entries(allowed)) {
        if (values.includes(body[field])) update[field] = body[field];
      }
      const { error } = await service.from('profile_privacy').update(update).eq('user_id', user.id);
      if (error) return fail(req, error.message, 400);
      return json(req, { ok: true });
    }

    if (req.method === 'PATCH' && path === '/api/account/password') {
      const user = await authenticate(req);
      if (user instanceof Response) return user;
      const body = await readBody(req);
      const current = typeof body.current_password === 'string' ? body.current_password : '';
      const next = typeof body.new_password === 'string' ? body.new_password : '';
      if (next.length < 8) return fail(req, 'New password must be at least 8 characters.');
      const anon = newAnonClient();
      const verified = await anon.auth.signInWithPassword({ email: user.email, password: current });
      if (verified.error) return fail(req, 'Current password is incorrect.', 401);
      const { error } = await service.auth.admin.updateUserById(user.id, { password: next });
      if (error) return fail(req, error.message, 400);
      await logActivity(user.id, 'password_changed');
      return json(req, { ok: true });
    }

    if (req.method === 'GET' && path === '/api/admin/overview') {
      const user = await authenticate(req, 'admin');
      if (user instanceof Response) return user;
      const [{ data: profiles }, announcements, { data: activities }] = await Promise.all([
        service.from('profiles').select('*').order('created_at', { ascending: false }),
        announcementRows(user.id, true),
        service.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(12),
      ]);
      const list = profiles || [];
      const ids = list.map((p) => p.id);
      const roles = await getRolesMap(ids);
      const actorIds = [...new Set((activities || []).map((a) => a.user_id).filter(Boolean))];
      const { data: actors } = actorIds.length ? await service.from('profiles').select('id,full_name').in('id', actorIds) : { data: [] as any[] };
      const actorMap = new Map((actors || []).map((a) => [a.id, a.full_name]));
      const approvedDirectory = await getDirectory(user);
      return json(req, {
        counts: {
          total_members: list.length,
          approved_members: list.filter((p) => p.membership_status === 'approved').length,
          pending_members: list.filter((p) => p.membership_status === 'pending').length,
          suspended_members: list.filter((p) => p.membership_status === 'suspended').length,
          rejected_members: list.filter((p) => p.membership_status === 'rejected').length,
        },
        recent_registrations: list.slice(0, 8).map((p) => ({ ...p, role: roles.get(p.id) || 'member' })),
        recent_announcements: announcements.slice(0, 5),
        recent_activity: (activities || []).map((a) => ({ ...a, actor_name: actorMap.get(a.user_id) || null })),
        upcoming_birthdays: birthdayRows(approvedDirectory, user, 6),
      });
    }

    if (req.method === 'GET' && path === '/api/admin/members') {
      const user = await authenticate(req, 'admin');
      if (user instanceof Response) return user;
      const [{ data: profiles, error }, roles, privacy] = await Promise.all([
        service.from('profiles').select('*').order('created_at', { ascending: false }),
        service.from('user_roles').select('user_id,role'),
        service
          .from('profile_privacy')
          .select('user_id,phone_visibility,email_visibility,workplace_visibility,birthday_visibility,location_visibility'),
      ]);
      if (error) return fail(req, error.message, 500);
      const roleMap = new Map((roles.data || []).map((r) => [r.user_id, r.role]));
      const privacyMap = new Map((privacy.data || []).map((p) => [p.user_id, p]));
      const search = clean(url.searchParams.get('search'), 120).toLowerCase();
      const status = clean(url.searchParams.get('status'), 30);
      const role = clean(url.searchParams.get('role'), 30);
      const members = (profiles || []).map((p) => ({ ...p, role: roleMap.get(p.id) || 'member', ...privacyMap.get(p.id) }))
        .filter((p) => (!search || `${p.full_name} ${p.email} ${p.occupation || ''}`.toLowerCase().includes(search)) && (!status || status === 'all' || p.membership_status === status) && (!role || role === 'all' || p.role === role));
      const allProfiles = profiles || [];
      return json(req, {
        members,
        summary: {
          total: allProfiles.length,
          pending: allProfiles.filter((p) => p.membership_status === 'pending').length,
          approved: allProfiles.filter((p) => p.membership_status === 'approved').length,
          suspended: allProfiles.filter((p) => p.membership_status === 'suspended').length,
          admins: [...roleMap.values()].filter((value) => value === 'admin').length,
          admin_limit: 3,
        },
      });
    }

    const statusMatch = path.match(/^\/api\/admin\/members\/([0-9a-f-]+)\/status$/i);
    if (req.method === 'PATCH' && statusMatch) {
      const admin = await authenticate(req, 'admin');
      if (admin instanceof Response) return admin;
      const body = await readBody(req);
      const status = clean(body.membership_status, 30);
      if (!['pending','approved','rejected','suspended'].includes(status)) return fail(req, 'Invalid membership status.');
      if (statusMatch[1] === admin.id && status !== 'approved') return fail(req, 'You cannot remove your own approved access.', 409);
      const [{ data: targetRole }, { count: approvedAdminCount }] = await Promise.all([
        service.from('user_roles').select('role').eq('user_id', statusMatch[1]).maybeSingle(),
        service.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'admin'),
      ]);
      if (targetRole?.role === 'admin' && status !== 'approved' && (approvedAdminCount || 0) <= 1) {
        return fail(req, 'The final administrator must remain approved and active.', 409);
      }
      const { error } = await service.from('profiles').update({ membership_status: status, updated_at: new Date().toISOString() }).eq('id', statusMatch[1]);
      if (error) return fail(req, error.message, 400);
      await logActivity(admin.id, 'member_status_changed', `${statusMatch[1]} → ${status}`);
      return json(req, { ok: true });
    }

    const roleMatch = path.match(/^\/api\/admin\/members\/([0-9a-f-]+)\/role$/i);
    if (req.method === 'PATCH' && roleMatch) {
      const admin = await authenticate(req, 'admin');
      if (admin instanceof Response) return admin;
      const body = await readBody(req);
      const role = clean(body.role, 20);
      if (!['admin','member'].includes(role)) return fail(req, 'Invalid user role.');
      const [{ data: currentRole }, { count: adminCount }] = await Promise.all([
        service.from('user_roles').select('role').eq('user_id', roleMatch[1]).maybeSingle(),
        service.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
      ]);
      if (currentRole?.role === 'admin' && role === 'member' && (adminCount || 0) <= 1) {
        return fail(req, 'The final administrator cannot be demoted.', 409);
      }
      if (role === 'admin') {
        if (currentRole?.role !== 'admin' && (adminCount || 0) >= 3) {
          return fail(req, 'All three administrator positions are already assigned.', 409);
        }
        const { data: target } = await service.from('profiles').select('membership_status').eq('id', roleMatch[1]).single();
        if (target?.membership_status !== 'approved') return fail(req, 'Approve the member before granting administrator access.', 409);
      }
      const { error } = await service.from('user_roles').update({ role }).eq('user_id', roleMatch[1]);
      if (error) return fail(req, error.message, 400);
      await logActivity(admin.id, 'member_role_changed', `${roleMatch[1]} → ${role}`);
      return json(req, { ok: true });
    }

    const resetMatch = path.match(/^\/api\/admin\/members\/([0-9a-f-]+)\/reset-token$/i);
    if (req.method === 'POST' && resetMatch) {
      const admin = await authenticate(req, 'admin');
      if (admin instanceof Response) return admin;
      const raw = Array.from(crypto.getRandomValues(new Uint8Array(24))).map((b) => b.toString(16).padStart(2, '0')).join('');
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))))
        .map((b) => b.toString(16).padStart(2, '0')).join('');
      const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { error } = await service.from('password_resets').insert({ user_id: resetMatch[1], token_hash: hash, expires_at: expires });
      if (error) return fail(req, error.message, 400);
      await logActivity(admin.id, 'password_reset_token_issued', resetMatch[1]);
      return json(req, { reset_token: raw, expires_at: expires });
    }

    const adminMemberMatch = path.match(/^\/api\/admin\/members\/([0-9a-f-]+)$/i);
    if (req.method === 'PATCH' && adminMemberMatch) {
      const admin = await authenticate(req, 'admin');
      if (admin instanceof Response) return admin;
      const body = await readBody(req);
      const fields = ['full_name','phone_number','date_of_birth','gender','country','state','city','lga','street_address','residential_location','occupation','workplace','professional_designation','skills','membership_category','date_of_joining','fellowship_responsibilities','biography'];
      const update: Record<string, any> = { updated_at: new Date().toISOString() };
      for (const field of fields) if (field in body) update[field] = nullable(body[field], field === 'biography' ? 1000 : 300);
      const { error } = await service.from('profiles').update(update).eq('id', adminMemberMatch[1]);
      if (error) return fail(req, error.message, 400);
      if (body.privacy && typeof body.privacy === 'object') {
        await service.from('profile_privacy').update({ ...body.privacy, updated_at: new Date().toISOString() }).eq('user_id', adminMemberMatch[1]);
      }
      await logActivity(admin.id, 'member_record_updated', adminMemberMatch[1]);
      return json(req, { ok: true });
    }

    if (req.method === 'GET' && path === '/api/admin/members/export') {
      const admin = await authenticate(req, 'admin');
      if (admin instanceof Response) return admin;
      const { data } = await service.from('profiles').select('*').order('full_name');
      const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
      const columns = ['full_name','email','phone_number','membership_status','occupation','workplace','professional_designation','membership_category','date_of_joining','country','state','city','lga','residential_location'];
      const csv = [columns.join(','), ...(data || []).map((row) => columns.map((c) => escape(row[c])).join(','))].join('\n');
      return new Response(csv, { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'text/csv; charset=utf-8' } });
    }

    if (req.method === 'GET' && (path === '/api/admin/announcements' || path === '/api/admin/settings')) {
      const admin = await authenticate(req, 'admin');
      if (admin instanceof Response) return admin;
      if (path.endsWith('/announcements')) return json(req, { announcements: await announcementRows(admin.id, true) });
      const [settings, { data: roles }] = await Promise.all([
        getSettings(), service.from('user_roles').select('user_id').eq('role', 'admin'),
      ]);
      const ids = (roles || []).map((r) => r.user_id);
      const { data: admins } = ids.length
        ? await service.from('profiles').select('id,full_name,email,professional_designation,created_at').in('id', ids).order('full_name')
        : { data: [] as any[] };
      return json(req, { settings, admins: admins || [] });
    }

    if (req.method === 'PATCH' && path === '/api/admin/settings') {
      const admin = await authenticate(req, 'admin');
      if (admin instanceof Response) return admin;
      const body = await readBody(req);
      const fields = ['fellowship_name','tagline','logo_url','description','meeting_schedule','meeting_location','default_phone_visibility','default_email_visibility','default_workplace_visibility','default_birthday_visibility','default_location_visibility'];
      const update: Record<string, any> = { updated_at: new Date().toISOString() };
      for (const field of fields) if (field in body) update[field] = nullable(body[field], field === 'description' ? 1500 : 300);
      const { data, error } = await service.from('fellowship_settings').update(update).eq('id', 'default').select('*').single();
      if (error) return fail(req, error.message, 400);
      await logActivity(admin.id, 'fellowship_settings_updated');
      return json(req, { settings: data });
    }

    if (path === '/api/admin/announcements' && req.method === 'POST') {
      const admin = await authenticate(req, 'admin');
      if (admin instanceof Response) return admin;
      const body = await readBody(req);
      const title = clean(body.title, 180);
      const content = clean(body.content, 5000);
      if (!title || !content) return fail(req, 'Announcement title and content are required.');
      let imageUrl: string | null = null;
      if (body.image instanceof File && body.image.size) imageUrl = await uploadImage(body.image, 'announcements', admin.id);
      const { data, error } = await service.from('announcements').insert({
        title, content, image_url: imageUrl,
        is_pinned: body.is_pinned === true || body.is_pinned === 'true' || body.is_pinned === 1,
        status: body.status === 'draft' ? 'draft' : 'published',
        created_by: admin.id,
      }).select('*').single();
      if (error) return fail(req, error.message, 400);
      await logActivity(admin.id, 'announcement_created', title);
      return json(req, { announcement: data }, 201);
    }

    const announcementAdminMatch = path.match(/^\/api\/admin\/announcements\/([0-9a-f-]+)$/i);
    if (announcementAdminMatch && req.method === 'PATCH') {
      const admin = await authenticate(req, 'admin');
      if (admin instanceof Response) return admin;
      const body = await readBody(req);
      const update: Record<string, any> = { updated_at: new Date().toISOString() };
      if ('title' in body) update.title = clean(body.title, 180);
      if ('content' in body) update.content = clean(body.content, 5000);
      if ('status' in body) update.status = body.status === 'draft' ? 'draft' : 'published';
      if ('is_pinned' in body) update.is_pinned = body.is_pinned === true || body.is_pinned === 'true' || body.is_pinned === 1;
      if (body.image instanceof File && body.image.size) update.image_url = await uploadImage(body.image, 'announcements', admin.id);
      const { error } = await service.from('announcements').update(update).eq('id', announcementAdminMatch[1]);
      if (error) return fail(req, error.message, 400);
      await logActivity(admin.id, 'announcement_updated', announcementAdminMatch[1]);
      return json(req, { ok: true });
    }

    if (announcementAdminMatch && req.method === 'DELETE') {
      const admin = await authenticate(req, 'admin');
      if (admin instanceof Response) return admin;
      const { error } = await service.from('announcements').delete().eq('id', announcementAdminMatch[1]);
      if (error) return fail(req, error.message, 400);
      await logActivity(admin.id, 'announcement_deleted', announcementAdminMatch[1]);
      return json(req, { ok: true });
    }

    return fail(req, 'API route not found.', 404);
  } catch (error) {
    console.error(error);
    return fail(req, error instanceof Error ? error.message : 'Unexpected server error.', 500);
  }
});
