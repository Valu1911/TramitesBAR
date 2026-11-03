/**
 * Vistas públicas del portal municipal: catálogo interactivo de trámites y
 * matriz de requisitos, verificador público de credenciales QR, políticas
 * normativas, ingreso, alta vecinal, confirmación de correo y recuperación.
 */

import {
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Markdown from "react-markdown";
import { api, ApiError } from "@/lib/api";
import {
  DOCUMENT_KIND_LABELS,
  STEP_LABELS,
  type MessageResponse,
  type Policy,
  type PolicySummary,
  type ProcedureType,
  type PublicLicense,
  type SessionPayload,
} from "@/lib/types";
import { useAuth } from "@/components/AuthContext";
import {
  ArrowRightIcon,
  CheckIcon,
  DocumentIcon,
  LockIcon,
  QrIcon,
  SearchIcon,
  ShieldIcon,
  UserIcon,
  WarningIcon,
} from "@/components/Icons";

/** Portada pública con catálogo de trámites y simulador de matriz normativa. */
export function HomePage() {
  const { session, isStaff } = useAuth();
  const [selectedTypeCode, setSelectedTypeCode] = useState<string>("nueva");
  const [selectedCategory, setSelectedCategory] = useState<string>("B");
  const [ageInput, setAgeInput] = useState<string>("25");

  const catalogQuery = useQuery({
    queryKey: ["catalog", "procedure-types"],
    queryFn: () => api.get<ProcedureType[]>("/catalog/procedure-types"),
  });

  const procedureTypes = useMemo(
    () => catalogQuery.data ?? [],
    [catalogQuery.data],
  );

  const activeProcedureType = useMemo(() => {
    if (!procedureTypes.length) return null;
    return (
      procedureTypes.find((item) => item.code === selectedTypeCode) ??
      procedureTypes[0]
    );
  }, [procedureTypes, selectedTypeCode]);

  const availableCategories = useMemo(() => {
    if (!activeProcedureType) return [];
    return activeProcedureType.matrix.map((row) => row.license_category);
  }, [activeProcedureType]);

  const activeMatrix = useMemo(() => {
    if (!activeProcedureType) return null;
    return (
      activeProcedureType.matrix.find(
        (row) => row.license_category === selectedCategory,
      ) ??
      activeProcedureType.matrix[0] ??
      null
    );
  }, [activeProcedureType, selectedCategory]);

  const parsedAge = Number(ageInput);
  const ageAllowed = useMemo(() => {
    if (!activeMatrix || Number.isNaN(parsedAge) || parsedAge <= 0) return true;
    if (parsedAge < activeMatrix.min_age) return false;
    if (activeMatrix.max_age !== null && parsedAge > activeMatrix.max_age) {
      return false;
    }
    return true;
  }, [activeMatrix, parsedAge]);

  function handleSelectTypeButton(event: MouseEvent<HTMLButtonElement>) {
    const code = event.currentTarget.dataset.code;
    if (!code) return;
    setSelectedTypeCode(code);
    const found = procedureTypes.find((item) => item.code === code);
    if (found && found.matrix.length > 0) {
      setSelectedCategory(found.matrix[0].license_category);
    }
  }

  function handleTypeSelectChange(event: ChangeEvent<HTMLSelectElement>) {
    const code = event.target.value;
    setSelectedTypeCode(code);
    const found = procedureTypes.find((item) => item.code === code);
    if (found && found.matrix.length > 0) {
      setSelectedCategory(found.matrix[0].license_category);
    }
  }

  function handleCategoryChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedCategory(event.target.value);
  }

  function handleAgeChange(event: ChangeEvent<HTMLInputElement>) {
    setAgeInput(event.target.value);
  }

  return (
    <div>
      <section className="hero-banner">
        <div className="hero-grid">
          <div>
            <span className="hero-eyebrow">
              <ShieldIcon size={15} />
              <span>Ventanilla Digital · Municipio de Baradero</span>
            </span>
            <h1 className="hero-title">
              Trámites de Licencias de Conducir claros, trazables y sin filas
              innecesarias
            </h1>
            <p className="hero-lead">
              Iniciá tu expediente, completá las charlas de seguridad vial,
              presentá tu aptitud psicofísica, aboná por transferencia bancaria
              conciliada y reservá tu turno práctico desde un único lugar.
            </p>
            <div className="hero-actions">
              {session.authenticated ? (
                <Link
                  to={isStaff ? "/admin" : "/panel"}
                  className="btn btn-light"
                >
                  <span>
                    {isStaff ? "Ir al backoffice municipal" : "Ir a mis trámites"}
                  </span>
                  <ArrowRightIcon size={17} />
                </Link>
              ) : (
                <>
                  <Link to="/registro" className="btn btn-light">
                    <span>Crear cuenta e iniciar trámite</span>
                    <ArrowRightIcon size={17} />
                  </Link>
                  <Link to="/ingresar" className="btn btn-outline-light">
                    <span>Ya tengo cuenta</span>
                  </Link>
                </>
              )}
              <Link to="/verificar" className="btn btn-outline-light">
                <QrIcon size={17} />
                <span>Verificar credencial QR</span>
              </Link>
            </div>
          </div>

          <div className="hero-card">
            <h2 className="hero-card-title">Garantías del circuito oficial</h2>
            <ul className="hero-stat-list">
              <li className="hero-stat-item">
                <CheckIcon size={18} />
                <span>
                  <strong>Secuencia transparente:</strong> cada etapa indica qué
                  documentación requiere y quién la revisa.
                </span>
              </li>
              <li className="hero-stat-item">
                <CheckIcon size={18} />
                <span>
                  <strong>Sin tarjetas ni intermediarios:</strong> pago único por
                  transferencia bancaria con referencia verificable.
                </span>
              </li>
              <li className="hero-stat-item">
                <CheckIcon size={18} />
                <span>
                  <strong>Credencial con código QR:</strong> validación pública
                  inmediata sin exponer tu número de DNI ni domicilio.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section-block" aria-labelledby="catalog-heading">
        <div className="section-header">
          <div>
            <span className="page-eyebrow">Catálogo municipal vigente</span>
            <h2 id="catalog-heading" className="page-title">
              Tipos de trámite disponibles
            </h2>
          </div>
          <p className="page-subtitle">
            Seleccioná un trámite para explorar sus etapas, aranceles y
            requisitos por categoría.
          </p>
        </div>

        {catalogQuery.isLoading && (
          <div className="card">
            <p className="muted-text">
              Consultando el catálogo oficial de trámites...
            </p>
          </div>
        )}

        {catalogQuery.isError && (
          <div className="alert alert-danger" role="alert">
            <WarningIcon size={18} />
            <div className="alert-content">
              No se pudo cargar el catálogo de trámites desde el servidor.
            </div>
          </div>
        )}

        {procedureTypes.length > 0 && (
          <div className="grid-3">
            {procedureTypes.map((procType) => {
              const isSelected = activeProcedureType?.code === procType.code;
              return (
                <article
                  key={procType.id}
                  className={
                    isSelected
                      ? "card card-interactive card-selected"
                      : "card card-interactive"
                  }
                >
                  <div className="card-header">
                    <div>
                      <h3 className="card-title">{procType.name}</h3>
                      <p className="card-subtitle">
                        {procType.short_description}
                      </p>
                    </div>
                    <span className="badge badge-info">
                      {procType.matrix.length} cat.
                    </span>
                  </div>
                  <p>{procType.description}</p>
                  <div className="card-footer">
                    <button
                      type="button"
                      className={
                        isSelected
                          ? "btn btn-primary btn-sm"
                          : "btn btn-secondary btn-sm"
                      }
                      data-code={procType.code}
                      onClick={handleSelectTypeButton}
                    >
                      {isSelected
                        ? "Explorando requisitos"
                        : "Ver matriz y arancel"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {activeProcedureType && (
        <section className="section-block" aria-labelledby="matrix-heading">
          <div className="card">
            <div className="page-header">
              <div>
                <span className="page-eyebrow">
                  Explorador de matriz normativa
                </span>
                <h2 id="matrix-heading" className="page-title">
                  Requisitos para {activeProcedureType.name}
                </h2>
                <p className="page-subtitle">
                  Consultá los pasos obligatorios, la edad requerida y el
                  arancel municipal según la categoría de vehículo.
                </p>
              </div>
            </div>

            <div className="form-row-3 bottom-gap-md">
              <div className="form-field">
                <label htmlFor="explorer-type" className="form-label">
                  Tipo de trámite
                </label>
                <select
                  id="explorer-type"
                  className="form-select"
                  value={activeProcedureType.code}
                  onChange={handleTypeSelectChange}
                >
                  {procedureTypes.map((pt) => (
                    <option key={pt.code} value={pt.code}>
                      {pt.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="explorer-category" className="form-label">
                  Categoría de licencia
                </label>
                <select
                  id="explorer-category"
                  className="form-select"
                  value={activeMatrix?.license_category ?? selectedCategory}
                  onChange={handleCategoryChange}
                >
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      Categoría {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="explorer-age" className="form-label">
                  Edad de la persona solicitante (años)
                </label>
                <input
                  id="explorer-age"
                  type="number"
                  min={16}
                  max={99}
                  className="form-input mono"
                  value={ageInput}
                  onChange={handleAgeChange}
                />
              </div>
            </div>

            {activeMatrix ? (
              <div className="form-stack">
                {!ageAllowed && (
                  <div className="alert alert-warning" role="status">
                    <WarningIcon size={18} />
                    <div className="alert-content">
                      Para la categoría {activeMatrix.license_category} en este
                      trámite la edad requerida es de {activeMatrix.min_age}
                      {activeMatrix.max_age
                        ? ` a ${activeMatrix.max_age}`
                        : " o más"}{" "}
                      años.
                    </div>
                  </div>
                )}

                <div className="kv-grid">
                  <div className="kv-item">
                    <span className="kv-label">Categoría seleccionada</span>
                    <span className="kv-value">
                      Clase {activeMatrix.license_category}
                    </span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-label">Arancel municipal</span>
                    <span className="kv-value mono">
                      ${activeMatrix.fee_amount} ARS
                    </span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-label">Vigencia máxima</span>
                    <span className="kv-value">
                      {activeMatrix.validity_years}{" "}
                      {activeMatrix.validity_years === 1 ? "año" : "años"}
                    </span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-label">Edad habilitada</span>
                    <span className="kv-value">
                      Desde {activeMatrix.min_age} años
                      {activeMatrix.max_age
                        ? ` hasta ${activeMatrix.max_age} años`
                        : ""}
                    </span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-label">Examen teórico</span>
                    <span className="kv-value">
                      {activeMatrix.theory_questions > 0
                        ? `${activeMatrix.theory_questions} preguntas (${Math.round(activeMatrix.theory_pass_ratio * 100)}% aprobación)`
                        : "No requerido"}
                    </span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-label">Prueba práctica</span>
                    <span className="kv-value">
                      {activeMatrix.requires_practical
                        ? "Obligatoria con turno"
                        : "Exenta"}
                    </span>
                  </div>
                </div>

                <div className="grid-2 top-gap-sm">
                  <div className="card">
                    <h3 className="card-title">
                      Secuencia obligatoria de etapas
                    </h3>
                    <p className="card-subtitle bottom-gap-md">
                      El expediente avanza en orden a medida que se aprueba cada
                      paso.
                    </p>
                    <ol className="form-stack">
                      {activeMatrix.steps.map((stepCode, index) => (
                        <li key={stepCode} className="kv-item">
                          <span className="kv-label">Paso {index + 1}</span>
                          <span className="kv-value">
                            {STEP_LABELS[stepCode] ?? stepCode}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="card">
                    <h3 className="card-title">Documentación respaldatoria</h3>
                    <p className="card-subtitle bottom-gap-md">
                      Archivos requeridos durante la tramitación digital.
                    </p>
                    {activeMatrix.required_documents.length > 0 ? (
                      <ul className="form-stack">
                        {activeMatrix.required_documents.map((docKind) => (
                          <li key={docKind} className="kv-item">
                            <span className="kv-label">Documento</span>
                            <span className="kv-value">
                              {DOCUMENT_KIND_LABELS[docKind] ?? docKind}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted-text">
                        No requiere carga adicional de documentos para esta
                        combinación.
                      </p>
                    )}

                    {activeMatrix.notes && (
                      <div className="alert alert-info top-gap-md">
                        <DocumentIcon size={18} />
                        <div className="alert-content">
                          {activeMatrix.notes}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="muted-text">
                Seleccioná una categoría para visualizar los requisitos.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/** Verificador público de credenciales mediante token o código QR. */
export function VerifyLicensePage() {
  const params = useParams<{ token?: string }>();
  const navigate = useNavigate();
  const [tokenDraft, setTokenDraft] = useState<string | null>(null);
  const activeToken = (params.token ?? "").trim();
  const tokenInput = tokenDraft ?? activeToken;

  const verifyQuery = useQuery({
    queryKey: ["public", "verify-license", activeToken],
    queryFn: () =>
      api.get<PublicLicense>(
        `/public/licenses/${encodeURIComponent(activeToken)}`,
      ),
    enabled: Boolean(activeToken),
    retry: false,
  });

  function handleTokenChange(event: ChangeEvent<HTMLInputElement>) {
    setTokenDraft(event.target.value);
  }

  function handleVerifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = tokenInput.trim();
    if (!cleaned) return;
    setTokenDraft(null);
    void navigate(`/verificar/${encodeURIComponent(cleaned)}`);
  }

  return (
    <div className="split-layout">
      <section className="card">
        <span className="page-eyebrow">Consulta pública sin datos sensibles</span>
        <h1 className="page-title">Verificación de credencial de conducir</h1>
        <p className="page-subtitle bottom-gap-md">
          Ingresá el código de verificación impreso o escaneado desde el QR de
          la credencial emitida por la Municipalidad de Baradero.
        </p>

        <form className="form-stack" onSubmit={handleVerifySubmit}>
          <div className="form-field">
            <label htmlFor="verify-token-input" className="form-label">
              Token de verificación pública
            </label>
            <input
              id="verify-token-input"
              type="text"
              className="form-input mono"
              placeholder="Ej.: qr_token de la credencial..."
              value={tokenInput}
              onChange={handleTokenChange}
              required
            />
          </div>
          <div className="btn-row">
            <button type="submit" className="btn btn-primary">
              <SearchIcon size={18} />
              <span>Verificar validez</span>
            </button>
          </div>
        </form>

        {verifyQuery.isLoading && (
          <p className="muted-text top-gap-md">
            Verificando firma y estado de la credencial...
          </p>
        )}

        {verifyQuery.isError && (
          <div className="alert alert-danger top-gap-md" role="alert">
            <WarningIcon size={18} />
            <div className="alert-content">
              {verifyQuery.error instanceof ApiError
                ? verifyQuery.error.message
                : "No se pudo verificar la credencial en este momento."}
            </div>
          </div>
        )}

        {verifyQuery.data && (
          <div className="license-card top-gap-md">
            <div className="license-card-header">
              <div>
                <span className="page-eyebrow">
                  {verifyQuery.data.municipality}
                </span>
                <h2 className="card-title">
                  {verifyQuery.data.found
                    ? `Credencial N.º ${verifyQuery.data.license_number}`
                    : "Credencial no registrada"}
                </h2>
              </div>
              {verifyQuery.data.category && (
                <span className="license-category-pill">
                  {verifyQuery.data.category}
                </span>
              )}
            </div>

            <div
              className={
                verifyQuery.data.found && verifyQuery.data.status === "active"
                  ? "alert alert-success"
                  : "alert alert-warning"
              }
            >
              {verifyQuery.data.found && verifyQuery.data.status === "active" ? (
                <CheckIcon size={18} />
              ) : (
                <WarningIcon size={18} />
              )}
              <div className="alert-content">
                <span className="alert-title">{verifyQuery.data.message}</span>
                <span>
                  Consulta certificada el{" "}
                  {new Date(verifyQuery.data.verified_at).toLocaleString("es-AR")}
                </span>
              </div>
            </div>

            {verifyQuery.data.found && (
              <div className="kv-grid">
                <div className="kv-item">
                  <span className="kv-label">Titular</span>
                  <span className="kv-value">
                    {verifyQuery.data.holder ?? "Reservado"}
                  </span>
                </div>
                <div className="kv-item">
                  <span className="kv-label">Estado registral</span>
                  <span className="kv-value">
                    {verifyQuery.data.status === "active"
                      ? "Vigente"
                      : verifyQuery.data.status === "revoked"
                        ? "Revocada"
                        : "Vencida"}
                  </span>
                </div>
                <div className="kv-item">
                  <span className="kv-label">Fecha de otorgamiento</span>
                  <span className="kv-value">
                    {verifyQuery.data.issued_at
                      ? new Date(verifyQuery.data.issued_at).toLocaleDateString(
                          "es-AR",
                        )
                      : "-"}
                  </span>
                </div>
                <div className="kv-item">
                  <span className="kv-label">Fecha de vencimiento</span>
                  <span className="kv-value">
                    {verifyQuery.data.expires_at
                      ? new Date(
                          verifyQuery.data.expires_at,
                        ).toLocaleDateString("es-AR")
                      : "-"}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <aside className="card">
        <h2 className="card-title">Privacidad en la vía pública</h2>
        <p className="top-gap-sm">
          El verificador público confirma si una licencia de conducir emitida
          por la Municipalidad de Baradero se encuentra vigente, vencida o
          revocada.
        </p>
        <p className="muted-text">
          Por resguardo de datos personales, esta consulta nunca expone el
          número de DNI, el domicilio particular ni el teléfono del titular.
        </p>
      </aside>
    </div>
  );
}

/** Página pública de políticas de privacidad y términos de uso versionados. */
export function PoliciesPage() {
  const params = useParams<{ slug?: string }>();
  const [selectedSlug, setSelectedSlug] = useState<string>(params.slug ?? "");

  const policiesQuery = useQuery({
    queryKey: ["policies", "list"],
    queryFn: () => api.get<PolicySummary[]>("/policies"),
  });

  const activeSlug = useMemo(() => {
    if (params.slug) return params.slug;
    if (selectedSlug) return selectedSlug;
    return policiesQuery.data?.[0]?.slug ?? "";
  }, [params.slug, selectedSlug, policiesQuery.data]);

  const policyDetailQuery = useQuery({
    queryKey: ["policies", "detail", activeSlug],
    queryFn: () => api.get<Policy>(`/policies/${activeSlug}`),
    enabled: Boolean(activeSlug),
  });

  function handleSelectPolicy(event: MouseEvent<HTMLButtonElement>) {
    const slug = event.currentTarget.dataset.slug;
    if (slug) {
      setSelectedSlug(slug);
    }
  }

  return (
    <div className="split-layout">
      <section className="card">
        <span className="page-eyebrow">Marco normativo y transparencia</span>
        <h1 className="page-title">Políticas vigentes del portal</h1>
        <p className="page-subtitle bottom-gap-md">
          Cada documento posee versión auditable y huella criptográfica SHA-256.
        </p>

        {policyDetailQuery.isLoading && (
          <p className="muted-text">Cargando documento normativo...</p>
        )}

        {policyDetailQuery.data && (
          <div>
            <div className="card-header">
              <div>
                <h2 className="card-title">{policyDetailQuery.data.title}</h2>
                <p className="card-subtitle">
                  Versión {policyDetailQuery.data.version} · Vigente desde{" "}
                  {new Date(
                    policyDetailQuery.data.effective_at,
                  ).toLocaleDateString("es-AR")}
                </p>
              </div>
              <span className="badge badge-info mono">
                SHA-256: {policyDetailQuery.data.content_hash.slice(0, 12)}
              </span>
            </div>
            <div className="markdown-body top-gap-md">
              <Markdown>{policyDetailQuery.data.body_md}</Markdown>
            </div>
          </div>
        )}
      </section>

      <aside className="card">
        <h2 className="card-title">Documentos publicados</h2>
        <div className="form-stack top-gap-sm">
          {(policiesQuery.data ?? []).map((pol) => (
            <button
              key={pol.slug}
              type="button"
              className={
                pol.slug === activeSlug
                  ? "btn btn-primary btn-block"
                  : "btn btn-secondary btn-block"
              }
              data-slug={pol.slug}
              onClick={handleSelectPolicy}
            >
              <DocumentIcon size={16} />
              <span>
                {pol.title} (v{pol.version})
              </span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

/** Pantalla de inicio de sesión con soporte para segundo factor TOTP/recuperación. */
export function LoginPage() {
  const { refetchSession } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleIdentifierChange(event: ChangeEvent<HTMLInputElement>) {
    setIdentifier(event.target.value);
  }

  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>) {
    setPassword(event.target.value);
  }

  function handleMfaCodeChange(event: ChangeEvent<HTMLInputElement>) {
    setMfaCode(event.target.value);
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = await api.post<SessionPayload>("/auth/login", {
        identifier: identifier.trim(),
        password,
        mfa_code: mfaRequired && mfaCode.trim() ? mfaCode.trim() : null,
      });
      await refetchSession();
      const target = payload.user.role === "citizen" ? "/panel" : "/admin";
      void navigate(target);
    } catch (err) {
      if (err instanceof ApiError && err.code === "mfa_required") {
        setMfaRequired(true);
        setErrorMsg(
          "Esta cuenta tiene segundo factor activo. Ingresá el código de tu aplicación autenticadora o un código de recuperación.",
        );
      } else if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("No se pudo iniciar sesión. Verificá tu conexión.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="split-layout">
      <section className="card">
        <span className="page-eyebrow">Acceso seguro al portal</span>
        <h1 className="page-title">Ingresar a TramitesBAR</h1>
        <p className="page-subtitle bottom-gap-md">
          Podés ingresar con tu correo electrónico o con tu número de DNI (sin
          puntos).
        </p>

        {errorMsg && (
          <div className="alert alert-danger" role="alert">
            <WarningIcon size={18} />
            <div className="alert-content">{errorMsg}</div>
          </div>
        )}

        <form className="form-stack" onSubmit={handleLoginSubmit}>
          <div className="form-field">
            <label htmlFor="login-identifier" className="form-label">
              Correo electrónico o DNI
            </label>
            <input
              id="login-identifier"
              type="text"
              autoComplete="username"
              className="form-input"
              value={identifier}
              onChange={handleIdentifierChange}
              placeholder="vecino@ejemplo.gob.ar o número de DNI"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="login-password" className="form-label">
              Contraseña
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className="form-input"
              value={password}
              onChange={handlePasswordChange}
              required
            />
          </div>

          {mfaRequired && (
            <div className="form-field">
              <label htmlFor="login-mfa" className="form-label">
                Código de segundo factor (TOTP o código de recuperación)
              </label>
              <input
                id="login-mfa"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="form-input mono"
                value={mfaCode}
                onChange={handleMfaCodeChange}
                placeholder="Código de 6 dígitos"
                required
              />
            </div>
          )}

          <div className="btn-row">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              <LockIcon size={18} />
              <span>
                {submitting
                  ? "Verificando credenciales..."
                  : mfaRequired
                    ? "Confirmar segundo factor"
                    : "Iniciar sesión"}
              </span>
            </button>
            <Link to="/recuperar" className="btn btn-ghost">
              Olvidé mi contraseña
            </Link>
          </div>
        </form>
      </section>

      <aside className="card">
        <h2 className="card-title">¿Todavía no tenés cuenta?</h2>
        <p className="top-gap-sm">
          Para iniciar un trámite de licencia de conducir necesitás registrar
          tus datos personales por única vez y validar tu casilla de correo.
        </p>
        <div className="btn-row top-gap-md">
          <Link to="/registro" className="btn btn-secondary">
            <UserIcon size={17} />
            <span>Crear cuenta vecinal</span>
          </Link>
          <Link to="/verificar-correo" className="btn btn-ghost">
            Confirmar correo con token
          </Link>
        </div>
      </aside>
    </div>
  );
}

/** Alta de cuenta ciudadana con validación de políticas obligatorias. */
export function RegisterPage() {
  const policiesQuery = useQuery({
    queryKey: ["policies", "list"],
    queryFn: () => api.get<PolicySummary[]>("/policies"),
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dni, setDni] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [locality, setLocality] = useState("Baradero");
  const [acceptedSlugs, setAcceptedSlugs] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function handleEmailChange(event: ChangeEvent<HTMLInputElement>) {
    setEmail(event.target.value);
  }
  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>) {
    setPassword(event.target.value);
  }
  function handleFirstNameChange(event: ChangeEvent<HTMLInputElement>) {
    setFirstName(event.target.value);
  }
  function handleLastNameChange(event: ChangeEvent<HTMLInputElement>) {
    setLastName(event.target.value);
  }
  function handleDniChange(event: ChangeEvent<HTMLInputElement>) {
    setDni(event.target.value);
  }
  function handleBirthDateChange(event: ChangeEvent<HTMLInputElement>) {
    setBirthDate(event.target.value);
  }
  function handlePhoneChange(event: ChangeEvent<HTMLInputElement>) {
    setPhone(event.target.value);
  }
  function handleAddressChange(event: ChangeEvent<HTMLInputElement>) {
    setAddress(event.target.value);
  }
  function handleLocalityChange(event: ChangeEvent<HTMLInputElement>) {
    setLocality(event.target.value);
  }

  function handlePolicyToggle(event: ChangeEvent<HTMLInputElement>) {
    const slug = event.target.value;
    const checked = event.target.checked;
    setAcceptedSlugs((prev) =>
      checked ? [...prev, slug] : prev.filter((item) => item !== slug),
    );
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanDni = dni.replace(/\D/g, "");
    if (cleanDni.length < 7 || cleanDni.length > 8) {
      setErrorMsg("El DNI debe contener entre 7 y 8 dígitos numéricos.");
      return;
    }
    if (password.length < 12) {
      setErrorMsg("La contraseña debe tener al menos 12 caracteres.");
      return;
    }
    if (acceptedSlugs.length === 0) {
      setErrorMsg("Debés aceptar las políticas obligatorias para registrarte.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post<MessageResponse>("/auth/register", {
        email: email.trim(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        dni: cleanDni,
        birth_date: birthDate,
        phone: phone.trim() || null,
        address: address.trim() || null,
        locality: locality.trim() || "Baradero",
        accepted_policies: acceptedSlugs,
      });
      setSuccessMsg(response.message);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo completar el registro.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="split-layout">
      <section className="card">
        <span className="page-eyebrow">Registro único de vecinos</span>
        <h1 className="page-title">Crear cuenta en TramitesBAR</h1>
        <p className="page-subtitle bottom-gap-md">
          Completá tus datos tal como figuran en tu Documento Nacional de
          Identidad.
        </p>

        {errorMsg && (
          <div className="alert alert-danger" role="alert">
            <WarningIcon size={18} />
            <div className="alert-content">{errorMsg}</div>
          </div>
        )}

        {successMsg ? (
          <div className="card">
            <div className="alert alert-success">
              <CheckIcon size={18} />
              <div className="alert-content">
                <span className="alert-title">Cuenta registrada</span>
                {successMsg}
              </div>
            </div>
            <div className="btn-row top-gap-md">
              <Link to="/verificar-correo" className="btn btn-primary">
                Ingresar código o token de verificación
              </Link>
              <Link to="/ingresar" className="btn btn-secondary">
                Ir a iniciar sesión
              </Link>
            </div>
          </div>
        ) : (
          <form className="form-stack" onSubmit={handleRegisterSubmit}>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="reg-first-name" className="form-label">
                  Nombre(s)
                </label>
                <input
                  id="reg-first-name"
                  type="text"
                  className="form-input"
                  value={firstName}
                  onChange={handleFirstNameChange}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="reg-last-name" className="form-label">
                  Apellido(s)
                </label>
                <input
                  id="reg-last-name"
                  type="text"
                  className="form-input"
                  value={lastName}
                  onChange={handleLastNameChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="reg-dni" className="form-label">
                  Número de DNI (7 u 8 dígitos)
                </label>
                <input
                  id="reg-dni"
                  type="text"
                  inputMode="numeric"
                  className="form-input mono"
                  value={dni}
                  onChange={handleDniChange}
                  placeholder="Sin puntos ni espacios"
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="reg-birth" className="form-label">
                  Fecha de nacimiento
                </label>
                <input
                  id="reg-birth"
                  type="date"
                  className="form-input"
                  value={birthDate}
                  onChange={handleBirthDateChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="reg-email" className="form-label">
                  Correo electrónico
                </label>
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  className="form-input"
                  value={email}
                  onChange={handleEmailChange}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="reg-phone" className="form-label">
                  Teléfono de contacto
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  className="form-input"
                  value={phone}
                  onChange={handlePhoneChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="reg-address" className="form-label">
                  Domicilio real
                </label>
                <input
                  id="reg-address"
                  type="text"
                  className="form-input"
                  value={address}
                  onChange={handleAddressChange}
                />
              </div>
              <div className="form-field">
                <label htmlFor="reg-locality" className="form-label">
                  Localidad
                </label>
                <input
                  id="reg-locality"
                  type="text"
                  className="form-input"
                  value={locality}
                  onChange={handleLocalityChange}
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="reg-password" className="form-label">
                Contraseña (mínimo 12 caracteres, mayúsculas, minúsculas y
                números)
              </label>
              <input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                className="form-input"
                value={password}
                onChange={handlePasswordChange}
                minLength={12}
                required
              />
            </div>

            <div className="card">
              <h2 className="card-title">Aceptación de políticas</h2>
              <p className="card-subtitle bottom-gap-md">
                Seleccioná las políticas obligatorias vigentes para continuar.
              </p>
              <div className="form-stack">
                {(policiesQuery.data ?? []).map((pol) => (
                  <label key={pol.slug} className="checkbox-row">
                    <input
                      type="checkbox"
                      className="checkbox-input"
                      value={pol.slug}
                      checked={acceptedSlugs.includes(pol.slug)}
                      onChange={handlePolicyToggle}
                    />
                    <span>
                      Acepto <strong>{pol.title}</strong> (versión {pol.version}
                      ) ·{" "}
                      <Link to={`/politicas/${pol.slug}`}>
                        Leer texto completo
                      </Link>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="btn-row">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                <UserIcon size={18} />
                <span>
                  {submitting ? "Creando cuenta..." : "Confirmar registro"}
                </span>
              </button>
              <Link to="/ingresar" className="btn btn-ghost">
                Ya tengo una cuenta
              </Link>
            </div>
          </form>
        )}
      </section>

      <aside className="card">
        <h2 className="card-title">Protección de tu identidad</h2>
        <p className="top-gap-sm">
          Tu número de DNI y tu teléfono se almacenan cifrados con AES-256-GCM.
          La búsqueda administrativa utiliza un índice ciego HMAC-SHA-256.
        </p>
      </aside>
    </div>
  );
}

/** Confirmación de casilla de correo electrónico mediante token de un solo uso. */
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const initialToken = searchParams.get("token") ?? "";
  const [token, setToken] = useState(initialToken);
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleTokenChange(event: ChangeEvent<HTMLInputElement>) {
    setToken(event.target.value);
  }

  async function handleVerifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token.trim() || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    setResultMsg(null);
    try {
      const response = await api.post<MessageResponse>("/auth/verify-email", {
        token: token.trim(),
      });
      setResultMsg(response.message);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo verificar el token.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <span className="page-eyebrow">Validación de contacto</span>
      <h1 className="page-title">Confirmar correo electrónico</h1>
      <p className="page-subtitle bottom-gap-md">
        Pegá el token recibido por correo para habilitar el inicio de trámites.
      </p>

      {errorMsg && (
        <div className="alert alert-danger" role="alert">
          <WarningIcon size={18} />
          <div className="alert-content">{errorMsg}</div>
        </div>
      )}

      {resultMsg && (
        <div className="alert alert-success" role="status">
          <CheckIcon size={18} />
          <div className="alert-content">
            <span className="alert-title">{resultMsg}</span>
            <Link to="/ingresar">Ir a iniciar sesión</Link>
          </div>
        </div>
      )}

      <form className="form-stack" onSubmit={handleVerifySubmit}>
        <div className="form-field">
          <label htmlFor="verify-email-token" className="form-label">
            Token de verificación
          </label>
          <input
            id="verify-email-token"
            type="text"
            className="form-input mono"
            value={token}
            onChange={handleTokenChange}
            placeholder="Token de verificación de correo..."
            required
          />
        </div>
        <div className="btn-row">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || token.trim().length < 10}
          >
            <CheckIcon size={18} />
            <span>{submitting ? "Verificando..." : "Confirmar correo"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

/** Solicitud de enlace de recuperación y restablecimiento de contraseña. */
export function PasswordResetPage() {
  const [searchParams] = useSearchParams();
  const initialToken = searchParams.get("token") ?? "";

  const [email, setEmail] = useState("");
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleEmailChange(event: ChangeEvent<HTMLInputElement>) {
    setEmail(event.target.value);
  }
  function handleTokenChange(event: ChangeEvent<HTMLInputElement>) {
    setToken(event.target.value);
  }
  function handleNewPasswordChange(event: ChangeEvent<HTMLInputElement>) {
    setNewPassword(event.target.value);
  }

  async function handleForgotSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const response = await api.post<MessageResponse>(
        "/auth/forgot-password",
        {
          email: email.trim(),
        },
      );
      setInfoMsg(response.message);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo procesar la solicitud.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token.trim() || newPassword.length < 12 || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const response = await api.post<MessageResponse>("/auth/reset-password", {
        token: token.trim(),
        new_password: newPassword,
      });
      setInfoMsg(response.message);
      setNewPassword("");
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "No se pudo restablecer la contraseña.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid-2">
      <section className="card">
        <span className="page-eyebrow">Paso 1 · Solicitar enlace</span>
        <h1 className="page-title">Recuperar acceso</h1>
        <p className="page-subtitle bottom-gap-md">
          Ingresá tu correo electrónico para recibir un token temporal de
          recuperación.
        </p>

        {errorMsg && (
          <div className="alert alert-danger" role="alert">
            <WarningIcon size={18} />
            <div className="alert-content">{errorMsg}</div>
          </div>
        )}

        {infoMsg && (
          <div className="alert alert-success" role="status">
            <CheckIcon size={18} />
            <div className="alert-content">{infoMsg}</div>
          </div>
        )}

        <form className="form-stack" onSubmit={handleForgotSubmit}>
          <div className="form-field">
            <label htmlFor="forgot-email" className="form-label">
              Correo electrónico registrado
            </label>
            <input
              id="forgot-email"
              type="email"
              className="form-input"
              value={email}
              onChange={handleEmailChange}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            Enviar instrucciones
          </button>
        </form>
      </section>

      <section className="card">
        <span className="page-eyebrow">Paso 2 · Definir nueva clave</span>
        <h2 className="page-title">Tengo un token de recuperación</h2>
        <p className="page-subtitle bottom-gap-md">
          Ingresá el token recibido y elegí una contraseña nueva de al menos 12
          caracteres.
        </p>

        <form className="form-stack" onSubmit={handleResetSubmit}>
          <div className="form-field">
            <label htmlFor="reset-token" className="form-label">
              Token de recuperación
            </label>
            <input
              id="reset-token"
              type="text"
              className="form-input mono"
              value={token}
              onChange={handleTokenChange}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="reset-password" className="form-label">
              Nueva contraseña (mínimo 12 caracteres)
            </label>
            <input
              id="reset-password"
              type="password"
              className="form-input"
              value={newPassword}
              onChange={handleNewPasswordChange}
              minLength={12}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            <LockIcon size={18} />
            <span>Actualizar contraseña</span>
          </button>
        </form>
      </section>
    </div>
  );
}
