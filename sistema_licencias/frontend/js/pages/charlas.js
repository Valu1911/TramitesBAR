/**
 * Página de Charlas - Videos de seguridad vial
 * No se puede avanzar sin ver todos los videos en orden
 */
class CharlasPage {
    static getFallbackData() {
        const demoVistos = JSON.parse(localStorage.getItem('demo_videos_vistos') || '[]');
        const videos = [
            { id: 1, titulo: 'Módulo 1: Señales de Tránsito y Prioridades de Paso', duracion: '5 min', orden: 1, visto: demoVistos.includes(1) },
            { id: 2, titulo: 'Módulo 2: Velocidades Máximas y Distancias de Frenado', duracion: '8 min', orden: 2, visto: demoVistos.includes(2) },
            { id: 3, titulo: 'Módulo 3: Conducción Defensiva y Alcohol al Volante', duracion: '10 min', orden: 3, visto: demoVistos.includes(3) },
            { id: 4, titulo: 'Módulo 4: Normativa Municipal de Baradero y Estacionamiento', duracion: '6 min', orden: 4, visto: demoVistos.includes(4) }
        ];
        return { videos, todos_vistos: videos.every(v => v.visto) };
    }

    static async render(app) {
        app.innerHTML = `
        ${renderBackHeader('Charlas en video')}
        <div class="page-content container-md">
            <div class="text-center" style="padding:40px 0">
                <div class="spinner" style="margin:0 auto"></div>
                <p class="text-muted mt-3">Cargando videos...</p>
            </div>
        </div>`;

        try {
            const data = await ApiService.getVideos();
            this.renderContent(app, data);
        } catch (err) {
            // Si el backend no está disponible o el paso está restringido, cargar demo interactivo
            const fallback = this.getFallbackData();
            this.renderContent(app, fallback);
            if (err && err.status === 403) {
                Toast.info('Modo Demo / Vista Previa: Mostrando charlas de capacitación.');
            }
        }
    }

    static renderContent(app, data) {
        const videos = data.videos;
        const todosVistos = data.todos_vistos;

        app.innerHTML = `
        ${renderBackHeader('Charlas en video')}
        <div class="page-content container-md animate-slideUp">
            <p class="text-sm text-muted mb-4">
                Mirá todas las charlas obligatorias sobre seguridad vial para avanzar al siguiente paso.
                Los videos deben verse en orden.
            </p>

            <div class="stack">
                ${videos.map((video, i) => {
                    const canWatch = video.visto || videos.slice(0, i).every(v => v.visto);
                    return `
                    <div class="video-card ${video.visto ? 'video-card--watched' : ''}" 
                         id="video-${video.id}"
                         style="${!canWatch && !video.visto ? 'opacity:0.5' : ''}">
                        <div class="video-card__icon" style="display:flex;align-items:center;justify-content:center">
                            ${video.visto ? '<span style="color:var(--success);display:flex;align-items:center">' + Icons.check + '</span>' : (canWatch ? '<span style="color:var(--primary);display:flex;align-items:center">' + Icons.play + '</span>' : '<span style="color:var(--text-muted);display:flex;align-items:center">' + Icons.lock + '</span>')}
                        </div>
                        <div class="video-card__info">
                            <div class="video-card__title">${video.titulo}</div>
                            <div class="video-card__duration" style="display:flex;align-items:center;gap:4px">
                                <span style="display:flex;align-items:center">${Icons.clock}</span> ${video.duracion}
                            </div>
                        </div>
                        ${!video.visto && canWatch ? `
                        <button class="btn btn-outline btn-sm" onclick="CharlasPage.watchVideo(${video.id}, '${video.titulo.replace(/'/g, "\\'")}')">
                            Ver video
                        </button>` : ''}
                    </div>`;
                }).join('')}
            </div>

            ${todosVistos ? `
            <div class="mt-4">
                <div class="info-box info-box--success mb-3">
                    <span style="display:flex;align-items:center">${Icons.check}</span>
                    <span>¡Completaste todas las charlas! Podés continuar con los formularios de salud.</span>
                </div>
                <button class="btn btn-primary btn-block btn-lg" onclick="Router.navigate('formularios')">
                    Continuar a formularios de salud →
                </button>
            </div>` : `
            <div class="info-box info-box--info mt-4">
                <span style="display:flex;align-items:center">${Icons.info}</span>
                <span>Debés ver todos los videos para continuar a los formularios de salud.</span>
            </div>`}
        </div>`;
        
        if (window.Tutorial) {
            setTimeout(() => window.Tutorial.startTutorialWithContext('charlas'), 300);
        }
    }

