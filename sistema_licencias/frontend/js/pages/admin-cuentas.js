/**
 * Admin Panel - Verificación de Cuentas e Infracciones de Tránsito
 */
class AdminCuentasPage {
    static filtro = 'todos';
    static usuarioSeleccionado = null;
    static busqueda = '';

    static async render(app) {
        const admin = ApiService.getAdmin();

        app.innerHTML = `
        ${renderAdminNavbar(admin)}
        <div class="page-content">
            <div class="text-center" style="padding:40px 0">
                <div class="spinner" style="margin:0 auto"></div>
                <p class="text-muted mt-3">Cargando cuentas y solicitudes de verificación...</p>
            </div>
        </div>`;

        try {
            const data = await ApiService.adminGetCuentas(this.filtro);
            this.renderContent(app, data, admin);
        } catch (err) {
            if (err.status === 403 || err.status === 401) {
                Toast.error('Acceso denegado. Iniciá sesión como administrador.');
                adminLogout();
                return;
            }
            Toast.error(err.message || 'Error al cargar cuentas');
        }
    }

    static setFiltro(nuevoFiltro) {
        this.filtro = nuevoFiltro;
        const app = document.getElementById('app');
        if (app) this.render(app);
    }

    static handleSearch(query) {
        this.busqueda = (query || '').toLowerCase().trim();
        const items = document.querySelectorAll('.cuenta-item');
        items.forEach(item => {
            const dni = item.getAttribute('data-dni') || '';
            const nombre = item.getAttribute('data-nombre') || '';
            if (!this.busqueda || dni.includes(this.busqueda) || nombre.includes(this.busqueda)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    static renderContent(app, data, admin) {
        const usuarios = data.usuarios || [];
        const pendientes = data.pendientes || 0;
        const conMultas = data.con_multas || 0;
        const aprobados = data.aprobados || 0;
        const papelera = data.papelera || 0;

        app.innerHTML = `
        ${renderAdminNavbar(admin)}
        <div class="page-content animate-fadeIn">
            <!-- HEADER -->
            <div class="flex-between mb-4" style="flex-wrap:wrap;gap:14px">
                <div>
                    <h1 style="font-size:1.4rem;font-weight:800;display:flex;align-items:center;gap:10px">
                        <span style="color:var(--primary);display:flex;align-items:center">${Icons.shield}</span>
                        Administrador de Cuentas e Infracciones
                    </h1>
                    <p class="text-sm text-muted">Verificá los antecedentes de tránsito en el sistema nacional/provincial antes de habilitar los trámites</p>
                </div>
                <div style="display:flex;gap:10px;align-items:center">
                    <span class="badge ${pendientes > 0 ? 'badge-warning' : 'badge-success'}" style="padding:8px 14px;font-size:0.85rem;display:inline-flex;align-items:center;gap:6px">
                        ${Icons.clock} ${pendientes} pendientes de verificar
                    </span>
                    <button class="btn btn-ghost btn-sm" onclick="AdminCuentasPage.render(document.getElementById('app'))" title="Actualizar lista">
                        <span style="display:flex;align-items:center;gap:4px">${Icons.refresh} Refrescar</span>
                    </button>
                </div>
            </div>

            <!-- FILTROS Y BUSCADOR -->
            <div class="flex-between mb-4" style="flex-wrap:wrap;gap:12px;background:var(--bg-card);padding:12px 16px;border-radius:var(--radius-md);border:1px solid var(--border)">
                <div class="tabs" style="margin-bottom:0">
                    <button class="tab ${this.filtro === 'todos' ? 'active' : ''}" onclick="AdminCuentasPage.setFiltro('todos')">
                        Todos (${usuarios.length})
                    </button>
                    <button class="tab ${this.filtro === 'pendiente' ? 'active' : ''}" onclick="AdminCuentasPage.setFiltro('pendiente')">
                        ⏳ Pendientes (${pendientes})
                    </button>
                    <button class="tab ${this.filtro === 'rechazada_multas' ? 'active' : ''}" onclick="AdminCuentasPage.setFiltro('rechazada_multas')">
                        ⚠️ Con Multas (${conMultas})
                    </button>
                    <button class="tab ${this.filtro === 'aprobada' ? 'active' : ''}" onclick="AdminCuentasPage.setFiltro('aprobada')">
                        ✓ Aprobadas (${aprobados})
                    </button>
                    <button class="tab ${this.filtro === 'papelera' ? 'active' : ''}" onclick="AdminCuentasPage.setFiltro('papelera')">
                        🗑️ Papelera (${papelera})
                    </button>
                </div>

                <div style="min-width:240px;flex:1;max-width:340px">
                    <input type="text" class="form-input" placeholder="🔍 Buscar por DNI o Nombre..." 
                           value="${this.busqueda}" oninput="AdminCuentasPage.handleSearch(this.value)">
                </div>
            </div>

            <!-- LISTA DE USUARIOS -->
            <div id="cuentasLista">
                ${usuarios.length === 0 ? `
                <div class="empty-state">
                    <div class="empty-state__icon" style="display:flex;align-items:center;justify-content:center">${Icons.users}</div>
                    <h3 class="empty-state__title">No hay usuarios</h3>
                    <p class="empty-state__desc">No se encontraron cuentas para el filtro seleccionado (${this.filtro}).</p>
                </div>` : usuarios.map(u => {
                    const stMap = {
                        'pendiente': { badge: 'badge-pending', label: 'Pendiente de Verificación', icon: Icons.clock },
                        'aprobada': { badge: 'badge-success', label: 'Cuenta Aprobada', icon: Icons.check },
                        'rechazada_multas': { badge: 'badge-danger', label: `Multas (${u.multas_cantidad} - $${Number(u.multas_monto).toLocaleString('es-AR')})`, icon: Icons.alert },
                        'papelera': { badge: 'badge', label: 'En Papelera', icon: Icons.trash }
                    };
                    const st = stMap[u.estado_cuenta] || stMap['pendiente'];
                    const tieneAvisoPago = u.infracciones_pagadas_solicitadas === 1;

                    return `
                    <div class="admin-item cuenta-item animate-slideUp" data-dni="${u.dni}" data-nombre="${(u.nombre + ' ' + u.apellido).toLowerCase()}" style="cursor:pointer;transition:all 0.2s ease" onclick="AdminCuentasPage.abrirModalVerificacion(${u.id})">
                        <div class="admin-item__header">
                            <div style="display:flex;align-items:center;gap:12px">
                                <div style="width:42px;height:42px;border-radius:50%;border:1.5px solid var(--primary);overflow:hidden;background:var(--primary-soft);display:flex;align-items:center;justify-content:center;color:var(--primary);font-weight:700;font-size:1.1rem;flex-shrink:0;">
                                    ${u.foto_rostro ? `<img src="${u.foto_rostro}" alt="Foto" style="width:100%;height:100%;object-fit:cover;">` : (u.nombre ? u.nombre.charAt(0).toUpperCase() : 'U')}
                                </div>
                                <div>
                                    <div class="admin-item__user" style="display:flex;align-items:center;gap:8px">
                                        <span>${u.nombre} ${u.apellido}</span>
                                        ${u.tiene_cud ? `<span class="badge badge-success" style="font-size:0.7rem;padding:2px 6px">${Icons.wheelchair} CUD</span>` : ''}
                                        ${tieneAvisoPago ? `<span class="badge badge-warning animate-pulse" style="font-size:0.75rem;padding:3px 8px;background:#fef3c7;color:#b45309;border:1px solid #f59e0b;font-weight:bold">🔔 Notificó Pago</span>` : ''}
                                        ${u.mensajes_sin_leer > 0 ? `<span class="badge badge-danger" style="font-size:0.7rem;padding:2px 6px">${Icons.chat} ${u.mensajes_sin_leer} msj</span>` : ''}
                                    </div>
                                    <div class="admin-item__meta" style="margin-top:2px">
                                        <strong>DNI:</strong> ${u.dni} · <strong>Edad:</strong> ${u.edad || '--'} años · <strong>Tel:</strong> ${u.telefono || 'Sin tel'} · <strong>Email:</strong> ${u.email || 'Sin email'}
                                    </div>
                                </div>
                            </div>
                            <span class="badge ${st.badge}" style="display:inline-flex;align-items:center;gap:5px">
                                ${st.icon} ${st.label}
                            </span>
                        </div>

                        <div class="admin-item__detail flex-between" style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border)">
                            <div class="text-xs text-muted">
                                Registrado el: ${u.created_at || '--'} 
                                ${u.multas_motivo ? ` · <span style="color:#b91c1c">Motivo: ${u.multas_motivo}</span>` : ''}
                            </div>
                            <button class="btn btn-primary btn-sm" style="display:inline-flex;align-items:center;gap:6px;font-weight:700">
                                ${Icons.shield} Abrir Verificación & Iframe →
                            </button>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>

        <!-- CONTENEDOR MODAL DINÁMICO -->
        <div id="modalContainerCuentas"></div>
        `;
    }

    /**
     * Abre el modal interactivo con iframe, DNI precargado, herramientas y chat inbox
     */
    static async abrirModalVerificacion(userId) {
        const modalCont = document.getElementById('modalContainerCuentas');
        if (!modalCont) return;

        modalCont.innerHTML = `
        <div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)">
            <div class="modal-content glass-card p-6" style="max-width:980px;width:100%;max-height:92vh;overflow-y:auto;position:relative">
                <div class="text-center" style="padding:50px 0">
                    <div class="spinner" style="margin:0 auto"></div>
                    <p class="text-muted mt-3">Cargando expediente del ciudadano e iframe...</p>
                </div>
            </div>
        </div>`;

        try {
            const data = await ApiService.adminGetCuentaDetalle(userId);
            this.usuarioSeleccionado = data.usuario;
            const u = data.usuario;
            const mensajes = data.mensajes || [];

            modalCont.innerHTML = `
            <div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:12px;backdrop-filter:blur(4px)">
                <div class="modal-content glass-card" style="max-width:1050px;width:100%;max-height:94vh;display:flex;flex-direction:column;position:relative;border:2px solid var(--primary);box-shadow:0 25px 50px -12px rgba(0,0,0,0.5)">
                    
                    <!-- HEADER DEL MODAL -->
                    <div class="flex-between p-4" style="background:var(--bg-card);border-bottom:1px solid var(--border);border-top-left-radius:var(--radius-md);border-top-right-radius:var(--radius-md)">
                        <div style="display:flex;align-items:center;gap:12px">
                            <div style="width:46px;height:46px;border-radius:50%;background:var(--primary-soft);display:flex;align-items:center;justify-content:center;color:var(--primary);font-size:1.3rem">
                                ${Icons.user}
                            </div>
                            <div>
                                <h2 style="font-size:1.15rem;font-weight:800;margin:0;display:flex;align-items:center;gap:8px">
                                    ${u.nombre} ${u.apellido}
                                    <span class="badge ${u.estado_cuenta === 'aprobada' ? 'badge-success' : u.estado_cuenta === 'rechazada_multas' ? 'badge-danger' : 'badge-pending'}" style="font-size:0.75rem">
                                        ${u.estado_cuenta.toUpperCase().replace('_', ' ')}
                                    </span>
                                </h2>
                                <p class="text-xs text-muted" style="margin:2px 0 0 0">
                                    DNI: <strong style="color:var(--text);font-size:0.9rem">${u.dni}</strong> · Edad: ${u.edad || '--'} años · Fecha Nac: ${u.fecha_nacimiento || '--'} · Tel: ${u.telefono || 'Sin tel'}
                                </p>
                            </div>
                        </div>
                        <button class="btn btn-ghost btn-sm" onclick="AdminCuentasPage.cerrarModal()" style="font-size:1.3rem;padding:4px 10px">×</button>
                    </div>

                    <!-- CUERPO CON PESTAÑAS (IFRAME VERIFICACIÓN / INBOX MENSAJES) -->
                    <div style="flex:1;overflow-y:auto;padding:16px;background:var(--bg)">
                        
                        <!-- BARRA DE ASISTENCIA RÁPIDA DNI -->
                        <div style="background:linear-gradient(135deg, rgba(37,99,235,0.12), rgba(147,197,253,0.2));border:1px solid var(--primary-light,#93c5fd);border-radius:var(--radius-md);padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
                            <div style="display:flex;align-items:center;gap:10px">
                                <span style="font-size:1.2rem;color:var(--primary);display:flex;align-items:center">${Icons.scan}</span>
                                <div>
                                    <div class="text-xs text-muted">DNI para consulta de Infracciones:</div>
                                    <strong style="font-size:1.15rem;letter-spacing:1px;color:var(--primary)">${u.dni}</strong>
                                </div>
                            </div>

                            <div style="display:flex;gap:8px;flex-wrap:wrap">
                                <button type="button" class="btn btn-primary btn-sm" onclick="AdminCuentasPage.copiarDni('${u.dni}')" style="display:inline-flex;align-items:center;gap:6px">
                                    ${Icons.copy} Copiar DNI
                                </button>
                                <a href="https://infraccionesba.gba.gob.ar/consulta-infraccion" target="_blank" class="btn btn-ghost btn-sm" style="background:rgba(255,255,255,0.7);display:inline-flex;align-items:center;gap:6px">
                                    ${Icons.externalLink} Abrir en pestaña externa
                                </a>
                            </div>
                        </div>

                        <!-- PESTAÑAS DENTRO DEL MODAL -->
                        <div class="tabs mb-3" style="border-bottom:1px solid var(--border)">
                            <button id="tabBtnIframe" class="tab active" onclick="AdminCuentasPage.switchTabModal('iframe')">
                                ${Icons.shield} Consulta Oficial de Infracciones BA
                            </button>
                            <button id="tabBtnInbox" class="tab" onclick="AdminCuentasPage.switchTabModal('inbox')">
                                ${Icons.chat} Inbox / Comprobantes Ciudadano (${mensajes.length})
                            </button>
                            <button id="tabBtnDatos" class="tab" onclick="AdminCuentasPage.switchTabModal('datos')">
                                ${Icons.doc} Datos del Ciudadano
                            </button>
                        </div>

                        <!-- CONTENIDO 1: HUB DE CONSULTA RÁPIDA DE INFRACCIONES -->
                        <div id="tabContentIframe" style="display:block">
                            <div class="glass-card p-6 text-center" style="background:var(--bg-card);border:2px solid var(--primary);border-radius:var(--radius-md);box-shadow:var(--shadow-md)">
                                
                                <div style="display:inline-flex;align-items:center;gap:8px;background:var(--primary-soft);color:var(--primary);padding:6px 16px;border-radius:20px;font-size:0.8rem;font-weight:700;margin-bottom:14px">
                                    🌐 Infracciones BA · Dirección Provincial de Seguridad Vial
                                </div>

                                <h3 class="font-bold text-xl mb-1" style="color:var(--text)">
                                    Verificación de Antecedentes de Tránsito
                                </h3>
                                <p class="text-sm text-muted mb-4" style="max-width:540px;margin-left:auto;margin-right:auto">
                                    Abrí la consulta oficial con el DNI del titular precargado para comprobar si posee multas impagas antes de aprobar la cuenta.
                                </p>

                                <!-- DNI DESTACADO Y BOTÓN DE ACCIÓN PRINCIPAL -->
                                <div style="background:linear-gradient(135deg, rgba(37,99,235,0.08), rgba(147,197,253,0.15));border:1px dashed var(--primary);border-radius:var(--radius-md);padding:20px;max-width:500px;margin:0 auto 20px auto">
                                    <div class="text-xs text-muted font-bold uppercase mb-1">DNI a Consultar</div>
                                    <div style="font-size:2.2rem;font-weight:900;letter-spacing:2px;color:var(--primary);margin-bottom:12px">
                                        ${u.dni}
                                    </div>
                                    
                                    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
                                        <button type="button" class="btn btn-primary btn-lg" onclick="AdminCuentasPage.abrirYCopiar('${u.dni}')" style="display:inline-flex;align-items:center;gap:8px;font-weight:800;padding:12px 22px">
                                            🚀 Abrir Infracciones BA & Copiar DNI
                                        </button>
                                        <button type="button" class="btn btn-ghost btn-sm" onclick="AdminCuentasPage.copiarDni('${u.dni}')" style="display:inline-flex;align-items:center;gap:4px">
                                            ${Icons.copy} Solo Copiar DNI
                                        </button>
                                    </div>
                                </div>

                                <!-- GUÍA RÁPIDA PARA EL OPERADOR -->
                                <div class="grid-2 text-left" style="gap:12px;max-width:680px;margin:0 auto;font-size:0.8rem">
                                    <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.3);padding:12px;border-radius:var(--radius-md)">
                                        <strong style="color:var(--success,#10b981);display:flex;align-items:center;gap:4px;margin-bottom:4px">
                                            ✓ Si NO registra multas:
                                        </strong>
                                        Hacé clic en el botón verde <strong>"Aprobar Cuenta"</strong> abajo para habilitar al ciudadano a comenzar sus trámites.
                                    </div>
                                    
                                    <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.3);padding:12px;border-radius:var(--radius-md)">
                                        <strong style="color:var(--danger,#ef4444);display:flex;align-items:center;gap:4px;margin-bottom:4px">
                                            ✕ Si TIENE multas pendientes:
                                        </strong>
                                        Hacé clic en el botón rojo <strong>"Rechazar por Multas"</strong> para cargar la cantidad y el costo en la plantilla.
                                    </div>
                                </div>

                            </div>
                        </div>

                        <!-- CONTENIDO 2: INBOX Y CHAT CON ADJUNTOS -->
                        <div id="tabContentInbox" style="display:none">
                            <div style="background:var(--bg-card);border-radius:var(--radius-md);border:1px solid var(--border);padding:14px;display:flex;flex-direction:column;height:440px">
                                <div id="inboxMensajesLista" style="flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:10px">
                                    ${mensajes.length === 0 ? `
                                    <div class="empty-state" style="padding:20px 0">
                                        <p class="text-xs text-muted">No hay mensajes previos con este ciudadano.</p>
                                    </div>` : mensajes.map(m => `
                                    <div style="max-width:80%;align-self:${m.emisor === 'admin' ? 'flex-end' : 'flex-start'};background:${m.emisor === 'admin' ? 'var(--primary)' : 'var(--bg-card-hover,#e2e8f0)'};color:${m.emisor === 'admin' ? '#fff' : 'inherit'};padding:10px 14px;border-radius:12px;box-shadow:var(--shadow-sm)">
                                        <div style="font-size:0.7rem;opacity:0.8;margin-bottom:4px;font-weight:700">
                                            ${m.emisor === 'admin' ? 'Oficial de Tránsito' : u.nombre + ' ' + u.apellido} · ${m.created_at}
                                        </div>
                                        <div style="font-size:0.85rem;white-space:pre-wrap">${m.mensaje}</div>
                                        ${m.adjunto_url ? `
                                        <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.2)">
                                            ${m.adjunto_url.startsWith('data:image') || m.adjunto_url.includes('.jpg') || m.adjunto_url.includes('.png') ? `
                                            <a href="${m.adjunto_url}" target="_blank">
                                                <img src="${m.adjunto_url}" style="max-width:100%;max-height:160px;border-radius:6px;display:block;margin-top:4px" alt="Comprobante">
                                            </a>` : `
                                            <a href="${m.adjunto_url}" target="_blank" class="btn btn-ghost btn-sm" style="font-size:0.75rem;padding:3px 8px;display:inline-flex;align-items:center;gap:4px">
                                                ${Icons.paperclip} Ver archivo adjunto (${m.adjunto_nombre || 'Comprobante'})
                                            </a>`}
                                        </div>` : ''}
                                    </div>`).join('')}
                                </div>

