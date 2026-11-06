# QA de experiencia ciudadana y responsive

## Ejecutar

Desde `sistema_licencias/frontend`, con Node.js 24 LTS y npm:

```powershell
npm ci
npx playwright install chromium
npm run test:e2e
```

En Linux, la instalación inicial del navegador puede necesitar `npx playwright install --with-deps chromium` (lo ejecuta CI). No hace falta iniciar la API, MySQL ni `iniciar.bat`.

- `npm run test:e2e:ui`: explorador interactivo de pruebas.
- `npm run test:e2e:report`: abre el informe HTML de la última ejecución.
- `npm run test:e2e -- --project=mobile-small`: solo ancho de 320 px.
- `npm run typecheck`, `npm run lint`, `npm test` y `npm run build`: controles complementarios.

El runner inicia y detiene su propio Vite en `http://127.0.0.1:4175`. Falla si ese puerto está ocupado; no reutiliza un servidor existente. No recibe una URL remota configurable.

## Alcance comprobado

Cuatro proyectos Chromium: 320 × 740, 390 × 844, 768 × 1024 y 1440 × 900. Son viewports emulados, no dispositivos físicos ni Safari/Firefox.

La suite `frontend/e2e/responsive.spec.ts` cubre:

- Elección explícita de tipo y categoría, sin preselección silenciosa.
- Desplazamiento instantáneo y foco al siguiente encabezado; no queda tapado por la barra fija. Tab lleva al siguiente control. Se respeta movimiento reducido.
- Resumen previo a crear; al cambiar tipo se limpia la categoría. Se bloquea confirmar sin matriz o fuera del rango de edad configurado.
- Creación con payload esperado y foco en el expediente devuelto por API, sin recarga que confunda un alta exitosa con una consulta fallida.
- Catálogo vacío, errores al cargar, reintento y errores al confirmar conservando la selección.
- `*` y validación nativa de obligatorios; registro inválido, envío de consentimiento explícito, error del servidor y recuperación.
- Políticas no disponibles: registro bloqueado, sin versiones inventadas ni casillas falsas, con reintento.
- Salud: grupo sanguíneo sin valor médico predeterminado, certificado y envío del formulario.
- Entrega postal: domicilio obligatorio y envío de la opción elegida.
- Menú móvil y ausencia de desborde horizontal real, sin ocultarlo mediante CSS.
- Axe WCAG A/AA sobre login, registro, recuperación, nueva contraseña, login municipal, perfil, panel, salud y entrega; también sobre el resumen de selección.

Se generan capturas de selección y registro en `test-results/`, e informe en `playwright-report/`. Errores conservan captura y traza. Todo está ignorado por Git. No usar estas capturas como evidencia de integraciones reales.

## Aislamiento y límites

Los fixtures en `frontend/e2e/fixtures.ts` contienen datos controlados y existen solo para pruebas. Interceptan toda ruta `/api/**`; una llamada no prevista aborta y falla la prueba. **No hay mocks ni modo demo en el código desplegado.** No se leen secretos, no se reutilizan cookies reales ni se prueban bases existentes.

Estas pruebas validan la interfaz y los payloads emitidos, no la persistencia, autorización, CSRF, entrega de correo ni seguridad del archivo en el backend. La validación cliente es una ayuda, nunca reemplaza Pydantic ni los controles del servidor. Axe no sustituye una revisión manual con lector de pantalla.

## Pendientes para afirmar funcionamiento integral

### Navegación por rol implementada (T03)

`frontend/src/lib/navigation.ts` coordina inicio, redirecciones, ambos logins y Navbar, sin modificar las allowlists del router ni los permisos del servidor:

| Cuenta | Destino con sesión y MFA al día |
|---|---|
| Ciudadano | `/panel` |
| Salud, Turnos, Pagos | `/admin/tramites` |
| Cuentas, Admin, Superadmin | `/admin/cuentas` |

El personal con enrolamiento pendiente va a `/perfil`, incluso tras recarga o acceso directo, y no ve enlaces operativos hasta completar MFA. El ciudadano sigue sin acceso a rutas staff. Los destinos son rutas locales fijas, no parámetros de redirección recibidos del usuario.

