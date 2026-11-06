import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { RequiredMark, RequiredFieldsNote, FormError } from '../../components/FormFeedback';
import type { Procedure, DocumentItem } from '../../lib/types';
import {
  Activity,
  Check,
  Upload,
  ChevronLeft,
  FileText,
  User as UserIcon,
} from '../../components/Icons';

interface HealthQuestionsState {
  hasVisionIssue: boolean;
  hasHearingIssue: boolean;
  hasMotorIssue: boolean;
  hasMedications: boolean;
  hasConditions: boolean;
  hasAllergies: boolean;
}

export function Health() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [procedure, setProcedure] = useState<Procedure | null>(null);

  // Declaración jurada médica
  // No atribuimos un grupo sanguíneo a quien todavía no respondió.
  const [bloodType, setBloodType] = useState('');
  const [questions, setQuestions] = useState<HealthQuestionsState>({
    hasVisionIssue: false,
    hasHearingIssue: false,
    hasMotorIssue: false,
    hasMedications: false,
    hasConditions: false,
    hasAllergies: false,
  });

  const [conditionsText, setConditionsText] = useState('');
  const [medicationsText, setMedicationsText] = useState('');
  const [allergiesText, setAllergiesText] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [declaresApt, setDeclaresApt] = useState(false);

  // Archivo de certificado médico
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedDoc, setUploadedDoc] = useState<DocumentItem | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;

    api
      .get<Procedure>(`/procedures/${id}`)
      .then((data) => {
        if (!active) return;
        setProcedure(data);
        const existingCert = data.documents.find((d) => d.kind === 'health_certificate');
        if (existingCert) {
          setUploadedDoc(existingCert);
        }
      })
      .catch((err) => {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Error al consultar el expediente';
          setErrorMsg(msg);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const handleQuestionToggle = (key: keyof HealthQuestionsState, value: boolean) => {
    setQuestions((prev) => ({ ...prev, [key]: value }));
  };

  const handleBloodTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setBloodType(e.target.value);
  };

  const handleConditionsChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setConditionsText(e.target.value);
  };

  const handleMedicationsChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMedicationsText(e.target.value);
  };

  const handleAllergiesChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setAllergiesText(e.target.value);
  };

  const handleEmergencyNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmergencyName(e.target.value);
  };

  const handleEmergencyPhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmergencyPhone(e.target.value);
  };

  const handleDeclaresAptChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDeclaresApt(e.target.checked);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadCertificate = async () => {
    if (!id || !selectedFile) return;
    try {
      setUploadingDoc(true);
      setErrorMsg(null);
      const formData = new FormData();
      formData.append('kind', 'health_certificate');
      formData.append('file', selectedFile);

      const doc = await api.upload<DocumentItem>(`/procedures/${id}/documents`, formData);
      setUploadedDoc(doc);
      setSelectedFile(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al subir el certificado médico';
      setErrorMsg(msg);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (!declaresApt) {
      setErrorMsg('Debés marcar la declaración jurada de aptitud psicofísica para continuar.');
      return;
    }

    if (!emergencyName.trim() || emergencyName.trim().length < 3) {
      setErrorMsg('Ingresá el nombre y apellido del contacto de emergencia (mínimo 3 letras).');
      return;
    }

    if (!emergencyPhone.trim() || emergencyPhone.trim().length < 6) {
      setErrorMsg('Ingresá un teléfono de contacto de emergencia válido (mínimo 6 dígitos).');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      // Si seleccionó un archivo pero todavía no lo subió por separado, subirlo primero
      if (selectedFile && !uploadedDoc) {
        const formData = new FormData();
        formData.append('kind', 'health_certificate');
        formData.append('file', selectedFile);
        const doc = await api.upload<DocumentItem>(`/procedures/${id}/documents`, formData);
        setUploadedDoc(doc);
      } else if (!uploadedDoc) {
        setErrorMsg('Tenés que adjuntar el certificado médico emitido por un profesional de la salud.');
        setSubmitting(false);
        return;
      }

      // Consolidar notas de patologías preexistentes
      const conditionsList: string[] = [];
      if (questions.hasVisionIssue) conditionsList.push('Afección visual / lentes recetados');
      if (questions.hasHearingIssue) conditionsList.push('Dificultad auditiva / audífonos');
      if (questions.hasMotorIssue) conditionsList.push('Afección motriz o de movilidad');
      if (questions.hasConditions) conditionsList.push('Enfermedad preexistente diagnosticada');
      if (conditionsText.trim()) conditionsList.push(conditionsText.trim());

      const finalConditions = conditionsList.length > 0 ? conditionsList.join('; ') : null;
      const finalMedications = questions.hasMedications && medicationsText.trim() ? medicationsText.trim() : null;
      const finalAllergies = questions.hasAllergies && allergiesText.trim() ? allergiesText.trim() : null;

      const healthPayload = {
        blood_type: bloodType,
        conditions: finalConditions,
        medications: finalMedications,
        allergies: finalAllergies,
        emergency_contact_name: emergencyName.trim(),
        emergency_contact_phone: emergencyPhone.trim(),
        declares_apt: true,
      };

      await api.post(`/procedures/${id}/health`, {
        form: healthPayload,
        ...healthPayload,
      });

      navigate('/panel');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al enviar la declaración de salud';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container profile-container health-container">
      {/* Cabecera */}
      <div className="card profile-header-card">
        <div className="flex-row-between">
          <div>
            <span className="profile-item-label">Etapa 2 — Aptitud Psicofísica</span>
            <h1>Formulario de Salud y Certificado Médico</h1>
            <p>
              Expediente: <strong>{procedure?.public_code ?? 'Cargando...'}</strong> — Categoría{' '}
              {procedure?.license_category ?? ''}
            </p>
          </div>
          <div>
            <Link to="/panel" className="btn btn-secondary">
              <ChevronLeft width={16} height={16} />
              <span>Volver al panel</span>
            </Link>
          </div>
        </div>
      </div>

      {errorMsg && <FormError message={errorMsg} />}

      {loading ? (
        <div className="card text-center">
          <p className="loading-text">Cargando requisitos médicos del trámite...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <RequiredFieldsNote />
          {/* Sección 1: Grupo Sanguíneo */}
          <div className="health-form-section">
            <h2 className="health-section-heading">
              <Activity width={20} height={20} />
              <span>1. Grupo y Factor Sanguíneo</span>
            </h2>
            <p className="card-subtitle spacing-mb-1">
              Indicá tu grupo y factor registrado en el DNI o análisis clínico.
            </p>

            <div className="form-group">
              <label htmlFor="bloodTypeSelect">Grupo sanguíneo<RequiredMark /></label>
              <select
                id="bloodTypeSelect"
                className="form-input"
                value={bloodType}
                onChange={handleBloodTypeChange}
                required
              >
                <option value="" disabled>Seleccioná tu grupo o indicá que no lo conocés</option>
                <option value="0+">0 Positivo (0+)</option>
                <option value="A+">A Positivo (A+)</option>
                <option value="B+">B Positivo (B+)</option>
                <option value="AB+">AB Positivo (AB+)</option>
                <option value="0-">0 Negativo (0-)</option>
                <option value="A-">A Negativo (A-)</option>
                <option value="B-">B Negativo (B-)</option>
                <option value="AB-">AB Negativo (AB-)</option>
                <option value="no_sabe">No conoce / Sin determinar</option>
              </select>
            </div>
          </div>

          {/* Sección 2: Cuestionario Psicofísico Sí/No */}
          <div className="health-form-section">
            <h2 className="health-section-heading">
              <FileText width={20} height={20} />
              <span>2. Cuestionario de Salud</span>
            </h2>
            <p className="card-subtitle spacing-mb-1">
              Respondé con carácter de declaración jurada municipal cada una de las siguientes consultas.
            </p>

            {/* Pregunta 1: Visión */}
            <div className="health-question-item">
              <div className="health-question-header">
                <span className="health-question-label">
                  ¿Tenés problemas visuales, usás anteojos recetados o lentes de contacto para conducir?
                </span>
                <div className="health-toggle-group">
                  <button
                    type="button"
                    className={`health-toggle-btn ${!questions.hasVisionIssue ? 'active-no' : ''}`}
                    onClick={() => handleQuestionToggle('hasVisionIssue', false)}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className={`health-toggle-btn ${questions.hasVisionIssue ? 'active-yes' : ''}`}
                    onClick={() => handleQuestionToggle('hasVisionIssue', true)}
                  >
                    Sí
                  </button>
                </div>
              </div>
            </div>

            {/* Pregunta 2: Audición */}
            <div className="health-question-item">
              <div className="health-question-header">
                <span className="health-question-label">
                  ¿Tenés disminución auditiva, zumbidos crónicos o utilizás prótesis auditivas?
                </span>
                <div className="health-toggle-group">
                  <button
                    type="button"
                    className={`health-toggle-btn ${!questions.hasHearingIssue ? 'active-no' : ''}`}
                    onClick={() => handleQuestionToggle('hasHearingIssue', false)}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className={`health-toggle-btn ${questions.hasHearingIssue ? 'active-yes' : ''}`}
                    onClick={() => handleQuestionToggle('hasHearingIssue', true)}
                  >
                    Sí
                  </button>
                </div>
              </div>
            </div>

            {/* Pregunta 3: Motricidad */}
            <div className="health-question-item">
              <div className="health-question-header">
                <span className="health-question-label">
                  ¿Poseés alguna limitación física, motriz o neurológica que afecte el manejo?
                </span>
                <div className="health-toggle-group">
                  <button
                    type="button"
                    className={`health-toggle-btn ${!questions.hasMotorIssue ? 'active-no' : ''}`}
                    onClick={() => handleQuestionToggle('hasMotorIssue', false)}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className={`health-toggle-btn ${questions.hasMotorIssue ? 'active-yes' : ''}`}
                    onClick={() => handleQuestionToggle('hasMotorIssue', true)}
                  >
                    Sí
                  </button>
                </div>
              </div>
            </div>

            {/* Pregunta 4: Medicación continua */}
            <div className="health-question-item">
              <div className="health-question-header">
                <span className="health-question-label">
                  ¿Tomás regularmente medicamentos de venta bajo receta, sedantes o psicofármacos?
                </span>
                <div className="health-toggle-group">
                  <button
                    type="button"
                    className={`health-toggle-btn ${!questions.hasMedications ? 'active-no' : ''}`}
                    onClick={() => handleQuestionToggle('hasMedications', false)}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className={`health-toggle-btn ${questions.hasMedications ? 'active-yes' : ''}`}
                    onClick={() => handleQuestionToggle('hasMedications', true)}
                  >
                    Sí
                  </button>
                </div>
              </div>
              {questions.hasMedications && (
                <textarea
                  className="form-input health-input-detail"
                  placeholder="Detallá los nombres de los medicamentos y la dosis prescripta..."
                  rows={2}
                  value={medicationsText}
                  onChange={handleMedicationsChange}
                />
              )}
            </div>

            {/* Pregunta 5: Enfermedades preexistentes */}
            <div className="health-question-item">
              <div className="health-question-header">
                <span className="health-question-label">
                  ¿Tenés diagnóstico de diabetes, epilepsia, hipertensión severa o problemas cardíacos?
                </span>
                <div className="health-toggle-group">
                  <button
                    type="button"
                    className={`health-toggle-btn ${!questions.hasConditions ? 'active-no' : ''}`}
                    onClick={() => handleQuestionToggle('hasConditions', false)}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className={`health-toggle-btn ${questions.hasConditions ? 'active-yes' : ''}`}
                    onClick={() => handleQuestionToggle('hasConditions', true)}
                  >
                    Sí
                  </button>
                </div>
              </div>
              {questions.hasConditions && (
                <textarea
                  className="form-input health-input-detail"
                  placeholder="Especificá las patologías diagnosticadas y fecha aproximada..."
                  rows={2}
                  value={conditionsText}
                  onChange={handleConditionsChange}
                />
              )}
            </div>

            {/* Pregunta 6: Alergias */}
            <div className="health-question-item">
              <div className="health-question-header">
                <span className="health-question-label">
                  ¿Sufrís alergias agudas a medicamentos o sustancias que requieran tratamiento urgente?
                </span>
                <div className="health-toggle-group">
                  <button
                    type="button"
                    className={`health-toggle-btn ${!questions.hasAllergies ? 'active-no' : ''}`}
                    onClick={() => handleQuestionToggle('hasAllergies', false)}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className={`health-toggle-btn ${questions.hasAllergies ? 'active-yes' : ''}`}
                    onClick={() => handleQuestionToggle('hasAllergies', true)}
                  >
                    Sí
                  </button>
                </div>
              </div>
              {questions.hasAllergies && (
                <textarea
                  className="form-input health-input-detail"
                  placeholder="Indicá a qué sustancias o medicamentos presentás alergia..."
                  rows={2}
                  value={allergiesText}
                  onChange={handleAllergiesChange}
                />
              )}
            </div>
          </div>

          {/* Sección 3: Contacto de Emergencia */}
          <div className="health-form-section">
            <h2 className="health-section-heading">
              <UserIcon width={20} height={20} />
              <span>3. Contacto de Emergencia</span>
            </h2>
            <p className="card-subtitle spacing-mb-1">
              Persona de referencia a quien contactar ante cualquier eventualidad vial.
            </p>

            <div className="grid-cols-2">
              <div className="form-group">
                <label htmlFor="emergencyNameInput">Nombre y apellido de contacto<RequiredMark /></label>
                <input
                  id="emergencyNameInput"
                  type="text"
                  className="form-input"
                  placeholder="Ej: Laura Gómez"
                  value={emergencyName}
                  onChange={handleEmergencyNameChange}
                  required
                  minLength={3}
                />
              </div>

              <div className="form-group">
                <label htmlFor="emergencyPhoneInput">Teléfono de contacto<RequiredMark /></label>
                <input
                  id="emergencyPhoneInput"
                  type="tel"
                  className="form-input"
                  placeholder="Ej: 3329123456"
                  value={emergencyPhone}
                  onChange={handleEmergencyPhoneChange}
                  required
                  minLength={6}
                />
              </div>
            </div>
          </div>

          {/* Sección 4: Subida de Certificado Médico */}
          <div className="health-form-section">
            <h2 className="health-section-heading">
              <Upload width={20} height={20} />
              <span>4. Certificado Médico Oficial</span>
            </h2>
            <p className="card-subtitle spacing-mb-1">
              Adjuntá copia digitalizada (PDF o imagen nítida) del certificado de aptitud física firmado por médico matriculado.
            </p>

            {uploadedDoc ? (
              <div className="health-upload-selected">
                <div className="flex-row-gap">
                  <Check width={18} height={18} />
                  <span>
                    Certificado adjuntado: <strong>{uploadedDoc.original_name}</strong>
                  </span>
                </div>
                <span className="badge badge-success">Adjuntado</span>
              </div>
            ) : (
              <div>
                <label htmlFor="certFileInput" className="health-upload-box">
                  <Upload width={28} height={28} />
                  <p>Seleccioná el certificado médico<RequiredMark /></p>
                  <span className="matrix-spec-label">Formatos admitidos: PDF, JPG, PNG (máx. 10 MB)</span>
                  <input
                    id="certFileInput"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="visually-hidden"
                  />
                </label>

                {selectedFile && (
                  <div className="flex-row-between spacing-mt-1">
                    <span>
                      Archivo seleccionado: <strong>{selectedFile.name}</strong> (
                      {Math.round(selectedFile.size / 1024)} KB)
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleUploadCertificate}
                      disabled={uploadingDoc}
                    >
                      {uploadingDoc ? 'Subiendo archivo...' : 'Subir certificado ahora'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sección 5: Declaración Jurada */}
          <div className="sworn-declaration-box">
            <input
              id="declaresAptCheck"
              type="checkbox"
              checked={declaresApt}
              onChange={handleDeclaresAptChange}
              required
            />
            <label htmlFor="declaresAptCheck" className="sworn-declaration-text">
              <RequiredMark />
              <strong>Declaración Jurada de Aptitud:</strong> Declaro bajo juramento que los datos consignados en el presente formulario municipal son fidedignos y exactos, que no he ocultado patologías ni prescripciones farmacológicas que alteren mis aptitudes psicofísicas para el gobierno del vehículo, asumiendo las responsabilidades civiles y penales derivadas de conformidad con la Ley Nacional de Tránsito N° 24.449 y normativas municipales de Baradero.
            </label>
          </div>

          {/* Botón de envío final */}
          <div className="text-right spacing-mb-1">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || (!uploadedDoc && !selectedFile)}
            >
              <Check width={18} height={18} />
              <span>{submitting ? 'Enviando declaración médica...' : 'Enviar Declaración de Salud'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
export default Health;
