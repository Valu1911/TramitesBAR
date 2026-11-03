/**
 * Admin Login Page - Acceso Institucional de Funcionarios y Evaluadores
 */
class AdminLoginPage {
    static render(app) {
        document.body.classList.remove('dark');

        const prefillUser = sessionStorage.getItem('prefill_admin_user') || '';
        if (prefillUser) {
            sessionStorage.removeItem('prefill_admin_user');
        }

        app.innerHTML = `
        <div class="admin-login-page" style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);padding:24px;">
            <div class="login-logo animate-fadeIn" style="text-align:center;margin-bottom:24px">
                <div style="width:52px;height:52px;border-radius:12px;background:#0284c7;border:1px solid #0369a1;color:#ffffff;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:1.45rem;box-shadow:0 8px 20px -4px rgba(2,132,199,0.28)">
                    ${Icons.shield}
                </div>
                <div style="font-size:0.68rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#0284c7;margin-bottom:4px">
                    MUNICIPALIDAD DE BARADERO
                </div>
                <h1 style="font-family:var(--font-title);font-size:1.55rem;font-weight:800;color:#0f172a;letter-spacing:-0.02em;margin:0">
                    Panel Administrativo
                </h1>
                <p style="font-size:0.82rem;color:#64748b;margin-top:4px">
                    Dirección de Tránsito y Transporte · Sistema de Licencias
                </p>
            </div>

            <div class="login-card animate-slideUp" style="max-width:450px;width:100%;">
                <div class="dash-card" style="padding:28px;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 12px 28px -6px rgba(15,23,42,0.08);background:#ffffff;">
                    <div style="display:flex;align-items:center;gap:8px;color:#0f172a;padding-bottom:14px;margin-bottom:18px;border-bottom:1px solid #f1f5f9;font-weight:700;font-size:0.86rem;">
                        <span style="color:#0284c7;display:flex;align-items:center;font-size:1.05rem">${Icons.lock}</span>
                        <span>Credenciales de Funcionario Autorizado</span>
                    </div>

                    <form onsubmit="AdminLoginPage.handleSubmit(event)">
                        <div class="stack" style="gap:14px;">
                            <div class="form-group" style="margin-bottom:0">
                                <label class="form-label" style="color:#0f172a;font-size:0.8rem">Usuario Institucional</label>
                                <input type="text" id="adminUser" class="form-input" style="height:42px;font-size:0.86rem"
                                       placeholder="Ej: admin_cuentas, admin_pagos" value="${prefillUser}" autocomplete="off" required>
                            </div>
                            <div class="form-group" style="margin-bottom:0">
                                <label class="form-label" style="color:#0f172a;font-size:0.8rem">Clave de Seguridad</label>
                                <input type="password" id="adminPass" class="form-input" style="height:42px;font-size:0.86rem"
                                       placeholder="Ingrese su contraseña" required>
                            </div>
                            <div id="adminError" class="form-error" style="display:none;background:#fff5f5;border:1px solid #fed7d7;color:#b84a54;padding:8px 12px;border-radius:8px;font-weight:600"></div>
                            <button type="submit" class="btn btn-primary btn-block" id="adminLoginBtn" style="height:44px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:9px;margin-top:4px">
                                <span>Ingresar al Panel</span>
                                <span style="display:flex;align-items:center">${Icons.chevronRight}</span>
                            </button>
                        </div>
                    </form>

                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-top:20px;font-size:0.75rem;color:#64748b;">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                            <strong style="color:#0f172a;font-size:0.74rem;text-transform:uppercase;letter-spacing:0.04em">Perfiles Operativos (Acceso Rápido)</strong>
                            <span style="color:#64748b;font-size:0.7rem">Selecciona el usuario</span>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:6px">
                            <button type="button" onclick="AdminLoginPage.quickFill('admin_cuentas')" class="btn btn-ghost btn-sm" style="justify-content:flex-start;border:1px solid #e2e8f0;background:#ffffff;color:#334155;font-size:0.74rem;padding:5px 9px;border-radius:6px">
                                <span style="color:#0284c7;display:flex">${Icons.shield}</span> admin_cuentas
                            </button>
                            <button type="button" onclick="AdminLoginPage.quickFill('admin_profesores')" class="btn btn-ghost btn-sm" style="justify-content:flex-start;border:1px solid #e2e8f0;background:#ffffff;color:#334155;font-size:0.74rem;padding:5px 9px;border-radius:6px">
                                <span style="color:#0284c7;display:flex">${Icons.teacher}</span> admin_profesores
                            </button>
                            <button type="button" onclick="AdminLoginPage.quickFill('admin_pagos')" class="btn btn-ghost btn-sm" style="justify-content:flex-start;border:1px solid #e2e8f0;background:#ffffff;color:#334155;font-size:0.74rem;padding:5px 9px;border-radius:6px">
                                <span style="color:#0284c7;display:flex">${Icons.creditCard}</span> admin_pagos
                            </button>
                            <button type="button" onclick="AdminLoginPage.quickFill('admin_salud')" class="btn btn-ghost btn-sm" style="justify-content:flex-start;border:1px solid #e2e8f0;background:#ffffff;color:#334155;font-size:0.74rem;padding:5px 9px;border-radius:6px">
                                <span style="color:#0284c7;display:flex">${Icons.stethoscope}</span> admin_salud
                            </button>
                            <button type="button" onclick="AdminLoginPage.quickFill('admin_turnos')" class="btn btn-ghost btn-sm" style="grid-column:1/-1;justify-content:flex-start;border:1px solid #e2e8f0;background:#ffffff;color:#334155;font-size:0.74rem;padding:5px 9px;border-radius:6px">
                                <span style="color:#0284c7;display:flex">${Icons.calendar}</span> admin_turnos
                            </button>
                        </div>
                    </div>

                    <div style="margin-top:16px;padding-top:12px;border-top:1px solid #f1f5f9;text-align:center">
                        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('login')" 
                                style="font-size:0.78rem;color:#64748b;display:inline-flex;align-items:center;justify-content:center;gap:6px">
                            <span style="display:flex;align-items:center">${Icons.arrowLeft}</span>
                            <span>Volver al Portal del Ciudadano</span>
                        </button>
                    </div>
                </div>
            </div>

            <p class="login-footer" style="margin-top:24px;font-size:0.74rem;color:#94a3b8;">Dirección General de Tránsito y Transporte · Municipalidad de Baradero</p>
        </div>`;

        if (prefillUser) {
            setTimeout(() => {
                const pInput = document.getElementById('adminPass');
                if (pInput) pInput.focus();
            }, 30);
        }
    }

