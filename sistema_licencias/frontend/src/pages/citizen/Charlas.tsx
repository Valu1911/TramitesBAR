import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { api } from '../../lib/api';
import type { LearningMaterial } from '../../lib/types';
import {
  Video,
  Play,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  FileText,
  Clock,
} from '../../components/Icons';

export function Charlas() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewedIds, setViewedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [videoSimulatedPlaying, setVideoSimulatedPlaying] = useState(false);

  useEffect(() => {
    let active = true;

    api
      .get<LearningMaterial[]>('/catalog/materials')
      .then((data) => {
        if (!active) return;
        const sorted = [...data].sort((a, b) => a.sort_order - b.sort_order);
        setMaterials(sorted);
        if (sorted.length > 0) {
          setViewedIds([sorted[0].id]);
        }
      })
      .catch((err) => {
        if (active) {
          const msg =
            err instanceof Error ? err.message : 'Error al cargar los materiales de charlas';
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

  const markCurrentAsViewed = useCallback((matId: number) => {
    setViewedIds((prev) => (prev.includes(matId) ? prev : [...prev, matId]));
  }, []);

  const handleSelectModule = (index: number) => {
    if (index < 0 || index >= materials.length) return;
    setCurrentIndex(index);
    markCurrentAsViewed(materials[index].id);
    setVideoSimulatedPlaying(false);
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      handleSelectModule(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < materials.length - 1) {
      handleSelectModule(currentIndex + 1);
    }
  };

  const handlePlayVideo = () => {
    setVideoSimulatedPlaying(true);
    if (materials[currentIndex]) {
      markCurrentAsViewed(materials[currentIndex].id);
    }
  };

  const handleFinishCharlas = async () => {
    if (!id || materials.length === 0) return;
    try {
      setCompleting(true);
      setErrorMsg(null);
      const allIds = materials.map((m) => m.id);
      await api.post(`/procedures/${id}/learning/complete`, {
        material_ids: allIds,
      });
      navigate('/panel');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo registrar la finalización de las charlas viales';
      setErrorMsg(msg);
    } finally {
      setCompleting(false);
    }
  };

  const currentMaterial = materials[currentIndex];
  const progressPercent =
    materials.length > 0
      ? Math.round((viewedIds.length / materials.length) * 100)
      : 0;
  const allViewed = materials.length > 0 && viewedIds.length === materials.length;

  return (
    <div className="container profile-container charlas-container">
      {/* Barra superior de navegación y título */}
      <div className="card profile-header-card">
        <div className="flex-row-between">
          <div>
            <span className="profile-item-label">Etapa 1 — Capacitación Obligatoria</span>
            <h1>Charlas de Seguridad Vial</h1>
            <p>
              Completá la visualización de los módulos temáticos para habilitar el formulario de salud y el examen teórico.
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

      {errorMsg && (
        <div className="alert alert-danger spacing-mb-1" role="alert">
          <AlertTriangle width={18} height={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Progreso de avance */}
      <div className="charlas-progress-box">
        <div className="charlas-progress-header">
          <span>Progreso de visualización</span>
          <span>
            {viewedIds.length} de {materials.length} módulos completados ({progressPercent}%)
          </span>
        </div>
        <progress
          className="progress-bar-native"
          value={viewedIds.length}
          max={materials.length || 1}
          aria-label="Progreso de módulos vistos"
        />
      </div>

      {loading ? (
        <div className="card text-center">
          <p className="loading-text">Cargando material educativo de Baradero...</p>
        </div>
      ) : materials.length === 0 ? (
        <div className="card text-center">
          <div className="alert alert-warning">
            <Clock width={18} height={18} />
            <span>No se encontraron materiales de charlas cargados en el catálogo municipal.</span>
          </div>
        </div>
      ) : (
        <div className="charlas-layout-grid">
          {/* Navegación lateral de módulos */}
          <nav className="charlas-nav-card" aria-label="Módulos de charlas">
            <span className="profile-item-label spacing-mb-1">Temario Vial</span>
            {materials.map((mat, idx) => {
              const isCurrent = idx === currentIndex;
              const isViewed = viewedIds.includes(mat.id);

              return (
                <button
                  key={mat.id}
                  type="button"
                  className={`charlas-nav-item ${isCurrent ? 'active' : ''} ${
                    isViewed ? 'completed' : ''
                  }`}
                  onClick={() => handleSelectModule(idx)}
                >
                  <div className="charlas-nav-item-icon">
                    {isViewed ? (
                      <Check width={14} height={14} />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  <div className="charlas-nav-item-title">
                    <span>{mat.title}</span>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Visor interactivo del contenido */}
          <section className="charlas-content-view" aria-label="Contenido del módulo">
            {currentMaterial && (
              <>
                <div className="charlas-module-header">
                  <span className="charlas-module-tag">
                    Módulo {currentIndex + 1} de {materials.length} — {currentMaterial.kind.toUpperCase()}
                  </span>
                  <h2 className="charlas-module-title">{currentMaterial.title}</h2>
                  <p className="card-subtitle">{currentMaterial.description}</p>
                </div>

                {/* Reproductor interactivo simulado o embebido si es video */}
                {currentMaterial.kind === 'video' ? (
                  <div className="charlas-video-frame-box">
                    <Video width={40} height={40} />
                    <div>
                      <h3>{currentMaterial.title}</h3>
                      <p>
                        {videoSimulatedPlaying
                          ? 'Reproduciendo video instruccional de seguridad vial...'
                          : 'Hacé clic para reproducir el módulo audiovisual.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="charlas-video-play-btn"
                      onClick={handlePlayVideo}
                      aria-label="Reproducir video"
                    >
                      {videoSimulatedPlaying ? (
                        <Check width={28} height={28} />
                      ) : (
                        <Play width={28} height={28} />
                      )}
                    </button>
                    {videoSimulatedPlaying && (
                      <span className="badge badge-success">Módulo visualizado</span>
                    )}
                  </div>
                ) : (
                  <div className="alert alert-info">
                    <FileText width={18} height={18} />
                    <span>Leé atentamente los conceptos de este módulo obligatorio.</span>
                  </div>
                )}

                {/* Cuerpo del material en Markdown */}
                {currentMaterial.body_md && (
                  <div className="charlas-markdown-prose">
                    <ReactMarkdown>{currentMaterial.body_md}</ReactMarkdown>
                  </div>
                )}

                {/* Navegación y botón de finalización */}
                <div className="charlas-bottom-nav">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                  >
                    <ChevronLeft width={16} height={16} />
                    <span>Módulo anterior</span>
                  </button>

                  {currentIndex < materials.length - 1 ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleNext}
                    >
                      <span>Siguiente módulo</span>
                      <ChevronRight width={16} height={16} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleFinishCharlas}
                      disabled={completing || !allViewed}
                    >
                      <CheckCircle width={18} height={18} />
                      <span>{completing ? 'Guardando avance...' : 'Finalizar etapa de charlas'}</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
export default Charlas;
