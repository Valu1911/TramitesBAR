/**
 * Página de Examen Práctico & Registro Biométrico (Huella y Foto)
 */
class PracticoPage {
    static turnoSeleccionado = null;

    static async render(app) {
        this.turnoSeleccionado = null;

        app.innerHTML = `
        ${renderBackHeader('Examen práctico y biometría')}
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
            const demoReserva = JSON.parse(localStorage.getItem('demo_reserva_practico') || 'null');
            const turnos = [
                { id: 1, fecha: 'Lunes 11/08/2026', horario: '09:00 hs', ubicacion: 'Circuito Municipal de Baradero', cupo_maximo: 10, cupo_actual: 2 },
                { id: 2, fecha: 'Miércoles 13/08/2026', horario: '10:30 hs', ubicacion: 'Circuito Municipal de Baradero', cupo_maximo: 10, cupo_actual: 4 },
                { id: 3, fecha: 'Viernes 15/08/2026', horario: '14:00 hs', ubicacion: 'Circuito Municipal de Baradero', cupo_maximo: 10, cupo_actual: 1 }
            ];
            this.renderContent(app, { turnos, reserva: demoReserva });
            if (err && err.status === 403) {
                Toast.info('Modo Demo: Reserva de Turno Práctico + Biometría.');
            }
        }
    }

    static renderContent(app, data) {
        if (data.reserva) {
            const r = data.reserva;
            const huella = r.huella_tomada ? '✓ Registrada' : '⏳ Pendiente presencial';
            const foto = r.foto_tomada ? '✓ Registrada' : '⏳ Pendiente presencial';
            const examen = r.resultado_examen === 'aprobado' ? '✓ Aprobado' : (r.resultado_examen === 'rechazado' ? '❌ No Aprobado' : '⏳ Pendiente');

            const statusMap = {
                'reservado': { icon: Icons.calendar, title: '¡Turno agendado!', desc: 'Presentate en el circuito municipal para el Examen Práctico, Toma de Huella y Foto.', badge: 'badge-pending', badgeText: 'Pendiente' },
                'aprobado': { icon: Icons.check, title: '¡Turno confirmado!', desc: 'Tu turno fue aprobado. Te esperamos para evaluar manejo y capturar biometría.', badge: 'badge-success', badgeText: 'Confirmado' },
                'completado': { 
                    icon: (r.resultado_examen === 'aprobado' && r.huella_tomada && r.foto_tomada) ? Icons.party : Icons.clock, 
                    title: (r.resultado_examen === 'aprobado' && r.huella_tomada && r.foto_tomada) ? '¡Trámite Práctico y Biometría Completados!' : 'Examen y Biometría en Verificación',
                    desc: (r.resultado_examen === 'aprobado' && r.huella_tomada && r.foto_tomada) ? '¡Excelente! Ya podés visualizar tu Licencia Digital en la aplicación.' : 'Se están procesando tus registros.',
                    badge: 'badge-success',
                    badgeText: 'Completado'
                },
                'rechazado': { icon: Icons.x, title: 'Turno no completado', desc: 'Motivo: ' + (r.observaciones_admin || 'Revisión requerida'), badge: 'badge-danger', badgeText: 'Rechazado' }
            };
            const st = statusMap[r.estado] || statusMap['reservado'];

            app.innerHTML = `
            ${renderBackHeader('Examen práctico y biometría')}
            <div class="page-content container-md animate-slideUp">
                <div class="waiting-status mb-4">
                    <div class="waiting-status__icon" style="background:var(--primary-soft);color:var(--primary);display:flex;align-items:center;justify-content:center">${st.icon}</div>
                    <h2 class="font-bold" style="font-size:1.25rem;margin-bottom:8px">${st.title}</h2>
                    <span class="badge ${st.badge}">${st.badgeText}</span>
                    <p class="text-muted text-sm mt-3">${st.desc}</p>
                </div>

                <div class="glass-card p-4 mb-4">
                    <div style="display:flex;align-items:center;gap:12px">
                        <div style="width:44px;height:44px;border-radius:var(--radius-md);background:var(--primary-soft);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:1.25rem">${Icons.calendar}</div>
                        <div>
                            <div class="font-semibold text-sm">${r.fecha} - ${r.horario}</div>
                            <div class="text-xs text-muted mt-1" style="display:flex;align-items:center;gap:4px">${Icons.mapPin} ${r.ubicacion}</div>
                        </div>
                    </div>
                </div>

                <!-- CHECKLIST REQUISITOS DEL TURNO -->
                <div class="glass-card p-5 mb-4">
                    <h3 class="font-bold text-sm mb-3">📋 Estado de Requisitos del Turno:</h3>
                    <div class="stack" style="gap:10px;font-size:0.85rem">
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg);border-radius:var(--radius-sm)">
                            <span>🚗 <strong>Examen Práctico de Manejo:</strong></span>
                            <span class="font-bold" style="color:${r.resultado_examen === 'aprobado' ? 'var(--success)' : 'var(--warning)'}">${examen}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg);border-radius:var(--radius-sm)">
                            <span>☝️ <strong>Toma de Huella Digital:</strong></span>
                            <span class="font-bold" style="color:${r.huella_tomada ? 'var(--success)' : 'var(--warning)'}">${huella}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg);border-radius:var(--radius-sm)">
                            <span>📸 <strong>Foto Biométrica para Licencia:</strong></span>
                            <span class="font-bold" style="color:${r.foto_tomada ? 'var(--success)' : 'var(--warning)'}">${foto}</span>
                        </div>
                    </div>
                    <p class="text-xs text-muted mt-3">
                        ⚠️ Recordá que una vez completados y aprobados los 3 ítems por la autoridad examinadora, la licencia de conducir se emite automáticamente en la aplicación.
                    </p>
                </div>

                <button class="btn btn-primary btn-block mt-4" onclick="Router.navigate('dashboard')">Volver al panel principal</button>
            </div>`;
            return;
        }

        // Sin reserva - mostrar turnos disponibles
        app.innerHTML = `
        ${renderBackHeader('Examen práctico y biometría')}
        <div class="page-content container-md animate-slideUp">
            <div style="background:linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2));border:1px solid var(--primary-light,#93c5fd);border-radius:var(--radius-md);padding:14px;margin-bottom:18px">
                <h3 class="font-bold text-sm mb-1" style="color:var(--primary);display:flex;align-items:center;gap:6px">
                    <span>🚗</span> Turno Unificado: Examen + Biometría
                </h3>
                <p class="text-xs text-muted mb-0">
                    Este turno agendado te habilita para realizar en el mismo día la <strong>evaluación práctica de manejo</strong>, la <strong>captura de huella digital</strong> y la <strong>toma de foto oficial</strong> para tu credencial digital.
                </p>
            </div>

            <p class="text-sm text-muted mb-4">
                Seleccioná un turno disponible en el Circuito Municipal de Baradero:
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
                            Cupos: ${turno.cupo_maximo - turno.cupo_actual} disponibles · Incluye Huella + Foto
                        </div>
                    </div>
                    ${this.turnoSeleccionado === turno.id ? '<span style="color:var(--primary);font-size:1.2rem;display:flex;align-items:center">' + Icons.check + '</span>' : ''}
                </div>`).join('')}
            </div>

            ${data.turnos.length > 0 ? `
            <button class="btn btn-primary btn-block btn-lg" id="reservarBtn"
                    ${!this.turnoSeleccionado ? 'disabled' : ''}
                    onclick="PracticoPage.reservar()">
                Confirmar turno unificado
            </button>` : ''}
        </div>`;
        if (window.Tutorial) setTimeout(() => window.Tutorial.startTutorialWithContext('practico'), 300);
    }

    static selectTurno(id) {
        this.turnoSeleccionado = id;
        this.render(document.getElementById('app'));
    }

    static async reservar() {
        if (!this.turnoSeleccionado) return;

        const btn = document.getElementById('reservarBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Reservando...';
        }

        try {
            await ApiService.reservarTurno(this.turnoSeleccionado);
            Toast.success('¡Turno para examen y biometría reservado correctamente!');
            this.render(document.getElementById('app'));
        } catch (err) {
            localStorage.setItem('demo_reserva_practico', JSON.stringify({
                estado: 'aprobado',
                resultado_examen: 'aprobado',
                huella_tomada: 1,
                foto_tomada: 1,
                fecha: 'Lunes 11/08/2026',
                horario: '09:00 hs',
                ubicacion: 'Circuito Municipal de Baradero',
                created_at: new Date().toISOString()
            }));
            Toast.success('¡Turno reservado correctamente! (Modo Demo)');
            this.render(document.getElementById('app'));
        }
    }
}
