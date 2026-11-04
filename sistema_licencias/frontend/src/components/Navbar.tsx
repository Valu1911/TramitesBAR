import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon, Menu, X, Shield, FileText } from './Icons';
import type { Role } from '../lib/types';

const ROLE_LABELS: Record<Role, string> = {
  citizen: 'Ciudadano/a',
  admin_cuentas: 'Admin Cuentas',
  admin_pagos: 'Admin Pagos',
  admin_salud: 'Admin Salud',
  admin_turnos: 'Admin Turnos',
  admin: 'Administrador/a',
  superadmin: 'Superadministrador/a',
};

export function Navbar() {
  const { user, logout, isStaff } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const closeMenu = () => setMenuOpen(false);

  const displayName = user?.profile
    ? `${user.profile.first_name} ${user.profile.last_name}`
    : user?.email;

  const roleLabel = user ? ROLE_LABELS[user.role] ?? user.role : '';

  return (
    <header className="navbar-root">
      <div className="container navbar-container">
        <Link to="/" className="navbar-brand" onClick={closeMenu}>
          <img src="/isologo.svg" alt="Municipalidad de Baradero" className="navbar-logo" />
          <div className="navbar-title-group">
            <span className="navbar-title">TramitesBAR</span>
            <span className="navbar-subtitle">Licencias de Conducir</span>
          </div>
        </Link>

        {/* Botón hamburguesa móvil */}
        <button
          type="button"
          className="navbar-burger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {menuOpen ? <X width={24} height={24} /> : <Menu width={24} height={24} />}
        </button>

        {/* Menú de navegación */}
        <nav className={`navbar-nav ${menuOpen ? 'is-open' : ''}`}>
          <div className="navbar-links">
            {user ? (
              <>
                {isStaff ? (
                  <>
                    <Link
                      to="/admin/cuentas"
                      className={`nav-link ${location.pathname.startsWith('/admin/cuentas') ? 'active' : ''}`}
                      onClick={closeMenu}
                    >
                      <Shield width={16} height={16} />
                      <span>Gestión de Cuentas</span>
                    </Link>
                    <Link
                      to="/admin/tramites"
                      className={`nav-link ${location.pathname.startsWith('/admin/tramites') ? 'active' : ''}`}
                      onClick={closeMenu}
                    >
                      <FileText width={16} height={16} />
                      <span>Trámites y Operaciones</span>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to="/panel"
                      className={`nav-link ${location.pathname === '/panel' ? 'active' : ''}`}
                      onClick={closeMenu}
                    >
                      <span>Mis Trámites</span>
                    </Link>
                  </>
                )}
                <Link
                  to="/perfil"
                  className={`nav-link ${location.pathname === '/perfil' ? 'active' : ''}`}
                  onClick={closeMenu}
                >
                  <UserIcon width={16} height={16} />
                  <span>Mi Perfil</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className={`nav-link ${location.pathname === '/login' ? 'active' : ''}`}
                  onClick={closeMenu}
                >
                  Iniciar Sesión
                </Link>
                <Link
                  to="/register"
                  className="btn btn-accent btn-sm"
                  onClick={closeMenu}
                >
                  Crear Cuenta
                </Link>
                <Link
                  to="/admin/login"
                  className="btn btn-secondary btn-sm"
                  onClick={closeMenu}
                >
                  <Shield width={14} height={14} />
                  <span>Personal Municipal</span>
                </Link>
              </>
            )}
          </div>

          {user && (
            <div className="navbar-user-section">
              <div className="user-details">
                <span className="user-name" title={displayName ?? ''}>{displayName}</span>
                <span className={`badge ${isStaff ? 'badge-primary' : 'badge-accent'}`}>
                  {roleLabel}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm btn-logout"
                onClick={handleLogout}
                title="Cerrar sesión"
              >
                <LogOut width={16} height={16} />
                <span className="logout-text">Salir</span>
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

