/**
 * Admin Panel - Pagos
 */
class AdminPagosPage {
    static filtro = 'todos';

    static async render(app) {
        const admin = ApiService.getAdmin();

        app.innerHTML = `
        ${renderAdminNavbar(admin)}
        <div class="page-content">
            <div class="text-center" style="padding:40px 0">
                <div class="spinner" style="margin:0 auto"></div>
                <p class="text-muted mt-3">Cargando pagos...</p>
            </div>
        </div>`;

        try {
            const data = await ApiService.adminGetPagos(this.filtro);
            this.renderContent(app, data, admin);
        } catch (err) {
            if (err.status === 403 || err.status === 401) {
                Toast.error('Acceso denegado. Iniciá sesión como admin de pagos.');
                adminLogout();
                return;
            }
            Toast.error(err.message);
        }
    }

    static renderContent(app, data, admin) {
        const pagos = data.pagos || [];

        app.innerHTML = `
        ${renderAdminNavbar(admin)}
        <div class="page-content animate-fadeIn">
            <div class="flex-between mb-4">
                <div>
                    <h1 style="font-size:1.25rem;font-weight:800;display:flex;align-items:center;gap:8px">${Icons.money} Gestión de Pagos</h1>
                    <p class="text-sm text-muted">Revisá y aprobá los comprobantes de pago</p>
                </div>
                <span class="badge badge-pending">${data.pendientes} pendientes</span>
            </div>

            <!-- Filtros -->
            <div class="tabs mb-4">
                <button class="tab ${this.filtro === 'todos' ? 'active' : ''}" onclick="AdminPagosPage.setFiltro('todos')">Todos (${pagos.length})</button>
                <button class="tab ${this.filtro === 'pendiente' ? 'active' : ''}" onclick="AdminPagosPage.setFiltro('pendiente')">Pendientes</button>
                <button class="tab ${this.filtro === 'aprobado' ? 'active' : ''}" onclick="AdminPagosPage.setFiltro('aprobado')">Aprobados</button>
                <button class="tab ${this.filtro === 'rechazado' ? 'active' : ''}" onclick="AdminPagosPage.setFiltro('rechazado')">Rechazados</button>
            </div>

            <!-- Lista -->
            <div id="pagosLista">
                ${pagos.length === 0 ? `
                <div class="empty-state">
                    <div class="empty-state__icon" style="display:flex;align-items:center;justify-content:center">${Icons.file}</div>
                    <h3 class="empty-state__title">Sin pagos</h3>
                    <p class="empty-state__desc">No hay pagos para mostrar con este filtro</p>
                </div>` : pagos.map(pago => `
                <div class="admin-item" id="pago-${pago.id}">
                    <div class="admin-item__header">
                        <div>
                            <div class="admin-item__user">${pago.nombre} ${pago.apellido}</div>
                            <div class="admin-item__meta">DNI: ${pago.dni} · ${pago.fecha_pago} · Método: ${pago.metodo}</div>
                        </div>
                        <span class="badge ${pago.estado === 'pendiente' ? 'badge-pending' : pago.estado === 'aprobado' ? 'badge-success' : 'badge-danger'}" style="display:inline-flex;align-items:center;gap:4px">
                            ${pago.estado === 'pendiente' ? Icons.clock : pago.estado === 'aprobado' ? Icons.check : Icons.x} ${pago.estado}
                        </span>
                    </div>
                    <div class="admin-item__detail">
                        Monto: $${Number(pago.monto).toLocaleString('es-AR')} · 
                        ${pago.metodo === 'transferencia' ? 'Transferencia bancaria' : 'Tarjeta de débito'}
                        ${pago.comprobante ? ' · <a href="javascript:void(0)" onclick="AdminPagosPage.verComprobante(\'' + pago.id + '\')" style="color:var(--primary)">Ver comprobante</a>' : ''}
                    </div>
                    ${pago.estado === 'pendiente' ? `
                    <div class="admin-item__actions">
                        <button class="btn btn-success btn-sm" onclick="AdminPagosPage.revisar(${pago.id}, 'aprobado')">
                            <span style="display:flex;align-items:center;gap:4px">${Icons.check} Aprobar</span>
                        </button>
                        <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger)" 
                                onclick="AdminPagosPage.revisar(${pago.id}, 'rechazado')">
                            <span style="display:flex;align-items:center;gap:4px">${Icons.x} Rechazar</span>
                        </button>
                    </div>` : ''}
                </div>`).join('')}
            </div>
        </div>`;
    }

    static setFiltro(filtro) {
        this.filtro = filtro;
        this.render(document.getElementById('app'));
    }

    static verComprobante(pagoId) {
        // En un sistema real se mostraría la imagen
        Toast.info('Función de visualización de comprobante');
    }

    static async revisar(pagoId, estado) {
        const obs = estado === 'rechazado' ? prompt('Motivo del rechazo (opcional):') || '' : '';
        
        try {
            await ApiService.adminRevisarPago(pagoId, estado, obs);
            Toast.success(`Pago ${estado} correctamente`);
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message);
        }
    }
}
