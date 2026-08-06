/**
 * Dashboard - Panel principal del usuario con progreso del trámite
 */
class DashboardPage {
    static async render(app) {
        const user = ApiService.getUsuario();
        
        app.innerHTML = `
        ${renderNavbar(user)}
        <div class="page-content">
            <div class="text-center" style="padding:60px 0">
                <div class="spinner" style="margin:0 auto"></div>
                <p class="text-muted mt-3">Cargando tu trámite...</p>
            </div>
        </div>`;

        try {
            const data = await ApiService.getProgreso();
            this.renderContent(app, data, user);
        } catch (err) {
            if (err.status === 401) {
                logout();
                return;
            }
            app.innerHTML = `
            ${renderNavbar(user)}
            <div class="page-content">
                <div class="empty-state">
                    <div class="empty-state__icon">⚠️</div>
                    <h2 class="empty-state__title">Error al cargar</h2>
                    <p class="empty-state__desc">${err.message}</p>
                    <button class="btn btn-primary mt-4" onclick="DashboardPage.render(document.getElementById('app'))">Reintentar</button>
                </div>
            </div>`;
        }
    }

    static renderContent(app, data, user) {
        const citizen = data.usuario || user || {};
        const isRenovacion = data.tipo === 'renovacion';
        const isCompletado = data.progreso_porcentaje === 100 || data.estado === 'completado' || data.paso_actual === 'finalizado';
        const licencia = data.licencia;

        // Guardar referencia en el objeto para la modal
        this.currentData = data;

        const stepIcons = {
            charlas: Icons.video,
            formularios: Icons.heart,
            examen: Icons.edit,
            pago: Icons.card,
            practico: Icons.car,
            entrega: Icons.id
        };

        const statusIcons = {
            completed: '<span style="color:var(--success);display:flex;align-items:center">' + Icons.check + '</span>',
            current: '<span style="color:#d97706;display:flex;align-items:center" title="Pendiente de verificación / acción">' + Icons.clock + '</span>',
            locked: '<span style="color:var(--text-muted);display:flex;align-items:center">' + Icons.lock + '</span>'
        };

        const currentStep = data.pasos.find(p => p.status === 'current');

        app.innerHTML = `
        ${renderNavbar(citizen)}
        <div class="page-content stack-lg animate-fadeIn">
            <!-- HERO CLASSIC -->
            <section class="hero gradient-hero">
                <div style="position:relative;z-index:1">
                    <div class="hero__badge">
                        <span style="display:flex;align-items:center;color:var(--warning)">${Icons.sparkles}</span>
                        ${isRenovacion ? 'Trámite de Renovación (Salud + Pago)' : 'Licencia Nueva'} · Baradero
                    </div>
                    <h1 class="hero__title">
                        Tu licencia de conducir, <span>sin filas</span>
                    </h1>
                    <p class="hero__subtitle">
                        ${isRenovacion ? 'Renovación directa online. Te acompañamos paso a paso desde la web.' : 'Iniciá tu trámite ahora mismo. Te acompañamos paso a paso desde la web.'}
                    </p>
                    <div class="hero__actions">
                        ${currentStep ? `
                        <button class="btn btn-lg" style="background:var(--bg-card);color:var(--primary);font-weight:700;box-shadow:var(--shadow-lg)" 
                                onclick="Router.navigate('${currentStep.id}')">
                            Continuar trámite →
                        </button>` : `
                        <button class="btn btn-lg" style="background:var(--success);color:white;font-weight:700" 
                                onclick="DashboardPage.openLicenciaModal()">
                            🪪 Ver mi Licencia Digital ✓
                        </button>`}
                    </div>
                </div>
            </section>

            <!-- PROGRESO -->
            <div class="glass-card p-5">
                <div class="flex-between mb-3">
                    <div style="display:flex;align-items:center;gap:10px">
                        <div style="width:40px;height:40px;border-radius:var(--radius-md);background:var(--primary-soft);display:flex;align-items:center;justify-content:center;font-size:1.2rem;color:var(--primary)">${Icons.id}</div>
                        <div>
                            <div class="font-bold text-sm">Tu progreso (${isRenovacion ? 'Renovación' : 'Licencia Nueva'})</div>
                            <div class="text-xs text-muted">${data.pasos.filter(p => p.status === 'completed').length} de ${data.pasos.length} pasos completados</div>
                        </div>
                    </div>
                    <span style="font-size:1.25rem;font-weight:800;color:var(--primary)">${data.progreso_porcentaje}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-bar__fill" style="width:${data.progreso_porcentaje}%"></div>
                </div>
            </div>

            <!-- ACCESO RÁPIDO (Adaptado según Trámite) -->
            <section>
                <h2 class="section-title mb-3">Acceso rápido</h2>
                <div class="quick-grid">
                    ${!isRenovacion ? `
                    <button class="quick-action" onclick="Router.navigate('charlas')">
                        <div class="quick-action__icon" style="background:var(--primary-soft);color:var(--primary)">${Icons.video}</div>
                        <span class="quick-action__label">Charlas</span>
                    </button>` : ''}
                    <button class="quick-action" onclick="Router.navigate('formularios')">
                        <div class="quick-action__icon" style="background:var(--accent-light);color:var(--accent)">${Icons.heart}</div>
                        <span class="quick-action__label">Salud</span>
                    </button>
                    ${!isRenovacion ? `
                    <button class="quick-action" onclick="Router.navigate('examen')">
                        <div class="quick-action__icon" style="background:var(--primary-soft);color:var(--primary)">${Icons.edit}</div>
                        <span class="quick-action__label">Examen</span>
                    </button>` : ''}
                    <button class="quick-action" onclick="Router.navigate('pago')">
                        <div class="quick-action__icon" style="background:var(--accent-light);color:var(--accent)">${Icons.card}</div>
                        <span class="quick-action__label">Pagar</span>
                    </button>
                    ${!isRenovacion ? `
                    <button class="quick-action" onclick="Router.navigate('practico')">
                        <div class="quick-action__icon" style="background:var(--primary-soft);color:var(--primary)">${Icons.car}</div>
                        <span class="quick-action__label">Práctico</span>
                    </button>` : ''}
                </div>
            </section>

            <!-- APARTADO DE MI LICENCIA DIGITAL EN DASHBOARD (SOLO SI TIENE LICENCIA/TRAMITE 100% O RENOVACIÓN) -->
            ${(licencia || isCompletado) ? `
            <section class="glass-card p-6" id="licenciaSection" style="border-left: 4px solid var(--success)">
                <div class="flex-between mb-4">
                    <div>
                        <h2 class="font-bold text-base mb-1" style="display:flex;align-items:center;gap:8px">
                            🪪 Mi Licencia Digital (Mi Argentina)
                        </h2>
                        <p class="text-xs text-muted">Licencia de conducir emitida · Hacé click para girarla (Frente / Dorso)</p>
                    </div>
                    <span class="licencia-badge">✓ VIGENTE · PBA</span>
                </div>

                <div class="licencia-wrapper">
                    <div class="licencia-card-3d" id="digitalCard" onclick="this.classList.toggle('flipped')">
                        <!-- FRENTE -->
                        <div class="licencia-card__front">
                            <div class="licencia-header">
                                <div class="licencia-header__title">
                                    <span class="licencia-header__country">REPÚBLICA ARGENTINA · PROV. BS. AS.</span>
                                    <span class="licencia-header__sub">LICENCIA NACIONAL DE CONDUCIR</span>
                                </div>
                                <span class="licencia-badge">VIGENTE</span>
                            </div>

                            <div class="licencia-body">
                                <div class="licencia-photo">👤</div>
                                <div class="licencia-details">
                                    <div class="licencia-label">Apellido y Nombre</div>
                                    <div class="licencia-val">${citizen.apellido || ''}, ${citizen.nombre || ''}</div>
                                    <div class="grid-2 mt-1">
                                        <div>
                                            <div class="licencia-label">DNI / N° Licencia</div>
                                            <div class="licencia-val">${citizen.dni || ''}</div>
                                        </div>
                                        <div>
                                            <div class="licencia-label">Edad / Clase</div>
                                            <div class="licencia-val">${citizen.edad || '--'} años · B1</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="licencia-footer">
                                <div>
                                    <div class="licencia-label">Emisión</div>
                                    <div class="font-bold">${licencia?.fecha_emision || '2026-08-06'}</div>
                                </div>
                                <div>
                                    <div class="licencia-label">Vencimiento</div>
                                    <div class="font-bold" style="color:#fef08a">${licencia?.fecha_vencimiento || '2031-08-06'}</div>
                                </div>
                                <div class="licencia-qr" title="Código de validación provincial">📱</div>
                            </div>
                        </div>

                        <!-- DORSO -->
                        <div class="licencia-card__back">
                            <div class="licencia-header">
                                <span class="licencia-header__country">DATOS COMPLEMENTARIOS Y MÉDICOS</span>
                                <span style="font-size:0.7rem;color:#93c5fd">BARADERO (PBA)</span>
                            </div>
                            <div style="font-size:0.8rem;line-height:1.5;display:flex;flex-direction:column;gap:6px">
                                <div><strong style="color:#93c5fd">Jurisdicción:</strong> Provincia de Buenos Aires</div>
                                <div><strong style="color:#93c5fd">Grupo Sanguíneo:</strong> O+</div>
                                <div><strong style="color:#93c5fd">Donante de Órganos:</strong> Sí (Ley 27.447)</div>
                                <div><strong style="color:#93c5fd">Apto Médico:</strong> Verificado sin restricciones.</div>
                            </div>
                            <div class="licencia-footer" style="border-top:1px dashed rgba(255,255,255,0.3)">
                                <div>
                                    <div class="licencia-label">Firma Autoridad Baradero</div>
                                    <div style="font-family:cursive;font-size:0.9rem;color:#7dd3fc">Intendencia Baradero</div>
                                </div>
                                <span class="text-xs" style="color:rgba(255,255,255,0.7)">Click para voltear ↺</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>` : ''}

            <!-- PASOS DEL TRÁMITE -->
            <section>
                <div class="flex-between mb-3">
                    <h2 class="section-title">Pasos del trámite</h2>
                    <span class="text-xs text-muted">${isRenovacion ? '⚡ Renovación: Salud + Pago' : 'Completá cada paso en orden'}</span>
                </div>
                <div class="grid-steps">
                    ${data.pasos.map((paso, i) => `
                    <div class="step-card step-card--${paso.status}" 
                         onclick="${paso.status !== 'locked' ? `Router.navigate('${paso.id}')` : 'Toast.warning(\"Debés completar los pasos anteriores primero\")'}"
                         style="animation-delay:${i * 0.05}s">
                        <div class="step-card__icon">${stepIcons[paso.id] || Icons.file}</div>
                        <div class="step-card__content">
                            <div class="step-card__step-label">Paso ${i + 1}</div>
                            <div class="step-card__title">${paso.title}</div>
                            <div class="step-card__desc">${paso.description}</div>
                        </div>
                        <div class="step-card__status">
                            <span>${statusIcons[paso.status]}</span>
                            ${paso.status !== 'locked' ? '<span style="color:var(--text-muted)">›</span>' : ''}
                        </div>
                    </div>`).join('')}
                </div>
            </section>
        </div>

        <!-- BOTÓN FLOTANTE (FAB) PARA VER LICENCIA -->
        <button class="fab-licencia animate-slideUp" onclick="DashboardPage.openLicenciaModal()" title="Ver mi Licencia Digital">
            <span style="font-size:1.2rem">🪪</span>
            <span>Mi Licencia</span>
        </button>

        <!-- MODAL DE LICENCIA DIGITAL -->
        <div class="modal-overlay" id="licenciaModal" onclick="DashboardPage.closeLicenciaModal()">
            <div class="modal p-6" style="max-width:500px;position:relative" onclick="event.stopPropagation()">
                <div class="flex-between mb-4">
                    <h3 class="font-bold text-base" style="display:flex;align-items:center;gap:6px">
                        <span>🪪</span> Licencia Digital Mi Argentina
                    </h3>
                    <button class="btn btn-ghost btn-sm" type="button" onclick="DashboardPage.closeLicenciaModal()" style="font-size:1.2rem;padding:4px 10px;cursor:pointer">✕</button>
                </div>

                <div class="licencia-wrapper mb-4">
                    <div class="licencia-card-3d" onclick="this.classList.toggle('flipped')">
                        <div class="licencia-card__front">
                            <div class="licencia-header">
                                <div class="licencia-header__title">
                                    <span class="licencia-header__country">REPÚBLICA ARGENTINA · PROV. BS. AS.</span>
                                    <span class="licencia-header__sub">LICENCIA NACIONAL DE CONDUCIR</span>
                                </div>
                                <span class="licencia-badge">VIGENTE</span>
                            </div>
                            <div class="licencia-body">
                                <div class="licencia-photo">👤</div>
                                <div class="licencia-details">
                                    <div class="licencia-label">Titular</div>
                                    <div class="licencia-val">${citizen.apellido || ''}, ${citizen.nombre || ''}</div>
                                    <div class="grid-2 mt-1">
                                        <div>
                                            <div class="licencia-label">DNI / N° Licencia</div>
                                            <div class="licencia-val">${citizen.dni || ''}</div>
                                        </div>
                                        <div>
                                            <div class="licencia-label">Edad / Clase</div>
                                            <div class="licencia-val">${citizen.edad || '--'} años · B1</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="licencia-footer">
                                <div><div class="licencia-label">Emisión</div><div class="font-bold">${licencia?.fecha_emision || '2026-08-06'}</div></div>
                                <div><div class="licencia-label">Vencimiento</div><div class="font-bold" style="color:#fef08a">${licencia?.fecha_vencimiento || '2031-08-06'}</div></div>
                                <div class="licencia-qr">📱</div>
                            </div>
                        </div>
                        <div class="licencia-card__back">
                            <div class="licencia-header">
                                <span class="licencia-header__country">DATOS COMPLEMENTARIOS</span>
                                <span style="font-size:0.7rem;color:#93c5fd">BARADERO</span>
                            </div>
                            <div style="font-size:0.8rem;line-height:1.5">
                                <div><strong>Jurisdicción:</strong> Prov. de Buenos Aires</div>
                                <div><strong>Donante:</strong> Sí</div>
                                <div><strong>Observaciones:</strong> Habilitado sin restricciones.</div>
                            </div>
                            <div class="licencia-footer">
                                <span class="text-xs" style="color:rgba(255,255,255,0.7)">Click para girar ↺</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="text-center">
                    <button class="btn btn-outline btn-block" type="button" onclick="DashboardPage.closeLicenciaModal()">Cerrar</button>
                </div>
            </div>
        </div>`;

        if (window.Tutorial) {
            setTimeout(() => window.Tutorial.startTutorialWithContext('dashboard'), 300);
        }
    }

    static openLicenciaModal() {
        const data = this.currentData || {};
        const isCompletado = data.progreso_porcentaje === 100 || data.estado === 'completado' || data.paso_actual === 'finalizado';
        const isRenovacion = data.tipo === 'renovacion';

        if (!data.licencia && !isCompletado && !isRenovacion) {
            Toast.warning(`Tu trámite está al ${data.progreso_porcentaje || 0}%. La Licencia Digital se habilitará al completar el 100% de los pasos.`);
            return;
        }

        // Resetear giros 3D para que siempre abra mostrando el frente
        document.querySelectorAll('.licencia-card-3d').forEach(card => card.classList.remove('flipped'));

        const modal = document.getElementById('licenciaModal');
        if (modal) {
            modal.classList.add('active');
        } else {
            const section = document.getElementById('licenciaSection');
            if (section) section.scrollIntoView({ behavior: 'smooth' });
        }
    }

    static closeLicenciaModal() {
        document.querySelectorAll('.licencia-card-3d').forEach(card => card.classList.remove('flipped'));
        const modal = document.getElementById('licenciaModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }
}
