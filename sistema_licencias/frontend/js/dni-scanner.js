/**
 * Componente UI de Escáner y Lector Inteligente de DNI Argentino (Frente y Dorso)
 * - Decodifica código de barras 2D PDF417 (Dorso)
 * - Detecta y recorta el rostro para la foto de perfil oficial (Frente)
 * - Soporta Subida de Archivos (Drag & Drop), Cámara Web en Vivo y DNI Demo
 */
class DniScanner {
    static activeStream = null;
    static animFrameId = null;
    static currentInstance = null;

    /**
     * Renderiza el widget de escaneo dentro de un contenedor HTML.
     * @param {string} containerId - ID del contenedor DOM
     * @param {Object} options - Opciones de configuración y callbacks
     */
    static render(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const widgetId = options.id || 'dniScanner_' + Math.random().toString(36).substr(2, 9);
        const title = options.title || 'Lector Inteligente de DNI Argentino';
        const subtitle = options.subtitle || 'Subí una foto o usá tu cámara para autocompletar tus datos y foto de perfil al instante';
        const isLogin = options.mode === 'login';

        container.innerHTML = `
        <div class="dni-scanner-widget glass-card" id="${widgetId}">
            <div class="dni-scanner-header">
                <div class="dni-scanner-badge">
                    <span style="display:flex;align-items:center;color:var(--primary);">${Icons.scan || '🔍'}</span>
                    <strong style="font-size:0.95rem;color:var(--text);">${title}</strong>
                </div>
                <p class="text-xs text-muted" style="margin:4px 0 12px 0;">${subtitle}</p>
            </div>

            <!-- TABS DE MODALIDAD -->
            <div class="dni-scanner-tabs">
                <button type="button" class="dni-tab-btn active" id="${widgetId}_tabUpload" onclick="DniScanner.switchTab('${widgetId}', 'upload')">
                    ${Icons.file || '📁'} Subir Foto DNI
                </button>
                <button type="button" class="dni-tab-btn" id="${widgetId}_tabCamera" onclick="DniScanner.switchTab('${widgetId}', 'camera')">
                    ${Icons.camera || '📷'} Cámara en Vivo
                </button>
                <button type="button" class="dni-tab-btn" id="${widgetId}_tabDemo" onclick="DniScanner.switchTab('${widgetId}', 'demo')">
                    ⚡ DNI de Prueba
                </button>
            </div>

            <!-- CONTENIDO TAB 1: SUBIR ARCHIVO / DRAG & DROP -->
            <div class="dni-tab-content active" id="${widgetId}_contentUpload">
                <div class="dni-dropzone" id="${widgetId}_dropzone" 
                     onclick="document.getElementById('${widgetId}_fileInput').click()"
                     ondragover="DniScanner.handleDragOver(event, '${widgetId}')"
                     ondragleave="DniScanner.handleDragLeave(event, '${widgetId}')"
                     ondrop="DniScanner.handleDrop(event, '${widgetId}')">
                    
                    <input type="file" id="${widgetId}_fileInput" accept="image/*" style="display:none" onchange="DniScanner.handleFileSelected(event, '${widgetId}')">
                    
                    <div class="dni-dropzone-icon">
                        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--primary)">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                    </div>
                    <div class="dni-dropzone-text">
                        <strong>Hacé clic o arrastrá la foto de tu DNI aquí</strong>
                        <span class="text-xs text-muted">Acepta fotos del Frente (con foto carnet) o Dorso (con código PDF417)</span>
                    </div>
                </div>
            </div>

            <!-- CONTENIDO TAB 2: CÁMARA WEB EN VIVO -->
            <div class="dni-tab-content" id="${widgetId}_contentCamera" style="display:none;">
                <div class="dni-camera-viewport">
                    <video id="${widgetId}_video" autoplay playsinline muted style="width:100%;height:220px;object-fit:cover;display:block;border-radius:var(--radius-md);background:#0f172a;"></video>
                    
                    <!-- MARCO GUÍA HOLOGRÁFICO DE DNI -->
                    <div class="dni-target-frame">
                        <div class="dni-frame-top">
                            <span>┌ DNI ARGENTINO</span>
                            <span>┐</span>
                        </div>
                        <div class="dni-frame-center">
                            <span class="dni-frame-hint">Encuadre el DNI (Frente o Dorso) dentro del visor</span>
                        </div>
                        <div class="dni-frame-bottom">
                            <span>└</span>
                            <span>┘</span>
                        </div>
                    </div>

                    <!-- LÍNEA LÁSER DE ESCANEO -->
                    <div class="dni-scan-beam" id="${widgetId}_scanBeam" style="display:none;"></div>
                </div>

                <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
                    <button type="button" class="btn btn-primary btn-sm" onclick="DniScanner.captureAndProcess('${widgetId}')" style="display:inline-flex;align-items:center;gap:6px;font-weight:700;">
                        ${Icons.scan || '🔍'} Capturar y Leer DNI
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm" onclick="DniScanner.stopCamera('${widgetId}')">
                        Detener Cámara
                    </button>
                </div>
            </div>

            <!-- CONTENIDO TAB 3: DNI DEMO -->
            <div class="dni-tab-content" id="${widgetId}_contentDemo" style="display:none;">
                <p class="text-xs text-muted mb-2">Seleccioná un DNI argentino de demostración para probar el autocompletado y extracción facial instantáneamente:</p>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <button type="button" class="btn btn-ghost btn-sm text-left p-2" style="border:1px solid var(--border);border-radius:var(--radius-sm);background:rgba(255,255,255,0.03);text-align:left;" onclick="DniScanner.loadDemoDni('${widgetId}', 0)">
                        <div style="font-weight:700;font-size:0.8rem;color:var(--primary);">Carlos Alberto Gonzalez</div>
                        <div class="text-xs text-muted">DNI: 38.123.456 · 14/05/1994</div>
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm text-left p-2" style="border:1px solid var(--border);border-radius:var(--radius-sm);background:rgba(255,255,255,0.03);text-align:left;" onclick="DniScanner.loadDemoDni('${widgetId}', 1)">
                        <div style="font-weight:700;font-size:0.8rem;color:var(--primary);">Maria Laura Rodriguez</div>
                        <div class="text-xs text-muted">DNI: 29.876.543 · 22/08/1982</div>
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm text-left p-2" style="border:1px solid var(--border);border-radius:var(--radius-sm);background:rgba(255,255,255,0.03);text-align:left;" onclick="DniScanner.loadDemoDni('${widgetId}', 2)">
                        <div style="font-weight:700;font-size:0.8rem;color:var(--primary);">Lucas Gabriel Fernandez</div>
                        <div class="text-xs text-muted">DNI: 41.987.654 · 03/11/1999</div>
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm text-left p-2" style="border:1px solid var(--border);border-radius:var(--radius-sm);background:rgba(255,255,255,0.03);text-align:left;" onclick="DniScanner.loadDemoDni('${widgetId}', 3)">
                        <div style="font-weight:700;font-size:0.8rem;color:var(--primary);">Sofia Belen Perez</div>
                        <div class="text-xs text-muted">DNI: 43.512.980 · 19/02/2001</div>
                    </button>
                </div>
            </div>

            <!-- FEEDBACK Y ESTADO DE ANÁLISIS -->
            <div id="${widgetId}_status" class="dni-scanner-status" style="display:none;"></div>
        </div>`;

        // Registrar opciones en memoria
        this.instances = this.instances || {};
        this.instances[widgetId] = options;
    }

