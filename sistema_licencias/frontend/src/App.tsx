import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';
import { VerifyEmail } from './pages/auth/VerifyEmail';
import { Profile } from './pages/citizen/Profile';
import { CitizenPanel } from './pages/citizen/CitizenPanel';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminAccounts } from './pages/admin/AdminAccounts';
import type { Role } from './lib/types';
import type { ReactNode } from 'react';

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
      </div>
    );
  }

  if (!user) {
    const redirectPath = location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  if (allowRoles && !allowRoles.includes(user.role)) {
    if (isStaff) {
      return <Navigate to="/admin/cuentas" replace />;
    }
    return <Navigate to="/panel" replace />;
  }

  return <>{children}</>;
}

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

          {/* Redirección por defecto ante rutas desconocidas */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
export default App;

