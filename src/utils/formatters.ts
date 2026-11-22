export const NIGERIAN_STATES = [
  'Abia State',
  'Adamawa State',
  'Akwa Ibom State',
  'Anambra State',
  'Bauchi State',
  'Bayelsa State',
  'Benue State',
  'Borno State',
  'Cross River State',
  'Delta State',
  'Ebonyi State',
  'Edo State',
  'Ekiti State',
  'Enugu State',
  'FCT Abuja',
  'Gombe State',
  'Imo State',
  'Jigawa State',
  'Kaduna State',
  'Kano State',
  'Katsina State',
  'Kebbi State',
  'Kogi State',
  'Kwara State',
  'Lagos State',
  'Nasarawa State',
  'Niger State',
  'Ogun State',
  'Ondo State',
  'Osun State',
  'Oyo State',
  'Plateau State',
  'Rivers State',
  'Sokoto State',
  'Taraba State',
  'Yobe State',
  'Zamfara State',
] as const;

export const COUNTRY_CODES = [
  { code: '+234', country: 'Nigeria', iso: 'NG' },
  { code: '+44', country: 'United Kingdom', iso: 'GB' },
  { code: '+233', country: 'Ghana', iso: 'GH' },
  { code: '+27', country: 'South Africa', iso: 'ZA' },
  { code: '+1', country: 'United States / Canada', iso: 'US' },
] as const;

/**
 * Formats a date string or Date as DD/MM/YYYY in Africa/Lagos timezone.
 */
export function formatDateDDMMYYYY(value: string | Date | null | undefined): string {
  if (!value) return '—';
  // If YYYY-MM-DD date-only string, preserve calendar day without UTC shift
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [year, month, day] = value.trim().split('-');
    return `${day}/${month}/${year}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  }).formatToParts(date);
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const year = parts.find((p) => p.type === 'year')?.value || '2026';
  return `${day}/${month}/${year}`;
}

/**
 * Formats a month-day string ("MM-DD") in Nigerian English, e.g. "28 November".
 */
export function formatMonthDayNG(mmdd: string): string {
  const [m, d] = mmdd.split('-').map(Number);
  if (!m || !d) return mmdd;
  return new Date(Date.UTC(2026, m - 1, d)).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

/**
 * Formats a full date in Nigerian English, e.g. "22 November 2026".
 */
export function formatLongDateNG(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  });
}

/**
 * Formats an amount in Nigerian Naira (₦), e.g. ₦50,000.00.
 */
export function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a Nigerian phone number cleanly without duplicating +234.
 */
export function normalizeNigerianPhoneClient(rawInput: string, dialCode = '+234'): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';
  const digits = trimmed.replace(/\D/g, '');

  if (dialCode === '+234') {
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
    return trimmed.startsWith('+') ? trimmed : `+234 ${local}`;
  }

  if (trimmed.startsWith('+')) return trimmed;
  return `${dialCode} ${digits}`;
}

export function isValidNigerianOrIntlPhone(rawInput: string, dialCode = '+234'): boolean {
  const digits = rawInput.replace(/\D/g, '');
  if (dialCode === '+234' || rawInput.trim().startsWith('+234') || rawInput.trim().startsWith('0')) {
    let local = digits;
    if (local.startsWith('234')) local = local.slice(3);
    if (local.startsWith('0')) local = local.slice(1);
    return /^[789][01]\d{8}$/.test(local);
  }
  return digits.length >= 7 && digits.length <= 15;
}

export function formatFullAddress(parts: {
  street_address?: string | null;
  lga?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  residential_location?: string | null;
}): string | null {
  const segments = [
    parts.street_address?.trim(),
    parts.lga?.trim(),
    parts.city?.trim(),
    parts.state?.trim(),
    parts.country?.trim(),
  ].filter(Boolean);
  if (segments.length > 0) return segments.join(', ');
  return parts.residential_location?.trim() || null;
}