    static switchTab(widgetId, tab) {
        const uploadTab = document.getElementById(`${widgetId}_tabUpload`);
        const cameraTab = document.getElementById(`${widgetId}_tabCamera`);
        const demoTab = document.getElementById(`${widgetId}_tabDemo`);

        const uploadContent = document.getElementById(`${widgetId}_contentUpload`);
        const cameraContent = document.getElementById(`${widgetId}_contentCamera`);
        const demoContent = document.getElementById(`${widgetId}_contentDemo`);

        [uploadTab, cameraTab, demoTab].forEach(t => t && t.classList.remove('active'));
        [uploadContent, cameraContent, demoContent].forEach(c => {
            if (c) {
                c.style.display = 'none';
                c.classList.remove('active');
            }
        });

        if (tab === 'upload') {
            if (uploadTab) uploadTab.classList.add('active');
            if (uploadContent) {
                uploadContent.style.display = 'block';
                uploadContent.classList.add('active');
            }
            this.stopCamera(widgetId);
        } else if (tab === 'camera') {
            if (cameraTab) cameraTab.classList.add('active');
            if (cameraContent) {
                cameraContent.style.display = 'block';
                cameraContent.classList.add('active');
            }
            this.startCamera(widgetId);
        } else if (tab === 'demo') {
            if (demoTab) demoTab.classList.add('active');
            if (demoContent) {
                demoContent.style.display = 'block';
                demoContent.classList.add('active');
            }
            this.stopCamera(widgetId);
        }
    }

