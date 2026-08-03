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
                        ${pago.comprobante ? ` · <a href="javascript:void(0)" onclick="AdminPagosPage.verComprobante('${pago.id}', '${pago.nombre} ${pago.apellido}', '${pago.dni}', '${pago.monto}', '${pago.metodo}')" style="color:var(--primary);font-weight:600">Ver comprobante</a>` : ''}
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

        if (window.Tutorial) {
            setTimeout(() => window.Tutorial.startTutorialWithContext('admin-pagos'), 300);
        }
    }

    static setFiltro(filtro) {
        this.filtro = filtro;
        this.render(document.getElementById('app'));
    }

    static verComprobante(pagoId, usuarioNombre, dni, monto, metodo) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'receiptModal';
        overlay.innerHTML = `
        <div class="modal" style="max-width:480px">
            <div class="modal__header">
                <div class="flex-between">
                    <h2 class="modal__title" style="font-size:0.95rem;display:flex;align-items:center;gap:6px">${Icons.card} Comprobante de Pago #${pagoId}</h2>
                    <button class="btn btn-ghost btn-sm" onclick="document.getElementById('receiptModal').remove()">✕</button>
                </div>
            </div>
            <div class="modal__body p-4">
                <div class="glass-card p-4 mb-3" style="background:var(--bg-elevated);border-left:4px solid var(--primary)">
                    <div class="font-bold text-sm">${usuarioNombre}</div>
                    <div class="text-xs text-muted">DNI: ${dni}</div>
                    <div class="text-sm font-bold text-primary mt-2">Monto abonado: $${Number(monto).toLocaleString('es-AR')}</div>
                    <div class="text-xs text-muted">Método: ${metodo === 'transferencia' ? 'Transferencia Bancaria (Alias/CBU)' : 'Tarjeta de Débito'}</div>
                </div>

                <div class="text-center p-4" style="background:var(--bg);border-radius:12px;border:2px dashed var(--border)">
                    <div style="font-size:2.5rem;color:var(--primary);margin-bottom:8px">🏛️</div>
                    <div class="font-semibold text-sm">Comprobante Oficial de Transferencia</div>
                    <div class="text-xs text-muted mt-1">CBU Destino: 0110012330001234567890</div>
                    <div class="text-xs text-muted">Alias: MUNICIPIO.BARADERO.LICENCIAS</div>
                    <span class="badge badge-pending mt-3">Estado: Pendiente de Auditoría Municipal</span>
                </div>
            </div>
            <div class="modal__footer">
                <button class="btn btn-primary btn-block" onclick="document.getElementById('receiptModal').remove()">Cerrar previsualización</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
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
