import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type MouseEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { staffAccess } from '../../lib/staffAccess';
import { formatPaymentAmount, paymentState } from '../../lib/payment';
import type { Page, PaymentAdmin } from '../../lib/types';
import { FormError, RequiredFieldsNote, RequiredMark } from '../../components/FormFeedback';
import { FileText, Refresh } from '../../components/Icons';

const PAGE_SIZE = 25;
const queryOptions = { retry: false, gcTime: 0, networkMode: 'always' as const, refetchOnWindowFocus: false, refetchOnReconnect: false };

/** No monta consultas financieras si el rol o el enrolamiento no permiten operar. */
export function AdminPayments() {
  const { user, mfaEnrollmentRequired } = useAuth();
  if (!user || !staffAccess(user.role).payments || mfaEnrollmentRequired) return <p>Tu cuenta no puede operar pagos.</p>;
  return <PaymentQueue key={`${user.id}:${user.role}`} actorId={user.id} />;
}

/** Bandeja paginada; búsqueda y filtros son enviados a la API, no simulan resultados locales. */
function PaymentQueue({ actorId }: { actorId: number }) {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const list = useQuery({
    ...queryOptions, queryKey: ['staff-payments', actorId, status, search, offset],
    queryFn: ({ signal }) => api.get<Page<PaymentAdmin>>('/admin/payments', {
      status: status || undefined, q: search || undefined, limit: PAGE_SIZE, offset,
    }, signal),
  });
  const handleDraft = (event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value);
  /** Aplicar una búsqueda abre otra bandeja y cierra cualquier decisión anterior. */
  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(draft.trim()); setOffset(0); setSelectedId(null);
  };
  const handleStatus = (event: ChangeEvent<HTMLSelectElement>) => {
    setStatus(event.target.value); setOffset(0); setSelectedId(null);
  };
  const handleRefresh = () => { void list.refetch(); };
  const handlePrevious = () => { setOffset((current) => Math.max(0, current - PAGE_SIZE)); setSelectedId(null); };
  const handleNext = () => { setOffset((current) => current + PAGE_SIZE); setSelectedId(null); };
  const handleClose = () => setSelectedId(null);
  /** Resuelve el ID contra la página recibida; no toma rutas de redirección del cliente. */
  const handleOpen = (event: MouseEvent<HTMLButtonElement>) => {
    const id = Number(event.currentTarget.dataset.id);
    if (list.data?.items.some((item) => item.id === id)) setSelectedId(id);
  };

  return (
    <section aria-labelledby="payment-queue-heading">
      <div className="card-header spacing-mb-1">
        <div><h2 id="payment-queue-heading">Bandeja de pagos</h2><p>Verificá la transferencia antes de registrar una decisión.</p></div>
        <button type="button" className="btn btn-secondary" onClick={handleRefresh} disabled={list.isFetching}><Refresh width={16} height={16} />Actualizar pagos</button>
      </div>
      <form className="card spacing-mb-1" onSubmit={handleSearch}>
        <div className="form-group"><label htmlFor="payment-search" className="form-label">Buscar por referencia, expediente o correo</label><input id="payment-search" type="search" className="input" maxLength={80} value={draft} onChange={handleDraft} /></div>
        <div className="form-group"><label htmlFor="payment-filter" className="form-label">Estado del pago</label><select id="payment-filter" className="select" value={status} onChange={handleStatus}>
          <option value="">Todos los estados</option><option value="pending">Pendientes</option><option value="claimed">Comprobantes en revisión</option><option value="pending_second">Segundo control</option><option value="approved">Aprobados</option><option value="rejected">Observados</option><option value="refunded">Reintegrados</option>
        </select></div>
        <button type="submit" className="btn btn-primary" disabled={list.isFetching}>Buscar pagos</button>
      </form>
      {list.isFetching ? <p role="status">Consultando pagos...</p> : list.isError ? (
        <FormError message={list.error.message} />
      ) : list.data && list.data.items.length === 0 ? <p className="card" role="status">No hay pagos para los filtros elegidos.</p> : (
        <ul className="staff-payment-list">
          {list.data?.items.map((item) => (
            <li key={item.id} className="card">
              <div className="card-header"><div><h3>{item.reference}</h3><p>{item.procedure_code} · {item.citizen_name}</p></div><strong>{formatPaymentAmount(item.amount)}</strong></div>
              <p>{paymentState(item.status).title}</p>
              <button type="button" className="btn btn-secondary spacing-mt-1" data-id={item.id} onClick={handleOpen} aria-label={`Revisar pago ${item.reference}`}>Ver detalle y revisión</button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex-row-between spacing-mt-1" aria-label="Paginación de pagos">
        <button type="button" className="btn btn-secondary" onClick={handlePrevious} disabled={offset === 0 || list.isFetching}>Página anterior</button>
        <p>Página {Math.floor(offset / PAGE_SIZE) + 1}{list.data && !list.isError && !list.isFetching ? ` · ${list.data.total} pagos` : ''}</p>
        <button type="button" className="btn btn-secondary" onClick={handleNext} disabled={list.isFetching || !list.data || list.isError || offset + PAGE_SIZE >= list.data.total}>Página siguiente</button>
      </div>
      {selectedId !== null && <PaymentReview key={selectedId} paymentId={selectedId} actorId={actorId} onClose={handleClose} />}
    </section>
  );
}

/** Cada selección consulta detalle fresco y mantiene una decisión explícita, no optimista. */
function PaymentReview({ paymentId, actorId, onClose }: { paymentId: number; actorId: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const key = ['staff-payment', actorId, paymentId];
  const detail = useQuery({ ...queryOptions, queryKey: key,
    queryFn: ({ signal }) => api.get<PaymentAdmin>(`/admin/payments/${paymentId}`, undefined, signal),
  });
  const [decision, setDecision] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const payment = detail.data;
  const reviewable = payment?.status === 'claimed' || payment?.status === 'pending_second';
  const ownFirstReview = payment?.status === 'pending_second' && payment.reviewed_by === actorId;

  // El detalle es una sección, no un falso modal sin trampa de foco.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
    return () => controller.current?.abort();
  }, []);
  const handleDecision = (event: ChangeEvent<HTMLSelectElement>) => setDecision(event.target.value);
  const handleNotes = (event: ChangeEvent<HTMLTextAreaElement>) => setNotes(event.target.value);
  const handleRefresh = () => {
    if (inFlight.current) return;
    setNeedsRefresh(false); setError(null); setNotice(null); setDecision('');
    void detail.refetch();
  };

  /** Una respuesta incierta exige recargar; nunca se duplica una aprobación automáticamente. */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!payment || !reviewable || busy || inFlight.current || needsRefresh || (decision === 'approve' && ownFirstReview)) return;
    if (decision !== 'approve' && decision !== 'reject') return;
    if (decision === 'reject' && notes.trim().length < 5) {
      setError('Indicá un motivo de rechazo de al menos 5 caracteres.'); return;
    }
    inFlight.current = true;
    const requestController = new AbortController(); controller.current = requestController;
    setBusy(true); setError(null); setNotice(null);
    try {
      const updated = await api.post<PaymentAdmin>(`/admin/payments/${paymentId}/review`, {
        decision, notes: notes.trim() || null,
      }, requestController.signal);
      queryClient.setQueryData(key, updated);
      setDecision(''); setNotes('');
      setNotice(updated.status === 'pending_second' ? 'Primera aprobación registrada. El pago sigue pendiente de otro control.'
        : updated.status === 'approved' ? 'Pago aprobado por la Municipalidad.'
        : updated.status === 'rejected' ? 'Rechazo registrado con observaciones.' : 'Decisión recibida. Consultá el estado informado.');
      // Una recarga fallida del listado no convierte una decisión confirmada en un supuesto fallo.
      void queryClient.invalidateQueries({ queryKey: ['staff-payments', actorId] });
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
    } catch (cause) {
      if (requestController.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'No pudimos confirmar la revisión.');
      setNeedsRefresh(true);
    } finally {
      inFlight.current = false; controller.current = null; setBusy(false);
    }
  };

  return (
    <section className="card spacing-mt-1" aria-labelledby="payment-review-heading">
      <div className="card-header"><h2 id="payment-review-heading" ref={heading} tabIndex={-1} className="flow-heading">Detalle y revisión del pago</h2><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cerrar detalle</button></div>
      <button type="button" className="btn btn-secondary spacing-mb-1" onClick={handleRefresh} disabled={busy || detail.isFetching}>Actualizar detalle</button>
      {notice && <p className="alert alert-success" role="status">{notice}</p>}
      {error && <FormError message={error} />}
      {detail.isFetching ? <p role="status">Consultando detalle del pago...</p> : detail.isError ? <FormError message={detail.error.message} /> : payment ? <>
        <dl className="payment-details">
          <div><dt>Referencia</dt><dd>{payment.reference}</dd></div><div><dt>Expediente</dt><dd>{payment.procedure_code}</dd></div>
          <div><dt>Ciudadano</dt><dd>{payment.citizen_name}</dd></div><div><dt>Ordenante declarado</dt><dd>{payment.payer_name || 'No informado'}</dd></div>
          <div><dt>Importe del servidor</dt><dd>{formatPaymentAmount(payment.amount)}</dd></div><div><dt>Estado</dt><dd>{paymentState(payment.status).title}</dd></div>
          {payment.review_notes && <div><dt>Observaciones registradas</dt><dd>{payment.review_notes}</dd></div>}
        </dl>
        {payment.receipt_document_id ? <a className="btn btn-secondary spacing-mt-1" href={api.url(`/admin/procedures/${payment.procedure_id}/documents/${payment.receipt_document_id}/download`)} target="_blank" rel="noopener noreferrer"><FileText width={16} height={16} />Ver comprobante</a>
          : <p className="alert alert-warning spacing-mt-1">No hay comprobante vinculado. Verificá la transferencia y sus antecedentes antes de decidir.</p>}
        {ownFirstReview && <p className="alert alert-warning spacing-mt-1">Otra persona debe completar la segunda aprobación.</p>}
        {needsRefresh && <p className="form-error spacing-mt-1">Actualizá el detalle antes de reintentar. La decisión podría haber sido registrada.</p>}
        {reviewable ? <form onSubmit={handleSubmit} className="spacing-mt-1">
          <RequiredFieldsNote />
          <fieldset className="payment-fields" disabled={busy || needsRefresh}>
            <legend className="visually-hidden">Decisión municipal sobre el pago</legend>
            <div className="form-group"><label htmlFor="payment-decision" className="form-label">Decisión de revisión<RequiredMark /></label><select id="payment-decision" className="select" required value={decision} onChange={handleDecision}>
              <option value="">Elegí una decisión</option><option value="approve" disabled={ownFirstReview}>Aprobar la transferencia verificada</option><option value="reject">Rechazar con observaciones</option>
            </select></div>
            <div className="form-group"><label htmlFor="review-notes" className="form-label">{decision === 'reject' ? <>Motivo del rechazo<RequiredMark /></> : 'Observaciones (opcional)'}</label><textarea id="review-notes" className="textarea" value={notes} onChange={handleNotes} required={decision === 'reject'} minLength={decision === 'reject' ? 5 : undefined} maxLength={2000} /></div>
            <p className="spacing-mb-1">Confirmar registra una decisión municipal. Verificá monto, referencia y transferencia antes de aprobar.</p>
            <button type="submit" className={`btn ${decision === 'reject' ? 'btn-danger' : 'btn-primary'}`} disabled={!decision || (decision === 'approve' && ownFirstReview)}>{busy ? 'Registrando decisión...' : decision === 'reject' ? 'Confirmar rechazo' : 'Confirmar aprobación'}</button>
          </fieldset>
        </form> : <p className="spacing-mt-1">Este estado no admite una nueva revisión desde la consola.</p>}
      </> : null}
    </section>
  );
}
