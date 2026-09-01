/**
 * Página de Login - Ingreso por DNI y Contraseña con Lector Inteligente de DNI
 */
class LoginPage {
    static render(app) {
        app.innerHTML = `
        <div class="login-page">
            <div class="login-logo animate-fadeIn">
                <div class="login-logo__icon" style="display:flex;align-items:center;justify-content:center;font-size:3rem;margin-bottom:10px">${Icons.car}</div>
                <h1 class="login-logo__text">Muni Digital</h1>
                <p class="login-logo__sub">Sistema de Licencias de Conducir · Municipalidad de Baradero</p>
            </div>

            <div class="login-card animate-slideUp" style="max-width:520px">
                <!-- WIDGET DE ESCÁNER DE DNI EN LOGIN -->
                <div id="loginDniScannerWrapper" style="margin-bottom:16px;"></div>

                <div class="glass-card p-6">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
                        <div style="display:flex;align-items:center;gap:8px;color:var(--primary)">
                            <span style="display:flex;align-items:center;justify-content:center">${Icons.shield}</span>
                            <span class="font-semibold text-sm">Verificación de identidad</span>
                        </div>
                    </div>

                    <!-- BANNER DE BIENVENIDA CON AVATAR CUANDO SE ESCANEA UN DNI EXISTENTE -->
                    <div id="loginUserDetectedCard" style="display:none;background:rgba(37,99,235,0.08);border:1px solid var(--primary-light,#93c5fd);border-radius:var(--radius-md);padding:14px;margin-bottom:16px;" class="animate-fadeIn">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <div id="loginUserAvatar" style="width:48px;height:48px;border-radius:50%;border:2px solid var(--primary);overflow:hidden;background:#e2e8f0;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
                                ${Icons.user}
                            </div>
                            <div style="flex:1;">
                                <div style="font-weight:700;font-size:0.95rem;color:var(--text);" id="loginUserName">¡Hola!</div>
                                <div class="text-xs text-muted" id="loginUserSubtitle">DNI verificado. Ingresá tu contraseña para entrar.</div>
                            </div>
                            <button type="button" class="btn btn-ghost btn-sm" onclick="LoginPage.resetScannedUser()" title="Cambiar usuario" style="font-size:0.75rem;padding:4px 8px;">
                                ✕
                            </button>
                        </div>
                    </div>

                    <form id="loginForm" onsubmit="LoginPage.handleSubmit(event)">
                        <div class="form-group mb-4">
                            <label class="form-label">Documento Nacional de Identidad</label>
                            <input type="text" id="loginDni" class="form-input" 
                                   placeholder="Ej: 35123456" inputmode="numeric" maxlength="10"
                                   autocomplete="off" oninput="LoginPage.handleDniTyping(this.value)">
                        </div>
                        <div class="form-group mb-4">
                            <label class="form-label">Contraseña</label>
                            <input type="password" id="loginPassword" class="form-input" 
                                   placeholder="Tu contraseña" required>
                            <div id="loginError" class="form-error" style="display:none"></div>
                        </div>

                        <button type="submit" class="btn btn-primary btn-block btn-lg" id="loginBtn">
                            Continuar →
                        </button>
                        <button type="button" class="btn btn-ghost btn-block btn-lg" style="margin-top: 12px; font-weight: 500;" onclick="Router.navigate('registro')">
                            Crear nueva cuenta
                        </button>
                    </form>

                    <div style="margin-top:16px;text-align:center">
                        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('admin-login')" 
                                style="font-size:0.75rem;color:var(--text-muted);display:flex;align-items:center;justify-content:center;gap:4px">
                            ${Icons.settings} Acceso administrador
                        </button>
                    </div>
                </div>
            </div>

            <p class="login-footer">Muni Digital · Municipalidad de Baradero © 2026</p>
        </div>`;

        // Renderizar el escáner de DNI dentro del wrapper
        setTimeout(() => {
            DniScanner.render('loginDniScannerWrapper', {
                mode: 'login',
                title: 'Lector de DNI Argentino (Frente / Dorso)',
                subtitle: 'Subí la foto o escaneá con la cámara para ingresar o registrarte automáticamente',
                onResult: (result) => LoginPage.handleDniScanResult(result)
            });
        }, 50);
    }

