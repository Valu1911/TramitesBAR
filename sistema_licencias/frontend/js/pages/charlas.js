/**
 * Página de Charlas - Videos de seguridad vial
 * No se puede avanzar sin ver todos los videos en orden
 */
class CharlasPage {
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
            if (err.status === 403) {
                app.innerHTML = `
                ${renderBackHeader('Charlas en video')}
                <div class="page-content container-md">
                    <div class="info-box info-box--warning">
                        <span style="display:flex;align-items:center">${Icons.alert}</span>
                        <span>${err.message}</span>
                    </div>
                </div>`;
            } else {
                Toast.error(err.message);
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
                    <span>¡Completaste todas las charlas! Podés continuar al examen teórico.</span>
                </div>
                <button class="btn btn-primary btn-block btn-lg" onclick="Router.navigate('examen')">
                    Continuar al examen teórico →
                </button>
            </div>` : `
            <div class="info-box info-box--info mt-4">
                <span style="display:flex;align-items:center">${Icons.info}</span>
                <span>Debés ver todos los videos para continuar al examen teórico.</span>
            </div>`}
        </div>`;
        
        if (window.Tutorial) {
            setTimeout(() => window.Tutorial.startTutorialWithContext('charlas'), 300);
        }
    }

    static async watchVideo(videoId, titulo) {
        // Mostrar modal de video
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'videoModal';
        overlay.innerHTML = `
        <div class="modal" style="max-width:640px">
            <div class="modal__header">
                <div class="flex-between">
                    <h2 class="modal__title" style="font-size:0.95rem">${titulo}</h2>
                    <button class="btn btn-ghost btn-sm" onclick="document.getElementById('videoModal').remove()">✕</button>
                </div>
            </div>
            <div class="modal__body" style="padding:0">
                <div style="aspect-ratio:16/9;background:var(--blue-950);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px">
                    <div style="font-size:4rem;color:var(--sky-400);display:flex;align-items:center;justify-content:center">${Icons.video}</div>
                    <p style="color:white;font-size:0.9rem;font-weight:600">${titulo}</p>
                    <p style="color:rgba(255,255,255,0.5);font-size:0.75rem">Simulación de reproducción de video</p>
                    <div id="videoProgress" style="width:80%;height:4px;background:rgba(255,255,255,0.2);border-radius:4px;overflow:hidden">
                        <div id="videoProgressBar" style="width:0%;height:100%;background:var(--sky-400);transition:width 0.3s linear"></div>
                    </div>
                    <p id="videoTimer" style="color:rgba(255,255,255,0.6);font-size:0.75rem">Cargando...</p>
                </div>
            </div>
            <div class="modal__footer">
                <button class="btn btn-primary btn-block" id="videoCompleteBtn" disabled onclick="CharlasPage.completeVideo(${videoId})">
                    Esperá a que termine el video...
                </button>
            </div>
        </div>`;

        document.body.appendChild(overlay);

        // Simular reproducción de 5 segundos
        let elapsed = 0;
        const total = 5;
        const interval = setInterval(() => {
            elapsed++;
            const pct = Math.min((elapsed / total) * 100, 100);
            const bar = document.getElementById('videoProgressBar');
            const timer = document.getElementById('videoTimer');
            const btn = document.getElementById('videoCompleteBtn');
            
            if (bar) bar.style.width = pct + '%';
            if (timer) timer.textContent = `${elapsed}s / ${total}s`;
            
            if (elapsed >= total) {
                clearInterval(interval);
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = '✓ Marcar como visto';
                }
                if (timer) timer.textContent = '¡Video completado!';
            }
        }, 1000);
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
            const modal = document.getElementById('videoModal');
            if (modal) modal.remove();
            // Recargar la página
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message);
            if (btn) {
                btn.disabled = false;
                btn.textContent = '✓ Marcar como visto';
            }
        }
    }
}
