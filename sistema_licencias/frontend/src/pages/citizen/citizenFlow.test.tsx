import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CitizenPanel } from './CitizenPanel';
import { Charlas } from './Charlas';
import { Health } from './Health';
import { TheoryExam } from './TheoryExam';
import * as authContext from '../../context/AuthContext';
import { api } from '../../lib/api';

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    upload: vi.fn(),
  },
}));

describe('Flujo Ciudadano de Licencias - TramitesBAR', () => {
  const mockUser = {
    id: 1,
    email: 'vecino@baradero.gob.ar',
    role: 'citizen' as const,
    status: 'active' as const,
    email_verified: true,
    mfa_enabled: false,
    created_at: '2026-01-01T00:00:00Z',
    profile: {
      first_name: 'Juan',
      last_name: 'Pérez',
      dni_masked: '******89',
      birth_date: '1990-05-15',
      phone: '3329123456',
      address: 'San Martín 123',
      locality: 'Baradero',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authContext.useAuth).mockReturnValue({
      user: mockUser,
      loading: false,
      mfaEnrollmentRequired: false,
      isStaff: false,
      isCitizen: true,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasRole: vi.fn().mockReturnValue(true),
    });
  });

  describe('CitizenPanel', () => {
    it('muestra el catálogo de trámites cuando no hay trámites activos', async () => {
      vi.mocked(api.get).mockImplementation(async (path: string) => {
        if (path === '/procedures/mine') {
          return [];
        }
        if (path === '/catalog/procedure-types') {
          return [
            {
              id: 1,
              code: 'nueva',
              name: 'Licencia Nueva',
              short_description: 'Primera obtención de licencia de conducir en Baradero',
              description: 'Para personas que nunca tuvieron licencia.',
              icon: 'car',
              sort_order: 1,
              matrix: [
                {
                  id: 1,
                  license_category: 'B',
                  min_age: 18,
                  max_age: null,
                  fee_amount: '12500.00',
                  validity_years: 5,
                  steps: ['charlas', 'health', 'theory', 'payment', 'practical', 'delivery'],
                  required_documents: ['health_certificate', 'payment_receipt'],
                  theory_questions: 5,
                  theory_pass_ratio: 0.8,
                  theory_minutes: 20,
                  max_theory_attempts: 1,
                  requires_health: true,
                  requires_practical: true,
                  notes: null,
                },
              ],
            },
          ];
        }
        return [];
      });

      render(
        <MemoryRouter>
          <CitizenPanel />
        </MemoryRouter>,
      );

      expect(screen.getByText('¡Hola, Juan!')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Iniciar Nuevo Trámite de Licencia')).toBeInTheDocument();
        expect(screen.getByText('Licencia Nueva')).toBeInTheDocument();
      });
      expect(screen.queryByText('Iniciar Solicitud de Trámite')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Licencia Nueva/ }));
      expect(screen.getByText('Iniciar Solicitud de Trámite')).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Categoría B' }));
      expect(screen.getByText('Iniciar Solicitud de Trámite')).toBeEnabled();
    });

    it('muestra el Stepper visual de etapas cuando hay un trámite activo', async () => {
      vi.mocked(api.get).mockImplementation(async (path: string) => {
        if (path === '/procedures/mine') {
          return [
            {
              id: 42,
              public_code: 'BAR-2026-42',
              procedure_type_code: 'nueva',
              procedure_type_name: 'Licencia Nueva',
              license_category: 'B',
              status: 'in_progress',
              current_step: 'charlas',
              created_at: '2026-11-01T10:00:00Z',
              completed_at: null,
            },
          ];
        }
        if (path === '/procedures/42') {
          return {
            id: 42,
            public_code: 'BAR-2026-42',
            procedure_type: {
              id: 1,
              code: 'nueva',
              name: 'Licencia Nueva',
              short_description: 'Primera licencia',
              description: 'Primera licencia',
              icon: 'car',
              sort_order: 1,
              matrix: [],
            },
            matrix: {
              id: 1,
              license_category: 'B',
              min_age: 18,
              max_age: null,
              fee_amount: '12500.00',
              validity_years: 5,
              steps: ['charlas', 'health', 'theory', 'practical', 'delivery'],
              required_documents: [],
              theory_questions: 5,
              theory_pass_ratio: 0.8,
              theory_minutes: 20,
              max_theory_attempts: 1,
              requires_health: true,
              requires_practical: true,
              notes: null,
            },
            license_category: 'B',
            status: 'in_progress',
            current_step: 'charlas',
            steps: [
              {
                code: 'charlas',
                label: 'Charlas de seguridad vial',
                position: 1,
                status: 'in_progress',
                data: {},
                notes: null,
                completed_at: null,
              },
              {
                code: 'health',
                label: 'Formulario de salud',
                position: 2,
                status: 'pending',
                data: {},
                notes: null,
                completed_at: null,
              },
              {
                code: 'theory',
                label: 'Examen teórico',
                position: 3,
                status: 'pending',
                data: {},
                notes: null,
                completed_at: null,
              },
              {
                code: 'practical',
                label: 'Examen práctico',
                position: 4,
                status: 'pending',
                data: {},
                notes: null,
                completed_at: null,
              },
              {
                code: 'delivery',
                label: 'Entrega de credencial',
                position: 5,
                status: 'pending',
                data: {},
                notes: null,
                completed_at: null,
              },
            ],
            documents: [],
            payment: null,
            license: null,
            data: {},
            rejection_reason: null,
            created_at: '2026-11-01T10:00:00Z',
            submitted_at: null,
            completed_at: null,
          };
        }
        return [];
      });

      render(
        <MemoryRouter>
          <CitizenPanel />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('BAR-2026-42')).toBeInTheDocument();
        expect(screen.getByText('Charlas Viales')).toBeInTheDocument();
        expect(screen.getByText('Salud')).toBeInTheDocument();
        expect(screen.getAllByText('Examen Teórico').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Ingresar a Charlas Viales')).toBeInTheDocument();
      });
    });
  });

  describe('Charlas', () => {
    it('muestra los módulos y la barra de progreso secuencial', async () => {
      vi.mocked(api.get).mockResolvedValue([
        {
          id: 1,
          code: 'conceptos_basicos',
          title: 'Conceptos Básicos de Tránsito',
          description: 'Reglas fundamentales de circulación y prioridades de paso.',
          kind: 'guide',
          url: null,
          body_md: '## Prioridades de Paso\nEn encrucijadas, la prioridad es de la derecha.',
          sort_order: 1,
        },
        {
          id: 2,
          code: 'senales_viales',
          title: 'Señales de Tránsito',
          description: 'Señales reglamentarias, preventivas e informativas.',
          kind: 'video',
          url: 'https://example.com/video',
          body_md: null,
          sort_order: 2,
        },
      ]);

      render(
        <MemoryRouter initialEntries={['/tramites/42/charlas']}>
          <Routes>
            <Route path="/tramites/:id/charlas" element={<Charlas />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Charlas de Seguridad Vial')).toBeInTheDocument();
        expect(screen.getAllByText('Conceptos Básicos de Tránsito').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Señales de Tránsito')).toBeInTheDocument();
      });
    });
  });

  describe('Health', () => {
    it('renderiza el cuestionario psicofísico y selector de grupo sanguíneo', async () => {
      vi.mocked(api.get).mockResolvedValue({
        id: 42,
        public_code: 'BAR-2026-42',
        license_category: 'B',
        documents: [],
      });

      render(
        <MemoryRouter initialEntries={['/tramites/42/salud']}>
          <Routes>
            <Route path="/tramites/:id/salud" element={<Health />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Formulario de Salud y Certificado Médico')).toBeInTheDocument();
        expect(screen.getByText('1. Grupo y Factor Sanguíneo')).toBeInTheDocument();
        expect(screen.getByText('2. Cuestionario de Salud')).toBeInTheDocument();
        expect(screen.getByText('3. Contacto de Emergencia')).toBeInTheDocument();
        expect(screen.getByText('4. Certificado Médico Oficial')).toBeInTheDocument();
      });
    });
  });

  describe('TheoryExam', () => {
    it('renderiza la pantalla previa de verificación de entorno y proctoring', async () => {
      vi.mocked(api.post).mockResolvedValue({
        room_name: 'exam-BAR-2026-42',
        identity: 'citizen-1',
        token: 'mock-token',
        server_url: 'ws://127.0.0.1:7880',
        participant_name: 'Juan Pérez',
        simulated: true,
      });

      render(
        <MemoryRouter initialEntries={['/tramites/42/examen']}>
          <Routes>
            <Route path="/tramites/:id/examen" element={<TheoryExam />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Verificación de Entorno de Examen')).toBeInTheDocument();
        expect(screen.getByText('Dispositivo y pantalla compatible')).toBeInTheDocument();
        expect(screen.getByText('Cámara de supervisión')).toBeInTheDocument();
        expect(screen.getByText('Sala de supervisión municipal')).toBeInTheDocument();
        expect(screen.getByText('Reglas del Examen Teórico:')).toBeInTheDocument();
        expect(screen.getByText('Comenzar Examen')).toBeInTheDocument();
      });
    });
  });
});
