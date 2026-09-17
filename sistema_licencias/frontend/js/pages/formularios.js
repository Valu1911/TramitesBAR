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
            const demoEstado = JSON.parse(localStorage.getItem('demo_formulario_estado') || 'null');
            this.renderContent(app, demoEstado || { enviado: false, formulario: null });
            if (err && err.status === 403) {
                Toast.info('Modo Demo: Sección de Declaración de Salud.');
            }
        }
    }

    static renderContent(app, data) {
        if (data.enviado && data.formulario) {
            const f = data.formulario;
            const statusMap = {
                'pendiente': { badge: 'badge-warning', bg: '#fef3c7', color: '#b45309', icon: Icons.clock, text: 'En Revisión Médica' },
                'aprobado': { badge: 'badge-success', bg: '#dcfce7', color: '#15803d', icon: Icons.check, text: 'Apto Médico Aprobado' },
                'rechazado': { badge: 'badge-danger', bg: '#fee2e2', color: '#b91c1c', icon: Icons.x, text: 'Declaración Observada' }
            };
            const st = statusMap[f.estado] || statusMap['pendiente'];

            app.innerHTML = `
            ${renderBackHeader('Declaración de Salud y Apto Médico')}
            <div class="page-content container-md animate-slideUp" style="max-width:760px;margin:0 auto;padding-top:12px;">
                
                <div class="dash-card text-center mb-4" style="border:1.5px solid #e2e8f0;padding:32px 24px;">
                    <div style="width:68px;height:68px;border-radius:50%;background:${st.bg};color:${st.color};display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 14px auto;">
                        ${st.icon}
                    </div>
                    <span class="badge ${st.badge} mb-2" style="font-size:0.8rem;padding:4px 12px;font-weight:700;">${st.text}</span>
                    <h2 style="font-size:1.3rem;font-weight:800;color:#1e293b;margin-bottom:6px;">
                        ${f.estado === 'pendiente' ? 'Declaración Médica Recibida' : (f.estado === 'aprobado' ? '¡Apto Médico Oficial Aprobado!' : 'Formularios con Observaciones')}
                    </h2>
                    <p style="font-size:0.85rem;color:#64748b;margin:0;max-width:540px;margin:0 auto 20px auto;">
                        ${f.estado === 'pendiente' ? 'El equipo de Salud del Municipio de Baradero está auditando tu ficha médica y certificado adjunto.' : 
                          f.estado === 'aprobado' ? 'Cumplís con las condiciones de aptitud física. Ya podés rendir tu examen teórico supervisado.' :
                          'Motivo informado por el médico: ' + (f.observaciones_admin || 'Por favor comunicate con el área de licencias.')}
                    </p>

                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;text-align:left;margin-bottom:24px;">
                        <h3 style="font-size:0.88rem;font-weight:800;color:#1e293b;margin-bottom:12px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">Resumen de Declaración Jurada</h3>
                        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:10px;font-size:0.82rem;">
                            <div><span class="text-muted">Grupo Sanguíneo:</span> <strong>${f.grupo_sanguineo}</strong></div>
                            <div><span class="text-muted">Uso de Lentes:</span> <strong>${f.usa_lentes}</strong></div>
                            <div><span class="text-muted">Enfermedad Crónica:</span> <strong>${f.enfermedad_cronica || 'Ninguna'}</strong></div>
                            <div><span class="text-muted">Medicación Actual:</span> <strong>${f.medicacion || 'Ninguna'}</strong></div>
                            <div><span class="text-muted">Contacto de Emergencia:</span> <strong>${f.contacto_emergencia}</strong></div>
                            <div><span class="text-muted">Tel. Emergencia:</span> <strong>${f.telefono_emergencia}</strong></div>
                        </div>
                    </div>

                    <button class="btn btn-primary btn-block btn-lg" style="font-weight:700" onclick="Router.navigate('dashboard')">
                        Volver al Panel Principal
                    </button>
                </div>

            </div>`;
            return;
        }

        // Formulario sin enviar
        app.innerHTML = `
        ${renderBackHeader('Formularios de Salud')}
        <div class="page-content container-md animate-slideUp" style="max-width:800px;margin:0 auto;padding-top:12px;">
            
            <div class="dash-card">
                <div class="card-header-row">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div style="width:40px;height:40px;border-radius:50%;background:#e0f2fe;color:#0284c7;display:flex;align-items:center;justify-content:center;font-size:1.2rem;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                        </div>
                        <div>
                            <h2 style="font-size:1.1rem;font-weight:800;margin:0;color:#1e293b;">Declaración Jurada de Salud</h2>
                            <p style="font-size:0.8rem;color:#64748b;margin:0;">Paso 2 de 7 · Completá tus antecedentes clínicos y subí tu apto médico.</p>
                        </div>
                    </div>
                    <span class="badge badge-info" style="font-size:0.75rem;padding:3px 8px;">Requerido</span>
                </div>

                <form id="saludForm" onsubmit="FormulariosPage.handleSubmit(event)">
                    <div class="stack" style="gap:16px;">
                        <div class="grid-2">
                            <div class="form-group">
                                <label class="form-label">Grupo Sanguíneo *</label>
                                <select id="fGrupo" class="form-input" required>
                                    <option value="">Seleccionar...</option>
                                    <option value="A+">A Positivo (A+)</option><option value="A-">A Negativo (A-)</option>
                                    <option value="B+">B Positivo (B+)</option><option value="B-">B Negativo (B-)</option>
                                    <option value="AB+">AB Positivo (AB+)</option><option value="AB-">AB Negativo (AB-)</option>
                                    <option value="O+">0 Positivo (O+)</option><option value="O-">0 Negativo (O-)</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label class="form-label">¿Usa lentes correctivos? *</label>
                                <select id="fLentes" class="form-input" required>
                                    <option value="">Seleccionar...</option>
                                    <option value="No">No usa lentes</option>
                                    <option value="Sí">Sí, requiere lentes para conducir</option>
                                </select>
                            </div>
                        </div>

                        <div class="grid-2">
                            <div class="form-group">
                                <label class="form-label">Enfermedad crónica / relevante</label>
                                <input type="text" id="fEnfermedad" class="form-input" placeholder="Ninguna o especificar (ej: diabetes, hipertensión)" value="Ninguna">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Medicación actual permanente</label>
                                <input type="text" id="fMedicacion" class="form-input" placeholder="Ninguna o especificar" value="Ninguna">
                            </div>
                        </div>

                        <div class="grid-2">
                            <div class="form-group">
                                <label class="form-label">Contacto de emergencia (Nombre y parentesco) *</label>
                                <input type="text" id="fContacto" class="form-input" placeholder="Ej: María López (Madre)" required>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Teléfono de emergencia *</label>
                                <input type="tel" id="fTelEmergencia" class="form-input" placeholder="Ej: 3329-123456" required>
                            </div>
                        </div>

                        <div class="form-group p-4" style="background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;">
                            <label class="form-label mb-1 font-bold" style="display:flex;align-items:center;gap:6px;color:#1e293b;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                Certificado Médico / Apto Físico Oficial *
                            </label>
                            <p class="text-xs text-muted mb-3">Adjuntá una foto o escaneo nítido del certificado firmado por un médico matriculado.</p>
                            
                            <input type="file" id="fCertificado" accept="image/*,.pdf" 
                                   class="form-input" style="padding:10px 14px;background:#ffffff;border:1px solid #cbd5e1;"
                                   required onchange="FormulariosPage.handleFile(event)">
                            <div id="certPreview" class="mt-2"></div>
                        </div>

                        <button type="submit" class="btn btn-primary btn-block btn-lg" id="saludBtn" style="font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;">
                            Enviar Declaración Médica
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        </button>
                    </div>
                </form>
            </div>

        </div>`;
        if (window.Tutorial) setTimeout(() => window.Tutorial.startTutorialWithContext('formularios'), 300);
    }

    static handleFile(e) {
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
            const demoData = {
                enviado: true,
                formulario: {
                    estado: 'pendiente',
                    declaracion_salud: 'Completado (Modo Demo)',
                    created_at: new Date().toISOString()
                }
            };
            localStorage.setItem('demo_formulario_estado', JSON.stringify(demoData));
            Toast.success('¡Formularios enviados correctamente! (Modo Demo)');
            this.render(document.getElementById('app'));
        }
    }
}