                                <!-- INPUT DE ENVÍO -->
                                <div style="display:flex;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);align-items:center">
                                    <label class="btn btn-ghost btn-sm" style="cursor:pointer" title="Adjuntar comprobante o foto">
                                        ${Icons.paperclip}
                                        <input type="file" id="adminInboxFileInput" accept="image/*,application/pdf" style="display:none" onchange="AdminCuentasPage.handleFileSelect(event)">
                                    </label>
                                    <span id="adminFileAttachedLabel" class="text-xs text-primary" style="display:none;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>
                                    <input type="text" id="adminInboxMsgInput" class="form-input" placeholder="Escribir mensaje de respuesta al ciudadano..." style="flex:1" onkeydown="if(event.key==='Enter') AdminCuentasPage.enviarMensajeAdmin(${u.id})">
                                    <button class="btn btn-primary btn-sm" onclick="AdminCuentasPage.enviarMensajeAdmin(${u.id})" style="display:inline-flex;align-items:center;gap:6px">
                                        ${Icons.send} Enviar
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- CONTENIDO 3: DATOS COMPLETOS -->
                        <div id="tabContentDatos" style="display:none">
                            <div class="glass-card p-4" style="background:var(--bg-card)">
                                <div class="grid-2" style="gap:14px;font-size:0.9rem">
                                    <div><strong>Nombre:</strong> ${u.nombre}</div>
                                    <div><strong>Apellido:</strong> ${u.apellido}</div>
                                    <div><strong>DNI:</strong> ${u.dni}</div>
                                    <div><strong>Fecha de Nacimiento:</strong> ${u.fecha_nacimiento} (${u.edad} años)</div>
                                    <div><strong>Email:</strong> ${u.email || 'No registrado'}</div>
                                    <div><strong>Teléfono:</strong> ${u.telefono || 'No registrado'}</div>
                                    <div><strong>Dirección:</strong> ${u.direccion || 'Baradero'}</div>
                                    <div><strong>Posee CUD:</strong> ${u.tiene_cud ? 'SÍ (N° ' + u.numero_cud + ')' : 'NO'}</div>
                                    <div><strong>Estado de Cuenta:</strong> ${u.estado_cuenta}</div>
                                    <div><strong>Infracciones Detectadas:</strong> ${u.multas_cantidad} ($${Number(u.multas_monto).toLocaleString('es-AR')})</div>
                                </div>
                            </div>
                        </div>

