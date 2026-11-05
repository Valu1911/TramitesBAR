<<<<<<< HEAD
/**
 * Configuración global del entorno de pruebas Vitest + Testing Library.
 */

import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
=======
import '@testing-library/jest-dom/vitest';
>>>>>>> 375601f98034ff3fad8c977a1bdcea7ff8dc8984
