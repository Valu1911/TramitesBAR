import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';
import { Login } from './pages/auth/Login';
import { AdminLogin } from './pages/admin/AdminLogin';
import { useAuth } from './context/AuthContext';
import { ApiError } from './lib/api';
import type { Role, SessionPayload, User } from './lib/types';
import { getNavigation } from './lib/navigation';

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('./context/AuthContext', () => ({ useAuth: vi.fn() }));
// Inspeccionamos el primer rechazo sin montar un bucle defectuoso de Navigate.
// Playwright comprueba por separado las redirecciones reales en el navegador.
vi.mock('react-router-dom', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-router-dom')>(),
  useNavigate: () => navigate,
  Navigate: ({ to }: { to: string }) => <div data-testid="redirect">{to}</div>,
}));
vi.mock('./pages/citizen/CitizenPanel', () => ({ CitizenPanel: () => <h1>Panel permitido</h1> }));
vi.mock('./pages/citizen/Profile', () => ({ Profile: () => <h1>Perfil permitido</h1> }));
vi.mock('./pages/admin/AdminAccounts', () => ({ AdminAccounts: () => <h1>Cuentas permitidas</h1> }));
vi.mock('./pages/admin/AdminProcedures', () => ({ AdminProcedures: () => <h1>Trámites permitidos</h1> }));

// Expectativas independientes del código de navegación y de los permisos del servidor.
const cases: { role: Role; home: string; accounts: boolean }[] = [
  { role: 'citizen', home: '/panel', accounts: false },
  { role: 'admin_salud', home: '/admin/tramites', accounts: false },
  { role: 'admin_turnos', home: '/admin/tramites', accounts: false },
  { role: 'admin_pagos', home: '/admin/tramites', accounts: false },
  { role: 'admin_cuentas', home: '/admin/cuentas', accounts: true },
  { role: 'admin', home: '/admin/cuentas', accounts: true },
  { role: 'superadmin', home: '/admin/cuentas', accounts: true },
];

/** Usa únicamente una identidad controlada; no realiza login ni consultas reales. */
function identity(role: Role): User {
  return { id: 1, email: 'operador@example.test', role, status: 'active', email_verified: true,
    mfa_enabled: role !== 'citizen', profile: null, created_at: '2026-01-01T12:00:00Z' };
}

/** Prepara el contexto sin relajar ninguna allowlist del router. */
function setSession(role: Role | null, pendingMfa = false, loading = false) {
  const user = role ? { ...identity(role), mfa_enabled: role !== 'citizen' && !pendingMfa } : null;
  const context = {
    user, loading, mfaEnrollmentRequired: pendingMfa,
    isStaff: Boolean(role && role !== 'citizen'), isCitizen: role === 'citizen',
    login: vi.fn(), logout: vi.fn(), refreshUser: vi.fn(), hasRole: vi.fn(),
  };
  vi.mocked(useAuth).mockReturnValue(context);
  return context;
}

