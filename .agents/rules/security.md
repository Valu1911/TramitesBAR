# Reglas de Ciberseguridad y Hardening

1. **Inyección SQL**: Toda interacción con la base de datos debe utilizar consultas parametrizadas con SQLAlchemy ORM o parámetros preparados. Queda estrictamente prohibida la interpolación directa de strings en consultas SQL.
2. **Sanitización XSS**: Todas las variables insertadas dinámicamente en el DOM deben ser sanitizadas o insertadas mediante `textContent` para evitar ejecución de scripts no autorizados.
3. **Control de Acceso y Autorización**: Cada endpoint que consulte o modifique recursos (boletas, reclamos, trámites, legajos) debe verificar que el recurso pertenece al usuario solicitante (`id_usuario == current_user.id_usuario`).
4. **Criptografía**: Las contraseñas se deben almacenar exclusivamente con hash `bcrypt` con sal aleatoria. Los tokens de recuperación deben tener expiración de 1 hora y un solo uso.
5. **Cabeceras de Seguridad**: Toda respuesta HTTP de la API debe incluir headers de protección (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`).
