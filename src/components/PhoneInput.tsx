import React, { useEffect, useState } from 'react';
import { COUNTRY_CODES, normalizeNigerianPhoneClient } from '../utils/formatters';

interface PhoneInputProps {
  id: string;
  value: string;
  onChange: (normalizedValue: string) => void;
  required?: boolean;
  className?: string;
}

function NigeriaFlagIcon() {
  return (
    <svg
      width="18"
      height="12"
      viewBox="0 0 18 12"
      fill="none"
      aria-hidden="true"
      className="rounded-[2px] border border-slate-200 shrink-0"
    >
      <rect width="6" height="12" fill="#008751" />
      <rect x="6" width="6" height="12" fill="#FFFFFF" />
      <rect x="12" width="6" height="12" fill="#008751" />
    </svg>
  );
}

function extractLocalPart(fullValue: string, dialCode: string): string {
  const trimmed = fullValue.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith(dialCode)) {
    return trimmed.slice(dialCode.length).trim();
  }
  const digits = trimmed.replace(/\D/g, '');
  if (dialCode === '+234' && digits.startsWith('234') && digits.length > 10) {
    return digits.slice(3);
  }
  return trimmed;
}

export function PhoneInput({ id, value, onChange, required = false, className = '' }: PhoneInputProps) {
  const detectInitialCode = (val: string) => {
    const matched = COUNTRY_CODES.find((c) => c.code !== '+1' && val.trim().startsWith(c.code));
    if (matched) return matched.code;
    if (val.trim().startsWith('+1 ')) return '+1';
    return '+234';
  };

  const [dialCode, setDialCode] = useState<string>(() => detectInitialCode(value));
  const [localInput, setLocalInput] = useState<string>(() => extractLocalPart(value, detectInitialCode(value)));

  useEffect(() => {
    const detected = detectInitialCode(value);
    setDialCode(detected);
    setLocalInput(extractLocalPart(value, detected));
  }, [value]);

  const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalInput(raw);

    if (!raw.trim()) {
      onChange('');
      return;
    }

    // Prevent double +234 prefix if user pastes +234803... or 0803...
    if (dialCode === '+234') {
      const digits = raw.replace(/\D/g, '');
      let cleanLocal = digits;
      if (cleanLocal.startsWith('234') && cleanLocal.length >= 13) {
        cleanLocal = cleanLocal.slice(3);
      } else if (cleanLocal.startsWith('0') && cleanLocal.length === 11) {
        cleanLocal = cleanLocal.slice(1);
      }
      if (cleanLocal.length === 10) {
        onChange(normalizeNigerianPhoneClient(cleanLocal, '+234'));
        return;
      }
      onChange(`+234 ${cleanLocal}`);
      return;
    }

    onChange(normalizeNigerianPhoneClient(raw, dialCode));
  };

  const handleBlur = () => {
    if (!localInput.trim()) return;
    const normalized = normalizeNigerianPhoneClient(localInput, dialCode);
    onChange(normalized);
    setLocalInput(extractLocalPart(normalized, dialCode));
  };

  const handleCodeChange = (nextCode: string) => {
    setDialCode(nextCode);
    if (localInput.trim()) {
      onChange(normalizeNigerianPhoneClient(localInput, nextCode));
    }
  };

  return (
    <div className={`mt-1 flex rounded-lg border border-slate-300 bg-white overflow-hidden focus-within:border-[#4B1C6F] ${className}`}>
      <div className="flex items-center gap-1.5 border-r border-slate-200 bg-slate-50 px-2.5 shrink-0">
        {dialCode === '+234' && <NigeriaFlagIcon />}
        <select
          aria-label="Country calling code"
          value={dialCode}
          onChange={(e) => handleCodeChange(e.target.value)}
          className="bg-transparent py-2 text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.iso} value={c.code}>
              {c.code} ({c.iso})
            </option>
          ))}
        </select>
      </div>
      <input
        id={id}
        type="tel"
        required={required}
        value={localInput}
        onChange={handleLocalChange}
        onBlur={handleBlur}
        placeholder={dialCode === '+234' ? '803 123 4567 or 08031234567' : 'Phone number'}
        className="w-full min-h-[42px] px-3 py-2 text-sm text-slate-900 font-mono-num focus:outline-none"
      />
    </div>
  );
}
