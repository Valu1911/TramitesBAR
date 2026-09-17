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
                'reservado': { icon: Icons.calendar, bg: '#fef3c7', color: '#b45309', title: '¡Turno Agendado con Éxito!', desc: 'Presentate con tu vehículo en el Circuito Municipal de Baradero para la evaluación y biometría.', badge: 'badge-warning', badgeText: 'Turno Confirmado' },
                'aprobado': { icon: Icons.check, bg: '#dcfce7', color: '#15803d', title: '¡Evaluación en Pista Aprobada!', desc: 'Tu examen práctico y datos biométricos fueron registrados por el evaluador oficial.', badge: 'badge-success', badgeText: 'Aprobado' },
                'completado': { 
                    icon: (r.resultado_examen === 'aprobado' && r.huella_tomada && r.foto_tomada) ? Icons.party : Icons.clock, 
                    bg: '#ecfdf5', color: '#059669',
                    title: (r.resultado_examen === 'aprobado' && r.huella_tomada && r.foto_tomada) ? '¡Trámite Práctico y Biometría Completados!' : 'Examen y Biometría en Verificación',
                    desc: (r.resultado_examen === 'aprobado' && r.huella_tomada && r.foto_tomada) ? '¡Felicitaciones! Cumpliste todas las etapas. Ya podés visualizar tu Licencia Digital oficial.' : 'Se están procesando tus registros biométricos.',
                    badge: 'badge-success',
                    badgeText: 'Completado'
                },
                'rechazado': { icon: Icons.x, bg: '#fee2e2', color: '#b91c1c', title: 'Examen No Aprobado', desc: 'Motivo: ' + (r.observaciones_admin || 'Consultá con el evaluador para coordinar una nueva fecha.'), badge: 'badge-danger', badgeText: 'Observado' }
            };
            const st = statusMap[r.estado] || statusMap['reservado'];

            app.innerHTML = `
            ${renderBackHeader('Examen Práctico y Biometría')}
            <div class="page-content container-md animate-slideUp" style="max-width:760px;margin:0 auto;padding-top:14px;">
                
                <div class="dash-card text-center mb-4" style="border:1.5px solid #e2e8f0;padding:32px 24px;">
                    <div style="width:72px;height:72px;border-radius:50%;background:${st.bg};color:${st.color};display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 14px auto;">
                        ${st.icon}
                    </div>
                    <span class="badge ${st.badge} mb-2" style="font-size:0.8rem;padding:4px 12px;font-weight:700;">${st.badgeText}</span>
                    <h2 style="font-size:1.3rem;font-weight:800;color:#1e293b;margin-bottom:6px;">${st.title}</h2>
                    <p style="font-size:0.88rem;color:#64748b;margin:0 auto 20px auto;max-width:540px;">${st.desc}</p>

                    <!-- TARJETA DETALLE DEL TURNO -->
                    <div style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:12px;padding:16px 20px;text-align:left;margin-bottom:20px;display:flex;align-items:center;gap:16px;">
                        <div style="width:48px;height:48px;border-radius:50%;background:#0284c7;color:#ffffff;display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;">
                            ${Icons.calendar}
                        </div>
                        <div style="flex:1;">
                            <div style="font-size:1rem;font-weight:800;color:#1e293b;">${r.fecha} — ${r.horario}</div>
                            <div style="font-size:0.82rem;color:#64748b;margin-top:2px;display:flex;align-items:center;gap:4px;">
                                ${Icons.mapPin} ${r.ubicacion}
                            </div>
                        </div>
                    </div>

                    <!-- CHECKLIST DE REQUISITOS -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;text-align:left;margin-bottom:24px;">
                        <h3 style="font-size:0.9rem;font-weight:800;color:#1e293b;margin-bottom:12px;border-bottom:1px solid #f1f5f9;padding-bottom:8px;">
                            📋 Estado de Evaluación Presencial:
                        </h3>
                        <div style="display:flex;flex-direction:column;gap:10px;font-size:0.85rem;">
                            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
                                <span>🚗 <strong>Examen Práctico de Conducción:</strong></span>
                                <span class="badge ${r.resultado_examen === 'aprobado' ? 'badge-success' : 'badge-warning'}" style="font-size:0.75rem;">${examen}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
                                <span>☝️ <strong>Captura de Huella Digital Biométrica:</strong></span>
                                <span class="badge ${r.huella_tomada ? 'badge-success' : 'badge-warning'}" style="font-size:0.75rem;">${huella}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
                                <span>📸 <strong>Foto Oficial de Credencial:</strong></span>
                                <span class="badge ${r.foto_tomada ? 'badge-success' : 'badge-warning'}" style="font-size:0.75rem;">${foto}</span>
                            </div>
                        </div>
                    </div>

                    <button class="btn btn-primary btn-block btn-lg" style="font-weight:700" onclick="Router.navigate('dashboard')">
                        Volver al Panel Principal
                    </button>
                </div>

            </div>`;
            return;
        }

        // Sin reserva - mostrar turnos disponibles
        app.innerHTML = `
        ${renderBackHeader('Examen Práctico y Biometría')}
        <div class="page-content container-md animate-slideUp" style="max-width:880px;margin:0 auto;padding-top:12px;">
            
            <div class="dash-card mb-4">
                <div class="card-header-row">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div style="width:40px;height:40px;border-radius:50%;background:#e0f2fe;color:#0284c7;display:flex;align-items:center;justify-content:center;font-size:1.2rem;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        </div>
                        <div>
                            <h2 style="font-size:1.1rem;font-weight:800;margin:0;color:#1e293b;">Reserva de Turno en Circuito</h2>
                            <p style="font-size:0.8rem;color:#64748b;margin:0;">Paso 5 de 7 · Circuito Municipal de Baradero (Pista + Huella + Foto oficial).</p>
                        </div>
                    </div>
                    <span class="badge badge-info" style="font-size:0.75rem;padding:3px 8px;">Presencial</span>
                </div>

                <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:0.82rem;color:#0369a1;display:flex;align-items:center;gap:10px;">
                    <span style="font-size:1.2rem;">🚗</span>
                    <span>Presentate 15 minutos antes con tu DNI físico, vehículo en regla (seguro vigente, VTV) y cédula.</span>
                </div>

                <div class="stack mb-4" style="gap:12px;">
                    ${data.turnos.length === 0 ? `
                    <div class="empty-state text-center" style="padding:30px 0;">
                        <div style="font-size:2rem;color:#94a3b8;margin-bottom:8px;">📅</div>
                        <h3 style="font-weight:800;font-size:1rem;color:#1e293b;margin-bottom:4px;">Sin turnos disponibles de momento</h3>
                        <p class="text-xs text-muted">El área de tránsito actualiza los cupos semanalmente. Volvé a consultar en breve.</p>
                    </div>` : data.turnos.map(turno => `
                    <div class="turno-card ${this.turnoSeleccionado === turno.id ? 'turno-card--selected' : ''}"
                         style="border:1.5px solid ${this.turnoSeleccionado === turno.id ? '#0284c7' : '#e2e8f0'};background:${this.turnoSeleccionado === turno.id ? '#e0f2fe' : '#ffffff'};border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:16px;cursor:pointer;transition:all 0.2s ease;"
                         onclick="PracticoPage.selectTurno(${turno.id})">
                        <div style="width:44px;height:44px;border-radius:50%;background:${this.turnoSeleccionado === turno.id ? '#0284c7' : '#f1f5f9'};color:${this.turnoSeleccionado === turno.id ? '#ffffff' : '#0284c7'};display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;">
                            ${Icons.calendar}
                        </div>
                        <div style="flex:1;">
                            <div style="font-weight:800;font-size:0.98rem;color:#1e293b;margin-bottom:2px;">${turno.fecha} — ${turno.horario}</div>
                            <div style="font-size:0.8rem;color:#64748b;display:flex;align-items:center;gap:4px;">
                                ${Icons.mapPin} ${turno.ubicacion}
                            </div>
                            <div style="font-size:0.75rem;color:#0284c7;font-weight:600;margin-top:4px;">
                                Cupos disponibles: ${turno.cupo_maximo - turno.cupo_actual} · Incluye Huella + Foto Biométrica
                            </div>
                        </div>
                        <div style="width:28px;height:28px;border-radius:50%;border:2px solid ${this.turnoSeleccionado === turno.id ? '#0284c7' : '#cbd5e1'};background:${this.turnoSeleccionado === turno.id ? '#0284c7' : '#ffffff'};color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85rem;">
                            ${this.turnoSeleccionado === turno.id ? '✓' : ''}
                        </div>
                    </div>`).join('')}
                </div>

                <button class="btn btn-primary btn-block btn-lg" id="reservarBtn" style="font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;"
                        ${!this.turnoSeleccionado ? 'disabled' : ''}
                        onclick="PracticoPage.reservar()">
                    Confirmar Reserva de Turno
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </button>
            </div>

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
