import { ArrowLeft, CheckCircle2, Clock, Eye, EyeOff, Lock, Shield, Upload } from 'lucide-react';
import React, { useState } from 'react';
import { PhoneInput } from '../components/PhoneInput';
import { useAuth } from '../context/AuthContext';
import { ApiError, apiFetch } from '../services/api';
import { AppRoute } from '../types';
import { isValidNigerianOrIntlPhone, NIGERIAN_STATES } from '../utils/formatters';

interface AuthNavProps {
  onNavigate: (route: AppRoute) => void;
  postLoginRoute?: AppRoute;
}

function PasswordInput({
  id,
  name,
  value,
  onChange,
  autoComplete,
  placeholder,
  required = false,
  minLength,
  className = '',
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password' | 'off';
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white pl-3.5 pr-11 py-2 text-sm text-slate-900 focus:border-[#4B1C6F] focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-[#4B1C6F]"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function AuthFrame({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const { publicInfo } = useAuth();
  const fellowshipName = publicInfo?.fellowship_name || 'DUNAMIS INTERNATIONAL GOSPEL CENTRE, OWERRI';
  const logoUrl = publicInfo?.logo_url || '/src/assets/images/dunamis_owerri_logo_1795268208018.jpg';
  return (
    <div className="relative min-h-screen bg-[#FAF9F6] flex flex-col justify-between px-4 py-8 sm:px-6 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none select-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
      >
        <img
          src={logoUrl}
          alt=""
          className="w-[380px] sm:w-[500px] max-w-[82vw] rounded-full object-cover opacity-[0.05] grayscale-[15%]"
        />
      </div>

      <div className="relative z-10 max-w-xl w-full mx-auto">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[40px] items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#4B1C6F] transition-colors"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="truncate">Back to {fellowshipName}</span>
        </button>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-xs p-6 sm:p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-3 pb-5 mb-5 border-b border-slate-100">
            <img
              src={logoUrl}
              alt={`${fellowshipName} logo`}
              referrerPolicy="no-referrer"
              className="h-11 w-11 rounded-lg object-cover border border-[#4B1C6F]/25 bg-[#3B1557] shrink-0"
            />
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-slate-900 leading-snug">{fellowshipName}</p>
              <p className="text-xs text-[#B47B07] font-medium truncate">Men&apos;s Fellowship Portal · Owerri, Nigeria</p>
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-600">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>

      <footer className="relative z-10 mt-8 text-center text-xs text-slate-500">
        {fellowshipName} · Men&apos;s Fellowship
      </footer>
    </div>
  );
}

const ADMIN_ONLY_ROUTES: AppRoute[] = [
  'admin-dashboard',
  'admin-members',
  'admin-announcements',
  'admin-settings',
];

export function LoginPage({ onNavigate, postLoginRoute }: AuthNavProps) {
  const { loginWithToken, publicInfo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setError('Please enter both your email address and password.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<{ token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          remember_me: rememberMe,
        }),
      });
      const profile = await loginWithToken(res.token);
      if (!profile) {
        setError('Signed in, but unable to load your profile session. Please try refreshing the page.');
      } else if (profile.membership_status === 'approved') {
        const canUseRequested =
          postLoginRoute &&
          postLoginRoute !== 'pending' &&
          postLoginRoute !== 'unauthorized' &&
          (!ADMIN_ONLY_ROUTES.includes(postLoginRoute) || profile.role === 'admin');
        onNavigate(canUseRequested ? postLoginRoute : profile.role === 'admin' ? 'admin-dashboard' : 'directory');
      } else {
        onNavigate('pending');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFrame
      title="Member Sign In"
      subtitle="Access the private directory, announcements, and fellowship updates."
      onBack={() => onNavigate('landing')}
    >
      <form onSubmit={handleSubmit} method="post" className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-2">
            <p>{error}</p>
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => onNavigate('forgot-password')}
                className="text-[#4B1C6F] hover:underline"
              >
                Reset forgotten password
              </button>
              <button
                type="button"
                onClick={() => onNavigate('register')}
                className="text-[#4B1C6F] hover:underline"
              >
                Create a member account
              </button>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-slate-700">
            Email Address
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            required
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1.5 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-[#4B1C6F] focus:outline-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <button
              type="button"
              onClick={() => onNavigate('forgot-password')}
              className="text-xs font-medium text-[#4B1C6F] hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <PasswordInput
            id="login-password"
            name="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            placeholder="Enter your password"
            className="mt-1.5"
          />
        </div>

        <label htmlFor="login-remember" className="flex items-start gap-2.5 cursor-pointer select-none pt-0.5">
          <input
            id="login-remember"
            name="remember_me"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#4B1C6F] focus:ring-[#4B1C6F]"
          />
          <span className="text-xs leading-relaxed text-slate-600">
            <span className="font-medium text-slate-800">Remember me</span> on this browser
          </span>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[44px] rounded-lg bg-[#4B1C6F] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#3A1458] disabled:opacity-60 transition-colors"
        >
          {submitting ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-slate-600">
        <span>
          New to the fellowship?{' '}
          <button
            type="button"
            onClick={() => onNavigate('register')}
            className="font-semibold text-[#4B1C6F] hover:underline"
          >
            Create a member account
          </button>
        </span>
        {(publicInfo?.needs_admin_setup || publicInfo?.requires_bootstrap_passcode) && (
          <button
            type="button"
            onClick={() => onNavigate('admin-setup')}
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            Initial Admin Setup
          </button>
        )}
      </div>
    </AuthFrame>
  );
}

export function RegisterPage({ onNavigate }: AuthNavProps) {
  const { loginWithToken } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [country, setCountry] = useState('Nigeria');
  const [stateName, setStateName] = useState('Imo State');
  const [city, setCity] = useState('Owerri');
  const [lga, setLga] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [occupation, setOccupation] = useState('');
  const [workplace, setWorkplace] = useState('');
  const [designation, setDesignation] = useState('');
  const [skills, setSkills] = useState('');

  const [category, setCategory] = useState('General Member');
  const [dateOfJoining, setDateOfJoining] = useState(new Date().toISOString().slice(0, 10));
  const [responsibilities, setResponsibilities] = useState('');
  const [biography, setBiography] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please upload a JPEG, PNG, or WebP photograph.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Profile photograph must be smaller than 5 MB.');
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const goNext = () => {
    setError(null);
    if (step === 1) {
      if (fullName.trim().length < 2) {
        setError('Please enter your full name.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError('Please enter a valid email address.');
        return;
      }
      if (!isValidNigerianOrIntlPhone(phone)) {
        setError('Please enter a valid Nigerian mobile number (e.g. 08031234567 or +234 803 123 4567) or international number.');
        return;
      }
      if (!dob) {
        setError('Please provide your date of birth.');
        return;
      }
      if (!country.trim() || !stateName.trim() || !city.trim()) {
        setError('Please provide your country, state, and city or town.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!occupation.trim()) {
        setError('Please enter your occupation or trade.');
        return;
      }
      setStep(3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const assembledLocation = [streetAddress.trim(), lga.trim(), city.trim(), stateName.trim(), country.trim()]
        .filter(Boolean)
        .join(', ');
      const formData = new FormData();
      formData.append('full_name', fullName.trim());
      formData.append('email', email.trim());
      formData.append('phone_number', phone.trim());
      formData.append('date_of_birth', dob);
      formData.append('gender', gender);
      formData.append('country', country.trim());
      formData.append('state', stateName.trim());
      formData.append('city', city.trim());
      formData.append('lga', lga.trim());
      formData.append('street_address', streetAddress.trim());
      formData.append('residential_location', assembledLocation);
      formData.append('occupation', occupation.trim());
      formData.append('workplace', workplace.trim());
      formData.append('professional_designation', designation.trim());
      formData.append('skills', skills.trim());
      formData.append('membership_category', category);
      formData.append('date_of_joining', dateOfJoining);
      formData.append('fellowship_responsibilities', responsibilities.trim());
      formData.append('biography', biography.trim());
      formData.append('password', password);
      if (photoFile) {
        formData.append('profile_photo', photoFile);
      }

      const res = await apiFetch<{ token: string }>('/api/auth/register', {
        method: 'POST',
        body: formData,
      });
      await loginWithToken(res.token);
      onNavigate('pending');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to submit registration.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFrame
      title="Member Registration"
      subtitle="Submit your profile for fellowship directory review. An administrator will verify your registration before granting access."
      onBack={() => onNavigate('landing')}
    >
      {/* Step Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-2">
          <span>Step {step} of 3</span>
          <span>
            {step === 1 && 'Personal Details'}
            {step === 2 && 'Professional & Skills'}
            {step === 3 && 'Fellowship & Security'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-colors ${s <= step ? 'bg-[#4B1C6F]' : 'bg-slate-200'}`}
            />
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {step === 1 && (
          <>
            <div className="flex items-center gap-4 pb-2">
              <div className="h-16 w-16 rounded-xl border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                {photoPreview ? (
                  <img src={photoPreview} alt="Selected portrait preview" className="h-full w-full object-cover" />
                ) : (
                  <Upload className="h-5 w-5 text-slate-400" />
                )}
              </div>
              <div className="flex-1">
                <label
                  htmlFor="reg-photo"
                  className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>{photoFile ? 'Change Photograph' : 'Upload Profile Photo'}</span>
                </label>
                <input
                  id="reg-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  className="sr-only"
                />
                <p className="mt-1 text-xs text-slate-500">JPEG, PNG, or WebP up to 5 MB.</p>
              </div>
            </div>

            <div>
              <label htmlFor="reg-name" className="block text-sm font-medium text-slate-700">
                Full Name *
              </label>
              <input
                id="reg-name"
                name="full_name"
                type="text"
                required
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700">
                  Email Address *
                </label>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="reg-phone" className="block text-sm font-medium text-slate-700">
                  Mobile Number *
                </label>
                <PhoneInput id="reg-phone" required value={phone} onChange={setPhone} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reg-dob" className="block text-sm font-medium text-slate-700">
                  Date of Birth *
                </label>
                <input
                  id="reg-dob"
                  type="date"
                  required
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="reg-gender" className="block text-sm font-medium text-slate-700">
                  Gender
                </label>
                <select
                  id="reg-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
                >
                  <option value="Male">Male</option>
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Residential Address (Editable)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-country" className="block text-xs font-medium text-slate-700">
                    Country *
                  </label>
                  <input
                    id="reg-country"
                    type="text"
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Nigeria"
                    className="mt-1 block w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-[#4B1C6F] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="reg-state" className="block text-xs font-medium text-slate-700">
                    State / Province *
                  </label>
                  {country.trim().toLowerCase() === 'nigeria' ? (
                    <select
                      id="reg-state"
                      value={stateName}
                      onChange={(e) => setStateName(e.target.value)}
                      className="mt-1 block w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-[#4B1C6F] focus:outline-none"
                    >
                      {NIGERIAN_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="reg-state"
                      type="text"
                      required
                      value={stateName}
                      onChange={(e) => setStateName(e.target.value)}
                      className="mt-1 block w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-[#4B1C6F] focus:outline-none"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-city" className="block text-xs font-medium text-slate-700">
                    City / Town *
                  </label>
                  <input
                    id="reg-city"
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Owerri, Orlu, Okigwe"
                    className="mt-1 block w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-[#4B1C6F] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="reg-lga" className="block text-xs font-medium text-slate-700">
                    LGA (Optional)
                  </label>
                  <input
                    id="reg-lga"
                    type="text"
                    value={lga}
                    onChange={(e) => setLga(e.target.value)}
                    placeholder="e.g. Owerri Municipal, Owerri North"
                    className="mt-1 block w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-[#4B1C6F] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-street" className="block text-xs font-medium text-slate-700">
                  Street / Estate / Residential Area (Optional)
                </label>
                <input
                  id="reg-street"
                  type="text"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="e.g. 14 Okigwe Road, New Owerri"
                  className="mt-1 block w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-[#4B1C6F] focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={goNext}
                className="min-h-[44px] rounded-lg bg-[#4B1C6F] px-6 py-2 text-sm font-medium text-white hover:bg-[#3A1458]"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <label htmlFor="reg-occupation" className="block text-sm font-medium text-slate-700">
                Occupation / Vocation *
              </label>
              <input
                id="reg-occupation"
                type="text"
                required
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="e.g. Civil Engineer, Accountant, Teacher"
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reg-workplace" className="block text-sm font-medium text-slate-700">
                  Workplace or Business Name
                </label>
                <input
                  id="reg-workplace"
                  type="text"
                  value={workplace}
                  onChange={(e) => setWorkplace(e.target.value)}
                  className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="reg-designation" className="block text-sm font-medium text-slate-700">
                  Professional Designation
                </label>
                <input
                  id="reg-designation"
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Senior Manager"
                  className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-skills" className="block text-sm font-medium text-slate-700">
                Skills & Areas of Specialization
              </label>
              <input
                id="reg-skills"
                type="text"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="Separate with commas (e.g. Financial Planning, Carpentry, Mentoring)"
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={goNext}
                className="min-h-[44px] rounded-lg bg-[#4B1C6F] px-6 py-2 text-sm font-medium text-white hover:bg-[#3A1458]"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reg-category" className="block text-sm font-medium text-slate-700">
                  Fellowship Group / Category
                </label>
                <select
                  id="reg-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
                >
                  <option value="General Member">General Member</option>
                  <option value="Young Professionals">Young Professionals</option>
                  <option value="Small Group Leader">Small Group Leader</option>
                  <option value="Core Elders & Mentors">Core Elders & Mentors</option>
                  <option value="Senior Brotherhood">Senior Brotherhood</option>
                </select>
              </div>
              <div>
                <label htmlFor="reg-joined" className="block text-sm font-medium text-slate-700">
                  Date Joined Fellowship
                </label>
                <input
                  id="reg-joined"
                  type="date"
                  value={dateOfJoining}
                  onChange={(e) => setDateOfJoining(e.target.value)}
                  className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-resp" className="block text-sm font-medium text-slate-700">
                Fellowship Responsibilities (Optional)
              </label>
              <input
                id="reg-resp"
                type="text"
                value={responsibilities}
                onChange={(e) => setResponsibilities(e.target.value)}
                placeholder="e.g. Hospitality Team, Study Facilitator"
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="reg-bio" className="block text-sm font-medium text-slate-700">
                Short Biography (Optional)
              </label>
              <textarea
                id="reg-bio"
                rows={3}
                value={biography}
                onChange={(e) => setBiography(e.target.value)}
                placeholder="Share a brief introduction with fellow members..."
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="reg-account-email" className="block text-sm font-medium text-slate-700">
                Sign-In Email Address
              </label>
              <input
                id="reg-account-email"
                name="email"
                type="email"
                readOnly
                autoComplete="username"
                value={email.trim()}
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-700 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-500">
                You will use this email address and password to sign in after registration.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700">
                  Account Password *
                </label>
                <PasswordInput
                  id="reg-password"
                  name="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Minimum 8 characters"
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="reg-confirm" className="block text-sm font-medium text-slate-700">
                  Confirm Password *
                </label>
                <PasswordInput
                  id="reg-confirm"
                  name="confirm_password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Re-enter password"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] rounded-lg bg-[#4B1C6F] px-6 py-2 text-sm font-medium text-white hover:bg-[#3A1458] disabled:opacity-60"
              >
                {submitting ? 'Submitting Registration...' : 'Submit Registration'}
              </button>
            </div>
          </>
        )}
      </form>

      <div className="mt-6 pt-5 border-t border-slate-200 text-sm text-slate-600">
        Already registered?{' '}
        <button type="button" onClick={() => onNavigate('login')} className="font-semibold text-[#4B1C6F] hover:underline">
          Sign in here
        </button>
      </div>
    </AuthFrame>
  );
}

export function AdminBootstrapPage({ onNavigate }: AuthNavProps) {
  const { publicInfo, loginWithToken } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ token: string }>('/api/auth/bootstrap-admin', {
        method: 'POST',
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone_number: phone,
          password,
          passcode: passcode || undefined,
        }),
      });
      await loginWithToken(res.token);
      onNavigate('admin-dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to provision administrator.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFrame
      title="Initial Administrator Provisioning"
      subtitle="Create the primary administrator account for this portal. Once claimed, this setup locks automatically unless an administrator bootstrap passcode is configured on the server."
      onBack={() => onNavigate('landing')}
    >
      {!publicInfo?.needs_admin_setup && !publicInfo?.requires_bootstrap_passcode ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Shield className="h-4 w-4 text-[#4B1C6F]" />
            <span>Administrator Provisioning Locked</span>
          </div>
          <p>
            An administrator account is already active on this portal. Additional administrators can only be promoted from inside the Admin Settings panel.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="min-h-[40px] rounded-lg bg-[#4B1C6F] px-4 py-2 text-sm font-medium text-white hover:bg-[#3A1458]"
          >
            Go to Sign In
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {publicInfo?.requires_bootstrap_passcode && (
            <div>
              <label htmlFor="boot-passcode" className="block text-sm font-medium text-slate-700">
                Server Bootstrap Passcode *
              </label>
              <input
                id="boot-passcode"
                type="password"
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Matches ADMIN_BOOTSTRAP_PASSCODE"
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
              />
            </div>
          )}

          <div>
            <label htmlFor="boot-name" className="block text-sm font-medium text-slate-700">
              Administrator Full Name *
            </label>
            <input
              id="boot-name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="boot-email" className="block text-sm font-medium text-slate-700">
                Email Address *
              </label>
              <input
                id="boot-email"
                name="email"
                type="email"
                required
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="boot-phone" className="block text-sm font-medium text-slate-700">
                Phone Number (Optional)
              </label>
              <PhoneInput id="boot-phone" value={phone} onChange={setPhone} />
            </div>
          </div>

          <div>
            <label htmlFor="boot-password" className="block text-sm font-medium text-slate-700">
              Administrator Password *
            </label>
            <PasswordInput
              id="boot-password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              placeholder="Minimum 8 characters"
              className="mt-1"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[44px] rounded-lg bg-[#4B1C6F] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#3A1458] disabled:opacity-60"
          >
            {submitting ? 'Provisioning...' : 'Create Administrator Account'}
          </button>
        </form>
      )}
    </AuthFrame>
  );
}

export function ForgotPasswordPage({ onNavigate }: AuthNavProps) {
  const [email, setEmail] = useState('');
  const [submittedMsg, setSubmittedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setSubmittedMsg(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFrame
      title="Reset Your Password"
      subtitle="Enter your registered email address to initiate password recovery."
      onBack={() => onNavigate('login')}
    >
      {submittedMsg ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
            <p>{submittedMsg}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('reset-password')}
              className="min-h-[42px] rounded-lg bg-[#4B1C6F] px-4 py-2 text-sm font-medium text-white hover:bg-[#3A1458]"
            >
              Enter Reset Token
            </button>
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Return to Sign In
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-700">
              Email Address
            </label>
            <input
              id="forgot-email"
              name="email"
              type="email"
              required
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5 block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[44px] rounded-lg bg-[#4B1C6F] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#3A1458] disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : 'Request Password Reset'}
          </button>
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => onNavigate('reset-password')}
              className="text-xs font-medium text-[#4B1C6F] hover:underline"
            >
              Already have a reset token? Set new password
            </button>
          </div>
        </form>
      )}
    </AuthFrame>
  );
}

export function ResetPasswordPage({ onNavigate }: AuthNavProps) {
  const initialToken =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') || '' : '';
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: token.trim(), new_password: newPassword }),
      });
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFrame
      title="Set New Password"
      subtitle="Enter your reset token and choose a new password (minimum 8 characters)."
      onBack={() => onNavigate('login')}
    >
      {message ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            {message}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="min-h-[44px] rounded-lg bg-[#4B1C6F] px-5 py-2 text-sm font-medium text-white hover:bg-[#3A1458]"
          >
            Proceed to Sign In
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="reset-token" className="block text-sm font-medium text-slate-700">
              Reset Token
            </label>
            <input
              id="reset-token"
              name="token"
              type="text"
              required
              autoComplete="one-time-code"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste the single-use reset token"
              className="mt-1.5 block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono focus:border-[#4B1C6F] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="reset-new-password" className="block text-sm font-medium text-slate-700">
              New Password
            </label>
            <PasswordInput
              id="reset-new-password"
              name="new_password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="Minimum 8 characters"
              className="mt-1.5"
            />
          </div>
          <div>
            <label htmlFor="reset-confirm-password" className="block text-sm font-medium text-slate-700">
              Confirm New Password
            </label>
            <PasswordInput
              id="reset-confirm-password"
              name="confirm_password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Re-enter new password"
              className="mt-1.5"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[44px] rounded-lg bg-[#4B1C6F] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#3A1458] disabled:opacity-60"
          >
            {submitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      )}
    </AuthFrame>
  );
}

export function PendingApprovalPage({ onNavigate }: AuthNavProps) {
  const { user, publicInfo, logout, refreshSession } = useAuth();
  const [checking, setChecking] = useState(false);
  const fellowshipName = publicInfo?.fellowship_name || 'DUNAMIS INTERNATIONAL GOSPEL CENTRE, OWERRI';
  const logoUrl = publicInfo?.logo_url || '/src/assets/images/dunamis_owerri_logo_1795268208018.jpg';

  const status = user?.membership_status || 'pending';

  const handleRefresh = async () => {
    setChecking(true);
    const updated = await refreshSession();
    setChecking(false);
    if (updated?.membership_status === 'approved') {
      onNavigate(updated.role === 'admin' ? 'admin-dashboard' : 'directory');
    }
  };

  const handleSignOut = async () => {
    await logout();
    onNavigate('landing');
  };

  return (
    <div className="relative min-h-screen bg-[#FAF9F6] flex items-center justify-center p-4 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none select-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
      >
        <img
          src={logoUrl}
          alt=""
          className="w-[380px] sm:w-[500px] max-w-[82vw] rounded-full object-cover opacity-[0.05] grayscale-[15%]"
        />
      </div>

      <div className="relative z-10 max-w-lg w-full rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-xs p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-[#B47B07] border border-amber-200">
          {status === 'pending' ? <Clock className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#4B1C6F]">
          {fellowshipName}
        </p>

        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900">
          {status === 'pending' && 'Registration Under Review'}
          {status === 'suspended' && 'Account Suspended'}
          {status === 'rejected' && 'Registration Not Approved'}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {status === 'pending' &&
            `Thank you for registering${user ? `, ${user.full_name}` : ''}. To protect member privacy, directory access, announcements, and birthdays are enabled once a fellowship administrator verifies your registration.`}
          {status === 'suspended' &&
            'Your fellowship portal access has been temporarily suspended. Please reach out to a fellowship administrator for assistance.'}
          {status === 'rejected' &&
            'Your registration request was not approved. Please contact fellowship leadership if you believe this was an error.'}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {status === 'pending' && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={checking}
              className="min-h-[42px] rounded-lg bg-[#4B1C6F] px-5 py-2 text-sm font-medium text-white hover:bg-[#3A1458] disabled:opacity-60"
            >
              {checking ? 'Checking Status...' : 'Check Approval Status'}
            </button>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

export function UnauthorizedPage({ onNavigate }: AuthNavProps) {
  const { user, publicInfo } = useAuth();
  const logoUrl = publicInfo?.logo_url || '/src/assets/images/dunamis_owerri_logo_1795268208018.jpg';
  return (
    <div className="relative min-h-screen bg-[#FAF9F6] flex items-center justify-center p-4 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none select-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
      >
        <img
          src={logoUrl}
          alt=""
          className="w-[380px] sm:w-[500px] max-w-[82vw] rounded-full object-cover opacity-[0.05] grayscale-[15%]"
        />
      </div>

      <div className="relative z-10 max-w-md w-full rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-xs p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-700 border border-red-200">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold text-slate-900">Access Restricted</h1>
        <p className="mt-2 text-sm text-slate-600">
          You do not have permission to view this section.
        </p>
        <button
          type="button"
          onClick={() => onNavigate(user?.membership_status === 'approved' ? 'directory' : 'landing')}
          className="mt-6 min-h-[42px] rounded-lg bg-[#4B1C6F] px-5 py-2 text-sm font-medium text-white hover:bg-[#3A1458]"
        >
          Return Safely
        </button>
      </div>
    </div>
  );
}
