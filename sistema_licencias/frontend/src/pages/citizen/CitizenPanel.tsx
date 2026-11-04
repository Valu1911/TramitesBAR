import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FileText, User as UserIcon, Shield, Clock } from '../../components/Icons';

export function CitizenPanel() {
  const { user } = useAuth();
  const firstName = user?.profile?.first_name || 'Vecino/a';

  return (
    <div className="container profile-container">
      <div className="card profile-header-card">
        <div className="flex-row-gap">
          <div className="profile-avatar">
            <UserIcon width={32} height={32} />
          </div>
          <div>
            <h1>¡Hola, {firstName}!</h1>
            <p>Bienvenido al portal de trámites de licencias de conducir de Baradero.</p>
          </div>
        </div>
      </div>

      <div className="grid-cols-2">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Mis Trámites de Licencia</h2>
              <p className="card-subtitle">Estado actual de tus solicitudes y renovaciones.</p>
            </div>
            <FileText width={24} height={24} />
          </div>

          <p className="mfa-step-desc">
            Podés iniciar un trámite de primera licencia, renovación o ampliación de categoría de manera 100% digital.
          </p>

          <div className="alert alert-info">
            <Clock width={18} height={18} />
            <span>No tenés trámites activos en este momento.</span>
          </div>

          <div className="spacing-mt-1">
            <Link to="/perfil" className="btn btn-primary">
              <UserIcon width={16} height={16} />
              <span>Ver y actualizar mis datos de perfil</span>
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Seguridad de la Cuenta</h2>
              <p className="card-subtitle">Protección de identidad y segundo factor.</p>
            </div>
            <Shield width={24} height={24} />
          </div>

          <div className="flex-row-between mfa-status-row">
            <div>
              <span className="profile-item-label">Segundo Factor (MFA)</span>
              <p className="mfa-status-desc">
                {user?.mfa_enabled ? 'Activado' : 'Desactivado'}
              </p>
            </div>
            <span className={`badge ${user?.mfa_enabled ? 'badge-success' : 'badge-warning'}`}>
              {user?.mfa_enabled ? 'Protegido' : 'Pendiente'}
            </span>
          </div>

          <p className="mfa-step-desc">
            Recomendamos activar el segundo factor de autenticación para resguardar tus datos personales y trámites.
          </p>

          <div className="spacing-mt-1">
            <Link to="/perfil" className="btn btn-secondary">
              <Shield width={16} height={16} />
              <span>Gestionar seguridad</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
