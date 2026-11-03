/**
 * Panel del ciudadano: gestión de trámites, expediente secuencial por etapas,
 * credenciales emitidas con QR y configuración de seguridad de la cuenta.
 */

import {
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Markdown from "react-markdown";
import { api, ApiError, buildUrl } from "@/lib/api";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PROCEDURE_STATUS_LABELS,
  STEP_LABELS,
  STEP_STATUS_LABELS,
  type Appointment,
  type AttemptResult,
  type AttemptStart,
  type AttemptSummary,
  type DocumentItem,
  type LearningMaterial,
  type License,
  type MessageResponse,
  type MfaRecovery,
  type MfaSetup,
  type NotificationList,
  type PaymentInstructions,
  type Procedure,
  type ProcedureListItem,
  type ProcedureType,
  type SessionInfo,
} from "@/lib/types";
import { useAuth } from "@/components/AuthContext";
import { BariStepGuide } from "@/components/BariWidget";
import {
  ArrowRightIcon,
  BookIcon,
  CalendarIcon,
  CarIcon,
  CheckIcon,
  DocumentIcon,
  HeartIcon,
  LockIcon,
  PlusIcon,
  QrIcon,
  TransferIcon,
  UploadIcon,
  VideoIcon,
  WarningIcon,
} from "@/components/Icons";

function statusBadgeClass(status: string): string {
  if (
    status === "completed" ||
    status === "approved" ||
    status === "active" ||
    status === "passed"
  ) {
    return "badge badge-success";
  }
  if (
    status === "rejected" ||
    status === "cancelled" ||
    status === "revoked" ||
    status === "failed"
  ) {
    return "badge badge-danger";
  }
  if (
    status === "under_review" ||
    status === "submitted" ||
    status === "claimed" ||
    status === "pending_second" ||
    status === "scheduled" ||
    status === "booked"
  ) {
    return "badge badge-warning";
  }
  return "badge badge-info";
}

