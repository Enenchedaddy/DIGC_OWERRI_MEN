import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch, setAuthToken } from '../services/api';
import { MemberProfile, ProfilePrivacy, PublicFellowshipInfo } from '../types';

interface MeResponse {
  profile: MemberProfile;
  privacy: ProfilePrivacy;
  fellowship: {
    fellowship_name: string;
    tagline: string;
    meeting_schedule: string;
    meeting_location: string;
  };
}

interface AuthContextValue {
  user: MemberProfile | null;
  privacy: ProfilePrivacy | null;
  publicInfo: PublicFellowshipInfo | null;
  loading: boolean;
  refreshSession: () => Promise<MemberProfile | null>;
  refreshPublicInfo: () => Promise<PublicFellowshipInfo | null>;
  loginWithToken: (token: string) => Promise<MemberProfile | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MemberProfile | null>(null);
  const [privacy, setPrivacy] = useState<ProfilePrivacy | null>(null);
  const [publicInfo, setPublicInfo] = useState<PublicFellowshipInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshPublicInfo = useCallback(async () => {
    try {
      const info = await apiFetch<PublicFellowshipInfo>('/api/public/info');
      setPublicInfo(info);
      return info;
    } catch {
      return null;
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const me = await apiFetch<MeResponse>('/api/auth/me');
      setUser(me.profile);
      setPrivacy(me.privacy);
      return me.profile;
    } catch {
      setUser(null);
      setPrivacy(null);
      setAuthToken(null);
      return null;
    }
  }, []);

  const loginWithToken = useCallback(
    async (token: string) => {
      setAuthToken(token);
      const profile = await refreshSession();
      await refreshPublicInfo();
      return profile;
    },
    [refreshPublicInfo, refreshSession]
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Clear client state even if session already expired.
    }
    setAuthToken(null);
    setUser(null);
    setPrivacy(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await Promise.all([refreshPublicInfo(), refreshSession()]);
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [refreshPublicInfo, refreshSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        privacy,
        publicInfo,
        loading,
        refreshSession,
        refreshPublicInfo,
        loginWithToken,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
