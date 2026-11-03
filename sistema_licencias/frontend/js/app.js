/**
 * App Principal - Router SPA + Toast System + ConfirmModal (AlertDialog) + Page Manager
 */

// ============================================================
// TOAST SYSTEM
// ============================================================
class Toast {
    static container = null;

    static init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    static show(message, type = 'info', duration = 4000) {
        this.init();
        const toast = document.createElement('div');
        toast.className = `toast toast--${type} animate-slideUp`;

        const icons = {
            success: Icons.checkCircle || Icons.check,
            error: Icons.xCircle || Icons.x,
            warning: Icons.alertTriangle || Icons.alert,
            info: Icons.info
        };

        toast.innerHTML = `
            <span style="font-size:1.1rem;flex-shrink:0;display:flex;align-items:center">${icons[type] || Icons.info}</span>
            <span class="toast__message">${message}</span>
            <button class="toast__close" onclick="this.parentElement.remove()" aria-label="Cerrar">${Icons.x}</button>
        `;

        this.container.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    }

    static success(msg) { this.show(msg, 'success'); }
    static error(msg) { this.show(msg, 'error', 5000); }
    static warning(msg) { this.show(msg, 'warning'); }
    static info(msg) { this.show(msg, 'info'); }
}

// ============================================================
// CONFIRM MODAL & PROMPT (Shadcn AlertDialog Style)
// ============================================================
class ConfirmModal {
    static activeCleanup = null;

    static closeActive() {
        if (this.activeCleanup) {
            this.activeCleanup();
            this.activeCleanup = null;
        }
    }

