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
        ${renderBackHeader('Examen Teórico Supervisado')}
        <div class="page-content container-md animate-fadeIn" style="max-width:880px;margin:0 auto;position:relative;padding-top:10px;">
            <!-- ALERTA ANTI TRAMPA HEADER -->
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                <div style="display:flex;align-items:center;gap:8px;font-size:0.84rem;color:#b91c1c;font-weight:700">
                    <span style="display:inline-flex;align-items:center;gap:4px;color:#dc2626">${Icons.shield} Modo Supervisado Activo</span>
                    <span style="color:#ef4444">• Transmisión Docente en Vivo</span>
                </div>
                <span id="warningsBadge" class="badge" style="background:#fee2e2;color:#991b1b;border:1px solid #f87171;font-size:0.75rem;padding:3px 8px;">
                    Advertencias Alt-Tab: ${this.warningsCount}
                </span>
            </div>

            <!-- Progress dots -->
            <div style="display:flex;gap:8px;justify-content:center;margin-bottom:16px">
                ${this.preguntas.map((_, i) => `
                <div style="width:12px;height:12px;border-radius:50%;transition:all 0.2s;
                    background:${i === this.currentQ ? '#0284c7' : (this.answers[this.preguntas[i].id] ? '#10b981' : '#e2e8f0')};
                    box-shadow:${i === this.currentQ ? '0 0 0 3px rgba(2,132,199,0.25)' : 'none'}">
                </div>`).join('')}
            </div>

            <div class="flex-between mb-3">
                <button class="btn btn-sm" style="background:#fffbeb;color:#b45309;border:1px dashed #f59e0b;font-size:0.75rem;font-weight:700;display:inline-flex;align-items:center;gap:4px" onclick="ExamenPage.autoCompletarCorrectas()">
                    ${Icons.sparkles} Modo Demo: Responder todas bien
                </button>
                <span class="text-xs text-muted font-bold">Pregunta ${this.currentQ + 1} de ${this.preguntas.length}</span>
            </div>

            <div class="dash-card mb-4" unselectable="on" onselectstart="return false;" onmousedown="return false;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
                    <span class="badge badge-info" style="font-size:0.72rem;padding:2px 8px;">Pregunta #${this.currentQ + 1}</span>
                </div>
                <h2 style="font-size:1.08rem;font-weight:800;color:#1e293b;margin-bottom:20px;user-select:none;line-height:1.4">${q.pregunta}</h2>
                <div class="stack" style="gap:10px;">
                    ${options.map(opt => `
                    <button class="exam-option ${this.answers[q.id] === opt.key ? 'exam-option--selected' : ''}"
                            style="user-select:none;display:flex;align-items:center;gap:12px;text-align:left;padding:14px 16px;border-radius:10px;border:1.5px solid ${this.answers[q.id] === opt.key ? '#0284c7' : '#e2e8f0'};background:${this.answers[q.id] === opt.key ? '#e0f2fe' : '#ffffff'};font-weight:${this.answers[q.id] === opt.key ? '700' : '500'};color:#1e293b;transition:all 0.15s ease;"
                            onclick="ExamenPage.selectAnswer(${q.id}, '${opt.key}')">
                        <span style="width:28px;height:28px;border-radius:50%;border:2px solid ${this.answers[q.id] === opt.key ? '#0284c7' : '#cbd5e1'};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.8rem;background:${this.answers[q.id] === opt.key ? '#0284c7' : '#f8fafc'};color:${this.answers[q.id] === opt.key ? '#ffffff' : '#64748b'};flex-shrink:0;">
                            ${opt.key.toUpperCase()}
                        </span>
                        <span style="flex:1;font-size:0.92rem;">${opt.text}</span>
                    </button>`).join('')}
                </div>
            </div>

            <div style="display:flex;gap:12px">
                ${this.currentQ > 0 ? `
                <button class="btn btn-outline" style="flex:1;font-weight:700" onclick="ExamenPage.prevQuestion()">
                    ← Anterior
                </button>` : ''}

                ${this.currentQ < this.preguntas.length - 1 ? `
                <button class="btn btn-primary" style="flex:1;font-weight:700" 
                        ${!this.answers[q.id] ? 'disabled' : ''}
                        onclick="ExamenPage.nextQuestion()">
                    Siguiente →
                </button>` : `
                <button class="btn btn-primary" style="flex:1;font-weight:700" 
                        ${!allAnswered ? 'disabled' : ''}
                        onclick="ExamenPage.submitExam()">
                    Entregar Examen al Profesor
                </button>`}
            </div>

            <div style="background:#f0f9ff;border:1px solid #bae6fd;padding:12px 16px;border-radius:10px;margin-top:20px;display:flex;align-items:center;gap:10px;font-size:0.82rem;color:#0369a1;">
                <span style="display:flex;align-items:center;">${Icons.info}</span>
                <span>Proctoring activado: tu cámara web y eventos de navegación son supervisados para garantizar la transparencia.</span>
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
            ${renderBackHeader('Examen Teórico')}
            <div class="page-content container-md animate-fadeIn" style="max-width:640px;margin:0 auto;padding-top:24px;">
                <div class="dash-card text-center" style="border:1.5px solid #bae6fd;padding:36px 24px;">
                    <div style="width:72px;height:72px;border-radius:50%;background:#e0f2fe;color:#0284c7;display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 16px auto;">
                        ⏳
                    </div>
                    <span class="badge badge-info mb-3" style="font-size:0.8rem;padding:4px 12px;">En Revisión Docente</span>
                    <h2 style="font-size:1.3rem;font-weight:800;color:#1e293b;margin-bottom:8px;">Examen Entregado Exitosamente</h2>
                    <p style="font-size:0.88rem;color:#64748b;margin-bottom:20px;">
                        Respondiste correctamente <strong>${result.puntaje}</strong> de <strong>${result.total}</strong> preguntas (${result.porcentaje || 0}% de acierto).
                    </p>
                    
                    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:16px;text-align:left;margin-bottom:24px;">
                        <strong style="color:#0369a1;display:flex;align-items:center;gap:6px;font-size:0.88rem;margin-bottom:6px;">
                            ${Icons.shield} Verificación de Supervisión y Respuestas
                        </strong>
                        <p style="font-size:0.8rem;color:#475569;margin:0;line-height:1.4;">
                            Tu evaluación y registro de proctoring están siendo validados por el evaluador oficial. Una vez emitida la calificación final, tu panel se actualizará automáticamente.
                        </p>
                    </div>

                    <button class="btn btn-primary btn-block btn-lg" style="font-weight:700" onclick="Router.navigate('dashboard')">
                        Volver al Panel Principal
                    </button>
                </div>
            </div>`;
            return;
        }

        const passed = result.aprobado;

        app.innerHTML = `
        ${renderBackHeader('Resultado del Examen')}
        <div class="page-content container-md animate-slideUp" style="max-width:640px;margin:0 auto;padding-top:24px;">
            <div class="dash-card text-center" style="border:2px solid ${passed ? '#86efac' : '#fca5a5'};padding:36px 24px;">
                <div style="width:76px;height:76px;border-radius:50%;background:${passed ? '#dcfce7' : '#fee2e2'};color:${passed ? '#15803d' : '#b91c1c'};display:flex;align-items:center;justify-content:center;font-size:2.2rem;margin:0 auto 16px auto;">
                    ${passed ? '✓' : '✕'}
                </div>
                
                <span class="badge ${passed ? 'badge-success' : 'badge-danger'} mb-3" style="font-size:0.8rem;padding:4px 12px;">
                    ${passed ? 'APROBADO' : 'NO APROBADO'}
                </span>

                <h2 style="font-size:1.4rem;font-weight:800;color:#1e293b;margin-bottom:8px;">
                    ${passed ? '¡Felicitaciones, Examen Aprobado!' : 'Examen Teórico No Aprobado'}
                </h2>
                
                <p style="font-size:0.9rem;color:#64748b;margin-bottom:20px;">
                    Puntaje obtenido: <strong>${result.puntaje}</strong> de <strong>${result.total}</strong> preguntas correctas (${result.porcentaje || 0}%).
                </p>

                ${!passed ? `
                <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:14px;text-align:left;margin-bottom:20px;color:#92400e;font-size:0.84rem;">
                    <strong>Observación del evaluador:</strong> Podrás repasar las charlas y solicitar una nueva fecha de examen teórico.
                </div>` : `
                <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:14px;text-align:left;margin-bottom:20px;color:#065f46;font-size:0.84rem;">
                    <strong>Instancia completada:</strong> Cumpliste el requisito teórico. Podés continuar con el pago del arancel y turno de pista.
                </div>`}

                <button class="btn btn-primary btn-block btn-lg" style="font-weight:700" onclick="Router.navigate('dashboard')">
                    Continuar al Panel
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
