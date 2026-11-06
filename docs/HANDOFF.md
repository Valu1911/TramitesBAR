# Handoff del Proyecto — TramitesBAR

**Fecha de actualización:** 2026-11-06

**Rama:** `fix/project-recovery`

**Estado:** UX/QA, navegación por rol (T03), pago ciudadano y revisión municipal de pagos implementados y verificados localmente. Backend actual 59/59, frontend 172 unitarias y 220 de navegador. Pendientes revisión de seguridad e integración. T02 sigue bloqueado por política; los fallos históricos de `jwt` no se reproducen en el venv actual, que ya tiene PyJWT instalado pero no declarado. No se certifica funcionamiento integral ni preparación para producción.

## Sesión 2026-11-06 — Revisión municipal de pagos y permisos operativos

### Qué se hizo y decisiones

- Se agregó **Pagos y comprobantes** en `/admin/tramites` para `admin_pagos`, `admin` y `superadmin`, con MFA al día. Pagos abre esa sección por defecto; los administradores generales la eligen desde sus pestañas. Los demás roles conservan solo sus operaciones.
- Bandeja con búsqueda (referencia, expediente o correo), filtro, paginación de 25 y detalle fresco por selección. Los filtros se resuelven en API; no se filtra una página incompleta en el navegador. El importe y el estado se muestran desde el servidor.
- Revisión explícita: aprobar o rechazar; el rechazo exige al menos 5 caracteres y las observaciones admiten hasta 2000. `*` y validación nativa visible. El comprobante se abre por la descarga autenticada y auditada existente, con la base de API configurada y `noopener noreferrer`; si falta adjunto se informa.
- Se usa el estado devuelto: la primera aprobación puede quedar en `pending_second` y el mismo primer revisor no puede aprobar otra vez. La pantalla no calcula el umbral ni inventa el paso siguiente. Solo `claimed`/`pending_second` permiten decidir; otros estados, incluso desconocidos, quedan en solo lectura.
- Sin aprobación optimista ni reintentos automáticos: ante una respuesta incierta hay que **Actualizar detalle** antes de decidir de nuevo. Actualizar solo la bandeja no desbloquea el formulario. Una aprobación confirmada sigue siendo exitosa aunque falle la recarga posterior del listado.
- Consultas separadas por identidad, caché sin persistencia, cancelación al salir, selección/notas reiniciadas al cambiar de cuenta o rol. Observaciones y nombres se escapan con React; no hay `innerHTML`, handlers ni estilos inline nuevos.
- `staffAccess.ts` centraliza capacidades de presentación y se comprobó contra los permisos reales de API. No otorga permisos: Salud revisa certificados; Turnos opera turnos y credenciales; Pagos no recibe acciones de salud. Se cerraron también los handlers y botones previos que no validaban el rol.
- Backend: `PaymentAdminOut` agrega `procedure_id` y `reviewed_by` solo al contrato administrativo. La revisión vuelve a leer pago y expediente bajo `FOR UPDATE` con refresco ORM, rechaza pagos que ya no están en revisión (`409 payment_not_reviewable`) y expedientes cerrados/fuera de etapa (`409 payment_step_unavailable`) sin reabrirlos. El doble control se sigue exigiendo en servidor.

### Pruebas y evidencia

- Antes de conectar la consola, las regresiones de backend reprodujeron cuatro fallos: una instancia ORM vieja reabría un pago ya aprobado y se podía aprobar sobre un expediente cerrado. Se corrigió con bloqueo y refresco de pago y expediente antes de mutar.
- Backend: **31/31 de pagos** y **59/59 de la suite completa** con dotenv deshabilitado, SQLite en memoria, claves y archivos temporales. Incluye permisos de los siete roles, CSRF/MFA/validación sin mutación, segundo revisor distinto vía HTTP, cierre concurrente y metadatos administrativos ausentes en el contrato ciudadano. Ruff y Mypy aprobados.
- Frontend: **172/172 unitarias** (10 nuevas de la matriz de capacidades) y **220/220 Playwright** en cuatro anchos (56 nuevas de revisión municipal). Cubren doble control, rechazo, permisos, búsqueda/paginación en servidor, fallos de listado, respuesta incierta, fuga de acciones de salud, escape de notas, axe y no desborde. Tipos, ESLint y build aprobados.
- **Diferencia de entorno:** el venv actual es Python 3.13.14 y ya tiene PyJWT 2.15.1; `requirements.txt` sigue sin declararlo. No se acreditó instalación limpia ni CI remoto. Las pruebas SQLite no certifican locks ni concurrencia MySQL.

### Riesgos, pendientes y próximo paso

