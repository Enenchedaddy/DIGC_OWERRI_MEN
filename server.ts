import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { db, initDatabase, logActivity, UPLOADS_DIR } from './server/db.ts';
import {
  applyMemberPrivacy,
  detectImageExtension,
  generateOpaqueToken,
  hashPassword,
  hashSessionToken,
  isValidDateOfBirth,
  isValidEmail,
  isValidPhone,
  neutralizeCsvCell,
  normalizePhoneNumber,
  sanitizeText,
  verifyPassword,
  verifySessionToken,
} from './server/security.ts';
import type { RawPrivacyRow, RawProfileRow } from './server/security.ts';

dotenv.config();
initDatabase();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const SESSION_COOKIE_NAME = 'fellowship_session';

app.set('trust proxy', 1);

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '2mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'admin' | 'member';
  membership_status: 'pending' | 'approved' | 'rejected' | 'suspended';
  full_name: string;
}

interface AuthRequest extends Request {
  authUser?: AuthenticatedUser;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) result[key] = decodeURIComponent(val);
  }
  return result;
}

function isHttpsRequest(req: Request): boolean {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const origin = String(req.headers.origin || '').toLowerCase();
  return req.secure || forwardedProto === 'https' || origin.startsWith('https://');
}

function isEmbeddedIframeRequest(req: Request): boolean {
  return (
    req.headers['x-embedded-context'] === '1' ||
    req.headers['sec-fetch-dest'] === 'iframe' ||
    req.headers['sec-fetch-site'] === 'cross-site'
  );
}

function buildCookieAttributes(req: Request): string {
  const isHttps = isHttpsRequest(req);
  if (!isHttps) {
    return 'HttpOnly; SameSite=Lax; Path=/';
  }
  if (isEmbeddedIframeRequest(req)) {
    return 'HttpOnly; Secure; SameSite=None; Partitioned; Path=/';
  }
  return 'HttpOnly; Secure; SameSite=Lax; Path=/';
}

function setSessionCookie(req: Request, res: Response, token: string, rememberMe = true) {
  const baseAttrs = buildCookieAttributes(req);
  const maxAgeAttr = rememberMe ? `; Max-Age=${60 * 60 * 24 * 30}` : '';
  res.append('Set-Cookie', `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; ${baseAttrs}${maxAgeAttr}`);
}

function clearSessionCookie(req: Request, res: Response) {
  const baseAttrs = buildCookieAttributes(req);
  res.append(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; ${baseAttrs}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  );
}

