import { CheckCircle2, Megaphone, Pin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PortalShell } from '../components/PortalShell';
import { apiFetch } from '../services/api';
import { Announcement, AppRoute } from '../types';
import { formatLongDateNG } from '../utils/formatters';

export function AnnouncementsPage({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch<{ announcements: Announcement[] }>('/api/announcements');
        if (active) setAnnouncements(res.announcements);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load announcements.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await apiFetch(`/api/announcements/${id}/read`, { method: 'POST' });
      setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: 1 } : a)));
    } catch {
      // Non-blocking read confirmation
    }
  };

  return (
    <PortalShell
      currentRoute="announcements"
      onNavigate={onNavigate}
      title="Fellowship Announcements"
      subtitle="Official notices, gathering schedules, and retreat communications"
    >
      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-5">
          {[1, 2].map((i) => (
            <div key={i} className="h-56 rounded-xl border border-slate-200 bg-white animate-pulse" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 font-display text-base font-semibold text-slate-900">
            No announcements published
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Official fellowship updates from leadership will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {announcements.map((ann) => (
            <article
              key={ann.id}
              className="rounded-xl border border-slate-200 bg-white overflow-hidden"
            >
              {ann.image_url && (
                <div className="aspect-[21/9] max-h-[300px] w-full bg-slate-100 overflow-hidden border-b border-slate-200">
                  <img
                    src={ann.image_url}
                    alt={ann.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {ann.is_pinned === 1 && (
                      <>
                        <span className="inline-flex items-center gap-1 font-semibold text-[#B47B07]">
                          <Pin className="h-3.5 w-3.5" />
                          <span>Pinned Notice</span>
                        </span>
                        <span aria-hidden="true">·</span>
                      </>
                    )}
                    <span>By {ann.author_name}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatLongDateNG(ann.created_at)}</span>
                  </div>

                  {ann.is_read === 1 ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Read</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => markAsRead(ann.id)}
                      className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Mark as Read
                    </button>
                  )}
                </div>

                <h2 className="mt-3 font-display text-xl font-bold text-slate-900">{ann.title}</h2>
                <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-700 whitespace-pre-line">
                  {ann.content}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
