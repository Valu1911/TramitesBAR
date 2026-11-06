import AxeBuilder from '@axe-core/playwright';
import { test, expect, citizen, procedure, mockApi, expectNoOverflow } from './fixtures';
import type { Page } from '@playwright/test';
import type { Role } from '../src/lib/types';

const payment = {
  id: 7, procedure_id: 42, procedure_code: 'EXP-PRUEBA-42', reference: 'PAGO-PRUEBA-42',
  amount: '150000.00', method: 'transfer', status: 'claimed', receipt_document_id: 9,
  payer_name: 'Ordenante de prueba', claimed_at: '2026-01-01T12:00:00Z', reviewed_at: null,
  review_notes: null as string | null, citizen_name: 'Persona de prueba', citizen_email: 'persona@example.test',
  reviewed_by: null as number | null, second_reviewed_by: null as number | null,
};

/** El banco y el personal no existen: cada operación queda interceptada solo dentro del test. */
async function staffApi(page: Page, role: Role = 'admin_pagos') {
  await mockApi(page);
  const state = { payment: { ...payment }, reads: [] as string[], queries: [] as string[], reviews: [] as unknown[], nextStatus: 'approved', failReview: false, failList: false, total: 1, procedures: [] as unknown[] };
  await page.context().addCookies([{ name: 'tb_csrf', value: 'csrf-staff-test', url: 'http://127.0.0.1:4175' }]);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: {
    user: { ...citizen, id: 11, role, mfa_enabled: true }, mfa_enrollment_required: false, csrf_token: 'csrf-staff-test',
  } }));
  await page.route('**/api/v1/admin/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    if (request.method() === 'GET') state.reads.push(path);
    if (request.method() === 'GET' && path === '/admin/procedures') {
      await route.fulfill({ json: { items: state.procedures, total: state.procedures.length, page: 1, page_size: 25 } });
    } else if (request.method() === 'GET' && path === '/admin/payments') {
      if (!['admin_pagos', 'admin', 'superadmin'].includes(role)) throw new Error('Lectura de pagos fuera del rol');
      const status = url.searchParams.get('status');
      const q = url.searchParams.get('q');
      const offset = Number(url.searchParams.get('offset') || 0);
      state.queries.push(url.search);
      const matches = (!status || status === state.payment.status) && (!q || state.payment.reference.includes(q));
      const items = matches ? [offset ? { ...state.payment, id: 8, reference: 'PAGO-PAGINA-2' } : state.payment] : [];
      await route.fulfill(state.failList ? { status: 503, json: { error: { code: 'unavailable', message: 'No pudimos consultar pagos.' } } } : { json: { items, total: matches ? state.total : 0, page: Math.floor(offset / 25) + 1, page_size: 25 } });
    } else if (request.method() === 'GET' && path === '/admin/payments/7') {
      await route.fulfill({ json: state.payment });
    } else if (request.method() === 'POST' && path === '/admin/payments/7/review') {
      expect(request.headers()['x-csrf-token']).toBe('csrf-staff-test');
      const data = request.postDataJSON();
      state.reviews.push(data);
      if (!state.failReview) {
        state.payment = { ...state.payment, status: data.decision === 'reject' ? 'rejected' : state.nextStatus,
          reviewed_by: state.payment.reviewed_by ?? 11, review_notes: data.notes,
          second_reviewed_by: state.payment.status === 'pending_second' ? 11 : null };
      }
      await route.fulfill(state.failReview ? { status: 503, json: { error: { code: 'unavailable', message: 'Respuesta de revisión no disponible.' } } } : { json: state.payment });
    } else {
      await route.abort();
      throw new Error(`Solicitud no prevista: ${request.method()} ${path}`);
    }
  });
  return state;
}

