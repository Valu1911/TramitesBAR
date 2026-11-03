/**
 * Backoffice municipal: tablero operativo, gestión de expedientes, conciliación
 * de pagos y extractos, turnos prácticos, banco de preguntas, credenciales,
 * cuentas de usuarios, políticas normativas y auditoría encadenada.
 */

import {
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
} from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, buildUrl } from "@/lib/api";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PROCEDURE_STATUS_LABELS,
  ROLE_LABELS,
  STEP_STATUS_LABELS,
  type AdminAppointment,
  type AdminPolicy,
  type AdminProcedure,
  type AuditEntry,
  type AuditVerify,
  type Dashboard,
  type LicenseAdmin,
  type MessageResponse,
  type Page,
  type PaymentAdmin,
  type PaymentImport,
  type Question,
  type RetryAuthorization,
  type Role,
  type UserAdmin,
} from "@/lib/types";
import { useAuth } from "@/components/AuthContext";
import {
  BookIcon,
  CalendarIcon,
  CheckIcon,
  DocumentIcon,
  PlusIcon,
  QrIcon,
  ShieldIcon,
  TransferIcon,
  UploadIcon,
  UserIcon,
  WarningIcon,
} from "@/components/Icons";

/** Barra de navegación interna del backoffice según permisos del operador. */
function AdminSubnav() {
  const { hasPermission } = useAuth();

  function handleNavLinkClass({ isActive }: { isActive: boolean }): string {
    return isActive ? "nav-link nav-link-active" : "nav-link";
  }

  return (
    <nav className="admin-subnav" aria-label="Módulos de administración">
      <NavLink to="/admin" end className={handleNavLinkClass}>
        Tablero
      </NavLink>
      {hasPermission("procedures.read") && (
        <NavLink to="/admin/tramites" className={handleNavLinkClass}>
          Expedientes
        </NavLink>
      )}
      {hasPermission("payments.read") && (
        <NavLink to="/admin/pagos" className={handleNavLinkClass}>
          Pagos y extractos
        </NavLink>
      )}
      {hasPermission("appointments.read") && (
        <NavLink to="/admin/turnos" className={handleNavLinkClass}>
          Turnos prácticos
        </NavLink>
      )}
      {hasPermission("questions.read") && (
        <NavLink to="/admin/preguntas" className={handleNavLinkClass}>
          Banco de preguntas
        </NavLink>
      )}
      {hasPermission("licenses.issue") && (
        <NavLink to="/admin/licencias" className={handleNavLinkClass}>
          Credenciales
        </NavLink>
      )}
      {hasPermission("users.read") && (
        <NavLink to="/admin/usuarios" className={handleNavLinkClass}>
          Usuarios y roles
        </NavLink>
      )}
      {hasPermission("policies.manage") && (
        <NavLink to="/admin/politicas" className={handleNavLinkClass}>
          Políticas
        </NavLink>
      )}
      {hasPermission("audit.read") && (
        <NavLink to="/admin/auditoria" className={handleNavLinkClass}>
          Auditoría
        </NavLink>
      )}
    </nav>
  );
}

