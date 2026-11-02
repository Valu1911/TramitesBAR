# AGENTS.md — Reglas para trabajar en TramitesBAR

Este archivo lo leen las personas y los agentes de IA antes de tocar el repositorio. Si no lo leíste, no empieces.

---

## 1. Qué es este proyecto

TramitesBAR es el sistema municipal de licencias de conducir de Baradero. Está dentro de `sistema_licencias`. No es SUBI. SUBI es el portal grande; TramitesBAR es el módulo de licencias que después se importa a SUBI.

El plan completo está en `docs/plan/PLAN_MAESTRO.md`. Las decisiones cerradas están en `docs/plan/DECISIONES.md`. Las reglas de ramas están en `docs/plan/GUIA_RAMAS_Y_MERGE.md`.

---

## 2. Reglas que no se negocian

1. **Nada de demo en producción.** No hay modo demo, datos sintéticos, `auto_aprobar`, fallbacks a `localStorage` ni respuestas falsas.
2. **Nada de credenciales hardcodeadas.** Ni `admin123`, ni claves SMTP, ni secretos en el código.
3. **Nada de datos de tarjeta.** El pago es por transferencia y conciliación.
4. **Nada de `innerHTML` con datos del usuario.** React escapa; si hay que usar HTML, se sanitiza.
5. **Nada de handlers inline ni estilos inline.** Componentes y CSS.
6. **Nada de emojis en la interfaz.** Iconos SVG.
7. **Nada de cambiar el stack sin ADR.** FastAPI + SQLAlchemy + MySQL + React + TypeScript + LiveKit.
8. **Nada de tocar `main` directo.** Todo por PR.
9. **Nada de force push.** Ni a `main`, ni a `develop`, ni a una rama compartida.
10. **Nada de borrar ramas o archivos de otros sin avisar.**
11. **Nada de inventar requisitos municipales.** Si falta la matriz oficial, se usa la configurable y se pregunta.
12. **Nada de prometer SOC 2 certificado.** Se dice “SOC 2 readiness” hasta que el auditor emita el informe.
13. **Nada de grabar localmente un examen.** La evidencia la genera el servidor.
14. **Nada de mandar PII a modelos de IA.** Bari no recibe DNI, email, teléfono ni datos de salud.
15. **Nada de mergear con CI en rojo.**

---

## 3. Flujo de trabajo

1. Leer `docs/plan/PLAN_MAESTRO.md` y `docs/plan/DECISIONES.md`.
2. Verificar en qué rama estás y si está actualizada.
3. Crear una rama desde `develop` o `main` según corresponda.
4. Hacer cambios chicos y coherentes.
5. Correr lint, tipos y tests.
6. Actualizar la documentación.
7. Actualizar `docs/HANDOFF.md`.
8. Abrir PR con la plantilla.
9. Esperar revisión y CI.
10. Mergear solo cuando esté aprobado.

No trabajes directo sobre `main`. No dejes cambios sin commitear al final de una sesión.

---

## 4. Seguridad

- Contraseñas: Argon2id `m=64 MiB`, `t=3`, `p=4`.
- Datos sensibles: AES-256-GCM.
- Índice ciego de DNI: HMAC-SHA-256.
- Sesión: cookie `httpOnly`, `Secure`, `SameSite`, CSRF.
- MFA obligatorio para admin, examinador, pagos y superadmin.
- Rate limit en login, registro, DNI, pagos, examen y verificación pública.
- Validación de entrada con Pydantic.
- Consultas parametrizadas. Nada de SQL concatenado.
- Archivos: MIME real, tamaño, antivirus, nombre aleatorio, cifrado, URL firmada.
- Logs sin PII.
- Auditoría de acciones administrativas.
- Secretos en `.env` o en el gestor de secretos. Nunca en git.
- Si tocás auth, pagos, archivos, proctoring o permisos, pedí revisión de seguridad.

---

## 5. Código y comentarios

- Python: `ruff`, `mypy`, `pytest`. TypeScript: `eslint`, `tsc`, `vitest`.
- Nombres claros. Funciones chicas. Sin duplicación innecesaria.
- Docstring en cada función y clase.
- Comentario por bloque explicando el porqué.
- Comentario de línea en módulos críticos.
- Español rioplatense, directo, sin clichés de IA, sin emojis.
- El comentario explica la intención, no traduce la sintaxis.
- Si algo es raro, se documenta. Si algo es obvio, no se comenta de más.

Ejemplo:

```python
# Mal: suma uno al contador.
intentos += 1

# Bien: contamos este intento para aplicar el límite de tres.
intentos += 1
```

---

## 6. Base de datos

- MySQL 8.4, InnoDB, `utf8mb4`, claves foráneas.
- Migraciones con Alembic. No se edita una migración aplicada.
- No se cambia el esquema a mano en producción.
- No se borra auditoría.
- No se guardan datos de tarjeta.
- Los campos sensibles se cifran.
- Los índices y constraints se documentan.
- Cada migración tiene downgrade probado.

---

## 7. Tests

- Unitarios para dominio y validaciones.
- Integración con MySQL, Redis y MinIO en Docker.
- E2E con Playwright, dos contextos: ciudadano y examinador.
- Seguridad: autorización, IDOR, CSRF, rate limit, uploads, XSS.
- Carga: k6 para API; 50 sesiones LiveKit en staging.
- Accesibilidad: axe-core.
- No se testea contra producción.
- Un PR sin tests no se mergea, salvo que sea solo documentación.

---

## 8. Documentación

Cada cambio actualiza lo que corresponda:

- `docs/ARQUITECTURA.md`
- `docs/MODELO_DATOS.md`
- `docs/API.md`
- `docs/SEGURIDAD.md`
- `docs/PROCTORING.md`
- `docs/OPERACION.md`
- `docs/RUNBOOK.md`
- `docs/HANDOFF.md`

Si agregás un endpoint, se documenta en OpenAPI. Si agregás una tabla, se documenta en el modelo. Si agregás un evento de correo, se documenta la plantilla y el disparador.

---

## 9. Handoff

Al terminar una sesión, actualizá `docs/HANDOFF.md` con:

- Qué se hizo.
- Qué falta.
- Decisiones tomadas.
- Riesgos.
- Cómo probar.
- Archivos tocados.
- Próximo paso.

Si no hay handoff, el trabajo no está terminado.

---

## 10. Prohibiciones

- No agregues `print` de debug en producción.
- No dejes `TODO` sin dueño y fecha.
- No uses `except Exception: pass`.
- No silencies errores con fallbacks.
- No uses `root` en producción.
- No desactives CSRF, CORS o validación para “que funcione”.
- No subas `.env`, backups, claves ni capturas con datos reales.
- No cambies la licencia del proyecto.
- No mezcles cambios de formato con cambios funcionales.
- No mergees tu propio PR sin revisión.
- No reescribas la historia de una rama compartida.

---

## 11. Si estás bloqueado

Preguntá. No inventes. Dejá escrito en el handoff:

- Qué te bloquea.
- Qué opciones viste.
- Qué recomendás.
- Qué necesitás de una persona.

Es mejor frenar que meter un parche inseguro.

---

## 12. Definition of Done

- Tests pasan.
- Lint pasa.
- Tipos pasan.
- Seguridad revisada si corresponde.
- Documentación actualizada.
- Handoff actualizado.
- Sin secretos.
- Sin datos demo.
- Sin warnings nuevos.
- PR aprobado.
- CI en verde.
