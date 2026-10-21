/**
 * App Principal - Router SPA + Toast System + Page Manager
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
            success: Icons.check,
            error: Icons.x,
            warning: Icons.alert,
            info: Icons.info
        };

        toast.innerHTML = `
            <span style="font-size:1.1rem;flex-shrink:0;display:flex;align-items:center">${icons[type] || Icons.info}</span>
            <span class="toast__message">${message}</span>
            <button class="toast__close" onclick="this.parentElement.remove()">×</button>
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
// SPA ROUTER
// ============================================================
class Router {
    static currentPage = null;

    static navigate(page, params = {}) {
        this.currentPage = page;
        window.location.hash = page;
        this.render(page, params);
    }

    static init() {
        window.addEventListener('hashchange', () => {
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

        if (!publicPages.includes(page) && !adminPages.includes(page)) {
            const token = ApiService.getToken();
            if (!token) {
                this.navigate('login');
                return;
            }
        }

        if (adminPages.includes(page)) {
            const adminToken = ApiService.getAdminToken();
            if (!adminToken) {
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

        // Bari launcher visibility depends on the current page
        if (window.Tutorial && typeof window.Tutorial.syncLauncher === 'function') {
            window.Tutorial.syncLauncher();
        }
    }
}

// ============================================================
// SIDEBAR COMPONENT (Replaces Navbar)
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

    return `
    <div class="sidebar-overlay ${_sidebarMobileOpen ? 'active' : ''}" onclick="toggleMobileSidebar()"></div>
    <button class="sidebar__mobile-toggle" onclick="toggleMobileSidebar()" aria-label="Abrir menú">
        <span style="display:flex;align-items:center">${Icons.menu || '☰'}</span>
    </button>
    <aside class="sidebar ${collapsed} ${_sidebarMobileOpen ? 'mobile-open' : ''}" id="app-sidebar">
        <div class="sidebar__header">
            <div class="sidebar__logo">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
            </div>
            <div class="sidebar__brand">
                <img class="sidebar__isologo" src="img/isologo-baradero.svg" alt="Municipio de Baradero">
                <span class="sidebar__brand-text">Ciudadano Digital</span>
            </div>
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
            <button class="sidebar__item" onclick="logout()" title="Cerrar sesión">
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
    
    // Persist preference
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

// Keep renderNavbar for backward compatibility (pages that use it)
// Returns sidebar HTML only - #app gets margin from CSS automatically
function renderNavbar(user) {
    return renderSidebar(user);
}

function renderAdminNavbar(admin) {
    const currentPage = window.location.hash.slice(1) || 'admin-cuentas';
    const collapsed = _sidebarCollapsed ? 'collapsed' : '';
    
    const adminItems = [
        { id: 'admin-cuentas', icon: Icons.shield, label: 'Cuentas' },
        { id: 'admin-profesores', icon: Icons.teacher || Icons.user, label: 'Profesores' },
        { id: 'admin-pagos', icon: Icons.money || Icons.credit, label: 'Pagos' },
        { id: 'admin-salud', icon: Icons.heart || Icons.check, label: 'Salud' },
        { id: 'admin-turnos', icon: Icons.calendar || Icons.clock, label: 'Turnos' },
    ];

    return `
    <div class="sidebar-overlay ${_sidebarMobileOpen ? 'active' : ''}" onclick="toggleMobileSidebar()"></div>
    <button class="sidebar__mobile-toggle" onclick="toggleMobileSidebar()" aria-label="Abrir menú">
        <span style="display:flex;align-items:center">${Icons.menu || '☰'}</span>
    </button>
    <aside class="sidebar ${collapsed} ${_sidebarMobileOpen ? 'mobile-open' : ''}" id="app-sidebar">
        <div class="sidebar__header">
            <div class="sidebar__logo">${Icons.settings}</div>
            <div class="sidebar__brand">
                <img class="sidebar__isologo" src="img/isologo-baradero.svg" alt="Municipio de Baradero">
                <span class="sidebar__brand-text">Panel Administrativo</span>
            </div>
        </div>
        <nav class="sidebar__nav">
            <div class="sidebar__nav-label">Gestión</div>
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
            <div class="sidebar__user-info">
                <div class="sidebar__user-avatar">${Icons.user}</div>
                <div style="flex:1;min-width:0;">
                    <div class="sidebar__user-name">${admin?.nombre || 'Admin'}</div>
                    <div class="sidebar__user-role">${admin?.rol || 'administrador'}</div>
                </div>
            </div>
            <button class="sidebar__item" onclick="adminLogout()" title="Cerrar sesión">
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
// AUTH BRAND HEADER (shared by login / registro / admin-login)
// ============================================================
function renderAuthBrand(title, accent, subtitle) {
    return `
    <div class="login-logo animate-fadeIn">
        <img class="login-logo__isologo" src="img/isologo-baradero.svg" alt="Municipio de Baradero">
        <h1 class="login-logo__text">${title} <span class="login-logo__accent">${accent}</span></h1>
        <p class="login-logo__sub">${subtitle}</p>
    </div>`;
}

// ============================================================
// LOGOUT
// ============================================================
function logout() {
    ApiService.clearToken();
    Router.navigate('login');
    Toast.info('Sesión cerrada');
}

function adminLogout() {
    ApiService.clearAdmin();
    Router.navigate('admin-login');
    Toast.info('Sesión admin cerrada');
}

// ============================================================
// THEME (single light theme — Baradero institutional)
// ============================================================
function initTheme() {
    // The dark mode was removed: clear any stale preference from older sessions.
    document.body.classList.remove('dark');
    localStorage.removeItem('theme');
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
        
        await ApiService.request('/api/user/preferences', 'PUT', currentPrefs);
    } catch (e) {
        // Silently fail — preferences are not critical
    }
}

async function loadUserPreferences() {
    try {
        const token = ApiService.getToken();
        if (!token) return;
        
        const res = await ApiService.request('/api/user/preferences');
        if (res?.preferences) {
            const prefs = res.preferences;
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
        ApiService.request('/api/user/activity', 'POST', { action, detail });
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

