---
name: enterprise-architecture
description: >-
  Guía y marco de trabajo de Arquitectura Empresarial Avanzada para desarrollo de software profesional.
  Implementa Domain-Driven Design (DDD), Clean Architecture (Hexagonal / Ports & Adapters),
  CQRS, Modular Monolith y patrones de escalabilidad para proyectos de gran envergadura.
---

# Enterprise Software Architecture Framework (DDD + Clean + Hexagonal + CQRS)

Este skill define el estándar de arquitectura de software para proyectos empresariales escalables y de misión crítica. Proporciona lineamientos, estructuras de carpetas, patrones tácticos y guías paso a paso para diseñar, refactorizar e implementar futuras funcionalidades con máxima mantenibilidad, desacoplamiento y robustez.

---

## 1. Principios Fundamentales de Arquitectura TOP

```
┌────────────────────────────────────────────────────────┐
│             PRESENTATION / ADAPTERS LAYER              │
│       FastAPI Routers, CLI, Web Controllers, DTOs      │
└──────────────────────────┬─────────────────────────────┘
                           │ uses
┌──────────────────────────▼─────────────────────────────┐
│               APPLICATION / USE CASES                  │
│       Command Handlers, Query Handlers, Ports (SPI)    │
└──────────────────────────┬─────────────────────────────┘
                           │ orchestrates
┌──────────────────────────▼─────────────────────────────┐
│                 DOMAIN CORE (Pure Logic)               │
│   Entities, Value Objects, Aggregates, Domain Events   │
└──────────────────────────▲─────────────────────────────┘
                           │ implements
┌──────────────────────────┴─────────────────────────────┐
│             INFRASTRUCTURE / DRIVERS LAYER             │
│   SQLAlchemy Repos, MySQL, Redis, External APIs, OAuth │
└────────────────────────────────────────────────────────┘
```

### Regla de Oro (Dependency Inversion)
- **El Dominio es agnóstico a la infraestructura**: Nunca importar SQLAlchemy, FastAPI, MySQL, bibliotecas de red o frameworks dentro de `domain/`.
- **Las dependencias apuntan hacia adentro**: La infraestructura y la presentación dependen de las interfaces (Puertos) definidas en la capa de aplicación/dominio.

---

## 2. Estructura Modular de Proyecto (Modular Monolith)

Cada módulo de negocio representa un **Bounded Context** de DDD:

```text
src/ o backend/
├── shared_kernel/                  # Elementos transversales compartidos
│   ├── domain/                     # BaseEntity, ValueObject, DomainEvent, Result/Either
│   ├── infrastructure/             # Database connection, EventBus, Logger, Security
│   └── application/                # BaseCommandHandler, BaseQueryHandler
│
├── modules/
│   ├── identidad_ciudadana/        # Bounded Context: Identidad, RUC, Auth, Biometría
│   │   ├── domain/                 # Entidades: Usuario, Perfil, Credenciales
│   │   ├── application/            # Casos de uso: IniciarSesion, ValidarBiometria
│   │   ├── infrastructure/         # Repositorios SQLAlchemy, Adaptador Google OAuth
│   │   └── presentation/           # Routers FastAPI: /api/auth, /api/usuarios
│   │
│   ├── administracion_municipal/   # Bounded Context: Portal General, Tasas, 147
│   │   ├── domain/                 # Entidades: Expediente, TasaBoleta, Reclamo147
│   │   ├── application/            # Casos de uso: IniciarTramite, PagarTasas, CrearReclamo
│   │   ├── infrastructure/         # Repositorios: TramiteRepository, TasasRepository
│   │   └── presentation/           # Routers FastAPI: /api/tramites, /api/tasas, /api/147
│   │
│   └── ambiente_subi/              # Bounded Context: Gestión Ambiental Baradero
│       ├── domain/                 # Entidades: SolicitudPoda, Podador, RecetaAgronomica
│       ├── application/            # Casos de uso: SolicitarPoda, InspeccionarArbol, EmitirReceta
│       ├── infrastructure/         # Repositorios: AmbienteRepository, VisitasGeoAdapter
│       └── presentation/           # Routers FastAPI: /api/ambiente/*
│
└── main.py                         # Punto de entrada / Composición de Inyección de Dependencias
```

---

## 3. Patrones Tácticos de Domain-Driven Design (DDD)

### A. Value Objects (Inmutables con Validación Autocontenida)
Nunca usar primitivos sueltos para conceptos con reglas de negocio (evita el *Primitive Obsession*):

```python
# domain/value_objects.py
from dataclasses import dataclass
import re

@dataclass(frozen=True)
class DNI:
    valor: str

    def __post_init__(self):
        limpio = re.sub(r"\D", "", self.valor)
        if not (7 <= len(limpio) <= 8):
            raise ValueError(f"DNI inválido: {self.valor}")
        object.__setattr__(self, "valor", limpio)

@dataclass(frozen=True)
class CodigoSeguimientoAmbiente:
    codigo: str

    @classmethod
    def generar(cls) -> "CodigoSeguimientoAmbiente":
        import random
        return cls(f"SUBI-2026-{random.randint(1000, 9999)}")
```

