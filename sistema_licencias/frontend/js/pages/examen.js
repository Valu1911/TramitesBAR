/**
 * Página de Examen Teórico con Proctoring, Anti-Cheat y Transmisión en Vivo
 */
class ExamenPage {
    static preguntas = [];
    static currentQ = 0;
    static answers = {};
    static warningsCount = 0;
    static streamInterval = null;
    static webcamStream = null;
    static screenStream = null;
    static startTime = null;

    static getFallbackPreguntas() {
        return [
            {
                id: 1,
                pregunta: '¿Cuál es la velocidad máxima permitida en calles urbanas en Baradero salvo señalización en contrario?',
                opcion_a: '40 km/h', opcion_b: '60 km/h', opcion_c: '20 km/h', opcion_d: '50 km/h',
                respuesta_correcta: 'a'
            },
            {
                id: 2,
                pregunta: 'Ante una señal de "PARE" (STOP) en una bocacalle, ¿qué acción corresponde realizar?',
                opcion_a: 'Detener la marcha por completo antes de ingresar', opcion_b: 'Disminuir la velocidad y pasar si no viene nadie', opcion_c: 'Tocar bocina y avanzar', opcion_d: 'Acelerar para pasar rápido',
                respuesta_correcta: 'a'
            },
            {
                id: 3,
                pregunta: '¿Cuál es el límite legal de alcohol en sangre para conductores particulares en Prov. de Bs. As.?',
                opcion_a: '0,0 g/l (Alcohol Cero)', opcion_b: '0,5 g/l', opcion_c: '0,2 g/l', opcion_d: '1,0 g/l',
                respuesta_correcta: 'a'
            },
            {
                id: 4,
                pregunta: '¿Quién tiene prioridad de paso en una rotonda sin semáforos?',
                opcion_a: 'El vehículo que circula dentro de la rotonda', opcion_b: 'El vehículo que ingresa a la rotonda', opcion_c: 'El vehículo más grande', opcion_d: 'El que toca bocina primero',
                respuesta_correcta: 'a'
            },
            {
                id: 5,
                pregunta: '¿Es obligatorio el uso de cinturón de seguridad para todos los ocupantes del vehículo?',
                opcion_a: 'Sí, siempre y en todos los asientos', opcion_b: 'Solo para el conductor', opcion_c: 'Solo en rutas o autopistas', opcion_d: 'Solo para los asientos delanteros',
                respuesta_correcta: 'a'
            }
        ];
    }

    static async render(app, force = false) {
        this.detenerProctoring();
        this.warningsCount = 0;
        this.startTime = Date.now();

        app.innerHTML = `
        ${renderBackHeader('Examen teórico')}
        <div class="page-content container-md">
            <div class="text-center" style="padding:40px 0">
                <div class="spinner" style="margin:0 auto"></div>
                <p class="text-muted mt-3">Iniciando sistema de examen y supervisión...</p>
            </div>
        </div>`;

        try {
            const data = await ApiService.getPreguntas(force);

            if (data.ya_rendido && !force) {
                this.renderResult(app, data);
                return;
            }

            this.preguntas = Array.isArray(data.preguntas) ? data.preguntas : [];
            this.currentQ = 0;
            this.answers = {};
            this.renderExam(app);
            if (this.preguntas.length > 0) this.iniciarProctoring();
        } catch (err) {
            this.preguntas = [];
            this.currentQ = 0;
            this.answers = {};
            this.renderExam(app);
            if (err && err.status === 403) {
                Toast.info('Modo Demo: Simulador de Examen Teórico con Anti-Cheat.');
            }
        }
    }

