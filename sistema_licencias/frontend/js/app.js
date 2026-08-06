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
        const adminPages = ['admin-pagos', 'admin-salud', 'admin-turnos'];

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
            case 'admin-pagos':
                AdminPagosPage.render(app);
                break;
            case 'admin-salud':
                AdminSaludPage.render(app);
                break;
            case 'admin-turnos':
                AdminTurnosPage.render(app);
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
// NAVBAR COMPONENT
// ============================================================
function renderNavbar(user) {
    return `
    <nav class="navbar">
        <div class="navbar__inner">
            <a class="navbar__brand" href="#dashboard" onclick="Router.navigate('dashboard')">
                <div class="navbar__brand-icon" style="display:flex;align-items:center;justify-content:center">${Icons.car}</div>
                <span>Muni Digital</span>
            </a>
            <div class="navbar__actions">
                <select class="form-input" style="height:32px;padding:0 8px;font-size:0.75rem;background:var(--warning-bg);color:#b45309;border:1px dashed var(--warning);font-weight:700;cursor:pointer" onchange="saltarDemoPaso(this.value); this.value='';" title="Navegar a cualquier sección (Modo Demo)">
                    <option value="" disabled selected>⚡ Saltear a...</option>
                    <option value="charlas">1. 🎬 Charlas en video</option>
                    <option value="formularios">2. 🏥 Formularios de Salud</option>
                    <option value="examen">3. 📝 Examen Teórico</option>
                    <option value="pago">4. 💳 Pago del Arancel</option>
                    <option value="practico">5. 🚗 Examen Práctico</option>
                    <option value="entrega">6. 📦 Entrega de Licencia</option>
                </select>
                <button class="btn btn-ghost btn-sm" onclick="toggleDarkMode()" title="Cambiar tema" id="darkModeBtn">
                    <span style="display:flex;align-items:center">${document.body.classList.contains('dark') ? Icons.sun : Icons.moon}</span>
                </button>
                <button class="btn btn-primary btn-sm tutorial-pulse-btn" onclick="if(window.Tutorial) window.Tutorial.startTutorialWithContext(window.location.hash.replace('#', '') || 'dashboard', true)" title="Ver tutorial">
                    <span style="display:flex;align-items:center;gap:4px">Ayuda</span>
                </button>
                <div class="navbar__user">
                    <span style="display:flex;align-items:center">${Icons.user}</span>
                    <span>${user?.nombre || 'Usuario'} ${user?.apellido || ''}</span>
                </div>
                <button class="btn btn-ghost btn-sm" onclick="logout()" title="Cerrar sesión">
                    <span style="display:flex;align-items:center;gap:4px">${Icons.logout} Salir</span>
                </button>
            </div>
        </div>
    </nav>`;
}

async function saltarDemoPaso(paso) {
    if (!paso) return;
    try {
        await ApiService.saltarPaso(paso);
        Toast.success(`⚡ Modo Demo: Se avanzó a la sección de ${paso.toUpperCase()}`);
        Router.navigate(paso);
    } catch (err) {
        Toast.success(`⚡ Modo Demo: Navegando a ${paso.toUpperCase()}`);
        Router.navigate(paso);
    }
}

function renderAdminNavbar(admin) {
    return `
    <nav class="navbar" style="background:rgba(23,37,84,0.95);border-bottom-color:rgba(255,255,255,0.1)">
        <div class="navbar__inner">
            <a class="navbar__brand" style="color:white" href="#admin-pagos">
                <div class="navbar__brand-icon" style="background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center">${Icons.settings}</div>
                <span>Admin Panel</span>
            </a>
            <div class="navbar__actions">
                <button class="btn btn-ghost btn-sm" onclick="toggleDarkMode()" title="Cambiar tema" style="color:rgba(255,255,255,0.6)" id="darkModeAdminBtn">
                    <span style="display:flex;align-items:center">${document.body.classList.contains('dark') ? Icons.sun : Icons.moon}</span>
                </button>
                <button class="btn btn-ghost btn-sm" style="color:${admin?.rol==='pagos'?'#38bdf8':'rgba(255,255,255,0.6)'}; display:flex;align-items:center;gap:4px" onclick="Router.navigate('admin-pagos')">${Icons.money} Pagos</button>
                <button class="btn btn-ghost btn-sm" style="color:${admin?.rol==='salud'?'#38bdf8':'rgba(255,255,255,0.6)'}; display:flex;align-items:center;gap:4px" onclick="Router.navigate('admin-salud')">${Icons.heart} Salud</button>
                <button class="btn btn-ghost btn-sm" style="color:${admin?.rol==='turnos'?'#38bdf8':'rgba(255,255,255,0.6)'}; display:flex;align-items:center;gap:4px" onclick="Router.navigate('admin-turnos')">${Icons.calendar} Turnos</button>
                <div class="navbar__user" style="background:rgba(255,255,255,0.1);color:white">
                    ${admin?.nombre || 'Admin'}
                </div>
                <button class="btn btn-ghost btn-sm" style="color:rgba(255,255,255,0.6)" onclick="adminLogout()">
                    <span style="display:flex;align-items:center">${Icons.logout}</span>
                </button>
            </div>
        </div>
    </nav>`;
}

function renderBackHeader(title, backTo = 'dashboard') {
    const user = ApiService.getUsuario();
    return `
    ${renderNavbar(user)}
    <div style="background:var(--bg-card);border-bottom:1px solid var(--border);padding:12px 20px">
        <div style="max-width:1200px;margin:0 auto;display:flex;align-items:center;gap:12px">
            <button class="btn btn-ghost btn-sm" style="display:flex;align-items:center;gap:4px" onclick="Router.navigate('${backTo}')">${Icons.back} Volver</button>
            <h1 style="font-size:1rem;font-weight:700">${title}</h1>
        </div>
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
// DARK MODE
// ============================================================
function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const icon = isDark ? Icons.sun : Icons.moon;
    const btn = document.getElementById('darkModeBtn');
    const adminBtn = document.getElementById('darkModeAdminBtn');
    if (btn) btn.innerHTML = `<span style="display:flex;align-items:center">${icon}</span>`;
    if (adminBtn) adminBtn.innerHTML = `<span style="display:flex;align-items:center">${icon}</span>`;
}

function initTheme() {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark');
    }
}

// ============================================================
// INITIALIZE
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    Router.init();
});
