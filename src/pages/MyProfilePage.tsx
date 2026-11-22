import { Check, Lock, Upload } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { MemberAvatar } from '../components/MemberAvatar';
import { PhoneInput } from '../components/PhoneInput';
import { PortalShell } from '../components/PortalShell';
import { useAuth } from '../context/AuthContext';
import { ApiError, apiFetch } from '../services/api';
import { AppRoute, BirthdayVisibility, FieldVisibility, ProfilePrivacy } from '../types';
import { isValidNigerianOrIntlPhone, NIGERIAN_STATES } from '../utils/formatters';

export function MyProfilePage({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  const { user, privacy, refreshSession } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [country, setCountry] = useState('Nigeria');
  const [stateName, setStateName] = useState('Imo State');
  const [city, setCity] = useState('Owerri');
  const [lga, setLga] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [occupation, setOccupation] = useState('');
  const [workplace, setWorkplace] = useState('');
  const [designation, setDesignation] = useState('');
  const [skills, setSkills] = useState('');
  const [category, setCategory] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [biography, setBiography] = useState('');

  const [privState, setPrivState] = useState<ProfilePrivacy>({
    phone_visibility: 'members',
    email_visibility: 'members',
    workplace_visibility: 'members',
    birthday_visibility: 'day_month',
    location_visibility: 'members',
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone_number || '');
      setDob(user.date_of_birth || '');
      setCountry(user.country || 'Nigeria');
      setStateName(user.state || 'Imo State');
      setCity(user.city || 'Owerri');
      setLga(user.lga || '');
      setStreetAddress(user.street_address || (!user.city && user.residential_location ? user.residential_location : ''));
      setOccupation(user.occupation || '');
      setWorkplace(user.workplace || '');
      setDesignation(user.professional_designation || '');
      setSkills(user.skills || '');
      setCategory(user.membership_category || 'General Member');
      setResponsibilities(user.fellowship_responsibilities || '');
      setBiography(user.biography || '');
    }
    if (privacy) {
      setPrivState(privacy);
    }
  }, [user, privacy]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setStatusMsg(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMsg('Please upload a JPEG, PNG, or WebP photograph.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Photograph size must be under 5 MB.');
      return;
    }
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      await apiFetch('/api/profile/photo', { method: 'POST', body: fd });
      await refreshSession();
      setStatusMsg('Profile photograph updated.');
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Unable to upload photograph.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    if (!isValidNigerianOrIntlPhone(phone)) {
      setErrorMsg('Please provide a valid Nigerian mobile number (e.g. +234 803 123 4567) or international phone number.');
      return;
    }
    setSavingProfile(true);
    try {
      const assembledLocation = [streetAddress.trim(), lga.trim(), city.trim(), stateName.trim(), country.trim()]
        .filter(Boolean)
        .join(', ');
      await apiFetch('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: fullName,
          phone_number: phone,
          date_of_birth: dob,
          country: country.trim(),
          state: stateName.trim(),
          city: city.trim(),
          lga: lga.trim(),
          street_address: streetAddress.trim(),
          residential_location: assembledLocation,
          occupation,
          workplace,
          professional_designation: designation,
          skills,
          membership_category: category,
          fellowship_responsibilities: responsibilities,
          biography,
        }),
      });
      await refreshSession();
      setStatusMsg('Your profile details have been saved.');
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Unable to save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePrivacy = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    setSavingPrivacy(true);
    try {
      await apiFetch('/api/profile/privacy', {
        method: 'PATCH',
        body: JSON.stringify(privState),
      });
      await refreshSession();
      setStatusMsg('Privacy preferences updated and enforced.');
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Unable to update privacy preferences.');
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    setSavingPassword(true);
    try {
      await apiFetch('/api/account/password', {
        method: 'PATCH',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setStatusMsg('Your password has been updated.');
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Unable to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <PortalShell
      currentRoute="my-profile"
      onNavigate={onNavigate}
      title="My Profile & Privacy"
      subtitle="Manage your directory information, portrait photograph, and visibility settings"
    >
      {statusMsg && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-700 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Profile Form */}
        <form onSubmit={handleSaveProfile} className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex items-center gap-4 pb-5 border-b border-slate-200">
            <MemberAvatar src={user?.profile_image} name={user?.full_name || 'Member'} size="xl" />
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">Profile Photograph</h2>
              <p className="text-xs text-slate-500 mt-0.5">JPEG, PNG, or WebP up to 5 MB</p>
              <label
                htmlFor="my-photo-input"
                className="mt-2.5 inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{uploadingPhoto ? 'Uploading...' : 'Change Photograph'}</span>
              </label>
              <input
                id="my-photo-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadingPhoto}
                onChange={handlePhotoUpload}
                className="sr-only"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prof-name" className="block text-sm font-medium text-slate-700">
                Full Name *
              </label>
              <input
                id="prof-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 block w-full min-h-[42px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="prof-phone" className="block text-sm font-medium text-slate-700">
                Mobile Number *
              </label>
              <PhoneInput id="prof-phone" required value={phone} onChange={setPhone} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prof-dob" className="block text-sm font-medium text-slate-700">
                Date of Birth
              </label>
              <input
                id="prof-dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="mt-1 block w-full min-h-[42px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="prof-country" className="block text-sm font-medium text-slate-700">
                Country
              </label>
              <input
                id="prof-country"
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Nigeria"
                className="mt-1 block w-full min-h-[42px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Residential Address
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="prof-state" className="block text-xs font-medium text-slate-700">
                  State / Province
                </label>
                {country.trim().toLowerCase() === 'nigeria' ? (
                  <select
                    id="prof-state"
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
                    id="prof-state"
                    type="text"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    className="mt-1 block w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-[#4B1C6F] focus:outline-none"
                  />
                )}
              </div>
              <div>
                <label htmlFor="prof-city" className="block text-xs font-medium text-slate-700">
                  City / Town
                </label>
                <input
                  id="prof-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Owerri"
                  className="mt-1 block w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-[#4B1C6F] focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="prof-lga" className="block text-xs font-medium text-slate-700">
                  LGA (Optional)
                </label>
                <input
                  id="prof-lga"
                  type="text"
                  value={lga}
                  onChange={(e) => setLga(e.target.value)}
                  placeholder="e.g. Owerri Municipal"
                  className="mt-1 block w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-[#4B1C6F] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="prof-street" className="block text-xs font-medium text-slate-700">
                  Street / Estate
                </label>
                <input
                  id="prof-street"
                  type="text"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="e.g. 14 Okigwe Road, New Owerri"
                  className="mt-1 block w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-[#4B1C6F] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prof-occ" className="block text-sm font-medium text-slate-700">
                Occupation
              </label>
              <input
                id="prof-occ"
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                className="mt-1 block w-full min-h-[42px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="prof-work" className="block text-sm font-medium text-slate-700">
                Workplace / Business
              </label>
              <input
                id="prof-work"
                type="text"
                value={workplace}
                onChange={(e) => setWorkplace(e.target.value)}
                className="mt-1 block w-full min-h-[42px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prof-desig" className="block text-sm font-medium text-slate-700">
                Professional Designation
              </label>
              <input
                id="prof-desig"
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="mt-1 block w-full min-h-[42px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="prof-cat" className="block text-sm font-medium text-slate-700">
                Fellowship Group
              </label>
              <select
                id="prof-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 block w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
              >
                <option value="General Member">General Member</option>
                <option value="Young Professionals">Young Professionals</option>
                <option value="Small Group Leader">Small Group Leader</option>
                <option value="Core Elders & Mentors">Core Elders & Mentors</option>
                <option value="Senior Brotherhood">Senior Brotherhood</option>
                <option value="Leadership">Leadership</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="prof-skills" className="block text-sm font-medium text-slate-700">
              Skills & Areas of Specialization
            </label>
            <input
              id="prof-skills"
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="mt-1 block w-full min-h-[42px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="prof-resp" className="block text-sm font-medium text-slate-700">
              Fellowship Responsibilities
            </label>
            <input
              id="prof-resp"
              type="text"
              value={responsibilities}
              onChange={(e) => setResponsibilities(e.target.value)}
              className="mt-1 block w-full min-h-[42px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="prof-bio" className="block text-sm font-medium text-slate-700">
              Biography
            </label>
            <textarea
              id="prof-bio"
              rows={3}
              value={biography}
              onChange={(e) => setBiography(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={savingProfile}
              className="min-h-[42px] rounded-lg bg-[#4B1C6F] px-5 py-2 text-sm font-medium text-white hover:bg-[#3A1458] disabled:opacity-60"
            >
              {savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>

        {/* Privacy & Account Column */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleSavePrivacy} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Lock className="h-4 w-4 text-[#4B1C6F]" />
              <h2 className="font-display text-base font-semibold text-slate-900">Privacy Preferences</h2>
            </div>
            <p className="text-xs text-slate-600">
              These controls are enforced directly by the server across the directory and birthday listings.
            </p>

            {(
              [
                ['phone_visibility', 'Phone Number Visibility'],
                ['email_visibility', 'Email Address Visibility'],
                ['workplace_visibility', 'Workplace Visibility'],
                ['location_visibility', 'Residential Area Visibility'],
              ] as Array<[keyof Omit<ProfilePrivacy, 'birthday_visibility'>, string]>
            ).map(([field, label]) => (
              <div key={field}>
                <label htmlFor={`priv-${field}`} className="block text-xs font-medium text-slate-700">
                  {label}
                </label>
                <select
                  id={`priv-${field}`}
                  value={privState[field]}
                  onChange={(e) =>
                    setPrivState((prev) => ({ ...prev, [field]: e.target.value as FieldVisibility }))
                  }
                  className="mt-1 block w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-[#4B1C6F] focus:outline-none"
                >
                  <option value="members">Approved Fellowship Members</option>
                  <option value="admins_only">Administrators Only</option>
                  <option value="private">Private (Only Me & Admins)</option>
                </select>
              </div>
            ))}

            <div>
              <label htmlFor="priv-birthday" className="block text-xs font-medium text-slate-700">
                Birthday Visibility
              </label>
              <select
                id="priv-birthday"
                value={privState.birthday_visibility}
                onChange={(e) =>
                  setPrivState((prev) => ({
                    ...prev,
                    birthday_visibility: e.target.value as BirthdayVisibility,
                  }))
                }
                className="mt-1 block w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-[#4B1C6F] focus:outline-none"
              >
                <option value="day_month">Month & Day Only (Hide Birth Year)</option>
                <option value="full_date">Full Date of Birth</option>
                <option value="admins_only">Administrators Only</option>
                <option value="private">Private (Exclude from Member List)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={savingPrivacy}
              className="w-full min-h-[42px] rounded-lg bg-[#4B1C6F] px-4 py-2 text-sm font-medium text-white hover:bg-[#3A1458] disabled:opacity-60"
            >
              {savingPrivacy ? 'Saving Privacy...' : 'Save Privacy Preferences'}
            </button>
          </form>

          <form onSubmit={handleChangePassword} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-slate-900 pb-3 border-b border-slate-100">
              Account Security
            </h2>
            <div>
              <label htmlFor="sec-current" className="block text-xs font-medium text-slate-700">
                Current Password
              </label>
              <input
                id="sec-current"
                name="current_password"
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 block w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-[#4B1C6F] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="sec-new" className="block text-xs font-medium text-slate-700">
                New Password (min 8 characters)
              </label>
              <input
                id="sec-new"
                name="new_password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-[#4B1C6F] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={savingPassword}
              className="w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              {savingPassword ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </PortalShell>
  );
}
