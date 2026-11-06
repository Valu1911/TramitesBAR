import AxeBuilder from '@axe-core/playwright';
import { test, expect, mockApi, expectNoOverflow, catalog, procedure } from './fixtures';

test('selección guiada, foco, confirmación y creación única', async ({ page }, testInfo) => {
  await mockApi(page);
  let creations = 0;
  await page.route('**/api/v1/procedures', async (route) => {
    creations++;
    expect(route.request().postDataJSON()).toEqual({ procedure_type: 'nueva', license_category: 'B', data: {} });
    await route.fulfill({ json: procedure });
  });
  await page.goto('/panel');
  await expect(page.locator('#category-section')).toHaveCount(0);
  await page.getByRole('button', { name: /Trámite de prueba 1/ }).click();
  const category = page.getByRole('heading', { name: /2. Seleccioná/ });
  await expect(category).toBeFocused();
  await expect(category).toBeInViewport();
  expect((await category.boundingBox())!.y).toBeGreaterThanOrEqual(72);
  await expect(page.getByRole('button', { name: 'Iniciar Solicitud de Trámite' })).toBeDisabled();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Categoría B', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  const summary = page.getByRole('heading', { name: /3. Revisá/ });
  await expect(summary).toBeFocused();
  await expect(summary).toBeInViewport();
  await expect(page.getByText('No requerido para este trámite')).toBeVisible();
  await expectNoOverflow(page);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(accessibility.violations.map(({ id }) => id)).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('seleccion-responsive.png'), fullPage: true });
  await page.getByRole('button', { name: 'Iniciar Solicitud de Trámite' }).click();
  await expect(page.getByText('PRUEBA-42', { exact: true })).toBeVisible();
  await expect(page.locator('.procedure-hero-card h2')).toBeFocused();
  expect(creations).toBe(1);
  await expect(page.getByRole('link', { name: 'Ingresar a Charlas Viales' })).toHaveAttribute('href', '/tramites/42/charlas');
});

test('cambiar trámite limpia categoría y respeta movimiento reducido', async ({ page }) => {
  await mockApi(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/panel');
  await page.getByRole('button', { name: /Trámite de prueba 1/ }).click();
  await page.getByRole('button', { name: 'Categoría B', exact: true }).click();
  await page.getByRole('button', { name: /Trámite de prueba 2/ }).click();
  await expect(page.locator('#category-heading')).toBeFocused();
  await expect(page.locator('#procedure-summary')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Iniciar Solicitud de Trámite' })).toBeDisabled();
});

test('catálogo sin matriz no permite crear un expediente', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/v1/catalog/procedure-types', (route) => route.fulfill({ json: [{ ...catalog[0], matrix: [] }] }));
  await page.goto('/panel');
  await page.getByRole('button', { name: /Trámite de prueba 1/ }).click();
  await expect(page.getByRole('status')).toContainText('no tiene categorías habilitadas');
  await expect(page.getByRole('button', { name: 'Iniciar Solicitud de Trámite' })).toBeDisabled();
});

test('fallo de carga explícito con reintento, sin catálogo falso', async ({ page }) => {
  await mockApi(page);
  let failed = true;
  await page.route('**/api/v1/licenses/mine', (route) => route.fulfill(failed ? { status: 503, json: { error: { code: 'unavailable', message: 'Servicio no disponible' } } } : { json: [] }));
  await page.goto('/panel');
  await expect(page.getByRole('alert')).toContainText('Servicio no disponible');
  await expect(page.locator('.catalog-grid')).toHaveCount(0);
  failed = false;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByRole('button', { name: /Trámite de prueba 1/ })).toBeVisible();
});