    /**
     * Muestra un diálogo de confirmación estético estilo Shadcn AlertDialog
     * @param {Object} options
     * @returns {Promise<boolean>}
     */
    static show({
        title = '¿Confirmar acción?',
        message = '',
        description = '',
        confirmText = 'Confirmar',
        cancelText = 'Cancelar',
        variant = 'primary', // 'primary' | 'danger' | 'success' | 'warning'
        icon = null
    } = {}) {
        const resolvedMessage = message || description || '¿Estás seguro de que deseás continuar con esta operación?';
        this.closeActive();

        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'alert-dialog-backdrop';

            const defaultIcons = {
                danger: Icons.alertTriangle || Icons.alert,
                warning: Icons.alertTriangle || Icons.alert,
                success: Icons.checkCircle || Icons.check,
                primary: Icons.shield || Icons.info
            };
            const renderedIcon = icon || defaultIcons[variant] || Icons.info;

            backdrop.innerHTML = `
                <div class="alert-dialog" role="alertdialog" aria-modal="true" aria-labelledby="alertDialogTitle" aria-describedby="alertDialogDesc">
                    <div class="alert-dialog__header">
                        <div class="alert-dialog__icon alert-dialog__icon--${variant}">
                            ${renderedIcon}
                        </div>
                        <div class="alert-dialog__content">
                            <h3 class="alert-dialog__title" id="alertDialogTitle">${title}</h3>
                            <p class="alert-dialog__desc" id="alertDialogDesc">${resolvedMessage}</p>
                        </div>
                    </div>
                    <div class="alert-dialog__footer">
                        <button type="button" class="btn btn-ghost alert-dialog__cancel" data-action="cancel">
                            ${cancelText}
                        </button>
                        <button type="button" class="btn alert-dialog__confirm alert-dialog__confirm--${variant}" data-action="confirm">
                            ${confirmText}
                        </button>
                    </div>
                </div>
            `;

            const cleanup = (result) => {
                document.removeEventListener('keydown', onKeyDown);
                backdrop.remove();
                this.activeCleanup = null;
                resolve(result);
            };

            const onKeyDown = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    cleanup(false);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    cleanup(true);
                }
            };

            this.activeCleanup = () => cleanup(false);

            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) cleanup(false);
            });

            backdrop.querySelector('[data-action="cancel"]').addEventListener('click', () => cleanup(false));
            backdrop.querySelector('[data-action="confirm"]').addEventListener('click', () => cleanup(true));

            document.addEventListener('keydown', onKeyDown);
            document.body.appendChild(backdrop);

            const confirmBtn = backdrop.querySelector('[data-action="confirm"]');
            if (confirmBtn) setTimeout(() => confirmBtn.focus(), 30);
        });
    }

    /**
     * Muestra un diálogo con campo de entrada de texto (reemplazo estético de window.prompt)
     * @param {Object} options
     * @returns {Promise<string|null>}
     */
    static prompt({
        title = 'Ingresar información',
        message = '',
        description = '',
        inputLabel = 'Detalle / Observación',
        placeholder = 'Escribí aquí...',
        defaultValue = '',
        confirmText = 'Confirmar',
        cancelText = 'Cancelar',
        variant = 'primary',
        required = false,
        icon = null
    } = {}) {
        const resolvedPromptMsg = message || description || '';
        this.closeActive();

        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'alert-dialog-backdrop';

            const defaultIcons = {
                danger: Icons.alertTriangle || Icons.alert,
                warning: Icons.alertTriangle || Icons.alert,
                success: Icons.checkCircle || Icons.check,
                primary: Icons.edit || Icons.info
            };
            const renderedIcon = icon || defaultIcons[variant] || Icons.edit;

            backdrop.innerHTML = `
                <div class="alert-dialog" role="dialog" aria-modal="true" aria-labelledby="alertPromptTitle">
                    <div class="alert-dialog__header">
                        <div class="alert-dialog__icon alert-dialog__icon--${variant}">
                            ${renderedIcon}
                        </div>
                        <div class="alert-dialog__content" style="width:100%">
                            <h3 class="alert-dialog__title" id="alertPromptTitle">${title}</h3>
                            ${resolvedPromptMsg ? `<p class="alert-dialog__desc">${resolvedPromptMsg}</p>` : ''}
                            <div class="alert-dialog__field">
                                ${inputLabel ? `<label class="alert-dialog__label" for="alertDialogInput">${inputLabel}${required ? ' *' : ''}</label>` : ''}
                                <textarea id="alertDialogInput" class="form-input alert-dialog__input" rows="3" placeholder="${placeholder}">${defaultValue}</textarea>
                                <div class="alert-dialog__error" id="alertDialogError" style="display:none">Este campo es obligatorio para continuar.</div>
                            </div>
                        </div>
                    </div>
                    <div class="alert-dialog__footer">
                        <button type="button" class="btn btn-ghost alert-dialog__cancel" data-action="cancel">
                            ${cancelText}
                        </button>
                        <button type="button" class="btn alert-dialog__confirm alert-dialog__confirm--${variant}" data-action="confirm">
                            ${confirmText}
                        </button>
                    </div>
                </div>
            `;

            const inputEl = backdrop.querySelector('#alertDialogInput');
            const errorEl = backdrop.querySelector('#alertDialogError');

            const cleanup = (result) => {
                document.removeEventListener('keydown', onKeyDown);
                backdrop.remove();
                this.activeCleanup = null;
                resolve(result);
            };

            const submitValue = () => {
                const val = (inputEl?.value || '').trim();
                if (required && !val) {
                    if (errorEl) errorEl.style.display = 'block';
                    if (inputEl) inputEl.focus();
                    return;
                }
                cleanup(val);
            };

            const onKeyDown = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    cleanup(null);
                } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    submitValue();
                }
            };

            this.activeCleanup = () => cleanup(null);

            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) cleanup(null);
            });

            backdrop.querySelector('[data-action="cancel"]').addEventListener('click', () => cleanup(null));
            backdrop.querySelector('[data-action="confirm"]').addEventListener('click', submitValue);

            document.addEventListener('keydown', onKeyDown);
            document.body.appendChild(backdrop);

            if (inputEl) {
                setTimeout(() => {
                    inputEl.focus();
                    inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
                }, 30);
            }
        });
    }
}

// ============================================================
// SPA ROUTER
// ============================================================
class Router {
    static currentPage = null;
    static _isNavigating = false;

    static navigate(page, params = {}) {
        this.currentPage = page;
        if (window.location.hash.slice(1) !== page) {
            this._isNavigating = true;
            window.location.hash = page;
            this._isNavigating = false;
        }
        this.render(page, params);
    }

    static init() {
        window.addEventListener('hashchange', () => {
            if (this._isNavigating) return;
            const page = window.location.hash.slice(1) || 'login';
            this.render(page);
        });

        const page = window.location.hash.slice(1) || 'login';
        this.render(page);
    }

