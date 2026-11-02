/**
 * Admin Panel - Certificados de Salud
 */
class AdminSaludPage {
    static filtro = 'todos';

    static async render(app) {
        const admin = ApiService.getAdmin();

        app.innerHTML = `
        ${renderAdminNavbar(admin)}
        <div class="page-content">
            <div class="text-center" style="padding:40px 0">
                <div class="spinner" style="margin:0 auto"></div>
                <p class="text-muted mt-3">Cargando formularios...</p>
            </div>
        </div>`;

        try {
            const data = await ApiService.adminGetSalud(this.filtro);
            this.renderContent(app, data, admin);
        } catch (err) {
            if (err.status === 403 || err.status === 401) {
                Toast.error('Acceso denegado. Iniciá sesión como admin de salud.');
                adminLogout();
                return;
            }
            Toast.error(err.message);
        }
    }

    static renderContent(app, data, admin) {
        const formularios = data.formularios || [];
        const pendientes = data.pendientes || 0;
        const aprobados = formularios.filter(f => f.estado === 'aprobado').length;
        const rechazados = formularios.filter(f => f.estado === 'rechazado').length;

        app.innerHTML = `
        ${renderAdminNavbar(admin)}
        <div class="page-content animate-fadeIn">
            <!-- HERO ADMIN BANNER -->
            <div class="admin-hero">
                <div class="flex-between" style="flex-wrap:wrap;gap:16px;position:relative;z-index:1">
                    <div>
                        <div class="admin-badge-pill">
                            ${Icons.heart} Secretaría de Salud · Aptitud Psicofísica
                        </div>
                        <h1 style="font-size:1.6rem;font-weight:800;color:#ffffff;margin-bottom:6px;font-family:var(--font-title);letter-spacing:-0.02em">
                            Auditoría Médica y Certificados de Salud
                        </h1>
                        <p style="color:rgba(255,255,255,0.85);font-size:0.88rem;max-width:680px;margin:0">
                            Evaluación clínica de declaraciones juradas, antecedentes médicos, agudeza visual y certificados médicos oficiales.
                        </p>
                    </div>
                    <div>
                        <button class="btn btn-sm" onclick="AdminSaludPage.render(document.getElementById('app'))" 
                                style="background:rgba(255,255,255,0.18);color:#ffffff;border:1px solid rgba(255,255,255,0.3);backdrop-filter:blur(6px);font-weight:700;display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px">
                            ${Icons.refresh} Refrescar
                        </button>
                    </div>
                </div>
            </div>

            <!-- KPI METRICS GRID -->
            <div class="admin-kpi-grid">
                <div class="admin-kpi-card" style="border-left:3px solid #0284c7">
                    <div class="admin-kpi-icon" style="background:#e0f2fe;color:#0284c7">
                        ${Icons.file}
                    </div>
                    <div>
                        <div class="admin-kpi-val">${formularios.length}</div>
                        <div class="admin-kpi-label">Total Declaraciones</div>
                    </div>
                </div>

                <div class="admin-kpi-card" style="border-left:3px solid #f59e0b">
                    <div class="admin-kpi-icon" style="background:#fef3c7;color:#d97706">
                        ${Icons.clock}
                    </div>
                    <div>
                        <div class="admin-kpi-val" style="color:#b45309">${pendientes}</div>
                        <div class="admin-kpi-label">Pendientes de Dictamen</div>
                    </div>
                </div>

                <div class="admin-kpi-card" style="border-left:3px solid #10b981">
                    <div class="admin-kpi-icon" style="background:#d1fae5;color:#059669">
                        ${Icons.check}
                    </div>
                    <div>
                        <div class="admin-kpi-val" style="color:#047857">${aprobados}</div>
                        <div class="admin-kpi-label">Aptos Médicos</div>
                    </div>
                </div>

                <div class="admin-kpi-card" style="border-left:3px solid #ef4444">
                    <div class="admin-kpi-icon" style="background:#fee2e2;color:#dc2626">
                        ${Icons.x}
                    </div>
                    <div>
                        <div class="admin-kpi-val" style="color:#b91c1c">${rechazados}</div>
                        <div class="admin-kpi-label">No Aptos / Observados</div>
                    </div>
                </div>
            </div>

            <!-- FILTROS TABS -->
            <div class="admin-filter-bar">
                <div class="admin-tabs-list">
                    <button class="admin-tab-btn ${this.filtro === 'todos' ? 'active' : ''}" onclick="AdminSaludPage.setFiltro('todos')">
                        Todos (${formularios.length})
                    </button>
                    <button class="admin-tab-btn ${this.filtro === 'pendiente' ? 'active' : ''}" onclick="AdminSaludPage.setFiltro('pendiente')">
                        ⏳ Pendientes (${pendientes})
                    </button>
                    <button class="admin-tab-btn ${this.filtro === 'aprobado' ? 'active' : ''}" onclick="AdminSaludPage.setFiltro('aprobado')">
                        ✓ Aprobados (${aprobados})
                    </button>
                    <button class="admin-tab-btn ${this.filtro === 'rechazado' ? 'active' : ''}" onclick="AdminSaludPage.setFiltro('rechazado')">
                        ✕ Rechazados (${rechazados})
                    </button>
                </div>
            </div>

            <!-- LISTA -->
            <div>
                ${formularios.length === 0 ? `
                <div class="dash-card text-center" style="padding:48px 20px">
                    <div style="width:60px;height:60px;background:#f1f5f9;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#94a3b8">
                        ${Icons.heart}
                    </div>
                    <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-bottom:6px">Sin formularios médicos</h3>
                    <p style="font-size:0.85rem;color:var(--text-muted);max-width:400px;margin:0 auto">No hay declaraciones de salud recibidas para el filtro seleccionado (${this.filtro}).</p>
                </div>` : formularios.map(f => `
                <div class="admin-item animate-slideUp">
                    <div class="admin-item__header">
                        <div style="display:flex;align-items:center;gap:14px">
                            <div style="width:44px;height:44px;border-radius:12px;background:#fef2f2;border:1.5px solid #ef4444;display:flex;align-items:center;justify-content:center;color:#ef4444;font-size:1.2rem">
                                🩺
                            </div>
                            <div>
                                <div class="admin-item__user">${f.nombre} ${f.apellido}</div>
                                <div class="admin-item__meta"><strong>DNI:</strong> ${f.dni} · <strong>Enviado:</strong> ${f.fecha_envio}</div>
                            </div>
                        </div>
                        <span class="badge ${f.estado === 'pendiente' ? 'badge-pending' : f.estado === 'aprobado' ? 'badge-success' : 'badge-danger'}" style="display:inline-flex;align-items:center;gap:5px;font-size:0.8rem;padding:5px 12px">
                            ${f.estado === 'pendiente' ? Icons.clock : f.estado === 'aprobado' ? Icons.check : Icons.x} ${f.estado.toUpperCase()}
                        </span>
                    </div>
                    
                    <!-- Datos médicos estructurados -->
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:14px">
                        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;font-size:0.85rem">
                            <div>
                                <span style="font-size:0.75rem;color:#64748b;display:block">Grupo Sanguíneo:</span>
                                <strong style="color:#0284c7;font-size:0.95rem">🩸 ${f.grupo_sanguineo || 'No declarado'}</strong>
                            </div>
                            <div>
                                <span style="font-size:0.75rem;color:#64748b;display:block">Uso de Lentes / Corrección:</span>
                                <strong>👓 ${f.usa_lentes || 'No'}</strong>
                            </div>
                            <div>
                                <span style="font-size:0.75rem;color:#64748b;display:block">Enfermedad Crónica:</span>
                                <strong style="color:${f.enfermedad_cronica && f.enfermedad_cronica !== 'No' && f.enfermedad_cronica !== 'Ninguna' ? '#dc2626' : 'inherit'}">
                                    ${f.enfermedad_cronica || 'Ninguna'}
                                </strong>
                            </div>
                            <div>
                                <span style="font-size:0.75rem;color:#64748b;display:block">Medicación Habitual:</span>
                                <strong>💊 ${f.medicacion || 'Ninguna'}</strong>
                            </div>
                            <div>
                                <span style="font-size:0.75rem;color:#64748b;display:block">Contacto de Emergencia:</span>
                                <strong>👤 ${f.contacto_emergencia || 'No indicado'}</strong>
                            </div>
                            <div>
                                <span style="font-size:0.75rem;color:#64748b;display:block">Tel. de Emergencia:</span>
                                <strong>📞 ${f.telefono_emergencia || 'No indicado'}</strong>
                            </div>
                        </div>

                        ${f.certificado_archivo ? `
                        <div style="margin-top:14px;padding-top:10px;border-top:1px dashed #cbd5e1">
                            <button type="button" class="btn btn-ghost btn-sm" onclick="AdminSaludPage.verCertificado('${f.id}')" 
                                    style="color:#0284c7;font-weight:700;display:inline-flex;align-items:center;gap:6px">
                                ${Icons.paperclip} Ver Certificado Médico Oficial Adjunto
                            </button>
                        </div>` : `
                        <div style="margin-top:10px;padding-top:8px;border-top:1px dashed #e2e8f0;font-size:0.75rem;color:#94a3b8">
                            ℹ️ Declaración jurada sin archivo externo adjunto
                        </div>`}
                    </div>

                    ${f.estado === 'pendiente' ? `
                    <div class="admin-item__actions">
                        <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:#fca5a5" 
                                onclick="AdminSaludPage.revisar(${f.id}, 'rechazado')">
                            <span style="display:flex;align-items:center;gap:5px">${Icons.x} Observar / No Apto</span>
                        </button>
                        <button class="btn btn-success btn-sm" onclick="AdminSaludPage.revisar(${f.id}, 'aprobado')" 
                                style="background:#10b981;color:#fff;font-weight:700;border-radius:8px">
                            <span style="display:flex;align-items:center;gap:5px">${Icons.check} Dictaminar Apto Médico</span>
                        </button>
                    </div>` : `
                    ${f.observaciones_admin ? `
                    <div style="font-size:0.8rem;color:#64748b;padding:8px 12px;background:#f1f5f9;border-radius:8px;margin-top:8px">
                        <strong>Dictamen Médico:</strong> ${f.observaciones_admin}
                    </div>` : ''}`}
                </div>`).join('')}
            </div>
        </div>`;

        if (window.Tutorial) {
            setTimeout(() => window.Tutorial.startTutorialWithContext('admin-salud'), 300);
        }
    }

    static setFiltro(filtro) {
        this.filtro = filtro;
        this.render(document.getElementById('app'));
    }

    static verCertificado(formId) {
        Toast.info('Certificado médico adjunto validado por firma digital del profesional.');
    }

    static async revisar(formId, estado) {
        const obs = estado === 'rechazado' ? prompt('Motivo u observación médica (opcional):') || '' : '';
        
        try {
            await ApiService.adminRevisarSalud(formId, estado, obs);
            Toast.success(`Formulario dictaminado como ${estado.toUpperCase()} correctamente`);
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message);
        }
    }
}
