/**
 * Admin Login Page
 */
class AdminLoginPage {
    static render(app) {
        app.innerHTML = `
        <div class="admin-login-page">
            <div class="login-logo animate-fadeIn">
                <div class="login-logo__icon">🔧</div>
                <h1 class="login-logo__text">Panel Admin</h1>
                <p class="login-logo__sub">Sistema de Gestión de Licencias de Conducir</p>
            </div>

            <div class="login-card animate-slideUp">
                <div class="glass-card p-6">
                    <form onsubmit="AdminLoginPage.handleSubmit(event)">
                        <div class="stack">
                            <div class="form-group">
                                <label class="form-label">Usuario</label>
                                <input type="text" id="adminUser" class="form-input" 
                                       placeholder="Ej: admin_pagos" autocomplete="off">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Contraseña</label>
                                <input type="password" id="adminPass" class="form-input" 
                                       placeholder="Contraseña">
                            </div>
                            <div id="adminError" class="form-error" style="display:none"></div>
                            <button type="submit" class="btn btn-primary btn-block btn-lg" id="adminLoginBtn">
                                Ingresar →
                            </button>
                        </div>
                    </form>

                    <div class="info-box info-box--info mt-4">
                        <span>ℹ️</span>
                        <div style="font-size:0.75rem">
                            <strong>Usuarios disponibles:</strong><br>
                            admin_pagos · admin_salud · admin_turnos<br>
                            <strong>Contraseña:</strong> admin123
                        </div>
                    </div>

                    <div style="margin-top:16px;text-align:center">
                        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('login')" 
                                style="font-size:0.75rem;color:var(--text-muted)">
                            ← Volver al login de usuarios
                        </button>
                    </div>
                </div>
            </div>

            <p class="login-footer">Panel Administrativo · Municipalidad de Baradero</p>
        </div>`;
    }

    static async handleSubmit(e) {
        e.preventDefault();
        const btn = document.getElementById('adminLoginBtn');
        const errorEl = document.getElementById('adminError');
        const usuario = document.getElementById('adminUser').value.trim();
        const password = document.getElementById('adminPass').value;

        if (!usuario || !password) {
            errorEl.textContent = 'Completá todos los campos';
            errorEl.style.display = 'block';
            return;
        }

        errorEl.style.display = 'none';
        btn.disabled = true;
        btn.textContent = 'Verificando...';

        try {
            const result = await ApiService.adminLogin(usuario, password);
            Toast.success(`Bienvenido, ${result.admin.nombre}`);

            // Redirigir según rol
            const redirectMap = {
                'pagos': 'admin-pagos',
                'salud': 'admin-salud',
                'turnos': 'admin-turnos'
            };
            Router.navigate(redirectMap[result.admin.rol] || 'admin-pagos');
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Ingresar →';
        }
    }
}
