import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Procedure } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import {
  Truck,
  MapPin,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
} from '../../components/Icons';

export function Delivery() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [method, setMethod] = useState<'branch' | 'postal'>('branch');
  const [address, setAddress] = useState(user?.profile?.address || '');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    api
      .get<Procedure>(`/procedures/${id}`)
      .then((proc) => {
        if (!active) return;
        setProcedure(proc);
        if (user?.profile?.address) {
          setAddress(user.profile.address);
        }
      })
      .catch((err) => {
        if (active) {
          setErrorMsg(err instanceof Error ? err.message : 'Error al cargar expediente');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setSubmitting(true);
      setErrorMsg(null);
      await api.post(`/procedures/${id}/delivery`, {
        method,
        address: method === 'postal' ? address : null,
      });
      navigate('/panel');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo confirmar la entrega');
    } finally {
      setSubmitting(false);
    }
  };

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
            <Truck width={32} height={32} />
          </div>
          <div>
            <h1>Forma de Entrega de Licencia</h1>
            <p>
              ¡Felicitaciones! Has completado todas las evaluaciones para la Categoría{' '}
              {procedure?.license_category}.
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

      {loading ? (
        <div className="card text-center">
          <p className="loading-text">Cargando datos del trámite...</p>
        </div>
      ) : (
        <div className="card">
          <form onSubmit={handleSubmit}>
            <h2 className="card-title spacing-mb-1">¿Cómo deseás recibir tu credencial?</h2>

            <div className="grid-cols-2 spacing-mb-1">
              <button
                type="button"
                onClick={() => setMethod('branch')}
                className={`card text-left ${method === 'branch' ? 'kpi-card active' : 'kpi-card'}`}
              >
                <div className="flex-row-gap">
                  <MapPin width={24} height={24} />
                  <div>
                    <strong>Retiro en Sede Municipal</strong>
                    <p className="spacing-mt-1">
                      Dirección de Tránsito (Av. San Martín y Rodríguez, Baradero).
                      <br />
                      Horario: Lunes a Viernes de 08:00 a 14:00 hs.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMethod('postal')}
                className={`card text-left ${method === 'postal' ? 'kpi-card active' : 'kpi-card'}`}
              >
                <div className="flex-row-gap">
                  <Truck width={24} height={24} />
                  <div>
                    <strong>Envío a Domicilio Postal</strong>
                    <p className="spacing-mt-1">
                      Entrega certificada por correo en tu domicilio registrado en Baradero.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {method === 'postal' && (
              <div className="form-group spacing-mb-1">
                <label htmlFor="delivery-address" className="form-label">
                  Confirmar Domicilio de Entrega en Baradero
                </label>
                <input
                  id="delivery-address"
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle, número, piso/depto, Baradero"
                  className="form-input"
                />
              </div>
            )}

            <div className="flex-row-between spacing-mt-1">
              <Link to="/panel" className="btn btn-secondary">
                <span>Volver</span>
              </Link>
              <button
                type="submit"
                disabled={submitting || (method === 'postal' && !address.trim())}
                className="btn btn-primary"
              >
                <CheckCircle width={18} height={18} />
                <span>{submitting ? 'Confirmando...' : 'Confirmar Forma de Entrega'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
