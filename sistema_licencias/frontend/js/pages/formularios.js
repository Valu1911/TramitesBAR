/**
 * Página de Formularios de Salud
 */
class FormulariosPage {
    static async render(app) {
        app.innerHTML = `
        ${renderBackHeader('Formularios de salud')}
        <div class="page-content container-md">
            <div class="text-center" style="padding:40px 0">
                <div class="spinner" style="margin:0 auto"></div>
                <p class="text-muted mt-3">Cargando formularios...</p>
            </div>
        </div>`;

        try {
            const data = await ApiService.getFormularioEstado();
            this.renderContent(app, data);
        } catch (err) {
            app.innerHTML = `
            ${renderBackHeader('Formularios de salud')}
            <div class="page-content container-md">
                <div class="info-box info-box--warning">
                    <span style="display:flex;align-items:center">${Icons.alert}</span>
                    <span>${err.message}</span>
                </div>
                <button class="btn btn-outline btn-block mt-4" onclick="Router.navigate('dashboard')">Volver al panel</button>
            </div>`;
        }
    }

    static renderContent(app, data) {
        if (data.enviado && data.formulario) {
            const f = data.formulario;
            const statusMap = {
                'pendiente': { badge: 'badge-pending', icon: Icons.clock, text: 'Pendiente de revisión' },
                'aprobado': { badge: 'badge-success', icon: Icons.check, text: 'Aprobado' },
                'rechazado': { badge: 'badge-danger', icon: Icons.x, text: 'Rechazado' }
            };
            const st = statusMap[f.estado] || statusMap['pendiente'];

            app.innerHTML = `
            ${renderBackHeader('Formularios de salud')}
            <div class="page-content container-md animate-slideUp">
                <div class="waiting-status ${f.estado === 'pendiente' ? 'waiting-status--pending' : ''}">
                    <div class="waiting-status__icon" style="display:flex;align-items:center;justify-content:center">${st.icon}</div>
                    <h2 class="font-bold" style="font-size:1.25rem;margin-bottom:8px">
                        ${f.estado === 'pendiente' ? 'Formularios enviados' : (f.estado === 'aprobado' ? '¡Formularios aprobados!' : 'Formularios rechazados')}
                    </h2>
                    <span class="badge ${st.badge}">${st.text}</span>
                    <p class="text-muted text-sm mt-3">
                        ${f.estado === 'pendiente' ? 'Un administrador revisará tus datos médicos a la brevedad.' : 
                          f.estado === 'aprobado' ? 'Podés continuar con el pago del arancel.' :
                          'Motivo: ' + (f.observaciones_admin || 'Sin observaciones')}
                    </p>
                </div>

                <div class="glass-card p-4 mt-4">
                    <h3 class="font-semibold text-sm mb-3">Datos enviados</h3>
                    <div class="stack" style="gap:8px">
                        <div class="flex-between"><span class="text-xs text-muted">Grupo sanguíneo</span><span class="text-sm font-semibold">${f.grupo_sanguineo}</span></div>
                        <div class="flex-between"><span class="text-xs text-muted">Usa lentes</span><span class="text-sm font-semibold">${f.usa_lentes}</span></div>
                        <div class="flex-between"><span class="text-xs text-muted">Enfermedad crónica</span><span class="text-sm font-semibold">${f.enfermedad_cronica}</span></div>
                        <div class="flex-between"><span class="text-xs text-muted">Medicación</span><span class="text-sm font-semibold">${f.medicacion}</span></div>
                        <div class="flex-between"><span class="text-xs text-muted">Contacto emergencia</span><span class="text-sm font-semibold">${f.contacto_emergencia}</span></div>
                        <div class="flex-between"><span class="text-xs text-muted">Teléfono emergencia</span><span class="text-sm font-semibold">${f.telefono_emergencia}</span></div>
                    </div>
                </div>

                <button class="btn btn-primary btn-block mt-4" onclick="Router.navigate('dashboard')">Volver al panel</button>
            </div>`;
            return;
        }

        // Formulario sin enviar
        app.innerHTML = `
        ${renderBackHeader('Formularios de salud')}
        <div class="page-content container-md animate-slideUp">
            <p class="text-sm text-muted mb-4">
                Completá estos formularios con tus datos médicos para el trámite de licencia.
            </p>

            <form id="saludForm" onsubmit="FormulariosPage.handleSubmit(event)">
                <div class="glass-card p-5">
                    <div class="stack">
                        <div class="form-group">
                            <label class="form-label">Grupo sanguíneo *</label>
                            <select id="fGrupo" class="form-input" required>
                                <option value="">Seleccionar...</option>
                                <option value="A+">A+</option><option value="A-">A-</option>
                                <option value="B+">B+</option><option value="B-">B-</option>
                                <option value="AB+">AB+</option><option value="AB-">AB-</option>
                                <option value="O+">O+</option><option value="O-">O-</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label class="form-label">¿Usa lentes? *</label>
                            <select id="fLentes" class="form-input" required>
                                <option value="">Seleccionar...</option>
                                <option value="Sí">Sí</option>
                                <option value="No">No</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Enfermedad crónica</label>
                            <input type="text" id="fEnfermedad" class="form-input" placeholder="Ninguna o especificar" value="Ninguna">
                        </div>

                        <div class="form-group">
                            <label class="form-label">Medicación actual</label>
                            <input type="text" id="fMedicacion" class="form-input" placeholder="Ninguna o especificar" value="Ninguna">
                        </div>

                        <div class="form-group">
                            <label class="form-label">Contacto de emergencia *</label>
                            <input type="text" id="fContacto" class="form-input" placeholder="Nombre completo" required>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Teléfono de emergencia *</label>
                            <input type="tel" id="fTelEmergencia" class="form-input" placeholder="Ej: 3329-123456" required>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Certificado del Médico *</label>
                            <input type="file" id="fCertificado" accept="image/*,.pdf" 
                                   class="form-input" style="padding:10px 16px;height:auto"
                                   required onchange="FormulariosPage.handleFile(event)">
                            <div id="certPreview"></div>
                        </div>
                    </div>
                </div>

                <button type="submit" class="btn btn-primary btn-block btn-lg mt-4" id="saludBtn">
                    Enviar formularios
                </button>
            </form>
        </div>`;
        if (window.Tutorial) setTimeout(() => window.Tutorial.startTutorialWithContext('formularios'), 300);
    }

