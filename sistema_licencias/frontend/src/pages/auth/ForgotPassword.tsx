import { useState, type FormEvent, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import type { MessageResponse } from '../../lib/types';
import { Send, Check, AlertTriangle } from '../../components/Icons';
import { RequiredMark, RequiredFieldsNote } from '../../components/FormFeedback';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Por favor, ingresá el correo electrónico asociado a tu cuenta.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post<MessageResponse>('/auth/forgot-password', {
        email: email.trim().toLowerCase(),
      });
      setSubmittedMessage(res.message);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Ocurrió un error al procesar la solicitud.');
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
          <h1>Recuperar Contraseña</h1>
          <p>Te enviaremos las instrucciones a tu correo para restablecer tu clave.</p>
        </div>

        {submittedMessage ? (
          <div className="flex-col-gap">
            <div className="alert alert-success" role="status">
              <Check width={20} height={20} />
              <span>{submittedMessage}</span>
            </div>
            <p className="loading-text">
              Revisá tu bandeja de entrada y la carpeta de correo no deseado (spam). El enlace tiene una validez temporal.
            </p>
            <Link to="/login" className="btn btn-primary btn-block auth-submit-btn">
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <RequiredFieldsNote />
            {error && (
              <div className="alert alert-danger" role="alert">
                <AlertTriangle width={20} height={20} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Correo electrónico registrado<RequiredMark />
              </label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={handleEmailChange}
                placeholder="vecino@ejemplo.com"
                autoComplete="email"
                required
                disabled={submitting}
              />
              <span className="form-hint">
                Ingresá la casilla de correo con la que te diste de alta en TramitesBAR.
              </span>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg auth-submit-btn"
              disabled={submitting}
            >
              <Send width={18} height={18} />
              <span>{submitting ? 'Enviando enlace...' : 'Enviar enlace de recuperación'}</span>
            </button>
          </form>
        )}

        <div className="auth-footer">
          <p>
            ¿Recordaste tu contraseña?{' '}
            <Link to="/login">Volver al inicio de sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

