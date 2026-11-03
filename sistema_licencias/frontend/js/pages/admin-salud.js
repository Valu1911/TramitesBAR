/**
 * Admin Panel - Auditoría Médica y Certificados de Salud
 */
class AdminSaludPage {
    static filtro = 'todos';

    static async render(app) {
        const admin = ApiService.getAdmin();

        app.innerHTML = `
        ${renderAdminNavbar(admin)}
        <div class="page-content">
            <div class="text-center" style="padding:48px 0">
                <div class="spinner" style="margin:0 auto"></div>
                <p class="text-muted mt-3" style="font-size:0.85rem">Cargando declaraciones psicofísicas...</p>
            </div>
        </div>`;

        try {
            const data = await ApiService.adminGetSalud(this.filtro);
            this.renderContent(app, data, admin);
        } catch (err) {
            if (err.status === 403 || err.status === 401) {
                adminLogout(true, true);
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
                            ${Icons.stethoscope} Secretaría de Salud · Aptitud Psicofísica
                        </div>
                        <h1 style="font-size:1.55rem;font-weight:800;color:#ffffff;margin-bottom:6px;font-family:var(--font-title);letter-spacing:-0.02em">
                            Auditoría Médica y Certificados de Salud
                        </h1>
                        <p style="color:rgba(255,255,255,0.82);font-size:0.86rem;max-width:680px;margin:0">
                            Evaluación clínica de declaraciones juradas de salud, agudeza visual, tratamientos crónicos y certificados psicofísicos.
                        </p>
                    </div>
                    <div>
                        <button class="admin-hero__refresh-btn" onclick="AdminSaludPage.render(document.getElementById('app'))">
                            ${Icons.refresh} Actualizar
                        </button>
                    </div>
                </div>
            </div>

            <!-- KPI METRICS GRID -->
            <div class="admin-kpi-grid">
                <div class="admin-kpi-card" style="border-left:3px solid #0284c7">
                    <div class="admin-kpi-icon" style="background:#f0f9ff;color:#0284c7">
                        ${Icons.file}
                    </div>
                    <div>
                        <div class="admin-kpi-val">${formularios.length}</div>
                        <div class="admin-kpi-label">Total Declaraciones</div>
                    </div>
                </div>

                <div class="admin-kpi-card" style="border-left:3px solid #f59e0b">
                    <div class="admin-kpi-icon" style="background:#fffbeb;color:#d97706">
                        ${Icons.clock}
                    </div>
                    <div>
                        <div class="admin-kpi-val" style="color:#b45309">${pendientes}</div>
                        <div class="admin-kpi-label">Pendientes de Dictamen</div>
                    </div>
                </div>

                <div class="admin-kpi-card" style="border-left:3px solid #10b981">
                    <div class="admin-kpi-icon" style="background:#ecfdf5;color:#059669">
                        ${Icons.checkCircle}
                    </div>
                    <div>
                        <div class="admin-kpi-val" style="color:#047857">${aprobados}</div>
                        <div class="admin-kpi-label">Aptos Médicos</div>
                    </div>
                </div>

                <div class="admin-kpi-card" style="border-left:3px solid #e57373">
                    <div class="admin-kpi-icon" style="background:#fff5f5;color:#b84a54">
                        ${Icons.xCircle}
                    </div>
                    <div>
                        <div class="admin-kpi-val" style="color:#b84a54">${rechazados}</div>
                        <div class="admin-kpi-label">No Aptos / Observados</div>
                    </div>
                </div>
            </div>

            <!-- FILTROS TABS -->
            <div class="admin-filter-bar">
                <div class="admin-tabs-list">
                    <button class="admin-tab-btn ${this.filtro === 'todos' ? 'active' : ''}" onclick="AdminSaludPage.setFiltro('todos')">
                        ${Icons.filter} Todos (${formularios.length})
                    </button>
                    <button class="admin-tab-btn ${this.filtro === 'pendiente' ? 'active' : ''}" onclick="AdminSaludPage.setFiltro('pendiente')">
                        ${Icons.clock} Pendientes (${pendientes})
                    </button>
                    <button class="admin-tab-btn ${this.filtro === 'aprobado' ? 'active' : ''}" onclick="AdminSaludPage.setFiltro('aprobado')">
                        ${Icons.check} Aprobados (${aprobados})
                    </button>
                    <button class="admin-tab-btn ${this.filtro === 'rechazado' ? 'active' : ''}" onclick="AdminSaludPage.setFiltro('rechazado')">
                        ${Icons.x} Rechazados (${rechazados})
                    </button>
                </div>
            </div>

            <!-- LISTA -->
            <div>
                ${formularios.length === 0 ? `
                <div class="dash-card text-center" style="padding:48px 20px">
                    <div style="width:56px;height:56px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;color:#64748b;font-size:1.35rem">
                        ${Icons.stethoscope}
                    </div>
                    <h3 style="font-size:1.05rem;font-weight:700;color:var(--text-primary);margin-bottom:6px">Sin declaraciones médicas</h3>
                    <p style="font-size:0.84rem;color:var(--text-muted);max-width:400px;margin:0 auto">No hay formularios de aptitud psicofísica registrados para el filtro seleccionado (${this.filtro}).</p>
                </div>` : formularios.map(f => `
                <div class="admin-item animate-slideUp">
                    <div class="admin-item__header">
                        <div style="display:flex;align-items:center;gap:14px">
                            <div class="admin-item__avatar">
                                ${Icons.stethoscope}
                            </div>
                            <div>
                                <div class="admin-item__user">${f.nombre} ${f.apellido}</div>
                                <div class="admin-item__meta">
                                    <span><strong>DNI:</strong> ${f.dni}</span>
                                    <span>·</span>
                                    <span><strong>Presentación:</strong> ${f.fecha_envio}</span>
                                </div>
                            </div>
                        </div>
                        <span class="badge ${f.estado === 'pendiente' ? 'badge-pending' : f.estado === 'aprobado' ? 'badge-success' : 'badge-danger'}" style="display:inline-flex;align-items:center;gap:5px;font-size:0.75rem;padding:4px 10px">
                            ${f.estado === 'pendiente' ? Icons.clock : f.estado === 'aprobado' ? Icons.check : Icons.x}
                            ${f.estado.toUpperCase()}
                        </span>
                    </div>
                    
                    <!-- Datos médicos estructurados -->
                    <div class="admin-item__detail">
                        <div class="admin-data-grid">
                            <div class="admin-data-cell">
                                <div class="admin-data-cell__label">${Icons.droplet} Grupo Sanguíneo</div>
                                <div class="admin-data-cell__value" style="color:#0284c7">${f.grupo_sanguineo || 'No declarado'}</div>
                            </div>
                            <div class="admin-data-cell">
                                <div class="admin-data-cell__label">${Icons.glasses} Corrección Óptica</div>
                                <div class="admin-data-cell__value">${f.usa_lentes || 'No requiere'}</div>
                            </div>
                            <div class="admin-data-cell">
                                <div class="admin-data-cell__label">${Icons.activity} Afección Crónica</div>
                                <div class="admin-data-cell__value" style="color:${f.enfermedad_cronica && f.enfermedad_cronica !== 'No' && f.enfermedad_cronica !== 'Ninguna' ? '#d95360' : '#0f172a'}">
                                    ${f.enfermedad_cronica || 'Ninguna'}
                                </div>
                            </div>
                            <div class="admin-data-cell">
                                <div class="admin-data-cell__label">${Icons.pill} Medicación Habitual</div>
                                <div class="admin-data-cell__value">${f.medicacion || 'Ninguna'}</div>
                            </div>
                            <div class="admin-data-cell">
                                <div class="admin-data-cell__label">${Icons.user} Contacto Emergencia</div>
                                <div class="admin-data-cell__value">${f.contacto_emergencia || 'No indicado'}</div>
                            </div>
                            <div class="admin-data-cell">
                                <div class="admin-data-cell__label">${Icons.phone} Teléfono Emergencia</div>
                                <div class="admin-data-cell__value">${f.telefono_emergencia || 'No indicado'}</div>
                            </div>
                        </div>

                        ${f.certificado_archivo ? `
                        <div style="margin-top:12px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
                            <span style="font-size:0.78rem;color:#475569;display:inline-flex;align-items:center;gap:6px">
                                <span style="color:#059669;display:flex">${Icons.fileCheck}</span>
                                <span>Documentación clínica respaldatoria adjunta</span>
                            </span>
                            <button type="button" class="btn btn-ghost btn-sm" onclick="AdminSaludPage.verCertificado('${f.id}', '${f.nombre} ${f.apellido}', '${f.dni}')" 
                                    style="color:#0284c7;border:1px solid #bae6fd;background:#ffffff;font-weight:700;display:inline-flex;align-items:center;gap:6px;border-radius:7px">
                                ${Icons.paperclip} Ver Certificado Médico Adjunto
                            </button>
                        </div>` : `
                        <div style="margin-top:12px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:0.76rem;color:#64748b;display:flex;align-items:center;gap:6px">
                            <span style="display:flex;color:#94a3b8">${Icons.info}</span>
                            <span>Declaración jurada digital sin archivo adjunto externo</span>
                        </div>`}
                    </div>

                    ${f.estado === 'pendiente' ? `
                    <div class="admin-item__actions">
                        <button class="btn btn-outline btn-sm" style="color:#b84a54;border-color:#fed7d7;background:#ffffff;border-radius:7px" 
                                onclick="AdminSaludPage.revisar(${f.id}, 'rechazado')">
                            <span style="display:flex;align-items:center;gap:5px">${Icons.x} Observar / No Apto</span>
                        </button>
                        <button class="btn btn-success btn-sm" onclick="AdminSaludPage.revisar(${f.id}, 'aprobado')" 
                                style="background:#059669;border-color:#059669;color:#fff;font-weight:700;border-radius:7px">
                            <span style="display:flex;align-items:center;gap:5px">${Icons.check} Dictaminar Apto Médico</span>
                        </button>
                    </div>` : `
                    ${f.observaciones_admin ? `
                    <div style="font-size:0.8rem;color:#475569;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-top:8px;display:flex;align-items:center;gap:6px">
                        <span style="color:#0284c7;display:flex">${Icons.fileCheck}</span>
                        <span><strong>Dictamen Médico:</strong> ${f.observaciones_admin}</span>
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

    static verCertificado(formId, titular = '', dni = '') {
        ConfirmModal.show({
            title: `Certificado Médico Oficial #${formId}`,
            message: `Constancia psicofísica presentada por ${titular || 'el solicitante'}${dni ? ` (DNI ${dni})` : ''}, validada en el registro clínico municipal.`,
            confirmText: 'Entendido',
            cancelText: 'Cerrar',
            variant: 'primary',
            icon: Icons.fileCheck
        });
    }

    static async revisar(formId, estado) {
        let obs = '';
        if (estado === 'aprobado') {
            const ok = await ConfirmModal.show({
                title: '¿Dictaminar Apto Médico?',
                message: 'Se convalidará la aptitud psicofísica del ciudadano y quedará habilitado para rendir el examen teórico.',
                confirmText: 'Confirmar Apto Médico',
                cancelText: 'Cancelar',
                variant: 'success',
                icon: Icons.checkCircle
            });
            if (!ok) return;
        } else {
            const motivo = await ConfirmModal.prompt({
                title: 'Registrar Observación / No Apto',
                message: 'Indicá el fundamento clínico o la documentación adicional que el solicitante debe presentar.',
                inputLabel: 'Dictamen u observación médica (opcional)',
                placeholder: 'Ej: Debe adjuntar estudio de agudeza visual actualizado por especialista.',
                confirmText: 'Registrar dictamen',
                cancelText: 'Cancelar',
                variant: 'danger',
                icon: Icons.stethoscope
            });
            if (motivo === null) return;
            obs = motivo;
        }
        
        try {
            await ApiService.adminRevisarSalud(formId, estado, obs);
            Toast.success(`Declaración dictaminada como ${estado.toUpperCase()} correctamente`);
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message);
        }
    }
}