test('Pagos accede a su bandeja, revisa el comprobante y registra solo el primer control', async ({ page }) => {
  const state = await staffApi(page);
  state.nextStatus = 'pending_second';
  await page.goto('/admin/tramites');
  await expect(page.getByRole('button', { name: 'Pagos y comprobantes', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Examen Práctico y Turnos/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Revisar pago PAGO-PRUEBA-42', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Ver comprobante', exact: true })).toHaveAttribute('href', '/api/v1/admin/procedures/42/documents/9/download');
  await page.getByLabel('Decisión de revisión').selectOption('approve');
  await page.getByRole('button', { name: 'Confirmar aprobación', exact: true }).click();
  await expect(page.getByText('Primera aprobación registrada. El pago sigue pendiente de otro control.')).toBeVisible();
  await expect(page.getByText('Otra persona debe completar la segunda aprobación.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar aprobación', exact: true })).toBeDisabled();
  expect(state.reviews).toEqual([{ decision: 'approve', notes: null }]);
});

test('el rechazo exige un motivo y no se anuncia como pago aprobado', async ({ page }) => {
  const state = await staffApi(page);
  await page.goto('/admin/tramites');
  await page.getByRole('button', { name: 'Revisar pago PAGO-PRUEBA-42', exact: true }).click();
  await page.getByLabel('Decisión de revisión').selectOption('reject');
  await page.getByRole('button', { name: 'Confirmar rechazo', exact: true }).click();
  expect(state.reviews).toHaveLength(0);
  await page.getByLabel('Motivo del rechazo').fill('La referencia no coincide.');
  await page.getByRole('button', { name: 'Confirmar rechazo', exact: true }).click();
  await expect(page.getByText('Rechazo registrado con observaciones.')).toBeVisible();
  expect(state.reviews).toEqual([{ decision: 'reject', notes: 'La referencia no coincide.' }]);
});

test('un segundo revisor distinto puede completar el control', async ({ page }) => {
  const state = await staffApi(page);
  state.payment.status = 'pending_second'; state.payment.reviewed_by = 8;
  await page.goto('/admin/tramites');
  await page.getByRole('button', { name: 'Revisar pago PAGO-PRUEBA-42', exact: true }).click();
  await page.getByLabel('Decisión de revisión').selectOption('approve');
  await page.getByRole('button', { name: 'Confirmar aprobación', exact: true }).click();
  await expect(page.getByText('Pago aprobado por la Municipalidad.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Decisión de revisión')).toHaveCount(0);
  expect(state.payment.reviewed_by).toBe(8);
  expect(state.payment.second_reviewed_by).toBe(11);
});

test('búsqueda y paginación consultan al servidor, no filtran una lista incompleta', async ({ page }) => {
  const state = await staffApi(page);
  state.total = 26;
  await page.goto('/admin/tramites');
  await page.getByRole('button', { name: 'Página siguiente' }).click();
  await expect(page.getByRole('heading', { name: 'PAGO-PAGINA-2' })).toBeVisible();
  expect(state.queries.at(-1)).toContain('offset=25');
  await page.getByRole('button', { name: 'Página anterior' }).click();
  await expect(page.getByRole('heading', { name: 'PAGO-PRUEBA-42', exact: true })).toBeVisible();
  await page.getByLabel('Buscar por referencia, expediente o correo').fill('PRUEBA');
  expect(state.queries.at(-1)).not.toContain('q=');
  await page.getByRole('button', { name: 'Buscar pagos' }).click();
  await expect.poll(() => state.queries.at(-1)).toContain('q=PRUEBA');
  await page.getByLabel('Estado del pago', { exact: true }).selectOption('approved');
  await expect(page.getByText('No hay pagos para los filtros elegidos.')).toBeVisible();
  expect(state.queries.at(-1)).toContain('status=approved');
});

test('fallo de consulta no aparece como bandeja vacía y se puede reintentar', async ({ page }) => {
  const state = await staffApi(page); state.failList = true;
  await page.goto('/admin/tramites');
  await expect(page.getByRole('alert')).toContainText('No pudimos consultar pagos.');
  await expect(page.getByText('No hay pagos para los filtros elegidos.')).toHaveCount(0);
  state.failList = false;
  await page.getByRole('button', { name: 'Actualizar pagos' }).click();
  await expect(page.getByRole('button', { name: 'Revisar pago PAGO-PRUEBA-42', exact: true })).toBeVisible();
});

