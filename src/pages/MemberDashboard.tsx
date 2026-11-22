import { ArrowRight, Cake, Calendar, MapPin, Megaphone, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MemberAvatar } from '../components/MemberAvatar';
import { PortalShell } from '../components/PortalShell';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import { Announcement, AppRoute, UpcomingBirthday } from '../types';
import { formatDateDDMMYYYY, formatMonthDayNG } from '../utils/formatters';

interface DashboardResponse {
  stats: {
    total_approved: number;
    distinct_occupations: number;
    unread_announcements: number;
    upcoming_birthdays_count: number;
  };
  recent_announcements: Announcement[];
  upcoming_birthdays: UpcomingBirthday[];
  fellowship: {
    fellowship_name: string;
    meeting_schedule: string;
    meeting_location: string;
    description: string;
  };
}

export function MemberDashboard({
  onNavigate,
  onSelectMember,
}: {
  onNavigate: (route: AppRoute) => void;
  onSelectMember: (id: string) => void;
}) {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch<DashboardResponse>('/api/dashboard');
        if (active) setData(res);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <PortalShell
      currentRoute="dashboard"
      onNavigate={onNavigate}
      title={`Welcome back, ${user?.full_name.split(' ')[0] || 'Brother'}`}
      subtitle="Fellowship overview, upcoming gatherings, and recent updates"
      headerAction={
        <button
          type="button"
          onClick={() => onNavigate('directory')}
          className="min-h-[40px] rounded-lg bg-[#4B1C6F] px-4 py-2 text-sm font-medium text-white hover:bg-[#3A1458] transition-colors whitespace-nowrap shrink-0"
        >
          Browse Directory
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
          <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
        </div>
      ) : data ? (
        <div className="space-y-8">
          {/* Metrics Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Approved Members</p>
              <p className="mt-2 font-mono-num text-2xl font-bold text-slate-900">
                {data.stats.total_approved}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Vocations Represented</p>
              <p className="mt-2 font-mono-num text-2xl font-bold text-slate-900">
                {data.stats.distinct_occupations}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Unread Announcements</p>
              <p className="mt-2 font-mono-num text-2xl font-bold text-slate-900">
                {data.stats.unread_announcements}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Upcoming Birthdays</p>
              <p className="mt-2 font-mono-num text-2xl font-bold text-slate-900">
                {data.stats.upcoming_birthdays_count}
              </p>
            </div>
          </div>

          {/* Two-Column Main Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Announcements Column */}
            <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-[#4B1C6F]" />
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    Recent Announcements
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('announcements')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#4B1C6F] hover:underline whitespace-nowrap"
                >
                  <span>View all</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {data.recent_announcements.length === 0 ? (
                <p className="py-8 text-sm text-slate-500 text-center">
                  No fellowship announcements have been published yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.recent_announcements.map((ann) => (
                    <article key={ann.id} className="py-4 first:pt-4 last:pb-0">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {ann.is_pinned === 1 && (
                          <>
                            <span className="font-semibold text-[#B47B07]">Pinned</span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        <span>{ann.author_name}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">{formatDateDDMMYYYY(ann.created_at)}</span>
                        {ann.is_read === 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium text-[#4B1C6F]">Unread</span>
                          </>
                        )}
                      </div>
                      <h3 className="mt-1 text-sm font-semibold text-slate-900">{ann.title}</h3>
                      <p className="mt-1 text-sm text-slate-600 line-clamp-2">{ann.content}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* Right Sidebar: Profile Summary, Gatherings & Birthdays */}
            <div className="lg:col-span-5 space-y-6">
              {/* My Summary */}
              {user && (
                <section className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex items-center gap-4">
                    <MemberAvatar src={user.profile_image} name={user.full_name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display text-base font-semibold text-slate-900 truncate">
                        {user.full_name}
                      </h2>
                      <p className="text-sm text-slate-600 truncate">
                        {user.professional_designation || user.occupation || 'Fellowship Member'}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">
                        {user.membership_category || 'General Member'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onNavigate('my-profile')}
                      className="text-xs font-semibold text-[#4B1C6F] hover:underline"
                    >
                      Edit Profile & Privacy
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('directory')}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>Directory</span>
                    </button>
                  </div>
                </section>
              )}

              {/* Next Gathering */}
              <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Fellowship Gatherings
                </h2>
                <div className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Calendar className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>{data.fellowship.meeting_schedule}</span>
                </div>
                <div className="flex items-start gap-2.5 text-sm text-slate-700">
                  <MapPin className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>{data.fellowship.meeting_location}</span>
                </div>
              </section>

              {/* Upcoming Birthdays */}
              <section className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
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
                    Full list
                  </button>
                </div>

                {data.upcoming_birthdays.length === 0 ? (
                  <p className="py-6 text-sm text-slate-500 text-center">
                    No upcoming birthdays visible right now.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.upcoming_birthdays.map((b) => (
                      <li key={b.id} className="py-3 first:pt-3 last:pb-0">
                        <button
                          type="button"
                          onClick={() => onSelectMember(b.id)}
                          className="flex w-full items-center justify-between gap-3 text-left hover:bg-slate-50 rounded-lg p-1 -m-1 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <MemberAvatar src={b.profile_image} name={b.full_name} size="sm" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {b.full_name}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                {formatMonthDayNG(b.birth_month_day)}
                                {b.turning_age ? ` · Turning ${b.turning_age}` : ''}
                              </p>
                            </div>
                          </div>
                          <span className="font-mono-num text-xs font-medium text-slate-600 shrink-0">
                            {b.days_until === 0
                              ? 'Today'
                              : b.days_until === 1
                              ? 'Tomorrow'
                              : `In ${b.days_until}d`}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </PortalShell>
  );
}
