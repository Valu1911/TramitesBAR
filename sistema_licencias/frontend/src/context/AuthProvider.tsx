import { useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { api, ApiError } from '../lib/api';
import type { User, SessionPayload, Role } from '../lib/types';
import { AuthContext } from './AuthContextDefinition';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaEnrollmentRequired, setMfaEnrollmentRequired] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get<SessionPayload>('/auth/me')
      .then((data) => {
        if (active) {
          setUser(data.user);
          setMfaEnrollmentRequired(Boolean(data.mfa_enrollment_required));
        }
      })
      .catch((err) => {
        if (active && err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setUser(null);
          setMfaEnrollmentRequired(false);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    try {
      const data = await api.get<SessionPayload>('/auth/me');
      setUser(data.user);
      setMfaEnrollmentRequired(Boolean(data.mfa_enrollment_required));
      return data.user;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setUser(null);
        setMfaEnrollmentRequired(false);
      }
      return null;
    }
  }, []);

  const login = useCallback(
    async (identifier: string, password: string, mfaCode?: string): Promise<SessionPayload> => {
      const payload = await api.post<SessionPayload>('/auth/login', {
        identifier,
        password,
        mfa_code: mfaCode ? mfaCode.trim() : undefined,
      });
      setUser(payload.user);
      setMfaEnrollmentRequired(Boolean(payload.mfa_enrollment_required));
      return payload;
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Limpieza de estado local
    } finally {
      setUser(null);
      setMfaEnrollmentRequired(false);
    }
  }, []);

  const isCitizen = useMemo(() => user?.role === 'citizen', [user]);
  const isStaff = useMemo(() => Boolean(user && user.role !== 'citizen'), [user]);

  const hasRole = useCallback(
    (...roles: Role[]): boolean => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      mfaEnrollmentRequired,
      login,
      logout,
      refreshUser,
      isStaff,
      isCitizen,
      hasRole,
    }),
    [user, loading, mfaEnrollmentRequired, login, logout, refreshUser, isStaff, isCitizen, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

