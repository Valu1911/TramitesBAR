import { useState, useEffect, useLayoutEffect, useRef, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { RequiredMark, RequiredFieldsNote, FormError } from '../../components/FormFeedback';
import type { Procedure, ProcedureListItem, ProcedureType, Matrix, License } from '../../lib/types';
import {
  FileText,
  User as UserIcon,
  Shield,
  Clock,
  Check,
  AlertTriangle,
  Play,
  Activity,
  Award,
  ChevronRight,
} from '../../components/Icons';

function calculateAge(birthDateStr?: string | null): number | null {
  if (!birthDateStr) return null;
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

interface StageConfig {
  code: string;
  title: string;
  routeSuffix: string;
  description: string;
}

const STAGES: StageConfig[] = [
  {
    code: 'charlas',
    title: 'Charlas Viales',
    routeSuffix: 'charlas',
    description: 'Capacitación en seguridad vial obligatoria.',
  },
  {
    code: 'health',
    title: 'Salud',
    routeSuffix: 'salud',
    description: 'Declaración psicofísica y certificado médico.',
  },
  {
    code: 'theory',
    title: 'Examen Teórico',
    routeSuffix: 'examen',
    description: 'Evaluación teórica supervisada de tránsito.',
  },
  {
    code: 'payment',
    title: 'Pago del arancel',
    routeSuffix: 'pago',
    description: 'Transferencia, comprobante y revisión municipal.',
  },
  {
    code: 'practical',
    title: 'Examen Práctico',
    routeSuffix: 'turnos',
    description: 'Prueba de manejo en circuito municipal.',
  },
  {
    code: 'delivery',
    title: 'Entrega',
    routeSuffix: 'entrega',
    description: 'Emisión y retiro de credencial física.',
  },
];

export function CitizenPanel() {
  const { user } = useAuth();
  const firstName = user?.profile?.first_name || 'Vecino/a';
  const citizenAge = calculateAge(user?.profile?.birth_date);

  const [loading, setLoading] = useState(true);
  const [activeProcedure, setActiveProcedure] = useState<Procedure | null>(null);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [procedureTypes, setProcedureTypes] = useState<ProcedureType[]>([]);
  const [selectedType, setSelectedType] = useState<ProcedureType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const categoryHeading = useRef<HTMLHeadingElement>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const procedureHeading = useRef<HTMLHeadingElement>(null);
  const focusCreatedProcedure = useRef(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchProceduresData = async () => {
    try {
      setLoading(true);
      setLoadFailed(false);
      setErrorMsg(null);
      const [mine, licList] = await Promise.all([
        api.get<ProcedureListItem[]>('/procedures/mine'),
        api.get<License[]>('/licenses/mine'),
      ]);
      setLicenses(licList);

      const active = mine.find(
        (p) => p.status === 'in_progress' || p.status === 'under_review',
      );

      if (active) {
        const fullDetail = await api.get<Procedure>(`/procedures/${active.id}`);
        setActiveProcedure(fullDetail);
      } else {
        setActiveProcedure(null);
        const types = await api.get<ProcedureType[]>('/catalog/procedure-types');
        setProcedureTypes(types);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cargar expedientes';
      setErrorMsg(msg);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    Promise.all([
      api.get<ProcedureListItem[]>('/procedures/mine'),
      api.get<License[]>('/licenses/mine'),
    ])
      .then(async ([mine, licList]) => {
        if (!active) return;
        setLicenses(licList);

        const activeProc = mine.find(
          (p) => p.status === 'in_progress' || p.status === 'under_review',
        );

        if (activeProc) {
          const fullDetail = await api.get<Procedure>(`/procedures/${activeProc.id}`);
          if (active) setActiveProcedure(fullDetail);
        } else {
          if (active) setActiveProcedure(null);
          const types = await api.get<ProcedureType[]>('/catalog/procedure-types');
          if (active) {
            setProcedureTypes(types);
          }
        }
      })
      .catch((err) => {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Error al cargar expedientes';
          setErrorMsg(msg);
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // El foco sigue la elección explícita, nunca la carga inicial del catálogo.
  useLayoutEffect(() => {
    if (selectedType) {
      categoryHeading.current?.focus({ preventScroll: true });
      categoryHeading.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  }, [selectedType]);

  useLayoutEffect(() => {
    if (selectedCategory) {
      summaryHeading.current?.focus({ preventScroll: true });
      summaryHeading.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  }, [selectedCategory]);

  // Al confirmar, el botón desaparece: el foco pasa al expediente recién creado.
  useLayoutEffect(() => {
    if (activeProcedure && focusCreatedProcedure.current) {
      focusCreatedProcedure.current = false;
      procedureHeading.current?.focus({ preventScroll: true });
      procedureHeading.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  }, [activeProcedure]);

  /** Resuelve la opción desde el catálogo real y reinicia la categoría anterior. */
  const handleSelectType = (event: MouseEvent<HTMLButtonElement>) => {
    const procType = procedureTypes.find((item) => item.code === event.currentTarget.dataset.code);
    if (!procType) return;
    setSelectedType({ ...procType });
    setSelectedCategory('');
    setErrorMsg(null);
  };

  /** El resumen requiere una categoría elegida por el ciudadano. */
  const handleSelectCategory = (event: MouseEvent<HTMLButtonElement>) => {
    setSelectedCategory(event.currentTarget.dataset.category ?? '');
    setErrorMsg(null);
    // Si vuelve a elegir la misma categoría, el resumen ya está montado.
    summaryHeading.current?.focus({ preventScroll: true });
    summaryHeading.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
  };

  const handleCreateProcedure = async () => {
    if (!selectedType || !selectedMatrixItem || !isAgeValid || creating) return;
    try {
      setCreating(true);
      setErrorMsg(null);
      const created = await api.post<Procedure>('/procedures', {
        procedure_type: selectedType.code,
        license_category: selectedCategory,
        data: {},
      });
      setSuccessMsg('Expediente municipal iniciado correctamente.');
      focusCreatedProcedure.current = true;
      setActiveProcedure(created);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo iniciar el trámite';
      setErrorMsg(msg);
    } finally {
      setCreating(false);
    }
  };

  const selectedMatrixItem: Matrix | undefined = selectedType?.matrix.find(
    (m) => m.license_category === selectedCategory,
  );

  const isAgeValid =
    citizenAge === null ||
    selectedMatrixItem === undefined ||
    (citizenAge >= selectedMatrixItem.min_age &&
      (selectedMatrixItem.max_age === null || citizenAge <= selectedMatrixItem.max_age));

  return (
    <div className="container profile-container">
      {/* Cabecera del vecino */}
      <div className="card profile-header-card">
        <div className="flex-row-gap">
          <div className="profile-avatar">
            <UserIcon width={32} height={32} />
          </div>
          <div>
            <h1>¡Hola, {firstName}!</h1>
            <p>Portal de licencias de conducir de la Municipalidad de Baradero.</p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <FormError message={errorMsg} />
      )}

      {successMsg && (
        <div className="alert alert-success spacing-mb-1" role="status">
          <Check width={18} height={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Credenciales / Licencias Habilitadas */}
      {licenses.length > 0 && (
        <div className="card credential-banner">
          <div className="card-header">
            <div>
              <span className="profile-item-label">Credencial municipal</span>
              <h2 className="card-title">Credencial Digital Municipal</h2>
              <p className="card-subtitle">
                Emitida por la Municipalidad de Baradero. No reemplaza la licencia nacional oficial.
              </p>
            </div>
            <Award width={28} height={28} />
          </div>

          <div className="credential-grid">
            {licenses.map((lic) => (
              <div key={lic.id} className="credential-card">
                <div className="credential-header">
                  <div>
                    <span className="badge badge-success">
                      {lic.status === 'active' ? 'Vigente y Habilitada' : lic.status}
                    </span>
                    <h3 className="credential-category">Categoría {lic.category}</h3>
                  </div>
                  <span className="credential-number">N° {lic.license_number}</span>
                </div>

                <div className="credential-body">
                  <div>
                    <strong>Titular:</strong> {user?.profile?.first_name} {user?.profile?.last_name}
                  </div>
                  <div>
                    <strong>DNI:</strong> {user?.profile?.dni_masked}
                  </div>
                  <div>
                    <strong>Vencimiento:</strong> {new Date(lic.expires_at).toLocaleDateString('es-AR')}
                  </div>
                </div>

                <div className="credential-actions">
                  <Link to={`/verificar/${lic.qr_token}`} className="btn btn-outline">
                    <Shield width={16} height={16} />
                    <span>Verificar QR Oficial</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="card text-center">
          <p className="loading-text">Consultando expedientes municipales...</p>
        </div>
      ) : loadFailed ? (
        <div className="card">
          <p className="spacing-mb-1">No pudimos cargar tus datos. Reintentá para continuar.</p>
          <button type="button" className="btn btn-secondary" onClick={fetchProceduresData}>Reintentar</button>
        </div>
      ) : activeProcedure ? (
        /* ================= VISTA DE TRÁMITE ACTIVO ================= */
        <div className="card procedure-hero-card">
          <div className="card-header">
            <div>
              <span className="profile-item-label">Expediente Municipal</span>
              <h2 ref={procedureHeading} tabIndex={-1} className="card-title flow-heading">
                {activeProcedure.procedure_type.name} — Categoría {activeProcedure.license_category}
              </h2>
              <p className="card-subtitle">
                Iniciado el {new Date(activeProcedure.created_at).toLocaleDateString('es-AR')}
              </p>
            </div>
            <div className="text-right">
              <span className="procedure-code-highlight">{activeProcedure.public_code}</span>
              <div>
                <span className="badge badge-primary spacing-mt-1">
                  {activeProcedure.status === 'in_progress' ? 'En trámite' : 'En revisión'}
                </span>
              </div>
            </div>
          </div>

          {/* Stepper visual de etapas */}
          <div className="stepper-container">
            <ol className="stepper-list">
              {[...activeProcedure.steps].sort((a, b) => a.position - b.position).map((stepObj, idx) => {
                // Cada matriz puede omitir o reordenar etapas; no mostramos un circuito ficticio.
                const stage = STAGES.find((item) => item.code === stepObj.code) ?? { code: stepObj.code, title: stepObj.label };
                const isCompleted = stepObj?.status === 'completed' || !!stepObj?.completed_at;
                const isCurrent =
                  activeProcedure.current_step === stage.code ||
                  (!isCompleted && stepObj?.status === 'in_progress');

                let stateClass = 'pending';
                if (isCompleted) stateClass = 'completed';
                else if (isCurrent) stateClass = 'in_progress';

                return (
                  <li key={stage.code} className={`stepper-item ${stateClass}`}>
                    <div className="stepper-icon-box">
                      {isCompleted ? (
                        <Check width={18} height={18} />
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>
                    <span className="stepper-step-title">{stage.title}</span>
                    <span
                      className={`badge stepper-step-badge ${
                        isCompleted
                          ? 'badge-success'
                          : isCurrent
                          ? 'badge-accent'
                          : 'badge-muted'
                      }`}
                    >
                      {isCompleted
                        ? 'Completado'
                        : isCurrent
                        ? 'En curso'
                        : 'Pendiente'}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Siguiente paso activo y botón de acción */}
          <div className="procedure-next-step-box">
            <div className="procedure-next-step-info">
              {activeProcedure.current_step === 'charlas' && <Play width={24} height={24} />}
              {activeProcedure.current_step === 'health' && <Activity width={24} height={24} />}
              {activeProcedure.current_step === 'theory' && <Award width={24} height={24} />}
              {activeProcedure.current_step !== 'charlas' &&
                activeProcedure.current_step !== 'health' &&
                activeProcedure.current_step !== 'theory' && <Clock width={24} height={24} />}
              <div className="procedure-next-step-text">
                <h4>
                  {activeProcedure.current_step === 'charlas' && 'Etapa: Charlas de Seguridad Vial'}
                  {activeProcedure.current_step === 'health' && 'Etapa: Salud y Declaración Médica'}
                  {activeProcedure.current_step === 'theory' && 'Etapa: Examen Teórico Supervisado'}
                  {activeProcedure.current_step === 'payment' && 'Etapa: Pago del arancel'}
                  {activeProcedure.current_step === 'practical' && 'Etapa: Examen Práctico en Circuito'}
                  {activeProcedure.current_step === 'delivery' && 'Etapa: Entrega de Licencia'}
                  {!['charlas', 'health', 'theory', 'payment', 'practical', 'delivery'].includes(
                    activeProcedure.current_step ?? '',
                  ) && 'Trámite en proceso municipal'}
                </h4>
                <p>
                  {activeProcedure.current_step === 'charlas' &&
                    'Visualizá los módulos obligatorios de seguridad vial para avanzar.'}
                  {activeProcedure.current_step === 'health' &&
                    'Completá la declaración jurada y adjuntá tu certificado médico habilitante.'}
                  {activeProcedure.current_step === 'theory' &&
                    'Rendí la evaluación teórica en línea con supervisión de escritorio y cámara.'}
                  {activeProcedure.current_step === 'payment' &&
                    'Consultá la referencia, informá tu transferencia y seguí la revisión municipal.'}
                  {activeProcedure.current_step === 'practical' &&
                    'Coordiná tu turno práctico en el autódromo municipal con los inspectores.'}
                  {activeProcedure.current_step === 'delivery' &&
                    'Tu licencia municipal está en confección.'}
                </p>
              </div>
            </div>

            <div>
              {activeProcedure.current_step === 'payment' && (
                <Link to={`/tramites/${activeProcedure.id}/pago`} className="btn btn-primary">
                  <span>Gestionar pago del arancel</span><ChevronRight width={16} height={16} />
                </Link>
              )}
              {activeProcedure.current_step === 'charlas' && (
                <Link
                  to={`/tramites/${activeProcedure.id}/charlas`}
                  className="btn btn-primary"
                >
                  <span>Ingresar a Charlas Viales</span>
                  <ChevronRight width={16} height={16} />
                </Link>
              )}
              {activeProcedure.current_step === 'health' && (
                <Link
                  to={`/tramites/${activeProcedure.id}/salud`}
                  className="btn btn-primary"
                >
                  <span>Completar Declaración de Salud</span>
                  <ChevronRight width={16} height={16} />
                </Link>
              )}
              {activeProcedure.current_step === 'theory' && (
                <Link
                  to={`/tramites/${activeProcedure.id}/examen`}
                  className="btn btn-primary"
                >
                  <span>Rendir Examen Teórico</span>
                  <ChevronRight width={16} height={16} />
                </Link>
              )}
              {activeProcedure.current_step === 'practical' && (
                <Link
                  to={`/tramites/${activeProcedure.id}/turnos`}
                  className="btn btn-primary"
                >
                  <span>Reservar Turno Práctico</span>
                  <ChevronRight width={16} height={16} />
                </Link>
              )}
              {activeProcedure.current_step === 'delivery' && (
                <Link
                  to={`/tramites/${activeProcedure.id}/entrega`}
                  className="btn btn-primary"
                >
                  <span>Gestionar Entrega de Licencia</span>
                  <ChevronRight width={16} height={16} />
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ================= VISTA DE CATÁLOGO (SIN TRÁMITE ACTIVO) ================= */
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Iniciar Nuevo Trámite de Licencia</h2>
              <p className="card-subtitle">
                Seleccioná el tipo de solicitud que deseás realizar ante la Municipalidad de Baradero.
              </p>
            </div>
            <FileText width={24} height={24} />
          </div>

          <div className="spacing-mt-1">
            <RequiredFieldsNote />
            <h3 id="type-heading" className="catalog-section-title">1. Elegí el tipo de trámite<RequiredMark /></h3>
            {procedureTypes.length === 0 && <p role="status">No hay trámites disponibles por el momento. Consultá con la Municipalidad.</p>}
            <div className="catalog-grid" role="group" aria-labelledby="type-heading">
              {procedureTypes.map((pt) => {
                const isSelected = selectedType?.id === pt.id;
                return (
                  <button
                    key={pt.code}
                    type="button"
                    className={`catalog-option-card ${isSelected ? 'selected' : ''}`}
                    data-code={pt.code}
                    aria-pressed={isSelected}
                    aria-controls={selectedType ? 'category-section' : undefined}
                    onClick={handleSelectType}
                    disabled={creating}
                  >
                    <h3>{pt.name}</h3>
                    <p>{pt.short_description || pt.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedType && (
            <section id="category-section" className="category-selection-box" aria-labelledby="category-heading">
              <h3 id="category-heading" ref={categoryHeading} tabIndex={-1} className="catalog-section-title flow-heading">2. Seleccioná la categoría de licencia<RequiredMark /></h3>
              <p className="mfa-step-desc">
                Trámite elegido: <strong>{selectedType.name}</strong>. Las categorías dependen de la matriz municipal vigente.
              </p>

              {selectedType.matrix.length === 0 && <p role="status">Este trámite todavía no tiene categorías habilitadas. No se puede iniciar la solicitud.</p>}
              <div className="category-pill-group" role="group" aria-labelledby="category-heading">
                {selectedType.matrix.map((m) => {
                  const isActive = selectedCategory === m.license_category;
                  return (
                    <button
                      key={m.license_category}
                      type="button"
                      className={`category-pill-btn ${isActive ? 'active' : ''}`}
                      data-category={m.license_category}
                      aria-pressed={isActive}
                      aria-controls={selectedMatrixItem ? 'procedure-summary' : undefined}
                      onClick={handleSelectCategory}
                      disabled={creating}
                    >
                      Categoría {m.license_category}
                    </button>
                  );
                })}
              </div>

              {selectedMatrixItem && (
                <section id="procedure-summary" className="procedure-summary" aria-labelledby="summary-heading">
                <h3 id="summary-heading" ref={summaryHeading} tabIndex={-1} className="catalog-section-title flow-heading">3. Revisá y confirmá tu solicitud</h3>
                <p>{selectedType.name} · Categoría {selectedCategory}. El expediente se crea solamente al confirmar.</p>
                <div className="matrix-specs-grid">
                  <div className="matrix-spec-item">
                    <span className="matrix-spec-label">Edad Mínima</span>
                    <span className="matrix-spec-val">{selectedMatrixItem.min_age} años</span>
                  </div>
                  <div className="matrix-spec-item">
                    <span className="matrix-spec-label">Vigencia</span>
                    <span className="matrix-spec-val">{selectedMatrixItem.validity_years} años</span>
                  </div>
                  <div className="matrix-spec-item">
                    <span className="matrix-spec-label">Arancel Municipal</span>
                    <span className="matrix-spec-val">${selectedMatrixItem.fee_amount}</span>
                  </div>
                  <div className="matrix-spec-item">
                    <span className="matrix-spec-label">Examen Teórico</span>
                    <span className="matrix-spec-val">
                      {selectedMatrixItem.steps.includes('theory') ? `${selectedMatrixItem.theory_questions} preguntas (${selectedMatrixItem.theory_minutes} min)` : 'No requerido para este trámite'}
                    </span>
                  </div>
                </div>
                </section>
              )}

              {!isAgeValid && selectedMatrixItem && (
                <div className="alert alert-warning spacing-mt-1">
                  <AlertTriangle width={18} height={18} />
                  <span>
                    La categoría seleccionada admite desde {selectedMatrixItem.min_age} años{selectedMatrixItem.max_age !== null ? ` hasta ${selectedMatrixItem.max_age} años` : ''}. Tu edad
                    registrada es {citizenAge} años.
                  </span>
                </div>
              )}

              <div className="spacing-mt-1">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreateProcedure}
                  disabled={creating || !selectedMatrixItem || !isAgeValid}
                >
                  {creating ? 'Iniciando expediente...' : 'Iniciar Solicitud de Trámite'}
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Tarjeta lateral de seguridad */}
      <div className="card spacing-mt-1">
        <div className="card-header">
          <div>
            <h2 className="card-title">Seguridad de la Cuenta</h2>
            <p className="card-subtitle">Protección de identidad y segundo factor.</p>
          </div>
          <Shield width={24} height={24} />
        </div>

        <div className="flex-row-between mfa-status-row">
          <div>
            <span className="profile-item-label">Segundo Factor (MFA)</span>
            <p className="mfa-status-desc">{user?.mfa_enabled ? 'Activado' : 'Desactivado'}</p>
          </div>
          <span className={`badge ${user?.mfa_enabled ? 'badge-success' : 'badge-warning'}`}>
            {user?.mfa_enabled ? 'Protegido' : 'Pendiente'}
          </span>
        </div>

        <div className="spacing-mt-1">
          <Link to="/perfil" className="btn btn-secondary">
            <Shield width={16} height={16} />
            <span>Gestionar perfil y seguridad</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