    static async watchVideo(videoId, titulo) {
        // Cerrar modal anterior si existe
        this.closeVideoModal();

        // Crear Modal Overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay animate-fadeIn';
        overlay.id = 'videoModal';
        overlay.style.zIndex = '10050';
        
        overlay.innerHTML = `
        <div class="modal animate-slideUp" style="max-width:680px;border-radius:16px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5)">
            <div class="modal__header" style="background:var(--bg-card);padding:14px 20px;border-bottom:1px solid var(--border)">
                <div class="flex-between">
                    <div style="display:flex;align-items:center;gap:10px">
                        <span style="display:flex;align-items:center;color:var(--primary);font-size:1.2rem">${Icons.video}</span>
                        <div>
                            <h2 class="modal__title" style="font-size:0.95rem;font-weight:700;margin:0">${titulo}</h2>
                            <p style="font-size:0.75rem;color:var(--text-muted);margin:0">Capacitación en Seguridad Vial · Baradero</p>
                        </div>
                    </div>
                    <button class="btn btn-ghost btn-sm" onclick="CharlasPage.closeVideoModal()" style="font-size:1.2rem;line-height:1">✕</button>
                </div>
            </div>
            <div class="modal__body" style="padding:0;background:#030712;position:relative">
                <!-- Video Screen Canvas Simulation -->
                <div style="aspect-ratio:16/9;position:relative;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;background:radial-gradient(circle at center, #1e293b 0%, #030712 100%);overflow:hidden">
                    
                    <!-- Top Live Badge -->
                    <div style="position:absolute;top:16px;left:16px;display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);padding:4px 10px;border-radius:20px;font-size:0.72rem;color:#38bdf8;font-weight:600;border:1px solid rgba(56,189,248,0.3)">
                        <span style="width:8px;height:8px;border-radius:50%;background:#22c55e;animation:pulse-ring 1s infinite"></span>
                        REPRODUCIENDO · 1080p HD
                    </div>

                    <!-- Center Playing Animation Icon -->
                    <div id="videoCenterIcon" style="width:80px;height:80px;border-radius:50%;background:rgba(37,99,235,0.2);border:2px solid var(--primary);display:flex;align-items:center;justify-content:center;color:white;font-size:2.5rem;box-shadow:0 0 30px rgba(37,99,235,0.4);animation:pulse-ring 1.5s ease-in-out infinite">
                        ${Icons.play}
                    </div>

                    <!-- Video Subtitle / Title -->
                    <div style="text-align:center;padding:0 20px;z-index:2">
                        <p style="color:white;font-size:1rem;font-weight:700;margin-bottom:4px;text-shadow:0 2px 4px rgba(0,0,0,0.8)">${titulo}</p>
                        <p id="videoStatusText" style="color:#94a3b8;font-size:0.8rem;margin:0">Simulación de reproducción en curso... (3 segundos)</p>
                    </div>

                    <!-- Player Bottom Bar -->
                    <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top, rgba(3,7,18,0.95), transparent);padding:16px 20px 12px">
                        <!-- Progress Bar Container -->
                        <div id="videoProgress" style="width:100%;height:6px;background:rgba(255,255,255,0.2);border-radius:4px;overflow:hidden;margin-bottom:8px">
                            <div id="videoProgressBar" style="width:0%;height:100%;background:linear-gradient(90deg, #38bdf8, #2563eb);border-radius:4px;transition:width 0.1s linear"></div>
                        </div>

                        <!-- Time & Controls -->
                        <div class="flex-between" style="color:#94a3b8;font-size:0.75rem">
                            <div style="display:flex;align-items:center;gap:12px">
                                <span style="color:white;display:flex;align-items:center">${Icons.play}</span>
                                <span id="videoTimer" style="font-weight:600;color:white">0s / 3s</span>
                            </div>
                            <div style="display:flex;align-items:center;gap:8px">
                                <span>🔊 100%</span>
                                <span style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;font-size:0.65rem;color:white">HD</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal__footer" style="background:var(--bg-card);padding:16px 20px;border-top:1px solid var(--border)">
                <button class="btn btn-primary btn-block btn-lg" id="videoCompleteBtn" disabled onclick="CharlasPage.completeVideo(${videoId})" style="font-weight:700">
                    <span id="videoBtnText">Mirando video (esperá 3 segundos)...</span>
                </button>
            </div>
        </div>`;

        document.body.appendChild(overlay);

        // Animar reproducción fluida durante exactamente 3 segundos (3000ms)
        const totalMs = 3000;
        const start = Date.now();

        this.videoTimerInterval = setInterval(() => {
            const elapsed = Date.now() - start;
            const pct = Math.min((elapsed / totalMs) * 100, 100);
            const seconds = Math.min(Math.floor(elapsed / 1000) + 1, 3);

            const bar = document.getElementById('videoProgressBar');
            const timer = document.getElementById('videoTimer');
            const statusText = document.getElementById('videoStatusText');
            const btn = document.getElementById('videoCompleteBtn');
            const btnText = document.getElementById('videoBtnText');
            const centerIcon = document.getElementById('videoCenterIcon');

            if (bar) bar.style.width = pct + '%';
            if (timer) timer.textContent = `${seconds}s / 3s`;

            if (elapsed >= totalMs) {
                clearInterval(this.videoTimerInterval);

                if (bar) bar.style.width = '100%';
                if (timer) timer.textContent = '3s / 3s';
                if (statusText) statusText.innerHTML = '<span style="color:#4ade80;font-weight:700">¡Video completado!</span>';
                if (centerIcon) {
                    centerIcon.style.borderColor = '#22c55e';
                    centerIcon.style.boxShadow = '0 0 30px rgba(34,197,94,0.5)';
                    centerIcon.innerHTML = `<span style="color:#22c55e">${Icons.check}</span>`;
                }

                if (btn) {
                    btn.disabled = false;
                    btn.style.background = 'var(--success)';
                    btn.style.borderColor = 'var(--success)';
                }
                if (btnText) btnText.textContent = '✓ Marcar como visto';
            }
        }, 50);
    }

    static closeVideoModal() {
        if (this.videoTimerInterval) clearInterval(this.videoTimerInterval);
        const modal = document.getElementById('videoModal');
        if (modal) modal.remove();
    }

    static async completeVideo(videoId) {
        const btn = document.getElementById('videoCompleteBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Guardando...';
        }

        try {
            await ApiService.marcarVideoVisto(videoId);
            Toast.success('Video marcado como visto');
            this.closeVideoModal();
            this.render(document.getElementById('app'));
        } catch (err) {
            let demoVistos = JSON.parse(localStorage.getItem('demo_videos_vistos') || '[]');
            if (!demoVistos.includes(videoId)) demoVistos.push(videoId);
            localStorage.setItem('demo_videos_vistos', JSON.stringify(demoVistos));

            Toast.success('Video marcado como visto (Modo Demo)');
            this.closeVideoModal();
            this.render(document.getElementById('app'));
        }
    }
}
