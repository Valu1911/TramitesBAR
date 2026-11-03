# TramitesBAR

Sistema municipal de licencias de conducir de Baradero. Este repositorio contiene el módulo de licencias que después se integra al portal SUBI.

## Estado

En implementación. La v1 operativa cubre el circuito administrativo completo: registro, políticas, trámites, documentación, pagos por transferencia, examen teórico, turnos prácticos, credencial con QR, notificaciones y backoffice.

El examen vigilado en vivo (proctoring) y la lectura automática de DNI se activan en una fase posterior, cuando existan la infraestructura y las validaciones legales correspondientes.

## Documentación obligatoria

Antes de tocar código, leer:

- [`docs/plan/PLAN_MAESTRO.md`](docs/plan/PLAN_MAESTRO.md): alcance, arquitectura, seguridad y fases.
- [`docs/plan/DECISIONES.md`](docs/plan/DECISIONES.md): decisiones de arquitectura cerradas.
- [`docs/plan/GUIA_RAMAS_Y_MERGE.md`](docs/plan/GUIA_RAMAS_Y_MERGE.md): ramas, distribución y merge.
- [`AGENTS.md`](AGENTS.md): reglas para personas y agentes.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): cómo contribuir.
- [`docs/HANDOFF.md`](docs/HANDOFF.md): estado del trabajo.

## Estructura

```
sistema_licencias/
  backend/       API FastAPI, modelos, migraciones y tests
  frontend/      Aplicación React + TypeScript + Vite
  docs/          Documentación técnica y operativa
  scripts/       Utilidades de desarrollo y despliegue
  storage/       Archivos locales de desarrollo (no versionado)
```

## Desarrollo rápido

Windows:

```powershell
cd sistema_licencias
.\iniciar.bat
```

Linux:

```bash
cd sistema_licencias
./iniciar.sh
```

La API queda en `http://127.0.0.1:8000` y el frontend en `http://127.0.0.1:5173`.

## Reglas que no se negocian

- Nada de datos demo ni credenciales por defecto en producción.
- Nada de datos de tarjeta.
- Nada de secretos en git.
- Nada de `innerHTML` con datos del usuario.
- Nada de emojis en la interfaz.
- Nada de mergear con CI en rojo.
- Nada de prometer SOC 2 Type II antes de que el auditor lo emita.
