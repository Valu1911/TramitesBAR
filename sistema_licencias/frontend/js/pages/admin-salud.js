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

        app.innerHTML = `
        ${renderAdminNavbar(admin)}
        <div class="page-content animate-fadeIn">
            <div class="flex-between mb-4">
                <div>
                    <h1 style="font-size:1.25rem;font-weight:800">🏥 Verificación de Certificados de Salud</h1>
                    <p class="text-sm text-muted">Revisá los formularios médicos de los ciudadanos</p>
                </div>
                <span class="badge badge-pending">${data.pendientes} pendientes</span>
            </div>

            <!-- Filtros -->
            <div class="tabs mb-4">
                <button class="tab ${this.filtro === 'todos' ? 'active' : ''}" onclick="AdminSaludPage.setFiltro('todos')">Todos (${formularios.length})</button>
                <button class="tab ${this.filtro === 'pendiente' ? 'active' : ''}" onclick="AdminSaludPage.setFiltro('pendiente')">Pendientes</button>
                <button class="tab ${this.filtro === 'aprobado' ? 'active' : ''}" onclick="AdminSaludPage.setFiltro('aprobado')">Aprobados</button>
                <button class="tab ${this.filtro === 'rechazado' ? 'active' : ''}" onclick="AdminSaludPage.setFiltro('rechazado')">Rechazados</button>
            </div>

            <!-- Lista -->
            <div>
                ${formularios.length === 0 ? `
                <div class="empty-state">
                    <div class="empty-state__icon">📄</div>
                    <h3 class="empty-state__title">Sin formularios</h3>
                    <p class="empty-state__desc">No hay formularios para mostrar con este filtro</p>
                </div>` : formularios.map(f => `
                <div class="admin-item">
                    <div class="admin-item__header">
                        <div>
                            <div class="admin-item__user">${f.nombre} ${f.apellido}</div>
                            <div class="admin-item__meta">DNI: ${f.dni} · Enviado: ${f.fecha_envio}</div>
                        </div>
                        <span class="badge ${f.estado === 'pendiente' ? 'badge-pending' : f.estado === 'aprobado' ? 'badge-success' : 'badge-danger'}">
                            ${f.estado === 'pendiente' ? '⏳' : f.estado === 'aprobado' ? '✅' : '❌'} ${f.estado}
                        </span>
                    </div>
                    
                    <!-- Datos médicos -->
                    <div class="glass-card p-3 mb-3" style="background:var(--bg-elevated)">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.8125rem">
                            <div><span class="text-muted">Grupo:</span> <strong>${f.grupo_sanguineo}</strong></div>
                            <div><span class="text-muted">Lentes:</span> <strong>${f.usa_lentes}</strong></div>
                            <div><span class="text-muted">Enfermedad:</span> <strong>${f.enfermedad_cronica}</strong></div>
                            <div><span class="text-muted">Medicación:</span> <strong>${f.medicacion}</strong></div>
                            <div><span class="text-muted">Contacto:</span> <strong>${f.contacto_emergencia}</strong></div>
                            <div><span class="text-muted">Tel. emergencia:</span> <strong>${f.telefono_emergencia}</strong></div>
                        </div>
                        ${f.certificado_archivo ? `
                        <div class="mt-2">
                            <button class="btn btn-ghost btn-sm" onclick="AdminSaludPage.verCertificado('${f.id}')">
                                📎 Ver certificado adjunto
                            </button>
                        </div>` : '<p class="text-xs text-muted mt-2">Sin certificado adjunto</p>'}
                    </div>

                    ${f.estado === 'pendiente' ? `
                    <div class="admin-item__actions">
                        <button class="btn btn-success btn-sm" onclick="AdminSaludPage.revisar(${f.id}, 'aprobado')">
                            ✅ Aprobar
                        </button>
                        <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger)" 
                                onclick="AdminSaludPage.revisar(${f.id}, 'rechazado')">
                            ❌ Rechazar
                        </button>
                    </div>` : `
                    ${f.observaciones_admin ? `<p class="text-xs text-muted">Obs: ${f.observaciones_admin}</p>` : ''}`}
                </div>`).join('')}
            </div>
        </div>`;
    }

    static setFiltro(filtro) {
        this.filtro = filtro;
        this.render(document.getElementById('app'));
    }

    static verCertificado(formId) {
        Toast.info('Función de visualización de certificado');
    }

    static async revisar(formId, estado) {
        const obs = estado === 'rechazado' ? prompt('Motivo del rechazo (opcional):') || '' : '';
        
        try {
            await ApiService.adminRevisarSalud(formId, estado, obs);
            Toast.success(`Formulario ${estado} correctamente`);
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message);
        }
    }
}
