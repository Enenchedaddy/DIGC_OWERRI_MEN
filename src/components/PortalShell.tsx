import {
  Cake,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  ShieldCheck,
  UserCheck,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AppRoute } from '../types';
import { MemberAvatar } from './MemberAvatar';

interface PortalShellProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  title: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

export function PortalShell({
  currentRoute,
  onNavigate,
  title,
  subtitle,
  headerAction,
  children,
}: PortalShellProps) {
  const { user, publicInfo, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const memberLinks: Array<{ route: AppRoute; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { route: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { route: 'directory', label: 'Member Directory', icon: Users },
    { route: 'birthdays', label: 'Birthdays', icon: Cake },
    { route: 'announcements', label: 'Announcements', icon: Megaphone },
    { route: 'my-profile', label: 'My Profile', icon: UserCircle },
  ];

  const adminLinks: Array<{ route: AppRoute; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { route: 'admin-dashboard', label: 'Admin Overview', icon: ShieldCheck },
    { route: 'admin-members', label: 'Member Management', icon: UserCheck },
    { route: 'admin-announcements', label: 'Manage Announcements', icon: Megaphone },
    { route: 'admin-settings', label: 'Fellowship Settings', icon: Settings },
  ];

  const handleNav = (route: AppRoute) => {
    setMobileMenuOpen(false);
    onNavigate(route);
  };

  const handleLogout = async () => {
    await logout();
    onNavigate('landing');
  };

  const fellowshipName = publicInfo?.fellowship_name || 'DUNAMIS INTERNATIONAL GOSPEL CENTRE, OWERRI';
  const logoUrl = publicInfo?.logo_url || '/src/assets/images/dunamis_owerri_logo_1795268208018.jpg';

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200 px-4 py-6">
      <div className="space-y-6">
        <div className="px-2">
          <button
            type="button"
            onClick={() => handleNav('dashboard')}
            className="flex items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <img
              src={logoUrl}
              alt={`${fellowshipName} logo`}
              referrerPolicy="no-referrer"
              className="h-10 w-10 rounded-lg object-cover border border-[#4B1C6F]/20 bg-[#3B1557] shrink-0"
            />
            <span className="font-display text-sm font-bold leading-snug tracking-tight text-slate-900 block">
              {fellowshipName}
            </span>
          </button>
        </div>

        <nav aria-label="Member navigation" className="space-y-1">
          <p className="px-2 pb-1 text-xs font-medium text-slate-500">Fellowship</p>
          {memberLinks.map((item) => {
            const Icon = item.icon;
            const active =
              currentRoute === item.route ||
              (item.route === 'directory' && currentRoute === 'member-profile');
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => handleNav(item.route)}
                className={`flex w-full min-h-[42px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#4B1C6F] text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {user?.role === 'admin' && (
          <nav aria-label="Administrator navigation" className="space-y-1 pt-2 border-t border-slate-200">
            <p className="px-2 pb-1 text-xs font-medium text-slate-500">Administration</p>
            {adminLinks.map((item) => {
              const Icon = item.icon;
              const active = currentRoute === item.route;
              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => handleNav(item.route)}
                  className={`flex w-full min-h-[42px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#4B1C6F] text-white'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {user && (
        <div className="pt-4 border-t border-slate-200 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <MemberAvatar src={user.profile_image} name={user.full_name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{user.full_name}</p>
              <p className="truncate text-xs text-slate-500">
                {user.role === 'admin' ? 'Administrator' : 'Member'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full min-h-[40px] items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[260px] shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute right-3 top-4 flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Column */}
      <div className="relative flex-1 min-w-0 flex flex-col">
        {/* Subtle Official Church Emblem Watermark */}
        <div
          aria-hidden="true"
          className="pointer-events-none select-none fixed inset-0 lg:left-[260px] z-0 flex items-center justify-center overflow-hidden"
        >
          <img
            src={logoUrl}
            alt=""
            className="w-[340px] sm:w-[460px] max-w-[75vw] rounded-full object-cover opacity-[0.045] grayscale-[20%]"
          />
        </div>

        <header className="sticky top-0 z-30 bg-[#FAF9F6]/95 backdrop-blur-sm border-b border-slate-200 px-4 sm:px-8 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                className="lg:hidden flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shrink-0"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-xs sm:text-sm text-slate-500 truncate">{subtitle}</p>
                )}
              </div>
            </div>
            {headerAction && <div className="shrink-0">{headerAction}</div>}
          </div>
        </header>

        <main className="relative z-10 flex-1 px-4 sm:px-8 py-6 sm:py-8">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>

        <footer className="relative z-10 border-t border-slate-200/80 px-4 sm:px-8 py-4 text-xs text-slate-500">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="font-medium text-slate-600">{fellowshipName} · Men&apos;s Fellowship Portal</p>
            <p>{publicInfo?.official_domain || 'digcowerri.com'} · Owerri, Imo State, Nigeria · WAT (Africa/Lagos)</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
