/**
 * Bari Tutorial System
 * Guided tutorial with Bari (the Baradero capybara mascot): floating launcher,
 * spotlight engine and a guide card whose mascot is rendered from transparent
 * video frames (canvas chroma/flood-fill clean-up).
 *
 * Public API (kept stable, used by every page):
 *   window.Tutorial.startTutorialWithContext(context, force)
 *   window.Tutorial.showApprovalGreeting(nombre)
 *   window.Tutorial.syncLauncher()
 */

// ============================================================================
// Canvas renderer: draws the current video frame and makes the outer
// background (near-black or transparent) fully transparent.
// ============================================================================
class BariCanvasRenderer {
    constructor(canvas, video) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });
        this.video = video;
        this.animId = null;
        this.isRunning = false;
        this.w = canvas.width || 185;
        this.h = canvas.height || 255;

        // Offscreen buffer: isolates each frame so nothing accumulates
        this.scratchCanvas = document.createElement('canvas');
        this.scratchCanvas.width = this.w;
        this.scratchCanvas.height = this.h;
        this.scratchCtx = this.scratchCanvas.getContext('2d', { willReadFrequently: true });

        this.crop = { sx: 0, sy: 175, sw: 720, sh: 992 };
        this.targetSrc = null;
        this.visited = new Uint8Array(this.w * this.h);
        this.queue = new Int32Array(this.w * this.h);
        this.onFallback = null;
        this.fallbackTriggered = false;
    }

    updateElements(canvas, video) {
        if (canvas && canvas !== this.canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d', { willReadFrequently: true });
            this.w = canvas.width || 185;
            this.h = canvas.height || 255;
            this.scratchCanvas.width = this.w;
            this.scratchCanvas.height = this.h;
            this.visited = new Uint8Array(this.w * this.h);
            this.queue = new Int32Array(this.w * this.h);
        }
        if (video) this.video = video;
    }

    // Crop windows that center Bari at a 185:255 ratio, per source video
    setCropForVideo(src) {
        if (!src) return;
        this.targetSrc = src;
        this.clear();
        if (src.includes('der.webm') || src.includes('deslizar.webm')) {
            this.crop = { sx: 361, sy: 0, sw: 522, sh: 720 };      // horizontal 1260x720
        } else if (src.includes('salu2.webm')) {
            this.crop = { sx: 138, sy: 59, sw: 433, sh: 597 };     // square 720x720
        } else if (src.includes('izquierda.webm')) {
            this.crop = { sx: 0, sy: 139, sw: 720, sh: 992 };      // vertical 720x1260
        } else {
            this.crop = { sx: 0, sy: 175, sw: 720, sh: 992 };      // lipsting.webm 720x1260
        }
    }

    clear() {
        if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
        if (this.scratchCtx) this.scratchCtx.clearRect(0, 0, this.w, this.h);
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        const loop = () => {
            if (!this.isRunning) return;
            this.render();
            this.animId = requestAnimationFrame(loop);
        };
        this.animId = requestAnimationFrame(loop);
    }

    stop() {
        this.isRunning = false;
        if (this.animId) {
            cancelAnimationFrame(this.animId);
            this.animId = null;
        }
        this.clear();
    }

    readFrameSafely(w, h) {
        try {
            return this.scratchCtx.getImageData(0, 0, w, h);
        } catch (error) {
            // Tainted canvas (e.g. opened from file://): switch to direct video mode
            this.stop();
            if (!this.fallbackTriggered) {
                this.fallbackTriggered = true;
                if (typeof this.onFallback === 'function') this.onFallback(error);
            }
            return null;
        }
    }

    render() {
        if (!this.video || this.video.readyState < 2) return;
        if (this.targetSrc && this.video.currentSrc &&
            !this.video.currentSrc.includes(this.targetSrc.split('/').pop())) return;

        const { sx, sy, sw, sh } = this.crop;
        const w = this.w;
        const h = this.h;

        this.scratchCtx.clearRect(0, 0, w, h);
        this.scratchCtx.drawImage(this.video, sx, sy, sw, sh, 0, 0, w, h);

        const imgData = this.readFrameSafely(w, h);
        if (!imgData) return;
        const data = imgData.data;
        const visited = this.visited;
        visited.fill(0);
        const queue = this.queue;
        let head = 0;
        let tail = 0;

        // Background = native alpha (<25) or near-black (<26 in every channel)
        const isBgPixel = (p) =>
            data[p + 3] < 25 || (data[p] < 26 && data[p + 1] < 26 && data[p + 2] < 26);

        // Seed from the frame borders
        for (let x = 0; x < w; x++) {
            const top = x;
            if (isBgPixel(top * 4)) { visited[top] = 1; queue[tail++] = top; }
            const bot = (h - 1) * w + x;
            if (isBgPixel(bot * 4)) { visited[bot] = 1; queue[tail++] = bot; }
        }
        for (let y = 0; y < h; y++) {
            const l = y * w;
            if (!visited[l] && isBgPixel(l * 4)) { visited[l] = 1; queue[tail++] = l; }
            const r = y * w + (w - 1);
            if (!visited[r] && isBgPixel(r * 4)) { visited[r] = 1; queue[tail++] = r; }
        }

        // BFS flood-fill: only the continuous outer background
        while (head < tail) {
            const curr = queue[head++];
            const cx = curr % w;
            const cy = (curr / w) | 0;
            if (cx > 0) {
                const n = curr - 1;
                if (!visited[n] && isBgPixel(n * 4)) { visited[n] = 1; queue[tail++] = n; }
            }
            if (cx < w - 1) {
                const n = curr + 1;
                if (!visited[n] && isBgPixel(n * 4)) { visited[n] = 1; queue[tail++] = n; }
            }
            if (cy > 0) {
                const n = curr - w;
                if (!visited[n] && isBgPixel(n * 4)) { visited[n] = 1; queue[tail++] = n; }
            }
            if (cy < h - 1) {
                const n = curr + w;
                if (!visited[n] && isBgPixel(n * 4)) { visited[n] = 1; queue[tail++] = n; }
            }
        }

        for (let i = 0; i < w * h; i++) {
            if (visited[i]) data[i * 4 + 3] = 0;
        }

        this.ctx.clearRect(0, 0, w, h);
        this.ctx.putImageData(imgData, 0, 0);
    }
}

