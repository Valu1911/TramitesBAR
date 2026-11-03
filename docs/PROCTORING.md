# Examen Teórico y Proctoring — TramitesBAR

Este documento describe el funcionamiento del examen teórico en la versión actual (v1) y la arquitectura prevista para la supervisión en vivo (*proctoring*) con LiveKit self-hosted.

---

## 1. Estado actual en v1 (`FEATURES_PROCTORING=false`)

En la versión 1 operativa, la variable `FEATURES_PROCTORING` está configurada en `false` por defecto (`app/core/config.py`). El examen teórico funciona de punta a punta con controles de integridad estrictos en el servidor, sin exigir transmisión WebRTC hasta que el municipio disponga del servidor dedicado y la validación legal del tratamiento de clips de video.

### Controles de integridad activos en v1 (`app/services/exams.py`)
1. **Habilitación secuencial:** el ciudadano solo puede iniciar el examen cuando el trámite se encuentra exactamente en el paso `theory` (habiendo completado las etapas previas según la matriz).
2. **Banco de preguntas revisado:** únicamente las preguntas con `active = true` y `reviewed = true` participan del sorteo. Cualquier pregunta creada o editada por administración nace con `reviewed = false` hasta su revisión explícita.
3. **Snapshot inmutable por intento:** al llamar a `POST /api/v1/procedures/{id}/exam/start`, el servidor sortea las preguntas de la categoría (o generales `B`) y guarda el arreglo congelado en `exam_attempts.questions`. El cliente recibe únicamente el enunciado y las opciones (`AttemptStartOut`), **nunca** el índice de la respuesta correcta (`correct_index`).
4. **Control de tiempo en servidor:** cada intento tiene `started_at` y `expires_at` calculados según `procedure_matrix.theory_minutes`. Si el ciudadano envía las respuestas después de `expires_at` (con una tolerancia de red de 10 segundos), el servidor marca el intento como `expired` y rechaza la entrega con `409 attempt_expired`.
5. **Límite de intentos y autorización auditada:** la cantidad máxima de intentos está definida en `procedure_matrix.max_theory_attempts` (por defecto `1`). Si el ciudadano desaprueba o vence el tiempo, no puede iniciar otro intento salvo que un administrador habilite un reintento justificado mediante `POST /api/v1/admin/procedures/{id}/retry` (que queda registrado en `audit_log` y notifica al vecino).

---

## 2. Arquitectura planificada de Proctoring en Vivo (Fases 5, 6 y 7)

Conforme a las decisiones cerradas `ADR-004`, `ADR-005`, `ADR-006` y `ADR-014` (`docs/plan/DECISIONES.md`), la supervisión en vivo se implementa bajo las siguientes reglas innegociables:

```mermaid
flowchart LR
  ALUMNO["Ciudadano (Desktop Chrome/Edge)"] -->|WebRTC: Cámara + Micrófono + Pantalla| LK["LiveKit Self-Hosted + coturn"]
  LK -->|Hasta 5 alumnos por sala| EXAM["Consola de Examinador Municipal"]
  API["FastAPI Backend"] -->|Tokens de sala / Eventos| LK
  LK -->|Clip de incidente (60-120s)| MINIO[("MinIO S3 (AES-256-GCM)")]
```

### 2.1 Reglas operativas y de privacidad
- **Infraestructura propia (*self-hosted*):** LiveKit y `coturn` corren en contenedores Docker sobre infraestructura controlada por el municipio (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`). No se envían flujos de audio/video de vecinos a nubes de terceros.
- **Prohibición de grabación local (`ADR-006`):** la consola del examinador no incluye botón de grabación ni de descarga local. Toda la evidencia la genera y cifra el servidor.
- **Evidencia por clip de incidente (`ADR-005` — Opción B):** no se almacenan grabaciones completas de todas las sesiones. El servidor mantiene un buffer temporal de 60 a 120 segundos y solo persiste el clip cifrado con AES-256-GCM cuando se registra un incidente o expulsión, con retención máxima de 90 días y acceso exclusivo para revisores de apelación (distintos del examinador que tomó la medida).
- **Cupo máximo por examinador (`ADR-014`):** cada examinador municipal certificado supervisa un máximo de 5 alumnos simultáneos.

---

## 3. Requisitos previos para activar `FEATURES_PROCTORING=true`

Antes de habilitar la bandera en producción se deben cumplir cuatro condiciones:

1. **Servidor dedicado de medios:** instancia Linux con al menos 16 vCPU, 32 GB de RAM, enlace simétrico de 1 Gbps, IP pública fija y puertos abiertos (`443/TCP`, `7880/TCP`, `7881/TCP`, `3478/UDP+TCP` para TURN y rango `50000-60000/UDP` para WebRTC).
2. **Dictamen legal municipal:** aprobación formal del texto de consentimiento específico de monitoreo y de la política de retención de 90 días para clips de incidente.
3. **Prueba de carga en staging:** validación de 50 sesiones concurrentes (10 examinadores x 5 alumnos) verificando estabilidad de CPU, ancho de banda y generación de clips.
4. **Certificación de examinadores:** alta formal y aprobación del curso operativo por parte del personal municipal designado.
