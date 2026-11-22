import { ChevronLeft, ChevronRight, Search, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MemberAvatar } from '../components/MemberAvatar';
import { PortalShell } from '../components/PortalShell';
import { apiFetch } from '../services/api';
import { AppRoute, MemberProfile } from '../types';

interface DirectoryResponse {
  members: MemberProfile[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  filters: {
    occupations: string[];
    categories: string[];
  };
}

export function MemberDirectory({
  onNavigate,
  onSelectMember,
}: {
  onNavigate: (route: AppRoute) => void;
  onSelectMember: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [occupation, setOccupation] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<DirectoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 220);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '12',
        });
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (occupation) params.set('occupation', occupation);
        if (category) params.set('category', category);

        const res = await apiFetch<DirectoryResponse>(`/api/members?${params.toString()}`);
        if (active) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load directory.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [debouncedSearch, occupation, category, page]);

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setOccupation('');
    setCategory('');
    setPage(1);
  };

  return (
    <PortalShell
      currentRoute="directory"
      onNavigate={onNavigate}
      title="Member Directory"
      subtitle={
        data
          ? `${data.pagination.total} verified fellowship ${data.pagination.total === 1 ? 'member' : 'members'}`
          : 'Search and connect with verified fellowship members'
      }
    >
      {/* Search & Filter Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Search members by name, occupation, or skills"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, occupation, or skills..."
              className="w-full min-h-[42px] rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2 text-sm text-slate-900 focus:border-[#4B1C6F] focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Filter by occupation"
              value={occupation}
              onChange={(e) => {
                setOccupation(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#4B1C6F] focus:outline-none"
            >
              <option value="">All Occupations</option>
              {data?.filters.occupations.map((occ) => (
                <option key={occ} value={occ}>
                  {occ}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Filter by fellowship group"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#4B1C6F] focus:outline-none"
            >
              <option value="">All Groups</option>
              {data?.filters.categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1 flex">
            <button
              type="button"
              onClick={clearFilters}
              className="w-full min-h-[42px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 rounded-xl border border-slate-200 bg-white animate-pulse" />
          ))}
        </div>
      ) : data && data.members.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 font-display text-base font-semibold text-slate-900">
            No matching members found
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Try clearing your search query or selecting a different occupation filter.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-4 min-h-[40px] rounded-lg bg-[#4B1C6F] px-4 py-2 text-sm font-medium text-white hover:bg-[#3A1458]"
          >
            Clear Filters
          </button>
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.members.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => onSelectMember(member.id)}
                className="text-left rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div className="flex items-start gap-4">
                  <MemberAvatar src={member.profile_image} name={member.full_name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-base font-semibold text-slate-900 truncate">
                      {member.full_name}
                    </h2>
                    <p className="mt-0.5 text-sm font-medium text-slate-700 truncate">
                      {member.occupation || 'Fellowship Member'}
                    </p>
                    {member.professional_designation && (
                      <p className="text-xs text-slate-500 truncate">{member.professional_designation}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between gap-2">
                  <span className="truncate">
                    {member.membership_category || 'General Member'}
                    {(() => {
                      const cityState = [member.city, member.state].filter(Boolean).join(', ');
                      const displayLoc = cityState || member.residential_location;
                      return displayLoc ? ` · ${displayLoc}` : '';
                    })()}
                  </span>
                  <span className="font-medium text-[#4B1C6F] shrink-0">View</span>
                </div>
              </button>
            ))}
          </div>

          {data.pagination.total_pages > 1 && (
            <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-4">
              <p className="text-xs text-slate-500 font-mono-num">
                Page {data.pagination.page} of {data.pagination.total_pages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  disabled={page >= data.pagination.total_pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}
    </PortalShell>
  );
}
