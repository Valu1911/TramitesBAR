import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
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
  const [selectedCategory, setSelectedCategory] = useState<string>('B');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchProceduresData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [mine, licList] = await Promise.all([
        api.get<ProcedureListItem[]>('/procedures/mine'),
        api.get<License[]>('/licenses/mine').catch(() => [] as License[]),
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
        if (types.length > 0) {
          const defaultType = types[0];
          setSelectedType(defaultType);
          if (defaultType.matrix.length > 0) {
            setSelectedCategory(defaultType.matrix[0].license_category);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cargar expedientes';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    Promise.all([
      api.get<ProcedureListItem[]>('/procedures/mine'),
      api.get<License[]>('/licenses/mine').catch(() => [] as License[]),
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
            if (types.length > 0) {
              const defaultType = types[0];
              setSelectedType(defaultType);
              if (defaultType.matrix.length > 0) {
                setSelectedCategory(defaultType.matrix[0].license_category);
              }
            }
          }
        }
      })
      .catch((err) => {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Error al cargar expedientes';
          setErrorMsg(msg);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSelectType = (procType: ProcedureType) => {
    setSelectedType(procType);
    if (procType.matrix.length > 0) {
      setSelectedCategory(procType.matrix[0].license_category);
    }
  };

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
  };

  const handleCreateProcedure = async () => {
    if (!selectedType) return;
    try {
      setCreating(true);
      setErrorMsg(null);
      await api.post<Procedure>('/procedures', {
        procedure_type: selectedType.code,
        license_category: selectedCategory,
        data: {},
      });
      setSuccessMsg('Expediente municipal iniciado correctamente.');
      await fetchProceduresData();
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
    citizenAge >= selectedMatrixItem.min_age;

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
        <div className="alert alert-danger spacing-mb-1" role="alert">
          <AlertTriangle width={18} height={18} />
          <span>{errorMsg}</span>
        </div>
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
              <span className="profile-item-label">Documento Oficial Nacional</span>
              <h2 className="card-title">Licencia Nacional de Conducir Digital</h2>
              <p className="card-subtitle">
                Emitida por la Municipalidad de Baradero conforme a la Ley Nacional de Tránsito.
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
      ) : activeProcedure ? (
        /* ================= VISTA DE TRÁMITE ACTIVO ================= */
        <div className="card procedure-hero-card">
          <div className="card-header">
            <div>
              <span className="profile-item-label">Expediente Municipal</span>
              <h2 className="card-title">
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
              {STAGES.map((stage, idx) => {
                const stepObj = activeProcedure.steps.find((s) => s.code === stage.code);
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
                  {activeProcedure.current_step === 'practical' && 'Etapa: Examen Práctico en Circuito'}
                  {activeProcedure.current_step === 'delivery' && 'Etapa: Entrega de Licencia'}
                  {!['charlas', 'health', 'theory', 'practical', 'delivery'].includes(
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
                  {activeProcedure.current_step === 'practical' &&
                    'Coordiná tu turno práctico en el autódromo municipal con los inspectores.'}
                  {activeProcedure.current_step === 'delivery' &&
                    'Tu licencia municipal está en confección.'}
                </p>
              </div>
            </div>

            <div>
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
            <h3 className="catalog-section-title">1. Elegí el tipo de trámite</h3>
            <div className="catalog-grid">
              {procedureTypes.map((pt) => {
                const isSelected = selectedType?.id === pt.id;
                return (
                  <button
                    key={pt.code}
                    type="button"
                    className={`catalog-option-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectType(pt)}
                  >
                    <h3>{pt.name}</h3>
                    <p>{pt.short_description || pt.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedType && (
            <div className="category-selection-box">
              <h3 className="catalog-section-title">2. Seleccioná la categoría de licencia</h3>
              <p className="mfa-step-desc">
                Las categorías habilitadas para este trámite dependen de la edad y requisitos municipales.
              </p>

              <div className="category-pill-group">
                {selectedType.matrix.map((m) => {
                  const isActive = selectedCategory === m.license_category;
                  return (
                    <button
                      key={m.license_category}
                      type="button"
                      className={`category-pill-btn ${isActive ? 'active' : ''}`}
                      onClick={() => handleSelectCategory(m.license_category)}
                    >
                      Categoría {m.license_category}
                    </button>
                  );
                })}
              </div>

              {selectedMatrixItem && (
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
                      {selectedMatrixItem.theory_questions} preguntas ({selectedMatrixItem.theory_minutes} min)
                    </span>
                  </div>
                </div>
              )}

              {!isAgeValid && selectedMatrixItem && (
                <div className="alert alert-warning spacing-mt-1">
                  <AlertTriangle width={18} height={18} />
                  <span>
                    La categoría seleccionada requiere una edad mínima de {selectedMatrixItem.min_age} años. Tu edad
                    registrada es {citizenAge} años.
                  </span>
                </div>
              )}

              <div className="spacing-mt-1">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreateProcedure}
                  disabled={creating || !isAgeValid}
                >
                  {creating ? 'Iniciando expediente...' : 'Iniciar Solicitud de Trámite'}
                </button>
              </div>
            </div>
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
