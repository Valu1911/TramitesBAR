import { test, expect, citizen, mockApi } from './fixtures';
import type { Page } from '@playwright/test';
import type { Role } from '../src/lib/types';

const roles: { role: Role; home: string; accounts: boolean }[] = [
  { role: 'citizen', home: '/panel', accounts: false },
  { role: 'admin_salud', home: '/admin/tramites', accounts: false },
  { role: 'admin_turnos', home: '/admin/tramites', accounts: false },
  { role: 'admin_pagos', home: '/admin/tramites', accounts: false },
  { role: 'admin_cuentas', home: '/admin/cuentas', accounts: true },
  { role: 'admin', home: '/admin/cuentas', accounts: true },
  { role: 'superadmin', home: '/admin/cuentas', accounts: true },
];

/** Devuelve solo respuestas aisladas; registra consultas para detectar montajes indebidos. */
async function mockRole(page: Page, role: Role, pendingMfa = false) {
  await mockApi(page);
  const adminRequests: string[] = [];
  const payload = {
    user: { ...citizen, role, mfa_enabled: role !== 'citizen' && !pendingMfa },
    csrf_token: '', mfa_enrollment_required: pendingMfa,
  };
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: payload }));
  // Solo lecturas de las pantallas de destino. No se permite ninguna acción staff.
  await page.route('**/api/v1/admin/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    adminRequests.push(path);
    const permitted = !pendingMfa && route.request().method() === 'GET' && (
      (path === '/api/v1/admin/users' && ['admin_cuentas', 'admin', 'superadmin'].includes(role)) ||
      (path === '/api/v1/admin/procedures' && role !== 'citizen') ||
      (path === '/api/v1/admin/payments' && ['admin_pagos', 'admin', 'superadmin'].includes(role))
    );
    if (!permitted) {
      await route.fulfill({ status: 403, json: { error: { code: 'forbidden', message: 'No permitido en esta prueba' } } });
      throw new Error(`La UI montó una lectura staff no permitida: ${role} ${path}`);
    }
    await route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 50 } });
  });
  return { payload, adminRequests };
}

/** Hace visibles los mismos enlaces en desktop y en el menú colapsado móvil. */
async function openMenu(page: Page) {
  const opener = page.getByRole('button', { name: 'Abrir menú' });
  if (await opener.isVisible()) await opener.click();
}

for (const { role, home, accounts } of roles) {
  test(`destinos y enlaces reales sin bucle: ${role}`, async ({ page }) => {
    const { adminRequests } = await mockRole(page, role);
    for (const entry of ['/', '/login', '/admin/login']) {
      await page.goto(entry);
      await expect(page).toHaveURL(new RegExp(`${home}$`));
      await expect(page.locator('h1')).toBeVisible();
    }
    // La ruta denegada sigue denegada; no debe llegar a consultar su recurso.
    const denied = role === 'citizen' ? '/admin/tramites' : accounts ? '/panel' : '/admin/cuentas';
    await page.goto(denied);
    await expect(page).toHaveURL(new RegExp(`${home}$`));
    await openMenu(page);
    await expect(page.getByRole('link', { name: 'Gestión de Cuentas' })).toHaveCount(accounts ? 1 : 0);
    await expect(page.getByRole('link', { name: 'Trámites y Operaciones' })).toHaveCount(role === 'citizen' ? 0 : 1);
    if (!accounts) expect(adminRequests).not.toContain('/api/v1/admin/users');
    if (role === 'citizen') expect(adminRequests).toEqual([]);
    await page.getByRole('link', { name: 'Mi Perfil', exact: true }).click();
    await expect(page).toHaveURL(/\/perfil$/);
    // La marca vuelve al destino permitido y cierra el menú móvil.
    await page.getByRole('link', { name: /Municipalidad de Baradero TramitesBAR/ }).click();
    await expect(page).toHaveURL(new RegExp(`${home}$`));
  });
}

test('MFA pendiente permanece en perfil tras recargar o entrar por URL directa', async ({ page }) => {
  const { adminRequests } = await mockRole(page, 'admin_salud', true);
  for (const path of ['/', '/login', '/admin/login', '/admin/cuentas', '/admin/tramites']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/perfil$/);
    await expect(page.getByRole('heading', { name: 'Persona Prueba', exact: true })).toBeVisible();
  }
  await page.reload();
  await expect(page).toHaveURL(/\/perfil$/);
  await openMenu(page);
  await expect(page.getByRole('link', { name: 'Trámites y Operaciones' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Gestión de Cuentas' })).toHaveCount(0);
  expect(adminRequests).toEqual([]);
});

for (const entry of ['/login', '/admin/login']) {
  test(`login de especialista desde ${entry} usa el destino real del rol`, async ({ page }) => {
    const { payload } = await mockRole(page, 'admin_pagos');
    await page.route('**/api/v1/auth/me', (route) => route.fulfill({ status: 401, json: { error: { code: 'unauthenticated', message: 'Sin sesión' } } }));
    await page.route('**/api/v1/auth/login', async (route) => {
      expect(route.request().postDataJSON()).toMatchObject({ identifier: 'operador@example.test' });
      await route.fulfill({ json: payload });
    });
    await page.goto(entry);
    await page.locator(entry === '/login' ? '#identifier' : '#adminIdentifier').fill('operador@example.test');
    await page.locator(entry === '/login' ? '#password' : '#adminPassword').fill('ClaveControlada2026');
    await page.getByRole('button', { name: entry === '/login' ? 'Ingresar' : 'Ingresar al Backoffice', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/tramites$/);
    await expect(page.getByRole('heading', { name: 'Trámites y Operaciones Municipales' })).toBeVisible();
  });
}