`src/navigation.test.tsx` verifica 134 escenarios de router, enlaces, login y MFA, incluida la ruta ciudadana de pago. `e2e/navigation.spec.ts` aporta 10 escenarios × 4 anchos con redirecciones reales, lecturas administrativas controladas y detección de montaje de recursos no permitidos. Las pantallas operativas se prueban con listas vacías de test: esto no certifica sus acciones, datos o autorización real. Requiere revisión de seguridad antes de integrar.

### Pago ciudadano implementado

`e2e/payment.spec.ts` aporta otros 10 escenarios × 4 anchos: acceso desde el panel, etapas reales, referencia y monto de API, envío multipart y declaración con CSRF, falta de datos bancarios, error/reintento de consulta, respuesta incierta con consulta previa, reutilización de adjunto confirmado, observación/rechazo, validación de archivo, estados de solo lectura, ID inválido y ausencia de pago en la matriz. Verifica escape de observaciones, fallo del portapapeles, ancho real y axe sobre la pantalla de pago. Las capturas `pago-responsive.png` también quedan solo en `test-results/`.

### Revisión municipal de pagos implementada

`e2e/admin-payments.spec.ts` aporta 14 escenarios × 4 anchos: bandeja de Pagos con su rol inicial, comprobante por descarga autenticada, primera aprobación que sigue en segundo control, rechazo con motivo obligatorio, segundo revisor distinto, búsqueda/paginación resueltas en API, fallo de listado con reintento, respuesta incierta bloqueada hasta **Actualizar detalle**, fallo de recarga posterior a una aprobación confirmada, estados no revisables con notas escapadas, axe/no desborde y cuatro roles sin acceso financiero. También comprueba que Pagos no revisa certificados de salud desde el expediente. Captura `revision-pagos-responsive.png` solo en `test-results/`.

Suite completa actual: **172 unitarias** (134 navegación, 22 ayudas de pago, 1 de privacidad del formulario, 5 ciudadanas previas, 10 de capacidades de rol) y **220 de navegador** (84 UX, 40 navegación, 40 pagos, 56 revisión municipal). Backend aislado: **59 pruebas**. Comandos, diferencias de entorno y límites en [PAGOS_CIUDADANOS.md](PAGOS_CIUDADANOS.md) y [PAGOS_MUNICIPALES.md](PAGOS_MUNICIPALES.md). No se certifica conciliación real por pasar pruebas de UI.

### Trabajo restante

- Resolver la política de admisión/supervisión del examen v1 (T02 en `docs/HANDOFF.md`), corregir sus respuestas simuladas y la dependencia `jwt` no declarada. El entorno actual tiene PyJWT y no reproduce los fallos históricos; eso no acredita una instalación limpia ni supervisión real. No habilitar un examen remoto sin supervisión como parche.
- Completar la consola de pagos con importación de extractos, conciliación y excepciones, y revisar el resto de pestañas/acciones del backoffice con pruebas funcionales propias. La revisión manual y el doble control ya tienen UI y pruebas; eso no equivale a conciliación bancaria automática.
- Completar recorrido de las seis matrices con API/MySQL, archivos, pagos y conciliación, correo, revisión municipal, turnos y credencial. Pantallas ciudadana y municipal implementadas; falta el recorrido conjunto con servicios reales.
- Revisar el resto de backoffice, cuestionarios dinámicos y examen con pruebas funcionales/accesibilidad específicas; la cobertura de perfil corresponde a su vista inicial.
- Validar matriz, políticas, modalidades de entrega y textos con el municipio; no confundir la credencial municipal con una licencia nacional oficial.
- Pruebas reales en staging, navegadores/dispositivos adicionales y revisión de seguridad de registro/consentimiento antes del merge. No ejecutar contra producción.
- Auditoría npm completa: quedan 10 avisos moderados del tooling de desarrollo, asociados a `minimatch`/ESLint. No se aplicó `audit fix --force` ni se bajaron herramientas para esconderlos. `npm audit --omit=dev` dio cero vulnerabilidades en esta sesión.

La ejecución remota de CI y la aprobación del PR quedan pendientes, aunque los comandos locales pasen.
