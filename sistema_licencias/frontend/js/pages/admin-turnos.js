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

        app.innerHTML = `
        ${renderAdminNavbar(admin)}
        <div class="page-content animate-fadeIn">
            <div class="flex-between mb-4">
                <div>
                    <h1 style="font-size:1.25rem;font-weight:800;display:flex;align-items:center;gap:8px">${Icons.calendar} Gestión de Turnos y Biometría</h1>
                    <p class="text-sm text-muted">Confirmá turnos, registrá la toma de huella digital, foto y el resultado del examen práctico.</p>
                </div>
                <span class="badge badge-pending">${data.pendientes} pendientes</span>
            </div>

            <!-- Filtros -->
            <div class="tabs mb-4">
                <button class="tab ${this.filtro === 'todos' ? 'active' : ''}" onclick="AdminTurnosPage.setFiltro('todos')">Todos (${reservas.length})</button>
                <button class="tab ${this.filtro === 'reservado' ? 'active' : ''}" onclick="AdminTurnosPage.setFiltro('reservado')">Pendientes</button>
                <button class="tab ${this.filtro === 'aprobado' ? 'active' : ''}" onclick="AdminTurnosPage.setFiltro('aprobado')">Confirmados</button>
                <button class="tab ${this.filtro === 'completado' ? 'active' : ''}" onclick="AdminTurnosPage.setFiltro('completado')">Completados</button>
            </div>

            <!-- Lista -->
            <div>
                ${reservas.length === 0 ? `
                <div class="empty-state">
                    <div class="empty-state__icon" style="display:flex;align-items:center;justify-content:center">${Icons.calendar}</div>
                    <h3 class="empty-state__title">Sin reservas</h3>
                    <p class="empty-state__desc">No hay reservas para mostrar con este filtro</p>
                </div>` : reservas.map(r => {
                    const estadoMap = {
                        'reservado': { badge: 'badge-pending', text: '<span style="display:flex;align-items:center;gap:4px">' + Icons.clock + ' Pendiente</span>' },
                        'aprobado': { badge: 'badge-info', text: '<span style="display:flex;align-items:center;gap:4px">' + Icons.check + ' Confirmado</span>' },
                        'completado': { badge: r.resultado_examen === 'aprobado' ? 'badge-success' : 'badge-danger', 
                                       text: r.resultado_examen === 'aprobado' ? '<span style="display:flex;align-items:center;gap:4px">' + Icons.party + ' Aprobado & Biometría OK</span>' : '<span style="display:flex;align-items:center;gap:4px">' + Icons.x + ' No aprobado</span>' },
                        'rechazado': { badge: 'badge-danger', text: '<span style="display:flex;align-items:center;gap:4px">' + Icons.x + ' Rechazado</span>' }
                    };
                    const st = estadoMap[r.estado] || estadoMap['reservado'];

                    return `
                    <div class="admin-item">
                        <div class="admin-item__header">
                            <div>
                                <div class="admin-item__user">${r.nombre} ${r.apellido}</div>
                                <div class="admin-item__meta">DNI: ${r.dni} · Reservado: ${r.fecha_reserva}</div>
                            </div>
                            <span class="badge ${st.badge}">${st.text}</span>
                        </div>

                        <div class="glass-card p-3 mb-3" style="background:var(--bg-elevated)">
                            <div style="display:flex;align-items:center;gap:10px">
                                <span style="font-size:1.25rem;display:flex;align-items:center">${Icons.calendar}</span>
                                <div>
                                    <div class="font-semibold text-sm">${r.fecha} - ${r.horario}</div>
                                    <div class="text-xs text-muted" style="display:flex;align-items:center;gap:4px">${Icons.mapPin} ${r.ubicacion}</div>
                                </div>
                            </div>

                            <div style="display:flex;gap:12px;margin-top:10px;font-size:0.75rem">
                                <span class="badge ${r.huella_tomada ? 'badge-success' : 'badge-pending'}">
                                    ☝️ Huella: ${r.huella_tomada ? 'Registrada' : 'Pendiente'}
                                </span>
                                <span class="badge ${r.foto_tomada ? 'badge-success' : 'badge-pending'}">
                                    📸 Foto: ${r.foto_tomada ? 'Registrada' : 'Pendiente'}
                                </span>
                            </div>
                        </div>

                        ${r.estado === 'reservado' ? `
                        <div class="admin-item__actions">
                            <button class="btn btn-success btn-sm" onclick="AdminTurnosPage.revisar(${r.id}, 'aprobado')">
                                <span style="display:flex;align-items:center;gap:4px">${Icons.check} Confirmar turno</span>
                            </button>
                            <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger)" 
                                    onclick="AdminTurnosPage.revisar(${r.id}, 'rechazado')">
                                <span style="display:flex;align-items:center;gap:4px">${Icons.x} Rechazar</span>
                            </button>
                        </div>` : ''}

                        ${(r.estado === 'aprobado' || r.estado === 'completado') ? `
                        <div class="p-3 style="background:var(--bg);border-radius:var(--radius-md)">
                            <p class="text-xs font-bold mb-2">📋 Validación de Evaluación y Registros Biométricos:</p>
                            
                            <div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:12px;font-size:0.85rem">
                                <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                                    <input type="checkbox" id="checkHuella_${r.id}" ${r.huella_tomada ? 'checked' : ''}>
                                    <span>☝️ Huella Digital Tomada</span>
                                </label>
                                <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                                    <input type="checkbox" id="checkFoto_${r.id}" ${r.foto_tomada ? 'checked' : ''}>
                                    <span>📸 Foto de Licencia Tomada</span>
                                </label>
                            </div>

                            <div class="admin-item__actions">
                                <button class="btn btn-success btn-sm" 
                                        onclick="AdminTurnosPage.completarConBiometria(${r.id}, 'aprobado')">
                                    <span style="display:flex;align-items:center;gap:4px">${Icons.party} Aprobar Examen y Emitir</span>
                                </button>
                                <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger)" 
                                        onclick="AdminTurnosPage.completarConBiometria(${r.id}, 'reprobado')">
                                    <span style="display:flex;align-items:center;gap:4px">${Icons.x} No Aprobó Examen</span>
                                </button>
                            </div>
                        </div>` : ''}

                        ${r.observaciones_admin ? `<p class="text-xs text-muted mt-2">Obs: ${r.observaciones_admin}</p>` : ''}
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
            if (!confirm('⚠️ Advertencia: No se han marcado ambas verificaciones biométricas (Huella y Foto). ¿Deseás continuar?')) {
                return;
            }
        }

        const obs = resultado === 'reprobado' ? prompt('Observaciones (opcional):') || '' : '';
        
        try {
            await ApiService.adminRevisarTurno(reservaId, 'completado', resultado, huellaChecked, fotoChecked, obs);
            Toast.success(resultado === 'aprobado' ? '¡Examen práctico y registro biométrico finalizados! Licencia lista.' : 'Registro finalizado como no aprobado.');
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message);
        }
    }
}
