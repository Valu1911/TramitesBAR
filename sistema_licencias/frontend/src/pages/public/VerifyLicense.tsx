import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { PublicLicense } from '../../lib/types';
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  Award,
} from '../../components/Icons';

export function VerifyLicense() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [license, setLicense] = useState<PublicLicense | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    api
      .get<PublicLicense>(`/public/licenses/${token}`)
      .then((data) => {
        if (active) setLicense(data);
      })
      .catch((err) => {
        if (active) {
          setErrorMsg(
            err instanceof Error ? err.message : 'No se pudo verificar la credencial',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="container profile-container">
      <div className="card profile-header-card">
        <div className="flex-row-gap">
          <div className="profile-avatar">
            <Shield width={32} height={32} />
          </div>
          <div>
            <h1>Verificación Pública de Licencia</h1>
            <p>Portal Oficial de Validación — Municipalidad de Baradero</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card text-center">
          <p className="loading-text">Verificando firma criptográfica municipal...</p>
        </div>
      ) : errorMsg || !license?.found ? (
        <div className="card">
          <div className="alert alert-danger spacing-mb-1" role="alert">
            <AlertTriangle width={24} height={24} />
            <div>
              <strong>Credencial Inválida o No Encontrada</strong>
              <p className="spacing-mt-1">
                El código QR escaneado no corresponde a una credencial vigente registrada en la
                Dirección de Tránsito de Baradero.
              </p>
            </div>
          </div>
          <div className="text-center spacing-mt-1">
            <Link to="/login" className="btn btn-secondary">
              <span>Ir al Portal de Trámites</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <div>
              <span className="profile-item-label">Validación Municipal Oficial</span>
              <h2 className="card-title">{license.license_number}</h2>
              <p className="card-subtitle">{license.municipality}</p>
            </div>
            <span
              className={`badge ${
                license.status === 'active'
                  ? 'badge-success'
                  : license.status === 'revoked'
                  ? 'badge-danger'
                  : 'badge-warning'
              }`}
            >
              {license.status === 'active'
                ? 'Vigente'
                : license.status === 'revoked'
                ? 'Revocada'
                : 'Vencida'}
            </span>
          </div>

          <div className="alert alert-success spacing-mb-1">
            <CheckCircle width={20} height={20} />
            <span>Documento oficial verificado en base de datos municipal.</span>
          </div>

          <div className="grid-cols-2 spacing-mb-1">
            <div className="form-group">
              <span className="profile-item-label">Titular Habilitado (Protegido por Ley 25.326)</span>
              <p className="procedure-code-highlight spacing-mt-1">{license.holder}</p>
            </div>

            <div className="form-group">
              <span className="profile-item-label">Categoría Habilitada</span>
              <p className="flex-row-gap spacing-mt-1">
                <Award width={20} height={20} />
                <strong>Categoría {license.category}</strong>
              </p>
            </div>

            <div className="form-group">
              <span className="profile-item-label">Fecha de Emisión</span>
              <p className="spacing-mt-1">
                {license.issued_at
                  ? new Date(license.issued_at).toLocaleDateString('es-AR')
                  : '-'}
              </p>
            </div>

            <div className="form-group">
              <span className="profile-item-label">Fecha de Vencimiento</span>
              <p className="spacing-mt-1">
                {license.expires_at
                  ? new Date(license.expires_at).toLocaleDateString('es-AR')
                  : '-'}
              </p>
            </div>
          </div>

          <div className="text-muted text-center spacing-mt-1">
            <small>
              Verificado el {new Date(license.verified_at).toLocaleString('es-AR')}. Esta consulta
              respeta la Ley Nacional 25.326 de Protección de Datos Personales sin exponer DNI ni
              domicilio.
            </small>
          </div>
        </div>
      )}
    </div>
  );
}
export default VerifyLicense;
