import AxeBuilder from '@axe-core/playwright';
import { test, expect, mockApi, procedure, expectNoOverflow } from './fixtures';
import type { Page } from '@playwright/test';
import type { DocumentItem, Payment, PaymentInstructions, Procedure } from '../src/lib/types';

// Importes y destinos ficticios exclusivamente de test. No se importan en producción.
const instructions: PaymentInstructions = {
  reference: 'PAGO-PRUEBA-42', amount: '1234.50', status: 'pending',
  alias: 'alias.de.prueba', cbu: '0000000000000000000000', holder: 'Titular de prueba', bank: 'Banco de prueba',
  message: 'Transferí el monto exacto e incluí la referencia en el concepto.',
};
const receipt: DocumentItem = {
  id: 7, kind: 'payment_receipt', original_name: 'comprobante.pdf', mime: 'application/pdf',
  size_bytes: 20, status: 'pending', review_notes: null, created_at: '2026-01-01T12:00:00Z',
};
const claimed: Payment = {
  id: 1, reference: instructions.reference, amount: instructions.amount, method: 'transfer', status: 'claimed',
  receipt_document_id: 7, payer_name: 'Ordenante Prueba', claimed_at: '2026-01-01T12:00:00Z', reviewed_at: null, review_notes: null,
};
const paymentProcedure: Procedure = {
  ...procedure, current_step: 'payment', matrix: { ...procedure.matrix, steps: ['health', 'payment', 'delivery'] },
  steps: [
    { code: 'health', label: 'Salud', position: 1, status: 'completed', completed_at: '2026-01-01T12:00:00Z', data: {}, notes: null },
    { code: 'payment', label: 'Pago', position: 2, status: 'in_progress', completed_at: null, data: {}, notes: null },
    { code: 'delivery', label: 'Entrega', position: 3, status: 'pending', completed_at: null, data: {}, notes: null },
  ],
};

/** Toda lectura queda en memoria y las mutaciones requieren handlers explícitos. */
async function paymentApi(page: Page, proc = paymentProcedure, info = instructions) {
  await mockApi(page);
  const current = { proc, info };
  await page.route('**/api/v1/procedures/mine', (route) => route.fulfill({ json: [{
    id: 42, status: 'in_progress', current_step: 'payment', created_at: proc.created_at,
  }] }));
  await page.route('**/api/v1/procedures/42', (route) => route.fulfill({ json: current.proc }));
  await page.route('**/api/v1/procedures/42/payment/instructions', (route) => route.fulfill({ json: current.info }));
  return current;
}

/** Completa datos controlados; nunca se usa DNI ni un comprobante real. */
async function fillClaim(page: Page) {
  await page.getByRole('textbox', { name: 'Nombre y apellido del ordenante', exact: true }).fill('Ordenante Prueba');
  await page.getByRole('textbox', { name: 'DNI del ordenante', exact: true }).fill('1234567');
  await page.locator('#payment-receipt').setInputFiles({ name: 'comprobante.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nPrueba') });
}

