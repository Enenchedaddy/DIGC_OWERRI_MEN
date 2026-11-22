import { Check, Copy, Download, Edit3, KeyRound, Search, Shield, UserCheck, UserX, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MemberAvatar } from '../components/MemberAvatar';
import { PhoneInput } from '../components/PhoneInput';
import { PortalShell } from '../components/PortalShell';
import { useAuth } from '../context/AuthContext';
import { ApiError, apiFetch } from '../services/api';
import { AdminMemberRecord, AppRoute, BirthdayVisibility, FieldVisibility, MembershipStatus, UserRole } from '../types';
import { formatDateDDMMYYYY, isValidNigerianOrIntlPhone, NIGERIAN_STATES } from '../utils/formatters';

interface MembershipSummary {
  total: number;
  pending: number;
  approved: number;
  suspended: number;
  admins: number;
  admin_limit: number;
}

export function AdminMembersPage({
  onNavigate,
  onSelectMember,
}: {
  onNavigate: (route: AppRoute) => void;
  onSelectMember: (id: string) => void;
}) {
  const { user } = useAuth();
  const [members, setMembers] = useState<AdminMemberRecord[]>([]);
  const [summary, setSummary] = useState<MembershipSummary>({
    total: 0,
    pending: 0,
    approved: 0,
    suspended: 0,
    admins: 0,
    admin_limit: 3,
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [editingMember, setEditingMember] = useState<AdminMemberRecord | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [issuingReset, setIssuingReset] = useState(false);
  const [issuedReset, setIssuedReset] = useState<{ token: string; link: string; expiresAt: string } | null>(null);
  const [copiedReset, setCopiedReset] = useState(false);

  const [confirmAction, setConfirmAction] = useState<{
    type: 'status' | 'role';
    id: string;
    name: string;
    nextValue: string;
    title: string;
    description: string;
    confirmLabel: string;
    destructive: boolean;
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (roleFilter !== 'all') params.set('role', roleFilter);

      const res = await apiFetch<{ members: AdminMemberRecord[]; summary: MembershipSummary }>(
        `/api/admin/members?${params.toString()}`
      );
      setMembers(res.members);
      setSummary(res.summary);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load member records.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, roleFilter]);

  useEffect(() => {
    const t = setTimeout(loadMembers, 180);
    return () => clearTimeout(t);
  }, [loadMembers]);

  const handleStatusChange = async (id: string, nextStatus: MembershipStatus) => {
    setActionBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/members/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ membership_status: nextStatus }),
      });
      setFeedback(`Member status updated to ${nextStatus}.`);
      await loadMembers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update status.');
    } finally {
      setActionBusy(false);
      setConfirmAction(null);
    }
  };

  const handleRoleChange = async (id: string, nextRole: UserRole) => {
    setActionBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/members/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
      });
      setFeedback(`Role updated to ${nextRole}.`);
      await loadMembers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update role.');
    } finally {
      setActionBusy(false);
      setConfirmAction(null);
    }
  };

  const handleExportCsv = async () => {
    try {
      const csv = await apiFetch<string>('/api/admin/members/export');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fellowship-members.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to export member records.');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    if (!isValidNigerianOrIntlPhone(editingMember.phone_number || '')) {
      setError('Please enter a valid Nigerian mobile number (e.g. +234 803 123 4567) or international number.');
      return;
    }
    setSavingEdit(true);
    setError(null);
    try {
      const assembledLocation = [
        editingMember.street_address?.trim(),
        editingMember.lga?.trim(),
        editingMember.city?.trim(),
        editingMember.state?.trim(),
        editingMember.country?.trim(),
      ]
        .filter(Boolean)
        .join(', ');
      await apiFetch(`/api/admin/members/${editingMember.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: editingMember.full_name,
          phone_number: editingMember.phone_number,
          date_of_birth: editingMember.date_of_birth,
          country: editingMember.country || 'Nigeria',
          state: editingMember.state || 'Imo State',
          city: editingMember.city || 'Owerri',
          lga: editingMember.lga || '',
          street_address: editingMember.street_address || '',
          residential_location: assembledLocation || editingMember.residential_location,
          occupation: editingMember.occupation,
          workplace: editingMember.workplace,
          professional_designation: editingMember.professional_designation,
          skills: editingMember.skills,
          membership_category: editingMember.membership_category,
          fellowship_responsibilities: editingMember.fellowship_responsibilities,
          biography: editingMember.biography,
          privacy: {
            phone_visibility: editingMember.phone_visibility,
            email_visibility: editingMember.email_visibility,
            workplace_visibility: editingMember.workplace_visibility,
            birthday_visibility: editingMember.birthday_visibility,
            location_visibility: editingMember.location_visibility,
          },
        }),
      });
      setFeedback(`Updated record for ${editingMember.full_name}.`);
      setEditingMember(null);
      setIssuedReset(null);
      await loadMembers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save member changes.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleIssueResetToken = async (memberId: string) => {
    setIssuingReset(true);
    setError(null);
    setCopiedReset(false);
    try {
      const res = await apiFetch<{ reset_token: string; expires_at: string }>(
        `/api/admin/members/${memberId}/reset-token`,
        { method: 'POST' }
      );
      const link = `${window.location.origin}/reset-password?token=${encodeURIComponent(res.reset_token)}`;
      setIssuedReset({ token: res.reset_token, link, expiresAt: res.expires_at });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to issue password reset token.');
    } finally {
      setIssuingReset(false);
    }
  };

  const openMemberEditor = (member: AdminMemberRecord) => {
    setIssuedReset(null);
    setCopiedReset(false);
    setEditingMember(member);
  };

  const renderMemberActions = (member: AdminMemberRecord, mobile = false) => (
    <div className={`flex flex-wrap items-center gap-2 ${mobile ? 'justify-start' : 'justify-end'}`}>
      {member.membership_status === 'pending' && (
        <>
          <button
            type="button"
            onClick={() => handleStatusChange(member.id, 'approved')}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            <Check className="h-3.5 w-3.5" />
            Approve
          </button>
          <button
            type="button"
            onClick={() =>
              setConfirmAction({
                type: 'status',
                id: member.id,
                name: member.full_name,
                nextValue: 'rejected',
                title: 'Reject Registration',
                description: `Reject ${member.full_name}'s fellowship registration?`,
                confirmLabel: 'Reject',
                destructive: true,
              })
            }
            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </button>
        </>
      )}

      {member.membership_status === 'approved' && member.id !== user?.id && (
        <button
          type="button"
          onClick={() =>
            setConfirmAction({
              type: 'status',
              id: member.id,
              name: member.full_name,
              nextValue: 'suspended',
              title: 'Suspend Member Account',
              description: `Suspend ${member.full_name}'s directory access until an administrator reactivates it?`,
              confirmLabel: 'Suspend Account',
              destructive: true,
            })
          }
          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <UserX className="h-3.5 w-3.5" />
          Suspend
        </button>
      )}

      {(member.membership_status === 'suspended' || member.membership_status === 'rejected') && (
        <button
          type="button"
          onClick={() => handleStatusChange(member.id, 'approved')}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
        >
          <UserCheck className="h-3.5 w-3.5" />
          Reactivate
        </button>
      )}

      {member.membership_status === 'approved' && member.id !== user?.id && (
        <button
          type="button"
          onClick={() =>
            setConfirmAction({
              type: 'role',
              id: member.id,
              name: member.full_name,
              nextValue: member.role === 'admin' ? 'member' : 'admin',
              title: member.role === 'admin' ? 'Revoke Administrator Role' : 'Assign Administrator Role',
              description:
                member.role === 'admin'
                  ? `Return ${member.full_name} to standard member access?`
                  : `Grant ${member.full_name} administrator access to review members and manage directory access? Only three administrator positions are available.`,
              confirmLabel: member.role === 'admin' ? 'Demote to Member' : 'Make Administrator',
              destructive: member.role === 'admin',
            })
          }
          disabled={member.role !== 'admin' && summary.admins >= summary.admin_limit}
          title={
            member.role !== 'admin' && summary.admins >= summary.admin_limit
              ? 'All three administrator positions are assigned'
              : undefined
          }
          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Shield className="h-3.5 w-3.5" />
          {member.role === 'admin' ? 'Demote' : 'Make Admin'}
        </button>
      )}

      <button
        type="button"
        onClick={() => openMemberEditor(member)}
        aria-label={`Edit ${member.full_name}`}
        className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <Edit3 className="h-3.5 w-3.5" />
        Edit
      </button>
    </div>
  );

  return (
    <PortalShell
      currentRoute="admin-members"
      onNavigate={onNavigate}
      title="Membership Access"
      subtitle="Review registrations, control directory access, and manage up to three administrators"
      headerAction={
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </button>
      }
    >
      {feedback && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {feedback}
        </div>
      )}
      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section aria-label="Membership summary" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Pending review', summary.pending, 'text-[#8A5B00]'],
          ['Approved members', summary.approved, 'text-emerald-700'],
          ['Suspended', summary.suspended, 'text-red-700'],
          ['Admin positions', `${summary.admins}/${summary.admin_limit}`, 'text-[#4B1C6F]'],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
            <p className={`mt-1 font-display text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </section>

      {/* Search & Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6 grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-6 relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or occupation..."
            className="w-full min-h-[42px] rounded-lg border border-slate-300 pl-10 pr-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
          />
        </div>
        <div className="md:col-span-3">
          <select
            aria-label="Filter by membership status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="suspended">Suspended</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="md:col-span-3">
          <select
            aria-label="Filter by role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
          >
            <option value="all">All Roles</option>
            <option value="member">Members</option>
            <option value="admin">Administrators</option>
          </select>
        </div>
      </div>

      {/* Member Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-600">
            No member records match the selected filters.
          </div>
        ) : (
          <>
            <div className="space-y-3 p-3 md:hidden">
              {members.map((member) => (
                <article key={member.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <MemberAvatar src={member.profile_image} name={member.full_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onSelectMember(member.id)}
                        className="block truncate text-left font-semibold text-slate-900 hover:text-[#4B1C6F] hover:underline"
                      >
                        {member.full_name}
                      </button>
                      <p className="truncate text-xs text-slate-500">{member.email}</p>
                      <p className="mt-1 text-[11px] text-slate-400 font-mono-num">
                        Joined {formatDateDDMMYYYY(member.date_of_joining || member.created_at)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-semibold capitalize ${
                        member.membership_status === 'approved'
                          ? 'text-emerald-700'
                          : member.membership_status === 'pending'
                          ? 'text-[#B47B07]'
                          : 'text-red-700'
                      }`}
                    >
                      {member.membership_status}
                    </span>
                  </div>
                  <div className="my-3 grid grid-cols-2 gap-3 border-y border-slate-100 py-3 text-xs">
                    <div>
                      <p className="text-slate-400">Occupation</p>
                      <p className="mt-0.5 truncate font-medium text-slate-700">{member.occupation || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Group / role</p>
                      <p className="mt-0.5 truncate font-medium capitalize text-slate-700">
                        {member.membership_category || 'General Member'} · {member.role}
                      </p>
                    </div>
                  </div>
                  {renderMemberActions(member, true)}
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Occupation & Group</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <MemberAvatar src={m.profile_image} name={m.full_name} size="sm" />
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => onSelectMember(m.id)}
                            className="font-semibold text-slate-900 hover:text-[#4B1C6F] hover:underline block truncate max-w-[200px]"
                          >
                            {m.full_name}
                          </button>
                          <p className="text-xs text-slate-500 truncate max-w-[220px]">{m.email}</p>
                          <p className="text-[11px] text-slate-400 font-mono-num">
                            Joined {formatDateDDMMYYYY(m.date_of_joining || m.created_at)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="text-slate-800 truncate max-w-[200px]">{m.occupation || '—'}</p>
                      <p className="text-xs text-slate-500 truncate max-w-[200px]">
                        {m.membership_category || 'General Member'}
                        {m.city || m.state ? ` · ${[m.city, m.state].filter(Boolean).join(', ')}` : ''}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-xs font-semibold capitalize ${
                          m.membership_status === 'approved'
                            ? 'text-emerald-700'
                            : m.membership_status === 'pending'
                            ? 'text-[#B47B07]'
                            : 'text-red-700'
                        }`}
                      >
                        {m.membership_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-700 capitalize">
                      {m.role}
                    </td>
                    <td className="py-3.5 px-4">
                      {renderMemberActions(m)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>

      {/* Edit Member Modal */}
      {editingMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl my-8 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Edit Member: {editingMember.full_name}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setEditingMember(null);
                  setIssuedReset(null);
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editingMember.full_name}
                  onChange={(e) => setEditingMember({ ...editingMember, full_name: e.target.value })}
                  className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Mobile Number *</label>
                <PhoneInput
                  id="admin-edit-phone"
                  required
                  value={editingMember.phone_number || ''}
                  onChange={(val) => setEditingMember({ ...editingMember, phone_number: val })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Occupation</label>
                <input
                  type="text"
                  value={editingMember.occupation || ''}
                  onChange={(e) => setEditingMember({ ...editingMember, occupation: e.target.value })}
                  className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Workplace</label>
                <input
                  type="text"
                  value={editingMember.workplace || ''}
                  onChange={(e) => setEditingMember({ ...editingMember, workplace: e.target.value })}
                  className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Designation</label>
                <input
                  type="text"
                  value={editingMember.professional_designation || ''}
                  onChange={(e) =>
                    setEditingMember({ ...editingMember, professional_designation: e.target.value })
                  }
                  className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Fellowship Group</label>
                <input
                  type="text"
                  value={editingMember.membership_category || ''}
                  onChange={(e) =>
                    setEditingMember({ ...editingMember, membership_category: e.target.value })
                  }
                  className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
              <p className="text-xs font-semibold text-slate-700">Residential Address</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-600">Country</label>
                  <input
                    type="text"
                    value={editingMember.country ?? 'Nigeria'}
                    onChange={(e) => setEditingMember({ ...editingMember, country: e.target.value })}
                    className="mt-1 w-full min-h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600">State / Province</label>
                  {(editingMember.country ?? 'Nigeria').trim().toLowerCase() === 'nigeria' ? (
                    <select
                      value={editingMember.state || 'Imo State'}
                      onChange={(e) => setEditingMember({ ...editingMember, state: e.target.value })}
                      className="mt-1 w-full min-h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                    >
                      {NIGERIAN_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={editingMember.state || ''}
                      onChange={(e) => setEditingMember({ ...editingMember, state: e.target.value })}
                      className="mt-1 w-full min-h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs text-slate-600">City / Town</label>
                  <input
                    type="text"
                    value={editingMember.city || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, city: e.target.value })}
                    className="mt-1 w-full min-h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600">LGA</label>
                  <input
                    type="text"
                    value={editingMember.lga || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, lga: e.target.value })}
                    className="mt-1 w-full min-h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600">Street / Estate</label>
                  <input
                    type="text"
                    value={editingMember.street_address || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, street_address: e.target.value })}
                    className="mt-1 w-full min-h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-700 mb-3">Visibility Overrides</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-600">Phone</label>
                  <select
                    value={editingMember.phone_visibility}
                    onChange={(e) =>
                      setEditingMember({
                        ...editingMember,
                        phone_visibility: e.target.value as FieldVisibility,
                      })
                    }
                    className="mt-1 w-full min-h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                  >
                    <option value="members">Members</option>
                    <option value="admins_only">Admins Only</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600">Email</label>
                  <select
                    value={editingMember.email_visibility}
                    onChange={(e) =>
                      setEditingMember({
                        ...editingMember,
                        email_visibility: e.target.value as FieldVisibility,
                      })
                    }
                    className="mt-1 w-full min-h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                  >
                    <option value="members">Members</option>
                    <option value="admins_only">Admins Only</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600">Birthday</label>
                  <select
                    value={editingMember.birthday_visibility}
                    onChange={(e) =>
                      setEditingMember({
                        ...editingMember,
                        birthday_visibility: e.target.value as BirthdayVisibility,
                      })
                    }
                    className="mt-1 w-full min-h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                  >
                    <option value="day_month">Month & Day</option>
                    <option value="full_date">Full Date</option>
                    <option value="admins_only">Admins Only</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-700">Account Recovery</p>
                  <p className="text-xs text-slate-500">
                    Generate a 30-minute single-use password reset link for this member.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={issuingReset}
                  onClick={() => handleIssueResetToken(editingMember.id)}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <KeyRound className="h-3.5 w-3.5 text-[#4B1C6F]" />
                  <span>{issuingReset ? 'Generating...' : 'Generate Reset Link'}</span>
                </button>
              </div>
              {issuedReset && (
                <div className="rounded-xl border border-[#4B1C6F]/20 bg-[#4B1C6F]/[0.04] p-3 space-y-2 text-xs">
                  <p className="font-semibold text-slate-800">
                    Single-Use Reset Link (expires in 30 minutes)
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={issuedReset.link}
                      className="flex-1 min-h-[34px] rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-[11px] text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(issuedReset.link);
                        setCopiedReset(true);
                      }}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-[#4B1C6F] px-3 py-1.5 font-medium text-white hover:bg-[#3A1458]"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>{copiedReset ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 font-mono break-all">
                    Token: {issuedReset.token}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setEditingMember(null);
                  setIssuedReset(null);
                }}
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="min-h-[40px] rounded-lg bg-[#4B1C6F] px-5 py-2 text-sm font-medium text-white hover:bg-[#3A1458] disabled:opacity-60"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title || ''}
        description={confirmAction?.description || ''}
        confirmLabel={confirmAction?.confirmLabel || 'Confirm'}
        destructive={confirmAction?.destructive}
        busy={actionBusy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction.type === 'status') {
            handleStatusChange(confirmAction.id, confirmAction.nextValue as MembershipStatus);
          } else {
            handleRoleChange(confirmAction.id, confirmAction.nextValue as UserRole);
          }
        }}
      />
    </PortalShell>
  );
}
