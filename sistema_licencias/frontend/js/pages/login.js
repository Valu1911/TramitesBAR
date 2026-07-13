/**
 * Página de Login - Ingreso por DNI
 */
class LoginPage {
    static render(app) {
        app.innerHTML = `
        <div class="login-page">
            <div class="login-logo animate-fadeIn">
                <div class="login-logo__icon">🚗</div>
                <h1 class="login-logo__text">Muni Digital</h1>
                <p class="login-logo__sub">Sistema de Licencias de Conducir · Municipalidad de Baradero</p>
            </div>

            <div class="login-card animate-slideUp">
                <div class="glass-card p-6">
                    <div style="display:flex;align-items:center;gap:8px;color:var(--primary);margin-bottom:16px">
                        <span>🛡️</span>
                        <span class="font-semibold text-sm">Verificación de identidad</span>
                    </div>

                    <form id="loginForm" onsubmit="LoginPage.handleSubmit(event)">
                        <div class="form-group mb-4">
                            <label class="form-label">Documento Nacional de Identidad</label>
                            <input type="text" id="loginDni" class="form-input" 
                                   placeholder="Ej: 35123456" inputmode="numeric" maxlength="10"
                                   autocomplete="off">
                            <div id="loginError" class="form-error" style="display:none"></div>
                        </div>
                        <button type="submit" class="btn btn-primary btn-block btn-lg" id="loginBtn">
                            Continuar →
                        </button>
                    </form>

                    <div style="margin-top:16px;text-align:center">
                        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('admin-login')" 
                                style="font-size:0.75rem;color:var(--text-muted)">
                            🔧 Acceso administrador
                        </button>
                    </div>
                </div>
            </div>

            <p class="login-footer">Muni Digital · Municipalidad de Baradero © 2026</p>
        </div>`;
    }

    static async handleSubmit(e) {
        e.preventDefault();
        const dniRaw = document.getElementById('loginDni').value.trim();
        const dni = dniRaw.replace(/\D/g, '');
        const errorEl = document.getElementById('loginError');
        const btn = document.getElementById('loginBtn');

        if (dni.length < 7 || dni.length > 8) {
            errorEl.textContent = 'Ingresá un DNI válido (7 u 8 dígitos)';
            errorEl.style.display = 'block';
            return;
        }

        errorEl.style.display = 'none';
        btn.disabled = true;
        btn.textContent = 'Verificando...';

        try {
            const checkResult = await ApiService.checkDni(dni);

            if (checkResult.exists) {
                // Login directo
                const loginResult = await ApiService.login(dni);
                Toast.success(`¡Bienvenido/a, ${loginResult.usuario.nombre}!`);
                Router.navigate('dashboard');
            } else {
                // Necesita registro
                Router.navigate('registro', { dni });
                // Guardamos el DNI temporalmente
                sessionStorage.setItem('registro_dni', dni);
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
