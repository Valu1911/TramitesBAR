import { useState, type FormEvent, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';
import { Shield, Eye, EyeOff } from '../../components/Icons';

export function AdminLogin() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleIdentifierChange = (e: ChangeEvent<HTMLInputElement>) => setIdentifier(e.target.value);
  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value);
  const handleMfaCodeChange = (e: ChangeEvent<HTMLInputElement>) => setMfaCode(e.target.value);
  const handleTogglePassword = () => setShowPassword((prev) => !prev);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim()) {
      setError('Ingresá tu correo oficial o DNI.');
      return;
    }
    if (!password) {
      setError('Ingresá tu contraseña de funcionario.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = await login(identifier.trim(), password, mfaCode ? mfaCode.trim() : undefined);

      if (payload.user.role === 'citizen') {
        await logout();
        setError('Esta cuenta pertenece a un ciudadano. Por favor, utilizá el portal de vecinos.');
        return;
      }

      if (payload.mfa_enrollment_required) {
        navigate('/perfil');
      } else {
        navigate('/admin/cuentas');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'mfa_required') {
          setError('El código de segundo factor (TOTP) es obligatorio para el personal municipal.');
        } else {
          setError(err.message || 'Credenciales o código de autenticación incorrectos.');
        }
      } else {
        setError('Ocurrió un error inesperado al autenticar con el servidor.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <Link to="/">
            <img src="/isologo.svg" alt="Municipalidad de Baradero" className="auth-logo" />
          </Link>
          <div className="flex-row-gap auth-center-link mfa-status-row">
            <span className="badge badge-primary">Personal Municipal</span>
          </div>
          <h1>Acceso Backoffice</h1>
          <p>Portal exclusivo para administración, validación de cuentas y fiscalización.</p>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="adminIdentifier" className="form-label">
              Correo oficial o DNI
            </label>
            <input
              id="adminIdentifier"
              type="text"
              className="input"
              value={identifier}
              onChange={handleIdentifierChange}
              placeholder="funcionario@baradero.gob.ar"
              autoComplete="username"
              required
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="adminPassword" className="form-label">
              Contraseña
            </label>
            <div className="input-password-wrapper">
              <input
                id="adminPassword"
                type={showPassword ? 'text' : 'password'}
                className="input input-password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="Contraseña de operador"
                autoComplete="current-password"
                required
                disabled={submitting}
              />
              <button
                type="button"
                onClick={handleTogglePassword}
                className="password-toggle-btn"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff width={18} height={18} /> : <Eye width={18} height={18} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="adminMfa" className="form-label">
              Código de Segundo Factor (MFA obligatorio)
            </label>
            <input
              id="adminMfa"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="input input-mono"
              value={mfaCode}
              onChange={handleMfaCodeChange}
              placeholder="000000"
              maxLength={10}
              autoComplete="one-time-code"
              disabled={submitting}
            />
            <span className="form-hint">
              Código de 6 dígitos de la app autenticadora. Requerido por normativa municipal.
            </span>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block btn-lg auth-submit-btn"
            disabled={submitting}
          >
            <Shield width={18} height={18} />
            <span>{submitting ? 'Verificando credenciales...' : 'Ingresar al Backoffice'}</span>
          </button>
        </form>

        <div className="auth-footer">
          <p>
            ¿Sos vecino/a tramitando tu licencia?{' '}
            <Link to="/login">Accedé al Portal Ciudadano</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
