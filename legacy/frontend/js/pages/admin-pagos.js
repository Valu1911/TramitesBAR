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
        const pendientes = data.pendientes || 0;
        const aprobados = pagos.filter(p => p.estado === 'aprobado').length;
        const rechazados = pagos.filter(p => p.estado === 'rechazado').length;
        const totalRecaudado = pagos
            .filter(p => p.estado === 'aprobado')
            .reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

        app.innerHTML = `
        ${renderAdminNavbar(admin)}
        <div class="page-content animate-fadeIn">
            <!-- HERO ADMIN BANNER -->
            <div class="admin-hero">
                <div class="flex-between" style="flex-wrap:wrap;gap:16px;position:relative;z-index:1">
                    <div>
                        <div class="admin-badge-pill">
                            ${Icons.money} Tesorería Municipal · Tasas y Aranceles
                        </div>
                        <h1 style="font-size:1.6rem;font-weight:800;color:#ffffff;margin-bottom:6px;font-family:var(--font-title);letter-spacing:-0.02em">
                            Auditoría de Pagos y Comprobantes
                        </h1>
                        <p style="color:rgba(255,255,255,0.85);font-size:0.88rem;max-width:680px;margin:0">
                            Revisá y convalidá las transferencias bancarias y comprobantes de aranceles de emisión antes de habilitar los turnos prácticos.
                        </p>
                    </div>
                    <div>
                        <button class="btn btn-sm" onclick="AdminPagosPage.render(document.getElementById('app'))" 
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
                        ${Icons.money}
                    </div>
                    <div>
                        <div class="admin-kpi-val">$${totalRecaudado.toLocaleString('es-AR')}</div>
                        <div class="admin-kpi-label">Recaudación Aprobada</div>
                    </div>
                </div>

                <div class="admin-kpi-card" style="border-left:3px solid #f59e0b">
                    <div class="admin-kpi-icon" style="background:#fef3c7;color:#d97706">
                        ${Icons.clock}
                    </div>
                    <div>
                        <div class="admin-kpi-val" style="color:#b45309">${pendientes}</div>
                        <div class="admin-kpi-label">Comprobantes Pendientes</div>
                    </div>
                </div>

                <div class="admin-kpi-card" style="border-left:3px solid #10b981">
                    <div class="admin-kpi-icon" style="background:#d1fae5;color:#059669">
                        ${Icons.check}
                    </div>
                    <div>
                        <div class="admin-kpi-val" style="color:#047857">${aprobados}</div>
                        <div class="admin-kpi-label">Pagos Aprobados</div>
                    </div>
                </div>

                <div class="admin-kpi-card" style="border-left:3px solid #ef4444">
                    <div class="admin-kpi-icon" style="background:#fee2e2;color:#dc2626">
                        ${Icons.x}
                    </div>
                    <div>
                        <div class="admin-kpi-val" style="color:#b91c1c">${rechazados}</div>
                        <div class="admin-kpi-label">Rechazados</div>
                    </div>
                </div>
            </div>

            <!-- FILTROS TABS -->
            <div class="admin-filter-bar">
                <div class="admin-tabs-list">
                    <button class="admin-tab-btn ${this.filtro === 'todos' ? 'active' : ''}" onclick="AdminPagosPage.setFiltro('todos')">
                        Todos (${pagos.length})
                    </button>
                    <button class="admin-tab-btn ${this.filtro === 'pendiente' ? 'active' : ''}" onclick="AdminPagosPage.setFiltro('pendiente')">
                        ⏳ Pendientes (${pendientes})
                    </button>
                    <button class="admin-tab-btn ${this.filtro === 'aprobado' ? 'active' : ''}" onclick="AdminPagosPage.setFiltro('aprobado')">
                        ✓ Aprobados (${aprobados})
                    </button>
                    <button class="admin-tab-btn ${this.filtro === 'rechazado' ? 'active' : ''}" onclick="AdminPagosPage.setFiltro('rechazado')">
                        ✕ Rechazados (${rechazados})
                    </button>
                </div>
            </div>

            <!-- LISTA DE PAGOS -->
            <div id="pagosLista">
                ${pagos.length === 0 ? `
                <div class="dash-card text-center" style="padding:48px 20px">
                    <div style="width:60px;height:60px;background:#f1f5f9;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#94a3b8">
                        ${Icons.money}
                    </div>
                    <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-bottom:6px">Sin pagos registrados</h3>
                    <p style="font-size:0.85rem;color:var(--text-muted);max-width:400px;margin:0 auto">No hay registros de transferencias o boletas de pago para este filtro (${this.filtro}).</p>
                </div>` : pagos.map(pago => `
                <div class="admin-item animate-slideUp" id="pago-${pago.id}">
                    <div class="admin-item__header">
                        <div style="display:flex;align-items:center;gap:14px">
                            <div style="width:44px;height:44px;border-radius:12px;background:#f0f9ff;border:1.5px solid #0284c7;display:flex;align-items:center;justify-content:center;color:#0284c7;font-weight:800;font-size:1.1rem">
                                💳
                            </div>
                            <div>
                                <div class="admin-item__user">${pago.nombre} ${pago.apellido}</div>
                                <div class="admin-item__meta">
                                    <strong>DNI:</strong> ${pago.dni} · <strong>Fecha:</strong> ${pago.fecha_pago} · <strong>Canal:</strong> ${pago.metodo === 'transferencia' ? 'Transferencia Bancaria' : 'Tarjeta de Débito'}
                                </div>
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px">
                            <span class="badge ${pago.estado === 'pendiente' ? 'badge-pending' : pago.estado === 'aprobado' ? 'badge-success' : 'badge-danger'}" style="display:inline-flex;align-items:center;gap:5px;font-size:0.8rem;padding:5px 12px">
                                ${pago.estado === 'pendiente' ? Icons.clock : pago.estado === 'aprobado' ? Icons.check : Icons.x} ${pago.estado.toUpperCase()}
                            </span>
                        </div>
                    </div>

                    <div class="admin-item__detail flex-between" style="border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;padding:12px 16px">
                        <div>
                            <span style="font-size:0.8rem;color:#64748b">Monto Liquidado:</span>
                            <span style="font-size:1.15rem;font-weight:800;color:#0284c7;margin-left:6px">$${Number(pago.monto).toLocaleString('es-AR')}</span>
                            <span style="font-size:0.8rem;color:#64748b;margin-left:8px">(${pago.metodo === 'transferencia' ? 'CBU / Alias Municipal' : 'Pasarela Digital'})</span>
                        </div>
                        <div>
                            <button class="btn btn-ghost btn-sm" onclick="AdminPagosPage.verComprobante('${pago.id}', '${pago.nombre} ${pago.apellido}', '${pago.dni}', '${pago.monto}', '${pago.metodo}')" 
                                    style="color:#0284c7;font-weight:700;display:inline-flex;align-items:center;gap:5px">
                                🔍 Ver Comprobante Detallado
                            </button>
                        </div>
                    </div>

                    ${pago.estado === 'pendiente' ? `
                    <div class="admin-item__actions" style="margin-top:10px">
                        <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:#fca5a5" 
                                onclick="AdminPagosPage.revisar(${pago.id}, 'rechazado')">
                            <span style="display:flex;align-items:center;gap:5px">${Icons.x} Rechazar Comprobante</span>
                        </button>
                        <button class="btn btn-success btn-sm" onclick="AdminPagosPage.revisar(${pago.id}, 'aprobado')" 
                                style="background:#10b981;color:#fff;font-weight:700;border-radius:8px">
                            <span style="display:flex;align-items:center;gap:5px">${Icons.check} Aprobar Pago</span>
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
        overlay.className = 'modal-backdrop';
        overlay.id = 'receiptModal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);';
        overlay.innerHTML = `
        <div class="dash-card animate-slideUp" style="max-width:520px;width:100%;box-shadow:0 25px 50px -12px rgba(0,0,0,0.4);border:2px solid #0284c7;padding:0;overflow:hidden">
            <div style="background:linear-gradient(135deg, #1e40af 0%, #0284c7 100%);color:#fff;padding:18px 20px;display:flex;align-items:center;justify-content:space-between">
                <div style="display:flex;align-items:center;gap:10px">
                    <span style="font-size:1.3rem">🏛️</span>
                    <div>
                        <h3 style="font-size:1rem;font-weight:800;margin:0;color:#fff">Comprobante Oficial de Pago #${pagoId}</h3>
                        <p style="font-size:0.75rem;margin:0;color:rgba(255,255,255,0.85)">Municipalidad de Baradero · Tesorería</p>
                    </div>
                </div>
                <button class="btn btn-ghost btn-sm" onclick="document.getElementById('receiptModal').remove()" style="color:#fff;font-size:1.2rem;padding:2px 8px">✕</button>
            </div>
            
            <div style="padding:22px">
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px">
                    <div style="font-size:1.05rem;font-weight:800;color:#0f172a">${usuarioNombre}</div>
                    <div style="font-size:0.8rem;color:#64748b;margin-top:2px">DNI del Contribuyente: <strong>${dni}</strong></div>
                    <div style="display:flex;align-items:baseline;gap:8px;margin-top:12px;padding-top:10px;border-top:1px dashed #cbd5e1">
                        <span style="font-size:0.85rem;color:#64748b">Total Declarado:</span>
                        <strong style="font-size:1.4rem;color:#0284c7">$${Number(monto).toLocaleString('es-AR')}</strong>
                    </div>
                    <div style="font-size:0.8rem;color:#64748b;margin-top:4px">
                        Método: <strong>${metodo === 'transferencia' ? 'Transferencia Bancaria (Alias / CBU)' : 'Tarjeta de Débito'}</strong>
                    </div>
                </div>

                <div style="background:#eff6ff;border-radius:12px;border:1.5px dashed #93c5fd;padding:18px;text-align:center">
                    <div style="font-size:2rem;margin-bottom:6px">📋</div>
                    <div style="font-size:0.9rem;font-weight:800;color:#1e40af">Datos de Cuenta Destino Verificada</div>
                    <div style="font-size:0.8rem;color:#3b82f6;margin-top:4px;font-family:monospace;letter-spacing:1px">CBU: 0110012330001234567890</div>
                    <div style="font-size:0.8rem;color:#3b82f6;font-family:monospace;margin-top:2px">ALIAS: MUNICIPIO.BARADERO.LICENCIAS</div>
                    <div style="margin-top:12px">
                        <span class="badge badge-pending" style="font-size:0.75rem;padding:4px 10px">Auditoría Fiscal de Tránsito</span>
                    </div>
                </div>
            </div>

            <div style="padding:14px 22px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end">
                <button class="btn btn-primary" onclick="document.getElementById('receiptModal').remove()" style="font-weight:700">
                    Cerrar Previsualización
                </button>
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
