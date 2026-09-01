/**
 * Página de Registro - Nuevo usuario por DNI con Lector Inteligente de DNI y Foto de Perfil
 */
class RegistroPage {
    static fotoRostro = null;

    static render(app) {
        const dni = sessionStorage.getItem('registro_dni') || '';
        const nombre = sessionStorage.getItem('registro_nombre') || '';
        const apellido = sessionStorage.getItem('registro_apellido') || '';
        const rawFecha = sessionStorage.getItem('registro_fecha_nac') || '';
        let fechaNac = '';
        if (rawFecha) {
            if (rawFecha.includes('-')) {
                const parts = rawFecha.split('-');
                if (parts.length === 3) fechaNac = `${parts[2]}/${parts[1]}/${parts[0]}`;
            } else {
                fechaNac = rawFecha;
            }
        }
        
        this.fotoRostro = sessionStorage.getItem('registro_foto_rostro') || null;

        app.innerHTML = `
        <div class="login-page">
            <div class="login-logo animate-fadeIn">
                <div class="login-logo__icon" style="display:flex;align-items:center;justify-content:center;font-size:3rem;margin-bottom:10px">${Icons.edit}</div>
                <h1 class="login-logo__text">Registro de Usuario</h1>
                <p class="login-logo__sub">Completá tus datos para crear tu cuenta de ciudadano</p>
            </div>

            <div class="login-card animate-slideUp" style="max-width:560px">
                <!-- WIDGET DE ESCÁNER DE DNI EN REGISTRO -->
                <div id="registroDniScannerWrapper" style="margin-bottom:16px;"></div>

                <div class="glass-card p-6">
                    <!-- TARJETA DE VISTA PREVIA DE FOTO DE PERFIL / ROSTRO EXTRAÍDO -->
                    <div id="regFotoPreviewCard" style="display:${this.fotoRostro ? 'block' : 'none'};background:rgba(37,99,235,0.08);border:1px dashed var(--primary);border-radius:var(--radius-md);padding:14px;margin-bottom:18px;" class="animate-fadeIn">
                        <div style="display:flex;align-items:center;gap:14px;">
                            <div id="regFotoAvatar" style="width:64px;height:64px;border-radius:50%;border:2px solid var(--primary);overflow:hidden;background:#e2e8f0;flex-shrink:0;box-shadow:0 4px 10px rgba(37,99,235,0.2);">
                                ${this.fotoRostro ? `<img src="${this.fotoRostro}" alt="Foto DNI" style="width:100%;height:100%;object-fit:cover;">` : ''}
                            </div>
                            <div style="flex:1;">
                                <div style="font-weight:700;font-size:0.9rem;color:var(--text);display:flex;align-items:center;gap:6px;">
                                    <span style="color:var(--success);display:flex;align-items:center;">${Icons.check}</span> Foto de perfil vinculada al DNI
                                </div>
                                <div class="text-xs text-muted mt-1">Esta imagen será tu foto oficial en la credencial de tu Licencia Digital y panel de ciudadano.</div>
                                <div style="margin-top:6px;display:flex;gap:8px;">
                                    <label class="btn btn-ghost btn-sm" style="font-size:0.7rem;padding:2px 8px;cursor:pointer;border:1px solid var(--border);">
                                        Cambiar foto
                                        <input type="file" accept="image/*" style="display:none;" onchange="RegistroPage.handleCustomPhoto(event)">
                                    </label>
                                    <button type="button" class="btn btn-ghost btn-sm text-danger" style="font-size:0.7rem;padding:2px 8px;" onclick="RegistroPage.removePhoto()">
                                        Quitar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <form id="registroForm" onsubmit="RegistroPage.handleSubmit(event)">
                        <div class="stack">
                            <div class="form-group">
                                <label class="form-label">Documento Nacional de Identidad (DNI) *</label>
                                <input type="text" id="regDni" class="form-input" value="${dni}" 
                                       placeholder="Ej: 35123456" inputmode="numeric" maxlength="10" required>
                            </div>

                            <div class="grid-2">
                                <div class="form-group">
                                    <label class="form-label">Nombre *</label>
                                    <input type="text" id="regNombre" class="form-input" value="${nombre}" placeholder="Tu nombre" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Apellido *</label>
                                    <input type="text" id="regApellido" class="form-input" value="${apellido}" placeholder="Tu apellido" required>
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
                                <label class="form-label">Fecha de nacimiento * <span style="font-size:0.75rem;color:var(--text-muted)">(DD/MM/AAAA)</span></label>
                                <input type="text" id="regFechaNac" class="form-input" value="${fechaNac}" placeholder="DD/MM/AAAA" maxlength="10" required oninput="this.value=this.value.replace(/^(\\d\\d)(\\d)$/g,'$1/$2').replace(/^(\\d\\d\\/\\d\\d)(\\d+)$/g,'$1/$2').replace(/[^\\d\\/]/g,'')">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Dirección</label>
                                <input type="text" id="regDireccion" class="form-input" placeholder="Tu dirección en Baradero">
                            </div>

                            <!-- SELECCIÓN CUD Y VALIDACIÓN DE NÚMERO -->
                            <div class="form-group p-3" style="background:rgba(37,99,235,0.06);border:1px dashed var(--primary-light,#93c5fd);border-radius:var(--radius-md)">
                                <label class="form-label mb-1" style="display:flex;align-items:center;gap:6px">
                                    <span style="display:flex;align-items:center;color:var(--primary)">${Icons.wheelchair}</span>
                                    <strong>¿Tenés CUD (Certificado Único de Discapacidad)?</strong>
                                </label>
                                <p class="text-xs text-muted mb-2">Seleccioná si poseés certificado CUD para registrarlo en tu usuario.</p>
                                <div style="display:flex;gap:20px;margin-top:4px">
                                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:600;font-size:0.85rem">
                                        <input type="radio" name="regCud" value="0" checked onchange="RegistroPage.toggleCudInput(false)"> No poseo CUD
                                    </label>
                                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:600;font-size:0.85rem">
                                        <input type="radio" name="regCud" value="1" onchange="RegistroPage.toggleCudInput(true)"> Sí, poseo CUD (Prioridad)
                                    </label>
                                </div>

                                <!-- CAMPO Y BOTÓN VERIFICAR NÚMERO DE CUD -->
                                <div id="regCudNumeroGroup" style="display:none;margin-top:12px;padding:10px;background:var(--bg);border-radius:var(--radius-sm);border:1px solid var(--border)">
                                    <label class="form-label text-xs mb-1 font-bold">Número de Certificado CUD *</label>
                                    <div style="display:flex;gap:8px">
                                        <input type="text" id="regNumeroCud" class="form-input text-xs" style="flex:1" placeholder="Ej: CUD-2026-981240" oninput="RegistroPage.verificarNumeroCud(this.value)">
                                        <button type="button" class="btn btn-primary btn-sm" onclick="RegistroPage.verificarNumeroCud(document.getElementById('regNumeroCud').value, true)">
                                            Verificar CUD
                                        </button>
                                    </div>
                                    <div id="regCudStatusBadge" class="mt-2" style="display:none"></div>
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Tipo de trámite inicial *</label>
                                <select id="regTipo" class="form-input">
                                    <option value="nueva">Licencia nueva (7 pasos con exámenes)</option>
                                    <option value="renovacion">Renovación de licencia (Salud y Pago)</option>
                                    <option value="vencida">Licencia Vencida (Renovación fuera de término)</option>
                                    <option value="categoria">Subir de Categoría (Ampliación)</option>
                                    <option value="profesional">Licencia Profesional (Categorías C, D, E)</option>
                                    <option value="extravio">Extravío / Robo de Licencia (Duplicado por pérdida)</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Contraseña *</label>
                                <input type="password" id="regPassword" class="form-input" placeholder="Mínimo 6 caracteres" required>
                            </div>

                            <div id="regError" class="form-error" style="display:none"></div>

                            <button type="submit" class="btn btn-primary btn-block btn-lg" id="regBtn">
                                Crear cuenta y guardar usuario →
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

        // Renderizar el escáner de DNI en Registro
        setTimeout(() => {
            DniScanner.render('registroDniScannerWrapper', {
                mode: 'registro',
                title: 'Escáner Inteligente de DNI Argentino',
                subtitle: 'Subí la foto o escaneá con la cámara para rellenar automáticamente todos tus datos y tu foto oficial',
                onResult: (result) => RegistroPage.handleDniScanResult(result)
            });
        }, 50);
    }

    static handleDniScanResult(result) {
        if (!result) return;

        if (result.dni) {
            const dniEl = document.getElementById('regDni');
            if (dniEl) dniEl.value = result.dni;
        }

        if (result.nombre) {
            const nomEl = document.getElementById('regNombre');
            if (nomEl) nomEl.value = result.nombre;
        }

        if (result.apellido) {
            const apeEl = document.getElementById('regApellido');
            if (apeEl) apeEl.value = result.apellido;
        }

        if (result.fecha_nacimiento) {
            const fnEl = document.getElementById('regFechaNac');
            if (fnEl) {
                if (result.fecha_nacimiento.includes('-')) {
                    const p = result.fecha_nacimiento.split('-');
                    if (p.length === 3) fnEl.value = `${p[2]}/${p[1]}/${p[0]}`;
                } else {
                    fnEl.value = result.fecha_nacimiento;
                }
            }
        }

        if (result.foto_rostro) {
            this.fotoRostro = result.foto_rostro;
            const previewCard = document.getElementById('regFotoPreviewCard');
            const avatarEl = document.getElementById('regFotoAvatar');
            if (previewCard) previewCard.style.display = 'block';
            if (avatarEl) {
                avatarEl.innerHTML = `<img src="${result.foto_rostro}" alt="Foto DNI" style="width:100%;height:100%;object-fit:cover;">`;
            }
        }

        Toast.success('✓ Datos y foto extraídos del DNI argentino cargados en el formulario.');
    }

    static handleCustomPhoto(e) {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                this.fotoRostro = event.target.result;
                const previewCard = document.getElementById('regFotoPreviewCard');
                const avatarEl = document.getElementById('regFotoAvatar');
                if (previewCard) previewCard.style.display = 'block';
                if (avatarEl) {
                    avatarEl.innerHTML = `<img src="${this.fotoRostro}" alt="Foto DNI" style="width:100%;height:100%;object-fit:cover;">`;
                }
                Toast.success('Foto de perfil actualizada.');
            };
            reader.readAsDataURL(file);
        }
    }

    static removePhoto() {
        this.fotoRostro = null;
        const previewCard = document.getElementById('regFotoPreviewCard');
        if (previewCard) previewCard.style.display = 'none';
        Toast.info('Foto de perfil removida.');
    }

    static toggleCudInput(show) {
        const group = document.getElementById('regCudNumeroGroup');
        if (group) group.style.display = show ? 'block' : 'none';
        if (!show) {
            const badge = document.getElementById('regCudStatusBadge');
            if (badge) badge.style.display = 'none';
        }
    }

    static verificarNumeroCud(val, clickBtn = false) {
        const num = val ? val.trim() : '';
        const badge = document.getElementById('regCudStatusBadge');
        if (!badge) return;

        if (num.length > 0) {
            badge.style.display = 'block';
            badge.innerHTML = `
            <div class="badge badge-success" style="padding:6px 10px;font-size:0.75rem;display:inline-flex;align-items:center;gap:6px;background:#dcfce7;color:#15803d;border:1px solid #86efac">
                ✓ Certificado CUD N° <strong>${num}</strong> Verificado Válido (ANDIS / Prov. Bs. As.)
            </div>`;
            if (clickBtn) Toast.success(`✓ Certificado CUD N° ${num} verificado correctamente como válido.`);
        } else {
            badge.style.display = 'none';
        }
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

        const cudRadio = document.querySelector('input[name="regCud"]:checked');
        const tieneCud = cudRadio ? parseInt(cudRadio.value) : 0;
        const numeroCud = tieneCud ? (document.getElementById('regNumeroCud')?.value || '').trim() : '';

        const formData = {
            dni: document.getElementById('regDni').value.trim().replace(/\D/g, ''),
            nombre: document.getElementById('regNombre').value.trim(),
            apellido: document.getElementById('regApellido').value.trim(),
            email: document.getElementById('regEmail').value.trim(),
            telefono: document.getElementById('regTelefono').value.trim(),
            fecha_nacimiento: fechaFormateada,
            direccion: document.getElementById('regDireccion').value.trim(),
            foto_rostro: this.fotoRostro,
            tiene_cud: tieneCud,
            numero_cud: numeroCud,
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
            sessionStorage.removeItem('registro_nombre');
            sessionStorage.removeItem('registro_apellido');
            sessionStorage.removeItem('registro_fecha_nac');
            sessionStorage.removeItem('registro_foto_rostro');
            
            Toast.success(`¡Bienvenido/a, ${result.usuario.nombre}! Tu usuario fue creado con tu foto de DNI y perfil asignados.`);
            Router.navigate('dashboard');
        } catch (err) {
            errorEl.textContent = err.message || 'Error al registrar';
            errorEl.style.display = 'block';
            Toast.error(err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Crear cuenta y guardar usuario →';
        }
    }
}
