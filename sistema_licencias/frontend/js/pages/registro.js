/**
 * Página de Registro - Nuevo usuario por DNI
 */
class RegistroPage {
    static render(app) {
        const dni = sessionStorage.getItem('registro_dni') || '';

        app.innerHTML = `
        <div class="login-page">
            <div class="login-logo animate-fadeIn">
                <div class="login-logo__icon" style="display:flex;align-items:center;justify-content:center;font-size:3rem;margin-bottom:10px">${Icons.edit}</div>
                <h1 class="login-logo__text">Registro</h1>
                <p class="login-logo__sub">Completá tus datos para crear tu cuenta</p>
            </div>

            <div class="login-card animate-slideUp" style="max-width:460px">
                <div class="glass-card p-6">
                    <form id="registroForm" onsubmit="RegistroPage.handleSubmit(event)">
                        <div class="stack">
                            <div class="form-group">
                                <label class="form-label">DNI</label>
                                <input type="text" id="regDni" class="form-input" value="${dni}" 
                                       ${dni ? 'readonly style="background:var(--bg);opacity:0.7"' : ''}
                                       placeholder="Tu DNI" inputmode="numeric" maxlength="10">
                            </div>

                            <div class="grid-2">
                                <div class="form-group">
                                    <label class="form-label">Nombre *</label>
                                    <input type="text" id="regNombre" class="form-input" placeholder="Tu nombre" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Apellido *</label>
                                    <input type="text" id="regApellido" class="form-input" placeholder="Tu apellido" required>
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Email</label>
                                <input type="email" id="regEmail" class="form-input" placeholder="ejemplo@mail.com">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Teléfono</label>
                                <input type="tel" id="regTelefono" class="form-input" placeholder="Ej: 3329-123456">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Fecha de nacimiento * <span style="font-size:0.75rem;color:var(--text-muted)">(Obligatorio para calcular edad y vigencia)</span></label>
                                <input type="text" id="regFechaNac" class="form-input" placeholder="DD/MM/AAAA" maxlength="10" required oninput="this.value=this.value.replace(/^(\d\d)(\d)$/g,'$1/$2').replace(/^(\d\d\/\d\d)(\d+)$/g,'$1/$2').replace(/[^\d\/]/g,'')">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Dirección</label>
                                <input type="text" id="regDireccion" class="form-input" placeholder="Tu dirección en Baradero">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Tipo de trámite *</label>
                                <select id="regTipo" class="form-input">
                                    <option value="nueva">Licencia nueva (7 pasos con exámenes)</option>
                                    <option value="renovacion">Renovación de licencia (Salud y Pago)</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Contraseña *</label>
                                <input type="password" id="regPassword" class="form-input" placeholder="Mínimo 6 caracteres" required>
                            </div>

                            <div id="regError" class="form-error" style="display:none"></div>

                            <button type="submit" class="btn btn-primary btn-block btn-lg" id="regBtn">
                                Crear cuenta y comenzar trámite →
                            </button>

                            <button type="button" class="btn btn-ghost btn-block btn-sm" style="display:flex;align-items:center;justify-content:center;gap:4px" onclick="Router.navigate('login')">
                                ${Icons.back} Volver al login
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <p class="login-footer">Muni Digital · Municipalidad de Baradero © 2026</p>
        </div>`;
    }

    static async handleSubmit(e) {
        e.preventDefault();
        const btn = document.getElementById('regBtn');
        const errorEl = document.getElementById('regError');

        let fechaFormateada = null;
        const fechaRaw = document.getElementById('regFechaNac').value || '';
        if (fechaRaw.length === 10) {
            const parts = fechaRaw.split('/');
            if (parts.length === 3) {
                fechaFormateada = `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
            }
        }

        const formData = {
            dni: document.getElementById('regDni').value.trim().replace(/\D/g, ''),
            nombre: document.getElementById('regNombre').value.trim(),
            apellido: document.getElementById('regApellido').value.trim(),
            email: document.getElementById('regEmail').value.trim(),
            telefono: document.getElementById('regTelefono').value.trim(),
            fecha_nacimiento: fechaFormateada,
            direccion: document.getElementById('regDireccion').value.trim(),
            tipo_tramite: document.getElementById('regTipo').value,
            password: document.getElementById('regPassword').value.trim()
        };

        if (!formData.nombre || !formData.apellido) {
            errorEl.textContent = 'Nombre y apellido son obligatorios';
            errorEl.style.display = 'block';
            return;
        }

        if (!formData.fecha_nacimiento) {
            errorEl.textContent = 'Ingresá una fecha de nacimiento válida (DD/MM/AAAA)';
            errorEl.style.display = 'block';
            return;
        }

        if (!formData.password || formData.password.length < 6) {
            errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres';
            errorEl.style.display = 'block';
            return;
        }

        if (formData.dni.length < 7 || formData.dni.length > 8) {
            errorEl.textContent = 'DNI inválido (7 u 8 dígitos)';
            errorEl.style.display = 'block';
            return;
        }

        errorEl.style.display = 'none';
        btn.disabled = true;
        btn.textContent = 'Registrando...';

        try {
            const result = await ApiService.registro(formData);
            sessionStorage.removeItem('registro_dni');
            Toast.success(`¡Bienvenido/a, ${result.usuario.nombre}! Tu trámite fue creado.`);
            Router.navigate('dashboard');
        } catch (err) {
            errorEl.textContent = err.message || 'Error al registrar';
            errorEl.style.display = 'block';
            Toast.error(err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Crear cuenta y comenzar trámite →';
        }
    }
}