    static render(page, params = {}) {
        const app = document.getElementById('app');
        if (!app) return;

        // Auth guard
        const publicPages = ['login', 'registro', 'admin-login'];
        const adminPages = ['admin-pagos', 'admin-salud', 'admin-turnos', 'admin-profesores', 'admin-cuentas'];
        const pageRoleMap = {
            'admin-cuentas': { rol: 'cuentas', user: 'admin_cuentas' },
            'admin-profesores': { rol: 'profesores', user: 'admin_profesores' },
            'admin-pagos': { rol: 'pagos', user: 'admin_pagos' },
            'admin-salud': { rol: 'salud', user: 'admin_salud' },
            'admin-turnos': { rol: 'turnos', user: 'admin_turnos' }
        };

        // Las vistas administrativas operan exclusivamente en Modo Claro Institucional
        if (page === 'admin-login' || adminPages.includes(page)) {
            document.body.classList.remove('dark');
        } else {
            initTheme();
        }

        if (!publicPages.includes(page) && !adminPages.includes(page)) {
            const token = ApiService.getToken();
            if (!token) {
                this.navigate('login');
                return;
            }
            const stepPages = ['charlas', 'formularios', 'examen', 'pago', 'practico', 'entrega'];
            if (stepPages.includes(page)) {
                const currentUser = ApiService.getUser();
                if (currentUser && currentUser.estado_cuenta && currentUser.estado_cuenta !== 'aprobada') {
                    Toast.warning('Tu cuenta debe estar aprobada y sin multas pendientes para acceder a los pasos del trámite.');
                    this.navigate('dashboard');
                    return;
                }
            }
        }

        if (adminPages.includes(page)) {
            const adminToken = ApiService.getAdminToken();
            const admin = ApiService.getAdmin();
            const expected = pageRoleMap[page];
            if (!adminToken || (expected && admin?.rol && admin.rol !== expected.rol && admin.rol !== 'superadmin')) {
                if (expected) {
                    sessionStorage.setItem('prefill_admin_user', expected.user);
                }
                ApiService.clearAdmin();
                this.navigate('admin-login');
                return;
            }
        }

        // Render page
        switch (page) {
            case 'login':
                LoginPage.render(app);
                break;
            case 'registro':
                RegistroPage.render(app);
                break;
            case 'dashboard':
                DashboardPage.render(app);
                break;
            case 'charlas':
                CharlasPage.render(app);
                break;
            case 'examen':
                ExamenPage.render(app);
                break;
            case 'formularios':
                FormulariosPage.render(app);
                break;
            case 'pago':
                PagoPage.render(app);
                break;
            case 'practico':
                PracticoPage.render(app);
                break;
            case 'entrega':
                EntregaPage.render(app);
                break;
            case 'admin-login':
                AdminLoginPage.render(app);
                break;
            case 'admin-cuentas':
                AdminCuentasPage.render(app);
                break;
            case 'admin-pagos':
                AdminPagosPage.render(app);
                break;
            case 'admin-salud':
                AdminSaludPage.render(app);
                break;
            case 'admin-turnos':
                AdminTurnosPage.render(app);
                break;
            case 'admin-profesores':
                AdminProfesoresPage.render(app);
                break;
            default:
                app.innerHTML = `
                    <div class="page-content text-center" style="padding-top:100px">
                        <div class="empty-state__icon" style="display:flex;align-items:center;justify-content:center">${Icons.help}</div>
                        <h2>Página no encontrada</h2>
                        <p class="text-muted mt-2">La página que buscás no existe</p>
                        <button class="btn btn-primary mt-4" onclick="Router.navigate('login')">Volver al inicio</button>
                    </div>`;
        }
    }
}

// ============================================================
// SIDEBAR COMPONENT (Citizen & Admin)
// ============================================================
let _sidebarCollapsed = false;
let _sidebarMobileOpen = false;

