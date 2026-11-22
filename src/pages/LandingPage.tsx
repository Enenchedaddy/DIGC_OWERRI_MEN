import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AppRoute } from '../types';

interface LandingPageProps {
  onNavigate: (route: AppRoute) => void;
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  const { publicInfo, user } = useAuth();
  const fellowshipName = publicInfo?.fellowship_name || 'DUNAMIS INTERNATIONAL GOSPEL CENTRE, OWERRI';
  const logoUrl = publicInfo?.logo_url || '/src/assets/images/dunamis_owerri_logo_1795268208018.jpg';
  const officialDomain = publicInfo?.official_domain || 'digcowerri.com';

  const handleSignInAction = () => {
    if (user) {
      if (user.membership_status === 'approved') {
        onNavigate('dashboard');
      } else {
        onNavigate('pending');
      }
    } else {
      onNavigate('login');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-slate-900 flex flex-col">
      {/* 1. Header and Church Branding */}
      <header className="sticky top-0 z-30 bg-[#FAF9F6]/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3.5 sm:py-4 flex items-center justify-between gap-4">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-3 font-display font-bold tracking-tight text-slate-900 min-w-0"
          >
            <img
              src={logoUrl}
              alt={`${fellowshipName} emblem`}
              referrerPolicy="no-referrer"
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg object-cover border border-[#4B1C6F]/25 bg-[#3B1557] shrink-0"
            />
            <span className="sm:hidden text-sm font-bold tracking-wide text-slate-900 whitespace-nowrap">
              DIGC OWERRI
            </span>
            <span className="hidden sm:inline text-sm md:text-base font-bold tracking-tight text-slate-900 leading-snug">
              {fellowshipName}
            </span>
          </a>

          <button
            type="button"
            onClick={handleSignInAction}
            className="min-h-[40px] rounded-lg bg-[#4B1C6F] px-4 py-2 text-sm font-medium text-white hover:bg-[#3A1458] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4B1C6F]"
          >
            {user ? 'Open Portal' : 'Sign In'}
          </button>
        </div>
      </header>

      {/* 2. Main Welcome / Hero Section & 3. Membership Registration / Sign-In Actions */}
      <main id="top" className="flex-1 flex items-center overflow-x-clip">
        <section className="w-full max-w-6xl mx-auto px-4 sm:px-8 py-10 sm:py-14 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <div className="mb-5 flex items-center gap-3.5">
                <img
                  src={logoUrl}
                  alt={fellowshipName}
                  referrerPolicy="no-referrer"
                  className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl object-cover border border-[#4B1C6F]/25 bg-[#3B1557] shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-display text-xs sm:text-sm font-bold tracking-wide text-[#4B1C6F] leading-snug">
                    {fellowshipName}
                  </p>
                  <p className="mt-0.5 text-xs sm:text-sm font-semibold text-[#B47B07]">
                    Men&apos;s Fellowship · Brotherhood, Stewardship &amp; Service
                  </p>
                </div>
              </div>

              <h1
                className="font-display font-bold tracking-tight text-[#0F172A] leading-[1.12]"
                style={{ fontSize: 'clamp(2rem, 3.6vw, 3.15rem)', textWrap: 'balance' }}
              >
                A private home for men walking together in faith and purpose.
              </h1>

              <p className="mt-5 text-base sm:text-lg leading-relaxed text-slate-600 max-w-xl">
                A private digital home connecting the men of Dunamis International Gospel Centre, Owerri, for fellowship, connection, accountability and growth.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => onNavigate('register')}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-[#4B1C6F] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#3A1458] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4B1C6F]"
                >
                  <span>Create Membership</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={handleSignInAction}
                  className="inline-flex min-h-[46px] items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4B1C6F]"
                >
                  {user ? 'Open Member Portal' : 'Member Sign In'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[260px] sm:min-h-[360px] lg:min-h-[400px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                <img
                  src="/assets/aistudio/IMG_2492_64588608.jpeg"
                  alt="Sanctuary interior of Dunamis International Gospel Centre, Owerri"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 4. Simple Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2.5 text-center sm:text-left">
            <img
              src={logoUrl}
              alt={`${fellowshipName} emblem`}
              referrerPolicy="no-referrer"
              className="h-6 w-6 rounded object-cover border border-[#4B1C6F]/20 bg-[#3B1557] shrink-0"
            />
            <span>
              Dunamis International Gospel Centre, Owerri <span aria-hidden="true">·</span> Men&apos;s Fellowship Directory
            </span>
          </div>
          <p className="text-center sm:text-right">
            © 2026 Dunamis International Gospel Centre, Owerri <span aria-hidden="true">·</span>{' '}
            <span className="font-medium text-slate-700">{officialDomain}</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

