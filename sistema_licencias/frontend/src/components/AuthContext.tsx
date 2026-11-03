/* eslint-disable react-refresh/only-export-components */
/**
 * Contexto de sesión y permisos del usuario autenticado.
 *
 * Consulta el estado real en el servidor mediante cookies httpOnly (`/auth/me`)
 * y las políticas obligatorias pendientes (`/policies/pending`). No almacena
 * credenciales ni tokens en localStorage.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Role, SessionPayload, User } from "@/lib/types";

const STAFF_ROLES: ReadonlySet<Role> = new Set<Role>([
  "admin",
  "superadmin",
  "admin_pagos",
  "admin_salud",
  "admin_turnos",
  "admin_cuentas",
]);

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<string>> = {
  citizen: new Set(["self.read", "self.write"]),
  admin_cuentas: new Set([
    "procedures.read",
    "users.read",
    "users.manage",
    "audit.read",
  ]),
  admin_salud: new Set([
    "procedures.read",
    "documents.review_health",
    "audit.read",
  ]),
  admin_pagos: new Set([
    "procedures.read",
    "payments.read",
    "payments.review",
    "payments.import",
    "audit.read",
  ]),
  admin_turnos: new Set([
    "procedures.read",
    "appointments.read",
    "appointments.manage",
    "licenses.issue",
    "licenses.revoke",
    "audit.read",
  ]),
  admin: new Set([
    "procedures.read",
    "procedures.manage",
    "documents.review",
    "payments.read",
    "payments.review",
    "payments.import",
    "appointments.read",
    "appointments.manage",
    "licenses.issue",
    "licenses.revoke",
    "users.read",
    "users.manage",
    "questions.read",
    "questions.manage",
    "policies.manage",
    "audit.read",
    "reports.read",
    "settings.read",
  ]),
  superadmin: new Set(["*"]),
};

export interface AuthSessionState {
  authenticated: boolean;
  user: User | null;
  mfa_verified: boolean;
  mfa_enrollment_required: boolean;
  pending_policies: string[];
}

export interface AuthContextValue {
  session: AuthSessionState;
  isLoading: boolean;
  isStaff: boolean;
  isCitizen: boolean;
  hasRole: (...roles: Role[]) => boolean;
  hasPermission: (permission: string) => boolean;
  refetchSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchSessionPayload(): Promise<SessionPayload | null> {
  try {
    return await api.get<SessionPayload>("/auth/me");
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return null;
    }
    throw err;
  }
}

async function fetchPendingPolicies(): Promise<string[]> {
  try {
    return await api.get<string[]>("/policies/pending");
  } catch {
    return [];
  }
}

/** Proveedor de sesión institucional. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchSessionPayload,
    retry: false,
    staleTime: 30_000,
  });

  const authenticated = Boolean(sessionQuery.data?.user);

  const pendingPoliciesQuery = useQuery({
    queryKey: ["auth", "pending-policies", sessionQuery.data?.user.id ?? 0],
    queryFn: fetchPendingPolicies,
    enabled: authenticated,
    retry: false,
    staleTime: 30_000,
  });

  const refetchSession = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["auth"] });
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Si la sesión ya expiró en el servidor, limpiamos la caché local de consultas.
    }
    queryClient.setQueryData(["auth", "me"], null);
    queryClient.removeQueries({ queryKey: ["auth", "pending-policies"] });
    await queryClient.invalidateQueries();
  }, [queryClient]);

  const user = sessionQuery.data?.user ?? null;
  const isStaff = Boolean(user && STAFF_ROLES.has(user.role));
  const isCitizen = Boolean(user && user.role === "citizen");

  const hasRole = useCallback(
    (...roles: Role[]) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user],
  );

  const hasPermission = useCallback(
    (permission: string) => {
      if (!user) return false;
      const perms = ROLE_PERMISSIONS[user.role];
      if (!perms) return false;
      return perms.has("*") || perms.has(permission);
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session: {
        authenticated,
        user,
        mfa_verified: Boolean(user?.mfa_enabled),
        mfa_enrollment_required: Boolean(
          sessionQuery.data?.mfa_enrollment_required,
        ),
        pending_policies: pendingPoliciesQuery.data ?? [],
      },
      isLoading: sessionQuery.isLoading,
      isStaff,
      isCitizen,
      hasRole,
      hasPermission,
      refetchSession,
      logout,
    }),
    [
      authenticated,
      user,
      sessionQuery.data?.mfa_enrollment_required,
      sessionQuery.isLoading,
      pendingPoliciesQuery.data,
      isStaff,
      isCitizen,
      hasRole,
      hasPermission,
      refetchSession,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook de acceso al contexto de autenticación. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe utilizarse dentro de AuthProvider");
  }
  return ctx;
}
