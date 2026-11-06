import { useState, useEffect, type FormEvent, type ChangeEvent, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { staffAccess } from '../../lib/staffAccess';
import { AdminPayments } from './AdminPayments';
import type {
  AdminProcedure,
  AdminAppointment,
  LicenseAdmin,
  Page,
  DocumentItem,
} from '../../lib/types';
import {
  FileText,
  Calendar,
  Award,
  Shield,
  Search,
  Check,
  Refresh,
  AlertTriangle,
  MapPin,
  Plus,
  X,
} from '../../components/Icons';

type AdminTab = 'expedientes' | 'turnos' | 'licencias' | 'pagos';

/** Una identidad distinta no conserva búsquedas, documentos ni decisiones de la anterior. */
export function AdminProcedures() {
  const { user } = useAuth();
  return <OperationsWorkspace key={`${user?.id}:${user?.role}`} />;
}

/** Presenta solo operaciones que ya permite el mapa de permisos del servidor. */
function OperationsWorkspace() {
  const { user } = useAuth();
  const access = staffAccess(user?.role);
  const [activeTab, setActiveTab] = useState<AdminTab>(user?.role === 'admin_pagos' ? 'pagos' : 'expedientes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Tab 1: Expedientes
  const [procedures, setProcedures] = useState<AdminProcedure[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProcedure, setSelectedProcedure] = useState<AdminProcedure | null>(null);
  const [reviewingDocId, setReviewingDocId] = useState<number | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Tab 2: Turnos Prácticos
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [showCreateSlotModal, setShowCreateSlotModal] = useState(false);
  const [newSlotDateTime, setNewSlotDateTime] = useState('');
  const [newSlotLocation, setNewSlotLocation] = useState('Autódromo / Pista Municipal Baradero');
  const [newSlotInstructor, setNewSlotInstructor] = useState('Inspector de Tránsito');
  const [newSlotCapacity, setNewSlotCapacity] = useState('1');
  const [submittingSlot, setSubmittingSlot] = useState(false);

  // Tab 3: Licencias y Entrega
  const [licenses, setLicenses] = useState<LicenseAdmin[]>([]);
  const [revokingLicense, setRevokingLicense] = useState<LicenseAdmin | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [submittingDelivery, setSubmittingDelivery] = useState(false);
  const [submittingRevoke, setSubmittingRevoke] = useState(false);

  /** Valida el destino del botón contra las secciones habilitadas, sin ampliar roles. */
  const handleTabChange = (event: MouseEvent<HTMLButtonElement>) => {
    const tab = event.currentTarget.dataset.tab;
    const allowed: AdminTab[] = ['expedientes'];
    if (access.payments) allowed.push('pagos');
    if (access.appointments) allowed.push('turnos');
    if (access.licenses) allowed.push('licencias');
    if (!allowed.includes(tab as AdminTab)) return;
    setActiveTab(tab as AdminTab); setError(null); setSelectedProcedure(null);
    setReviewingDocId(null); setRejectNotes(''); setLoading(tab !== 'pagos');
  };

  /** La bandeja financiera tiene su propio refresco y sus estados de carga. */
  const handleRefresh = () => {
    if (activeTab === 'expedientes') void loadProcedures();
    else if (activeTab === 'turnos' && access.appointments) void loadAppointments();
    else if (activeTab === 'licencias' && access.licenses) void loadLicenses();
  };

  // Carga de datos para Tab 1: Expedientes
  const loadProcedures = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, unknown> = { limit: 50 };
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get<Page<AdminProcedure>>('/admin/procedures', params);
      setProcedures(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cargar expedientes');
    } finally {
      setLoading(false);
    }
  };

  // Carga de datos para Tab 2: Turnos
  const loadAppointments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<Page<AdminAppointment>>('/admin/appointments', {
        kind: 'practical',
        limit: 50,
      });
      setAppointments(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cargar turnos');
    } finally {
      setLoading(false);
    }
  };

  // Carga de datos para Tab 3: Licencias
  const loadLicenses = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<Page<LicenseAdmin>>('/admin/licenses', { limit: 50 });
      setLicenses(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cargar credenciales emitidas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    if (activeTab === 'expedientes') {
      const params: Record<string, unknown> = { limit: 50 };
      if (statusFilter !== 'all') params.status = statusFilter;

      api
        .get<Page<AdminProcedure>>('/admin/procedures', params)
        .then((res) => {
          if (active) setProcedures(res.items);
        })
        .catch((err) => {
          if (active) {
            setError(err instanceof ApiError ? err.message : 'Error al cargar expedientes');
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else if (activeTab === 'turnos') {
      api
        .get<Page<AdminAppointment>>('/admin/appointments', {
          kind: 'practical',
          limit: 50,
        })
        .then((res) => {
          if (active) setAppointments(res.items);
        })
        .catch((err) => {
          if (active) {
            setError(err instanceof ApiError ? err.message : 'Error al cargar turnos');
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else if (activeTab === 'licencias') {
      Promise.all([
        api.get<Page<AdminProcedure>>('/admin/procedures', { limit: 50 }),
        api.get<Page<LicenseAdmin>>('/admin/licenses', { limit: 50 }),
      ])
        .then(([procRes, licRes]) => {
          if (active) {
            setProcedures(procRes.items);
            setLicenses(licRes.items);
          }
        })
        .catch((err) => {
          if (active) {
            setError(err instanceof ApiError ? err.message : 'Error al cargar licencias');
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [activeTab, statusFilter]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    void loadProcedures();
  };

  // Revisión de documento de salud
  const handleReviewDocument = async (doc: DocumentItem, decision: 'approve' | 'reject') => {
    if (!selectedProcedure || !access.health || doc.kind !== 'health_certificate') return;
    try {
      setSubmittingReview(true);
      setError(null);
      await api.post(
        `/admin/procedures/${selectedProcedure.id}/documents/${doc.id}/review`,
        {
          decision,
          notes: decision === 'reject' ? rejectNotes : null,
        },
      );
      setActionSuccess(
        decision === 'approve'
          ? 'Certificado médico aprobado. Consultá la etapa vigente del trámite.'
          : 'Certificado médico rechazado con observaciones.',
      );
      setReviewingDocId(null);
      setRejectNotes('');
      // Refrescamos trámite y lista
      const updated = await api.get<AdminProcedure>(
        `/admin/procedures/${selectedProcedure.id}`,
      );
      setSelectedProcedure(updated);
      await loadProcedures();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo revisar el documento');
    } finally {
      setSubmittingReview(false);
    }
  };

  // Creación de nuevo cupo práctico
  const handleCreateSlot = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSlotDateTime || !access.appointments) return;
    try {
      setSubmittingSlot(true);
      setError(null);
      await api.post('/admin/appointments', {
        scheduled_at: new Date(newSlotDateTime).toISOString(),
        location: newSlotLocation,
        instructor: newSlotInstructor || null,
        capacity: parseInt(newSlotCapacity, 10) || 1,
        kind: 'practical',
      });
      setActionSuccess('Nuevo cupo de examen práctico publicado con éxito.');
      setShowCreateSlotModal(false);
      setNewSlotDateTime('');
      await loadAppointments();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el cupo');
    } finally {
      setSubmittingSlot(false);
    }
  };

  // Calificación de examen práctico (Aprobar o Reprobar)
  const handleGradePractical = async (
    appointmentId: number,
    result: 'passed' | 'failed',
  ) => {
    if (!access.appointments) return;
    try {
      setError(null);
      await api.patch(`/admin/appointments/${appointmentId}`, {
        status: 'completed',
        result,
        notes: result === 'passed' ? 'Examen práctico de manejo aprobado en circuito.' : 'Examen práctico reprobado.',
      });
      setActionSuccess(
        result === 'passed'
          ? 'Examen práctico aprobado. El expediente avanzó a la etapa de entrega.'
          : 'Examen práctico calificado como reprobado.',
      );
      await loadAppointments();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al registrar el resultado');
    }
  };

  // Confirmar entrega y emisión de credencial
  const handleCompleteDelivery = async (procedureId: number) => {
    if (!access.licenses) return;
    try {
      setSubmittingDelivery(true);
      setError(null);
      await api.post(`/admin/procedures/${procedureId}/delivery/complete`, {
        notes: 'Credencial física emitida y entregada conforme a normativa municipal.',
      });
      setActionSuccess('¡Licencia de conducir emitida y entregada al ciudadano con éxito!');
      await loadLicenses();
      await loadProcedures();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la entrega');
    } finally {
      setSubmittingDelivery(false);
    }
  };

  // Revocación de licencia
  const handleRevokeLicense = async (e: FormEvent) => {
    e.preventDefault();
    if (!revokingLicense || !revokeReason.trim() || !access.licenses) return;
    try {
      setSubmittingRevoke(true);
      setError(null);
      await api.post(`/admin/licenses/${revokingLicense.id}/revoke`, {
        reason: revokeReason.trim(),
      });
      setActionSuccess(`Licencia N° ${revokingLicense.license_number} revocada.`);
      setRevokingLicense(null);
      setRevokeReason('');
      await loadLicenses();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo revocar la credencial');
    } finally {
      setSubmittingRevoke(false);
    }
  };

  const deliveryPendingProcedures = procedures.filter(
    (p) => p.current_step === 'delivery' && p.status !== 'completed',
  );

  return (
    <div className="container profile-container">
      {/* Cabecera del Panel */}
      <div className="admin-page-header">
        <div>
          <h1>Trámites y Operaciones Municipales</h1>
          <p>
            Expedientes, pagos y operaciones habilitadas para tu rol municipal.
          </p>
        </div>
        {activeTab !== 'pagos' && <div className="flex-row-gap">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <Refresh width={14} height={14} />
            <span>Actualizar</span>
          </button>
        </div>}
      </div>

      {actionSuccess && (
        <div className="alert alert-success spacing-mb-1" role="status">
          <Check width={18} height={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-danger spacing-mb-1" role="alert">
          <AlertTriangle width={18} height={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Navegación por pestañas */}
      <nav className="tabs-nav" aria-label="Secciones operativas">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'expedientes' ? 'active' : ''}`}
          data-tab="expedientes" aria-pressed={activeTab === 'expedientes'} onClick={handleTabChange}
        >
          <FileText width={16} height={16} />
          <span>Expedientes y Salud</span>
        </button>
        {access.payments && <button type="button" className={`tab-btn ${activeTab === 'pagos' ? 'active' : ''}`} data-tab="pagos" aria-pressed={activeTab === 'pagos'} onClick={handleTabChange}>Pagos y comprobantes</button>}
        {access.appointments && <button
          type="button"
          className={`tab-btn ${activeTab === 'turnos' ? 'active' : ''}`}
          data-tab="turnos" aria-pressed={activeTab === 'turnos'} onClick={handleTabChange}
        >
          <Calendar width={16} height={16} />
          <span>Examen Práctico y Turnos</span>
        </button>}
        {access.licenses && <button
          type="button"
          className={`tab-btn ${activeTab === 'licencias' ? 'active' : ''}`}
          data-tab="licencias" aria-pressed={activeTab === 'licencias'} onClick={handleTabChange}
        >
          <Award width={16} height={16} />
          <span>Entrega y Licencias</span>
        </button>}
      </nav>

      {activeTab === 'pagos' && access.payments && <AdminPayments />}

      {/* ================= PESTAÑA 1: EXPEDIENTES ================= */}
      {activeTab === 'expedientes' && (
        <div>
          <div className="card spacing-mb-1">
            <form onSubmit={handleSearchSubmit} className="search-bar-form">
              <div className="search-input-wrapper">
                <Search width={18} height={18} className="search-icon" />
                <input
                  type="search"
                  aria-label="Buscar expedientes"
                  className="search-input"
                  placeholder="Buscar por código (BAR-...), nombre, email o DNI..."
                  value={searchQuery}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex-row-gap">
                <select
                  aria-label="Estado del expediente"
                  className="filter-select"
                  value={statusFilter}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Todos los estados</option>
                  <option value="in_progress">En trámite</option>
                  <option value="under_review">En revisión</option>
                  <option value="completed">Completados</option>
                  <option value="rejected">Rechazados</option>
                </select>
                <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
                  <span>Buscar</span>
                </button>
              </div>
            </form>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Expediente</th>
                  <th>Ciudadano</th>
                  <th>Categoría</th>
                  <th>Etapa Actual</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center">
                      <p className="loading-text">Cargando expedientes municipales...</p>
                    </td>
                  </tr>
                ) : procedures.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center">
                      No se encontraron trámites con los filtros indicados.
                    </td>
                  </tr>
                ) : (
                  procedures.map((proc) => {
                    const healthDoc = proc.documents?.find(
                      (d) => d.kind === 'health_certificate',
                    );

                    return (
                      <tr key={proc.id}>
                        <td>
                          <strong>{proc.public_code}</strong>
                          <div className="subtext-xs">
                            {new Date(proc.created_at).toLocaleDateString('es-AR')}
                          </div>
                        </td>
                        <td>
                          <div>{proc.citizen?.name || 'Ciudadano/a'}</div>
                          <span className="badge badge-muted">
                            DNI {proc.citizen?.dni_masked}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-accent">Cat. {proc.license_category}</span>
                        </td>
                        <td>
                          <span className="badge badge-primary">
                            {proc.current_step === 'charlas' && 'Charlas Viales'}
                            {proc.current_step === 'health' && 'Salud / Médico'}
                            {proc.current_step === 'theory' && 'Examen Teórico'}
                            {proc.current_step === 'payment' && 'Pago del arancel'}
                            {proc.current_step === 'practical' && 'Examen Práctico'}
                            {proc.current_step === 'delivery' && 'Entrega'}
                            {proc.status === 'completed' && 'Finalizado'}
                            {!proc.current_step && proc.status !== 'completed' && 'Inicio'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              proc.status === 'completed'
                                ? 'badge-success'
                                : proc.status === 'rejected'
                                ? 'badge-danger'
                                : 'badge-primary'
                            }`}
                          >
                            {proc.status === 'in_progress' ? 'En trámite' : proc.status}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedProcedure(proc)}
                          >
                            <FileText width={14} height={14} />
                            <span>
                              {access.health && healthDoc?.status === 'pending'
                                ? 'Revisar Certificado'
                                : 'Detalle'}
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= PESTAÑA 2: TURNOS PRÁCTICOS ================= */}
      {activeTab === 'turnos' && (
        <div>
          <div className="flex-row-between spacing-mb-1">
            <div>
              <h3>Agenda de Evaluación Práctica en Circuito</h3>
              <p className="subtext-sm">
                Control de turnos, instructores asignados y carga de resultados de manejo.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowCreateSlotModal(true)}
            >
              <Plus width={16} height={16} />
              <span>Publicar Nuevo Cupo</span>
            </button>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Circuito</th>
                  <th>Instructor</th>
                  <th>Expediente / Ciudadano</th>
                  <th>Estado</th>
                  <th>Resultado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center">
                      <p className="loading-text">Cargando turnos prácticos...</p>
                    </td>
                  </tr>
                ) : appointments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center">
                      No hay turnos registrados en la agenda.
                    </td>
                  </tr>
                ) : (
                  appointments.map((app) => {
                    const dateObj = new Date(app.scheduled_at);

                    return (
                      <tr key={app.id}>
                        <td>
                          <strong>
                            {dateObj.toLocaleDateString('es-AR', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </strong>
                          <div className="subtext-xs">
                            {dateObj.toLocaleTimeString('es-AR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            hs
                          </div>
                        </td>
                        <td>
                          <div className="flex-row-gap">
                            <MapPin width={14} height={14} />
                            <span>{app.location}</span>
                          </div>
                        </td>
                        <td>{app.instructor || 'Inspector de turno'}</td>
                        <td>
                          {app.procedure_code ? (
                            <div>
                              <strong>{app.procedure_code}</strong>
                              <div className="subtext-xs">{app.citizen_name}</div>
                            </div>
                          ) : (
                            <span className="badge badge-muted">Sin postulante</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              app.status === 'booked'
                                ? 'badge-accent'
                                : app.status === 'completed'
                                ? 'badge-success'
                                : 'badge-muted'
                            }`}
                          >
                            {app.status === 'available' && 'Disponible'}
                            {app.status === 'booked' && 'Reservado'}
                            {app.status === 'completed' && 'Finalizado'}
                            {app.status === 'cancelled' && 'Cancelado'}
                          </span>
                        </td>
                        <td>
                          {app.result === 'passed' && (
                            <span className="badge badge-success">Aprobado</span>
                          )}
                          {app.result === 'failed' && (
                            <span className="badge badge-danger">Reprobado</span>
                          )}
                          {!app.result && <span className="subtext-xs">—</span>}
                        </td>
                        <td>
                          {app.status === 'booked' && !app.result && (
                            <div className="flex-row-gap">
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => handleGradePractical(app.id, 'passed')}
                              >
                                <Check width={14} height={14} />
                                <span>Aprobar</span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleGradePractical(app.id, 'failed')}
                              >
                                <X width={14} height={14} />
                                <span>Reprobar</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= PESTAÑA 3: LICENCIAS Y ENTREGA ================= */}
      {activeTab === 'licencias' && (
        <div>
          {/* Subsección: Pendientes de entrega */}
          <div className="card spacing-mb-2">
            <div className="card-header">
              <div>
                <h3 className="card-title">Trámites Listos para Confección y Entrega</h3>
                <p className="card-subtitle">
                  Expedientes con todas las etapas aprobadas esperando emisión de credencial física.
                </p>
              </div>
              <span className="badge badge-primary">
                {deliveryPendingProcedures.length} en espera
              </span>
            </div>

            {deliveryPendingProcedures.length === 0 ? (
              <p className="subtext-sm">
                No hay trámites con entrega pendiente en este momento.
              </p>
            ) : (
              <div className="table-container spacing-mt-1">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Titular</th>
                      <th>Categoría</th>
                      <th>Modalidad</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryPendingProcedures.map((proc) => {
                      const deliveryData = (proc.data as Record<string, unknown>) || {};
                      const method = deliveryData.delivery_method === 'postal' ? 'Domicilio' : 'Retiro en Sede';

                      return (
                        <tr key={proc.id}>
                          <td>
                            <strong>{proc.public_code}</strong>
                          </td>
                          <td>
                            <div>{proc.citizen?.name}</div>
                            <span className="badge badge-muted">
                              DNI {proc.citizen?.dni_masked}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-accent">Cat. {proc.license_category}</span>
                          </td>
                          <td>
                            <span className="badge badge-primary">{method}</span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={submittingDelivery}
                              onClick={() => handleCompleteDelivery(proc.id)}
                            >
                              <Award width={14} height={14} />
                              <span>Emitir y Entregar Credencial</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Subsección: Credenciales emitidas */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Registro Municipal de Credenciales Emitidas</h3>
                <p className="card-subtitle">
                  Credenciales municipales emitidas con token criptográfico QR.
                </p>
              </div>
              <span className="badge badge-success">{licenses.length} emitidas</span>
            </div>

            <div className="table-container spacing-mt-1">
              <table className="table">
                <thead>
                  <tr>
                    <th>N° Licencia</th>
                    <th>Titular</th>
                    <th>Categoría</th>
                    <th>Fecha de Emisión</th>
                    <th>Vencimiento</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {licenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center">
                        No hay licencias emitidas en el registro aún.
                      </td>
                    </tr>
                  ) : (
                    licenses.map((lic) => (
                      <tr key={lic.id}>
                        <td>
                          <strong>{lic.license_number}</strong>
                          <div className="subtext-xs">{lic.procedure_code}</div>
                        </td>
                        <td>
                          <div>{lic.citizen_name}</div>
                          <span className="subtext-xs">{lic.citizen_email}</span>
                        </td>
                        <td>
                          <span className="badge badge-accent">Cat. {lic.category}</span>
                        </td>
                        <td>{new Date(lic.issued_at).toLocaleDateString('es-AR')}</td>
                        <td>{new Date(lic.expires_at).toLocaleDateString('es-AR')}</td>
                        <td>
                          <span
                            className={`badge ${
                              lic.status === 'active' ? 'badge-success' : 'badge-danger'
                            }`}
                          >
                            {lic.status === 'active' ? 'Vigente' : 'Revocada'}
                          </span>
                        </td>
                        <td>
                          <div className="flex-row-gap">
                            <Link
                              to={`/verificar/${lic.license_number}`}
                              className="btn btn-secondary btn-sm"
                            >
                              <Shield width={14} height={14} />
                              <span>QR</span>
                            </Link>
                            {lic.status === 'active' && (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => setRevokingLicense(lic)}
                              >
                                <span>Revocar</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: DETALLE Y REVISIÓN DE EXPEDIENTE ================= */}
      {selectedProcedure && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Expediente {selectedProcedure.public_code}</h3>
                <p className="subtext-sm">
                  {selectedProcedure.citizen?.name} — DNI {selectedProcedure.citizen?.dni_masked}
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedProcedure(null)}
                aria-label="Cerrar modal"
              >
                <X width={20} height={20} />
              </button>
            </div>

            <div className="spacing-mb-1">
              <h4>Documentación Adjunta</h4>
              {selectedProcedure.documents?.length === 0 ? (
                <p className="subtext-sm spacing-mt-1">
                  El ciudadano no ha adjuntado documentos aún.
                </p>
              ) : (
                <div className="spacing-mt-1">
                  {selectedProcedure.documents?.map((doc) => (
                    <div key={doc.id} className="card spacing-mb-1">
                      <div className="flex-row-between">
                        <div>
                          <strong>
                            {doc.kind === 'health_certificate'
                              ? 'Certificado Médico Psicofísico'
                              : doc.kind}
                          </strong>
                          <div className="subtext-xs">
                            Archivo: {doc.original_name} ({Math.round(doc.size_bytes / 1024)} KB)
                          </div>
                        </div>
                        <span
                          className={`badge ${
                            doc.status === 'approved'
                              ? 'badge-success'
                              : doc.status === 'rejected'
                              ? 'badge-danger'
                              : 'badge-accent'
                          }`}
                        >
                          {doc.status === 'pending'
                            ? 'Pendiente de Revisión'
                            : doc.status === 'approved'
                            ? 'Aprobado'
                            : 'Rechazado'}
                        </span>
                      </div>

                      <div className="flex-row-gap spacing-mt-1">
                        <a
                          href={`/api/v1/admin/procedures/${selectedProcedure.id}/documents/${doc.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary btn-sm"
                        >
                          <FileText width={14} height={14} />
                          <span>Descargar Documento</span>
                        </a>

                        {access.health && doc.kind === 'health_certificate' && doc.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={submittingReview}
                              onClick={() => handleReviewDocument(doc, 'approve')}
                            >
                              <Check width={14} height={14} />
                              <span>Aprobar Certificado</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              disabled={submittingReview}
                              onClick={() => setReviewingDocId(doc.id)}
                            >
                              <X width={14} height={14} />
                              <span>Rechazar</span>
                            </button>
                          </>
                        )}
                      </div>

                      {/* Cuadro de rechazo con observaciones */}
                      {reviewingDocId === doc.id && (
                        <div className="spacing-mt-1">
                          <textarea
                            className="input-textarea"
                            placeholder="Motivo del rechazo o documentación faltante..."
                            value={rejectNotes}
                            onChange={(e) => setRejectNotes(e.target.value)}
                          />
                          <div className="flex-row-gap spacing-mt-1">
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              disabled={submittingReview || !rejectNotes.trim()}
                              onClick={() => handleReviewDocument(doc, 'reject')}
                            >
                              <span>Confirmar Rechazo</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setReviewingDocId(null)}
                            >
                              <span>Cancelar</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="spacing-mt-2 text-right">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedProcedure(null)}
              >
                <span>Cerrar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: PUBLICAR NUEVO CUPO PRÁCTICO ================= */}
      {showCreateSlotModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Nuevo Cupo de Examen Práctico</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowCreateSlotModal(false)}
                aria-label="Cerrar modal"
              >
                <X width={20} height={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSlot}>
              <div className="form-group spacing-mb-1">
                <label htmlFor="slotDateTime" className="form-label">
                  Fecha y Hora del Turno
                </label>
                <input
                  id="slotDateTime"
                  type="datetime-local"
                  required
                  className="input-text"
                  value={newSlotDateTime}
                  onChange={(e) => setNewSlotDateTime(e.target.value)}
                />
              </div>

              <div className="form-group spacing-mb-1">
                <label htmlFor="slotLocation" className="form-label">
                  Lugar / Circuito
                </label>
                <input
                  id="slotLocation"
                  type="text"
                  required
                  className="input-text"
                  value={newSlotLocation}
                  onChange={(e) => setNewSlotLocation(e.target.value)}
                />
              </div>

              <div className="form-group spacing-mb-1">
                <label htmlFor="slotInstructor" className="form-label">
                  Instructor Evaluador
                </label>
                <input
                  id="slotInstructor"
                  type="text"
                  className="input-text"
                  value={newSlotInstructor}
                  onChange={(e) => setNewSlotInstructor(e.target.value)}
                />
              </div>

              <div className="form-group spacing-mb-2">
                <label htmlFor="slotCapacity" className="form-label">
                  Capacidad de Postulantes
                </label>
                <input
                  id="slotCapacity"
                  type="number"
                  min="1"
                  max="10"
                  className="input-text"
                  value={newSlotCapacity}
                  onChange={(e) => setNewSlotCapacity(e.target.value)}
                />
              </div>

              <div className="flex-row-between">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateSlotModal(false)}
                >
                  <span>Cancelar</span>
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingSlot || !newSlotDateTime}
                >
                  <Plus width={16} height={16} />
                  <span>{submittingSlot ? 'Publicando...' : 'Publicar Cupo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: REVOCACIÓN DE LICENCIA ================= */}
      {revokingLicense && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">
                Revocar Licencia N° {revokingLicense.license_number}
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setRevokingLicense(null)}
                aria-label="Cerrar modal"
              >
                <X width={20} height={20} />
              </button>
            </div>

            <form onSubmit={handleRevokeLicense}>
              <div className="alert alert-danger spacing-mb-1">
                <AlertTriangle width={18} height={18} />
                <span>
                  Esta acción anulará la validez legal de la credencial y la marcará como revocada en
                  el portal de verificación pública con código QR.
                </span>
              </div>

              <div className="form-group spacing-mb-2">
                <label htmlFor="revokeReason" className="form-label">
                  Motivo o Resolución Municipal de Revocación
                </label>
                <textarea
                  id="revokeReason"
                  required
                  minLength={10}
                  className="input-textarea"
                  placeholder="Detallar resolución judicial, médica o administrativa..."
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                />
              </div>

              <div className="flex-row-between">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRevokingLicense(null)}
                >
                  <span>Cancelar</span>
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={submittingRevoke || revokeReason.trim().length < 10}
                >
                  <span>{submittingRevoke ? 'Revocando...' : 'Confirmar Revocación'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