                    </div>

                    <!-- FOOTER DE ACCIONES DEL ADMINISTRADOR -->
                    <div class="p-4" style="background:var(--bg-card);border-top:1px solid var(--border);border-bottom-left-radius:var(--radius-md);border-bottom-right-radius:var(--radius-md);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
                        
                        <div style="display:flex;gap:8px">
                            ${u.estado_cuenta !== 'papelera' ? `
                            <button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger,#ef4444);display:inline-flex;align-items:center;gap:6px" onclick="AdminCuentasPage.moverPapelera(${u.id})">
                                ${Icons.trash} Mover a Papelera
                            </button>` : `
                            <button type="button" class="btn btn-ghost btn-sm" style="color:var(--success,#10b981);display:inline-flex;align-items:center;gap:6px" onclick="AdminCuentasPage.darAlta(${u.id})">
                                ${Icons.refresh} Restaurar / Dar de Alta
                            </button>`}
                        </div>

                        <div style="display:flex;gap:10px">
                            <!-- BOTÓN ROJO: RECHAZAR POR MULTAS -->
                            <button type="button" class="btn btn-danger" onclick="AdminCuentasPage.abrirModalRechazo(${u.id}, '${u.nombre} ${u.apellido}', '${u.dni}')" style="display:inline-flex;align-items:center;gap:6px;background:var(--danger,#ef4444);font-weight:700">
                                ${Icons.x} Rechazar por Multas
                            </button>

