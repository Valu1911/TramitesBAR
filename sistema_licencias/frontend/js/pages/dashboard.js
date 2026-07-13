/**
 * Dashboard - Panel principal del usuario con progreso del trámite
 */
class DashboardPage {
    static async render(app) {
        const user = ApiService.getUsuario();
        
        app.innerHTML = `
        ${renderNavbar(user)}
        <div class="page-content">
            <div class="text-center" style="padding:60px 0">
                <div class="spinner" style="margin:0 auto"></div>
                <p class="text-muted mt-3">Cargando tu trámite...</p>
            </div>
        </div>`;

        try {
            const data = await ApiService.getProgreso();
            this.renderContent(app, data, user);
        } catch (err) {
            if (err.status === 401) {
                logout();
                return;
            }
            app.innerHTML = `
            ${renderNavbar(user)}
            <div class="page-content">
                <div class="empty-state">
                    <div class="empty-state__icon">⚠️</div>
                    <h2 class="empty-state__title">Error al cargar</h2>
                    <p class="empty-state__desc">${err.message}</p>
                    <button class="btn btn-primary mt-4" onclick="DashboardPage.render(document.getElementById('app'))">Reintentar</button>
                </div>
            </div>`;
        }
    }

    static renderContent(app, data, user) {
        const stepIcons = {
            charlas: Icons.video,
            examen: Icons.edit,
            formularios: Icons.heart,
            pago: Icons.card,
            practico: Icons.car,
            entrega: Icons.box
        };

        const statusIcons = {
            completed: '<span style="color:var(--success);display:flex;align-items:center">' + Icons.check + '</span>',
            current: '<span style="color:var(--primary);display:flex;align-items:center">' + Icons.clock + '</span>',
            locked: '<span style="color:var(--text-muted);display:flex;align-items:center">' + Icons.lock + '</span>'
        };

        const currentStep = data.pasos.find(p => p.status === 'current');

        app.innerHTML = `
        ${renderNavbar(data.usuario || user)}
        <div class="page-content stack-lg animate-fadeIn">
            <!-- HERO -->
            <section class="hero gradient-hero">
                <div style="position:relative;z-index:1">
                    <div class="hero__badge"><span style="display:flex;align-items:center;color:var(--warning)">${Icons.sparkles}</span> Hacelo en 3 clicks</div>
                    <h1 class="hero__title">
                        Tu licencia de conducir, <span>sin filas</span>
                    </h1>
                    <p class="hero__subtitle">
                        Iniciá tu trámite ahora mismo. Te acompañamos paso a paso desde la web.
                    </p>
                    <div class="hero__actions">
                        ${currentStep ? `
                        <button class="btn btn-lg" style="background:white;color:var(--primary);font-weight:700;box-shadow:var(--shadow-lg)" 
                                onclick="Router.navigate('${currentStep.id}')">
                            Continuar trámite →
                        </button>` : `
                        <button class="btn btn-lg" style="background:white;color:var(--primary);font-weight:700" disabled>
                            ¡Trámite completado! ✓
                        </button>`}
                    </div>
                </div>
            </section>

            <!-- PROGRESO -->
            <div class="glass-card p-5">
                <div class="flex-between mb-3">
                    <div style="display:flex;align-items:center;gap:10px">
                        <div style="width:40px;height:40px;border-radius:var(--radius-md);background:var(--primary-soft);display:flex;align-items:center;justify-content:center;font-size:1.2rem;color:var(--primary)">${Icons.id}</div>
                        <div>
                            <div class="font-bold text-sm">Tu progreso</div>
                            <div class="text-xs text-muted">${data.pasos.filter(p => p.status === 'completed').length} de ${data.pasos.length} pasos completados</div>
                        </div>
                    </div>
                    <span style="font-size:1.25rem;font-weight:800;color:var(--primary)">${data.progreso_porcentaje}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-bar__fill" style="width:${data.progreso_porcentaje}%"></div>
                </div>
            </div>

            <!-- ACCESO RÁPIDO -->
            <section>
                <h2 class="section-title mb-3">Acceso rápido</h2>
                <div class="quick-grid">
                    <button class="quick-action" onclick="Router.navigate('charlas')">
                        <div class="quick-action__icon" style="background:var(--primary-soft);color:var(--primary)">${Icons.video}</div>
                        <span class="quick-action__label">Charlas</span>
                    </button>
                    <button class="quick-action" onclick="Router.navigate('examen')">
                        <div class="quick-action__icon" style="background:var(--accent-light);color:var(--accent)">${Icons.edit}</div>
                        <span class="quick-action__label">Examen</span>
                    </button>
                    <button class="quick-action" onclick="Router.navigate('pago')">
                        <div class="quick-action__icon" style="background:var(--primary-soft);color:var(--primary)">${Icons.card}</div>
                        <span class="quick-action__label">Pagar</span>
                    </button>
                    <button class="quick-action" onclick="Router.navigate('practico')">
                        <div class="quick-action__icon" style="background:var(--accent-light);color:var(--accent)">${Icons.car}</div>
                        <span class="quick-action__label">Práctico</span>
                    </button>
                </div>
            </section>

            <!-- PASOS -->
            <section>
                <h2 class="section-title mb-3">Pasos del trámite</h2>
                <div class="grid-steps">
                    ${data.pasos.map((paso, i) => `
                    <div class="step-card step-card--${paso.status}" 
                         onclick="${paso.status !== 'locked' ? `Router.navigate('${paso.id}')` : 'Toast.warning(\"Debés completar los pasos anteriores\")'}"
                         style="animation-delay:${i * 0.05}s">
                        <div class="step-card__icon">${stepIcons[paso.id] || Icons.file}</div>
                        <div class="step-card__content">
                            <div class="step-card__step-label">Paso ${i + 1}</div>
                            <div class="step-card__title">${paso.title}</div>
                            <div class="step-card__desc">${paso.description}</div>
                        </div>
                        <div class="step-card__status">
                            <span>${statusIcons[paso.status]}</span>
                            ${paso.status !== 'locked' ? '<span style="color:var(--text-muted)">›</span>' : ''}
                        </div>
                    </div>`).join('')}
                </div>
            </section>
        </div>`;
    }
}