    static handleDniScanResult(result) {
        if (!result) return;

        const dni = (result.dni || '').toString().trim().replace(/\D/g, '');
        const dniInput = document.getElementById('loginDni');
        const passInput = document.getElementById('loginPassword');
        const userCard = document.getElementById('loginUserDetectedCard');
        const nameEl = document.getElementById('loginUserName');
        const avatarEl = document.getElementById('loginUserAvatar');
        const subEl = document.getElementById('loginUserSubtitle');

        if (dniInput && dni) {
            dniInput.value = dni;
        }

        // Si el usuario existe en la base de datos
        if (result.user_exists && result.usuario_existente) {
            const u = result.usuario_existente;
            if (userCard) userCard.style.display = 'block';
            if (nameEl) nameEl.textContent = `¡Hola, ${u.nombre || result.nombre || 'Ciudadano'}!`;
            if (subEl) subEl.textContent = `DNI ${dni} verificado. Ingresá tu contraseña:`;

            const photo = result.foto_rostro || u.foto_rostro;
            if (avatarEl) {
                if (photo) {
                    avatarEl.innerHTML = `<img src="${photo}" alt="Foto DNI" style="width:100%;height:100%;object-fit:cover;">`;
                } else {
                    avatarEl.innerHTML = Icons.user;
                }
            }

            Toast.success(`✓ DNI de ${u.nombre || result.nombre} detectado. Ingresá tu contraseña.`);
            if (passInput) {
                passInput.focus();
            }
        } else if (dni) {
            // No existe -> transferir datos al Registro
            sessionStorage.setItem('registro_dni', dni);
            if (result.nombre) sessionStorage.setItem('registro_nombre', result.nombre);
            if (result.apellido) sessionStorage.setItem('registro_apellido', result.apellido);
            if (result.fecha_nacimiento) sessionStorage.setItem('registro_fecha_nac', result.fecha_nacimiento);
            if (result.foto_rostro) sessionStorage.setItem('registro_foto_rostro', result.foto_rostro);

            Toast.info(`DNI ${dni} detectado. Redirigiendo al formulario de registro con tus datos...`);
            setTimeout(() => {
                Router.navigate('registro');
            }, 800);
        }
    }

    static resetScannedUser() {
        const userCard = document.getElementById('loginUserDetectedCard');
        const dniInput = document.getElementById('loginDni');
        const passInput = document.getElementById('loginPassword');
        if (userCard) userCard.style.display = 'none';
        if (dniInput) dniInput.value = '';
        if (passInput) passInput.value = '';
    }

    static async handleDniTyping(val) {
        const clean = (val || '').replace(/\D/g, '');
        if (clean.length >= 7 && clean.length <= 8) {
            try {
                const res = await ApiService.checkDni(clean);
                if (res.exists) {
                    const userCard = document.getElementById('loginUserDetectedCard');
                    const nameEl = document.getElementById('loginUserName');
                    const avatarEl = document.getElementById('loginUserAvatar');
                    const subEl = document.getElementById('loginUserSubtitle');
                    
                    if (userCard) userCard.style.display = 'block';
                    if (nameEl) nameEl.textContent = `¡Hola, ${res.nombre || 'Ciudadano'}!`;
                    if (subEl) subEl.textContent = `DNI ${clean} verificado. Ingresá tu contraseña:`;
                    if (avatarEl) {
                        if (res.foto_rostro) {
                            avatarEl.innerHTML = `<img src="${res.foto_rostro}" alt="Foto DNI" style="width:100%;height:100%;object-fit:cover;">`;
                        } else {
                            avatarEl.innerHTML = Icons.user;
                        }
                    }
                }
            } catch (e) {}
        }
    }

    static async handleSubmit(e) {
        e.preventDefault();
        const dniRaw = document.getElementById('loginDni').value.trim();
        const dni = dniRaw.replace(/\D/g, '');
        const password = document.getElementById('loginPassword').value.trim();
        const errorEl = document.getElementById('loginError');
        const btn = document.getElementById('loginBtn');

        if (dni.length < 7 || dni.length > 8) {
            errorEl.textContent = 'Ingresá un DNI válido (7 u 8 dígitos)';
            errorEl.style.display = 'block';
            return;
        }

        if (!password) {
            errorEl.textContent = 'Ingresá tu contraseña';
            errorEl.style.display = 'block';
            return;
        }

        errorEl.style.display = 'none';
        btn.disabled = true;
        btn.textContent = 'Verificando...';

        try {
            const checkResult = await ApiService.checkDni(dni);

            if (checkResult.exists) {
                const loginResult = await ApiService.login(dni, password);
                Toast.success(`¡Bienvenido/a, ${loginResult.usuario.nombre}!`);
                Router.navigate('dashboard');
            } else {
                sessionStorage.setItem('registro_dni', dni);
                Router.navigate('registro');
            }
        } catch (err) {
            if (err.data?.needs_register) {
                sessionStorage.setItem('registro_dni', dni);
                Router.navigate('registro');
            } else {
                errorEl.textContent = err.message || 'Error de conexión';
                errorEl.style.display = 'block';
                Toast.error(err.message || 'Error al verificar DNI');
            }
        } finally {
            btn.disabled = false;
            btn.textContent = 'Continuar →';
        }
    }
}