function createPersistedSession(userId: string, rememberMe: boolean): string {
  const token = generateOpaqueToken(32);
  const tokenHash = hashSessionToken(token);
  const ttlMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  db.prepare(
    `INSERT INTO user_sessions (id, user_id, token_hash, remember_me, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), userId, tokenHash, rememberMe ? 1 : 0, expiresAt);

  db.prepare(`DELETE FROM user_sessions WHERE expires_at < datetime('now', '-1 day')`).run();
  return token;
}

function verifyAnySession(token: string): { sub: string } | null {
  const tokenHash = hashSessionToken(token);
  const dbSession = db
    .prepare(
      `SELECT user_id, expires_at, revoked_at
       FROM user_sessions
       WHERE token_hash = ?`
    )
    .get(tokenHash) as { user_id: string; expires_at: string; revoked_at: string | null } | undefined;

  if (dbSession) {
    if (dbSession.revoked_at) return null;
    if (new Date(dbSession.expires_at).getTime() <= Date.now()) return null;
    return { sub: dbSession.user_id };
  }

  const legacy = verifySessionToken(token);
  return legacy ? { sub: legacy.sub } : null;
}

function revokeSessionToken(token: string) {
  const tokenHash = hashSessionToken(token);
  db.prepare(`UPDATE user_sessions SET revoked_at = datetime('now') WHERE token_hash = ? AND revoked_at IS NULL`).run(
    tokenHash
  );
}

function revokeAllSessionsForUser(userId: string, exceptToken?: string | null) {
  if (exceptToken) {
    const keepHash = hashSessionToken(exceptToken);
    db.prepare(
      `UPDATE user_sessions SET revoked_at = datetime('now')
       WHERE user_id = ? AND token_hash != ? AND revoked_at IS NULL`
    ).run(userId, keepHash);
    return;
  }
  db.prepare(`UPDATE user_sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL`).run(
    userId
  );
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME] || null;
}

function verifyStateChangingRequest(req: Request): boolean {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return true;
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') return true;
  const origin = req.headers.origin;
  const forwardedHost =
    typeof req.headers['x-forwarded-host'] === 'string'
      ? req.headers['x-forwarded-host'].split(',')[0].trim()
      : '';
  const host = forwardedHost || req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) return true;
      const allowedCustomHosts = new Set(['digcowerri.com', 'www.digcowerri.com']);
      if (process.env.APP_URL) {
        try {
          allowedCustomHosts.add(new URL(process.env.APP_URL).host);
        } catch {
          // Ignore malformed APP_URL
        }
      }
      return allowedCustomHosts.has(originHost);
    } catch {
      return false;
    }
  }
  return false;
}

function getUserById(userId: string): AuthenticatedUser | null {
  const row = db
    .prepare(
      `SELECT u.id, u.email, COALESCE(r.role, 'member') as role,
              COALESCE(p.membership_status, 'pending') as membership_status,
              COALESCE(p.full_name, u.email) as full_name,
              r.user_id as has_role
       FROM users u
       LEFT JOIN user_roles r ON r.user_id = u.id
       LEFT JOIN profiles p ON p.id = u.id
       WHERE u.id = ?`
    )
    .get(userId) as (AuthenticatedUser & { has_role: string | null }) | undefined;
  if (!row) return null;
  if (!row.has_role) {
    db.prepare(`INSERT OR IGNORE INTO user_roles (id, user_id, role) VALUES (?, ?, 'member')`).run(
      crypto.randomUUID(),
      userId
    );
  }
  return {
    id: row.id,
    email: row.email,
    role: row.role === 'admin' ? 'admin' : 'member',
    membership_status: row.membership_status,
    full_name: row.full_name,
  };
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const payload = verifyAnySession(token);
  if (!payload) {
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    return;
  }
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !verifyStateChangingRequest(req)) {
    res.status(403).json({ error: 'Invalid request origin.' });
    return;
  }
  const user = getUserById(payload.sub);
  if (!user) {
    res.status(401).json({ error: 'Account not found.' });
    return;
  }
  req.authUser = user;
  next();
}

function requireApproved(req: AuthRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (!req.authUser) return;
    if (req.authUser.membership_status !== 'approved') {
      res.status(403).json({
        error:
          req.authUser.membership_status === 'pending'
            ? 'Your membership registration is awaiting administrator approval.'
            : 'Your account does not have active directory access.',
        membership_status: req.authUser.membership_status,
      });
      return;
    }
    next();
  });
}

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  requireApproved(req, res, () => {
    if (!req.authUser || req.authUser.role !== 'admin') {
      res.status(403).json({ error: 'Administrator privileges are required for this action.' });
      return;
    }
    next();
  });
}

function saveValidatedImage(file: Express.Multer.File): string {
  const ext = detectImageExtension(file.buffer);
  if (!ext) {
    throw new Error('Invalid image file. Please upload a genuine JPEG, PNG, or WebP photograph.');
  }
  const filename = `${crypto.randomUUID()}.${ext}`;
  const targetPath = path.resolve(UPLOADS_DIR, filename);
  if (!targetPath.startsWith(UPLOADS_DIR + path.sep)) {
    throw new Error('Invalid upload destination.');
  }
  fs.writeFileSync(targetPath, file.buffer);
  return `/api/uploads/${filename}`;
}

function getSafeAdminCount(): number {
  const row = db.prepare(`SELECT COUNT(*) as cnt FROM user_roles WHERE role = 'admin'`).get() as { cnt: number };
  return row.cnt;
}

function getSettingsRow() {
  return db.prepare(`SELECT * FROM fellowship_settings WHERE id = 'default'`).get() as Record<string, unknown>;
}

function validateVisibility(val: unknown, allowed: string[], fallback: string): string {
  return typeof val === 'string' && allowed.includes(val) ? val : fallback;
}

// ---------------------------------------------------------------------------
// PUBLIC ROUTES
// ---------------------------------------------------------------------------

app.get('/api/public/info', (_req, res) => {
  const settings = getSettingsRow();
  const adminCount = getSafeAdminCount();
  const hasPasscodeConfigured = Boolean(process.env.ADMIN_BOOTSTRAP_PASSCODE?.trim());

  res.json({
    fellowship_name: settings.fellowship_name,
    tagline: settings.tagline,
    logo_url: settings.logo_url || '/src/assets/images/dunamis_owerri_logo_1795268208018.jpg',
    description: settings.description,
    meeting_schedule: settings.meeting_schedule,
    meeting_location: settings.meeting_location,
    official_domain: 'digcowerri.com',
    needs_admin_setup: adminCount === 0,
    requires_bootstrap_passcode: hasPasscodeConfigured,
  });
});

app.post('/api/auth/bootstrap-admin', (req, res) => {
  const configuredPasscode = process.env.ADMIN_BOOTSTRAP_PASSCODE?.trim() || '';
  const adminCount = getSafeAdminCount();

  if (configuredPasscode) {
    const providedPasscode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    const a = Buffer.from(providedPasscode, 'utf8');
    const b = Buffer.from(configuredPasscode, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      res.status(403).json({ error: 'Invalid administrator bootstrap passcode.' });
      return;
    }
  } else if (adminCount > 0) {
    res.status(403).json({
      error: 'Initial administrator has already been provisioned. Ask an existing administrator to grant privileges.',
    });
    return;
  }

  const fullName = sanitizeText(req.body?.full_name, 120);
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  const rawPhone = sanitizeText(req.body?.phone_number, 40) || '+234 800 000 0100';
  const phone = normalizePhoneNumber(rawPhone);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (fullName.length < 2) {
    res.status(400).json({ error: 'Please provide the administrator full name.' });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Please provide a valid email address.' });
    return;
  }
  if (!isValidPhone(rawPhone)) {
    res.status(400).json({ error: 'Please provide a valid Nigerian or international phone number.' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(TRIM(email)) = ?').get(email) as { id: string } | undefined;
  if (existing) {
    res.status(409).json({ error: 'An account with this email address already exists.' });
    return;
  }

  const userId = crypto.randomUUID();
  const passwordHash = hashPassword(password);

  const tx = db.transaction(() => {
    if (!configuredPasscode && getSafeAdminCount() > 0) {
      throw new Error('ADMIN_EXISTS');
    }
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, email, passwordHash);
    db.prepare(
      `INSERT INTO profiles (
        id, full_name, email, phone_number, country, state, city, residential_location,
        occupation, professional_designation, fellowship_responsibilities,
        membership_category, membership_status, date_of_joining
      ) VALUES (?, ?, ?, ?, 'Nigeria', 'Imo State', 'Owerri', 'Owerri, Imo State, Nigeria', ?, ?, ?, ?, 'approved', date('now'))`
    ).run(
      userId,
      fullName,
      email,
      phone,
      'Fellowship Leadership',
      'Portal Administrator',
      'Fellowship Administration & Oversight',
      'Leadership'
    );
    db.prepare(`INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'admin')`).run(crypto.randomUUID(), userId);
    db.prepare(
      `INSERT INTO profile_privacy (
        id, user_id, phone_visibility, email_visibility, workplace_visibility, birthday_visibility, location_visibility
      ) VALUES (?, ?, 'admins_only', 'members', 'members', 'day_month', 'members')`
    ).run(crypto.randomUUID(), userId);
    logActivity(userId, 'admin_bootstrapped', `Initial administrator provisioned: ${email}`);
  });

  try {
    tx();
  } catch (err) {
    if (err instanceof Error && err.message === 'ADMIN_EXISTS') {
      res.status(403).json({ error: 'Initial administrator has already been claimed.' });
      return;
    }
    res.status(500).json({ error: 'Unable to provision administrator account.' });
    return;
  }

  const token = createPersistedSession(userId, true);
  setSessionCookie(req, res, token, true);
  res.status(201).json({
    token,
    user: {
      id: userId,
      email,
      full_name: fullName,
      role: 'admin',
      membership_status: 'approved',
    },
  });
});

app.post('/api/auth/register', upload.single('profile_photo'), (req, res) => {
  const fullName = sanitizeText(req.body?.full_name, 120);
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  const rawPhone = sanitizeText(req.body?.phone_number, 40);
  const phone = normalizePhoneNumber(rawPhone);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const dob = sanitizeText(req.body?.date_of_birth, 20);
  const gender = sanitizeText(req.body?.gender, 30) || 'Male';
  const country = sanitizeText(req.body?.country, 80) || 'Nigeria';
  const state = sanitizeText(req.body?.state, 80) || 'Imo State';
  const city = sanitizeText(req.body?.city, 80) || 'Owerri';
  const lga = sanitizeText(req.body?.lga, 80);
  const streetAddress = sanitizeText(req.body?.street_address, 160);
  const rawLocation = sanitizeText(req.body?.residential_location, 160);
  const assembledLocation = [streetAddress, lga, city, state, country].filter(Boolean).join(', ');
  const location = rawLocation || assembledLocation;
  const occupation = sanitizeText(req.body?.occupation, 120);
  const workplace = sanitizeText(req.body?.workplace, 160);
  const designation = sanitizeText(req.body?.professional_designation, 120);
  const skills = sanitizeText(req.body?.skills, 300);
  const category = sanitizeText(req.body?.membership_category, 80) || 'General Member';
  const dateOfJoining = sanitizeText(req.body?.date_of_joining, 20) || new Date().toISOString().slice(0, 10);
  const responsibilities = sanitizeText(req.body?.fellowship_responsibilities, 200);
  const biography = sanitizeText(req.body?.biography, 1000);

  if (fullName.length < 2) {
    res.status(400).json({ error: 'Full name is required.' });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (!isValidPhone(rawPhone)) {
    res.status(400).json({ error: 'Please enter a valid Nigerian mobile number (e.g. +234 803 123 4567) or international number.' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }
  if (!isValidDateOfBirth(dob)) {
    res.status(400).json({ error: 'Please provide a valid date of birth.' });
    return;
  }
  if (!location || !occupation) {
    res.status(400).json({ error: 'Residential address and occupation are required.' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE LOWER(TRIM(email)) = ? UNION SELECT id FROM profiles WHERE LOWER(TRIM(email)) = ?')
    .get(email, email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email address is already registered. Please sign in or reset your password.' });
    return;
  }

  let profileImageUrl: string | null = null;
  if (req.file) {
    try {
      profileImageUrl = saveValidatedImage(req.file);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid profile image.' });
      return;
    }
  }

  const settings = getSettingsRow();
  const userId = crypto.randomUUID();
  const passwordHash = hashPassword(password);

  const tx = db.transaction(() => {
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, email, passwordHash);
    db.prepare(
      `INSERT INTO profiles (
        id, full_name, email, phone_number, profile_image, date_of_birth, gender,
        country, state, city, lga, street_address, residential_location,
        occupation, workplace, professional_designation, skills,
        membership_category, date_of_joining, fellowship_responsibilities, biography, membership_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).run(
      userId,
      fullName,
      email,
      phone,
      profileImageUrl,
      dob,
      gender,
      country,
      state,
      city,
      lga || null,
      streetAddress || null,
      location,
      occupation,
      workplace || null,
      designation || null,
      skills || null,
      category,
      dateOfJoining,
      responsibilities || null,
      biography || null
    );
    // Role is strictly 'member'; never accepted from client input.
    db.prepare(`INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'member')`).run(crypto.randomUUID(), userId);
    db.prepare(
      `INSERT INTO profile_privacy (
        id, user_id, phone_visibility, email_visibility, workplace_visibility, birthday_visibility, location_visibility
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      userId,
      String(settings.default_phone_visibility || 'members'),
      String(settings.default_email_visibility || 'members'),
      String(settings.default_workplace_visibility || 'members'),
      String(settings.default_birthday_visibility || 'day_month'),
      String(settings.default_location_visibility || 'members')
    );
    logActivity(userId, 'member_registered', `New registration submitted by ${fullName} (${email})`);
  });

  tx();

  const token = createPersistedSession(userId, true);
  setSessionCookie(req, res, token, true);

  res.status(201).json({
    token,
    user: {
      id: userId,
      email,
      full_name: fullName,
      role: 'member',
      membership_status: 'pending',
    },
    message: 'Registration submitted. Your account is pending administrator approval.',
  });
});

app.post('/api/auth/login', (req, res) => {
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const rememberMe = req.body?.remember_me !== false;

  if (!email || !password) {
    res.status(400).json({ error: 'Email address and password are required.' });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }

  const userRow = db
    .prepare(
      `SELECT u.id, u.email, u.password_hash,
              COALESCE(r.role, 'member') as role,
              COALESCE(p.membership_status, 'pending') as membership_status,
              COALESCE(p.full_name, u.email) as full_name,
              r.user_id as has_role,
              p.id as has_profile,
              pr.user_id as has_privacy
       FROM users u
       LEFT JOIN user_roles r ON r.user_id = u.id
       LEFT JOIN profiles p ON p.id = u.id
       LEFT JOIN profile_privacy pr ON pr.user_id = u.id
       WHERE LOWER(TRIM(u.email)) = ?`
    )
    .get(email) as
    | (AuthenticatedUser & {
        password_hash: string;
        has_role: string | null;
        has_profile: string | null;
        has_privacy: string | null;
      })
    | undefined;

  if (!userRow || !verifyPassword(password, userRow.password_hash)) {
    res.status(401).json({
      error:
        'Incorrect email address or password. Please check your credentials, reset your password if forgotten, or create a member account if you have not registered yet.',
    });
    return;
  }

  if (!userRow.has_role || !userRow.has_profile || !userRow.has_privacy) {
    const settings = getSettingsRow();
    db.transaction(() => {
      if (!userRow.has_role) {
        db.prepare(`INSERT OR IGNORE INTO user_roles (id, user_id, role) VALUES (?, ?, 'member')`).run(
          crypto.randomUUID(),
          userRow.id
        );
      }
      if (!userRow.has_profile) {
        db.prepare(
          `INSERT OR IGNORE INTO profiles (id, full_name, email, phone_number, membership_status)
           VALUES (?, ?, ?, '', 'pending')`
        ).run(userRow.id, userRow.full_name, userRow.email);
      }
      if (!userRow.has_privacy) {
        db.prepare(
          `INSERT OR IGNORE INTO profile_privacy (
            id, user_id, phone_visibility, email_visibility, workplace_visibility, birthday_visibility, location_visibility
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(
          crypto.randomUUID(),
          userRow.id,
          String(settings.default_phone_visibility || 'members'),
          String(settings.default_email_visibility || 'members'),
          String(settings.default_workplace_visibility || 'members'),
          String(settings.default_birthday_visibility || 'day_month'),
          String(settings.default_location_visibility || 'members')
        );
      }
    })();
  }

  const role: 'admin' | 'member' = userRow.role === 'admin' ? 'admin' : 'member';
  const token = createPersistedSession(userRow.id, rememberMe);
  setSessionCookie(req, res, token, rememberMe);
  logActivity(userRow.id, 'user_signed_in', `Signed in (${role})`);

  res.json({
    token,
    remember_me: rememberMe,
    user: {
      id: userRow.id,
      email: userRow.email,
      full_name: userRow.full_name,
      role,
      membership_status: userRow.membership_status,
    },
  });
});

