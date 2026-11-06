import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type MouseEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import type { DocumentItem, Payment as PaymentData, PaymentInstructions, Procedure } from '../../lib/types';
import { formatPaymentAmount, paymentState, receiptError, reusableReceipt } from '../../lib/payment';
import { FormError, RequiredFieldsNote, RequiredMark } from '../../components/FormFeedback';
import { ChevronLeft, Copy, FileText, Refresh, Upload } from '../../components/Icons';

/** Consulta un expediente propio antes de pedir instrucciones; no crea pagos ni referencias. */
async function loadPayment(procedureId: string, signal: AbortSignal) {
  const procedure = await api.get<Procedure>(`/procedures/${procedureId}`, undefined, signal);
  const hasPayment = procedure.steps.some((step) => step.code === 'payment');
  const instructions = hasPayment
    ? await api.get<PaymentInstructions>(`/procedures/${procedureId}/payment/instructions`, undefined, signal)
    : null;
  return { procedure, instructions };
}

/** La clave remonta el formulario al cambiar de usuario o expediente, sin conservar PII entre recursos. */
export function Payment() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  if (!id || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    return <div className="container profile-container"><FormError message="El identificador del trámite no es válido." /><Link to="/panel">Volver al panel</Link></div>;
  }
  return <PaymentDetails key={`${user?.id}:${id}`} procedureId={id} />;
}

