import { test as base, expect, type Page } from '@playwright/test';
import type { Matrix, Procedure, ProcedureType, User } from '../src/lib/types';

// Datos exclusivamente de prueba; no se importan desde la aplicación ni usan PII real.
export const citizen: User = {
  id: 1, email: 'ciudadano@example.test', role: 'citizen', status: 'active',
  email_verified: true, mfa_enabled: false, created_at: '2026-01-01T12:00:00Z',
  profile: {
    first_name: 'Persona', last_name: 'Prueba', dni_masked: '******00',
    birth_date: '1990-01-01', phone: null, address: null, locality: 'Baradero',
  },
};
const matrix: Matrix = {
  id: 1, license_category: 'B', min_age: 18, max_age: null, fee_amount: '100.00',
  validity_years: 1, steps: ['charlas', 'health', 'delivery'], required_documents: [],
  theory_questions: 5, theory_pass_ratio: 0.8, theory_minutes: 20, max_theory_attempts: 1,
  requires_health: true, requires_practical: false, notes: null,
};
export const catalog: ProcedureType[] = ['nueva', 'renovacion', 'vencida', 'categoria', 'profesional', 'extravio'].map((code, index) => ({
  id: index + 1, code, name: `Trámite de prueba ${index + 1}`, short_description: 'Descripción controlada para comprobar la selección.',
  description: 'Catálogo de prueba, no constituye una regla municipal.', icon: 'file', sort_order: index,
  matrix: [{ ...matrix, id: index + 1 }],
}));
export const procedure: Procedure = {
  id: 42, public_code: 'PRUEBA-42', procedure_type: catalog[0], matrix,
  license_category: 'B', status: 'in_progress', current_step: 'charlas',
  steps: [{ code: 'charlas', label: 'Charlas', position: 1, status: 'in_progress', data: {}, notes: null, completed_at: null }],
  documents: [], payment: null, license: null, data: {}, rejection_reason: null,
  created_at: '2026-01-01T12:00:00Z', submitted_at: null, completed_at: null,
};

/** Intercepta TODA la API; una llamada no prevista falla en vez de alcanzar servicios locales. */
export async function mockApi(page: Page, signedIn = true) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    if (path === '/auth/me') {
      await route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? { user: citizen, csrf_token: '', mfa_enrollment_required: false } : { error: { code: 'unauthenticated', message: 'Sin sesión' } } });
    } else if (path === '/procedures/mine' || path === '/licenses/mine') {
      await route.fulfill({ json: [] });
    } else if (path === '/catalog/procedure-types') {
      await route.fulfill({ json: catalog });
    } else if (path === '/procedures/42') {
      await route.fulfill({ json: procedure });
    } else if (path === '/policies') {
      await route.fulfill({ json: [{ slug: 'politica_prueba', title: 'Política de prueba', version: 1, mandatory: true, content_hash: 'test-only', effective_at: '2026-01-01T12:00:00Z' }] });
    } else {
      await route.abort('blockedbyclient');
      throw new Error(`API no prevista en la prueba: ${route.request().method()} ${path}`);
    }
  });
}

/** Verifica el ancho real, sin esconder desbordes con overflow-x: hidden. */
export async function expectNoOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

export const test = base;
export { expect };