    staticic handleFile(e) {
        const file = e.target.files[0];
        const preview = document.getElementById('certPreview');
        if (!file) { preview.innerHTML = ''; return; }

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                preview.innerHTML = `
                <div class="file-preview mt-2">
                    <img src="${ev.target.result}" alt="Certificado">
                </div>`;
            };
            reader.readAsDataURL(file);
        } else {
            preview.innerHTML = `<p class="text-sm text-muted mt-2" style="display:flex;align-items:center;gap:4px">${Icons.paperclip} ${file.name}</p>`;
        }
    }

    static async handleSubmit(e) {
        e.preventDefault();
        const btn = document.getElementById('saludBtn');
        btn.disabled = true;
        btn.textContent = 'Enviando...';

        // Get certificate as base64 if exists
        let certificado = null;
        const fileInput = document.getElementById('fCertificado');
        if (fileInput.files[0]) {
            certificado = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(fileInput.files[0]);
            });
        }

        try {
            await ApiService.enviarFormularios({
                grupo_sanguineo: document.getElementById('fGrupo').value,
                usa_lentes: document.getElementById('fLentes').value,
                enfermedad_cronica: document.getElementById('fEnfermedad').value || 'Ninguna',
                medicacion: document.getElementById('fMedicacion').value || 'Ninguna',
                contacto_emergencia: document.getElementById('fContacto').value,
                telefono_emergencia: document.getElementById('fTelEmergencia').value,
                certificado_archivo: certificado
            });
            Toast.success('¡Formularios enviados correctamente!');
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message);
            btn.disabled = false;
            btn.textContent = 'Enviar formularios';
        }
    }
}
