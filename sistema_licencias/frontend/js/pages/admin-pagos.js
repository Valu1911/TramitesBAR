/**
 * Admin Panel - Tesorería y Auditoría de Pagos
 */
class AdminPagosPage {
    static filtro = 'todos';

    static async render(app) {
        const admin = ApiService.getAdmin();

        app.innerHTML = `
        ${renderAdminNavbar(admin)}
        <div class="page-content">
            <div class="text-center" style="padding:48px 0">
                <div class="spinner" style="margin:0 auto"></div>
                <p class="text-muted mt-3" style="font-size:0.85rem">Cargando registros de tesorería...</p>
            </div>
        </div>`;

        try {
            const data = await ApiService.adminGetPagos(this.filtro);
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
                            ${Icons.landmark} Tesorería Municipal · Tasas y Aranceles
                        </div>
                        <h1 style="font-size:1.55rem;font-weight:800;color:#ffffff;margin-bottom:6px;font-family:var(--font-title);letter-spacing:-0.02em">
                            Auditoría de Pagos y Comprobantes
                        </h1>
                        <p style="color:rgba(255,255,255,0.82);font-size:0.86rem;max-width:680px;margin:0">
                            Verificación contable de transferencias bancarias y liquidaciones de aranceles de emisión previo a la habilitación del examen práctico.
                        </p>
                    </div>
                    <div>
                        <button class="admin-hero__refresh-btn" onclick="AdminPagosPage.render(document.getElementById('app'))">
                            ${Icons.refresh} Actualizar
                        </button>
                    </div>
                </div>
            </div>

            <!-- KPI METRICS GRID -->
            <div class="admin-kpi-grid">
                <div class="admin-kpi-card" style="border-left:3px solid #0284c7">
                    <div class="admin-kpi-icon" style="background:#f0f9ff;color:#0284c7">
                        ${Icons.receipt}
                    </div>
                    <div>
                        <div class="admin-kpi-val">$${totalRecaudado.toLocaleString('es-AR')}</div>
                        <div class="admin-kpi-label">Recaudación Convalidada</div>
                    </div>
                </div>

                <div class="admin-kpi-card" style="border-left:3px solid #f59e0b">
                    <div class="admin-kpi-icon" style="background:#fffbeb;color:#d97706">
                        ${Icons.clock}
                    </div>
                    <div>
                        <div class="admin-kpi-val" style="color:#b45309">${pendientes}</div>
                        <div class="admin-kpi-label">Pendientes de Revisión</div>
                    </div>
                </div>

                <div class="admin-kpi-card" style="border-left:3px solid #10b981">
                    <div class="admin-kpi-icon" style="background:#ecfdf5;color:#059669">
                        ${Icons.checkCircle}
                    </div>
                    <div>
                        <div class="admin-kpi-val" style="color:#047857">${aprobados}</div>
                        <div class="admin-kpi-label">Comprobantes Aprobados</div>
                    </div>
                </div>

                <div class="admin-kpi-card" style="border-left:3px solid #e57373">
                    <div class="admin-kpi-icon" style="background:#fff5f5;color:#b84a54">
                        ${Icons.xCircle}
                    </div>
                    <div>
                        <div class="admin-kpi-val" style="color:#b84a54">${rechazados}</div>
                        <div class="admin-kpi-label">Observados / Rechazados</div>
                    </div>
                </div>
            </div>

            <!-- FILTROS TABS -->
            <div class="admin-filter-bar">
                <div class="admin-tabs-list">
                    <button class="admin-tab-btn ${this.filtro === 'todos' ? 'active' : ''}" onclick="AdminPagosPage.setFiltro('todos')">
                        ${Icons.filter} Todos (${pagos.length})
                    </button>
                    <button class="admin-tab-btn ${this.filtro === 'pendiente' ? 'active' : ''}" onclick="AdminPagosPage.setFiltro('pendiente')">
                        ${Icons.clock} Pendientes (${pendientes})
                    </button>
                    <button class="admin-tab-btn ${this.filtro === 'aprobado' ? 'active' : ''}" onclick="AdminPagosPage.setFiltro('aprobado')">
                        ${Icons.check} Aprobados (${aprobados})
                    </button>
                    <button class="admin-tab-btn ${this.filtro === 'rechazado' ? 'active' : ''}" onclick="AdminPagosPage.setFiltro('rechazado')">
                        ${Icons.x} Rechazados (${rechazados})
                    </button>
                </div>
            </div>

            <!-- LISTA DE PAGOS -->
            <div id="pagosLista">
                ${pagos.length === 0 ? `
                <div class="dash-card text-center" style="padding:48px 20px">
                    <div style="width:56px;height:56px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;color:#64748b;font-size:1.35rem">
                        ${Icons.creditCard}
                    </div>
                    <h3 style="font-size:1.05rem;font-weight:700;color:var(--text-primary);margin-bottom:6px">Sin registros contables</h3>
                    <p style="font-size:0.84rem;color:var(--text-muted);max-width:400px;margin:0 auto">No se encontraron liquidaciones ni comprobantes de pago bajo el filtro seleccionado (${this.filtro}).</p>
                </div>` : pagos.map(pago => `
                <div class="admin-item animate-slideUp" id="pago-${pago.id}">
                    <div class="admin-item__header">
                        <div style="display:flex;align-items:center;gap:14px">
                            <div class="admin-item__avatar">
                                ${Icons.creditCard}
                            </div>
                            <div>
                                <div class="admin-item__user">${pago.nombre} ${pago.apellido}</div>
                                <div class="admin-item__meta">
                                    <span><strong>DNI:</strong> ${pago.dni}</span>
                                    <span>·</span>
                                    <span><strong>Fecha:</strong> ${pago.fecha_pago}</span>
                                    <span>·</span>
                                    <span><strong>Medio:</strong> ${pago.metodo === 'transferencia' ? 'Transferencia Bancaria' : 'Tarjeta de Débito'}</span>
                                </div>
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px">
                            <span class="badge ${pago.estado === 'pendiente' ? 'badge-pending' : pago.estado === 'aprobado' ? 'badge-success' : 'badge-danger'}" style="display:inline-flex;align-items:center;gap:5px;font-size:0.75rem;padding:4px 10px">
                                ${pago.estado === 'pendiente' ? Icons.clock : pago.estado === 'aprobado' ? Icons.check : Icons.x}
                                ${pago.estado.toUpperCase()}
                            </span>
                        </div>
                    </div>

                    <div class="admin-item__detail flex-between" style="flex-wrap:wrap;gap:10px">
                        <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
                            <span style="font-size:0.78rem;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.03em">Importe Declarado:</span>
                            <span style="font-size:1.15rem;font-weight:800;color:#0f172a;font-variant-numeric:tabular-nums">$${Number(pago.monto).toLocaleString('es-AR')}</span>
                            <span style="font-size:0.78rem;color:#64748b">(${pago.metodo === 'transferencia' ? 'Cuenta Recaudadora CBU / Alias Municipal' : 'Acreditación por Débito'})</span>
                        </div>
                        <div>
                            <button class="btn btn-ghost btn-sm" onclick="AdminPagosPage.verComprobante('${pago.id}', '${pago.nombre} ${pago.apellido}', '${pago.dni}', '${pago.monto}', '${pago.metodo}')" 
                                    style="color:#0284c7;border:1px solid #bae6fd;background:#f0f9ff;font-weight:700;display:inline-flex;align-items:center;gap:6px;border-radius:7px">
                                ${Icons.eye} Ver Detalle de Liquidación
                            </button>
                        </div>
                    </div>

                    ${pago.observaciones_admin ? `
                    <div style="font-size:0.8rem;color:#475569;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:10px;display:flex;align-items:center;gap:6px">
                        <span style="color:#64748b;display:flex">${Icons.info}</span>
                        <span><strong>Observación Tesorería:</strong> ${pago.observaciones_admin}</span>
                    </div>` : ''}

                    ${pago.estado === 'pendiente' ? `
                    <div class="admin-item__actions">
                        <button class="btn btn-outline btn-sm" style="color:#b84a54;border-color:#fed7d7;background:#ffffff;border-radius:7px" 
                                onclick="AdminPagosPage.revisar(${pago.id}, 'rechazado')">
                            <span style="display:flex;align-items:center;gap:5px">${Icons.x} Observar / Rechazar</span>
                        </button>
                        <button class="btn btn-success btn-sm" onclick="AdminPagosPage.revisar(${pago.id}, 'aprobado')" 
                                style="background:#059669;border-color:#059669;color:#fff;font-weight:700;border-radius:7px">
                            <span style="display:flex;align-items:center;gap:5px">${Icons.check} Aprobar Comprobante</span>
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
        overlay.className = 'alert-dialog-backdrop';
        overlay.id = 'receiptModal';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        overlay.innerHTML = `
        <div class="dash-card animate-slideUp" style="max-width:500px;width:100%;box-shadow:0 25px 50px -12px rgba(15,23,42,0.3);border:1px solid #cbd5e1;padding:0;overflow:hidden;border-radius:14px">
            <div style="background:#0f172a;color:#fff;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #1e293b">
                <div style="display:flex;align-items:center;gap:12px">
                    <div style="width:38px;height:38px;border-radius:9px;background:rgba(56,189,248,0.14);border:1px solid rgba(56,189,248,0.3);color:#38bdf8;display:flex;align-items:center;justify-content:center;font-size:1.1rem">
                        ${Icons.landmark}
                    </div>
                    <div>
                        <h3 style="font-size:0.96rem;font-weight:800;margin:0;color:#fff">Liquidación Oficial #${pagoId}</h3>
                        <p style="font-size:0.74rem;margin:0;color:#94a3b8">Municipalidad de Baradero · Tesorería General</p>
                    </div>
                </div>
                <button class="btn btn-ghost btn-sm" onclick="document.getElementById('receiptModal').remove()" style="color:#94a3b8;padding:4px 8px">${Icons.x}</button>
            </div>
            
            <div style="padding:22px">
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:16px">
                    <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:2px">Contribuyente Titular</div>
                    <div style="font-size:1.02rem;font-weight:800;color:#0f172a">${usuarioNombre}</div>
                    <div style="font-size:0.8rem;color:#475569;margin-top:2px">Documento (DNI): <strong>${dni}</strong></div>
                    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0">
                        <span style="font-size:0.82rem;font-weight:600;color:#64748b">Arancel Liquidado:</span>
                        <strong style="font-size:1.35rem;color:#0284c7;font-variant-numeric:tabular-nums">$${Number(monto).toLocaleString('es-AR')}</strong>
                    </div>
                    <div style="font-size:0.78rem;color:#64748b;margin-top:6px">
                        Modalidad de Pago: <strong>${metodo === 'transferencia' ? 'Transferencia Bancaria (CBU / Alias)' : 'Tarjeta de Débito'}</strong>
                    </div>
                </div>

                <div style="background:#f0f9ff;border-radius:10px;border:1px solid #bae6fd;padding:16px">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;color:#0369a1;font-weight:700;font-size:0.84rem">
                        ${Icons.fileCheck}
                        <span>Cuenta Recaudadora Municipal Verificada</span>
                    </div>
                    <div style="font-size:0.78rem;color:#0f172a;font-family:monospace;background:#ffffff;padding:8px 10px;border-radius:6px;border:1px solid #e0f2fe">
                        <div>CBU: 0110012330001234567890</div>
                        <div style="margin-top:2px">ALIAS: MUNICIPIO.BARADERO.LICENCIAS</div>
                    </div>
                </div>
            </div>

            <div style="padding:14px 22px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end">
                <button class="btn btn-primary btn-sm" onclick="document.getElementById('receiptModal').remove()" style="font-weight:700;padding:8px 18px;border-radius:8px">
                    Cerrar Comprobante
                </button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
    }

    static async revisar(pagoId, estado) {
        let obs = '';
        if (estado === 'aprobado') {
            const ok = await ConfirmModal.show({
                title: '¿Aprobar comprobante de pago?',
                message: 'Al convalidar este pago, el ciudadano quedará habilitado para reservar su turno de evaluación práctica.',
                confirmText: 'Sí, aprobar pago',
                cancelText: 'Cancelar',
                variant: 'success',
                icon: Icons.checkCircle
            });
            if (!ok) return;
        } else {
            const motivo = await ConfirmModal.prompt({
                title: 'Rechazar comprobante de pago',
                message: 'Podés indicar el motivo del rechazo para que el contribuyente verifique su operación y vuelva a presentar el comprobante.',
                inputLabel: 'Motivo de observación / rechazo (opcional)',
                placeholder: 'Ej: El número de comprobante o importe no coincide con los registros bancarios.',
                confirmText: 'Confirmar rechazo',
                cancelText: 'Cancelar',
                variant: 'danger',
                icon: Icons.xCircle
            });
            if (motivo === null) return;
            obs = motivo;
        }
        
        try {
            await ApiService.adminRevisarPago(pagoId, estado, obs);
            Toast.success(`Comprobante ${estado} correctamente`);
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message);
        }
    }
}
