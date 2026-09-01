/**
 * Dashboard - Panel principal del usuario con elección de trámite, progreso específico,
 * verificación de cuenta e infracciones, pantalla de multas e inbox.
 */
class DashboardPage {
    static selectedFileData = null;
    static selectedFileName = null;

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
        this.currentData = data;
        const estadoCuenta = citizen.estado_cuenta || data.estado_cuenta || 'pendiente';

        // ============================================================
        // CASO 1: CUENTA EN PROCESO DE VERIFICACIÓN (BLOQUEADO)
        // ============================================================
        if (estadoCuenta === 'pendiente') {
            app.innerHTML = `
            ${renderNavbar(citizen)}
            <div class="page-content container-md animate-fadeIn" style="padding-top:40px">
                <div class="glass-card p-8 text-center" style="border:2px solid #f59e0b;background:rgba(245,158,11,0.03);box-shadow:var(--shadow-lg);border-radius:var(--radius-lg)">
                    <div style="width:80px;height:80px;border-radius:50%;background:#fef3c7;color:#d97706;display:flex;align-items:center;justify-content:center;font-size:2.4rem;margin:0 auto 20px auto;border:2px solid #fde68a">
                        ${Icons.clock}
                    </div>
                    <div class="badge badge-warning mb-3" style="font-size:0.85rem;padding:6px 14px">
                        Estado: En Verificación Inicial
                    </div>
                    <h1 class="font-bold text-2xl mb-3" style="color:var(--text)">Tu cuenta está en proceso de verificación</h1>
                    <p class="text-muted mb-6" style="max-width:560px;margin:0 auto;line-height:1.6;font-size:1rem">
                        Serás avisado cuando la misma esté activa. Nuestro equipo de Tránsito e Infracciones está revisando tus antecedentes e identidad en las bases oficiales. Mientras tanto, el acceso a los trámites permanece temporalmente reservado.
                    </p>

                    <div style="background:var(--bg-card);padding:14px 20px;border-radius:var(--radius-md);max-width:480px;margin:0 auto 24px auto;border:1px solid var(--border);text-align:left;font-size:0.85rem">
                        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                            <span class="text-muted">Titular:</span> <strong>${citizen.nombre || ''} ${citizen.apellido || ''}</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                            <span class="text-muted">DNI:</span> <strong>${citizen.dni || ''}</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between">
                            <span class="text-muted">Fecha de Solicitud:</span> <span>${citizen.created_at || 'Hoy'}</span>
                        </div>
                    </div>

                    <div style="display:flex;justify-content:center;gap:14px;flex-wrap:wrap">
                        <button class="btn btn-primary btn-lg" onclick="DashboardPage.render(document.getElementById('app'))" style="display:inline-flex;align-items:center;gap:8px;font-weight:700">
                            ${Icons.refresh} Comprobar Estado de mi Cuenta
                        </button>
                        <button class="btn btn-ghost btn-lg" onclick="logout()">
                            ${Icons.logout} Cerrar Sesión
                        </button>
                    </div>
                </div>
            </div>
            <div id="citizenInboxModalContainer"></div>
            `;
            return;
        }