test('error al confirmar conserva la selección y enfoca el mensaje', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/v1/procedures', (route) => route.fulfill({ status: 409, json: { error: { code: 'conflict', message: 'Revisá tu solicitud antes de continuar.' } } }));
  await page.goto('/panel');
  await page.getByRole('button', { name: /Trámite de prueba 1/ }).click();
  await page.getByRole('button', { name: 'Categoría B', exact: true }).click();
  await page.getByRole('button', { name: 'Iniciar Solicitud de Trámite' }).click();
  await expect(page.getByRole('alert')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Categoría B', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('registro marca obligatorios y valida antes de enviar', async ({ page }, testInfo) => {
  await mockApi(page, false);
  await page.goto('/register');
  await expect(page.getByRole('button', { name: 'Crear mi cuenta' })).toBeEnabled();
  for (const id of ['firstName', 'lastName', 'dni', 'birthDate', 'email', 'password', 'confirmPassword']) {
    await expect(page.locator(`label[for="${id}"] .required-asterisk`)).toHaveText('*');
    await expect(page.locator(`#${id}`)).toHaveAttribute('required', '');
  }
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click();
  await expect(page.getByRole('textbox', { name: 'Nombre', exact: true })).toBeFocused();
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Persona');
  await page.getByRole('textbox', { name: 'Apellido', exact: true }).fill('Prueba');
  await page.getByRole('textbox', { name: 'DNI', exact: true }).fill('1234567');
  await page.locator('#birthDate').fill('1990-01-01');
  await page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).fill('formato-invalido');
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click();
  await expect(page.getByRole('textbox', { name: 'Correo electrónico', exact: true })).toBeFocused();
  await expectNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('registro-responsive.png'), fullPage: true });
});

test('políticas caídas bloquean el registro y permiten recuperar', async ({ page }) => {
  await mockApi(page, false);
  await page.route('**/api/v1/policies', (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto('/register');
  await expect(page.getByRole('alert')).toContainText('registro está pausado');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Crear mi cuenta' })).toBeDisabled();
  await page.unroute('**/api/v1/policies');
  await page.getByRole('button', { name: 'Reintentar carga de políticas' }).click();
  await expect(page.getByRole('checkbox')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear mi cuenta' })).toBeEnabled();
});

test('matriz por edad y catálogo vacío no permiten iniciar', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/v1/catalog/procedure-types', (route) => route.fulfill({
    json: [{ ...catalog[0], matrix: [{ ...catalog[0].matrix[0], max_age: 20 }] }],
  }));
  await page.goto('/panel');
  await page.getByRole('button', { name: /Trámite de prueba 1/ }).click();
  await page.getByRole('button', { name: 'Categoría B', exact: true }).click();
  await expect(page.getByText(/admite desde 18 años hasta 20 años/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar Solicitud de Trámite' })).toBeDisabled();
  await page.route('**/api/v1/catalog/procedure-types', (route) => route.fulfill({ json: [] }));
  await page.reload();
  await expect(page.getByRole('status')).toContainText('No hay trámites disponibles');
  await expect(page.getByRole('button', { name: 'Iniciar Solicitud de Trámite' })).toHaveCount(0);
});

test('registro envía consentimiento explícito y conserva datos ante error', async ({ page }) => {
  await mockApi(page, false);
  let accepted = false;
  await page.route('**/api/v1/auth/register', async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      first_name: 'Persona', last_name: 'Prueba', email: 'persona@example.test',
      accepted_policies: ['politica_prueba'], guardian: null,
    });
    await route.fulfill(accepted ? { json: { message: 'Registro recibido' } } : {
      status: 422, json: { error: { code: 'validation', message: 'Revisá los datos ingresados.' } },
    });
  });
  await page.goto('/register');
  await page.locator('#firstName').fill('Persona');
  await page.locator('#lastName').fill('Prueba');
  await page.locator('#dni').fill('1234567');
  await page.locator('#birthDate').fill('1990-01-01');
  await page.locator('#email').fill('persona@example.test');
  await page.locator('#password').fill('ClaveControlada2026');
  await page.locator('#confirmPassword').fill('ClaveControlada2026');
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click();
  await expect(page.getByRole('alert')).toBeFocused();
  await expect(page.locator('#email')).toHaveValue('persona@example.test');
  accepted = true;
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('salud exige elección explícita y envía formulario y certificado', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/v1/procedures/42', (route) => route.fulfill({ json: { ...procedure, current_step: 'health' } }));
  let uploaded = false;
  await page.route('**/api/v1/procedures/42/documents', async (route) => {
    uploaded = true;
    expect(route.request().headers()['content-type']).toContain('multipart/form-data');
    await route.fulfill({ json: { id: 1, kind: 'health_certificate', original_name: 'prueba.pdf', status: 'pending' } });
  });
  await page.route('**/api/v1/procedures/42/health', async (route) => {
    expect(uploaded).toBe(true);
    expect(route.request().postDataJSON().form).toMatchObject({ blood_type: 'no_sabe', emergency_contact_name: 'Contacto Prueba', declares_apt: true });
    await route.fulfill({ json: { ...procedure, status: 'under_review' } });
  });
  await page.goto('/tramites/42/salud');
  await expect(page.locator('#bloodTypeSelect')).toHaveValue('');
  await expect(page.locator('label[for="bloodTypeSelect"] .required-asterisk')).toHaveText('*');
  await page.locator('#bloodTypeSelect').selectOption('no_sabe');
  await page.locator('#emergencyNameInput').fill('Contacto Prueba');
  await page.locator('#emergencyPhoneInput').fill('00000000');
  await page.locator('#certFileInput').setInputFiles({ name: 'prueba.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nTest controlado') });
  await page.locator('#declaresAptCheck').check();
  await page.getByRole('button', { name: 'Enviar Declaración de Salud' }).click();
  await expect(page).toHaveURL(/\/panel$/);
});

