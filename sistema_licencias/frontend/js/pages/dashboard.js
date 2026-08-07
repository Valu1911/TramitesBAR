/**
 * Dashboard - Panel principal del usuario con elección de trámite y progreso específico
 */
class DashboardPage {
    static async render(app) {
        const user = ApiService.getUsuario();
        
        app.innerHTML = `
        ${renderNavbar(user)}
        <div class="page-content">
            <div class="text-center" style="padding:60px 0">
                <div class="spinner" style="margin:0 auto"></div>
                <p class="text-muted mt-3">Cargando tu información...</p>
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
        const tramiteSeleccionado = localStorage.getItem('tramite_activo_seleccionado') || null;
        const isRenovacion = data.tipo === 'renovacion';
        const isCompletado = data.progreso_porcentaje === 100 || data.estado === 'completado' || data.paso_actual === 'finalizado';
        const licencia = data.licencia;

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
                        Baradero · Portal de Ciudadano
                    </div>
                    <h1 class="hero__title">
                        Bienvenido/a, <span>${citizen.nombre || 'Ciudadano'}</span>
                    </h1>
                    <p class="hero__subtitle">
                        Gestioná todos tus trámites de licencia de conducir en un solo lugar de forma simple y digital.
                    </p>
                </div>
            </section>

            <!-- PANEL DE DATOS PERSONALES DEL CIUDADANO -->
            <section class="glass-card p-6" style="border-left: 4px solid var(--primary)">
                <div class="flex-between mb-4">
                    <div style="display:flex;align-items:center;gap:12px">
                        <div style="width:48px;height:48px;border-radius:50%;background:var(--primary-soft);display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:var(--primary)">
                            ${Icons.user}
                        </div>
                        <div>
                            <h2 class="font-bold text-lg mb-0">${citizen.nombre || ''} ${citizen.apellido || ''}</h2>
                            <p class="text-xs text-muted">DNI ${citizen.dni || ''} · ${citizen.edad || '--'} años</p>
                        </div>
                    </div>

                    <!-- BADGE CUD -->
                    <div style="text-align:right">
                        ${citizen.tiene_cud ? `
                        <span class="badge badge-success" style="padding:6px 12px;font-size:0.8rem;display:inline-flex;align-items:center;gap:6px;background:#dcfce7;color:#15803d;border:1px solid #86efac">
                            ${Icons.wheelchair} Posee CUD ${citizen.numero_cud ? 'N° ' + citizen.numero_cud : ''} (Atención Prioritaria)
                        </span>` : `
                        <span class="badge" style="padding:6px 12px;font-size:0.8rem;display:inline-flex;align-items:center;gap:6px;background:var(--bg);color:var(--text-muted);border:1px solid var(--border)">
                            Sin CUD registrado
                        </span>`}
                        <div class="mt-1">
                            <button class="btn btn-ghost btn-sm text-xs" style="display:inline-flex;align-items:center;gap:4px" onclick="DashboardPage.toggleCudModal(${citizen.tiene_cud ? 1 : 0})">
                                ${Icons.edit} Cambiar estado CUD
                            </button>
                        </div>
                    </div>
                </div>

                <div class="grid-3" style="font-size:0.85rem;gap:16px;background:rgba(255,255,255,0.05);padding:14px;border-radius:var(--radius-md)">
                    <div><strong class="text-muted">Fecha Nacimiento:</strong> ${citizen.fecha_nacimiento || '--'}</div>
                    <div><strong class="text-muted">Email:</strong> ${citizen.email || 'No registrado'}</div>
                    <div><strong class="text-muted">Teléfono:</strong> ${citizen.telefono || 'No registrado'}</div>
                    <div><strong class="text-muted">Dirección:</strong> ${citizen.direccion || 'Baradero'}</div>
                    <div><strong class="text-muted">Trámites Realizados:</strong> 1 activo</div>
                    <div><strong class="text-muted">Estado General:</strong> En Regla</div>
                </div>
            </section>

            <!-- SECCIÓN: SELECCIÓN DE TRÁMITES -->
            <section class="glass-card p-6">
                <div class="mb-4">
                    <h2 class="section-title mb-1" style="display:flex;align-items:center;gap:8px">
                        <span style="color:var(--primary);display:flex;align-items:center">${Icons.doc}</span> Elegir mi Trámite
                    </h2>
                    <p class="text-xs text-muted">Seleccioná un botón para activar el trámite correspondiente y visualizar sus pasos específicos:</p>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:14px">
                    <button class="tramite-card-btn ${tramiteSeleccionado === 'nueva' ? 'tramite-card-btn--active' : ''}" 
                            onclick="DashboardPage.seleccionarTramite('nueva')">
                        <div style="font-size:1.5rem;margin-bottom:6px;color:var(--primary);display:flex;justify-content:center">${Icons.car}</div>
                        <strong style="font-size:0.95rem;margin-bottom:4px">Licencia Nueva</strong>
                        <span class="text-xs ${tramiteSeleccionado === 'nueva' ? '' : 'text-muted'}">Primera vez · Examen teórico, práctico y biometría.</span>
                        ${tramiteSeleccionado === 'nueva' ? `<span class="badge mt-2" style="background:rgba(255,255,255,0.25);display:inline-flex;align-items:center;gap:4px">${Icons.check} En curso</span>` : ''}
                    </button>

                    <button class="tramite-card-btn ${tramiteSeleccionado === 'renovacion' ? 'tramite-card-btn--active' : ''}" 
                            onclick="DashboardPage.seleccionarTramite('renovacion')">
                        <div style="font-size:1.5rem;margin-bottom:6px;color:var(--primary);display:flex;justify-content:center">${Icons.sparkles}</div>
                        <strong style="font-size:0.95rem;margin-bottom:4px">Renovar Licencia</strong>
                        <span class="text-xs ${tramiteSeleccionado === 'renovacion' ? '' : 'text-muted'}">Renovación directa online · Salud + Pago del arancel.</span>
                        ${tramiteSeleccionado === 'renovacion' ? `<span class="badge mt-2" style="background:rgba(255,255,255,0.25);display:inline-flex;align-items:center;gap:4px">${Icons.check} En curso</span>` : ''}
                    </button>

                    <button class="tramite-card-btn ${tramiteSeleccionado === 'vencida' ? 'tramite-card-btn--active' : ''}" 
                            onclick="DashboardPage.seleccionarTramite('vencida')">
                        <div style="font-size:1.5rem;margin-bottom:6px;color:var(--warning);display:flex;justify-content:center">${Icons.clock}</div>
                        <strong style="font-size:0.95rem;margin-bottom:4px">Licencia Vencida</strong>
                        <span class="text-xs ${tramiteSeleccionado === 'vencida' ? '' : 'text-muted'}">Fuera de término (+90 días) · Requiere re-examen.</span>
                        ${tramiteSeleccionado === 'vencida' ? `<span class="badge mt-2" style="background:rgba(255,255,255,0.25);display:inline-flex;align-items:center;gap:4px">${Icons.check} En curso</span>` : ''}
                    </button>

                    <button class="tramite-card-btn ${tramiteSeleccionado === 'categoria' ? 'tramite-card-btn--active' : ''}" 
                            onclick="DashboardPage.seleccionarTramite('categoria')">
                        <div style="font-size:1.5rem;margin-bottom:6px;color:var(--primary);display:flex;justify-content:center">${Icons.shield}</div>
                        <strong style="font-size:0.95rem;margin-bottom:4px">Subir de Categoría</strong>
                        <span class="text-xs ${tramiteSeleccionado === 'categoria' ? '' : 'text-muted'}">Ampliación de licencia · Agregar auto/moto.</span>
                        ${tramiteSeleccionado === 'categoria' ? `<span class="badge mt-2" style="background:rgba(255,255,255,0.25);display:inline-flex;align-items:center;gap:4px">${Icons.check} En curso</span>` : ''}
                    </button>

                    <button class="tramite-card-btn ${tramiteSeleccionado === 'profesional' ? 'tramite-card-btn--active' : ''}" 
                            onclick="DashboardPage.seleccionarTramite('profesional')">
                        <div style="font-size:1.5rem;margin-bottom:6px;color:var(--primary);display:flex;justify-content:center">${Icons.truck}</div>
                        <strong style="font-size:0.95rem;margin-bottom:4px">Licencia Profesional</strong>
                        <span class="text-xs ${tramiteSeleccionado === 'profesional' ? '' : 'text-muted'}">Categorías C, D y E · Camiones, taxis, colectivos.</span>
                        ${tramiteSeleccionado === 'profesional' ? `<span class="badge mt-2" style="background:rgba(255,255,255,0.25);display:inline-flex;align-items:center;gap:4px">${Icons.check} En curso</span>` : ''}
                    </button>

                    <button class="tramite-card-btn ${tramiteSeleccionado === 'extravio' ? 'tramite-card-btn--active' : ''}" 
                            onclick="DashboardPage.seleccionarTramite('extravio')">
                        <div style="font-size:1.5rem;margin-bottom:6px;color:var(--accent);display:flex;justify-content:center">${Icons.box}</div>
                        <strong style="font-size:0.95rem;margin-bottom:4px">Extravío o Robo</strong>
                        <span class="text-xs ${tramiteSeleccionado === 'extravio' ? '' : 'text-muted'}">Duplicado por pérdida/robo · Trámite ágil Salud + Pago.</span>
                        ${tramiteSeleccionado === 'extravio' ? `<span class="badge mt-2" style="background:rgba(255,255,255,0.25);display:inline-flex;align-items:center;gap:4px">${Icons.check} En curso</span>` : ''}
                    </button>
                </div>
            </section>

            <!-- MOSTRAR PROGRESO Y PASOS ÚNICAMENTE SI SE SELECCIONÓ UN TRÁMITE PREVIAMENTE -->
            ${!tramiteSeleccionado ? `
            <div class="glass-card p-6 text-center" style="border: 2px dashed var(--primary-light,#93c5fd); background: rgba(37,99,235,0.03)">
                <div style="display:flex;justify-content:center;margin-bottom:8px;color:var(--primary);font-size:1.5rem">${Icons.id}</div>
                <h3 class="font-bold text-base mb-1">Seleccioná un Trámite para Comenzar</h3>
                <p class="text-xs text-muted mb-0">
                    Hacé clic en cualquiera de las 6 opciones superiores (<i>Licencia Nueva, Renovar Licencia, Licencia Vencida, Subir de Categoría, Licencia Profesional o Extravío/Robo</i>) para ver la barra de progreso específica y los pasos correspondientes a tu trámite.
                </p>
            </div>` : `
            
            <!-- PROGRESO DEL TRÁMITE SELECCIONADO -->
            <div class="glass-card p-5 animate-slideUp">
                <div class="flex-between mb-3">
                    <div style="display:flex;align-items:center;gap:10px">
                        <div style="width:40px;height:40px;border-radius:var(--radius-md);background:var(--primary-soft);display:flex;align-items:center;justify-content:center;font-size:1.2rem;color:var(--primary)">${Icons.id}</div>
                        <div>
                            <div class="font-bold text-sm">Progreso del Trámite Actual (${tramiteSeleccionado.toUpperCase()})</div>
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
            <section class="animate-slideUp">
                <h2 class="section-title mb-3">Acceso rápido a pasos</h2>
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

            <!-- PASOS DEL TRÁMITE -->
            <section class="animate-slideUp">
                <div class="flex-between mb-3">
                    <h2 class="section-title">Pasos del trámite (${tramiteSeleccionado.toUpperCase()})</h2>
                    <span class="text-xs text-muted">${isRenovacion ? 'Renovación: Salud + Pago' : 'Completá cada paso en orden'}</span>
                </div>
                <div class="grid-steps">
                    ${data.pasos.map((paso, i) => `
                    <div class="step-card step-card--${paso.status}" 
                         onclick="Router.navigate('${paso.id}')"
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
            </section>`}

            <!-- APARTADO DE MI LICENCIA DIGITAL EN DASHBOARD (SOLO SI EL PROGRESO ES EXACTAMENTE 100% Y EL ESTADO ES COMPLETADO) -->
            ${(data.progreso_porcentaje === 100 && data.estado === 'completado' && licencia && (licencia.numero_licencia || licencia.id)) ? `
            <section class="glass-card p-6" id="licenciaSection" style="border-left: 4px solid var(--success); margin-top: 48px !important">
                <div class="flex-between mb-4">
                    <div>
                        <h2 class="font-bold text-base mb-1" style="display:flex;align-items:center;gap:8px">
                            <span style="color:var(--primary);display:flex;align-items:center">${Icons.id}</span> Mi Licencia Digital (Mi Argentina)
                        </h2>
                        <p class="text-xs text-muted">Licencia de conducir emitida · Hacé click sobre la credencial para alternar Frente / Dorso</p>
                    </div>
                    <span class="licencia-badge" style="display:inline-flex;align-items:center;gap:4px">${Icons.check} VIGENTE · PBA</span>
                </div>

                <div style="max-width:460px;margin:0 auto;text-align:center">
                    <div style="position:relative;cursor:pointer;border-radius:16px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,0.3);border:2px solid var(--primary);transition:transform 0.2s ease" 
                         onclick="DashboardPage.toggleLicenciaImage()"
                         onmouseover="this.style.transform='scale(1.02)'"
                         onmouseout="this.style.transform='scale(1)'">
                        <img id="licenciaImgDisplay" src="./img/licencia_frente.png" 
                             style="width:100%;height:auto;max-height:285px;object-fit:cover;display:block;border-radius:14px" 
                             alt="Licencia Digital Mi Argentina">
                    </div>
                    <div id="licenciaSideLabel" class="text-xs text-muted mt-2 font-bold" style="color:var(--primary);display:inline-flex;align-items:center;gap:6px">
                        ${Icons.mapPin} Viendo: FRENTE DE LA LICENCIA (Datos personales y QR)
                    </div>
                </div>
            </section>` : ''}
        </div>`;

        const is100Pct = data.progreso_porcentaje === 100 && data.estado === 'completado' && licencia;
        if (is100Pct) {
            const tramiteKey = 'celebrated_' + (data.tramite_id || '1');
            if (!sessionStorage.getItem(tramiteKey)) {
                sessionStorage.setItem(tramiteKey, '1');
                setTimeout(() => {
                    if (window.Tutorial) {
                        window.Tutorial.startTutorialWithContext('licencia-completada', true);
                    }
                }, 400);
            }
        } else if (window.Tutorial) {
            setTimeout(() => window.Tutorial.startTutorialWithContext('dashboard'), 300);
        }
    }

    static toggleLicenciaImage() {
        const img = document.getElementById('licenciaImgDisplay');
        const label = document.getElementById('licenciaSideLabel');
        if (!img) return;

        if (img.src.includes('licencia_frente.png')) {
            img.src = './img/licencia_dorso.png';
            if (label) label.textContent = '📍 Viendo: DORSO DE LA LICENCIA (Datos médicos y firma)';
        } else {
            img.src = './img/licencia_frente.png';
            if (label) label.textContent = '📍 Viendo: FRENTE DE LA LICENCIA (Datos personales y QR)';
        }
    }

    static async seleccionarTramite(tipo) {
        const actual = localStorage.getItem('tramite_activo_seleccionado');
        
        // Si se hace clic en la misma opción activa, se des-selecciona para limpiar la pantalla
        if (actual === tipo) {
            localStorage.removeItem('tramite_activo_seleccionado');
            Toast.info('Trámite deseleccionado. Vista limpia.');
            DashboardPage.render(document.getElementById('app'));
            return;
        }

        const data = this.currentData || {};
        const licencia = data.licencia;
        const citizen = data.usuario || {};

        // VALIDACIÓN DE RENOVACIÓN DE LICENCIA
        if (tipo === 'renovacion') {
            if (!licencia || !licencia.fecha_vencimiento) {
                Toast.warning('ℹ️ No poseés una licencia previa registrada en el sistema para renovar. Podés iniciar tu primera "Licencia Nueva".');
                return;
            }
            const hoy = new Date();
            const venc = new Date(licencia.fecha_vencimiento);
            const diasRestantes = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
            if (diasRestantes > 30) {
                Toast.warning(`ℹ️ Tu licencia N° ${licencia.numero_licencia || citizen.dni} sigue vigente hasta el ${licencia.fecha_vencimiento} (le quedan ${diasRestantes} días). La renovación se habilita 30 días antes del vencimiento.`);
                return;
            }
        }

        // VALIDACIÓN DE LICENCIA VENCIDA
        if (tipo === 'vencida') {
            if (!licencia || !licencia.fecha_vencimiento) {
                Toast.warning('ℹ️ No registrás una licencia previa vencida. Seleccioná "Licencia Nueva" para sacar tu primera licencia.');
                return;
            }
            const hoy = new Date();
            const venc = new Date(licencia.fecha_vencimiento);
            const diasRestantes = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
            if (diasRestantes > 0) {
                Toast.warning(`ℹ️ Tu licencia N° ${licencia.numero_licencia || citizen.dni} aún se encuentra vigente hasta el ${licencia.fecha_vencimiento}. El trámite de Licencia Vencida es únicamente para licencias expiradas.`);
                return;
            }
        }

        try {
            localStorage.setItem('tramite_activo_seleccionado', tipo);
            await ApiService.iniciarTramite(tipo);
            Toast.success(`¡Excelente! Seleccionaste el trámite: ${tipo.toUpperCase()}`);
            DashboardPage.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message || 'Error al seleccionar trámite');
        }
    }

    static async toggleCudModal(actualCud) {
        const nuevoCud = actualCud ? 0 : 1;
        try {
            await ApiService.actualizarCud(nuevoCud);
            Toast.success(`Estado CUD actualizado a: ${nuevoCud ? '♿ Con CUD (Atención Prioritaria)' : 'Sin CUD'}`);
            DashboardPage.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message || 'Error al actualizar CUD');
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

        document.querySelectorAll('.licencia-card-3d').forEach(card => card.classList.remove('flipped'));

        const modal = document.getElementById('licenciaModal');
        if (modal) {
            modal.classList.add('active');
        } else {
            const section = document.getElementById('licenciaSection');
            if (section) section.scrollIntoView({ behavior: 'smooth' });
        }
    }

    static toggleLicenciaSide() {
        const frontEl = document.getElementById('licenciaFront');
        const backEl = document.getElementById('licenciaBack');
        if (!frontEl || !backEl) return;

        if (frontEl.style.display === 'none') {
            backEl.style.display = 'none';
            frontEl.style.display = 'flex';
            Toast.info('🔄 Mostrando FRENTE de la licencia (Datos personales y QR)');
        } else {
            frontEl.style.display = 'none';
            backEl.style.display = 'flex';
            Toast.info('🔄 Mostrando DORSO de la licencia (Datos médicos y firma)');
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