app.post('/api/auth/logout', (req: AuthRequest, res) => {
  const token = extractToken(req);
  if (token) {
    const payload = verifyAnySession(token);
    if (payload) {
      logActivity(payload.sub, 'user_signed_out');
    }
    revokeSessionToken(token);
  }
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }

  const user = db
    .prepare('SELECT u.id, p.full_name FROM users u LEFT JOIN profiles p ON p.id = u.id WHERE LOWER(TRIM(u.email)) = ?')
    .get(email) as { id: string; full_name: string | null } | undefined;

  let emailDispatched = false;

  if (user) {
    const rawToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    db.prepare('INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)').run(
      crypto.randomUUID(),
      user.id,
      tokenHash,
      expiresAt
    );
    logActivity(user.id, 'password_reset_requested');

    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    if (resendApiKey) {
      const forwardedHost =
        typeof req.headers['x-forwarded-host'] === 'string'
          ? req.headers['x-forwarded-host'].split(',')[0].trim()
          : '';
      const activeHost = forwardedHost || req.headers.host;
      const appBaseUrl = activeHost
        ? `${isHttpsRequest(req) ? 'https' : 'http'}://${activeHost}`
        : process.env.APP_URL?.trim() || 'https://digcowerri.com';
      const resetLink = `${appBaseUrl.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;
      const fromAddress = process.env.EMAIL_FROM?.trim() || 'DIGC Owerri Fellowship <no-reply@digcowerri.com>';
      try {
        const mailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [email],
            subject: "Reset your password — DIGC Owerri Men's Fellowship Portal",
            text: `Hello ${user.full_name || 'Brother'},\n\nUse this link within 30 minutes to reset your password:\n${resetLink}\n\nOr enter reset token: ${rawToken}\n\nIf you did not request this, you can safely ignore this message.`,
          }),
        });
        emailDispatched = mailRes.ok;
      } catch {
        emailDispatched = false;
      }
    }
  }

  res.json({
    email_configured: Boolean(process.env.RESEND_API_KEY?.trim()),
    email_dispatched: emailDispatched,
    message: process.env.RESEND_API_KEY?.trim()
      ? 'If an account exists for that email address, password reset instructions have been sent. Check your inbox and spam folder.'
      : 'If an account exists for that email address, a password reset request has been logged. If you have not received a reset token, please ask a fellowship administrator to generate a one-time reset token for your account.',
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const token = sanitizeText(req.body?.token, 128);
  const newPassword = typeof req.body?.new_password === 'string' ? req.body.new_password : '';

  if (!token || newPassword.length < 8) {
    res.status(400).json({ error: 'A valid reset token and password (minimum 8 characters) are required.' });
    return;
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const resetRow = db
    .prepare(
      `SELECT id, user_id, expires_at, used_at FROM password_resets
       WHERE token_hash = ? AND used_at IS NULL`
    )
    .get(tokenHash) as { id: string; user_id: string; expires_at: string; used_at: string | null } | undefined;

  if (!resetRow || new Date(resetRow.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'Reset token is invalid or has expired.' });
    return;
  }

  const passwordHash = hashPassword(newPassword);
  const tx = db.transaction(() => {
    db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(
      passwordHash,
      resetRow.user_id
    );
    db.prepare(`UPDATE password_resets SET used_at = datetime('now') WHERE id = ?`).run(resetRow.id);
    revokeAllSessionsForUser(resetRow.user_id);
    logActivity(resetRow.user_id, 'password_reset_completed');
  });
  tx();

  clearSessionCookie(req, res);
  res.json({ message: 'Your password has been updated. You may now sign in with your new password.' });
});

// ---------------------------------------------------------------------------
// AUTHENTICATED SELF & PRIVATE UPLOAD ROUTES
// ---------------------------------------------------------------------------

app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
  const userId = req.authUser!.id;
  const profile = db
    .prepare(
      `SELECT p.*, COALESCE(r.role, 'member') as role
       FROM profiles p
       LEFT JOIN user_roles r ON r.user_id = p.id
       WHERE p.id = ?`
    )
    .get(userId) as RawProfileRow | undefined;

  let privacy = db
    .prepare(
      `SELECT phone_visibility, email_visibility, workplace_visibility, birthday_visibility, location_visibility
       FROM profile_privacy WHERE user_id = ?`
    )
    .get(userId) as RawPrivacyRow | undefined;

  const settings = getSettingsRow();

  if (profile && !privacy) {
    privacy = {
      phone_visibility: String(settings.default_phone_visibility || 'members'),
      email_visibility: String(settings.default_email_visibility || 'members'),
      workplace_visibility: String(settings.default_workplace_visibility || 'members'),
      birthday_visibility: String(settings.default_birthday_visibility || 'day_month'),
      location_visibility: String(settings.default_location_visibility || 'members'),
    };
    db.prepare(
      `INSERT OR IGNORE INTO profile_privacy (
        id, user_id, phone_visibility, email_visibility, workplace_visibility, birthday_visibility, location_visibility
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      userId,
      privacy.phone_visibility,
      privacy.email_visibility,
      privacy.workplace_visibility,
      privacy.birthday_visibility,
      privacy.location_visibility
    );
  }

  if (!profile || !privacy) {
    res.status(404).json({ error: 'Profile record not found.' });
    return;
  }

  res.json({
    profile,
    privacy,
    fellowship: {
      fellowship_name: settings.fellowship_name,
      tagline: settings.tagline,
      logo_url: settings.logo_url || '/src/assets/images/dunamis_owerri_logo_1795268208018.jpg',
      meeting_schedule: settings.meeting_schedule,
      meeting_location: settings.meeting_location,
    },
  });
});

