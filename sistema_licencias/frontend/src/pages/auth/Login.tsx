import { useState, type FormEvent, type ChangeEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';
import { Shield, Lock, Eye, EyeOff } from '../../components/Icons';
import { RequiredMark, RequiredFieldsNote, FormError } from '../../components/FormFeedback';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showMfa, setShowMfa] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const successNotice = (location.state as { notice?: string } | null)?.notice;

  const handleIdentifierChange = (e: ChangeEvent<HTMLInputElement>) => {
    setIdentifier(e.target.value);
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

  const handleMfaCodeChange = (e: ChangeEvent<HTMLInputElement>) => {
    setMfaCode(e.target.value);
  };

  const handleTogglePassword = () => {
    setShowPassword((prev) => !prev);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim()) {
      setError('Por favor, ingresá tu DNI o correo electrónico.');
      return;
    }
    if (!password) {
      setError('Por favor, ingresá tu contraseña.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = await login(identifier.trim(), password, showMfa ? mfaCode : undefined);
      if (payload.user.role === 'citizen') {
        navigate('/panel');
      } else {
        navigate('/admin/cuentas');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'mfa_required') {
          setShowMfa(true);
          setError('Esta cuenta tiene segundo factor activado. Ingresá el código de 6 dígitos.');
        } else {
          setError(err.message || 'Credenciales inválidas. Verificá los datos.');
        }
      } else {
        setError('Ocurrió un error inesperado al intentar iniciar sesión.');
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
          <h1>Iniciar Sesión</h1>
          <p>Accedé al sistema de trámites de licencias con tu DNI o correo.</p>
        </div>

        {successNotice && (
          <div className="alert alert-success" role="status">
            <span>{successNotice}</span>
          </div>
        )}

        {error && <FormError message={error} />}

        <form onSubmit={handleSubmit}>
          <RequiredFieldsNote />
          <div className="form-group">
            <label htmlFor="identifier" className="form-label">
              DNI o Correo electrónico<RequiredMark />
            </label>
            <input
              id="identifier"
              type="text"
              className="input"
              value={identifier}
              onChange={handleIdentifierChange}
              placeholder="Ej: 38456123 o vecino@baradero.gob.ar"
              autoComplete="username"
              required
              disabled={submitting}
            />
            <span className="form-hint">Si usás DNI, ingresalo sin puntos ni espacios.</span>
          </div>

          <div className="form-group">
            <div className="form-header-row">
              <label htmlFor="password" className="form-label">
                Contraseña<RequiredMark />
              </label>
              <Link to="/forgot-password" className="form-hint">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <div className="input-password-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="input input-password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="Ingresá tu contraseña"
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

          {showMfa && (
            <div className="form-group">
              <label htmlFor="mfaCode" className="form-label">
                Código de segundo factor (TOTP)<RequiredMark />
              </label>
              <input
                id="mfaCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="input input-mono"
                value={mfaCode}
                onChange={handleMfaCodeChange}
                placeholder="000000"
                maxLength={10}
                autoComplete="one-time-code"
                autoFocus
                required
                disabled={submitting}
              />
              <span className="form-hint">
                Código de 6 dígitos de tu aplicación autenticadora o código de recuperación.
              </span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-block btn-lg auth-submit-btn"
            disabled={submitting}
          >
            <Lock width={18} height={18} />
            <span>{submitting ? 'Iniciando sesión...' : 'Ingresar'}</span>
          </button>
        </form>

        <div className="auth-footer">
          <p>
            ¿No tenés una cuenta registrada?{' '}
            <Link to="/register">Creá tu cuenta acá</Link>
          </p>
          <div className="auth-divider">
            <Link to="/admin/login" className="nav-link auth-center-link">
              <Shield width={16} height={16} />
              <span>Acceso para personal municipal</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