// ============================================================================
// Tutorial system
// ============================================================================
class TutorialSystem {
    constructor() {
        this.currentStep = 0;
        this.steps = [];
        this.isActive = false;
        this.currentKey = null;
        this.currentContext = null;
        this.bariRenderer = null;
        this.launcher = null;
        this.overlay = null;
        this.spotlight = null;
        this.guideCard = null;
        this.listenersBound = false;

        // Contexts that have a tutorial (the launcher is shown only on these pages)
        this.launcherPages = [
            'dashboard', 'charlas', 'formularios', 'examen', 'pago', 'practico', 'entrega',
            'admin-pagos', 'admin-salud', 'admin-turnos'
        ];

        this.onResize = () => { if (this.isActive) this.updateSpotlight(); };
        this.onScroll = () => { if (this.isActive) this.updateSpotlight(); };
        this.onKeyDown = (e) => {
            if (this.isActive && e.key === 'Escape') this.endTutorial(true);
        };
    }

    // ---------------------------------------------------------------- DOM

    init() {
        this.ensureOverlay();
        this.ensureGuideCard();

        if (!this.listenersBound) {
            window.addEventListener('resize', this.onResize);
            window.addEventListener('scroll', this.onScroll, { passive: true });
            document.addEventListener('keydown', this.onKeyDown);
            this.listenersBound = true;
        }
    }

    ensureOverlay() {
        if (!this.overlay) {
            this.overlay = document.getElementById('tutorial-overlay');
            if (!this.overlay) {
                this.overlay = document.createElement('div');
                this.overlay.id = 'tutorial-overlay';
                document.body.appendChild(this.overlay);
            }
        }
        if (!this.spotlight) {
            this.spotlight = document.getElementById('tutorial-spotlight');
            if (!this.spotlight) {
                this.spotlight = document.createElement('div');
                this.spotlight.id = 'tutorial-spotlight';
                document.body.appendChild(this.spotlight);
            }
        }
    }