- **Se solicita revisión de seguridad de pagos, permisos y descargas antes del merge**, además de las revisiones de consentimiento, navegación y archivos ya pedidas. Verificar con MySQL en staging decisiones simultáneas, cierre de expediente concurrente, archivos cifrados/antivirus/retención y correo real.
- La revisión manual no es conciliación bancaria: falta la UI de importación de extractos, conciliación y excepciones, y el recorrido conjunto ciudadano–municipio con servicios reales. El resto del backoffice y los cuestionarios dinámicos siguen sin cobertura funcional propia.
- T02 conserva el bloqueo de modalidad/admisión del examen; no se modificó examen, proctoring, matriz, migraciones ni dependencias. No se accedió a producción, `.env`, bases existentes ni servicios externos.
- Próximo paso independiente: conciliación/importación de pagos con permisos y pruebas propias, o completar la regresión del resto del backoffice. No presentar esta unidad como conciliación completa.

### Cómo probar, archivos y reversión

- [PAGOS_MUNICIPALES.md](PAGOS_MUNICIPALES.md) contiene recorrido, contratos, guardas y límites; [PAGOS_CIUDADANOS.md](PAGOS_CIUDADANOS.md) mantiene el runner aislado de backend; [QA_RESPONSIVE.md](QA_RESPONSIVE.md) cubre Playwright y los totales.
- Archivos: backend `app/schemas/payment.py`, `app/services/payments.py`, `app/services/serializers.py`, `tests/test_payments.py`; frontend `src/pages/admin/AdminPayments.tsx`, `src/pages/admin/AdminProcedures.tsx`, `src/lib/staffAccess.ts`, `src/lib/staffAccess.test.ts`, `src/lib/api.ts`, `src/lib/types.ts`, `src/styles/main.css`, `e2e/admin-payments.spec.ts`, `e2e/navigation.spec.ts`; documentos `PAGOS_MUNICIPALES.md`, `API.md`, `SEGURIDAD.md`, `PAGOS_CIUDADANOS.md`, `QA_RESPONSIVE.md` y este handoff.
- Reversión acotada por PR: retirar la pestaña/componente y sus pruebas si fuera necesario, conservando las guardas de servidor. No hay datos, migraciones ni esquema que revertir. Solo commit local, sin publicar ni mergear.

---

## Sesión 2026-11-06 — Continuación: pago ciudadano y protección del doble control

### Qué se hizo y decisiones

- Ruta ciudadana `/tramites/:id/pago`, acceso desde el panel y etapas tomadas de `procedure.steps`/`position`, sin circuito fijo que omita pago o agregue exámenes no requeridos.
- Consulta monto/referencia/destino reales de API. Copia de datos con feedback honesto, falta de configuración municipal explícita, campos obligatorios y opcionales, formatos y tamaño de comprobante previos al control real del servidor.
- Upload como `payment_receipt` y posterior declaración con el ID devuelto, sin monto cliente ni aprobación. Distingue pendiente, observado, revisión, segundo control, aprobado, reintegrado y desconocido. Ningún estado desconocido habilita enviar.
- Ante respuesta incierta, exige consultar antes de reenviar; reutiliza un adjunto confirmado de una declaración aún pendiente sin subirlo dos veces. No reutiliza automáticamente comprobantes observados o de un pago rechazado. In-flight guard, cancelación al salir y formulario separado por expediente/usuario, sin persistencia de PII en navegador.
- Se corrigió en `claim_payment` el reenvío que borraba revisores o reabría reintegros. Solo `pending`/`rejected` permiten declarar; en otros estados no habilitados devuelve `409 payment_not_claimable` sin alterar controles. Se conserva la guarda de aprobado.
- La consulta bloqueada refresca la instancia ORM con `populate_existing=True`: un pago precargado antes de que otro revisor actúe no puede ocultar ese control. Sin cambios de esquema, migraciones, roles, permisos, dependencias ni reglas de monto.

### Pruebas y evidencia

- Antes de implementar: Playwright reprodujo el panel con etapas ficticias y sin pago. En API, tres regresiones de reenvío devolvían 200 y borraban revisores en lugar de rechazar; otra regresión mostró que el estado ORM viejo omitía un segundo control. Se corrigió antes un error del fixture (dominio `.test` rechazado por `EmailStr`), sin modificar el validador ni atribuir ese fallo al producto.
- Después: backend completo **40/40** con dotenv deshabilitado, entorno limpiado, SQLite en memoria, claves y archivos temporales. Incluye **12 pruebas de pagos** (3 existentes + 9 nuevas), propiedad, CSRF, etapa y revisión sin mutación. Ruff y Mypy (`app tests`, 71 archivos) aprobados.
- Frontend: **162/162 unitarias**, **164/164 Playwright** en cuatro tamaños (40 pruebas nuevas de pago), tipos y ESLint aprobados. La regresión de privacidad cambia la identidad sin recargar la ruta y verifica que nombre/DNI anteriores se limpien. Pago inspeccionado con axe y captura a 320 px. Build aprobado. Las ejecuciones completas no omiten pruebas.
- **Diferencia de entorno:** el venv actual es Python 3.13.14 y ya tiene PyJWT 2.15.1. Los fallos históricos de `jwt` no se reprodujeron al repetir toda la suite; `requirements.txt` sigue sin declararlo. No se instaló PyJWT, no se cambió el manifiesto ni se corrigió la supervisión; no afirmar que un clon limpio o CI está resuelto por este resultado local.
- No se accedió a `.env`, bases existentes, servicios externos ni producción. No hubo migraciones, transferencia bancaria, CI remoto, publicación ni merge. La prueba ORM con SQLite no certifica locks/concurrencia MySQL.

