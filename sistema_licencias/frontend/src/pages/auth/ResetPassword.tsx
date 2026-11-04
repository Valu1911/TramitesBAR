import { useState, type FormEvent, type ChangeEvent } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import type { MessageResponse } from '../../lib/types';
import { Lock, Eye, EyeOff, Check, AlertTriangle } from '../../components/Icons';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tokenFromUrl = searchParams.get('token') || '';
  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleTokenChange = (e: ChangeEvent<HTMLInputElement>) => setToken(e.target.value);
  const handleNewPasswordChange = (e: ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value);
  const handleConfirmPasswordChange = (e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value);
  const handleTogglePassword = () => setShowPassword((prev) => !prev);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token.trim()) {
      setError('El token de restablecimiento es obligatorio.');
      return;
    }
    if (newPassword.length < 12) {
      setError('La nueva contraseña debe tener al menos 12 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post<MessageResponse>('/auth/reset-password', {
        token: token.trim(),
        new_password: newPassword,
      });
      setSuccessMessage(res.message);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'El enlace de recuperación es inválido o ha expirado.');
      } else {
        setError('Ocurrió un error al actualizar la contraseña.');
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
          <h1>Nueva Contraseña</h1>
          <p>Elegí una clave segura para acceder a tus trámites de licencia.</p>
        </div>

        {successMessage ? (
          <div className="flex-col-gap">
            <div className="alert alert-success" role="status">
              <Check width={20} height={20} />
              <span>{successMessage}</span>
            </div>
            <p className="loading-text">
              Tu contraseña fue actualizada correctamente. Ya podés iniciar sesión con tus nuevas credenciales.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-block auth-submit-btn"
              onClick={() => navigate('/login')}
            >
              Ir a Iniciar Sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="alert alert-danger" role="alert">
                <AlertTriangle width={20} height={20} />
                <span>{error}</span>
              </div>
            )}

            {!tokenFromUrl && (
              <div className="form-group">
                <label htmlFor="token" className="form-label">
                  Código o token de recuperación
                </label>
                <input
                  id="token"
                  type="text"
                  className="input input-mono"
                  value={token}
                  onChange={handleTokenChange}
                  placeholder="Pegá aquí el código recibido por correo"
                  required
                  disabled={submitting}
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="newPassword" className="form-label">
                Nueva contraseña
              </label>
              <div className="input-password-wrapper">
                <input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  className="input input-password"
                  value={newPassword}
                  onChange={handleNewPasswordChange}
                  placeholder="Mínimo 12 caracteres"
                  autoComplete="new-password"
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
              <span className="form-hint">Mínimo 12 caracteres, mayúsculas, minúsculas y números.</span>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirmar nueva contraseña
              </label>
              <div className="input-password-wrapper">
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  className="input input-password"
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  placeholder="Repetí la nueva contraseña"
                  autoComplete="new-password"
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg auth-submit-btn"
              disabled={submitting}
            >
              <Lock width={18} height={18} />
              <span>{submitting ? 'Guardando...' : 'Restablecer contraseña'}</span>
            </button>
          </form>
        )}

        <div className="auth-footer">
          <p>
            ¿Querés volver?{' '}
            <Link to="/login">Volver al inicio de sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

