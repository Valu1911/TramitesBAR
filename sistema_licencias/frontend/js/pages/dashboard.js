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

        // Saludo de bienvenida con Bari si es la primera vez que ingresa aprobada
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
        <div class="page-content animate-fadeIn" style="max-width:1220px;margin:0 auto;padding-top:12px;">
            
            <!-- 1. HERO AUTENTICADO ESTILO SUBI -->
            <section class="home-hero">
                <div class="hero-wave-bg">
                    <svg viewBox="0 0 1440 320" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                        <path d="M0,96L48,112C96,128,192,160,288,186.7C384,213,480,235,576,218.7C672,203,768,149,864,138.7C960,128,1056,160,1152,176C1248,192,1344,192,1392,192L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" fill="#ffffff" fill-opacity="0.12" />
                    </svg>
                </div>

                <div class="home-hero-content">
                    <!-- Credencial del Vecino -->
                    <div class="citizen-badge-bar">
                        <span>DNI: <strong>${citizen.dni || ''}</strong></span>
                        <span class="badge-dot">•</span>
                        <span>Domicilio: <strong>${citizen.direccion || 'Baradero'}</strong></span>
                        <span class="badge-dot">•</span>
                        <span class="badge-level-verified">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Nivel 2 Verificado
                        </span>
                    </div>

                    <h1 class="home-hero-title">¡Hola, ${citizen.nombre || 'Vecino'}!</h1>
                    <p class="home-hero-subtitle">Sistema de Gestión de Licencias de Conducir · Municipalidad de Baradero</p>

                    <!-- Buscador en tiempo real -->
                    <div class="hero-search-wrapper">
                        <div class="hero-search-box">
                            <svg class="search-box-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input type="text" id="dashboardSearchInput" class="hero-search-input"
                                   placeholder="Buscá por trámite, paso o arancel (ej: examen, pago, turno, médico)..."
                                   autocomplete="off" oninput="DashboardPage.handleSearch(this.value)" />
                            <span class="search-kbd-hint" title="Presiona / para buscar"><kbd>/</kbd></span>
                            <button type="button" class="hero-search-btn" aria-label="Buscar">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                    <polyline points="12 5 19 12 12 19" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <!-- Chips populares de acceso rápido -->
                    <div class="hero-popular-row">
                        <span class="hero-popular-label">Accesos rápidos:</span>
                        <button type="button" class="popular-chip" onclick="DashboardPage.seleccionarTramite('nueva')">Licencia Nueva</button>
                        <button type="button" class="popular-chip" onclick="DashboardPage.seleccionarTramite('renovacion')">Renovar Licencia</button>
                        <button type="button" class="popular-chip" onclick="Router.navigate('pago')">Pagar Arancel</button>
                        <button type="button" class="popular-chip" onclick="Router.navigate('practico')">Turno Práctico</button>
                        <button type="button" class="popular-chip" onclick="DashboardPage.abrirInboxCiudadano()">Mensajes Oficiales</button>
                    </div>
                </div>
            </section>

            <!-- 2. CUATRO TARJETAS DE ACCIÓN PRINCIPALES (FLOTANTES ESTILO SUBI) -->
            <section class="action-cards-grid" aria-label="Servicios Principales">
                <!-- 1. Trámite Activo -->
                <div class="action-card" onclick="document.getElementById('sectionPasos')?.scrollIntoView({behavior:'smooth'})">
                    <span class="action-card-badge">${data.progreso_porcentaje}%</span>
                    <div class="action-card-icon-circle icon-blue">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                    </div>
                    <div class="action-card-title">Trámite Actual</div>
                    <div class="action-card-desc">${(tramiteSeleccionado || 'NUEVA').toUpperCase()} · En curso</div>
                </div>

                <!-- 2. Pagar Aranceles -->
                <div class="action-card" onclick="Router.navigate('pago')">
                    <span class="action-card-badge badge-amber">ARANCEL</span>
                    <div class="action-card-icon-circle icon-amber">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="5" width="20" height="14" rx="2" />
                            <line x1="2" y1="10" x2="22" y2="10" />
                        </svg>
                    </div>
                    <div class="action-card-title">Pagar Tasas</div>
                    <div class="action-card-desc">Arancel y Sellado Digital</div>
                </div>

                <!-- 3. Turnos y Práctico -->
                <div class="action-card" onclick="Router.navigate('practico')">
                    <span class="action-card-badge badge-green">PISTA</span>
                    <div class="action-card-icon-circle icon-emerald">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                    </div>
                    <div class="action-card-title">Turnos Práctico</div>
                    <div class="action-card-desc">Circuito y Evaluadores</div>
                </div>

                <!-- 4. Licencia Digital -->
                <div class="action-card" onclick="${licencia ? 'DashboardPage.openLicenciaModal()' : 'Router.navigate(\'entrega\')'}">
                    <span class="action-card-badge">${licencia ? 'EMITIDA' : 'FINAL'}</span>
                    <div class="action-card-icon-circle icon-indigo">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="4" width="18" height="16" rx="3" />
                            <circle cx="9" cy="10" r="2" />
                            <line x1="15" y1="8" x2="17" y2="8" />
                            <line x1="15" y1="12" x2="17" y2="12" />
                            <line x1="7" y1="16" x2="17" y2="16" />
                        </svg>
                    </div>
                    <div class="action-card-title">Licencia Digital</div>
                    <div class="action-card-desc">${licencia ? 'Ver credencial oficial' : 'Etapa de Entrega'}</div>
                </div>
            </section>

            <!-- 3. SPLIT GRID DASHBOARD (2 COLUMNAS EQUILIBRADAS ESTILO SUBI) -->
            <div class="dashboard-split-grid">
                
                <!-- COLUMNA IZQUIERDA: TRÁMITES Y PASOS -->
                <div class="dashboard-left-col">
                    
                    <!-- SECCIÓN: SELECCIÓN DE TRÁMITES -->
                    <div class="dash-card">
                        <div class="card-header-row">
                            <div style="display:flex;align-items:center;gap:10px;">
                                <div style="width:34px;height:34px;border-radius:50%;background:#e0f2fe;color:#0284c7;display:flex;align-items:center;justify-content:center;">
                                    ${Icons.doc}
                                </div>
                                <div>
                                    <h2 style="font-size:1.05rem;font-weight:800;margin:0;color:#1e293b;">Tipo de Trámite</h2>
                                    <p style="font-size:0.78rem;color:#64748b;margin:0;">Seleccioná el trámite a cursar para configurar los pasos requeridos:</p>
                                </div>
                            </div>
                            <span class="badge badge-info" style="font-size:0.75rem;padding:3px 8px;">6 opciones</span>
                        </div>

                        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px">
                            <button class="tramite-card-btn ${tramiteSeleccionado === 'nueva' ? 'tramite-card-btn--active' : ''}" 
                                    onclick="DashboardPage.seleccionarTramite('nueva')">
                                <div style="font-size:1.4rem;margin-bottom:6px;color:#0284c7;display:flex;justify-content:center">${Icons.car}</div>
                                <strong style="font-size:0.92rem;margin-bottom:2px">Licencia Nueva</strong>
                                <span class="text-xs ${tramiteSeleccionado === 'nueva' ? '' : 'text-muted'}">Teórico, práctico y salud</span>
                                ${tramiteSeleccionado === 'nueva' ? `<span class="badge mt-2" style="background:#0284c7;color:#fff;display:inline-flex;align-items:center;gap:4px">✓ Activo</span>` : ''}
                            </button>

                            <button class="tramite-card-btn ${tramiteSeleccionado === 'renovacion' ? 'tramite-card-btn--active' : ''}" 
                                    onclick="DashboardPage.seleccionarTramite('renovacion')">
                                <div style="font-size:1.4rem;margin-bottom:6px;color:#0284c7;display:flex;justify-content:center">${Icons.sparkles}</div>
                                <strong style="font-size:0.92rem;margin-bottom:2px">Renovación</strong>
                                <span class="text-xs ${tramiteSeleccionado === 'renovacion' ? '' : 'text-muted'}">Salud + Pago directo</span>
                                ${tramiteSeleccionado === 'renovacion' ? `<span class="badge mt-2" style="background:#0284c7;color:#fff;display:inline-flex;align-items:center;gap:4px">✓ Activo</span>` : ''}
                            </button>

                            <button class="tramite-card-btn ${tramiteSeleccionado === 'vencida' ? 'tramite-card-btn--active' : ''}" 
                                    onclick="DashboardPage.seleccionarTramite('vencida')">
                                <div style="font-size:1.4rem;margin-bottom:6px;color:#f59e0b;display:flex;justify-content:center">${Icons.clock}</div>
                                <strong style="font-size:0.92rem;margin-bottom:2px">Licencia Vencida</strong>
                                <span class="text-xs ${tramiteSeleccionado === 'vencida' ? '' : 'text-muted'}">Fuera de término (+90d)</span>
                                ${tramiteSeleccionado === 'vencida' ? `<span class="badge mt-2" style="background:#0284c7;color:#fff;display:inline-flex;align-items:center;gap:4px">✓ Activo</span>` : ''}
                            </button>

                            <button class="tramite-card-btn ${tramiteSeleccionado === 'categoria' ? 'tramite-card-btn--active' : ''}" 
                                    onclick="DashboardPage.seleccionarTramite('categoria')">
                                <div style="font-size:1.4rem;margin-bottom:6px;color:#0284c7;display:flex;justify-content:center">${Icons.shield}</div>
                                <strong style="font-size:0.92rem;margin-bottom:2px">Categoría</strong>
                                <span class="text-xs ${tramiteSeleccionado === 'categoria' ? '' : 'text-muted'}">Ampliación de clase</span>
                                ${tramiteSeleccionado === 'categoria' ? `<span class="badge mt-2" style="background:#0284c7;color:#fff;display:inline-flex;align-items:center;gap:4px">✓ Activo</span>` : ''}
                            </button>

                            <button class="tramite-card-btn ${tramiteSeleccionado === 'profesional' ? 'tramite-card-btn--active' : ''}" 
                                    onclick="DashboardPage.seleccionarTramite('profesional')">
                                <div style="font-size:1.4rem;margin-bottom:6px;color:#0284c7;display:flex;justify-content:center">${Icons.truck}</div>
                                <strong style="font-size:0.92rem;margin-bottom:2px">Profesional</strong>
                                <span class="text-xs ${tramiteSeleccionado === 'profesional' ? '' : 'text-muted'}">Clases C, D y E</span>
                                ${tramiteSeleccionado === 'profesional' ? `<span class="badge mt-2" style="background:#0284c7;color:#fff;display:inline-flex;align-items:center;gap:4px">✓ Activo</span>` : ''}
                            </button>

                            <button class="tramite-card-btn ${tramiteSeleccionado === 'extravio' ? 'tramite-card-btn--active' : ''}" 
                                    onclick="DashboardPage.seleccionarTramite('extravio')">
                                <div style="font-size:1.4rem;margin-bottom:6px;color:#0ea5e9;display:flex;justify-content:center">${Icons.box}</div>
                                <strong style="font-size:0.92rem;margin-bottom:2px">Extravío / Robo</strong>
                                <span class="text-xs ${tramiteSeleccionado === 'extravio' ? '' : 'text-muted'}">Duplicado simplificado</span>
                                ${tramiteSeleccionado === 'extravio' ? `<span class="badge mt-2" style="background:#0284c7;color:#fff;display:inline-flex;align-items:center;gap:4px">✓ Activo</span>` : ''}
                            </button>
                        </div>
                    </div>

                    <!-- PROGRESO Y PASOS -->
                    ${!tramiteSeleccionado ? `
                    <div class="dash-card text-center" style="border: 2px dashed #bae6fd; background: #f0f9ff; padding: 36px 20px;">
                        <div style="display:flex;justify-content:center;margin-bottom:8px;color:#0284c7;font-size:2rem">${Icons.id}</div>
                        <h3 style="font-weight:800;font-size:1.1rem;margin-bottom:4px;color:#1e293b;">Seleccioná un Trámite para Comenzar</h3>
                        <p style="font-size:0.85rem;color:#64748b;margin:0;">
                            Hacé clic en cualquiera de las opciones superiores para ver la barra de progreso y habilitar los pasos del trámite.
                        </p>
                    </div>` : `
                    
                    <div class="dash-card" id="sectionPasos">
                        <div class="card-header-row">
                            <div style="display:flex;align-items:center;gap:10px;">
                                <div style="width:34px;height:34px;border-radius:50%;background:#ecfdf5;color:#10b981;display:flex;align-items:center;justify-content:center;">
                                    ${Icons.check}
                                </div>
                                <div>
                                    <h2 style="font-size:1.05rem;font-weight:800;margin:0;color:#1e293b;">Hoja de Ruta del Trámite</h2>
                                    <p style="font-size:0.78rem;color:#64748b;margin:0;">${data.pasos.filter(p => p.status === 'completed').length} de ${data.pasos.length} pasos completados (${tramiteSeleccionado.toUpperCase()})</p>
                                </div>
                            </div>
                            <span style="font-size:1.3rem;font-weight:900;color:#0284c7;">${data.progreso_porcentaje}%</span>
                        </div>

                        <div class="progress-bar mb-5">
                            <div class="progress-bar__fill" style="width:${data.progreso_porcentaje}%"></div>
                        </div>

                        <div class="grid-steps" id="dashboardStepsContainer">
                            ${data.pasos.map((paso, i) => `
                            <div class="step-card step-card--${paso.status}" 
                                 data-step-title="${(paso.title || '').toLowerCase()}"
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
                    </div>`}

                    <!-- SECCIÓN LICENCIA DIGITAL (SI ESTÁ EMITIDA) -->
                    ${licencia ? `
                    <div id="licenciaSection" class="dash-card text-center animate-slideUp" style="border:2px solid #10b981;background:#ecfdf5;">
                        <div style="font-size:2.2rem;color:#10b981;margin-bottom:8px">🎉</div>
                        <h2 style="font-size:1.2rem;font-weight:800;color:#065f46;margin-bottom:4px">¡Tu Licencia Digital ya fue emitida!</h2>
                        <p style="font-size:0.85rem;color:#047857;margin-bottom:16px;">Podés visualizarla, descargarla o imprimir tu credencial oficial con QR.</p>
                        <button class="btn btn-success btn-lg" onclick="DashboardPage.openLicenciaModal()" style="display:inline-flex;align-items:center;gap:8px;font-weight:700">
                            ${Icons.id} Ver Licencia Digital Oficial
                        </button>
                    </div>` : ''}

                </div>

                <!-- COLUMNA DERECHA: PERFIL CIUDADANO & ASISTENCIA -->
                <div class="dashboard-right-col">
                    
                    <!-- TARJETA CIUDADANO OFICIAL -->
                    <div class="dash-card">
                        <div class="card-header-row">
                            <div style="font-weight:800;font-size:0.92rem;color:#1e293b;display:flex;align-items:center;gap:6px;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                Credencial del Ciudadano
                            </div>
                            <span class="badge badge-success" style="font-size:0.7rem;padding:2px 8px;">Aprobado</span>
                        </div>

                        <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
                            <div style="width:62px;height:62px;border-radius:50%;border:2.5px solid #0284c7;overflow:hidden;background:#f0f9ff;display:flex;align-items:center;justify-content:center;font-size:1.6rem;color:#0284c7;flex-shrink:0;box-shadow:0 3px 10px rgba(2,132,199,0.2);">
                                ${citizen.foto_rostro ? `<img src="${citizen.foto_rostro}" alt="Foto DNI" style="width:100%;height:100%;object-fit:cover;">` : Icons.user}
                            </div>
                            <div style="flex:1;min-width:0;">
                                <h3 style="font-weight:800;font-size:1.02rem;color:#1e293b;margin:0 0 2px 0;">${citizen.nombre || ''} ${citizen.apellido || ''}</h3>
                                <p style="font-size:0.8rem;color:#64748b;margin:0;">DNI ${citizen.dni || ''} · ${citizen.edad || '--'} años</p>
                            </div>
                        </div>

                        ${citizen.tiene_cud ? `
                        <div style="background:#dcfce7;border:1px solid #86efac;padding:8px 12px;border-radius:8px;margin-bottom:14px;display:flex;align-items:center;gap:8px;font-size:0.78rem;color:#15803d;font-weight:700;">
                            <span style="display:flex;align-items:center;">${Icons.wheelchair}</span>
                            Certificado CUD N° ${citizen.numero_cud || ''} (Prioridad Asignada)
                        </div>` : ''}

                        <div style="display:flex;flex-direction:column;gap:8px;font-size:0.82rem;background:#f8fafc;padding:12px;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:16px;">
                            <div style="display:flex;justify-content:space-between;"><span class="text-muted">Nacimiento:</span> <strong>${citizen.fecha_nacimiento || '--'}</strong></div>
                            <div style="display:flex;justify-content:space-between;"><span class="text-muted">Email:</span> <span style="font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;">${citizen.email || 'No registrado'}</span></div>
                            <div style="display:flex;justify-content:space-between;"><span class="text-muted">Teléfono:</span> <strong>${citizen.telefono || 'No registrado'}</strong></div>
                            <div style="display:flex;justify-content:space-between;"><span class="text-muted">Domicilio:</span> <strong>${citizen.direccion || 'Baradero'}</strong></div>
                            <div style="display:flex;justify-content:space-between;padding-top:6px;border-top:1px solid #e2e8f0;">
                                <span class="text-muted">Infracciones:</span>
                                <span style="color:#10b981;font-weight:800;display:inline-flex;align-items:center;gap:4px;">
                                    ✓ Libre de Deuda
                                </span>
                            </div>
                        </div>

                        <button class="btn btn-outline btn-block btn-sm" onclick="DashboardPage.abrirInboxCiudadano()" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;font-weight:700;">
                            ${Icons.chat} Abrir Mensajería Oficial
                        </button>
                    </div>

                    <!-- ASISTENCIA CIUDADANA -->
                    <div class="dash-card">
                        <div class="card-header-row">
                            <div style="font-weight:800;font-size:0.92rem;color:#1e293b;display:flex;align-items:center;gap:6px;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                Ayuda & Soporte Digital
                            </div>
                        </div>

                        <p style="font-size:0.8rem;color:#64748b;line-height:1.4;margin-bottom:12px;">
                            ¿Tenés dudas sobre las etapas del examen teórico o práctico en Baradero? Consultá a nuestro guía oficial Bari.
                        </p>

                        <div style="display:flex;flex-direction:column;gap:8px;">
                            <button type="button" class="btn btn-ghost btn-sm btn-block" style="justify-content:flex-start;text-align:left;gap:8px;border:1px solid #e2e8f0;padding:8px 12px;" onclick="if(window.Tutorial) window.Tutorial.startTutorialWithContext('dashboard', true)">
                                <span>🐾</span> <strong>Recorrido guiado con Bari</strong>
                            </button>
                            <a href="tel:147" class="btn btn-ghost btn-sm btn-block" style="justify-content:flex-start;text-align:left;gap:8px;border:1px solid #e2e8f0;padding:8px 12px;text-decoration:none;color:inherit;">
                                <span>📞</span> <strong>Línea Municipal 147</strong>
                            </a>
                        </div>
                    </div>

                </div>

            </div>
        </div>

        <div id="citizenInboxModalContainer"></div>
        `;
    }

    /**
     * Búsqueda en tiempo real dentro del dashboard
     */
    static handleSearch(val) {
        const term = (val || '').toLowerCase().trim();
        const cards = document.querySelectorAll('#dashboardStepsContainer .step-card');
        cards.forEach(card => {
            const title = card.getAttribute('data-step-title') || '';
            const text = card.textContent.toLowerCase();
            if (!term || title.includes(term) || text.includes(term)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
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
