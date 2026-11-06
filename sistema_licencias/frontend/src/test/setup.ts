import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// JSDOM no realiza layout; los desplazamientos reales se verifican con Playwright.
Element.prototype.scrollIntoView = vi.fn();
