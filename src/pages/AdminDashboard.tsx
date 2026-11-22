import { ArrowRight, Cake, Check, Megaphone, ShieldCheck, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MemberAvatar } from '../components/MemberAvatar';
import { PortalShell } from '../components/PortalShell';
import { ApiError, apiFetch } from '../services/api';
import { ActivityLog, Announcement, AppRoute, MembershipStatus, UpcomingBirthday } from '../types';
import { formatDateDDMMYYYY } from '../utils/formatters';

interface AdminOverviewResponse {
  counts: {
    total_members: number;
    approved_members: number;
    pending_members: number;
    suspended_members: number;
    rejected_members: number;
  };
  recent_registrations: Array<{
    id: string;
    full_name: string;
    email: string;
    phone_number: string;
    occupation: string | null;
    membership_status: MembershipStatus;
    profile_image: string | null;
    created_at: string;
    role: string;
  }>;
  recent_announcements: Announcement[];
  recent_activity: ActivityLog[];
  upcoming_birthdays: UpcomingBirthday[];
}

export function AdminDashboard({
  onNavigate,
  onSelectMember,
}: {
  onNavigate: (route: AppRoute) => void;
  onSelectMember: (id: string) => void;
}) {
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState<{ id: string; name: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<AdminOverviewResponse>('/api/admin/overview');
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load admin overview.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (id: string, status: MembershipStatus) => {
    setBusyId(id);
    try {
      await apiFetch(`/api/admin/members/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ membership_status: status }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update member status.');
    } finally {
      setBusyId(null);
      setConfirmReject(null);
    }
  };

  return (
    <PortalShell
      currentRoute="admin-dashboard"
      onNavigate={onNavigate}
      title="Administrator Overview"
      subtitle="Fellowship membership metrics, pending approvals, and governance logs"
      headerAction={
        <button
          type="button"
          onClick={() => onNavigate('admin-members')}
          className="min-h-[40px] rounded-lg bg-[#4B1C6F] px-4 py-2 text-sm font-medium text-white hover:bg-[#3A1458] whitespace-nowrap shrink-0"
        >
          Manage Members
        </button>
      }
    >
      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-xl border border-slate-200 bg-white animate-pulse" />
            ))}
          </div>
          <div className="h-72 rounded-xl border border-slate-200 bg-white animate-pulse" />
        </div>
      ) : data ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Total Registered</p>
              <p className="mt-2 font-mono-num text-2xl font-bold text-slate-900">
                {data.counts.total_members || 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Approved Members</p>
              <p className="mt-2 font-mono-num text-2xl font-bold text-emerald-700">
                {data.counts.approved_members || 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Pending Approvals</p>
              <p className="mt-2 font-mono-num text-2xl font-bold text-[#B47B07]">
                {data.counts.pending_members || 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Suspended / Rejected</p>
              <p className="mt-2 font-mono-num text-2xl font-bold text-slate-700">
                {(data.counts.suspended_members || 0) + (data.counts.rejected_members || 0)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Registrations Queue */}
            <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#4B1C6F]" />
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    Recent & Pending Registrations
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('admin-members')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#4B1C6F] hover:underline"
                >
                  <span>All records</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {data.recent_registrations.map((reg) => (
                  <div
                    key={reg.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <MemberAvatar src={reg.profile_image} name={reg.full_name} size="sm" />
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onSelectMember(reg.id)}
                          className="text-sm font-semibold text-slate-900 hover:text-[#4B1C6F] hover:underline truncate block"
                        >
                          {reg.full_name}
                        </button>
                        <p className="text-xs text-slate-500 truncate">
                          {reg.occupation || 'Member'} · {reg.email} ·{' '}
                          <span className="font-mono-num">{formatDateDDMMYYYY(reg.created_at)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {reg.membership_status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            disabled={busyId === reg.id}
                            onClick={() => updateStatus(reg.id, 'approved')}
                            className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            disabled={busyId === reg.id}
                            onClick={() => setConfirmReject({ id: reg.id, name: reg.full_name })}
                            className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        </>
                      ) : (
                        <span
                          className={`text-xs font-medium capitalize ${
                            reg.membership_status === 'approved'
                              ? 'text-emerald-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {reg.membership_status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Right Column: Announcements, Birthdays & Audit Log */}
            <div className="lg:col-span-5 space-y-6">
              <section className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-[#4B1C6F]" />
                    <h2 className="font-display text-base font-semibold text-slate-900">
                      Announcements
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('admin-announcements')}
                    className="text-xs font-medium text-[#4B1C6F] hover:underline"
                  >
                    Manage
                  </button>
                </div>
                <ul className="divide-y divide-slate-100 mt-2">
                  {data.recent_announcements.map((a) => (
                    <li key={a.id} className="py-2.5 flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-slate-800 truncate">{a.title}</span>
                      <span className="text-xs text-slate-500 capitalize shrink-0">{a.status}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Cake className="h-4 w-4 text-[#B47B07]" />
                    <h2 className="font-display text-base font-semibold text-slate-900">
                      Upcoming Birthdays
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('birthdays')}
                    className="text-xs font-medium text-[#4B1C6F] hover:underline"
                  >
                    View all
                  </button>
                </div>
                <ul className="divide-y divide-slate-100 mt-2">
                  {data.upcoming_birthdays.map((b) => (
                    <li key={b.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-800 truncate">{b.full_name}</span>
                      <span className="font-mono-num text-xs text-slate-500 shrink-0">
                        {b.days_until === 0 ? 'Today' : `In ${b.days_until}d`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="font-display text-base font-semibold text-slate-900 pb-3 border-b border-slate-100">
                  Recent Activity Log
                </h2>
                <ul className="divide-y divide-slate-100 mt-2">
                  {data.recent_activity.slice(0, 6).map((log) => (
                    <li key={log.id} className="py-2.5">
                      <p className="text-xs font-medium text-slate-800 flex items-center justify-between gap-2">
                        <span>
                          {log.action.replace(/_/g, ' ')}
                          {log.actor_name ? ` · ${log.actor_name}` : ''}
                        </span>
                        <span className="font-mono-num text-[11px] text-slate-400 shrink-0">
                          {formatDateDDMMYYYY(log.created_at)}
                        </span>
                      </p>
                      {log.details && <p className="text-xs text-slate-500 truncate">{log.details}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmReject)}
        title="Reject Registration"
        description={`Are you sure you want to reject ${confirmReject?.name}'s registration? They will remain blocked from accessing the directory.`}
        confirmLabel="Reject Registration"
        destructive
        busy={Boolean(busyId)}
        onCancel={() => setConfirmReject(null)}
        onConfirm={() => {
          if (confirmReject) updateStatus(confirmReject.id, 'rejected');
        }}
      />
    </PortalShell>
  );
}