### Riesgos, pendientes y próximo paso

- **Se solicita revisión de seguridad de pagos/archivos antes del merge**, además de las revisiones de consentimiento y navegación pendientes. Verificar el pipeline de archivos (cifrado, antivirus, retención) y flujo de doble control con MySQL en staging.
- Próximo paso independiente: consola de pagos (revisión, segundo control, conciliación y excepciones) y acciones de backoffice por permiso. Falta el recorrido conjunto ciudadano–municipio con servicios reales.
- T02 conserva el bloqueo de modalidad/admisión del examen; la presencia local de PyJWT no elimina las respuestas simuladas ni asegura supervisión. Corregir esa dependencia junto con la unidad correspondiente, sin presentar el examen como seguro.
- No se cambiaron matriz municipal, políticas, examen, CI, `.atl/` ni `legacy/`. El trabajo anterior queda preservado en `f21e994` y `ec193a9`.

### Cómo probar, archivos y reversión

- [PAGOS_CIUDADANOS.md](PAGOS_CIUDADANOS.md) contiene recorrido, contratos, estados y runner de backend aislado reproducible; [QA_RESPONSIVE.md](QA_RESPONSIVE.md) cubre instalación y ejecución de Playwright. No usar `iniciar.bat` ni pruebas contra producción.
- Archivos: backend `app/services/procedures.py`, `tests/test_payments.py`; frontend `src/pages/citizen/Payment.tsx`, `src/pages/citizen/Payment.test.tsx`, `src/lib/payment.ts`, `src/lib/payment.test.ts`, `src/App.tsx`, `src/pages/citizen/CitizenPanel.tsx`, `src/navigation.test.tsx`, `src/styles/main.css`, `e2e/payment.spec.ts`; documentos `PAGOS_CIUDADANOS.md`, `API.md`, `SEGURIDAD.md`, `QA_RESPONSIVE.md` y este handoff.
- Reversión acotada por PR: retirar la UI/ruta si fuera necesario, conservando las guardas del servidor. No reabrir pagos en revisión como arreglo operativo; no hay datos/esquema que revertir. Solo commit local de esta unidad, sin publicar ni mergear.

---

## Sesión 2026-11-06 — Continuación: navegación por rol (T03)

### Qué se hizo y decisiones

- Se agregó `src/lib/navigation.ts` como política única de destinos y enlaces de interfaz. Salud, Turnos y Pagos llegan a `/admin/tramites`; Cuentas, Admin y Superadmin a `/admin/cuentas`; el ciudadano conserva `/panel` y el anónimo `/login`.
- Inicio, rutas públicas con sesión, rechazo de rutas protegidas y ambos logins consumen esa política. Navbar deja de ofrecer Cuentas a especialistas que no pueden abrirla. No se modificaron las allowlists de rutas, los roles ni permisos del backend.
- El enrolamiento MFA informado por servidor lleva al perfil también tras recargar o entrar por URL directa; el perfil permanece disponible y no muestra enlaces operativos hasta terminar. Un desafío TOTP sigue requiriendo su código. No se agrega return URL arbitraria ni persistencia de roles en el cliente.
- Al completar MFA, los enlaces reaparecen sin abandonar el perfil ni los códigos de recuperación que acaba de recibir la persona. Se mantiene el rechazo de ciudadanos en el login municipal.

### Pruebas y evidencia

- Antes de cambiar producción, la regresión enfocada de `admin_salud` produjo 7 fallos de destino y 1 aprobación; las otras 108 pruebas del archivo quedaron fuera de ese filtro. El fallo observado fue `/admin/cuentas` en lugar de `/admin/tramites`.
- Después: Vitest completo **125/125** (120 nuevas de navegación, MFA y límites; 5 ciudadanas anteriores). Las expectativas de rol y destino son independientes de las listas de producción. Se montan las allowlists reales del router; las vistas finales son sentinelas de prueba.
- Playwright completo **124/124** (84 responsive anteriores y 40 nuevas de navegación en los cuatro anchos). En navegador se comprueban los siete roles, redirecciones reales sin bucle, enlaces, marca de inicio, ambos logins de especialista y enrolamiento pendiente tras recarga. No se consulta `/admin/users` desde un rol sin acceso a cuentas ni ningún recurso operativo cuando falta enrolar MFA.
- Typecheck, ESLint y build aprobados. Sin pruebas omitidas en las ejecuciones completas. No se ejecutó backend, ni CI remoto, ni integración con servicios reales.

### Riesgos y qué falta

