/**
 * Enrutador principal y guardias de autorización por rol.
 *
 * Protege las rutas vecinales y administrativas verificando la sesión activa en
 * el servidor.
 */

import type { ReactNode } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/components/AuthContext";
import { Layout } from "@/components/Layout";
import {
  HomePage,
  LoginPage,
  PasswordResetPage,
  PoliciesPage,
  RegisterPage,
  VerifyEmailPage,
  VerifyLicensePage,
} from "@/pages/PublicPages";
import {
  CitizenDashboardPage,
  CitizenLicensesPage,
  CitizenSecurityPage,
  ProcedureDetailPage,
} from "@/pages/CitizenPages";
import {
  AdminAppointmentsPage,
  AdminAuditPage,
  AdminDashboardPage,
  AdminLicensesPage,
  AdminPaymentsPage,
  AdminPoliciesPage,
  AdminProceduresPage,
  AdminQuestionsPage,
  AdminUsersPage,
} from "@/pages/AdminPages";

const defaultQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/** Guardia para vistas que exigen sesión autenticada. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="card">
        <p className="muted-text">Verificando sesión activa...</p>
      </div>
    );
  }

  if (!session.authenticated) {
    return <Navigate to="/ingresar" replace />;
  }

  return <>{children}</>;
}

/** Guardia para vistas exclusivas del personal municipal. */
export function RequireStaff({ children }: { children: ReactNode }) {
  const { session, isStaff, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="card">
        <p className="muted-text">Verificando permisos municipales...</p>
      </div>
    );
  }

  if (!session.authenticated) {
    return <Navigate to="/ingresar" replace />;
  }

  if (!isStaff) {
    return <Navigate to="/panel" replace />;
  }

  return <>{children}</>;
}

/** Vista institucional para rutas inexistentes. */
function NotFoundPage() {
  return (
    <div className="card">
      <span className="page-eyebrow">Error 404</span>
      <h1 className="page-title">Página no encontrada</h1>
      <p className="page-subtitle bottom-gap-md">
        La dirección solicitada no existe dentro del portal de licencias de la
        Municipalidad de Baradero.
      </p>
      <Link to="/" className="btn btn-primary">
        Volver al inicio
      </Link>
    </div>
  );
}

/** Árbol de rutas envuelto en el proveedor de sesión y diseño institucional. */
export function AppShellRoutes() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/verificar" element={<VerifyLicensePage />} />
          <Route path="/verificar/:token" element={<VerifyLicensePage />} />
          <Route path="/politicas" element={<PoliciesPage />} />
          <Route path="/politicas/:slug" element={<PoliciesPage />} />
          <Route path="/ingresar" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/verificar-correo" element={<VerifyEmailPage />} />
          <Route path="/recuperar" element={<PasswordResetPage />} />

          <Route
            path="/panel"
            element={
              <RequireAuth>
                <CitizenDashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/panel/tramites/:id"
            element={
              <RequireAuth>
                <ProcedureDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/panel/licencias"
            element={
              <RequireAuth>
                <CitizenLicensesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/panel/seguridad"
            element={
              <RequireAuth>
                <CitizenSecurityPage />
              </RequireAuth>
            }
          />

          <Route
            path="/admin"
            element={
              <RequireStaff>
                <AdminDashboardPage />
              </RequireStaff>
            }
          />
          <Route
            path="/admin/tramites"
            element={
              <RequireStaff>
                <AdminProceduresPage />
              </RequireStaff>
            }
          />
          <Route
            path="/admin/tramites/:id"
            element={
              <RequireStaff>
                <AdminProceduresPage />
              </RequireStaff>
            }
          />
          <Route
            path="/admin/pagos"
            element={
              <RequireStaff>
                <AdminPaymentsPage />
              </RequireStaff>
            }
          />
          <Route
            path="/admin/turnos"
            element={
              <RequireStaff>
                <AdminAppointmentsPage />
              </RequireStaff>
            }
          />
          <Route
            path="/admin/preguntas"
            element={
              <RequireStaff>
                <AdminQuestionsPage />
              </RequireStaff>
            }
          />
          <Route
            path="/admin/licencias"
            element={
              <RequireStaff>
                <AdminLicensesPage />
              </RequireStaff>
            }
          />
          <Route
            path="/admin/usuarios"
            element={
              <RequireStaff>
                <AdminUsersPage />
              </RequireStaff>
            }
          />
          <Route
            path="/admin/politicas"
            element={
              <RequireStaff>
                <AdminPoliciesPage />
              </RequireStaff>
            }
          />
          <Route
            path="/admin/auditoria"
            element={
              <RequireStaff>
                <AdminAuditPage />
              </RequireStaff>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </AuthProvider>
  );
}

/** Componente raíz de la aplicación web. */
export function App() {
  return (
    <QueryClientProvider client={defaultQueryClient}>
      <BrowserRouter>
        <AppShellRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
