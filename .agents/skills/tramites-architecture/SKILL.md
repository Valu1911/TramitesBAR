---
name: tramites-architecture
description: Arquitectura completa del sistema de trámites de licencias de conducir de Baradero. Incluye flujo de pasos, roles, endpoints de la API, y reglas de negocio.
---

# Arquitectura del Sistema de Trámites — Baradero

## Flujo de Trámite (Licencia Nueva)

El ciudadano debe completar los pasos **en orden secuencial**. No puede avanzar al siguiente sin completar el anterior.

```
1. 🎬 Charlas en video     → Videos de seguridad vial (deben verse todos, en orden)
2. 🏥 Formularios de salud → Datos médicos + certificado de salud (archivo)
3. 📝 Examen teórico       → 5 preguntas aleatorias, 4/5 mínimo, un solo intento
4. 💳 Pago del arancel     → Transferencia bancaria o tarjeta de débito ($12,500)
5. 🚗 Examen práctico      → Selección y reserva de turno con profesor
6. 📦 Entrega              → Domicilio o retiro presencial
```

### Flujo de Renovación
```
1. 🏥 Formularios de salud
2. 💳 Pago del arancel
3. 📦 Entrega
```

## Roles y Permisos

| Rol | Usuario | Acceso |
|-----|---------|--------|
| Ciudadano | DNI como login | Dashboard, flujo de trámite |
| `admin_pagos` | admin_pagos/admin123 | Aprobar/rechazar comprobantes de pago |
| `admin_salud` | admin_salud/admin123 | Verificar certificados de salud |
| `admin_turnos` | admin_turnos/admin123 | Gestionar turnos, registrar resultados prácticos |
| `admin_profesores` | - | Gestionar instructores de manejo |
| `admin_cuentas` | - | Verificar/activar cuentas de ciudadanos |

## Estados de Cuenta del Ciudadano
- `pendiente` → Cuenta creada, esperando verificación admin
- `activo` → Verificado, puede hacer trámites
- `rechazado` → Cuenta rechazada por admin

## Endpoints Principales de la API

### Auth
- `POST /api/login` — Login ciudadano (DNI + password)
- `POST /api/registro` — Registro nuevo ciudadano
- `POST /api/admin/login` — Login admin

### Progreso
- `GET /api/progreso` — Estado actual del trámite del ciudadano
- `GET /api/progreso/charlas` — Progreso de charlas en video

### Pasos del Trámite
- `POST /api/charlas/completar` — Marcar video como visto
- `POST /api/formularios/enviar` — Enviar formularios de salud
- `GET /api/examen/preguntas` — Obtener preguntas del examen
- `POST /api/examen/enviar` — Enviar respuestas del examen
- `POST /api/pago/enviar` — Enviar comprobante de pago
- `GET /api/turnos/disponibles` — Turnos disponibles para práctico
- `POST /api/turnos/reservar` — Reservar turno

### Admin
- `GET /api/admin/pagos` — Listar pagos pendientes
- `PUT /api/admin/pagos/:id` — Aprobar/rechazar pago
- `GET /api/admin/salud` — Listar certificados pendientes
- `PUT /api/admin/salud/:id` — Aprobar/rechazar certificado
- `GET /api/admin/turnos` — Listar turnos
- `PUT /api/admin/turnos/:id` — Registrar resultado práctico

### Memoria (Nuevos)
- `POST /api/user/activity` — Registrar actividad del usuario
- `GET /api/user/activity` — Historial de actividad
- `GET /api/user/preferences` — Obtener preferencias
- `PUT /api/user/preferences` — Guardar preferencias (tema, sidebar, última página)

## Constantes de Negocio
```python
MONTO_LICENCIA = 12500.00
ALIAS_BANCARIO = 'MUNICIPIO.BARADERO.LICENCIAS'
CBU_BANCARIO = '0110012330001234567890'
MINIMO_APROBACION_EXAMEN = 4  # de 5 preguntas
```
