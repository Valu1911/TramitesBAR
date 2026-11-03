# Decisiones de Arquitectura — TramitesBAR

Este archivo guarda las decisiones que no se cambian por capricho. Si alguien quiere cambiar una, escribe un ADR nuevo, explica el motivo y lo aprueba el responsable del proyecto. No se borra el ADR anterior.

Formato: contexto, decisión, consecuencias, alternativas.

---

## ADR-001 — Stack backend FastAPI + SQLAlchemy + MySQL

**Fecha:** 2026-11-02
**Estado:** aceptada

**Contexto:** El prototipo actual usa Flask + SQLite. SUBI, el destino final, usa FastAPI + SQLAlchemy + MySQL. Mantener Flask + SQLite obliga a reescribir todo al integrar.

**Decisión:** TramitesBAR usa FastAPI + SQLAlchemy 2 + Alembic + Pydantic v2 + MySQL 8.4.

**Consecuencias:**
- Se alinea con SUBI.
- Hay que migrar el prototipo, no parchearlo.
- SQLite queda solo para unitarios aislados.
- MySQL 8.4 corre en WAMP para desarrollo y en Docker para producción.

**Alternativas descartadas:** Flask + SQLite (no escala ni integra), Django (más pesado y distinto de SUBI), Node (no comparte stack con SUBI).

---

## ADR-002 — Base `tramites_bar` y usuario `tramites_app`

**Fecha:** 2026-11-02
**Estado:** aceptada

**Contexto:** El prototipo usa SQLite y, cuando apunta a MySQL, usa `root` sin contraseña. Eso no es aceptable.

**Decisión:** Base `tramites_bar`, usuario dedicado `tramites_app`, permisos mínimos sobre esa base. `root` solo para tareas administrativas locales.

**Consecuencias:**
- Hay que crear el usuario y otorgar permisos en el `iniciar.bat`.
- Las credenciales van en `.env`, nunca en git.
- Producción usa otro usuario y otras credenciales.

---

## ADR-003 — Frontend React + TypeScript + Vite

**Fecha:** 2026-11-02
**Estado:** aceptada

**Contexto:** El frontend actual es vanilla JS con 348 handlers inline, 1.868 estilos inline, 144 usos de `innerHTML` y 119 emojis. La consola de examinador necesita estado complejo, grilla, foco y eventos en tiempo real. Mantener ese código es más caro que reescribirlo.

**Decisión:** React 19 + TypeScript + Vite + TanStack Query + React Router + Zod + Radix + CSS propio.

**Consecuencias:**
- Hay build de frontend y pipeline de CI.
- Se gana tipado, testabilidad y componentes accesibles.
- Se pierde algo de simplicidad para integrar en SUBI, que es vanilla. Se resuelve sirviendo la app como ruta separada y, si hace falta, montándola en un contenedor.
- Nada de plantillas genéricas: el diseño se hace a mano con la identidad de Baradero.

**Alternativas descartadas:** seguir con vanilla (deuda técnica), Angular (más pesado), Vue (viable, pero el equipo no lo usa).

---

## ADR-004 — LiveKit self-hosted + coturn

**Fecha:** 2026-11-02
**Estado:** aceptada

**Contexto:** El examen necesita video, audio y pantalla en vivo para 50+ alumnos concurrentes, con varios examinadores mirando. Una solución P2P no escala. Una nube externa manda datos de menores a un tercero.

**Decisión:** LiveKit self-hosted en Docker, con coturn para TURN.

**Consecuencias:**
- Se necesita servidor con IP pública, 1 Gbps y puertos abiertos.
- Hay que mantener el servidor y monitorearlo.
- No hay dependencia de un proveedor de video.
- En Windows se corre con Docker Desktop o WSL2.

**Alternativas descartadas:** Jitsi (más pesado de operar), Zoom/Meet (datos afuera, pago por uso), WebRTC P2P (no escala).

---