        // ============================================================
        // CASO 2: CUENTA CON MULTAS PENDIENTES (ALERTA Y YA PAGUÉ)
        // ============================================================
        if (estadoCuenta === 'rechazada_multas') {
            const multasCant = citizen.multas_cantidad || data.multas_cantidad || 1;
            const multasMonto = citizen.multas_monto || data.multas_monto || 0;
            const multasMotivo = citizen.multas_motivo || data.multas_motivo || 'Infracciones de tránsito pendientes detectadas en Registro Oficial.';
            const notificado = citizen.infracciones_pagadas_solicitadas || data.infracciones_pagadas_solicitadas;

            app.innerHTML = `
            ${renderNavbar(citizen)}
            <div class="page-content container-md animate-fadeIn" style="padding-top:30px">
                <div class="glass-card p-8" style="border:2px solid var(--danger,#ef4444);background:rgba(239,68,68,0.02);box-shadow:var(--shadow-lg);border-radius:var(--radius-lg)">
                    
                    <div class="flex-between mb-4" style="flex-wrap:wrap;gap:12px;border-bottom:1px solid var(--border);padding-bottom:16px">
                        <div style="display:flex;align-items:center;gap:14px">
                            <div style="width:60px;height:60px;border-radius:50%;background:#fee2e2;color:#dc2626;display:flex;align-items:center;justify-content:center;font-size:1.8rem">
                                ${Icons.alert}
                            </div>
                            <div>
                                <h1 class="font-bold text-2xl mb-1" style="color:var(--danger,#ef4444)">Tienes Multas Pendientes</h1>
                                <p class="text-sm text-muted mb-0">Se detectaron infracciones impagas asociadas a tu DNI <strong>${citizen.dni}</strong></p>
                            </div>
                        </div>
                        <span class="badge badge-danger" style="font-size:0.9rem;padding:8px 14px;font-weight:bold">
                            ${multasCant} Infracción(es) Registrada(s)
                        </span>
                    </div>

                    <!-- DETALLES DE LAS MULTAS -->
                    <div class="grid-2 mb-6" style="gap:16px">
                        <div style="background:var(--bg-card);padding:18px;border-radius:var(--radius-md);border:1px solid var(--border)">
                            <div class="text-xs text-muted font-bold uppercase mb-1">Monto Total a Regularizar</div>
                            <div style="font-size:2.2rem;font-weight:900;color:var(--danger,#ef4444)">
                                $${Number(multasMonto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </div>
                            <div class="text-xs text-muted mt-1">Valor fijado por el Juzgado de Faltas / Registro de Seguridad Vial</div>
                        </div>
                        
                        <div style="background:var(--bg-card);padding:18px;border-radius:var(--radius-md);border:1px solid var(--border)">
                            <div class="text-xs text-muted font-bold uppercase mb-1">Motivo / Detalle Oficial</div>
                            <div style="font-size:0.95rem;line-height:1.5;color:var(--text)">
                                ${multasMotivo}
                            </div>
                        </div>
                    </div>

                    ${notificado ? `
                    <div style="background:#fef3c7;border:1px solid #f59e0b;padding:14px 18px;border-radius:var(--radius-md);margin-bottom:20px;color:#92400e;display:flex;align-items:center;gap:12px">
                        <span style="font-size:1.5rem">🔔</span>
                        <div>
                            <strong>¡Notificación enviada!</strong> Tu comprobante y mensaje están siendo revisados por el oficial de cuentas. Te responderá a la brevedad en el Inbox.
                        </div>
                    </div>` : ''}

                    <!-- ACCIONES DEL CIUDADANO -->
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px">
                        <button class="btn btn-ghost" onclick="DashboardPage.abrirInboxCiudadano(false)" style="display:inline-flex;align-items:center;gap:6px">
                            ${Icons.chat} Ver Mensajes / Inbox con el Municipio
                        </button>
                        
                        <button class="btn btn-success btn-lg" onclick="DashboardPage.abrirInboxCiudadano(true)" style="display:inline-flex;align-items:center;gap:8px;background:var(--success,#10b981);color:#fff;font-weight:800;padding:12px 24px">
                            ${Icons.check} ¡Ya Pagué! Adjuntar Comprobante →
                        </button>
                    </div>
                </div>
            </div>
            <div id="citizenInboxModalContainer"></div>
            `;
            return;
        }

        // ============================================================
        // CASO 3: CUENTA APROBADA - DASHBOARD COMPLETO DE TRÁMITES
        // ============================================================
        const tramiteSeleccionado = localStorage.getItem('tramite_activo_seleccionado') || null;
        const isRenovacion = data.tipo === 'renovacion';
        const isCompletado = data.progreso_porcentaje === 100 || data.estado === 'completado' || data.paso_actual === 'finalizado';
        const licencia = data.licencia;

