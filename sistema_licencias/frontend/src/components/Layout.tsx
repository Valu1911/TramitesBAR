/**
 * Estructura institucional principal, cabecera, controles de bloqueo de
 * políticas y enrolamiento obligatorio de segundo factor para personal.
 */

import {
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Markdown from "react-markdown";
import { api, ApiError } from "@/lib/api";
import {
  ROLE_LABELS,
  type MfaRecovery,
  type MfaSetup,
  type NotificationList,
  type Policy,
} from "@/lib/types";
import { useAuth } from "@/components/AuthContext";
import { BariFloatingWidget } from "@/components/BariWidget";
import {
  BellIcon,
  CheckIcon,
  LockIcon,
  LogoutIcon,
  ShieldIcon,
  UserIcon,
  WarningIcon,
} from "@/components/Icons";

/** Compuerta bloqueante de aceptación de políticas institucionales vigentes. */
function PendingPoliciesGate({
  pendingSlugs,
  onAccepted,
}: {
  pendingSlugs: string[];
  onAccepted: () => Promise<void>;
}) {
  const currentSlug = pendingSlugs[0] ?? "";
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const policyQuery = useQuery({
    queryKey: ["policies", "detail", currentSlug],
    queryFn: () => api.get<Policy>(`/policies/${currentSlug}`),
    enabled: Boolean(currentSlug),
  });

  async function handleAcceptClick() {
    if (!currentSlug || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await api.post(`/policies/${currentSlug}/accept`, { accept: true });
      await onAccepted();
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo registrar la aceptación.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-gate-title"
    >
      <div className="modal-panel">
        <span className="page-eyebrow">Actualización normativa obligatoria</span>
        <h2 id="policy-gate-title" className="page-title">
          Aceptación de políticas vigentes
        </h2>
        <p className="page-subtitle bottom-gap-md">
          Para continuar utilizando el portal municipal debés leer y aceptar la
          versión vigente ({pendingSlugs.length} pendiente
          {pendingSlugs.length > 1 ? "s" : ""}).
        </p>

        {errorMsg && (
          <div className="alert alert-danger" role="alert">
            <WarningIcon size={18} />
            <div className="alert-content">{errorMsg}</div>
          </div>
        )}

        {policyQuery.isLoading && (
          <p className="muted-text">Cargando texto normativo...</p>
        )}

        {policyQuery.data && (
          <div className="card bottom-gap-md">
            <div className="card-header">
              <div>
                <h3 className="card-title">{policyQuery.data.title}</h3>
                <p className="card-subtitle">
                  Versión {policyQuery.data.version} · Hash SHA-256:{" "}
                  <code className="mono">
                    {policyQuery.data.content_hash.slice(0, 16)}...
                  </code>
                </p>
              </div>
              <span className="badge badge-info">Obligatoria</span>
            </div>
            <div className="markdown-body">
              <Markdown>{policyQuery.data.body_md}</Markdown>
            </div>
          </div>
        )}

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAcceptClick}
            disabled={submitting || !policyQuery.data}
          >
            <CheckIcon size={18} />
            <span>
              {submitting
                ? "Registrando aceptación..."
                : "He leído y acepto esta política"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Compuerta bloqueante de configuración TOTP obligatoria para personal municipal. */
function StaffMfaEnrollmentGate({
  onCompleted,
}: {
  onCompleted: () => Promise<void>;
}) {
  const [setupData, setSetupData] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleStartSetup() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await api.post<MfaSetup>("/auth/mfa/setup");
      setSetupData(response);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo generar el secreto TOTP.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleCodeChange(event: ChangeEvent<HTMLInputElement>) {
    setCode(event.target.value);
  }

  async function handleEnableSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await api.post<MfaRecovery>("/auth/mfa/enable", {
        code: code.trim(),
      });
      setRecoveryCodes(response.recovery_codes);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "El código ingresado no es válido.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleFinishEnrollment() {
    await onCompleted();
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mfa-gate-title"
    >
      <div className="modal-panel">
        <span className="page-eyebrow">Seguridad administrativa obligatoria</span>
        <h2 id="mfa-gate-title" className="page-title">
          Activación de segundo factor (MFA)
        </h2>
        <p className="page-subtitle bottom-gap-md">
          El personal municipal debe operar con autenticación de dos factores
          (TOTP) activa antes de acceder al panel de gestión.
        </p>

        {errorMsg && (
          <div className="alert alert-danger" role="alert">
            <WarningIcon size={18} />
            <div className="alert-content">{errorMsg}</div>
          </div>
        )}

        {!setupData && !recoveryCodes && (
          <div className="card">
            <p>
              Generá tu clave secreta para vincular una aplicación autenticadora
              (Google Authenticator, FreeOTP, Ente Auth o similar).
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleStartSetup}
              disabled={loading}
            >
              <LockIcon size={18} />
              <span>{loading ? "Generando..." : "Generar clave TOTP"}</span>
            </button>
          </div>
        )}

        {setupData && !recoveryCodes && (
          <form className="card form-stack" onSubmit={handleEnableSubmit}>
            <div>
              <span className="kv-label">Clave secreta (Base32)</span>
              <code className="kv-value mono">{setupData.secret}</code>
            </div>
            <div>
              <span className="kv-label">URI de aprovisionamiento</span>
              <code className="kv-value mono">{setupData.otpauth_uri}</code>
            </div>
            <div className="form-field">
              <label htmlFor="staff-mfa-code" className="form-label">
                Código de 6 dígitos generado por tu aplicación
              </label>
              <input
                id="staff-mfa-code"
                type="text"
                inputMode="numeric"
                className="form-input mono"
                value={code}
                onChange={handleCodeChange}
                placeholder="000000"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || code.trim().length < 6}
            >
              <CheckIcon size={18} />
              <span>{loading ? "Verificando..." : "Confirmar y activar MFA"}</span>
            </button>
          </form>
        )}

        {recoveryCodes && (
          <div className="card form-stack">
            <div className="alert alert-warning">
              <WarningIcon size={18} />
              <div className="alert-content">
                <span className="alert-title">
                  Guardá estos códigos de recuperación en un lugar seguro
                </span>
                Se muestran por única vez. Cada código permite ingresar una sola
                vez si perdés acceso a tu dispositivo autenticador.
              </div>
            </div>
            <div className="kv-grid">
              {recoveryCodes.map((rc) => (
                <div key={rc} className="kv-item">
                  <code className="mono">{rc}</code>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleFinishEnrollment}
            >
              <CheckIcon size={18} />
              <span>Ya guardé mis códigos · Continuar al panel</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Estructura general con navegación, notificaciones y pie institucional. */
export function Layout({ children }: { children: ReactNode }) {
  const { session, isStaff, isCitizen, refetchSession, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notifOpen, setNotifOpen] = useState(false);

  const notificationsQuery = useQuery({
    queryKey: ["notifications", "header", session.user?.id ?? 0],
    queryFn: () => api.get<NotificationList>("/notifications", { limit: 8 }),
    enabled: session.authenticated,
    staleTime: 30_000,
  });

  function handleNavLinkClass({ isActive }: { isActive: boolean }): string {
    return isActive ? "nav-link nav-link-active" : "nav-link";
  }

  function handleToggleNotifications() {
    setNotifOpen((prev) => !prev);
  }

  async function handleMarkAllRead() {
    try {
      await api.post("/notifications/read-all");
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      // Mantenemos el panel abierto si falla la red.
    }
  }

  async function handleNotificationRead(event: MouseEvent<HTMLButtonElement>) {
    const id = Number(event.currentTarget.dataset.notifId);
    const link = event.currentTarget.dataset.notifLink;
    if (id) {
      try {
        await api.post(`/notifications/${id}/read`);
        await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      } catch {
        // Ignoramos error puntual de lectura y navegamos si corresponde.
      }
    }
    setNotifOpen(false);
    if (link) {
      void navigate(link);
    }
  }

  async function handleLogoutClick() {
    await logout();
    void navigate("/");
  }

  const unreadCount = notificationsQuery.data?.unread ?? 0;

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>

      <div className="civic-ribbon">
        <div className="container civic-ribbon-inner">
          <div className="civic-ribbon-tag">
            <ShieldIcon size={15} />
            <span>
              Municipalidad de Baradero · Subsecretaría de Modernización y
              Gestión Pública
            </span>
          </div>
          <span className="mono">
            Sistema Oficial de Licencias de Conducir · TramitesBAR
          </span>
        </div>
      </div>

      <header className="site-header">
        <div className="container site-header-inner">
          <Link to="/" className="brand-link">
            <img
              src="/isologo.svg"
              alt="Escudo de la Municipalidad de Baradero"
              className="brand-logo"
            />
            <div className="brand-copy">
              <span className="brand-title">TramitesBAR</span>
              <span className="brand-subtitle">
                Licencias de Conducir · Municipio de Baradero
              </span>
            </div>
          </Link>

          <nav className="main-nav" aria-label="Navegación principal">
            <NavLink to="/" end className={handleNavLinkClass}>
              Catálogo y requisitos
            </NavLink>
            <NavLink to="/verificar" className={handleNavLinkClass}>
              Verificar credencial
            </NavLink>
            <NavLink to="/politicas" className={handleNavLinkClass}>
              Políticas y privacidad
            </NavLink>

            {session.authenticated && isCitizen && (
              <>
                <NavLink to="/panel" end className={handleNavLinkClass}>
                  Mis trámites
                </NavLink>
                <NavLink to="/panel/licencias" className={handleNavLinkClass}>
                  Mis credenciales
                </NavLink>
                <NavLink to="/panel/seguridad" className={handleNavLinkClass}>
                  Mi cuenta y seguridad
                </NavLink>
              </>
            )}

            {session.authenticated && isStaff && (
              <>
                <NavLink to="/admin" className={handleNavLinkClass}>
                  Backoffice municipal
                </NavLink>
                <NavLink to="/panel/seguridad" className={handleNavLinkClass}>
                  Seguridad
                </NavLink>
              </>
            )}
          </nav>

          <div className="header-actions">
            {session.authenticated && session.user ? (
              <>
                <button
                  type="button"
                  className="notif-trigger"
                  onClick={handleToggleNotifications}
                  aria-label="Ver notificaciones"
                  aria-expanded={notifOpen}
                >
                  <BellIcon size={18} />
                  {unreadCount > 0 && (
                    <span className="notif-count">{unreadCount}</span>
                  )}
                </button>

                <div className="user-pill">
                  <UserIcon size={16} />
                  <div>
                    <div>
                      {session.user.profile
                        ? `${session.user.profile.first_name} ${session.user.profile.last_name}`
                        : session.user.email}
                    </div>
                    <div className="user-pill-role">
                      {ROLE_LABELS[session.user.role] ?? session.user.role}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleLogoutClick}
                >
                  <LogoutIcon size={16} />
                  <span>Salir</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/ingresar" className="btn btn-secondary btn-sm">
                  Ingresar
                </Link>
                <Link to="/registro" className="btn btn-primary btn-sm">
                  Crear cuenta vecinal
                </Link>
              </>
            )}
          </div>
        </div>

        {notifOpen && session.authenticated && (
          <div className="container bottom-gap-md">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Notificaciones del expediente</h3>
                  <p className="card-subtitle">
                    Avisos oficiales sobre el avance de tus trámites.
                  </p>
                </div>
                <div className="btn-row">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleMarkAllRead}
                    >
                      Marcar todas como leídas
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleToggleNotifications}
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              {notificationsQuery.data?.items.length ? (
                <div className="form-stack">
                  {notificationsQuery.data.items.map((item) => (
                    <div key={item.id} className="kv-item">
                      <div className="card-header">
                        <strong>{item.title}</strong>
                        <span className="badge badge-neutral">
                          {item.read_at ? "Leída" : "Nueva"}
                        </span>
                      </div>
                      <p>{item.body}</p>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        data-notif-id={item.id}
                        data-notif-link={item.link ?? ""}
                        onClick={handleNotificationRead}
                      >
                        {item.link ? "Abrir detalle" : "Marcar como leída"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted-text">
                  No tenés notificaciones registradas por el momento.
                </p>
              )}
            </div>
          </div>
        )}
      </header>

      {session.authenticated && session.pending_policies.length > 0 && (
        <PendingPoliciesGate
          pendingSlugs={session.pending_policies}
          onAccepted={refetchSession}
        />
      )}

      {session.authenticated &&
        session.pending_policies.length === 0 &&
        session.mfa_enrollment_required && (
          <StaffMfaEnrollmentGate onCompleted={refetchSession} />
        )}

      <main id="main-content" className="site-main">
        <div className="container">{children}</div>
      </main>

      <BariFloatingWidget />

      <footer className="site-footer">
        <div className="container">
          <div className="site-footer-grid">
            <div>
              <h3>Municipalidad de Baradero</h3>
              <p>
                Plataforma oficial para la tramitación, renovación y
                verificación pública de licencias de conducir. Todos los pagos
                se concilian por transferencia bancaria identificada.
              </p>
            </div>
            <div>
              <h4>Accesos rápidos</h4>
              <ul className="footer-list">
                <li>
                  <Link to="/">Catálogo de trámites y aranceles</Link>
                </li>
                <li>
                  <Link to="/verificar">Verificación pública de QR</Link>
                </li>
                <li>
                  <Link to="/politicas">Políticas de privacidad y uso</Link>
                </li>
              </ul>
            </div>
            <div>
              <h4>Seguridad e integridad</h4>
              <ul className="footer-list">
                <li>Protección de datos con cifrado AES-256-GCM</li>
                <li>Auditoría encadenada verificable</li>
                <li>Sin solicitud de datos de tarjetas bancarias</li>
              </ul>
            </div>
          </div>
          <div className="site-footer-bottom">
            <span>
              Subsecretaría de Modernización y Gestión Pública · Baradero,
              Provincia de Buenos Aires
            </span>
            <span className="mono">SOC 2 Readiness · Arquitectura v1</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
