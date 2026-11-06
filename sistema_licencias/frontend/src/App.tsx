import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import type { Role } from './lib/types';
import { getNavigation } from './lib/navigation';

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
  const { user, loading, mfaEnrollmentRequired } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container loading-container">
        <p className="loading-text">Verificando sesión municipal...</p>
      </div>
    );
  }

  if (!user) {
    const redirectPath = location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  // El perfil debe seguir disponible para enrolar MFA, incluso tras recargar.
  if (user.role !== 'citizen' && mfaEnrollmentRequired && location.pathname !== '/perfil') {
    return <Navigate to="/perfil" replace />;
  }

  if (allowRoles && !allowRoles.includes(user.role)) {
    return <Navigate to={getNavigation(user.role, mfaEnrollmentRequired).home} replace />;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, loading, mfaEnrollmentRequired } = useAuth();

  if (loading) {
    return (
      <div className="container loading-container">
        <p className="loading-text">Cargando...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to={getNavigation(user.role, mfaEnrollmentRequired).home} replace />;
  }

  return <>{children}</>;
}

function HomeRedirect() {
  const { user, loading, mfaEnrollmentRequired } = useAuth();

  if (loading) {
    return (
      <div className="container loading-container">
        <p className="loading-text">Cargando TramitesBAR...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to={getNavigation(user.role, mfaEnrollmentRequired).home} replace />;
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
export default App;