test('panel muestra la etapa real y permite informar un pago sin aprobarlo', async ({ page }) => {
  await paymentApi(page);
  await page.context().addCookies([{ name: 'tb_csrf', value: 'csrf-solo-test', url: 'http://127.0.0.1:4175' }]);
  let uploads = 0;
  let claims = 0;
  await page.route('**/api/v1/procedures/42/documents', async (route) => {
    uploads++;
    expect(route.request().headers()['x-csrf-token']).toBe('csrf-solo-test');
    expect(route.request().postData()).toContain('payment_receipt');
    await route.fulfill({ status: 201, json: receipt });
  });
  await page.route('**/api/v1/procedures/42/payment/claim', async (route) => {
    claims++;
    expect(route.request().headers()['x-csrf-token']).toBe('csrf-solo-test');
    expect(route.request().postDataJSON()).toEqual({
      receipt_document_id: 7, payer_name: 'Ordenante Prueba', payer_dni: '1234567', transfer_date: null, notes: null,
    });
    await route.fulfill({ json: claimed });
  });
  await page.goto('/panel');
  await expect(page.locator('.stepper-step-title')).toHaveText(['Salud', 'Pago del arancel', 'Entrega']);
  await page.getByRole('link', { name: 'Gestionar pago del arancel' }).click();
  await expect(page.getByRole('heading', { name: 'Pago del arancel', exact: true })).toBeVisible();
  await expect(page.getByText('PAGO-PRUEBA-42', { exact: true })).toBeVisible();
  await expect(page.getByText(/1.234,50/)).toBeVisible();
  await fillClaim(page);
  await page.getByRole('button', { name: 'Enviar comprobante para revisión' }).click();
  await expect(page.getByRole('heading', { name: 'Comprobante en revisión', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar comprobante para revisión' })).toHaveCount(0);
  expect(uploads).toBe(1);
  expect(claims).toBe(1);
});

test('datos bancarios ausentes no se inventan ni se anuncian como disponibles', async ({ page }) => {
  await paymentApi(page, paymentProcedure, { ...instructions, alias: null, cbu: null, holder: null, bank: null,
    message: 'Los datos de transferencia están pendientes de configuración municipal.' });
  await page.goto('/tramites/42/pago');
  await expect(page.getByText(/pendientes de configuración municipal/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copiar alias' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copiar CBU' })).toHaveCount(0);
  await expect(page.getByText(/Si ya transferiste con datos confirmados/)).toBeVisible();
});

test('carga fallida no muestra instrucciones viejas y permite reintentar', async ({ page }) => {
  await paymentApi(page);
  let failed = true;
  await page.route('**/api/v1/procedures/42/payment/instructions', (route) => route.fulfill(failed
    ? { status: 503, json: { error: { code: 'unavailable', message: 'No se pudo consultar el arancel.' } } }
    : { json: instructions }));
  await page.goto('/tramites/42/pago');
  await expect(page.getByRole('alert')).toContainText('No se pudo consultar el arancel');
  await expect(page.getByRole('button', { name: 'Enviar comprobante para revisión' })).toHaveCount(0);
  failed = false;
  await page.getByRole('button', { name: 'Actualizar estado' }).click();
  await expect(page.getByText('PAGO-PRUEBA-42', { exact: true })).toBeVisible();
});

test('respuesta perdida requiere consultar y no duplica upload ni declaración', async ({ page }) => {
  const current = await paymentApi(page);
  let uploads = 0;
  let claims = 0;
  await page.route('**/api/v1/procedures/42/documents', async (route) => {
    uploads++;
    current.proc = { ...paymentProcedure, documents: [receipt] };
    await route.fulfill({ json: receipt });
  });
  await page.route('**/api/v1/procedures/42/payment/claim', async (route) => {
    claims++;
    current.info = { ...instructions, status: 'claimed' };
    current.proc = { ...current.proc, payment: claimed };
    await route.fulfill({ status: 503, json: { error: { code: 'unavailable', message: 'Respuesta no disponible.' } } });
  });
  await page.goto('/tramites/42/pago');
  await fillClaim(page);
  await page.getByRole('button', { name: 'Enviar comprobante para revisión' }).click();
  await expect(page.getByRole('alert').first()).toContainText('Respuesta no disponible');
  await expect(page.getByRole('button', { name: 'Enviar comprobante para revisión' })).toBeDisabled();
  await expect(page.getByText(/Actualizá el estado antes de volver a enviar/)).toBeVisible();
  await page.getByRole('button', { name: 'Actualizar estado' }).click();
  await expect(page.getByRole('heading', { name: 'Comprobante en revisión' })).toBeVisible();
  expect(uploads).toBe(1);
  expect(claims).toBe(1);
});

test('rechazo municipal exige nuevo adjunto y escapa sus observaciones', async ({ page }) => {
  await paymentApi(page, { ...paymentProcedure, documents: [receipt], payment: { ...claimed, status: 'rejected',
    review_notes: '<img src=x onerror=alert(1)> Revisá la referencia.' } }, { ...instructions, status: 'rejected' });
  await page.goto('/tramites/42/pago');
  await expect(page.getByRole('heading', { name: 'Pago observado' })).toBeVisible();
  await expect(page.getByText(/<img src=x onerror=alert\(1\)>/)).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enviar comprobante para revisión' })).toBeDisabled();
  await expect(page.locator('#payment-receipt')).toHaveAttribute('required', '');
  await expect(page.locator('label[for="payer-dni"] .required-asterisk')).toHaveText('*');
});

test('estados en revisión, cerrados o desconocidos no permiten reenviar', async ({ page }) => {
  const current = await paymentApi(page);
  for (const [status, title] of [
    ['claimed', 'Comprobante en revisión'], ['pending_second', 'Pendiente de segundo control'],
    ['approved', 'Pago aprobado'], ['refunded', 'Pago reintegrado'], ['unknown', 'Estado de pago no disponible'],
  ]) {
    current.info = { ...instructions, status: status as PaymentInstructions['status'] };
    await page.goto('/tramites/42/pago');
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar comprobante para revisión' })).toHaveCount(0);
  }
  current.proc = { ...paymentProcedure, current_step: 'health' };
  current.info = instructions;
  await page.goto('/tramites/42/pago');
  await expect(page.getByText(/Esta etapa todavía no está habilitada/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar comprobante para revisión' })).toHaveCount(0);
});

test('archivo inválido o rechazado por servidor no declara un pago', async ({ page }) => {
  await paymentApi(page, { ...paymentProcedure, documents: [receipt] });
  let uploads = 0;
  await page.route('**/api/v1/procedures/42/documents', async (route) => {
    uploads++;
    await route.fulfill({ status: 415, json: { error: { code: 'unsupported_file', message: 'El contenido no es un PDF o imagen válido.' } } });
  });
  await page.goto('/tramites/42/pago');
  await page.locator('#payment-receipt').setInputFiles({ name: 'comprobante.html', mimeType: 'text/html', buffer: Buffer.from('<script>prueba</script>') });
  await expect(page.getByRole('alert')).toContainText('Elegí un comprobante');
  await expect(page.getByRole('button', { name: 'Enviar comprobante para revisión' })).toBeDisabled();
  expect(uploads).toBe(0);
  await fillClaim(page);
  await page.getByRole('button', { name: 'Enviar comprobante para revisión' }).click();
  await expect(page.getByRole('alert')).toContainText('contenido no es un PDF o imagen válido');
  expect(uploads).toBe(1);
  await expect(page.locator('#payer-dni')).toHaveValue('1234567');
});

test('si la declaración falló sin guardarse se reutiliza el archivo confirmado, no se sube dos veces', async ({ page }) => {
  const current = await paymentApi(page);
  let uploads = 0;
  let claims = 0;
  await page.route('**/api/v1/procedures/42/documents', async (route) => {
    uploads++;
    current.proc = { ...paymentProcedure, documents: [receipt] };
    await route.fulfill({ status: 201, json: receipt });
  });
  await page.route('**/api/v1/procedures/42/payment/claim', async (route) => {
    claims++;
    await route.fulfill(claims === 1
      ? { status: 503, json: { error: { code: 'unavailable', message: 'No se pudo registrar.' } } }
      : { json: claimed });
  });
  await page.goto('/tramites/42/pago');
  await fillClaim(page);
  await page.getByRole('button', { name: 'Enviar comprobante para revisión' }).click();
  await expect(page.getByRole('button', { name: 'Enviar comprobante para revisión' })).toBeDisabled();
  await page.getByRole('button', { name: 'Actualizar estado' }).click();
  await expect(page.getByRole('textbox', { name: 'Nombre y apellido del ordenante', exact: true })).toHaveValue('Ordenante Prueba');
  await expect(page.getByText(/Adjuntado al trámite: comprobante.pdf/)).toBeVisible();
  await page.getByRole('button', { name: 'Enviar comprobante para revisión' }).click();
  await expect(page.getByRole('heading', { name: 'Comprobante en revisión' })).toBeVisible();
  expect(uploads).toBe(1);
  expect(claims).toBe(2);
});

test('pantalla responsive y accesible con copia rechazada por el navegador', async ({ page }, testInfo) => {
  await paymentApi(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('Permiso denegado en prueba'); } } });
  });
  await page.goto('/tramites/42/pago');
  await page.getByRole('button', { name: 'Copiar referencia', exact: true }).click();
  await expect(page.getByText('No pudimos copiar el dato. Seleccionalo y copialo manualmente.')).toBeVisible();
  await expectNoOverflow(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target }) => target) }))).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('pago-responsive.png'), fullPage: true });
});

test('sin etapa de pago o con ID inválido no presenta una transferencia', async ({ page }) => {
  const current = await paymentApi(page);
  current.proc = procedure;
  await page.goto('/tramites/42/pago');
  await expect(page.getByRole('heading', { name: 'Este trámite no requiere pago' })).toBeVisible();
  await page.goto('/tramites/no-valido/pago');
  await expect(page.getByRole('alert')).toContainText('identificador del trámite no es válido');
  await expect(page.getByRole('button', { name: 'Enviar comprobante para revisión' })).toHaveCount(0);
});