    ensureGuideCard() {
        let card = document.getElementById('tutorial-guide-card');
        if (!card) {
            card = document.createElement('div');
            card.id = 'tutorial-guide-card';
            card.setAttribute('role', 'dialog');
            card.setAttribute('aria-label', 'Guía de Bari');
            card.innerHTML = `
                <div class="tutorial-bari-column">
                    <div class="tutorial-bari-video-box">
                        <canvas id="tutorial-bari-canvas" class="bari-tutorial-canvas" width="185" height="255"></canvas>
                        <video id="tutorial-bari-talking-video" class="bari-video-lipsting"
                               src="assets/videos/lipsting.webm" autoplay loop muted playsinline></video>
                    </div>
                </div>
                <div class="tutorial-content-column">
                    <div class="tutorial-guide-header">
                        <span class="tutorial-step-pill" id="tutorial-step-pill">Paso 1 de 1</span>
                        <button class="tutorial-close-btn" id="tutorial-btn-close" type="button" aria-label="Cerrar guía">&times;</button>
                    </div>
                    <div class="tutorial-guide-title"><span id="tutorial-title-text">Hola</span></div>
                    <div class="tutorial-guide-text" id="tutorial-guide-text"></div>
                    <div class="tutorial-guide-footer">
                        <button class="tutorial-skip-btn" id="tutorial-btn-skip" type="button">Saltear tutorial</button>
                        <div class="tutorial-dots-row" id="tutorial-dots-row"></div>
                        <div class="tutorial-nav-btns">
                            <button class="tutorial-nav-btn tutorial-btn-prev" id="tutorial-btn-prev" type="button">Anterior</button>
                            <button class="tutorial-nav-btn tutorial-btn-next" id="tutorial-btn-next" type="button">Siguiente</button>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(card);
        }
        this.guideCard = card;

        const canvas = document.getElementById('tutorial-bari-canvas');
        const video = document.getElementById('tutorial-bari-talking-video');
        if (canvas && video) {
            if (!this.bariRenderer) {
                this.bariRenderer = new BariCanvasRenderer(canvas, video);
            } else {
                this.bariRenderer.updateElements(canvas, video);
            }
            this.bariRenderer.onFallback = () => this.enableBariVideoFallback();
        }
    }

    bindCardButtons() {
        const btnClose = document.getElementById('tutorial-btn-close');
        const btnSkip = document.getElementById('tutorial-btn-skip');
        const btnPrev = document.getElementById('tutorial-btn-prev');
        const btnNext = document.getElementById('tutorial-btn-next');
        if (btnClose) btnClose.onclick = () => this.endTutorial(true);
        if (btnSkip) btnSkip.onclick = () => this.endTutorial(true);
        if (btnPrev) btnPrev.onclick = () => this.prevStep();
        if (btnNext) btnNext.onclick = () => this.nextStep();
    }

    enableBariVideoFallback() {
        const box = document.querySelector('.tutorial-bari-video-box');
        if (box) box.classList.add('bari-file-fallback');
        const vid = document.getElementById('tutorial-bari-talking-video');
        if (vid) vid.play().catch(() => {});
    }

    // ----------------------------------------------------------- Launcher

    /**
     * Shows the floating Bari launcher on pages that have a tutorial and
     * hides it everywhere else (login, registro, pages without steps).
     */
    syncLauncher() {
        const page = (window.location.hash.slice(1) || '').split('?')[0];
        const shouldShow = this.launcherPages.includes(page);

        if (!shouldShow) {
            if (this.launcher) this.launcher.classList.add('hidden');
            return;
        }

        if (!this.launcher) this.buildLauncher();
        if (this.launcher && !this.isActive) this.launcher.classList.remove('hidden');
    }

    buildLauncher() {
        const launcher = document.createElement('div');
        launcher.id = 'bari-floating-launcher';
        launcher.className = 'bari-launcher hidden';
        launcher.setAttribute('role', 'button');
        launcher.setAttribute('tabindex', '0');
        launcher.setAttribute('aria-label', 'Iniciar recorrido guiado con Bari');
        launcher.innerHTML = `
            <div class="bari-bubble" id="bari-launcher-bubble">
                <span class="bari-bubble-badge">Guía de Bari</span>
                <p class="bari-bubble-text">¿Necesitás ayuda con este paso? Hacé clic y te guío.</p>
                <button class="bari-bubble-close" id="bari-bubble-close" type="button" aria-label="Cerrar mensaje">&times;</button>
            </div>
            <div class="bari-mascot-pod">
                <video id="bari-salu2-video" class="bari-video-salu2" src="assets/videos/salu2.webm"
                       autoplay loop muted playsinline></video>
                <span class="bari-status-badge">
                    <span class="bari-status-pulse"></span>
                    <span>Guía</span>
                </span>
            </div>`;
        document.body.appendChild(launcher);
        this.launcher = launcher;

        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const vid = launcher.querySelector('#bari-salu2-video');
        if (reduceMotion && vid) {
            vid.removeAttribute('autoplay');
            vid.pause();
        }

        const close = launcher.querySelector('#bari-bubble-close');
        close.onclick = (e) => {
            e.stopPropagation();
            const bubble = document.getElementById('bari-launcher-bubble');
            if (bubble) bubble.style.display = 'none';
        };

        const start = () => {
            const page = (window.location.hash.slice(1) || 'dashboard').split('?')[0];
            this.startTutorialWithContext(page, true);
        };
        launcher.onclick = (e) => {
            if (e.target && e.target.closest('#bari-bubble-close')) return;
            start();
        };
        launcher.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                start();
            }
        };
    }

    // ------------------------------------------------------------ Control

    /**
     * Starts a tutorial for a specific context (dashboard, admin-pagos, etc.)
     */
    startTutorial(context, force = false) {
        // Per-account tutorial progress
        let userId = '';
        if (window.ApiService) {
            const user = ApiService.getUsuario();
            if (user && user.dni) userId = '_' + user.dni;
            const admin = ApiService.getAdmin();
            if (admin && admin.id) userId = '_admin_' + admin.id;
        }

        this.currentKey = `tutorial_${context}${userId}`;

        const hasSeen = localStorage.getItem(this.currentKey);
        if (hasSeen === 'completed' && !force) return;

        const steps = this.getStepsForContext(context);
        if (steps.length === 0) return;

        this.init();
        this.bindCardButtons();
        this.steps = steps;
        this.currentStep = 0;
        this.isActive = true;

        if (this.launcher) this.launcher.classList.add('hidden');
        this.overlay.classList.add('active');
        this.guideCard.classList.add('active');
        this.setCardMode('steps');

        this.showCurrentStep();
    }

    startTutorialWithContext(context, force = false) {
        this.currentContext = context;
        this.startTutorial(context, force);
    }

    nextStep() {
        if (this.currentStep >= this.steps.length - 1) {
            this.endTutorial();
            return;
        }
        this.currentStep++;
        this.showCurrentStep();
    }

    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.showCurrentStep();
        }
    }

    endTutorial(skipped = false) {
        this.isActive = false;
        if (this.overlay) {
            this.overlay.classList.remove('active');
            this.overlay.classList.remove('transparent-bg');
        }
        if (this.spotlight) this.spotlight.classList.remove('active');
        if (this.guideCard) this.guideCard.classList.remove('active');
        if (this.bariRenderer) this.bariRenderer.stop();

        const vid = document.getElementById('tutorial-bari-talking-video');
        if (vid) vid.pause();

        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));

        if (this.currentKey) {
            localStorage.setItem(this.currentKey, 'completed');
        }
        this.syncLauncher();
    }

    // Toggles the card between multi-step mode and single-message mode
    setCardMode(mode) {
        if (!this.guideCard) return;
        this.guideCard.classList.toggle('tutorial-single', mode === 'single');
    }

    // ---------------------------------------------------------- Spotlight

    updateSpotlight(targetEl = null) {
        if (!targetEl && this.steps && this.steps[this.currentStep]) {
            const selector = this.steps[this.currentStep].targetSelector;
            if (selector) targetEl = document.querySelector(selector);
        }

        if (targetEl && this.spotlight) {
            const rect = targetEl.getBoundingClientRect();
            const padding = 10;

            this.spotlight.style.top = `${Math.max(0, rect.top - padding)}px`;
            this.spotlight.style.left = `${Math.max(0, rect.left - padding)}px`;
            this.spotlight.style.width = `${rect.width + padding * 2}px`;
            this.spotlight.style.height = `${rect.height + padding * 2}px`;

            const computedRadius = parseInt(window.getComputedStyle(targetEl).borderRadius) || 12;
            this.spotlight.style.borderRadius = `${Math.min(computedRadius + 6, 24)}px`;

            this.spotlight.classList.add('active');
            if (this.overlay) this.overlay.classList.add('transparent-bg');

            this.positionGuideCard(rect, this.steps[this.currentStep]);
        } else {
            if (this.spotlight) this.spotlight.classList.remove('active');
            if (this.overlay) this.overlay.classList.remove('transparent-bg');
            this.centerGuideCard();
        }
    }

    positionGuideCard(targetRect, step = null) {
        if (!this.guideCard) return;

        const cardWidth = Math.min(630, window.innerWidth - 32);
        const cardHeight = 295;
        const gap = 20;
        let top = 0;
        let left = 0;

        const placement = step && step.preferredPlacement ? step.preferredPlacement : 'auto';

        if (placement === 'right-of-target' && (targetRect.right + gap + cardWidth <= window.innerWidth - 16)) {
            left = targetRect.right + gap;
            top = Math.max(16, Math.min(targetRect.top, window.innerHeight - cardHeight - 16));
        } else if (placement === 'left-of-target' && (targetRect.left - gap - cardWidth >= 16)) {
            left = targetRect.left - gap - cardWidth;
            top = Math.max(16, Math.min(targetRect.top, window.innerHeight - cardHeight - 16));
        } else {
            const spaceBelow = window.innerHeight - targetRect.bottom;
            const spaceAbove = targetRect.top;

            if (spaceBelow >= cardHeight + gap) {
                top = targetRect.bottom + gap;
                left = targetRect.left + (targetRect.width - cardWidth) / 2;
            } else if (spaceAbove >= cardHeight + gap) {
                top = targetRect.top - cardHeight - gap;
                left = targetRect.left + (targetRect.width - cardWidth) / 2;
            } else {
                top = window.innerHeight - cardHeight - 24;
                left = window.innerWidth - cardWidth - 24;
            }
        }

        left = Math.max(16, Math.min(left, window.innerWidth - cardWidth - 16));
        top = Math.max(16, Math.min(top, window.innerHeight - cardHeight - 16));

        this.guideCard.style.top = `${top}px`;
        this.guideCard.style.left = `${left}px`;
        this.guideCard.style.transform = 'none';
    }

    centerGuideCard() {
        if (!this.guideCard) return;
        this.guideCard.style.top = '50%';
        this.guideCard.style.left = '50%';
        this.guideCard.style.transform = 'translate(-50%, -50%)';
    }

    // ------------------------------------------------------------ Bari video

    // Picks the pointing video according to where the target sits relative to the card
    resolveVideoForStep(step, targetEl) {
        const fallback = (step && step.video) || 'assets/videos/lipsting.webm';
        if (!targetEl || !step) return fallback;
        if (step.gesture === 'talk' || step.gesture === 'slide') return fallback;

        const targetRect = targetEl.getBoundingClientRect();
        const targetCenterX = targetRect.left + targetRect.width / 2;

        if (this.guideCard) {
            const cardRect = this.guideCard.getBoundingClientRect();
            const diffX = targetCenterX - (cardRect.left + cardRect.width / 2);
            const diffY = (targetRect.top + targetRect.height / 2) - (cardRect.top + cardRect.height / 2);

            // Target mostly above/below: never point sideways
            if (Math.abs(diffY) > 160 && Math.abs(diffX) < 140) return 'assets/videos/lipsting.webm';
            if (diffX > 70) return 'assets/videos/der.webm';
            if (diffX < -70) return 'assets/videos/izquierda.webm';
        }
        return fallback;
    }

    applyBariVideo(src) {
        const vid = document.getElementById('tutorial-bari-talking-video');
        if (!vid || !src) return;

        if (vid.getAttribute('src') !== src) {
            vid.setAttribute('src', src);
            vid.load();
        }
        if (this.bariRenderer) {
            this.bariRenderer.updateElements(document.getElementById('tutorial-bari-canvas'), vid);
            this.bariRenderer.setCropForVideo(src);
            if (!this.bariRenderer.fallbackTriggered) this.bariRenderer.start();
        }
        vid.play().catch(() => {});
    }

    // ------------------------------------------------------------- Steps

    showCurrentStep() {
        const step = this.steps[this.currentStep];
        if (!step) {
            this.endTutorial();
            return;
        }

        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));

        const pill = document.getElementById('tutorial-step-pill');
        const titleText = document.getElementById('tutorial-title-text');
        const textEl = document.getElementById('tutorial-guide-text');
        const btnPrev = document.getElementById('tutorial-btn-prev');
        const btnNext = document.getElementById('tutorial-btn-next');
        const dotsRow = document.getElementById('tutorial-dots-row');

        if (pill) pill.textContent = `Paso ${this.currentStep + 1} de ${this.steps.length}`;
        if (titleText) titleText.textContent = step.title;
        if (textEl) textEl.innerHTML = step.text;
        if (btnPrev) btnPrev.style.display = this.currentStep > 0 ? 'inline-block' : 'none';
        if (btnNext) btnNext.textContent = this.currentStep === this.steps.length - 1 ? 'Entendido' : 'Siguiente';

        if (dotsRow) {
            dotsRow.innerHTML = this.steps.map((_, i) => {
                let cls = 'tutorial-dot';
                if (i === this.currentStep) cls += ' active';
                if (i < this.currentStep) cls += ' completed';
                return `<div class="${cls}"></div>`;
            }).join('');
        }

        // Initial video (before layout is known) so Bari is never blank
        this.applyBariVideo(this.resolveVideoForStep(step, null));

        if (step.targetSelector) {
            setTimeout(() => {
                if (!this.isActive) return;
                const targetEl = document.querySelector(step.targetSelector);
                if (targetEl) {
                    targetEl.classList.add('tutorial-highlight');
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    this.updateSpotlight(targetEl);
                    this.applyBariVideo(this.resolveVideoForStep(step, targetEl));
                } else {
                    this.updateSpotlight(null);
                }
            }, 100);
        } else {
            this.updateSpotlight(null);
        }
    }

    // ------------------------------------------------------------- Content

    getStepsForContext(context) {
        switch (context) {
            case 'licencia-completada':
                return [
                    {
                        title: '¡Felicitaciones! Trámite al 100%',
                        text: '¡Increíble trabajo! Completaste el 100% de tu trámite. Tu Licencia Digital Mi Argentina ya está emitida y disponible abajo.',
                        targetSelector: '#licenciaSection'
                    },
                    {
                        title: 'Tu licencia digital emitida',
                        text: 'Acá podés ver tu credencial emitida. Hacé clic sobre ella para alternar entre la cara frontal (datos y QR) y la cara trasera (información médica).',
                        targetSelector: '#licenciaImgDisplay'
                    }
                ];
            case 'dashboard':
                if (document.getElementById('licenciaSection')) {
                    return [
                        {
                            title: 'Trámite completado al 100%',
                            text: '¡Felicitaciones! Completaste el 100% de tu trámite. Tu Licencia Digital ya está emitida y disponible en esta sección inferior.',
                            targetSelector: '#licenciaSection'
                        },
                        {
                            title: 'Credencial Digital Mi Argentina',
                            text: 'Acá se encuentra tu credencial oficial emitida. Hacé clic sobre la tarjeta para alternar entre la cara frontal (datos y QR) y la cara trasera (información médica).',
                            targetSelector: '#licenciaImgDisplay'
                        }
                    ];
                }
                if (!localStorage.getItem('tramite_activo_seleccionado')) {
                    return [
                        {
                            title: '¡Bienvenido/a al Portal de Baradero!',
                            text: 'Soy Bari y te voy a guiar. Para comenzar, primero tenés que seleccionar un trámite de la lista superior.',
                            targetSelector: null
                        },
                        {
                            title: 'Selección de trámite',
                            text: 'Elegí entre Licencia Nueva, Renovación, Vencida, Subir de Categoría, Profesional o Extravío.',
                            targetSelector: '.tramite-card-btn'
                        },
                        {
                            title: 'Despliegue específico',
                            text: 'Al hacer clic en cualquiera de estas opciones, se desplegarán tus pasos específicos y la barra de progreso.',
                            targetSelector: null
                        }
                    ];
                }
                return [
                    {
                        title: '¡Trámite en curso!',
                        text: 'Soy Bari. Te muestro la barra de avance y los pasos requeridos para obtener tu licencia.',
                        targetSelector: null
                    },
                    {
                        title: 'Tu progreso',
                        text: 'Acá podés ver cuánto te falta para terminar tu trámite (actualmente en curso).',
                        targetSelector: '.progress-bar'
                    },
                    {
                        title: 'Pasos obligatorios',
                        text: 'Tenés que completar estos pasos en orden para alcanzar el 100%.',
                        targetSelector: '.grid-steps'
                    }
                ];
            case 'admin-pagos':
                return [
                    {
                        title: 'Panel de pagos',
                        text: 'Como administrador, acá vas a ver los pagos que la gente realiza por el sistema.',
                        targetSelector: null
                    },
                    {
                        title: 'Verificar pagos',
                        text: 'Usá los botones de acción en la tabla para marcar los pagos como cobrados.',
                        targetSelector: 'table'
                    }
                ];
            case 'admin-turnos':
                return [
                    {
                        title: 'Panel de turnos',
                        text: 'Acá gestionás los turnos para el examen práctico.',
                        targetSelector: null
                    }
                ];
            case 'admin-salud':
                return [
                    {
                        title: 'Examen médico',
                        text: 'Acá registrás los resultados de los exámenes médicos (Apto/No Apto).',
                        targetSelector: null
                    }
                ];
            case 'charlas':
                return [
                    {
                        title: 'Curso de educación vial',
                        text: 'Acá tenés que ver todos los videos obligatorios. No se pueden saltear.',
                        targetSelector: null
                    },
                    {
                        title: 'Videos',
                        text: 'Hacé clic en cada video para reproducirlo y marcarlo como visto.',
                        targetSelector: '.grid-2'
                    }
                ];
            case 'examen':
                return [
                    {
                        title: 'Examen teórico',
                        text: 'Tenés que responder estas preguntas de opción múltiple. ¡Suerte!',
                        targetSelector: null
                    }
                ];
            case 'formularios':
                return [
                    {
                        title: 'Declaración de salud',
                        text: 'Completá este formulario con tus datos médicos. Sé honesto/a.',
                        targetSelector: 'form'
                    }
                ];
            case 'pago':
                return [
                    {
                        title: 'Pago del arancel',
                        text: 'Abonás el trámite usando el método que prefieras.',
                        targetSelector: '.grid-2'
                    }
                ];
            case 'practico':
                return [
                    {
                        title: 'Examen práctico',
                        text: 'Elegí una fecha y hora disponible para rendir tu examen práctico de manejo.',
                        targetSelector: null
                    }
                ];
            case 'entrega':
                return [
                    {
                        title: '¡Último paso!',
                        text: 'Seleccioná cómo querés recibir tu licencia.',
                        targetSelector: null
                    }
                ];
            default:
                return [];
        }
    }

    /**
     * Bari congratulates the user on account approval (single-message card)
     */
    showApprovalGreeting(nombre = '') {
        this.init();
        this.bindCardButtons();
        this.steps = [];
        this.currentKey = null;
        this.isActive = true;

        if (this.launcher) this.launcher.classList.add('hidden');
        this.overlay.classList.add('active');
        this.overlay.classList.remove('transparent-bg');
        if (this.spotlight) this.spotlight.classList.remove('active');
        this.guideCard.classList.add('active');
        this.setCardMode('single');
        this.centerGuideCard();

        const pill = document.getElementById('tutorial-step-pill');
        const titleEl = document.getElementById('tutorial-title-text');
        const textEl = document.getElementById('tutorial-guide-text');
        const nextBtn = document.getElementById('tutorial-btn-next');
        const prevBtn = document.getElementById('tutorial-btn-prev');
        const dots = document.getElementById('tutorial-dots-row');

        if (pill) pill.textContent = 'Cuenta aprobada';
        if (titleEl) titleEl.textContent = `¡Cuenta aprobada con éxito, ${nombre || 'Ciudadano'}!`;
        if (textEl) textEl.innerHTML = '¡Excelentes noticias! El área de Tránsito verificó tus antecedentes e infracciones y <strong>tu cuenta fue aprobada con éxito</strong>.<br><br>Ya tenés acceso libre y completo para comenzar a gestionar tu licencia de conducir digital.';
        if (prevBtn) prevBtn.style.display = 'none';
        if (dots) dots.innerHTML = '';
        if (nextBtn) {
            nextBtn.textContent = 'Entendido, comenzar trámite';
            nextBtn.onclick = () => this.endTutorial(true);
        }

        this.applyBariVideo('assets/videos/lipsting.webm');
    }
}

// Global instance
window.Tutorial = new TutorialSystem();