function renderSidebar(user) {
    const currentPage = window.location.hash.slice(1) || 'dashboard';
    const collapsed = _sidebarCollapsed ? 'collapsed' : '';
    
    const menuItems = [
        { id: 'dashboard', icon: Icons.home || Icons.car, label: 'Inicio' },
        { id: 'charlas', icon: Icons.video || Icons.play, label: 'Charlas' },
        { id: 'formularios', icon: Icons.clipboard || Icons.file, label: 'Formularios' },
        { id: 'examen', icon: Icons.edit || Icons.check, label: 'Examen' },
        { id: 'pago', icon: Icons.money || Icons.credit, label: 'Pago' },
        { id: 'practico', icon: Icons.car, label: 'Práctico' },
        { id: 'entrega', icon: Icons.package || Icons.truck, label: 'Entrega' },
    ];

    const isDark = document.body.classList.contains('dark');

    return `
    <div class="sidebar-overlay ${_sidebarMobileOpen ? 'active' : ''}" onclick="toggleMobileSidebar()"></div>
    <button class="sidebar__mobile-toggle" onclick="toggleMobileSidebar()" aria-label="Abrir menú">
        <span style="display:flex;align-items:center">${Icons.menu}</span>
    </button>
    <aside class="sidebar ${collapsed} ${_sidebarMobileOpen ? 'mobile-open' : ''}" id="app-sidebar">
        <div class="sidebar__header">
            <div class="sidebar__logo">
                ${Icons.car}
            </div>
            <span class="sidebar__brand-text">Ciudadano Digital</span>
        </div>
        <nav class="sidebar__nav">
            <div class="sidebar__nav-label">Trámite</div>
            ${menuItems.map(item => `
                <button class="sidebar__item ${currentPage === item.id ? 'active' : ''}" 
                        onclick="Router.navigate('${item.id}'); closeMobileSidebar();" 
                        title="${item.label}">
                    <span class="sidebar__item-icon">${item.icon}</span>
                    <span class="sidebar__item-text">${item.label}</span>
                </button>
            `).join('')}
            
            <div class="sidebar__nav-label" style="margin-top:8px">Configuración</div>
            <button class="sidebar__item" onclick="toggleDarkMode()" title="${isDark ? 'Modo claro' : 'Modo oscuro'}">
                <span class="sidebar__item-icon">${isDark ? Icons.sun : Icons.moon}</span>
                <span class="sidebar__item-text">${isDark ? 'Modo claro' : 'Modo oscuro'}</span>
            </button>
        </nav>
        <div class="sidebar__footer">
            <div class="sidebar__user-info">
                <div class="sidebar__user-avatar">
                    ${user?.foto_rostro ? `<img src="${user.foto_rostro}" alt="Avatar">` : Icons.user}
                </div>
                <div style="flex:1;min-width:0;">
                    <div class="sidebar__user-name">${user?.nombre || 'Usuario'} ${user?.apellido || ''}</div>
                    <div class="sidebar__user-role">DNI ${user?.dni || ''}</div>
                </div>
            </div>
            <button class="sidebar__item sidebar__item--logout" onclick="logout()" title="Cerrar sesión">
                <span class="sidebar__item-icon">${Icons.logout}</span>
                <span class="sidebar__item-text">Cerrar sesión</span>
            </button>
        </div>
    </aside>`;
}

function renderAppLayout(user, content) {
    const collapsed = _sidebarCollapsed ? 'sidebar-collapsed' : '';
    return `
    ${renderSidebar(user)}
    <main class="app-main ${collapsed}">
        ${content}
    </main>`;
}

function toggleSidebar() {
    _sidebarCollapsed = !_sidebarCollapsed;
    const sidebar = document.getElementById('app-sidebar');
    const main = document.querySelector('.app-main');
    if (sidebar) sidebar.classList.toggle('collapsed', _sidebarCollapsed);
    if (main) main.classList.toggle('sidebar-collapsed', _sidebarCollapsed);
    
    saveUserPreference('sidebar_collapsed', _sidebarCollapsed);
}

function toggleMobileSidebar() {
    _sidebarMobileOpen = !_sidebarMobileOpen;
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('mobile-open', _sidebarMobileOpen);
    if (overlay) overlay.classList.toggle('active', _sidebarMobileOpen);
}

function closeMobileSidebar() {
    _sidebarMobileOpen = false;
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('active');
}

function renderNavbar(user) {
    return renderSidebar(user);
}

