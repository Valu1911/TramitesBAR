import { useState, type FormEvent, type ChangeEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../lib/api';
import type { SessionInfo, MfaSetup, MfaRecovery, MessageResponse } from '../../lib/types';
import { generateQrDataUri } from '../../lib/qr';
import {
  User as UserIcon,
  Shield,
  Key,
  Lock,
  Trash,
  Check,
  Copy,
  AlertTriangle,
  Refresh,
} from '../../components/Icons';

type TabKey = 'personal' | 'security' | 'mfa' | 'sessions';

export function Profile() {
  const { user, refreshUser, isStaff } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('personal');

  // Datos personales editables
  const [phone, setPhone] = useState(user?.profile?.phone || '');
  const [address, setAddress] = useState(user?.profile?.address || '');
  const [locality, setLocality] = useState(user?.profile?.locality || 'Baradero');
  const [personalMsg, setPersonalMsg] = useState<string | null>(null);
  const [personalError, setPersonalError] = useState<string | null>(null);
  const [savingPersonal, setSavingPersonal] = useState(false);

  // Cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  // Sesiones activas
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Configuración de MFA
  const [mfaSetup, setMfaSetup] = useState<MfaSetup | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaMsg, setMfaMsg] = useState<string | null>(null);
  const [enrollingMfa, setEnrollingMfa] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Desactivación de MFA (solo ciudadanos)
  const [showDisableMfa, setShowDisableMfa] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disablingMfa, setDisablingMfa] = useState(false);

  const loadSessions = async () => {
    setLoadingSessions(true);
    setSessionError(null);
    try {
      const data = await api.get<SessionInfo[]>('/auth/sessions');
      setSessions(data);
    } catch {
      setSessionError('No pudimos cargar tus sesiones activas.');
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (tab === 'sessions') {
      void loadSessions();
    }
  };

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value);
  const handleAddressChange = (e: ChangeEvent<HTMLInputElement>) => setAddress(e.target.value);
  const handleLocalityChange = (e: ChangeEvent<HTMLInputElement>) => setLocality(e.target.value);

  const handlePersonalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPersonalMsg(null);
    setPersonalError(null);
    setSavingPersonal(true);

    try {
      await api.patch('/auth/me', {
        phone: phone.trim() || null,
        address: address.trim() || null,
        locality: locality.trim() || null,
      });
      await refreshUser();
      setPersonalMsg('Tus datos de contacto fueron actualizados con éxito.');
    } catch (err) {
      if (err instanceof ApiError) {
        setPersonalError(err.message);
      } else {
        setPersonalError('Error al guardar los cambios.');
      }
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleCurrentPasswordChange = (e: ChangeEvent<HTMLInputElement>) => setCurrentPassword(e.target.value);
  const handleNewPasswordChange = (e: ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value);
  const handleConfirmPasswordChange = (e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value);

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    setPasswordError(null);

    if (newPassword.length < 12) {
      setPasswordError('La nueva contraseña debe tener al menos 12 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await api.post<MessageResponse>('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordMsg(res.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err instanceof ApiError) {
        setPasswordError(err.message);
      } else {
        setPasswordError('No se pudo actualizar la contraseña.');
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const handleStartMfaSetup = async () => {
    setMfaError(null);
    setMfaMsg(null);
    try {
      const data = await api.post<MfaSetup>('/auth/mfa/setup');
      setMfaSetup(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setMfaError(err.message);
      } else {
        setMfaError('No se pudo iniciar la configuración de segundo factor.');
      }
    }
  };

  const handleMfaCodeChange = (e: ChangeEvent<HTMLInputElement>) => setMfaCode(e.target.value);

  const handleCopySecret = async () => {
    if (mfaSetup?.secret) {
      await navigator.clipboard.writeText(mfaSetup.secret);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleEnableMfa = async (e: FormEvent) => {
    e.preventDefault();
    setMfaError(null);

    if (!mfaCode.trim()) {
      setMfaError('Ingresá el código de 6 dígitos generado por tu aplicación.');
      return;
    }

    setEnrollingMfa(true);
    try {
      const data = await api.post<MfaRecovery>('/auth/mfa/enable', {
        code: mfaCode.trim(),
      });
      setRecoveryCodes(data.recovery_codes);
      setMfaSetup(null);
      setMfaCode('');
      setMfaMsg('Segundo factor activado con éxito.');
      await refreshUser();
    } catch (err) {
      if (err instanceof ApiError) {
        setMfaError(err.message || 'Código incorrecto. Verificá la hora de tu dispositivo.');
      } else {
        setMfaError('Error al activar el segundo factor.');
      }
    } finally {
      setEnrollingMfa(false);
    }
  };

  const handleDisablePasswordChange = (e: ChangeEvent<HTMLInputElement>) => setDisablePassword(e.target.value);
  const handleDisableCodeChange = (e: ChangeEvent<HTMLInputElement>) => setDisableCode(e.target.value);

  const handleDisableMfa = async (e: FormEvent) => {
    e.preventDefault();
    setMfaError(null);
    setDisablingMfa(true);

    try {
      const res = await api.post<MessageResponse>('/auth/mfa/disable', {
        password: disablePassword,
        code: disableCode.trim(),
      });
      setMfaMsg(res.message);
      setShowDisableMfa(false);
      setDisablePassword('');
      setDisableCode('');
      await refreshUser();
    } catch (err) {
      if (err instanceof ApiError) {
        setMfaError(err.message);
      } else {
        setMfaError('Error al desactivar el segundo factor.');
      }
    } finally {
      setDisablingMfa(false);
    }
  };

  const handleRevokeSession = async (sessionId: number) => {
    try {
      await api.delete(`/auth/sessions/${sessionId}`);
      await loadSessions();
    } catch {
      setSessionError('No se pudo revocar la sesión.');
    }
  };

  if (!user) {
    return (
      <div className="container profile-container">
        <div className="alert alert-warning">
          <span>Iniciá sesión para ver tu perfil.</span>
        </div>
      </div>
    );
  }

  const profile = user.profile;
  const fullName = profile ? `${profile.first_name} ${profile.last_name}` : user.email;

  return (
    <div className="container profile-container">
      <div className="card profile-header-card">
        <div className="flex-row-gap">
          <div className="profile-avatar">
            <UserIcon width={32} height={32} />
          </div>
          <div>
            <h1>{fullName}</h1>
            <p>{user.email}</p>
          </div>
        </div>
      </div>

      <div className="tabs-nav" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'personal'}
          className={`tab-btn ${activeTab === 'personal' ? 'active' : ''}`}
          onClick={() => handleTabChange('personal')}
        >
          Mis Datos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'security'}
          className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => handleTabChange('security')}
        >
          Seguridad y Clave
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'mfa'}
          className={`tab-btn ${activeTab === 'mfa' ? 'active' : ''}`}
          onClick={() => handleTabChange('mfa')}
        >
          Segundo Factor (MFA)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sessions'}
          className={`tab-btn ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => handleTabChange('sessions')}
        >
          Sesiones Activas
        </button>
      </div>

      {activeTab === 'personal' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Datos Personales y de Contacto</h2>
              <p className="card-subtitle">
                Los datos de identidad provienen de tu DNI registrado y no pueden modificarse desde la web.
              </p>
            </div>
            <span className="badge badge-accent">Registrado</span>
          </div>

          {personalMsg && (
            <div className="alert alert-success" role="status">
              <Check width={18} height={18} />
              <span>{personalMsg}</span>
            </div>
          )}

          {personalError && (
            <div className="alert alert-danger" role="alert">
              <AlertTriangle width={18} height={18} />
              <span>{personalError}</span>
            </div>
          )}

          <div className="profile-info-grid">
            <div className="profile-item">
              <span className="profile-item-label">DNI</span>
              <span className="profile-item-value">{profile?.dni_masked || '—'}</span>
            </div>

            <div className="profile-item">
              <span className="profile-item-label">Nombre y Apellido</span>
              <span className="profile-item-value">{fullName}</span>
            </div>

            <div className="profile-item">
              <span className="profile-item-label">Fecha de Nacimiento</span>
              <span className="profile-item-value">{profile?.birth_date || '—'}</span>
            </div>

            <div className="profile-item">
              <span className="profile-item-label">Estado de la Cuenta</span>
              <div>
                <span className={`badge ${user.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                  {user.status === 'active' ? 'Activa' : user.status}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handlePersonalSubmit} noValidate>
            <h3 className="card-title card-section-title">
              Actualizar Datos de Contacto
            </h3>

            <div className="grid-cols-2">
              <div className="form-group">
                <label htmlFor="phone" className="form-label">
                  Teléfono
                </label>
                <input
                  id="phone"
                  type="tel"
                  className="input"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="Ej: 3329123456"
                  disabled={savingPersonal}
                />
              </div>

              <div className="form-group">
                <label htmlFor="locality" className="form-label">
                  Localidad
                </label>
                <input
                  id="locality"
                  type="text"
                  className="input"
                  value={locality}
                  onChange={handleLocalityChange}
                  disabled={savingPersonal}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="address" className="form-label">
                Dirección
              </label>
              <input
                id="address"
                type="text"
                className="input"
                value={address}
                onChange={handleAddressChange}
                placeholder="Calle y número"
                disabled={savingPersonal}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingPersonal}
            >
              <Check width={16} height={16} />
              <span>{savingPersonal ? 'Guardando cambios...' : 'Guardar Datos de Contacto'}</span>
            </button>
          </form>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="card card-max-sm">
          <div className="card-header">
            <div>
              <h2 className="card-title">Cambiar Contraseña</h2>
              <p className="card-subtitle">
                Al actualizar tu contraseña, por seguridad se cerrarán todas las demás sesiones activas.
              </p>
            </div>
            <Lock width={24} height={24} />
          </div>

          {passwordMsg && (
            <div className="alert alert-success" role="status">
              <Check width={18} height={18} />
              <span>{passwordMsg}</span>
            </div>
          )}

          {passwordError && (
            <div className="alert alert-danger" role="alert">
              <AlertTriangle width={18} height={18} />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="currentPassword" className="form-label">
                Contraseña actual
              </label>
              <input
                id="currentPassword"
                type="password"
                className="input"
                value={currentPassword}
                onChange={handleCurrentPasswordChange}
                required
                disabled={savingPassword}
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword" className="form-label">
                Nueva contraseña
              </label>
              <input
                id="newPassword"
                type="password"
                className="input"
                value={newPassword}
                onChange={handleNewPasswordChange}
                placeholder="Mínimo 12 caracteres"
                required
                disabled={savingPassword}
              />
              <span className="form-hint">Debe contener mayúsculas, minúsculas y números.</span>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirmar nueva contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                className="input"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                placeholder="Repetí la contraseña"
                required
                disabled={savingPassword}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary auth-submit-btn"
              disabled={savingPassword}
            >
              <Key width={16} height={16} />
              <span>{savingPassword ? 'Actualizando clave...' : 'Actualizar Contraseña'}</span>
            </button>
          </form>
        </div>
      )}

      {activeTab === 'mfa' && (
        <div className="card card-max-md">
          <div className="card-header">
            <div>
              <h2 className="card-title">Segundo Factor de Autenticación (MFA / TOTP)</h2>
              <p className="card-subtitle">
                Añadí una capa extra de seguridad para proteger tus trámites municipales.
              </p>
            </div>
            <Shield width={24} height={24} />
          </div>

          {mfaMsg && (
            <div className="alert alert-success" role="status">
              <Check width={18} height={18} />
              <span>{mfaMsg}</span>
            </div>
          )}

          {mfaError && (
            <div className="alert alert-danger" role="alert">
              <AlertTriangle width={18} height={18} />
              <span>{mfaError}</span>
            </div>
          )}

          <div className="flex-row-between mfa-status-row">
            <div>
              <span className="profile-item-label">Estado de MFA</span>
              <p className="mfa-status-desc">
                {user.mfa_enabled ? 'Activado y protegiendo tu cuenta' : 'Desactivado'}
              </p>
            </div>
            <span className={`badge ${user.mfa_enabled ? 'badge-success' : 'badge-warning'}`}>
              {user.mfa_enabled ? 'Protegido' : 'Inseguro'}
            </span>
          </div>

          {recoveryCodes && (
            <div className="alert alert-warning" role="alert">
              <div className="flex-col-gap">
                <strong>¡Guardá tus códigos de recuperación de un solo uso!</strong>
                <p className="mfa-recovery-text">
                  Si perdés el acceso a tu aplicación autenticadora, vas a necesitar estos códigos para entrar.
                  No los compartas con nadie y guardalos en un lugar seguro.
                </p>
                <div className="recovery-codes-grid">
                  {recoveryCodes.map((code) => (
                    <span key={code} className="recovery-code-item">
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!user.mfa_enabled && !mfaSetup && (
            <div>
              <p className="mfa-intro-text">
                Podés usar aplicaciones como Google Authenticator, Microsoft Authenticator o Bitwarden
                para generar códigos temporales seguros al iniciar sesión.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStartMfaSetup}
              >
                <Shield width={16} height={16} />
                <span>Configurar Segundo Factor Ahora</span>
              </button>
            </div>
          )}

          {mfaSetup && (
            <div className="mfa-box">
              <h3 className="card-title mfa-step-title">
                Paso 1: Escaneá el código o ingresá la clave
              </h3>
              <p className="mfa-step-desc">
                Abrí tu app de autenticación y escaneá este código QR o copiá la clave manual:
              </p>

              <div className="mfa-qr-group">
                <img
                  src={generateQrDataUri(mfaSetup.otpauth_uri)}
                  alt="Código QR para enrolar MFA"
                  className="mfa-qr-image"
                />
                <div className="mfa-qr-info">
                  <span className="profile-item-label">Clave Secreta Manual</span>
                  <div className="mfa-secret-display">
                    <span>{mfaSetup.secret}</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleCopySecret}
                      title="Copiar clave"
                    >
                      <Copy width={14} height={14} />
                      <span>{copiedKey ? 'Copiada' : 'Copiar'}</span>
                    </button>
                  </div>
                  <span className="form-hint">
                    Tipo: Basado en tiempo (TOTP), 6 dígitos, intervalo de 30 segundos.
                  </span>
                </div>
              </div>

              <form onSubmit={handleEnableMfa} noValidate>
                <h3 className="card-title mfa-step-title">
                  Paso 2: Confirmá el código de 6 dígitos
                </h3>
                <div className="form-group mfa-code-input-group">
                  <input
                    id="mfaCode"
                    type="text"
                    inputMode="numeric"
                    className="input input-mono"
                    value={mfaCode}
                    onChange={handleMfaCodeChange}
                    placeholder="000000"
                    maxLength={6}
                    required
                    disabled={enrollingMfa}
                  />
                </div>

                <div className="flex-row-gap">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={enrollingMfa}
                  >
                    <Check width={16} height={16} />
                    <span>{enrollingMfa ? 'Verificando...' : 'Confirmar y Activar'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setMfaSetup(null)}
                    disabled={enrollingMfa}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {user.mfa_enabled && !isStaff && (
            <div className="mfa-disable-section">
              {!showDisableMfa ? (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setShowDisableMfa(true)}
                >
                  <Trash width={14} height={14} />
                  <span>Desactivar Segundo Factor</span>
                </button>
              ) : (
                <form onSubmit={handleDisableMfa} className="mfa-box">
                  <h4 className="mfa-disable-title">
                    Confirmar desactivación de MFA
                  </h4>
                  <p className="mfa-disable-text">
                    Por seguridad, ingresá tu contraseña y el código actual de tu aplicación para desactivar el factor.
                  </p>

                  <div className="grid-cols-2">
                    <div className="form-group">
                      <label htmlFor="disablePassword" className="form-label">
                        Contraseña
                      </label>
                      <input
                        id="disablePassword"
                        type="password"
                        className="input"
                        value={disablePassword}
                        onChange={handleDisablePasswordChange}
                        required
                        disabled={disablingMfa}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="disableCode" className="form-label">
                        Código de 6 dígitos
                      </label>
                      <input
                        id="disableCode"
                        type="text"
                        className="input input-mono"
                        value={disableCode}
                        onChange={handleDisableCodeChange}
                        placeholder="000000"
                        maxLength={6}
                        required
                        disabled={disablingMfa}
                      />
                    </div>
                  </div>

                  <div className="flex-row-gap">
                    <button
                      type="submit"
                      className="btn btn-danger"
                      disabled={disablingMfa}
                    >
                      <span>{disablingMfa ? 'Desactivando...' : 'Confirmar Desactivación'}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowDisableMfa(false)}
                      disabled={disablingMfa}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {user.mfa_enabled && isStaff && (
            <div className="alert alert-info mfa-info-alert">
              <span>
                Por política de seguridad municipal, el segundo factor de autenticación es obligatorio
                para todo el personal y no puede ser desactivado.
              </span>
            </div>
          )}
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Dispositivos y Sesiones Conectadas</h2>
              <p className="card-subtitle">
                Revisá desde qué navegadores y dispositivos se inició sesión en tu cuenta.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={loadSessions}
              disabled={loadingSessions}
            >
              <Refresh width={14} height={14} />
              <span>Actualizar</span>
            </button>
          </div>

          {sessionError && (
            <div className="alert alert-danger" role="alert">
              <AlertTriangle width={18} height={18} />
              <span>{sessionError}</span>
            </div>
          )}

          {loadingSessions ? (
            <div className="loading-container">
              <p className="loading-text">Consultando sesiones activas...</p>
            </div>
          ) : (
            <div className="sessions-list">
              {sessions.map((sess) => (
                <div key={sess.id} className="session-item">
                  <div className="session-meta">
                    <div className="flex-row-gap">
                      <span className="session-agent">{sess.user_agent || 'Navegador desconocido'}</span>
                      {sess.is_current && <span className="badge badge-success">Sesión actual</span>}
                    </div>
                    <span className="session-sub">
                      IP: {sess.ip || 'Red protegida'} · Conectado:{' '}
                      {new Date(sess.last_seen_at).toLocaleString('es-AR')}
                    </span>
                  </div>

                  {!sess.is_current && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleRevokeSession(sess.id)}
                      title="Cerrar esta sesión"
                    >
                      <Trash width={14} height={14} />
                      <span>Cerrar sesión</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
