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
                adminLogout(true, true);
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
            <!-- HERO ADMIN CIVIC BANNER -->
            <div class="admin-hero">
                <div class="flex-between" style="flex-wrap:wrap;gap:16px;position:relative;z-index:1">
                    <div>
                        <div class="admin-badge-pill">
                            ${Icons.shield} Panel de Verificación y Antecedentes Viales
                        </div>
                        <h1 style="color:#ffffff;font-size:1.6rem;font-weight:800;margin-bottom:6px;letter-spacing:-0.02em">
                            Administración de Cuentas Ciudadanas
                        </h1>
                        <p style="color:rgba(255,255,255,0.92);font-size:0.88rem;max-width:680px;margin:0">
                            Auditoría oficial de antecedentes de tránsito e infracciones en el Registro Provincial de Seguridad Vial previo a la emisión de licencias.
                        </p>
                    </div>
                    <div style="display:flex;gap:10px;align-items:center">
                        <button class="admin-hero__refresh-btn" onclick="AdminCuentasPage.render(document.getElementById('app'))">
                            ${Icons.refresh} Refrescar Datos
                        </button>
                    </div>
                </div>
            </div>

            <!-- KPI METRICS GRID -->
            <div class="admin-kpi-grid">
                <div class="admin-kpi-card" style="border-left:3px solid #0284c7">
                    <div class="admin-kpi-icon" style="background:#e0f2fe;color:#0284c7">
                        ${Icons.users}
                    </div>
                    <div>
                        <div class="admin-kpi-val">${usuarios.length}</div>
                        <div class="admin-kpi-label">Total Solicitudes</div>
                    </div>
                </div>

                <div class="admin-kpi-card" style="border-left:3px solid #f59e0b">
                    <div class="admin-kpi-icon" style="background:#fef3c7;color:#d97706">
                        ${Icons.clock}
                    </div>
                    <div>
                        <div class="admin-kpi-val" style="color:#b45309">${pendientes}</div>
                        <div class="admin-kpi-label">Pendientes Auditoría</div>
                    </div>
                </div>

                <div class="admin-kpi-card" style="border-left:3px solid #e57373">
                    <div class="admin-kpi-icon" style="background:#fff5f5;color:#b84a54">
                        ${Icons.alertTriangle}
                    </div>
                    <div>
                        <div class="admin-kpi-val" style="color:#b84a54">${conMultas}</div>
                        <div class="admin-kpi-label">Con Infracciones</div>
                    </div>
                </div>

                <div class="admin-kpi-card" style="border-left:3px solid #10b981">
                    <div class="admin-kpi-icon" style="background:#d1fae5;color:#059669">
                        ${Icons.check}
                    </div>
                    <div>
                        <div class="admin-kpi-val" style="color:#047857">${aprobados}</div>
                        <div class="admin-kpi-label">Cuentas Aprobadas</div>
                    </div>
                </div>
            </div>

            <!-- FILTROS Y BUSCADOR -->
            <div class="admin-filter-bar">
                <div class="admin-tabs-list">
                    <button class="admin-tab-btn ${this.filtro === 'todos' ? 'active' : ''}" onclick="AdminCuentasPage.setFiltro('todos')">
                        ${Icons.filter} Todos (${usuarios.length})
                    </button>
                    <button class="admin-tab-btn ${this.filtro === 'pendiente' ? 'active' : ''}" onclick="AdminCuentasPage.setFiltro('pendiente')">
                        ${Icons.clock} Pendientes (${pendientes})
                    </button>
                    <button class="admin-tab-btn ${this.filtro === 'rechazada_multas' ? 'active' : ''}" onclick="AdminCuentasPage.setFiltro('rechazada_multas')">
                        ${Icons.alertTriangle} Con Multas (${conMultas})
                    </button>
                    <button class="admin-tab-btn ${this.filtro === 'aprobada' ? 'active' : ''}" onclick="AdminCuentasPage.setFiltro('aprobada')">
                        ${Icons.check} Aprobadas (${aprobados})
                    </button>
                    <button class="admin-tab-btn ${this.filtro === 'papelera' ? 'active' : ''}" onclick="AdminCuentasPage.setFiltro('papelera')">
                        ${Icons.trash} Papelera (${papelera})
                    </button>
                </div>

                <div class="admin-search-wrap">
                    <span class="admin-search-icon">${Icons.search}</span>
                    <input type="text" class="admin-search-input" placeholder="Buscar por DNI o Nombre..." 
                           value="${this.busqueda}" oninput="AdminCuentasPage.handleSearch(this.value)">
                </div>
            </div>

            <!-- LISTA DE USUARIOS -->
            <div id="cuentasLista">
                ${usuarios.length === 0 ? `
                <div class="dash-card text-center" style="padding:48px 20px">
                    <div style="width:56px;height:56px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#64748b">
                        ${Icons.users}
                    </div>
                    <h3 style="font-size:1.05rem;font-weight:700;color:#0f172a;margin-bottom:6px">No se encontraron solicitudes</h3>
                    <p style="font-size:0.85rem;color:#64748b;max-width:400px;margin:0 auto">No hay expedientes ciudadanos registrados bajo el filtro seleccionado (${this.filtro}).</p>
                </div>` : usuarios.map(u => {
                    const stMap = {
                        'pendiente': { badge: 'badge-pending', label: 'Pendiente de Verificación', icon: Icons.clock },
                        'aprobada': { badge: 'badge-success', label: 'Cuenta Aprobada', icon: Icons.check },
                        'rechazada_multas': { badge: 'badge-danger', label: `Multas (${u.multas_cantidad} - $${Number(u.multas_monto).toLocaleString('es-AR')})`, icon: Icons.alertTriangle },
                        'papelera': { badge: 'badge', label: 'En Papelera', icon: Icons.trash }
                    };
                    const st = stMap[u.estado_cuenta] || stMap['pendiente'];
                    const tieneAvisoPago = u.infracciones_pagadas_solicitadas === 1;

                    return `
                    <div class="admin-item cuenta-item animate-slideUp" data-dni="${u.dni}" data-nombre="${(u.nombre + ' ' + u.apellido).toLowerCase()}" 
                         style="cursor:pointer" onclick="AdminCuentasPage.abrirModalVerificacion(${u.id})">
                        <div class="admin-item__header">
                            <div style="display:flex;align-items:center;gap:14px">
                                <div class="admin-item__avatar">
                                    ${u.foto_rostro ? `<img src="${u.foto_rostro}" alt="Foto" style="width:100%;height:100%;object-fit:cover;">` : (u.nombre ? u.nombre.charAt(0).toUpperCase() : 'U')}
                                </div>
                                <div>
                                    <div class="admin-item__user" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                                        <span>${u.nombre} ${u.apellido}</span>
                                        ${u.tiene_cud ? `<span class="badge badge-success" style="font-size:0.7rem;padding:2px 6px">${Icons.wheelchair} CUD</span>` : ''}
                                        ${tieneAvisoPago ? `<span class="badge badge-warning" style="font-size:0.74rem;padding:3px 8px;background:#fef3c7;color:#b45309;border:1px solid #f59e0b;font-weight:700;display:inline-flex;align-items:center;gap:4px">${Icons.bell} Notificó Pago</span>` : ''}
                                        ${u.mensajes_sin_leer > 0 ? `<span class="badge badge-danger" style="font-size:0.7rem;padding:2px 6px;display:inline-flex;align-items:center;gap:4px">${Icons.chat} ${u.mensajes_sin_leer} msj</span>` : ''}
                                    </div>
                                    <div class="admin-item__meta" style="margin-top:3px">
                                        <strong>DNI:</strong> ${u.dni} · <strong>Edad:</strong> ${u.edad || '--'} años · <strong>Tel:</strong> ${u.telefono || 'Sin tel'} · <strong>Email:</strong> ${u.email || 'Sin email'}
                                    </div>
                                </div>
                            </div>
                            <span class="badge ${st.badge}" style="display:inline-flex;align-items:center;gap:5px;font-size:0.78rem;padding:5px 12px">
                                ${st.icon} ${st.label}
                            </span>
                        </div>

                        <div class="admin-item__detail flex-between" style="margin-top:10px;padding:10px 14px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0">
                            <div class="text-xs text-muted">
                                Registrado el: <strong>${u.created_at || '--'}</strong> 
                                ${u.multas_motivo ? ` · <span style="color:#b84a54;font-weight:700">Infracción: ${u.multas_motivo}</span>` : ''}
                            </div>
                            <button class="btn btn-primary btn-sm" style="display:inline-flex;align-items:center;gap:6px;font-weight:700;border-radius:8px;background:#0284c7;border:none">
                                ${Icons.shield} Abrir Auditoría y Consulta Oficial ${Icons.chevronRight}
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
     * Abre el modal interactivo con consulta de infracciones, DNI precargado, herramientas y chat inbox
     */
    static async abrirModalVerificacion(userId) {
        const modalCont = document.getElementById('modalContainerCuentas');
        if (!modalCont) return;

        modalCont.innerHTML = `
        <div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(15,23,42,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)">
            <div class="modal-content glass-card p-6" style="max-width:980px;width:100%;max-height:92vh;overflow-y:auto;position:relative;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px">
                <div class="text-center" style="padding:50px 0">
                    <div class="spinner" style="margin:0 auto"></div>
                    <p class="text-muted mt-3">Cargando expediente del ciudadano...</p>
                </div>
            </div>
        </div>`;

        try {
            const data = await ApiService.adminGetCuentaDetalle(userId);
            this.usuarioSeleccionado = data.usuario;
            const u = data.usuario;
            const mensajes = data.mensajes || [];

            modalCont.innerHTML = `
            <div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(15,23,42,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:12px;backdrop-filter:blur(4px)">
                <div class="modal-content" style="max-width:1020px;width:100%;max-height:94vh;display:flex;flex-direction:column;position:relative;background:#ffffff;border:1px solid #cbd5e1;border-radius:14px;box-shadow:0 25px 50px -12px rgba(15,23,42,0.35);overflow:hidden">
                    
                    <!-- HEADER DEL MODAL -->
                    <div class="flex-between p-4" style="background:#ffffff;border-bottom:1px solid #e2e8f0">
                        <div style="display:flex;align-items:center;gap:12px">
                            <div class="admin-item__avatar">
                                ${Icons.userCheck}
                            </div>
                            <div>
                                <h2 style="font-size:1.1rem;font-weight:800;color:#0f172a;margin:0;display:flex;align-items:center;gap:8px">
                                    ${u.nombre} ${u.apellido}
                                    <span class="badge ${u.estado_cuenta === 'aprobada' ? 'badge-success' : u.estado_cuenta === 'rechazada_multas' ? 'badge-danger' : 'badge-pending'}" style="font-size:0.72rem">
                                        ${u.estado_cuenta.toUpperCase().replace('_', ' ')}
                                    </span>
                                </h2>
                                <p class="text-xs text-muted" style="margin:2px 0 0 0">
                                    DNI: <strong style="color:#0f172a;font-size:0.88rem">${u.dni}</strong> · Edad: ${u.edad || '--'} años · Fecha Nac: ${u.fecha_nacimiento || '--'} · Tel: ${u.telefono || 'Sin tel'}
                                </p>
                            </div>
                        </div>
                        <button class="btn btn-ghost btn-sm" onclick="AdminCuentasPage.cerrarModal()" style="padding:6px;border-radius:8px;color:#64748b">
                            ${Icons.x}
                        </button>
                    </div>

                    <!-- CUERPO CON PESTAÑAS -->
                    <div style="flex:1;overflow-y:auto;padding:18px;background:#f8fafc">
                        
                        <!-- BARRA DE ASISTENCIA RÁPIDA DNI -->
                        <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
                            <div style="display:flex;align-items:center;gap:10px">
                                <div style="width:36px;height:36px;border-radius:8px;background:#e0f2fe;color:#0284c7;display:flex;align-items:center;justify-content:center">
                                    ${Icons.scan}
                                </div>
                                <div>
                                    <div class="text-xs text-muted">DNI para consulta de Infracciones:</div>
                                    <strong style="font-size:1.1rem;letter-spacing:0.04em;color:#0f172a;font-variant-numeric:tabular-nums">${u.dni}</strong>
                                </div>
                            </div>

                            <div style="display:flex;gap:8px;flex-wrap:wrap">
                                <button type="button" class="btn btn-primary btn-sm" onclick="AdminCuentasPage.copiarDni('${u.dni}')" style="display:inline-flex;align-items:center;gap:6px;background:#0284c7;border:none;border-radius:8px">
                                    ${Icons.copy} Copiar DNI
                                </button>
                                <a href="https://infraccionesba.gba.gob.ar/consulta-infraccion" target="_blank" class="btn btn-outline btn-sm" style="background:#ffffff;display:inline-flex;align-items:center;gap:6px;border-radius:8px">
                                    ${Icons.externalLink} Abrir en pestaña externa
                                </a>
                            </div>
                        </div>

                        <!-- PESTAÑAS DENTRO DEL MODAL -->
                        <div class="admin-tabs-list" style="margin-bottom:16px">
                            <button id="tabBtnIframe" class="admin-tab-btn active" onclick="AdminCuentasPage.switchTabModal('iframe')">
                                ${Icons.shield} Consulta Oficial de Infracciones BA
                            </button>
                            <button id="tabBtnInbox" class="admin-tab-btn" onclick="AdminCuentasPage.switchTabModal('inbox')">
                                ${Icons.inbox} Inbox / Comprobantes (${mensajes.length})
                            </button>
                            <button id="tabBtnDatos" class="admin-tab-btn" onclick="AdminCuentasPage.switchTabModal('datos')">
                                ${Icons.doc} Datos del Ciudadano
                            </button>
                        </div>

                        <!-- CONTENIDO 1: HUB DE CONSULTA RÁPIDA DE INFRACCIONES -->
                        <div id="tabContentIframe" style="display:block">
                            <div class="dash-card text-center" style="background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;padding:28px 24px">
                                
                                <div style="display:inline-flex;align-items:center;gap:8px;background:#f0f9ff;color:#0284c7;border:1px solid #bae6fd;padding:6px 14px;border-radius:20px;font-size:0.78rem;font-weight:700;margin-bottom:14px">
                                    ${Icons.globe} Infracciones BA · Dirección Provincial de Seguridad Vial
                                </div>

                                <h3 style="font-size:1.2rem;font-weight:800;color:#0f172a;margin-bottom:6px">
                                    Verificación de Antecedentes de Tránsito
                                </h3>
                                <p class="text-sm text-muted mb-4" style="max-width:540px;margin-left:auto;margin-right:auto">
                                    Abrí la consulta oficial con el DNI del titular copiado al portapapeles para comprobar si posee multas impagas antes de aprobar la cuenta.
                                </p>

                                <!-- DNI DESTACADO Y BOTÓN DE ACCIÓN PRINCIPAL -->
                                <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:20px;max-width:500px;margin:0 auto 20px auto">
                                    <div class="text-xs text-muted font-bold uppercase mb-1">DNI a Consultar</div>
                                    <div style="font-size:2rem;font-weight:800;letter-spacing:0.06em;color:#0284c7;margin-bottom:14px;font-variant-numeric:tabular-nums">
                                        ${u.dni}
                                    </div>
                                    
                                    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
                                        <button type="button" class="btn btn-primary" onclick="AdminCuentasPage.abrirYCopiar('${u.dni}')" style="display:inline-flex;align-items:center;gap:8px;font-weight:700;padding:10px 20px;background:#0284c7;border:none;border-radius:8px">
                                            ${Icons.externalLink} Abrir Infracciones BA y Copiar DNI
                                        </button>
                                        <button type="button" class="btn btn-outline btn-sm" onclick="AdminCuentasPage.copiarDni('${u.dni}')" style="display:inline-flex;align-items:center;gap:5px;background:#ffffff;border-radius:8px">
                                            ${Icons.copy} Solo Copiar DNI
                                        </button>
                                    </div>
                                </div>

                                <!-- GUÍA RÁPIDA PARA EL OPERADOR -->
                                <div class="grid-2 text-left" style="gap:12px;max-width:680px;margin:0 auto;font-size:0.8rem">
                                    <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:12px 14px;border-radius:8px">
                                        <strong style="color:#059669;display:flex;align-items:center;gap:5px;margin-bottom:4px">
                                            ${Icons.checkCircle} Si NO registra multas:
                                        </strong>
                                        <span style="color:#334155">Hacé clic en el botón verde <strong>"Aprobar Cuenta"</strong> abajo para habilitar al ciudadano a comenzar sus trámites.</span>
                                    </div>
                                    
                                    <div style="background:#fff5f5;border:1px solid #fed7d7;padding:12px 14px;border-radius:8px">
                                        <strong style="color:#b84a54;display:flex;align-items:center;gap:5px;margin-bottom:4px">
                                            ${Icons.xCircle} Si TIENE multas pendientes:
                                        </strong>
                                        <span style="color:#334155">Hacé clic en el botón rojo <strong>"Rechazar por Multas"</strong> para cargar la cantidad y el monto en la plantilla.</span>
                                    </div>
                                </div>

                            </div>
                        </div>

                        <!-- CONTENIDO 2: INBOX Y CHAT CON ADJUNTOS -->
                        <div id="tabContentInbox" style="display:none">
                            <div style="background:#ffffff;border-radius:10px;border:1px solid #cbd5e1;padding:14px;display:flex;flex-direction:column;height:420px">
                                <div id="inboxMensajesLista" style="flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:10px">
                                    ${mensajes.length === 0 ? `
                                    <div class="empty-state" style="padding:36px 0;text-align:center">
                                        <p class="text-xs text-muted">No hay mensajes previos con este ciudadano.</p>
                                    </div>` : mensajes.map(m => `
                                    <div style="max-width:80%;align-self:${m.emisor === 'admin' ? 'flex-end' : 'flex-start'};background:${m.emisor === 'admin' ? '#0284c7' : '#f1f5f9'};color:${m.emisor === 'admin' ? '#fff' : '#0f172a'};padding:10px 14px;border-radius:10px">
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
                                <div style="display:flex;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0;align-items:center">
                                    <label class="btn btn-outline btn-sm" style="cursor:pointer;background:#fff;border-radius:8px" title="Adjuntar comprobante o foto">
                                        ${Icons.paperclip}
                                        <input type="file" id="adminInboxFileInput" accept="image/*,application/pdf" style="display:none" onchange="AdminCuentasPage.handleFileSelect(event)">
                                    </label>
                                    <span id="adminFileAttachedLabel" class="text-xs" style="display:none;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#0284c7;font-weight:600"></span>
                                    <input type="text" id="adminInboxMsgInput" class="form-input" placeholder="Escribir mensaje de respuesta al ciudadano..." style="flex:1" onkeydown="if(event.key==='Enter') AdminCuentasPage.enviarMensajeAdmin(${u.id})">
                                    <button class="btn btn-primary btn-sm" onclick="AdminCuentasPage.enviarMensajeAdmin(${u.id})" style="display:inline-flex;align-items:center;gap:6px;background:#0284c7;border:none;border-radius:8px">
                                        ${Icons.send} Enviar
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- CONTENIDO 3: DATOS COMPLETOS -->
                        <div id="tabContentDatos" style="display:none">
                            <div class="dash-card" style="background:#ffffff;border:1px solid #cbd5e1">
                                <div class="admin-data-grid">
                                    <div class="admin-data-cell">
                                        <div class="admin-data-cell__label">Nombre y Apellido</div>
                                        <div class="admin-data-cell__value">${u.nombre} ${u.apellido}</div>
                                    </div>
                                    <div class="admin-data-cell">
                                        <div class="admin-data-cell__label">Documento Nacional</div>
                                        <div class="admin-data-cell__value">${u.dni}</div>
                                    </div>
                                    <div class="admin-data-cell">
                                        <div class="admin-data-cell__label">Fecha de Nacimiento</div>
                                        <div class="admin-data-cell__value">${u.fecha_nacimiento} (${u.edad} años)</div>
                                    </div>
                                    <div class="admin-data-cell">
                                        <div class="admin-data-cell__label">Correo Electrónico</div>
                                        <div class="admin-data-cell__value">${u.email || 'No registrado'}</div>
                                    </div>
                                    <div class="admin-data-cell">
                                        <div class="admin-data-cell__label">Teléfono de Contacto</div>
                                        <div class="admin-data-cell__value">${u.telefono || 'No registrado'}</div>
                                    </div>
                                    <div class="admin-data-cell">
                                        <div class="admin-data-cell__label">Domicilio Declarado</div>
                                        <div class="admin-data-cell__value">${u.direccion || 'Baradero'}</div>
                                    </div>
                                    <div class="admin-data-cell">
                                        <div class="admin-data-cell__label">Certificado CUD</div>
                                        <div class="admin-data-cell__value">${u.tiene_cud ? 'SÍ (N° ' + u.numero_cud + ')' : 'NO'}</div>
                                    </div>
                                    <div class="admin-data-cell">
                                        <div class="admin-data-cell__label">Infracciones Detectadas</div>
                                        <div class="admin-data-cell__value">${u.multas_cantidad} ($${Number(u.multas_monto).toLocaleString('es-AR')})</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    <!-- FOOTER DE ACCIONES DEL ADMINISTRADOR -->
                    <div class="p-4" style="background:#ffffff;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
                        
                        <div style="display:flex;gap:8px">
                            ${u.estado_cuenta !== 'papelera' ? `
                            <button type="button" class="btn btn-outline btn-sm" style="color:#b84a54;border-color:#fed7d7;background:#fff;border-radius:8px;display:inline-flex;align-items:center;gap:6px;font-weight:600" onclick="AdminCuentasPage.moverPapelera(${u.id})">
                                ${Icons.trash} Mover a Papelera
                            </button>` : `
                            <button type="button" class="btn btn-outline btn-sm" style="color:#059669;border-color:#a7f3d0;background:#fff;border-radius:8px;display:inline-flex;align-items:center;gap:6px;font-weight:600" onclick="AdminCuentasPage.darAlta(${u.id})">
                                ${Icons.rotateCcw} Restaurar / Dar de Alta
                            </button>`}
                        </div>

                        <div style="display:flex;gap:10px">
                            <!-- BOTÓN ROJO: RECHAZAR POR MULTAS -->
                            <button type="button" class="btn btn-danger btn-sm" onclick="AdminCuentasPage.abrirModalRechazo(${u.id}, '${u.nombre} ${u.apellido}', '${u.dni}')" style="display:inline-flex;align-items:center;gap:6px;background:#d95360;color:#fff;border:none;border-radius:8px;font-weight:700;padding:9px 16px">
                                ${Icons.x} Rechazar por Multas
                            </button>

                            <!-- BOTÓN VERDE: APROBAR CUENTA -->
                            <button type="button" class="btn btn-success btn-sm" onclick="AdminCuentasPage.aprobarCuenta(${u.id})" style="display:inline-flex;align-items:center;gap:6px;background:#059669;color:#fff;border:none;border-radius:8px;font-weight:700;padding:9px 16px">
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

        document.getElementById('tabBtnIframe').className = `admin-tab-btn ${tab === 'iframe' ? 'active' : ''}`;
        document.getElementById('tabBtnInbox').className = `admin-tab-btn ${tab === 'inbox' ? 'active' : ''}`;
        document.getElementById('tabBtnDatos').className = `admin-tab-btn ${tab === 'datos' ? 'active' : ''}`;
    }

    static copiarDni(dni) {
        if (!dni) return;
        navigator.clipboard.writeText(dni).then(() => {
            Toast.success(`DNI ${dni} copiado al portapapeles. Listo para pegar.`);
        }).catch(() => {
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
     * Aprueba la cuenta con modal de confirmación estético
     */
    static async aprobarCuenta(userId) {
        const ok = await ConfirmModal.show({
            title: 'Aprobar cuenta ciudadana',
            description: '¿Confirmás que el titular no registra multas de tránsito impagas y querés aprobar su cuenta para iniciar trámites?',
            confirmText: 'Aprobar Cuenta',
            cancelText: 'Cancelar',
            variant: 'success',
            icon: Icons.userCheck
        });
        if (!ok) return;

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
        <div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(15,23,42,0.75);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(3px)">
            <div class="modal-content animate-slideUp" style="max-width:540px;width:100%;background:#ffffff;border:1px solid #cbd5e1;border-top:4px solid #d95360;border-radius:12px;padding:24px;box-shadow:0 20px 40px rgba(15,23,42,0.3)">
                
                <div class="flex-between mb-4">
                    <div style="display:flex;align-items:center;gap:12px">
                        <div style="width:40px;height:40px;border-radius:10px;background:#fff5f5;color:#b84a54;display:flex;align-items:center;justify-content:center">
                            ${Icons.alertTriangle}
                        </div>
                        <div>
                            <h3 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin:0">Rechazar por Infracciones</h3>
                            <p class="text-xs text-muted mb-0">${nombreCompleto} · DNI: ${dni}</p>
                        </div>
                    </div>
                    <button class="btn btn-ghost btn-sm" onclick="document.getElementById('subModalRechazo').remove()" style="padding:4px;color:#64748b">
                        ${Icons.x}
                    </button>
                </div>

                <p class="text-xs text-muted mb-4">
                    Completá la plantilla. Al enviar, el usuario no podrá avanzar con trámites y verá el aviso de <strong>Multas Pendientes</strong> con estos valores:
                </p>

                <div class="stack">
                    <div class="grid-2">
                        <div class="form-group">
                            <label class="form-label">Cantidad de Multas *</label>
                            <input type="number" id="inputCantidadMultas" class="form-input" value="1" min="1" max="99" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Monto Total a Pagar ($) *</label>
                            <input type="number" id="inputMontoMultas" class="form-input" placeholder="Ej: 45000" step="50" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Mensaje / Detalle para el Ciudadano</label>
                        <textarea id="inputMotivoMultas" class="form-input" rows="3" style="resize:none">Se detectaron infracciones de tránsito pendientes en el Registro de Antecedentes Viales. Por favor regularice su situación y presione el botón 'Ya pagué' adjuntando el comprobante correspondiente.</textarea>
                    </div>

                    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
                        <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('subModalRechazo').remove()" style="background:#fff;border-radius:8px">Cancelar</button>
                        <button type="button" class="btn btn-danger btn-sm" onclick="AdminCuentasPage.confirmarRechazo(${userId})" style="background:#d95360;color:#fff;border:none;border-radius:8px;font-weight:700;padding:8px 16px">
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
        const ok = await ConfirmModal.show({
            title: 'Mover solicitud a la papelera',
            description: 'Los datos del ciudadano no se eliminarán de forma definitiva y podrás volver a darlo de alta desde la pestaña Papelera en cualquier momento.',
            confirmText: 'Mover a Papelera',
            cancelText: 'Cancelar',
            variant: 'danger',
            icon: Icons.trash
        });
        if (!ok) return;

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
        const ok = await ConfirmModal.show({
            title: 'Restaurar cuenta ciudadana',
            description: 'La cuenta saldrá de la papelera y volverá a estar activa en el padrón de solicitudes.',
            confirmText: 'Restaurar y Dar de Alta',
            cancelText: 'Cancelar',
            variant: 'primary',
            icon: Icons.rotateCcw
        });
        if (!ok) return;

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
                lbl.innerHTML = `${Icons.paperclip} ${file.name}`;
                lbl.style.display = 'inline-flex';
                lbl.style.alignItems = 'center';
                lbl.style.gap = '4px';
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
            this.abrirModalVerificacion(userId);
        } catch (err) {
            Toast.error(err.message || 'Error al enviar mensaje');
        }
    }
}