## ADR-005 — Evidencia de examen: Opción B, clip de incidente

**Fecha:** 2026-11-02
**Estado:** aceptada

**Contexto:** Se necesita respaldar una expulsión ante un reclamo. Grabar todas las sesiones implica almacenar imágenes de menores y decenas de GB por hora. No grabar nada deja al examinador sin prueba objetiva.

**Decisión:** El servidor mantiene un buffer de 60 a 120 segundos por sesión y preserva el clip solo cuando hay incidente o expulsión. Cifrado con AES-256-GCM, retención de 90 días, acceso solo para revisores de apelación, todo auditado.

**Consecuencias:**
- Hay que validar el buffer con LiveKit/Egress en un spike técnico temprano.
- Si el clip no es confiable, se cae a grabación completa con retención corta.
- El examen requiere consentimiento específico de evidencia.
- Los menores requieren autorización del tutor.
- No hay grabación local por parte del examinador.

**Alternativas descartadas:** Opción A (solo eventos y notas), Opción C (grabación completa por defecto).

---

## ADR-006 — Sin grabación local por examinadores

**Fecha:** 2026-11-02
**Estado:** aceptada

**Contexto:** Un examinador podría grabar la sesión con OBS, el celular o una herramienta externa. Eso no se puede impedir técnicamente al 100%, pero sí se puede prohibir, controlar y auditar.

**Decisión:** La consola no tiene botón de grabación ni descarga. La evidencia la genera el servidor. El examinador firma una política de confidencialidad. Se registra cada acceso a evidencia.

**Consecuencias:**
- Menos riesgo de filtraciones.
- La evidencia depende del servidor, no del escritorio del examinador.
- Hay que capacitar y sancionar el incumplimiento.

---

## ADR-007 — Bari determinista + Ollama opcional

**Fecha:** 2026-11-02
**Estado:** aceptada

**Contexto:** Se quiere un chatbot que “funcione siempre”, gratuito y limitado a licencias. Una API gratuita externa tiene límites, caídas y cambios. Un modelo local puede faltar o ser lento.

**Decisión:** Bari tiene un bot determinista para el flujo crítico y preguntas frecuentes. Ollama local es opcional para preguntas libres, con timeout, RAG sobre documentación oficial, filtro de temas y fallback al determinista.

**Consecuencias:**
- Bari funciona aunque Ollama esté caído.
- El modelo local consume RAM/CPU; si hay mucha concurrencia, se encola.
- No se manda PII al modelo.
- Las respuestas se limitan a licencias; si no sabe, deriva.

**Alternativas descartadas:** OpenRouter free como dependencia crítica (no garantiza disponibilidad), solo chatbot sin guía visual (peor experiencia).

---

## ADR-008 — Correo provider-agnostic

**Fecha:** 2026-11-02
**Estado:** aceptada

**Contexto:** Se reutiliza `subibaradero@gmail.com` para desarrollo. Gmail tiene límites y no da reputación municipal. Producción necesita algo mejor.

**Decisión:** Interfaz de correo con SMTP configurable, cola, reintentos e idempotencia. Gmail en desarrollo; SMTP oficial o proveedor transaccional en producción, con SPF, DKIM y DMARC.

**Consecuencias:**
- Cambiar de proveedor no toca el dominio.
- Hay que monitorear rebotes y quejas.
- Si el volumen supera 300-500 mails por día, se migra a proveedor transaccional.

---

## ADR-009 — Pagos por transferencia y conciliación

**Fecha:** 2026-11-02
**Estado:** aceptada

**Contexto:** No se quieren datos de tarjeta ni scraping de home banking. El municipio cobra por transferencia o billetera.

**Decisión:** Código de referencia único, comprobante, importación CSV/XLSX, conciliación por referencia/monto/DNI/nombre/fecha, cola de excepciones y doble control para montos altos.

**Consecuencias:**
- Hay trabajo manual de conciliación.
- Se evita el riesgo de PCI.
- Se puede migrar a una API oficial en el futuro sin cambiar el modelo.

