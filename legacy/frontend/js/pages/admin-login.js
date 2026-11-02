/**
 * Admin Login Page - Acceso Administrativo y Profesores
 */
class AdminLoginPage {
    static render(app) {
        app.innerHTML = `
        <div class="admin-login-page" style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8fafc;padding:24px;">
            <div class="login-logo animate-fadeIn">
                <div class="login-logo__icon" style="display:flex;align-items:center;justify-content:center">
                    <svg viewBox="0 0 44 44" width="54" height="54" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="22" cy="22" r="21" fill="#1e293b" stroke="#334155" stroke-width="1"/>
                        <path d="M14 22L20 28L30 16" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="22" cy="22" r="14" stroke="#0284c7" stroke-width="2" stroke-dasharray="4 3"/>
                    </svg>
                </div>
                <h1 class="login-logo__text" style="font-family:'Plus Jakarta Sans',Inter,sans-serif;color:#1e293b;">ADMIN <span style="font-weight:400;color:#0284c7">PANEL</span></h1>
                <p class="login-logo__sub" style="font-weight:700;letter-spacing:1.2px;text-transform:uppercase;font-size:0.68rem;color:#64748b;">GESTIÓN DE LICENCIAS · MUNICIPIO DE BARADERO</p>
            </div>

            <div class="login-card animate-slideUp" style="max-width:440px;width:100%;">
                <div class="dash-card p-6" style="border:1.5px solid #e2e8f0;box-shadow:0 12px 28px -4px rgba(0,0,0,0.08);">
                    <div style="display:flex;align-items:center;gap:8px;color:#0284c7;margin-bottom:16px;font-weight:700;font-size:0.85rem;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        <span>Acceso de Funcionarios y Evaluadores</span>
                    </div>

                    <form onsubmit="AdminLoginPage.handleSubmit(event)">
                        <div class="stack" style="gap:14px;">
                            <div class="form-group">
                                <label class="form-label font-bold" style="color:#1e293b;">Identificador de Usuario</label>
                                <input type="text" id="adminUser" class="form-input" 
                                       placeholder="Ej: admin_profesores, admin_cuentas" autocomplete="off" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label font-bold" style="color:#1e293b;">Clave de Seguridad</label>
                                <input type="password" id="adminPass" class="form-input" 
                                       placeholder="Contraseña oficial" required>
                            </div>
                            <div id="adminError" class="form-error" style="display:none"></div>
                            <button type="submit" class="btn btn-primary btn-block btn-lg" id="adminLoginBtn" style="font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;">
                                Ingresar al Sistema
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                            </button>
                        </div>
                    </form>

                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-top:20px;font-size:0.75rem;color:#64748b;">
                        <strong style="color:#1e293b;display:block;margin-bottom:4px;">Usuarios demo preconfigurados:</strong>
                        <div>• admin_cuentas · admin_profesores · admin_pagos</div>
                        <div>• admin_salud · admin_turnos</div>
                        <div style="margin-top:4px;color:#0284c7;font-weight:700;">Clave unificada: admin123</div>
                    </div>

                    <div style="margin-top:16px;text-align:center">
                        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('login')" 
                                style="font-size:0.78rem;color:#64748b;display:inline-flex;align-items:center;justify-content:center;gap:6px">
                            ← Volver al Portal de Ciudadanos
                        </button>
                    </div>
                </div>
            </div>

            <p class="login-footer" style="margin-top:24px;font-size:0.75rem;color:#94a3b8;">Dirección de Tránsito y Transporte · Municipalidad de Baradero © 2026</p>
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
                'cuentas': 'admin-cuentas',
                'profesores': 'admin-profesores',
                'pagos': 'admin-pagos',
                'salud': 'admin-salud',
                'turnos': 'admin-turnos'
            };
            Router.navigate(redirectMap[result.admin.rol] || 'admin-cuentas');
        } catch (err) {
            errorEl.textContent = err.message || 'Error de autenticación';
            errorEl.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Ingresar →';
        }
    }
}