    static renderExam(app) {
        if (this.preguntas.length === 0) {
            app.innerHTML = `
            ${renderBackHeader('Examen teórico supervisado')}
            <div class="page-content container-md animate-fadeIn">
                <div class="glass-card p-6 text-center">
                    <div style="display:flex;justify-content:center;margin-bottom:10px;color:var(--primary);font-size:2.5rem">${Icons.doc}</div>
                    <h3 class="font-bold text-base mb-1" style="color:var(--text-main,#f8fafc)">No hay preguntas en el banco de examen</h3>
                    <p class="text-xs text-muted mb-4">El profesor o la administración debe agregar preguntas personalizadas o seleccionar el modo Plantilla para este examen.</p>
                    <button class="btn btn-primary" onclick="Router.navigate('dashboard')">Volver al Inicio</button>
                </div>
            </div>`;
            return;
        }

        const q = this.preguntas[this.currentQ];
        const options = [
            { key: 'a', text: q.opcion_a },
            { key: 'b', text: q.opcion_b },
            { key: 'c', text: q.opcion_c },
            { key: 'd', text: q.opcion_d }
        ];

        const allAnswered = Object.keys(this.answers).length === this.preguntas.length;

        app.innerHTML = `
        ${renderBackHeader('Examen teórico supervisado')}
        <div class="page-content container-md animate-fadeIn" style="position:relative">
            <!-- ALERTA ANTI TRAMPA HEADER -->
            <div style="background:rgba(239,68,68,0.1);border:1px solid #fca5a5;border-radius:var(--radius-md);padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between">
                <div style="display:flex;align-items:center;gap:8px;font-size:0.85rem;color:#b91c1c;font-weight:700">
                    <span style="display:inline-flex;align-items:center;gap:4px">${Icons.shield} Modo Supervisado Activo</span>
                    <span>· Pantalla Completa & Transmisión en Vivo</span>
                </div>
                <span id="warningsBadge" class="badge" style="background:#fee2e2;color:#991b1b;border:1px solid #f87171">
                    Advertencias Alt-Tab: ${this.warningsCount}
                </span>
            </div>

            <!-- Progress dots -->
            <div style="display:flex;gap:8px;justify-content:center;margin-bottom:16px">
                ${this.preguntas.map((_, i) => `
                <div style="width:10px;height:10px;border-radius:50%;transition:all 0.2s;
                    background:${i === this.currentQ ? 'var(--primary)' : (this.answers[this.preguntas[i].id] ? 'var(--blue-300)' : 'var(--blue-100)')}">
                </div>`).join('')}
            </div>

            <div class="flex-between mb-3">
                <button class="btn btn-sm" style="background:var(--warning-bg);color:#b45309;border:1px dashed var(--warning);font-size:0.75rem;font-weight:700;display:inline-flex;align-items:center;gap:4px" onclick="ExamenPage.autoCompletarCorrectas()">
                    ${Icons.sparkles} Modo Demo: Responder todas bien
                </button>
                <span class="text-xs text-muted font-semibold">Pregunta ${this.currentQ + 1} de ${this.preguntas.length}</span>
            </div>

            <div class="glass-card p-5 mb-4" unselectable="on" onselectstart="return false;" onmousedown="return false;">
                <h2 style="font-size:1rem;font-weight:700;margin-bottom:16px;user-select:none">${q.pregunta}</h2>
                <div class="stack">
                    ${options.map(opt => `
                    <button class="exam-option ${this.answers[q.id] === opt.key ? 'exam-option--selected' : ''}"
                            style="user-select:none"
                            onclick="ExamenPage.selectAnswer(${q.id}, '${opt.key}')">
                        ${opt.text}
                    </button>`).join('')}
                </div>
            </div>

            <div style="display:flex;gap:12px">
                ${this.currentQ > 0 ? `
                <button class="btn btn-outline" style="flex:1" onclick="ExamenPage.prevQuestion()">
                    ← Anterior
                </button>` : ''}

                ${this.currentQ < this.preguntas.length - 1 ? `
                <button class="btn btn-primary" style="flex:1" 
                        ${!this.answers[q.id] ? 'disabled' : ''}
                        onclick="ExamenPage.nextQuestion()">
                    Siguiente →
                </button>` : `
                <button class="btn btn-primary" style="flex:1" 
                        ${!allAnswered ? 'disabled' : ''}
                        onclick="ExamenPage.submitExam()">
                    Entregar examen
                </button>`}
            </div>

            <div class="info-box info-box--info mt-4">
                <span style="display:flex;align-items:center">${Icons.info}</span>
                <span>Proctoring activado: tu cámara y pantalla se transmiten al panel del profesor en tiempo real.</span>
            </div>
        </div>

        <!-- RECUADRO FLOTANTE DE CÁMARA (PiP Anti-Cheat) -->
        <div id="pipCameraOverlay" style="position:fixed;bottom:20px;right:20px;width:180px;height:135px;background:#000;border:2px solid var(--primary);border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.5);z-index:9999;display:flex;flex-direction:column">
            <div style="background:var(--primary);color:#fff;font-size:0.65rem;font-weight:700;padding:3px 8px;display:flex;justify-content:space-between;align-items:center">
                <span style="display:inline-flex;align-items:center;gap:4px">${Icons.camera} Cámara en Vivo</span>
                <span style="font-size:0.6rem">VERIFICANDO</span>
            </div>
            <video id="webcamPipVideo" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover"></video>
            <video id="screenPipVideo" autoplay playsinline muted style="display:none"></video>
            <canvas id="proctorCanvas" style="display:none"></canvas>
        </div>`;

        this.conectarCamarasPip();
        if (window.Tutorial) setTimeout(() => window.Tutorial.startTutorialWithContext('examen'), 300);
    }