    static quickFill(user) {
        const uInput = document.getElementById('adminUser');
        const pInput = document.getElementById('adminPass');
        if (uInput) uInput.value = user;
        if (pInput) {
            pInput.value = '';
            pInput.focus();
        }
    }

    static async handleSubmit(e) {
        e.preventDefault();
        const btn = document.getElementById('adminLoginBtn');
        const errorEl = document.getElementById('adminError');
        const usuario = document.getElementById('adminUser').value.trim();
        const password = document.getElementById('adminPass').value;

        if (!usuario || !password) {
            errorEl.textContent = 'Completá el usuario y la contraseña para ingresar';
            errorEl.style.display = 'block';
            return;
        }

        errorEl.style.display = 'none';
        btn.disabled = true;
        btn.innerHTML = `<span>Verificando credenciales...</span>`;

        try {
            const result = await ApiService.adminLogin(usuario, password);
            Toast.success(`Sesión iniciada: ${result.admin.nombre}`);

            const redirectMap = {
                'cuentas': 'admin-cuentas',
                'profesores': 'admin-profesores',
                'pagos': 'admin-pagos',
                'salud': 'admin-salud',
                'turnos': 'admin-turnos'
            };
            Router.navigate(redirectMap[result.admin.rol] || 'admin-cuentas');
        } catch (err) {
            errorEl.textContent = err.message || 'Credenciales inválidas o sin permisos';
            errorEl.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<span>Ingresar al Panel</span><span style="display:flex;align-items:center">${Icons.chevronRight}</span>`;
        }
    }
}
