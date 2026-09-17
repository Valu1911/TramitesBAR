/**
 * Página de Login - Ingreso por DNI y Contraseña con Lector Inteligente de DNI
 */
class LoginPage {
    static render(app) {
        app.innerHTML = `
        <div class="login-page">
            <div class="login-logo animate-fadeIn">
                <div class="login-logo__icon" style="display:flex;align-items:center;justify-content:center">
                    <svg viewBox="0 0 44 44" width="52" height="52" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="22" cy="22" r="21" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
                        <path d="M12 22C12 16.477 16.477 12 22 12C25.5 12 28.5 13.8 30.2 16.5" stroke="#1976d2" stroke-width="3.5" stroke-linecap="round"/>
                        <path d="M32 22C32 27.523 27.523 32 22 32C18.5 32 15.5 30.2 13.8 27.5" stroke="#1976d2" stroke-width="3.5" stroke-linecap="round"/>
                        <path d="M17 22C17 19.239 19.239 17 22 17C23.8 17 25.3 18 26.2 19.5" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
                        <path d="M27 22C27 24.761 24.761 27 22 27C20.2 27 18.7 26 17.8 24.5" stroke="#0284c7" stroke-width="3" stroke-linecap="round"/>
                    </svg>
                </div>
                <h1 class="login-logo__text" style="font-family:'Plus Jakarta Sans',Inter,sans-serif">CIUDADANO <span style="font-weight:400;color:#0284c7">DIGITAL</span></h1>
                <p class="login-logo__sub" style="font-weight:700;letter-spacing:1.2px;text-transform:uppercase;font-size:0.68rem">LICENCIAS · MUNICIPIO DE BARADERO</p>
            </div>

            <div class="login-card animate-slideUp" style="max-width:520px">
                <!-- WIDGET DE ESCÁNER DE DNI EN LOGIN -->
                <div id="loginDniScannerWrapper" style="margin-bottom:16px;"></div>

                <div class="glass-card p-6">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
                        <div style="display:flex;align-items:center;gap:8px;color:#0284c7">
                            <span style="display:flex;align-items:center;justify-content:center">${Icons.shield}</span>
                            <span style="font-weight:700;font-size:0.84rem;letter-spacing:0.2px">Verificación de identidad</span>
                        </div>
                    </div>

                    <!-- BANNER DE BIENVENIDA CON AVATAR CUANDO SE ESCANEA UN DNI EXISTENTE -->
                    <div id="loginUserDetectedCard" style="display:none;background:#e0f2fe;border:1px solid #bae6fd;border-radius:12px;padding:14px;margin-bottom:16px;" class="animate-fadeIn">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <div id="loginUserAvatar" style="width:48px;height:48px;border-radius:50%;border:2px solid #0284c7;overflow:hidden;background:#f0f9ff;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#0284c7;">
                                ${Icons.user}
                            </div>
                            <div style="flex:1;">
                                <div style="font-weight:800;font-size:0.95rem;color:#1e293b;" id="loginUserName">¡Hola!</div>
                                <div style="font-size:0.78rem;color:#64748b;" id="loginUserSubtitle">DNI verificado. Ingresá tu contraseña para entrar.</div>
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
                            Continuar
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        </button>
                        <button type="button" class="btn btn-ghost btn-block btn-lg" style="margin-top: 12px; font-weight: 500;" onclick="Router.navigate('registro')">
                            Crear nueva cuenta
                        </button>
                    </form>

                    <div style="margin-top:16px;text-align:center">
                        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('admin-login')" 
                                style="font-size:0.75rem;color:#94a3b8;display:flex;align-items:center;justify-content:center;gap:4px">
                            ${Icons.settings} Acceso administrador
                        </button>
                    </div>
                </div>
            </div>

            <p class="login-footer">Ciudadano Digital · Municipalidad de Baradero © 2026</p>
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
