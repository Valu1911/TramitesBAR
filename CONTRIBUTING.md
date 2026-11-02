# Contribuir en TramitesBAR

Antes de tocar código, leé `AGENTS.md` y `docs/plan/PLAN_MAESTRO.md`. Ahí está el panorama completo.

---

## 1. Ramas

- `main`: producción. No se pushea directo.
- `develop`: integración. Se crea cuando hay más de una persona trabajando.
- `feature/nombre-corto`: funcionalidad.
- `fix/nombre-corto`: corrección.
- `docs/nombre-corto`: documentación.
- `security/nombre-corto`: seguridad.

Las ramas salen de `develop` o de `main` actualizado. No se trabaja sobre una rama vieja sin rebasear.

---

## 2. Commits

Mensajes claros, en español, en imperativo:

- `feat: agregar matriz de trámites`
- `fix: corregir validación de DNI`
- `docs: actualizar manual de examinador`
- `test: cubrir expulsión y apelación`
- `refactor: separar servicio de pagos`

No mezclar cambios de formato con cambios funcionales. No usar mensajes vacíos como `123` o `fixes`.

---

## 3. Pull requests

- Un PR por tema.
- Título claro.
- Descripción con qué, por qué, cómo se prueba y qué riesgo tiene.
- Checklist completo.
- CI en verde.
- Revisión de otra persona.
- Si toca seguridad, revisión específica.
- Si toca base de datos, migración y rollback.
- Si toca frontend, captura o descripción visual.
- Si toca documentación, enlace al archivo.

---

## 4. Código

- Python: `ruff`, `mypy`, `pytest`.
- TypeScript: `eslint`, `tsc`, `vitest`.
- Docstring y comentarios según `CODING_STANDARDS.md`.
- Sin secretos.
- Sin datos demo.
- Sin `except Exception: pass`.
- Sin `print` de debug.
- Sin `innerHTML` con datos del usuario.
- Sin handlers inline.
- Sin emojis en la interfaz.

---

## 5. Base de datos

- Migraciones con Alembic.
- No editar migraciones aplicadas.
- No cambiar el esquema a mano.
- No borrar auditoría.
- No guardar tarjetas.
- Cifrar datos sensibles.
- Documentar tablas y columnas.

---

## 6. Tests

- Unitarios.
- Integración con MySQL, Redis y MinIO.
- E2E con Playwright.
- Seguridad: autorización, IDOR, CSRF, rate limit, uploads, XSS.
- Accesibilidad con axe.
- Un PR sin tests no se mergea, salvo documentación.

---

## 7. Documentación

- Actualizar `docs/HANDOFF.md`.
- Actualizar el documento del módulo que tocaste.
- Actualizar OpenAPI si agregaste endpoints.
- Actualizar el modelo de datos si agregaste tablas.
- Actualizar el runbook si cambió la operación.

---

## 8. Seguridad

Si encontrás una vulnerabilidad, no la publiques en un issue abierto. Avisá al responsable del proyecto por canal privado. No la explotes en producción. No la dejes sin documentar.