- **Se solicita revisión de seguridad de navegación/login/MFA antes del merge.** La UI no otorga permisos: el servidor sigue siendo la autoridad. Las pruebas interceptadas no acreditan autorización real del backend.
- La vista operativa todavía contiene pestañas/acciones que deben revisarse por permiso específico; ocultar Cuentas no completa el backoffice de Pagos ni su conciliación. Ese trabajo es una unidad distinta de T03.
- T02 conserva su bloqueo municipal (modalidad y admisión verificable del examen). Siguen pendientes pagos ciudadanos, recorrido completo con servicios reales y revisión de las reglas/textos. No se modificó examen, API, datos, migraciones, dependencias, CI, `.atl/` ni `legacy/`.
- Próximo paso independiente recomendado: pantalla de pago ciudadano y acciones de backoffice ajustadas a los permisos de su API, con revisión de seguridad; para examen hace falta definición municipal antes de implementar la admisión.

### Cómo probar, archivos y reversión

- Desde `sistema_licencias/frontend`: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e`. Solo navegación: `npm test -- src/navigation.test.tsx` y `npm run test:e2e -- e2e/navigation.spec.ts`.
- Archivos: frontend `src/lib/navigation.ts`, `src/App.tsx`, `src/components/Navbar.tsx`, `src/pages/auth/Login.tsx`, `src/pages/admin/AdminLogin.tsx`, `src/navigation.test.tsx`, `e2e/navigation.spec.ts`; `docs/HANDOFF.md`, `docs/QA_RESPONSIVE.md`, `docs/SEGURIDAD.md` y `odd/tasks/project-recovery.md`.
- Reversión: revertir esta unidad de política de UI y sus consumidores/pruebas como conjunto, mediante PR. Sin reversión de datos ni esquema. Se conserva el commit UX anterior `f21e994`. Commit local, sin publicación ni merge.

---

## Sesión 2026-11-06 — Experiencia ciudadana y Playwright

### Qué se hizo y decisiones

- Playwright, Chromium y axe instalados. Suite aislada con cuatro anchos (320, 390, 768, 1440 px), capturas e informe local ignorados por Git. Se incorpora a CI sin tocar backend ni sus checks; Node de frontend pasa a 24 LTS para satisfacer los engines actuales.
- Selección explícita de tipo → categoría → resumen, desplazamiento instantáneo y foco accesible, sin salto al cargar. Se limpia la categoría al cambiar tipo; no se crea el expediente hasta confirmar. Guardas ante matriz ausente y rango de edad tomado de API.
- Al crear se usa el expediente devuelto por API, sin una segunda consulta que pueda reportar falsamente que falló el alta. Opciones bloqueadas durante el envío.
- `*`, leyenda y validación nativa en formularios intervenidos; opcionales de registro identificados. Errores visibles con foco en login, registro, panel y salud. Grupo sanguíneo sin dato médico preseleccionado. Entrega con selección accesible y domicilio señalado como obligatorio si es postal.
- Se elimina el fallback de políticas inventadas del registro y el fallback de licencias vacías ante error. Ambos errores quedan visibles, con reintento; registrar requiere políticas reales disponibles.
- Contraste de enlaces/estados corregido, enlaces de texto subrayados, controles táctiles ampliados, entradas de etapas estilizadas, grillas sin desborde y movimiento reducido. Credencial del panel rotulada municipal, no nacional oficial.

### Verificación local

- Playwright: 84/84 aprobadas (21 escenarios × 4 anchos), incluyendo 40 inspecciones axe (36 de vistas y 4 del resumen de selección). Se revisaron capturas de selección y registro a 320 px. Chromium emulado, no Safari ni dispositivos físicos.
- TypeScript, ESLint, Vitest 5/5 y build aprobados. La suite nueva vive fuera de Vitest y sus archivos/configuración están incluidos en el chequeo de tipos.
- `npm audit --omit=dev`: cero vulnerabilidades; auditoría completa: 10 moderadas del tooling de desarrollo (`minimatch`/ESLint), sin actualización forzada.
- Toda API de las pruebas Playwright está interceptada exclusivamente desde fixtures de test. No se inició backend, no se leyó `.env`, no se migraron bases ni se accedió a servicios reales. No se ejecutó CI remoto ni se publicó/mergeó una rama.

### Riesgos, pendientes y próximo paso

- **Se solicita revisión de seguridad de registro/consentimiento antes del merge.** Pruebas UI no validan persistencia, CSRF, archivos, permisos ni entrega de correo reales.
- T02: definir modalidad remota/presencial de examen v1 y contrato verificable de admisión, luego corregir simulación y fallos `jwt` con regresiones. Se mantiene el bloqueo anterior, sin inventar reglas municipales.
- T03: especialistas todavía redirigidos a `/admin/cuentas`, cuya allowlist no los admite. Resolver navegación sin ampliar permisos.
- Falta recorrido integral de seis matrices y servicios en staging, incluido pago ciudadano (sin pantalla/ruta en el frontend actual), conciliación, emisión, correo y proctoring. Revisar también cuestionarios dinámicos y backoffice; no están cubiertos íntegramente por esta tanda.
- Revisar y aprobar con municipio matriz, textos y modalidades de entrega. Revisar tooling vulnerable en una unidad separada. No afirmar que el sistema entero funciona.

### Cómo probar y archivos

- Instrucciones reproducibles, límites y rollback: [QA_RESPONSIVE.md](QA_RESPONSIVE.md). Ejecutar desde `sistema_licencias/frontend`: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`. Para instalación limpia: `npm ci` y `npx playwright install chromium`.
- Archivos: `.github/workflows/ci.yml`, `.gitignore`, `sistema_licencias/README.md`; frontend `package.json`, `package-lock.json`, `playwright.config.ts`, `tsconfig.node.json`, `vite.config.ts`, `e2e/fixtures.ts`, `e2e/responsive.spec.ts`, `src/components/FormFeedback.tsx`, `src/pages/auth/{Login,Register,ForgotPassword,ResetPassword}.tsx`, `src/pages/admin/AdminLogin.tsx`, `src/pages/citizen/{CitizenPanel,Health,Delivery,Profile,citizenFlow.test}.tsx`, `src/styles/main.css`, `src/test/setup.ts`; documentación `QA_RESPONSIVE.md`, `OPERACION.md`, `SEGURIDAD.md` y este handoff.
- Reversión acotada: revertir esta unidad UX/QA por PR; no hay migraciones ni cambios de API/datos. No recuperar los fallbacks falsos de políticas/credenciales como arreglo operativo.

