import { Edit3, Pin, Plus, Trash2, Upload, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PortalShell } from '../components/PortalShell';
import { ApiError, apiFetch } from '../services/api';
import { Announcement, AppRoute } from '../types';
import { formatDateDDMMYYYY } from '../utils/formatters';

export function AdminAnnouncementsPage({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'published' | 'draft'>('published');
  const [isPinned, setIsPinned] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ announcements: Announcement[] }>('/api/admin/announcements');
      setAnnouncements(res.announcements);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load announcements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNewForm = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setStatus('published');
    setIsPinned(false);
    setImageFile(null);
    setFormOpen(true);
  };

  const openEditForm = (ann: Announcement) => {
    setEditingId(ann.id);
    setTitle(ann.title);
    setContent(ann.content);
    setStatus(ann.status);
    setIsPinned(ann.is_pinned === 1);
    setImageFile(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('content', content);
      fd.append('status', status);
      fd.append('is_pinned', isPinned ? 'true' : 'false');
      if (imageFile) {
        fd.append('image', imageFile);
      }

      if (editingId) {
        await apiFetch(`/api/admin/announcements/${editingId}`, { method: 'PATCH', body: fd });
      } else {
        await apiFetch('/api/admin/announcements', { method: 'POST', body: fd });
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save announcement.');
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (ann: Announcement) => {
    try {
      await apiFetch(`/api/admin/announcements/${ann.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_pinned: ann.is_pinned === 1 ? 0 : 1 }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update pin state.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/admin/announcements/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete announcement.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PortalShell
      currentRoute="admin-announcements"
      onNavigate={onNavigate}
      title="Announcement Management"
      subtitle="Create, pin, draft, and publish official fellowship announcements"
      headerAction={
        <button
          type="button"
          onClick={openNewForm}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#4B1C6F] px-4 py-2 text-sm font-medium text-white hover:bg-[#3A1458] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Announcement</span>
        </button>
      }
    >
      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 rounded-xl border border-slate-200 bg-white p-6 space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h2 className="font-display text-base font-semibold text-slate-900">
              {editingId ? 'Edit Announcement' : 'Publish New Announcement'}
            </h2>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="p-1 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div>
            <label htmlFor="ann-title" className="block text-sm font-medium text-slate-700">
              Title *
            </label>
            <input
              id="ann-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full min-h-[42px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="ann-content" className="block text-sm font-medium text-slate-700">
              Content *
            </label>
            <textarea
              id="ann-content"
              rows={5}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#4B1C6F] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="ann-status" className="block text-sm font-medium text-slate-700">
                Status
              </label>
              <select
                id="ann-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'published' | 'draft')}
                className="mt-1 block w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="published">Published (Visible to Members)</option>
                <option value="draft">Draft (Admins Only)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="ann-image"
                className="flex min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Upload className="h-4 w-4" />
                <span className="truncate">{imageFile ? imageFile.name : 'Optional Banner Image'}</span>
              </label>
              <input
                id="ann-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="sr-only"
              />
            </div>

            <label className="flex min-h-[42px] items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#4B1C6F]"
              />
              <span>Pin to top of announcements</span>
            </label>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[40px] rounded-lg bg-[#4B1C6F] px-5 py-2 text-sm font-medium text-white hover:bg-[#3A1458] disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Publish Announcement'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 rounded-xl border border-slate-200 bg-white animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          {announcements.map((ann) => (
            <div key={ann.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span
                    className={`font-semibold capitalize ${
                      ann.status === 'published' ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {ann.status}
                  </span>
                  {ann.is_pinned === 1 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-[#B47B07]">Pinned</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{ann.author_name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">{formatDateDDMMYYYY(ann.created_at)}</span>
                </div>
                <h3 className="mt-1 font-display text-base font-semibold text-slate-900">{ann.title}</h3>
                <p className="mt-1 text-sm text-slate-600 line-clamp-2">{ann.content}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => togglePin(ann)}
                  className={`inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    ann.is_pinned === 1
                      ? 'border-amber-300 bg-amber-50 text-[#B47B07]'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Pin className="h-3.5 w-3.5" />
                  <span>{ann.is_pinned === 1 ? 'Unpin' : 'Pin'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openEditForm(ann)}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(ann)}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Announcement"
        description={`Permanently delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete Announcement"
        destructive
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </PortalShell>
  );
}
