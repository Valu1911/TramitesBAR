/**
 * TramitBot Tutorial System
 * Gestiona el tutorial guiado usando la mascota en pantalla.
 */

class TutorialSystem {
    constructor() {
        this.currentStep = 0;
        this.steps = [];
        this.isActive = false;
        
        // El SVG de nuestra mascota "TramitBot" (un robot simpático)
        this.mascotSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" class="mascot-svg" style="filter: drop-shadow(0 10px 15px rgba(0,0,0,0.2)); width: 140px; height: 140px;">
            <defs>
                <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#ffffff"/>
                    <stop offset="100%" stop-color="#d1d5db"/>
                </linearGradient>
                <linearGradient id="visorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#3b82f6"/>
                    <stop offset="100%" stop-color="#1d4ed8"/>
                </linearGradient>
                <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#22d3ee"/>
                    <stop offset="100%" stop-color="#0891b2"/>
                </linearGradient>
            </defs>
            
            <!-- Left Ear/Antenna -->
            <rect x="30" y="70" width="15" height="30" rx="5" fill="url(#bodyGrad)"/>
            <path d="M 35 75 L 35 50 L 45 50 L 45 75 Z" fill="url(#cyanGrad)"/>
            
            <!-- Right Ear/Antenna -->
            <rect x="155" y="70" width="15" height="30" rx="5" fill="url(#bodyGrad)"/>
            <path d="M 155 75 L 155 50 L 165 50 L 165 75 Z" fill="url(#cyanGrad)"/>

            <!-- Body/Torso -->
            <path d="M 60 120 Q 100 180 140 120 Z" fill="url(#bodyGrad)"/>
            
            <!-- Cyan Belly Badge -->
            <path d="M 75 130 Q 100 170 125 130 Z" fill="url(#cyanGrad)"/>

            <!-- Left Arm -->
            <path d="M 65 125 C 40 135 30 160 45 170 C 60 180 75 145 75 145" fill="url(#bodyGrad)"/>
            
            <!-- Right Arm (Waving) -->
            <path d="M 135 125 C 160 110 180 90 170 70 C 160 50 145 95 145 95" fill="url(#bodyGrad)"/>

            <!-- Head -->
            <rect x="40" y="40" width="120" height="85" rx="40" fill="url(#bodyGrad)"/>
            
            <!-- Face / Visor -->
            <rect x="50" y="50" width="100" height="65" rx="30" fill="url(#visorGrad)"/>
            
            <!-- Visor Highlight (Glass effect) -->
            <path d="M 60 55 Q 100 45 140 55 Q 120 70 80 70 Z" fill="rgba(255,255,255,0.2)"/>
            
            <!-- Eyes (Glowing) -->
            <g filter="drop-shadow(0 0 5px #67e8f9)">
                <path d="M 70 75 Q 80 65 90 75" fill="none" stroke="#67e8f9" stroke-width="6" stroke-linecap="round"/>
                <path d="M 110 75 Q 120 65 130 75" fill="none" stroke="#67e8f9" stroke-width="6" stroke-linecap="round"/>
            </g>
        </svg>
        `;
    }

    init() {
        if (document.getElementById('tutorial-overlay')) return; // Ya inicializado

        // 1. Crear Overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'tutorial-overlay';
        document.body.appendChild(this.overlay);

        // 2. Crear Spotlight Cutout
        this.spotlight = document.createElement('div');
        this.spotlight.id = 'tutorial-spotlight';
        document.body.appendChild(this.spotlight);

        // 3. Crear Contenedor de Mascota
        this.container = document.createElement('div');
        this.container.id = 'tutorial-mascot-container';
        
        this.container.innerHTML = `
            <div class="tutorial-dialog">
                <div class="tutorial-dialog__title">
                    <span style="font-size:1.2rem">🤖</span> <span id="tutorial-title">Hola!</span>
                </div>
                <div class="tutorial-dialog__text" id="tutorial-text">
                    Soy TramitBot, tu asistente personal.
                </div>
                <div class="tutorial-dialog__actions">
                    <button class="tutorial-btn-skip" id="tutorial-btn-skip">Saltear tutorial</button>
                    <button class="tutorial-btn-next" id="tutorial-btn-next">Siguiente →</button>
                </div>
            </div>
            ${this.mascotSvg}
        `;
        document.body.appendChild(this.container);

        // 4. Eventos
        document.getElementById('tutorial-btn-skip').addEventListener('click', () => this.endTutorial(true));
        document.getElementById('tutorial-btn-next').addEventListener('click', () => this.nextStep());

        window.addEventListener('resize', () => {
            if (this.isActive) this.updateSpotlight();
        });
        window.addEventListener('scroll', () => {
            if (this.isActive) this.updateSpotlight();
        }, { passive: true });
    }

    /**
     * Inicia un tutorial para un contexto específico (dashboard, admin-pagos, etc)
     */
    startTutorial(context, force = false) {
        // Determinar ID del usuario actual para que el tutorial sea por cuenta
        let userId = '';
        if (window.ApiService) {
            const user = ApiService.getUsuario();
            if (user && user.dni) userId = '_' + user.dni;
            const admin = ApiService.getAdmin();
            if (admin && admin.id) userId = '_admin_' + admin.id;
        }
        
        this.currentKey = `tutorial_${context}${userId}`;

        // Chequear si ya lo vio
        const hasSeen = localStorage.getItem(this.currentKey);
        if (hasSeen === 'completed' && !force) return; // Ya lo vio

        this.init();
        this.steps = this.getStepsForContext(context);
        
        if (this.steps.length === 0) return; // No hay tutorial para esta vista

        this.currentStep = 0;
        this.isActive = true;
        this.overlay.classList.add('active');
        this.container.classList.add('active');
        
        this.showCurrentStep();
    }

    updateSpotlight(targetEl = null) {
        if (!targetEl && this.steps && this.steps[this.currentStep]) {
            const selector = this.steps[this.currentStep].targetSelector;
            if (selector) targetEl = document.querySelector(selector);
        }

        if (targetEl && this.spotlight) {
            const rect = targetEl.getBoundingClientRect();
            const padding = 8;

            this.spotlight.style.top = (rect.top - padding) + 'px';
            this.spotlight.style.left = (rect.left - padding) + 'px';
            this.spotlight.style.width = (rect.width + padding * 2) + 'px';
            this.spotlight.style.height = (rect.height + padding * 2) + 'px';

            const computedRadius = parseInt(window.getComputedStyle(targetEl).borderRadius) || 12;
            this.spotlight.style.borderRadius = Math.min(computedRadius + 4, 24) + 'px';

            this.spotlight.classList.add('active');
            if (this.overlay) this.overlay.classList.add('transparent-bg');
        } else {
            if (this.spotlight) this.spotlight.classList.remove('active');
            if (this.overlay) this.overlay.classList.remove('transparent-bg');
        }
    }

    showCurrentStep() {
        const step = this.steps[this.currentStep];
        if (!step) {
            this.endTutorial();
            return;
        }

        // Remover highlight anterior
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));

        // Actualizar textos
        document.getElementById('tutorial-title').textContent = step.title;
        document.getElementById('tutorial-text').textContent = step.text;
        
        // Actualizar botón next
        const btnNext = document.getElementById('tutorial-btn-next');
        if (this.currentStep === this.steps.length - 1) {
            btnNext.textContent = '¡Entendido! ✓';
        } else {
            btnNext.textContent = 'Siguiente →';
        }

        // Resaltar elemento y mover mascota
        if (step.targetSelector) {
            setTimeout(() => {
                const targetEl = document.querySelector(step.targetSelector);
                if (targetEl) {
                    targetEl.classList.add('tutorial-highlight');
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // Actualizar spotlight cutout
                    this.updateSpotlight(targetEl);
                    
                    // Estrategia de posicionamiento: Ubicar a TramitBot más arriba en la esquina inferior derecha
                    // para que el diálogo completo y el botón de confirmar sean 100% visibles y fáciles de presionar.
                    const cWidth = 460;
                    const cHeight = 320;
                    
                    let top = window.innerHeight - cHeight - 40;
                    let left = window.innerWidth - cWidth - 30;
                    
                    if (left < 10) left = 10;
                    if (top < 70) top = 70;
                    
                    this.container.style.top = top + 'px';
                    this.container.style.left = left + 'px';
                    this.container.style.transform = 'none';
                } else {
                    this.updateSpotlight(null);
                    this.centerMascot();
                }
            }, 100);
        } else {
            this.updateSpotlight(null);
            this.centerMascot();
        }
    }

    centerMascot() {
        this.container.style.top = (window.innerHeight / 2 - 125) + 'px';
        this.container.style.left = '50%';
        this.container.style.transform = 'translateX(-50%)';
    }

    nextStep() {
        this.currentStep++;
        this.showCurrentStep();
    }

    endTutorial(skipped = false) {
        this.isActive = false;
        this.overlay.classList.remove('active');
        this.overlay.classList.remove('transparent-bg');
        if (this.spotlight) this.spotlight.classList.remove('active');
        this.container.classList.remove('active');
        
        // Esconder mascota enviandola fuera de pantalla
        this.container.style.top = '-500px';
        this.container.style.left = '50%';
        this.container.style.transform = 'translateX(-50%)';
        
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
        
        if (this.currentKey) {
            localStorage.setItem(this.currentKey, 'completed');
        }
    }

    startTutorialWithContext(context, force = false) {
        this.currentContext = context;
        this.startTutorial(context, force);
    }

    getStepsForContext(context) {
        switch(context) {
            case 'licencia-completada':
                return [
                    {
                        title: '🎉 ¡FELICITACIONES! Trámite al 100%',
                        text: '¡Increíble trabajo! Has completado exitosamente el 100% de tu trámite. Tu Licencia Digital Mi Argentina ya está emitida y disponible abajo.',
                        targetSelector: '#licenciaSection'
                    },
                    {
                        title: '🪪 Mi Licencia Digital Emitida',
                        text: 'Aquí podés ver tu credencial emitida. Hacé clic sobre ella para alternar entre la cara frontal (datos y QR) y la cara trasera (información médica).',
                        targetSelector: '#licenciaImgDisplay'
                    }
                ];
            case 'dashboard':
                const licenciaSec = document.getElementById('licenciaSection');
                if (licenciaSec) {
                    return [
                        {
                            title: '🎉 Trámite Completado al 100%',
                            text: '¡Felicitaciones! Has completado exitosamente el 100% de tu trámite. Tu Licencia Digital ya está emitida y disponible en esta sección inferior.',
                            targetSelector: '#licenciaSection'
                        },
                        {
                            title: '🪪 Credencial Digital Mi Argentina',
                            text: 'Aquí se encuentra tu credencial oficial emitida. Hacé clic sobre la tarjeta para alternar entre la cara frontal (datos y QR) y la cara trasera (información médica).',
                            targetSelector: '#licenciaImgDisplay'
                        }
                    ];
                }
                if (!localStorage.getItem('tramite_activo_seleccionado')) {
                    return [
                        {
                            title: '¡Bienvenido/a al Portal de Baradero!',
                            text: 'Soy TramitBot y te voy a guiar. Para comenzar, primero debes seleccionar un trámite de la lista superior.',
                            targetSelector: null
                        },
                        {
                            title: 'Selección de Trámite',
                            text: 'Elige entre Licencia Nueva, Renovación, Vencida, Subir de Categoría, Profesional o Extravío.',
                            targetSelector: '.tramite-card-btn'
                        },
                        {
                            title: 'Despliegue Específico',
                            text: 'Al hacer clic en cualquiera de estas opciones, se desplegarán tus pasos específicos y barra de progreso.',
                            targetSelector: null
                        }
                    ];
                }
                return [
                    {
                        title: '¡Trámite en Curso!',
                        text: 'Soy TramitBot. Te muestro la barra de avance y los pasos requeridos para obtener tu licencia.',
                        targetSelector: null
                    },
                    {
                        title: 'Tu Progreso',
                        text: 'Aquí podrás ver cuánto te falta para terminar tu trámite (actualmente en curso).',
                        targetSelector: '.progress-bar'
                    },
                    {
                        title: 'Pasos Obligatorios',
                        text: 'Debes completar estos pasos en orden para alcanzar el 100%.',
                        targetSelector: '.grid-steps'
                    }
                ];
            case 'admin-pagos':
                return [
                    {
                        title: 'Panel de Pagos',
                        text: 'Como administrador, aquí verás los pagos que la gente realiza por el sistema.',
                        targetSelector: null
                    },
                    {
                        title: 'Verificar Pagos',
                        text: 'Usa los botones de acción en la tabla para marcar los pagos como cobrados.',
                        targetSelector: 'table'
                    }
                ];
            case 'admin-turnos':
                return [
                    {
                        title: 'Panel de Turnos',
                        text: 'Aquí gestionarás los turnos para el examen práctico.',
                        targetSelector: null
                    }
                ];
            case 'admin-salud':
                return [
                    {
                        title: 'Examen Médico',
                        text: 'Aquí registrarás los resultados de los exámenes médicos (Apto/No Apto).',
                        targetSelector: null
                    }
                ];
            case 'charlas':
                return [
                    {
                        title: 'Curso de Educación Vial',
                        text: 'Aquí deberás ver todos los videos obligatorios. No puedes saltártelos.',
                        targetSelector: null
                    },
                    {
                        title: 'Videos',
                        text: 'Haz clic en cada video para reproducirlo y marcarlo como visto.',
                        targetSelector: '.grid-2'
                    }
                ];
            case 'examen':
                return [
                    {
                        title: 'Examen Teórico',
                        text: 'Deberás responder a estas preguntas de opción múltiple. ¡Suerte!',
                        targetSelector: null
                    }
                ];
            case 'formularios':
                return [
                    {
                        title: 'Declaración de Salud',
                        text: 'Completa este formulario con tus datos médicos. Sé honesto.',
                        targetSelector: 'form'
                    }
                ];
            case 'pago':
                return [
                    {
                        title: 'Pago del Arancel',
                        text: 'Abona el trámite usando el método que prefieras.',
                        targetSelector: '.grid-2'
                    }
                ];
            case 'practico':
                return [
                    {
                        title: 'Examen Práctico',
                        text: 'Elige una fecha y hora disponible para rendir tu examen práctico de manejo.',
                        targetSelector: null
                    }
                ];
            case 'entrega':
                return [
                    {
                        title: '¡Último paso!',
                        text: 'Selecciona cómo quieres recibir tu licencia.',
                        targetSelector: null
                    }
                ];
            default:
                return [];
        }
    }

    /**
     * Muestra a Tramibot felicitando al usuario por la aprobación de su cuenta
     */
    showApprovalGreeting(nombre = '') {
        this.init();
        this.isActive = true;
        if (this.overlay) this.overlay.classList.add('active');
        if (this.container) {
            this.container.classList.add('active');
            this.container.style.position = 'fixed';
            this.container.style.bottom = '40px';
            this.container.style.right = '40px';
            this.container.style.left = 'auto';
            this.container.style.top = 'auto';
            this.container.style.transform = 'none';
        }
        
        const titleEl = document.getElementById('tutorial-title');
        const textEl = document.getElementById('tutorial-text');
        const skipBtn = document.getElementById('tutorial-btn-skip');
        const nextBtn = document.getElementById('tutorial-btn-next');
        
        if (titleEl) titleEl.innerText = `¡Cuenta Aprobada con Éxito, ${nombre || 'Ciudadano'}! 🎉`;
        if (textEl) textEl.innerHTML = `¡Excelentes noticias! El área de Tránsito ha verificado tus antecedentes e infracciones y <strong>tu cuenta ha sido aprobada con éxito</strong>.<br><br>Ya tenés acceso libre y completo para comenzar a gestionar tu licencia de conducir digital.`;
        if (skipBtn) skipBtn.style.display = 'none';
        if (nextBtn) {
            nextBtn.innerText = '¡Entendido, Comenzar Trámite! 🚀';
            nextBtn.onclick = () => {
                this.endTutorial(true);
            };
        }
    }
}

// Instancia global
window.Tutorial = new TutorialSystem();