---

## Sesión 2026-11-05 — Bloqueo de política previo a T02

- Se contrastaron el plan, las decisiones, proctoring, arquitectura y los contratos reales de examen. No se modificaron la aplicación, las pruebas, CI, esquemas ni documentos canónicos para resolver el desacuerdo por cuenta propia.
- `docs/PROCTORING.md:7-16` y `docs/ARQUITECTURA.md:98` describen examen v1 sin WebRTC con `FEATURES_PROCTORING=false`. No limitan expresamente esa modalidad a atención presencial.
- `PLAN_MAESTRO.md:410-446` describe admisión del examinador y cámara, micrófono y pantalla obligatorios; las líneas 630-641 separan examen y proctoring y excluyen este último del corte mínimo productivo. Los ADR de supervisión no resuelven la admisión v1 sin transmisión.
- El inicio por API, `ExamAttempt` y `ProcedureMatrix` no distinguen explícitamente modalidad remota/presencial ni acreditan admisión de un examinador. No corresponde deducir presencia física de una bandera o de datos enviados por el ciudadano.
- **Definición necesaria:** alcance remoto o exclusivamente presencial del examen v1 sin WebRTC y, si se admite el presencial, contrato de admisión verificable en servidor. Un bloqueo general podría eliminar una modalidad legítima; dejar el inicio abierto podría permitir un examen remoto sin supervisión. Se recomienda aclarar este punto antes de modificar la admisión.
- T02 y T03 siguen incompletos. No se añadieron ni ejecutaron pruebas en este preflight; no hay evidencia RED/GREEN nueva. Los resultados de T01 indicados abajo no son una repetición de pruebas de T02. Los fallos por `jwt` no están corregidos.
- El coordinador verificó T01 independientemente sin defectos ni fallos nuevos. La revisión RDD nativa sigue habilitada pero no disponible: `immutable_review_transport_unsupported`, `next_action=stop`, `mutation_not_started`, `retry_safe=false`; no se reintentó, desactivó ni afirmó aprobación.
- Solo se actualizan este handoff y `odd/tasks/project-recovery.md` para conservar el bloqueo. Próximo paso: definición del responsable municipal/coordinador y luego regresiones primero para T02. Sin acceso remoto, servicios reales, migraciones, publicación ni cambios en `.atl/` o `legacy/`.

## Sesión 2026-11-05 — T01: dependencias de desarrollo en CI

**Qué se hizo**
- CI instala `requirements-dev.txt` mediante `python -m pip`; este archivo incluye las dependencias de ejecución. La caché de pip considera tanto `requirements.txt` como `requirements-dev.txt`.
- Se creó el registro recuperable `odd/tasks/project-recovery.md` con alcance, exclusiones, criterios, comandos aislados y evidencia. Se preservó `.atl/` sin incluirlo en el commit.
- No se modificaron la aplicación, las pruebas, los manifiestos de dependencias, los permisos ni los disparadores de CI.

**Decisión y límites**
- Integración por etapas: `chain_strategy: stacked-to-main`, `delivery_strategy: ask-on-risk`. T01 es la primera unidad; T02 y T03 siguen pendientes. Solo trabajo y commits locales; sin publicación, PR ni merge.
- TDD sin estado habilitado verificado; comprobaciones ordinarias para este cambio de aprovisionamiento, sin afirmar un ciclo RED/GREEN. La revisión RDD corresponde al coordinador.