/** Separa declarar una transferencia de su aprobación, que sigue siendo municipal. */
function PaymentDetails({ procedureId }: { procedureId: string }) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['citizen-payment', user?.id, procedureId],
    queryFn: ({ signal }) => loadPayment(procedureId, signal),
    retry: false, gcTime: 0, staleTime: 0, networkMode: 'always',
    refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  const [payerName, setPayerName] = useState('');
  const [payerDni, setPayerDni] = useState('');
  const [transferDate, setTransferDate] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState<DocumentItem | null>(null);
  const [receiptChanged, setReceiptChanged] = useState(false);
  const [result, setResult] = useState<PaymentData | null>(null);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'claiming'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  const submission = useRef<AbortController | null>(null);
  const outcomeHeading = useRef<HTMLHeadingElement>(null);
  const data = query.data;
  const info = data?.instructions;
  const status = result?.status ?? info?.status ?? '';
  const state = paymentState(status);
  const receipt = uploaded ?? (receiptChanged ? null : reusableReceipt(data?.procedure.documents ?? [], status));
  const step = data?.procedure.steps.find((item) => item.code === 'payment');
  const currentStep = data?.procedure.current_step === 'payment' && step?.status !== 'completed';
  const openProcedure = ['in_progress', 'under_review'].includes(data?.procedure.status ?? '');
  const canClaim = Boolean(info && currentStep && openProcedure && state.canClaim);
  const busy = phase !== 'idle';

  // No encadenamos una declaración con PII si la persona ya salió del formulario.
  useEffect(() => () => submission.current?.abort(), []);

  /** Reconsulta primero el servidor para resolver respuestas de envío inciertas. */
  const handleRefresh = () => {
    if (inFlight.current) return;
    setError(null);
    setNeedsRefresh(false);
    setResult(null);
    setUploaded(null);
    setReceiptChanged(false);
    void query.refetch();
  };

  const handleName = (event: ChangeEvent<HTMLInputElement>) => setPayerName(event.target.value);
  const handleDni = (event: ChangeEvent<HTMLInputElement>) => setPayerDni(event.target.value);
  const handleDate = (event: ChangeEvent<HTMLInputElement>) => setTransferDate(event.target.value);
  const handleNotes = (event: ChangeEvent<HTMLTextAreaElement>) => setNotes(event.target.value);

  /** No deja enviar una selección inválida ni reutiliza inadvertidamente el archivo anterior. */
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    const message = receiptError(selected);
    setError(message);
    setReceiptChanged(true);
    setUploaded(null);
    setFile(message ? null : selected);
    if (message) event.target.value = '';
  };

  /** Copiar es opcional: si el navegador lo rechaza, el dato queda visible y seleccionable. */
  const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    const value = event.currentTarget.dataset.value;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage('Dato copiado.');
    } catch {
      setCopyMessage('No pudimos copiar el dato. Seleccionalo y copialo manualmente.');
    }
  };

  /** Sube el comprobante una sola vez y luego declara sus datos; nunca aprueba ni avanza etapas. */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canClaim || busy || needsRefresh || inFlight.current) return;
    if (payerName.trim().length < 3 || !/^\d{7,8}$/.test(payerDni.trim())) {
      setError('Revisá el nombre del ordenante y su DNI de 7 u 8 dígitos, sin puntos.');
      return;
    }
    if (!file && !receipt) {
      setError('Adjuntá el comprobante de transferencia para continuar.');
      return;
    }
    inFlight.current = true;
    const controller = new AbortController();
    submission.current = controller;
    setError(null);
    let claimStarted = false;
    try {
      let document = receipt;
      if (file) {
        setPhase('uploading');
        const formData = new FormData();
        formData.append('kind', 'payment_receipt');
        formData.append('file', file);
        document = await api.upload<DocumentItem>(`/procedures/${procedureId}/documents`, formData, controller.signal);
        setUploaded(document);
        setFile(null);
      }
      if (!document) return;
      setPhase('claiming');
      claimStarted = true;
      const payment = await api.post<PaymentData>(`/procedures/${procedureId}/payment/claim`, {
        receipt_document_id: document.id,
        payer_name: payerName.trim(), payer_dni: payerDni.trim(),
        transfer_date: transferDate || null, notes: notes.trim() || null,
      }, controller.signal);
      setResult(payment);
      setPayerDni('');
      // El mismo encabezado permanece montado: anunciamos el resultado sin una recarga adicional.
      outcomeHeading.current?.focus({ preventScroll: true });
      outcomeHeading.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'No pudimos enviar el comprobante.');
      // Si el servidor alcanzó a confirmar pero se perdió la respuesta, no reenviamos a ciegas.
      if (claimStarted) setNeedsRefresh(true);
    } finally {
      inFlight.current = false;
      submission.current = null;
      setPhase('idle');
    }
  };

  return (
    <div className="container profile-container payment-container">
      <div className="card-header spacing-mb-1">
        <Link to="/panel" className="btn btn-secondary"><ChevronLeft width={16} height={16} />Volver al panel</Link>
        <button type="button" className="btn btn-secondary" onClick={handleRefresh} disabled={busy || query.isFetching}>
          <Refresh width={16} height={16} />Actualizar estado
        </button>
      </div>
      <div className="card profile-header-card">
        <div><h1>Pago del arancel</h1><p>Transferencia y revisión municipal. No ingreses datos de tarjetas.</p></div>
      </div>
      {error && <FormError message={error} />}
      {query.isFetching ? <div className="card" role="status">Consultando el estado del pago...</div> : query.isError ? (
        <FormError message={query.error instanceof Error ? query.error.message : 'No pudimos consultar el pago. Reintentá con Actualizar estado.'} />
      ) : data && !info ? (
        <div className="card"><h2>Este trámite no requiere pago</h2><p>Consultá sus etapas vigentes en el panel.</p></div>
      ) : info && data ? (
        <>
          <section className="card spacing-mb-1" aria-labelledby="payment-state">
            <p className="profile-item-label">Expediente {data.procedure.public_code}</p>
            <h2 id="payment-state" ref={outcomeHeading} tabIndex={-1} className="flow-heading">{state.title}</h2>
            <p role="status">{state.canClaim && !canClaim ? 'El pago no está habilitado en esta etapa o el trámite está cerrado. Consultá el panel antes de transferir.' : state.description}</p>
            {status === 'rejected' && data.procedure.payment?.review_notes && (
              <div className="alert alert-warning spacing-mt-1"><strong>Observación del pago:</strong> {data.procedure.payment.review_notes}</div>
            )}
            {needsRefresh && <p className="form-error spacing-mt-1">Actualizá el estado antes de volver a enviar. El comprobante podría haber sido recibido.</p>}
          </section>

          <section className="card spacing-mb-1" aria-labelledby="transfer-heading">
            <h2 id="transfer-heading">Datos de la transferencia</h2>
            <p className="payment-amount">{formatPaymentAmount(info.amount)}</p>
            <dl className="payment-details">
              <div><dt>Referencia del pago</dt><dd><span className="input-mono">{info.reference}</span><button type="button" className="btn btn-secondary btn-sm" data-value={info.reference} onClick={handleCopy}><Copy width={16} height={16} />Copiar referencia</button></dd></div>
              {info.alias && <div><dt>Alias</dt><dd><span>{info.alias}</span><button type="button" className="btn btn-secondary btn-sm" data-value={info.alias} onClick={handleCopy}><Copy width={16} height={16} />Copiar alias</button></dd></div>}
              {info.cbu && <div><dt>CBU</dt><dd><span className="input-mono">{info.cbu}</span><button type="button" className="btn btn-secondary btn-sm" data-value={info.cbu} onClick={handleCopy}><Copy width={16} height={16} />Copiar CBU</button></dd></div>}
              {info.holder && <div><dt>Titular</dt><dd>{info.holder}</dd></div>}
              {info.bank && <div><dt>Banco</dt><dd>{info.bank}</dd></div>}
            </dl>
            {copyMessage && <p role="status">{copyMessage}</p>}
            {canClaim && <p className="spacing-mt-1">{info.message}</p>}
            {canClaim && !info.alias && !info.cbu && <p className="alert alert-warning spacing-mt-1">No hagas una nueva transferencia hasta confirmar los datos con la oficina. Si ya transferiste con datos confirmados, podés informar tu pago.</p>}
            {!state.canClaim && <p className="spacing-mt-1">No vuelvas a transferir este arancel sin indicación municipal.</p>}
          </section>

          {canClaim ? (
            <section className="card" aria-labelledby="claim-heading">
              <h2 id="claim-heading">Informar una transferencia realizada</h2>
              <RequiredFieldsNote />
              <form onSubmit={handleSubmit} aria-busy={busy}>
                <fieldset className="payment-fields" disabled={busy || needsRefresh}>
                  <legend className="visually-hidden">Datos del ordenante y comprobante</legend>
                  <div className="form-group"><label htmlFor="payer-name" className="form-label">Nombre y apellido del ordenante<RequiredMark /></label><input id="payer-name" className="input" value={payerName} onChange={handleName} required minLength={3} maxLength={150} aria-describedby="payer-hint" /><p id="payer-hint" className="form-hint">Persona titular de la cuenta desde la que se transfirió. Puede ser distinta del solicitante.</p></div>
                  <div className="form-group"><label htmlFor="payer-dni" className="form-label">DNI del ordenante<RequiredMark /></label><input id="payer-dni" className="input" inputMode="numeric" pattern="[0-9]{7,8}" maxLength={8} value={payerDni} onChange={handleDni} required aria-describedby="payer-dni-hint" /><p id="payer-dni-hint" className="form-hint">7 u 8 números, sin puntos ni espacios.</p></div>
                  <div className="form-group"><label htmlFor="transfer-date" className="form-label">Fecha de transferencia (opcional)</label><input id="transfer-date" className="input" type="date" value={transferDate} onChange={handleDate} /></div>
                  <div className="form-group"><label htmlFor="payment-receipt" className="form-label"><Upload width={16} height={16} /> Comprobante de transferencia<RequiredMark /></label><input id="payment-receipt" type="file" className="form-input" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFile} required={!file && !receipt} aria-describedby="receipt-hint" /><p id="receipt-hint" className="form-hint">PDF, JPG, PNG o WEBP. Hasta 10 MB en el portal; el servidor valida el contenido real.</p></div>
                  {(file || receipt) && <p className="alert alert-info"><FileText width={18} height={18} />{file ? `Seleccionado: ${file.name}` : `Adjuntado al trámite: ${receipt?.original_name}. Falta enviar los datos del pago.`}</p>}
                  <div className="form-group"><label htmlFor="payment-notes" className="form-label">Observaciones (opcional)</label><textarea id="payment-notes" className="textarea" value={notes} onChange={handleNotes} maxLength={1000} /></div>
                  <button type="submit" className="btn btn-primary btn-block" disabled={!file && !receipt}>{phase === 'uploading' ? 'Subiendo comprobante...' : phase === 'claiming' ? 'Enviando datos del pago...' : 'Enviar comprobante para revisión'}</button>
                </fieldset>
              </form>
            </section>
          ) : state.canClaim && <div className="alert alert-info">Esta etapa todavía no está habilitada o el trámite está cerrado. Consultá el panel para continuar en orden.</div>}
        </>
      ) : null}
    </div>
  );
}
