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
            <!-- HERO ADMIN -->
            <div class="glass-card p-6" style="border-left: 4px solid var(--primary)">
                <div class="flex-between">
                    <div>
                        <span style="font-size:0.75rem;padding:4px 10px;border-radius:12px;background:rgba(37,99,235,0.2);color:#60a5fa;border:1px solid #3b82f6;font-weight:700;display:inline-flex;align-items:center;gap:6px;margin-bottom:8px">
                            ${Icons.teacher} Panel de Profesores & Evaluaciones
                        </span>
                        <h1 class="font-bold text-xl mb-1" style="color:var(--text-main,#f8fafc)">Gestión del Examen Teórico de Conducir</h1>
                        <p class="text-xs text-muted">Configurá preguntas, dictaminá evaluaciones de alumnos, supervisá en tiempo real y gestioná expulsiones/justificaciones.</p>
                    </div>
                </div>

                <!-- TABS DE NAVEGACIÓN -->
                <div style="display:flex;gap:10px;margin-top:20px;border-bottom:1px solid var(--border);padding-bottom:10px;flex-wrap:wrap">
                    <button class="btn ${this.activeTab === 'config' ? 'btn-primary' : 'btn-ghost'} btn-sm" style="display:inline-flex;align-items:center;gap:6px" onclick="AdminProfesoresPage.switchTab('config')">
                        ${Icons.settings} Configuración & Vista Previa
                    </button>
                    <button class="btn ${this.activeTab === 'preguntas' ? 'btn-primary' : 'btn-ghost'} btn-sm" style="display:inline-flex;align-items:center;gap:6px" onclick="AdminProfesoresPage.switchTab('preguntas')">
                        ${Icons.doc} Banco de Preguntas
                    </button>
                    <button class="btn ${this.activeTab === 'monitoreo' ? 'btn-primary' : 'btn-ghost'} btn-sm" style="display:inline-flex;align-items:center;gap:6px" onclick="AdminProfesoresPage.switchTab('monitoreo')">
                        ${Icons.camera} Monitoreo en Tiempo Real
                    </button>
                    <button class="btn ${this.activeTab === 'revision' ? 'btn-primary' : 'btn-ghost'} btn-sm" style="display:inline-flex;align-items:center;gap:6px" onclick="AdminProfesoresPage.switchTab('revision')">
                        ${Icons.check} Exámenes a Revisar & Dictamen
                    </button>
                </div>
            </div>

            <!-- CONTENIDO DE CADA TAB -->
            <div id="profesoresTabContent">
                <div class="text-center p-6">
                    <div class="spinner" style="margin:0 auto"></div>
                    <p class="text-muted mt-2 text-xs">Cargando módulo...</p>
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
        <div class="grid-2" style="gap:20px">
            <!-- COLUMNA 1: SELECCIÓN DE MODO DE EXAMEN -->
            <div class="glass-card p-6">
                <h2 class="font-bold text-base mb-2" style="display:flex;align-items:center;gap:6px;color:var(--text-main,#f8fafc)">
                    <span style="color:var(--primary);display:flex;align-items:center">${Icons.settings}</span> Configuración del Examen Teórico
                </h2>
                <p class="text-xs text-muted mb-4">Elegí la modalidad con la que el sistema generará las preguntas para los alumnos:</p>

                <form onsubmit="AdminProfesoresPage.guardarConfig(event)">
                    <div class="stack mb-4">
                        <!-- OPCIÓN 1: PLANTILLA -->
                        <label class="p-3" style="border:1px solid ${this.config.modo === 'plantilla' ? 'var(--primary)' : 'var(--border)'};border-radius:var(--radius-md);display:block;cursor:pointer;background:${this.config.modo === 'plantilla' ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.02)'}">
                            <div style="display:flex;align-items:center;gap:8px">
                                <input type="radio" name="modoExamen" value="plantilla" ${this.config.modo === 'plantilla' ? 'checked' : ''} onchange="AdminProfesoresPage.onModoChange(this.value)">
                                <div>
                                    <strong style="font-size:0.9rem;color:var(--text-main,#f8fafc)">1. Modo Plantilla Estándar</strong>
                                    <p class="text-xs text-muted mb-0">Utiliza las preguntas base preexistentes del sistema.</p>
                                </div>
                            </div>
                        </label>

                        <!-- OPCIÓN 2: PERSONALIZADO -->
                        <label class="p-3" style="border:1px solid ${this.config.modo === 'personalizado' ? 'var(--primary)' : 'var(--border)'};border-radius:var(--radius-md);display:block;cursor:pointer;background:${this.config.modo === 'personalizado' ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.02)'}">
                            <div style="display:flex;align-items:center;gap:8px">
                                <input type="radio" name="modoExamen" value="personalizado" ${this.config.modo === 'personalizado' ? 'checked' : ''} onchange="AdminProfesoresPage.onModoChange(this.value)">
                                <div>
                                    <strong style="font-size:0.9rem;color:var(--text-main,#f8fafc)">2. Modo Personalizado (Profesor)</strong>
                                    <p class="text-xs text-muted mb-0">Utiliza exclusivamente las preguntas creadas por el profesor.</p>
                                </div>
                            </div>
                        </label>

                        <!-- OPCIÓN 3: HÍBRIDO -->
                        <label class="p-3" style="border:1px solid ${this.config.modo === 'hibrido' ? 'var(--primary)' : 'var(--border)'};border-radius:var(--radius-md);display:block;cursor:pointer;background:${this.config.modo === 'hibrido' ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.02)'}">
                            <div style="display:flex;align-items:center;gap:8px">
                                <input type="radio" name="modoExamen" value="hibrido" ${this.config.modo === 'hibrido' ? 'checked' : ''} onchange="AdminProfesoresPage.onModoChange(this.value)">
                                <div>
                                    <strong style="font-size:0.9rem;color:var(--text-main,#f8fafc)">3. Modo Híbrido (Combinado sin repetir)</strong>
                                    <p class="text-xs text-muted mb-0">Combina preguntas de plantilla con preguntas de profesor sin duplicados.</p>
                                </div>
                            </div>
                        </label>
                    </div>

                    <div id="hibridoConfigInputs" style="display:${this.config.modo === 'hibrido' ? 'block' : 'none'};background:var(--bg);padding:12px;border-radius:var(--radius-md);margin-bottom:16px;border:1px solid var(--border)">
                        <div class="grid-2" style="gap:10px">
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

                    <button type="submit" class="btn btn-primary btn-block">
                        Guardar Configuración de Examen
                    </button>
                </form>
            </div>

            <!-- COLUMNA 2: VISTA PREVIA DE PREGUNTAS EN VIVO -->
            <div class="glass-card p-6">
                <div class="flex-between mb-3">
                    <h2 class="font-bold text-base mb-0" style="display:flex;align-items:center;gap:6px;color:var(--text-main,#f8fafc)">
                        <span style="color:var(--primary);display:flex;align-items:center">${Icons.doc}</span> Vista Previa de Preguntas (${this.previewPreguntas.length})
                    </h2>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                        <span style="padding:4px 10px;border-radius:12px;background:rgba(37,99,235,0.2);color:#60a5fa;border:1px solid #3b82f6;font-size:0.7rem;font-weight:700">
                            ${this.config.modo.toUpperCase()}
                        </span>
                        <button type="button" class="btn btn-ghost btn-sm text-xs" style="color:#f87171;border:1px solid #ef4444;padding:3px 8px;display:inline-flex;align-items:center;gap:4px;font-weight:700" onclick="AdminProfesoresPage.vaciarPreguntasPlantilla()">
                            ${Icons.x} Vaciar plantilla base
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm text-xs" style="color:#60a5fa;border:1px solid #3b82f6;padding:3px 8px;display:inline-flex;align-items:center;gap:4px;font-weight:700" onclick="AdminProfesoresPage.restaurarPreguntasPlantilla()">
                            ${Icons.check} Restaurar plantilla base
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm text-xs" style="color:#f87171;border:1px solid #ef4444;padding:3px 8px;display:inline-flex;align-items:center;gap:4px;font-weight:700" onclick="AdminProfesoresPage.vaciarPreguntasProfesor()">
                            ${Icons.x} Vaciar preguntas de profesor
                        </button>
                    </div>
                </div>
                <p class="text-xs text-muted mb-4">Estas son las preguntas que verán los alumnos al rendir el examen con la configuración actual:</p>

                <div class="stack" style="max-height:400px;overflow-y:auto;gap:12px">
                    ${this.previewPreguntas.length === 0 ? `
                    <div class="empty-state">
                        <p class="text-xs text-muted">No hay preguntas disponibles para el modo seleccionado. Podés cargar nuevas preguntas o vaciar las anteriores.</p>
                    </div>` : this.previewPreguntas.map((q, i) => `
                    <div style="background:rgba(15,23,42,0.6);padding:14px;border-radius:var(--radius-md);border-left:4px solid ${q.es_plantilla ? '#3b82f6' : '#a855f7'};border-top:1px solid var(--border);border-right:1px solid var(--border);border-bottom:1px solid var(--border)">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                            <span class="font-bold text-xs" style="color:var(--text-main,#f8fafc)">Pregunta ${i + 1}</span>
                            ${q.es_plantilla ? `
                            <span style="font-size:0.65rem;padding:3px 8px;border-radius:12px;background:rgba(37,99,235,0.25);color:#60a5fa;border:1px solid #3b82f6;font-weight:700">
                                Plantilla Base
                            </span>` : `
                            <span style="font-size:0.65rem;padding:3px 8px;border-radius:12px;background:rgba(168,85,247,0.25);color:#c084fc;border:1px solid #a855f7;font-weight:700">
                                Creada por Profesor
                            </span>`}
                        </div>
                        <p class="font-bold text-xs mb-3" style="color:var(--text-main,#f8fafc);font-size:0.85rem">${q.pregunta}</p>
                        <div class="grid-2" style="font-size:0.8rem;gap:6px;font-weight:600">
                            <div style="background:rgba(255,255,255,0.06);color:var(--text-main,#f8fafc);padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1)">A) ${q.opcion_a}</div>
                            <div style="background:rgba(255,255,255,0.06);color:var(--text-main,#f8fafc);padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1)">B) ${q.opcion_b}</div>
                            <div style="background:rgba(255,255,255,0.06);color:var(--text-main,#f8fafc);padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1)">C) ${q.opcion_c}</div>
                            <div style="background:rgba(255,255,255,0.06);color:var(--text-main,#f8fafc);padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1)">D) ${q.opcion_d}</div>
                        </div>
                        <div class="text-xs font-bold text-success mt-3" style="display:inline-flex;align-items:center;gap:4px">
                            ${Icons.check} Respuesta Correcta: ${q.respuesta_correcta?.toUpperCase()}
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
    // ============================================================
    static async renderTabPreguntas(container) {
        try {
            const data = await ApiService.adminGetPreguntas();
            this.preguntas = data.preguntas || [];
        } catch (err) {
            Toast.error('Error al cargar banco de preguntas');
        }

        container.innerHTML = `
        <div class="grid-2" style="gap:20px">
            <!-- COLUMNA 1: FORMULARIO CREAR PREGUNTA -->
            <div class="glass-card p-6">
                <h2 class="font-bold text-base mb-2" style="display:flex;align-items:center;gap:6px;color:var(--text-main,#f8fafc)">
                    <span style="color:var(--primary);display:flex;align-items:center">${Icons.doc}</span> Nueva Pregunta de Examen
                </h2>
                <p class="text-xs text-muted mb-4">Agregá preguntas personalizadas al sistema:</p>

                <form onsubmit="AdminProfesoresPage.crearPregunta(event)">
                    <div class="stack">
                        <div class="form-group">
                            <label class="form-label text-xs">Pregunta / Consigna *</label>
                            <textarea id="newPreguntaText" class="form-input text-xs" rows="3" placeholder="Ej: ¿Qué velocidad máxima corresponde en avenidas de Baradero?" required></textarea>
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

                        <button type="submit" class="btn btn-primary btn-block mt-2">
                            Guardar Pregunta
                        </button>
                    </div>
                </form>
            </div>

            <!-- COLUMNA 2: LISTA DE PREGUNTAS CON BOTÓN DE VACIADO -->
            <div class="glass-card p-6">
                <div class="flex-between mb-3" style="flex-wrap:wrap;gap:8px">
                    <h2 class="font-bold text-base mb-0" style="color:var(--text-main,#f8fafc)">Banco de Preguntas (${this.preguntas.length})</h2>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                        <button type="button" class="btn btn-ghost btn-sm text-xs" style="color:#f87171;border:1px solid #ef4444;padding:3px 8px;display:inline-flex;align-items:center;gap:4px;font-weight:700" onclick="AdminProfesoresPage.vaciarPreguntasPlantilla()">
                            ${Icons.x} Vaciar plantilla base
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm text-xs" style="color:#60a5fa;border:1px solid #3b82f6;padding:3px 8px;display:inline-flex;align-items:center;gap:4px;font-weight:700" onclick="AdminProfesoresPage.restaurarPreguntasPlantilla()">
                            ${Icons.check} Restaurar plantilla base
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm text-xs" style="color:#f87171;border:1px solid #ef4444;padding:3px 8px;display:inline-flex;align-items:center;gap:4px;font-weight:700" onclick="AdminProfesoresPage.vaciarPreguntasProfesor()">
                            ${Icons.x} Vaciar preguntas del profesor
                        </button>
                    </div>
                </div>
                
                <div class="stack" style="max-height:480px;overflow-y:auto;gap:12px">
                    ${this.preguntas.length === 0 ? `
                    <div class="empty-state">
                        <p class="text-xs text-muted">No hay preguntas registradas actualmente en el banco.</p>
                    </div>` : this.preguntas.map((q, i) => `
                    <div style="background:rgba(15,23,42,0.6);padding:14px;border-radius:var(--radius-md);border-left:4px solid ${q.es_plantilla ? '#3b82f6' : '#a855f7'};border-top:1px solid var(--border);border-right:1px solid var(--border);border-bottom:1px solid var(--border)">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                            ${q.es_plantilla ? `
                            <span style="font-size:0.65rem;padding:3px 8px;border-radius:12px;background:rgba(37,99,235,0.25);color:#60a5fa;border:1px solid #3b82f6;font-weight:700">
                                Plantilla Base
                            </span>` : `
                            <span style="font-size:0.65rem;padding:3px 8px;border-radius:12px;background:rgba(168,85,247,0.25);color:#c084fc;border:1px solid #a855f7;font-weight:700">
                                Creada por Profesor
                            </span>`}
                            <button class="btn btn-ghost btn-sm" onclick="AdminProfesoresPage.eliminarPregunta(${q.id})" style="color:#f87171;font-size:0.75rem;padding:2px 8px;display:inline-flex;align-items:center;gap:2px">
                                ${Icons.x} Eliminar
                            </button>
                        </div>
                        <p class="font-bold text-xs mb-3" style="color:var(--text-main,#f8fafc);font-size:0.85rem">${q.pregunta}</p>
                        <div class="grid-2" style="font-size:0.8rem;gap:6px;font-weight:600">
                            <div style="background:rgba(255,255,255,0.06);color:var(--text-main,#f8fafc);padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1)">A) ${q.opcion_a}</div>
                            <div style="background:rgba(255,255,255,0.06);color:var(--text-main,#f8fafc);padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1)">B) ${q.opcion_b}</div>
                            <div style="background:rgba(255,255,255,0.06);color:var(--text-main,#f8fafc);padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1)">C) ${q.opcion_c}</div>
                            <div style="background:rgba(255,255,255,0.06);color:var(--text-main,#f8fafc);padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1)">D) ${q.opcion_d}</div>
                        </div>
                        <div class="text-xs font-bold text-success mt-3" style="display:inline-flex;align-items:center;gap:4px">
                            ${Icons.check} Correcta: ${q.respuesta_correcta?.toUpperCase()}
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
                <div class="flex-between mb-4">
                    <div>
                        <h2 class="font-bold text-base mb-1" style="display:flex;align-items:center;gap:6px;color:var(--text-main,#f8fafc)">
                            <span style="color:var(--danger);display:flex;align-items:center">${Icons.camera}</span> Centro de Supervisión en Tiempo Real
                        </h2>
                        <p class="text-xs text-muted">Visualización en vivo de cámaras web, captura de pantalla, alertas anti-trampa y botón de expulsión inmediata.</p>
                    </div>
                    <span style="padding:6px 12px;font-size:0.75rem;border-radius:12px;background:rgba(34,197,94,0.2);color:#4ade80;border:1px solid #22c55e;font-weight:700;animation:pulse 2s infinite">
                        ● Transmisión en Vivo
                    </span>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:16px">
                    ${this.estudiantes.length === 0 ? `
                    <div class="glass-card p-6 text-center" style="grid-column:1/-1">
                        <div style="display:flex;justify-content:center;margin-bottom:10px;color:var(--primary);font-size:2rem">${Icons.camera}</div>
                        <h3 class="font-bold text-sm" style="color:var(--text-main,#f8fafc)">No hay alumnos rindiendo el examen en este momento</h3>
                        <p class="text-xs text-muted mt-1">Los exámenes activos aparecerán aquí en vivo cuando los ciudadanos inicien la evaluación.</p>
                    </div>` : this.estudiantes.map(st => `
                    <div class="glass-card p-4" style="border-top:4px solid ${st.warnings_count > 0 ? '#ef4444' : '#22c55e'}">
                        <div class="flex-between mb-2">
                            <div>
                                <strong class="text-sm" style="color:var(--text-main,#f8fafc)">${st.nombre}</strong>
                                <div class="text-xs text-muted">DNI ${st.dni}</div>
                            </div>
                            <span style="font-size:0.65rem;padding:3px 8px;border-radius:12px;background:${st.warnings_count > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'};color:${st.warnings_count > 0 ? '#f87171' : '#4ade80'};border:1px solid ${st.warnings_count > 0 ? '#ef4444' : '#22c55e'};font-weight:700">
                                Alt-Tab: ${st.warnings_count} alertas
                            </span>
                        </div>

                        <!-- STREAMING CAM Y SCREEN -->
                        <div class="grid-2" style="gap:8px;margin-bottom:10px">
                            <div style="position:relative;height:120px;background:#000;border-radius:var(--radius-sm);overflow:hidden">
                                ${st.cam_frame ? `
                                <img src="${st.cam_frame}" style="width:100%;height:100%;object-fit:cover">` : `
                                <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#aaa;font-size:0.7rem">Sin video cam</div>`}
                                <span style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,0.6);color:#fff;font-size:0.6rem;padding:2px 6px;border-radius:4px">Cámara Web</span>
                            </div>

                            <div style="position:relative;height:120px;background:#000;border-radius:var(--radius-sm);overflow:hidden">
                                ${st.screen_frame ? `
                                <img src="${st.screen_frame}" style="width:100%;height:100%;object-fit:cover">` : `
                                <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#aaa;font-size:0.7rem">Sin pantalla</div>`}
                                <span style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,0.6);color:#fff;font-size:0.6rem;padding:2px 6px;border-radius:4px">Pantalla Entera</span>
                            </div>
                        </div>

                        <div class="flex-between text-xs mb-3" style="background:rgba(15,23,42,0.6);padding:8px 10px;border-radius:var(--radius-sm);color:var(--text-main,#f8fafc);border:1px solid var(--border)">
                            <span>Pregunta: <strong style="color:var(--text-main,#f8fafc)">${st.current_question}/5</strong></span>
                            <span>Tiempo: <strong style="color:var(--text-main,#f8fafc)">${st.elapsed_seconds || 0} seg</strong></span>
                            ${st.tiene_cud ? `<span style="font-size:0.6rem;padding:2px 6px;border-radius:10px;background:rgba(34,197,94,0.2);color:#4ade80;border:1px solid #22c55e;font-weight:700;display:inline-flex;align-items:center;gap:2px">${Icons.wheelchair} CUD</span>` : ''}
                        </div>

                        <!-- BOTÓN DE EXPULSIÓN INMEDIATA EN VIVO -->
                        <button class="btn btn-primary btn-block btn-sm" style="background:#ef4444;color:#fff;border:none;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:4px" onclick="AdminProfesoresPage.expulsarEstudiante(${st.tramite_id}, '${st.nombre}')">
                            ${Icons.x} Expulsar del Examen en Vivo
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
                    <h2 class="font-bold text-base mb-1" style="display:flex;align-items:center;gap:6px;color:var(--text-main,#f8fafc)">
                        <span style="color:var(--primary);display:flex;align-items:center">${Icons.check}</span> Exámenes Entregados & Dictamen del Profesor
                    </h2>
                    <p class="text-xs text-muted">Revisá las respuestas de los alumnos, su porcentaje de aciertos, sus alertas anti-trampa y emití el dictamen con justificación oficial.</p>
                </div>
            </div>

            <div class="stack" style="gap:16px">
                ${this.revisionExamenes.length === 0 ? `
                <div class="glass-card p-6 text-center">
                    <div style="display:flex;justify-content:center;margin-bottom:10px;color:var(--primary);font-size:2rem">${Icons.doc}</div>
                    <h3 class="font-bold text-sm" style="color:var(--text-main,#f8fafc)">No hay exámenes entregados registrados</h3>
                    <p class="text-xs text-muted mt-1">Los exámenes entregados por los alumnos aparecerán aquí para tu revisión.</p>
                </div>` : this.revisionExamenes.map(ex => `
                <div class="glass-card p-5" style="border-left:4px solid ${ex.estado_revision === 'aprobado' ? '#22c55e' : (ex.estado_revision === 'desaprobado' ? '#ef4444' : '#3b82f6')}">
                    <div class="flex-between mb-3" style="flex-wrap:wrap;gap:10px">
                        <div>
                            <h3 class="font-bold text-sm mb-0" style="color:var(--text-main,#f8fafc)">${ex.nombre} ${ex.apellido}</h3>
                            <div class="text-xs text-muted">DNI ${ex.dni} · Trámite #${ex.tramite_id} · Fecha: ${ex.created_at || ''}</div>
                        </div>

                        <div style="display:flex;gap:8px;align-items:center">
                            <span style="padding:4px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;background:rgba(37,99,235,0.25);color:#60a5fa;border:1px solid #3b82f6">
                                Acierto: ${ex.porcentaje_acierto || Math.round(((ex.puntaje || 0) / (ex.total_preguntas || 1)) * 100)}% (${ex.puntaje || 0}/${ex.total_preguntas || 0})
                            </span>

                            <span style="padding:4px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;
                                background:${ex.estado_revision === 'aprobado' ? 'rgba(34,197,94,0.25)' : (ex.estado_revision === 'desaprobado' || ex.expulsado ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)')};
                                color:${ex.estado_revision === 'aprobado' ? '#4ade80' : (ex.estado_revision === 'desaprobado' || ex.expulsado ? '#f87171' : '#fbbf24')};
                                border:1px solid ${ex.estado_revision === 'aprobado' ? '#22c55e' : (ex.estado_revision === 'desaprobado' || ex.expulsado ? '#ef4444' : '#f59e0b')}">
                                ${ex.expulsado ? '🚫 EXPULSADO' : (ex.estado_revision === 'aprobado' ? '✅ APROBADO' : (ex.estado_revision === 'desaprobado' ? '❌ DESAPROBADO' : '⏳ PENDIENTE DE REVISIÓN'))}
                            </span>
                        </div>
                    </div>

                    ${ex.motivo_justificacion ? `
                    <div class="p-3 mb-3" style="background:rgba(255,255,255,0.04);border-radius:6px;border-left:3px solid var(--primary)">
                        <strong class="text-xs" style="color:var(--text-main,#f8fafc)">Justificación del Profesor:</strong>
                        <p class="text-xs text-muted mb-0 mt-1">${ex.motivo_justificacion}</p>
                    </div>` : ''}

                    <!-- ACCIONES DE DICTAMEN DE REVISIÓN -->
                    <div style="background:rgba(15,23,42,0.6);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border)">
                        <label class="form-label text-xs font-bold mb-1">Justificación u Observación Oficial del Profesor *</label>
                        <input type="text" id="motivo_${ex.tramite_id}" class="form-input text-xs mb-3" placeholder="Ej: Cumple con el 70% mínimo de respuestas correctas y sin alertas de Alt-Tab." value="${ex.motivo_justificacion || ''}">

                        <div style="display:flex;gap:10px;flex-wrap:wrap">
                            <button type="button" class="btn btn-sm" style="background:#22c55e;color:#fff;font-weight:700;display:inline-flex;align-items:center;gap:4px" onclick="AdminProfesoresPage.dictaminarExamen(${ex.tramite_id}, 'aprobar')">
                                ${Icons.check} Aprobar Examen
                            </button>
                            <button type="button" class="btn btn-sm" style="background:#ef4444;color:#fff;font-weight:700;display:inline-flex;align-items:center;gap:4px" onclick="AdminProfesoresPage.dictaminarExamen(${ex.tramite_id}, 'desaprobar')">
                                ${Icons.x} Desaprobar Examen
                            </button>
                            <button type="button" class="btn btn-outline btn-sm text-xs" onclick="AdminProfesoresPage.enviarChatDirecto(${ex.tramite_id}, '${ex.nombre}')">
                                Send Mensaje / Justificación Directa al Alumno
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