/** Monta el router productivo; solo las vistas finales se reemplazan por sentinelas. */
function renderPath(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe.each(cases)('Navegación de $role', ({ role, home, accounts }) => {
  it.each(['/', '/login', '/admin/login'])('elige destino válido desde %s', async (path) => {
    setSession(role);
    renderPath(path);
    expect(await screen.findByTestId('redirect')).toHaveTextContent(home);
  });

  it('conserva la allowlist de cuentas y oculta enlaces no permitidos', async () => {
    setSession(role);
    renderPath('/admin/cuentas');
    if (accounts) expect(await screen.findByText('Cuentas permitidas')).toBeInTheDocument();
    else expect(await screen.findByTestId('redirect')).toHaveTextContent(home);
    expect(Boolean(screen.queryByRole('link', { name: 'Gestión de Cuentas' }))).toBe(accounts);
    expect(Boolean(screen.queryByRole('link', { name: 'Trámites y Operaciones' }))).toBe(role !== 'citizen');
  });

  it('conserva la allowlist de trámites', async () => {
    setSession(role);
    renderPath('/admin/tramites');
    if (role !== 'citizen') expect(await screen.findByText('Trámites permitidos')).toBeInTheDocument();
    else expect(await screen.findByTestId('redirect')).toHaveTextContent('/panel');
  });

  it('no permite al personal entrar en una ruta ciudadana', async () => {
    setSession(role);
    renderPath('/panel');
    if (role === 'citizen') expect(await screen.findByText('Panel permitido')).toBeInTheDocument();
    else expect(await screen.findByTestId('redirect')).toHaveTextContent(home);
  });

  it.each(['ciudadano', 'municipal'])('resuelve el login %s sin cambiar roles', async (entry) => {
    const context = setSession(null);
    const payload: SessionPayload = { user: identity(role), csrf_token: '', mfa_enrollment_required: false };
    context.login.mockResolvedValue(payload);
    render(<MemoryRouter>{entry === 'municipal' ? <AdminLogin /> : <Login />}</MemoryRouter>);
    fireEvent.change(screen.getByRole('textbox', { name: entry === 'municipal' ? 'Correo oficial o DNI' : 'DNI o Correo electrónico' }), { target: { value: 'operador@example.test' } });
    fireEvent.change(screen.getByLabelText(/Contraseña/), { target: { value: 'ClaveControlada2026' } });
    fireEvent.click(screen.getByRole('button', { name: entry === 'municipal' ? 'Ingresar al Backoffice' : 'Ingresar' }));
    await waitFor(() => expect(context.login).toHaveBeenCalledTimes(1));
    if (entry === 'municipal' && role === 'citizen') {
      await waitFor(() => expect(context.logout).toHaveBeenCalledOnce());
      expect(navigate).not.toHaveBeenCalled();
      expect(await screen.findByRole('alert')).toHaveTextContent('cuenta pertenece a un ciudadano');
    } else await waitFor(() => expect(navigate).toHaveBeenCalledWith(home));
  });
});

describe.each(cases.filter(({ role }) => role !== 'citizen'))('Enrolamiento MFA de $role', ({ role }) => {
  it.each(['/', '/login', '/admin/login', '/admin/cuentas', '/admin/tramites', '/panel'])('dirige %s al perfil sin abrir operaciones', async (path) => {
    setSession(role, true);
    renderPath(path);
    expect(await screen.findByTestId('redirect')).toHaveTextContent('/perfil');
    expect(screen.queryByRole('link', { name: 'Gestión de Cuentas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Trámites y Operaciones' })).not.toBeInTheDocument();
  });

  it('mantiene accesible el perfil para completar el enrolamiento', async () => {
    setSession(role, true);
    renderPath('/perfil');
    expect(await screen.findByText('Perfil permitido')).toBeInTheDocument();
    expect(screen.queryByTestId('redirect')).not.toBeInTheDocument();
  });

  it.each(['ciudadano', 'municipal'])('el login %s no pierde la obligación de MFA', async (entry) => {
    const context = setSession(null);
    context.login.mockResolvedValue({ user: { ...identity(role), mfa_enabled: false }, csrf_token: '', mfa_enrollment_required: true });
    render(<MemoryRouter>{entry === 'municipal' ? <AdminLogin /> : <Login />}</MemoryRouter>);
    fireEvent.change(screen.getByRole('textbox', { name: entry === 'municipal' ? 'Correo oficial o DNI' : 'DNI o Correo electrónico' }), { target: { value: 'operador@example.test' } });
    fireEvent.change(screen.getByLabelText(/Contraseña/), { target: { value: 'ClaveControlada2026' } });
    fireEvent.click(screen.getByRole('button', { name: entry === 'municipal' ? 'Ingresar al Backoffice' : 'Ingresar' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/perfil'));
  });
});

it.each([
  { path: '/', target: '/login' }, { path: '/panel', target: '/login' },
  { path: '/admin/cuentas', target: '/admin/login' }, { path: '/admin/tramites', target: '/admin/login' },
])('sin sesión: $path dirige a $target', async ({ path, target }) => {
  setSession(null);
  renderPath(path);
  expect(await screen.findByTestId('redirect')).toHaveTextContent(target);
});

it('no decide un destino mientras carga la sesión', () => {
  setSession(null, false, true);
  renderPath('/admin/cuentas');
  expect(screen.queryByTestId('redirect')).not.toBeInTheDocument();
  expect(screen.getByText('Verificando sesión municipal...')).toBeInTheDocument();
});

it('un desafío TOTP no redirige ni se saltea al reintentar', async () => {
  const context = setSession(null);
  context.login.mockRejectedValueOnce(new ApiError(401, 'mfa_required', 'Código requerido', null));
  context.login.mockResolvedValueOnce({ user: identity('admin_salud'), csrf_token: '', mfa_enrollment_required: false });
  render(<MemoryRouter><Login /></MemoryRouter>);
  fireEvent.change(screen.getByRole('textbox', { name: 'DNI o Correo electrónico' }), { target: { value: 'operador@example.test' } });
  fireEvent.change(screen.getByLabelText(/Contraseña/), { target: { value: 'ClaveControlada2026' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
  const code = await screen.findByRole('textbox', { name: /Código de segundo factor/ });
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.change(code, { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/admin/tramites'));
  expect(context.login).toHaveBeenLastCalledWith('operador@example.test', 'ClaveControlada2026', '123456');
});

it.each([null, 'desconocido', '__proto__'])('un rol no reconocido (%s) no recibe navegación administrativa', (role) => {
  expect(getNavigation(role as Role | null, true)).toEqual({ home: '/login', showAccounts: false, showProcedures: false });
});

it('al completar MFA habilita enlaces sin sacar al usuario de sus códigos de recuperación', async () => {
  setSession('admin_salud', true);
  const view = renderPath('/perfil');
  expect(await screen.findByText('Perfil permitido')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Trámites y Operaciones' })).not.toBeInTheDocument();
  setSession('admin_salud');
  view.rerender(<MemoryRouter initialEntries={['/perfil']}><App /></MemoryRouter>);
  expect(await screen.findByRole('link', { name: 'Trámites y Operaciones' })).toBeInTheDocument();
  expect(screen.queryByTestId('redirect')).not.toBeInTheDocument();
});
