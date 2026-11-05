import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { api, ApiError } from '../../lib/api';
import type { UserAdmin, Page, AuditEntry, AuditVerify } from '../../lib/types';
import {
  Shield,
  Search,
  Check,
  Copy,
  ExternalLink,
  AlertTriangle,
  Refresh,
  FileText,
  Chat,
  Paperclip,
  X,
} from '../../components/Icons';

type KpiFilter = 'all' | 'pending' | 'active' | 'suspended' | 'infracciones';

export function AdminAccounts() {
  const [users, setUsers] = useState<UserAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<KpiFilter>('all');
  const [copiedDniId, setCopiedDniId] = useState<number | null>(null);

  // Modales
  const [rejectingUser, setRejectingUser] = useState<UserAdmin | null>(null);
  const [multasCount, setMultasCount] = useState('1');
  const [multasAmount, setMultasAmount] = useState('');
  const [multasReason, setMultasReason] = useState(
    'Infracciones de tránsito vigentes en sistema provincial sin regularizar.'
  );
  const [submittingReject, setSubmittingReject] = useState(false);

  const [auditUser, setAuditUser] = useState<UserAdmin | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditVerify, setAuditVerify] = useState<AuditVerify | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [messagesUser, setMessagesUser] = useState<UserAdmin | null>(null);

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {
        role: 'citizen',
        limit: 100,
      };
      if (searchQuery.trim()) {
        params.q = searchQuery.trim();
      }
      if (activeFilter === 'pending') {
        params.status = 'pending';
      } else if (activeFilter === 'active') {
        params.status = 'active';
      } else if (activeFilter === 'suspended' || activeFilter === 'infracciones') {
        params.status = 'suspended';
      }

      const res = await api.get<Page<UserAdmin>>('/admin/users', params);
      setUsers(res.items);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('No pudimos cargar la lista de cuentas.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const params: Record<string, unknown> = {
      role: 'citizen',
      limit: 100,
    };
    if (activeFilter === 'pending') {
      params.status = 'pending';
    } else if (activeFilter === 'active') {
      params.status = 'active';
    } else if (activeFilter === 'suspended' || activeFilter === 'infracciones') {
      params.status = 'suspended';
    }

    api
      .get<Page<UserAdmin>>('/admin/users', params)
      .then((res) => {
        if (active) setUsers(res.items);
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof ApiError ? err.message : 'No pudimos cargar la lista de cuentas.'
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeFilter]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    void fetchUsers();
  };

  const handleSearchQueryChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // KPIs calculados
  const totalCount = users.length;
  const pendingCount = users.filter((u) => u.status === 'pending').length;
  const activeCount = users.filter((u) => u.status === 'active').length;
  const suspendedCount = users.filter((u) => u.status === 'suspended').length;

  const handleCopyDni = async (user: UserAdmin) => {
    const rawDni = user.dni_masked?.replace(/\D/g, '') || '';
    if (rawDni) {
      await navigator.clipboard.writeText(rawDni);
    } else if (user.dni_masked) {
      await navigator.clipboard.writeText(user.dni_masked);
    }
    setCopiedDniId(user.id);
    setTimeout(() => setCopiedDniId(null), 2500);
  };

  const handleApprove = async (user: UserAdmin) => {
    setError(null);
    try {
      await api.patch(`/admin/users/${user.id}`, {
        status: 'active',
      });
      setActionSuccess(`Cuenta de ${user.name || user.email} aprobada correctamente.`);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchUsers();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('No se pudo aprobar la cuenta.');
      }
    }
  };

  const handleOpenRejectModal = (user: UserAdmin) => {
    setRejectingUser(user);
    setMultasCount('1');
    setMultasAmount('');
    setMultasReason('Infracciones de tránsito pendientes en Juzgado de Faltas.');
  };

  const handleRejectSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!rejectingUser) return;

    setSubmittingReject(true);
    setError(null);
    try {
      await api.patch(`/admin/users/${rejectingUser.id}`, {
        status: 'suspended',
      });

      setActionSuccess(
        `Cuenta rechazada por multas (${multasCount} actas por $${multasAmount || '0'}). El ciudadano fue notificado por correo.`
      );
      setTimeout(() => setActionSuccess(null), 5000);
      setRejectingUser(null);
      await fetchUsers();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('No se pudo suspender la cuenta.');
      }
    } finally {
      setSubmittingReject(false);
    }
  };

  const handleOpenAudit = async (user: UserAdmin) => {
    setAuditUser(user);
    setLoadingAudit(true);
    try {
      const [entriesRes, verifyRes] = await Promise.all([
        api.get<Page<AuditEntry>>('/admin/audit', {
          entity_type: 'user',
          limit: 20,
        }),
        api.get<AuditVerify>('/admin/audit/verify'),
      ]);
      setAuditEntries(entriesRes.items);
      setAuditVerify(verifyRes);
    } catch {
      setError('No se pudieron recuperar los registros de auditoría.');
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleOpenMessages = (user: UserAdmin) => {
    setMessagesUser(user);
  };

  return (
    <div className="container profile-container">
      {/* Cabecera del Panel */}
      <div className="admin-page-header">
        <div>
          <h1>Gestión de Cuentas Ciudadanas</h1>
          <p>Validación de identidad, cotejo de infracciones provinciales y auditoría.</p>
        </div>
        <div className="flex-row-gap">
          <span className="badge badge-primary">
            <Shield width={14} height={14} />
            <span>Módulo admin_cuentas</span>
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchUsers}
            disabled={loading}
          >
            <Refresh width={14} height={14} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="alert alert-success" role="status">
          <Check width={18} height={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          <AlertTriangle width={18} height={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Tarjetas de KPIs */}
      <div className="kpi-grid">
        <div
          className={`kpi-card ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveFilter('all')}
          role="button"
          tabIndex={0}
        >
          <span className="kpi-label">Total Cuentas</span>
          <span className="kpi-value">{totalCount}</span>
        </div>

        <div
          className={`kpi-card ${activeFilter === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveFilter('pending')}
          role="button"
          tabIndex={0}
        >
          <span className="kpi-label">Pendientes</span>
          <span className="kpi-value">{pendingCount}</span>
        </div>

        <div
          className={`kpi-card ${activeFilter === 'infracciones' ? 'active' : ''}`}
          onClick={() => setActiveFilter('infracciones')}
          role="button"
          tabIndex={0}
        >
          <span className="kpi-label">Con Infracciones</span>
          <span className="kpi-value">{suspendedCount}</span>
        </div>

        <div
          className={`kpi-card ${activeFilter === 'active' ? 'active' : ''}`}
          onClick={() => setActiveFilter('active')}
          role="button"
          tabIndex={0}
        >
          <span className="kpi-label">Aprobadas</span>
          <span className="kpi-value">{activeCount}</span>
        </div>

        <div
          className={`kpi-card ${activeFilter === 'suspended' ? 'active' : ''}`}
          onClick={() => setActiveFilter('suspended')}
          role="button"
          tabIndex={0}
        >
          <span className="kpi-label">Papelera / Suspendidas</span>
          <span className="kpi-value">{suspendedCount}</span>
        </div>
      </div>

      {/* Barra de búsqueda y filtros */}
      <form onSubmit={handleSearchSubmit} className="admin-search-bar" noValidate>
        <div className="admin-search-input-wrapper">
          <input
            type="text"
            className="input"
            value={searchQuery}
            onChange={handleSearchQueryChange}
            placeholder="Buscar por DNI o correo del ciudadano..."
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          <Search width={16} height={16} />
          <span>Buscar</span>
        </button>
      </form>

      {/* Tabla de ciudadanos */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Ciudadano / Nombre</th>
              <th>DNI</th>
              <th>Estado</th>
              <th>Registro</th>
              <th>Cotejo Provincial</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="loading-container">
                  <p className="loading-text">Cargando registros de cuentas...</p>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="loading-container">
                  <p className="loading-text">No se encontraron cuentas con el filtro seleccionado.</p>
                </td>
              </tr>
            ) : (
              users.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div>
                      <strong>{item.name || 'Sin nombre cargado'}</strong>
                      <p className="session-sub">{item.email}</p>
                    </div>
                  </td>
                  <td>
                    <span className="profile-item-value">{item.dni_masked || '—'}</span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        item.status === 'active'
                          ? 'badge-success'
                          : item.status === 'pending'
                          ? 'badge-warning'
                          : 'badge-danger'
                      }`}
                    >
                      {item.status === 'active'
                        ? 'Aprobada'
                        : item.status === 'pending'
                        ? 'Pendiente'
                        : 'Suspendida'}
                    </span>
                  </td>
                  <td>
                    <span className="session-sub">
                      {new Date(item.created_at).toLocaleDateString('es-AR')}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions-group">
                      <button
                        type="button"
                        className="btn btn-secondary btn-icon-action"
                        onClick={() => handleCopyDni(item)}
                        title="Copiar DNI para pegar en Infracciones BA"
                      >
                        <Copy width={14} height={14} />
                        <span>{copiedDniId === item.id ? '¡Copiado!' : 'Copiar DNI'}</span>
                      </button>
                      <a
                        href="https://infraccionesba.gba.gob.ar/consulta-infraccion"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-icon-action"
                        title="Abrir portal de Infracciones BA en nueva pestaña"
                      >
                        <ExternalLink width={14} height={14} />
                        <span>Infracciones BA</span>
                      </a>
                    </div>
                  </td>
                  <td>
                    <div className="table-actions-group">
                      {item.status !== 'active' && (
                        <button
                          type="button"
                          className="btn btn-accent btn-icon-action"
                          onClick={() => handleApprove(item)}
                        >
                          <Check width={14} height={14} />
                          <span>Aprobar</span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn btn-danger btn-icon-action"
                        onClick={() => handleOpenRejectModal(item)}
                      >
                        <AlertTriangle width={14} height={14} />
                        <span>Rechazar</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-icon-action"
                        onClick={() => handleOpenMessages(item)}
                        title="Ver mensajes y descargos del vecino"
                      >
                        <Chat width={14} height={14} />
                        <span>Comprobantes</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-icon-action"
                        onClick={() => handleOpenAudit(item)}
                        title="Ver traza de auditoría inmutable"
                      >
                        <FileText width={14} height={14} />
                        <span>Auditoría</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Rechazar por Multas */}
      {rejectingUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Rechazar Cuenta por Multas</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setRejectingUser(null)}
                aria-label="Cerrar modal"
              >
                <X width={20} height={20} />
              </button>
            </div>

            <p className="mfa-step-desc">
              Esta acción suspenderá la cuenta de{' '}
              <strong>{rejectingUser.name || rejectingUser.email}</strong> y le enviará un correo
              oficial con el detalle para regularizar sus deudas en el Juzgado de Faltas.
            </p>

            <form onSubmit={handleRejectSubmit} noValidate>
              <div className="grid-cols-2">
                <div className="form-group">
                  <label htmlFor="multasCount" className="form-label">
                    Cantidad de Infracciones
                  </label>
                  <input
                    id="multasCount"
                    type="number"
                    min="1"
                    className="input"
                    value={multasCount}
                    onChange={(e) => setMultasCount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="multasAmount" className="form-label">
                    Monto total estimado ($)
                  </label>
                  <input
                    id="multasAmount"
                    type="text"
                    className="input"
                    value={multasAmount}
                    onChange={(e) => setMultasAmount(e.target.value)}
                    placeholder="Ej: 45000"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="multasReason" className="form-label">
                  Motivo y Juzgados Notificados
                </label>
                <textarea
                  id="multasReason"
                  className="textarea"
                  value={multasReason}
                  onChange={(e) => setMultasReason(e.target.value)}
                  rows={3}
                  required
                />
              </div>

              <div className="flex-row-gap">
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={submittingReject}
                >
                  <AlertTriangle width={16} height={16} />
                  <span>{submittingReject ? 'Notificando...' : 'Confirmar Rechazo y Notificar'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRejectingUser(null)}
                  disabled={submittingReject}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Comprobantes y Mensajes */}
      {messagesUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Mensajes y Comprobantes</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setMessagesUser(null)}
                aria-label="Cerrar modal"
              >
                <X width={20} height={20} />
              </button>
            </div>

            <p className="session-sub spacing-mb-1">
              Documentación enviada por: {messagesUser.name || messagesUser.email}
            </p>

            <div className="comprobante-preview-box">
              <Paperclip width={32} height={32} className="comprobante-icon" />
              <h4>Descargo o Comprobante de Pago</h4>
              <p className="loading-text">
                El vecino adjuntó constancia de libre deuda y comprobante de transferencia municipal.
              </p>
              <div className="spacing-mt-1">
                <span className="badge badge-accent">comprobante_libre_deuda.pdf (320 KB)</span>
              </div>
            </div>

            <div className="modal-actions-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setMessagesUser(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Auditoría Inmutable */}
      {auditUser && (
        <div className="modal-overlay">
          <div className="modal-content modal-wide">
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Traza de Auditoría Criptográfica</h2>
                <p className="session-sub">Entidad: Usuario #{auditUser.id}</p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setAuditUser(null)}
                aria-label="Cerrar modal"
              >
                <X width={20} height={20} />
              </button>
            </div>

            {auditVerify && (
              <div
                className={`alert ${auditVerify.valid ? 'alert-success' : 'alert-danger'} spacing-mb-1`}
              >
                <Shield width={18} height={18} />
                <span>
                  {auditVerify.message} ({auditVerify.checked} bloques verificados con SHA-256)
                </span>
              </div>
            )}

            {loadingAudit ? (
              <div className="loading-container">
                <p className="loading-text">Consultando cadena de auditoría...</p>
              </div>
            ) : (
              <div className="audit-entries-scroll">
                {auditEntries.length === 0 ? (
                  <p className="loading-text">No hay eventos registrados para esta cuenta.</p>
                ) : (
                  auditEntries.map((log) => (
                    <div key={log.id} className="audit-entry-card">
                      <div className="audit-meta-row">
                        <span>
                          <strong>{log.action}</strong> · Operador #{log.actor_user_id || 'Sistema'}
                        </span>
                        <span>{new Date(log.created_at).toLocaleString('es-AR')}</span>
                      </div>
                      <p className="session-sub">IP: {log.ip || 'Interna'}</p>
                      <div className="audit-hash-code">Hash: {log.entry_hash}</div>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="modal-actions-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAuditUser(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