/** Tablero principal del vecino para iniciar y seguir expedientes. */
export function CitizenDashboardPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedType, setSelectedType] = useState("nueva");
  const [selectedCategory, setSelectedCategory] = useState("B");
  const [creating, setCreating] = useState(false);
  const [resending, setResending] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const proceduresQuery = useQuery({
    queryKey: ["procedures", "mine"],
    queryFn: () => api.get<ProcedureListItem[]>("/procedures/mine"),
  });

  const catalogQuery = useQuery({
    queryKey: ["catalog", "procedure-types"],
    queryFn: () => api.get<ProcedureType[]>("/catalog/procedure-types"),
  });

  const activeTypeObj = useMemo(() => {
    const list = catalogQuery.data ?? [];
    return (
      list.find((item) => item.code === selectedType) ?? list[0] ?? null
    );
  }, [catalogQuery.data, selectedType]);

  function handleTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    const code = event.target.value;
    setSelectedType(code);
    const found = (catalogQuery.data ?? []).find((item) => item.code === code);
    if (found && found.matrix.length > 0) {
      setSelectedCategory(found.matrix[0].license_category);
    }
  }

  function handleCategoryChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedCategory(event.target.value);
  }

  async function handleResendVerification() {
    if (resending) return;
    setResending(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const res = await api.post<MessageResponse>("/auth/resend-verification");
      setFeedbackMsg(res.message);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo reenviar el correo de verificación.",
      );
    } finally {
      setResending(false);
    }
  }

  async function handleCreateProcedure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const created = await api.post<Procedure>("/procedures", {
        procedure_type: activeTypeObj?.code ?? selectedType,
        license_category: selectedCategory,
        data: {},
      });
      await queryClient.invalidateQueries({ queryKey: ["procedures", "mine"] });
      void navigate(`/panel/tramites/${created.id}`);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo iniciar el trámite.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Ventanilla vecinal</span>
          <h1 className="page-title">Mis trámites de licencia</h1>
          <p className="page-subtitle">
            Consultá el avance de tus expedientes en curso o iniciá una nueva
            solicitud.
          </p>
        </div>
        <div className="btn-row">
          <Link to="/panel/licencias" className="btn btn-secondary">
            <QrIcon size={17} />
            <span>Mis credenciales</span>
          </Link>
          <Link to="/panel/seguridad" className="btn btn-secondary">
            <LockIcon size={17} />
            <span>Seguridad de la cuenta</span>
          </Link>
        </div>
      </div>

      {session.user && !session.user.email_verified && (
        <div className="alert alert-warning">
          <WarningIcon size={18} />
          <div className="alert-content">
            <span className="alert-title">
              Tu correo electrónico todavía no fue verificado
            </span>
            Para iniciar un expediente municipal primero debés confirmar tu
            casilla.
            <div className="btn-row top-gap-sm">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleResendVerification}
                disabled={resending}
              >
                {resending ? "Reenviando..." : "Reenviar correo de verificación"}
              </button>
              <Link to="/verificar-correo" className="btn btn-primary btn-sm">
                Ingresar token de verificación
              </Link>
            </div>
          </div>
        </div>
      )}

      {feedbackMsg && (
        <div className="alert alert-success" role="status">
          <CheckIcon size={18} />
          <div className="alert-content">{feedbackMsg}</div>
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-danger" role="alert">
          <WarningIcon size={18} />
          <div className="alert-content">{errorMsg}</div>
        </div>
      )}

      <div className="split-layout">
        <section className="form-stack">
          <h2 className="card-title">Expedientes registrados</h2>

          {proceduresQuery.isLoading && (
            <div className="card">
              <p className="muted-text">Cargando tus expedientes...</p>
            </div>
          )}

          {!proceduresQuery.isLoading &&
            (proceduresQuery.data ?? []).length === 0 && (
              <div className="empty-box">
                <DocumentIcon size={28} />
                <h3 className="card-title top-gap-sm">
                  No tenés trámites iniciados
                </h3>
                <p className="top-gap-sm">
                  Seleccioná el tipo de trámite y la categoría en el panel
                  lateral para abrir tu primer expediente digital.
                </p>
              </div>
            )}

          {(proceduresQuery.data ?? []).map((proc) => (
            <article key={proc.id} className="card card-interactive">
              <div className="card-header">
                <div>
                  <span className="page-eyebrow mono">{proc.public_code}</span>
                  <h3 className="card-title">
                    {proc.procedure_type_name} · Categoría{" "}
                    {proc.license_category}
                  </h3>
                </div>
                <span className={statusBadgeClass(proc.status)}>
                  {PROCEDURE_STATUS_LABELS[proc.status] ?? proc.status}
                </span>
              </div>

              <div className="kv-grid">
                <div className="kv-item">
                  <span className="kv-label">Etapa actual</span>
                  <span className="kv-value">
                    {proc.current_step
                      ? (STEP_LABELS[proc.current_step] ?? proc.current_step)
                      : "Revisión / Finalizado"}
                  </span>
                </div>
                <div className="kv-item">
                  <span className="kv-label">Fecha de inicio</span>
                  <span className="kv-value">
                    {new Date(proc.created_at).toLocaleDateString("es-AR")}
                  </span>
                </div>
              </div>

              <div className="card-footer">
                <Link
                  to={`/panel/tramites/${proc.id}`}
                  className="btn btn-primary btn-sm"
                >
                  <span>Abrir expediente</span>
                  <ArrowRightIcon size={16} />
                </Link>
              </div>
            </article>
          ))}
        </section>

        <aside className="card">
          <span className="page-eyebrow">Nueva solicitud</span>
          <h2 className="card-title">Iniciar trámite de licencia</h2>
          <p className="card-subtitle bottom-gap-md">
            El sistema creará tu expediente con las etapas correspondientes a la
            matriz municipal vigente.
          </p>

          <form className="form-stack" onSubmit={handleCreateProcedure}>
            <div className="form-field">
              <label htmlFor="new-proc-type" className="form-label">
                Tipo de trámite
              </label>
              <select
                id="new-proc-type"
                className="form-select"
                value={activeTypeObj?.code ?? selectedType}
                onChange={handleTypeChange}
              >
                {(catalogQuery.data ?? []).map((pt) => (
                  <option key={pt.code} value={pt.code}>
                    {pt.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="new-proc-cat" className="form-label">
                Categoría solicitada
              </label>
              <select
                id="new-proc-cat"
                className="form-select"
                value={selectedCategory}
                onChange={handleCategoryChange}
              >
                {(activeTypeObj?.matrix ?? []).map((m) => (
                  <option key={m.license_category} value={m.license_category}>
                    Clase {m.license_category} · Arancel ${m.fee_amount}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={creating}
            >
              <PlusIcon size={18} />
              <span>
                {creating ? "Abriendo expediente..." : "Confirmar e iniciar"}
              </span>
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}

/** Vista detallada de un expediente con sus 6 etapas secuenciales y guía Bari. */
export function ProcedureDetailPage() {
  const params = useParams<{ id: string }>();
  const procedureId = Number(params.id);
  const queryClient = useQueryClient();

  const [selectedStepCode, setSelectedStepCode] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Estado para charlas viales
  const [checkedMaterials, setCheckedMaterials] = useState<number[]>([]);

  // Estado para formulario de salud y carga de certificado
  const [healthFile, setHealthFile] = useState<File | null>(null);
  const [bloodType, setBloodType] = useState("O+");
  const [conditions, setConditions] = useState("");
  const [medications, setMedications] = useState("");
  const [allergies, setAllergies] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [declaresApt, setDeclaresApt] = useState(true);

  // Estado para examen teórico
  const [activeAttempt, setActiveAttempt] = useState<AttemptStart | null>(null);
  const [examAnswers, setExamAnswers] = useState<Record<number, number>>({});
  const [lastExamResult, setLastExamResult] = useState<AttemptResult | null>(
    null,
  );

  // Estado para pago por transferencia
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [selectedReceiptDocId, setSelectedReceiptDocId] = useState<number>(0);
  const [payerName, setPayerName] = useState("");
  const [payerDni, setPayerDni] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Estado para preferencia de entrega
  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "home">(
    "pickup",
  );
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  const procedureQuery = useQuery({
    queryKey: ["procedures", "detail", procedureId],
    queryFn: () => api.get<Procedure>(`/procedures/${procedureId}`),
    enabled: Number.isFinite(procedureId) && procedureId > 0,
  });

  const procedure = procedureQuery.data ?? null;
  const activeStepCode =
    selectedStepCode ??
    procedure?.current_step ??
    procedure?.steps[0]?.code ??
    null;

  const materialsQuery = useQuery({
    queryKey: ["catalog", "materials"],
    queryFn: () => api.get<LearningMaterial[]>("/catalog/materials"),
    enabled: activeStepCode === "charlas",
  });

  const paymentInstructionsQuery = useQuery({
    queryKey: ["procedures", "payment-instructions", procedureId],
    queryFn: () =>
      api.get<PaymentInstructions>(
        `/procedures/${procedureId}/payment/instructions`,
      ),
    enabled: Boolean(procedure) && activeStepCode === "payment",
  });

  const examAttemptsQuery = useQuery({
    queryKey: ["procedures", "exam-attempts", procedureId],
    queryFn: () =>
      api.get<AttemptSummary[]>(`/procedures/${procedureId}/exam/attempts`),
    enabled: Boolean(procedure) && activeStepCode === "theory",
  });

  const availableAppointmentsQuery = useQuery({
    queryKey: ["appointments", "available"],
    queryFn: () => api.get<Appointment[]>("/appointments/available"),
    enabled: Boolean(procedure) && activeStepCode === "practical",
  });

  const receiptDocuments = useMemo(() => {
    if (!procedure) return [];
    return procedure.documents.filter(
      (doc) => doc.kind === "payment_receipt" && doc.status !== "rejected",
    );
  }, [procedure]);

  async function refreshProcedure() {
    await queryClient.invalidateQueries({
      queryKey: ["procedures", "detail", procedureId],
    });
    await queryClient.invalidateQueries({ queryKey: ["procedures", "mine"] });
  }

  function handleSelectStepButton(event: MouseEvent<HTMLButtonElement>) {
    const code = event.currentTarget.dataset.stepCode;
    if (code) {
      setSelectedStepCode(code);
      setActionError(null);
      setActionSuccess(null);
    }
  }

  function handleMaterialCheckboxChange(event: ChangeEvent<HTMLInputElement>) {
    const id = Number(event.target.value);
    const checked = event.target.checked;
    setCheckedMaterials((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id),
    );
  }

  async function handleCompleteCharlas(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!procedure || busy) return;
    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await api.post<Procedure>(
        `/procedures/${procedure.id}/learning/complete`,
        { material_ids: checkedMaterials },
      );
      setSelectedStepCode(updated.current_step);
      setActionSuccess("Etapa de charlas de seguridad vial completada.");
      await refreshProcedure();
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "No se pudo completar la etapa de charlas.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleHealthFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setHealthFile(file);
  }

  async function handleUploadHealthCert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!procedure || !healthFile || busy) return;
    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const formData = new FormData();
      formData.append("kind", "health_certificate");
      formData.append("file", healthFile);
      await api.upload<DocumentItem>(
        `/procedures/${procedure.id}/documents`,
        formData,
      );
      setHealthFile(null);
      setActionSuccess(
        "Certificado de salud subido correctamente. Ahora enviá la declaración jurada.",
      );
      await refreshProcedure();
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "No se pudo subir el certificado de salud.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleBloodTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    setBloodType(event.target.value);
  }
  function handleConditionsChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setConditions(event.target.value);
  }
  function handleMedicationsChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setMedications(event.target.value);
  }
  function handleAllergiesChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setAllergies(event.target.value);
  }
  function handleEmergencyNameChange(event: ChangeEvent<HTMLInputElement>) {
    setEmergencyName(event.target.value);
  }
  function handleEmergencyPhoneChange(event: ChangeEvent<HTMLInputElement>) {
    setEmergencyPhone(event.target.value);
  }
  function handleDeclaresAptChange(event: ChangeEvent<HTMLInputElement>) {
    setDeclaresApt(event.target.checked);
  }

  async function handleSubmitHealthForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!procedure || busy) return;
    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.post<Procedure>(`/procedures/${procedure.id}/health`, {
        blood_type: bloodType,
        conditions: conditions.trim() || null,
        medications: medications.trim() || null,
        allergies: allergies.trim() || null,
        emergency_contact_name: emergencyName.trim(),
        emergency_contact_phone: emergencyPhone.trim(),
        declares_apt: declaresApt,
      });
      setActionSuccess(
        "Declaración de salud registrada. Quedó pendiente de revisión por el área médica municipal.",
      );
      await refreshProcedure();
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "No se pudo registrar la declaración de salud.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleStartExam() {
    if (!procedure || busy) return;
    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const attempt = await api.post<AttemptStart>(
        `/procedures/${procedure.id}/exam/start`,
      );
      setActiveAttempt(attempt);
      setExamAnswers({});
      setLastExamResult(null);
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "No se pudo iniciar el examen teórico.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleSelectExamAnswer(event: MouseEvent<HTMLButtonElement>) {
    const qIndex = Number(event.currentTarget.dataset.questionIndex);
    const optIndex = Number(event.currentTarget.dataset.optionIndex);
    if (Number.isNaN(qIndex) || Number.isNaN(optIndex)) return;
    setExamAnswers((prev) => ({ ...prev, [qIndex]: optIndex }));
  }

  async function handleSubmitExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!procedure || !activeAttempt || busy) return;
    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const answersArray = activeAttempt.questions.map((q) => ({
        index: q.index,
        selected_index: examAnswers[q.index] ?? 0,
      }));
      const result = await api.post<AttemptResult>(
        `/procedures/${procedure.id}/exam/${activeAttempt.attempt_id}/submit`,
        { answers: answersArray },
      );
      setLastExamResult(result);
      setActiveAttempt(null);
      await queryClient.invalidateQueries({
        queryKey: ["procedures", "exam-attempts", procedureId],
      });
      await refreshProcedure();
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "No se pudo entregar el examen teórico.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleReceiptFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setReceiptFile(file);
  }

  async function handleUploadReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!procedure || !receiptFile || busy) return;
    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const formData = new FormData();
      formData.append("kind", "payment_receipt");
      formData.append("file", receiptFile);
      const uploaded = await api.upload<DocumentItem>(
        `/procedures/${procedure.id}/documents`,
        formData,
      );
      setSelectedReceiptDocId(uploaded.id);
      setReceiptFile(null);
      setActionSuccess(
        "Comprobante cargado. Completá los datos de la transferencia para enviarlo a conciliación.",
      );
      await refreshProcedure();
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "No se pudo subir el comprobante de pago.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleReceiptDocSelectChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedReceiptDocId(Number(event.target.value));
  }
  function handlePayerNameChange(event: ChangeEvent<HTMLInputElement>) {
    setPayerName(event.target.value);
  }
  function handlePayerDniChange(event: ChangeEvent<HTMLInputElement>) {
    setPayerDni(event.target.value);
  }
  function handleTransferDateChange(event: ChangeEvent<HTMLInputElement>) {
    setTransferDate(event.target.value);
  }
  function handlePaymentNotesChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setPaymentNotes(event.target.value);
  }

  async function handleClaimPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!procedure || busy) return;
    const docId = selectedReceiptDocId || receiptDocuments[0]?.id || 0;
    if (!docId) {
      setActionError(
        "Primero subí el archivo del comprobante de transferencia.",
      );
      return;
    }
    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.post(`/procedures/${procedure.id}/payment/claim`, {
        receipt_document_id: docId,
        payer_name: payerName.trim(),
        payer_dni: payerDni.replace(/\D/g, ""),
        transfer_date: transferDate || null,
        notes: paymentNotes.trim() || null,
      });
      setActionSuccess(
        "Transferencia declarada. El área de Recaudación conciliará el comprobante.",
      );
      await refreshProcedure();
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "No se pudo declarar la transferencia.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleBookAppointment(event: MouseEvent<HTMLButtonElement>) {
    const appointmentId = Number(event.currentTarget.dataset.appointmentId);
    if (!procedure || !appointmentId || busy) return;
    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.post(`/procedures/${procedure.id}/appointment`, {
        appointment_id: appointmentId,
      });
      setActionSuccess("Turno de examen práctico reservado correctamente.");
      await queryClient.invalidateQueries({
        queryKey: ["appointments", "available"],
      });
      await refreshProcedure();
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "No se pudo reservar el turno práctico.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleDeliveryMethodChange(event: ChangeEvent<HTMLSelectElement>) {
    setDeliveryMethod(event.target.value as "pickup" | "home");
  }
  function handleDeliveryAddressChange(event: ChangeEvent<HTMLInputElement>) {
    setDeliveryAddress(event.target.value);
  }
  function handleDeliveryNotesChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setDeliveryNotes(event.target.value);
  }

  async function handleSubmitDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!procedure || busy) return;
    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.post(`/procedures/${procedure.id}/delivery`, {
        method: deliveryMethod,
        address: deliveryMethod === "home" ? deliveryAddress.trim() : null,
        notes: deliveryNotes.trim() || null,
      });
      setActionSuccess(
        "Preferencia de entrega registrada. El municipio confirmará la emisión de la credencial.",
      );
      await refreshProcedure();
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "No se pudo guardar la preferencia de entrega.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelProcedure() {
    if (!procedure || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await api.post<MessageResponse>(
        `/procedures/${procedure.id}/cancel`,
      );
      setActionSuccess(res.message);
      await refreshProcedure();
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "No se pudo cancelar el expediente.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (procedureQuery.isLoading) {
    return (
      <div className="card">
        <p className="muted-text">Cargando expediente municipal...</p>
      </div>
    );
  }

  if (procedureQuery.isError || !procedure) {
    return (
      <div className="alert alert-danger" role="alert">
        <WarningIcon size={18} />
        <div className="alert-content">
          No encontramos el expediente solicitado o no tenés permisos para
          consultarlo.
        </div>
      </div>
    );
  }

  const activeStepObj =
    procedure.steps.find((s) => s.code === activeStepCode) ?? null;

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow mono">
            Expediente {procedure.public_code}
          </span>
          <h1 className="page-title">
            {procedure.procedure_type.name} · Categoría{" "}
            {procedure.license_category}
          </h1>
          <p className="page-subtitle">
            Estado general:{" "}
            <strong>
              {PROCEDURE_STATUS_LABELS[procedure.status] ?? procedure.status}
            </strong>{" "}
            · Arancel matriz: <span className="mono">${procedure.matrix.fee_amount}</span>
          </p>
        </div>
        <div className="btn-row">
          <Link to="/panel" className="btn btn-secondary btn-sm">
            Volver a mis trámites
          </Link>
          {(procedure.status === "in_progress" ||
            procedure.status === "under_review") && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleCancelProcedure}
              disabled={busy}
            >
              Cancelar trámite
            </button>
          )}
        </div>
      </div>

      {procedure.rejection_reason && (
        <div className="alert alert-danger" role="alert">
          <WarningIcon size={18} />
          <div className="alert-content">
            <span className="alert-title">Expediente rechazado</span>
            Motivo informado: {procedure.rejection_reason}
          </div>
        </div>
      )}

      {actionError && (
        <div className="alert alert-danger" role="alert">
          <WarningIcon size={18} />
          <div className="alert-content">{actionError}</div>
        </div>
      )}

      {actionSuccess && (
        <div className="alert alert-success" role="status">
          <CheckIcon size={18} />
          <div className="alert-content">{actionSuccess}</div>
        </div>
      )}

      <ol className="stepper-list" aria-label="Etapas del trámite">
        {procedure.steps.map((step) => {
          const isCurrent = step.code === activeStepCode;
          let itemClass = "stepper-item";
          if (isCurrent) itemClass += " stepper-item-current";
          if (step.status === "completed") {
            itemClass += " stepper-item-completed";
          }
          if (step.status === "rejected") itemClass += " stepper-item-rejected";

          return (
            <li key={step.code}>
              <button
                type="button"
                className={itemClass}
                data-step-code={step.code}
                onClick={handleSelectStepButton}
              >
                <div className="stepper-top">
                  <span className="stepper-number">Paso {step.position}</span>
                  <span className={statusBadgeClass(step.status)}>
                    {STEP_STATUS_LABELS[step.status] ?? step.status}
                  </span>
                </div>
                <span className="stepper-label">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="split-layout">
        <section className="form-stack">
          {activeStepObj && (
            <div className="card">
              <div className="card-header">
                <div>
                  <span className="page-eyebrow">
                    Etapa {activeStepObj.position} de {procedure.steps.length}
                  </span>
                  <h2 className="card-title">{activeStepObj.label}</h2>
                </div>
                <span className={statusBadgeClass(activeStepObj.status)}>
                  {STEP_STATUS_LABELS[activeStepObj.status] ??
                    activeStepObj.status}
                </span>
              </div>

              {activeStepObj.notes && (
                <div className="alert alert-warning">
                  <WarningIcon size={18} />
                  <div className="alert-content">
                    <span className="alert-title">Observación municipal</span>
                    {activeStepObj.notes}
                  </div>
                </div>
              )}

              {/* ETAPA 1: CHARLAS DE SEGURIDAD VIAL */}
              {activeStepObj.code === "charlas" && (
                <div className="form-stack">
                  <div className="kv-item">
                    <div className="civic-ribbon-tag">
                      <VideoIcon size={18} />
                      <strong>Módulo audiovisual obligatorio</strong>
                    </div>
                    <video
                      className="bari-video-preview top-gap-sm"
                      src="/bari/video_capacitacion_real.webm"
                      poster="/bari/bari.png"
                      controls
                      playsInline
                    />
                  </div>

                  <form
                    className="form-stack"
                    onSubmit={handleCompleteCharlas}
                  >
                    {(materialsQuery.data ?? []).map((mat) => (
                      <div key={mat.id} className="card">
                        <h3 className="card-title">{mat.title}</h3>
                        <p className="card-subtitle">{mat.description}</p>
                        {mat.body_md && (
                          <div className="markdown-body top-gap-sm">
                            <Markdown>{mat.body_md}</Markdown>
                          </div>
                        )}
                        <label className="checkbox-row top-gap-sm">
                          <input
                            type="checkbox"
                            className="checkbox-input"
                            value={mat.id}
                            checked={checkedMaterials.includes(mat.id)}
                            onChange={handleMaterialCheckboxChange}
                          />
                          <span>
                            He visto y comprendido el módulo{" "}
                            <strong>{mat.title}</strong>
                          </span>
                        </label>
                      </div>
                    ))}

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={
                        busy ||
                        activeStepObj.status === "completed" ||
                        (materialsQuery.data ?? []).length === 0
                      }
                    >
                      <CheckIcon size={18} />
                      <span>
                        {activeStepObj.status === "completed"
                          ? "Etapa ya completada"
                          : "Confirmar charlas completadas"}
                      </span>
                    </button>
                  </form>
                </div>
              )}

              {/* ETAPA 2: FORMULARIO Y CERTIFICADO DE SALUD */}
              {activeStepObj.code === "health" && (
                <div className="form-stack">
                  <form
                    className="card form-stack"
                    onSubmit={handleUploadHealthCert}
                  >
                    <div className="civic-ribbon-tag">
                      <HeartIcon size={18} />
                      <strong>
                        1. Subir certificado de aptitud psicofísica (PDF, JPG o
                        PNG)
                      </strong>
                    </div>
                    <div className="form-field">
                      <label htmlFor="health-file-input" className="form-label">
                        Archivo del certificado médico firmado
                      </label>
                      <input
                        id="health-file-input"
                        type="file"
                        accept=".pdf,image/jpeg,image/png"
                        className="form-input"
                        onChange={handleHealthFileChange}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn btn-secondary"
                      disabled={busy || !healthFile}
                    >
                      <UploadIcon size={17} />
                      <span>Subir certificado médico</span>
                    </button>
                  </form>

                  <form
                    className="card form-stack"
                    onSubmit={handleSubmitHealthForm}
                  >
                    <strong>2. Declaración jurada de salud</strong>
                    <div className="form-row">
                      <div className="form-field">
                        <label htmlFor="health-blood" className="form-label">
                          Grupo y factor sanguíneo
                        </label>
                        <select
                          id="health-blood"
                          className="form-select"
                          value={bloodType}
                          onChange={handleBloodTypeChange}
                        >
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                        </select>
                      </div>
                      <div className="form-field">
                        <label
                          htmlFor="health-emerg-name"
                          className="form-label"
                        >
                          Contacto de emergencia (Nombre y apellido)
                        </label>
                        <input
                          id="health-emerg-name"
                          type="text"
                          className="form-input"
                          value={emergencyName}
                          onChange={handleEmergencyNameChange}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-field">
                      <label
                        htmlFor="health-emerg-phone"
                        className="form-label"
                      >
                        Teléfono de emergencia
                      </label>
                      <input
                        id="health-emerg-phone"
                        type="tel"
                        className="form-input"
                        value={emergencyPhone}
                        onChange={handleEmergencyPhoneChange}
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="health-conditions" className="form-label">
                        Antecedentes o afecciones médicas relevantes (opcional)
                      </label>
                      <textarea
                        id="health-conditions"
                        className="form-textarea"
                        value={conditions}
                        onChange={handleConditionsChange}
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-field">
                        <label htmlFor="health-meds" className="form-label">
                          Medicación habitual (opcional)
                        </label>
                        <textarea
                          id="health-meds"
                          className="form-textarea"
                          value={medications}
                          onChange={handleMedicationsChange}
                        />
                      </div>
                      <div className="form-field">
                        <label
                          htmlFor="health-allergies"
                          className="form-label"
                        >
                          Alergias conocidas (opcional)
                        </label>
                        <textarea
                          id="health-allergies"
                          className="form-textarea"
                          value={allergies}
                          onChange={handleAllergiesChange}
                        />
                      </div>
                    </div>

                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={declaresApt}
                        onChange={handleDeclaresAptChange}
                      />
                      <span>
                        Declaro bajo juramento que los datos consignados son
                        verídicos y corresponden a mi estado de salud actual.
                      </span>
                    </label>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={busy || activeStepObj.status === "completed"}
                    >
                      <CheckIcon size={18} />
                      <span>Enviar declaración y certificado a revisión</span>
                    </button>
                  </form>
                </div>
              )}

              {/* ETAPA 3: EXAMEN TEÓRICO */}
              {activeStepObj.code === "theory" && (
                <div className="form-stack">
                  <div className="kv-grid">
                    <div className="kv-item">
                      <span className="kv-label">Preguntas por intento</span>
                      <span className="kv-value">
                        {procedure.matrix.theory_questions}
                      </span>
                    </div>
                    <div className="kv-item">
                      <span className="kv-label">Mínimo de aprobación</span>
                      <span className="kv-value">
                        {Math.round(procedure.matrix.theory_pass_ratio * 100)}%
                      </span>
                    </div>
                    <div className="kv-item">
                      <span className="kv-label">Tiempo máximo</span>
                      <span className="kv-value">
                        {procedure.matrix.theory_minutes} minutos
                      </span>
                    </div>
                  </div>

                  {lastExamResult && (
                    <div
                      className={
                        lastExamResult.passed
                          ? "alert alert-success"
                          : "alert alert-warning"
                      }
                    >
                      <BookIcon size={18} />
                      <div className="alert-content">
                        <span className="alert-title">
                          {lastExamResult.passed
                            ? "Examen teórico aprobado"
                            : "Puntaje insuficiente en este intento"}
                        </span>
                        Puntaje obtenido: {lastExamResult.score} sobre{" "}
                        {lastExamResult.total} (mínimo requerido:{" "}
                        {lastExamResult.pass_score}).
                      </div>
                    </div>
                  )}

                  {!activeAttempt && activeStepObj.status !== "completed" && (
                    <div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleStartExam}
                        disabled={busy}
                      >
                        <BookIcon size={18} />
                        <span>Iniciar o retomar examen teórico</span>
                      </button>
                    </div>
                  )}

                  {activeAttempt && (
                    <form className="form-stack" onSubmit={handleSubmitExam}>
                      <div className="alert alert-info">
                        <BookIcon size={18} />
                        <div className="alert-content">
                          Intento #{activeAttempt.attempt_id} en curso · Vence a
                          las{" "}
                          {new Date(
                            activeAttempt.expires_at,
                          ).toLocaleTimeString("es-AR")}
                        </div>
                      </div>

                      {activeAttempt.questions.map((q) => (
                        <div key={q.index} className="question-card">
                          <strong>
                            Pregunta {q.index + 1}: {q.prompt}
                          </strong>
                          <div className="option-list">
                            {q.options.map((optText, optIdx) => {
                              const selected = examAnswers[q.index] === optIdx;
                              return (
                                <button
                                  key={`${q.index}-${optIdx}`}
                                  type="button"
                                  className={
                                    selected
                                      ? "option-button option-button-selected"
                                      : "option-button"
                                  }
                                  data-question-index={q.index}
                                  data-option-index={optIdx}
                                  onClick={handleSelectExamAnswer}
                                >
                                  <span className="mono">
                                    {String.fromCharCode(65 + optIdx)}.
                                  </span>
                                  <span>{optText}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={busy}
                      >
                        <CheckIcon size={18} />
                        <span>Entregar respuestas y calificar</span>
                      </button>
                    </form>
                  )}

                  {(examAttemptsQuery.data ?? []).length > 0 && (
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Intento</th>
                            <th>Estado</th>
                            <th>Puntaje</th>
                            <th>Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(examAttemptsQuery.data ?? []).map((att) => (
                            <tr key={att.id}>
                              <td className="mono">#{att.attempt_number}</td>
                              <td>
                                <span className={statusBadgeClass(att.status)}>
                                  {att.status}
                                </span>
                              </td>
                              <td className="mono">
                                {att.score !== null
                                  ? `${att.score}/${att.total}`
                                  : "-"}
                              </td>
                              <td>
                                {new Date(att.started_at).toLocaleString(
                                  "es-AR",
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ETAPA 4: PAGO DEL ARANCEL POR TRANSFERENCIA */}
              {activeStepObj.code === "payment" && (
                <div className="form-stack">
                  {paymentInstructionsQuery.data && (
                    <div className="card">
                      <div className="card-header">
                        <div>
                          <span className="page-eyebrow">
                            Datos bancarios oficiales
                          </span>
                          <h3 className="card-title">
                            Instrucciones para transferencia bancaria
                          </h3>
                        </div>
                        <span
                          className={statusBadgeClass(
                            paymentInstructionsQuery.data.status,
                          )}
                        >
                          {PAYMENT_STATUS_LABELS[
                            paymentInstructionsQuery.data.status
                          ] ?? paymentInstructionsQuery.data.status}
                        </span>
                      </div>
                      <p>{paymentInstructionsQuery.data.message}</p>
                      <div className="kv-grid top-gap-sm">
                        <div className="kv-item">
                          <span className="kv-label">
                            Referencia obligatoria
                          </span>
                          <span className="kv-value mono">
                            {paymentInstructionsQuery.data.reference}
                          </span>
                        </div>
                        <div className="kv-item">
                          <span className="kv-label">Monto exacto</span>
                          <span className="kv-value mono">
                            ${paymentInstructionsQuery.data.amount} ARS
                          </span>
                        </div>
                        <div className="kv-item">
                          <span className="kv-label">Alias bancario</span>
                          <span className="kv-value mono">
                            {paymentInstructionsQuery.data.alias ??
                              "Consultar en tesorería"}
                          </span>
                        </div>
                        <div className="kv-item">
                          <span className="kv-label">CBU</span>
                          <span className="kv-value mono">
                            {paymentInstructionsQuery.data.cbu ??
                              "Consultar en tesorería"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <form
                    className="card form-stack"
                    onSubmit={handleUploadReceipt}
                  >
                    <div className="civic-ribbon-tag">
                      <TransferIcon size={18} />
                      <strong>1. Subir comprobante de transferencia</strong>
                    </div>
                    <div className="form-field">
                      <label htmlFor="receipt-file" className="form-label">
                        Archivo del comprobante bancario (PDF, JPG o PNG)
                      </label>
                      <input
                        id="receipt-file"
                        type="file"
                        accept=".pdf,image/jpeg,image/png"
                        className="form-input"
                        onChange={handleReceiptFileChange}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn btn-secondary"
                      disabled={busy || !receiptFile}
                    >
                      <UploadIcon size={17} />
                      <span>Subir archivo de comprobante</span>
                    </button>
                  </form>

                  <form
                    className="card form-stack"
                    onSubmit={handleClaimPayment}
                  >
                    <strong>2. Declarar transferencia para conciliación</strong>
                    <div className="form-field">
                      <label htmlFor="claim-doc-id" className="form-label">
                        Comprobante adjunto
                      </label>
                      <select
                        id="claim-doc-id"
                        className="form-select"
                        value={
                          selectedReceiptDocId || receiptDocuments[0]?.id || 0
                        }
                        onChange={handleReceiptDocSelectChange}
                      >
                        <option value={0}>
                          Seleccioná el comprobante subido...
                        </option>
                        {receiptDocuments.map((doc) => (
                          <option key={doc.id} value={doc.id}>
                            #{doc.id} · {doc.original_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-row">
                      <div className="form-field">
                        <label htmlFor="claim-payer-name" className="form-label">
                          Nombre del titular de la cuenta ordenante
                        </label>
                        <input
                          id="claim-payer-name"
                          type="text"
                          className="form-input"
                          value={payerName}
                          onChange={handlePayerNameChange}
                          required
                        />
                      </div>
                      <div className="form-field">
                        <label htmlFor="claim-payer-dni" className="form-label">
                          DNI del ordenante (7 u 8 dígitos)
                        </label>
                        <input
                          id="claim-payer-dni"
                          type="text"
                          inputMode="numeric"
                          className="form-input mono"
                          value={payerDni}
                          onChange={handlePayerDniChange}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-field">
                        <label htmlFor="claim-date" className="form-label">
                          Fecha de transferencia
                        </label>
                        <input
                          id="claim-date"
                          type="date"
                          className="form-input"
                          value={transferDate}
                          onChange={handleTransferDateChange}
                        />
                      </div>
                      <div className="form-field">
                        <label htmlFor="claim-notes" className="form-label">
                          Observaciones o número de operación
                        </label>
                        <textarea
                          id="claim-notes"
                          className="form-textarea"
                          value={paymentNotes}
                          onChange={handlePaymentNotesChange}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={busy || activeStepObj.status === "completed"}
                    >
                      <CheckIcon size={18} />
                      <span>Informar pago para conciliación</span>
                    </button>
                  </form>
                </div>
              )}

              {/* ETAPA 5: TURNO DE EXAMEN PRÁCTICO */}
              {activeStepObj.code === "practical" && (
                <div className="form-stack">
                  <div className="civic-ribbon-tag">
                    <CarIcon size={18} />
                    <strong>
                      Selección de turno presencial para prueba de manejo
                    </strong>
                  </div>

                  {availableAppointmentsQuery.isLoading && (
                    <p className="muted-text">
                      Consultando cupos disponibles...
                    </p>
                  )}

                  {(availableAppointmentsQuery.data ?? []).length === 0 ? (
                    <div className="empty-box">
                      <CalendarIcon size={24} />
                      <p className="top-gap-sm">
                        No hay cupos libres cargados en este momento o ya tenés
                        un turno asignado.
                      </p>
                    </div>
                  ) : (
                    <div className="grid-2">
                      {(availableAppointmentsQuery.data ?? []).map((slot) => (
                        <div key={slot.id} className="card">
                          <span className="page-eyebrow">Cupo disponible</span>
                          <h3 className="card-title">
                            {new Date(slot.scheduled_at).toLocaleString(
                              "es-AR",
                            )}
                          </h3>
                          <p className="card-subtitle">{slot.location}</p>
                          {slot.instructor && (
                            <p className="muted-text top-gap-sm">
                              Examinador: {slot.instructor}
                            </p>
                          )}
                          <div className="card-footer">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              data-appointment-id={slot.id}
                              onClick={handleBookAppointment}
                              disabled={busy}
                            >
                              Reservar este turno
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ETAPA 6: ENTREGA DE LA CREDENCIAL */}
              {activeStepObj.code === "delivery" && (
                <div className="form-stack">
                  {procedure.license && (
                    <div className="alert alert-success">
                      <QrIcon size={18} />
                      <div className="alert-content">
                        <span className="alert-title">
                          Tu credencial N.º {procedure.license.license_number} ya
                          fue emitida
                        </span>
                        <Link to="/panel/licencias">
                          Ver mi credencial digital y código QR
                        </Link>
                      </div>
                    </div>
                  )}

                  <form
                    className="form-stack"
                    onSubmit={handleSubmitDelivery}
                  >
                    <div className="form-field">
                      <label htmlFor="delivery-method" className="form-label">
                        Modalidad de recepción de la licencia física
                      </label>
                      <select
                        id="delivery-method"
                        className="form-select"
                        value={deliveryMethod}
                        onChange={handleDeliveryMethodChange}
                      >
                        <option value="pickup">
                          Retiro presencial en Oficina de Licencias de Baradero
                        </option>
                        <option value="home">
                          Envío al domicilio declarado en Baradero
                        </option>
                      </select>
                    </div>

                    {deliveryMethod === "home" && (
                      <div className="form-field">
                        <label
                          htmlFor="delivery-address"
                          className="form-label"
                        >
                          Dirección completa en Baradero (calle, altura, entre
                          calles)
                        </label>
                        <input
                          id="delivery-address"
                          type="text"
                          className="form-input"
                          value={deliveryAddress}
                          onChange={handleDeliveryAddressChange}
                          required
                        />
                      </div>
                    )}

                    <div className="form-field">
                      <label htmlFor="delivery-notes" className="form-label">
                        Indicaciones adicionales de entrega (opcional)
                      </label>
                      <textarea
                        id="delivery-notes"
                        className="form-textarea"
                        value={deliveryNotes}
                        onChange={handleDeliveryNotesChange}
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={busy || activeStepObj.status === "completed"}
                    >
                      <CheckIcon size={18} />
                      <span>Confirmar modalidad de entrega</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* DOCUMENTOS SUBIDOS EN EL EXPEDIENTE */}
          <div className="card">
            <h2 className="card-title">Archivos adjuntos al expediente</h2>
            <p className="card-subtitle bottom-gap-md">
              Certificados y comprobantes asociados a este trámite.
            </p>
            {procedure.documents.length === 0 ? (
              <p className="muted-text">
                Todavía no se cargaron archivos en este expediente.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Archivo</th>
                      <th>Estado</th>
                      <th>Observaciones</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {procedure.documents.map((doc) => (
                      <tr key={doc.id}>
                        <td>{DOCUMENT_KIND_LABELS[doc.kind] ?? doc.kind}</td>
                        <td className="mono">{doc.original_name}</td>
                        <td>
                          <span className={statusBadgeClass(doc.status)}>
                            {DOCUMENT_STATUS_LABELS[doc.status] ?? doc.status}
                          </span>
                        </td>
                        <td>{doc.review_notes ?? "-"}</td>
                        <td>
                          <a
                            href={buildUrl(
                              `/procedures/${procedure.id}/documents/${doc.id}/download`,
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary btn-sm"
                          >
                            Ver archivo
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <BariStepGuide
          procedureCode={procedure.procedure_type.code}
          currentStepCode={activeStepCode}
        />
      </div>
    </div>
  );
}

/** Listado de credenciales emitidas del ciudadano con código QR en SVG. */
export function CitizenLicensesPage() {
  const licensesQuery = useQuery({
    queryKey: ["licenses", "mine"],
    queryFn: () => api.get<License[]>("/licenses/mine"),
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Credencial digital verificable</span>
          <h1 className="page-title">Mis licencias de conducir</h1>
          <p className="page-subtitle">
            Presentá el código QR ante controles de tránsito o verificá su
            estado registral en línea.
          </p>
        </div>
        <Link to="/panel" className="btn btn-secondary">
          Volver a mis trámites
        </Link>
      </div>

      {licensesQuery.isLoading && (
        <div className="card">
          <p className="muted-text">Consultando tus credenciales...</p>
        </div>
      )}

      {!licensesQuery.isLoading && (licensesQuery.data ?? []).length === 0 && (
        <div className="empty-box">
          <QrIcon size={28} />
          <h2 className="card-title top-gap-sm">
            Todavía no tenés credenciales emitidas
          </h2>
          <p className="top-gap-sm">
            Cuando completes todas las etapas de tu expediente y se confirme la
            entrega, tu licencia aparecerá en esta sección.
          </p>
        </div>
      )}

      <div className="grid-2">
        {(licensesQuery.data ?? []).map((lic) => (
          <article key={lic.id} className="license-card">
            <div className="license-card-header">
              <div>
                <span className="page-eyebrow">Municipalidad de Baradero</span>
                <h2 className="card-title">
                  Licencia N.º {lic.license_number}
                </h2>
              </div>
              <span className="license-category-pill">{lic.category}</span>
            </div>

            <div className="split-layout">
              <div className="kv-grid">
                <div className="kv-item">
                  <span className="kv-label">Estado</span>
                  <span className={statusBadgeClass(lic.status)}>
                    {lic.status === "active"
                      ? "Vigente"
                      : lic.status === "revoked"
                        ? "Revocada"
                        : "Vencida"}
                  </span>
                </div>
                <div className="kv-item">
                  <span className="kv-label">Emisión</span>
                  <span className="kv-value">
                    {new Date(lic.issued_at).toLocaleDateString("es-AR")}
                  </span>
                </div>
                <div className="kv-item">
                  <span className="kv-label">Vencimiento</span>
                  <span className="kv-value">
                    {new Date(lic.expires_at).toLocaleDateString("es-AR")}
                  </span>
                </div>
              </div>

              <div className="qr-frame">
                <img
                  src={buildUrl(`/licenses/${lic.id}/qr.svg`)}
                  alt={`Código QR de la licencia ${lic.license_number}`}
                  className="qr-image"
                />
              </div>
            </div>

            <div className="card-footer">
              <span className="mono muted-text">Token: {lic.qr_token}</span>
              <Link
                to={`/verificar/${encodeURIComponent(lic.qr_token)}`}
                className="btn btn-secondary btn-sm"
              >
                Abrir verificación pública
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/** Configuración de seguridad, sesiones activas, MFA y perfil de contacto. */
export function CitizenSecurityPage() {
  const { session, isCitizen, refetchSession } = useAuth();
  const queryClient = useQueryClient();

  // Perfil de contacto
  const [phone, setPhone] = useState(session.user?.profile?.phone ?? "");
  const [address, setAddress] = useState(session.user?.profile?.address ?? "");
  const [locality, setLocality] = useState(
    session.user?.profile?.locality ?? "Baradero",
  );

  // Contraseña
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Segundo factor MFA
  const [mfaSetup, setMfaSetup] = useState<MfaSetup | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sessionsQuery = useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: () => api.get<SessionInfo[]>("/auth/sessions"),
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications", "security-page"],
    queryFn: () => api.get<NotificationList>("/notifications", { limit: 20 }),
  });

  function handlePhoneChange(event: ChangeEvent<HTMLInputElement>) {
    setPhone(event.target.value);
  }
  function handleAddressChange(event: ChangeEvent<HTMLInputElement>) {
    setAddress(event.target.value);
  }
  function handleLocalityChange(event: ChangeEvent<HTMLInputElement>) {
    setLocality(event.target.value);
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await api.patch("/auth/me", {
        phone: phone.trim() || null,
        address: address.trim() || null,
        locality: locality.trim() || "Baradero",
      });
      await refetchSession();
      setStatusMsg("Datos de contacto actualizados correctamente.");
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo actualizar el perfil.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleCurrentPasswordChange(event: ChangeEvent<HTMLInputElement>) {
    setCurrentPassword(event.target.value);
  }
  function handleNewPasswordChange(event: ChangeEvent<HTMLInputElement>) {
    setNewPassword(event.target.value);
  }

  async function handleChangePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const res = await api.post<MessageResponse>("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setStatusMsg(res.message);
      setCurrentPassword("");
      setNewPassword("");
      await refetchSession();
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo cambiar la contraseña.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleStartMfaSetup() {
    if (busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const data = await api.post<MfaSetup>("/auth/mfa/setup");
      setMfaSetup(data);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo iniciar la configuración de MFA.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleMfaCodeChange(event: ChangeEvent<HTMLInputElement>) {
    setMfaCode(event.target.value);
  }

  async function handleEnableMfaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !mfaCode.trim()) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await api.post<MfaRecovery>("/auth/mfa/enable", {
        code: mfaCode.trim(),
      });
      setRecoveryCodes(res.recovery_codes);
      setMfaSetup(null);
      setMfaCode("");
      await refetchSession();
      setStatusMsg("Segundo factor TOTP activado en tu cuenta.");
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError ? err.message : "Código TOTP inválido.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleDisablePasswordChange(event: ChangeEvent<HTMLInputElement>) {
    setDisablePassword(event.target.value);
  }
  function handleDisableCodeChange(event: ChangeEvent<HTMLInputElement>) {
    setDisableCode(event.target.value);
  }

  async function handleDisableMfaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await api.post<MessageResponse>("/auth/mfa/disable", {
        password: disablePassword,
        code: disableCode.trim(),
      });
      setStatusMsg(res.message);
      setDisablePassword("");
      setDisableCode("");
      await refetchSession();
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError ? err.message : "No se pudo desactivar MFA.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeSession(event: MouseEvent<HTMLButtonElement>) {
    const id = Number(event.currentTarget.dataset.sessionId);
    if (!id || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await api.delete(`/auth/sessions/${id}`);
      await queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
      setStatusMsg("Sesión revocada correctamente.");
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo revocar la sesión.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkAllNotificationsRead() {
    try {
      await api.post("/notifications/read-all");
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      // Ignoramos error de red puntual.
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Resguardo de cuenta</span>
          <h1 className="page-title">Seguridad, sesiones y notificaciones</h1>
          <p className="page-subtitle">
            Administrá tu contraseña, el segundo factor de autenticación (TOTP)
            y los dispositivos con sesión abierta.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="alert alert-danger" role="alert">
          <WarningIcon size={18} />
          <div className="alert-content">{errorMsg}</div>
        </div>
      )}

      {statusMsg && (
        <div className="alert alert-success" role="status">
          <CheckIcon size={18} />
          <div className="alert-content">{statusMsg}</div>
        </div>
      )}

      <div className="grid-2 bottom-gap-md">
        {session.user?.profile && (
          <section className="card">
            <h2 className="card-title">Datos de contacto</h2>
            <p className="card-subtitle bottom-gap-md">
              DNI registrado:{" "}
              <strong className="mono">
                {session.user.profile.dni_masked}
              </strong>
            </p>
            <form className="form-stack" onSubmit={handleProfileSubmit}>
              <div className="form-field">
                <label htmlFor="sec-phone" className="form-label">
                  Teléfono
                </label>
                <input
                  id="sec-phone"
                  type="tel"
                  className="form-input"
                  value={phone}
                  onChange={handlePhoneChange}
                />
              </div>
              <div className="form-field">
                <label htmlFor="sec-address" className="form-label">
                  Domicilio
                </label>
                <input
                  id="sec-address"
                  type="text"
                  className="form-input"
                  value={address}
                  onChange={handleAddressChange}
                />
              </div>
              <div className="form-field">
                <label htmlFor="sec-locality" className="form-label">
                  Localidad
                </label>
                <input
                  id="sec-locality"
                  type="text"
                  className="form-input"
                  value={locality}
                  onChange={handleLocalityChange}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy}
              >
                Guardar datos de contacto
              </button>
            </form>
          </section>
        )}

        <section className="card">
          <h2 className="card-title">Cambiar contraseña</h2>
          <p className="card-subtitle bottom-gap-md">
            Al actualizar la contraseña se cerrarán todas las sesiones activas.
          </p>
          <form className="form-stack" onSubmit={handleChangePasswordSubmit}>
            <div className="form-field">
              <label htmlFor="sec-curr-pwd" className="form-label">
                Contraseña actual
              </label>
              <input
                id="sec-curr-pwd"
                type="password"
                className="form-input"
                value={currentPassword}
                onChange={handleCurrentPasswordChange}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="sec-new-pwd" className="form-label">
                Nueva contraseña (mínimo 12 caracteres)
              </label>
              <input
                id="sec-new-pwd"
                type="password"
                className="form-input"
                value={newPassword}
                onChange={handleNewPasswordChange}
                minLength={12}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <LockIcon size={17} />
              <span>Actualizar contraseña</span>
            </button>
          </form>
        </section>
      </div>

      <div className="grid-2 bottom-gap-md">
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Segundo factor (MFA TOTP)</h2>
              <p className="card-subtitle">
                Protección adicional mediante código temporal de 6 dígitos.
              </p>
            </div>
            <span
              className={
                session.user?.mfa_enabled
                  ? "badge badge-success"
                  : "badge badge-neutral"
              }
            >
              {session.user?.mfa_enabled ? "Activo" : "Inactivo"}
            </span>
          </div>

          {!session.user?.mfa_enabled && !mfaSetup && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleStartMfaSetup}
              disabled={busy}
            >
              Configurar aplicación autenticadora
            </button>
          )}

          {mfaSetup && (
            <form className="form-stack" onSubmit={handleEnableMfaSubmit}>
              <div className="kv-item">
                <span className="kv-label">Secreto Base32</span>
                <code className="kv-value mono">{mfaSetup.secret}</code>
              </div>
              <div className="form-field">
                <label htmlFor="sec-mfa-code" className="form-label">
                  Código de 6 dígitos
                </label>
                <input
                  id="sec-mfa-code"
                  type="text"
                  inputMode="numeric"
                  className="form-input mono"
                  value={mfaCode}
                  onChange={handleMfaCodeChange}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy}
              >
                Confirmar y activar MFA
              </button>
            </form>
          )}

          {recoveryCodes && (
            <div className="top-gap-md">
              <strong>Códigos de recuperación de un solo uso:</strong>
              <div className="kv-grid top-gap-sm">
                {recoveryCodes.map((rc) => (
                  <div key={rc} className="kv-item mono">
                    {rc}
                  </div>
                ))}
              </div>
            </div>
          )}

          {session.user?.mfa_enabled && isCitizen && (
            <form
              className="form-stack top-gap-md"
              onSubmit={handleDisableMfaSubmit}
            >
              <div className="form-field">
                <label htmlFor="disable-mfa-pwd" className="form-label">
                  Contraseña actual
                </label>
                <input
                  id="disable-mfa-pwd"
                  type="password"
                  className="form-input"
                  value={disablePassword}
                  onChange={handleDisablePasswordChange}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="disable-mfa-code" className="form-label">
                  Código TOTP o de recuperación
                </label>
                <input
                  id="disable-mfa-code"
                  type="text"
                  className="form-input mono"
                  value={disableCode}
                  onChange={handleDisableCodeChange}
                  required
                />
              </div>
              <button type="submit" className="btn btn-danger" disabled={busy}>
                Desactivar segundo factor
              </button>
            </form>
          )}
        </section>

        <section className="card">
          <h2 className="card-title">Sesiones activas</h2>
          <p className="card-subtitle bottom-gap-md">
            Dispositivos conectados actualmente a tu cuenta.
          </p>
          <div className="form-stack">
            {(sessionsQuery.data ?? []).map((sess) => (
              <div key={sess.id} className="kv-item">
                <div className="card-header">
                  <strong className="mono">
                    Sesión #{sess.id} · IP {sess.ip ?? "local"}
                  </strong>
                  {sess.is_current && (
                    <span className="badge badge-info">Sesión actual</span>
                  )}
                </div>
                <p className="muted-text">{sess.user_agent ?? "Navegador"}</p>
                {!sess.is_current && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm top-gap-sm"
                    data-session-id={sess.id}
                    onClick={handleRevokeSession}
                    disabled={busy}
                  >
                    Revocar sesión
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Historial de notificaciones</h2>
            <p className="card-subtitle">
              Mensajes oficiales enviados a tu cuenta.
            </p>
          </div>
          {(notificationsQuery.data?.unread ?? 0) > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleMarkAllNotificationsRead}
            >
              Marcar todas como leídas
            </button>
          )}
        </div>

        {(notificationsQuery.data?.items ?? []).length === 0 ? (
          <p className="muted-text">No hay notificaciones registradas.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Título</th>
                  <th>Detalle</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {(notificationsQuery.data?.items ?? []).map((n) => (
                  <tr key={n.id}>
                    <td>{new Date(n.created_at).toLocaleString("es-AR")}</td>
                    <td>
                      <strong>{n.title}</strong>
                    </td>
                    <td>{n.body}</td>
                    <td>
                      <span
                        className={
                          n.read_at
                            ? "badge badge-neutral"
                            : "badge badge-info"
                        }
                      >
                        {n.read_at ? "Leída" : "Sin leer"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