/** Tablero operativo del backoffice municipal. */
export function AdminDashboardPage() {
  const { session, hasPermission } = useAuth();
  const canReadReports = hasPermission("reports.read");

  const dashboardQuery = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => api.get<Dashboard>("/admin/dashboard"),
    enabled: canReadReports,
  });

  const kpis = dashboardQuery.data;

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Gestión interna municipal</span>
          <h1 className="page-title">Backoffice de Licencias de Conducir</h1>
          <p className="page-subtitle">
            Operador autenticado: <strong>{session.user?.email}</strong> · Rol:{" "}
            <strong>
              {session.user
                ? (ROLE_LABELS[session.user.role] ?? session.user.role)
                : ""}
            </strong>
          </p>
        </div>
      </div>

      <AdminSubnav />

      {canReadReports && kpis && (
        <section className="section-block">
          <div className="grid-4 bottom-gap-md">
            <div className="kpi-card">
              <div className="kpi-label">Pagos por conciliar</div>
              <div className="kpi-value">{kpis.payments_pending}</div>
              <div className="kpi-meta">Pendientes / doble control</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Documentos por revisar</div>
              <div className="kpi-value">{kpis.documents_pending}</div>
              <div className="kpi-meta">Certificados y comprobantes</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Turnos prácticos próximos</div>
              <div className="kpi-value">{kpis.appointments_upcoming}</div>
              <div className="kpi-meta">Cupos libres y reservados</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Credenciales vigentes</div>
              <div className="kpi-value">{kpis.licenses_active}</div>
              <div className="kpi-meta">Activas en el registro</div>
            </div>
          </div>

          <div className="grid-3">
            <div className="kpi-card">
              <div className="kpi-label">Cuentas registradas</div>
              <div className="kpi-value">{kpis.users_total}</div>
              <div className="kpi-meta">Ciudadanos y personal</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Preguntas aprobadas</div>
              <div className="kpi-value">{kpis.questions_reviewed}</div>
              <div className="kpi-meta">Habilitadas para sorteo</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Preguntas en borrador</div>
              <div className="kpi-value">{kpis.questions_pending}</div>
              <div className="kpi-meta">Pendientes de revisión</div>
            </div>
          </div>
        </section>
      )}

      <section className="grid-3">
        {hasPermission("procedures.read") && (
          <div className="card">
            <DocumentIcon size={22} />
            <h2 className="card-title top-gap-sm">Expedientes y salud</h2>
            <p className="card-subtitle">
              Revisá certificados psicofísicos, autorizá reintentos teóricos y
              confirmá entregas de credenciales.
            </p>
            <div className="card-footer">
              <Link to="/admin/tramites" className="btn btn-primary btn-sm">
                Gestionar expedientes
              </Link>
            </div>
          </div>
        )}

        {hasPermission("payments.read") && (
          <div className="card">
            <TransferIcon size={22} />
            <h2 className="card-title top-gap-sm">Recaudación y extractos</h2>
            <p className="card-subtitle">
              Conciliá transferencias bancarias declaradas, aplicá doble control
              y procesá archivos CSV/XLSX.
            </p>
            <div className="card-footer">
              <Link to="/admin/pagos" className="btn btn-primary btn-sm">
                Ir a pagos
              </Link>
            </div>
          </div>
        )}

        {hasPermission("appointments.read") && (
          <div className="card">
            <CalendarIcon size={22} />
            <h2 className="card-title top-gap-sm">Agenda de examen práctico</h2>
            <p className="card-subtitle">
              Publicá nuevos cupos de evaluación práctica y asentá las
              calificaciones de manejo.
            </p>
            <div className="card-footer">
              <Link to="/admin/turnos" className="btn btn-primary btn-sm">
                Administrar turnos
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/** Bandeja y ficha de expedientes para revisión documental, reintentos y emisión. */
export function AdminProceduresPage() {
  const params = useParams<{ id?: string }>();
  const detailId = params.id ? Number(params.id) : null;
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [retryReason, setRetryReason] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const listQuery = useQuery({
    queryKey: ["admin", "procedures", statusFilter, searchQuery],
    queryFn: () =>
      api.get<Page<AdminProcedure>>("/admin/procedures", {
        status: statusFilter || undefined,
        q: searchQuery || undefined,
        limit: 50,
      }),
    enabled: !detailId,
  });

  const detailQuery = useQuery({
    queryKey: ["admin", "procedure-detail", detailId],
    queryFn: () => api.get<AdminProcedure>(`/admin/procedures/${detailId}`),
    enabled: Boolean(detailId),
  });

  function handleStatusFilterChange(event: ChangeEvent<HTMLSelectElement>) {
    setStatusFilter(event.target.value);
  }
  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setSearchQuery(event.target.value);
  }
  function handleReviewNotesChange(event: ChangeEvent<HTMLInputElement>) {
    setReviewNotes(event.target.value);
  }
  function handleRetryReasonChange(event: ChangeEvent<HTMLInputElement>) {
    setRetryReason(event.target.value);
  }
  function handleDeliveryNotesChange(event: ChangeEvent<HTMLInputElement>) {
    setDeliveryNotes(event.target.value);
  }
  function handleRejectReasonChange(event: ChangeEvent<HTMLInputElement>) {
    setRejectReason(event.target.value);
  }

  async function refreshDetail() {
    await queryClient.invalidateQueries({
      queryKey: ["admin", "procedure-detail", detailId],
    });
    await queryClient.invalidateQueries({ queryKey: ["admin", "procedures"] });
  }

  async function handleDocumentReview(event: MouseEvent<HTMLButtonElement>) {
    const docId = Number(event.currentTarget.dataset.docId);
    const decision = event.currentTarget.dataset.decision as
      | "approve"
      | "reject";
    if (!detailId || !docId || !decision || busy) return;
    setBusy(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      await api.post(
        `/admin/procedures/${detailId}/documents/${docId}/review`,
        {
          decision,
          notes: reviewNotes.trim() || null,
        },
      );
      setFeedback(
        decision === "approve"
          ? "Documento aprobado correctamente."
          : "Documento observado y ciudadano notificado.",
      );
      setReviewNotes("");
      await refreshDetail();
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo registrar la revisión del documento.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAuthorizeRetry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailId || retryReason.trim().length < 5 || busy) return;
    setBusy(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await api.post<RetryAuthorization>(
        `/admin/procedures/${detailId}/retry`,
        { reason: retryReason.trim() },
      );
      setFeedback(res.message);
      setRetryReason("");
      await refreshDetail();
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo habilitar el intento extra.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCompleteDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailId || busy) return;
    setBusy(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      await api.post(`/admin/procedures/${detailId}/delivery/complete`, {
        notes: deliveryNotes.trim() || null,
      });
      setFeedback("Entrega confirmada y credencial emitida.");
      setDeliveryNotes("");
      await refreshDetail();
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo completar la entrega.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRejectProcedure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailId || rejectReason.trim().length < 10 || busy) return;
    setBusy(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      await api.post(`/admin/procedures/${detailId}/reject`, {
        reason: rejectReason.trim(),
      });
      setFeedback("Expediente rechazado y ciudadano notificado.");
      setRejectReason("");
      await refreshDetail();
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo rechazar el expediente.",
      );
    } finally {
      setBusy(false);
    }
  }

  const proc = detailQuery.data;

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Backoffice · Expedientes</span>
          <h1 className="page-title">
            {detailId
              ? `Expediente ${proc?.public_code ?? `#${detailId}`}`
              : "Bandeja de trámites"}
          </h1>
        </div>
        {detailId && (
          <Link to="/admin/tramites" className="btn btn-secondary btn-sm">
            Volver al listado de expedientes
          </Link>
        )}
      </div>

      <AdminSubnav />

      {errorMsg && (
        <div className="alert alert-danger" role="alert">
          <WarningIcon size={18} />
          <div className="alert-content">{errorMsg}</div>
        </div>
      )}

      {feedback && (
        <div className="alert alert-success" role="status">
          <CheckIcon size={18} />
          <div className="alert-content">{feedback}</div>
        </div>
      )}

      {!detailId && (
        <>
          <div className="filter-bar">
            <div className="form-field">
              <label htmlFor="admin-proc-status" className="form-label">
                Estado del trámite
              </label>
              <select
                id="admin-proc-status"
                className="form-select"
                value={statusFilter}
                onChange={handleStatusFilterChange}
              >
                <option value="">Todos los estados</option>
                <option value="in_progress">En curso</option>
                <option value="under_review">En revisión</option>
                <option value="completed">Completados</option>
                <option value="rejected">Rechazados</option>
                <option value="cancelled">Cancelados</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="admin-proc-q" className="form-label">
                Buscar por código TB-, correo o DNI
              </label>
              <input
                id="admin-proc-q"
                type="text"
                className="form-input"
                placeholder="TB-2026-... o DNI"
                value={searchQuery}
                onChange={handleSearchChange}
              />
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Vecino/a</th>
                  <th>Trámite / Cat.</th>
                  <th>Estado</th>
                  <th>Etapa actual</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {(listQuery.data?.items ?? []).map((item) => (
                  <tr key={item.id}>
                    <td className="mono">{item.public_code}</td>
                    <td>
                      <div>{item.citizen.name}</div>
                      <div className="muted-text mono">
                        {item.citizen.dni_masked} · {item.citizen.email}
                      </div>
                    </td>
                    <td>
                      {item.procedure_type.name} ({item.license_category})
                    </td>
                    <td>
                      <span className="badge badge-info">
                        {PROCEDURE_STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </td>
                    <td>{item.current_step ?? "-"}</td>
                    <td>
                      <Link
                        to={`/admin/tramites/${item.id}`}
                        className="btn btn-primary btn-sm"
                      >
                        Revisar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {detailId && proc && (
        <div className="form-stack">
          <div className="card">
            <div className="kv-grid">
              <div className="kv-item">
                <span className="kv-label">Titular</span>
                <span className="kv-value">{proc.citizen.name}</span>
              </div>
              <div className="kv-item">
                <span className="kv-label">DNI / Correo</span>
                <span className="kv-value mono">
                  {proc.citizen.dni_masked} · {proc.citizen.email}
                </span>
              </div>
              <div className="kv-item">
                <span className="kv-label">Tipo y categoría</span>
                <span className="kv-value">
                  {proc.procedure_type.name} · Clase {proc.license_category}
                </span>
              </div>
              <div className="kv-item">
                <span className="kv-label">Estado actual</span>
                <span className="kv-value">
                  {PROCEDURE_STATUS_LABELS[proc.status] ?? proc.status} (Etapa:{" "}
                  {proc.current_step ?? "ninguna"})
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">Etapas del expediente</h2>
            <div className="table-wrap top-gap-sm">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Etapa</th>
                    <th>Estado</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {proc.steps.map((st) => (
                    <tr key={st.code}>
                      <td className="mono">{st.position}</td>
                      <td>{st.label}</td>
                      <td>
                        <span className="badge badge-neutral">
                          {STEP_STATUS_LABELS[st.status] ?? st.status}
                        </span>
                      </td>
                      <td>{st.notes ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">Revisión de documentos adjuntos</h2>
            <div className="form-field top-gap-sm bottom-gap-md">
              <label htmlFor="doc-review-notes" className="form-label">
                Observaciones para la revisión documental (opcional al aprobar,
                recomendado al observar)
              </label>
              <input
                id="doc-review-notes"
                type="text"
                className="form-input"
                value={reviewNotes}
                onChange={handleReviewNotesChange}
                placeholder="Motivo u observación sobre el documento..."
              />
            </div>

            {proc.documents.length === 0 ? (
              <p className="muted-text">No hay documentos cargados.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Tipo</th>
                      <th>Archivo</th>
                      <th>Estado</th>
                      <th>Descarga</th>
                      <th>Decisión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proc.documents.map((doc) => (
                      <tr key={doc.id}>
                        <td className="mono">#{doc.id}</td>
                        <td>{DOCUMENT_KIND_LABELS[doc.kind] ?? doc.kind}</td>
                        <td className="mono">{doc.original_name}</td>
                        <td>
                          <span className="badge badge-info">
                            {DOCUMENT_STATUS_LABELS[doc.status] ?? doc.status}
                          </span>
                        </td>
                        <td>
                          <a
                            href={buildUrl(
                              `/admin/procedures/${proc.id}/documents/${doc.id}/download`,
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary btn-sm"
                          >
                            Abrir archivo
                          </a>
                        </td>
                        <td>
                          {doc.status === "pending" ? (
                            <div className="btn-row">
                              <button
                                type="button"
                                className="btn btn-success btn-sm"
                                data-doc-id={doc.id}
                                data-decision="approve"
                                onClick={handleDocumentReview}
                                disabled={busy}
                              >
                                Aprobar
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                data-doc-id={doc.id}
                                data-decision="reject"
                                onClick={handleDocumentReview}
                                disabled={busy}
                              >
                                Observar
                              </button>
                            </div>
                          ) : (
                            <span className="muted-text">
                              {doc.review_notes ?? "Revisado"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid-3">
            <form className="card form-stack" onSubmit={handleAuthorizeRetry}>
              <h3 className="card-title">Habilitar reintento teórico</h3>
              <div className="form-field">
                <label htmlFor="retry-reason" className="form-label">
                  Justificación administrativa (mín. 5 caracteres)
                </label>
                <input
                  id="retry-reason"
                  type="text"
                  className="form-input"
                  value={retryReason}
                  onChange={handleRetryReasonChange}
                  minLength={5}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={busy}
              >
                Autorizar intento extra
              </button>
            </form>

            <form className="card form-stack" onSubmit={handleCompleteDelivery}>
              <h3 className="card-title">Confirmar entrega y emitir licencia</h3>
              <div className="form-field">
                <label htmlFor="complete-delivery-notes" className="form-label">
                  Notas de entrega o retiro
                </label>
                <input
                  id="complete-delivery-notes"
                  type="text"
                  className="form-input"
                  value={deliveryNotes}
                  onChange={handleDeliveryNotesChange}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || proc.current_step !== "delivery"}
              >
                Emitir credencial y cerrar
              </button>
            </form>

            <form className="card form-stack" onSubmit={handleRejectProcedure}>
              <h3 className="card-title">Rechazar expediente</h3>
              <div className="form-field">
                <label htmlFor="reject-proc-reason" className="form-label">
                  Motivo fundado (mín. 10 caracteres)
                </label>
                <input
                  id="reject-proc-reason"
                  type="text"
                  className="form-input"
                  value={rejectReason}
                  onChange={handleRejectReasonChange}
                  minLength={10}
                  required
                />
              </div>
              <button type="submit" className="btn btn-danger" disabled={busy}>
                Rechazar trámite
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/** Módulo de pagos: revisión manual, doble control y conciliación por extracto CSV/XLSX. */
export function AdminPaymentsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const paymentsQuery = useQuery({
    queryKey: ["admin", "payments", statusFilter, searchQuery],
    queryFn: () =>
      api.get<Page<PaymentAdmin>>("/admin/payments", {
        status: statusFilter || undefined,
        q: searchQuery || undefined,
        limit: 50,
      }),
  });

  const importsQuery = useQuery({
    queryKey: ["admin", "payment-imports"],
    queryFn: () => api.get<PaymentImport[]>("/admin/payments/imports"),
  });

  function handleStatusChange(event: ChangeEvent<HTMLSelectElement>) {
    setStatusFilter(event.target.value);
  }
  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setSearchQuery(event.target.value);
  }
  function handleNotesChange(event: ChangeEvent<HTMLInputElement>) {
    setReviewNotes(event.target.value);
  }
  function handleStatementFileChange(event: ChangeEvent<HTMLInputElement>) {
    setStatementFile(event.target.files?.[0] ?? null);
  }

  async function handleReviewPayment(event: MouseEvent<HTMLButtonElement>) {
    const paymentId = Number(event.currentTarget.dataset.paymentId);
    const decision = event.currentTarget.dataset.decision as
      | "approve"
      | "reject";
    if (!paymentId || !decision || busy) return;
    setBusy(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const updated = await api.post<PaymentAdmin>(
        `/admin/payments/${paymentId}/review`,
        {
          decision,
          notes: reviewNotes.trim() || null,
        },
      );
      setFeedback(
        `Pago ${updated.reference} actualizado a estado: ${PAYMENT_STATUS_LABELS[updated.status] ?? updated.status}.`,
      );
      setReviewNotes("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo revisar el pago.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleImportStatement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!statementFile || busy) return;
    setBusy(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append("file", statementFile);
      const summary = await api.upload<PaymentImport>(
        "/admin/payments/import",
        formData,
      );
      setFeedback(
        `Extracto ${summary.filename} procesado: ${summary.matched_rows} conciliados de ${summary.total_rows} filas (${summary.exception_rows} excepciones).`,
      );
      setStatementFile(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
      await queryClient.invalidateQueries({
        queryKey: ["admin", "payment-imports"],
      });
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo importar el extracto bancario.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Backoffice · Recaudación</span>
          <h1 className="page-title">
            Conciliación de transferencias y extractos
          </h1>
        </div>
      </div>

      <AdminSubnav />

      {errorMsg && (
        <div className="alert alert-danger" role="alert">
          <WarningIcon size={18} />
          <div className="alert-content">{errorMsg}</div>
        </div>
      )}

      {feedback && (
        <div className="alert alert-success" role="status">
          <CheckIcon size={18} />
          <div className="alert-content">{feedback}</div>
        </div>
      )}

      <div className="grid-2 bottom-gap-md">
        <form className="card form-stack" onSubmit={handleImportStatement}>
          <div className="civic-ribbon-tag">
            <UploadIcon size={18} />
            <strong>Importar extracto bancario (CSV o XLSX)</strong>
          </div>
          <div className="form-field">
            <label htmlFor="stmt-file" className="form-label">
              Archivo de movimientos bancarios
            </label>
            <input
              id="stmt-file"
              type="file"
              accept=".csv,.xlsx"
              className="form-input"
              onChange={handleStatementFileChange}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !statementFile}
          >
            Conciliar extracto
          </button>
        </form>

        <div className="card form-stack">
          <h2 className="card-title">Últimas importaciones</h2>
          {(importsQuery.data ?? []).length === 0 ? (
            <p className="muted-text">
              Todavía no se importaron extractos bancarios.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Archivo</th>
                    <th>Filas</th>
                    <th>Conciliadas</th>
                    <th>Excepciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(importsQuery.data ?? []).slice(0, 5).map((imp) => (
                    <tr key={imp.id}>
                      <td className="mono">{imp.filename}</td>
                      <td className="mono">{imp.total_rows}</td>
                      <td className="mono">{imp.matched_rows}</td>
                      <td className="mono">{imp.exception_rows}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="filter-bar">
        <div className="form-field">
          <label htmlFor="pay-status-filter" className="form-label">
            Estado del pago
          </label>
          <select
            id="pay-status-filter"
            className="form-select"
            value={statusFilter}
            onChange={handleStatusChange}
          >
            <option value="">Todos</option>
            <option value="claimed">Comprobante enviado</option>
            <option value="pending_second">Doble control pendiente</option>
            <option value="approved">Aprobados</option>
            <option value="rejected">Observados</option>
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="pay-search-q" className="form-label">
            Referencia PAGO- o correo
          </label>
          <input
            id="pay-search-q"
            type="text"
            className="form-input"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>

        <div className="form-field">
          <label htmlFor="pay-review-notes" className="form-label">
            Nota de revisión / observación
          </label>
          <input
            id="pay-review-notes"
            type="text"
            className="form-input"
            value={reviewNotes}
            onChange={handleNotesChange}
            placeholder="Nota para dejar en auditoría..."
          />
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Referencia</th>
              <th>Expediente</th>
              <th>Vecino / Ordenante</th>
              <th>Monto</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(paymentsQuery.data?.items ?? []).map((pay) => (
              <tr key={pay.id}>
                <td className="mono">{pay.reference}</td>
                <td className="mono">{pay.procedure_code}</td>
                <td>
                  <div>{pay.citizen_name}</div>
                  <div className="muted-text">
                    Ordenante: {pay.payer_name ?? "-"}
                  </div>
                </td>
                <td className="mono">${pay.amount}</td>
                <td>
                  <span className="badge badge-info">
                    {PAYMENT_STATUS_LABELS[pay.status] ?? pay.status}
                  </span>
                </td>
                <td>
                  {pay.status === "claimed" ||
                  pay.status === "pending_second" ? (
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        data-payment-id={pay.id}
                        data-decision="approve"
                        onClick={handleReviewPayment}
                        disabled={busy}
                      >
                        {pay.status === "pending_second"
                          ? "2.ª Aprobación"
                          : "Aprobar"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        data-payment-id={pay.id}
                        data-decision="reject"
                        onClick={handleReviewPayment}
                        disabled={busy}
                      >
                        Observar
                      </button>
                    </div>
                  ) : (
                    <span className="muted-text">
                      {pay.review_notes ?? "Sin acciones pendientes"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Módulo de agenda de turnos prácticos y registro de calificaciones de manejo. */
export function AdminAppointmentsPage() {
  const queryClient = useQueryClient();
  const [scheduledAt, setScheduledAt] = useState("");
  const [location, setLocation] = useState(
    "Pista Municipal de Examen · Baradero",
  );
  const [instructor, setInstructor] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const appointmentsQuery = useQuery({
    queryKey: ["admin", "appointments"],
    queryFn: () =>
      api.get<Page<AdminAppointment>>("/admin/appointments", { limit: 60 }),
  });

  function handleScheduledAtChange(event: ChangeEvent<HTMLInputElement>) {
    setScheduledAt(event.target.value);
  }
  function handleLocationChange(event: ChangeEvent<HTMLInputElement>) {
    setLocation(event.target.value);
  }
  function handleInstructorChange(event: ChangeEvent<HTMLInputElement>) {
    setInstructor(event.target.value);
  }
  function handleNotesInputChange(event: ChangeEvent<HTMLInputElement>) {
    setNotesInput(event.target.value);
  }

  async function handleCreateAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scheduledAt || busy) return;
    setBusy(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const isoDate = new Date(scheduledAt).toISOString();
      await api.post("/admin/appointments", {
        scheduled_at: isoDate,
        location: location.trim(),
        kind: "practical",
        capacity: 1,
        instructor: instructor.trim() || null,
      });
      setFeedback("Cupo de examen práctico publicado correctamente.");
      setScheduledAt("");
      await queryClient.invalidateQueries({
        queryKey: ["admin", "appointments"],
      });
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError ? err.message : "No se pudo crear el turno.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRecordResult(event: MouseEvent<HTMLButtonElement>) {
    const id = Number(event.currentTarget.dataset.appointmentId);
    const result = event.currentTarget.dataset.result as "passed" | "failed";
    if (!id || !result || busy) return;
    setBusy(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      await api.patch(`/admin/appointments/${id}`, {
        status: "completed",
        result,
        notes: notesInput.trim() || null,
      });
      setFeedback(
        result === "passed"
          ? "Examen práctico calificado como APROBADO."
          : "Examen práctico calificado como DESAPROBADO.",
      );
      setNotesInput("");
      await queryClient.invalidateQueries({
        queryKey: ["admin", "appointments"],
      });
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo registrar el resultado práctico.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Backoffice · Pista de Manejo</span>
          <h1 className="page-title">Turnos y evaluación de examen práctico</h1>
        </div>
      </div>

      <AdminSubnav />

      {errorMsg && (
        <div className="alert alert-danger" role="alert">
          <WarningIcon size={18} />
          <div className="alert-content">{errorMsg}</div>
        </div>
      )}

      {feedback && (
        <div className="alert alert-success" role="status">
          <CheckIcon size={18} />
          <div className="alert-content">{feedback}</div>
        </div>
      )}

      <form
        className="card form-stack bottom-gap-md"
        onSubmit={handleCreateAppointment}
      >
        <h2 className="card-title">Publicar nuevo cupo práctico</h2>
        <div className="form-row-3">
          <div className="form-field">
            <label htmlFor="appt-datetime" className="form-label">
              Fecha y hora
            </label>
            <input
              id="appt-datetime"
              type="datetime-local"
              className="form-input"
              value={scheduledAt}
              onChange={handleScheduledAtChange}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="appt-location" className="form-label">
              Lugar de evaluación
            </label>
            <input
              id="appt-location"
              type="text"
              className="form-input"
              value={location}
              onChange={handleLocationChange}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="appt-instructor" className="form-label">
              Inspector / Examinador asignado
            </label>
            <input
              id="appt-instructor"
              type="text"
              className="form-input"
              value={instructor}
              onChange={handleInstructorChange}
            />
          </div>
        </div>
        <div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            <PlusIcon size={17} />
            <span>Crear cupo disponible</span>
          </button>
        </div>
      </form>

      <div className="filter-bar">
        <div className="form-field">
          <label htmlFor="practical-notes" className="form-label">
            Observaciones del examinador para el acta práctica
          </label>
          <input
            id="practical-notes"
            type="text"
            className="form-input"
            value={notesInput}
            onChange={handleNotesInputChange}
            placeholder="Detalle de maniobras evaluadas..."
          />
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha y hora</th>
              <th>Lugar / Examinador</th>
              <th>Estado</th>
              <th>Expediente / Vecino</th>
              <th>Resultado</th>
              <th>Calificar</th>
            </tr>
          </thead>
          <tbody>
            {(appointmentsQuery.data?.items ?? []).map((appt) => (
              <tr key={appt.id}>
                <td>{new Date(appt.scheduled_at).toLocaleString("es-AR")}</td>
                <td>
                  <div>{appt.location}</div>
                  <div className="muted-text">
                    {appt.instructor ?? "Sin asignar"}
                  </div>
                </td>
                <td>
                  <span className="badge badge-info">{appt.status}</span>
                </td>
                <td>
                  {appt.procedure_code ? (
                    <div>
                      <span className="mono">{appt.procedure_code}</span> ·{" "}
                      {appt.citizen_name}
                    </div>
                  ) : (
                    <span className="muted-text">Libre</span>
                  )}
                </td>
                <td>{appt.result ?? "-"}</td>
                <td>
                  {appt.status === "booked" ? (
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        data-appointment-id={appt.id}
                        data-result="passed"
                        onClick={handleRecordResult}
                        disabled={busy}
                      >
                        Aprobar práctico
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        data-appointment-id={appt.id}
                        data-result="failed"
                        onClick={handleRecordResult}
                        disabled={busy}
                      >
                        Desaprobar
                      </button>
                    </div>
                  ) : (
                    <span className="muted-text">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Banco oficial de preguntas teóricas con flujo de revisión antes de entrar en sorteo. */
export function AdminQuestionsPage() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("B");
  const [prompt, setPrompt] = useState("");
  const [opt0, setOpt0] = useState("");
  const [opt1, setOpt1] = useState("");
  const [opt2, setOpt2] = useState("");
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const questionsQuery = useQuery({
    queryKey: ["admin", "questions"],
    queryFn: () =>
      api.get<Page<Question>>("/admin/questions", { limit: 100 }),
  });

  function handleCategoryChange(event: ChangeEvent<HTMLSelectElement>) {
    setCategory(event.target.value);
  }
  function handlePromptChange(event: ChangeEvent<HTMLInputElement>) {
    setPrompt(event.target.value);
  }
  function handleOpt0Change(event: ChangeEvent<HTMLInputElement>) {
    setOpt0(event.target.value);
  }
  function handleOpt1Change(event: ChangeEvent<HTMLInputElement>) {
    setOpt1(event.target.value);
  }
  function handleOpt2Change(event: ChangeEvent<HTMLInputElement>) {
    setOpt2(event.target.value);
  }
  function handleCorrectIndexChange(event: ChangeEvent<HTMLSelectElement>) {
    setCorrectIndex(Number(event.target.value));
  }
  function handleExplanationChange(event: ChangeEvent<HTMLInputElement>) {
    setExplanation(event.target.value);
  }

  async function handleCreateQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const options = [opt0.trim(), opt1.trim(), opt2.trim()].filter(Boolean);
      await api.post("/admin/questions", {
        category,
        prompt: prompt.trim(),
        options,
        correct_index: correctIndex,
        explanation: explanation.trim() || null,
        source: "Manual Municipal Baradero",
      });
      setFeedback(
        "Pregunta creada en estado borrador. Revisala para habilitarla en los exámenes.",
      );
      setPrompt("");
      setOpt0("");
      setOpt1("");
      setOpt2("");
      setExplanation("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "questions"] });
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo crear la pregunta.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleReview(event: MouseEvent<HTMLButtonElement>) {
    const id = Number(event.currentTarget.dataset.questionId);
    const reviewed = event.currentTarget.dataset.reviewed === "true";
    if (!id || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await api.post(`/admin/questions/${id}/review`, { reviewed });
      await queryClient.invalidateQueries({ queryKey: ["admin", "questions"] });
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo actualizar la revisión.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Backoffice · Evaluación Teórica</span>
          <h1 className="page-title">Banco de preguntas oficial</h1>
        </div>
      </div>

      <AdminSubnav />

      {errorMsg && (
        <div className="alert alert-danger" role="alert">
          <WarningIcon size={18} />
          <div className="alert-content">{errorMsg}</div>
        </div>
      )}

      {feedback && (
        <div className="alert alert-success" role="status">
          <CheckIcon size={18} />
          <div className="alert-content">{feedback}</div>
        </div>
      )}

      <form
        className="card form-stack bottom-gap-md"
        onSubmit={handleCreateQuestion}
      >
        <h2 className="card-title">Agregar nueva pregunta al banco</h2>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="q-cat" className="form-label">
              Categoría
            </label>
            <select
              id="q-cat"
              className="form-select"
              value={category}
              onChange={handleCategoryChange}
            >
              <option value="A">Clase A</option>
              <option value="B">Clase B</option>
              <option value="C">Clase C</option>
              <option value="D">Clase D</option>
              <option value="E">Clase E</option>
              <option value="G">Clase G</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="q-correct" className="form-label">
              Opción correcta
            </label>
            <select
              id="q-correct"
              className="form-select"
              value={correctIndex}
              onChange={handleCorrectIndexChange}
            >
              <option value={0}>Opción A (primera)</option>
              <option value={1}>Opción B (segunda)</option>
              <option value={2}>Opción C (tercera)</option>
            </select>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="q-prompt" className="form-label">
            Enunciado de la pregunta
          </label>
          <input
            id="q-prompt"
            type="text"
            className="form-input"
            value={prompt}
            onChange={handlePromptChange}
            minLength={10}
            required
          />
        </div>

        <div className="form-row-3">
          <div className="form-field">
            <label htmlFor="q-opt0" className="form-label">
              Opción A
            </label>
            <input
              id="q-opt0"
              type="text"
              className="form-input"
              value={opt0}
              onChange={handleOpt0Change}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="q-opt1" className="form-label">
              Opción B
            </label>
            <input
              id="q-opt1"
              type="text"
              className="form-input"
              value={opt1}
              onChange={handleOpt1Change}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="q-opt2" className="form-label">
              Opción C
            </label>
            <input
              id="q-opt2"
              type="text"
              className="form-input"
              value={opt2}
              onChange={handleOpt2Change}
              required
            />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="q-exp" className="form-label">
            Fundamento normativo / explicación
          </label>
          <input
            id="q-exp"
            type="text"
            className="form-input"
            value={explanation}
            onChange={handleExplanationChange}
          />
        </div>

        <div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            <BookIcon size={17} />
            <span>Guardar pregunta</span>
          </button>
        </div>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Cat.</th>
              <th>Enunciado y opciones</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {(questionsQuery.data?.items ?? []).map((q) => (
              <tr key={q.id}>
                <td className="mono">#{q.id}</td>
                <td className="mono">{q.category}</td>
                <td>
                  <strong>{q.prompt}</strong>
                  <div className="muted-text">
                    {q.options.map((opt, idx) => (
                      <span key={`${q.id}-${idx}`}>
                        {idx === q.correct_index ? `[Correcta: ${opt}] ` : `${opt} · `}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <span
                    className={
                      q.reviewed ? "badge badge-success" : "badge badge-warning"
                    }
                  >
                    {q.reviewed ? "Revisada" : "Borrador"}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    data-question-id={q.id}
                    data-reviewed={q.reviewed ? "false" : "true"}
                    onClick={handleToggleReview}
                    disabled={busy}
                  >
                    {q.reviewed ? "Retirar de sorteo" : "Aprobar pregunta"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Registro administrativo de credenciales emitidas y revocación fundada. */
export function AdminLicensesPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const licensesQuery = useQuery({
    queryKey: ["admin", "licenses", searchQuery],
    queryFn: () =>
      api.get<Page<LicenseAdmin>>("/admin/licenses", {
        q: searchQuery || undefined,
        limit: 50,
      }),
  });

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setSearchQuery(event.target.value);
  }
  function handleRevokeReasonChange(event: ChangeEvent<HTMLInputElement>) {
    setRevokeReason(event.target.value);
  }

  async function handleRevokeLicense(event: MouseEvent<HTMLButtonElement>) {
    const id = Number(event.currentTarget.dataset.licenseId);
    if (!id || busy) return;
    if (revokeReason.trim().length < 10) {
      setErrorMsg(
        "Ingresá un motivo de revocación de al menos 10 caracteres en la barra superior.",
      );
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await api.post<MessageResponse>(
        `/admin/licenses/${id}/revoke`,
        {
          reason: revokeReason.trim(),
        },
      );
      setFeedback(res.message);
      setRevokeReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "licenses"] });
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo revocar la credencial.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Backoffice · Registro Municipal</span>
          <h1 className="page-title">Credenciales emitidas y revocaciones</h1>
        </div>
      </div>

      <AdminSubnav />

      {errorMsg && (
        <div className="alert alert-danger" role="alert">
          <WarningIcon size={18} />
          <div className="alert-content">{errorMsg}</div>
        </div>
      )}

      {feedback && (
        <div className="alert alert-success" role="status">
          <CheckIcon size={18} />
          <div className="alert-content">{feedback}</div>
        </div>
      )}

      <div className="filter-bar">
        <div className="form-field">
          <label htmlFor="lic-search" className="form-label">
            Buscar por número de licencia o correo
          </label>
          <input
            id="lic-search"
            type="text"
            className="form-input"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
        <div className="form-field">
          <label htmlFor="lic-revoke-reason" className="form-label">
            Motivo de revocación (mín. 10 caracteres)
          </label>
          <input
            id="lic-revoke-reason"
            type="text"
            className="form-input"
            value={revokeReason}
            onChange={handleRevokeReasonChange}
            placeholder="Resolución administrativa o contravención..."
          />
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>N.º Licencia</th>
              <th>Titular</th>
              <th>Cat.</th>
              <th>Expediente</th>
              <th>Vigencia</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {(licensesQuery.data?.items ?? []).map((lic) => (
              <tr key={lic.id}>
                <td className="mono">{lic.license_number}</td>
                <td>
                  <div>{lic.citizen_name}</div>
                  <div className="muted-text">{lic.citizen_email}</div>
                </td>
                <td className="mono">{lic.category}</td>
                <td className="mono">{lic.procedure_code}</td>
                <td>
                  {new Date(lic.issued_at).toLocaleDateString("es-AR")} al{" "}
                  {new Date(lic.expires_at).toLocaleDateString("es-AR")}
                </td>
                <td>
                  <span
                    className={
                      lic.status === "active"
                        ? "badge badge-success"
                        : "badge badge-danger"
                    }
                  >
                    {lic.status}
                  </span>
                </td>
                <td>
                  {lic.status === "active" ? (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      data-license-id={lic.id}
                      onClick={handleRevokeLicense}
                      disabled={busy}
                    >
                      <QrIcon size={15} />
                      <span>Revocar</span>
                    </button>
                  ) : (
                    <span className="muted-text">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Administración de cuentas de usuario, estado de suspensión y roles (superadmin). */
export function AdminUsersPage() {
  const { hasRole } = useAuth();
  const isSuperadmin = hasRole("superadmin");
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const usersQuery = useQuery({
    queryKey: ["admin", "users", searchQuery],
    queryFn: () =>
      api.get<Page<UserAdmin>>("/admin/users", {
        q: searchQuery || undefined,
        limit: 50,
      }),
  });

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setSearchQuery(event.target.value);
  }

  async function handleToggleUserStatus(event: MouseEvent<HTMLButtonElement>) {
    const id = Number(event.currentTarget.dataset.userId);
    const nextStatus = event.currentTarget.dataset.nextStatus;
    if (!id || !nextStatus || busy) return;
    setBusy(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      await api.patch(`/admin/users/${id}`, { status: nextStatus });
      setFeedback(`Estado de la cuenta #${id} actualizado a ${nextStatus}.`);
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo actualizar el estado del usuario.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleSelectChange(event: ChangeEvent<HTMLSelectElement>) {
    const id = Number(event.currentTarget.dataset.userId);
    const nextRole = event.target.value as Role;
    if (!id || !nextRole || busy) return;
    setBusy(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      await api.patch(`/admin/users/${id}`, { role: nextRole });
      setFeedback(`Rol de la cuenta #${id} actualizado a ${nextRole}.`);
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo actualizar el rol.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Backoffice · Cuentas y Permisos</span>
          <h1 className="page-title">Gestión de usuarios y personal</h1>
        </div>
      </div>

      <AdminSubnav />

      {errorMsg && (
        <div className="alert alert-danger" role="alert">
          <WarningIcon size={18} />
          <div className="alert-content">{errorMsg}</div>
        </div>
      )}

      {feedback && (
        <div className="alert alert-success" role="status">
          <CheckIcon size={18} />
          <div className="alert-content">{feedback}</div>
        </div>
      )}

      <div className="filter-bar">
        <div className="form-field">
          <label htmlFor="user-search-q" className="form-label">
            Buscar por correo electrónico o número de DNI exacto
          </label>
          <input
            id="user-search-q"
            type="text"
            className="form-input"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="correo@ejemplo.com o DNI sin puntos"
          />
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre y correo</th>
              <th>DNI</th>
              <th>Rol</th>
              <th>MFA</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(usersQuery.data?.items ?? []).map((u) => (
              <tr key={u.id}>
                <td className="mono">#{u.id}</td>
                <td>
                  <div>{u.name ?? "Sin perfil"}</div>
                  <div className="muted-text">{u.email}</div>
                </td>
                <td className="mono">{u.dni_masked ?? "-"}</td>
                <td>
                  {isSuperadmin ? (
                    <select
                      className="form-select"
                      value={u.role}
                      data-user-id={u.id}
                      onChange={handleRoleSelectChange}
                      disabled={busy}
                      aria-label={`Rol de ${u.email}`}
                    >
                      <option value="citizen">citizen</option>
                      <option value="admin_pagos">admin_pagos</option>
                      <option value="admin_salud">admin_salud</option>
                      <option value="admin_turnos">admin_turnos</option>
                      <option value="admin_cuentas">admin_cuentas</option>
                      <option value="admin">admin</option>
                      <option value="superadmin">superadmin</option>
                    </select>
                  ) : (
                    <span className="badge badge-neutral">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  )}
                </td>
                <td>
                  <span
                    className={
                      u.mfa_enabled
                        ? "badge badge-success"
                        : "badge badge-neutral"
                    }
                  >
                    {u.mfa_enabled ? "Activo" : "No"}
                  </span>
                </td>
                <td>
                  <span
                    className={
                      u.status === "active"
                        ? "badge badge-success"
                        : "badge badge-danger"
                    }
                  >
                    {u.status}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className={
                      u.status === "active"
                        ? "btn btn-danger btn-sm"
                        : "btn btn-secondary btn-sm"
                    }
                    data-user-id={u.id}
                    data-next-status={
                      u.status === "active" ? "suspended" : "active"
                    }
                    onClick={handleToggleUserStatus}
                    disabled={busy}
                  >
                    <UserIcon size={15} />
                    <span>
                      {u.status === "active" ? "Suspender" : "Reactivar"}
                    </span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Publicación de versiones de políticas normativas con hash SHA-256. */
export function AdminPoliciesPage() {
  const queryClient = useQueryClient();
  const [slug, setSlug] = useState("privacidad");
  const [title, setTitle] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [mandatory, setMandatory] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const policiesQuery = useQuery({
    queryKey: ["admin", "policies"],
    queryFn: () => api.get<AdminPolicy[]>("/admin/policies"),
  });

  function handleSlugChange(event: ChangeEvent<HTMLInputElement>) {
    setSlug(event.target.value);
  }
  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    setTitle(event.target.value);
  }
  function handleBodyChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setBodyMd(event.target.value);
  }
  function handleMandatoryChange(event: ChangeEvent<HTMLInputElement>) {
    setMandatory(event.target.checked);
  }

  async function handlePublishPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || bodyMd.trim().length < 50) return;
    setBusy(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const created = await api.post<{
        slug: string;
        version: number;
        content_hash: string;
      }>("/admin/policies", {
        slug: slug.trim(),
        title: title.trim(),
        body_md: bodyMd.trim(),
        mandatory,
        applies_to: "all",
      });
      setFeedback(
        `Política "${created.slug}" v${created.version} publicada (SHA-256: ${created.content_hash.slice(0, 14)}...).`,
      );
      setTitle("");
      setBodyMd("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "policies"] });
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo publicar la política.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Backoffice · Normativa</span>
          <h1 className="page-title">Políticas versionadas</h1>
        </div>
      </div>

      <AdminSubnav />

      {errorMsg && (
        <div className="alert alert-danger" role="alert">
          <WarningIcon size={18} />
          <div className="alert-content">{errorMsg}</div>
        </div>
      )}

      {feedback && (
        <div className="alert alert-success" role="status">
          <CheckIcon size={18} />
          <div className="alert-content">{feedback}</div>
        </div>
      )}

      <form
        className="card form-stack bottom-gap-md"
        onSubmit={handlePublishPolicy}
      >
        <h2 className="card-title">Publicar nueva versión de política</h2>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="pol-slug" className="form-label">
              Identificador (slug)
            </label>
            <input
              id="pol-slug"
              type="text"
              className="form-input mono"
              value={slug}
              onChange={handleSlugChange}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="pol-title" className="form-label">
              Título oficial
            </label>
            <input
              id="pol-title"
              type="text"
              className="form-input"
              value={title}
              onChange={handleTitleChange}
              required
            />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="pol-body" className="form-label">
            Contenido normativo en Markdown (mínimo 50 caracteres)
          </label>
          <textarea
            id="pol-body"
            className="form-textarea"
            value={bodyMd}
            onChange={handleBodyChange}
            minLength={50}
            required
          />
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            className="checkbox-input"
            checked={mandatory}
            onChange={handleMandatoryChange}
          />
          <span>
            Aceptación obligatoria para continuar operando en el portal
          </span>
        </label>

        <div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Publicar nueva versión
          </button>
        </div>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Slug</th>
              <th>Título</th>
              <th>Versión</th>
              <th>Estado</th>
              <th>Hash SHA-256</th>
            </tr>
          </thead>
          <tbody>
            {(policiesQuery.data ?? []).map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.slug}</td>
                <td>{p.title}</td>
                <td className="mono">v{p.version}</td>
                <td>
                  <span
                    className={
                      p.active ? "badge badge-success" : "badge badge-neutral"
                    }
                  >
                    {p.active ? "Vigente" : "Histórica"}
                  </span>
                </td>
                <td className="mono">{p.content_hash.slice(0, 16)}...</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Registro de auditoría inmutable con verificación criptográfica de cadena de hashes. */
export function AdminAuditPage() {
  const [actionFilter, setActionFilter] = useState("");
  const [verifyResult, setVerifyResult] = useState<AuditVerify | null>(null);
  const [verifying, setVerifying] = useState(false);

  const auditQuery = useQuery({
    queryKey: ["admin", "audit", actionFilter],
    queryFn: () =>
      api.get<Page<AuditEntry>>("/admin/audit", {
        action: actionFilter || undefined,
        limit: 60,
      }),
  });

  function handleActionFilterChange(event: ChangeEvent<HTMLInputElement>) {
    setActionFilter(event.target.value);
  }

  async function handleVerifyChain() {
    if (verifying) return;
    setVerifying(true);
    try {
      const res = await api.get<AuditVerify>("/admin/audit/verify");
      setVerifyResult(res);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Backoffice · Trazabilidad</span>
          <h1 className="page-title">Auditoría criptográfica encadenada</h1>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleVerifyChain}
          disabled={verifying}
        >
          <ShieldIcon size={18} />
          <span>
            {verifying
              ? "Verificando hashes..."
              : "Verificar integridad de la cadena"}
          </span>
        </button>
      </div>

      <AdminSubnav />

      {verifyResult && (
        <div
          className={
            verifyResult.valid ? "alert alert-success" : "alert alert-danger"
          }
          role="status"
        >
          <ShieldIcon size={18} />
          <div className="alert-content">
            <span className="alert-title">{verifyResult.message}</span>
            Entradas verificadas: {verifyResult.checked}
            {verifyResult.broken_at
              ? ` · Ruptura en ID #${verifyResult.broken_at}`
              : ""}
          </div>
        </div>
      )}

      <div className="filter-bar">
        <div className="form-field">
          <label htmlFor="audit-action-filter" className="form-label">
            Filtrar por código de acción exacta
          </label>
          <input
            id="audit-action-filter"
            type="text"
            className="form-input mono"
            value={actionFilter}
            onChange={handleActionFilterChange}
            placeholder="Ej.: auth.login, procedure.created, payment.reviewed"
          />
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Fecha</th>
              <th>Actor / Rol</th>
              <th>Acción</th>
              <th>Entidad</th>
              <th>Hash de entrada</th>
            </tr>
          </thead>
          <tbody>
            {(auditQuery.data?.items ?? []).map((entry) => (
              <tr key={entry.id}>
                <td className="mono">#{entry.id}</td>
                <td>{new Date(entry.created_at).toLocaleString("es-AR")}</td>
                <td className="mono">
                  {entry.actor_user_id ? `#${entry.actor_user_id}` : "sistema"}{" "}
                  ({entry.actor_role ?? "-"})
                </td>
                <td className="mono">
                  <span className="badge badge-info">{entry.action}</span>
                </td>
                <td className="mono">
                  {entry.entity_type}
                  {entry.entity_id ? `:${entry.entity_id}` : ""}
                </td>
                <td className="mono">{entry.entry_hash.slice(0, 16)}...</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