---

## ADR-010 — Retención de datos

**Fecha:** 2026-11-02
**Estado:** aceptada, pendiente de validación legal

**Decisión:**
- Licencias y pagos: 5 años.
- Eventos de examen: 2 años.
- Imágenes de DNI: 90 días.
- Aceptaciones de políticas: 10 años.
- Clips de incidente: 90 días.
- Auditoría: 5 años.
- Backups: 30 días diarios, 12 meses mensuales.

**Consecuencias:**
- Hay jobs de borrado y certificados de borrado.
- Legal hold suspende el borrado.
- La política se publica y se valida con el municipio.

---

## ADR-011 — Alcance SOC 2

**Fecha:** 2026-11-02
**Estado:** aceptada

**Contexto:** SUBI es el portal grande; TramitesBAR es el módulo de licencias. Auditar todo SUBI agranda el alcance y mezcla responsabilidades.

**Decisión:** El SOC 2 cubre solo `sistema_licencias` y sus dependencias: MySQL, Redis, MinIO, LiveKit, SMTP, hosting y backups. SUBI queda afuera.

**Consecuencias:**
- El alcance es más chico y defendible.
- Los proveedores críticos se incluyen como subservice organizations.
- El informe se emite después de 3 a 6 meses de operación.

---

## ADR-012 — Cross-platform Windows/Linux

**Fecha:** 2026-11-02
**Estado:** aceptada

**Contexto:** El desarrollo es Windows con WAMP. Producción probablemente Linux. El municipio no definió servidor.

**Decisión:** El código es cross-platform. `iniciar.bat` para Windows, `iniciar.sh` para Linux, Dockerfile y Compose para ambos. LiveKit y coturn siempre en Docker. Producción recomendada Linux.

**Consecuencias:**
- Hay que probar en los dos sistemas.
- No se usan dependencias Unix-only en la app.
- Windows Server funciona para la app, pero LiveKit necesita Docker/WSL2.

---

## ADR-013 — Comentarios y documentación

**Fecha:** 2026-11-02
**Estado:** aceptada

**Contexto:** El código debe entenderlo cualquiera, incluso alguien que nunca programó. Comentar cada línea sin criterio vuelve el código ilegible.

**Decisión:** Docstring por función y clase, comentario por bloque y comentario de línea en módulos críticos. Comentarios en español rioplatense, directos, sin clichés de IA y sin emojis. Documentación completa en `docs/`.

**Consecuencias:**
- Más tiempo de escritura.
- Código más mantenible.
- Se revisa en code review.

---

## ADR-014 — Certificación de examinadores

**Fecha:** 2026-11-02
**Estado:** aceptada

**Contexto:** Los examinadores son personal municipal y no se sabe si tienen equipos adecuados. Un examinador sin capacitación puede expulsar de más, filtrar datos o no detectar irregularidades.

**Decisión:** Registro formal, curso obligatorio, certificación con vencimiento anual, máximo 5 alumnos por examinador y asignación solo a certificados.

**Consecuencias:**
- Hay que dictar el curso y mantenerlo.
- El sistema bloquea examinadores no certificados.
- Se auditan expulsiones y apelaciones.

---

## ADR-015 — Políticas obligatorias y consentimiento de menores

**Fecha:** 2026-11-02
**Estado:** aceptada

**Contexto:** El sistema trata datos sensibles, incluso de menores. Aceptar una política no puede ser un checkbox decorativo.

**Decisión:** Políticas versionadas, bloqueo en el backend hasta la aceptación, registro de usuario, versión, fecha, IP, user agent y hash. Para menores, autorización del tutor con verificación y evidencia. Re-aceptación al cambiar la política.

**Consecuencias:**
- Nadie usa el sistema sin aceptar.
- Hay que revisar legalmente el texto y el flujo de tutor.
- Se guardan aceptaciones por 10 años.