app.get('/api/uploads/:filename', requireAuth, (req: AuthRequest, res) => {
  const filename = path.basename(req.params.filename || '');
  if (!filename || !/^[a-f0-9-]+\.(jpg|png|webp)$/i.test(filename)) {
    res.status(400).json({ error: 'Invalid file identifier.' });
    return;
  }

  const resolvedPath = path.resolve(UPLOADS_DIR, filename);
  if (!resolvedPath.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(resolvedPath)) {
    res.status(404).json({ error: 'Image not found.' });
    return;
  }

  const fileUrl = `/api/uploads/${filename}`;
  const caller = req.authUser!;

  if (caller.role !== 'admin') {
    const ownerProfile = db
      .prepare('SELECT id, membership_status FROM profiles WHERE profile_image = ?')
      .get(fileUrl) as { id: string; membership_status: string } | undefined;

    const announcementAsset = db
      .prepare(`SELECT id FROM announcements WHERE image_url = ? AND status = 'published'`)
      .get(fileUrl) as { id: string } | undefined;

    const isOwner = ownerProfile?.id === caller.id;
    const isApprovedViewingApprovedMember =
      caller.membership_status === 'approved' && ownerProfile?.membership_status === 'approved';
    const isApprovedViewingAnnouncement = caller.membership_status === 'approved' && Boolean(announcementAsset);

    if (!isOwner && !isApprovedViewingApprovedMember && !isApprovedViewingAnnouncement) {
      res.status(403).json({ error: 'You do not have permission to view this private image.' });
      return;
    }
  }

  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(resolvedPath);
});

// ---------------------------------------------------------------------------
// APPROVED MEMBER ROUTES
// ---------------------------------------------------------------------------

app.get('/api/dashboard', requireApproved, (req: AuthRequest, res) => {
  const userId = req.authUser!.id;
  const viewerRole = req.authUser!.role;

  const stats = db
    .prepare(
      `SELECT
        COUNT(*) as total_approved,
        COUNT(DISTINCT occupation) as distinct_occupations
       FROM profiles WHERE membership_status = 'approved'`
    )
    .get() as { total_approved: number; distinct_occupations: number };

  const announcementRows = db
    .prepare(
      `SELECT a.id, a.title, a.content, a.image_url, a.is_pinned, a.created_at,
              p.full_name as author_name,
              CASE WHEN ar.id IS NOT NULL THEN 1 ELSE 0 END as is_read
       FROM announcements a
       JOIN profiles p ON p.id = a.created_by
       LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.user_id = ?
       WHERE a.status = 'published'
       ORDER BY a.is_pinned DESC, a.created_at DESC
       LIMIT 4`
    )
    .all(userId);

  const unreadRow = db
    .prepare(
      `SELECT COUNT(*) as cnt
       FROM announcements a
       LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.user_id = ?
       WHERE a.status = 'published' AND ar.id IS NULL`
    )
    .get(userId) as { cnt: number };

  const memberBirthdays = db
    .prepare(
      `SELECT p.id, p.full_name, p.profile_image, p.date_of_birth, p.occupation,
              pr.birthday_visibility
       FROM profiles p
       JOIN profile_privacy pr ON pr.user_id = p.id
       WHERE p.membership_status = 'approved' AND p.date_of_birth IS NOT NULL`
    )
    .all() as Array<{
      id: string;
      full_name: string;
      profile_image: string | null;
      date_of_birth: string;
      occupation: string | null;
      birthday_visibility: string;
    }>;

  const upcomingBirthdays = computeUpcomingBirthdays(memberBirthdays, userId, viewerRole).slice(0, 5);
  const settings = getSettingsRow();

  res.json({
    stats: {
      total_approved: stats.total_approved,
      distinct_occupations: stats.distinct_occupations,
      unread_announcements: unreadRow.cnt,
      upcoming_birthdays_count: upcomingBirthdays.length,
    },
    recent_announcements: announcementRows,
    upcoming_birthdays: upcomingBirthdays,
    fellowship: {
      fellowship_name: settings.fellowship_name,
      logo_url: settings.logo_url || '/src/assets/images/dunamis_owerri_logo_1795268208018.jpg',
      meeting_schedule: settings.meeting_schedule,
      meeting_location: settings.meeting_location,
      description: settings.description,
    },
  });
});

function computeUpcomingBirthdays(
  rows: Array<{
    id: string;
    full_name: string;
    profile_image: string | null;
    date_of_birth: string;
    occupation: string | null;
    birthday_visibility: string;
  }>,
  viewerId: string,
  viewerRole: 'admin' | 'member'
) {
  const lagosParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .split('-')
    .map(Number);
  const [lagosYear, lagosMonth, lagosDay] = lagosParts;
  const todayUtc = Date.UTC(lagosYear, lagosMonth - 1, lagosDay);

  const list: Array<{
    id: string;
    full_name: string;
    profile_image: string | null;
    occupation: string | null;
    birth_month_day: string;
    date_of_birth: string | null;
    days_until: number;
    turning_age: number | null;
  }> = [];

  for (const row of rows) {
    const isSelfOrAdmin = row.id === viewerId || viewerRole === 'admin';
    if (!isSelfOrAdmin && (row.birthday_visibility === 'private' || row.birthday_visibility === 'admins_only')) {
      continue;
    }

    const parts = row.date_of_birth.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) continue;
    const [birthYear, birthMonth, birthDay] = parts;

    let nextYear = lagosYear;
    let candidate = Date.UTC(nextYear, birthMonth - 1, birthDay);
    if (candidate < todayUtc) {
      nextYear += 1;
      candidate = Date.UTC(nextYear, birthMonth - 1, birthDay);
    }

    const daysUntil = Math.round((candidate - todayUtc) / (1000 * 60 * 60 * 24));
    const showFullDate = isSelfOrAdmin || row.birthday_visibility === 'full_date';

    list.push({
      id: row.id,
      full_name: row.full_name,
      profile_image: row.profile_image,
      occupation: row.occupation,
      birth_month_day: `${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`,
      date_of_birth: showFullDate ? row.date_of_birth : null,
      days_until: daysUntil,
      turning_age: showFullDate ? nextYear - birthYear : null,
    });
  }

  return list.sort((a, b) => a.days_until - b.days_until);
}