**Verificación observada**
- Backend, con el Python del venv: `ruff check .` sin errores; `mypy app tests` sin errores en 71 archivos; `pip check` sin dependencias rotas.
- Pytest con el aislamiento documentado: 29 aprobadas, 2 fallidas y 1 `StarletteDeprecationWarning`. La repetición con resumen tardó 9,56 s. Son exactamente los mismos fallos de la línea base, no fallos ambientales ni regresiones nuevas observadas.
- Fallan `test_exam_proctoring_token_and_step_validation` y `test_full_procedure_lifecycle_from_start_to_license_issued`: `ModuleNotFoundError: No module named 'jwt'` en `app/services/exams.py:526`. No se omitieron ni modificaron esas pruebas.
- Frontend: `npm run typecheck`, `npm run lint`, `npm test` (5/5, un archivo) y `npm run build` aprobados; 253 módulos transformados.
- Comprobación estructural de YAML aprobada sobre el workflow preparado para commit: instalación de desarrollo, ambas rutas de caché, directorio de trabajo, controles de calidad y permisos de solo lectura.

**Riesgos, prueba y próximo paso**
- Python local 3.14.6 frente a CI 3.12; Node local 24.18.0 frente a CI 20. No se verificó paridad entre versiones, ejecución remota de Actions, restauración de caché ni migraciones MySQL.
- Para repetir las pruebas, usar el wrapper de aislamiento completo y los comandos de `odd/tasks/project-recovery.md`; no ejecutar contra configuración heredada ni usar `iniciar.bat`.
- T01 corrige únicamente el aprovisionamiento; CI todavía puede fallar por los defectos existentes de examen. El siguiente paso es T02, supervisión con rechazo seguro, previa autorización. No se habilitará un examen sin supervisión como alternativa.
- Archivos de esta unidad: `.github/workflows/ci.yml`, `docs/HANDOFF.md`, `odd/tasks/project-recovery.md`. Reversión acotada: líneas de instalación/caché y documentación de T01, sin cambios de esquema ni de aplicación.

## Historial previo (no constituye evidencia vigente)

Las afirmaciones anteriores de pruebas totalmente aprobadas, supervisión real o funcionamiento de punta a punta no describen la verificación actual. Se conservan a continuación como historial; prevalecen el estado y la evidencia de T01 indicados arriba.

---

## Sesión 2026-11-05 — Resolución del merge `37af8f3`

**Qué se hizo**
- El merge `37af8f3` había quedado commiteado con marcadores de conflicto en `App.tsx`, `Icons.tsx`, `lib/api.ts`, `lib/types.ts`, `main.tsx`, `test/setup.ts`, `iniciar.bat`, `README.md` y este archivo. Se resolvieron todos tomando el lado entrante (`375601f`, el último trabajo publicado).
- Se eliminaron los archivos del frontend alternativo de `4d08376` que quedaron sin uso y rompían `tsc`: `pages/PublicPages.tsx`, `pages/CitizenPages.tsx`, `pages/AdminPages.tsx`, `components/Layout.tsx`, `components/AuthContext.tsx`, `components/BariWidget.tsx`, `styles/index.css`, `test/app.test.tsx`. Si hace falta recuperarlos, están en `4d08376`.
- Se corrigieron saltos de línea duplicados (`\r\r\n`) en `backend/app/schemas/procedure.py`.

**Estado verificado**
- Backend: `pytest` 31/31, `ruff` y `mypy` sin errores.
- Frontend: `typecheck`, `lint`, `vitest` (5/5) y `build` sin errores.

**Riesgos y pendientes**
- `legacy/backend/db.py` y `legacy/database/schema.sql` siguen con marcadores de conflicto antiguos (anteriores a este merge). No se tocaron.
- `iniciar.bat` quedó unificado con `iniciar.sh` (venv, dependencias, `.env`, migraciones, semilla y `uvicorn` del venv, cortando ante cada error). Se agregó `.gitattributes` para fijar CRLF en `.bat` y LF en `.sh`. Los pasos 4 y 5 requieren MySQL levantado y un `.env` generado de forma interactiva.

**Próximo paso**
- Levantar MySQL, generar `.env`, correr `iniciar.bat` de punta a punta y retomar el plan en `docs/plan/PLAN_MAESTRO.md`.

---

## 1. Qué se hizo

2026-11-04

---

`fase-0-base`

Los puntos pendientes dependen de definiciones del Municipio de Baradero o de infraestructura de producción:

Senior Architect / Antigravity Agent & Frontend Subagents

---

Consolidación integral de la plataforma municipal de licencias de conducir de Baradero, abarcando todas las etapas del trámite ciudadano y la consola operativa de gestión administrativa:

