import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Procedure, Appointment } from '../../lib/types';
import {
  Calendar,
  Clock,
  MapPin,
  User as UserIcon,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
} from '../../components/Icons';

export function PracticalAppointment() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [availableSlots, setAvailableSlots] = useState<Appointment[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      const [proc, slots] = await Promise.all([
        api.get<Procedure>(`/procedures/${id}`),
        api.get<Appointment[]>('/appointments/available'),
      ]);
      setProcedure(proc);
      setAvailableSlots(slots);
      if (slots.length > 0) {
        setSelectedSlotId(slots[0].id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cargar los turnos disponibles';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let active = true;

    Promise.all([
      api.get<Procedure>(`/procedures/${id}`),
      api.get<Appointment[]>('/appointments/available'),
    ])
      .then(([proc, slots]) => {
        if (!active) return;
        setProcedure(proc);
        setAvailableSlots(slots);
        if (slots.length > 0) {
          setSelectedSlotId(slots[0].id);
        }
      })
      .catch((err) => {
        if (active) {
          const msg =
            err instanceof Error ? err.message : 'Error al cargar los turnos disponibles';
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

  const handleBook = async () => {
    if (!id || !selectedSlotId) return;
    try {
      setSubmitting(true);
      setErrorMsg(null);
      await api.post(`/procedures/${id}/appointment`, {
        appointment_id: selectedSlotId,
      });
      setSuccessMsg('¡Turno práctico reservado con éxito!');
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo reservar el turno';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const practicalStep = procedure?.steps.find((s) => s.code === 'practical');
  const isScheduled =
    practicalStep?.status === 'scheduled' || Boolean(practicalStep?.data?.appointment_id);
  const scheduledData = practicalStep?.data as
    | {
        appointment_id?: number;
        scheduled_at?: string;
        location?: string;
        instructor?: string;
      }
    | undefined;

  return (
    <div className="container profile-container">
      <div className="card-header spacing-mb-1">
        <Link to="/panel" className="btn btn-secondary btn-sm">
          <ChevronLeft width={16} height={16} />
          <span>Volver al Panel</span>
        </Link>
        <span className="procedure-code-highlight">{procedure?.public_code}</span>
      </div>

      <div className="card profile-header-card">
        <div className="flex-row-gap">
          <div className="profile-avatar">
            <Calendar width={32} height={32} />
          </div>
          <div>
            <h1>Turno de Examen Práctico</h1>
            <p>
              Prueba de conducción en circuito municipal — Categoría {procedure?.license_category}
            </p>
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
          <CheckCircle width={18} height={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="card text-center">
          <p className="loading-text">Cargando turnos disponibles...</p>
        </div>
      ) : isScheduled && scheduledData?.scheduled_at ? (
        /* Turno ya reservado */
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Turno Confirmado</h2>
              <p className="card-subtitle">Tu examen práctico ya se encuentra agendado.</p>
            </div>
            <span className="badge badge-success">Reservado</span>
          </div>

          <div className="alert alert-info spacing-mb-1">
            <Calendar width={20} height={20} />
            <div>
              <strong>Fecha y Hora:</strong>{' '}
              {new Date(scheduledData.scheduled_at).toLocaleDateString('es-AR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>

          <div className="grid-cols-2 spacing-mb-1">
            <div className="form-group">
              <span className="profile-item-label">Lugar de Examen</span>
              <p className="flex-row-gap spacing-mt-1">
                <MapPin width={18} height={18} />
                <span>{scheduledData.location || 'Circuito Municipal de Baradero'}</span>
              </p>
            </div>
            {scheduledData.instructor && (
              <div className="form-group">
                <span className="profile-item-label">Instructor Asignado</span>
                <p className="flex-row-gap spacing-mt-1">
                  <UserIcon width={18} height={18} />
                  <span>{scheduledData.instructor}</span>
                </p>
              </div>
            )}
          </div>

          <div className="alert alert-warning">
            <Clock width={20} height={20} />
            <div>
              <strong>Recomendaciones para el examen:</strong>
              <ul className="spacing-mt-1">
                <li>Presentate 15 minutos antes con tu DNI físico.</li>
                <li>Concurrí con un acompañante habilitado con licencia vigente.</li>
                <li>El vehículo debe contar con seguro al día, cédula y VTV vigente.</li>
              </ul>
            </div>
          </div>

          <div className="spacing-mt-1 text-right">
            <Link to="/panel" className="btn btn-primary">
              <span>Ir al Panel Principal</span>
            </Link>
          </div>
        </div>
      ) : (
        /* Selector de cupos disponibles */
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Cupos Disponibles</h2>
              <p className="card-subtitle">
                Elegí la fecha y horario que te resulte más conveniente para rendir en Baradero.
              </p>
            </div>
          </div>

          {availableSlots.length === 0 ? (
            <div className="alert alert-info">
              <Clock width={18} height={18} />
              <span>
                En este momento no hay cupos prácticos con disponibilidad inmediata. Por favor
                reintentá más tarde o consultá en la oficina de Tránsito.
              </span>
            </div>
          ) : (
            <div>
              <div className="grid-cols-2 spacing-mb-1">
                {availableSlots.map((slot) => {
                  const dateObj = new Date(slot.scheduled_at);
                  const isSelected = selectedSlotId === slot.id;

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`card text-left ${isSelected ? 'kpi-card active' : 'kpi-card'}`}
                    >
                      <div className="flex-row-between">
                        <strong>
                          {dateObj.toLocaleDateString('es-AR', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </strong>
                        <span className="badge badge-accent">
                          {dateObj.toLocaleTimeString('es-AR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="flex-row-gap spacing-mt-1">
                        <MapPin width={16} height={16} />
                        <span>{slot.location}</span>
                      </p>
                      {slot.instructor && (
                        <p className="flex-row-gap spacing-mt-1">
                          <UserIcon width={16} height={16} />
                          <span>Instructor: {slot.instructor}</span>
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex-row-between spacing-mt-1">
                <Link to="/panel" className="btn btn-secondary">
                  <span>Cancelar</span>
                </Link>
                <button
                  type="button"
                  disabled={!selectedSlotId || submitting}
                  onClick={handleBook}
                  className="btn btn-primary"
                >
                  <CheckCircle width={18} height={18} />
                  <span>{submitting ? 'Confirmando...' : 'Reservar Turno Práctico'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
