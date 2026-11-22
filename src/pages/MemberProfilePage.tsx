import { ArrowLeft, Briefcase, Calendar, Lock, Mail, MapPin, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MemberAvatar } from '../components/MemberAvatar';
import { PortalShell } from '../components/PortalShell';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import { AppRoute, MemberProfile } from '../types';
import { formatDateDDMMYYYY, formatFullAddress, formatMonthDayNG } from '../utils/formatters';

export function MemberProfilePage({
  memberId,
  onNavigate,
}: {
  memberId: string;
  onNavigate: (route: AppRoute) => void;
}) {
  const { user } = useAuth();
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const res = await apiFetch<{ member: MemberProfile }>(`/api/members/${memberId}`);
        if (active) setMember(res.member);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load member profile.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [memberId]);

  const isSelf = user?.id === memberId;

  return (
    <PortalShell
      currentRoute="member-profile"
      onNavigate={onNavigate}
      title={member ? member.full_name : 'Member Profile'}
      subtitle={member?.professional_designation || member?.occupation || 'Fellowship Directory Profile'}
      headerAction={
        <button
          type="button"
          onClick={() => onNavigate('directory')}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Directory</span>
        </button>
      }
    >
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-80 rounded-xl border border-slate-200 bg-white animate-pulse" />
      ) : member ? (
        <div className="space-y-6">
          {/* Header Card */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <MemberAvatar src={member.profile_image} name={member.full_name} size="xl" />
                <div>
                  <h2 className="font-display text-2xl font-bold text-slate-900">{member.full_name}</h2>
                  <p className="mt-1 text-base text-slate-700">
                    {member.professional_designation || member.occupation || 'Fellowship Member'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {member.membership_category || 'General Member'}
                    {member.fellowship_responsibilities ? ` · ${member.fellowship_responsibilities}` : ''}
                    {member.date_of_joining ? ` · Joined ${formatDateDDMMYYYY(member.date_of_joining)}` : ''}
                  </p>
                </div>
              </div>

              {isSelf && (
                <button
                  type="button"
                  onClick={() => onNavigate('my-profile')}
                  className="min-h-[40px] rounded-lg bg-[#4B1C6F] px-4 py-2 text-sm font-medium text-white hover:bg-[#3A1458] whitespace-nowrap shrink-0"
                >
                  Edit My Profile
                </button>
              )}
            </div>

            {member.biography && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h3 className="text-xs font-medium text-slate-500">Biography</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-700 max-w-3xl">{member.biography}</p>
              </div>
            )}
          </section>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <h3 className="font-display text-base font-semibold text-slate-900 pb-3 border-b border-slate-100">
                Professional & Skills
              </h3>
              <div>
                <p className="text-xs text-slate-500">Occupation</p>
                <p className="mt-0.5 text-sm font-medium text-slate-900">{member.occupation || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Workplace / Business</p>
                {member.workplace ? (
                  <p className="mt-0.5 text-sm font-medium text-slate-900 flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-slate-400" />
                    <span>{member.workplace}</span>
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    <span>{member.privacy_summary?.workplace_visible ? 'Not listed' : 'Private per member preference'}</span>
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Skills & Areas of Specialization</p>
                <p className="mt-0.5 text-sm text-slate-800">{member.skills || 'Not specified'}</p>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <h3 className="font-display text-base font-semibold text-slate-900 pb-3 border-b border-slate-100">
                Permitted Contact & Personal Info
              </h3>
              <div>
                <p className="text-xs text-slate-500">Email Address</p>
                {member.email ? (
                  <a
                    href={`mailto:${member.email}`}
                    className="mt-0.5 text-sm font-medium text-[#4B1C6F] hover:underline flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span>{member.email}</span>
                  </a>
                ) : (
                  <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Restricted by member privacy settings</span>
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-slate-500">Phone Number</p>
                {member.phone_number ? (
                  <p className="mt-0.5 text-sm font-medium text-slate-900 flex items-center gap-2 font-mono-num">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span>{member.phone_number}</span>
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Restricted by member privacy settings</span>
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-slate-500">Residential Address</p>
                {(() => {
                  const addr = formatFullAddress(member);
                  return addr ? (
                    <p className="mt-0.5 text-sm font-medium text-slate-900 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>{addr}</span>
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" />
                      <span>Restricted by member privacy settings</span>
                    </p>
                  );
                })()}
              </div>

              <div>
                <p className="text-xs text-slate-500">Birthday</p>
                {member.date_of_birth ? (
                  <p className="mt-0.5 text-sm font-medium text-slate-900 flex items-center gap-2 font-mono-num">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>{formatDateDDMMYYYY(member.date_of_birth)}</span>
                  </p>
                ) : member.birth_month_day ? (
                  <p className="mt-0.5 text-sm font-medium text-slate-900 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>{formatMonthDayNG(member.birth_month_day)}</span>
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Private</span>
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </PortalShell>
  );
}