        // Saludo de bienvenida con Tramibot si es la primera vez que ingresa aprobada
        if (citizen.bienvenida_mostrada === 0 || data.bienvenida_mostrada === 0) {
            setTimeout(() => {
                if (window.Tutorial && window.Tutorial.showApprovalGreeting) {
                    window.Tutorial.showApprovalGreeting(citizen.nombre);
                    ApiService.marcarBienvenidaVista();
                }
            }, 400);
        }

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
                    <div style="display:flex;align-items:center;gap:14px">
                        <div style="width:58px;height:58px;border-radius:50%;border:2.5px solid var(--primary);overflow:hidden;background:var(--primary-soft);display:flex;align-items:center;justify-content:center;font-size:1.6rem;color:var(--primary);flex-shrink:0;box-shadow:0 3px 12px rgba(37,99,235,0.25);">
                            ${citizen.foto_rostro ? `<img src="${citizen.foto_rostro}" alt="Foto DNI" style="width:100%;height:100%;object-fit:cover;">` : Icons.user}
                        </div>
                        <div>
                            <h2 class="font-bold text-lg mb-0">${citizen.nombre || ''} ${citizen.apellido || ''}</h2>
                            <p class="text-xs text-muted">DNI ${citizen.dni || ''} · ${citizen.edad || '--'} años</p>
                        </div>
                    </div>

                    <!-- BADGES Y ESTADO -->
                    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
                        <span class="badge badge-success" style="padding:6px 12px;font-size:0.8rem;display:inline-flex;align-items:center;gap:6px">
                            ${Icons.check} Cuenta Verificada y Aprobada
                        </span>
                        ${citizen.tiene_cud ? `
                        <span class="badge badge-success" style="padding:4px 10px;font-size:0.75rem;display:inline-flex;align-items:center;gap:6px;background:#dcfce7;color:#15803d;border:1px solid #86efac">
                            ${Icons.wheelchair} CUD N° ${citizen.numero_cud || ''} (Prioridad)
                        </span>` : ''}
                    </div>
                </div>