test('entrega postal requiere domicilio y confirma la selección', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/v1/procedures/42', (route) => route.fulfill({ json: { ...procedure, current_step: 'delivery' } }));
  await page.route('**/api/v1/procedures/42/delivery', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ method: 'postal', address: 'Domicilio de prueba 123' });
    await route.fulfill({ json: procedure });
  });
  await page.goto('/tramites/42/entrega');
  await page.getByRole('button', { name: /Envío a Domicilio Postal/ }).click();
  await expect(page.getByRole('button', { name: 'Confirmar Forma de Entrega' })).toBeDisabled();
  await expect(page.locator('label[for="delivery-address"] .required-asterisk')).toHaveText('*');
  await page.locator('#delivery-address').fill('Domicilio de prueba 123');
  await expectNoOverflow(page);
  await page.getByRole('button', { name: 'Confirmar Forma de Entrega' }).click();
  await expect(page).toHaveURL(/\/panel$/);
});

test('navegación móvil cierra el menú al cambiar de sección', async ({ page }) => {
  await mockApi(page, false);
  await page.goto('/login');
  const menu = page.getByRole('button', { name: 'Abrir menú' });
  if (await menu.isVisible()) {
    await menu.click();
    await expect(page.getByRole('button', { name: 'Cerrar menú' })).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('link', { name: 'Crear Cuenta', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'false');
  } else {
    await page.getByRole('link', { name: 'Crear Cuenta', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Crear Cuenta Ciudadana' })).toBeVisible();
  await expectNoOverflow(page);
});

for (const path of ['/login', '/register', '/forgot-password', '/reset-password', '/admin/login', '/perfil', '/panel', '/tramites/42/salud', '/tramites/42/entrega']) {
  test(`accesibilidad y ancho real: ${path}`, async ({ page }) => {
    await mockApi(page, ['/perfil', '/panel', '/tramites/42/salud', '/tramites/42/entrega'].includes(path));
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText(/Cargando|Consultando expedientes/)).toHaveCount(0);
    await expectNoOverflow(page);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([]);
  });
}