                            <!-- BOTÓN VERDE: APROBAR CUENTA -->
                            <button type="button" class="btn btn-success" onclick="AdminCuentasPage.aprobarCuenta(${u.id})" style="display:inline-flex;align-items:center;gap:6px;background:var(--success,#10b981);color:#fff;font-weight:700">
                                ${Icons.check} Aprobar Cuenta (Sin Multas)
                            </button>
                        </div>
                    </div>

                </div>
            </div>`;
        } catch (err) {
            Toast.error(err.message || 'Error al cargar detalle');
            this.cerrarModal();
        }
    }

    static switchTabModal(tab) {
        document.getElementById('tabContentIframe').style.display = tab === 'iframe' ? 'block' : 'none';
        document.getElementById('tabContentInbox').style.display = tab === 'inbox' ? 'block' : 'none';
        document.getElementById('tabContentDatos').style.display = tab === 'datos' ? 'block' : 'none';

        document.getElementById('tabBtnIframe').className = `tab ${tab === 'iframe' ? 'active' : ''}`;
        document.getElementById('tabBtnInbox').className = `tab ${tab === 'inbox' ? 'active' : ''}`;
        document.getElementById('tabBtnDatos').className = `tab ${tab === 'datos' ? 'active' : ''}`;
    }

    static copiarDni(dni) {
        if (!dni) return;
        navigator.clipboard.writeText(dni).then(() => {
            Toast.success(`DNI ${dni} copiado al portapapeles. Listo para pegar.`);
        }).catch(() => {
            // Fallback manual
            const el = document.createElement('textarea');
            el.value = dni;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            Toast.success(`DNI ${dni} copiado.`);
        });
    }

    static abrirYCopiar(dni) {
        if (dni) {
            this.copiarDni(dni);
        }
        window.open('https://infraccionesba.gba.gob.ar/consulta-infraccion', '_blank');
    }

    static cerrarModal() {
        const modalCont = document.getElementById('modalContainerCuentas');
        if (modalCont) modalCont.innerHTML = '';
        this.usuarioSeleccionado = null;
    }

    /**
     * Aprueba la cuenta directamente
     */
    static async aprobarCuenta(userId) {
        if (!confirm('¿Confirmás que el usuario NO registra multas impagas y querés APROBAR la cuenta?')) {
            return;
        }

        try {
            const res = await ApiService.adminAprobarCuenta(userId);
            Toast.success(res.message || 'Cuenta aprobada con éxito');
            this.cerrarModal();
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message || 'Error al aprobar cuenta');
        }
    }

    /**
     * Muestra el modal con plantilla prediseñada para cargar cantidad de multas y monto
     */
    static abrirModalRechazo(userId, nombreCompleto, dni) {
        const modalCont = document.getElementById('modalContainerCuentas');
        if (!modalCont) return;

        const subModal = document.createElement('div');
        subModal.id = 'subModalRechazo';
        subModal.innerHTML = `
        <div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px">
            <div class="modal-content glass-card p-6 animate-slideUp" style="max-width:560px;width:100%;border:2px solid var(--danger,#ef4444)">
                