function renderAdminNavbar(admin) {
    // Asegurar siempre modo claro en todas las cuentas de administrador
    document.body.classList.remove('dark');

    const currentPage = window.location.hash.slice(1) || 'admin-cuentas';
    const collapsed = _sidebarCollapsed ? 'collapsed' : '';
    
    const adminItems = [
        { id: 'admin-cuentas', icon: Icons.shield, label: 'Cuentas e Infracciones', rolKey: 'cuentas' },
        { id: 'admin-profesores', icon: Icons.teacher, label: 'Claustro Docente', rolKey: 'profesores' },
        { id: 'admin-pagos', icon: Icons.creditCard, label: 'Tesorería y Pagos', rolKey: 'pagos' },
        { id: 'admin-salud', icon: Icons.stethoscope, label: 'Aptitud Psicofísica', rolKey: 'salud' },
        { id: 'admin-turnos', icon: Icons.calendar, label: 'Turnos y Biometría', rolKey: 'turnos' },
    ];

    const rolLabels = {
        cuentas: 'Auditoría de Cuentas',
        profesores: 'Evaluación Teórica',
        pagos: 'Tesorería Municipal',
        salud: 'Auditoría Médica',
        turnos: 'Centro de Emisión'
    };
    const rolLabel = rolLabels[admin?.rol] || 'Gestión Municipal';

    return `
    <div class="sidebar-overlay ${_sidebarMobileOpen ? 'active' : ''}" onclick="toggleMobileSidebar()"></div>
    <button class="sidebar__mobile-toggle" onclick="toggleMobileSidebar()" aria-label="Abrir menú">
        <span style="display:flex;align-items:center">${Icons.menu}</span>
    </button>
    <aside class="sidebar sidebar--admin ${collapsed} ${_sidebarMobileOpen ? 'mobile-open' : ''}" id="app-sidebar">
        <div class="sidebar__admin-header">
            <div class="sidebar__admin-eyebrow">MUNICIPIO DE BARADERO</div>
            <div class="sidebar__admin-title">Panel Administrativo</div>
            <div class="sidebar__admin-subtitle">
                <span class="sidebar__admin-dot"></span>
                <span>${rolLabel}</span>
            </div>
        </div>
        <nav class="sidebar__nav">
            <div class="sidebar__nav-label">Gestión Operativa</div>
            ${adminItems.map(item => `
                <button class="sidebar__item ${currentPage === item.id ? 'active' : ''}" 
                        onclick="Router.navigate('${item.id}'); closeMobileSidebar();" 
                        title="${item.label}">
                    <span class="sidebar__item-icon">${item.icon}</span>
                    <span class="sidebar__item-text">${item.label}</span>
                </button>
            `).join('')}
        </nav>
        <div class="sidebar__footer">
            <div class="sidebar__user-info sidebar__user-info--admin">
                <div class="sidebar__user-avatar sidebar__user-avatar--admin">
                    ${Icons.userCheck || Icons.user}
                </div>
                <div style="flex:1;min-width:0;">
                    <div class="sidebar__user-name">${admin?.nombre || 'Funcionario'}</div>
                    <div class="sidebar__user-role">Rol: ${admin?.rol ? admin.rol.toUpperCase() : 'ADMIN'}</div>
                </div>
            </div>
            <button class="sidebar__item sidebar__item--logout" onclick="adminLogout()" title="Cerrar sesión">
                <span class="sidebar__item-icon">${Icons.logout}</span>
                <span class="sidebar__item-text">Cerrar sesión</span>
            </button>
        </div>
    </aside>`;
}

async function saltarDemoPaso(paso) {
    if (!paso) return;
    try {
        if (paso === 'completar') {
            await ApiService.saltarPaso('completar');
            Toast.success('Trámite completado al 100%. Licencia Digital emitida');
            sessionStorage.clear();
            const app = document.getElementById('app');
            if (app) DashboardPage.render(app);
            setTimeout(() => {
                if (window.Tutorial) {
                    window.Tutorial.startTutorialWithContext('licencia-completada', true);
                }
            }, 400);
            return;
        }
        await ApiService.saltarPaso(paso);
        Toast.success(`Modo Demo: Avanzado a ${paso.toUpperCase()}`);
        const app = document.getElementById('app');
        if (app && (window.location.hash.includes('dashboard') || !window.location.hash)) {
            DashboardPage.render(app);
        } else {
            Router.navigate(paso);
        }
    } catch (err) {
        Toast.error(err.message || 'Error al saltar paso en modo demo');
    }
}

