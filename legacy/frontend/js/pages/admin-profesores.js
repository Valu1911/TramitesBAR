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
                        <h1 style="font-size:1.6rem;font-weight:800;color:#ffffff;margin-bottom:6px;font-family:var(--font-title);letter-spacing:-0.02em">
                            Gestión de Exámenes Teóricos de Conducir
                        </h1>
                        <p style="color:rgba(255,255,255,0.85);font-size:0.88rem;max-width:680px;margin:0">
                            Configuración del banco de reactivos, supervisión biométrica en tiempo real por streaming y dictamen oficial con justificación pedagógica.
                        </p>
                    </div>
                </div>
            </div>

            <!-- TABS DE NAVEGACIÓN SUBI -->
            <div class="admin-filter-bar" style="margin-bottom:20px">
                <div class="admin-tabs-list">
                    <button class="admin-tab-btn ${this.activeTab === 'config' ? 'active' : ''}" onclick="AdminProfesoresPage.switchTab('config')">
                        ${Icons.settings} Configuración & Vista Previa
                    </button>
                    <button class="admin-tab-btn ${this.activeTab === 'preguntas' ? 'active' : ''}" onclick="AdminProfesoresPage.switchTab('preguntas')">
                        ${Icons.doc} Banco de Preguntas
                    </button>
                    <button class="admin-tab-btn ${this.activeTab === 'monitoreo' ? 'active' : ''}" onclick="AdminProfesoresPage.switchTab('monitoreo')">
                        ${Icons.camera} Monitoreo en Tiempo Real
                    </button>
                    <button class="admin-tab-btn ${this.activeTab === 'revision' ? 'active' : ''}" onclick="AdminProfesoresPage.switchTab('revision')">
                        ${Icons.check} Exámenes a Revisar & Dictamen
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
            Toast.error('Error al cargar configuración del examen');
        }

        container.innerHTML = `
        <div class="grid-2" style="gap:20px;align-items:start">
            <!-- COLUMNA 1: SELECCIÓN DE MODO DE EXAMEN -->
            <div class="dash-card">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                    <span style="color:#0284c7;display:flex;align-items:center">${Icons.settings}</span>
                    <h2 style="font-size:1.15rem;font-weight:800;color:var(--text-primary);margin:0">Modalidad de Evaluación</h2>
                </div>
                <p style="font-size:0.84rem;color:var(--text-secondary);margin-bottom:18px">Elegí la modalidad con la que el sistema compilará las preguntas para los aspirantes:</p>

                <form onsubmit="AdminProfesoresPage.guardarConfig(event)">
                    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px">
                        <!-- OPCIÓN 1: PLANTILLA -->
                        <label style="border:1.5px solid ${this.config.modo === 'plantilla' ? '#0284c7' : '#e2e8f0'};border-radius:12px;padding:14px;display:block;cursor:pointer;background:${this.config.modo === 'plantilla' ? '#eff6ff' : '#ffffff'};transition:all 0.15s ease">
                            <div style="display:flex;align-items:center;gap:12px">
                                <input type="radio" name="modoExamen" value="plantilla" ${this.config.modo === 'plantilla' ? 'checked' : ''} onchange="AdminProfesoresPage.onModoChange(this.value)" style="width:18px;height:18px">
                                <div>
                                    <strong style="font-size:0.92rem;color:#0f172a;display:block">1. Modo Plantilla Estándar</strong>
                                    <span style="font-size:0.8rem;color:#64748b">Preguntas oficiales base estandarizadas por la Agencia Provincial de Seguridad Vial.</span>
                                </div>
                            </div>
                        </label>

                        <!-- OPCIÓN 2: PERSONALIZADO -->
                        <label style="border:1.5px solid ${this.config.modo === 'personalizado' ? '#0284c7' : '#e2e8f0'};border-radius:12px;padding:14px;display:block;cursor:pointer;background:${this.config.modo === 'personalizado' ? '#eff6ff' : '#ffffff'};transition:all 0.15s ease">
                            <div style="display:flex;align-items:center;gap:12px">
                                <input type="radio" name="modoExamen" value="personalizado" ${this.config.modo === 'personalizado' ? 'checked' : ''} onchange="AdminProfesoresPage.onModoChange(this.value)" style="width:18px;height:18px">
                                <div>
                                    <strong style="font-size:0.92rem;color:#0f172a;display:block">2. Modo Personalizado (Profesor)</strong>
                                    <span style="font-size:0.8rem;color:#64748b">Utiliza exclusivamente preguntas elaboradas y cargadas por el equipo docente local.</span>
                                </div>
                            </div>
                        </label>

                        <!-- OPCIÓN 3: HÍBRIDO -->
                        <label style="border:1.5px solid ${this.config.modo === 'hibrido' ? '#0284c7' : '#e2e8f0'};border-radius:12px;padding:14px;display:block;cursor:pointer;background:${this.config.modo === 'hibrido' ? '#eff6ff' : '#ffffff'};transition:all 0.15s ease">
                            <div style="display:flex;align-items:center;gap:12px">
                                <input type="radio" name="modoExamen" value="hibrido" ${this.config.modo === 'hibrido' ? 'checked' : ''} onchange="AdminProfesoresPage.onModoChange(this.value)" style="width:18px;height:18px">
                                <div>
                                    <strong style="font-size:0.92rem;color:#0f172a;display:block">3. Modo Híbrido (Combinado sin duplicados)</strong>
                                    <span style="font-size:0.8rem;color:#64748b">Combina reactivos de plantilla estándar con preguntas locales del profesor.</span>
                                </div>
                            </div>
                        </label>
                    </div>

                    <div id="hibridoConfigInputs" style="display:${this.config.modo === 'hibrido' ? 'block' : 'none'};background:#f8fafc;padding:14px;border-radius:12px;margin-bottom:18px;border:1px solid #e2e8f0">
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

                    <button type="submit" class="btn btn-primary btn-block" style="font-weight:700;padding:12px">
                        Guardar Modalidad de Examen
                    </button>
                </form>
            </div>

            <!-- COLUMNA 2: VISTA PREVIA DE PREGUNTAS EN VIVO -->
            <div class="dash-card">
                <div class="flex-between mb-3" style="flex-wrap:wrap;gap:8px">
                    <div>
                        <h2 style="font-size:1.15rem;font-weight:800;color:var(--text-primary);margin:0;display:flex;align-items:center;gap:6px">
                            <span style="color:#0284c7;display:flex;align-items:center">${Icons.doc}</span> Vista Previa (${this.previewPreguntas.length})
                        </h2>
                        <span style="font-size:0.75rem;color:#64748b">Modalidad: <strong style="color:#0284c7">${this.config.modo.toUpperCase()}</strong></span>
                    </div>

                    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                        <button type="button" class="btn btn-ghost btn-sm text-xs" style="color:#ef4444;border:1px solid #fca5a5;padding:4px 8px;display:inline-flex;align-items:center;gap:4px;font-weight:700" onclick="AdminProfesoresPage.vaciarPreguntasPlantilla()">
                            ${Icons.x} Vaciar base
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm text-xs" style="color:#0284c7;border:1px solid #bae6fd;padding:4px 8px;display:inline-flex;align-items:center;gap:4px;font-weight:700" onclick="AdminProfesoresPage.restaurarPreguntasPlantilla()">
                            ${Icons.check} Restaurar base
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm text-xs" style="color:#dc2626;border:1px solid #fca5a5;padding:4px 8px;display:inline-flex;align-items:center;gap:4px;font-weight:700" onclick="AdminProfesoresPage.vaciarPreguntasProfesor()">
                            ${Icons.x} Vaciar profesor
                        </button>
                    </div>
                </div>

                <div class="stack" style="max-height:480px;overflow-y:auto;gap:12px">
                    ${this.previewPreguntas.length === 0 ? `
                    <div class="dash-card text-center" style="padding:32px 14px;background:#f8fafc">
                        <p style="font-size:0.85rem;color:#64748b;margin:0">No hay preguntas disponibles para el modo seleccionado. Podés cargar nuevas preguntas o restaurar la plantilla base.</p>
                    </div>` : this.previewPreguntas.map((q, i) => `
                    <div style="background:#ffffff;padding:16px;border-radius:12px;border-left:4px solid ${q.es_plantilla ? '#0284c7' : '#9333ea'};border-top:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;box-shadow:var(--shadow-sm)">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                            <span style="font-weight:800;font-size:0.85rem;color:#0f172a">Pregunta ${i + 1}</span>
                            ${q.es_plantilla ? `
                            <span class="badge badge-info" style="font-size:0.68rem;padding:3px 8px">
                                Plantilla Base
                            </span>` : `
                            <span class="badge" style="background:#f3e8ff;color:#7e22ce;font-size:0.68rem;padding:3px 8px">
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
                            ${Icons.check} Correcta: Opción ${q.respuesta_correcta?.toUpperCase()}
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
            Toast.success('¡Configuración del examen guardada exitosamente!');
            const container = document.getElementById('profesoresTabContent');
            if (container) this.renderTabConfig(container);
        } catch (err) {
            Toast.error(err.message || 'Error al guardar la configuración');
        }
    }


    // ============================================================
    // TAB 2: BANCO DE PREGUNTAS
    // =========================    static async renderTabPreguntas(container) {
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
                    <span style="color:#0284c7;display:flex;align-items:center">${Icons.doc}</span>
                    <h2 style="font-size:1.15rem;font-weight:800;color:var(--text-primary);margin:0">Nueva Pregunta Docente</h2>
                </div>
                <p style="font-size:0.84rem;color:var(--text-secondary);margin-bottom:18px">Agregá preguntas personalizadas con 4 alternativas y consigna oficial:</p>

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

                        <button type="submit" class="btn btn-primary btn-block mt-2" style="font-weight:700;padding:12px">
                            Guardar Pregunta en el Banco
                        </button>
                    </div>
                </form>
            </div>

            <!-- COLUMNA 2: LISTA DE PREGUNTAS CON BOTÓN DE VACIADO -->
            <div class="dash-card">
                <div class="flex-between mb-3" style="flex-wrap:wrap;gap:8px">
                    <h2 style="font-size:1.15rem;font-weight:800;color:var(--text-primary);margin:0">Banco de Reactivos (${this.preguntas.length})</h2>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                        <button type="button" class="btn btn-ghost btn-sm text-xs" style="color:#ef4444;border:1px solid #fca5a5;padding:4px 8px;display:inline-flex;align-items:center;gap:4px;font-weight:700" onclick="AdminProfesoresPage.vaciarPreguntasPlantilla()">
                            ${Icons.x} Vaciar base
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm text-xs" style="color:#0284c7;border:1px solid #bae6fd;padding:4px 8px;display:inline-flex;align-items:center;gap:4px;font-weight:700" onclick="AdminProfesoresPage.restaurarPreguntasPlantilla()">
                            ${Icons.check} Restaurar base
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm text-xs" style="color:#dc2626;border:1px solid #fca5a5;padding:4px 8px;display:inline-flex;align-items:center;gap:4px;font-weight:700" onclick="AdminProfesoresPage.vaciarPreguntasProfesor()">
                            ${Icons.x} Vaciar profesor
                        </button>
                    </div>
                </div>
                
                <div class="stack" style="max-height:520px;overflow-y:auto;gap:12px">
                    ${this.preguntas.length === 0 ? `
                    <div class="dash-card text-center" style="padding:32px 14px;background:#f8fafc">
                        <p style="font-size:0.85rem;color:#64748b;margin:0">No hay preguntas registradas actualmente en el banco.</p>
                    </div>` : this.preguntas.map((q, i) => `
                    <div style="background:#ffffff;padding:16px;border-radius:12px;border-left:4px solid ${q.es_plantilla ? '#0284c7' : '#9333ea'};border-top:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;box-shadow:var(--shadow-sm)">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                            ${q.es_plantilla ? `
                            <span class="badge badge-info" style="font-size:0.68rem;padding:3px 8px">
                                Plantilla Base
                            </span>` : `
                            <span class="badge" style="background:#f3e8ff;color:#7e22ce;font-size:0.68rem;padding:3px 8px">
                                Docente Local
                            </span>`}
                            <button class="btn btn-ghost btn-sm" onclick="AdminProfesoresPage.eliminarPregunta(${q.id})" style="color:#ef4444;font-size:0.75rem;padding:2px 8px;display:inline-flex;align-items:center;gap:2px">
                                ${Icons.x} Eliminar
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
                            ${Icons.check} Correcta: Opción ${q.respuesta_correcta?.toUpperCase()}
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
            Toast.success('¡Pregunta guardada en el banco correctamente!');
            this.renderTabPreguntas(document.getElementById('profesoresTabContent'));
        } catch (err) {
            Toast.error(err.message || 'Error al guardar la pregunta');
        }
    }

    static async eliminarPregunta(id) {
        if (!confirm('¿Eliminar esta pregunta del banco de examen?')) return;
        try {
            await ApiService.adminDeletePregunta(id);
            Toast.success('Pregunta eliminada');
            this.renderTabPreguntas(document.getElementById('profesoresTabContent'));
        } catch (err) {
            Toast.error(err.message || 'Error al eliminar');
        }
    }

    static async vaciarPreguntasProfesor() {
        if (!confirm('¿Estás seguro/a de eliminar TODAS las preguntas creadas por profesores? Esta acción dejará el banco limpio para crear nuevas preguntas personalizadas.')) return;
        try {
            const res = await ApiService.adminVaciarPreguntas(true);
            Toast.success(res.message || 'Preguntas del profesor vaciadas correctamente');
            this.loadTabData();
        } catch (err) {
            Toast.error(err.message || 'Error al vaciar preguntas');
        }
    }

    static async vaciarPreguntasPlantilla() {
        if (!confirm('¿Estás seguro/a de eliminar TODAS las preguntas de la plantilla base?')) return;
        try {
            const res = await ApiService.adminVaciarPlantilla();
            Toast.success(res.message || 'Preguntas de plantilla base eliminadas');
            this.loadTabData();
        } catch (err) {
            Toast.error(err.message || 'Error al eliminar plantilla base');
        }
    }

    static async restaurarPreguntasPlantilla() {
        if (!confirm('¿Restaurar las preguntas predeterminadas de la plantilla base?')) return;
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
                        <h2 style="font-size:1.15rem;font-weight:800;color:var(--text-primary);margin:0;display:flex;align-items:center;gap:8px">
                            <span style="color:#ef4444;display:flex;align-items:center">${Icons.camera}</span> Centro de Supervisión Remota en Vivo
                        </h2>
                        <p style="font-size:0.82rem;color:var(--text-secondary);margin-top:2px">
                            Monitoreo en tiempo real de video del aspirante, captura de escritorio y detección anti-trampa con expulsión inmediata.
                        </p>
                    </div>
                    <span style="padding:6px 14px;font-size:0.75rem;border-radius:20px;background:#dcfce7;color:#15803d;border:1px solid #86efac;font-weight:800;display:inline-flex;align-items:center;gap:6px">
                        <span style="width:8px;height:8px;border-radius:50%;background:#22c55e;animation:pulse 1.5s infinite"></span>
                        Transmisión en Vivo
                    </span>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:18px">
                    ${this.estudiantes.length === 0 ? `
                    <div class="dash-card text-center" style="grid-column:1/-1;padding:48px 20px">
                        <div style="width:64px;height:64px;border-radius:50%;background:#eff6ff;color:#0284c7;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:2rem">
                            ${Icons.camera}
                        </div>
                        <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-bottom:6px">No hay alumnos rindiendo en este momento</h3>
                        <p style="font-size:0.85rem;color:var(--text-muted);max-width:440px;margin:0 auto">Las sesiones activas de examen teórico con cámara web y pantalla compartida se sincronizarán aquí automáticamente.</p>
                    </div>` : this.estudiantes.map(st => `
                    <div class="dash-card" style="border-top:4px solid ${st.warnings_count > 0 ? '#ef4444' : '#10b981'}">
                        <div class="flex-between mb-3">
                            <div>
                                <strong style="font-size:0.95rem;color:#0f172a">${st.nombre}</strong>
                                <div style="font-size:0.78rem;color:#64748b">DNI ${st.dni}</div>
                            </div>
                            <span class="badge ${st.warnings_count > 0 ? 'badge-danger' : 'badge-success'}" style="font-size:0.75rem;padding:4px 10px">
                                ${st.warnings_count > 0 ? `⚠️ Alt-Tab: ${st.warnings_count}` : '✓ Sin Alertas'}
                            </span>
                        </div>

                        <!-- STREAMING CAM Y SCREEN -->
                        <div class="grid-2" style="gap:10px;margin-bottom:12px">
                            <div style="position:relative;height:120px;background:#0f172a;border-radius:10px;overflow:hidden;border:1px solid #334155">
                                ${st.cam_frame ? `
                                <img src="${st.cam_frame}" style="width:100%;height:100%;object-fit:cover">` : `
                                <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:0.75rem">Sin video cam</div>`}
                                <span style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,0.7);color:#fff;font-size:0.65rem;padding:2px 6px;border-radius:4px">Cámara Web</span>
                            </div>

                            <div style="position:relative;height:120px;background:#0f172a;border-radius:10px;overflow:hidden;border:1px solid #334155">
                                ${st.screen_frame ? `
                                <img src="${st.screen_frame}" style="width:100%;height:100%;object-fit:cover">` : `
                                <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:0.75rem">Sin pantalla</div>`}
                                <span style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,0.7);color:#fff;font-size:0.65rem;padding:2px 6px;border-radius:4px">Pantalla Entera</span>
                            </div>
                        </div>

                        <div class="flex-between text-xs mb-3" style="background:#f8fafc;padding:10px 12px;border-radius:10px;color:#334155;border:1px solid #e2e8f0">
                            <span>Pregunta activa: <strong style="color:#0284c7">${st.current_question}/5</strong></span>
                            <span>Tiempo transcurrido: <strong>${st.elapsed_seconds || 0} seg</strong></span>
                            ${st.tiene_cud ? `<span class="badge badge-success" style="font-size:0.65rem;padding:2px 6px">${Icons.wheelchair} CUD</span>` : ''}
                        </div>

                        <!-- BOTÓN DE EXPULSIÓN INMEDIATA EN VIVO -->
                        <button class="btn btn-primary btn-block btn-sm" style="background:#ef4444;color:#fff;border:none;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:8px" onclick="AdminProfesoresPage.expulsarEstudiante(${st.tramite_id}, '${st.nombre}')">
                            ${Icons.x} Expulsar por Falta Grave
                        </button>
                    </div>`).join('')}
                </div>
            </div>`;
        };

        await fetchAndRenderMonitoreo();
        this.monitorInterval = setInterval(fetchAndRenderMonitoreo, 2000);
    }

    static async expulsarEstudiante(tramiteId, nombre) {
        const motivo = prompt(`¿Motivo de la expulsión en tiempo real para ${nombre}?`, 'Detectadas alertas reiteradas de cambio de pestaña / Alt-Tab');
        if (!motivo) return;

        try {
            await ApiService.adminExpulsarExamen(tramiteId, motivo);
            Toast.success(`¡El alumno ${nombre} ha sido expulsado del examen!`);
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
                    <h2 style="font-size:1.15rem;font-weight:800;color:var(--text-primary);margin:0;display:flex;align-items:center;gap:8px">
                        <span style="color:#0284c7;display:flex;align-items:center">${Icons.check}</span> Evaluaciones Entregadas & Dictamen Docente
                    </h2>
                    <p style="font-size:0.82rem;color:var(--text-secondary);margin-top:2px">
                        Revisá las respuestas de los aspirantes, porcentaje de aprobación, incidentes reportados y emití el dictamen fundado.
                    </p>
                </div>
            </div>

            <div class="stack" style="gap:16px">
                ${this.revisionExamenes.length === 0 ? `
                <div class="dash-card text-center" style="padding:48px 20px">
                    <div style="width:64px;height:64px;border-radius:50%;background:#eff6ff;color:#0284c7;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:2rem">
                        ${Icons.doc}
                    </div>
                    <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-bottom:6px">No hay exámenes entregados pendientes</h3>
                    <p style="font-size:0.85rem;color:var(--text-muted);max-width:440px;margin:0 auto">Los exámenes finalizados por los ciudadanos aparecerán aquí para dictamen oficial.</p>
                </div>` : this.revisionExamenes.map(ex => `
                <div class="dash-card" style="border-left:4px solid ${ex.estado_revision === 'aprobado' ? '#10b981' : (ex.estado_revision === 'desaprobado' ? '#ef4444' : '#0284c7')}">
                    <div class="flex-between mb-3" style="flex-wrap:wrap;gap:10px">
                        <div>
                            <h3 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin:0">${ex.nombre} ${ex.apellido}</h3>
                            <div style="font-size:0.8rem;color:#64748b;margin-top:2px"><strong>DNI:</strong> ${ex.dni} · <strong>Trámite:</strong> #${ex.tramite_id} · <strong>Fecha:</strong> ${ex.created_at || ''}</div>
                        </div>

                        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                            <span class="badge badge-info" style="font-size:0.8rem;padding:5px 12px">
                                Acierto: ${ex.porcentaje_acierto || Math.round(((ex.puntaje || 0) / (ex.total_preguntas || 1)) * 100)}% (${ex.puntaje || 0}/${ex.total_preguntas || 0})
                            </span>

                            <span class="badge ${ex.estado_revision === 'aprobado' ? 'badge-success' : (ex.estado_revision === 'desaprobado' || ex.expulsado ? 'badge-danger' : 'badge-pending')}" style="font-size:0.8rem;padding:5px 12px">
                                ${ex.expulsado ? '🚫 EXPULSADO' : (ex.estado_revision === 'aprobado' ? '✅ APROBADO' : (ex.estado_revision === 'desaprobado' ? '❌ DESAPROBADO' : '⏳ PENDIENTE DE REVISIÓN'))}
                            </span>
                        </div>
                    </div>

                    ${ex.motivo_justificacion ? `
                    <div style="background:#f8fafc;padding:12px;border-radius:8px;border-left:3px solid #0284c7;margin-bottom:14px">
                        <strong style="font-size:0.8rem;color:#0f172a">Justificación del Docente:</strong>
                        <p style="font-size:0.82rem;color:#475569;margin:4px 0 0 0">${ex.motivo_justificacion}</p>
                    </div>` : ''}

                    <!-- ACCIONES DE DICTAMEN DE REVISIÓN -->
                    <div style="background:#f8fafc;padding:16px;border-radius:12px;border:1px solid #e2e8f0">
                        <label class="form-label text-xs font-bold mb-1">Dictamen / Justificación Pedagógica Oficial *</label>
                        <input type="text" id="motivo_${ex.tramite_id}" class="form-input text-xs mb-3" placeholder="Ej: Cumple con el porcentaje reglamentario (mínimo 70%) sin incidencias en proctoring." value="${ex.motivo_justificacion || ''}">

                        <div style="display:flex;gap:10px;flex-wrap:wrap">
                            <button type="button" class="btn btn-sm" style="background:#10b981;color:#fff;font-weight:700;display:inline-flex;align-items:center;gap:6px;border-radius:8px" onclick="AdminProfesoresPage.dictaminarExamen(${ex.tramite_id}, 'aprobar')">
                                ${Icons.check} Dictaminar Aprobado
                            </button>
                            <button type="button" class="btn btn-sm" style="background:#ef4444;color:#fff;font-weight:700;display:inline-flex;align-items:center;gap:6px;border-radius:8px" onclick="AdminProfesoresPage.dictaminarExamen(${ex.tramite_id}, 'desaprobar')">
                                ${Icons.x} Dictaminar Reprobado
                            </button>
                            <button type="button" class="btn btn-outline btn-sm text-xs" style="border-radius:8px" onclick="AdminProfesoresPage.enviarChatDirecto(${ex.tramite_id}, '${ex.nombre}')">
                                ✉️ Enviar Notificación Directa al Alumno
                            </button>
                        </div>
                    </div>
                </div>`).join('')}
            </div>
        </div>`;
    }

    static async dictaminarExamen(tramiteId, decision) {
        const input = document.getElementById(`motivo_${tramiteId}`);
        const motivo = input?.value || (decision === 'aprobar' ? 'Aprobado según criterios y porcentaje exigido' : 'No alcanza los criterios mínimos de evaluación');

        try {
            await ApiService.adminRevisarExamen(tramiteId, decision, motivo);
            Toast.success(`Examen ${decision === 'aprobar' ? 'APROBADO' : 'DESAPROBADO'} con justificación guardada`);
            this.loadTabData();
        } catch (err) {
            Toast.error(err.message || 'Error al procesar dictamen');
        }
    }

    static async enviarChatDirecto(tramiteId, nombre) {
        const mensaje = prompt(`Enviar justificación u observación oficial directamente a ${nombre}:`);
        if (!mensaje) return;

        try {
            await ApiService.adminEnviarMensajeProfesor(tramiteId, mensaje);
            Toast.success('Justificación enviada al alumno correctamente');
        } catch (err) {
            Toast.error(err.message || 'Error al enviar mensaje');
        }
    }
}

