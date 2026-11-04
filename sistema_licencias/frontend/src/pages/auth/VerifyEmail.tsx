import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import type { MessageResponse } from '../../lib/types';
import { Check, AlertTriangle, Refresh } from '../../components/Icons';

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tokenFromUrl = searchParams.get('token') || '';
  const [token, setToken] = useState(tokenFromUrl);
  const [loading, setLoading] = useState(() => Boolean(tokenFromUrl));
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleTokenChange = (e: ChangeEvent<HTMLInputElement>) => {
    setToken(e.target.value);
  };

  const handleVerify = async (tokenToVerify: string) => {
    if (!tokenToVerify.trim()) {
      setError('Por favor, ingresá el código de verificación.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.post<MessageResponse>('/auth/verify-email', {
        token: tokenToVerify.trim(),
      });
      setSuccessMessage(res.message);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'El enlace de verificación es inválido o ha expirado.');
      } else {
        setError('Ocurrió un error al verificar tu cuenta.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!tokenFromUrl) return;
    let active = true;
    api
      .post<MessageResponse>('/auth/verify-email', {
        token: tokenFromUrl.trim(),
      })
      .then((res) => {
        if (active) setSuccessMessage(res.message);
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'El enlace de verificación es inválido o ha expirado.'
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tokenFromUrl]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleVerify(token);
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <Link to="/">
            <img src="/isologo.svg" alt="Municipalidad de Baradero" className="auth-logo" />
          </Link>
          <h1>Verificación de Correo</h1>
          <p>Confirmá tu casilla electrónica para activar tu cuenta de TramitesBAR.</p>
        </div>

        {successMessage ? (
          <div className="flex-col-gap">
            <div className="alert alert-success" role="status">
              <Check width={20} height={20} />
              <span>{successMessage}</span>
            </div>
            <p className="loading-text">
              Tu casilla fue validada con éxito. Ya podés ingresar y dar inicio a tus trámites de licencia municipal.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-block auth-submit-btn"
              onClick={() => navigate('/login')}
            >
              Iniciar Sesión
            </button>
          </div>
        ) : (
          <div>
            {error && (
              <div className="alert alert-danger" role="alert">
                <AlertTriangle width={20} height={20} />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="flex-col-gap loading-container">
                <p className="loading-text">Verificando tu token de acceso...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <div className="form-group">
                  <label htmlFor="token" className="form-label">
                    Código de verificación
                  </label>
                  <input
                    id="token"
                    type="text"
                    className="input input-mono"
                    value={token}
                    onChange={handleTokenChange}
                    placeholder="Pegá el código recibido en tu correo"
                    required
                    disabled={loading}
                  />
                  <span className="form-hint">
                    Si abriste el enlace desde el correo, la validación se realiza automáticamente.
                  </span>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-block btn-lg auth-submit-btn"
                  disabled={loading}
                >
                  <Refresh width={18} height={18} />
                  <span>{loading ? 'Verificando...' : 'Confirmar correo'}</span>
                </button>
              </form>
            )}
          </div>
        )}

        <div className="auth-footer">
          <p>
            ¿Querés volver al inicio?{' '}
            <Link to="/login">Volver a Iniciar Sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