app.get('/api/members', requireApproved, (req: AuthRequest, res) => {
  const viewerId = req.authUser!.id;
  const viewerRole = req.authUser!.role;
  const search = sanitizeText(req.query.search, 100).toLowerCase();
  const occupation = sanitizeText(req.query.occupation, 100);
  const category = sanitizeText(req.query.category, 80);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(48, Math.max(6, Number(req.query.limit) || 12));
  const offset = (page - 1) * limit;

  const conditions = [`p.membership_status = 'approved'`];
  const params: unknown[] = [];

  if (search) {
    conditions.push(`(LOWER(p.full_name) LIKE ? OR LOWER(COALESCE(p.occupation, '')) LIKE ? OR LOWER(COALESCE(p.skills, '')) LIKE ? OR LOWER(COALESCE(p.professional_designation, '')) LIKE ?)`);
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (occupation) {
    conditions.push(`p.occupation = ?`);
    params.push(occupation);
  }
  if (category) {
    conditions.push(`p.membership_category = ?`);
    params.push(category);
  }

  const whereSql = conditions.join(' AND ');

  const totalRow = db
    .prepare(`SELECT COUNT(*) as cnt FROM profiles p WHERE ${whereSql}`)
    .get(...params) as { cnt: number };

  const rows = db
    .prepare(
      `SELECT p.*, r.role,
              pr.phone_visibility, pr.email_visibility, pr.workplace_visibility, pr.birthday_visibility, pr.location_visibility
       FROM profiles p
       JOIN user_roles r ON r.user_id = p.id
       JOIN profile_privacy pr ON pr.user_id = p.id
       WHERE ${whereSql}
       ORDER BY p.full_name ASC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as Array<RawProfileRow & RawPrivacyRow>;

  const members = rows.map((row) => applyMemberPrivacy(row, row, viewerId, viewerRole));

  const occupations = (
    db
      .prepare(
        `SELECT DISTINCT occupation FROM profiles
         WHERE membership_status = 'approved' AND occupation IS NOT NULL AND occupation != ''
         ORDER BY occupation ASC`
      )
      .all() as Array<{ occupation: string }>
  ).map((o) => o.occupation);

  const categories = (
    db
      .prepare(
        `SELECT DISTINCT membership_category FROM profiles
         WHERE membership_status = 'approved' AND membership_category IS NOT NULL AND membership_category != ''
         ORDER BY membership_category ASC`
      )
      .all() as Array<{ membership_category: string }>
  ).map((c) => c.membership_category);

  res.json({
    members,
    pagination: {
      page,
      limit,
      total: totalRow.cnt,
      total_pages: Math.max(1, Math.ceil(totalRow.cnt / limit)),
    },
    filters: {
      occupations,
      categories,
    },
  });
});

app.get('/api/members/:id', requireApproved, (req: AuthRequest, res) => {
  const viewerId = req.authUser!.id;
  const viewerRole = req.authUser!.role;
  const targetId = req.params.id;

  const row = db
    .prepare(
      `SELECT p.*, r.role,
              pr.phone_visibility, pr.email_visibility, pr.workplace_visibility, pr.birthday_visibility, pr.location_visibility
       FROM profiles p
       JOIN user_roles r ON r.user_id = p.id
       JOIN profile_privacy pr ON pr.user_id = p.id
       WHERE p.id = ?`
    )
    .get(targetId) as (RawProfileRow & RawPrivacyRow) | undefined;

  if (!row) {
    res.status(404).json({ error: 'Member profile not found.' });
    return;
  }

  if (row.membership_status !== 'approved' && viewerRole !== 'admin' && viewerId !== row.id) {
    res.status(403).json({ error: 'This profile is not available in the directory.' });
    return;
  }

  res.json({ member: applyMemberPrivacy(row, row, viewerId, viewerRole) });
});

app.get('/api/birthdays', requireApproved, (req: AuthRequest, res) => {
  const viewerId = req.authUser!.id;
  const viewerRole = req.authUser!.role;

  const rows = db
    .prepare(
      `SELECT p.id, p.full_name, p.profile_image, p.date_of_birth, p.occupation,
              pr.birthday_visibility
       FROM profiles p
       JOIN profile_privacy pr ON pr.user_id = p.id
       WHERE p.membership_status = 'approved' AND p.date_of_birth IS NOT NULL`
    )
    .all() as Array<{
      id: string;
      full_name: string;
      profile_image: string | null;
      date_of_birth: string;
      occupation: string | null;
      birthday_visibility: string;
    }>;

  const birthdays = computeUpcomingBirthdays(rows, viewerId, viewerRole);
  res.json({ birthdays });
});

app.get('/api/announcements', requireApproved, (req: AuthRequest, res) => {
  const userId = req.authUser!.id;
  const rows = db
    .prepare(
      `SELECT a.id, a.title, a.content, a.image_url, a.is_pinned, a.status, a.created_at, a.updated_at,
              p.full_name as author_name,
              CASE WHEN ar.id IS NOT NULL THEN 1 ELSE 0 END as is_read
       FROM announcements a
       JOIN profiles p ON p.id = a.created_by
       LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.user_id = ?
       WHERE a.status = 'published'
       ORDER BY a.is_pinned DESC, a.created_at DESC`
    )
    .all(userId);

  res.json({ announcements: rows });
});

app.post('/api/announcements/:id/read', requireApproved, (req: AuthRequest, res) => {
  const userId = req.authUser!.id;
  const announcementId = req.params.id;

  const exists = db
    .prepare(`SELECT id FROM announcements WHERE id = ? AND status = 'published'`)
    .get(announcementId);
  if (!exists) {
    res.status(404).json({ error: 'Announcement not found.' });
    return;
  }

  db.prepare(
    `INSERT OR IGNORE INTO announcement_reads (id, announcement_id, user_id) VALUES (?, ?, ?)`
  ).run(crypto.randomUUID(), announcementId, userId);

  res.json({ ok: true });
});

app.patch('/api/profile', requireAuth, (req: AuthRequest, res) => {
  const userId = req.authUser!.id;
  if (req.authUser!.membership_status === 'suspended' || req.authUser!.membership_status === 'rejected') {
    res.status(403).json({ error: 'Account cannot be modified in its current status.' });
    return;
  }

  const fullName = sanitizeText(req.body?.full_name, 120);
  const rawPhone = sanitizeText(req.body?.phone_number, 40);
  const phone = normalizePhoneNumber(rawPhone);
  const dob = sanitizeText(req.body?.date_of_birth, 20);
  const country = sanitizeText(req.body?.country, 80);
  const state = sanitizeText(req.body?.state, 80);
  const city = sanitizeText(req.body?.city, 80);
  const lga = sanitizeText(req.body?.lga, 80);
  const streetAddress = sanitizeText(req.body?.street_address, 160);
  const rawLocation = sanitizeText(req.body?.residential_location, 160);
  const assembledLocation = [streetAddress, lga, city, state, country].filter(Boolean).join(', ');
  const location = assembledLocation || rawLocation;
  const occupation = sanitizeText(req.body?.occupation, 120);
  const workplace = sanitizeText(req.body?.workplace, 160);
  const designation = sanitizeText(req.body?.professional_designation, 120);
  const skills = sanitizeText(req.body?.skills, 300);
  const category = sanitizeText(req.body?.membership_category, 80);
  const responsibilities = sanitizeText(req.body?.fellowship_responsibilities, 200);
  const biography = sanitizeText(req.body?.biography, 1000);

  if (fullName.length < 2) {
    res.status(400).json({ error: 'Full name is required.' });
    return;
  }
  if (!isValidPhone(rawPhone)) {
    res.status(400).json({ error: 'Please provide a valid Nigerian mobile number or international phone number.' });
    return;
  }
  if (dob && !isValidDateOfBirth(dob)) {
    res.status(400).json({ error: 'Please provide a valid date of birth.' });
    return;
  }

  db.prepare(
    `UPDATE profiles
     SET full_name = ?, phone_number = ?, date_of_birth = COALESCE(NULLIF(?, ''), date_of_birth),
         country = COALESCE(NULLIF(?, ''), country),
         state = COALESCE(NULLIF(?, ''), state),
         city = COALESCE(NULLIF(?, ''), city),
         lga = ?,
         street_address = ?,
         residential_location = ?, occupation = ?, workplace = ?, professional_designation = ?,
         skills = ?, membership_category = ?, fellowship_responsibilities = ?, biography = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    fullName,
    phone,
    dob,
    country,
    state,
    city,
    lga || null,
    streetAddress || null,
    location || null,
    occupation || null,
    workplace || null,
    designation || null,
    skills || null,
    category || null,
    responsibilities || null,
    biography || null,
    userId
  );

  logActivity(userId, 'profile_updated');
  res.json({ ok: true, message: 'Profile updated successfully.' });
});

app.post('/api/profile/photo', requireAuth, upload.single('photo'), (req: AuthRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Please select an image file to upload.' });
    return;
  }
  try {
    const imageUrl = saveValidatedImage(req.file);
    db.prepare(`UPDATE profiles SET profile_image = ?, updated_at = datetime('now') WHERE id = ?`).run(
      imageUrl,
      req.authUser!.id
    );
    logActivity(req.authUser!.id, 'profile_photo_updated');
    res.json({ profile_image: imageUrl });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to upload image.' });
  }
});