1. **Flujo Ciudadano Integral (React 19 + TypeScript + Vite)**:
   - **Charlas Viales Obligatorias (`Charlas.tsx`)**: Módulos interactivos secuenciales con telemetría de lectura, bloqueo de avance no visualizado y confirmación de finalización vía `POST /procedures/:id/learning/complete`.
   - **Salud y Declaración Psicofísica (`Health.tsx`)**: Cuestionario médico jurado con grupo sanguíneo, contacto de emergencia y carga multipart/form-data de certificado médico (`POST /procedures/:id/documents` y `POST /procedures/:id/health`).
   - **Examen Teórico Supervisado (`TheoryExam.tsx`)**: Check de hardware obligatorio (pantalla de escritorio, cámara y micrófono), generación de token WebRTC firmado de LiveKit (`POST /procedures/:id/exam/proctoring-token`), cuenta regresiva interactiva, respuestas aleatorizadas y corrección estricta en servidor (`POST /procedures/:id/exam/:attemptId/submit`).
   - **Turno de Examen Práctico (`PracticalAppointment.tsx`)**: Selector reactivo de cupos disponibles (`GET /appointments/available`), reserva inmediata (`POST /procedures/:id/appointments/:id/book`) y credencial de turno con recomendaciones para el circuito.
   - **Gestión de Entrega (`Delivery.tsx`)**: Selección de modalidad (retiro en sede o envío postal a domicilio con validación de dirección) vía `POST /procedures/:id/delivery`.
   - **Credencial Digital Municipal (`CitizenPanel.tsx`)**: Integración con `GET /licenses/mine`. Si el usuario tiene licencia vigente emitida, se renderiza la credencial digital con sello municipal, categoría, vigencia y botón para verificar el QR oficial.
   - **Portal Público de Verificación QR (`VerifyLicense.tsx`)**: Vista pública accesible vía `/verificar/:token` que valida la autenticidad de la credencial contra la base municipal sin exponer datos sensibles ni DNI sin enmascarar.

2. **Consola Operativa Backoffice (`AdminProcedures.tsx`)**:
   - Pestaña **Expedientes y Salud**: Listado paginado de trámites con filtros por estado y buscador general (`q`). Modal de detalle con descarga segura de certificados y botones para **Aprobar Certificado Médico** (avanza automáticamente de salud a teórico) o **Rechazar con observaciones**.
   - Pestaña **Examen Práctico y Turnos**: Agenda municipal en circuito. Modal para **Publicar Nuevo Cupo Práctico** (`POST /admin/appointments`) y botones directos para **Aprobar Manejo** (avanza el trámite de práctico a entrega) o **Reprobar Manejo** (`PATCH /admin/appointments/:id`).
   - Pestaña **Entrega y Licencias**: Bandeja de expedientes con etapas aprobadas listos para confección con botón **Emitir y Entregar Credencial** (`POST /admin/procedures/:id/delivery/complete`), y registro oficial de licencias emitidas con enlace a QR y botón de revocación judicial/médica con motivo (`POST /admin/licenses/:id/revoke`).

3. **Backend LiveKit Proctoring y Normalización de Esquemas**:
   - `ExamProctoringTokenOut` agregado a `app/schemas/exam.py`.
   - `create_proctoring_token` en `app/services/exams.py` generando tokens WebRTC seguros con permisos de video (cámara + compartir pantalla) para sala supervisada de LiveKit.
   - Endpoint `POST /procedures/{procedure_id}/exam/proctoring-token` con guardas de etapa (`current_step == 'theory'`).
   - Desempaquetado transparente en `HealthFormIn` con `@model_validator(mode="before")` para tolerar payloads planos o envueltos en `{ form: ... }`.

4. **Cumplimiento Estricto de Reglas de Proyecto (`AGENTS.md`)**:
   - Cero emojis: interfaz 100% basada en iconos vectoriales SVG limpios (`Icons.tsx`).
   - Cero estilos inline y cero handlers inline: maquetación exclusiva con clases CSS en `src/styles/main.css`.
   - Cero datos sintéticos ni mocks en producción: flujo end-to-end cableado a los endpoints reales de FastAPI y MySQL.
   - Accesibilidad WCAG 2.1 AA y paleta cívica municipal (`#0b2a3a`, `#0284c7`).

5. **Métricas de Calidad y Verificación**:
   - **Backend**: `pytest` 30/30 tests aprobados (100%), `ruff` 0 errores, `mypy` 0 problemas en 63 módulos.
   - **Frontend**: `tsc` 0 errores, `eslint` 0 errores y 0 advertencias, `vitest` 5/5 tests aprobados, `vite build` compilación de producción exitosa con code-splitting.

- Se aplicaron las 15 decisiones cerradas en `docs/plan/DECISIONES.md` (`ADR-001` a `ADR-015`).
- En ausencia de los datos bancarios reales del municipio y de la aprobación legal para menores y proctoring, **no se inventaron datos ni se crearon simulaciones falsas**: se implementaron banderas explícitas (`FEATURES_MINORS`, `FEATURES_PROCTORING`, `FEATURES_DNI_OCR`) y avisos transparentes en la API y en la interfaz.
- Las cuentas administrativas no existen en el `seed`: se crean únicamente mediante `python -m app.cli create-superadmin` o `create-staff` con contraseña ingresada por el operador y obligación de enrolar MFA TOTP en el primer ingreso.

- Configuración de servidor LiveKit de producción (URL y API Secret en variables de entorno `.env`).
- Automatización de conciliación bancaria masiva para cobro presencial y transferencias de aranceles.

## 4. Riesgos identificados

