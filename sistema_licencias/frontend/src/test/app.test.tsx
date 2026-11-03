/**
 * Pruebas unitarias y de integración de la interfaz de TramitesBAR.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShellRoutes } from "@/App";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("TramitesBAR Frontend", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.cookie = "tb_csrf=; Max-Age=0; path=/";
  });

  it("envía el token CSRF desde la cookie tb_csrf en mutaciones HTTP y construye la URL sin duplicar /api/v1", async () => {
    document.cookie = "tb_csrf=token-csrf-baradero-2026; path=/";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => jsonResponse({ message: "ok" }));

    await api.get("/catalog/procedure-types", { active: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [getUrl, getInit] = fetchSpy.mock.calls[0];
    expect(getUrl).toBe("/api/v1/catalog/procedure-types?active=true");
    const getHeaders = new Headers(getInit?.headers);
    expect(getHeaders.get("X-CSRF-Token")).toBeNull();

    await api.post("/auth/logout", {});
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [postUrl, postInit] = fetchSpy.mock.calls[1];
    expect(postUrl).toBe("/api/v1/auth/logout");
    const postHeaders = new Headers(postInit?.headers);
    expect(postHeaders.get("X-CSRF-Token")).toBe("token-csrf-baradero-2026");
  });

  it("renderiza el catálogo público de trámites y la matriz de requisitos desde la API v1", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/auth/me")) {
        return jsonResponse(
          { error: { code: "unauthenticated", message: "Sin sesión" } },
          401,
        );
      }
      if (url.includes("/catalog/procedure-types")) {
        return jsonResponse([
          {
            id: 1,
            code: "nueva",
            name: "Licencia nueva",
            short_description: "Primera licencia de conducir",
            description: "Otorgamiento inicial con curso y exámenes.",
            icon: "car",
            sort_order: 1,
            matrix: [
              {
                id: 10,
                license_category: "B",
                min_age: 18,
                max_age: 70,
                fee_amount: "18500.00",
                validity_years: 5,
                steps: [
                  "charlas",
                  "health",
                  "theory",
                  "payment",
                  "practical",
                  "delivery",
                ],
                required_documents: ["health_certificate", "payment_receipt"],
                theory_questions: 5,
                theory_pass_ratio: 0.8,
                theory_minutes: 20,
                max_theory_attempts: 1,
                requires_health: true,
                requires_practical: true,
                notes: "Presentar DNI físico al retirar.",
              },
            ],
          },
        ]);
      }
      return jsonResponse({});
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <AppShellRoutes />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Requisitos para Licencia nueva"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("$18500.00 ARS")).toBeInTheDocument();
    expect(
      screen.getByText("Presentar DNI físico al retirar."),
    ).toBeInTheDocument();
  });

  it("solicita el código MFA cuando el servidor responde mfa_required en el login", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/auth/me")) {
        return jsonResponse(
          { error: { code: "unauthenticated", message: "Sin sesión" } },
          401,
        );
      }
      if (url.includes("/auth/login") && init?.method === "POST") {
        return jsonResponse(
          {
            error: {
              code: "mfa_required",
              message: "Ingresá el código del segundo factor",
            },
          },
          401,
        );
      }
      return jsonResponse({});
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/ingresar"]}>
          <AppShellRoutes />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByLabelText("Correo electrónico o DNI"),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Correo electrónico o DNI"), {
      target: { value: "operador@baradero.gob.ar" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "ClaveSeguraMunicipal2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Iniciar sesión/i }));

    await waitFor(() => {
      expect(
        screen.getByLabelText(
          /Código de segundo factor \(TOTP o código de recuperación\)/i,
        ),
      ).toBeInTheDocument();
    });
  });

  it("protege las rutas privadas redirigiendo a /ingresar cuando no hay sesión", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      jsonResponse(
        { error: { code: "unauthenticated", message: "Sin sesión" } },
        401,
      ),
    );

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/panel"]}>
          <AppShellRoutes />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Ingresar a TramitesBAR" }),
      ).toBeInTheDocument();
    });
  });

  it("muestra la advertencia de protección de PII al abrir el asistente Bari", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      jsonResponse(
        { error: { code: "unauthenticated", message: "Sin sesión" } },
        401,
      ),
    );

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <AppShellRoutes />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const bariTrigger = await screen.findByRole("button", {
      name: /Consultar a Bari/i,
    });
    fireEvent.click(bariTrigger);

    expect(
      screen.getByText(
        /No ingreses tu DNI, correo electrónico, teléfono ni datos de salud en este chat/i,
      ),
    ).toBeInTheDocument();
  });
});
