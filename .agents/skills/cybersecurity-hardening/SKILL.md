---
name: cybersecurity-hardening
description: >-
  Auditoría defensiva de ciberseguridad avanzada, pentesting defensivo, detección profunda de vulnerabilidades (OWASP Top 10, API Security, CWE) y remediación automática con principio Zero-Regression.
---

# Advanced Cybersecurity Auditing, Defensive Pentesting & Remediation Framework

Este skill proporciona un protocolo de nivel profesional para realizar auditorías defensivas de seguridad, análisis estático de vulnerabilidades (SAST), detección exhaustiva de vectores de riesgo (OWASP Top 10 Web & API) y aplicación automática de parches de seguridad robustos preservando el 100% de la funcionalidad del sistema.

---

## 1. Metodología de Auditoría y Pentesting Defensivo

El proceso de auditoría y hardening sigue un ciclo continuo de 5 fases:

```
┌────────────────────────────────────────────────────────┐
│ 1. MODELADO DE AMENAZAS & MAPEO DE SUPERFICIE DE ATAQUE│
│    Inventario de endpoints, inputs, auth flows y roles │
└──────────────────────────┬─────────────────────────────┘
                           │ analiza
┌──────────────────────────▼─────────────────────────────┐
│ 2. ANÁLISIS DE VULNERABILIDADES (SAST & LOGIC AUDIT)   │
│    Inspección de OWASP Top 10, API Top 10 y CWEs       │
└──────────────────────────┬─────────────────────────────┘
                           │ clasifica
┌──────────────────────────▼─────────────────────────────┐
│ 3. EVALUACIÓN DE IMPACTO & ROOT CAUSE ANALYSIS         │
│    Severidad CVSS, vectores de explotación y causa     │
└──────────────────────────┬─────────────────────────────┘
                           │ remedia
┌──────────────────────────▼─────────────────────────────┐
│ 4. PARCHEO DEFENSIVO CON ZERO-REGRESSION               │
│    Refactorización segura de código y sanitización     │
└──────────────────────────┬─────────────────────────────┘
                           │ verifica
┌──────────────────────────▼─────────────────────────────┐
│ 5. VERIFICACIÓN DE SEGURIDAD & HARDENING DE ENTORNO    │
│    Validación de parches, headers, rate limit y logs   │
└────────────────────────────────────────────────────────┘
```

---

## 2. Catálogo Profundo de Detección y Remediación de Vulnerabilidades

### A. Broken Object Level Authorization (BOLA / IDOR) [OWASP API1 / A01]
- **Vector de Riesgo:** El atacante modifica identificadores numéricos o slugs en URLs o payloads (`/api/tasas/boletas?id=5`, `username=admin`) para acceder o alterar datos ajenos.
- **Detección en Código:** Endpoints que reciben `id` o `username` desde el cliente y ejecutan consultas a la BDD sin verificar si el recurso pertenece al token/sesión del usuario autenticado.
- **Patrón de Remediación:**
```python
# ❌ VULNERABLE (Confía ciegamente en el ID provisto por el cliente)
@app.get("/api/legajo/documento/{doc_id}")
def get_documento(doc_id: int, db: Session = Depends(get_db)):
    return db.query(LegajoDocumento).filter(LegajoDocumento.id_documento == doc_id).first()

# ✅ REMEDIADO (Enlaza el recurso estrictamente a la identidad autenticada)
@app.get("/api/legajo/documento/{doc_id}")
def get_documento(doc_id: int, current_user: Usuario = Depends(get_authenticated_user), db: Session = Depends(get_db)):
    doc = db.query(LegajoDocumento).filter(
        LegajoDocumento.id_documento == doc_id,
        LegajoDocumento.id_usuario == current_user.id_usuario
    ).first()
    if not doc:
        # Responder 404 para no filtrar existencia de recursos ajenos (evita User Enumeration)
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    return doc
```

---

### B. Inyecciones SQL y Command Injection [OWASP A03 / CWE-89]
- **Vector de Riesgo:** Interpolación directa de cadenas en sentencias SQL, consultas dinámicas sin bind variables o comandos de sistema operativo (`os.system(f"echo {input}")`).
- **Detección en Código:** Uso de strings formateados `f"..."`, `+` o `.format()` en llamadas a `cursor.execute()` o `db.execute()`.
- **Patrón de Remediación:**
```python
# ❌ VULNERABLE
query = f"SELECT * FROM usuario WHERE email = '{email}' AND activo = 1"
cursor.execute(query)

# ✅ REMEDIADO (ORM SQLAlchemy o Parámetros Preparados)
usuario = db.query(Usuario).filter(Usuario.email == email, Usuario.activo == True).first()
# O en SQL nativo:
cursor.execute("SELECT * FROM usuario WHERE email = %s AND activo = 1", (email,))
```

---