### B. Entities & Aggregate Roots (Límites Transaccionales)
Los agregados garantizan la consistencia y ejecutan las reglas del negocio:

```python
# domain/aggregates.py
from typing import List, Optional
from datetime import datetime

class SolicitudPodaAggregate:
    def __init__(self, id_solicitud: str, id_usuario: int, direccion: str, especie: Optional[str] = None):
        self.id_solicitud = id_solicitud
        self.id_usuario = id_usuario
        self.direccion = direccion
        self.especie = especie
        self.estado = "Ingresado"
        self.porcentaje_avance = 25
        self.inspector_asignado: Optional[str] = None
        self.dictamen: Optional[str] = None
        self.domain_events = []

    def asignar_inspector(self, inspector: str, fecha_visita: str) -> None:
        if self.estado == "Finalizado":
            raise ValueError("No se puede asignar inspector a un trámite finalizado.")
        self.inspector_asignado = inspector
        self.estado = "Visita Técnica Programada"
        self.porcentaje_avance = 60
        # Registrar Domain Event
        self.domain_events.append({
            "event": "InspectorAsignado",
            "solicitud_id": self.id_solicitud,
            "inspector": inspector,
            "timestamp": datetime.utcnow()
        })

    def emitir_dictamen(self, dictamen: str, aprobado: bool) -> None:
        self.dictamen = dictamen
        self.estado = "Aprobado" if aprobado else "Rechazado"
        self.porcentaje_avance = 100
```

### C. Patrón Repository (Puertos / Interfaces)
Definir contratos abstractos en el dominio/aplicación:

```python
# domain/repositories.py
from abc import ABC, abstractmethod
from typing import Optional, List

class ISolicitudPodaRepository(ABC):
    @abstractmethod
    def get_by_codigo(self, codigo: str) -> Optional[SolicitudPodaAggregate]:
        pass

    @abstractmethod
    def save(self, solicitud: SolicitudPodaAggregate) -> None:
        pass
```

---

## 4. Patrón CQRS (Command Query Responsibility Segregation)

Separar explícitamente las operaciones de modificación (Commands) de las de lectura optimizada (Queries):

### Commands (Modificaciones)
```python
# application/commands/solicitar_poda_command.py
from dataclasses import dataclass

@dataclass(frozen=True)
class SolicitarPodaCommand:
    username: str
    direccion: str
    motivo: str
    especie: str

class SolicitarPodaCommandHandler:
    def __init__(self, repo: ISolicitudPodaRepository, user_repo: IUsuarioRepository):
        self.repo = repo
        self.user_repo = user_repo

    def handle(self, cmd: SolicitarPodaCommand) -> str:
        user = self.user_repo.get_by_username(cmd.username)
        if not user:
            raise ValueError("Usuario no existe.")
        
        solicitud = SolicitudPodaAggregate(
            id_solicitud=CodigoSeguimientoAmbiente.generar().codigo,
            id_usuario=user.id,
            direccion=cmd.direccion,
            especie=cmd.especie
        )
        self.repo.save(solicitud)
        return solicitud.id_solicitud
```

### Queries (Lecturas optimizadas y DTOs planos)
```python
# application/queries/obtener_estado_query.py
class ObtenerEstadoTramiteQueryHandler:
    def __init__(self, read_db_session):
        self.db = read_db_session

    def handle(self, codigo: str) -> dict:
        # Lectura directa proyectada a DTO sin sobrecarga de hidratar agregados
        result = self.db.execute("SELECT * FROM ambiente_solicitud WHERE codigo_seguimiento = :c", {"c": codigo}).first()
        return dict(result) if result else None
```

---

## 5. Result Pattern y Manejo Explícito de Errores

Evitar excepciones genéricas no controladas; usar objetos `Result` para comunicar éxito/fracaso de manera predecible:

```python
# shared_kernel/domain/result.py
from typing import Generic, TypeVar, Optional

T = TypeVar("T")

class Result(Generic[T]):
    def __init__(self, is_success: bool, value: Optional[T] = None, error: Optional[str] = None):
        self.is_success = is_success
        self.value = value
        self.error = error

    @classmethod
    def ok(cls, value: T) -> "Result[T]":
        return cls(True, value=value)

    @classmethod
    def fail(cls, error: str) -> "Result[T]":
        return cls(False, error=error)
```

---

## 6. Guía de Implementación para Nuevas Funcionalidades

Cuando se agregue un nuevo módulo o funcionalidad:

1. **Definir el Bounded Context**: Identificar si pertenece al núcleo general o a un dominio específico (ej: Bromatología, Obras, Ambiente).
2. **Modelar el Dominio**: Diseñar Entidades, Value Objects y Reglas de Negocio en `domain/` sin librerías externas.
3. **Definir los Casos de Uso (Application)**: Crear Command/Query Handlers con sus respectivos DTOs.
4. **Implementar los Adaptadores (Infrastructure)**: Implementar la persistencia con SQLAlchemy y servicios externos en `infrastructure/`.
5. **Exponer la API (Presentation)**: Crear routers limpios en FastAPI que deleguen inmediatamente a los handlers.
6. **Escribir Pruebas**: Tests unitarios de dominio sin base de datos (ultrarrápidos) + Tests de integración con la base de datos de test.
