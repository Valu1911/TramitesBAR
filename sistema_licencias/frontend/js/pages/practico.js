/**
 * Página de Examen Práctico - Selección de turno
 */
class PracticoPage {
    static turnoSeleccionado = null;

    static async render(app) {
        this.turnoSeleccionado = null;

        app.innerHTML = `
        ${renderBackHeader('Examen práctico')}
        <div class="page-content container-md">
            <div class="text-center" style="padding:40px 0">
                <div class="spinner" style="margin:0 auto"></div>
                <p class="text-muted mt-3">Cargando turnos...</p>
            </div>
        </div>`;

        try {
            const data = await ApiService.getTurnosDisponibles();
            this.renderContent(app, data);
        } catch (err) {
            app.innerHTML = `
            ${renderBackHeader('Examen práctico')}
            <div class="page-content container-md">
                <div class="info-box info-box--warning">
                    <span style="display:flex;align-items:center">${Icons.alert}</span>
                    <span>${err.message}</span>
                </div>
                <button class="btn btn-outline btn-block mt-4" onclick="Router.navigate('dashboard')">Volver al panel</button>
            </div>`;
        }
    }

    static renderContent(app, data) {
        if (data.reserva) {
            const r = data.reserva;
            const statusMap = {
                'reservado': { icon: Icons.calendar, title: '¡Turno agendado!', desc: 'Tu turno fue reservado. Esperá la confirmación del administrador.', badge: 'badge-pending', badgeText: 'Pendiente' },
                'aprobado': { icon: Icons.check, title: '¡Turno confirmado!', desc: 'Tu turno fue aprobado. Presentate en la fecha y lugar indicados.', badge: 'badge-success', badgeText: 'Confirmado' },
                'completado': { 
                    icon: r.resultado_examen === 'aprobado' ? Icons.party : Icons.x, 
                    title: r.resultado_examen === 'aprobado' ? '¡Examen práctico aprobado!' : 'Examen práctico no aprobado',
                    desc: r.resultado_examen === 'aprobado' ? 'Podés continuar con la entrega de tu licencia.' : 'Contactá a la municipalidad para más información.',
                    badge: r.resultado_examen === 'aprobado' ? 'badge-success' : 'badge-danger',
                    badgeText: r.resultado_examen === 'aprobado' ? 'Aprobado' : 'No aprobado'
                },
                'rechazado': { icon: Icons.x, title: 'Turno rechazado', desc: 'Motivo: ' + (r.observaciones_admin || 'Sin observaciones'), badge: 'badge-danger', badgeText: 'Rechazado' }
            };
            const st = statusMap[r.estado] || statusMap['reservado'];

            app.innerHTML = `
            ${renderBackHeader('Examen práctico')}
            <div class="page-content container-md animate-slideUp">
                <div class="waiting-status">
                    <div class="waiting-status__icon" style="background:var(--primary-soft);color:var(--primary);display:flex;align-items:center;justify-content:center">${st.icon}</div>
                    <h2 class="font-bold" style="font-size:1.25rem;margin-bottom:8px">${st.title}</h2>
                    <span class="badge ${st.badge}">${st.badgeText}</span>
                    <p class="text-muted text-sm mt-3">${st.desc}</p>
                </div>

                <div class="glass-card p-4 mt-4">
                    <div style="display:flex;align-items:center;gap:12px">
                        <div style="width:44px;height:44px;border-radius:var(--radius-md);background:var(--primary-soft);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:1.25rem">${Icons.calendar}</div>
                        <div>
                            <div class="font-semibold text-sm">${r.fecha} - ${r.horario}</div>
                            <div class="text-xs text-muted mt-1" style="display:flex;align-items:center;gap:4px">${Icons.mapPin} ${r.ubicacion}</div>
                        </div>
                    </div>
                </div>

                <button class="btn btn-primary btn-block mt-4" onclick="Router.navigate('dashboard')">Volver al panel</button>
            </div>`;
            return;
        }

        // Sin reserva - mostrar turnos disponibles
        app.innerHTML = `
        ${renderBackHeader('Examen práctico')}
        <div class="page-content container-md animate-slideUp">
            <p class="text-sm text-muted mb-4">
                Seleccioná un turno disponible para el examen práctico presencial.
            </p>

            <div class="stack mb-4">
                ${data.turnos.length === 0 ? `
                <div class="empty-state">
                    <div class="empty-state__icon" style="display:flex;align-items:center;justify-content:center">${Icons.calendar}</div>
                    <h3 class="empty-state__title">Sin turnos disponibles</h3>
                    <p class="empty-state__desc">No hay turnos disponibles en este momento. Volvé más tarde.</p>
                </div>` : data.turnos.map(turno => `
                <div class="turno-card ${this.turnoSeleccionado === turno.id ? 'turno-card--selected' : ''}"
                     onclick="PracticoPage.selectTurno(${turno.id})">
                    <div class="turno-card__icon" style="display:flex;align-items:center;justify-content:center">${Icons.calendar}</div>
                    <div style="flex:1">
                        <h3 class="font-semibold text-sm">${turno.fecha} - ${turno.horario}</h3>
                        <div class="text-xs text-muted mt-1" style="display:flex;align-items:center;gap:4px">
                            <span style="display:flex;align-items:center">${Icons.mapPin}</span> ${turno.ubicacion}
                        </div>
                        <div class="text-xs text-muted mt-1">
                            Cupos: ${turno.cupo_maximo - turno.cupo_actual} disponibles
                        </div>
                    </div>
                    ${this.turnoSeleccionado === turno.id ? '<span style="color:var(--primary);font-size:1.2rem;display:flex;align-items:center">' + Icons.check + '</span>' : ''}
                </div>`).join('')}
            </div>

            ${data.turnos.length > 0 ? `
            <button class="btn btn-primary btn-block btn-lg" id="reservarBtn"
                    ${!this.turnoSeleccionado ? 'disabled' : ''}
                    onclick="PracticoPage.reservar()">
                Confirmar turno
            </button>` : ''}
        </div>`;
        if (window.Tutorial) setTimeout(() => window.Tutorial.startTutorialWithContext('practico'), 300);
    }

    staticic selectTurno(id) {
        this.turnoSeleccionado = id;
        this.render(document.getElementById('app'));
    }

    static async reservar() {
        if (!this.turnoSeleccionado) return;

        const btn = document.getElementById('reservarBtn');
        btn.disabled = true;
        btn.textContent = 'Reservando...';

        try {
            await ApiService.reservarTurno(this.turnoSeleccionado);
            Toast.success('¡Turno reservado correctamente!');
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message);
            btn.disabled = false;
            btn.textContent = 'Confirmar turno';
        }
    }
}
