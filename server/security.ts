import crypto from 'crypto';

const IN_MEMORY_SESSION_KEY = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : IN_MEMORY_SESSION_KEY;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function generateOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface SessionPayload {
  sub: string;
  role: 'admin' | 'member';
  iat: number;
  exp: number;
}

export function createSessionToken(userId: string, role: 'admin' | 'member', ttlSeconds = 60 * 60 * 24 * 7): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: userId,
    role,
    iat: now,
    exp: now + ttlSeconds,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedPayload, sig] = parts;
    if (!encodedPayload || !sig) return null;
    const expectedSig = crypto
      .createHmac('sha256', getSessionSecret())
      .update(encodedPayload)
      .digest('base64url');
    const sigBuf = Buffer.from(sig, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SessionPayload;
    if (!decoded || typeof decoded.sub !== 'string' || typeof decoded.exp !== 'number') {
      return null;
    }
    if (decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function detectImageExtension(buffer: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buffer.length < 12) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }
  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.trim().length <= 160;
}

export function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.trim();
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';

  // Handle local Nigerian 11-digit format (e.g. 08031234567) or 234-prefixed 13-digit format
  if (
    cleaned.startsWith('+234') ||
    cleaned.startsWith('234') ||
    (cleaned.startsWith('0') && digits.length === 11) ||
    (/^[789][01]\d{8}$/.test(digits))
  ) {
    let local = digits;
    if (local.startsWith('234') && local.length >= 13) {
      local = local.slice(3);
    }
    if (local.startsWith('0') && local.length === 11) {
      local = local.slice(1);
    }
    if (local.length === 10) {
      return `+234 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
    }
  }

  return cleaned.startsWith('+') ? cleaned : `+${digits}`;
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.trim();
  const digits = cleaned.replace(/\D/g, '');
  if (!/^[+\d\s().-]+$/.test(cleaned)) return false;

  // Strict check for Nigerian numbers
  if (cleaned.startsWith('+234') || cleaned.startsWith('234') || (cleaned.startsWith('0') && digits.length === 11)) {
    let local = digits;
    if (local.startsWith('234')) local = local.slice(3);
    if (local.startsWith('0')) local = local.slice(1);
    return /^[789][01]\d{8}$/.test(local);
  }

  return digits.length >= 7 && digits.length <= 15;
}

export function isValidDateOfBirth(dob: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
  const parsed = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  const year = parsed.getUTCFullYear();
  const currentYear = new Date().getUTCFullYear();
  return year >= 1910 && year <= currentYear - 13;
}

export function sanitizeText(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export function neutralizeCsvCell(value: unknown): string {
  const str = String(value ?? '').replace(/\r?\n/g, ' ');
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

export interface RawProfileRow {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  profile_image: string | null;
  date_of_birth: string | null;
  gender: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  lga?: string | null;
  street_address?: string | null;
  residential_location: string | null;
  occupation: string | null;
  workplace: string | null;
  professional_designation: string | null;
  skills: string | null;
  membership_category: string | null;
  date_of_joining: string | null;
  fellowship_responsibilities: string | null;
  biography: string | null;
  membership_status: string;
  created_at: string;
  updated_at: string;
  role?: string;
}

export interface RawPrivacyRow {
  phone_visibility: string;
  email_visibility: string;
  workplace_visibility: string;
  birthday_visibility: string;
  location_visibility: string;
}

export function canViewField(
  visibility: string | undefined,
  viewerId: string,
  targetId: string,
  viewerRole: 'admin' | 'member'
): boolean {
  if (viewerId === targetId || viewerRole === 'admin') return true;
  return visibility === 'members';
}

export function applyMemberPrivacy(
  profile: RawProfileRow,
  privacy: RawPrivacyRow,
  viewerId: string,
  viewerRole: 'admin' | 'member'
) {
  const isSelfOrAdmin = viewerId === profile.id || viewerRole === 'admin';
  const showPhone = canViewField(privacy.phone_visibility, viewerId, profile.id, viewerRole);
  const showEmail = canViewField(privacy.email_visibility, viewerId, profile.id, viewerRole);
  const showWorkplace = canViewField(privacy.workplace_visibility, viewerId, profile.id, viewerRole);
  const showLocation = canViewField(privacy.location_visibility, viewerId, profile.id, viewerRole);

  let visibleDob: string | null = null;
  let birthMonthDay: string | null = null;

  if (profile.date_of_birth) {
    const [, month, day] = profile.date_of_birth.split('-');
    if (isSelfOrAdmin || privacy.birthday_visibility === 'full_date') {
      visibleDob = profile.date_of_birth;
      birthMonthDay = `${month}-${day}`;
    } else if (privacy.birthday_visibility === 'day_month') {
      visibleDob = null;
      birthMonthDay = `${month}-${day}`;
    }
  }

  return {
    id: profile.id,
    full_name: profile.full_name,
    email: showEmail ? profile.email : null,
    phone_number: showPhone ? profile.phone_number : null,
    profile_image: profile.profile_image,
    date_of_birth: visibleDob,
    birth_month_day: birthMonthDay,
    gender: profile.gender,
    country: showLocation ? (profile.country ?? 'Nigeria') : null,
    state: showLocation ? (profile.state ?? 'Imo State') : null,
    city: showLocation ? (profile.city ?? null) : null,
    lga: showLocation ? (profile.lga ?? null) : null,
    street_address: showLocation ? (profile.street_address ?? null) : null,
    residential_location: showLocation ? profile.residential_location : null,
    occupation: profile.occupation,
    workplace: showWorkplace ? profile.workplace : null,
    professional_designation: profile.professional_designation,
    skills: profile.skills,
    membership_category: profile.membership_category,
    date_of_joining: profile.date_of_joining,
    fellowship_responsibilities: profile.fellowship_responsibilities,
    biography: profile.biography,
    membership_status: profile.membership_status,
    role: profile.role ?? 'member',
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    privacy_summary: {
      phone_visible: showPhone,
      email_visible: showEmail,
      workplace_visible: showWorkplace,
      location_visible: showLocation,
      birthday_mode: isSelfOrAdmin ? 'full_date' : privacy.birthday_visibility,
    },
  };
}