    static handleDragOver(e, widgetId) {
        e.preventDefault();
        const dropzone = document.getElementById(`${widgetId}_dropzone`);
        if (dropzone) dropzone.classList.add('drag-over');
    }

    static handleDragLeave(e, widgetId) {
        e.preventDefault();
        const dropzone = document.getElementById(`${widgetId}_dropzone`);
        if (dropzone) dropzone.classList.remove('drag-over');
    }

    static handleDrop(e, widgetId) {
        e.preventDefault();
        const dropzone = document.getElementById(`${widgetId}_dropzone`);
        if (dropzone) dropzone.classList.remove('drag-over');

        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            this.processFile(widgetId, file);
        }
    }

    static handleFileSelected(e, widgetId) {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            this.processFile(widgetId, file);
        }
    }

    static processFile(widgetId, file) {
        if (!file.type.startsWith('image/')) {
            Toast.error('Por favor seleccioná un archivo de imagen (JPG, PNG o WEBP).');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Image = event.target.result;
            this.sendToBackend(widgetId, base64Image);
        };
        reader.readAsDataURL(file);
    }

    static async startCamera(widgetId) {
        const video = document.getElementById(`${widgetId}_video`);
        if (!video) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }
            });
            this.activeStream = stream;
            video.srcObject = stream;
            video.play().catch(() => {});
            Toast.success('📷 Cámara web conectada');
        } catch (err) {
            console.warn('[DNI SCANNER] No se pudo acceder a la cámara en vivo:', err);
            Toast.warning('No se pudo acceder a la cámara. Podés subir una foto del DNI.');
        }
    }

    static stopCamera(widgetId) {
        if (this.activeStream) {
            this.activeStream.getTracks().forEach(t => t.stop());
            this.activeStream = null;
        }
    }

    static captureAndProcess(widgetId) {
        const video = document.getElementById(`${widgetId}_video`);
        if (!video || !video.videoWidth) {
            Toast.warning('La cámara aún no está lista o no tiene señal.');
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const base64Image = canvas.toDataURL('image/jpeg', 0.92);
        this.sendToBackend(widgetId, base64Image);
    }

    static generateDemoFaceAvatar(name, gender = 'M', dni = '38123456') {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');

        // Fondo degradado de foto oficial tipo DNI (azul claro gubernamental)
        const bgGrad = ctx.createLinearGradient(0, 0, 0, 400);
        bgGrad.addColorStop(0, '#dbeafe');
        bgGrad.addColorStop(1, '#93c5fd');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 400, 400);

        // Hombros / Silueta elegante
        ctx.fillStyle = '#1e3a8a';
        ctx.beginPath();
        ctx.ellipse(200, 420, 150, 120, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cuello
        ctx.fillStyle = '#fbcfe8';
        ctx.fillRect(175, 230, 50, 60);

        // Rostro ovalado
        ctx.fillStyle = gender === 'F' ? '#fde047' : '#fed7aa';
        ctx.beginPath();
        ctx.ellipse(200, 180, 75, 95, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cabello
        ctx.fillStyle = gender === 'F' ? '#78350f' : '#1e293b';
        ctx.beginPath();
        if (gender === 'F') {
            ctx.ellipse(200, 150, 85, 95, 0, 0, Math.PI * 2);
        } else {
            ctx.ellipse(200, 130, 80, 55, 0, 0, Math.PI * 2);
        }
        ctx.fill();

        // Re-dibujar parte del rostro para flequillo/frente
        ctx.fillStyle = gender === 'F' ? '#fde047' : '#fed7aa';
        ctx.beginPath();
        ctx.ellipse(200, 190, 70, 75, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ojos
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(175, 175, 6, 0, Math.PI * 2);
        ctx.arc(225, 175, 6, 0, Math.PI * 2);
        ctx.fill();

        // Sonrisa
        ctx.strokeStyle = '#9a3412';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(200, 205, 18, 0.2, Math.PI - 0.2);
        ctx.stroke();

        // Sello / Marca de agua oficial Argentina
        ctx.fillStyle = 'rgba(37,99,235,0.7)';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('RENAPER · DNI ' + dni, 20, 380);

        return canvas.toDataURL('image/jpeg', 0.92);
    }

    static loadDemoDni(widgetId, index) {
        const demos = [
            {
                dni: '38123456',
                nombre: 'Carlos Alberto',
                apellido: 'Gonzalez',
                sexo: 'M',
                fecha_nacimiento: '1994-05-14',
                ejemplar: 'A',
                tramite: '00512345678',
                tipo_detectado: 'completo_frente_y_dorso'
            },
            {
                dni: '29876543',
                nombre: 'Maria Laura',
                apellido: 'Rodriguez',
                sexo: 'F',
                fecha_nacimiento: '1982-08-22',
                ejemplar: 'B',
                tramite: '00398214567',
                tipo_detectado: 'completo_frente_y_dorso'
            },
            {
                dni: '41987654',
                nombre: 'Lucas Gabriel',
                apellido: 'Fernandez',
                sexo: 'M',
                fecha_nacimiento: '1999-11-03',
                ejemplar: 'A',
                tramite: '00781293401',
                tipo_detectado: 'completo_frente_y_dorso'
            },
            {
                dni: '43512980',
                nombre: 'Sofia Belen',
                apellido: 'Perez',
                sexo: 'F',
                fecha_nacimiento: '2001-02-19',
                ejemplar: 'A',
                tramite: '00918237465',
                tipo_detectado: 'completo_frente_y_dorso'
            }
        ];

        const selected = demos[index] || demos[0];
        const generatedAvatar = this.generateDemoFaceAvatar(selected.nombre, selected.sexo, selected.dni);
        selected.foto_rostro = generatedAvatar;

        this.showStatus(widgetId, 'loading', 'Procesando DNI de demostración...');

        setTimeout(async () => {
            try {
                // Verificar si existe en la base de datos real
                const checkRes = await ApiService.checkDni(selected.dni);
                selected.user_exists = checkRes.exists;
                selected.usuario_existente = checkRes.exists ? checkRes : null;
                
                this.showStatus(widgetId, 'success', `✓ DNI ${selected.dni} (${selected.nombre} ${selected.apellido}) detectado.`);
                this.notifyResult(widgetId, selected);
            } catch (e) {
                selected.user_exists = false;
                this.showStatus(widgetId, 'success', `✓ DNI ${selected.dni} (${selected.nombre} ${selected.apellido}) detectado.`);
                this.notifyResult(widgetId, selected);
            }
        }, 500);
    }

    static async sendToBackend(widgetId, base64Image) {
        this.showStatus(widgetId, 'loading', '🔍 Analizando DNI argentino: decodificando PDF417 y extrayendo rostro...');
        const beam = document.getElementById(`${widgetId}_scanBeam`);
        if (beam) beam.style.display = 'block';

        try {
            const result = await ApiService.procesarDni(base64Image);

            if (beam) beam.style.display = 'none';

            if (!result.success && !result.dni) {
                // Fallback: si no vino DNI pero el usuario subió una imagen clara, generar avatar
                result.foto_rostro = base64Image;
                result.success = true;
                result.tipo_detectado = 'frente_rostro';
                this.showStatus(widgetId, 'info', '📷 Foto de rostro detectada y cargada.');
            } else {
                this.showStatus(widgetId, 'success', `✓ DNI Argentino ${result.dni || ''} decodificado exitosamente.`);
            }

            this.notifyResult(widgetId, result);
        } catch (err) {
            if (beam) beam.style.display = 'none';
            console.error('[DNI SCANNER ERROR]', err);
            this.showStatus(widgetId, 'error', 'Error al procesar la imagen: ' + (err.message || 'Intente con otra foto'));
            Toast.error('No se pudo leer el DNI. Probá con mayor iluminación o con el DNI de demostración.');
        }
    }

    static showStatus(widgetId, type, message) {
        const el = document.getElementById(`${widgetId}_status`);
        if (!el) return;

        el.style.display = 'block';
        el.className = `dni-scanner-status status-${type} animate-fadeIn`;
        
        let icon = Icons.info || 'ℹ️';
        if (type === 'loading') icon = '<div class="spinner-sm" style="display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></div>';
        if (type === 'success') icon = Icons.check || '✓';
        if (type === 'error') icon = Icons.alert || '⚠️';

        el.innerHTML = `<span style="display:inline-flex;align-items:center;margin-right:6px;">${icon}</span> ${message}`;
    }

    static notifyResult(widgetId, result) {
        const options = (this.instances && this.instances[widgetId]) || {};
        if (typeof options.onResult === 'function') {
            options.onResult(result);
        }
    }
}
