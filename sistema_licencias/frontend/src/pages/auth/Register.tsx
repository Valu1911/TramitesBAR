import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import type { PolicySummary } from '../../lib/types';
import { Check, AlertTriangle, Eye, EyeOff } from '../../components/Icons';
import { RequiredMark, RequiredFieldsNote, FormError } from '../../components/FormFeedback';

export function Register() {
  const navigate = useNavigate();

  // Datos personales
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dni, setDni] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [locality, setLocality] = useState('Baradero');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Menor de edad y tutor
  const [isMinor, setIsMinor] = useState(false);
  const [guardianFullName, setGuardianFullName] = useState('');
  const [guardianDni, setGuardianDni] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('Madre / Padre');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');

  // Políticas vigentes
  const [policies, setPolicies] = useState<PolicySummary[]>([]);
  const [acceptedPolicies, setAcceptedPolicies] = useState<Record<string, boolean>>({});
  const [policiesLoading, setPoliciesLoading] = useState(true);
  const [policiesError, setPoliciesError] = useState(false);
  const [policiesAttempt, setPoliciesAttempt] = useState(0);

  // Estado general del formulario
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchPolicies = async () => {
      try {
        const data = await api.get<PolicySummary[]>('/policies');
        if (active) {
          if (!data.length) throw new Error('No hay políticas vigentes');
          setPolicies(data);
          const initialMap: Record<string, boolean> = {};
          data.forEach((p) => {
            initialMap[p.slug] = false;
          });
          setAcceptedPolicies(initialMap);
        }
      } catch {
        if (active) {
          // Sin políticas auténticas no se puede registrar consentimiento.
          setPoliciesError(true);
          setPolicies([]);
          setAcceptedPolicies({});
        }
      } finally {
        if (active) setPoliciesLoading(false);
      }
    };
    void fetchPolicies();
    return () => {
      active = false;
    };
  }, [policiesAttempt]);

  /** Permite recuperar una caída sin fabricar versiones de políticas. */
  const handleRetryPolicies = () => {
    setPoliciesLoading(true);
    setPoliciesError(false);
    setPoliciesAttempt((attempt) => attempt + 1);
  };

  const handleFirstNameChange = (e: ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value);
  const handleLastNameChange = (e: ChangeEvent<HTMLInputElement>) => setLastName(e.target.value);
  const handleDniChange = (e: ChangeEvent<HTMLInputElement>) => setDni(e.target.value);
  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value);
  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value);
  const handleAddressChange = (e: ChangeEvent<HTMLInputElement>) => setAddress(e.target.value);
  const handleLocalityChange = (e: ChangeEvent<HTMLInputElement>) => setLocality(e.target.value);
  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value);
  const handleConfirmPasswordChange = (e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value);
  const handleGuardianFullNameChange = (e: ChangeEvent<HTMLInputElement>) => setGuardianFullName(e.target.value);
  const handleGuardianDniChange = (e: ChangeEvent<HTMLInputElement>) => setGuardianDni(e.target.value);
  const handleGuardianRelationshipChange = (e: ChangeEvent<HTMLSelectElement>) => setGuardianRelationship(e.target.value);
  const handleGuardianEmailChange = (e: ChangeEvent<HTMLInputElement>) => setGuardianEmail(e.target.value);
  const handleGuardianPhoneChange = (e: ChangeEvent<HTMLInputElement>) => setGuardianPhone(e.target.value);

  const handleBirthDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBirthDate(val);
    if (!val) {
      setIsMinor(false);
      return;
    }
    const birth = new Date(val);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    setIsMinor(age >= 16 && age < 18);
  };

  const handlePolicyToggle = (slug: string) => {
    setAcceptedPolicies((prev) => ({
      ...prev,
      [slug]: !prev[slug],
    }));
  };

  /** Mantiene un handler estable también en la lista de consentimientos. */
  const handlePolicyChange = (event: ChangeEvent<HTMLInputElement>) => {
    handlePolicyToggle(event.currentTarget.value);
  };

  const handleTogglePassword = () => {
    setShowPassword((prev) => !prev);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (policiesLoading || policiesError || !policies.length || submitting) {
      setError('Esperá a que se carguen las políticas vigentes antes de crear tu cuenta.');
      return;
    }

    const cleanDni = dni.replace(/\D/g, '');
    if (cleanDni.length < 7 || cleanDni.length > 8) {
      setError('El DNI debe tener 7 u 8 dígitos numéricos.');
      return;
    }

    if (password.length < 12) {
      setError('La contraseña debe tener al menos 12 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (isMinor) {
      const cleanGuardianDni = guardianDni.replace(/\D/g, '');
      if (!guardianFullName.trim()) {
        setError('Por favor, indicá el nombre completo del tutor legal.');
        return;
      }
      if (cleanGuardianDni.length < 7 || cleanGuardianDni.length > 8) {
        setError('El DNI del tutor debe tener 7 u 8 dígitos.');
        return;
      }
    }

    const mandatorySlugs = policies.filter((p) => p.mandatory).map((p) => p.slug);
    const missingPolicies = mandatorySlugs.some((slug) => !acceptedPolicies[slug]);
    if (missingPolicies) {
      setError('Tenés que aceptar las políticas y condiciones obligatorias para registrarte.');
      return;
    }

    const payloadAcceptedPolicies = Object.keys(acceptedPolicies).filter(
      (slug) => acceptedPolicies[slug]
    );

    setSubmitting(true);
    try {
      await api.post('/auth/register', {
        email: email.trim().toLowerCase(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        dni: cleanDni,
        birth_date: birthDate,
        phone: phone.trim() || null,
        address: address.trim() || null,
        locality: locality.trim() || 'Baradero',
        accepted_policies: payloadAcceptedPolicies,
        guardian: isMinor
          ? {
              full_name: guardianFullName.trim(),
              dni: guardianDni.replace(/\D/g, ''),
              relationship: guardianRelationship.trim(),
              email: guardianEmail.trim() || null,
              phone: guardianPhone.trim() || null,
            }
          : null,
      });

      navigate('/login', {
        state: {
          notice:
            '¡Registro completado! Te enviamos un correo electrónico de verificación. Revisá tu bandeja de entrada o spam.',
        },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'No pudimos registrar tu cuenta. Revisá los campos.');
      } else {
        setError('Ocurrió un error inesperado al procesar el registro.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card auth-card-wide">
        <div className="auth-header">
          <Link to="/">
            <img src="/isologo.svg" alt="Municipalidad de Baradero" className="auth-logo" />
          </Link>
          <h1>Crear Cuenta Ciudadana</h1>
          <p>Registrate para iniciar o renovar tu licencia de conducir en Baradero.</p>
        </div>

        {error && <FormError message={error} />}

        <form onSubmit={handleSubmit}>
          <RequiredFieldsNote />
          <div className="grid-cols-2">
            <div className="form-group">
              <label htmlFor="firstName" className="form-label">
                Nombre<RequiredMark />
              </label>
              <input
                id="firstName"
                type="text"
                className="input"
                value={firstName}
                onChange={handleFirstNameChange}
                placeholder="Ej: Juan"
                autoComplete="given-name"
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="lastName" className="form-label">
                Apellido<RequiredMark />
              </label>
              <input
                id="lastName"
                type="text"
                className="input"
                value={lastName}
                onChange={handleLastNameChange}
                placeholder="Ej: Pérez"
                autoComplete="family-name"
                required
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label htmlFor="dni" className="form-label">
                DNI<RequiredMark />
              </label>
              <input
                id="dni"
                type="text"
                inputMode="numeric"
                className="input"
                value={dni}
                onChange={handleDniChange}
                placeholder="Sin puntos ni espacios"
                maxLength={8}
                pattern="[0-9]{7,8}"
                required
                disabled={submitting}
              />
              <span className="form-hint">7 u 8 números corridos.</span>
            </div>

            <div className="form-group">
              <label htmlFor="birthDate" className="form-label">
                Fecha de nacimiento<RequiredMark />
              </label>
              <input
                id="birthDate"
                type="date"
                autoComplete="bday"
                className="input"
                value={birthDate}
                onChange={handleBirthDateChange}
                required
                disabled={submitting}
              />
              <span className="form-hint">Edad mínima para iniciar trámite: 16 años.</span>
            </div>
          </div>

          {isMinor && (
            <div className="card guardian-card">
              <div className="card-header">
                <span className="card-title guardian-card-title">
                  Autorización de Tutor Legal (Menor de 18 años)
                </span>
                <span className="badge badge-warning">Requerido</span>
              </div>
              <p className="guardian-card-desc">
                De acuerdo con la normativa vigente, los postulantes menores de 18 años deben contar
                con el consentimiento firmado de su padre, madre o tutor legal.
              </p>

              <div className="grid-cols-2">
                <div className="form-group">
                  <label htmlFor="guardianFullName" className="form-label">
                    Nombre y apellido del tutor<RequiredMark />
                  </label>
                  <input
                    id="guardianFullName"
                    type="text"
                    className="input"
                    value={guardianFullName}
                    onChange={handleGuardianFullNameChange}
                    placeholder="Ej: María Gómez"
                    required={isMinor}
                    disabled={submitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="guardianDni" className="form-label">
                    DNI del tutor<RequiredMark />
                  </label>
                  <input
                    id="guardianDni"
                    type="text"
                    inputMode="numeric"
                    className="input"
                    value={guardianDni}
                    onChange={handleGuardianDniChange}
                    placeholder="Sin puntos ni espacios"
                    maxLength={8}
                    required={isMinor}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="grid-cols-2">
                <div className="form-group">
                  <label htmlFor="guardianRelationship" className="form-label">
                    Vínculo<RequiredMark />
                  </label>
                  <select
                    id="guardianRelationship"
                    className="select"
                    value={guardianRelationship}
                    required
                    onChange={handleGuardianRelationshipChange}
                    disabled={submitting}
                  >
                    <option value="Madre / Padre">Madre / Padre</option>
                    <option value="Tutor Legal">Tutor Legal judicialmente designado</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="guardianPhone" className="form-label">
                    Teléfono del tutor (opcional)
                  </label>
                  <input
                    id="guardianPhone"
                    type="tel"
                    className="input"
                    value={guardianPhone}
                    onChange={handleGuardianPhoneChange}
                    placeholder="Ej: 3329123456"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="guardianEmail" className="form-label">
                  Correo electrónico del tutor (opcional)
                </label>
                <input
                  id="guardianEmail"
                  type="email"
                  className="input"
                  value={guardianEmail}
                  onChange={handleGuardianEmailChange}
                  placeholder="tutor@ejemplo.com"
                  disabled={submitting}
                />
              </div>
            </div>
          )}

          <div className="grid-cols-2">
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Correo electrónico<RequiredMark />
              </label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={handleEmailChange}
                placeholder="vecino@ejemplo.com"
                autoComplete="email"
                required
                disabled={submitting}
              />
              <span className="form-hint">Te enviaremos el enlace para activar tu cuenta.</span>
            </div>

            <div className="form-group">
              <label htmlFor="phone" className="form-label">
                Teléfono de contacto (opcional)
              </label>
              <input
                id="phone"
                type="tel"
                className="input"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="Ej: 3329123456"
                autoComplete="tel"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label htmlFor="address" className="form-label">
                Dirección en Baradero (opcional)
              </label>
              <input
                id="address"
                type="text"
                className="input"
                value={address}
                onChange={handleAddressChange}
                placeholder="Calle y número"
                autoComplete="street-address"
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="locality" className="form-label">
                Localidad (opcional)
              </label>
              <input
                id="locality"
                type="text"
                className="input"
                value={locality}
                onChange={handleLocalityChange}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Contraseña<RequiredMark />
              </label>
              <div className="input-password-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input input-password"
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Mínimo 12 caracteres"
                  autoComplete="new-password"
                  minLength={12}
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={handleTogglePassword}
                  className="password-toggle-btn"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff width={18} height={18} /> : <Eye width={18} height={18} />}
                </button>
              </div>
              <span className="form-hint">Al menos 12 caracteres, con letras y números.</span>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirmar contraseña<RequiredMark />
              </label>
              <div className="input-password-wrapper">
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  className="input input-password"
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  placeholder="Repetí la contraseña"
                  autoComplete="new-password"
                  minLength={12}
                  required
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          <div className="policies-section">
            <span className="form-label policies-title">
              Políticas y Términos Municipales
            </span>

            {policiesLoading ? (
              <p className="loading-text">Cargando políticas vigentes...</p>
            ) : policiesError ? (
              <div className="alert alert-warning" role="alert">
                <AlertTriangle width={20} height={20} />
                <div>
                  <p>No pudimos cargar las políticas vigentes. El registro está pausado para proteger tu consentimiento.</p>
                  <button type="button" className="btn btn-secondary spacing-mt-1" onClick={handleRetryPolicies}>Reintentar carga de políticas</button>
                </div>
              </div>
            ) : (
              policies.map((p) => (
                <label key={p.slug} className="checkbox-group">
                  <input
                    type="checkbox"
                    checked={Boolean(acceptedPolicies[p.slug])}
                    value={p.slug}
                    onChange={handlePolicyChange}
                    disabled={submitting}
                    required={p.mandatory}
                  />
                  <span className="checkbox-label">
                    Acepto los{' '}
                    <strong>{p.title}</strong> (Versión {p.version}){' '}
                    {p.mandatory && <RequiredMark />}
                  </span>
                </label>
              ))
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block btn-lg"
            disabled={submitting || policiesLoading || policiesError || !policies.length}
          >
            <Check width={18} height={18} />
            <span>{submitting ? 'Procesando registro...' : 'Crear mi cuenta'}</span>
          </button>
        </form>

        <div className="auth-footer">
          <p>
            ¿Ya tenés una cuenta en el sistema?{' '}
            <Link to="/login">Iniciá sesión acá</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