app.patch('/api/profile/privacy', requireAuth, (req: AuthRequest, res) => {
  const userId = req.authUser!.id;
  const current = db
    .prepare(
      `SELECT phone_visibility, email_visibility, workplace_visibility, birthday_visibility, location_visibility
       FROM profile_privacy WHERE user_id = ?`
    )
    .get(userId) as RawPrivacyRow | undefined;

  if (!current) {
    res.status(404).json({ error: 'Privacy settings not found.' });
    return;
  }

  const standardOptions = ['members', 'admins_only', 'private'];
  const birthdayOptions = ['day_month', 'full_date', 'admins_only', 'private'];

  const phoneVisibility = validateVisibility(req.body?.phone_visibility, standardOptions, current.phone_visibility);
  const emailVisibility = validateVisibility(req.body?.email_visibility, standardOptions, current.email_visibility);
  const workplaceVisibility = validateVisibility(
    req.body?.workplace_visibility,
    standardOptions,
    current.workplace_visibility
  );
  const birthdayVisibility = validateVisibility(
    req.body?.birthday_visibility,
    birthdayOptions,
    current.birthday_visibility
  );
  const locationVisibility = validateVisibility(
    req.body?.location_visibility,
    standardOptions,
    current.location_visibility
  );

  db.prepare(
    `UPDATE profile_privacy
     SET phone_visibility = ?, email_visibility = ?, workplace_visibility = ?,
         birthday_visibility = ?, location_visibility = ?, updated_at = datetime('now')
     WHERE user_id = ?`
  ).run(phoneVisibility, emailVisibility, workplaceVisibility, birthdayVisibility, locationVisibility, userId);

  logActivity(userId, 'privacy_updated');
  res.json({
    privacy: {
      phone_visibility: phoneVisibility,
      email_visibility: emailVisibility,
      workplace_visibility: workplaceVisibility,
      birthday_visibility: birthdayVisibility,
      location_visibility: locationVisibility,
    },
  });
});

app.patch('/api/account/password', requireAuth, (req: AuthRequest, res) => {
  const currentPassword = typeof req.body?.current_password === 'string' ? req.body.current_password : '';
  const newPassword = typeof req.body?.new_password === 'string' ? req.body.new_password : '';

  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters.' });
    return;
  }

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.authUser!.id) as
    | { password_hash: string }
    | undefined;

  if (!user || !verifyPassword(currentPassword, user.password_hash)) {
    res.status(401).json({ error: 'Current password is incorrect.' });
    return;
  }

  const nextHash = hashPassword(newPassword);
  db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(
    nextHash,
    req.authUser!.id
  );
  revokeAllSessionsForUser(req.authUser!.id, extractToken(req));
  logActivity(req.authUser!.id, 'password_changed');
  res.json({ message: 'Password updated successfully.' });
});

// ---------------------------------------------------------------------------
// ADMINISTRATOR ROUTES
// ---------------------------------------------------------------------------

app.get('/api/admin/overview', requireAdmin, (req: AuthRequest, res) => {
  const counts = db
    .prepare(
      `SELECT
        COUNT(*) as total_members,
        SUM(CASE WHEN membership_status = 'approved' THEN 1 ELSE 0 END) as approved_members,
        SUM(CASE WHEN membership_status = 'pending' THEN 1 ELSE 0 END) as pending_members,
        SUM(CASE WHEN membership_status = 'suspended' THEN 1 ELSE 0 END) as suspended_members,
        SUM(CASE WHEN membership_status = 'rejected' THEN 1 ELSE 0 END) as rejected_members
       FROM profiles`
    )
    .get();

  const recentRegistrations = db
    .prepare(
      `SELECT p.id, p.full_name, p.email, p.phone_number, p.occupation, p.membership_status, p.profile_image, p.created_at, r.role
       FROM profiles p
       JOIN user_roles r ON r.user_id = p.id
       ORDER BY CASE WHEN p.membership_status = 'pending' THEN 0 ELSE 1 END, p.created_at DESC
       LIMIT 8`
    )
    .all();

  const recentAnnouncements = db
    .prepare(
      `SELECT a.id, a.title, a.status, a.is_pinned, a.created_at, p.full_name as author_name
       FROM announcements a
       JOIN profiles p ON p.id = a.created_by
       ORDER BY a.created_at DESC
       LIMIT 5`
    )
    .all();

  const recentActivity = db
    .prepare(
      `SELECT l.id, l.action, l.details, l.created_at, p.full_name as actor_name
       FROM activity_logs l
       LEFT JOIN profiles p ON p.id = l.user_id
       ORDER BY l.created_at DESC
       LIMIT 10`
    )
    .all();

  const birthdayRows = db
    .prepare(
      `SELECT p.id, p.full_name, p.profile_image, p.date_of_birth, p.occupation, pr.birthday_visibility
       FROM profiles p
       JOIN profile_privacy pr ON pr.user_id = p.id
       WHERE p.membership_status = 'approved' AND p.date_of_birth IS NOT NULL`
    )
    .all() as Array<{
      id: string;
      full_name: string;
      profile_image: string | null;
      date_of_birth: string;
      occupation: string | null;
      birthday_visibility: string;
    }>;

  const upcomingBirthdays = computeUpcomingBirthdays(birthdayRows, req.authUser!.id, 'admin').slice(0, 5);

  res.json({
    counts,
    recent_registrations: recentRegistrations,
    recent_announcements: recentAnnouncements,
    recent_activity: recentActivity,
    upcoming_birthdays: upcomingBirthdays,
  });
});