                <div class="flex-between mb-4">
                    <div style="display:flex;align-items:center;gap:10px">
                        <div style="width:40px;height:40px;border-radius:50%;background:#fee2e2;color:#dc2626;display:flex;align-items:center;justify-content:center;font-size:1.2rem">
                            ${Icons.alert}
                        </div>
                        <div>
                            <h3 class="font-bold text-lg mb-0" style="color:var(--danger,#ef4444)">Rechazar por Infracciones</h3>
                            <p class="text-xs text-muted mb-0">${nombreCompleto} · DNI: ${dni}</p>
                        </div>
                    </div>
                    <button class="btn btn-ghost btn-sm" onclick="document.getElementById('subModalRechazo').remove()">×</button>
                </div>

                <p class="text-xs text-muted mb-4">
                    Completá la plantilla. Al enviar, el usuario no podrá avanzar con trámites y verá el cartel de <strong>Multas Pendientes</strong> con estos valores:
                </p>

                <div class="stack">
                    <div class="grid-2">
                        <div class="form-group">
                            <label class="form-label">Cantidad de Multas *</label>
                            <input type="number" id="inputCantidadMultas" class="form-input" value="1" min="1" max="99" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Costo / Monto Total a Pagar ($) *</label>
                            <input type="number" id="inputMontoMultas" class="form-input" placeholder="Ej: 45000" step="50" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Mensaje / Detalle para el Ciudadano</label>
                        <textarea id="inputMotivoMultas" class="form-input" rows="3" style="resize:none">Se detectaron infracciones de tránsito pendientes en el Registro de Antecedentes Viales. Por favor regularice su situación y presione el botón 'Ya pagué' adjuntando el comprobante correspondiente.</textarea>
                    </div>

                    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
                        <button type="button" class="btn btn-ghost" onclick="document.getElementById('subModalRechazo').remove()">Cancelar</button>
                        <button type="button" class="btn btn-danger" onclick="AdminCuentasPage.confirmarRechazo(${userId})" style="background:var(--danger,#ef4444);font-weight:700">
                            Confirmar y Notificar al Ciudadano
                        </button>
                    </div>
                </div>

