/**
 * Panel de Administración: Profesores & Examen Teórico (Configuración, Preguntas, Monitoreo en Vivo y Revisión/Dictamen)
 */
class AdminProfesoresPage {
    static activeTab = 'config'; // 'config', 'preguntas', 'monitoreo', 'revision'
    static config = { modo: 'plantilla', cant_plantilla: 3, cant_profesor: 3 };
    static preguntas = [];
    static previewPreguntas = [];
    static estudiantes = [];
    static revisionExamenes = [];
    static monitorInterval = null;

    static async render(app) {
        const admin = ApiService.getAdmin();

        app.innerHTML = `
        ${renderAdminNavbar(admin)}
        <div class="page-content stack-lg animate-fadeIn">
            <!-- HERO ADMIN CIVIC BANNER -->
            <div class="admin-hero">
                <div class="flex-between" style="flex-wrap:wrap;gap:16px;position:relative;z-index:1">
                    <div>
                        <div class="admin-badge-pill">
                            ${Icons.teacher} Dirección de Educación Vial · Claustro Docente
                        </div>
                        <h1 style="color:#ffffff;font-size:1.6rem;font-weight:800;margin-bottom:6px;letter-spacing:-0.02em">
                            Gestión de Exámenes Teóricos de Conducir
                        </h1>
                        <p style="color:rgba(255,255,255,0.92);font-size:0.88rem;max-width:680px;margin:0">
                            Configuración del banco de reactivos, supervisión biométrica en tiempo real por streaming y dictamen oficial con justificación pedagógica.
                        </p>
                    </div>
                    <div>
                        <button class="admin-hero__refresh-btn" onclick="AdminProfesoresPage.loadTabData()">
                            ${Icons.refresh} Sincronizar Panel
                        </button>
                    </div>
                </div>
            </div>

            <!-- TABS DE NAVEGACIÓN -->
            <div class="admin-filter-bar" style="margin-bottom:20px">
                <div class="admin-tabs-list">
                    <button class="admin-tab-btn ${this.activeTab === 'config' ? 'active' : ''}" onclick="AdminProfesoresPage.switchTab('config')">
                        ${Icons.settings} Configuración y Vista Previa
                    </button>
                    <button class="admin-tab-btn ${this.activeTab === 'preguntas' ? 'active' : ''}" onclick="AdminProfesoresPage.switchTab('preguntas')">
                        ${Icons.doc} Banco de Preguntas
                    </button>
                    <button class="admin-tab-btn ${this.activeTab === 'monitoreo' ? 'active' : ''}" onclick="AdminProfesoresPage.switchTab('monitoreo')">
                        ${Icons.camera} Monitoreo en Tiempo Real
                    </button>
                    <button class="admin-tab-btn ${this.activeTab === 'revision' ? 'active' : ''}" onclick="AdminProfesoresPage.switchTab('revision')">
                        ${Icons.fileCheck} Exámenes a Revisar y Dictamen
                    </button>
                </div>
            </div>

            <!-- CONTENIDO DE CADA TAB -->
            <div id="profesoresTabContent">
                <div class="dash-card text-center" style="padding:48px 20px">
                    <div class="spinner" style="margin:0 auto"></div>
                    <p class="text-muted mt-3" style="font-size:0.85rem">Cargando módulo docente...</p>
                </div>
            </div>
        </div>`;

        this.loadTabData();
    }

    static async switchTab(tab) {
        this.activeTab = tab;
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        this.render(document.getElementById('app'));
    }

    static async loadTabData() {
        const container = document.getElementById('profesoresTabContent');
        if (!container) return;

        if (this.activeTab === 'config') {
            await this.renderTabConfig(container);
        } else if (this.activeTab === 'preguntas') {
            await this.renderTabPreguntas(container);
        } else if (this.activeTab === 'monitoreo') {
            await this.renderTabMonitoreo(container);
        } else if (this.activeTab === 'revision') {
            await this.renderTabRevision(container);
        }
    }

