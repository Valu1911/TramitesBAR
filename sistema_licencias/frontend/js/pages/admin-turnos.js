/**
 * Admin Panel - Turnos y Exámenes Prácticos
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
                    <h1 style="font-size:1.25rem;font-weight:800">📅 Gestión de Turnos y Exámenes</h1>
                    <p class="text-sm text-muted">Aprobá turnos y registrá resultados de exámenes prácticos</p>
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
                    <div class="empty-state__icon">📅</div>
                    <h3 class="empty-state__title">Sin reservas</h3>
                    <p class="empty-state__desc">No hay reservas para mostrar con este filtro</p>
                </div>` : reservas.map(r => {
                    const estadoMap = {
                        'reservado': { badge: 'badge-pending', text: '⏳ Pendiente' },
                        'aprobado': { badge: 'badge-info', text: '✅ Confirmado' },
                        'completado': { badge: r.resultado_examen === 'aprobado' ? 'badge-success' : 'badge-danger', 
                                       text: r.resultado_examen === 'aprobado' ? '🎉 Aprobado' : '❌ No aprobado' },
                        'rechazado': { badge: 'badge-danger', text: '❌ Rechazado' }
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
                                <span style="font-size:1.25rem">📅</span>
                                <div>
                                    <div class="font-semibold text-sm">${r.fecha} - ${r.horario}</div>
                                    <div class="text-xs text-muted">📍 ${r.ubicacion}</div>
                                </div>
                            </div>
                        </div>

                        ${r.estado === 'reservado' ? `
                        <div class="admin-item__actions">
                            <button class="btn btn-success btn-sm" onclick="AdminTurnosPage.revisar(${r.id}, 'aprobado')">
                                ✅ Confirmar turno
                            </button>
                            <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger)" 
                                    onclick="AdminTurnosPage.revisar(${r.id}, 'rechazado')">
                                ❌ Rechazar
                            </button>
                        </div>` : ''}

                        ${r.estado === 'aprobado' ? `
                        <div>
                            <p class="text-xs text-muted mb-2">Registrar resultado del examen práctico:</p>
                            <div class="admin-item__actions">
                                <button class="btn btn-success btn-sm" 
                                        onclick="AdminTurnosPage.completar(${r.id}, 'aprobado')">
                                    🎉 Aprobó examen
                                </button>
                                <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger)" 
                                        onclick="AdminTurnosPage.completar(${r.id}, 'reprobado')">
                                    ❌ No aprobó
                                </button>
                            </div>
                        </div>` : ''}

                        ${r.observaciones_admin ? `<p class="text-xs text-muted mt-2">Obs: ${r.observaciones_admin}</p>` : ''}
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }

    static setFiltro(filtro) {
        this.filtro = filtro;
        this.render(document.getElementById('app'));
    }

    static async revisar(reservaId, estado) {
        const obs = estado === 'rechazado' ? prompt('Motivo del rechazo (opcional):') || '' : '';
        
        try {
            await ApiService.adminRevisarTurno(reservaId, estado, 'pendiente', obs);
            Toast.success(`Turno ${estado} correctamente`);
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message);
        }
    }

    static async completar(reservaId, resultado) {
        const obs = resultado === 'reprobado' ? prompt('Observaciones (opcional):') || '' : '';
        
        try {
            await ApiService.adminRevisarTurno(reservaId, 'completado', resultado, obs);
            Toast.success(resultado === 'aprobado' ? '¡Examen práctico aprobado!' : 'Examen práctico registrado como no aprobado');
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message);
        }
    }
}