            </div>
        </div>`;
        modalCont.appendChild(subModal);
    }

    static async confirmarRechazo(userId) {
        const cant = parseInt(document.getElementById('inputCantidadMultas').value, 10) || 1;
        const monto = parseFloat(document.getElementById('inputMontoMultas').value) || 0;
        const mensaje = document.getElementById('inputMotivoMultas').value.trim();

        if (monto <= 0) {
            Toast.warning('Por favor ingresá un monto total válido para las multas.');
            return;
        }

        try {
            const res = await ApiService.adminRechazarCuenta(userId, {
                cantidad_multas: cant,
                monto_total: monto,
                mensaje
            });
            Toast.success(res.message || 'Usuario notificado con multas');
            this.cerrarModal();
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message || 'Error al registrar multas');
        }
    }

    static async moverPapelera(userId) {
        if (!confirm('¿Mover usuario a la papelera? (Los datos no se eliminarán y podrás darlo de alta en cualquier momento)')) {
            return;
        }
        try {
            const res = await ApiService.adminMoverPapeleraCuenta(userId);
            Toast.success(res.message || 'Movido a papelera');
            this.cerrarModal();
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message || 'Error al mover a papelera');
        }
    }

    static async darAlta(userId) {
        try {
            const res = await ApiService.adminDarAltaCuenta(userId);
            Toast.success(res.message || 'Cuenta reactivada y dada de alta');
            this.cerrarModal();
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message || 'Error al dar de alta');
        }
    }

    static handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            AdminCuentasPage.selectedFileData = e.target.result;
            AdminCuentasPage.selectedFileName = file.name;
            const lbl = document.getElementById('adminFileAttachedLabel');
            if (lbl) {
                lbl.innerText = `📎 ${file.name}`;
                lbl.style.display = 'inline';
            }
            Toast.info(`Archivo ${file.name} listo para enviar.`);
        };
        reader.readAsDataURL(file);
    }

    static async enviarMensajeAdmin(userId) {
        const input = document.getElementById('adminInboxMsgInput');
        if (!input) return;

        const msg = input.value.trim();
        const fileData = AdminCuentasPage.selectedFileData || null;
        const fileName = AdminCuentasPage.selectedFileName || null;

        if (!msg && !fileData) {
            Toast.warning('Escribí un mensaje o adjuntá un archivo');
            return;
        }

        try {
            await ApiService.sendInboxMensaje({
                usuario_id: userId,
                mensaje: msg,
                adjunto_url: fileData,
                adjunto_nombre: fileName
            }, true);

            input.value = '';
            AdminCuentasPage.selectedFileData = null;
            AdminCuentasPage.selectedFileName = null;
            const lbl = document.getElementById('adminFileAttachedLabel');
            if (lbl) lbl.style.display = 'none';

            Toast.success('Mensaje enviado al ciudadano');
            // Recargar modal
            this.abrirModalVerificacion(userId);
        } catch (err) {
            Toast.error(err.message || 'Error al enviar mensaje');
        }
    }
}
