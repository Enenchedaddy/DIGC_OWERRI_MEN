import { Check, Shield } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PortalShell } from '../components/PortalShell';
import { useAuth } from '../context/AuthContext';
import { ApiError, apiFetch } from '../services/api';
import { AppRoute, BirthdayVisibility, FellowshipSettings, FieldVisibility } from '../types';

interface AdminUserSummary {
  id: string;
  full_name: string;
  email: string;
  professional_designation: string | null;
  created_at: string;
}

export function AdminSettingsPage({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  const { user, refreshPublicInfo } = useAuth();
  const [settings, setSettings] = useState<FellowshipSettings | null>(null);
  const [admins, setAdmins] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [demoteTarget, setDemoteTarget] = useState<AdminUserSummary | null>(null);
  const [demoting, setDemoting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ settings: FellowshipSettings; admins: AdminUserSummary[] }>(
        '/api/admin/settings'
      );
      setSettings(res.settings);
      setAdmins(res.admins);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Unable to load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ settings: FellowshipSettings }>('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      });
      setSettings(res.settings);
      await refreshPublicInfo();
      setStatusMsg('Fellowship settings and default privacy policies saved.');
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleDemote = async () => {
    if (!demoteTarget) return;
    setDemoting(true);
    try {
      await apiFetch(`/api/admin/members/${demoteTarget.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: 'member' }),
      });
      setDemoteTarget(null);
      setStatusMsg(`Removed administrator privileges from ${demoteTarget.full_name}.`);
      await load();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Unable to update administrator role.');
    } finally {
      setDemoting(false);
    }
  };

  return (
    <PortalShell
      currentRoute="admin-settings"
      onNavigate={onNavigate}
      title="Fellowship Settings"
      subtitle="Configure fellowship identity, gathering details, default privacy policies, and administrators"
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

      {loading || !settings ? (
        <div className="h-72 rounded-xl border border-slate-200 bg-white animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form onSubmit={handleSave} className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 space-y-5">
            <h2 className="font-display text-base font-semibold text-slate-900 pb-3 border-b border-slate-100">
              Fellowship Information & Defaults
            </h2>

            <div>
              <label htmlFor="set-name" className="block text-sm font-medium text-slate-700">
                Fellowship Name
              </label>
              <input
                id="set-name"
                type="text"
                required
                value={settings.fellowship_name}
                onChange={(e) => setSettings({ ...settings, fellowship_name: e.target.value })}
                className="mt-1 block w-full min-h-[42px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="set-tagline" className="block text-sm font-medium text-slate-700">
                Tagline
              </label>
              <input
                id="set-tagline"
                type="text"
                value={settings.tagline}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                className="mt-1 block w-full min-h-[42px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="set-desc" className="block text-sm font-medium text-slate-700">
                Public Welcome Description
              </label>
              <textarea
                id="set-desc"
                rows={3}
                value={settings.description}
                onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="set-sched" className="block text-sm font-medium text-slate-700">
                  Meeting Schedule
                </label>
                <input
                  id="set-sched"
                  type="text"
                  value={settings.meeting_schedule}
                  onChange={(e) => setSettings({ ...settings, meeting_schedule: e.target.value })}
                  className="mt-1 block w-full min-h-[42px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="set-loc" className="block text-sm font-medium text-slate-700">
                  Meeting Location
                </label>
                <input
                  id="set-loc"
                  type="text"
                  value={settings.meeting_location}
                  onChange={(e) => setSettings({ ...settings, meeting_location: e.target.value })}
                  className="mt-1 block w-full min-h-[42px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Default Visibility for New Registrations
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    ['default_phone_visibility', 'Phone Number Default'],
                    ['default_email_visibility', 'Email Address Default'],
                    ['default_workplace_visibility', 'Workplace Default'],
                    ['default_location_visibility', 'Residential Area Default'],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-slate-700">{label}</label>
                    <select
                      value={settings[field]}
                      onChange={(e) =>
                        setSettings({ ...settings, [field]: e.target.value as FieldVisibility })
                      }
                      className="mt-1 block w-full min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 text-xs"
                    >
                      <option value="members">Approved Members</option>
                      <option value="admins_only">Administrators Only</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                ))}

                <div>
                  <label className="block text-xs font-medium text-slate-700">Birthday Default</label>
                  <select
                    value={settings.default_birthday_visibility}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        default_birthday_visibility: e.target.value as BirthdayVisibility,
                      })
                    }
                    className="mt-1 block w-full min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 text-xs"
                  >
                    <option value="day_month">Month & Day Only</option>
                    <option value="full_date">Full Date</option>
                    <option value="admins_only">Administrators Only</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">Active Regional &amp; Localization Standards</p>
              <p>
                Country: Nigeria · Default State/City: Owerri, Imo State · Calling Code: +234 · Currency: Nigerian Naira (₦) · Date Format: DD/MM/YYYY · Timezone: Africa/Lagos (WAT)
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="min-h-[42px] rounded-lg bg-[#4B1C6F] px-5 py-2 text-sm font-medium text-white hover:bg-[#3A1458] disabled:opacity-60"
              >
                {saving ? 'Saving Settings...' : 'Save Settings'}
              </button>
            </div>
          </form>

          {/* Administrators List */}
          <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#4B1C6F]" />
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Authorized Administrators
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('admin-members')}
                className="text-xs font-medium text-[#4B1C6F] hover:underline"
              >
                Promote Member
              </button>
            </div>

            <p className="text-xs text-slate-600">
              To grant administrative privileges to another trusted brother, locate their approved account in Member Management and select &ldquo;Make Admin&rdquo;.
            </p>

            <ul className="divide-y divide-slate-100">
              {admins.map((adm) => (
                <li key={adm.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{adm.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{adm.email}</p>
                  </div>
                  {adm.id === user?.id ? (
                    <span className="text-xs font-medium text-slate-500 shrink-0">Current Session</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDemoteTarget(adm)}
                      className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shrink-0"
                    >
                      Demote
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(demoteTarget)}
        title="Revoke Administrator Role"
        description={`Remove administrator privileges from ${demoteTarget?.full_name}? They will retain standard approved member access.`}
        confirmLabel="Revoke Role"
        destructive
        busy={demoting}
        onCancel={() => setDemoteTarget(null)}
        onConfirm={handleDemote}
      />
    </PortalShell>
  );
}