- **Avance de etapas en backend**: Se respetó la máquina de estados del dominio: al aprobar el certificado médico se transiciona de `health` a `theory`; al aprobar el práctico se transiciona a `delivery`; y al confirmar entrega se invoca `issue_license` generando el número oficial y el QR criptográfico.
- **Backoffice unificado**: Se integraron las tres etapas operativas (`salud`, `turnos`, `entrega/licencias`) en `AdminProcedures.tsx` para permitir que el personal municipal califique y emita licencias sin requerir consultas de base de datos directas.
- **Sin efectos de estado síncronos**: Se eliminaron llamadas a `setState` síncronas antes de límites asíncronos en `useEffect`, cumpliendo la regla de React 19 / eslint-plugin-react-hooks.

---

- Ninguno. El sistema funciona de punta a punta tanto para el ciudadano como para el personal administrativo.

## Cómo probar

### 5.1 Backend (lint, tipos y suite de 26 tests)
```powershell
# 1. Backend tests, lint y tipos
cd sistema_licencias/backend
python -m pytest tests
python -m ruff check app tests
python -m mypy app

# 2. Frontend tipos, lint, tests y build
cd ../frontend
npm run typecheck
npm run lint
npm run test
npm run build
```

### 5.2 Frontend (typecheck, lint, tests y build de producción)
```powershell
cd sistema_licencias/frontend
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

- `sistema_licencias/backend/app/api/v1/procedures.py`
- `sistema_licencias/backend/app/schemas/exam.py`
- `sistema_licencias/backend/app/schemas/procedure.py`
- `sistema_licencias/backend/app/services/exams.py`
- `sistema_licencias/backend/tests/test_exams.py`
- `sistema_licencias/frontend/src/App.tsx`
- `sistema_licencias/frontend/src/components/Icons.tsx`
- `sistema_licencias/frontend/src/components/Navbar.tsx`
- `sistema_licencias/frontend/src/lib/api.ts`
- `sistema_licencias/frontend/src/lib/types.ts`
- `sistema_licencias/frontend/src/styles/main.css`
- `sistema_licencias/frontend/src/vite-env.d.ts`
- `sistema_licencias/frontend/src/pages/citizen/Charlas.tsx`
- `sistema_licencias/frontend/src/pages/citizen/Health.tsx`
- `sistema_licencias/frontend/src/pages/citizen/TheoryExam.tsx`
- `sistema_licencias/frontend/src/pages/citizen/PracticalAppointment.tsx`
- `sistema_licencias/frontend/src/pages/citizen/Delivery.tsx`
- `sistema_licencias/frontend/src/pages/citizen/CitizenPanel.tsx`
- `sistema_licencias/frontend/src/pages/citizen/citizenFlow.test.tsx`
- `sistema_licencias/frontend/src/pages/admin/AdminProcedures.tsx`
- `sistema_licencias/frontend/src/pages/public/VerifyLicense.tsx`
- `docs/HANDOFF.md`

# Iniciar backend (genera .env si no existe, corre alembic upgrade head y seed)
cd sistema_licencias
.\iniciar.bat

- `alembic/versions/e27f0525b8ab_verificacion_cuentas_e_infracciones.py`: Incorpora columnas de estado de cuenta y multas a `citizen_profiles` y crea la tabla `account_messages`.

---

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (opcionales; si no están configuradas, se activa el modo simulado de proctoring seguro).

- **Raíz y CI:**
  - `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `CODING_STANDARDS.md`, `.gitignore`
  - `docker-compose.dev.yml`
  - `.github/workflows/ci.yml`
- **Documentación (`docs/`):**
  - `docs/plan/PLAN_MAESTRO.md`, `docs/plan/DECISIONES.md`, `docs/plan/GUIA_RAMAS_Y_MERGE.md`
  - `docs/ARQUITECTURA.md`, `docs/MODELO_DATOS.md`, `docs/API.md`, `docs/SEGURIDAD.md`, `docs/PROCTORING.md`, `docs/OPERACION.md`, `docs/RUNBOOK.md`, `docs/HANDOFF.md`
- **Módulo `sistema_licencias/`:**
  - `sistema_licencias/.env.example`, `sistema_licencias/iniciar.bat`, `sistema_licencias/iniciar.sh`, `sistema_licencias/README.md`
  - `sistema_licencias/backend/pyproject.toml`, `requirements.txt`, `alembic.ini`, `alembic/env.py`, `alembic/versions/d16e0434e5fd_esquema_inicial.py`
  - `sistema_licencias/backend/app/` (`main.py`, `cli.py`, `seed.py`, `worker.py`, `core/*`, `domain/*`, `models/*`, `schemas/*`, `services/*`, `api/*`)
  - `sistema_licencias/backend/scripts/generate_env.py`
  - `sistema_licencias/backend/tests/` (`conftest.py`, `test_auth.py`, `test_procedures.py`, `test_payments.py`, `test_exams.py`, `test_security.py`)
  - `sistema_licencias/frontend/` (`package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `src/lib/*`, `src/components/*`, `src/pages/*`, `src/styles/*`, `src/test/*`, `src/App.tsx`, `src/main.tsx`)

- Probar en entorno de staging y coordinar con el equipo de infraestructura municipal el despliegue del servidor LiveKit.
