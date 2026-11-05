<<<<<<< HEAD
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
=======
import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import type { Role } from './lib/types';

// Carga diferida de vistas para optimización de paquetes y rendimiento
const Login = lazy(() => import('./pages/auth/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/auth/Register').then((m) => ({ default: m.Register })));
const ForgotPassword = lazy(() =>
  import('./pages/auth/ForgotPassword').then((m) => ({ default: m.ForgotPassword })),
);
const ResetPassword = lazy(() =>
  import('./pages/auth/ResetPassword').then((m) => ({ default: m.ResetPassword })),
);
const VerifyEmail = lazy(() =>
  import('./pages/auth/VerifyEmail').then((m) => ({ default: m.VerifyEmail })),
);
const Profile = lazy(() => import('./pages/citizen/Profile').then((m) => ({ default: m.Profile })));
const CitizenPanel = lazy(() =>
  import('./pages/citizen/CitizenPanel').then((m) => ({ default: m.CitizenPanel })),
);
const Charlas = lazy(() =>
  import('./pages/citizen/Charlas').then((m) => ({ default: m.Charlas })),
);
const Health = lazy(() =>
  import('./pages/citizen/Health').then((m) => ({ default: m.Health })),
);
const TheoryExam = lazy(() =>
  import('./pages/citizen/TheoryExam').then((m) => ({ default: m.TheoryExam })),
);
const PracticalAppointment = lazy(() =>
  import('./pages/citizen/PracticalAppointment').then((m) => ({ default: m.PracticalAppointment })),
);
const Delivery = lazy(() =>
  import('./pages/citizen/Delivery').then((m) => ({ default: m.Delivery })),
);
const VerifyLicense = lazy(() =>
  import('./pages/public/VerifyLicense').then((m) => ({ default: m.VerifyLicense })),
);
const AdminLogin = lazy(() =>
  import('./pages/admin/AdminLogin').then((m) => ({ default: m.AdminLogin })),
);
const AdminAccounts = lazy(() =>
  import('./pages/admin/AdminAccounts').then((m) => ({ default: m.AdminAccounts })),
);
const AdminProcedures = lazy(() =>
  import('./pages/admin/AdminProcedures').then((m) => ({ default: m.AdminProcedures })),
);

function RouteLoadingFallback() {
  return (
    <div className="container loading-container">
      <p className="loading-text">Cargando sección...</p>
    </div>
  );
}

function ProtectedRoute({
  children,
  allowRoles,
}: {
  children: ReactNode;
  allowRoles?: Role[];
}) {
  const { user, loading, isStaff } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container loading-container">
        <p className="loading-text">Verificando sesión municipal...</p>
>>>>>>> 375601f98034ff3fad8c977a1bdcea7ff8dc8984
      </div>
    );
  }

<<<<<<< HEAD
  if (!session.authenticated) {
    return <Navigate to="/ingresar" replace />;
  }

  if (!isStaff) {
=======
  if (!user) {
    const redirectPath = location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  if (allowRoles && !allowRoles.includes(user.role)) {
    if (isStaff) {
      return <Navigate to="/admin/cuentas" replace />;
    }
>>>>>>> 375601f98034ff3fad8c977a1bdcea7ff8dc8984
    return <Navigate to="/panel" replace />;
  }

  return <>{children}</>;
}

<<<<<<< HEAD
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

=======
function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, loading, isStaff } = useAuth();

  if (loading) {
    return (
      <div className="container loading-container">
        <p className="loading-text">Cargando...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to={isStaff ? '/admin/cuentas' : '/panel'} replace />;
  }

  return <>{children}</>;
}

function HomeRedirect() {
  const { user, loading, isStaff } = useAuth();

  if (loading) {
    return (
      <div className="container loading-container">
        <p className="loading-text">Cargando TramitesBAR...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to={isStaff ? '/admin/cuentas' : '/panel'} replace />;
  }

  return <Navigate to="/login" replace />;
}

export function App() {
  return (
    <>
      <Navbar />
      <main>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            {/* Redirección inteligente de inicio */}
            <Route path="/" element={<HomeRedirect />} />

            {/* Rutas públicas de autenticación */}
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <Login />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicOnlyRoute>
                  <Register />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <PublicOnlyRoute>
                  <ForgotPassword />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/reset-password"
              element={
                <PublicOnlyRoute>
                  <ResetPassword />
                </PublicOnlyRoute>
              }
            />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route
              path="/admin/login"
              element={
                <PublicOnlyRoute>
                  <AdminLogin />
                </PublicOnlyRoute>
              }
            />

            {/* Rutas protegidas para ciudadanos */}
            <Route
              path="/panel"
              element={
                <ProtectedRoute allowRoles={['citizen']}>
                  <CitizenPanel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tramites/:id/charlas"
              element={
                <ProtectedRoute allowRoles={['citizen']}>
                  <Charlas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tramites/:id/salud"
              element={
                <ProtectedRoute allowRoles={['citizen']}>
                  <Health />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tramites/:id/examen"
              element={
                <ProtectedRoute allowRoles={['citizen']}>
                  <TheoryExam />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tramites/:id/turnos"
              element={
                <ProtectedRoute allowRoles={['citizen']}>
                  <PracticalAppointment />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tramites/:id/entrega"
              element={
                <ProtectedRoute allowRoles={['citizen']}>
                  <Delivery />
                </ProtectedRoute>
              }
            />

            {/* Verificación pública de credencial con código QR */}
            <Route path="/verificar/:token" element={<VerifyLicense />} />

            {/* Perfil accesible tanto para ciudadano como staff */}
            <Route
              path="/perfil"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* Rutas protegidas para staff municipal */}
            <Route
              path="/admin/cuentas"
              element={
                <ProtectedRoute allowRoles={['admin_cuentas', 'admin', 'superadmin']}>
                  <AdminAccounts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tramites"
              element={
                <ProtectedRoute
                  allowRoles={[
                    'admin_salud',
                    'admin_turnos',
                    'admin_pagos',
                    'admin_cuentas',
                    'admin',
                    'superadmin',
                  ]}
                >
                  <AdminProcedures />
                </ProtectedRoute>
              }
            />

            {/* Redirección por defecto ante rutas desconocidas */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </>
  );
}
>>>>>>> 375601f98034ff3fad8c977a1bdcea7ff8dc8984
export default App;