function renderBackHeader(title, backTo = 'dashboard') {
    return `
    <div style="background:var(--bg-card);border-bottom:1px solid var(--border);padding:12px 24px">
        <div style="max-width:1200px;margin:0 auto;display:flex;align-items:center;gap:12px">
            <button class="btn btn-ghost btn-sm" style="display:flex;align-items:center;gap:4px" onclick="Router.navigate('${backTo}')">${Icons.back} Volver</button>
            <h1 style="font-size:1rem;font-weight:700">${title}</h1>
        </div>
    </div>`;
}

// ============================================================
// LOGOUT (Con Modal Estético de Confirmación)
// ============================================================
async function logout(skipConfirm = false) {
    if (!skipConfirm) {
        const confirmed = await ConfirmModal.show({
            title: '¿Seguro que querés cerrar sesión?',
            message: 'Tu sesión actual en el Portal del Ciudadano se cerrará y volverás a la pantalla de ingreso.',
            confirmText: 'Sí, cerrar sesión',
            cancelText: 'Cancelar',
            variant: 'danger',
            icon: Icons.logout
        });
        if (!confirmed) return;
    }
    ApiService.clearToken();
    Router.navigate('login');
    Toast.info('Sesión finalizada correctamente');
}

async function adminLogout(skipConfirm = false, silent = false) {
    if (!skipConfirm) {
        const confirmed = await ConfirmModal.show({
            title: '¿Seguro que querés cerrar sesión?',
            message: 'Se cerrará tu sesión administrativa activa en el Panel de Gestión de Licencias. Deberás volver a autenticarte para operar.',
            confirmText: 'Sí, cerrar sesión',
            cancelText: 'Cancelar',
            variant: 'danger',
            icon: Icons.logout
        });
        if (!confirmed) return;
    }
    ApiService.clearAdmin();
    Router.navigate('admin-login');
    if (!skipConfirm && !silent) {
        Toast.info('Sesión administrativa cerrada');
    }
}

// ============================================================
// DARK MODE (Solo para Portal Ciudadano — Deshabilitado en Admin)
// ============================================================
function toggleDarkMode() {
    const currentPage = window.location.hash.slice(1) || 'dashboard';
    if (currentPage.startsWith('admin')) {
        document.body.classList.remove('dark');
        return;
    }

    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    saveUserPreference('theme', isDark ? 'dark' : 'light');
    
    const app = document.getElementById('app');
    if (app && currentPage !== 'login' && currentPage !== 'registro' && currentPage !== 'admin-login') {
        Router.render(currentPage);
    }
}

function initTheme() {
    const currentPage = window.location.hash.slice(1) || 'login';
    if (currentPage.startsWith('admin')) {
        document.body.classList.remove('dark');
        return;
    }
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
        document.body.classList.add('dark');
    } else {
        document.body.classList.remove('dark');
    }
}

// ============================================================
// PREFERENCES PERSISTENCE
// ============================================================
async function saveUserPreference(key, value) {
    try {
        const token = ApiService.getToken();
        if (!token) return;
        
        const currentPrefs = JSON.parse(localStorage.getItem('userPreferences') || '{}');
        currentPrefs[key] = value;
        localStorage.setItem('userPreferences', JSON.stringify(currentPrefs));
        
        await ApiService.request('/user/preferences', {
            method: 'PUT',
            body: currentPrefs
        });
    } catch (e) {
        // Silently fail
    }
}

async function loadUserPreferences() {
    try {
        const token = ApiService.getToken();
        if (!token) return;
        
        const res = await ApiService.request('/user/preferences');
        if (res?.preferences) {
            const prefs = res.preferences;
            const currentPage = window.location.hash.slice(1) || 'login';
            if (prefs.theme === 'dark' && !currentPage.startsWith('admin')) {
                document.body.classList.add('dark');
                localStorage.setItem('theme', 'dark');
            }
            if (prefs.sidebar_collapsed) {
                _sidebarCollapsed = true;
            }
            localStorage.setItem('userPreferences', JSON.stringify(prefs));
        }
    } catch (e) {
        // Use local defaults
    }
}

// ============================================================
// ACTIVITY TRACKING
// ============================================================
function trackActivity(action, detail = '') {
    try {
        const token = ApiService.getToken();
        if (!token) return;
        ApiService.request('/user/activity', {
            method: 'POST',
            body: { action, detail }
        });
    } catch (e) {
        // Silently fail
    }
}

// ============================================================
// INITIALIZE
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    Router.init();
});