### C. Cross-Site Scripting (XSS) Reflejado, Almacenado y DOM-Based [OWASP A03 / CWE-79]
- **Vector de Riesgo:** Inyección de payloads JavaScript maliciosos (`<img src=x onerror=alert(document.cookie)>`) que se ejecutan en el navegador de otros usuarios.
- **Detección en Código:** Uso indiscriminado de `element.innerHTML = ...`, `eval()`, `document.write()` o inserción de datos de API en el DOM sin escape de caracteres HTML.
- **Patrón de Remediación en Frontend:**
```javascript
// ✅ Función de escape HTML seguro
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

// ✅ Inserción segura en el DOM
function renderizarComentarioSeguro(container, usuarioInput) {
  const div = document.createElement("div");
  div.className = "comment-item";
  div.textContent = usuarioInput; // textContent nunca ejecuta scripts
  container.appendChild(div);
}
```

---

### D. Broken Authentication & Credential Stuffing [OWASP A07 / CWE-307]
- **Vector de Riesgo:** Ataques de fuerza bruta sobre el login o recuperación de clave, contraseñas débiles, tokens JWT con algoritmos vulnerables (`alg: "none"`).
- **Patrón de Remediación:**
  1. **Hash de contraseñas:** Algoritmo `bcrypt` con factor de coste adaptativo (`cost >= 12`) o `Argon2id`.
  2. **Rate Limiting Defensivo:** Limitar intentos de login a un máximo de 5 intentos por minuto por IP/Usuario.
  3. **Tokens de un solo uso:** Invalidados inmediatamente tras su primer consumo (`usado = 1`).
  4. **Protección de cookies de sesión:** Flags obligatorias `HttpOnly; Secure; SameSite=Strict`.

```python
# Rate limiter en memoria / Redis para endpoints críticos
from collections import defaultdict
import time

RATE_LIMIT_STORE = defaultdict(list)

def check_rate_limit(client_ip: str, max_requests: int = 5, window_seconds: int = 60):
    now = time.time()
    RATE_LIMIT_STORE[client_ip] = [t for t in RATE_LIMIT_STORE[client_ip] if now - t < window_seconds]
    if len(RATE_LIMIT_STORE[client_ip]) >= max_requests:
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos. Por motivos de seguridad, intente nuevamente en unos minutos."
        )
    RATE_LIMIT_STORE[client_ip].append(now)
```

---

### E. Mass Assignment / Over-Posting Vulnerability [OWASP API3 / CWE-915]
- **Vector de Riesgo:** El atacante envía campos adicionales en JSON (`{"rol": "admin", "activo": true, "saldo": 99999}`) que el backend vincula automáticamente al modelo de datos.
- **Detección en Código:** Diccionarios deserializados directamente sobre modelos de base de datos sin un DTO de entrada estricto (`Usuario(**request.dict())`).
- **Patrón de Remediación:** Uso obligatorio de esquemas Pydantic con `extra = "forbid"` o listas explícitas de campos permitidos.

```python
class PerfilUpdateRequest(BaseModel):
    nombre: constr(min_length=2, max_length=100)
    apellido: constr(min_length=2, max_length=100)
    telefono: Optional[str] = None
    
    class Config:
        extra = "forbid" # Rechaza cualquier campo malicioso inyectado
```

---

### F. Security Misconfiguration & Server Information Leaks [OWASP A05]
- **Vector de Riesgo:** Respuestas con stack traces detallados que revelan versiones de bases de datos, rutas internas del servidor o cabeceras reveladoras (`Server: uvicorn`, `X-Powered-By`).
- **Patrón de Remediación:**
```python
# Middleware de Hardening de Cabeceras HTTP
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    # Evitar Clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    # Evitar MIME-sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Política de Referrer estricta
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # HSTS para forzar HTTPS
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # Protección XSS heredada
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # Eliminar información de servidores
    if "server" in response.headers:
        del response.headers["server"]
    return response
```

---

### G. Auditoría de Seguridad & Trazabilidad Inmutable (Audit Logging) [OWASP A09]
Toda operación crítica debe dejar registro inalterable para análisis forense:
- Login exitoso / fallido (con IP y User-Agent).
- Cambio de contraseña o reseteo de cuenta.
- Pagos de tasas o emisión de certificados tributarios.
- Modificación de roles o permisos administrativos.
- Creación y dictamen de trámites ambientales.

---

## 3. Protocolo de Remediación Defensiva "Zero-Regression"

Al detectar cualquier fallo de seguridad en el código:

1. **Aislar la causa raíz:** Identificar exactamente qué línea o parámetro es vulnerable sin alterar la lógica de negocio adyacente.
2. **Aplicar el patrón de sanitización o validación mínima requerida:** Usar defensas en profundidad (validación de esquema + parametrización + verificación de pertenencia).
3. **Verificación de compatibilidad de API:** Asegurar que los contratos de entrada y salida JSON no se rompan para los clientes legítimos.
4. **Test de Regresión:** Compilar y ejecutar pruebas de integración para confirmar que todos los flujos de usuario legítimos siguen funcionando con total normalidad.
