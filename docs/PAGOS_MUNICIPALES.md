# Revisión municipal de pagos

## Operación disponible

En `/admin/tramites`, la sección **Pagos y comprobantes** está disponible para `admin_pagos`, `admin` y `superadmin`, con MFA al día. Es la sección inicial de Pagos; los administradores generales pueden abrirla desde sus pestañas operativas.

1. Consultar la bandeja: búsqueda por referencia, expediente o correo, filtro de estado y páginas de 25. Los filtros y la paginación se procesan en API.
2. Abrir **Ver detalle y revisión**: consulta nuevamente el pago y desplaza el foco al encabezado. Muestra importe y estado del servidor, ciudadano, ordenante y observaciones.
3. **Ver comprobante** abre la descarga autenticada del documento vinculado, con la misma base de API configurada. La API conserva autorización y auditoría; el enlace usa `noopener noreferrer`. La falta de adjunto se indica, no se reemplaza con uno inventado.
4. Elegir explícitamente una decisión. Rechazar exige al menos 5 caracteres no vacíos; las observaciones admiten hasta 2000. Los campos obligatorios llevan `*`.
5. Confirmar registra una decisión municipal, no comprueba una transferencia en el banco. Verificar monto, referencia y transferencia real antes de aprobar.

La pantalla interpreta el estado devuelto, no calcula el umbral de doble control. `pending_second` informa que falta otra persona y bloquea la segunda aprobación del primer revisor; esa persona todavía puede observar el pago, como permite la API. Solo `claimed` y `pending_second` muestran el formulario. Otros estados, incluso desconocidos, quedan en solo lectura.

## Respuestas inciertas y privacidad

- No hay aprobación optimista, reintentos automáticos, cola offline ni persistencia de pagos/PII en el navegador.
- Si falla la respuesta de revisión, hay que usar **Actualizar detalle** antes de decidir nuevamente. Actualizar solo la bandeja no elimina este bloqueo.
- Una aprobación confirmada sigue figurando como exitosa aunque falle la posterior recarga de la bandeja; ese fallo se muestra por separado.
- Consultas separadas por identidad, caché con `gcTime: 0`, selección/formulario reiniciados al cambiar de cuenta o rol y cancelación al salir. Cancelar una solicitud no revierte lo que el servidor ya recibió.
- Nombres y observaciones se presentan como texto escapado por React. No se mandan a Bari ni se registran en logs de esta vista.
- Las capacidades de `staffAccess.ts` solo controlan la presentación. Salud revisa certificados; Turnos opera turnos y credenciales; Pagos no recibe esas acciones. No se amplía ningún permiso del servidor.

## Cambios de contrato y guardas

Se usan los endpoints existentes de listado, detalle y revisión de `/api/v1/admin/payments`. `PaymentAdminOut` incorpora `procedure_id` y `reviewed_by`, solo para respuestas administrativas. El contrato ciudadano no recibe estos campos. Ver [API.md](API.md).

La revisión vuelve a leer el pago y el expediente bajo `FOR UPDATE`, refrescando instancias ORM precargadas. Rechaza pagos que ya no están en revisión (`409 payment_not_reviewable`) y expedientes cerrados o fuera de la etapa de pago (`409 payment_step_unavailable`), sin reabrirlos. El segundo control sigue exigiéndose en servidor. No se modifica esquema, monto, matriz, roles ni dependencias.

## Cómo probar y límites

Frontend, desde `sistema_licencias/frontend`:

```powershell
npm test -- src/lib/staffAccess.test.ts
npm run test:e2e -- e2e/admin-payments.spec.ts
npm run typecheck
npm run lint
npm run build
```

Backend: ejecutar `tests/test_payments.py` con el runner aislado de [PAGOS_CIUDADANOS.md](PAGOS_CIUDADANOS.md). Para toda la suite, usar `tests` en ese runner. No ejecutar contra producción ni usar configuración heredada de `.env`.

Playwright intercepta la API únicamente en tests, usa datos controlados y cuatro anchos; incluye axe, no desborde y capturas `revision-pagos-responsive.png` ignoradas por Git. No mueve dinero ni valida un banco. Las pruebas SQLite comprueban guardas/refresco ORM, **no certifican locks ni concurrencia MySQL**.

**Se solicita revisión de seguridad de pagos, permisos y descargas antes del merge.** Falta validar con MySQL en staging el recorrido ciudadano–municipio, decisiones simultáneas y cierre de expediente concurrente, archivos cifrados/antivirus/retención y correo. PyJWT sigue sin declararse en el manifiesto pese a existir localmente; no se acredita instalación limpia ni CI remoto. El examen conserva su bloqueo de política y no fue modificado.

La UI de importación de extractos, conciliación y excepciones queda para otra unidad: no se presenta la revisión manual como conciliación bancaria automatizada. El resto de backoffice todavía requiere pruebas funcionales propias. Reversión por PR revisado; conservar las guardas del servidor aunque se retire la vista.
