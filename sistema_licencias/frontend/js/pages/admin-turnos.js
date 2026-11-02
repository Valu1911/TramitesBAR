/**
 * Admin Panel - Turnos, Exámenes Prácticos y Biometría (Huella + Foto)
 */
class AdminTurnosPage {
    static filtro = 'todos';

    static async render(app) {
        const admin = ApiService.getAdmin();

        app.innerHTML = `
        ${renderAdminNavbar(admin)}
        <div class="page-content">
            <div class="text-center" style="padding:40px 0">
                <div class="spinner" style="margin:0 auto"></div>
                <p class="text-muted mt-3">Cargando turnos...</p>
            </div>
        </div>`;

        try {
            const data = await ApiService.adminGetTurnos(this.filtro);
            this.renderContent(app, data, admin);
        } catch (err) {
            if (err.status === 403 || err.status === 401) {
                Toast.error('Acceso denegado. Iniciá sesión como admin de turnos.');
                adminLogout();
                return;
            }
            Toast.error(err.message);
        }
    }

    static renderContent(app, data, admin) {
        const reservas = data.reservas || [];
        const pendientes = data.pendientes || 0;
        const confirmados = reservas.filter(r => r.estado === 'aprobado').length;
        const completados = reservas.filter(r => r.estado === 'completado').length;

        app.innerHTML = `
        ${renderAdminNavbar(admin)}
        <div class="page-content animate-fadeIn">
            <!-- HERO ADMIN BANNER -->
            <div class="admin-hero">
                <div class="flex-between" style="flex-wrap:wrap;gap:16px;position:relative;z-index:1">
                    <div>
                        <div class="admin-badge-pill">
                            ${Icons.calendar} Centro de Emisión · Circuito y Biometría
                        </div>
                        <h1 style="font-size:1.6rem;font-weight:800;color:#ffffff;margin-bottom:6px;font-family:var(--font-title);letter-spacing:-0.02em">
                            Gestión de Turnos y Evaluación Práctica
                        </h1>
                        <p style="color:rgba(255,255,255,0.85);font-size:0.88rem;max-width:680px;margin:0">
                            Confirmá citas presenciales, coordiná la pista de manejo y validá los registros biométricos (huella dactilar y captura fotográfica).
                        </p>
                    </div>
                    <div>
                        <button class="btn btn-sm" onclick="AdminTurnosPage.render(document.getElementById('app'))" 
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
                        ${Icons.calendar}
                    </div>
                    <div>
                        <div class="admin-kpi-val">${reservas.length}</div>
                        <div class="admin-kpi-label">Total Citas Agendadas</div>
                    </div>
                </div>

                <div class="admin-kpi-card" style="border-left:3px solid #f59e0b">
                    <div class="admin-kpi-icon" style="background:#fef3c7;color:#d97706">
                        ${Icons.clock}
                    </div>
                    <div>
                        <div class="admin-kpi-val" style="color:#b45309">${pendientes}</div>
                        <div class="admin-kpi-label">Por Confirmar</div>
                    </div>
                </div>

                <div class="admin-kpi-card" style="border-left:3px solid #0284c7">
                    <div class="admin-kpi-icon" style="background:#e0f2fe;color:#0284c7">
                        ${Icons.check}
                    </div>
                    <div>
                        <div class="admin-kpi-val" style="color:#0284c7">${confirmados}</div>
                        <div class="admin-kpi-label">Turnos Confirmados</div>
                    </div>
                </div>

                <div class="admin-kpi-card" style="border-left:3px solid #10b981">
                    <div class="admin-kpi-icon" style="background:#d1fae5;color:#059669">
                        ${Icons.party}
                    </div>
                    <div>
                        <div class="admin-kpi-val" style="color:#047857">${completados}</div>
                        <div class="admin-kpi-label">Biometría y Práctico OK</div>
                    </div>
                </div>
            </div>

            <!-- FILTROS TABS -->
            <div class="admin-filter-bar">
                <div class="admin-tabs-list">
                    <button class="admin-tab-btn ${this.filtro === 'todos' ? 'active' : ''}" onclick="AdminTurnosPage.setFiltro('todos')">
                        Todos (${reservas.length})
                    </button>
                    <button class="admin-tab-btn ${this.filtro === 'reservado' ? 'active' : ''}" onclick="AdminTurnosPage.setFiltro('reservado')">
                        ⏳ Por Confirmar (${pendientes})
                    </button>
                    <button class="admin-tab-btn ${this.filtro === 'aprobado' ? 'active' : ''}" onclick="AdminTurnosPage.setFiltro('aprobado')">
                        ✓ Confirmados (${confirmados})
                    </button>
                    <button class="admin-tab-btn ${this.filtro === 'completado' ? 'active' : ''}" onclick="AdminTurnosPage.setFiltro('completado')">
                        🎉 Completados (${completados})
                    </button>
                </div>
            </div>

            <!-- LISTA -->
            <div>
                ${reservas.length === 0 ? `
                <div class="dash-card text-center" style="padding:48px 20px">
                    <div style="width:60px;height:60px;background:#f1f5f9;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#94a3b8">
                        ${Icons.calendar}
                    </div>
                    <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-bottom:6px">Sin citas de turno</h3>
                    <p style="font-size:0.85rem;color:var(--text-muted);max-width:400px;margin:0 auto">No hay turnos presenciales agendados para este filtro (${this.filtro}).</p>
                </div>` : reservas.map(r => {
                    const estadoMap = {
                        'reservado': { badge: 'badge-pending', text: '<span style="display:flex;align-items:center;gap:4px">' + Icons.clock + ' Pendiente de Confirmación</span>' },
                        'aprobado': { badge: 'badge-info', text: '<span style="display:flex;align-items:center;gap:4px">' + Icons.check + ' Turno Confirmado</span>' },
                        'completado': { badge: r.resultado_examen === 'aprobado' ? 'badge-success' : 'badge-danger', 
                                       text: r.resultado_examen === 'aprobado' ? '<span style="display:flex;align-items:center;gap:4px">' + Icons.party + ' Aprobado & Biometría OK</span>' : '<span style="display:flex;align-items:center;gap:4px">' + Icons.x + ' No Aprobado</span>' },
                        'rechazado': { badge: 'badge-danger', text: '<span style="display:flex;align-items:center;gap:4px">' + Icons.x + ' Rechazado</span>' }
                    };
                    const st = estadoMap[r.estado] || estadoMap['reservado'];

                    return `
                    <div class="admin-item animate-slideUp">
                        <div class="admin-item__header">
                            <div style="display:flex;align-items:center;gap:14px">
                                <div style="width:44px;height:44px;border-radius:12px;background:#eff6ff;border:1.5px solid #0284c7;display:flex;align-items:center;justify-content:center;color:#0284c7;font-size:1.2rem">
                                    🚗
                                </div>
                                <div>
                                    <div class="admin-item__user">${r.nombre} ${r.apellido}</div>
                                    <div class="admin-item__meta"><strong>DNI:</strong> ${r.dni} · <strong>Solicitado:</strong> ${r.fecha_reserva}</div>
                                </div>
                            </div>
                            <span class="badge ${st.badge}" style="font-size:0.8rem;padding:5px 12px">
                                ${st.text}
                            </span>
                        </div>

                        <!-- Detalle de Fecha y Lugar -->
                        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:14px">
                            <div class="flex-between" style="flex-wrap:wrap;gap:12px">
                                <div style="display:flex;align-items:center;gap:12px">
                                    <span style="font-size:1.4rem;display:flex;align-items:center;color:#0284c7">${Icons.calendar}</span>
                                    <div>
                                        <div style="font-weight:800;font-size:1.05rem;color:#0f172a">${r.fecha} · Horario: ${r.horario}</div>
                                        <div style="font-size:0.8rem;color:#64748b;display:flex;align-items:center;gap:4px;margin-top:2px">
                                            ${Icons.mapPin} ${r.ubicacion || 'Pista de Examen Municipal · Baradero'}
                                        </div>
                                    </div>
                                </div>

                                <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                                    <span class="badge ${r.huella_tomada ? 'badge-success' : 'badge-pending'}" style="font-size:0.75rem;padding:4px 10px">
                                        ☝️ Huella: ${r.huella_tomada ? 'Registrada' : 'Pendiente'}
                                    </span>
                                    <span class="badge ${r.foto_tomada ? 'badge-success' : 'badge-pending'}" style="font-size:0.75rem;padding:4px 10px">
                                        📸 Foto: ${r.foto_tomada ? 'Registrada' : 'Pendiente'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        ${r.estado === 'reservado' ? `
                        <div class="admin-item__actions">
                            <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:#fca5a5" 
                                    onclick="AdminTurnosPage.revisar(${r.id}, 'rechazado')">
                                <span style="display:flex;align-items:center;gap:5px">${Icons.x} Rechazar Cita</span>
                            </button>
                            <button class="btn btn-success btn-sm" onclick="AdminTurnosPage.revisar(${r.id}, 'aprobado')"
                                    style="background:#0284c7;color:#fff;font-weight:700;border-radius:8px">
                                <span style="display:flex;align-items:center;gap:5px">${Icons.check} Confirmar Turno Presencial</span>
                            </button>
                        </div>` : ''}

                        ${(r.estado === 'aprobado' || r.estado === 'completado') ? `
                        <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:16px;margin-top:10px">
                            <div style="font-size:0.85rem;font-weight:800;color:#1e40af;margin-bottom:10px;display:flex;align-items:center;gap:6px">
                                📋 Toma de Datos Biométricos & Evaluación de Conducción en Pista:
                            </div>
                            
                            <div style="display:flex;flex-wrap:wrap;gap:20px;margin-bottom:14px;font-size:0.85rem">
                                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:#fff;padding:8px 14px;border-radius:8px;border:1px solid #cbd5e1">
                                    <input type="checkbox" id="checkHuella_${r.id}" ${r.huella_tomada ? 'checked' : ''} style="width:18px;height:18px">
                                    <span style="font-weight:700;color:#1e293b">☝️ Huella Dactilar Tomada</span>
                                </label>
                                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:#fff;padding:8px 14px;border-radius:8px;border:1px solid #cbd5e1">
                                    <input type="checkbox" id="checkFoto_${r.id}" ${r.foto_tomada ? 'checked' : ''} style="width:18px;height:18px">
                                    <span style="font-weight:700;color:#1e293b">📸 Fotografía Oficial Registrada</span>
                                </label>
                            </div>

                            <div class="admin-item__actions">
                                <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:#fca5a5" 
                                        onclick="AdminTurnosPage.completarConBiometria(${r.id}, 'reprobado')">
                                    <span style="display:flex;align-items:center;gap:5px">${Icons.x} No Aprobó Práctico</span>
                                </button>
                                <button class="btn btn-success btn-sm" 
                                        onclick="AdminTurnosPage.completarConBiometria(${r.id}, 'aprobado')"
                                        style="background:#10b981;color:#fff;font-weight:700;border-radius:8px">
                                    <span style="display:flex;align-items:center;gap:5px">${Icons.party} Aprobar Examen y Habilitar Emisión</span>
                                </button>
                            </div>
                        </div>` : ''}

                        ${r.observaciones_admin ? `
                        <div style="font-size:0.8rem;color:#64748b;padding:8px 12px;background:#f1f5f9;border-radius:8px;margin-top:10px">
                            <strong>Observaciones:</strong> ${r.observaciones_admin}
                        </div>` : ''}
                    </div>`;
                }).join('')}
            </div>
        </div>`;

        if (window.Tutorial) {
            setTimeout(() => window.Tutorial.startTutorialWithContext('admin-turnos'), 300);
        }
    }

    static setFiltro(filtro) {
        this.filtro = filtro;
        this.render(document.getElementById('app'));
    }

    static async revisar(reservaId, estado) {
        const obs = estado === 'rechazado' ? prompt('Motivo del rechazo (opcional):') || '' : '';
        
        try {
            await ApiService.adminRevisarTurno(reservaId, estado, 'pendiente', 0, 0, obs);
            Toast.success(`Turno ${estado} correctamente`);
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message);
        }
    }

    static async completarConBiometria(reservaId, resultado) {
        const huellaChecked = document.getElementById(`checkHuella_${reservaId}`)?.checked ? 1 : 0;
        const fotoChecked = document.getElementById(`checkFoto_${reservaId}`)?.checked ? 1 : 0;

        if (resultado === 'aprobado' && (!huellaChecked || !fotoChecked)) {
            if (!confirm('⚠️ Advertencia: No se han marcado ambas verificaciones biométricas (Huella y Foto). ¿Deseás continuar de todos modos?')) {
                return;
            }
        }

        const obs = resultado === 'reprobado' ? prompt('Observaciones (opcional):') || '' : '';
        
        try {
            await ApiService.adminRevisarTurno(reservaId, 'completado', resultado, huellaChecked, fotoChecked, obs);
            Toast.success(resultado === 'aprobado' ? '¡Examen práctico y registro biométrico finalizados! Licencia lista para entrega.' : 'Registro finalizado como no aprobado.');
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message);
        }
    }
}
