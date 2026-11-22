import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminMembersPage } from './pages/AdminMembersPage';
import {
  ForgotPasswordPage,
  LoginPage,
  PendingApprovalPage,
  RegisterPage,
  ResetPasswordPage,
  UnauthorizedPage,
} from './pages/AuthPages';
import { LandingPage } from './pages/LandingPage';
import { MemberDirectory } from './pages/MemberDirectory';
import { MemberProfilePage } from './pages/MemberProfilePage';
import { MyProfilePage } from './pages/MyProfilePage';
import { AppRoute } from './types';

const ROUTE_TO_PATH: Record<AppRoute, string> = {
  landing: '/',
  login: '/login',
  register: '/register',
  'forgot-password': '/forgot-password',
  'reset-password': '/reset-password',
  'admin-setup': '/admin-setup',
  pending: '/pending',
  unauthorized: '/unauthorized',
  dashboard: '/dashboard',
  directory: '/directory',
  'member-profile': '/members',
  'my-profile': '/my-profile',
  birthdays: '/birthdays',
  announcements: '/announcements',
  'admin-dashboard': '/admin',
  'admin-members': '/admin/members',
  'admin-announcements': '/admin/announcements',
  'admin-settings': '/admin/settings',
};

const PUBLIC_ROUTES: AppRoute[] = [
  'landing',
  'login',
  'register',
  'forgot-password',
  'reset-password',
];

const ADMIN_ROUTES: AppRoute[] = ['admin-members'];

const LEGACY_MEMBER_ROUTES: AppRoute[] = ['dashboard', 'birthdays', 'announcements'];
const LEGACY_ADMIN_ROUTES: AppRoute[] = [
  'admin-dashboard',
  'admin-announcements',
  'admin-settings',
];

function parseLocation(): { route: AppRoute; memberId: string | null } {
  const pathname = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
  if (pathname.startsWith('/members/')) {
    const id = decodeURIComponent(pathname.slice('/members/'.length));
    if (id) return { route: 'member-profile', memberId: id };
  }
  const match = (Object.entries(ROUTE_TO_PATH) as Array<[AppRoute, string]>).find(
    ([, path]) => path === pathname
  );
  return { route: match ? match[0] : 'landing', memberId: null };
}

function PortalRouter() {
  const { user, loading } = useAuth();
  const initial = parseLocation();
  const [route, setRoute] = useState<AppRoute>(initial.route);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(initial.memberId);

  useEffect(() => {
    const onPopState = () => {
      const next = parseLocation();
      setRoute(next.route);
      setSelectedMemberId(next.memberId);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((nextRoute: AppRoute) => {
    const nextPath = ROUTE_TO_PATH[nextRoute] || '/';
    if (window.location.pathname !== nextPath) {
      window.history.pushState({ route: nextRoute }, '', nextPath);
    }
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openMemberProfile = useCallback((memberId: string) => {
    const nextPath = `/members/${encodeURIComponent(memberId)}`;
    if (window.location.pathname !== nextPath) {
      window.history.pushState({ route: 'member-profile', memberId }, '', nextPath);
    }
    setSelectedMemberId(memberId);
    setRoute('member-profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (loading || !user || user.membership_status !== 'approved') return;
    if (route === 'login' || route === 'pending') {
      const target: AppRoute = 'directory';
      const nextPath = ROUTE_TO_PATH[target];
      if (window.location.pathname !== nextPath) {
        window.history.replaceState({ route: target }, '', nextPath);
      }
      setRoute(target);
    }
  }, [loading, user, route]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-7 w-7 rounded-full border-2 border-[#4B1C6F] border-t-transparent animate-spin" />
          <p className="text-sm text-slate-600">Loading fellowship portal...</p>
        </div>
      </div>
    );
  }

  const protectedTarget = !PUBLIC_ROUTES.includes(route) ? route : undefined;

  // Public routes
  if (route === 'landing') {
    return <LandingPage onNavigate={navigate} />;
  }
  if (route === 'login') {
    if (user) {
      if (user.membership_status !== 'approved') {
        return <PendingApprovalPage onNavigate={navigate} />;
      }
      return <MemberDirectory onNavigate={navigate} onSelectMember={openMemberProfile} />;
    }
    return <LoginPage onNavigate={navigate} />;
  }
  if (route === 'register') {
    return <RegisterPage onNavigate={navigate} />;
  }
  if (route === 'forgot-password') {
    return <ForgotPasswordPage onNavigate={navigate} />;
  }
  if (route === 'reset-password') {
    return <ResetPasswordPage onNavigate={navigate} />;
  }
  if (route === 'admin-setup') return <LoginPage onNavigate={navigate} />;

  // Authentication gate for all private routes
  if (!user) {
    return <LoginPage onNavigate={navigate} postLoginRoute={protectedTarget} />;
  }

  // Approval gate: Pending / Suspended / Rejected users cannot access private portal routes
  if (user.membership_status !== 'approved') {
    return <PendingApprovalPage onNavigate={navigate} />;
  }

  if (route === 'pending') {
    return <MemberDirectory onNavigate={navigate} onSelectMember={openMemberProfile} />;
  }

  if (LEGACY_MEMBER_ROUTES.includes(route)) {
    return <MemberDirectory onNavigate={navigate} onSelectMember={openMemberProfile} />;
  }

  if (LEGACY_ADMIN_ROUTES.includes(route)) {
    return user.role === 'admin' ? (
      <AdminMembersPage onNavigate={navigate} onSelectMember={openMemberProfile} />
    ) : (
      <UnauthorizedPage onNavigate={navigate} />
    );
  }

  // Admin route authorization gate
  if (ADMIN_ROUTES.includes(route) && user.role !== 'admin') {
    return <UnauthorizedPage onNavigate={navigate} />;
  }

  switch (route) {
    case 'directory':
      return <MemberDirectory onNavigate={navigate} onSelectMember={openMemberProfile} />;
    case 'member-profile':
      return selectedMemberId ? (
        <MemberProfilePage memberId={selectedMemberId} onNavigate={navigate} />
      ) : (
        <MemberDirectory onNavigate={navigate} onSelectMember={openMemberProfile} />
      );
    case 'my-profile':
      return <MyProfilePage onNavigate={navigate} />;
    case 'admin-members':
      return <AdminMembersPage onNavigate={navigate} onSelectMember={openMemberProfile} />;
    case 'unauthorized':
      return <UnauthorizedPage onNavigate={navigate} />;
    default:
      return <MemberDirectory onNavigate={navigate} onSelectMember={openMemberProfile} />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <PortalRouter />
    </AuthProvider>
  );
}