app.get('/api/admin/members', requireAdmin, (req: AuthRequest, res) => {
  const search = sanitizeText(req.query.search, 100).toLowerCase();
  const status = sanitizeText(req.query.status, 30);
  const roleFilter = sanitizeText(req.query.role, 30);

  const conditions = ['1 = 1'];
  const params: unknown[] = [];

  if (search) {
    conditions.push(`(LOWER(p.full_name) LIKE ? OR LOWER(p.email) LIKE ? OR LOWER(COALESCE(p.occupation, '')) LIKE ?)`);
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (status && ['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
    conditions.push(`p.membership_status = ?`);
    params.push(status);
  }
  if (roleFilter && ['admin', 'member'].includes(roleFilter)) {
    conditions.push(`r.role = ?`);
    params.push(roleFilter);
  }

  const rows = db
    .prepare(
      `SELECT p.*, r.role,
              pr.phone_visibility, pr.email_visibility, pr.workplace_visibility, pr.birthday_visibility, pr.location_visibility
       FROM profiles p
       JOIN user_roles r ON r.user_id = p.id
       JOIN profile_privacy pr ON pr.user_id = p.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY CASE WHEN p.membership_status = 'pending' THEN 0 ELSE 1 END, p.full_name ASC`
    )
    .all(...params);

  res.json({ members: rows });
});

app.patch('/api/admin/members/:id/status', requireAdmin, (req: AuthRequest, res) => {
  const targetId = req.params.id;
  const nextStatus = sanitizeText(req.body?.membership_status, 30);

  if (!['approved', 'rejected', 'suspended', 'pending'].includes(nextStatus)) {
    res.status(400).json({ error: 'Invalid membership status.' });
    return;
  }

  if (targetId === req.authUser!.id && nextStatus !== 'approved') {
    res.status(400).json({ error: 'Administrators cannot suspend or deactivate their own active session.' });
    return;
  }

  const target = db.prepare('SELECT id, full_name FROM profiles WHERE id = ?').get(targetId) as
    | { id: string; full_name: string }
    | undefined;
  if (!target) {
    res.status(404).json({ error: 'Member not found.' });
    return;
  }

  db.prepare(`UPDATE profiles SET membership_status = ?, updated_at = datetime('now') WHERE id = ?`).run(
    nextStatus,
    targetId
  );
  logActivity(req.authUser!.id, `member_status_${nextStatus}`, `Updated ${target.full_name} to ${nextStatus}`);

  res.json({ ok: true, membership_status: nextStatus });
});

app.patch('/api/admin/members/:id', requireAdmin, (req: AuthRequest, res) => {
  const targetId = req.params.id;
  const existing = db.prepare('SELECT id FROM profiles WHERE id = ?').get(targetId);
  if (!existing) {
    res.status(404).json({ error: 'Member not found.' });
    return;
  }

  const fullName = sanitizeText(req.body?.full_name, 120);
  const rawPhone = sanitizeText(req.body?.phone_number, 40);
  const phone = normalizePhoneNumber(rawPhone);
  const dob = sanitizeText(req.body?.date_of_birth, 20);
  const country = sanitizeText(req.body?.country, 80);
  const state = sanitizeText(req.body?.state, 80);
  const city = sanitizeText(req.body?.city, 80);
  const lga = sanitizeText(req.body?.lga, 80);
  const streetAddress = sanitizeText(req.body?.street_address, 160);
  const rawLocation = sanitizeText(req.body?.residential_location, 160);
  const assembledLocation = [streetAddress, lga, city, state, country].filter(Boolean).join(', ');
  const location = assembledLocation || rawLocation;
  const occupation = sanitizeText(req.body?.occupation, 120);
  const workplace = sanitizeText(req.body?.workplace, 160);
  const designation = sanitizeText(req.body?.professional_designation, 120);
  const skills = sanitizeText(req.body?.skills, 300);
  const category = sanitizeText(req.body?.membership_category, 80);
  const responsibilities = sanitizeText(req.body?.fellowship_responsibilities, 200);
  const biography = sanitizeText(req.body?.biography, 1000);

  if (fullName.length < 2) {
    res.status(400).json({ error: 'Full name is required.' });
    return;
  }
  if (!isValidPhone(rawPhone)) {
    res.status(400).json({ error: 'Valid Nigerian or international phone number is required.' });
    return;
  }

  db.prepare(
    `UPDATE profiles
     SET full_name = ?, phone_number = ?, date_of_birth = COALESCE(NULLIF(?, ''), date_of_birth),
         country = COALESCE(NULLIF(?, ''), country),
         state = COALESCE(NULLIF(?, ''), state),
         city = COALESCE(NULLIF(?, ''), city),
         lga = ?,
         street_address = ?,
         residential_location = ?, occupation = ?, workplace = ?, professional_designation = ?,
         skills = ?, membership_category = ?, fellowship_responsibilities = ?, biography = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    fullName,
    phone,
    dob,
    country,
    state,
    city,
    lga || null,
    streetAddress || null,
    location || null,
    occupation || null,
    workplace || null,
    designation || null,
    skills || null,
    category || null,
    responsibilities || null,
    biography || null,
    targetId
  );

  if (req.body?.privacy) {
    const standardOptions = ['members', 'admins_only', 'private'];
    const birthdayOptions = ['day_month', 'full_date', 'admins_only', 'private'];
    const cur = db
      .prepare(
        `SELECT phone_visibility, email_visibility, workplace_visibility, birthday_visibility, location_visibility
         FROM profile_privacy WHERE user_id = ?`
      )
      .get(targetId) as RawPrivacyRow;

    db.prepare(
      `UPDATE profile_privacy
       SET phone_visibility = ?, email_visibility = ?, workplace_visibility = ?,
           birthday_visibility = ?, location_visibility = ?, updated_at = datetime('now')
       WHERE user_id = ?`
    ).run(
      validateVisibility(req.body.privacy.phone_visibility, standardOptions, cur.phone_visibility),
      validateVisibility(req.body.privacy.email_visibility, standardOptions, cur.email_visibility),
      validateVisibility(req.body.privacy.workplace_visibility, standardOptions, cur.workplace_visibility),
      validateVisibility(req.body.privacy.birthday_visibility, birthdayOptions, cur.birthday_visibility),
      validateVisibility(req.body.privacy.location_visibility, standardOptions, cur.location_visibility),
      targetId
    );
  }

  logActivity(req.authUser!.id, 'admin_member_edited', `Edited member record ${fullName}`);
  res.json({ ok: true });
});

app.patch('/api/admin/members/:id/role', requireAdmin, (req: AuthRequest, res) => {
  const targetId = req.params.id;
  const nextRole = sanitizeText(req.body?.role, 20);

  if (nextRole !== 'admin' && nextRole !== 'member') {
    res.status(400).json({ error: 'Invalid role specified.' });
    return;
  }

  const target = db
    .prepare(
      `SELECT p.id, p.full_name, p.membership_status, r.role
       FROM profiles p JOIN user_roles r ON r.user_id = p.id
       WHERE p.id = ?`
    )
    .get(targetId) as { id: string; full_name: string; membership_status: string; role: string } | undefined;

  if (!target) {
    res.status(404).json({ error: 'Member not found.' });
    return;
  }

  if (nextRole === 'admin' && target.membership_status !== 'approved') {
    res.status(400).json({ error: 'Only approved members can be granted administrator privileges.' });
    return;
  }

  if (target.role === 'admin' && nextRole === 'member' && getSafeAdminCount() <= 1) {
    res.status(400).json({ error: 'Cannot remove the last remaining administrator.' });
    return;
  }

  db.prepare('UPDATE user_roles SET role = ? WHERE user_id = ?').run(nextRole, targetId);
  logActivity(req.authUser!.id, 'admin_role_changed', `Assigned role '${nextRole}' to ${target.full_name}`);
  res.json({ ok: true, role: nextRole });
});

app.post('/api/admin/members/:id/reset-token', requireAdmin, (req: AuthRequest, res) => {
  const targetId = req.params.id;
  const target = db
    .prepare('SELECT u.id, p.full_name, u.email FROM users u LEFT JOIN profiles p ON p.id = u.id WHERE u.id = ?')
    .get(targetId) as { id: string; full_name: string | null; email: string } | undefined;

  if (!target) {
    res.status(404).json({ error: 'Member account not found.' });
    return;
  }

  const rawToken = crypto.randomBytes(24).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  db.prepare('INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)').run(
    crypto.randomUUID(),
    target.id,
    tokenHash,
    expiresAt
  );
  logActivity(
    req.authUser!.id,
    'admin_issued_password_reset',
    `Issued 30-minute reset token for ${target.full_name || target.email}`
  );

  res.json({
    reset_token: rawToken,
    expires_at: expiresAt,
    email: target.email,
  });
});

app.get('/api/admin/members/export', requireAdmin, (req: AuthRequest, res) => {
  const rows = db
    .prepare(
      `SELECT p.full_name, p.email, p.phone_number, p.membership_status, r.role,
              p.occupation, p.workplace, p.professional_designation,
              p.street_address, p.lga, p.city, p.state, p.country, p.residential_location,
              p.membership_category, p.date_of_joining, p.created_at
       FROM profiles p
       JOIN user_roles r ON r.user_id = p.id
       ORDER BY p.full_name ASC`
    )
    .all() as Array<Record<string, unknown>>;

  const headers = [
    'Full Name',
    'Email',
    'Phone Number',
    'Status',
    'Role',
    'Occupation',
    'Workplace',
    'Designation',
    'Street Address',
    'LGA',
    'City',
    'State',
    'Country',
    'Residential Location',
    'Category',
    'Date Joined',
    'Registered At',
  ];

  const lines = [
    headers.map(neutralizeCsvCell).join(','),
    ...rows.map((r) =>
      [
        r.full_name,
        r.email,
        r.phone_number,
        r.membership_status,
        r.role,
        r.occupation,
        r.workplace,
        r.professional_designation,
        r.street_address,
        r.lga,
        r.city,
        r.state,
        r.country,
        r.residential_location,
        r.membership_category,
        r.date_of_joining,
        r.created_at,
      ]
        .map(neutralizeCsvCell)
        .join(',')
    ),
  ];

  logActivity(req.authUser!.id, 'member_records_exported', `Exported ${rows.length} member records`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="fellowship-members.csv"');
  res.send(lines.join('\n'));
});

app.get('/api/admin/announcements', requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT a.*, p.full_name as author_name
       FROM announcements a
       JOIN profiles p ON p.id = a.created_by
       ORDER BY a.is_pinned DESC, a.created_at DESC`
    )
    .all();
  res.json({ announcements: rows });
});

app.post('/api/admin/announcements', requireAdmin, upload.single('image'), (req: AuthRequest, res) => {
  const title = sanitizeText(req.body?.title, 180);
  const content = sanitizeText(req.body?.content, 4000);
  const isPinned = req.body?.is_pinned === true || req.body?.is_pinned === 'true' || req.body?.is_pinned === '1' ? 1 : 0;
  const status = req.body?.status === 'draft' ? 'draft' : 'published';

  if (title.length < 3 || content.length < 10) {
    res.status(400).json({ error: 'Announcement title and full content are required.' });
    return;
  }

  let imageUrl: string | null = null;
  if (req.file) {
    try {
      imageUrl = saveValidatedImage(req.file);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid announcement image.' });
      return;
    }
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO announcements (id, title, content, image_url, is_pinned, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, title, content, imageUrl, isPinned, status, req.authUser!.id);

  logActivity(req.authUser!.id, 'announcement_created', `${status}: ${title}`);
  res.status(201).json({ id, ok: true });
});

app.patch('/api/admin/announcements/:id', requireAdmin, upload.single('image'), (req: AuthRequest, res) => {
  const announcementId = req.params.id;
  const existing = db.prepare('SELECT * FROM announcements WHERE id = ?').get(announcementId) as
    | { id: string; title: string; content: string; image_url: string | null; is_pinned: number; status: string }
    | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Announcement not found.' });
    return;
  }

  const title = req.body?.title !== undefined ? sanitizeText(req.body.title, 180) : existing.title;
  const content = req.body?.content !== undefined ? sanitizeText(req.body.content, 4000) : existing.content;
  const isPinned =
    req.body?.is_pinned !== undefined
      ? req.body.is_pinned === true || req.body.is_pinned === 'true' || req.body.is_pinned === 1
        ? 1
        : 0
      : existing.is_pinned;
  const status =
    req.body?.status === 'draft' || req.body?.status === 'published' ? req.body.status : existing.status;

  let imageUrl = existing.image_url;
  if (req.body?.remove_image === 'true') {
    imageUrl = null;
  }
  if (req.file) {
    try {
      imageUrl = saveValidatedImage(req.file);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid image file.' });
      return;
    }
  }

  db.prepare(
    `UPDATE announcements
     SET title = ?, content = ?, image_url = ?, is_pinned = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(title, content, imageUrl, isPinned, status, announcementId);

  logActivity(req.authUser!.id, 'announcement_updated', title);
  res.json({ ok: true });
});

app.delete('/api/admin/announcements/:id', requireAdmin, (req: AuthRequest, res) => {
  const announcementId = req.params.id;
  const existing = db.prepare('SELECT title FROM announcements WHERE id = ?').get(announcementId) as
    | { title: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Announcement not found.' });
    return;
  }
  db.prepare('DELETE FROM announcements WHERE id = ?').run(announcementId);
  logActivity(req.authUser!.id, 'announcement_deleted', existing.title);
  res.json({ ok: true });
});

app.get('/api/admin/settings', requireAdmin, (_req, res) => {
  const settings = getSettingsRow();
  const admins = db
    .prepare(
      `SELECT p.id, p.full_name, p.email, p.professional_designation, r.created_at
       FROM profiles p
       JOIN user_roles r ON r.user_id = p.id
       WHERE r.role = 'admin'
       ORDER BY p.full_name ASC`
    )
    .all();

  res.json({ settings, admins });
});

app.patch('/api/admin/settings', requireAdmin, (req: AuthRequest, res) => {
  const cur = getSettingsRow();
  const standardOptions = ['members', 'admins_only', 'private'];
  const birthdayOptions = ['day_month', 'full_date', 'admins_only', 'private'];

  const fellowshipName = sanitizeText(req.body?.fellowship_name, 120) || String(cur.fellowship_name);
  const tagline = sanitizeText(req.body?.tagline, 160) || String(cur.tagline);
  const description = sanitizeText(req.body?.description, 1000) || String(cur.description);
  const meetingSchedule = sanitizeText(req.body?.meeting_schedule, 160) || String(cur.meeting_schedule);
  const meetingLocation = sanitizeText(req.body?.meeting_location, 160) || String(cur.meeting_location);

  const defPhone = validateVisibility(
    req.body?.default_phone_visibility,
    standardOptions,
    String(cur.default_phone_visibility)
  );
  const defEmail = validateVisibility(
    req.body?.default_email_visibility,
    standardOptions,
    String(cur.default_email_visibility)
  );
  const defWorkplace = validateVisibility(
    req.body?.default_workplace_visibility,
    standardOptions,
    String(cur.default_workplace_visibility)
  );
  const defBirthday = validateVisibility(
    req.body?.default_birthday_visibility,
    birthdayOptions,
    String(cur.default_birthday_visibility)
  );
  const defLocation = validateVisibility(
    req.body?.default_location_visibility,
    standardOptions,
    String(cur.default_location_visibility)
  );

  db.prepare(
    `UPDATE fellowship_settings
     SET fellowship_name = ?, tagline = ?, description = ?, meeting_schedule = ?, meeting_location = ?,
         default_phone_visibility = ?, default_email_visibility = ?, default_workplace_visibility = ?,
         default_birthday_visibility = ?, default_location_visibility = ?, updated_at = datetime('now')
     WHERE id = 'default'`
  ).run(
    fellowshipName,
    tagline,
    description,
    meetingSchedule,
    meetingLocation,
    defPhone,
    defEmail,
    defWorkplace,
    defBirthday,
    defLocation
  );

  logActivity(req.authUser!.id, 'fellowship_settings_updated');
  res.json({ settings: getSettingsRow() });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'Uploaded image exceeds the 5 MB file size limit.' });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

// ---------------------------------------------------------------------------
// VITE DEV MIDDLEWARE / PRODUCTION STATIC HOSTING
// ---------------------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.get('/@vite/client', async (_req, res, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (!result) {
          next();
          return;
        }
        const safeCode = result.code.replace(
          /transport\.connect\([^;]*\);?/g,
          '/* HMR WebSocket disabled */'
        );
        res.type('application/javascript').send(safeCode);
      } catch (err) {
        next(err);
      }
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Men's Fellowship Portal listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