                <div class="grid-3" style="font-size:0.85rem;gap:16px;background:rgba(255,255,255,0.05);padding:14px;border-radius:var(--radius-md)">
                    <div><strong class="text-muted">Fecha Nacimiento:</strong> ${citizen.fecha_nacimiento || '--'}</div>
                    <div><strong class="text-muted">Email:</strong> ${citizen.email || 'No registrado'}</div>
                    <div><strong class="text-muted">Teléfono:</strong> ${citizen.telefono || 'No registrado'}</div>
                    <div><strong class="text-muted">Dirección:</strong> ${citizen.direccion || 'Baradero'}</div>
                    <div><strong class="text-muted">Infracciones:</strong> <span style="color:var(--success);font-weight:700">Libre de Deuda</span></div>
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
                    Hacé clic en cualquiera de las opciones superiores para ver la barra de progreso y los pasos correspondientes.
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
                        <div class="step-card__icon">${paso.status === 'completed' ? Icons.check : paso.status === 'current' ? Icons.clock : Icons.lock}</div>
                        <div class="step-card__content">
                            <h3 class="step-card__title">${paso.title}</h3>
                            <p class="step-card__desc">${paso.description}</p>
                        </div>
                        <div class="step-card__status">
                            <span class="badge ${paso.status === 'completed' ? 'badge-success' : paso.status === 'current' ? 'badge-warning' : 'badge-muted'}">
                                ${paso.status === 'completed' ? 'Completado' : paso.status === 'current' ? 'En curso' : 'Bloqueado'}
                            </span>
                        </div>
                    </div>`).join('')}
                </div>
            </section>`}

            <!-- SECCIÓN LICENCIA DIGITAL (SI ESTÁ EMITIDA) -->
            ${licencia ? `
            <section id="licenciaSection" class="glass-card p-6 text-center animate-slideUp" style="border:2px solid var(--success);background:rgba(16,185,129,0.04)">
                <div style="font-size:2rem;color:var(--success);margin-bottom:8px">🎉</div>
                <h2 class="font-bold text-xl mb-2">¡Tu Licencia Digital ya fue emitida!</h2>
                <p class="text-sm text-muted mb-4">Podés verla y descargarla en cualquier momento desde aquí.</p>
                <button class="btn btn-success btn-lg" onclick="DashboardPage.openLicenciaModal()" style="display:inline-flex;align-items:center;gap:8px">
                    ${Icons.id} Ver Licencia Digital
                </button>
            </section>` : ''}
        </div>

        <div id="citizenInboxModalContainer"></div>
        `;
    }

    /**
     * Abre el modal del Inbox para el ciudadano (chat con el área de tránsito)
     */
    static async abrirInboxCiudadano(esNotificacionPago = false) {
        const container = document.getElementById('citizenInboxModalContainer');
        if (!container) return;

        container.innerHTML = `
        <div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)">
            <div class="modal-content glass-card p-6" style="max-width:640px;width:100%;max-height:90vh;display:flex;flex-direction:column;border:2px solid var(--primary)">
                <div class="text-center" style="padding:40px 0">
                    <div class="spinner" style="margin:0 auto"></div>
                    <p class="text-muted mt-3">Cargando mensajes del municipio...</p>
                </div>
            </div>
        </div>`;

        try {
            const data = await ApiService.getInboxMensajes();
            const mensajes = data.mensajes || [];
            const user = ApiService.getUsuario() || {};

            container.innerHTML = `
            <div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)">
                <div class="modal-content glass-card" style="max-width:680px;width:100%;max-height:92vh;display:flex;flex-direction:column;border:2px solid var(--primary);box-shadow:var(--shadow-lg)">
                    
                    <!-- HEADER INBOX -->
                    <div class="flex-between p-4" style="background:var(--bg-card);border-bottom:1px solid var(--border);border-top-left-radius:var(--radius-md);border-top-right-radius:var(--radius-md)">
                        <div style="display:flex;align-items:center;gap:10px">
                            <div style="width:40px;height:40px;border-radius:50%;background:var(--primary-soft);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:1.2rem">
                                ${Icons.chat}
                            </div>
                            <div>
                                <h3 class="font-bold text-base mb-0">Mensajería con Tránsito & Infracciones</h3>
                                <p class="text-xs text-muted mb-0">Canal directo para notificar pagos y consultas</p>
                            </div>
                        </div>
                        <button class="btn btn-ghost btn-sm" onclick="DashboardPage.cerrarInbox()">×</button>
                    </div>

                    <!-- CUERPO DE MENSAJES -->
                    <div id="citizenMessagesBody" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;max-height:360px;background:var(--bg)">
                        ${mensajes.length === 0 ? `
                        <div class="empty-state" style="padding:30px 0">
                            <p class="text-xs text-muted">Aún no hay mensajes. Podés escribir o adjuntar tu comprobante de pago abajo.</p>
                        </div>` : mensajes.map(m => `
                        <div style="max-width:82%;align-self:${m.emisor === 'usuario' ? 'flex-end' : 'flex-start'};background:${m.emisor === 'usuario' ? 'var(--primary)' : 'var(--bg-card)'};color:${m.emisor === 'usuario' ? '#fff' : 'inherit'};padding:10px 14px;border-radius:12px;box-shadow:var(--shadow-sm);border:1px solid ${m.emisor === 'usuario' ? 'transparent' : 'var(--border)'}">
                            <div style="font-size:0.7rem;opacity:0.8;margin-bottom:4px;font-weight:700">
                                ${m.emisor === 'usuario' ? 'Vos' : 'Oficial de Tránsito'} · ${m.created_at}
                            </div>
                            <div style="font-size:0.85rem;white-space:pre-wrap">${m.mensaje}</div>
                            ${m.adjunto_url ? `
                            <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.2)">
                                ${m.adjunto_url.startsWith('data:image') || m.adjunto_url.includes('.jpg') || m.adjunto_url.includes('.png') ? `
                                <a href="${m.adjunto_url}" target="_blank">
                                    <img src="${m.adjunto_url}" style="max-width:100%;max-height:140px;border-radius:6px;display:block;margin-top:4px" alt="Comprobante">
                                </a>` : `
                                <a href="${m.adjunto_url}" target="_blank" class="btn btn-ghost btn-sm" style="font-size:0.75rem;padding:3px 8px">
                                    ${Icons.paperclip} Ver adjunto (${m.adjunto_nombre || 'Comprobante'})
                                </a>`}
                            </div>` : ''}
                        </div>`).join('')}
                    </div>

                    <!-- FOOTER ENVÍO -->
                    <div class="p-4" style="background:var(--bg-card);border-top:1px solid var(--border);border-bottom-left-radius:var(--radius-md);border-bottom-right-radius:var(--radius-md)">
                        <div style="display:flex;flex-direction:column;gap:10px">
                            
                            <!-- ADJUNTO SELECCIONADO PREVIEW -->
                            <div id="citizenAttachmentPreview" style="display:none;background:var(--primary-soft);padding:6px 12px;border-radius:var(--radius-sm);font-size:0.8rem;color:var(--primary);align-items:center;justify-content:space-between">
                                <span id="citizenAttachmentName"></span>
                                <button type="button" class="btn btn-ghost btn-sm" style="padding:0 4px" onclick="DashboardPage.quitarAdjunto()">✕</button>
                            </div>

                            <div style="display:flex;gap:8px;align-items:center">
                                <label class="btn btn-ghost btn-sm" style="cursor:pointer" title="Adjuntar comprobante o foto">
                                    ${Icons.paperclip} Adjuntar Foto/PDF
                                    <input type="file" id="citizenFileInput" accept="image/*,application/pdf" style="display:none" onchange="DashboardPage.handleCitizenFileSelect(event)">
                                </label>
                                
                                <input type="text" id="citizenMsgInput" class="form-input" 
                                       placeholder="${esNotificacionPago ? 'Ej: Adjunto comprobante de pago de las multas...' : 'Escribir mensaje...'}" 
                                       value="${esNotificacionPago ? 'Ya realicé el pago de las multas pendientes. Adjunto comprobante para verificación.' : ''}"
                                       style="flex:1" onkeydown="if(event.key==='Enter') DashboardPage.enviarMensajeCiudadano(${esNotificacionPago})">

                                <button class="btn btn-primary btn-sm" onclick="DashboardPage.enviarMensajeCiudadano(${esNotificacionPago})" style="display:inline-flex;align-items:center;gap:6px;font-weight:700">
                                    ${Icons.send} Enviar
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>`;
        } catch (err) {
            Toast.error(err.message || 'Error al cargar mensajes');
            this.cerrarInbox();
        }
    }

    static handleCitizenFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            DashboardPage.selectedFileData = e.target.result;
            DashboardPage.selectedFileName = file.name;
            const prev = document.getElementById('citizenAttachmentPreview');
            const nameEl = document.getElementById('citizenAttachmentName');
            if (prev && nameEl) {
                nameEl.innerText = `📎 ${file.name}`;
                prev.style.display = 'flex';
            }
            Toast.info(`Comprobante ${file.name} seleccionado.`);
        };
        reader.readAsDataURL(file);
    }

    static quitarAdjunto() {
        DashboardPage.selectedFileData = null;
        DashboardPage.selectedFileName = null;
        const prev = document.getElementById('citizenAttachmentPreview');
        if (prev) prev.style.display = 'none';
        const fileInp = document.getElementById('citizenFileInput');
        if (fileInp) fileInp.value = '';
    }

    static async enviarMensajeCiudadano(esNotificacionPago = false) {
        const input = document.getElementById('citizenMsgInput');
        if (!input) return;

        const msg = input.value.trim();
        const fileData = DashboardPage.selectedFileData || null;
        const fileName = DashboardPage.selectedFileName || null;

        if (!msg && !fileData) {
            Toast.warning('Escribí un mensaje o adjuntá un comprobante');
            return;
        }

        try {
            if (esNotificacionPago) {
                await ApiService.notificarYaPague({
                    mensaje: msg,
                    adjunto_url: fileData,
                    adjunto_nombre: fileName
                });
                Toast.success('¡Comprobante y aviso de pago enviados al administrador con éxito!');
            } else {
                await ApiService.sendInboxMensaje({
                    mensaje: msg,
                    adjunto_url: fileData,
                    adjunto_nombre: fileName
                });
                Toast.success('Mensaje enviado');
            }

            DashboardPage.selectedFileData = null;
            DashboardPage.selectedFileName = null;
            this.cerrarInbox();
            DashboardPage.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message || 'Error al enviar');
        }
    }

    static cerrarInbox() {
        const container = document.getElementById('citizenInboxModalContainer');
        if (container) container.innerHTML = '';
        DashboardPage.selectedFileData = null;
        DashboardPage.selectedFileName = null;
    }

    static async seleccionarTramite(tipo) {
        const actual = localStorage.getItem('tramite_activo_seleccionado');
        if (actual === tipo) {
            localStorage.removeItem('tramite_activo_seleccionado');
            Toast.info('Trámite deseleccionado.');
            DashboardPage.render(document.getElementById('app'));
            return;
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

    static openLicenciaModal() {
        const data = this.currentData || {};
        const citizen = data.usuario || ApiService.getUsuario() || {};
        const lic = data.licencia || {};
        const isCompletado = data.progreso_porcentaje === 100 || data.estado === 'completado' || data.paso_actual === 'finalizado';
        
        let container = document.getElementById('citizenLicenciaModalContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'citizenLicenciaModalContainer';
            document.body.appendChild(container);
        }

        const foto = citizen.foto_rostro || lic.foto_rostro || null;

        container.innerHTML = `
        <div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(5px);" onclick="if(event.target===this) this.remove()">
            <div class="modal-content glass-card p-6 animate-slideUp" style="max-width:480px;width:100%;border:2px solid var(--primary);box-shadow:var(--shadow-lg);position:relative;">
                <button type="button" class="btn btn-ghost btn-sm" onclick="this.closest('.modal-backdrop').remove()" style="position:absolute;top:12px;right:12px;font-size:1.1rem;padding:4px 8px;">✕</button>
                
                <div class="licencia-digital-card" style="background:linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%);color:#fff;border-radius:14px;padding:20px;box-shadow:0 10px 25px rgba(0,0,0,0.35);position:relative;overflow:hidden;border:1px solid rgba(255,255,255,0.25);">
                    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:10px;margin-bottom:14px;">
                        <div>
                            <div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;color:#93c5fd;font-weight:700;">REPÚBLICA ARGENTINA</div>
                            <div style="font-size:0.95rem;font-weight:800;letter-spacing:0.5px;">LICENCIA NACIONAL DE CONDUCIR</div>
                            <div style="font-size:0.7rem;color:#bfdbfe;">Provincia de Buenos Aires · Baradero</div>
                        </div>
                        <div style="font-size:1.8rem;">🚗</div>
                    </div>

                    <div style="display:flex;gap:14px;align-items:center;">
                        <div style="width:96px;height:120px;border-radius:8px;border:2px solid #fff;overflow:hidden;background:#cbd5e1;flex-shrink:0;box-shadow:0 4px 10px rgba(0,0,0,0.25);">
                            ${foto ? `<img src="${foto}" alt="Rostro DNI" style="width:100%;height:100%;object-fit:cover;">` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#1e3a8a;font-size:2.2rem;">👤</div>'}
                        </div>
                        <div style="flex:1;font-size:0.75rem;line-height:1.4;">
                            <div style="color:#93c5fd;font-size:0.65rem;text-transform:uppercase;">Apellido y Nombres</div>
                            <div style="font-weight:800;font-size:0.95rem;margin-bottom:6px;color:#fff;">${citizen.apellido || ''}, ${citizen.nombre || ''}</div>
                            
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                                <div>
                                    <span style="color:#93c5fd;font-size:0.65rem;">DNI</span><br>
                                    <strong style="font-size:0.85rem;">${citizen.dni || ''}</strong>
                                </div>
                                <div>
                                    <span style="color:#93c5fd;font-size:0.65rem;">CLASE</span><br>
                                    <strong style="color:#fde047;font-size:0.9rem;">${lic.categoria || 'B1'}</strong>
                                </div>
                                <div>
                                    <span style="color:#93c5fd;font-size:0.65rem;">FECHA EMISIÓN</span><br>
                                    <span>${lic.fecha_emision || new Date().toISOString().split('T')[0]}</span>
                                </div>
                                <div>
                                    <span style="color:#93c5fd;font-size:0.65rem;">VENCIMIENTO</span><br>
                                    <strong style="color:#86efac;">${lic.fecha_vencimiento || '2031-08-31'}</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="margin-top:14px;padding-top:8px;border-top:1px dashed rgba(255,255,255,0.25);display:flex;justify-content:space-between;align-items:center;font-size:0.7rem;color:#bfdbfe;">
                        <span>N° Licencia: <strong>${citizen.dni || ''}</strong></span>
                        <span style="background:rgba(34,197,94,0.3);color:#86efac;padding:2px 8px;border-radius:4px;font-weight:700;">OFICIAL VIGENTE</span>
                    </div>
                </div>

                <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;">
                    <button type="button" class="btn btn-primary btn-sm" onclick="window.print()" style="display:inline-flex;align-items:center;gap:6px;">
                        ${Icons.file || '📄'} Imprimir Credencial
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm" onclick="this.closest('.modal-backdrop').remove()">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>`;
    }
}
