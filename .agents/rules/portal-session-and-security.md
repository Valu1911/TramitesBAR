# Reglas de Persistencia de Sesión y Seguridad en el Portal SUBI

1. **Simetría y Bootstrap de Sesión en el Portal del Ciudadano**:
   - Toda página o prototipo del portal del vecino (como `home-ciudadano.html`) debe asegurar la existencia de las claves estándar en `localStorage` y `sessionStorage`:
     `usuario_nombre`, `usuario_username`, `usuario_dni`, `usuario_cuil`, `usuario_email`, `usuario_rol`, `usuario_domicilio`, `subi_user`, `subi_token`.
   - Al cargar vistas autenticadas, debe ejecutarse un bootstrap simétrico para garantizar que al navegar hacia `tramites.html`, `tasas.html`, `legajo.html`, `atencion147.html`, etc., la guardia de autenticación (`authGuard`) en `portal-common.js` reconozca al vecino verificado y nunca provoque rebotes indeseados a `login.html`.

2. **Guardias de Autenticación Resilientes (Zero Redirect Loops)**:
   - La función `authGuard()` en `portal-common.js` verifica de manera jerárquica:
     1. Claves estándar `usuario_nombre` y `usuario_username`.
     2. Objetos de usuario serializados `subi_user` o `subi_auth_user` para auto-hidratar las claves faltantes.
     3. Entornos locales (`file://`, `localhost`, `127.0.0.1`), donde inicializa de forma tolerante el perfil de demostración verificado sin interrumpir la experiencia de evaluación.
     4. En producción estricta sin credenciales, redirige de forma segura a `login.html`.

3. **Ciberseguridad y Prevención XSS / Open-Redirect (CWE-79, CWE-601)**:
   - Todo dato dinámico inyectado en plantillas HTML mediante `innerHTML` (nombres, expedientes, fechas, estados, valores de búsqueda) debe sanitizarse obligatoriamente mediante `escapeHTML()`.
   - Las redirecciones y enlaces entre módulos deben apegarse estrictamente a la lista blanca de rutas relativas validadas del portal.
