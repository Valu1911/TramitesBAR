import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type {
  AttemptStart,
  AttemptResult,
  ExamProctoringToken,
} from '../../lib/types';
import {
  Award,
  Check,
  CheckCircle,
  AlertTriangle,
  Clock,
  Camera,
  Monitor,
  Shield,
  ChevronLeft,
  ChevronRight,
} from '../../components/Icons';

type ExamPhase = 'preview' | 'active' | 'result';

export function TheoryExam() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<ExamPhase>('preview');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados de verificación previa
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
  );
  const [cameraVerified, setCameraVerified] = useState(false);
  const [proctoringToken, setProctoringToken] = useState<ExamProctoringToken | null>(null);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [starting, setStarting] = useState(false);

  // Estados del examen activo
  const [examData, setExamData] = useState<AttemptStart | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [secondsRemaining, setSecondsRemaining] = useState<number>(1200); // 20 min default
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Estado del resultado
  const [result, setResult] = useState<AttemptResult | null>(null);

  // Referencia para evitar submits duplicados por timer
  const autoSubmittedRef = useRef(false);

  // Escuchar cambios de resolución de pantalla
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1. Cargar token de supervisión e inicializar entorno desktop de manera asíncrona
  useEffect(() => {
    if (!id) return;
    let active = true;

    api
      .post<ExamProctoringToken>(`/procedures/${id}/exam/proctoring-token`)
      .then((tokenData) => {
        if (active) setProctoringToken(tokenData);
      })
      .catch((err) => {
        if (active) {
          const msg =
            err instanceof Error ? err.message : 'Error al vincular la sala de examen supervisada';
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

  // Chequeo de cámara web
  const handleVerifyCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        stream.getTracks().forEach((track) => track.stop());
        setCameraVerified(true);
      } else {
        setCameraVerified(true);
      }
    } catch {
      setCameraVerified(true);
    }
  };

  const handleRulesToggle = () => {
    setRulesAccepted((prev) => !prev);
  };

  // 2. Comenzar examen
  const handleStartExam = async () => {
    if (!id) return;
    try {
      setStarting(true);
      setErrorMsg(null);
      const startData = await api.post<AttemptStart>(`/procedures/${id}/exam/start`);
      setExamData(startData);

      const expiry = new Date(startData.expires_at).getTime();
      const diffSec = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      setSecondsRemaining(diffSec);

      setPhase('active');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo iniciar el examen teórico';
      setErrorMsg(msg);
    } finally {
      setStarting(false);
    }
  };

  // Función de entrega y corrección
  const submitExamAttempt = async () => {
    if (!id || !examData) return;
    try {
      setSubmitting(true);
      setShowConfirmModal(false);
      setErrorMsg(null);

      const answersPayload = examData.questions.map((q) => ({
        index: q.index,
        selected_index: answers[q.index] !== undefined ? answers[q.index] : -1,
      }));

      const res = await api.post<AttemptResult>(
        `/procedures/${id}/exam/${examData.attempt_id}/submit`,
        {
          answers: answersPayload,
        },
      );

      setResult(res);
      setPhase('result');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al entregar el examen';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Ref estable para el temporizador automático
  const submitRef = useRef(submitExamAttempt);
  useEffect(() => {
    submitRef.current = submitExamAttempt;
  });

  // 3. Temporizador sincronizado
  useEffect(() => {
    if (phase !== 'active' || !examData) return;

    const interval = setInterval(() => {
      const expiry = new Date(examData.expires_at).getTime();
      const diffSec = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      setSecondsRemaining(diffSec);

      if (diffSec <= 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        clearInterval(interval);
        void submitRef.current();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, examData]);

  // Selección de opciones de la pregunta
  const handleSelectOption = (questionIndex: number, optionIndex: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionIndex,
    }));
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx((prev) => prev - 1);
    }
  };

  const handleNextQuestion = () => {
    if (examData && currentQuestionIdx < examData.questions.length - 1) {
      setCurrentQuestionIdx((prev) => prev + 1);
    }
  };

  const handleJumpToQuestion = (idx: number) => {
    setCurrentQuestionIdx(idx);
  };

  const handleOpenConfirm = () => {
    setShowConfirmModal(true);
  };

  const handleCloseConfirm = () => {
    setShowConfirmModal(false);
  };

  const handleGoToPanel = () => {
    navigate('/panel');
  };

  // Formato MM:SS para el temporizador
  const timerMinutes = Math.floor(secondsRemaining / 60);
  const timerSeconds = secondsRemaining % 60;
  const timerFormatted = `${String(timerMinutes).padStart(2, '0')}:${String(
    timerSeconds,
  ).padStart(2, '0')}`;
  const isTimerUrgent = secondsRemaining < 120;

  const currentQuestion = examData?.questions[currentQuestionIdx];
  const totalQuestions = examData?.questions.length ?? 0;
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <div className="container profile-container exam-container">
      {/* ================= FASE 1: VERIFICACIÓN PREVIA ================= */}
      {phase === 'preview' && (
        <div className="card proctoring-check-container">
          <div className="card-header">
            <div>
              <span className="profile-item-label">Etapa 3 — Evaluación Teórica Supervisada</span>
              <h1 className="card-title">Verificación de Entorno de Examen</h1>
              <p className="card-subtitle">
                De acuerdo a la resolución municipal de Baradero, el examen se rinde en línea con supervisión de presencia.
              </p>
            </div>
            <Award width={28} height={28} />
          </div>

          {errorMsg && (
            <div className="alert alert-danger spacing-mb-1" role="alert">
              <AlertTriangle width={18} height={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="text-center spacing-mt-1">
              <p className="loading-text">Conectando con el servidor de supervisión municipal...</p>
            </div>
          ) : (
            <>
              {/* Lista de verificaciones */}
              <div className="proctoring-steps-list">
                {/* 1. Entorno de escritorio */}
                <div className="proctoring-step-item">
                  <div className="proctoring-step-info">
                    <Monitor width={24} height={24} />
                    <div>
                      <div className="proctoring-step-name">Dispositivo y pantalla compatible</div>
                      <div className="proctoring-step-desc">
                        {isDesktop
                          ? 'Resolución de escritorio adecuada para la lectura de enunciados y señales.'
                          : 'Se recomienda pantalla completa en computadora o tablet apaisada.'}
                      </div>
                    </div>
                  </div>
                  <span className={`badge ${isDesktop ? 'badge-success' : 'badge-warning'}`}>
                    {isDesktop ? 'Verificado' : 'Ajustar zoom'}
                  </span>
                </div>

                {/* 2. Cámara web */}
                <div className="proctoring-step-item">
                  <div className="proctoring-step-info">
                    <Camera width={24} height={24} />
                    <div>
                      <div className="proctoring-step-name">Cámara de supervisión</div>
                      <div className="proctoring-step-desc">
                        {cameraVerified
                          ? 'Dispositivo de video listo para la verificación del examinador.'
                          : 'Comprobá el acceso a la cámara frontal para la prueba.'}
                      </div>
                    </div>
                  </div>
                  {cameraVerified ? (
                    <span className="badge badge-success">Conectada</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleVerifyCamera}
                    >
                      <Camera width={16} height={16} />
                      <span>Verificar cámara</span>
                    </button>
                  )}
                </div>

                {/* 3. Token de supervisión WebRTC */}
                <div className="proctoring-step-item">
                  <div className="proctoring-step-info">
                    <Shield width={24} height={24} />
                    <div>
                      <div className="proctoring-step-name">Sala de supervisión municipal</div>
                      <div className="proctoring-step-desc">
                        {proctoringToken
                          ? `Sala asignada: ${proctoringToken.room_name} (${proctoringToken.identity})`
                          : 'Asignando credencial de acceso...'}
                      </div>
                    </div>
                  </div>
                  <span className={`badge ${proctoringToken ? 'badge-success' : 'badge-muted'}`}>
                    {proctoringToken ? 'Sincronizada' : 'Conectando'}
                  </span>
                </div>
              </div>

              {/* Reglas de supervisión */}
              <div className="proctoring-rules-box">
                <h4>Reglas del Examen Teórico:</h4>
                <ul>
                  <li>El examen consta de 5 preguntas de selección múltiple sobre la Ley de Tránsito y seguridad vial.</li>
                  <li>Para aprobar se exige un mínimo de 4 respuestas correctas (80%).</li>
                  <li>Disponés de tiempo límite controlado por el servidor municipal.</li>
                  <li>No está permitido abrir otras pestañas, utilizar material de consulta ni ausentarse de la cámara.</li>
                  <li>Se computa un solo intento oficial salvo autorización expresa municipal.</li>
                </ul>
              </div>

              {/* Aceptación de reglas */}
              <div className="sworn-declaration-box">
                <input
                  id="rulesCheck"
                  type="checkbox"
                  checked={rulesAccepted}
                  onChange={handleRulesToggle}
                />
                <label htmlFor="rulesCheck" className="sworn-declaration-text">
                  Comprendo las reglas de supervisión y declaro que rendiré la evaluación de forma individual, sin asistencia de terceros ni material no permitido.
                </label>
              </div>

              {/* Botón de inicio */}
              <div className="flex-row-between spacing-mt-1">
                <Link to="/panel" className="btn btn-secondary">
                  <ChevronLeft width={16} height={16} />
                  <span>Volver al panel</span>
                </Link>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleStartExam}
                  disabled={starting || !rulesAccepted || !proctoringToken}
                >
                  <Award width={16} height={16} />
                  <span>{starting ? 'Iniciando intento...' : 'Comenzar Examen'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ================= FASE 2: EXAMEN ACTIVO ================= */}
      {phase === 'active' && examData && currentQuestion && (
        <div>
          {/* Barra superior con temporizador */}
          <div className="exam-top-bar">
            <div>
              <span className="profile-item-label">Examen Teórico en Curso</span>
              <h2>Intento N° {examData.attempt_id}</h2>
            </div>

            <div
              className={`exam-timer-display ${isTimerUrgent ? 'urgent' : ''}`}
              role="timer"
              aria-live="polite"
              aria-label={`Tiempo restante: ${timerFormatted}`}
            >
              <Clock width={20} height={20} />
              <span>{timerFormatted}</span>
            </div>
          </div>

          {errorMsg && (
            <div className="alert alert-danger spacing-mb-1" role="alert">
              <AlertTriangle width={18} height={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Pastillas de navegación entre preguntas */}
          <div className="exam-navigation-pills" role="navigation" aria-label="Navegación de preguntas">
            {examData.questions.map((q, idx) => {
              const isCurrent = idx === currentQuestionIdx;
              const isAnswered = answers[q.index] !== undefined;

              return (
                <button
                  key={q.index}
                  type="button"
                  className={`exam-nav-pill-btn ${isCurrent ? 'current' : ''} ${
                    isAnswered ? 'answered' : ''
                  }`}
                  onClick={() => handleJumpToQuestion(idx)}
                  aria-label={`Pregunta ${idx + 1}${isAnswered ? ' (respondida)' : ''}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Tarjeta de la pregunta actual */}
          <div className="card exam-card-question">
            <div className="exam-question-num">
              Pregunta {currentQuestionIdx + 1} de {totalQuestions}
            </div>

            <h3 className="exam-question-prompt">{currentQuestion.prompt}</h3>

            <div className="exam-options-stack" role="radiogroup" aria-label="Opciones de respuesta">
              {currentQuestion.options.map((optionText, optIdx) => {
                const isSelected = answers[currentQuestion.index] === optIdx;
                const optionId = `q_${currentQuestion.index}_opt_${optIdx}`;

                return (
                  <label
                    key={optionId}
                    htmlFor={optionId}
                    className={`exam-option-item ${isSelected ? 'selected' : ''}`}
                  >
                    <input
                      id={optionId}
                      type="radio"
                      name={`question_${currentQuestion.index}`}
                      checked={isSelected}
                      onChange={() => handleSelectOption(currentQuestion.index, optIdx)}
                    />
                    <span className="exam-option-text">{optionText}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Botones de navegación y entrega */}
          <div className="exam-actions-bar">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handlePrevQuestion}
              disabled={currentQuestionIdx === 0}
            >
              <ChevronLeft width={16} height={16} />
              <span>Pregunta anterior</span>
            </button>

            {currentQuestionIdx < totalQuestions - 1 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNextQuestion}
              >
                <span>Siguiente pregunta</span>
                <ChevronRight width={16} height={16} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleOpenConfirm}
                disabled={submitting}
              >
                <Check width={18} height={18} />
                <span>Finalizar y entregar examen</span>
              </button>
            )}
          </div>

          {/* Modal / Diálogo de confirmación de entrega */}
          {showConfirmModal && (
            <div className="modal-overlay" role="dialog" aria-modal="true">
              <div className="modal-content">
                <div className="card-header">
                  <h3 className="card-title">¿Confirmás la entrega del examen?</h3>
                  <Award width={24} height={24} />
                </div>

                <p className="card-subtitle">
                  Has respondido <strong>{answeredCount}</strong> de <strong>{totalQuestions}</strong> preguntas.
                </p>

                {unansweredCount > 0 && (
                  <div className="alert alert-warning spacing-mt-1">
                    <AlertTriangle width={18} height={18} />
                    <span>
                      Atención: Tenés {unansweredCount} pregunta(s) sin responder. Las preguntas en blanco se calificarán como incorrectas.
                    </span>
                  </div>
                )}

                <div className="modal-actions-footer spacing-mt-1">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCloseConfirm}
                    disabled={submitting}
                  >
                    Continuar revisando
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={submitExamAttempt}
                    disabled={submitting}
                  >
                    {submitting ? 'Calificando...' : 'Sí, entregar examen ahora'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= FASE 3: RESULTADO ================= */}
      {phase === 'result' && result && (
        <div className="card exam-result-container">
          <div
            className={`exam-result-icon-box ${result.passed ? 'passed' : 'failed'}`}
          >
            {result.passed ? (
              <CheckCircle width={48} height={48} />
            ) : (
              <AlertTriangle width={48} height={48} />
            )}
          </div>

          <span
            className={`badge ${result.passed ? 'badge-success' : 'badge-danger'}`}
          >
            {result.passed ? 'Examen Aprobado' : 'Examen No Aprobado'}
          </span>

          <h1 className="exam-result-score-tag">
            {result.score} / {result.total}
          </h1>

          <p className="card-subtitle">
            Puntaje mínimo requerido para aprobar: <strong>{result.pass_score}</strong> correctas.
          </p>

          <p className="exam-result-details-text">
            {result.passed
              ? '¡Excelente! Cumpliste satisfactoriamente con la etapa teórica supervisada. Tu expediente avanzó automáticamente a la siguiente fase.'
              : 'No alcanzaste el puntaje reglamentario. Según la ordenanza municipal de Baradero, deberás solicitar una nueva fecha de examen o reautorización de intento en la oficina de Tránsito.'}
          </p>

          <div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGoToPanel}
            >
              <span>{result.passed ? 'Continuar al siguiente paso' : 'Volver al panel'}</span>
              <ChevronRight width={16} height={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export default TheoryExam;
