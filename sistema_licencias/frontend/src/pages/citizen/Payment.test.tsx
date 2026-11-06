import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Payment } from './Payment';

const session = vi.hoisted(() => ({ id: 1 }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: session.id } }) }));
vi.mock('../../lib/api', () => ({
  api: { get: vi.fn(async (path: string) => path.endsWith('/instructions') ? {
    reference: 'PAGO-TEST-42', amount: '100.00', status: 'pending', alias: null,
    cbu: null, holder: null, bank: null, message: 'Configuración de prueba',
  } : {
    id: 42, public_code: 'TEST-42', status: 'in_progress', current_step: 'payment',
    steps: [{ code: 'payment', status: 'in_progress' }], documents: [], payment: null,
  }) },
}));

afterEach(cleanup);

it('no conserva datos del ordenante si cambia la cuenta durante la misma ruta', async () => {
  session.id = 1;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  /** Mantiene el router montado para comprobar el reinicio por identidad, no por recarga. */
  function content() {
    return <QueryClientProvider client={client}><MemoryRouter initialEntries={['/tramites/42/pago']}><Routes><Route path="/tramites/:id/pago" element={<Payment />} /></Routes></MemoryRouter></QueryClientProvider>;
  }
  const view = render(content());
  const name = await screen.findByRole('textbox', { name: 'Nombre y apellido del ordenante' });
  fireEvent.change(name, { target: { value: 'Ordenante anterior' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'DNI del ordenante' }), { target: { value: '1234567' } });
  session.id = 2;
  view.rerender(content());
  expect(await screen.findByRole('textbox', { name: 'Nombre y apellido del ordenante' })).toHaveValue('');
  expect(screen.getByRole('textbox', { name: 'DNI del ordenante' })).toHaveValue('');
  view.unmount();
  client.clear();
});