test('respuesta incierta exige actualizar el detalle antes de decidir otra vez', async ({ page }) => {
  const state = await staffApi(page); state.failReview = true;
  await page.goto('/admin/tramites');
  await page.getByRole('button', { name: 'Revisar pago PAGO-PRUEBA-42', exact: true }).click();
  await page.getByLabel('Decisión de revisión').selectOption('approve');
  await page.getByRole('button', { name: 'Confirmar aprobación', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Respuesta de revisión no disponible.');
  await expect(page.getByRole('button', { name: 'Confirmar aprobación', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Actualizar pagos' }).click();
  await expect(page.getByRole('button', { name: 'Confirmar aprobación', exact: true })).toBeDisabled();
  state.payment.status = 'approved';
  await page.getByRole('button', { name: 'Actualizar detalle' }).click();
  await expect(page.getByLabel('Decisión de revisión')).toHaveCount(0);
  expect(state.reviews).toHaveLength(1);
});

test('un fallo al recargar la lista no convierte una aprobación confirmada en fallo', async ({ page }) => {
  const state = await staffApi(page);
  await page.goto('/admin/tramites');
  await page.getByRole('button', { name: 'Revisar pago PAGO-PRUEBA-42', exact: true }).click();
  await page.getByLabel('Decisión de revisión').selectOption('approve');
  state.failList = true;
  await page.getByRole('button', { name: 'Confirmar aprobación', exact: true }).click();
  await expect(page.getByText('Pago aprobado por la Municipalidad.', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('No pudimos consultar pagos.');
  expect(state.reviews).toHaveLength(1);
});

test('estados no revisables son solo lectura y las observaciones se escapan', async ({ page }) => {
  const state = await staffApi(page);
  state.payment.review_notes = '<img src=x onerror=alert(1)> Nota de prueba';
  for (const status of ['pending', 'approved', 'rejected', 'refunded', 'unknown']) {
    state.payment.status = status;
    await page.goto('/admin/tramites');
    await page.getByRole('button', { name: 'Revisar pago PAGO-PRUEBA-42', exact: true }).click();
    await expect(page.getByText(/<img src=x onerror=alert\(1\)>/)).toBeVisible();
    await expect(page.getByLabel('Decisión de revisión')).toHaveCount(0);
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
  }
});

test('la consola y el detalle son accesibles y no desbordan el móvil', async ({ page }, testInfo) => {
  await staffApi(page);
  await page.goto('/admin/tramites');
  await page.getByRole('button', { name: 'Revisar pago PAGO-PRUEBA-42', exact: true }).click();
  await expect(page.getByLabel('Decisión de revisión')).toBeVisible();
  await expectNoOverflow(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target }) => target) }))).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('revision-pagos-responsive.png'), fullPage: true });
});

for (const role of ['admin_salud', 'admin_turnos', 'admin_cuentas', 'citizen'] as const) {
  test(`${role} no monta una bandeja financiera ni muestra acciones de pago`, async ({ page }) => {
    const state = await staffApi(page, role);
    await page.goto('/admin/tramites');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pagos y comprobantes', exact: true })).toHaveCount(0);
    expect(state.reads.some((path) => path.startsWith('/admin/payments'))).toBe(false);
  });
}

test('Pagos no puede revisar certificados desde el detalle general del expediente', async ({ page }) => {
  const state = await staffApi(page);
  state.procedures = [{ ...procedure, citizen: { name: 'Persona prueba', dni_masked: '******00' },
    documents: [{ id: 9, kind: 'health_certificate', status: 'pending', original_name: 'salud.pdf', size_bytes: 100 }] }];
  await page.goto('/admin/tramites');
  await page.getByRole('button', { name: 'Expedientes y Salud', exact: true }).click();
  await page.getByRole('button', { name: 'Detalle', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aprobar Certificado', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rechazar', exact: true })).toHaveCount(0);
});