    // ============================================================
    // TAB 1: CONFIGURACIÓN & VISTA PREVIA
    // ============================================================
    static async renderTabConfig(container) {
        try {
            const configRes = await ApiService.adminGetConfigExamen();
            this.config = configRes.config || { modo: 'plantilla', cant_plantilla: 3, cant_profesor: 3 };
            
            const savedModo = localStorage.getItem('profesor_selected_modo');
            if (savedModo && ['plantilla', 'personalizado', 'hibrido'].includes(savedModo) && this.config.modo !== savedModo) {
                this.config.modo = savedModo;
                await ApiService.adminUpdateConfigExamen({
                    modo: savedModo,
                    cant_plantilla: this.config.cant_plantilla || 3,
                    cant_profesor: this.config.cant_profesor || 3
                }).catch(() => {});
            }

            const previewRes = await ApiService.adminGetPreguntasPreview();
            this.previewPreguntas = previewRes.preguntas || [];
        } catch (err) {
            if (err.status === 403 || err.status === 401) { adminLogout(true, true); return; }
            Toast.error('Error al cargar configuración del examen');
        }

        container.innerHTML = `
        <div class="grid-2" style="gap:20px;align-items:start">
            <!-- COLUMNA 1: SELECCIÓN DE MODO DE EXAMEN -->
            <div class="dash-card">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                    <span style="color:#0284c7;display:flex;align-items:center">${Icons.sliders}</span>
                    <h2 style="font-size:1.1rem;font-weight:800;color:#0f172a;margin:0">Modalidad de Evaluación</h2>
                </div>
                <p style="font-size:0.84rem;color:#64748b;margin-bottom:18px">Elegí la modalidad con la que el sistema compilará las preguntas para los aspirantes:</p>

                <form onsubmit="AdminProfesoresPage.guardarConfig(event)">
                    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px">
                        <!-- OPCIÓN 1: PLANTILLA -->
                        <label style="border:1.5px solid ${this.config.modo === 'plantilla' ? '#0284c7' : '#e2e8f0'};border-radius:10px;padding:14px;display:block;cursor:pointer;background:${this.config.modo === 'plantilla' ? '#f0f9ff' : '#ffffff'};transition:all 0.15s ease">
                            <div style="display:flex;align-items:center;gap:12px">
                                <input type="radio" name="modoExamen" value="plantilla" ${this.config.modo === 'plantilla' ? 'checked' : ''} onchange="AdminProfesoresPage.onModoChange(this.value)" style="width:17px;height:17px;accent-color:#0284c7">
                                <div>
                                    <strong style="font-size:0.9rem;color:#0f172a;display:block">1. Modo Plantilla Estándar</strong>
                                    <span style="font-size:0.8rem;color:#64748b">Preguntas oficiales base estandarizadas por la Agencia Provincial de Seguridad Vial.</span>
                                </div>
                            </div>
                        </label>

                        <!-- OPCIÓN 2: PERSONALIZADO -->
                        <label style="border:1.5px solid ${this.config.modo === 'personalizado' ? '#0284c7' : '#e2e8f0'};border-radius:10px;padding:14px;display:block;cursor:pointer;background:${this.config.modo === 'personalizado' ? '#f0f9ff' : '#ffffff'};transition:all 0.15s ease">
                            <div style="display:flex;align-items:center;gap:12px">
                                <input type="radio" name="modoExamen" value="personalizado" ${this.config.modo === 'personalizado' ? 'checked' : ''} onchange="AdminProfesoresPage.onModoChange(this.value)" style="width:17px;height:17px;accent-color:#0284c7">
                                <div>
                                    <strong style="font-size:0.9rem;color:#0f172a;display:block">2. Modo Personalizado (Profesor)</strong>
                                    <span style="font-size:0.8rem;color:#64748b">Utiliza exclusivamente preguntas elaboradas y cargadas por el equipo docente local.</span>
                                </div>
                            </div>
                        </label>

                        <!-- OPCIÓN 3: HÍBRIDO -->
                        <label style="border:1.5px solid ${this.config.modo === 'hibrido' ? '#0284c7' : '#e2e8f0'};border-radius:10px;padding:14px;display:block;cursor:pointer;background:${this.config.modo === 'hibrido' ? '#f0f9ff' : '#ffffff'};transition:all 0.15s ease">
                            <div style="display:flex;align-items:center;gap:12px">
                                <input type="radio" name="modoExamen" value="hibrido" ${this.config.modo === 'hibrido' ? 'checked' : ''} onchange="AdminProfesoresPage.onModoChange(this.value)" style="width:17px;height:17px;accent-color:#0284c7">
                                <div>
                                    <strong style="font-size:0.9rem;color:#0f172a;display:block">3. Modo Híbrido (Combinado sin duplicados)</strong>
                                    <span style="font-size:0.8rem;color:#64748b">Combina reactivos de plantilla estándar con preguntas locales del profesor.</span>
                                </div>
                            </div>
                        </label>
                    </div>

                    <div id="hibridoConfigInputs" style="display:${this.config.modo === 'hibrido' ? 'block' : 'none'};background:#f8fafc;padding:14px;border-radius:10px;margin-bottom:18px;border:1px solid #e2e8f0">
                        <div class="grid-2" style="gap:12px">
                            <div>
                                <label class="form-label text-xs">Preguntas de Plantilla</label>
                                <input type="number" id="cantPlantilla" class="form-input text-xs" min="1" max="10" value="${this.config.cant_plantilla || 3}">
                            </div>
                            <div>
                                <label class="form-label text-xs">Preguntas de Profesor</label>
                                <input type="number" id="cantProfesor" class="form-input text-xs" min="1" max="10" value="${this.config.cant_profesor || 3}">
                            </div>
                        </div>
                    </div>

                    <button type="submit" class="btn btn-primary btn-block" style="font-weight:700;padding:11px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;gap:6px">
                        ${Icons.check} Guardar Modalidad de Examen
                    </button>
                </form>
            </div>

            <!-- COLUMNA 2: VISTA PREVIA DE PREGUNTAS EN VIVO -->
            <div class="dash-card">
                <div class="flex-between mb-3" style="flex-wrap:wrap;gap:8px">
                    <div>
                        <h2 style="font-size:1.1rem;font-weight:800;color:#0f172a;margin:0;display:flex;align-items:center;gap:6px">
                            <span style="color:#0284c7;display:flex;align-items:center">${Icons.eye}</span> Vista Previa (${this.previewPreguntas.length})
                        </h2>
                        <span style="font-size:0.75rem;color:#64748b">Modalidad activa: <strong style="color:#0284c7">${this.config.modo.toUpperCase()}</strong></span>
                    </div>

                    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                        <button type="button" class="btn btn-ghost btn-sm text-xs" style="color:#b84a54;border:1px solid #fed7d7;background:#fff;padding:5px 10px;border-radius:7px;display:inline-flex;align-items:center;gap:4px;font-weight:600" onclick="AdminProfesoresPage.vaciarPreguntasPlantilla()">
                            ${Icons.trash} Vaciar base
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm text-xs" style="color:#0284c7;border:1px solid #bae6fd;background:#fff;padding:5px 10px;border-radius:7px;display:inline-flex;align-items:center;gap:4px;font-weight:600" onclick="AdminProfesoresPage.restaurarPreguntasPlantilla()">
                            ${Icons.rotateCcw} Restaurar base
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm text-xs" style="color:#b84a54;border:1px solid #fed7d7;background:#fff;padding:5px 10px;border-radius:7px;display:inline-flex;align-items:center;gap:4px;font-weight:600" onclick="AdminProfesoresPage.vaciarPreguntasProfesor()">
                            ${Icons.trash} Vaciar profesor
                        </button>
                    </div>
                </div>

                <div class="stack" style="max-height:480px;overflow-y:auto;gap:12px">
                    ${this.previewPreguntas.length === 0 ? `
                    <div class="dash-card text-center" style="padding:32px 14px;background:#f8fafc">
                        <p style="font-size:0.85rem;color:#64748b;margin:0">No hay preguntas disponibles para el modo seleccionado. Podés cargar nuevas preguntas o restaurar la plantilla base.</p>
                    </div>` : this.previewPreguntas.map((q, i) => `
                    <div style="background:#ffffff;padding:16px;border-radius:10px;border-left:4px solid ${q.es_plantilla ? '#0284c7' : '#6366f1'};border-top:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                            <span style="font-weight:800;font-size:0.84rem;color:#0f172a">Pregunta ${i + 1}</span>
                            ${q.es_plantilla ? `
                            <span class="badge badge-info" style="font-size:0.68rem;padding:3px 8px">
                                Plantilla Base
                            </span>` : `
                            <span class="badge" style="background:#eef2ff;color:#4f46e5;font-size:0.68rem;padding:3px 8px">
                                Docente Local
                            </span>`}
                        </div>
                        <p style="font-weight:700;color:#1e293b;font-size:0.88rem;margin-bottom:10px">${q.pregunta}</p>
                        <div class="grid-2" style="font-size:0.8rem;gap:6px">
                            <div style="background:#f8fafc;color:#334155;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0"><strong>A)</strong> ${q.opcion_a}</div>
                            <div style="background:#f8fafc;color:#334155;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0"><strong>B)</strong> ${q.opcion_b}</div>
                            <div style="background:#f8fafc;color:#334155;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0"><strong>C)</strong> ${q.opcion_c}</div>
                            <div style="background:#f8fafc;color:#334155;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0"><strong>D)</strong> ${q.opcion_d}</div>
                        </div>
                        <div style="margin-top:10px;font-size:0.8rem;font-weight:700;color:#059669;display:flex;align-items:center;gap:4px">
                            ${Icons.check} Respuesta correcta: Opción ${q.respuesta_correcta?.toUpperCase()}
                        </div>
                    </div>`).join('')}
                </div>
            </div>
        </div>`;
    }

    static async onModoChange(val) {
        this.config.modo = val;
        localStorage.setItem('profesor_selected_modo', val);

        const div = document.getElementById('hibridoConfigInputs');
        if (div) div.style.display = val === 'hibrido' ? 'block' : 'none';

        const cant_plantilla = parseInt(document.getElementById('cantPlantilla')?.value || this.config.cant_plantilla || 3);
        const cant_profesor = parseInt(document.getElementById('cantProfesor')?.value || this.config.cant_profesor || 3);

        try {
            await ApiService.adminUpdateConfigExamen({ modo: val, cant_plantilla, cant_profesor });
            Toast.success(`Modalidad de examen guardada: ${val.toUpperCase()}`);
            const previewRes = await ApiService.adminGetPreguntasPreview();
            this.previewPreguntas = previewRes.preguntas || [];
            const container = document.getElementById('profesoresTabContent');
            if (container) this.renderTabConfig(container);
        } catch (err) {
            Toast.error(err.message || 'Error al guardar la modalidad');
        }
    }

    static async guardarConfig(e) {
        if (e && e.preventDefault) e.preventDefault();
        const checkedRadio = document.querySelector('input[name="modoExamen"]:checked');
        const modo = checkedRadio ? checkedRadio.value : this.config.modo;
        localStorage.setItem('profesor_selected_modo', modo);

        const cant_plantilla = parseInt(document.getElementById('cantPlantilla')?.value || 3);
        const cant_profesor = parseInt(document.getElementById('cantProfesor')?.value || 3);

        try {
            await ApiService.adminUpdateConfigExamen({ modo, cant_plantilla, cant_profesor });
            Toast.success('Configuración del examen guardada exitosamente');
            const container = document.getElementById('profesoresTabContent');
            if (container) this.renderTabConfig(container);
        } catch (err) {
            Toast.error(err.message || 'Error al guardar la configuración');
        }
    }

    // ============================================================
    // TAB 2: BANCO DE PREGUNTAS
    // ============================================================
    static async renderTabPreguntas(container) {
        try {
            const data = await ApiService.adminGetPreguntas();
            this.preguntas = data.preguntas || [];
        } catch (err) {
            Toast.error('Error al cargar banco de preguntas');
        }

        container.innerHTML = `
        <div class="grid-2" style="gap:20px;align-items:start">
            <!-- COLUMNA 1: FORMULARIO CREAR PREGUNTA -->
            <div class="dash-card">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                    <span style="color:#0284c7;display:flex;align-items:center">${Icons.plus}</span>
                    <h2 style="font-size:1.1rem;font-weight:800;color:#0f172a;margin:0">Nueva Pregunta Docente</h2>
                </div>
                <p style="font-size:0.84rem;color:#64748b;margin-bottom:18px">Agregá preguntas personalizadas con 4 alternativas y consigna oficial:</p>

                <form onsubmit="AdminProfesoresPage.crearPregunta(event)">
                    <div class="stack">
                        <div class="form-group">
                            <label class="form-label text-xs">Pregunta / Consigna Reglamentaria *</label>
                            <textarea id="newPreguntaText" class="form-input text-xs" rows="3" placeholder="Ej: ¿Cuál es la velocidad máxima permitida en avenidas de Baradero según ordenanza vial?" required></textarea>
                        </div>

                        <div class="form-group">
                            <label class="form-label text-xs">Opción A *</label>
                            <input type="text" id="newOpA" class="form-input text-xs" placeholder="Opción A" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label text-xs">Opción B *</label>
                            <input type="text" id="newOpB" class="form-input text-xs" placeholder="Opción B" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label text-xs">Opción C *</label>
                            <input type="text" id="newOpC" class="form-input text-xs" placeholder="Opción C" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label text-xs">Opción D *</label>
                            <input type="text" id="newOpD" class="form-input text-xs" placeholder="Opción D" required>
                        </div>

                        <div class="grid-2">
                            <div class="form-group">
                                <label class="form-label text-xs">Respuesta Correcta *</label>
                                <select id="newCorrecta" class="form-input text-xs">
                                    <option value="a">Opción A</option>
                                    <option value="b">Opción B</option>
                                    <option value="c">Opción C</option>
                                    <option value="d">Opción D</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label class="form-label text-xs">Tipo de Origen</label>
                                <select id="newEsPlantilla" class="form-input text-xs">
                                    <option value="0" selected>Pregunta del Profesor</option>
                                    <option value="1">Plantilla Estándar</option>
                                </select>
                            </div>
                        </div>

                        <button type="submit" class="btn btn-primary btn-block mt-2" style="font-weight:700;padding:11px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;gap:6px">
                            ${Icons.plus} Guardar Pregunta en el Banco
                        </button>
                    </div>
                </form>
            </div>

            <!-- COLUMNA 2: LISTA DE PREGUNTAS CON BOTÓN DE VACIADO -->
            <div class="dash-card">
                <div class="flex-between mb-3" style="flex-wrap:wrap;gap:8px">
                    <h2 style="font-size:1.1rem;font-weight:800;color:#0f172a;margin:0;display:flex;align-items:center;gap:6px">
                        <span style="color:#0284c7;display:inline-flex">${Icons.database}</span> Banco de Reactivos (${this.preguntas.length})
                    </h2>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                        <button type="button" class="btn btn-ghost btn-sm text-xs" style="color:#b84a54;border:1px solid #fed7d7;background:#fff;padding:5px 10px;border-radius:7px;display:inline-flex;align-items:center;gap:4px;font-weight:600" onclick="AdminProfesoresPage.vaciarPreguntasPlantilla()">
                            ${Icons.trash} Vaciar base
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm text-xs" style="color:#0284c7;border:1px solid #bae6fd;background:#fff;padding:5px 10px;border-radius:7px;display:inline-flex;align-items:center;gap:4px;font-weight:600" onclick="AdminProfesoresPage.restaurarPreguntasPlantilla()">
                            ${Icons.rotateCcw} Restaurar base
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm text-xs" style="color:#b84a54;border:1px solid #fed7d7;background:#fff;padding:5px 10px;border-radius:7px;display:inline-flex;align-items:center;gap:4px;font-weight:600" onclick="AdminProfesoresPage.vaciarPreguntasProfesor()">
                            ${Icons.trash} Vaciar profesor
                        </button>
                    </div>
                </div>
                
                <div class="stack" style="max-height:520px;overflow-y:auto;gap:12px">
                    ${this.preguntas.length === 0 ? `
                    <div class="dash-card text-center" style="padding:32px 14px;background:#f8fafc">
                        <p style="font-size:0.85rem;color:#64748b;margin:0">No hay preguntas registradas actualmente en el banco.</p>
                    </div>` : this.preguntas.map((q) => `
                    <div style="background:#ffffff;padding:16px;border-radius:10px;border-left:4px solid ${q.es_plantilla ? '#0284c7' : '#6366f1'};border-top:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                            ${q.es_plantilla ? `
                            <span class="badge badge-info" style="font-size:0.68rem;padding:3px 8px">
                                Plantilla Base
                            </span>` : `
                            <span class="badge" style="background:#eef2ff;color:#4f46e5;font-size:0.68rem;padding:3px 8px">
                                Docente Local
                            </span>`}
                            <button class="btn btn-ghost btn-sm" onclick="AdminProfesoresPage.eliminarPregunta(${q.id})" style="color:#b84a54;font-size:0.75rem;padding:3px 8px;display:inline-flex;align-items:center;gap:4px;font-weight:600">
                                ${Icons.trash} Eliminar
                            </button>
                        </div>
                        <p style="font-weight:700;color:#1e293b;font-size:0.88rem;margin-bottom:10px">${q.pregunta}</p>
                        <div class="grid-2" style="font-size:0.8rem;gap:6px">
                            <div style="background:#f8fafc;color:#334155;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0"><strong>A)</strong> ${q.opcion_a}</div>
                            <div style="background:#f8fafc;color:#334155;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0"><strong>B)</strong> ${q.opcion_b}</div>
                            <div style="background:#f8fafc;color:#334155;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0"><strong>C)</strong> ${q.opcion_c}</div>
                            <div style="background:#f8fafc;color:#334155;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0"><strong>D)</strong> ${q.opcion_d}</div>
                        </div>
                        <div style="margin-top:10px;font-size:0.8rem;font-weight:700;color:#059669;display:flex;align-items:center;gap:4px">
                            ${Icons.check} Respuesta correcta: Opción ${q.respuesta_correcta?.toUpperCase()}
                        </div>
                    </div>`).join('')}
                </div>
            </div>
        </div>`;
    }

    static async crearPregunta(e) {
        e.preventDefault();
        const payload = {
            pregunta: document.getElementById('newPreguntaText').value,
            opcion_a: document.getElementById('newOpA').value,
            opcion_b: document.getElementById('newOpB').value,
            opcion_c: document.getElementById('newOpC').value,
            opcion_d: document.getElementById('newOpD').value,
            respuesta_correcta: document.getElementById('newCorrecta').value,
            es_plantilla: parseInt(document.getElementById('newEsPlantilla').value)
        };

        try {
            await ApiService.adminCreatePregunta(payload);
            Toast.success('Pregunta guardada en el banco correctamente');
            this.renderTabPreguntas(document.getElementById('profesoresTabContent'));
        } catch (err) {
            Toast.error(err.message || 'Error al guardar la pregunta');
        }
    }

    static async eliminarPregunta(id) {
        const ok = await ConfirmModal.show({
            title: 'Eliminar pregunta del banco',
            description: '¿Estás seguro de que querés eliminar esta pregunta del banco de evaluación teórica?',
            confirmText: 'Eliminar pregunta',
            cancelText: 'Cancelar',
            variant: 'danger',
            icon: Icons.trash
        });
        if (!ok) return;

        try {
            await ApiService.adminDeletePregunta(id);
            Toast.success('Pregunta eliminada');
            this.renderTabPreguntas(document.getElementById('profesoresTabContent'));
        } catch (err) {
            Toast.error(err.message || 'Error al eliminar');
        }
    }

    static async vaciarPreguntasProfesor() {
        const ok = await ConfirmModal.show({
            title: 'Vaciar banco de preguntas docentes',
            description: '¿Estás seguro de eliminar todas las preguntas creadas por profesores? Esta acción dejará el banco limpio para cargar nuevos reactivos personalizados.',
            confirmText: 'Vaciar preguntas de profesor',
            cancelText: 'Cancelar',
            variant: 'danger',
            icon: Icons.trash
        });
        if (!ok) return;

        try {
            const res = await ApiService.adminVaciarPreguntas(true);
            Toast.success(res.message || 'Preguntas del profesor vaciadas correctamente');
            this.loadTabData();
        } catch (err) {
            Toast.error(err.message || 'Error al vaciar preguntas');
        }
    }

    static async vaciarPreguntasPlantilla() {
        const ok = await ConfirmModal.show({
            title: 'Vaciar preguntas de plantilla base',
            description: '¿Estás seguro de eliminar todas las preguntas de la plantilla oficial base? Podrás restaurarlas más adelante.',
            confirmText: 'Vaciar plantilla base',
            cancelText: 'Cancelar',
            variant: 'danger',
            icon: Icons.trash
        });
        if (!ok) return;

        try {
            const res = await ApiService.adminVaciarPlantilla();
            Toast.success(res.message || 'Preguntas de plantilla base eliminadas');
            this.loadTabData();
        } catch (err) {
            Toast.error(err.message || 'Error al eliminar plantilla base');
        }
    }

    static async restaurarPreguntasPlantilla() {
        const ok = await ConfirmModal.show({
            title: 'Restaurar plantilla oficial base',
            description: 'Se volverán a cargar las preguntas predeterminadas oficiales de la plantilla base sin afectar las preguntas creadas por docentes.',
            confirmText: 'Restaurar plantilla',
            cancelText: 'Cancelar',
            variant: 'primary',
            icon: Icons.rotateCcw
        });
        if (!ok) return;

        try {
            const res = await ApiService.adminRestaurarPlantilla();
            Toast.success(res.message || 'Preguntas de plantilla base restauradas exitosamente');
            this.loadTabData();
        } catch (err) {
            Toast.error(err.message || 'Error al restaurar plantilla base');
        }
    }

    // ============================================================
    // TAB 3: MONITOREO EN TIEMPO REAL (LIVE PROCTORING & EXPULSIÓN)
    // ============================================================
    static async renderTabMonitoreo(container) {
        const fetchAndRenderMonitoreo = async () => {
            try {
                const res = await ApiService.adminGetExamenMonitoreo();
                this.estudiantes = res.estudiantes || [];
            } catch (e) {}

            container.innerHTML = `
            <div>
                <div class="flex-between mb-4" style="flex-wrap:wrap;gap:12px">
                    <div>
                        <h2 style="font-size:1.1rem;font-weight:800;color:#0f172a;margin:0;display:flex;align-items:center;gap:8px">
                            <span style="color:#0284c7;display:flex;align-items:center">${Icons.camera}</span> Centro de Supervisión Remota en Vivo
                        </h2>
                        <p style="font-size:0.82rem;color:#64748b;margin-top:2px">
                            Monitoreo en tiempo real de video del aspirante, captura de escritorio y detección anti-trampa con expulsión inmediata.
                        </p>
                    </div>
                    <span style="padding:6px 14px;font-size:0.75rem;border-radius:20px;background:#dcfce7;color:#15803d;border:1px solid #86efac;font-weight:700;display:inline-flex;align-items:center;gap:6px">
                        <span style="width:8px;height:8px;border-radius:50%;background:#22c55e;animation:pulse 1.5s infinite"></span>
                        Transmisión Activa
                    </span>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:18px">
                    ${this.estudiantes.length === 0 ? `
                    <div class="dash-card text-center" style="grid-column:1/-1;padding:48px 20px">
                        <div style="width:56px;height:56px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
                            ${Icons.camera}
                        </div>
                        <h3 style="font-size:1.05rem;font-weight:700;color:#0f172a;margin-bottom:6px">No hay alumnos rindiendo en este momento</h3>
                        <p style="font-size:0.85rem;color:#64748b;max-width:440px;margin:0 auto">Las sesiones activas de examen teórico con cámara web y pantalla compartida se sincronizarán aquí automáticamente.</p>
                    </div>` : this.estudiantes.map(st => `
                    <div class="dash-card" style="border-top:3px solid ${st.warnings_count > 0 ? '#e57373' : '#10b981'}">
                        <div class="flex-between mb-3">
                            <div>
                                <strong style="font-size:0.95rem;color:#0f172a">${st.nombre}</strong>
                                <div style="font-size:0.78rem;color:#64748b">DNI ${st.dni}</div>
                            </div>
                            <span class="badge ${st.warnings_count > 0 ? 'badge-danger' : 'badge-success'}" style="font-size:0.74rem;padding:4px 10px;display:inline-flex;align-items:center;gap:4px">
                                ${st.warnings_count > 0 ? `${Icons.alertTriangle} Alertas: ${st.warnings_count}` : `${Icons.check} Sin Alertas`}
                            </span>
                        </div>

                        <!-- STREAMING CAM Y SCREEN -->
                        <div class="grid-2" style="gap:10px;margin-bottom:12px">
                            <div style="position:relative;height:120px;background:#0f172a;border-radius:8px;overflow:hidden;border:1px solid #334155">
                                ${st.cam_frame ? `
                                <img src="${st.cam_frame}" style="width:100%;height:100%;object-fit:cover">` : `
                                <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:0.75rem">Sin video cámara</div>`}
                                <span style="position:absolute;bottom:4px;left:4px;background:rgba(15,23,42,0.8);color:#fff;font-size:0.65rem;padding:2px 6px;border-radius:4px">Cámara Web</span>
                            </div>

                            <div style="position:relative;height:120px;background:#0f172a;border-radius:8px;overflow:hidden;border:1px solid #334155">
                                ${st.screen_frame ? `
                                <img src="${st.screen_frame}" style="width:100%;height:100%;object-fit:cover">` : `
                                <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:0.75rem">Sin pantalla</div>`}
                                <span style="position:absolute;bottom:4px;left:4px;background:rgba(15,23,42,0.8);color:#fff;font-size:0.65rem;padding:2px 6px;border-radius:4px">Escritorio</span>
                            </div>
                        </div>

                        <div class="flex-between text-xs mb-3" style="background:#f8fafc;padding:10px 12px;border-radius:8px;color:#334155;border:1px solid #e2e8f0">
                            <span>Pregunta activa: <strong style="color:#0284c7">${st.current_question}/5</strong></span>
                            <span>Tiempo: <strong>${st.elapsed_seconds || 0} s</strong></span>
                            ${st.tiene_cud ? `<span class="badge badge-success" style="font-size:0.65rem;padding:2px 6px">${Icons.wheelchair} CUD</span>` : ''}
                        </div>

                        <!-- BOTÓN DE EXPULSIÓN INMEDIATA EN VIVO -->
                        <button class="btn btn-primary btn-block btn-sm" style="background:#d95360;color:#fff;border:none;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:8px" onclick="AdminProfesoresPage.expulsarEstudiante(${st.tramite_id}, '${st.nombre}')">
                            ${Icons.ban} Expulsar por Falta Grave
                        </button>
                    </div>`).join('')}
                </div>
            </div>`;
        };

        await fetchAndRenderMonitoreo();
        this.monitorInterval = setInterval(fetchAndRenderMonitoreo, 2000);
    }

    static async expulsarEstudiante(tramiteId, nombre) {
        const motivo = await ConfirmModal.prompt({
            title: `Expulsar a ${nombre} del examen`,
            description: 'La sesión del aspirante se cerrará de inmediato por falta reglamentaria y el examen quedará anulado.',
            placeholder: 'Motivo de la expulsión...',
            defaultValue: 'Detectadas alertas reiteradas de cambio de pestaña / desvío de cámara',
            confirmText: 'Expulsar Alumno',
            cancelText: 'Cancelar',
            variant: 'danger',
            icon: Icons.ban,
            required: true
        });
        if (!motivo) return;

        try {
            await ApiService.adminExpulsarExamen(tramiteId, motivo);
            Toast.success(`El alumno ${nombre} ha sido expulsado del examen.`);
            this.loadTabData();
        } catch (err) {
            Toast.error(err.message || 'Error al expulsar alumno');
        }
    }

    // ============================================================
    // TAB 4: EXÁMENES A REVISAR & DICTAMEN CON JUSTIFICACIÓN OBLIGATORIA
    // ============================================================
    static async renderTabRevision(container) {
        try {
            const res = await ApiService.adminGetExamenesRevision();
            this.revisionExamenes = res.examenes || [];
        } catch (err) {
            Toast.error('Error al cargar exámenes a revisar');
        }

        container.innerHTML = `
        <div>
            <div class="flex-between mb-4">
                <div>
                    <h2 style="font-size:1.1rem;font-weight:800;color:#0f172a;margin:0;display:flex;align-items:center;gap:8px">
                        <span style="color:#0284c7;display:flex;align-items:center">${Icons.fileCheck}</span> Evaluaciones Entregadas y Dictamen Docente
                    </h2>
                    <p style="font-size:0.82rem;color:#64748b;margin-top:2px">
                        Revisá las respuestas de los aspirantes, porcentaje de aprobación, incidentes reportados y emití el dictamen fundado.
                    </p>
                </div>
            </div>

            <div class="stack" style="gap:14px">
                ${this.revisionExamenes.length === 0 ? `
                <div class="dash-card text-center" style="padding:48px 20px">
                    <div style="width:56px;height:56px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
                        ${Icons.doc}
                    </div>
                    <h3 style="font-size:1.05rem;font-weight:700;color:#0f172a;margin-bottom:6px">No hay exámenes entregados pendientes</h3>
                    <p style="font-size:0.85rem;color:#64748b;max-width:440px;margin:0 auto">Los exámenes finalizados por los ciudadanos aparecerán aquí para dictamen oficial.</p>
                </div>` : this.revisionExamenes.map(ex => {
                    let statusBadge = `<span class="badge badge-pending" style="font-size:0.76rem;padding:5px 10px;display:inline-flex;align-items:center;gap:4px">${Icons.clock} PENDIENTE DE REVISIÓN</span>`;
                    if (ex.expulsado) {
                        statusBadge = `<span class="badge badge-danger" style="font-size:0.76rem;padding:5px 10px;display:inline-flex;align-items:center;gap:4px">${Icons.ban} EXPULSADO</span>`;
                    } else if (ex.estado_revision === 'aprobado') {
                        statusBadge = `<span class="badge badge-success" style="font-size:0.76rem;padding:5px 10px;display:inline-flex;align-items:center;gap:4px">${Icons.checkCircle} APROBADO</span>`;
                    } else if (ex.estado_revision === 'desaprobado') {
                        statusBadge = `<span class="badge badge-danger" style="font-size:0.76rem;padding:5px 10px;display:inline-flex;align-items:center;gap:4px">${Icons.xCircle} DESAPROBADO</span>`;
                    }

                    return `
                <div class="dash-card" style="border-left:4px solid ${ex.estado_revision === 'aprobado' ? '#10b981' : (ex.estado_revision === 'desaprobado' ? '#e57373' : '#0284c7')}">
                    <div class="flex-between mb-3" style="flex-wrap:wrap;gap:10px">
                        <div style="display:flex;align-items:center;gap:12px">
                            <div class="admin-item__avatar">
                                ${ex.nombre ? ex.nombre.charAt(0).toUpperCase() : 'A'}
                            </div>
                            <div>
                                <h3 style="font-size:1rem;font-weight:800;color:#0f172a;margin:0">${ex.nombre} ${ex.apellido}</h3>
                                <div style="font-size:0.8rem;color:#64748b;margin-top:2px"><strong>DNI:</strong> ${ex.dni} · <strong>Trámite:</strong> #${ex.tramite_id} · <strong>Fecha:</strong> ${ex.created_at || ''}</div>
                            </div>
                        </div>

                        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                            <span class="badge badge-info" style="font-size:0.78rem;padding:5px 12px;font-variant-numeric:tabular-nums">
                                Acierto: ${ex.porcentaje_acierto || Math.round(((ex.puntaje || 0) / (ex.total_preguntas || 1)) * 100)}% (${ex.puntaje || 0}/${ex.total_preguntas || 0})
                            </span>
                            ${statusBadge}
                        </div>
                    </div>

                    ${ex.motivo_justificacion ? `
                    <div style="background:#f8fafc;padding:12px;border-radius:8px;border-left:3px solid #0284c7;margin-bottom:14px">
                        <strong style="font-size:0.8rem;color:#0f172a">Justificación del Docente:</strong>
                        <p style="font-size:0.82rem;color:#475569;margin:4px 0 0 0">${ex.motivo_justificacion}</p>
                    </div>` : ''}

                    <!-- ACCIONES DE DICTAMEN DE REVISIÓN -->
                    <div style="background:#f8fafc;padding:16px;border-radius:10px;border:1px solid #e2e8f0">
                        <label class="form-label text-xs font-bold mb-1">Dictamen / Justificación Pedagógica Oficial *</label>
                        <input type="text" id="motivo_${ex.tramite_id}" class="form-input text-xs mb-3" placeholder="Ej: Cumple con el porcentaje reglamentario (mínimo 70%) sin incidencias en proctoring." value="${ex.motivo_justificacion || ''}">

                        <div style="display:flex;gap:10px;flex-wrap:wrap">
                            <button type="button" class="btn btn-sm" style="background:#059669;color:#fff;border:none;font-weight:700;display:inline-flex;align-items:center;gap:6px;border-radius:8px" onclick="AdminProfesoresPage.dictaminarExamen(${ex.tramite_id}, 'aprobar')">
                                ${Icons.check} Dictaminar Aprobado
                            </button>
                            <button type="button" class="btn btn-sm" style="background:#d95360;color:#fff;border:none;font-weight:700;display:inline-flex;align-items:center;gap:6px;border-radius:8px" onclick="AdminProfesoresPage.dictaminarExamen(${ex.tramite_id}, 'desaprobar')">
                                ${Icons.x} Dictaminar Reprobado
                            </button>
                            <button type="button" class="btn btn-outline btn-sm text-xs" style="border-radius:8px;background:#fff;display:inline-flex;align-items:center;gap:6px;font-weight:600" onclick="AdminProfesoresPage.enviarChatDirecto(${ex.tramite_id}, '${ex.nombre}')">
                                ${Icons.mail} Enviar Notificación Directa al Alumno
                            </button>
                        </div>
                    </div>
                </div>`;
                }).join('')}
            </div>
        </div>`;
    }

    static async dictaminarExamen(tramiteId, decision) {
        const input = document.getElementById(`motivo_${tramiteId}`);
        const motivo = input?.value || (decision === 'aprobar' ? 'Aprobado según criterios y porcentaje exigido' : 'No alcanza los criterios mínimos de evaluación');

        const ok = await ConfirmModal.show({
            title: decision === 'aprobar' ? 'Confirmar aprobación de examen teórico' : 'Confirmar reprobación de examen teórico',
            description: `Se emitirá el dictamen oficial con la justificación: "${motivo}".`,
            confirmText: decision === 'aprobar' ? 'Dictaminar Aprobado' : 'Dictaminar Reprobado',
            cancelText: 'Cancelar',
            variant: decision === 'aprobar' ? 'success' : 'danger',
            icon: decision === 'aprobar' ? Icons.checkCircle : Icons.xCircle
        });
        if (!ok) return;

        try {
            await ApiService.adminRevisarExamen(tramiteId, decision, motivo);
            Toast.success(`Examen ${decision === 'aprobar' ? 'APROBADO' : 'DESAPROBADO'} con justificación guardada`);
            this.loadTabData();
        } catch (err) {
            Toast.error(err.message || 'Error al procesar dictamen');
        }
    }

    static async enviarChatDirecto(tramiteId, nombre) {
        const mensaje = await ConfirmModal.prompt({
            title: `Enviar notificación oficial a ${nombre}`,
            description: 'El mensaje se registrará en la bandeja del ciudadano como comunicación directa del equipo docente.',
            placeholder: 'Escribí la observación o justificación académica...',
            confirmText: 'Enviar Notificación',
            cancelText: 'Cancelar',
            variant: 'primary',
            icon: Icons.mail,
            required: true
        });
        if (!mensaje) return;

        try {
            await ApiService.adminEnviarMensajeProfesor(tramiteId, mensaje);
            Toast.success('Justificación enviada al alumno correctamente');
        } catch (err) {
            Toast.error(err.message || 'Error al enviar mensaje');
        }
    }
}