    static async conectarCamarasPip() {
        const video = document.getElementById('webcamPipVideo');
        if (video && this.webcamStream) {
            video.srcObject = this.webcamStream;
        }
    }

    static async iniciarProctoring() {
        // Solicitud de pantalla completa
        try {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        } catch (e) {}

        try {
            this.webcamStream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
            const v = document.getElementById('webcamPipVideo');
            if (v) v.srcObject = this.webcamStream;
        } catch (err) {
            console.warn('Cámara web no accesible para proctoring:', err);
        }

        try {
            if (navigator.mediaDevices.getDisplayMedia) {
                this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true }).catch(() => null);
            }
        } catch (err) {}

        this.onVisibilityChange = () => {
            if (!ExamenPage.proctoringActivo || window.location.hash !== '#examen') return;
            if (document.hidden) {
                this.registrarAdvertencia('Cambio de pestaña / minimizado detectado');
            }
        };

        this.onBlur = () => {
            if (!ExamenPage.proctoringActivo || window.location.hash !== '#examen') return;
            this.registrarAdvertencia('Pérdida de foco de ventana (Alt+Tab)');
        };

        this.onContextMenu = (e) => {
            if (!ExamenPage.proctoringActivo || window.location.hash !== '#examen') return true;
            e.preventDefault();
            Toast.warning('⚠️ Menú contextual deshabilitado durante el examen.');
            return false;
        };

        this.onKeyDown = (e) => {
            if (!ExamenPage.proctoringActivo || window.location.hash !== '#examen') return true;
            if (e.key === 'F12' || (e.altKey && e.key === 'Tab') || (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'u'))) {
                e.preventDefault();
                this.registrarAdvertencia(`Intento de atajo bloqueado: ${e.key}`);
                return false;
            }
        };

        window.addEventListener('hashchange', () => {
            if (window.location.hash !== '#examen') this.detenerProctoring();
        });

        document.addEventListener('visibilitychange', this.onVisibilityChange);
        window.addEventListener('blur', this.onBlur);
        document.addEventListener('contextmenu', this.onContextMenu);
        document.addEventListener('keydown', this.onKeyDown);

        this.streamInterval = setInterval(() => this.enviarPingProctoring(), 2500);
    }

    static registrarAdvertencia(motivo) {
        if (!ExamenPage.proctoringActivo || window.location.hash !== '#examen') return;
        this.warningsCount++;
        Toast.error(`⚠️ ALERTA ANTI-TRAMPA: ${motivo} (Intento N° ${this.warningsCount})`);
        
        const badge = document.getElementById('warningsBadge');
        if (badge) badge.textContent = `Advertencias Alt-Tab: ${this.warningsCount}`;

        if (this.warningsCount >= 3) {
            Toast.error('⛔ Has acumulado 3 advertencias de cambio de pantalla. El intento quedará registrado para el profesor.');
        }
    }

    static async enviarPingProctoring() {
        if (!ExamenPage.proctoringActivo || window.location.hash !== '#examen') return;
        let camFrame = null;
        let screenFrame = null;

        try {
            const canvas = document.getElementById('proctorCanvas') || document.createElement('canvas');
            canvas.width = 160;
            canvas.height = 120;
            const ctx = canvas.getContext('2d');

            const webcamVid = document.getElementById('webcamPipVideo');
            if (webcamVid && webcamVid.readyState === 4) {
                ctx.drawImage(webcamVid, 0, 0, 160, 120);
                camFrame = canvas.toDataURL('image/jpeg', 0.5);
            }

            const screenVid = document.getElementById('screenPipVideo');
            if (screenVid && screenVid.readyState === 4) {
                ctx.drawImage(screenVid, 0, 0, 160, 120);
                screenFrame = canvas.toDataURL('image/jpeg', 0.5);
            }
        } catch (e) {}

        const elapsedSeconds = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;

        try {
            await ApiService.sendExamenPing({
                cam_frame: camFrame,
                screen_frame: screenFrame,
                warnings_count: this.warningsCount,
                elapsed_seconds: elapsedSeconds,
                current_question: this.currentQ + 1
            });
        } catch (err) {}
    }

    static detenerProctoring() {
        this.proctoringActivo = false;

        if (this.streamInterval) {
            clearInterval(this.streamInterval);
            this.streamInterval = null;
        }

        if (this.screenStream) {
            try {
                this.screenStream.getTracks().forEach(track => {
                    track.stop();
                    track.enabled = false;
                });
            } catch (e) {}
            this.screenStream = null;
        }

        if (this.webcamStream) {
            try {
                this.webcamStream.getTracks().forEach(track => {
                    track.stop();
                    track.enabled = false;
                });
            } catch (e) {}
            this.webcamStream = null;
        }

        const screenVid = document.getElementById('screenPipVideo');
        if (screenVid) screenVid.srcObject = null;

        const webcamVid = document.getElementById('webcamPipVideo');
        if (webcamVid) webcamVid.srcObject = null;

        if (this.onVisibilityChange) document.removeEventListener('visibilitychange', this.onVisibilityChange);
        if (this.onBlur) window.removeEventListener('blur', this.onBlur);
        if (this.onContextMenu) document.removeEventListener('contextmenu', this.onContextMenu);
        if (this.onKeyDown) document.removeEventListener('keydown', this.onKeyDown);

        try {
            if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
        } catch (e) {}

        const pip = document.getElementById('pipCameraOverlay');
        if (pip) pip.remove();
    }

    static autoCompletarCorrectas() {
        this.preguntas.forEach(q => {
            if (q.respuesta_correcta) {
                this.answers[q.id] = q.respuesta_correcta;
            }
        });
        this.currentQ = this.preguntas.length - 1;
        Toast.success('⚡ Modo Demo: Respuestas correctas seleccionadas');
        this.renderExam(document.getElementById('app'));
    }

    static selectAnswer(questionId, answer) {
        this.answers[questionId] = answer;
        this.renderExam(document.getElementById('app'));
    }

    static nextQuestion() {
        if (this.currentQ < this.preguntas.length - 1) {
            this.currentQ++;
            this.renderExam(document.getElementById('app'));
        }
    }

    static prevQuestion() {
        if (this.currentQ > 0) {
            this.currentQ--;
            this.renderExam(document.getElementById('app'));
        }
    }

    static async submitExam() {
        this.detenerProctoring();

        const app = document.getElementById('app');
        app.innerHTML = `
        ${renderBackHeader('Examen teórico')}
        <div class="page-content container-md text-center" style="padding-top:60px">
            <div class="spinner" style="margin:0 auto"></div>
            <p class="text-muted mt-3">Enviando examen al profesor para su revisión...</p>
        </div>`;

        try {
            const result = await ApiService.entregarExamen(this.answers);
            this.renderResult(app, result);
        } catch (err) {
            let correctas = 0;
            this.preguntas.forEach(q => {
                if (this.answers[q.id] === q.respuesta_correcta) correctas++;
            });
            const total = this.preguntas.length || 1;
            const porcentaje = Math.round((correctas / total) * 100);
            this.renderResult(app, { pendiente_revision: true, puntaje: correctas, total, porcentaje });
        }
    }

    static renderResult(app, result) {
        if (result.pendiente_revision) {
            app.innerHTML = `
            ${renderBackHeader('Examen entregado')}
            <div class="page-content container-md text-center animate-fadeIn" style="padding-top:40px">
                <div style="font-size:3rem;margin-bottom:12px">⏳</div>
                <h2 class="font-bold text-xl mb-2" style="color:var(--text-main,#f8fafc)">Examen Entregado - En Revisión por el Profesor</h2>
                <p class="text-xs text-muted mb-4">Respondiste correctamente ${result.puntaje} de ${result.total} preguntas (${result.porcentaje || 0}% de acierto).</p>
                <div class="p-4 mb-4" style="background:rgba(37,99,235,0.15);border:1px solid #3b82f6;border-radius:12px;text-align:left">
                    <strong style="color:#60a5fa;display:block;margin-bottom:4px">📌 Dictamen y Justificación en Proceso:</strong>
                    <p class="text-xs text-muted mb-0">Tu evaluación e historial de supervisión están siendo validados por el Profesor. Una vez aprobado o desaprobado por el docente con su justificación oficial, avanzarás al siguiente paso.</p>
                </div>
                <button class="btn btn-primary btn-block" onclick="Router.navigate('dashboard')">Volver al Panel de Inicio</button>
            </div>`;
            return;
        }

        const passed = result.aprobado;

        app.innerHTML = `
        ${renderBackHeader('Resultado')}
        <div class="page-content container-md text-center animate-slideUp" style="padding-top:40px">
            <div class="result-circle ${passed ? 'result-circle--pass' : 'result-circle--fail'}">
                ${passed ? '✅' : '❌'}
            </div>
            <h2 style="font-size:1.5rem;font-weight:800;margin-bottom:8px">
                ${passed ? '¡Examen Aprobado!' : 'Examen No Aprobado'}
            </h2>
            <p class="text-muted">
                Respondiste correctamente ${result.puntaje} de ${result.total} preguntas (${result.porcentaje || 0}%).
            </p>

            ${!passed ? `
            <div class="info-box info-box--warning mt-4" style="text-align:left">
                <span>⚠️</span>
                <span>Deberás rendir el examen nuevamente en otro momento según la justificación del profesor.</span>
            </div>` : `
            <div class="info-box info-box--success mt-4" style="text-align:left">
                <span>✅</span>
                <span>¡Excelente! Podés continuar con el pago del arancel.</span>
            </div>`}

            <div class="stack mt-4">
                <button class="btn btn-primary btn-block btn-lg" onclick="Router.navigate('dashboard')">
                    Volver al panel
                </button>
            </div>
        </div>`;
    }

    static async reintentarExamen() {
        try {
            await ApiService.reiniciarExamen();
            Toast.info('Examen reiniciado. Podés volver a responder.');
            this.render(document.getElementById('app'), true);
        } catch (err) {
            Toast.error(err.message);
        }
    }
}
