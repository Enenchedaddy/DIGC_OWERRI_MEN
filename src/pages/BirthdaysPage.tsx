import { Cake } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MemberAvatar } from '../components/MemberAvatar';
import { PortalShell } from '../components/PortalShell';
import { apiFetch } from '../services/api';
import { AppRoute, UpcomingBirthday } from '../types';
import { formatMonthDayNG } from '../utils/formatters';

export function BirthdaysPage({
  onNavigate,
  onSelectMember,
}: {
  onNavigate: (route: AppRoute) => void;
  onSelectMember: (id: string) => void;
}) {
  const [birthdays, setBirthdays] = useState<UpcomingBirthday[]>([]);
  const [windowFilter, setWindowFilter] = useState<'all' | '30' | '90'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch<{ birthdays: UpcomingBirthday[] }>('/api/birthdays');
        if (active) setBirthdays(res.birthdays);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load birthdays.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = birthdays.filter((b) => {
    if (windowFilter === '30') return b.days_until <= 30;
    if (windowFilter === '90') return b.days_until <= 90;
    return true;
  });

  return (
    <PortalShell
      currentRoute="birthdays"
      onNavigate={onNavigate}
      title="Fellowship Birthdays"
      subtitle="Chronological calendar of upcoming member celebrations, respecting individual birth-year privacy"
      headerAction={
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              ['all', 'All Upcoming'],
              ['30', 'Next 30 Days'],
              ['90', 'Next 90 Days'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setWindowFilter(val)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                windowFilter === val ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl border border-slate-200 bg-white animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <Cake className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 font-display text-base font-semibold text-slate-900">
            No birthdays in this timeframe
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Switch to &ldquo;All Upcoming&rdquo; to view the full fellowship birthday calendar.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-slate-50/60 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <MemberAvatar src={item.profile_image} name={item.full_name} size="md" />
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onSelectMember(item.id)}
                    className="font-display text-base font-semibold text-slate-900 hover:text-[#4B1C6F] hover:underline truncate block"
                  >
                    {item.full_name}
                  </button>
                  <p className="text-xs text-slate-500 truncate">
                    {item.occupation || 'Fellowship Member'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-6 sm:text-right">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatMonthDayNG(item.birth_month_day)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.turning_age ? `Turning ${item.turning_age}` : 'Birth year private'}
                  </p>
                </div>
                <span className="font-mono-num text-xs font-medium text-[#B47B07] min-w-[80px] text-right">
                  {item.days_until === 0
                    ? 'Today'
                    : item.days_until === 1
                    ? 'Tomorrow'
                    : `In ${item.days_until} days`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
